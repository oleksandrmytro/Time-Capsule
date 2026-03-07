package com.oleksandrmytro.timecapsule.models.enums;

/**
 * Centralized visibility values for capsules.
 */
public enum CapsuleVisibility {
    PRIVATE("private"),
    PUBLIC("public"),
    SHARED("shared");

    public static final String REGEX = "private|public|shared";

    private final String value;

    CapsuleVisibility(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean equalsValue(String candidate) {
        return candidate != null && value.equalsIgnoreCase(candidate);
    }

    public static CapsuleVisibility fromValue(String value) {
        if (value == null) return null;
        for (CapsuleVisibility v : values()) {
            if (v.equalsValue(value)) {
                return v;
            }
        }
        throw new IllegalArgumentException("Unknown capsule visibility: " + value);
    }
}

