package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.services.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Chat endpoints. Messages are NOT persisted — they're delivered via WebSocket only.
 * These REST endpoints exist for:
 * - GET /conversations => always empty (no persistence)
 * - GET /{userId}/messages => always empty (no persistence)
 * - POST /{userId}/messages => sends message via WebSocket and returns it to caller
 */
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<Map<String, Object>>> conversations(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User me)) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(chatService.listConversations(me.getId()));
    }

    @GetMapping("/{userId}/messages")
    public ResponseEntity<List<Map<String, Object>>> messages(@PathVariable String userId, Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User me)) return ResponseEntity.status(401).build();
        try {
            return ResponseEntity.ok(chatService.getConversation(me.getId(), userId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).build();
        }
    }

    @PostMapping("/{userId}/messages")
    public ResponseEntity<Map<String, Object>> send(@PathVariable String userId,
                                                    @RequestBody ChatMessageRequest body,
                                                    Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User me)) return ResponseEntity.status(401).build();
        try {
            Map<String, Object> dto = chatService.sendMessage(
                    me.getId(),
                    userId,
                    body.text(),
                    body.replyToMessageId(),
                    body.mediaUrl(),
                    body.mediaKind(),
                    body.mimeType()
            );
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().build();
        }
    }

    public record ChatMessageRequest(
            String text,
            String replyToMessageId,
            String mediaUrl,
            String mediaKind,
            String mimeType
    ) {}
}
