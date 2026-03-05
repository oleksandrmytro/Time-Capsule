package com.oleksandrmytro.timecapsule.responses;

public class AuthSessionResponse {
    private boolean authenticated;

    public AuthSessionResponse() {
    }

    public AuthSessionResponse(boolean authenticated) {
        this.authenticated = authenticated;
    }

    public boolean isAuthenticated() {
        return authenticated;
    }

    public void setAuthenticated(boolean authenticated) {
        this.authenticated = authenticated;
    }
}
