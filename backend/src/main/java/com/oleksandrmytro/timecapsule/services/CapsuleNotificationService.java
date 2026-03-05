package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.events.CapsuleStatusEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class CapsuleNotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    public CapsuleNotificationService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Send capsule status event to a specific user.
     * @param userEmail the email used as Principal.getName() in STOMP session
     */
    public void sendStatus(String userEmail, CapsuleStatusEvent event) {
        messagingTemplate.convertAndSendToUser(userEmail, "/queue/capsules/status", event);
    }
}


