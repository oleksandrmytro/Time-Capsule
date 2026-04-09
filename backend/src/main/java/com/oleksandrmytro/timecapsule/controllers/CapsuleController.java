package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.CreateCapsuleRequest;
import com.oleksandrmytro.timecapsule.dto.ShareCapsuleRequest;
import com.oleksandrmytro.timecapsule.dto.UpdateCapsuleRequest;
import com.oleksandrmytro.timecapsule.responses.CapsuleResponse;
import com.oleksandrmytro.timecapsule.services.CapsuleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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

    @GetMapping("/public")
    public ResponseEntity<List<CapsuleResponse>> listPublic() {
        return ResponseEntity.ok(capsuleService.listPublic());
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

    @GetMapping("/map")
    public ResponseEntity<List<Map<String, Object>>> map(Authentication auth) {
        String ownerId = currentUserId(auth);
        return ResponseEntity.ok(capsuleService.listMapMarkers(ownerId));
    }

    @GetMapping("/{id}/edit")
    public ResponseEntity<CapsuleResponse> getEditable(@PathVariable String id, Authentication auth) {
        String actorId = currentUserId(auth);
        return ResponseEntity.ok(capsuleService.getEditable(id, actorId));
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

    @PutMapping("/{id}")
    public ResponseEntity<CapsuleResponse> update(@PathVariable String id,
                                                  @Valid @RequestBody UpdateCapsuleRequest request,
                                                  Authentication auth) {
        String actorId = currentUserId(auth);
        return ResponseEntity.ok(capsuleService.update(id, actorId, request));
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
        if (auth == null) {
            auth = SecurityContextHolder.getContext().getAuthentication();
        }
        if (auth == null || auth.getPrincipal() == null) {
            throw new IllegalArgumentException("Unauthorized");
        }

        Object principal = auth.getPrincipal();
        if (principal instanceof com.oleksandrmytro.timecapsule.models.User u) {
            return u.getId();
        }
        if (principal instanceof UserDetails ud) {
            return ud.getUsername();
        }
        if (principal instanceof String value && !value.isBlank() && !"anonymousUser".equalsIgnoreCase(value)) {
            return value;
        }

        throw new IllegalArgumentException("Unauthorized");
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
