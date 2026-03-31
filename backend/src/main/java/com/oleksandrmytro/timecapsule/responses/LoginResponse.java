package com.oleksandrmytro.timecapsule.responses;

import lombok.Getter;
import lombok.Setter;

/**
 * Response DTO for successful login.
 */

@Getter
@Setter
public class LoginResponse {
    private String accessToken;
    private long expiresIn;
    private String refreshToken;
    private long refreshExpiresIn;
    private boolean mustChangePassword;
    private boolean impersonating;
    private String actingAdminId;
    private String actingAdminEmail;

    public LoginResponse(String accessToken, long expiresIn, String refreshToken, long refreshExpiresIn) {
        this.accessToken = accessToken;
        this.expiresIn = expiresIn;
        this.refreshToken = refreshToken;
        this.refreshExpiresIn = refreshExpiresIn;
        this.mustChangePassword = false;
        this.impersonating = false;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public long getExpiresIn() {
        return expiresIn;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public long getRefreshExpiresIn() {
        return refreshExpiresIn;
    }

    public boolean isMustChangePassword() {
        return mustChangePassword;
    }

    public void setMustChangePassword(boolean mustChangePassword) {
        this.mustChangePassword = mustChangePassword;
    }

    public boolean isImpersonating() {
        return impersonating;
    }

    public void setImpersonating(boolean impersonating) {
        this.impersonating = impersonating;
    }

    public String getActingAdminId() {
        return actingAdminId;
    }

    public void setActingAdminId(String actingAdminId) {
        this.actingAdminId = actingAdminId;
    }

    public String getActingAdminEmail() {
        return actingAdminEmail;
    }

    public void setActingAdminEmail(String actingAdminEmail) {
        this.actingAdminEmail = actingAdminEmail;
    }
}
