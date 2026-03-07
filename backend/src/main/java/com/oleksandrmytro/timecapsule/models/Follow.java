package com.oleksandrmytro.timecapsule.models;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "follows")
public class Follow {
    @Id
    private String id;

    @Field("userId")
    private ObjectId userId; // who is being followed

    @Field("followerId")
    private ObjectId followerId; // who follows

    @Field("createdAt")
    private Instant createdAt = Instant.now();

    @Field("deletedAt")
    private Instant deletedAt;

    public Follow() {}

    public Follow(String userId, String followerId) {
        this.userId = new ObjectId(userId);
        this.followerId = new ObjectId(followerId);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public ObjectId getUserId() { return userId; }
    public void setUserId(ObjectId userId) { this.userId = userId; }
    public ObjectId getFollowerId() { return followerId; }
    public void setFollowerId(ObjectId followerId) { this.followerId = followerId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
