package com.oleksandrmytro.timecapsule.models.enums;

/**
 * Allowed roles for shared capsules.
 */
public enum ShareRole {
    VIEWER("viewer");

    public static final String REGEX = "viewer";

    private final String value;

    ShareRole(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean equalsValue(String candidate) {
        return candidate != null && value.equalsIgnoreCase(candidate);
    }

    public static ShareRole fromValue(String value) {
        if (value == null) return null;
        for (ShareRole r : values()) {
            if (r.equalsValue(value)) return r;
        }
        throw new IllegalArgumentException("Unknown share role: " + value);
    }
}

