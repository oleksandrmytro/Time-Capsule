package com.oleksandrmytro.timecapsule.models.enums;

/**
 * Allowed statuses for capsule sharing lifecycle.
 */
public enum ShareStatus {
    PENDING("pending");

    public static final String REGEX = "pending";

    private final String value;

    ShareStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean equalsValue(String candidate) {
        return candidate != null && value.equalsIgnoreCase(candidate);
    }

    public static ShareStatus fromValue(String value) {
        if (value == null) return null;
        for (ShareStatus s : values()) {
            if (s.equalsValue(value)) return s;
        }
        throw new IllegalArgumentException("Unknown share status: " + value);
    }
}

