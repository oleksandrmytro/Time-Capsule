package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.ReactionToggleRequest;
import com.oleksandrmytro.timecapsule.responses.ReactionSummaryResponse;
import com.oleksandrmytro.timecapsule.services.ReactionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/capsules/{capsuleId}/reactions")
public class ReactionController {

    private final ReactionService reactionService;

    public ReactionController(ReactionService reactionService) {
        this.reactionService = reactionService;
    }

    /**
     * Перемикає реакцію (потребує авторизації).
     */
    @PostMapping
    public ResponseEntity<ReactionSummaryResponse> toggleReaction(
            @PathVariable String capsuleId,
            @Valid @RequestBody ReactionToggleRequest request,
            Authentication auth) {
        String userId = currentUserId(auth);
        return ResponseEntity.ok(reactionService.toggleReaction(userId, capsuleId, request.getType()));
    }

    /**
     * Повертає підсумок реакцій (доступно для всіх).
     */
    @GetMapping
    public ResponseEntity<ReactionSummaryResponse> getSummary(
            @PathVariable String capsuleId,
            Authentication auth) {
        String viewerId = currentUserIdOrNull(auth);
        return ResponseEntity.ok(reactionService.getSummary(capsuleId, viewerId));
    }

    private String currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof UserDetails ud)) {
            throw new IllegalArgumentException("Unauthorized");
        }
        if (ud instanceof com.oleksandrmytro.timecapsule.models.User u) {
            return u.getId();
        }
        return ud.getUsername();
    }

    private String currentUserIdOrNull(Authentication auth) {
        try {
            return currentUserId(auth);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}

