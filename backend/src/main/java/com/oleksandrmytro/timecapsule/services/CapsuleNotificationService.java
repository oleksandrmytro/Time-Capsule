package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.events.CapsuleStatusEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * CapsuleNotificationService — сервіс для надсилання WS-подій про статус капсул користувачам.
 * Використовує SimpMessagingTemplate для відправки повідомлень на STOMP-канали, підписані користувачами.
 * Метод sendStatus надсилає CapsuleStatusEvent на канал "/user/{userEmail}/queue/capsules/status", де {userEmail} — це email користувача,
 * який використовується як Principal.getName() у STOMP-сесії.
 */
@Service
public class CapsuleNotificationService {
    // SimpMessagingTemplate — це Spring-компонент для відправки STOMP-повідомлень. Він інжектиться через конструктор.
    private final SimpMessagingTemplate messagingTemplate;

    public CapsuleNotificationService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * sendStatus — метод для надсилання WS-події про статус капсули користувачу.
     * Він приймає email користувача та CapsuleStatusEvent, який містить інформацію про капсулу (id, status, isLocked, unlockAt, openedAt, tags).
     * Використовує messagingTemplate.convertAndSendToUser для відправки повідомлення на канал "/user/{userEmail}/queue/capsules/status".
     * Користувач, який підписаний на цей канал, отримає подію про зміну статусу капсу
     * @param userEmail
     * @param event
     */
    public void sendStatus(String userEmail, CapsuleStatusEvent event) {
        messagingTemplate.convertAndSendToUser(userEmail, "/queue/capsules/status", event);
    }
}


