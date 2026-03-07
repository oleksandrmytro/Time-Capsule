package com.oleksandrmytro.timecapsule.models;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "shares")
public class Share {
    @Id
    private String id;

    @Field("capsuleId")
    private ObjectId capsuleId;

    @Field("granteeId")
    private ObjectId granteeId;

    @Field("inviterId")
    private ObjectId inviterId;

    @Field("role")
    private String role = "viewer";

    @Field("status")
    private String status = "pending";

    @Field("via")
    private String via = "invite";

    @Field("shareToken")
    private String shareToken;

    @Field("createdAt")
    private Instant createdAt = Instant.now();

    @Field("updatedAt")
    private Instant updatedAt = Instant.now();

    @Field("deletedAt")
    private Instant deletedAt;

    public Share() {}

    public Share(String capsuleId, String granteeId, String inviterId) {
        this.capsuleId = new ObjectId(capsuleId);
        this.granteeId = new ObjectId(granteeId);
        this.inviterId = new ObjectId(inviterId);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public ObjectId getCapsuleId() { return capsuleId; }
    public void setCapsuleId(ObjectId capsuleId) { this.capsuleId = capsuleId; }
    public ObjectId getGranteeId() { return granteeId; }
    public void setGranteeId(ObjectId granteeId) { this.granteeId = granteeId; }
    public ObjectId getInviterId() { return inviterId; }
    public void setInviterId(ObjectId inviterId) { this.inviterId = inviterId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getVia() { return via; }
    public void setVia(String via) { this.via = via; }
    public String getShareToken() { return shareToken; }
    public void setShareToken(String shareToken) { this.shareToken = shareToken; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}

