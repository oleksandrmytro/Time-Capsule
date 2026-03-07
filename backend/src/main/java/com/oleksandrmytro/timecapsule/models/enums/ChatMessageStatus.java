package com.oleksandrmytro.timecapsule.models.enums;

/**
 * Delivery status for chat messages.
 */
public enum ChatMessageStatus {
    SENT("sent");

    public static final String REGEX = "sent";

    private final String value;

    ChatMessageStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean equalsValue(String candidate) {
        return candidate != null && value.equalsIgnoreCase(candidate);
    }

    public static ChatMessageStatus fromValue(String value) {
        if (value == null) return null;
        for (ChatMessageStatus s : values()) {
            if (s.equalsValue(value)) return s;
        }
        throw new IllegalArgumentException("Unknown chat message status: " + value);
    }
}

