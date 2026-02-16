package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.LoginUserDto;
import com.oleksandrmytro.timecapsule.dto.RegisterUserDto;
import com.oleksandrmytro.timecapsule.dto.RefreshTokenRequest;
import com.oleksandrmytro.timecapsule.dto.VerifyUserDto;
import com.oleksandrmytro.timecapsule.dto.ResendVerificationDto;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.responses.AuthSessionResponse;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import com.oleksandrmytro.timecapsule.services.AuthenticationService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;


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

    @PostMapping("/signup")
    public ResponseEntity<String> register(@Valid @RequestBody RegisterUserDto registerUserDto) {
        authenticationService.signup(registerUserDto);
        return ResponseEntity.status(HttpStatus.CREATED).body("Verification email sent. Please check your inbox.");
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> authenticate(@Valid @RequestBody LoginUserDto loginUserDto, HttpServletRequest request, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.authenticateAndIssueTokens(loginUserDto);
        writeAuthCookies(request, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/verify")
    public ResponseEntity<String> verifyUserPost(@Valid @RequestBody VerifyUserDto verifyUserDto) {
        authenticationService.verifyUser(verifyUserDto);
        return ResponseEntity.ok("Account verified successfully");
    }

    @GetMapping("/verify")
    public ResponseEntity<String> verifyUserGet(@RequestParam("code") String code) {
        VerifyUserDto dto = new VerifyUserDto();
        dto.setCode(code);
        authenticationService.verifyUser(dto);
        return ResponseEntity.ok("Account verified successfully");
    }

    @PostMapping("/verify-and-login")
    public ResponseEntity<LoginResponse> verifyAndLogin(@Valid @RequestBody VerifyUserDto verifyUserDto, HttpServletRequest request, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.verifyUserAndIssueTokens(verifyUserDto);
        writeAuthCookies(request, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/resend")
    public ResponseEntity<String> resendVerificationCode(@Valid @RequestBody ResendVerificationDto dto) {
        authenticationService.resendVerificationCode(dto.getEmail());
        return ResponseEntity.ok("Verification code sent");
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.refreshTokens(request);
        writeAuthCookies(httpRequest, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/refresh/check")
    public ResponseEntity<LoginResponse> refreshCheck(@Valid @RequestBody RefreshTokenRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        LoginResponse rotated = authenticationService.refreshWithRotationCheck(request);
        if (rotated != null) {
            writeAuthCookies(httpRequest, response, rotated);
            return ResponseEntity.ok(rotated);
        }
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
    }

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

    @GetMapping("/session")
    public ResponseEntity<AuthSessionResponse> session(Authentication authentication) {
        boolean authenticated = authentication != null && authentication.getPrincipal() instanceof User;
        return ResponseEntity.ok(new AuthSessionResponse(authenticated));
    }

    private void clearCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        // Clear both variants to reliably remove cookies across HTTP/HTTPS and proxy setups.
        response.addHeader("Set-Cookie", buildExpiredCookie(name, false));
        response.addHeader("Set-Cookie", buildExpiredCookie(name, true));

        // Also clear with runtime-detected secure flag in case browser/proxy normalizes attributes.
        boolean secure = request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
        response.addHeader("Set-Cookie", buildExpiredCookie(name, secure));
    }

    private String buildExpiredCookie(String name, boolean secure) {
        return name + "=; HttpOnly; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT" + (secure ? "; Secure" : "");
    }

    private void writeAuthCookies(HttpServletRequest request, HttpServletResponse response, LoginResponse tokens) {
        response.addHeader("Set-Cookie", buildCookie(request, "accessToken", tokens.getAccessToken(), (int) (tokens.getExpiresIn() / 1000)));
        response.addHeader("Set-Cookie", buildCookie(request, "refreshToken", tokens.getRefreshToken(), (int) (tokens.getRefreshExpiresIn() / 1000)));
    }

    private String buildCookie(HttpServletRequest request, String name, String value, int maxAgeSeconds) {
        boolean secure = request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
        String sameSite = resolveSameSite(request, secure);
        return name + "=" + value + "; HttpOnly; SameSite=" + sameSite + "; Path=/; Max-Age=" + maxAgeSeconds + (secure ? "; Secure" : "");
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
