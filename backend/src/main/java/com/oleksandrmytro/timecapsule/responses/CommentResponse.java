package com.oleksandrmytro.timecapsule.responses;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class CommentResponse {
    private String id;
    private String capsuleId;
    private String userId;
    private String username;
    private String avatarUrl;
    private String body;
    private String parentCommentId;
    @JsonIgnore
    private List<CommentResponse> replies = new ArrayList<>();
    private Instant createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCapsuleId() { return capsuleId; }
    public void setCapsuleId(String capsuleId) { this.capsuleId = capsuleId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getParentCommentId() { return parentCommentId; }
    public void setParentCommentId(String parentCommentId) { this.parentCommentId = parentCommentId; }
    @JsonIgnore
    public List<CommentResponse> getReplies() { return replies; }
    public void setReplies(List<CommentResponse> replies) { this.replies = replies; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}


