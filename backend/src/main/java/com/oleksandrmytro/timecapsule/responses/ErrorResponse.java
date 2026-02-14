package com.oleksandrmytro.timecapsule.responses;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String code, String message, String path, String traceId) {
}

