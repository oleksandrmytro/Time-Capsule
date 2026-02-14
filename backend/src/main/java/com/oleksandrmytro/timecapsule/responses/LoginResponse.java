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

    public LoginResponse(String accessToken, long expiresIn, String refreshToken, long refreshExpiresIn) {
        this.accessToken = accessToken;
        this.expiresIn = expiresIn;
        this.refreshToken = refreshToken;
        this.refreshExpiresIn = refreshExpiresIn;
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
}
