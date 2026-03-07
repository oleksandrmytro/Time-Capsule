package com.oleksandrmytro.timecapsule.dto;

import java.util.List;

public class ShareCapsuleRequest {
    private List<String> userIds;

    public List<String> getUserIds() { return userIds; }
    public void setUserIds(List<String> userIds) { this.userIds = userIds; }
}

