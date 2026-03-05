package com.oleksandrmytro.timecapsule.events;

import java.time.Instant;
import java.util.List;

public class CapsuleStatusEvent {
    private String id;
    private String status;
    private Boolean isLocked;
    private Instant unlockAt;
    private Instant openedAt;
    private List<String> tags;

    public CapsuleStatusEvent() {}

    public CapsuleStatusEvent(String id, String status, Boolean isLocked, Instant unlockAt, Instant openedAt, List<String> tags) {
        this.id = id;
        this.status = status;
        this.isLocked = isLocked;
        this.unlockAt = unlockAt;
        this.openedAt = openedAt;
        this.tags = tags;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Boolean getIsLocked() { return isLocked; }
    public void setIsLocked(Boolean isLocked) { this.isLocked = isLocked; }
    public Instant getUnlockAt() { return unlockAt; }
    public void setUnlockAt(Instant unlockAt) { this.unlockAt = unlockAt; }
    public Instant getOpenedAt() { return openedAt; }
    public void setOpenedAt(Instant openedAt) { this.openedAt = openedAt; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}

