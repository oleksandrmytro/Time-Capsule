package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.Reaction;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleStatus;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleVisibility;
import com.oleksandrmytro.timecapsule.models.enums.ReactionType;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.repositories.ReactionRepository;
import com.oleksandrmytro.timecapsule.responses.ReactionSummaryResponse;
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
public class ReactionService {

    private final ReactionRepository reactionRepository;
    private final CapsuleRepository capsuleRepository;
    private final MongoTemplate mongoTemplate;

    public ReactionService(ReactionRepository reactionRepository, CapsuleRepository capsuleRepository, MongoTemplate mongoTemplate) {
        this.reactionRepository = reactionRepository;
        this.capsuleRepository = capsuleRepository;
        this.mongoTemplate = mongoTemplate;
    }

    /**
     * Перемикає реакцію.
     * Unique індекс (capsuleId, userId) — один юзер може мати лише одну реакцію на капсулу.
     * Якщо натискає той самий тип — видаляємо (hard delete, бо unique індекс не включає deletedAt).
     * Якщо натискає інший тип — оновлюємо type через MongoTemplate (щоб уникнути shard key проблем).
     * Якщо реакції нема — створюємо нову.
     */
    public ReactionSummaryResponse toggleReaction(String userId, String capsuleId, String type) {
        Capsule capsule = assertPublicOpenedCapsule(capsuleId);

        if (!Boolean.TRUE.equals(capsule.getAllowReactions())) {
            throw new IllegalArgumentException("Реакції вимкнені для цієї капсули");
        }

        ObjectId capsuleOid = new ObjectId(capsuleId);
        ObjectId userOid = new ObjectId(userId);

        // Шукаємо існуючу реакцію (будь-якого типу) від цього юзера на цю капсулу
        Query findQuery = new Query(Criteria.where("capsuleId").is(capsuleOid).and("userId").is(userOid));
        Reaction existing = mongoTemplate.findOne(findQuery, Reaction.class);

        if (existing != null) {
            if (existing.getType().equals(type)) {
                // Той самий тип — знімаємо реакцію (hard delete, бо unique індекс)
                mongoTemplate.remove(findQuery, Reaction.class);
            } else {
                // Інший тип — оновлюємо через updateFirst (shard-safe)
                Update update = new Update()
                        .set("type", type)
                        .set("createdAt", Instant.now());
                mongoTemplate.updateFirst(findQuery, update, Reaction.class);
            }
        } else {
            // Нова реакція
            Reaction reaction = new Reaction();
            reaction.setCapsuleId(capsuleOid);
            reaction.setUserId(userOid);
            reaction.setType(type);
            reaction.setCreatedAt(Instant.now());
            reactionRepository.save(reaction);
        }

        return getSummary(capsuleId, userId);
    }

    /**
     * Повертає підсумок реакцій: кількість кожного типу та реакції поточного користувача.
     */
    public ReactionSummaryResponse getSummary(String capsuleId, String viewerId) {
        assertPublicOpenedCapsule(capsuleId);

        ObjectId capsuleOid = new ObjectId(capsuleId);

        // Отримуємо всі активні реакції для капсули
        List<Reaction> allReactions = reactionRepository.findByCapsuleIdAndDeletedAtIsNull(capsuleOid);

        // Підрахунок кожного типу реакції
        Map<String, Long> counts = new LinkedHashMap<>();
        for (ReactionType rt : ReactionType.values()) {
            counts.put(rt.getValue(), 0L);
        }
        for (Reaction r : allReactions) {
            counts.merge(r.getType(), 1L, Long::sum);
        }

        // Реакції поточного юзера
        List<String> userReactions = Collections.emptyList();
        if (viewerId != null) {
            String viewerHex = viewerId;
            userReactions = allReactions.stream()
                    .filter(r -> r.getUserId().toHexString().equals(viewerHex))
                    .map(Reaction::getType)
                    .collect(Collectors.toList());
        }

        return new ReactionSummaryResponse(counts, userReactions);
    }

    /**
     * Перевіряє, що капсула публічна, відкрита та не видалена.
     */
    private Capsule assertPublicOpenedCapsule(String capsuleId) {
        Capsule capsule = capsuleRepository.findByIdAndDeletedAtIsNull(capsuleId)
                .orElseThrow(() -> new IllegalArgumentException("Капсула не знайдена"));

        if (!CapsuleVisibility.PUBLIC.equals(CapsuleVisibility.fromValue(capsule.getVisibility()))) {
            throw new IllegalArgumentException("Реакції доступні тільки для публічних капсул");
        }

        CapsuleStatus status = CapsuleStatus.fromValue(capsule.getStatus());
        if (!CapsuleStatus.OPENED.equals(status)) {
            throw new IllegalArgumentException("Реакції доступні тільки для відкритих капсул");
        }

        return capsule;
    }
}


