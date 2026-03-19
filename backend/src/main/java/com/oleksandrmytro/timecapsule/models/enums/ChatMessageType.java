package com.oleksandrmytro.timecapsule.models.enums;

/**
 * Types of chat messages.
 */
public enum ChatMessageType {
    TEXT("text"),
    IMAGE("image"),
    VIDEO("video"),
    CAPSULE_SHARE("capsule_share");

    public static final String REGEX = "text|image|video|capsule_share";

    private final String value;

    ChatMessageType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean equalsValue(String candidate) {
        return candidate != null && value.equalsIgnoreCase(candidate);
    }

    public static ChatMessageType fromValue(String value) {
        if (value == null) return null;
        for (ChatMessageType t : values()) {
            if (t.equalsValue(value)) return t;
        }
        throw new IllegalArgumentException("Unknown chat message type: " + value);
    }
}

