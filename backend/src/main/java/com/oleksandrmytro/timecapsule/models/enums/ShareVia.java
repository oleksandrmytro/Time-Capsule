package com.oleksandrmytro.timecapsule.models.enums;

/**
 * Indicates how a capsule was shared.
 */
public enum ShareVia {
    INVITE("invite");

    public static final String REGEX = "invite";

    private final String value;

    ShareVia(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean equalsValue(String candidate) {
        return candidate != null && value.equalsIgnoreCase(candidate);
    }

    public static ShareVia fromValue(String value) {
        if (value == null) return null;
        for (ShareVia v : values()) {
            if (v.equalsValue(value)) return v;
        }
        throw new IllegalArgumentException("Unknown share via: " + value);
    }
}

