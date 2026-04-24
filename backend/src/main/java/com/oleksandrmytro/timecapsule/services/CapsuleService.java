package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.CreateCapsuleRequest;
import com.oleksandrmytro.timecapsule.dto.UpdateCapsuleRequest;
import com.oleksandrmytro.timecapsule.events.CapsuleStatusEvent;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.Share;
import com.oleksandrmytro.timecapsule.models.User;
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
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CapsuleService {

    private static final String GEO_MARKERS_COLLECTION = "geomarkers";

    private final CapsuleRepository capsuleRepository;
    private final MongoTemplate mongoTemplate;
    private final CapsuleNotificationService capsuleNotificationService;
    private final UserRepository userRepository;
    private final FollowRepository followRepository;
    private final ShareRepository shareRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;
    private final EmailService emailService;

    public CapsuleService(CapsuleRepository capsuleRepository, MongoTemplate mongoTemplate, CapsuleNotificationService capsuleNotificationService, UserRepository userRepository, FollowRepository followRepository, ShareRepository shareRepository, SimpMessagingTemplate messagingTemplate, ChatService chatService, EmailService emailService) {
        this.capsuleRepository = capsuleRepository;
        this.mongoTemplate = mongoTemplate;
        this.capsuleNotificationService = capsuleNotificationService;
        this.userRepository = userRepository;
        this.followRepository = followRepository;
        this.shareRepository = shareRepository;
        this.messagingTemplate = messagingTemplate;
        this.chatService = chatService;
        this.emailService = emailService;
    }

    private void notifyOwner(String ownerId, Capsule capsule) {
        userRepository.findById(ownerId).ifPresent(user ->
                capsuleNotificationService.sendStatus(user.getId(), toEvent(capsule))
        );
        emailService.sendCapsuleOpened(ownerId, capsule);
    }

    public CapsuleResponse create(String ownerId, CreateCapsuleRequest request) {
        // Перевірка бізнес-правил
        validateCapsuleRequest(request);

        CapsuleVisibility visibility = CapsuleVisibility.fromValue(request.getVisibility());
        CapsuleStatus status = resolveCreateStatus(request);
        Instant unlockAt = normalizeUnlockAt(status, request.getUnlockAt());
        Instant expiresAt = normalizeExpiresAt(status, unlockAt, request.getExpiresAt());
        Instant now = Instant.now();
        boolean publicVisibility = CapsuleVisibility.PUBLIC.equals(visibility) && !status.isDraft();

        Capsule capsule = new Capsule();
        capsule.setOwnerId(new ObjectId(ownerId));
        capsule.setTitle(request.getTitle().trim());
        capsule.setBody(normalizeBlankToNull(request.getBody()));
        capsule.setVisibility(visibility);
        capsule.setStatus(status);
        capsule.setUnlockAt(unlockAt);
        capsule.setExpiresAt(expiresAt);
        capsule.setOpenedAt(CapsuleStatus.OPENED.equals(status) ? now : null);
        capsule.setAllowComments(publicVisibility && Boolean.TRUE.equals(request.getAllowComments()));
        capsule.setAllowReactions(publicVisibility && Boolean.TRUE.equals(request.getAllowReactions()));
        capsule.setTags(normalizeTags(request.getTags()));
        capsule.setCoverImageUrl(normalizeBlankToNull(request.getCoverImageUrl()));
        capsule.setMedia(mapMediaRequest(request.getMedia()));

        Capsule.GeoPoint requestedLocation = normalizeGeo(mapGeo(request.getLocation()));
        capsule.setLocation(null);
        capsule.setGeoMarkerId(null);

        // Генерація токена для спільних капсул
        if (CapsuleVisibility.SHARED.equals(visibility) && !status.isDraft()) {
            capsule.setShareToken(generateShareToken());
        }

        // Зберігаємо відмічену дату створення/оновлення
        capsule.setCreatedAt(now);
        capsule.setUpdatedAt(now);

        Capsule saved = capsuleRepository.save(capsule);
        if (requestedLocation != null) {
            try {
                ObjectId geoMarkerId = upsertGeoMarker(saved, requestedLocation, visibility);
                saved.setGeoMarkerId(geoMarkerId);
                saved.setLocation(null);
                mongoTemplate.updateFirst(
                        new Query(Criteria.where("_id").is(saved.getId()).and("ownerId").is(saved.getOwnerId()).and("deletedAt").is(null)),
                        new Update()
                                .set("geoMarkerId", geoMarkerId)
                                .unset("location")
                                .set("updatedAt", Instant.now()),
                        Capsule.class
                );
            } catch (RuntimeException ex) {
                // Fallback for resilience: keep location in capsule if geomarker write failed.
                saved.setLocation(requestedLocation);
                mongoTemplate.updateFirst(
                        new Query(Criteria.where("_id").is(saved.getId()).and("ownerId").is(saved.getOwnerId()).and("deletedAt").is(null)),
                        new Update()
                                .set("location", requestedLocation)
                                .set("updatedAt", Instant.now()),
                        Capsule.class
                );
            }
        }
        return toResponse(saved);
    }

    public CapsuleResponse getEditable(String capsuleId, String actorId) {
        User actor = requireActor(actorId);
        Capsule capsule = capsuleRepository.findByIdAndDeletedAtIsNull(capsuleId)
                .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));

        ensureCanEdit(capsule, actor);
        return toResponse(capsule, null, true);
    }

    public CapsuleResponse update(String capsuleId, String actorId, UpdateCapsuleRequest request) {
        User actor = requireActor(actorId);
        Capsule capsule = capsuleRepository.findByIdAndDeletedAtIsNull(capsuleId)
                .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));

        boolean isAdmin = actor.getRole() == User.Role.ADMIN;
        ensureCanEdit(capsule, actor);
        validateCapsuleUpdateRequest(request, isAdmin);

        CapsuleVisibility visibility = CapsuleVisibility.fromValue(request.getVisibility());
        CapsuleStatus targetStatus = CapsuleStatus.fromValue(request.getStatus());
        Instant unlockAt = normalizeUnlockAt(targetStatus, request.getUnlockAt());
        Instant expiresAt = normalizeExpiresAt(targetStatus, unlockAt, request.getExpiresAt());

        capsule.setTitle(request.getTitle().trim());
        capsule.setBody(normalizeBlankToNull(request.getBody()));
        capsule.setVisibility(visibility);
        capsule.setStatus(targetStatus);
        capsule.setUnlockAt(unlockAt);
        capsule.setExpiresAt(expiresAt);

        boolean publicVisibility = CapsuleVisibility.PUBLIC.equals(visibility) && !CapsuleStatus.DRAFT.equals(targetStatus);
        capsule.setAllowComments(publicVisibility && Boolean.TRUE.equals(request.getAllowComments()));
        capsule.setAllowReactions(publicVisibility && Boolean.TRUE.equals(request.getAllowReactions()));
        capsule.setTags(normalizeTags(request.getTags()));
        capsule.setCoverImageUrl(normalizeBlankToNull(request.getCoverImageUrl()));
        capsule.setMedia(mapUpdateMediaRequest(request.getMedia()));

        Instant now = Instant.now();
        if (CapsuleStatus.OPENED.equals(targetStatus)) {
            if (capsule.getOpenedAt() == null) {
                capsule.setOpenedAt(now);
            }
        } else {
            capsule.setOpenedAt(null);
        }

        if (CapsuleStatus.DRAFT.equals(targetStatus)) {
            capsule.setShareToken(null);
        } else if (CapsuleVisibility.SHARED.equals(visibility) &&
                (capsule.getShareToken() == null || capsule.getShareToken().isBlank())) {
            capsule.setShareToken(generateShareToken());
        }

        Capsule.GeoPoint requestedLocation = normalizeGeo(mapGeo(request.getLocation()));
        if (requestedLocation == null) {
            archiveGeoMarkers(capsule);
            capsule.setGeoMarkerId(null);
            capsule.setLocation(null);
        } else {
            try {
                ObjectId markerId = upsertGeoMarker(capsule, requestedLocation, visibility);
                capsule.setGeoMarkerId(markerId);
                capsule.setLocation(null);
            } catch (RuntimeException ex) {
                // Fallback for resilience: preserve location in capsule document.
                capsule.setGeoMarkerId(null);
                capsule.setLocation(requestedLocation);
            }
        }

        capsule.setUpdatedAt(now);
        Query persistQuery = new Query(
                Criteria.where("_id").is(capsule.getId())
                        .and("ownerId").is(capsule.getOwnerId())
                        .and("deletedAt").is(null)
        );
        Update persistUpdate = new Update()
                .set("title", capsule.getTitle())
                .set("visibility", capsule.getVisibility())
                .set("status", capsule.getStatus())
                .set("allowComments", capsule.getAllowComments())
                .set("allowReactions", capsule.getAllowReactions())
                .set("tags", capsule.getTags() != null ? capsule.getTags() : List.of())
                .set("media", capsule.getMedia() != null ? capsule.getMedia() : List.of())
                .set("updatedAt", capsule.getUpdatedAt());

        if (capsule.getBody() != null) {
            persistUpdate.set("body", capsule.getBody());
        } else {
            persistUpdate.unset("body");
        }

        if (capsule.getExpiresAt() != null) {
            persistUpdate.set("expiresAt", capsule.getExpiresAt());
        } else {
            persistUpdate.unset("expiresAt");
        }

        if (capsule.getUnlockAt() != null) {
            persistUpdate.set("unlockAt", capsule.getUnlockAt());
        } else {
            persistUpdate.unset("unlockAt");
        }

        if (capsule.getCoverImageUrl() != null) {
            persistUpdate.set("coverImageUrl", capsule.getCoverImageUrl());
        } else {
            persistUpdate.unset("coverImageUrl");
        }

        if (capsule.getOpenedAt() != null) {
            persistUpdate.set("openedAt", capsule.getOpenedAt());
        } else {
            persistUpdate.unset("openedAt");
        }

        if (capsule.getShareToken() != null && !capsule.getShareToken().isBlank()) {
            persistUpdate.set("shareToken", capsule.getShareToken());
        } else {
            persistUpdate.unset("shareToken");
        }

        if (capsule.getGeoMarkerId() != null) {
            persistUpdate.set("geoMarkerId", capsule.getGeoMarkerId());
        } else {
            persistUpdate.unset("geoMarkerId");
        }

        if (capsule.getLocation() != null) {
            persistUpdate.set("location", capsule.getLocation());
        } else {
            persistUpdate.unset("location");
        }

        mongoTemplate.updateFirst(persistQuery, persistUpdate, Capsule.class);
        Capsule saved = mongoTemplate.findOne(persistQuery, Capsule.class);
        if (saved == null) {
            throw new IllegalStateException("Failed to persist capsule update");
        }
        return toResponse(saved, null, true);
    }

    private User requireActor(String actorId) {
        if (actorId == null || actorId.isBlank()) {
            throw new SecurityException("Unauthorized");
        }
        return userRepository.findById(actorId)
                .orElseThrow(() -> new SecurityException("Unauthorized"));
    }

    private void ensureCanEdit(Capsule capsule, User actor) {
        boolean isAdmin = actor.getRole() == User.Role.ADMIN;
        boolean isOwner = capsule.getOwnerId() != null && Objects.equals(capsule.getOwnerId().toHexString(), actor.getId());
        if (!isOwner && !isAdmin) {
            throw new SecurityException("Only owner or admin can edit this capsule");
        }

        CapsuleStatus currentStatus = CapsuleStatus.fromValue(capsule.getStatus());
        if (!isAdmin && CapsuleStatus.OPENED.equals(currentStatus)) {
            throw new SecurityException("Opened capsules cannot be edited");
        }
    }

    private void validateCapsuleUpdateRequest(UpdateCapsuleRequest request, boolean isAdmin) {
        CapsuleStatus status = CapsuleStatus.fromValue(request.getStatus());
        if (!isAdmin && CapsuleStatus.OPENED.equals(status)) {
            throw new SecurityException("Only admin can set capsule status to opened");
        }

        if (CapsuleStatus.SEALED.equals(status)) {
            if (request.getUnlockAt() == null) {
                throw new IllegalArgumentException("Unlock date is required for sealed capsules");
            }
            if (!request.getUnlockAt().isAfter(Instant.now())) {
                throw new IllegalArgumentException("Unlock date must be in the future for sealed capsules");
            }
        }

        if (!CapsuleStatus.DRAFT.equals(status)
                && request.getExpiresAt() != null
                && request.getUnlockAt() != null
                && !request.getExpiresAt().isAfter(request.getUnlockAt())) {
            throw new IllegalArgumentException("Expiration date must be after unlock date");
        }

        if (request.getMedia() != null) {
            for (UpdateCapsuleRequest.MediaDto item : request.getMedia()) {
                if (item == null) {
                    throw new IllegalArgumentException("Media item cannot be null");
                }
                String url = normalizeBlankToNull(item.getUrl());
                String type = normalizeBlankToNull(item.getType());
                if (url == null || type == null) {
                    throw new IllegalArgumentException("Each media item must contain url and type");
                }
                if (!"image".equalsIgnoreCase(type) && !"video".equalsIgnoreCase(type)) {
                    throw new IllegalArgumentException("Media type must be image or video");
                }
            }
        }
    }

    private void validateCapsuleRequest(CreateCapsuleRequest request) {
        CapsuleStatus status = resolveCreateStatus(request);
        if (CapsuleStatus.SEALED.equals(status)) {
            if (request.getUnlockAt() == null) {
                throw new IllegalArgumentException("Unlock date is required for sealed capsules");
            }
            if (!request.getUnlockAt().isAfter(Instant.now())) {
                throw new IllegalArgumentException("Unlock date must be in the future for sealed capsules");
            }
        }

        if (!status.isDraft()
                && request.getExpiresAt() != null
                && request.getUnlockAt() != null
                && !request.getExpiresAt().isAfter(request.getUnlockAt())) {
            throw new IllegalArgumentException("Expiration date must be after unlock date");
        }
    }

    private CapsuleStatus resolveCreateStatus(CreateCapsuleRequest request) {
        CapsuleStatus status = CapsuleStatus.fromValue(request.getStatus());
        return status != null ? status : CapsuleStatus.DRAFT;
    }

    private Instant normalizeUnlockAt(CapsuleStatus status, Instant unlockAt) {
        return status != null && status.isDraft() ? null : unlockAt;
    }

    private Instant normalizeExpiresAt(CapsuleStatus status, Instant unlockAt, Instant expiresAt) {
        if (status != null && status.isDraft()) {
            return null;
        }
        if (unlockAt == null) {
            return null;
        }
        return expiresAt;
    }

    private boolean isDraft(Capsule capsule) {
        if (capsule == null) {
            return false;
        }
        CapsuleStatus status = CapsuleStatus.fromValue(capsule.getStatus());
        return status != null && status.isDraft();
    }

    private boolean isPubliclyAccessible(Capsule capsule) {
        if (capsule == null || isDraft(capsule)) {
            return false;
        }
        return CapsuleVisibility.PUBLIC.equals(CapsuleVisibility.fromValue(capsule.getVisibility()));
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

        List<Capsule> capsules = capsuleRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner);
        Map<String, Capsule.GeoPoint> locationsByCapsuleId = resolveGeoLocationsByCapsuleId(capsules);
        return capsules.stream()
                .map(c -> toResponse(c, locationsByCapsuleId))
                .collect(Collectors.toList());
    }

    public List<CapsuleResponse> listPublic() {
        List<Capsule> capsules = capsuleRepository.findByVisibilityAndDeletedAtIsNullOrderByCreatedAtDesc(
                CapsuleVisibility.PUBLIC.getValue()
        );
        List<Capsule> visibleCapsules = capsules.stream()
                .filter(this::isPubliclyAccessible)
                .collect(Collectors.toList());
        Map<String, Capsule.GeoPoint> locationsByCapsuleId = resolveGeoLocationsByCapsuleId(visibleCapsules);
        return visibleCapsules.stream()
                .map(c -> toResponse(c, locationsByCapsuleId))
                .collect(Collectors.toList());
    }

    /**
     * Повертає публічні капсули для заданого користувача (видимі всім).
     * Якщо запит робить власник — повертає усі капсули (включно з приватними).
     */
    public List<CapsuleResponse> listUserCapsules(String userId, String requesterId) {
        ObjectId owner = new ObjectId(userId);
        List<Capsule> capsules;
        if (userId.equals(requesterId)) {
            // Власний профіль — повертаємо всі капсули
            capsules = capsuleRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner);
        } else {
        // Інший користувач — тільки публічні капсули
            capsules = capsuleRepository.findByOwnerIdAndVisibilityAndDeletedAtIsNullOrderByCreatedAtDesc(owner, CapsuleVisibility.PUBLIC.getValue());
            capsules = capsules.stream()
                    .filter(this::isPubliclyAccessible)
                    .collect(Collectors.toList());
        }
        Map<String, Capsule.GeoPoint> locationsByCapsuleId = resolveGeoLocationsByCapsuleId(capsules);
        return capsules.stream()
                .map(c -> toResponse(c, locationsByCapsuleId))
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

        boolean isOwner = capsule.getOwnerId() != null && Objects.equals(capsule.getOwnerId().toHexString(), ownerId);
        if (isDraft(capsule) && !isOwner) {
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

        notifyOwner(ownerId, updated);
        return toResponse(updated);
    }

    public void shareCapsule(String capsuleId, String sharerId, List<String> userIds) {
        // Шукаємо капсулу тільки за id та deletedAt (без перевірки ownerId)
        Query findQuery = new Query(Criteria.where("_id").is(capsuleId).and("deletedAt").is(null));
        Capsule capsule = mongoTemplate.findOne(findQuery, Capsule.class);
        if (capsule == null) throw new IllegalArgumentException("Capsule not found");
        if (isDraft(capsule)) {
            throw new IllegalArgumentException("Draft capsules cannot be shared until they are sealed");
        }

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
        return toResponse(capsule, null, false);
    }

    private CapsuleResponse toResponse(Capsule capsule, Map<String, Capsule.GeoPoint> locationsByCapsuleId) {
        return toResponse(capsule, locationsByCapsuleId, false);
    }

    private CapsuleResponse toResponse(Capsule capsule,
                                      Map<String, Capsule.GeoPoint> locationsByCapsuleId,
                                      boolean includeLockedContent) {
        CapsuleResponse resp = new CapsuleResponse();
        resp.setId(capsule.getId());
        resp.setOwnerId(capsule.getOwnerId() != null ? capsule.getOwnerId().toHexString() : null);
        resp.setTitle(capsule.getTitle());

        boolean isLocked = isLocked(capsule.getStatus(), capsule.getUnlockAt());

        resp.setIsLocked(isLocked);
        if (isLocked && !includeLockedContent) {
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
        resp.setGeoMarkerId(capsule.getGeoMarkerId() != null ? capsule.getGeoMarkerId().toHexString() : null);
        resp.setAllowComments(capsule.getAllowComments());
        resp.setAllowReactions(capsule.getAllowReactions());
        resp.setShareToken(capsule.getShareToken());
        resp.setTags(capsule.getTags());
        resp.setCoverImageUrl(capsule.getCoverImageUrl());
        Capsule.GeoPoint location = null;
        if (locationsByCapsuleId != null && capsule.getId() != null) {
            location = locationsByCapsuleId.get(capsule.getId());
        }
        if (location == null) {
            location = resolveGeoLocationForCapsule(capsule);
        }
        resp.setLocation(mapGeo(location));
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

    private List<Capsule.Media> mapUpdateMediaRequest(List<UpdateCapsuleRequest.MediaDto> media) {
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
        Capsule.GeoPoint normalized = normalizeGeo(geo);
        if (normalized == null) return null;
        CapsuleResponse.GeoPoint g = new CapsuleResponse.GeoPoint();
        g.setType(normalized.getType());
        g.setCoordinates(normalized.getCoordinates());
        return g;
    }

    private Capsule.GeoPoint mapGeo(CreateCapsuleRequest.GeoPointDto geo) {
        if (geo == null) return null;
        List<Double> coordinates = geo.getCoordinates();
        if (coordinates == null || coordinates.size() < 2) return null;
        Double lon = coordinates.get(0);
        Double lat = coordinates.get(1);
        if (lon == null || lat == null) return null;
        Capsule.GeoPoint g = new Capsule.GeoPoint();
        g.setType(geo.getType() == null || geo.getType().isBlank() ? "Point" : geo.getType());
        g.setCoordinates(List.of(lon, lat));
        return g;
    }

    private Capsule.GeoPoint mapGeo(UpdateCapsuleRequest.GeoPointDto geo) {
        if (geo == null) return null;
        List<Double> coordinates = geo.getCoordinates();
        if (coordinates == null || coordinates.size() < 2) return null;
        Double lon = coordinates.get(0);
        Double lat = coordinates.get(1);
        if (lon == null || lat == null) return null;
        Capsule.GeoPoint g = new Capsule.GeoPoint();
        g.setType(geo.getType() == null || geo.getType().isBlank() ? "Point" : geo.getType());
        g.setCoordinates(List.of(lon, lat));
        return g;
    }

    private String normalizeBlankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null) return null;
        return tags.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .collect(Collectors.toList());
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
        List<Capsule> capsules = mongoTemplate.find(query, Capsule.class);
        Map<String, Capsule.GeoPoint> locationsByCapsuleId = resolveGeoLocationsByCapsuleId(capsules);
        return capsules.stream()
                .map(c -> toResponse(c, locationsByCapsuleId))
                .collect(Collectors.toList());
    }

    /**
     * Повертає капсулу залежно від доступу глядача: власник/спільний доступ або публічна капсула.
     */
    public List<Map<String, Object>> listMapMarkers(String currentUserId) {
        ObjectId me = new ObjectId(currentUserId);
        Set<ObjectId> relatedUsers = new LinkedHashSet<>();
        relatedUsers.add(me);

        followRepository.findByFollowerIdAndDeletedAtIsNull(me)
                .forEach(f -> relatedUsers.add(f.getUserId()));
        followRepository.findByUserIdAndDeletedAtIsNull(me)
                .forEach(f -> relatedUsers.add(f.getFollowerId()));

        Query query = new Query(
                Criteria.where("ownerId").in(relatedUsers)
                        .and("deletedAt").is(null)
        );
        query.addCriteria(new Criteria().orOperator(
                Criteria.where("geoMarkerId").ne(null),
                Criteria.where("location").ne(null)
        ));

        List<Capsule> candidates = mongoTemplate.find(query, Capsule.class);
        candidates.sort(Comparator.comparing(Capsule::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        Map<String, Capsule.GeoPoint> locationsByCapsuleId = resolveGeoLocationsByCapsuleId(candidates);

        Set<String> ownerIds = candidates.stream()
                .filter(c -> c.getOwnerId() != null)
                .map(c -> c.getOwnerId().toHexString())
                .collect(Collectors.toSet());

        Map<String, com.oleksandrmytro.timecapsule.models.User> usersById = new HashMap<>();
        userRepository.findAllById(ownerIds).forEach(u -> usersById.put(u.getId(), u));

        List<Map<String, Object>> markers = new ArrayList<>();
        for (Capsule capsule : candidates) {
            if (capsule.getOwnerId() == null) {
                continue;
            }

            Capsule.GeoPoint geoPoint = locationsByCapsuleId.get(capsule.getId());
            if (geoPoint == null || geoPoint.getCoordinates() == null) {
                continue;
            }

            List<Double> coordinates = geoPoint.getCoordinates();
            if (coordinates.size() < 2 || coordinates.get(0) == null || coordinates.get(1) == null) {
                continue;
            }

            double lon = coordinates.get(0);
            double lat = coordinates.get(1);
            if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
                continue;
            }

            String ownerId = capsule.getOwnerId().toHexString();
            boolean isOwn = ownerId.equals(currentUserId);
            boolean isPublic = CapsuleVisibility.PUBLIC.equals(CapsuleVisibility.fromValue(capsule.getVisibility()));
            if ((!isOwn && !isPublic) || (isDraft(capsule) && !isOwn)) {
                continue;
            }

            com.oleksandrmytro.timecapsule.models.User owner = usersById.get(ownerId);

            Map<String, Object> marker = new HashMap<>();
            marker.put("id", capsule.getId());
            marker.put("title", capsule.getTitle());
            marker.put("ownerId", ownerId);
            marker.put("ownerName", owner != null
                    ? (owner.getUsernameField() != null ? owner.getUsernameField() : owner.getEmail())
                    : "Unknown");
            marker.put("ownerAvatarUrl", owner != null ? owner.getAvatarUrl() : null);
            marker.put("visibility", capsule.getVisibility());
            marker.put("status", capsule.getStatus());
            marker.put("isLocked", isLocked(capsule.getStatus(), capsule.getUnlockAt()));
            marker.put("isOwn", isOwn);
            marker.put("coverImageUrl", capsule.getCoverImageUrl());
            marker.put("unlockAt", capsule.getUnlockAt());
            marker.put("openedAt", capsule.getOpenedAt());
            marker.put("tags", capsule.getTags());
            marker.put("coordinates", List.of(lon, lat));
            markers.add(marker);
        }

        return markers;
    }

    private Capsule.GeoPoint normalizeGeo(Capsule.GeoPoint geo) {
        if (geo == null || geo.getCoordinates() == null || geo.getCoordinates().size() < 2) return null;
        Double lon = geo.getCoordinates().get(0);
        Double lat = geo.getCoordinates().get(1);
        if (lon == null || lat == null) return null;
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
        Capsule.GeoPoint normalized = new Capsule.GeoPoint();
        normalized.setType("Point");
        normalized.setCoordinates(List.of(lon, lat));
        return normalized;
    }

    private Capsule.GeoPoint resolveGeoLocationForCapsule(Capsule capsule) {
        Capsule.GeoPoint legacy = normalizeGeo(capsule.getLocation());

        if (capsule.getGeoMarkerId() != null) {
            Query byMarkerId = new Query(Criteria.where("_id").is(capsule.getGeoMarkerId()).and("deletedAt").is(null));
            GeoMarkerRecord marker = mongoTemplate.findOne(byMarkerId, GeoMarkerRecord.class, GEO_MARKERS_COLLECTION);
            Capsule.GeoPoint fromMarker = marker != null ? normalizeGeo(marker.getLocation()) : null;
            if (fromMarker != null) return fromMarker;
        }

        if (capsule.getId() != null && ObjectId.isValid(capsule.getId())) {
            Query byCapsuleId = new Query(Criteria.where("capsuleId").is(new ObjectId(capsule.getId())).and("deletedAt").is(null));
            GeoMarkerRecord marker = mongoTemplate.findOne(byCapsuleId, GeoMarkerRecord.class, GEO_MARKERS_COLLECTION);
            Capsule.GeoPoint fromMarker = marker != null ? normalizeGeo(marker.getLocation()) : null;
            if (fromMarker != null) return fromMarker;
        }

        return legacy;
    }

    private Map<String, Capsule.GeoPoint> resolveGeoLocationsByCapsuleId(List<Capsule> capsules) {
        Map<String, Capsule.GeoPoint> byCapsuleId = new HashMap<>();
        if (capsules == null || capsules.isEmpty()) return byCapsuleId;

        Set<ObjectId> markerIds = new LinkedHashSet<>();
        Set<ObjectId> capsuleIds = new LinkedHashSet<>();
        Map<String, ObjectId> markerIdByCapsuleId = new HashMap<>();

        for (Capsule capsule : capsules) {
            if (capsule.getId() == null) continue;

            Capsule.GeoPoint legacy = normalizeGeo(capsule.getLocation());
            if (legacy != null) {
                byCapsuleId.put(capsule.getId(), legacy);
            }

            if (capsule.getGeoMarkerId() != null) {
                markerIds.add(capsule.getGeoMarkerId());
                markerIdByCapsuleId.put(capsule.getId(), capsule.getGeoMarkerId());
            }
            if (ObjectId.isValid(capsule.getId())) {
                capsuleIds.add(new ObjectId(capsule.getId()));
            }
        }

        Map<String, Capsule.GeoPoint> byMarkerId = new HashMap<>();
        if (!markerIds.isEmpty()) {
            Query q = new Query(Criteria.where("_id").in(markerIds).and("deletedAt").is(null));
            List<GeoMarkerRecord> markers = mongoTemplate.find(q, GeoMarkerRecord.class, GEO_MARKERS_COLLECTION);
            for (GeoMarkerRecord marker : markers) {
                Capsule.GeoPoint normalized = normalizeGeo(marker.getLocation());
                if (normalized == null) continue;
                if (marker.getId() != null) {
                    byMarkerId.put(marker.getId().toHexString(), normalized);
                }
                if (marker.getCapsuleId() != null) {
                    byCapsuleId.put(marker.getCapsuleId().toHexString(), normalized);
                }
            }
        }

        if (!capsuleIds.isEmpty()) {
            Query q = new Query(Criteria.where("capsuleId").in(capsuleIds).and("deletedAt").is(null));
            List<GeoMarkerRecord> markers = mongoTemplate.find(q, GeoMarkerRecord.class, GEO_MARKERS_COLLECTION);
            for (GeoMarkerRecord marker : markers) {
                Capsule.GeoPoint normalized = normalizeGeo(marker.getLocation());
                if (normalized == null || marker.getCapsuleId() == null) continue;
                byCapsuleId.put(marker.getCapsuleId().toHexString(), normalized);
            }
        }

        for (Map.Entry<String, ObjectId> entry : markerIdByCapsuleId.entrySet()) {
            Capsule.GeoPoint byId = byMarkerId.get(entry.getValue().toHexString());
            if (byId != null) {
                byCapsuleId.put(entry.getKey(), byId);
            }
        }

        return byCapsuleId;
    }

    private void archiveGeoMarkers(Capsule capsule) {
        Instant now = Instant.now();

        if (capsule.getGeoMarkerId() != null) {
            mongoTemplate.updateFirst(
                    new Query(Criteria.where("_id").is(capsule.getGeoMarkerId())),
                    new Update()
                            .set("deletedAt", now)
                            .set("updatedAt", now),
                    GEO_MARKERS_COLLECTION
            );
        }

        if (capsule.getId() != null && ObjectId.isValid(capsule.getId())) {
            mongoTemplate.updateMulti(
                    new Query(Criteria.where("capsuleId").is(new ObjectId(capsule.getId())).and("deletedAt").is(null)),
                    new Update()
                            .set("deletedAt", now)
                            .set("updatedAt", now),
                    GEO_MARKERS_COLLECTION
            );
        }
    }

    private ObjectId upsertGeoMarker(Capsule capsule, Capsule.GeoPoint location, CapsuleVisibility visibility) {
        if (capsule == null || capsule.getId() == null || !ObjectId.isValid(capsule.getId())) {
            throw new IllegalArgumentException("Cannot create geomarker: invalid capsule id");
        }
        Capsule.GeoPoint normalized = normalizeGeo(location);
        if (normalized == null) {
            throw new IllegalArgumentException("Cannot create geomarker: invalid coordinates");
        }

        Instant now = Instant.now();
        ObjectId capsuleId = new ObjectId(capsule.getId());
        String markerVisibility = "owner";
        if (CapsuleVisibility.PUBLIC.equals(visibility)) {
            markerVisibility = "public";
        } else if (CapsuleVisibility.SHARED.equals(visibility)) {
            markerVisibility = "shared";
        }

        Query existingQuery = new Query(Criteria.where("capsuleId").is(capsuleId).and("deletedAt").is(null));
        GeoMarkerRecord existing = mongoTemplate.findOne(existingQuery, GeoMarkerRecord.class, GEO_MARKERS_COLLECTION);
        if (existing != null && existing.getId() != null) {
            mongoTemplate.updateFirst(
                    new Query(Criteria.where("_id").is(existing.getId())),
                    new Update()
                            .set("location", normalized)
                            .set("visibility", markerVisibility)
                            .set("updatedAt", now)
                            .unset("deletedAt"),
                    GEO_MARKERS_COLLECTION
            );
            return existing.getId();
        }

        GeoMarkerRecord marker = new GeoMarkerRecord();
        marker.setCapsuleId(capsuleId);
        marker.setLocation(normalized);
        marker.setVisibility(markerVisibility);
        marker.setCreatedAt(now);
        marker.setUpdatedAt(now);
        GeoMarkerRecord saved = mongoTemplate.save(marker, GEO_MARKERS_COLLECTION);
        if (saved == null || saved.getId() == null) {
            throw new IllegalStateException("Failed to save geomarker");
        }
        return saved.getId();
    }

    private static class GeoMarkerRecord {
        @Id
        private ObjectId id;

        @Field("capsuleId")
        private ObjectId capsuleId;

        @Field("location")
        private Capsule.GeoPoint location;

        @Field("visibility")
        private String visibility;

        @Field("createdAt")
        private Instant createdAt;

        @Field("updatedAt")
        private Instant updatedAt;

        @Field("deletedAt")
        private Instant deletedAt;

        public ObjectId getId() {
            return id;
        }

        public void setId(ObjectId id) {
            this.id = id;
        }

        public ObjectId getCapsuleId() {
            return capsuleId;
        }

        public void setCapsuleId(ObjectId capsuleId) {
            this.capsuleId = capsuleId;
        }

        public Capsule.GeoPoint getLocation() {
            return location;
        }

        public void setLocation(Capsule.GeoPoint location) {
            this.location = location;
        }

        public String getVisibility() {
            return visibility;
        }

        public void setVisibility(String visibility) {
            this.visibility = visibility;
        }

        public Instant getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(Instant createdAt) {
            this.createdAt = createdAt;
        }

        public Instant getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(Instant updatedAt) {
            this.updatedAt = updatedAt;
        }

        public Instant getDeletedAt() {
            return deletedAt;
        }

        public void setDeletedAt(Instant deletedAt) {
            this.deletedAt = deletedAt;
        }
    }

    public CapsuleResponse getAccessible(String id, String viewerId) {
        if (viewerId != null) {
            boolean isAdmin = userRepository.findById(viewerId)
                    .map(User::getRole)
                    .map(role -> role == User.Role.ADMIN)
                    .orElse(false);
            if (isAdmin) {
                Capsule capsule = capsuleRepository.findByIdAndDeletedAtIsNull(id)
                        .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));
                return toResponse(capsule);
            }
        }

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

        if (isPubliclyAccessible(capsule)) {
            return toResponse(capsule);
        }

        throw new IllegalArgumentException("Capsule not found or not accessible");
    }
}
