package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.net.URI;

@Component
public class AuthCookieService {

    public static final String ACCESS_TOKEN_COOKIE = "accessToken";
    public static final String REFRESH_TOKEN_COOKIE = "refreshToken";
    private static final String ACCESS_TOKEN_PATH = "/";
    private static final String REFRESH_TOKEN_PATH = "/api/auth";

    public void writeAuthCookies(HttpServletRequest request, HttpServletResponse response, LoginResponse tokens) {
        applyNoStore(response);
        response.addHeader("Set-Cookie", buildCookie(
                request,
                ACCESS_TOKEN_COOKIE,
                tokens.getAccessToken(),
                (int) (tokens.getExpiresIn() / 1000),
                ACCESS_TOKEN_PATH
        ));
        response.addHeader("Set-Cookie", buildCookie(
                request,
                REFRESH_TOKEN_COOKIE,
                tokens.getRefreshToken(),
                (int) (tokens.getRefreshExpiresIn() / 1000),
                REFRESH_TOKEN_PATH
        ));
    }

    public void clearAuthCookies(HttpServletResponse response) {
        applyNoStore(response);
        clearCookie(response, ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_PATH);
        clearCookie(response, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_PATH);
        // Clear legacy refresh cookies that were previously issued on the root path.
        clearCookie(response, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_PATH);
        clearCookie(response, "JSESSIONID", ACCESS_TOKEN_PATH);
        clearCookie(response, "SESSION", ACCESS_TOKEN_PATH);
    }

    public void applyNoStore(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        response.setHeader("Pragma", "no-cache");
        response.setDateHeader("Expires", 0);
    }

    public String requireRefreshTokenCookie(HttpServletRequest request) {
        String refreshToken = extractCookie(request, REFRESH_TOKEN_COOKIE);
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalArgumentException("Refresh token cookie is missing");
        }
        return refreshToken;
    }

    public String extractCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private void clearCookie(HttpServletResponse response, String name, String path) {
        response.addHeader("Set-Cookie", buildExpiredCookie(name, false, path));
        response.addHeader("Set-Cookie", buildExpiredCookie(name, true, path));
    }

    private String buildExpiredCookie(String name, boolean secure, String path) {
        return name + "=; HttpOnly; Path=" + path + "; Max-Age=0; Expires=Thu, 03 Oct 2004 00:00:00 GMT"
                + (secure ? "; Secure" : "");
    }

    private String buildCookie(HttpServletRequest request, String name, String value, int maxAgeSeconds, String path) {
        boolean secure = isSecureRequest(request);
        String sameSite = resolveSameSite(request, secure);
        return name + "=" + value
                + "; HttpOnly"
                + "; SameSite=" + sameSite
                + "; Path=" + path
                + "; Max-Age=" + maxAgeSeconds
                + (secure ? "; Secure" : "");
    }

    private boolean isSecureRequest(HttpServletRequest request) {
        return request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
    }

    private String resolveSameSite(HttpServletRequest request, boolean secure) {
        if (secure && isCrossSiteRequest(request)) {
            return "None";
        }
        return "Lax";
    }

    private boolean isCrossSiteRequest(HttpServletRequest request) {
        String fetchSite = request.getHeader("Sec-Fetch-Site");
        if ("cross-site".equalsIgnoreCase(fetchSite)) {
            return true;
        }

        String origin = request.getHeader("Origin");
        if (origin == null || origin.isBlank()) {
            return false;
        }

        try {
            URI uri = URI.create(origin);
            String originHost = uri.getHost();
            return originHost != null && !originHost.equalsIgnoreCase(request.getServerName());
        } catch (Exception ignored) {
            return false;
        }
    }
}
