package com.oleksandrmytro.timecapsule.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "tags")
public class Tag {
    @Id
    private String id;

    @Indexed(unique = true)
    @Field("name")
    private String name;

    @Field("imageUrl")
    private String imageUrl;

    @Field("isSystem")
    private boolean isSystem;

    @Field("createdBy")
    private ObjectId createdBy;

    @Field("createdAt")
    private Instant createdAt = Instant.now();

    public Tag() {}

    public Tag(String name, String imageUrl, boolean isSystem) {
        this.name = name;
        this.imageUrl = imageUrl;
        this.isSystem = isSystem;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public boolean isSystem() { return isSystem; }
    public void setSystem(boolean system) { isSystem = system; }
    @JsonIgnore
    public ObjectId getCreatedBy() { return createdBy; }
    public void setCreatedBy(ObjectId createdBy) { this.createdBy = createdBy; }

    @JsonProperty("createdBy")
    public String getCreatedByHex() { return createdBy != null ? createdBy.toHexString() : null; }

    @JsonProperty("createdBy")
    public void setCreatedByHex(String createdBy) {
        if (createdBy == null || createdBy.isBlank()) {
            this.createdBy = null;
            return;
        }
        this.createdBy = new ObjectId(createdBy);
    }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

