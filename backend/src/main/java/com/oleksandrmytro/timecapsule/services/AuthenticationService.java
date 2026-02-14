package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.LoginUserDto;
import com.oleksandrmytro.timecapsule.dto.RegisterUserDto;
import com.oleksandrmytro.timecapsule.dto.RefreshTokenRequest;
import com.oleksandrmytro.timecapsule.dto.VerifyUserDto;
import com.oleksandrmytro.timecapsule.models.PendingUser;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.PendingUserRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import jakarta.mail.MessagingException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for user authentication operations.
 */
@Service
public class AuthenticationService {
    
    private static final Logger log = LoggerFactory.getLogger(AuthenticationService.class);
    private static final int VERIFICATION_CODE_TTL_MINUTES = 60 * 24; // 24h

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;
    private final JwtService jwtService;
    private final PendingUserRepository pendingUserRepository;

    public AuthenticationService(
            UserRepository userRepository,
            AuthenticationManager authenticationManager,
            PasswordEncoder passwordEncoder,
            EmailService emailService,
            JwtService jwtService,
            PendingUserRepository pendingUserRepository
    ) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.jwtService = jwtService;
        this.pendingUserRepository = pendingUserRepository;
    }

    /**
     * Register new user into pending storage.
     */
    public User signup(RegisterUserDto input) {
        if (input.getEmail() == null || input.getEmail().isBlank()) {
            throw new RuntimeException("Email is required");
        }
        if (input.getPassword() == null || input.getPassword().isBlank()) {
            throw new RuntimeException("Password is required");
        }
        if (userRepository.findByEmail(input.getEmail()).isPresent()) {
            throw new RuntimeException("User with this email already exists");
        }
        PendingUser pending = pendingUserRepository.findByEmail(input.getEmail())
                .orElse(new PendingUser(input.getUsername(), input.getEmail(), passwordEncoder.encode(input.getPassword())));
        pending.setUsername(input.getUsername());
        pending.setPasswordHash(passwordEncoder.encode(input.getPassword()));
        pending.setVerificationCode(generateCode());
        pending.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(VERIFICATION_CODE_TTL_MINUTES));
        pendingUserRepository.save(pending);
        sendVerificationEmail(pending.getEmail(), pending.getVerificationCode());
        return null; // nothing persisted in users until verification
    }

    /**
     * Authenticate user login.
     */
    public User authenticate(LoginUserDto input) {
        Optional<User> existing = userRepository.findByEmail(input.getEmail());
        if (existing.isEmpty()) {
            // Якщо є pending — значить ще не верифіковано
            if (pendingUserRepository.findByEmail(input.getEmail()).isPresent()) {
                throw new RuntimeException("Account not verified. Please verify your account.");
            }
            throw new RuntimeException("User not found");
        }
        User user = existing.get();
        if (!user.isEnabled()) {
            throw new RuntimeException("Account not verified. Please verify your account.");
        }
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(input.getEmail(), input.getPassword()));
        return user;
    }

    /**
     * Verify user with verification code from pending storage.
     */
    public void verifyUser(VerifyUserDto input) {
        PendingUser pending = resolvePending(input.getCode());
        User user = new User(pending.getUsername(), pending.getEmail(), pending.getPasswordHash());
        user.setEnabled(true);
        userRepository.save(user);
        pendingUserRepository.deleteByEmail(pending.getEmail());
    }

    public LoginResponse verifyUserAndIssueTokens(VerifyUserDto input) {
        PendingUser pending = resolvePending(input.getCode());
        User user = new User(pending.getUsername(), pending.getEmail(), pending.getPasswordHash());
        user.setEnabled(true);
        userRepository.save(user);
        pendingUserRepository.deleteByEmail(pending.getEmail());
        return buildTokens(user);
    }

    /**
     * Resend verification code for pending user.
     */
    public void resendVerificationCode(String email) {
        PendingUser pending = pendingUserRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (userRepository.findByEmail(email).isPresent()) {
            pendingUserRepository.deleteByEmail(email);
            throw new RuntimeException("Account is already verified");
        }
        pending.setVerificationCode(generateCode());
        pending.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(VERIFICATION_CODE_TTL_MINUTES));
        pendingUserRepository.save(pending);
        sendVerificationEmail(pending.getEmail(), pending.getVerificationCode());
    }

    public void sendVerificationEmail(String email, String plainCode) {
        String subject = "Account Verification";
        if (plainCode == null || plainCode.isBlank()) {
            throw new RuntimeException("No verification code present");
        }
        String message = "<html>"
                + "<body style=\"font-family: Arial, sans-serif;\">"
                + "<div style=\"background-color: #f5f5f5; padding: 20px;\">"
                + "<h2 style=\"color: #333;\">Welcome to our app!</h2>"
                + "<p style=\"font-size: 16px;\">Use this code to verify your email:</p>"
                + "<div style=\"background-color: #fff; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.1);\">"
                + "<p style=\"font-size: 20px; font-weight: bold; letter-spacing: 2px;\">" + plainCode + "</p>"
                + "</div>"
                + "<p style=\"font-size: 14px; color: #555;\">This code expires in 24 hours.</p>"
                + "</div>"
                + "</body>"
                + "</html>";

        try {
            emailService.sendVerificationEmail(email, subject, message);
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send verification email", e);
        }
    }

    private PendingUser resolvePending(String code) {
        if (code == null || code.isBlank()) {
            throw new RuntimeException("Verification code is required");
        }
        PendingUser pending = pendingUserRepository.findByVerificationCode(code)
                .orElseThrow(() -> new RuntimeException("Invalid or expired verification code"));
        if (pending.getVerificationCodeExpiresAt() == null || pending.getVerificationCodeExpiresAt().isBefore(LocalDateTime.now())) {
            pendingUserRepository.deleteByEmail(pending.getEmail());
            throw new RuntimeException("Verification code has expired");
        }
        if (userRepository.findByEmail(pending.getEmail()).isPresent()) {
            pendingUserRepository.deleteByEmail(pending.getEmail());
            throw new RuntimeException("User with this email already exists");
        }
        return pending;
    }

    private String generateCode() {
        int code = (int) (Math.random() * 900_000) + 100_000; // 6-digit
        return Integer.toString(code);
    }

    // Issue tokens after signup
    public LoginResponse signupAndIssueTokens(RegisterUserDto input) {
        throw new UnsupportedOperationException("Signup no longer issues tokens before verification");
    }

    // Issue tokens after login
    public LoginResponse authenticateAndIssueTokens(LoginUserDto input) {
        User user = authenticate(input);
        return buildTokens(user);
    }

    public LoginResponse refreshTokens(RefreshTokenRequest request) {
        String refreshToken = request.getRefreshToken();
        String username = jwtService.extractUsername(refreshToken);
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!jwtService.isRefreshTokenValid(refreshToken, user)) {
            log.warn("Refresh token rejected for userId={} email={}", user.getId(), user.getEmail());
            throw new IllegalArgumentException("Invalid refresh token");
        }

        return buildTokens(user);
    }

    public LoginResponse refreshWithRotationCheck(RefreshTokenRequest request) {
        String refreshToken = request.getRefreshToken();
        String username = jwtService.extractUsername(refreshToken);
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!jwtService.isRefreshTokenValid(refreshToken, user)) {
            log.warn("Refresh token rejected for userId={} email={}", user.getId(), user.getEmail());
            throw new IllegalArgumentException("Invalid refresh token");
        }

        LoginResponse rotated = jwtService.regenerateIfSecretRotated(refreshToken, user);
        if (rotated != null) {
            return rotated;
        }
        return null;
    }

    public LoginResponse buildTokens(User user) {
         String accessToken = jwtService.generateToken(user);
         String refreshToken = jwtService.generateRefreshToken(user);
         return new LoginResponse(
                 accessToken,
                 jwtService.getExpirationTime(),
                 refreshToken,
                 jwtService.getRefreshExpiration()
         );
     }
 }
