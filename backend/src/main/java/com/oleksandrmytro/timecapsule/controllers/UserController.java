package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.UpdateProfileRequest;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.responses.UserProfileResponse;
import com.oleksandrmytro.timecapsule.services.UserService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> me(Authentication auth, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Expires", "0");

        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(toResponse(user, user.getId()));
    }

    @PatchMapping("/me")
    public ResponseEntity<UserProfileResponse> updateMe(@Valid @RequestBody UpdateProfileRequest req, Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(401).build();
        }
        User updated = userService.updateProfile(user.getId(), req);
        return ResponseEntity.ok(toResponse(updated, user.getId()));
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserProfileResponse>> search(@RequestParam(name = "q", required = false, defaultValue = "") String query, Authentication auth) {
        String currentUserId = (auth != null && auth.getPrincipal() instanceof User u) ? u.getId() : null;
        List<UserProfileResponse> result = userService.searchUsers(query).stream()
                .map(u -> toResponse(u, currentUserId))
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserProfileResponse> getById(@PathVariable String id, Authentication auth) {
        String currentUserId = (auth != null && auth.getPrincipal() instanceof User u) ? u.getId() : null;
        try {
            User u = userService.getByIdOrUsername(id);
            return ResponseEntity.ok(toResponse(u, currentUserId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/follow")
    public ResponseEntity<Void> follow(@PathVariable String id, Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User me)) {
            return ResponseEntity.status(401).build();
        }
        try {
            userService.follow(id, me.getId());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/unfollow")
    public ResponseEntity<Void> unfollow(@PathVariable String id, Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User me)) {
            return ResponseEntity.status(401).build();
        }
        userService.unfollow(id, me.getId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/followers")
    public ResponseEntity<List<UserProfileResponse>> followers(@PathVariable String id, Authentication auth) {
        String currentUserId = (auth != null && auth.getPrincipal() instanceof User u) ? u.getId() : null;
        try {
            List<UserProfileResponse> list = userService.followers(id).stream().map(u -> toResponse(u, currentUserId)).toList();
            return ResponseEntity.ok(list);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/following")
    public ResponseEntity<List<UserProfileResponse>> following(@PathVariable String id, Authentication auth) {
        String currentUserId = (auth != null && auth.getPrincipal() instanceof User u) ? u.getId() : null;
        try {
            List<UserProfileResponse> list = userService.following(id).stream().map(u -> toResponse(u, currentUserId)).toList();
            return ResponseEntity.ok(list);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    private UserProfileResponse toResponse(User user, String currentUserId) {
        UserProfileResponse resp = new UserProfileResponse();
        resp.setId(user.getId());
        resp.setUsername(user.getUsernameField());
        resp.setEmail(user.getEmail());
        resp.setAvatarUrl(user.getAvatarUrl());
        resp.setRole(user.getRoleDb());
        resp.setEnabled(user.isEnabled());
        resp.setCreatedAt(user.getCreatedAt());
        resp.setUpdatedAt(user.getUpdatedAt());
        resp.setOnline(user.isOnline());
        resp.setDisplayName(user.getUsernameField());
        resp.setFollowersCount(userService.followersCount(user.getId()));
        resp.setFollowingCount(userService.followingCount(user.getId()));
        resp.setCapsulesCount(userService.capsulesCount(user.getId()));
        if (currentUserId != null && !currentUserId.equals(user.getId())) {
            resp.setFollowing(userService.isFollowing(user.getId(), currentUserId));
        } else {
            resp.setFollowing(false);
        }
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
