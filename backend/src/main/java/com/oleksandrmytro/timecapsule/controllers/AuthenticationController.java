package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.LoginUserDto;
import com.oleksandrmytro.timecapsule.dto.RefreshTokenRequest;
import com.oleksandrmytro.timecapsule.dto.RegisterUserDto;
import com.oleksandrmytro.timecapsule.dto.ResendVerificationDto;
import com.oleksandrmytro.timecapsule.dto.VerifyUserDto;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.responses.AuthSessionResponse;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import com.oleksandrmytro.timecapsule.services.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/**
 * Controller for authentication endpoints.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    public AuthenticationController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    // PostMapping - обробляє POST-запит на "/signup" та запускає флоу реєстрації з email verification.
    @PostMapping("/signup")
    public ResponseEntity<String> register(@Valid @RequestBody RegisterUserDto registerUserDto) {
        authenticationService.signup(registerUserDto);
        return ResponseEntity.status(HttpStatus.CREATED).body("Verification email sent. Please check your inbox.");
    }

    /**
     * Обробляє POST-запит на "/login" для аутентифікації користувача.
     * У разі успіху записує access/refresh cookie та повертає LoginResponse.
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> authenticate(@Valid @RequestBody LoginUserDto loginUserDto, HttpServletRequest request, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.authenticateAndIssueTokens(loginUserDto);
        writeAuthCookies(request, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    /**
     * Обробляє POST-запит на "/verify" для підтвердження акаунта кодом.
     */
    @PostMapping("/verify")
    public ResponseEntity<String> verifyUserPost(@Valid @RequestBody VerifyUserDto verifyUserDto) {
        authenticationService.verifyUser(verifyUserDto);
        return ResponseEntity.ok("Account verified successfully");
    }

    /**
     * Обробляє GET-запит на "/verify" (підтвердження з email-посилання).
     */
    @GetMapping("/verify")
    public ResponseEntity<String> verifyUserGet(@RequestParam("code") String code) {
        VerifyUserDto dto = new VerifyUserDto();
        dto.setCode(code);
        authenticationService.verifyUser(dto);
        return ResponseEntity.ok("Account verified successfully");
    }

    /**
     * Обробляє POST-запит на "/verify-and-login":
     * підтверджує акаунт і одразу видає токени.
     */
    @PostMapping("/verify-and-login")
    public ResponseEntity<LoginResponse> verifyAndLogin(@Valid @RequestBody VerifyUserDto verifyUserDto, HttpServletRequest request, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.verifyUserAndIssueTokens(verifyUserDto);
        writeAuthCookies(request, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    /**
     * Обробляє POST-запит на "/resend" для повторної відправки коду верифікації.
     */
    @PostMapping("/resend")
    public ResponseEntity<String> resendVerificationCode(@Valid @RequestBody ResendVerificationDto dto) {
        authenticationService.resendVerificationCode(dto.getEmail());
        return ResponseEntity.ok("Verification code sent");
    }

    /**
     * Обробляє POST-запит на "/refresh" для оновлення access/refresh токенів.
     */
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.refreshTokens(request);
        writeAuthCookies(httpRequest, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    /**
     * Обробляє POST-запит на "/refresh/check" для ротації токенів при secret-version mismatch.
     */
    @PostMapping("/refresh/check")
    public ResponseEntity<LoginResponse> refreshCheck(@Valid @RequestBody RefreshTokenRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        LoginResponse rotated = authenticationService.refreshWithRotationCheck(request);
        if (rotated != null) {
            writeAuthCookies(httpRequest, response, rotated);
            return ResponseEntity.ok(rotated);
        }
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
    }

    /**
     * Обробляє POST-запит на "/logout":
     * інвалідовує сесію, чистить security context і видаляє auth cookies.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();

        clearCookie(request, response, "accessToken");
        clearCookie(request, response, "refreshToken");
        clearCookie(request, response, "JSESSIONID");
        clearCookie(request, response, "SESSION");
        return ResponseEntity.noContent().build();
    }

    /**
     * Обробляє POST-запит на "/impersonation/stop" та повертає сесію адміна назад.
     */
    @PostMapping("/impersonation/stop")
    public ResponseEntity<LoginResponse> stopImpersonation(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User activeUser)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Object adminIdRaw = request.getAttribute("impersonation.adminId");
        String adminId = adminIdRaw == null ? null : adminIdRaw.toString();
        if (adminId == null || adminId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        LoginResponse tokens = authenticationService.stopImpersonation(adminId, activeUser.getId());
        writeAuthCookies(request, response, tokens);
        return ResponseEntity.ok(tokens);
    }

    /**
     * Обробляє GET-запит на "/session" для перевірки, чи є активна auth-сесія.
     */
    @GetMapping("/session")
    public ResponseEntity<AuthSessionResponse> session(Authentication authentication) {
        boolean authenticated = authentication != null && authentication.getPrincipal() instanceof User;
        return ResponseEntity.ok(new AuthSessionResponse(authenticated));
    }

    /**
     * Допоміжний метод для видалення cookie в різних secure/samesite комбінаціях.
     */
    private void clearCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        response.addHeader("Set-Cookie", buildExpiredCookie(name, false));
        response.addHeader("Set-Cookie", buildExpiredCookie(name, true));
        boolean secure = request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
        response.addHeader("Set-Cookie", buildExpiredCookie(name, secure));
    }

    private String buildExpiredCookie(String name, boolean secure) {
        return name + "=; HttpOnly; Path=/; Max-Age=0; Expires=Thu, 03 Oct 2004 00:00:00 GMT" + (secure ? "; Secure" : "");
    }

    /**
     * Допоміжний метод для запису access/refresh токенів у HttpOnly cookie.
     */
    private void writeAuthCookies(HttpServletRequest request, HttpServletResponse response, LoginResponse tokens) {
        response.addHeader("Set-Cookie", buildCookie(request, "accessToken", tokens.getAccessToken(), (int) (tokens.getExpiresIn() / 1000)));
        response.addHeader("Set-Cookie", buildCookie(request, "refreshToken", tokens.getRefreshToken(), (int) (tokens.getRefreshExpiresIn() / 1000)));
    }

    /**
     * Формує Set-Cookie з правильною політикою SameSite + Secure.
     */
    private String buildCookie(HttpServletRequest request, String name, String value, int maxAgeSeconds) {
        boolean secure = request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
        String sameSite = resolveSameSite(request, secure);
        return name + "=" + value + "; HttpOnly; SameSite=" + sameSite + "; Path=/; Max-Age=" + maxAgeSeconds + (secure ? "; Secure" : "");
    }

    /**
     * Якщо HTTPS + cross-site, повертає SameSite=None, інакше Lax.
     */
    private String resolveSameSite(HttpServletRequest request, boolean secure) {
        if (secure && isCrossSiteRequest(request)) {
            return "None";
        }
        return "Lax";
    }

    /**
     * Визначає, чи запит є cross-site (по Sec-Fetch-Site/Origin).
     */
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
