package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.Tag;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.services.AdminService;
import com.oleksandrmytro.timecapsule.services.TagService;
import org.bson.Document;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final TagService tagService;

    public AdminController(AdminService adminService, TagService tagService) {
        this.adminService = adminService;
        this.tagService = tagService;
    }

    /* ── Stats ─────────────────────────── */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> stats(Authentication auth) {
        requireAdmin(auth);
        return ResponseEntity.ok(adminService.getStats());
    }

    /* ── Users ─────────────────────────── */
    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> listUsers(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean includeDeleted,
            @RequestParam(defaultValue = "false") boolean onlyBlocked,
            Authentication auth) {
        requireAdmin(auth);
        List<User> users = adminService.listUsers(q, page, size, includeDeleted, onlyBlocked);
        long total = adminService.countUsers(q, includeDeleted, onlyBlocked);
        // Map users to safe representation (without password)
        var mapped = users.stream().map(this::mapUser).toList();
        return ResponseEntity.ok(Map.of("items", mapped, "total", total, "page", page, "size", size));
    }

    @PatchMapping("/users/{id}")
    public ResponseEntity<Map<String, Object>> updateUser(@PathVariable String id, @RequestBody Map<String, Object> updates, Authentication auth) {
        User actor = requireAdmin(auth);
        User updated = adminService.updateUser(id, updates, actor);
        return ResponseEntity.ok(mapUser(updated));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id, Authentication auth) {
        User actor = requireAdmin(auth);
        adminService.deleteUser(id, actor);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/users/{id}/restore")
    public ResponseEntity<Map<String, Object>> restoreUser(@PathVariable String id, Authentication auth) {
        User actor = requireAdmin(auth);
        User updated = adminService.restoreUser(id, actor);
        return ResponseEntity.ok(mapUser(updated));
    }

    @PostMapping("/users/bulk")
    public ResponseEntity<Map<String, Object>> bulkUsers(@RequestBody Map<String, Object> payload, Authentication auth) {
        User actor = requireAdmin(auth);
        @SuppressWarnings("unchecked")
        List<String> ids = (List<String>) payload.getOrDefault("ids", List.of());
        String action = payload.get("action") == null ? null : payload.get("action").toString();
        String value = payload.get("value") == null ? null : payload.get("value").toString();
        long modified = adminService.bulkUsers(ids, action, value, actor);
        return ResponseEntity.ok(Map.of("modified", modified));
    }

    /* ── Capsules ──────────────────────── */
    @GetMapping("/capsules")
    public ResponseEntity<Map<String, Object>> listCapsules(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean includeDeleted,
            Authentication auth) {
        requireAdmin(auth);
        List<Capsule> capsules = adminService.listCapsules(q, page, size, includeDeleted);
        long total = adminService.countCapsules(q, includeDeleted);
        var mapped = capsules.stream().map(this::mapCapsule).toList();
        return ResponseEntity.ok(Map.of("items", mapped, "total", total, "page", page, "size", size));
    }

    @DeleteMapping("/capsules/{id}")
    public ResponseEntity<Void> deleteCapsule(@PathVariable String id, Authentication auth) {
        User actor = requireAdmin(auth);
        adminService.deleteCapsule(id, actor);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/capsules/{id}/restore")
    public ResponseEntity<Map<String, Object>> restoreCapsule(@PathVariable String id, Authentication auth) {
        User actor = requireAdmin(auth);
        Capsule updated = adminService.restoreCapsule(id, actor);
        return ResponseEntity.ok(mapCapsule(updated));
    }

    @PostMapping("/capsules/bulk")
    public ResponseEntity<Map<String, Object>> bulkCapsules(@RequestBody Map<String, Object> payload, Authentication auth) {
        User actor = requireAdmin(auth);
        @SuppressWarnings("unchecked")
        List<String> ids = (List<String>) payload.getOrDefault("ids", List.of());
        String action = payload.get("action") == null ? null : payload.get("action").toString();
        String value = payload.get("value") == null ? null : payload.get("value").toString();
        long modified = adminService.bulkCapsules(ids, action, value, actor);
        return ResponseEntity.ok(Map.of("modified", modified));
    }

    @PatchMapping("/capsules/{id}")
    public ResponseEntity<Map<String, Object>> updateCapsule(@PathVariable String id,
                                                             @RequestBody Map<String, Object> updates,
                                                             Authentication auth) {
        User actor = requireAdmin(auth);
        Capsule updated = adminService.updateCapsule(id, updates, actor);
        return ResponseEntity.ok(mapCapsule(updated));
    }

    /* ── Tags ──────────────────────────── */
    @GetMapping("/tags")
    public ResponseEntity<List<Tag>> listTags(Authentication auth) {
        requireAdmin(auth);
        return ResponseEntity.ok(tagService.listAll());
    }

    @DeleteMapping("/tags/{id}")
    public ResponseEntity<Void> deleteTag(@PathVariable String id, Authentication auth) {
        User actor = requireAdmin(auth);
        adminService.deleteTag(id, actor);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/tags")
    public ResponseEntity<Tag> createTag(@RequestBody Map<String, Object> payload, Authentication auth) {
        User actor = requireAdmin(auth);
        return ResponseEntity.ok(adminService.createTag(payload, actor));
    }

    @PatchMapping("/tags/{id}")
    public ResponseEntity<Tag> updateTag(@PathVariable String id,
                                         @RequestBody Map<String, Object> updates,
                                         Authentication auth) {
        User actor = requireAdmin(auth);
        return ResponseEntity.ok(adminService.updateTag(id, updates, actor));
    }

    @PostMapping("/tags/bulk")
    public ResponseEntity<Map<String, Object>> bulkTags(@RequestBody Map<String, Object> payload, Authentication auth) {
        User actor = requireAdmin(auth);
        @SuppressWarnings("unchecked")
        List<String> ids = (List<String>) payload.getOrDefault("ids", List.of());
        String action = payload.get("action") == null ? null : payload.get("action").toString();
        long modified = adminService.bulkTags(ids, action, actor);
        return ResponseEntity.ok(Map.of("modified", modified));
    }

    /* ── Audit log ─────────────────────── */
    @GetMapping("/audit-logs")
    public ResponseEntity<Map<String, Object>> listAuditLogs(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth
    ) {
        requireAdmin(auth);
        var items = adminService.listAuditLogs(q, page, size);
        long total = adminService.countAuditLogs(q);
        return ResponseEntity.ok(Map.of("items", items, "total", total, "page", page, "size", size));
    }

    /* ── Universal Collections ───────────── */
    @GetMapping("/collections")
    public ResponseEntity<List<String>> listCollections(Authentication auth) {
        requireAdmin(auth);
        return ResponseEntity.ok(adminService.listManagedCollections());
    }

    @GetMapping("/collections/{name}")
    public ResponseEntity<Map<String, Object>> listCollectionDocs(@PathVariable String name,
                                                                  @RequestParam(defaultValue = "") String q,
                                                                  @RequestParam(defaultValue = "0") int page,
                                                                  @RequestParam(defaultValue = "20") int size,
                                                                  Authentication auth) {
        requireAdmin(auth);
        List<Document> items = adminService.listCollectionDocs(name, q, page, size);
        long total = adminService.countCollectionDocs(name, q);
        return ResponseEntity.ok(Map.of("items", items, "total", total, "page", page, "size", size));
    }

    @PatchMapping("/collections/{name}/{id}")
    public ResponseEntity<Document> updateCollectionDoc(@PathVariable String name,
                                                        @PathVariable String id,
                                                        @RequestBody Map<String, Object> updates,
                                                        Authentication auth) {
        User actor = requireAdmin(auth);
        return ResponseEntity.ok(adminService.updateCollectionDoc(name, id, updates, actor));
    }

    @DeleteMapping("/collections/{name}/{id}")
    public ResponseEntity<Void> deleteCollectionDoc(@PathVariable String name,
                                                    @PathVariable String id,
                                                    Authentication auth) {
        User actor = requireAdmin(auth);
        adminService.deleteCollectionDoc(name, id, actor);
        return ResponseEntity.ok().build();
    }

    /* ── Helpers ───────────────────────── */
    private User requireAdmin(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        if (user.getRole() != User.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: admin role required");
        }
        return user;
    }

    private Map<String, Object> mapUser(User u) {
        return Map.ofEntries(
            Map.entry("id", u.getId() != null ? u.getId() : ""),
            Map.entry("username", u.getUsernameField() != null ? u.getUsernameField() : ""),
            Map.entry("email", u.getEmail() != null ? u.getEmail() : ""),
            Map.entry("role", u.getRoleDb() != null ? u.getRoleDb() : "regular"),
            Map.entry("enabled", u.isEnabled()),
            Map.entry("status", userStatus(u)),
            Map.entry("isOnline", u.isOnline()),
            Map.entry("avatarUrl", u.getAvatarUrl() != null ? u.getAvatarUrl() : ""),
            Map.entry("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : ""),
            Map.entry("blockedUntil", u.getBlockedUntil() != null ? u.getBlockedUntil().toString() : ""),
            Map.entry("deletedAt", u.getDeletedAt() != null ? u.getDeletedAt().toString() : "")
        );
    }

    private Map<String, Object> mapCapsule(Capsule c) {
        return Map.ofEntries(
            Map.entry("id", c.getId() != null ? c.getId() : ""),
            Map.entry("title", c.getTitle() != null ? c.getTitle() : ""),
            Map.entry("body", c.getBody() != null ? c.getBody() : ""),
            Map.entry("status", c.getStatus() != null ? c.getStatus() : ""),
            Map.entry("visibility", c.getVisibility() != null ? c.getVisibility() : ""),
            Map.entry("ownerId", c.getOwnerId() != null ? c.getOwnerId().toHexString() : ""),
            Map.entry("unlockAt", c.getUnlockAt() != null ? c.getUnlockAt().toString() : ""),
            Map.entry("expiresAt", c.getExpiresAt() != null ? c.getExpiresAt().toString() : ""),
            Map.entry("createdAt", c.getCreatedAt() != null ? c.getCreatedAt().toString() : ""),
            Map.entry("updatedAt", c.getUpdatedAt() != null ? c.getUpdatedAt().toString() : ""),
            Map.entry("allowComments", c.getAllowComments() != null ? c.getAllowComments() : false),
            Map.entry("allowReactions", c.getAllowReactions() != null ? c.getAllowReactions() : false),
            Map.entry("tags", c.getTags() != null ? c.getTags() : List.of()),
            Map.entry("media", c.getMedia() != null ? c.getMedia() : List.of()),
            Map.entry("coverImageUrl", c.getCoverImageUrl() != null ? c.getCoverImageUrl() : ""),
            Map.entry("deletedAt", c.getDeletedAt() != null ? c.getDeletedAt().toString() : "")
        );
    }

    private String userStatus(User user) {
        if (user.getDeletedAt() != null) return "deleted";
        if (user.getBlockedUntil() != null && user.getBlockedUntil().isAfter(java.time.LocalDateTime.now())) return "blocked";
        return user.isEnabled() ? "active" : "disabled";
    }
}

