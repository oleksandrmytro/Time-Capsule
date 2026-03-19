package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.models.AdminAuditLog;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.Tag;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.AdminAuditLogRepository;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final CapsuleRepository capsuleRepository;
    private final MongoTemplate mongoTemplate;
    private final TagService tagService;
    private final PasswordEncoder passwordEncoder;
    private final AdminAuditLogRepository adminAuditLogRepository;

    private static final Set<String> MANAGED_COLLECTIONS = Set.of(
            "users", "capsules", "tags", "comments", "reactions", "shares", "follows",
            "chat_messages", "notifications", "reminders", "geomarkers", "feed_events", "pending_users", "admin_audit_logs"
    );

    public AdminService(
            UserRepository userRepository,
            CapsuleRepository capsuleRepository,
            MongoTemplate mongoTemplate,
            TagService tagService,
            PasswordEncoder passwordEncoder,
            AdminAuditLogRepository adminAuditLogRepository
    ) {
        this.userRepository = userRepository;
        this.capsuleRepository = capsuleRepository;
        this.mongoTemplate = mongoTemplate;
        this.tagService = tagService;
        this.passwordEncoder = passwordEncoder;
        this.adminAuditLogRepository = adminAuditLogRepository;
    }

    /* ── Stats ─────────────────────────── */
    public Map<String, Long> getStats() {
        long users = userRepository.count();
        long capsules = capsuleRepository.count();
        long tags = tagService.count();
        long auditLogs = adminAuditLogRepository.count();
        return Map.of("users", users, "capsules", capsules, "tags", tags, "auditLogs", auditLogs);
    }

    /* ── Users ─────────────────────────── */
    public List<User> listUsers(String query, int page, int size, boolean includeDeleted, boolean onlyBlocked) {
        Query q = new Query();
        if (!includeDeleted) {
            q.addCriteria(Criteria.where("deletedAt").is(null));
        }
        if (onlyBlocked) {
            q.addCriteria(Criteria.where("blockedUntil").gt(LocalDateTime.now()));
        }
        if (query != null && !query.isBlank()) {
            q.addCriteria(new Criteria().orOperator(
                    Criteria.where("username").regex(query, "i"),
                    Criteria.where("email").regex(query, "i")
            ));
        }
        q.with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return mongoTemplate.find(q, User.class);
    }

    public long countUsers(String query, boolean includeDeleted, boolean onlyBlocked) {
        Query q = new Query();
        if (!includeDeleted) {
            q.addCriteria(Criteria.where("deletedAt").is(null));
        }
        if (onlyBlocked) {
            q.addCriteria(Criteria.where("blockedUntil").gt(LocalDateTime.now()));
        }
        if (query != null && !query.isBlank()) {
            q.addCriteria(new Criteria().orOperator(
                    Criteria.where("username").regex(query, "i"),
                    Criteria.where("email").regex(query, "i")
            ));
        }
        return mongoTemplate.count(q, User.class);
    }

    public User updateUser(String id, Map<String, Object> updates, User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (updates.containsKey("role") && updates.get("role") != null) {
            user.setRoleDb(updates.get("role").toString());
        }
        if (updates.containsKey("enabled")) {
            user.setEnabled(Boolean.parseBoolean(String.valueOf(updates.get("enabled"))));
        }
        if (updates.containsKey("username") && updates.get("username") != null) {
            String username = updates.get("username").toString().trim();
            userRepository.findByUsernameIgnoreCase(username)
                    .filter(found -> !found.getId().equals(id))
                    .ifPresent(found -> {
                        throw new IllegalArgumentException("Username already in use");
                    });
            user.setUsername(username);
        }
        if (updates.containsKey("email") && updates.get("email") != null) {
            String email = updates.get("email").toString().trim();
            userRepository.findByEmail(email)
                    .filter(found -> !found.getId().equals(id))
                    .ifPresent(found -> {
                        throw new IllegalArgumentException("Email already in use");
                    });
            user.setEmail(email);
        }
        if (updates.containsKey("avatarUrl")) {
            user.setAvatarUrl(updates.get("avatarUrl") == null ? null : updates.get("avatarUrl").toString());
        }
        if (updates.containsKey("password") && updates.get("password") != null) {
            String raw = updates.get("password").toString();
            if (!raw.isBlank()) {
                user.setPassword(passwordEncoder.encode(raw));
            }
        }
        if (updates.containsKey("blockedUntil")) {
            user.setBlockedUntil(parseLocalDateTimeOrNull(updates.get("blockedUntil")));
        }
        if (updates.containsKey("deletedAt")) {
            user.setDeletedAt(parseLocalDateTimeOrNull(updates.get("deletedAt")));
        }
        if (updates.containsKey("status") && updates.get("status") != null) {
            String status = updates.get("status").toString();
            if ("active".equalsIgnoreCase(status)) {
                user.setEnabled(true);
                user.setBlockedUntil(null);
                user.setDeletedAt(null);
            } else if ("blocked".equalsIgnoreCase(status)) {
                user.setEnabled(true);
                user.setBlockedUntil(LocalDateTime.now().plusDays(7));
            } else if ("deleted".equalsIgnoreCase(status)) {
                user.setDeletedAt(LocalDateTime.now());
                user.setEnabled(false);
            }
        }

        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        audit(actor, "USER_UPDATE", "user", id, updates);
        return saved;
    }

    public void deleteUser(String id, User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setDeletedAt(LocalDateTime.now());
        user.setEnabled(false);
        userRepository.save(user);
        audit(actor, "USER_SOFT_DELETE", "user", id, Map.of());
    }

    public User restoreUser(String id, User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setDeletedAt(null);
        user.setEnabled(true);
        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        audit(actor, "USER_RESTORE", "user", id, Map.of());
        return saved;
    }

    public long bulkUsers(List<String> ids, String action, String value, User actor) {
        if (ids == null || ids.isEmpty()) return 0L;
        Query q = new Query(Criteria.where("_id").in(ids));
        Update u = new Update().set("updatedAt", LocalDateTime.now());
        switch (action == null ? "" : action) {
            case "delete" -> {
                u.set("deletedAt", LocalDateTime.now());
                u.set("enabled", false);
            }
            case "restore" -> {
                u.unset("deletedAt");
                u.set("enabled", true);
            }
            case "enable" -> u.set("enabled", true);
            case "disable" -> u.set("enabled", false);
            case "role" -> u.set("role", value == null ? "regular" : value);
            case "block" -> u.set("blockedUntil", parseLocalDateTimeOrDefault(value, LocalDateTime.now().plusDays(7)));
            case "unblock" -> u.unset("blockedUntil");
            default -> throw new IllegalArgumentException("Unsupported user bulk action: " + action);
        }
        long modified = mongoTemplate.updateMulti(q, u, User.class).getModifiedCount();
        var details = new HashMap<String, Object>();
        details.put("ids", ids);
        details.put("value", value);
        details.put("modified", modified);
        audit(actor, "USER_BULK_" + action, "user", "bulk", details);
        return modified;
    }

    /* ── Capsules ──────────────────────── */
    public List<Capsule> listCapsules(String query, int page, int size, boolean includeDeleted) {
        Query q = new Query();
        if (!includeDeleted) {
            q.addCriteria(Criteria.where("deletedAt").is(null));
        }
        if (query != null && !query.isBlank()) {
            q.addCriteria(Criteria.where("title").regex(query, "i"));
        }
        q.with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return mongoTemplate.find(q, Capsule.class);
    }

    public long countCapsules(String query, boolean includeDeleted) {
        Query q = new Query();
        if (!includeDeleted) {
            q.addCriteria(Criteria.where("deletedAt").is(null));
        }
        if (query != null && !query.isBlank()) {
            q.addCriteria(Criteria.where("title").regex(query, "i"));
        }
        return mongoTemplate.count(q, Capsule.class);
    }

    public void deleteCapsule(String id, User actor) {
        Query q = new Query(Criteria.where("_id").is(id));
        Update u = new Update().set("deletedAt", Instant.now()).set("updatedAt", Instant.now());
        mongoTemplate.updateFirst(q, u, Capsule.class);
        audit(actor, "CAPSULE_SOFT_DELETE", "capsule", id, Map.of());
    }

    public Capsule restoreCapsule(String id, User actor) {
        Query q = new Query(Criteria.where("_id").is(id));
        Update u = new Update().unset("deletedAt").set("updatedAt", Instant.now());
        mongoTemplate.updateFirst(q, u, Capsule.class);
        Capsule capsule = capsuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));
        audit(actor, "CAPSULE_RESTORE", "capsule", id, Map.of());
        return capsule;
    }

    public long bulkCapsules(List<String> ids, String action, String value, User actor) {
        if (ids == null || ids.isEmpty()) return 0L;
        Query q = new Query(Criteria.where("_id").in(ids));
        Update u = new Update().set("updatedAt", Instant.now());
        switch (action == null ? "" : action) {
            case "delete" -> u.set("deletedAt", Instant.now());
            case "restore" -> u.unset("deletedAt");
            case "visibility" -> u.set("visibility", value == null ? "private" : value);
            case "status" -> u.set("status", value == null ? "draft" : value);
            default -> throw new IllegalArgumentException("Unsupported capsule bulk action: " + action);
        }
        long modified = mongoTemplate.updateMulti(q, u, Capsule.class).getModifiedCount();
        var details = new HashMap<String, Object>();
        details.put("ids", ids);
        details.put("value", value);
        details.put("modified", modified);
        audit(actor, "CAPSULE_BULK_" + action, "capsule", "bulk", details);
        return modified;
    }

    public Capsule updateCapsule(String id, Map<String, Object> updates, User actor) {
        capsuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));

        Query q = new Query(Criteria.where("_id").is(id));
        Update u = new Update();

        if (updates.containsKey("title")) u.set("title", updates.get("title"));
        if (updates.containsKey("body")) u.set("body", updates.get("body"));
        if (updates.containsKey("visibility")) u.set("visibility", updates.get("visibility"));
        if (updates.containsKey("status")) u.set("status", updates.get("status"));
        if (updates.containsKey("allowComments")) u.set("allowComments", updates.get("allowComments"));
        if (updates.containsKey("allowReactions")) u.set("allowReactions", updates.get("allowReactions"));
        if (updates.containsKey("tags")) u.set("tags", updates.get("tags"));
        if (updates.containsKey("coverImageUrl")) u.set("coverImageUrl", updates.get("coverImageUrl"));
        if (updates.containsKey("media")) u.set("media", updates.get("media"));
        if (updates.containsKey("ownerId") && updates.get("ownerId") != null) {
            String ownerId = updates.get("ownerId").toString();
            if (!ObjectId.isValid(ownerId)) {
                throw new IllegalArgumentException("Invalid ownerId");
            }
            u.set("ownerId", new ObjectId(ownerId));
        }
        if (updates.containsKey("unlockAt")) {
            Object unlockAt = updates.get("unlockAt");
            u.set("unlockAt", unlockAt == null ? null : Instant.parse(unlockAt.toString()));
        }
        if (updates.containsKey("expiresAt")) {
            Object expires = updates.get("expiresAt");
            u.set("expiresAt", expires == null ? null : Instant.parse(expires.toString()));
        }

        u.set("updatedAt", Instant.now());
        mongoTemplate.updateFirst(q, u, Capsule.class);

        Capsule updated = capsuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));
        audit(actor, "CAPSULE_UPDATE", "capsule", id, updates);
        return updated;
    }

    /* ── Tags ──────────────────────────── */
    public Tag updateTag(String id, Map<String, Object> updates, User actor) {
        Query q = new Query(Criteria.where("_id").is(id));
        Update u = new Update().set("updatedAt", Instant.now());
        if (updates.containsKey("name")) u.set("name", updates.get("name"));
        if (updates.containsKey("imageUrl")) u.set("imageUrl", updates.get("imageUrl"));
        if (updates.containsKey("isSystem")) u.set("isSystem", updates.get("isSystem"));
        mongoTemplate.updateFirst(q, u, Tag.class);
        Tag updated = mongoTemplate.findOne(q, Tag.class);
        audit(actor, "TAG_UPDATE", "tag", id, updates);
        return updated;
    }

    public Tag createTag(Map<String, Object> payload, User actor) {
        String name = payload.get("name") == null ? "" : payload.get("name").toString().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Tag name is required");
        }
        String imageUrl = payload.get("imageUrl") == null ? null : payload.get("imageUrl").toString();
        Tag created = tagService.create(name, imageUrl, actor.getId());
        audit(actor, "TAG_CREATE", "tag", created.getId(), payload);
        return created;
    }

    public long bulkTags(List<String> ids, String action, User actor) {
        if (ids == null || ids.isEmpty()) return 0L;
        if (!"delete".equals(action)) {
            throw new IllegalArgumentException("Unsupported tag bulk action: " + action);
        }
        Query q = new Query(Criteria.where("_id").in(ids));
        long modified = mongoTemplate.remove(q, Tag.class).getDeletedCount();
        audit(actor, "TAG_BULK_DELETE", "tag", "bulk", Map.of("ids", ids, "modified", modified));
        return modified;
    }

    public void deleteTag(String id, User actor) {
        tagService.delete(id);
        audit(actor, "TAG_DELETE", "tag", id, Map.of());
    }

    /* ── Audit Logs ────────────────────── */
    public List<AdminAuditLog> listAuditLogs(String query, int page, int size) {
        Query q = new Query();
        if (query != null && !query.isBlank()) {
            q.addCriteria(new Criteria().orOperator(
                    Criteria.where("action").regex(query, "i"),
                    Criteria.where("entityType").regex(query, "i"),
                    Criteria.where("actorEmail").regex(query, "i")
            ));
        }
        q.with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return mongoTemplate.find(q, AdminAuditLog.class);
    }

    public long countAuditLogs(String query) {
        Query q = new Query();
        if (query != null && !query.isBlank()) {
            q.addCriteria(new Criteria().orOperator(
                    Criteria.where("action").regex(query, "i"),
                    Criteria.where("entityType").regex(query, "i"),
                    Criteria.where("actorEmail").regex(query, "i")
            ));
        }
        return mongoTemplate.count(q, AdminAuditLog.class);
    }

    /* ── Universal Collections ─────────── */
    public List<String> listManagedCollections() {
        Set<String> existing = new LinkedHashSet<>();
        for (String name : mongoTemplate.getDb().listCollectionNames()) {
            if (MANAGED_COLLECTIONS.contains(name)) existing.add(name);
        }
        return existing.stream().sorted().toList();
    }

    public List<Document> listCollectionDocs(String name, String query, int page, int size) {
        ensureAllowedCollection(name);
        Query q = new Query();
        if (query != null && !query.isBlank()) {
            q.addCriteria(new Criteria().orOperator(
                    Criteria.where("title").regex(query, "i"),
                    Criteria.where("name").regex(query, "i"),
                    Criteria.where("username").regex(query, "i"),
                    Criteria.where("email").regex(query, "i")
            ));
        }
        q.with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "_id")));
        return mongoTemplate.find(q, Document.class, name);
    }

    public long countCollectionDocs(String name, String query) {
        ensureAllowedCollection(name);
        Query q = new Query();
        if (query != null && !query.isBlank()) {
            q.addCriteria(new Criteria().orOperator(
                    Criteria.where("title").regex(query, "i"),
                    Criteria.where("name").regex(query, "i"),
                    Criteria.where("username").regex(query, "i"),
                    Criteria.where("email").regex(query, "i")
            ));
        }
        return mongoTemplate.count(q, name);
    }

    public Document updateCollectionDoc(String collection, String id, Map<String, Object> updates, User actor) {
        ensureAllowedCollection(collection);
        Query q = new Query(idCriteria(id));
        Update u = new Update();
        updates.forEach((k, v) -> {
            if (!"_id".equals(k)) u.set(k, v);
        });
        mongoTemplate.updateFirst(q, u, collection);
        Document updated = mongoTemplate.findOne(q, Document.class, collection);
        audit(actor, "COLLECTION_UPDATE", collection, id, updates);
        return updated;
    }

    public void deleteCollectionDoc(String collection, String id, User actor) {
        ensureAllowedCollection(collection);
        Query q = new Query(idCriteria(id));
        mongoTemplate.remove(q, collection);
        audit(actor, "COLLECTION_DELETE", collection, id, Map.of());
    }

    private LocalDateTime parseLocalDateTimeOrNull(Object raw) {
        if (raw == null) return null;
        String value = raw.toString().trim();
        if (value.isBlank()) return null;
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ignored) {
            try {
                return Instant.parse(value).atOffset(ZoneOffset.UTC).toLocalDateTime();
            } catch (Exception ignored2) {
                throw new IllegalArgumentException("Invalid datetime format: " + value);
            }
        }
    }

    private LocalDateTime parseLocalDateTimeOrDefault(String raw, LocalDateTime fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        return parseLocalDateTimeOrNull(raw);
    }

    private void audit(User actor, String action, String entityType, String entityId, Map<String, Object> details) {
        if (actor == null) return;
        AdminAuditLog log = new AdminAuditLog();
        log.setActorId(actor.getId());
        log.setActorEmail(actor.getEmail());
        log.setActorRole(actor.getRoleDb());
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setDetails(details);
        log.setCreatedAt(Instant.now());
        adminAuditLogRepository.save(log);
    }

    private Criteria idCriteria(String id) {
        if (ObjectId.isValid(id)) {
            return Criteria.where("_id").is(new ObjectId(id));
        }
        return Criteria.where("_id").is(id);
    }

    private void ensureAllowedCollection(String name) {
        if (!MANAGED_COLLECTIONS.contains(name)) {
            throw new IllegalArgumentException("Collection is not allowed: " + name);
        }
    }
}

