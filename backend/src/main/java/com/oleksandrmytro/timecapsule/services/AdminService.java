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
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.HashMap;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final CapsuleRepository capsuleRepository;
    private final MongoTemplate mongoTemplate;
    private final TagService tagService;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final AdminAuditLogRepository adminAuditLogRepository;
    private final java.security.SecureRandom secureRandom = new java.security.SecureRandom();

    private static final Set<String> MANAGED_COLLECTIONS = Set.of(
            "users", "capsules", "tags", "comments", "reactions", "shares", "follows",
            "chat_messages", "notifications", "reminders", "geomarkers", "feed_events", "pending_users", "admin_audit_logs"
    );
    private static final Set<String> REDACTED_EXACT_KEYS = Set.of(
            "password",
            "passwordhash",
            "verificationcode",
            "verificationcodeexpiresat",
            "accesstoken",
            "refreshtoken",
            "idtoken",
            "sessiontoken",
            "authtoken",
            "apitoken",
            "tokenhash"
    );

    public AdminService(
            UserRepository userRepository,
            CapsuleRepository capsuleRepository,
            MongoTemplate mongoTemplate,
            TagService tagService,
            PasswordEncoder passwordEncoder,
            EmailService emailService,
            AdminAuditLogRepository adminAuditLogRepository
    ) {
        this.userRepository = userRepository;
        this.capsuleRepository = capsuleRepository;
        this.mongoTemplate = mongoTemplate;
        this.tagService = tagService;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
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
    public List<User> listUsers(String query, int page, int size, boolean includeDeleted, boolean onlyBlocked, String role, String status) {
        Query q = buildUsersQuery(query, includeDeleted, onlyBlocked, role, status);
        q.with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return mongoTemplate.find(q, User.class);
    }

    public long countUsers(String query, boolean includeDeleted, boolean onlyBlocked, String role, String status) {
        Query q = buildUsersQuery(query, includeDeleted, onlyBlocked, role, status);
        return mongoTemplate.count(q, User.class);
    }

    private Query buildUsersQuery(String query, boolean includeDeleted, boolean onlyBlocked, String role, String status) {
        Query q = new Query();
        applyUserStatusFilter(q, includeDeleted, onlyBlocked, status);

        String normalizedRole = role == null ? "all" : role.trim().toLowerCase(Locale.ROOT);
        if ("admin".equals(normalizedRole) || "regular".equals(normalizedRole)) {
            q.addCriteria(Criteria.where("role").is(normalizedRole));
        }

        if (query != null && !query.isBlank()) {
            q.addCriteria(new Criteria().orOperator(
                    Criteria.where("username").regex(query, "i"),
                    Criteria.where("email").regex(query, "i")
            ));
        }
        return q;
    }

    private void applyUserStatusFilter(Query q, boolean includeDeleted, boolean onlyBlocked, String status) {
        String normalizedStatus = status == null ? "all" : status.trim().toLowerCase(Locale.ROOT);
        LocalDateTime now = LocalDateTime.now();

        if (!"all".equals(normalizedStatus)) {
            switch (normalizedStatus) {
                case "deleted" -> q.addCriteria(Criteria.where("deletedAt").ne(null));
                case "blocked" -> {
                    q.addCriteria(Criteria.where("deletedAt").is(null));
                    q.addCriteria(Criteria.where("blockedUntil").gt(now));
                }
                case "disabled" -> {
                    q.addCriteria(Criteria.where("deletedAt").is(null));
                    q.addCriteria(notBlockedCriteria(now));
                    q.addCriteria(Criteria.where("enabled").is(false));
                }
                case "active" -> {
                    q.addCriteria(Criteria.where("deletedAt").is(null));
                    q.addCriteria(notBlockedCriteria(now));
                    q.addCriteria(Criteria.where("enabled").is(true));
                }
                case "pending" -> {
                    q.addCriteria(Criteria.where("deletedAt").is(null));
                    q.addCriteria(Criteria.where("status").is("pending"));
                }
                default -> throw new IllegalArgumentException("Unsupported status filter: " + normalizedStatus);
            }
            return;
        }

        if (!includeDeleted) {
            q.addCriteria(Criteria.where("deletedAt").is(null));
        }
        if (onlyBlocked) {
            q.addCriteria(Criteria.where("blockedUntil").gt(now));
        }
    }

    private Criteria notBlockedCriteria(LocalDateTime now) {
        return new Criteria().orOperator(
                Criteria.where("blockedUntil").is(null),
                Criteria.where("blockedUntil").lte(now)
        );
    }

    public User createUser(Map<String, Object> payload, User actor) {
        String email = payload.get("email") == null ? "" : payload.get("email").toString().trim();
        String username = payload.get("username") == null ? "" : payload.get("username").toString().trim();
        String password = payload.get("password") == null ? "" : payload.get("password").toString();
        String role = payload.get("role") == null ? "regular" : payload.get("role").toString().trim().toLowerCase();
        boolean enabled = payload.get("enabled") == null || Boolean.parseBoolean(String.valueOf(payload.get("enabled")));

        if (email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        if (password.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }
        if (password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("User with this email already exists");
        }
        if (userRepository.findByUsernameIgnoreCase(username).isPresent()) {
            throw new IllegalArgumentException("Username already in use");
        }

        User user = new User(username, email, passwordEncoder.encode(password));
        user.setRoleDb("admin".equals(role) ? "admin" : "regular");
        user.setEnabled(enabled);
        user.setBlockedUntil(null);
        user.setDeletedAt(null);
        user.setVerificationCode(null);
        user.setVerificationCodeExpiresAt(null);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        User saved = userRepository.save(user);
        audit(actor, "USER_CREATE", "user", saved.getId(), Map.of(
                "username", saved.getUsernameField(),
                "email", saved.getEmail(),
                "role", saved.getRoleDb(),
                "enabled", saved.isEnabled()
        ));
        return saved;
    }

    public User updateUser(String id, Map<String, Object> updates, User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String originalEmail = user.getEmail();
        String originalUsername = user.getUsernameField();

        if (updates.containsKey("role") && updates.get("role") != null) {
            String role = updates.get("role").toString().trim().toLowerCase();
            if (!"admin".equals(role) && !"regular".equals(role)) {
                throw new IllegalArgumentException("Unsupported role: " + role);
            }
            user.setRoleDb(role);
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
                user.setMustChangePassword(false);
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
            } else if ("disabled".equalsIgnoreCase(status)) {
                user.setEnabled(false);
            } else {
                throw new IllegalArgumentException("Unsupported status: " + status);
            }
        }

        user.setUpdatedAt(LocalDateTime.now());
        Update update = new Update()
                .set("role", user.getRoleDb())
                .set("enabled", user.isEnabled())
                .set("username", user.getUsernameField())
                .set("email", user.getEmail())
                .set("avatarUrl", user.getAvatarUrl())
                .set("password", user.getPassword())
                .set("mustChangePassword", user.isMustChangePassword())
                .set("updatedAt", user.getUpdatedAt());

        if (user.getBlockedUntil() == null) {
            update.unset("blockedUntil");
        } else {
            update.set("blockedUntil", user.getBlockedUntil());
        }
        if (user.getDeletedAt() == null) {
            update.unset("deletedAt");
        } else {
            update.set("deletedAt", user.getDeletedAt());
        }

        updateUserByOriginalIdentity(id, originalEmail, originalUsername, update);
        User saved = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        audit(actor, "USER_UPDATE", "user", id, updates);
        return saved;
    }

    public void deleteUser(String id, User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Update update = new Update()
                .set("deletedAt", LocalDateTime.now())
                .set("enabled", false)
                .set("updatedAt", LocalDateTime.now());
        updateUserByIdentity(user, update);
        audit(actor, "USER_SOFT_DELETE", "user", id, Map.of());
    }

    public User restoreUser(String id, User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Update update = new Update()
                .unset("deletedAt")
                .set("enabled", true)
                .set("updatedAt", LocalDateTime.now());
        updateUserByIdentity(user, update);
        User saved = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        audit(actor, "USER_RESTORE", "user", id, Map.of());
        return saved;
    }

    public void issueTemporaryPassword(String id, User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new IllegalArgumentException("User does not have an email");
        }

        String tempPassword = generateTemporaryPassword(14);
        Update update = new Update()
                .set("password", passwordEncoder.encode(tempPassword))
                .set("mustChangePassword", true)
                .set("updatedAt", LocalDateTime.now());
        updateUserByIdentity(user, update);

        emailService.sendTemporaryPassword(user, tempPassword);
        audit(actor, "USER_TEMP_PASSWORD_ISSUE", "user", id, Map.of(
                "targetEmail", user.getEmail(),
                "targetUsername", user.getUsernameField() == null ? "" : user.getUsernameField()
        ));
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
        if (updates.containsKey("ownerId")) {
            String ownerId = updates.get("ownerId") == null ? "" : updates.get("ownerId").toString().trim();
            if (ownerId.isBlank()) {
                // keep existing owner when field is blank
            } else if (!ObjectId.isValid(ownerId)) {
                throw new IllegalArgumentException("Invalid ownerId");
            } else {
                u.set("ownerId", new ObjectId(ownerId));
            }
        }
        if (updates.containsKey("unlockAt")) {
            Instant unlockAt = parseInstantOrNull(updates.get("unlockAt"), "unlockAt");
            if (unlockAt == null) u.unset("unlockAt");
            else u.set("unlockAt", unlockAt);
        }
        if (updates.containsKey("expiresAt")) {
            Instant expiresAt = parseInstantOrNull(updates.get("expiresAt"), "expiresAt");
            if (expiresAt == null) u.unset("expiresAt");
            else u.set("expiresAt", expiresAt);
        }

        u.set("updatedAt", Instant.now());
        mongoTemplate.updateFirst(q, u, Capsule.class);

        Capsule updated = capsuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));
        audit(actor, "CAPSULE_UPDATE", "capsule", id, updates);
        return updated;
    }

    private Instant parseInstantOrNull(Object raw, String fieldName) {
        if (raw == null) return null;
        String value = raw.toString().trim();
        if (value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(value).atOffset(ZoneOffset.UTC).toInstant();
            } catch (DateTimeParseException ex) {
                throw new IllegalArgumentException("Invalid " + fieldName + " format");
            }
        }
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
        List<Document> docs = mongoTemplate.find(q, Document.class, name);
        List<Document> normalized = new ArrayList<>(docs.size());
        for (Document doc : docs) {
            normalized.add(sanitizeDocumentForResponse(name, normalizeDocumentForResponse(doc)));
        }
        return normalized;
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
        return sanitizeDocumentForResponse(collection, normalizeDocumentForResponse(updated));
    }

    public void deleteCollectionDoc(String collection, String id, User actor) {
        ensureAllowedCollection(collection);
        Query q = new Query(idCriteria(id));
        mongoTemplate.remove(q, collection);
        audit(actor, "COLLECTION_DELETE", collection, id, Map.of());
    }

    private Document normalizeDocumentForResponse(Document source) {
        if (source == null) return null;
        Document normalized = new Document();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            normalized.put(entry.getKey(), normalizeBsonValue(entry.getValue()));
        }
        return normalized;
    }

    private Document sanitizeDocumentForResponse(String collection, Document source) {
        if (source == null) return null;
        Document sanitized = new Document();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            String key = entry.getKey();
            if (isSensitiveField(collection, key)) {
                continue;
            }
            sanitized.put(key, sanitizeNestedValue(collection, entry.getValue()));
        }
        return sanitized;
    }

    private Object sanitizeNestedValue(String collection, Object value) {
        if (value == null) return null;
        if (value instanceof Document document) {
            return sanitizeDocumentForResponse(collection, document);
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> sanitized = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (isSensitiveField(collection, key)) {
                    continue;
                }
                sanitized.put(key, sanitizeNestedValue(collection, entry.getValue()));
            }
            return sanitized;
        }
        if (value instanceof List<?> list) {
            List<Object> sanitized = new ArrayList<>(list.size());
            for (Object item : list) {
                sanitized.add(sanitizeNestedValue(collection, item));
            }
            return sanitized;
        }
        return value;
    }

    private boolean isSensitiveField(String collection, String fieldName) {
        if (fieldName == null || fieldName.isBlank()) {
            return false;
        }
        String normalized = fieldName.toLowerCase(Locale.ROOT).trim();
        if (REDACTED_EXACT_KEYS.contains(normalized)) {
            return true;
        }

        if (normalized.contains("password")) {
            return true;
        }

        if (normalized.contains("token") && !normalized.endsWith("type")) {
            return true;
        }

        if (("users".equals(collection) || "pending_users".equals(collection)) && "authproviders".equals(normalized)) {
            return true;
        }

        return false;
    }

    private Object normalizeBsonValue(Object value) {
        if (value == null) return null;
        if (value instanceof ObjectId objectId) {
            return objectId.toHexString();
        }
        if (value instanceof Date date) {
            return date.toInstant().toString();
        }
        if (value instanceof Instant instant) {
            return instant.toString();
        }
        if (value instanceof LocalDateTime dateTime) {
            return dateTime.atOffset(ZoneOffset.UTC).toInstant().toString();
        }
        if (value instanceof Document document) {
            return normalizeDocumentForResponse(document);
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> normalized = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                normalized.put(String.valueOf(entry.getKey()), normalizeBsonValue(entry.getValue()));
            }
            return normalized;
        }
        if (value instanceof List<?> list) {
            List<Object> normalized = new ArrayList<>(list.size());
            for (Object item : list) {
                normalized.add(normalizeBsonValue(item));
            }
            return normalized;
        }
        return value;
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

    private void updateUserByOriginalIdentity(String id, String originalEmail, String originalUsername, Update update) {
        Query targeted = new Query(idCriteria(id));
        if (originalEmail != null && !originalEmail.isBlank()) {
            targeted.addCriteria(Criteria.where("email").is(originalEmail));
        }
        if (originalUsername != null && !originalUsername.isBlank()) {
            targeted.addCriteria(Criteria.where("username").is(originalUsername));
        }
        var targetedResult = mongoTemplate.updateFirst(targeted, update, User.class);
        if (targetedResult.getMatchedCount() > 0) {
            return;
        }
        mongoTemplate.updateFirst(new Query(idCriteria(id)), update, User.class);
    }

    private void updateUserByIdentity(User user, Update update) {
        Query targeted = new Query(idCriteria(user.getId()));
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            targeted.addCriteria(Criteria.where("email").is(user.getEmail()));
        }
        if (user.getUsernameField() != null && !user.getUsernameField().isBlank()) {
            targeted.addCriteria(Criteria.where("username").is(user.getUsernameField()));
        }

        var targetedResult = mongoTemplate.updateFirst(targeted, update, User.class);
        if (targetedResult.getMatchedCount() > 0) {
            return;
        }
        mongoTemplate.updateFirst(new Query(idCriteria(user.getId())), update, User.class);
    }

    private void ensureAllowedCollection(String name) {
        if (!MANAGED_COLLECTIONS.contains(name)) {
            throw new IllegalArgumentException("Collection is not allowed: " + name);
        }
    }

    private String generateTemporaryPassword(int length) {
        final String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*_-";
        if (length < 10) {
            length = 10;
        }
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            int idx = secureRandom.nextInt(alphabet.length());
            builder.append(alphabet.charAt(idx));
        }
        return builder.toString();
    }
}

