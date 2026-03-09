package com.oleksandrmytro.timecapsule.dto;

import com.oleksandrmytro.timecapsule.models.enums.ReactionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class ReactionToggleRequest {
    @NotBlank(message = "Reaction type is required")
    @Pattern(regexp = ReactionType.REGEX, message = "Type must be one of: like, love, wow, bookmark")
    private String type;

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}

