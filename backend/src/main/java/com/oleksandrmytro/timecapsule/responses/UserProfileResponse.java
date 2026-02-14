package com.oleksandrmytro.timecapsule.responses;

import java.time.LocalDateTime;
import java.util.List;

public class UserProfileResponse {
    private String id;
    private String username;
    private String email;
    private String avatarUrl;
    private String role;
    private boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<AuthProvider> authProviders;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<AuthProvider> getAuthProviders() { return authProviders; }
    public void setAuthProviders(List<AuthProvider> authProviders) { this.authProviders = authProviders; }

    public static class AuthProvider {
        private String provider;
        private String providerId;
        private String email;
        private String name;

        public String getProvider() { return provider; }
        public void setProvider(String provider) { this.provider = provider; }
        public String getProviderId() { return providerId; }
        public void setProviderId(String providerId) { this.providerId = providerId; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }
}

