package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.UpdateProfileRequest;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public UserService(UserRepository userRepository, EmailService emailService, MongoTemplate mongoTemplate) {
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
    }

    public List<User> allUsers() {
        return new ArrayList<>(userRepository.findAll());
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
}
