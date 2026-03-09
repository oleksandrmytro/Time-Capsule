package com.oleksandrmytro.timecapsule.models.enums;

/**
 * Типи реакцій на капсулу.
 */
public enum ReactionType {
    LIKE("like"),
    LOVE("love"),
    WOW("wow"),
    BOOKMARK("bookmark");

    public static final String REGEX = "like|love|wow|bookmark";

    private final String value;

    ReactionType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ReactionType fromValue(String value) {
        if (value == null) return null;
        for (ReactionType t : values()) {
            if (t.value.equalsIgnoreCase(value)) return t;
        }
        return null;
    }
}

