package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.LoginUserDto;
import com.oleksandrmytro.timecapsule.dto.RegisterUserDto;
import com.oleksandrmytro.timecapsule.dto.RefreshTokenRequest;
import com.oleksandrmytro.timecapsule.dto.VerifyUserDto;
import com.oleksandrmytro.timecapsule.dto.ResendVerificationDto;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import com.oleksandrmytro.timecapsule.services.AuthenticationService;
import com.oleksandrmytro.timecapsule.services.JwtService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller for authentication endpoints.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthenticationController {
    
    private final JwtService jwtService;
    private final AuthenticationService authenticationService;

    public AuthenticationController(JwtService jwtService, AuthenticationService authenticationService) {
        this.jwtService = jwtService;
        this.authenticationService = authenticationService;
    }

    @PostMapping("/signup")
    public ResponseEntity<String> register(@Valid @RequestBody RegisterUserDto registerUserDto) {
        authenticationService.signup(registerUserDto);
        return ResponseEntity.status(HttpStatus.CREATED).body("Verification email sent. Please check your inbox.");
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> authenticate(@Valid @RequestBody LoginUserDto loginUserDto) {
        LoginResponse loginResponse = authenticationService.authenticateAndIssueTokens(loginUserDto);
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
    public ResponseEntity<LoginResponse> verifyAndLogin(@Valid @RequestBody VerifyUserDto verifyUserDto) {
        LoginResponse loginResponse = authenticationService.verifyUserAndIssueTokens(verifyUserDto);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/resend")
    public ResponseEntity<String> resendVerificationCode(@Valid @RequestBody ResendVerificationDto dto) {
        authenticationService.resendVerificationCode(dto.getEmail());
        return ResponseEntity.ok("Verification code sent");
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authenticationService.refreshTokens(request));
    }

    @PostMapping("/refresh/check")
    public ResponseEntity<LoginResponse> refreshCheck(@Valid @RequestBody RefreshTokenRequest request) {
        LoginResponse rotated = authenticationService.refreshWithRotationCheck(request);
        if (rotated != null) {
            return ResponseEntity.ok(rotated);
        }
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        clearCookie(response, "accessToken");
        clearCookie(response, "refreshToken");
        return ResponseEntity.noContent().build();
    }

    private void clearCookie(HttpServletResponse response, String name) {
        response.addHeader("Set-Cookie", name + "=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
    }
}
