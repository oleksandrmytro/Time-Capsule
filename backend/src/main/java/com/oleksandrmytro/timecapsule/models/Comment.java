package com.oleksandrmytro.timecapsule.models;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "comments")
public class Comment {
    @Id
    private String id;

    @Field("capsuleId")
    private ObjectId capsuleId;

    @Field("userId")
    private ObjectId userId;

    @Field("parentCommentId")
    private ObjectId parentCommentId;

    @Field("body")
    private String body;

    @Field("createdAt")
    private Instant createdAt = Instant.now();

    @Field("updatedAt")
    private Instant updatedAt = Instant.now();

    @Field("deletedAt")
    private Instant deletedAt;

    public Comment() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public ObjectId getCapsuleId() { return capsuleId; }
    public void setCapsuleId(ObjectId capsuleId) { this.capsuleId = capsuleId; }
    public ObjectId getUserId() { return userId; }
    public void setUserId(ObjectId userId) { this.userId = userId; }
    public ObjectId getParentCommentId() { return parentCommentId; }
    public void setParentCommentId(ObjectId parentCommentId) { this.parentCommentId = parentCommentId; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}



