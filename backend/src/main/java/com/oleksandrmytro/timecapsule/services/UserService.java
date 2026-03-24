package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.UpdateProfileRequest;
import com.oleksandrmytro.timecapsule.models.Follow;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.repositories.FollowRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final FollowRepository followRepository;
    private final CapsuleRepository capsuleRepository;

    public UserService(UserRepository userRepository, EmailService emailService, MongoTemplate mongoTemplate, FollowRepository followRepository, CapsuleRepository capsuleRepository) {
        this.userRepository = userRepository;
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
        if (StringUtils.hasText(q)) {
            mongoQuery.addCriteria(new Criteria().orOperator(
                    Criteria.where("username").regex(q, "i"),
                    Criteria.where("email").regex(q, "i")
            ));
        }
        mongoQuery.limit(20);
        return mongoTemplate.find(mongoQuery, User.class);
    }

    public User updateProfile(String userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

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

        Query query = new Query(Criteria.where("_id").is(user.getId()).and("email").is(user.getEmail()));
        mongoTemplate.findAndReplace(query, user);
        return user;
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

        Query q = new Query(Criteria.where("userId").is(target).and("followerId").is(follower));
        Update u = new Update()
                .set("userId", target)
                .set("followerId", follower)
                .unset("deletedAt")
                .setOnInsert("createdAt", java.time.Instant.now());
        mongoTemplate.upsert(q, u, Follow.class);
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
                .toList();
    }

    public List<User> following(String userId) {
        ObjectId follower = new ObjectId(userId);
        return followRepository.findByFollowerIdAndDeletedAtIsNull(follower).stream()
                .map(f -> getById(f.getUserId().toHexString()))
                .toList();
    }

    public long followersCount(String userId) {
        return followRepository.countByUserIdAndDeletedAtIsNull(new ObjectId(userId));
    }

    public long followingCount(String userId) {
        return followRepository.countByFollowerIdAndDeletedAtIsNull(new ObjectId(userId));
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
}
