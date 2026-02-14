package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.UpdateProfileRequest;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.responses.UserProfileResponse;
import com.oleksandrmytro.timecapsule.services.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> me(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(toResponse(user));
    }

    @PatchMapping("/me")
    public ResponseEntity<UserProfileResponse> updateMe(@Valid @RequestBody UpdateProfileRequest req, Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(401).build();
        }
        User updated = userService.updateProfile(user.getId(), req);
        return ResponseEntity.ok(toResponse(updated));
    }

    private UserProfileResponse toResponse(User user) {
        UserProfileResponse resp = new UserProfileResponse();
        resp.setId(user.getId());
        resp.setUsername(user.getUsernameField());
        resp.setEmail(user.getEmail());
        resp.setAvatarUrl(user.getAvatarUrl());
        resp.setRole(user.getRoleDb());
        resp.setEnabled(user.isEnabled());
        resp.setCreatedAt(user.getCreatedAt());
        resp.setUpdatedAt(user.getUpdatedAt());
        if (user.getAuthProviders() != null) {
            resp.setAuthProviders(user.getAuthProviders().stream().map(ap -> {
                UserProfileResponse.AuthProvider m = new UserProfileResponse.AuthProvider();
                m.setProvider(ap.getProvider());
                m.setProviderId(ap.getProviderId());
                m.setEmail(ap.getEmail());
                m.setName(ap.getName());
                return m;
            }).collect(Collectors.toList()));
        }
        return resp;
    }
}
