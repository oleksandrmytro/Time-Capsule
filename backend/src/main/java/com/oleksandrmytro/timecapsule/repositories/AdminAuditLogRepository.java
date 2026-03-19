package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.AdminAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AdminAuditLogRepository extends MongoRepository<AdminAuditLog, String> {
    Page<AdminAuditLog> findByActionRegexOrEntityTypeRegexOrActorEmailRegex(
            String actionRegex,
            String entityTypeRegex,
            String actorEmailRegex,
            Pageable pageable
    );
}

