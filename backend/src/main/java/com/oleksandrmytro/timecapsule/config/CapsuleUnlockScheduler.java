package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.events.CapsuleStatusEvent;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.services.CapsuleNotificationService;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Periodically scans for sealed capsules whose unlockAt has arrived,
 * opens them in DB and pushes a WS event to the owner.
 */
@Component
public class CapsuleUnlockScheduler {

    private final MongoTemplate mongoTemplate;
    private final CapsuleNotificationService notificationService;
    private final UserRepository userRepository;

    public CapsuleUnlockScheduler(MongoTemplate mongoTemplate, CapsuleNotificationService notificationService, UserRepository userRepository) {
        this.mongoTemplate = mongoTemplate;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    @Scheduled(fixedDelay = 5000) // every 5 seconds
    public void unlockReadyCapsules() {
        Instant now = Instant.now();

        Query query = new Query(
                Criteria.where("status").is("sealed")
                        .and("deletedAt").is(null)
                        .and("unlockAt").lte(now)
        );
        List<Capsule> ready = mongoTemplate.find(query, Capsule.class);

        if (ready.isEmpty()) return;

        Update update = new Update()
                .set("status", "opened")
                .set("openedAt", now)
                .set("updatedAt", now);
        mongoTemplate.updateMulti(query, update, Capsule.class);

        // Push WS event per owner (resolve email for STOMP routing)
        for (Capsule c : ready) {
            String ownerId = c.getOwnerId() != null ? c.getOwnerId().toHexString() : null;
            if (ownerId == null) continue;

            CapsuleStatusEvent event = new CapsuleStatusEvent(
                    c.getId(), "opened", false, c.getUnlockAt(), now, c.getTags()
            );

            userRepository.findById(ownerId).ifPresent(user ->
                    notificationService.sendStatus(user.getEmail(), event)
            );
        }
    }
}
