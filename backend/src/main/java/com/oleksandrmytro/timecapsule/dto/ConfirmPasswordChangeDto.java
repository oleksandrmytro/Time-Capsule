package com.oleksandrmytro.timecapsule.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConfirmPasswordChangeDto {
    @NotBlank(message = "Verification code is required")
    @JsonProperty("code")
    @JsonAlias({"verificationCode", "token"})
    private String code;

    @NotBlank(message = "New password is required")
    @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
    private String newPassword;
}
