package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.Capsule;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CapsuleRepository extends MongoRepository<Capsule, String> {
    List<Capsule> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerId);
    Optional<Capsule> findByIdAndOwnerIdAndDeletedAtIsNull(String id, String ownerId);
}

