package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.CreateCommentRequest;
import com.oleksandrmytro.timecapsule.responses.CommentResponse;
import com.oleksandrmytro.timecapsule.services.CommentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/capsules/{capsuleId}/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    /**
     * Додає коментар до капсули (потребує авторизації).
     */
    @PostMapping
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable String capsuleId,
            @Valid @RequestBody CreateCommentRequest request,
            Authentication auth) {
        String userId = currentUserId(auth);
        return ResponseEntity.ok(commentService.addComment(userId, capsuleId, request.getBody(), request.getParentCommentId()));
    }

    /**
     * Повертає список коментарів (доступно для всіх).
     */
    @GetMapping
    public ResponseEntity<List<CommentResponse>> listComments(@PathVariable String capsuleId) {
        return ResponseEntity.ok(commentService.listComments(capsuleId));
    }

    /**
     * Видаляє коментар (soft delete, тільки автор).
     */
    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable String capsuleId,
            @PathVariable String commentId,
            Authentication auth) {
        String userId = currentUserId(auth);
        commentService.deleteComment(userId, commentId);
        return ResponseEntity.ok().build();
    }

    /**
     * Оновлює текст коментаря (тільки автор).
     */
    @PatchMapping("/{commentId}")
    public ResponseEntity<CommentResponse> updateComment(
            @PathVariable String capsuleId,
            @PathVariable String commentId,
            @Valid @RequestBody CreateCommentRequest request,
            Authentication auth) {
        String userId = currentUserId(auth);
        return ResponseEntity.ok(commentService.updateComment(userId, commentId, request.getBody()));
    }

    private String currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof UserDetails ud)) {
            throw new IllegalArgumentException("Unauthorized");
        }
        if (ud instanceof com.oleksandrmytro.timecapsule.models.User u) {
            return u.getId();
        }
        return ud.getUsername();
    }
}



