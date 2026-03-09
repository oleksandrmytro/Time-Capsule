package com.oleksandrmytro.timecapsule.models;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "reactions")
public class Reaction {
    @Id
    private String id;

    @Field("capsuleId")
    private ObjectId capsuleId;

    @Field("userId")
    private ObjectId userId;

    @Field("type")
    private String type;

    @Field("createdAt")
    private Instant createdAt = Instant.now();

    @Field("deletedAt")
    private Instant deletedAt;

    public Reaction() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public ObjectId getCapsuleId() { return capsuleId; }
    public void setCapsuleId(ObjectId capsuleId) { this.capsuleId = capsuleId; }
    public ObjectId getUserId() { return userId; }
    public void setUserId(ObjectId userId) { this.userId = userId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}

