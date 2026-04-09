package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.UpdateProfileRequest;
import com.oleksandrmytro.timecapsule.models.Follow;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.repositories.FollowRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class UserService {
    private static final int PASSWORD_CHANGE_CODE_TTL_MINUTES = 15;

    private final UserRepository userRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final MongoTemplate mongoTemplate;
    private final FollowRepository followRepository;
    private final CapsuleRepository capsuleRepository;

    public UserService(
            UserRepository userRepository,
            EmailService emailService,
            PasswordEncoder passwordEncoder,
            MongoTemplate mongoTemplate,
            FollowRepository followRepository,
            CapsuleRepository capsuleRepository
    ) {
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.mongoTemplate = mongoTemplate;
        this.followRepository = followRepository;
        this.capsuleRepository = capsuleRepository;
    }

    public List<User> allUsers() {
        return new ArrayList<>(userRepository.findAll());
    }

    public List<User> searchUsers(String query) {
        String q = query == null ? "" : query.trim();
        Query mongoQuery = new Query();
        Criteria publicUserCriteria = new Criteria().andOperator(
                Criteria.where("role").ne(User.Role.ADMIN.getDbValue()),
                Criteria.where("deletedAt").is(null),
                Criteria.where("enabled").is(true)
        );
        if (StringUtils.hasText(q)) {
            mongoQuery.addCriteria(new Criteria().andOperator(
                    publicUserCriteria,
                    new Criteria().orOperator(
                            Criteria.where("username").regex(q, "i"),
                            Criteria.where("email").regex(q, "i")
                    )
            ));
        } else {
            mongoQuery.addCriteria(publicUserCriteria);
        }
        return mongoTemplate.find(mongoQuery, User.class);
    }

    public User updateProfile(String userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String originalEmail = user.getEmail();
        String originalUsername = user.getUsernameField();

        if (StringUtils.hasText(req.getUsername())) {
            user.setUsername(req.getUsername());
        }
        if (StringUtils.hasText(req.getEmail())) {
            if (userRepository.findByEmail(req.getEmail()).filter(u -> !u.getId().equals(userId)).isPresent()) {
                throw new IllegalArgumentException("Email already in use");
            }
            user.setEmail(req.getEmail());
        }
        if (req.getAvatarUrl() != null) {
            user.setAvatarUrl(req.getAvatarUrl());
        }

        Query targeted = new Query(Criteria.where("_id").is(user.getId()));
        if (StringUtils.hasText(originalEmail)) {
            targeted.addCriteria(Criteria.where("email").is(originalEmail));
        }
        if (StringUtils.hasText(originalUsername)) {
            targeted.addCriteria(Criteria.where("username").is(originalUsername));
        }

        Update update = new Update()
                .set("username", user.getUsernameField())
                .set("email", user.getEmail())
                .set("avatarUrl", user.getAvatarUrl())
                .set("updatedAt", LocalDateTime.now());

        var targetedResult = mongoTemplate.updateFirst(targeted, update, User.class);
        if (targetedResult.getMatchedCount() == 0) {
            mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(user.getId())), update, User.class);
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    public User getById(String userId) {
        return userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    public User getByIdOrUsername(String value) {
        if (value == null) throw new IllegalArgumentException("User not found");
        return userRepository.findById(value)
                .or(() -> userRepository.findByUsernameIgnoreCase(value))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    public void follow(String targetUserId, String followerId) {
        if (targetUserId.equals(followerId)) throw new IllegalArgumentException("Cannot follow yourself");
        getById(targetUserId);
        getById(followerId);
        ObjectId target = new ObjectId(targetUserId);
        ObjectId follower = new ObjectId(followerId);

        Query active = new Query(Criteria.where("userId").is(target).and("followerId").is(follower).and("deletedAt").is(null));
        if (mongoTemplate.exists(active, Follow.class)) {
            return;
        }

        Query restore = new Query(Criteria.where("userId").is(target).and("followerId").is(follower).and("deletedAt").ne(null));
        var restored = mongoTemplate.updateFirst(restore, new Update().unset("deletedAt"), Follow.class);
        if (restored.getMatchedCount() > 0) {
            return;
        }

        Follow created = new Follow();
        created.setUserId(target);
        created.setFollowerId(follower);
        created.setCreatedAt(Instant.now());
        created.setDeletedAt(null);
        try {
            mongoTemplate.insert(created);
        } catch (DuplicateKeyException ignored) {
            // Concurrent request created relation first; ensure it is active.
            mongoTemplate.updateFirst(
                    new Query(Criteria.where("userId").is(target).and("followerId").is(follower)),
                    new Update().unset("deletedAt"),
                    Follow.class
            );
        }
    }

    public void unfollow(String targetUserId, String followerId) {
        ObjectId target = new ObjectId(targetUserId);
        ObjectId follower = new ObjectId(followerId);
        Query q = new Query(Criteria.where("userId").is(target).and("followerId").is(follower).and("deletedAt").is(null));
        Update u = new Update().set("deletedAt", java.time.Instant.now());
        mongoTemplate.updateFirst(q, u, Follow.class);
    }

    public List<User> followers(String userId) {
        ObjectId target = new ObjectId(userId);
        return followRepository.findByUserIdAndDeletedAtIsNull(target).stream()
                .map(f -> getById(f.getFollowerId().toHexString()))
                .filter(this::isPublicUser)
                .toList();
    }

    public List<User> following(String userId) {
        ObjectId follower = new ObjectId(userId);
        return followRepository.findByFollowerIdAndDeletedAtIsNull(follower).stream()
                .map(f -> getById(f.getUserId().toHexString()))
                .filter(this::isPublicUser)
                .toList();
    }

    public List<User> suggestUsers(String userId, int limit) {
        if (!StringUtils.hasText(userId)) {
            return List.of();
        }

        int resolvedLimit = Math.max(1, Math.min(limit, 24));
        List<User> directFollowing = following(userId);
        List<User> directFollowers = followers(userId);

        Set<String> excludedIds = new LinkedHashSet<>();
        excludedIds.add(userId);
        directFollowing.forEach(user -> excludedIds.add(user.getId()));

        Map<String, Integer> scores = new LinkedHashMap<>();
        Map<String, User> candidates = new LinkedHashMap<>();

        for (User relation : directFollowing) {
            collectSuggestedUsersFromRelation(relation, excludedIds, scores, candidates, 3, true);
            collectSuggestedUsersFromRelation(relation, excludedIds, scores, candidates, 2, false);
        }

        for (User relation : directFollowers) {
            collectSuggestedUsersFromRelation(relation, excludedIds, scores, candidates, 1, false);
        }

        if (candidates.isEmpty()) {
            return searchUsers("").stream()
                    .filter(user -> !excludedIds.contains(user.getId()))
                    .limit(resolvedLimit)
                    .toList();
        }

        return candidates.values().stream()
                .sorted(Comparator
                        .comparingInt((User user) -> scores.getOrDefault(user.getId(), 0))
                        .reversed()
                        .thenComparing(user -> user.getUsernameField() != null ? user.getUsernameField().toLowerCase() : user.getId()))
                .limit(resolvedLimit)
                .toList();
    }

    public long followersCount(String userId) {
        ObjectId target = new ObjectId(userId);
        return followRepository.findByUserIdAndDeletedAtIsNull(target).stream()
                .map(f -> getById(f.getFollowerId().toHexString()))
                .filter(this::isPublicUser)
                .count();
    }

    public long followingCount(String userId) {
        ObjectId follower = new ObjectId(userId);
        return followRepository.findByFollowerIdAndDeletedAtIsNull(follower).stream()
                .map(f -> getById(f.getUserId().toHexString()))
                .filter(this::isPublicUser)
                .count();
    }

    public boolean isFollowing(String targetUserId, String followerId) {
        try {
            if (targetUserId == null || followerId == null) return false;
            return followRepository.existsByUserIdAndFollowerIdAndDeletedAtIsNull(new ObjectId(targetUserId), new ObjectId(followerId));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    public long capsulesCount(String userId) {
        try {
            return capsuleRepository.countByOwnerIdAndDeletedAtIsNull(new ObjectId(userId));
        } catch (IllegalArgumentException ex) {
            return 0;
        }
    }

    public long capsulesCountVisibleToViewer(String userId, String viewerId) {
        try {
            ObjectId owner = new ObjectId(userId);
            if (viewerId != null && viewerId.equals(userId)) {
                return capsuleRepository.countByOwnerIdAndDeletedAtIsNull(owner);
            }
            return capsuleRepository.countByOwnerIdAndVisibilityAndDeletedAtIsNull(owner, "public");
        } catch (IllegalArgumentException ex) {
            return 0;
        }
    }

    public void requestPasswordChangeCode(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!StringUtils.hasText(user.getEmail())) {
            throw new IllegalArgumentException("Email is not set for this account");
        }

        String code = generateCode();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(PASSWORD_CHANGE_CODE_TTL_MINUTES);
        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(userId)),
                new Update()
                        .set("verificationCode", code)
                        .set("verificationCodeExpiresAt", expiresAt)
                        .set("updatedAt", LocalDateTime.now()),
                User.class
        );
        emailService.sendPasswordChangeCode(user, code);
    }

    public void confirmPasswordChange(String userId, String code, String newPassword) {
        if (!StringUtils.hasText(code)) {
            throw new IllegalArgumentException("Verification code is required");
        }
        if (!StringUtils.hasText(newPassword)) {
            throw new IllegalArgumentException("New password is required");
        }
        if (newPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!StringUtils.hasText(user.getVerificationCode()) || !code.trim().equals(user.getVerificationCode())) {
            throw new RuntimeException("Invalid verification code");
        }
        if (user.getVerificationCodeExpiresAt() == null || user.getVerificationCodeExpiresAt().isBefore(LocalDateTime.now())) {
            mongoTemplate.updateFirst(
                    new Query(Criteria.where("_id").is(userId)),
                    new Update()
                            .unset("verificationCode")
                            .unset("verificationCodeExpiresAt")
                            .set("updatedAt", LocalDateTime.now()),
                    User.class
            );
            throw new RuntimeException("Verification code has expired");
        }

        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(userId)),
                new Update()
                        .set("password", passwordEncoder.encode(newPassword))
                        .set("mustChangePassword", false)
                        .unset("verificationCode")
                        .unset("verificationCodeExpiresAt")
                        .set("updatedAt", LocalDateTime.now()),
                User.class
        );
    }

    public void changePasswordWithCurrent(String userId, String currentPassword, String newPassword) {
        if (!StringUtils.hasText(currentPassword)) {
            throw new IllegalArgumentException("Current password is required");
        }
        if (!StringUtils.hasText(newPassword)) {
            throw new IllegalArgumentException("New password is required");
        }
        if (newPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is invalid");
        }

        Query targeted = new Query(Criteria.where("_id").is(user.getId()));
        if (StringUtils.hasText(user.getEmail())) {
            targeted.addCriteria(Criteria.where("email").is(user.getEmail()));
        }
        if (StringUtils.hasText(user.getUsernameField())) {
            targeted.addCriteria(Criteria.where("username").is(user.getUsernameField()));
        }
        Update update = new Update()
                .set("password", passwordEncoder.encode(newPassword))
                .set("mustChangePassword", false)
                .unset("verificationCode")
                .unset("verificationCodeExpiresAt")
                .set("updatedAt", LocalDateTime.now());

        var result = mongoTemplate.updateFirst(targeted, update, User.class);
        if (result.getMatchedCount() == 0) {
            mongoTemplate.updateFirst(new Query(Criteria.where("_id").is(user.getId())), update, User.class);
        }
    }

    private String generateCode() {
        int code = (int) (Math.random() * 900_000) + 100_000;
        return Integer.toString(code);
    }

    private void collectSuggestedUsersFromRelation(
            User relation,
            Set<String> excludedIds,
            Map<String, Integer> scores,
            Map<String, User> candidates,
            int weight,
            boolean followersOfRelation
    ) {
        List<User> neighbors = followersOfRelation ? followers(relation.getId()) : following(relation.getId());
        for (User candidate : neighbors) {
            if (!isPublicUser(candidate) || excludedIds.contains(candidate.getId())) {
                continue;
            }
            candidates.putIfAbsent(candidate.getId(), candidate);
            scores.merge(candidate.getId(), weight, Integer::sum);
        }
    }

    private boolean isPublicUser(User user) {
        return user != null
                && user.getRole() != User.Role.ADMIN
                && user.getDeletedAt() == null
                && user.isEnabled();
    }
}
