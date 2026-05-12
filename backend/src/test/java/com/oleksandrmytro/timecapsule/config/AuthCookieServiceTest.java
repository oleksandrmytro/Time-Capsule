package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthCookieServiceTest {

    private final AuthCookieService authCookieService = new AuthCookieService();

    @Test
    void writeAuthCookiesUsesSecureNoneForCrossSiteHttpsRequests() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setServerName("api.timecapsule.local");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("Origin", "https://app.timecapsule.local");
        MockHttpServletResponse response = new MockHttpServletResponse();

        authCookieService.writeAuthCookies(
                request,
                response,
                new LoginResponse("access-token", 900_000, "refresh-token", 86_400_000)
        );

        List<String> cookies = response.getHeaders("Set-Cookie");
        assertEquals(2, cookies.size());
        assertTrue(cookies.get(0).contains("accessToken=access-token"));
        assertTrue(cookies.get(0).contains("SameSite=None"));
        assertTrue(cookies.get(0).contains("Secure"));
        assertTrue(cookies.get(0).contains("Path=/"));
        assertTrue(cookies.get(0).contains("Max-Age=900"));
        assertTrue(cookies.get(1).contains("refreshToken=refresh-token"));
        assertTrue(cookies.get(1).contains("Path=/api/auth"));
        assertTrue(cookies.get(1).contains("Max-Age=86400"));
        assertEquals("no-store, no-cache, must-revalidate, max-age=0", response.getHeader("Cache-Control"));
    }

    @Test
    void clearAuthCookiesExpiresCurrentAndLegacyCookiePaths() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        authCookieService.clearAuthCookies(response);

        List<String> cookies = response.getHeaders("Set-Cookie");
        assertEquals(10, cookies.size());
        assertTrue(cookies.stream().anyMatch(cookie -> cookie.contains("accessToken=") && cookie.contains("Path=/") && cookie.contains("Max-Age=0")));
        assertTrue(cookies.stream().anyMatch(cookie -> cookie.contains("refreshToken=") && cookie.contains("Path=/api/auth") && cookie.contains("Max-Age=0")));
        assertTrue(cookies.stream().anyMatch(cookie -> cookie.contains("refreshToken=") && cookie.contains("Path=/") && cookie.contains("Max-Age=0")));
        assertTrue(cookies.stream().anyMatch(cookie -> cookie.contains("JSESSIONID=") && cookie.contains("Path=/") && cookie.contains("Max-Age=0")));
        assertTrue(cookies.stream().anyMatch(cookie -> cookie.contains("SESSION=") && cookie.contains("Path=/") && cookie.contains("Max-Age=0")));
    }

    @Test
    void requireRefreshTokenCookieRejectsMissingCookie() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        assertThrows(IllegalArgumentException.class, () -> authCookieService.requireRefreshTokenCookie(request));
    }
}
