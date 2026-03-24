package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.Comment;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleStatus;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleVisibility;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.repositories.CommentRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.responses.CommentResponse;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final CapsuleRepository capsuleRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final EmailService emailService;

    public CommentService(CommentRepository commentRepository, CapsuleRepository capsuleRepository, UserRepository userRepository, MongoTemplate mongoTemplate, EmailService emailService) {
        this.commentRepository = commentRepository;
        this.capsuleRepository = capsuleRepository;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
        this.emailService = emailService;
    }

    /**
     * Додає коментар (або відповідь на коментар) до публічної відкритої капсули.
     */
    public CommentResponse addComment(String userId, String capsuleId, String body, String parentCommentId) {
        Capsule capsule = assertPublicOpenedCapsule(capsuleId);

        if (!Boolean.TRUE.equals(capsule.getAllowComments())) {
            throw new IllegalArgumentException("Коментарі вимкнені для цієї капсули");
        }

        // Якщо це відповідь — перевіряємо, що батьківський коментар існує
        if (parentCommentId != null) {
            commentRepository.findByIdAndDeletedAtIsNull(parentCommentId)
                    .orElseThrow(() -> new IllegalArgumentException("Батьківський коментар не знайдено"));
        }

        Comment comment = new Comment();
        comment.setCapsuleId(new ObjectId(capsuleId));
        comment.setUserId(new ObjectId(userId));
        comment.setBody(body);
        if (parentCommentId != null) {
            comment.setParentCommentId(new ObjectId(parentCommentId));
        }
        comment.setCreatedAt(Instant.now());
        comment.setUpdatedAt(Instant.now());

        Comment saved = commentRepository.save(comment);
        notifyCapsuleOwnerAboutComment(userId, capsule);
        return toResponse(saved);
    }

    /**
     * Повертає плоский список всіх коментарів капсули (включаючи відповіді).
     * Фронтенд сам знаходить батька по parentCommentId і показує цитату.
     */
    public List<CommentResponse> listComments(String capsuleId) {
        assertPublicOpenedCapsule(capsuleId);

        List<Comment> allComments = commentRepository.findByCapsuleIdAndDeletedAtIsNullOrderByCreatedAtDesc(new ObjectId(capsuleId));

        List<CommentResponse> result = new ArrayList<>();
        for (Comment c : allComments) {
            result.add(toResponse(c));
        }

        return result;
    }

    /**
     * Soft-delete коментаря через MongoTemplate (shard-safe).
     * Тільки автор може видалити свій коментар.
     */
    public void deleteComment(String userId, String commentId) {
        Comment comment = commentRepository.findByIdAndDeletedAtIsNull(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Коментар не знайдено"));

        if (!comment.getUserId().toHexString().equals(userId)) {
            throw new IllegalArgumentException("Немає дозволу на видалення цього коментаря");
        }

        // Використовуємо MongoTemplate для оновлення, щоб включити shard key (capsuleId)
        Query query = new Query(Criteria.where("_id").is(commentId).and("capsuleId").is(comment.getCapsuleId()));
        Update update = new Update()
                .set("deletedAt", Instant.now())
                .set("updatedAt", Instant.now());
        mongoTemplate.updateFirst(query, update, Comment.class);
    }

    /**
     * Оновлює текст коментаря (тільки автор може змінити).
     */
    public CommentResponse updateComment(String userId, String commentId, String newBody) {
        Comment comment = commentRepository.findByIdAndDeletedAtIsNull(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Коментар не знайдено"));

        if (!comment.getUserId().toHexString().equals(userId)) {
            throw new IllegalArgumentException("Немає дозволу на редагування цього коментаря");
        }

        // Використовуємо MongoTemplate для оновлення (shard-safe, включаємо capsuleId)
        Query query = new Query(Criteria.where("_id").is(commentId).and("capsuleId").is(comment.getCapsuleId()));
        Update update = new Update()
                .set("body", newBody)
                .set("updatedAt", Instant.now());
        mongoTemplate.updateFirst(query, update, Comment.class);

        // Повертаємо оновлений коментар
        comment.setBody(newBody);
        comment.setUpdatedAt(Instant.now());
        return toResponse(comment);
    }

    /**
     * Перевіряє, що капсула публічна, відкрита та не видалена.
     */
    private Capsule assertPublicOpenedCapsule(String capsuleId) {
        Capsule capsule = capsuleRepository.findByIdAndDeletedAtIsNull(capsuleId)
                .orElseThrow(() -> new IllegalArgumentException("Капсула не знайдена"));

        if (!CapsuleVisibility.PUBLIC.equals(CapsuleVisibility.fromValue(capsule.getVisibility()))) {
            throw new IllegalArgumentException("Коментарі доступні тільки для публічних капсул");
        }

        CapsuleStatus status = CapsuleStatus.fromValue(capsule.getStatus());
        if (!CapsuleStatus.OPENED.equals(status)) {
            throw new IllegalArgumentException("Коментарі доступні тільки для відкритих капсул");
        }

        return capsule;
    }

    /**
     * Перетворює Comment у CommentResponse з підтягуванням username та avatarUrl.
     */
    private CommentResponse toResponse(Comment comment) {
        CommentResponse resp = new CommentResponse();
        resp.setId(comment.getId());
        resp.setCapsuleId(comment.getCapsuleId().toHexString());
        resp.setUserId(comment.getUserId().toHexString());
        resp.setBody(comment.getBody());
        resp.setParentCommentId(comment.getParentCommentId() != null ? comment.getParentCommentId().toHexString() : null);
        resp.setCreatedAt(comment.getCreatedAt());

        userRepository.findById(comment.getUserId().toHexString()).ifPresent(user -> {
            resp.setUsername(user.getUsernameField() != null ? user.getUsernameField() : user.getEmail());
            resp.setAvatarUrl(user.getAvatarUrl());
        });

        return resp;
    }

    private void notifyCapsuleOwnerAboutComment(String commenterId, Capsule capsule) {
        if (capsule == null || capsule.getOwnerId() == null) {
            return;
        }
        String ownerId = capsule.getOwnerId().toHexString();
        if (ownerId.equals(commenterId)) {
            return;
        }
        String actorName = userRepository.findById(commenterId)
                .map(user -> user.getUsernameField() != null ? user.getUsernameField() : user.getEmail())
                .orElse("Someone");
        emailService.enqueueCommentDigest(ownerId, actorName, capsule.getTitle());
    }
}




