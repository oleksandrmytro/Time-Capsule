package com.oleksandrmytro.timecapsule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public class CreateCapsuleRequest {
    @NotBlank
    private String title;
    private String body;
    private List<MediaDto> media;
    @NotBlank
    private String visibility; // private | public | shared
    @NotBlank
    private String status; // draft | sealed | opened
    @NotNull
    private Instant unlockAt;
    private Instant expiresAt;
    private GeoPointDto location;
    private Boolean allowComments;
    private Boolean allowReactions;
    private List<String> tags;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public List<MediaDto> getMedia() { return media; }
    public void setMedia(List<MediaDto> media) { this.media = media; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getUnlockAt() { return unlockAt; }
    public void setUnlockAt(Instant unlockAt) { this.unlockAt = unlockAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public GeoPointDto getLocation() { return location; }
    public void setLocation(GeoPointDto location) { this.location = location; }
    public Boolean getAllowComments() { return allowComments; }
    public void setAllowComments(Boolean allowComments) { this.allowComments = allowComments; }
    public Boolean getAllowReactions() { return allowReactions; }
    public void setAllowReactions(Boolean allowReactions) { this.allowReactions = allowReactions; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public static class MediaDto {
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

    public static class GeoPointDto {
        private String type;
        private List<Double> coordinates;

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public List<Double> getCoordinates() { return coordinates; }
        public void setCoordinates(List<Double> coordinates) { this.coordinates = coordinates; }
    }
}

