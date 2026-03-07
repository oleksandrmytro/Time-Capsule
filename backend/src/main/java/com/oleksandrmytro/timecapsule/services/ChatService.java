package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.models.ChatMessage;
import com.oleksandrmytro.timecapsule.repositories.ChatMessageRepository;
import org.bson.types.ObjectId;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Chat service — purely WebSocket-based, no database persistence.
 * Messages are delivered in real-time via STOMP /user/queue/chat.
 */
@Service
public class ChatService {
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatMessageRepository chatMessageRepository;

    public ChatService(UserService userService, SimpMessagingTemplate messagingTemplate, ChatMessageRepository chatMessageRepository) {
        this.userService = userService;
        this.messagingTemplate = messagingTemplate;
        this.chatMessageRepository = chatMessageRepository;
    }

    /**
     * Send a text message from currentUserId to peerId via WebSocket only.
     */
    public Map<String, Object> sendMessage(String currentUserId, String peerId, String text) {
        if (!StringUtils.hasText(text)) throw new IllegalArgumentException("Message text is empty");
        userService.getById(peerId); // validate peer exists
        ChatMessage msg = new ChatMessage(currentUserId, peerId, text.trim());
        msg.setType("text");
        msg.setCreatedAt(Instant.now());
        msg.setStatus("sent");
        ChatMessage saved = chatMessageRepository.save(msg);
        return deliver(saved, currentUserId, peerId);
    }

    public Map<String, Object> saveShareMessage(String ownerId, String granteeId, String capsuleId, String capsuleTitle, String text) {
        ChatMessage msg = new ChatMessage(ownerId, granteeId, text);
        msg.setType("capsule_share");
        msg.setCapsuleId(new ObjectId(capsuleId));
        msg.setCapsuleTitle(capsuleTitle);
        msg.setCreatedAt(Instant.now());
        msg.setStatus("sent");
        ChatMessage saved = chatMessageRepository.save(msg);
        return deliver(saved, ownerId, granteeId);
    }

    private Map<String, Object> deliver(ChatMessage saved, String senderId, String peerId) {
        Map<String, Object> payloadToPeer = new HashMap<>();
        payloadToPeer.put("id", saved.getId());
        payloadToPeer.put("type", saved.getType());
        payloadToPeer.put("text", saved.getText() == null ? "" : saved.getText());
        payloadToPeer.put("fromUserId", senderId);
        payloadToPeer.put("fromMe", false);
        payloadToPeer.put("timestamp", saved.getCreatedAt().toString());
        payloadToPeer.put("status", saved.getStatus());
        if (saved.getCapsuleId() != null) payloadToPeer.put("capsuleId", saved.getCapsuleId().toHexString());
        if (saved.getCapsuleTitle() != null) payloadToPeer.put("capsuleTitle", saved.getCapsuleTitle());
        messagingTemplate.convertAndSendToUser(peerId, "/queue/chat", payloadToPeer);

        Map<String, Object> payloadToSender = new HashMap<>();
        payloadToSender.put("id", saved.getId());
        payloadToSender.put("type", saved.getType());
        payloadToSender.put("text", saved.getText() == null ? "" : saved.getText());
        payloadToSender.put("fromUserId", senderId);
        payloadToSender.put("fromMe", true);
        payloadToSender.put("timestamp", saved.getCreatedAt().toString());
        payloadToSender.put("status", saved.getStatus());
        if (saved.getCapsuleId() != null) payloadToSender.put("capsuleId", saved.getCapsuleId().toHexString());
        if (saved.getCapsuleTitle() != null) payloadToSender.put("capsuleTitle", saved.getCapsuleTitle());
        return payloadToSender;
    }

    public List<Map<String, Object>> getConversation(String currentUserId, String peerId) {
        List<ChatMessage> list = chatMessageRepository
                .findByFromUserIdAndToUserIdOrFromUserIdAndToUserIdOrderByCreatedAtAsc(new ObjectId(currentUserId), new ObjectId(peerId), new ObjectId(peerId), new ObjectId(currentUserId));
        List<Map<String, Object>> dto = new ArrayList<>();
        for (ChatMessage m : list) {
            boolean fromMe = m.getFromUserId().toHexString().equals(currentUserId);
            Map<String, Object> entry = new HashMap<>();
            entry.put("id", m.getId());
            entry.put("type", m.getType());
            entry.put("text", m.getText() == null ? "" : m.getText());
            entry.put("fromUserId", m.getFromUserId().toHexString());
            entry.put("fromMe", fromMe);
            entry.put("timestamp", m.getCreatedAt().toString());
            entry.put("status", m.getStatus());
            if (m.getCapsuleId() != null) entry.put("capsuleId", m.getCapsuleId().toHexString());
            if (m.getCapsuleTitle() != null) entry.put("capsuleTitle", m.getCapsuleTitle());
            dto.add(entry);
        }
        return dto;
    }

    public List<Map<String, Object>> listConversations(String currentUserId) {
        List<ChatMessage> recent = chatMessageRepository.findByFromUserIdOrToUserIdOrderByCreatedAtDesc(new ObjectId(currentUserId), new ObjectId(currentUserId));
        Map<String, ChatMessage> lastByPeer = new LinkedHashMap<>();
        for (ChatMessage msg : recent) {
            String peerId = msg.getFromUserId().toHexString().equals(currentUserId) ? msg.getToUserId().toHexString() : msg.getFromUserId().toHexString();
            if (!lastByPeer.containsKey(peerId)) {
                lastByPeer.put(peerId, msg);
            }
        }
        List<Map<String, Object>> conv = new ArrayList<>();
        for (Map.Entry<String, ChatMessage> entry : lastByPeer.entrySet()) {
            String peerId = entry.getKey();
            var peer = userService.getByIdOrUsername(peerId);
            ChatMessage last = entry.getValue();
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", peer.getId());
            userMap.put("username", peer.getUsernameField());
            userMap.put("displayName", peer.getUsernameField());
            userMap.put("avatar", peer.getAvatarUrl());
            userMap.put("isOnline", peer.isOnline());

            Map<String, Object> lastMsg = new HashMap<>();
            lastMsg.put("text", last.getText() == null ? "" : last.getText());
            lastMsg.put("timestamp", last.getCreatedAt().toString());
            lastMsg.put("isRead", true);
            lastMsg.put("fromMe", last.getFromUserId().toHexString().equals(currentUserId));

            Map<String, Object> convEntry = new HashMap<>();
            convEntry.put("id", peer.getId());
            convEntry.put("user", userMap);
            convEntry.put("lastMessage", lastMsg);
            conv.add(convEntry);
        }
        return conv;
    }
}
