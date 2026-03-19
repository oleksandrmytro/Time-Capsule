package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.CreateCapsuleRequest;
import com.oleksandrmytro.timecapsule.dto.ShareCapsuleRequest;
import com.oleksandrmytro.timecapsule.responses.CapsuleResponse;
import com.oleksandrmytro.timecapsule.services.CapsuleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/capsules")
public class CapsuleController {

    private final CapsuleService capsuleService;

    public CapsuleController(CapsuleService capsuleService) {
        this.capsuleService = capsuleService;
    }

    @PostMapping
    public ResponseEntity<CapsuleResponse> create(@Valid @RequestBody CreateCapsuleRequest request, Authentication auth) {
        String ownerId = currentUserId(auth);
        return ResponseEntity.ok(capsuleService.create(ownerId, request));
    }

    @GetMapping
    public ResponseEntity<List<CapsuleResponse>> listMine(Authentication auth) {
        String ownerId = currentUserId(auth);
        return ResponseEntity.ok(capsuleService.listMine(ownerId));
    }

    @GetMapping("/calendar")
    public ResponseEntity<List<CapsuleResponse>> calendar(
            @RequestParam String from,
            @RequestParam String to,
            Authentication auth) {
        String ownerId = currentUserId(auth);
        Instant fromInst = Instant.parse(from);
        Instant toInst = Instant.parse(to);
        return ResponseEntity.ok(capsuleService.listByDateRange(ownerId, fromInst, toInst));
    }

    /**
     * Отримання капсули за id. Дозволяє як авторизованим, так і анонімним користувачам.
     * @param id
     * @param auth
     * @return
     */
    @GetMapping("/{id}")
    public ResponseEntity<CapsuleResponse> get(@PathVariable String id, Authentication auth) {
        String viewerId = currentUserIdOrNull(auth);
        return ResponseEntity.ok(capsuleService.getAccessible(id, viewerId));
    }

    @PostMapping("/{id}/unlock")
    public ResponseEntity<CapsuleResponse> unlock(@PathVariable String id, Authentication auth) {
        String ownerId = currentUserId(auth);
        return ResponseEntity.ok(capsuleService.unlockCapsule(id, ownerId));
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<Void> share(@PathVariable String id, @RequestBody ShareCapsuleRequest req, Authentication auth) {
        String sharerId = currentUserId(auth);
        capsuleService.shareCapsule(id, sharerId, req != null ? req.getUserIds() : null);
        return ResponseEntity.ok().build();
    }

    /**
     * Там, де потрібен авторизований користувач
     * @param auth
     * @return
     */
    private String currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof UserDetails ud)) {
            throw new IllegalArgumentException("Unauthorized");
        }
        if (ud instanceof com.oleksandrmytro.timecapsule.models.User u) {
            return u.getId();
        }
        return ud.getUsername();
    }

    /**
     * Там, де хочемо дозволити і анонімальних користувачів
     * @param auth
     * @return
     */
    private String currentUserIdOrNull(Authentication auth) {
        try {
            return currentUserId(auth);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
