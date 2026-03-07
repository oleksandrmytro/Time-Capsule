package com.oleksandrmytro.timecapsule.models.enums;

/**
 * Stored in Mongo as plain strings for backward compatibility.
 */
public enum CapsuleStatus {
    DRAFT("draft"),
    SEALED("sealed"),
    OPENED("opened");

    public static final String REGEX = "draft|sealed|opened";

    private final String value;

    CapsuleStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean equalsValue(String candidate) {
        return candidate != null && value.equalsIgnoreCase(candidate);
    }

    public boolean isSealed() {
        return this == SEALED;
    }

    public boolean isOpened() {
        return this == OPENED;
    }

    public static CapsuleStatus fromValue(String value) {
        if (value == null) return null;
        for (CapsuleStatus status : values()) {
            if (status.equalsValue(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown capsule status: " + value);
    }
}

