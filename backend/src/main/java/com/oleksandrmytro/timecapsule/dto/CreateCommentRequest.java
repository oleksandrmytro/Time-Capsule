package com.oleksandrmytro.timecapsule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateCommentRequest {
    @NotBlank(message = "Comment body is required")
    @Size(max = 2000, message = "Comment must not exceed 2000 characters")
    private String body;

    private String parentCommentId;

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getParentCommentId() { return parentCommentId; }
    public void setParentCommentId(String parentCommentId) { this.parentCommentId = parentCommentId; }
}


