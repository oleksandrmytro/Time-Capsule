package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.LoginUserDto;
import com.oleksandrmytro.timecapsule.dto.RegisterUserDto;
import com.oleksandrmytro.timecapsule.dto.VerifyUserDto;
import com.oleksandrmytro.timecapsule.models.AdminAuditLog;
import com.oleksandrmytro.timecapsule.models.PendingUser;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.AdminAuditLogRepository;
import com.oleksandrmytro.timecapsule.repositories.PendingUserRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import jakarta.mail.MessagingException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
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
    private static final String IMPERSONATED_BY_ADMIN_ID_CLAIM = "impersonatedByAdminId";
    private static final String IMPERSONATED_BY_ADMIN_EMAIL_CLAIM = "impersonatedByAdminEmail";
    private static final String IMPERSONATION_ACTIVE_CLAIM = "impersonationActive";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;
    private final JwtService jwtService;
    private final PendingUserRepository pendingUserRepository;
    private final AdminAuditLogRepository adminAuditLogRepository;

    public AuthenticationService(
            UserRepository userRepository,
            AuthenticationManager authenticationManager,
            PasswordEncoder passwordEncoder,
            EmailService emailService,
            JwtService jwtService,
            PendingUserRepository pendingUserRepository,
            AdminAuditLogRepository adminAuditLogRepository
    ) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.jwtService = jwtService;
        this.pendingUserRepository = pendingUserRepository;
        this.adminAuditLogRepository = adminAuditLogRepository;
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
        ensureAccountCanAuthenticate(user);
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
        String message = "<!doctype html>"
                + "<html lang=\"en\">"
                + "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"><title>Account Verification</title></head>"
                + "<body style=\"margin:0;padding:0;background:#050816;font-family:Segoe UI,Arial,sans-serif;color:#dbe7ff;\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#050816;padding:22px 10px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:#0B1220;\">"
                + "<tr><td style=\"padding:24px 28px;background:linear-gradient(135deg,rgba(124,92,255,.3),rgba(94,230,255,.22));\">"
                + "<p style=\"margin:0 0 8px 0;font-size:11px;line-height:1.4;letter-spacing:.12em;text-transform:uppercase;color:#c5d2f0;\">TimeCapsule</p>"
                + "<h1 style=\"margin:0 0 8px 0;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;\">Verify Your Account</h1>"
                + "<p style=\"margin:0;font-size:14px;line-height:1.6;color:#d5e1fa;\">Use the code below to confirm your email address.</p>"
                + "</td></tr>"
                + "<tr><td style=\"padding:24px 28px 18px 28px;\">"
                + "<div style=\"margin:0 0 14px 0;border-radius:14px;border:1px solid rgba(94,230,255,.35);background:rgba(17,32,64,.55);padding:16px 18px;\">"
                + "<p style=\"margin:0;font-size:28px;line-height:1.1;letter-spacing:4px;font-weight:700;color:#5EE6FF;text-align:center;\">" + plainCode + "</p>"
                + "</div>"
                + "<p style=\"margin:0;font-size:13px;line-height:1.55;color:#9fb0cf;\">This code expires in 24 hours.</p>"
                + "</td></tr>"
                + "</table>"
                + "<p style=\"max-width:640px;margin:12px auto 0 auto;font-size:11px;line-height:1.5;color:#6f83a8;\">Automated message from TimeCapsule</p>"
                + "</td></tr></table></body></html>";

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

    public LoginResponse refreshTokens(String refreshToken) {
        // extractUsername повертає subject з JWT — тепер це userId (раніше був email)
        String subject = jwtService.extractUsername(refreshToken);
        // Шукаємо по userId (новий формат), fallback на email (старі токени)
        User user = userRepository.findById(subject)
                .orElseGet(() -> userRepository.findByEmail(subject)
                        .orElseThrow(() -> new IllegalArgumentException("User not found")));

        if (!jwtService.isRefreshTokenValid(refreshToken, user)) {
            log.warn("Refresh token rejected for userId={} email={}", user.getId(), user.getEmail());
            throw new IllegalArgumentException("Invalid refresh token");
        }
        ensureAccountCanAuthenticate(user);

        ImpersonationContext impersonation = extractImpersonationContext(refreshToken);
        return buildTokens(user, impersonation);
    }

    public LoginResponse refreshWithRotationCheck(String refreshToken) {
        // extractUsername повертає subject з JWT — тепер це userId (раніше був email)
        String subject = jwtService.extractUsername(refreshToken);
        // Шукаємо по userId (новий формат), fallback на email (старі токени)
        User user = userRepository.findById(subject)
                .orElseGet(() -> userRepository.findByEmail(subject)
                        .orElseThrow(() -> new IllegalArgumentException("User not found")));

        if (!jwtService.isRefreshTokenValid(refreshToken, user)) {
            log.warn("Refresh token rejected for userId={} email={}", user.getId(), user.getEmail());
            throw new IllegalArgumentException("Invalid refresh token");
        }
        ensureAccountCanAuthenticate(user);

        if (jwtService.isKidMismatched(refreshToken)) {
            return buildTokens(user, extractImpersonationContext(refreshToken));
        }
        return null;
    }

    public LoginResponse buildTokens(User user) {
         return buildTokens(user, null);
     }

    public LoginResponse impersonateAsUser(User admin, String targetUserId) {
        if (admin == null || admin.getRole() != User.Role.ADMIN) {
            throw new IllegalArgumentException("Only admins can impersonate users");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        ensureAccountCanAuthenticate(target);

        ImpersonationContext impersonation = new ImpersonationContext(admin.getId(), admin.getEmail());
        LoginResponse response = buildTokens(target, impersonation);
        audit(admin, "USER_IMPERSONATION_START", "user", target.getId(), Map.of(
                "targetEmail", target.getEmail() == null ? "" : target.getEmail(),
                "targetUsername", target.getUsernameField() == null ? "" : target.getUsernameField()
        ));
        return response;
    }

    public LoginResponse stopImpersonation(String adminId, String activeUserId) {
        if (!StringUtils.hasText(adminId)) {
            throw new IllegalArgumentException("Impersonation admin id is missing");
        }
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found"));
        if (admin.getRole() != User.Role.ADMIN) {
            throw new IllegalArgumentException("Impersonation owner is not an admin");
        }
        ensureAccountCanAuthenticate(admin);
        LoginResponse response = buildTokens(admin, null);

        Map<String, Object> details = new HashMap<>();
        details.put("activeUserId", activeUserId == null ? "" : activeUserId);
        audit(admin, "USER_IMPERSONATION_STOP", "user", admin.getId(), details);
        return response;
    }

    private LoginResponse buildTokens(User user, ImpersonationContext impersonation) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", user.getEmail());
        claims.put("username", user.getUsernameField());
        claims.put("role", user.getRoleDb());
        if (impersonation != null && StringUtils.hasText(impersonation.adminId())) {
            claims.put(IMPERSONATION_ACTIVE_CLAIM, true);
            claims.put(IMPERSONATED_BY_ADMIN_ID_CLAIM, impersonation.adminId());
            if (StringUtils.hasText(impersonation.adminEmail())) {
                claims.put(IMPERSONATED_BY_ADMIN_EMAIL_CLAIM, impersonation.adminEmail());
            }
        }

        String accessToken = jwtService.generateToken(claims, user);
        String refreshToken = jwtService.generateRefreshToken(claims, user);
        LoginResponse response = new LoginResponse(
                accessToken,
                jwtService.getExpirationTime(),
                refreshToken,
                jwtService.getRefreshExpiration()
        );
        response.setMustChangePassword(user.isMustChangePassword());
        response.setImpersonating(impersonation != null && StringUtils.hasText(impersonation.adminId()));
        response.setActingAdminId(impersonation != null ? impersonation.adminId() : null);
        response.setActingAdminEmail(impersonation != null ? impersonation.adminEmail() : null);
        return response;
    }

    private ImpersonationContext extractImpersonationContext(String token) {
        String adminId = jwtService.extractClaim(token, claims -> claims.get(IMPERSONATED_BY_ADMIN_ID_CLAIM, String.class));
        if (!StringUtils.hasText(adminId)) {
            return null;
        }
        String adminEmail = jwtService.extractClaim(token, claims -> claims.get(IMPERSONATED_BY_ADMIN_EMAIL_CLAIM, String.class));
        return new ImpersonationContext(adminId, adminEmail);
    }

    private void audit(User actor, String action, String entityType, String entityId, Map<String, Object> details) {
        if (actor == null) {
            return;
        }
        AdminAuditLog logRecord = new AdminAuditLog();
        logRecord.setActorId(actor.getId());
        logRecord.setActorEmail(actor.getEmail());
        logRecord.setActorRole(actor.getRoleDb());
        logRecord.setAction(action);
        logRecord.setEntityType(entityType);
        logRecord.setEntityId(entityId);
        logRecord.setDetails(details);
        logRecord.setCreatedAt(Instant.now());
        adminAuditLogRepository.save(logRecord);
    }

    private void ensureAccountCanAuthenticate(User user) {
        if (user.getDeletedAt() != null) {
            throw new RuntimeException("Account was deleted");
        }
        if (user.getBlockedUntil() != null && user.getBlockedUntil().isAfter(LocalDateTime.now())) {
            throw new RuntimeException("Account is banned");
        }
        if (!user.isEnabled()) {
            throw new RuntimeException("Account is disabled");
        }
    }

    private record ImpersonationContext(String adminId, String adminEmail) {}
 }
