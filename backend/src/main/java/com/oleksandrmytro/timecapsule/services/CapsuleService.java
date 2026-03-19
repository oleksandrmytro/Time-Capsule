package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.CreateCapsuleRequest;
import com.oleksandrmytro.timecapsule.dto.ShareCapsuleRequest;
import com.oleksandrmytro.timecapsule.events.CapsuleStatusEvent;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.Share;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleStatus;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleVisibility;
import com.oleksandrmytro.timecapsule.models.enums.ChatMessageStatus;
import com.oleksandrmytro.timecapsule.models.enums.ChatMessageType;
import com.oleksandrmytro.timecapsule.models.enums.ShareRole;
import com.oleksandrmytro.timecapsule.models.enums.ShareStatus;
import com.oleksandrmytro.timecapsule.models.enums.ShareVia;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.repositories.FollowRepository;
import com.oleksandrmytro.timecapsule.repositories.ShareRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.responses.CapsuleResponse;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CapsuleService {

    private final CapsuleRepository capsuleRepository;
    private final MongoTemplate mongoTemplate;
    private final CapsuleNotificationService capsuleNotificationService;
    private final UserRepository userRepository;
    private final FollowRepository followRepository;
    private final ShareRepository shareRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;

    public CapsuleService(CapsuleRepository capsuleRepository, MongoTemplate mongoTemplate, CapsuleNotificationService capsuleNotificationService, UserRepository userRepository, FollowRepository followRepository, ShareRepository shareRepository, SimpMessagingTemplate messagingTemplate, ChatService chatService) {
        this.capsuleRepository = capsuleRepository;
        this.mongoTemplate = mongoTemplate;
        this.capsuleNotificationService = capsuleNotificationService;
        this.userRepository = userRepository;
        this.followRepository = followRepository;
        this.shareRepository = shareRepository;
        this.messagingTemplate = messagingTemplate;
        this.chatService = chatService;
    }

    private void notifyOwner(String ownerId, Capsule capsule) {
        userRepository.findById(ownerId).ifPresent(user ->
                capsuleNotificationService.sendStatus(user.getId(), toEvent(capsule))
        );
    }

    public CapsuleResponse create(String ownerId, CreateCapsuleRequest request) {
        // Перевірка бізнес-правил
        validateCapsuleRequest(request);

        CapsuleVisibility visibility = CapsuleVisibility.fromValue(request.getVisibility());

        Capsule capsule = new Capsule();
        capsule.setOwnerId(new ObjectId(ownerId));
        capsule.setTitle(request.getTitle());
        capsule.setBody(request.getBody());
        capsule.setVisibility(visibility);
        capsule.setStatus(request.getStatus());
        capsule.setUnlockAt(request.getUnlockAt());
        capsule.setExpiresAt(request.getExpiresAt());
        capsule.setAllowComments(request.getAllowComments() != null ? request.getAllowComments() : true);
        capsule.setAllowReactions(request.getAllowReactions() != null ? request.getAllowReactions() : true);
        capsule.setTags(request.getTags());
        capsule.setCoverImageUrl(request.getCoverImageUrl());
        capsule.setMedia(mapMediaRequest(request.getMedia()));

        // Only set location if provided
        if (request.getLocation() != null) {
            capsule.setLocation(mapGeo(request.getLocation()));
        }

        // Генерація токена для спільних капсул
        if (CapsuleVisibility.SHARED.equals(visibility)) {
            capsule.setShareToken(generateShareToken());
        }

        // Зберігаємо відмічену дату створення/оновлення
        capsule.setCreatedAt(Instant.now());
        capsule.setUpdatedAt(Instant.now());

        Capsule saved = capsuleRepository.save(capsule);
        return toResponse(saved);
    }

    private void validateCapsuleRequest(CreateCapsuleRequest request) {
        CapsuleStatus status = CapsuleStatus.fromValue(request.getStatus());
        if (CapsuleStatus.SEALED.equals(status)) {
            if (request.getUnlockAt() == null) {
                throw new IllegalArgumentException("Unlock date is required for sealed capsules");
            }
            if (request.getUnlockAt().isBefore(Instant.now())) {
                throw new IllegalArgumentException("Unlock date must be in the future for sealed capsules");
            }
        }

        if (request.getExpiresAt() != null && request.getUnlockAt() != null) {
            if (request.getExpiresAt().isBefore(request.getUnlockAt())) {
                throw new IllegalArgumentException("Expiration date must be after unlock date");
            }
        }
    }

    private String generateShareToken() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    public List<CapsuleResponse> listMine(String ownerId) {
        ObjectId owner = new ObjectId(ownerId);
        // Знаходимо капсули, що вже мають бути відкриті, щоб надіслати нотифікації пізніше
        Query readyQuery = new Query(
                Criteria.where("ownerId").is(owner)
                        .and("status").is(CapsuleStatus.SEALED.getValue())
                        .and("deletedAt").is(null)
                        .and("unlockAt").lte(Instant.now())
        );
        var ready = mongoTemplate.find(readyQuery, Capsule.class);

        // Масово знімаємо блокування для готових капсул (shard-key targeted)
        Update unlockUpdate = new Update()
                .set("status", CapsuleStatus.OPENED.getValue())
                .set("openedAt", Instant.now())
                .set("updatedAt", Instant.now());
        mongoTemplate.updateMulti(readyQuery, unlockUpdate, Capsule.class);

        // Надсилаємо повідомлення про відкриття тим, хто був у черзі
        ready.forEach(c -> notifyOwner(ownerId, toUnlocked(c)));

        return capsuleRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Повертає публічні капсули для заданого користувача (видимі всім).
     * Якщо запит робить власник — повертає усі капсули (включно з приватними).
     */
    public List<CapsuleResponse> listUserCapsules(String userId, String requesterId) {
        ObjectId owner = new ObjectId(userId);
        if (userId.equals(requesterId)) {
            // Власний профіль — повертаємо всі капсули
            return capsuleRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner)
                    .stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
        }
        // Інший користувач — тільки публічні капсули
        return capsuleRepository.findByOwnerIdAndVisibilityAndDeletedAtIsNullOrderByCreatedAtDesc(owner, CapsuleVisibility.PUBLIC.getValue())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public CapsuleResponse getMine(String id, String ownerId) {
        ObjectId owner = new ObjectId(ownerId);

        /**
         * Забезпечує відкриття капсули одразу після настання unlockAt, якщо власник саме зараз її відкриває.
         * Це підстраховує, якщо шедулер ще не завершив обробку: капсула буде відкритою саме у момент запиту.
         */
        Query unlockQuery = new Query(
                Criteria.where("_id").is(id)
                        .and("ownerId").is(owner)
                        .and("status").is(CapsuleStatus.SEALED.getValue())
                        .and("deletedAt").is(null)
                        .and("unlockAt").lte(Instant.now())
        );
        Update unlockUpdate = new Update()
                .set("status", CapsuleStatus.OPENED.getValue())
                .set("openedAt", Instant.now())
                .set("updatedAt", Instant.now());
        Capsule unlocked = mongoTemplate.findAndModify(
                unlockQuery,
                unlockUpdate,
                FindAndModifyOptions.options().returnNew(true),
                Capsule.class
        );

        if (unlocked != null) {
            notifyOwner(ownerId, unlocked);
            return toResponse(unlocked);
        }

        // 1) Owner access
        Capsule capsule = capsuleRepository.findByIdAndOwnerIdAndDeletedAtIsNull(id, owner)
                .orElse(null);

        // 2) Shared access (if current user is grantee)
        if (capsule == null) {
            ObjectId capsuleOid = new ObjectId(id);
            boolean sharedWithUser = shareRepository.existsByCapsuleIdAndGranteeIdAndDeletedAtIsNull(capsuleOid, owner);
            if (sharedWithUser) {
                capsule = capsuleRepository.findByIdAndDeletedAtIsNull(id)
                        .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));
            }
        }

        if (capsule == null) {
            throw new IllegalArgumentException("Capsule not found");
        }

        return toResponse(capsule);
    }

    public CapsuleResponse unlockCapsule(String id, String ownerId) {
        ObjectId owner = new ObjectId(ownerId);

        Query query = new Query(
                Criteria.where("_id").is(id)
                        .and("ownerId").is(owner)
                        .and("deletedAt").is(null)
                        .and("status").is(CapsuleStatus.SEALED.getValue())
                        .and("unlockAt").lte(Instant.now())
        );

        Update update = new Update()
                .set("status", CapsuleStatus.OPENED.getValue())
                .set("openedAt", Instant.now())
                .set("updatedAt", Instant.now());

        Capsule updated = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                Capsule.class
        );

        if (updated == null) {
            throw new IllegalArgumentException("Capsule cannot be unlocked yet or not found");
        }

        capsuleNotificationService.sendStatus(
                userRepository.findById(ownerId).map(u -> u.getId()).orElse(ownerId),
                toEvent(updated)
        );
        return toResponse(updated);
    }

    public void shareCapsule(String capsuleId, String sharerId, List<String> userIds) {
        // Шукаємо капсулу тільки за id та deletedAt (без перевірки ownerId)
        Query findQuery = new Query(Criteria.where("_id").is(capsuleId).and("deletedAt").is(null));
        Capsule capsule = mongoTemplate.findOne(findQuery, Capsule.class);
        if (capsule == null) throw new IllegalArgumentException("Capsule not found");

        // Перевіряємо права доступу:
        // - власник може ділитись завжди
        // - інші користувачі можуть ділитись тільки публічними капсулами
        boolean isOwner = capsule.getOwnerId() != null && capsule.getOwnerId().toHexString().equals(sharerId);
        boolean isPublic = "public".equalsIgnoreCase(capsule.getVisibility());
        if (!isOwner && !isPublic) {
            throw new IllegalArgumentException("You can only share public capsules");
        }

        // shareToken генерується/зберігається тільки власником
        String shareToken = capsule.getShareToken();
        if (isOwner && (shareToken == null || shareToken.isEmpty())) {
            shareToken = generateShareToken();
            Query ownerQuery = new Query(
                Criteria.where("_id").is(capsuleId)
                    .and("ownerId").is(capsule.getOwnerId())
                    .and("deletedAt").is(null)
            );
            Update update = new Update()
                    .set("shareToken", shareToken)
                    .set("updatedAt", Instant.now());
            mongoTemplate.updateFirst(ownerQuery, update, Capsule.class);
        }

        if (CollectionUtils.isEmpty(userIds)) return;   // Жодного користувача для шарингу — виходимо

        // Ім'я того, хто ділиться (не обов'язково власник)
        String senderName = userRepository.findById(sharerId)
                .map(u -> u.getUsernameField() != null ? u.getUsernameField() : u.getEmail())
                .orElse("Someone");

        for (String uid : userIds) {
            // Пропускаємо, якщо вже шарено
            ObjectId capsOid = new ObjectId(capsuleId);
            ObjectId granteeOid = new ObjectId(uid);
            if (shareRepository.existsByCapsuleIdAndGranteeIdAndDeletedAtIsNull(capsOid, granteeOid)) continue;

            // Створюємо запис про шаринг у колекції shares (grantedBy = той, хто ділиться)
            Share share = new Share(capsuleId, uid, sharerId);
            share.setRole(ShareRole.VIEWER);
            share.setStatus(ShareStatus.PENDING);
            share.setVia(ShareVia.INVITE);
            if (shareToken != null) share.setShareToken(shareToken);
            shareRepository.save(share);

            String shareText = senderName + " shared a capsule: " + (capsule.getTitle() != null ? capsule.getTitle() : "");
            chatService.saveShareMessage(sharerId, uid, capsuleId, capsule.getTitle(), shareText);

            // Відправляємо повідомлення через WebSocket до отримувача
            Map<String, Object> chatMsg = Map.of(
                    "id", UUID.randomUUID().toString(),
                    "type", ChatMessageType.CAPSULE_SHARE.getValue(),
                    "text", shareText,
                    "capsuleId", capsuleId,
                    "capsuleTitle", capsule.getTitle() != null ? capsule.getTitle() : "",
                    "fromUserId", sharerId,
                    "fromMe", false,
                    "timestamp", Instant.now().toString(),
                    "status", ChatMessageStatus.SENT.getValue()
            );
            messagingTemplate.convertAndSendToUser(uid, "/queue/chat", chatMsg);
        }
    }

    /**
     * Перетворює капсулу в подію CapsuleStatusEvent, щоб надсилати її через WebSocket.
     * @param capsule
     * @return
     */
    private CapsuleStatusEvent toEvent(Capsule capsule) {
        boolean isLocked = isLocked(capsule.getStatus(), capsule.getUnlockAt());
        CapsuleStatus status = CapsuleStatus.fromValue(capsule.getStatus());
        String statusValue = status != null ? status.getValue() : capsule.getStatus();
        return new CapsuleStatusEvent(capsule.getId(), statusValue, isLocked, capsule.getUnlockAt(), capsule.getOpenedAt(), capsule.getTags());
    }

    private Capsule toUnlocked(Capsule capsule) {
        capsule.setStatus(CapsuleStatus.OPENED.getValue());
        capsule.setOpenedAt(Instant.now());
        capsule.setUpdatedAt(Instant.now());
        return capsule;
    }

    /**
     * Перетворює Capsule у CapsuleResponse для API-відповіді з урахуванням блокування.
     * @param capsule
     * @return
     */
    private CapsuleResponse toResponse(Capsule capsule) {
        CapsuleResponse resp = new CapsuleResponse();
        resp.setId(capsule.getId());
        resp.setOwnerId(capsule.getOwnerId() != null ? capsule.getOwnerId().toHexString() : null);
        resp.setTitle(capsule.getTitle());

        boolean isLocked = isLocked(capsule.getStatus(), capsule.getUnlockAt());

        resp.setIsLocked(isLocked);
        if (isLocked) {
            resp.setBody(null);
            resp.setMedia(null);
        } else {
            resp.setBody(capsule.getBody());
            resp.setMedia(mapMediaResponse(capsule.getMedia()));
        }

        resp.setVisibility(capsule.getVisibility());
        CapsuleStatus status = CapsuleStatus.fromValue(capsule.getStatus());
        resp.setStatus(status != null ? status.getValue() : capsule.getStatus());
        resp.setUnlockAt(capsule.getUnlockAt());
        resp.setOpenedAt(capsule.getOpenedAt());
        resp.setExpiresAt(capsule.getExpiresAt());
        resp.setAllowComments(capsule.getAllowComments());
        resp.setAllowReactions(capsule.getAllowReactions());
        resp.setShareToken(capsule.getShareToken());
        resp.setTags(capsule.getTags());
        resp.setCoverImageUrl(capsule.getCoverImageUrl());
        resp.setLocation(mapGeo(capsule.getLocation()));
        resp.setCreatedAt(capsule.getCreatedAt());
        resp.setUpdatedAt(capsule.getUpdatedAt());
        return resp;
    }

    private List<CapsuleResponse.Media> mapMediaResponse(List<Capsule.Media> media) {
        if (media == null) return null;
        return media.stream().map(m -> {
            CapsuleResponse.Media rm = new CapsuleResponse.Media();
            rm.setId(m.getId() != null ? m.getId() : m.getUrl());
            rm.setUrl(m.getUrl());
            rm.setType(m.getType());
            rm.setMeta(m.getMeta());
            return rm;
        }).collect(Collectors.toList());
    }

    private List<Capsule.Media> mapMediaRequest(List<CreateCapsuleRequest.MediaDto> media) {
        if (media == null) return null;
        return media.stream().map(m -> {
            Capsule.Media cm = new Capsule.Media();
            cm.setId(m.getId() != null ? m.getId() : m.getUrl());
            cm.setUrl(m.getUrl());
            cm.setType(m.getType());
            cm.setMeta(m.getMeta());
            return cm;
        }).collect(Collectors.toList());
    }

    private CapsuleResponse.GeoPoint mapGeo(Capsule.GeoPoint geo) {
        if (geo == null) return null;
        CapsuleResponse.GeoPoint g = new CapsuleResponse.GeoPoint();
        g.setType(geo.getType());
        g.setCoordinates(geo.getCoordinates());
        return g;
    }

    private Capsule.GeoPoint mapGeo(CreateCapsuleRequest.GeoPointDto geo) {
        if (geo == null) return null;
        Capsule.GeoPoint g = new Capsule.GeoPoint();
        g.setType(geo.getType());
        g.setCoordinates(geo.getCoordinates());
        return g;
    }

    private boolean isLocked(String status, Instant unlockAt) {
        CapsuleStatus st = CapsuleStatus.fromValue(status);
        return CapsuleStatus.SEALED.equals(st) && unlockAt != null && Instant.now().isBefore(unlockAt);
    }

    /**
     * Повертає капсули користувача з unlockAt у заданому діапазоні дат (для календаря).
     */
    public List<CapsuleResponse> listByDateRange(String ownerId, Instant from, Instant to) {
        ObjectId owner = new ObjectId(ownerId);
        Query query = new Query(
                Criteria.where("ownerId").is(owner)
                        .and("deletedAt").is(null)
                        .and("unlockAt").gte(from).lte(to)
        );
        return mongoTemplate.find(query, Capsule.class)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Повертає капсулу залежно від доступу глядача: власник/спільний доступ або публічна капсула.
     */
    public CapsuleResponse getAccessible(String id, String viewerId) {
        // Якщо користувач авторизований, спочатку пробуємо власницький/шаринг-режим
        if (viewerId != null) {
            try {
                return getMine(id, viewerId);
            } catch (IllegalArgumentException ex) {
                // Якщо доступу нема — перевіряємо публічний режим
            }
        }

        // Публічний доступ: будь-хто (навіть без логіну) може переглядати public капсули
        Capsule capsule = capsuleRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));

        if (CapsuleVisibility.PUBLIC.equals(CapsuleVisibility.fromValue(capsule.getVisibility()))) {
            return toResponse(capsule);
        }

        throw new IllegalArgumentException("Capsule not found or not accessible");
    }
}
