package com.oleksandrmytro.timecapsule.models;

import com.oleksandrmytro.timecapsule.models.enums.ShareRole;
import com.oleksandrmytro.timecapsule.models.enums.ShareStatus;
import com.oleksandrmytro.timecapsule.models.enums.ShareVia;
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
    private String role = ShareRole.VIEWER.getValue();

    @Field("status")
    private String status = ShareStatus.PENDING.getValue();

    @Field("via")
    private String via = ShareVia.INVITE.getValue();

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
    public void setRole(ShareRole role) { this.role = role != null ? role.getValue() : null; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public void setStatus(ShareStatus status) { this.status = status != null ? status.getValue() : null; }
    public String getVia() { return via; }
    public void setVia(String via) { this.via = via; }
    public void setVia(ShareVia via) { this.via = via != null ? via.getValue() : null; }
    public String getShareToken() { return shareToken; }
    public void setShareToken(String shareToken) { this.shareToken = shareToken; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
