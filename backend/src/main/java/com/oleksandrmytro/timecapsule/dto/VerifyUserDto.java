package com.oleksandrmytro.timecapsule.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * DTO for user verification request.
 */
@Getter
@Setter
public class VerifyUserDto {
    @NotBlank(message = "Verification code is required")
    @JsonProperty("code")
    @JsonAlias({"verificationCode", "token"})
    private String code;
}
