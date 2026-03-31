package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;

/**
 * Service for sending emails.
 */
@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String DIGEST_COLLECTION = "email_digest_state";
    private static final String DIGEST_TYPE_COMMENT = "comment";
    private static final String DIGEST_TYPE_CHAT = "chat";

    private final JavaMailSender emailSender;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final String frontendUrl;
    private final int digestThreshold;
    private final Duration digestCooldown;
    private final Duration digestInactiveDelay;
    private final Duration digestLockTtl;

    public EmailService(JavaMailSender emailSender,
                        UserRepository userRepository,
                        MongoTemplate mongoTemplate,
                        @Value("${frontend.url:http://localhost}") String frontendUrl,
                        @Value("${app.notifications.digest.threshold:5}") int digestThreshold,
                        @Value("${app.notifications.digest.cooldown:PT30M}") Duration digestCooldown,
                        @Value("${app.notifications.digest.inactive-delay:PT2H}") Duration digestInactiveDelay,
                        @Value("${app.notifications.digest.lock-ttl:PT5M}") Duration digestLockTtl) {
        this.emailSender = emailSender;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
        this.frontendUrl = normalizeFrontendUrl(frontendUrl);
        this.digestThreshold = Math.max(1, digestThreshold);
        this.digestCooldown = digestCooldown.isNegative() ? Duration.ZERO : digestCooldown;
        this.digestInactiveDelay = digestInactiveDelay.isNegative() ? Duration.ZERO : digestInactiveDelay;
        this.digestLockTtl = digestLockTtl.isNegative() ? Duration.ofMinutes(5) : digestLockTtl;
    }

    public void sendHtmlEmail(String to, String subject, String htmlBody) throws MessagingException {
        MimeMessage message = emailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(
                message,
                MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                StandardCharsets.UTF_8.name()
        );

        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);

        emailSender.send(message);
    }

    public void sendVerificationEmail(String to, String subject, String text) throws MessagingException {
        sendHtmlEmail(to, subject, text);
    }

    public void sendPasswordChangeCode(User user, String plainCode) {
        if (user == null || !StringUtils.hasText(user.getEmail())) {
            throw new RuntimeException("User email is required");
        }
        if (!StringUtils.hasText(plainCode)) {
            throw new RuntimeException("Verification code is required");
        }

        String safeName = HtmlUtils.htmlEscape(resolveDisplayName(user));
        String safeCode = HtmlUtils.htmlEscape(plainCode);
        String subject = "Password change verification code";
        String bodyContent = "<p style=\"margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#dbe7ff;\">Hi <strong style=\"color:#ffffff;\">"
                + safeName + "</strong>, use this code to confirm password change:</p>"
                + "<div style=\"margin:16px 0;border-radius:14px;border:1px solid rgba(94,230,255,.35);background:rgba(17,32,64,.55);padding:16px 18px;\">"
                + "<p style=\"margin:0;font-size:28px;line-height:1.1;letter-spacing:4px;font-weight:700;color:#5EE6FF;text-align:center;\">"
                + safeCode + "</p>"
                + "</div>"
                + "<p style=\"margin:0 0 8px 0;font-size:13px;line-height:1.55;color:#9fb0cf;\">This code expires in 15 minutes.</p>"
                + "<p style=\"margin:0;font-size:13px;line-height:1.55;color:#9fb0cf;\">If you did not request this, you can safely ignore this email.</p>";
        String body = renderEmailLayout(
                "Password change verification code",
                "Password Change Request",
                "Secure update for your TimeCapsule account",
                bodyContent,
                "Open Account Settings",
                frontendUrl + "/account",
                "For security, never share your code with anyone."
        );

        try {
            sendHtmlEmail(user.getEmail(), subject, body);
        } catch (MessagingException ex) {
            throw new RuntimeException("Failed to send password change code", ex);
        }
    }

    public void sendTemporaryPassword(User user, String temporaryPassword) {
        if (user == null || !StringUtils.hasText(user.getEmail())) {
            throw new RuntimeException("User email is required");
        }
        if (!StringUtils.hasText(temporaryPassword)) {
            throw new RuntimeException("Temporary password is required");
        }

        String safeName = HtmlUtils.htmlEscape(resolveDisplayName(user));
        String safePassword = HtmlUtils.htmlEscape(temporaryPassword);
        String subject = "Temporary password for your TimeCapsule account";
        String bodyContent = "<p style=\"margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#dbe7ff;\">Hi <strong style=\"color:#ffffff;\">"
                + safeName + "</strong>, an administrator generated a temporary password for your account.</p>"
                + "<div style=\"margin:16px 0;border-radius:14px;border:1px solid rgba(124,92,255,.36);background:rgba(17,32,64,.55);padding:16px 18px;\">"
                + "<p style=\"margin:0 0 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#95a6c9;\">Temporary Password</p>"
                + "<p style=\"margin:0;font-size:22px;line-height:1.2;letter-spacing:1px;font-weight:700;color:#ffffff;text-align:center;\">"
                + safePassword + "</p>"
                + "</div>"
                + "<p style=\"margin:0 0 8px 0;font-size:13px;line-height:1.55;color:#9fb0cf;\">Sign in with this password and immediately set your own new password in account settings.</p>"
                + "<p style=\"margin:0;font-size:13px;line-height:1.55;color:#9fb0cf;\">If this action was unexpected, contact support right away.</p>";
        String body = renderEmailLayout(
                "Temporary password issued",
                "Temporary Password",
                "Sign in and change it immediately",
                bodyContent,
                null,
                null,
                "For security, this password should be used only once."
        );

        try {
            sendHtmlEmail(user.getEmail(), subject, body);
        } catch (MessagingException ex) {
            throw new RuntimeException("Failed to send temporary password email", ex);
        }
    }

    public void sendCapsuleOpened(String ownerId, Capsule capsule) {
        if (!StringUtils.hasText(ownerId) || capsule == null) {
            return;
        }

        userRepository.findById(ownerId).ifPresent(user -> {
            if (!StringUtils.hasText(user.getEmail())) {
                return;
            }
            String subject = buildCapsuleOpenedSubject(capsule.getTitle());
            String htmlBody = buildCapsuleOpenedBody(user, capsule);
            try {
                sendHtmlEmail(user.getEmail(), subject, htmlBody);
            } catch (MessagingException ex) {
                log.warn("Failed to send capsule-opened email to user {}", ownerId, ex);
            }
        });
    }

    public void enqueueCommentDigest(String recipientUserId, String actorName, String capsuleTitle) {
        String sampleText = StringUtils.hasText(capsuleTitle)
                ? "Commented on \"" + capsuleTitle + "\""
                : "Commented on your capsule";
        recordDigestEvent(recipientUserId, DIGEST_TYPE_COMMENT, actorName, sampleText);
    }

    public void enqueueChatDigest(String recipientUserId, String actorName, String previewText) {
        String sampleText = StringUtils.hasText(previewText) ? previewText : "Sent you a message";
        recordDigestEvent(recipientUserId, DIGEST_TYPE_CHAT, actorName, sampleText);
    }

    @Scheduled(fixedDelayString = "${app.notifications.digest.flush-interval-ms:60000}")
    public void flushInactiveDigests() {
        Instant now = Instant.now();
        Instant inactiveCutoff = now.minus(digestInactiveDelay);

        Query query = new Query(new Criteria().andOperator(
                Criteria.where("pendingCount").gt(0),
                Criteria.where("lastPendingAt").lte(inactiveCutoff)
        ));
        List<Document> staleDigests = mongoTemplate.find(query, Document.class, DIGEST_COLLECTION);
        for (Document digestState : staleDigests) {
            trySendIfEligible(digestState, now, true);
        }
    }

    private void recordDigestEvent(String recipientUserId, String type, String actorName, String sampleText) {
        if (!StringUtils.hasText(recipientUserId)) {
            return;
        }

        ObjectId userId;
        try {
            userId = new ObjectId(recipientUserId);
        } catch (IllegalArgumentException ex) {
            return;
        }

        Instant now = Instant.now();
        String stateId = digestStateId(recipientUserId, type);
        Query query = new Query(Criteria.where("_id").is(stateId));
        Update update = new Update()
                .inc("pendingCount", 1)
                .set("sampleActor", trimForStorage(actorName, 120))
                .set("sampleText", trimForStorage(sampleText, 240))
                .set("lastPendingAt", now)
                .set("updatedAt", now);

        var updateResult = mongoTemplate.updateFirst(query, update, DIGEST_COLLECTION);
        if (updateResult.getMatchedCount() == 0) {
            Document seed = new Document();
            seed.put("_id", stateId);
            seed.put("userId", userId);
            seed.put("type", type);
            seed.put("createdAt", now);
            seed.put("pendingCount", 1);
            seed.put("sampleActor", trimForStorage(actorName, 120));
            seed.put("sampleText", trimForStorage(sampleText, 240));
            seed.put("lastPendingAt", now);
            seed.put("updatedAt", now);
            try {
                mongoTemplate.insert(seed, DIGEST_COLLECTION);
            } catch (DuplicateKeyException ignored) {
                mongoTemplate.updateFirst(query, update, DIGEST_COLLECTION);
            }
        }

        Document state = mongoTemplate.findOne(query, Document.class, DIGEST_COLLECTION);
        if (state != null) {
            trySendIfEligible(state, now, false);
        }
    }

    private void trySendIfEligible(Document state, Instant now, boolean allowInactiveFlush) {
        if (!isEligible(state, now, allowInactiveFlush)) {
            return;
        }

        String stateId = getString(state, "_id");
        Document claimed = claimForDelivery(stateId, now);
        if (claimed == null) {
            return;
        }

        if (!isEligible(claimed, now, allowInactiveFlush)) {
            releaseDeliveryLock(stateId, now);
            return;
        }

        if (sendDigest(claimed, now)) {
            markDelivered(stateId, now);
        } else {
            releaseDeliveryLock(stateId, now);
        }
    }

    private boolean isEligible(Document state, Instant now, boolean allowInactiveFlush) {
        if (state == null) {
            return false;
        }
        int pendingCount = getInt(state, "pendingCount");
        if (pendingCount <= 0) {
            return false;
        }

        Instant lastEmailSentAt = getInstant(state, "lastEmailSentAt");
        if (!cooldownElapsed(lastEmailSentAt, now)) {
            return false;
        }
        if (pendingCount >= digestThreshold) {
            return true;
        }

        Instant lastPendingAt = getInstant(state, "lastPendingAt");
        return allowInactiveFlush && lastPendingAt != null
                && !lastPendingAt.isAfter(now.minus(digestInactiveDelay));
    }

    private boolean cooldownElapsed(Instant lastEmailSentAt, Instant now) {
        if (lastEmailSentAt == null) {
            return true;
        }
        return !now.isBefore(lastEmailSentAt.plus(digestCooldown));
    }

    private Document claimForDelivery(String stateId, Instant now) {
        if (!StringUtils.hasText(stateId)) {
            return null;
        }

        Instant staleLockCutoff = now.minus(digestLockTtl);
        Criteria unlockedOrStale = new Criteria().orOperator(
                Criteria.where("deliveryLockedAt").is(null),
                Criteria.where("deliveryLockedAt").lte(staleLockCutoff)
        );
        Query claimQuery = new Query(new Criteria().andOperator(
                Criteria.where("_id").is(stateId),
                Criteria.where("pendingCount").gt(0),
                unlockedOrStale
        ));
        Update claimUpdate = new Update()
                .set("deliveryLockedAt", now)
                .set("updatedAt", now);

        return mongoTemplate.findAndModify(
                claimQuery,
                claimUpdate,
                FindAndModifyOptions.options().returnNew(true),
                Document.class,
                DIGEST_COLLECTION
        );
    }

    private void releaseDeliveryLock(String stateId, Instant now) {
        Query query = new Query(Criteria.where("_id").is(stateId));
        Update update = new Update()
                .unset("deliveryLockedAt")
                .set("updatedAt", now);
        mongoTemplate.updateFirst(query, update, DIGEST_COLLECTION);
    }

    private void markDelivered(String stateId, Instant now) {
        Query query = new Query(Criteria.where("_id").is(stateId));
        Update update = new Update()
                .set("pendingCount", 0)
                .set("lastEmailSentAt", now)
                .set("lastPendingAt", null)
                .set("sampleActor", null)
                .set("sampleText", null)
                .unset("deliveryLockedAt")
                .set("updatedAt", now);
        mongoTemplate.updateFirst(query, update, DIGEST_COLLECTION);
    }

    private boolean sendDigest(Document state, Instant now) {
        String type = getString(state, "type");
        ObjectId userIdObj = getObjectId(state, "userId");
        if (!StringUtils.hasText(type) || userIdObj == null) {
            return true;
        }

        String userId = userIdObj.toHexString();
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !StringUtils.hasText(user.getEmail())) {
            return true;
        }

        int pendingCount = getInt(state, "pendingCount");
        String subject = buildDigestSubject(type, pendingCount);
        String body = buildDigestBody(type, user, state, pendingCount, now);
        try {
            sendHtmlEmail(user.getEmail(), subject, body);
            return true;
        } catch (MessagingException ex) {
            log.warn("Failed to send digest email type {} to user {}", type, userId, ex);
            return false;
        }
    }

    private String buildCapsuleOpenedSubject(String capsuleTitle) {
        if (!StringUtils.hasText(capsuleTitle)) {
            return "Your capsule is now open";
        }
        return "Your capsule is now open: " + capsuleTitle;
    }

    private String buildCapsuleOpenedBody(User user, Capsule capsule) {
        String safeName = HtmlUtils.htmlEscape(resolveDisplayName(user));
        String safeTitle = HtmlUtils.htmlEscape(StringUtils.hasText(capsule.getTitle()) ? capsule.getTitle() : "Untitled capsule");
        String capsuleLink = frontendUrl + "/capsules/" + capsule.getId();
        String safeLink = HtmlUtils.htmlEscape(capsuleLink);
        String bodyContent = "<p style=\"margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#dbe7ff;\">Hi <strong style=\"color:#ffffff;\">"
                + safeName + "</strong>, your capsule is now available.</p>"
                + "<div style=\"margin:16px 0;border-radius:14px;border:1px solid rgba(124,92,255,.36);background:rgba(17,32,64,.55);padding:14px 16px;\">"
                + "<p style=\"margin:0 0 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#95a6c9;\">Opened Capsule</p>"
                + "<p style=\"margin:0;font-size:18px;line-height:1.35;font-weight:600;color:#ffffff;\">"
                + safeTitle + "</p>"
                + "</div>"
                + "<p style=\"margin:0;font-size:13px;line-height:1.55;color:#9fb0cf;word-break:break-all;\">Direct link: "
                + safeLink + "</p>";
        return renderEmailLayout(
                "Your capsule is now open",
                "Capsule Opened",
                "A memory from your timeline has just unlocked",
                bodyContent,
                "Open Capsule",
                capsuleLink,
                "You are receiving this because this capsule belongs to your account."
        );
    }

    private String buildDigestSubject(String type, int count) {
        if (DIGEST_TYPE_COMMENT.equalsIgnoreCase(type)) {
            return count == 1
                    ? "New comment on your capsules"
                    : "You have " + count + " new comments on capsules";
        }
        return count == 1
                ? "New chat message in TimeCapsule"
                : "You have " + count + " new chat messages";
    }

    private String buildDigestBody(String type, User user, Document state, int pendingCount, Instant now) {
        String safeName = HtmlUtils.htmlEscape(resolveDisplayName(user));
        String safeActor = HtmlUtils.htmlEscape(StringUtils.hasText(getString(state, "sampleActor")) ? getString(state, "sampleActor") : "Someone");
        String safeText = HtmlUtils.htmlEscape(StringUtils.hasText(getString(state, "sampleText")) ? getString(state, "sampleText") : "sent an update");
        boolean commentsDigest = DIGEST_TYPE_COMMENT.equalsIgnoreCase(type);
        String section = commentsDigest ? "capsule" : "chat";
        String actionUrl = commentsDigest ? frontendUrl + "/capsules" : frontendUrl + "/chat";
        String updatesLabel = pendingCount == 1 ? section + " update" : section + " updates";
        String bodyContent = "<p style=\"margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#dbe7ff;\">Hi <strong style=\"color:#ffffff;\">"
                + safeName + "</strong>, you have <strong style=\"color:#ffffff;\">" + pendingCount + "</strong> new "
                + updatesLabel + ".</p>"
                + "<div style=\"margin:16px 0;border-radius:14px;border:1px solid rgba(94,230,255,.3);background:rgba(17,32,64,.55);padding:14px 16px;\">"
                + "<p style=\"margin:0 0 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#95a6c9;\">Latest Activity</p>"
                + "<p style=\"margin:0;font-size:15px;line-height:1.55;color:#eef4ff;\"><strong style=\"color:#5EE6FF;\">"
                + safeActor + "</strong> - " + safeText + "</p>"
                + "</div>"
                + "<p style=\"margin:0;font-size:12px;line-height:1.5;color:#9fb0cf;\">Digest generated at " + now + " UTC.</p>";
        String subtitle = commentsDigest ? "New activity on your capsules" : "New activity in your chats";
        return renderEmailLayout(
                "TimeCapsule digest",
                "Activity Digest",
                subtitle,
                bodyContent,
                "Open TimeCapsule",
                actionUrl,
                "You can manage notification preferences inside your account settings."
        );
    }

    private String renderEmailLayout(String preheader,
                                     String title,
                                     String subtitle,
                                     String bodyContentHtml,
                                     String actionLabel,
                                     String actionUrl,
                                     String footerNote) {
        String safePreheader = HtmlUtils.htmlEscape(preheader == null ? "" : preheader);
        String safeTitle = HtmlUtils.htmlEscape(title == null ? "TimeCapsule" : title);
        String safeSubtitle = HtmlUtils.htmlEscape(subtitle == null ? "" : subtitle);
        String safeActionLabel = HtmlUtils.htmlEscape(actionLabel == null ? "" : actionLabel);
        String safeActionUrl = HtmlUtils.htmlEscape(actionUrl == null ? "" : actionUrl);
        String safeFooterNote = HtmlUtils.htmlEscape(footerNote == null ? "" : footerNote);
        String actionBlock = "";
        if (StringUtils.hasText(actionLabel) && StringUtils.hasText(actionUrl)) {
            actionBlock = "<tr><td style=\"padding:0 28px 24px 28px;\">"
                    + "<a href=\"" + safeActionUrl + "\" style=\"display:inline-block;border-radius:12px;background:linear-gradient(135deg,#7C5CFF,#5EE6FF);color:#061023;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;\">"
                    + safeActionLabel
                    + "</a></td></tr>";
        }

        return "<!doctype html>"
                + "<html lang=\"en\">"
                + "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"><title>"
                + safeTitle
                + "</title></head>"
                + "<body style=\"margin:0;padding:0;background:#050816;font-family:Segoe UI,Arial,sans-serif;color:#dbe7ff;\">"
                + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;\">" + safePreheader + "</div>"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#050816;padding:22px 10px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:#0B1220;\">"
                + "<tr><td style=\"padding:24px 28px;background:linear-gradient(135deg,rgba(124,92,255,.3),rgba(94,230,255,.22));\">"
                + "<p style=\"margin:0 0 8px 0;font-size:11px;line-height:1.4;letter-spacing:.12em;text-transform:uppercase;color:#c5d2f0;\">TimeCapsule</p>"
                + "<h1 style=\"margin:0 0 8px 0;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;\">" + safeTitle + "</h1>"
                + "<p style=\"margin:0;font-size:14px;line-height:1.6;color:#d5e1fa;\">" + safeSubtitle + "</p>"
                + "</td></tr>"
                + "<tr><td style=\"padding:24px 28px 18px 28px;\">" + bodyContentHtml + "</td></tr>"
                + actionBlock
                + "<tr><td style=\"padding:0 28px 24px 28px;\">"
                + "<p style=\"margin:0;font-size:12px;line-height:1.55;color:#8ea0c4;\">" + safeFooterNote + "</p>"
                + "</td></tr>"
                + "</table>"
                + "<p style=\"max-width:640px;margin:12px auto 0 auto;font-size:11px;line-height:1.5;color:#6f83a8;\">Automated message from TimeCapsule</p>"
                + "</td></tr></table></body></html>";
    }

    private String resolveDisplayName(User user) {
        if (StringUtils.hasText(user.getUsernameField())) {
            return user.getUsernameField();
        }
        if (StringUtils.hasText(user.getEmail())) {
            return user.getEmail();
        }
        return "there";
    }

    private String trimForStorage(String input, int maxLength) {
        if (!StringUtils.hasText(input)) {
            return null;
        }
        String value = input.trim();
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String digestStateId(String userId, String type) {
        return userId + ":" + type;
    }

    private String normalizeFrontendUrl(String url) {
        if (!StringUtils.hasText(url)) {
            return "http://localhost";
        }
        String trimmed = url.trim();
        if (trimmed.endsWith("/")) {
            return trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private int getInt(Document doc, String field) {
        Object value = doc.get(field);
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    private String getString(Document doc, String field) {
        Object value = doc.get(field);
        return value != null ? value.toString() : null;
    }

    private Instant getInstant(Document doc, String field) {
        Object value = doc.get(field);
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof Date date) {
            return date.toInstant();
        }
        if (value instanceof String str && StringUtils.hasText(str)) {
            try {
                return Instant.parse(str);
            } catch (RuntimeException ignored) {
            }
        }
        return null;
    }

    private ObjectId getObjectId(Document doc, String field) {
        Object value = doc.get(field);
        if (value instanceof ObjectId objectId) {
            return objectId;
        }
        if (value instanceof String str && StringUtils.hasText(str)) {
            try {
                return new ObjectId(str);
            } catch (IllegalArgumentException ignored) {
            }
        }
        return null;
    }
}
