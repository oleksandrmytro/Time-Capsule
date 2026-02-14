package com.oleksandrmytro.timecapsule.models;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "capsules")
public class Capsule {
    @Id
    private String id;

    @Field("ownerId")
    private String ownerId;

    @Field("title")
    private String title;

    @Field("body")
    private String body;

    @Field("media")
    private List<Media> media = new ArrayList<>();

    @Field("visibility")
    private String visibility; // private | public | shared

    @Field("status")
    private String status; // draft | sealed | opened

    @Field("unlockAt")
    private Instant unlockAt;

    @Field("openedAt")
    private Instant openedAt;

    @Field("expiresAt")
    private Instant expiresAt;

    @Field("location")
    private GeoPoint location;

    @Field("allowComments")
    private Boolean allowComments;

    @Field("allowReactions")
    private Boolean allowReactions;

    @Field("shareToken")
    private String shareToken;

    @Field("tags")
    private List<String> tags = new ArrayList<>();

    @Field("createdAt")
    private Instant createdAt = Instant.now();

    @Field("updatedAt")
    private Instant updatedAt = Instant.now();

    @Field("deletedAt")
    private Instant deletedAt;

    public Capsule() {}

    // getters and setters
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
    public Instant getUnlockAt() { return unlockAt; }
    public void setUnlockAt(Instant unlockAt) { this.unlockAt = unlockAt; }
    public Instant getOpenedAt() { return openedAt; }
    public void setOpenedAt(Instant openedAt) { this.openedAt = openedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
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
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }

    public static class Media {
        private String url;
        private String type;
        private Object meta;

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

