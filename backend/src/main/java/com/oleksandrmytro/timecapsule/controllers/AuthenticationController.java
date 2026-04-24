package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.config.AuthCookieService;
import com.oleksandrmytro.timecapsule.dto.LoginUserDto;
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

/**
 * Controller for authentication endpoints.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthenticationController {

    private final AuthenticationService authenticationService;
    private final AuthCookieService authCookieService;

    public AuthenticationController(AuthenticationService authenticationService, AuthCookieService authCookieService) {
        this.authenticationService = authenticationService;
        this.authCookieService = authCookieService;
    }

    @PostMapping("/signup")
    public ResponseEntity<String> register(@Valid @RequestBody RegisterUserDto registerUserDto) {
        authenticationService.signup(registerUserDto);
        return ResponseEntity.status(HttpStatus.CREATED).body("Verification email sent. Please check your inbox.");
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> authenticate(@Valid @RequestBody LoginUserDto loginUserDto,
                                                      HttpServletRequest request,
                                                      HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.authenticateAndIssueTokens(loginUserDto);
        authCookieService.writeAuthCookies(request, response, loginResponse);
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
    public ResponseEntity<LoginResponse> verifyAndLogin(@Valid @RequestBody VerifyUserDto verifyUserDto,
                                                        HttpServletRequest request,
                                                        HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.verifyUserAndIssueTokens(verifyUserDto);
        authCookieService.writeAuthCookies(request, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/resend")
    public ResponseEntity<String> resendVerificationCode(@Valid @RequestBody ResendVerificationDto dto) {
        authenticationService.resendVerificationCode(dto.getEmail());
        return ResponseEntity.ok("Verification code sent");
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = authCookieService.requireRefreshTokenCookie(request);
        LoginResponse loginResponse = authenticationService.refreshTokens(refreshToken);
        authCookieService.writeAuthCookies(request, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/refresh/check")
    public ResponseEntity<LoginResponse> refreshCheck(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = authCookieService.requireRefreshTokenCookie(request);
        LoginResponse rotated = authenticationService.refreshWithRotationCheck(refreshToken);
        if (rotated != null) {
            authCookieService.writeAuthCookies(request, response, rotated);
            return ResponseEntity.ok(rotated);
        }
        authCookieService.applyNoStore(response);
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        authCookieService.clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/impersonation/stop")
    public ResponseEntity<LoginResponse> stopImpersonation(Authentication authentication,
                                                           HttpServletRequest request,
                                                           HttpServletResponse response) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User activeUser)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Object adminIdRaw = request.getAttribute("impersonation.adminId");
        String adminId = adminIdRaw == null ? null : adminIdRaw.toString();
        if (adminId == null || adminId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        LoginResponse tokens = authenticationService.stopImpersonation(adminId, activeUser.getId());
        authCookieService.writeAuthCookies(request, response, tokens);
        return ResponseEntity.ok(tokens);
    }

    @GetMapping("/session")
    public ResponseEntity<AuthSessionResponse> session(Authentication authentication, HttpServletResponse response) {
        authCookieService.applyNoStore(response);
        boolean authenticated = authentication != null && authentication.getPrincipal() instanceof User;
        return ResponseEntity.ok(new AuthSessionResponse(authenticated));
    }
}
