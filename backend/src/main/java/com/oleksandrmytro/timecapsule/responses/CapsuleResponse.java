package com.oleksandrmytro.timecapsule.responses;

import java.time.Instant;
import java.util.List;

public class CapsuleResponse {
    private String id;
    private String ownerId;
    private String title;
    private String body;
    private List<Media> media;
    private String visibility;
    private String status;
    private Boolean isLocked; // true if sealed and unlock time hasn't arrived
    private Instant unlockAt;
    private Instant openedAt;
    private Instant expiresAt;
    private String geoMarkerId;
    private GeoPoint location;
    private Boolean allowComments;
    private Boolean allowReactions;
    private String shareToken;
    private List<String> tags;
    private String coverImageUrl;
    private Instant createdAt;
    private Instant updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public List<Media> getMedia() { return media; }
    public void setMedia(List<Media> media) { this.media = media; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Boolean getIsLocked() { return isLocked; }
    public void setIsLocked(Boolean isLocked) { this.isLocked = isLocked; }
    public Instant getUnlockAt() { return unlockAt; }
    public void setUnlockAt(Instant unlockAt) { this.unlockAt = unlockAt; }
    public Instant getOpenedAt() { return openedAt; }
    public void setOpenedAt(Instant openedAt) { this.openedAt = openedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public String getGeoMarkerId() { return geoMarkerId; }
    public void setGeoMarkerId(String geoMarkerId) { this.geoMarkerId = geoMarkerId; }
    public GeoPoint getLocation() { return location; }
    public void setLocation(GeoPoint location) { this.location = location; }
    public Boolean getAllowComments() { return allowComments; }
    public void setAllowComments(Boolean allowComments) { this.allowComments = allowComments; }
    public Boolean getAllowReactions() { return allowReactions; }
    public void setAllowReactions(Boolean allowReactions) { this.allowReactions = allowReactions; }
    public String getShareToken() { return shareToken; }
    public void setShareToken(String shareToken) { this.shareToken = shareToken; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class Media {
        private String id;
        private String url;
        private String type;
        private Object meta;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Object getMeta() { return meta; }
        public void setMeta(Object meta) { this.meta = meta; }
    }

    public static class GeoPoint {
        private String type;
        private List<Double> coordinates;

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public List<Double> getCoordinates() { return coordinates; }
        public void setCoordinates(List<Double> coordinates) { this.coordinates = coordinates; }
    }
}

