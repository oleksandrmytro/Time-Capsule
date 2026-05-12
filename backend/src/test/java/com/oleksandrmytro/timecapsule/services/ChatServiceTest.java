package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.models.ChatMessage;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.models.enums.ChatMessageStatus;
import com.oleksandrmytro.timecapsule.models.enums.ChatMessageType;
import com.oleksandrmytro.timecapsule.repositories.ChatMessageRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    private static final String SENDER_ID = "507f1f77bcf86cd799439011";
    private static final String PEER_ID = "507f1f77bcf86cd799439012";

    @Mock
    private UserService userService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private ChatService chatService;

    @Test
    void sendMessageTrimsTextPersistsItAndDeliversToPeer() {
        given(userService.getById(PEER_ID)).willReturn(user(PEER_ID, "peer"));
        given(userService.getById(SENDER_ID)).willReturn(user(SENDER_ID, "sender"));
        given(chatMessageRepository.save(any(ChatMessage.class))).willAnswer(invocation -> {
            ChatMessage message = invocation.getArgument(0);
            message.setId("message-1");
            return message;
        });

        Map<String, Object> payload = chatService.sendMessage(SENDER_ID, PEER_ID, "  hello  ", null, null, null, null);

        ArgumentCaptor<ChatMessage> messageCaptor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(chatMessageRepository).save(messageCaptor.capture());
        ChatMessage saved = messageCaptor.getValue();
        assertEquals(new ObjectId(SENDER_ID), saved.getFromUserId());
        assertEquals(new ObjectId(PEER_ID), saved.getToUserId());
        assertEquals("hello", saved.getText());
        assertEquals(ChatMessageType.TEXT.getValue(), saved.getType());
        assertEquals(ChatMessageStatus.SENT.getValue(), saved.getStatus());

        assertEquals("message-1", payload.get("id"));
        assertEquals("hello", payload.get("text"));
        assertTrue((Boolean) payload.get("fromMe"));
        verify(messagingTemplate).convertAndSendToUser(eq(PEER_ID), eq("/queue/chat"), any(Map.class));
        verify(emailService).enqueueChatDigest(PEER_ID, "sender", "hello");
    }

    @Test
    void sendMessageAcceptsMediaOnlyMessageAndBuildsDigestPreview() {
        given(userService.getById(PEER_ID)).willReturn(user(PEER_ID, "peer"));
        given(userService.getById(SENDER_ID)).willReturn(user(SENDER_ID, "sender"));
        given(chatMessageRepository.save(any(ChatMessage.class))).willAnswer(invocation -> {
            ChatMessage message = invocation.getArgument(0);
            message.setId("message-2");
            return message;
        });

        Map<String, Object> payload = chatService.sendMessage(
                SENDER_ID,
                PEER_ID,
                " ",
                null,
                "/uploads/chat/image.jpg",
                "image",
                "image/jpeg"
        );

        assertEquals(ChatMessageType.IMAGE.getValue(), payload.get("type"));
        assertEquals("", payload.get("text"));
        assertEquals("/uploads/chat/image.jpg", payload.get("mediaUrl"));
        assertTrue((Boolean) payload.get("fromMe"));
        verify(emailService).enqueueChatDigest(PEER_ID, "sender", "Sent you an image");
    }

    @Test
    void sendMessageRejectsEmptyMessageBeforePersistence() {
        assertThrows(IllegalArgumentException.class, () ->
                chatService.sendMessage(SENDER_ID, PEER_ID, " ", null, null, null, null)
        );

        verify(chatMessageRepository, never()).save(any(ChatMessage.class));
        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any());
        verify(emailService, never()).enqueueChatDigest(any(), any(), any());
    }

    private User user(String id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        user.setEnabled(true);
        return user;
    }
}
