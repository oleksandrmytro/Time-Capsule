package com.oleksandrmytro.timecapsule.models;

import com.oleksandrmytro.timecapsule.models.enums.ChatMessageStatus;
import com.oleksandrmytro.timecapsule.models.enums.ChatMessageType;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "chat_messages")
public class ChatMessage {
    @Id
    private String id;

    @Field("fromUserId")
    @Indexed
    private ObjectId fromUserId;

    @Field("toUserId")
    @Indexed
    private ObjectId toUserId;

    @Field("text")
    private String text;

    @Field("type")
    private String type = ChatMessageType.TEXT.getValue(); // text | capsule_share

    @Field("capsuleId")
    private ObjectId capsuleId;

    @Field("capsuleTitle")
    private String capsuleTitle;

    @Field("replyToMessageId")
    private ObjectId replyToMessageId;   // ID повідомлення, на яке це є відповіддю

    @Field("createdAt")
    @Indexed
    private Instant createdAt = Instant.now();

    @Field("status")
    private String status = ChatMessageStatus.SENT.getValue();

    @Field("deletedAt")
    private Instant deletedAt;

    public ChatMessage() {}

    public ChatMessage(String fromUserId, String toUserId, String text) {
        this.fromUserId = new ObjectId(fromUserId);
        this.toUserId = new ObjectId(toUserId);
        this.text = text;
    }

    // getters/setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public ObjectId getFromUserId() { return fromUserId; }
    public void setFromUserId(ObjectId fromUserId) { this.fromUserId = fromUserId; }
    public ObjectId getToUserId() { return toUserId; }
    public void setToUserId(ObjectId toUserId) { this.toUserId = toUserId; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public void setType(ChatMessageType type) { this.type = type != null ? type.getValue() : null; }
    public ObjectId getCapsuleId() { return capsuleId; }
    public void setCapsuleId(ObjectId capsuleId) { this.capsuleId = capsuleId; }
    public String getCapsuleTitle() { return capsuleTitle; }
    public void setCapsuleTitle(String capsuleTitle) { this.capsuleTitle = capsuleTitle; }
    public ObjectId getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(ObjectId replyToMessageId) { this.replyToMessageId = replyToMessageId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public void setStatus(ChatMessageStatus status) { this.status = status != null ? status.getValue() : null; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
