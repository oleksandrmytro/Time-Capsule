package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.CreateCapsuleRequest;
import com.oleksandrmytro.timecapsule.responses.CapsuleResponse;
import com.oleksandrmytro.timecapsule.services.CapsuleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

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

    @GetMapping("/{id}")
    public ResponseEntity<CapsuleResponse> get(@PathVariable String id, Authentication auth) {
        String ownerId = currentUserId(auth);
        return ResponseEntity.ok(capsuleService.getMine(id, ownerId));
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
}

