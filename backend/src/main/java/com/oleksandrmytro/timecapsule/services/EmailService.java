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
                .setOnInsert("_id", stateId)
                .setOnInsert("userId", userId)
                .setOnInsert("type", type)
                .setOnInsert("createdAt", now)
                .inc("pendingCount", 1)
                .set("sampleActor", trimForStorage(actorName, 120))
                .set("sampleText", trimForStorage(sampleText, 240))
                .set("lastPendingAt", now)
                .set("updatedAt", now);

        Document state = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().upsert(true).returnNew(true),
                Document.class,
                DIGEST_COLLECTION
        );
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

        return "<!doctype html>"
                + "<html lang=\"en\">"
                + "<head>"
                + "<meta charset=\"UTF-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
                + "<title>Capsule Opened</title>"
                + "</head>"
                + "<body style=\"margin:0;padding:0;background:#f3f6fb;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f3f6fb;padding:24px 12px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;\">"
                + "<tr><td style=\"background:linear-gradient(135deg,#0f766e,#2563eb);padding:28px 32px;\">"
                + "<div style=\"font-size:12px;letter-spacing:.08em;color:#dbeafe;text-transform:uppercase;\">TimeCapsule</div>"
                + "<h1 style=\"margin:8px 0 0 0;font-size:28px;line-height:1.2;color:#ffffff;\">Your capsule is open</h1>"
                + "</td></tr>"
                + "<tr><td style=\"padding:30px 32px 20px 32px;\">"
                + "<p style=\"margin:0 0 14px 0;font-size:16px;line-height:1.6;\">Hi, <strong>" + safeName + "</strong>.</p>"
                + "<p style=\"margin:0 0 14px 0;font-size:16px;line-height:1.6;\">Your capsule <strong>\"" + safeTitle + "\"</strong> has just been opened and is ready to view.</p>"
                + "<p style=\"margin:0 0 26px 0;font-size:15px;line-height:1.6;color:#4b5563;\">Use the button below to open it.</p>"
                + "<a href=\"" + safeLink + "\" style=\"display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;\">Open capsule</a>"
                + "<p style=\"margin:24px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;\">If the button does not work, copy this link:<br>" + safeLink + "</p>"
                + "</td></tr>"
                + "</table>"
                + "<p style=\"max-width:620px;margin:14px auto 0 auto;font-size:12px;color:#94a3b8;line-height:1.5;\">This is an automated TimeCapsule message.</p>"
                + "</td></tr>"
                + "</table>"
                + "</body>"
                + "</html>";
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
        String section = commentsDigest ? "capsules" : "chat";
        String actionUrl = commentsDigest ? frontendUrl + "/capsules" : frontendUrl + "/chat";

        return "<p>Hi " + safeName + ",</p>"
                + "<p>You have <strong>" + pendingCount + "</strong> new " + section + " updates.</p>"
                + "<p>Latest: <strong>" + safeActor + "</strong> - " + safeText + "</p>"
                + "<p><a href=\"" + actionUrl + "\">Open TimeCapsule</a></p>"
                + "<p style=\"color:#666;font-size:12px;\">Digest generated at " + now + " UTC.</p>";
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
