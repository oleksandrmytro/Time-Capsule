package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.events.CapsuleStatusEvent;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleStatus;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.services.CapsuleNotificationService;
import com.oleksandrmytro.timecapsule.services.EmailService;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
public class CapsuleUnlockScheduler {
    private final MongoTemplate mongoTemplate;
    private final CapsuleNotificationService notificationService;
    private final UserRepository userRepository;
    private final EmailService emailService;

    public CapsuleUnlockScheduler(MongoTemplate mongoTemplate,
                                  CapsuleNotificationService notificationService,
                                  UserRepository userRepository,
                                  EmailService emailService) {
        this.mongoTemplate = mongoTemplate;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    @Scheduled(fixedDelay = 5000)
    public void unlockReadyCapsules() {
        Instant now = Instant.now();
        Query query = new Query(
                Criteria.where("status").is(CapsuleStatus.SEALED.getValue())
                        .and("deletedAt").is(null)
                        .and("unlockAt").lte(now)
        );
        List<Capsule> ready = mongoTemplate.find(query, Capsule.class);
        if (ready.isEmpty()) {
            return;
        }

        Update update = new Update()
                .set("status", CapsuleStatus.OPENED.getValue())
                .set("openedAt", now)
                .set("updatedAt", now);
        mongoTemplate.updateMulti(query, update, Capsule.class);

        for (Capsule capsule : ready) {
            String ownerId = capsule.getOwnerId() != null ? capsule.getOwnerId().toHexString() : null;
            if (ownerId == null) {
                continue;
            }

            capsule.setStatus(CapsuleStatus.OPENED.getValue());
            capsule.setOpenedAt(now);
            capsule.setUpdatedAt(now);

            CapsuleStatusEvent event = new CapsuleStatusEvent(
                    capsule.getId(),
                    CapsuleStatus.OPENED.getValue(),
                    false,
                    capsule.getUnlockAt(),
                    now,
                    capsule.getTags()
            );
            userRepository.findById(ownerId)
                    .ifPresent(user -> notificationService.sendStatus(user.getId(), event));
            emailService.sendCapsuleOpened(ownerId, capsule);
        }
    }
}
