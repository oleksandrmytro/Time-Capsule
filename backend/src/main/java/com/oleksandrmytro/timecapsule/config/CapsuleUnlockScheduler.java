package com.oleksandrmytro.timecapsule.config;

import com.mongodb.client.result.UpdateResult;
import com.oleksandrmytro.timecapsule.events.CapsuleStatusEvent;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleStatus;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.services.CapsuleNotificationService;
import com.oleksandrmytro.timecapsule.services.EmailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
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
    private final int batchSize;
    private final int maxBatchesPerRun;

    public CapsuleUnlockScheduler(MongoTemplate mongoTemplate,
                                  CapsuleNotificationService notificationService,
                                  UserRepository userRepository,
                                  EmailService emailService,
                                  @Value("${app.capsules.unlock-scheduler.batch-size:100}") int batchSize,
                                  @Value("${app.capsules.unlock-scheduler.max-batches-per-run:20}") int maxBatchesPerRun) {
        this.mongoTemplate = mongoTemplate;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.batchSize = Math.max(1, batchSize);
        this.maxBatchesPerRun = Math.max(1, maxBatchesPerRun);
    }

    @Scheduled(fixedDelayString = "${app.capsules.unlock-scheduler.delay-ms:5000}")
    public void unlockReadyCapsules() {
        Instant now = Instant.now();
        for (int batch = 0; batch < maxBatchesPerRun; batch++) {
            if (!unlockReadyBatch(now)) {
                return;
            }
        }
    }

    private boolean unlockReadyBatch(Instant now) {
        Query query = new Query(
                Criteria.where("status").is(CapsuleStatus.SEALED.getValue())
                        .and("deletedAt").is(null)
                        .and("unlockAt").lte(now)
        );
        query.with(Sort.by(Sort.Direction.ASC, "unlockAt"));
        query.limit(batchSize);
        query.fields()
                .include("_id")
                .include("ownerId")
                .include("title")
                .include("unlockAt")
                .include("tags");

        List<Capsule> ready = mongoTemplate.find(query, Capsule.class);
        if (ready.isEmpty()) {
            return false;
        }

        for (Capsule capsule : ready) {
            String ownerId = capsule.getOwnerId() != null ? capsule.getOwnerId().toHexString() : null;
            if (ownerId == null || capsule.getId() == null) {
                continue;
            }

            UpdateResult result = mongoTemplate.updateFirst(
                    new Query(
                            Criteria.where("_id").is(capsule.getId())
                                    .and("ownerId").is(capsule.getOwnerId())
                                    .and("status").is(CapsuleStatus.SEALED.getValue())
                                    .and("deletedAt").is(null)
                                    .and("unlockAt").lte(now)
                    ),
                    new Update()
                            .set("status", CapsuleStatus.OPENED.getValue())
                            .set("openedAt", now)
                            .set("updatedAt", now),
                    Capsule.class
            );
            if (result.getModifiedCount() == 0) {
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

        return ready.size() == batchSize;
    }
}
