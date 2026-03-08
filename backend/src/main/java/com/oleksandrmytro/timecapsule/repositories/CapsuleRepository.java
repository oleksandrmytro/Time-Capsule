package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.Capsule;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CapsuleRepository extends MongoRepository<Capsule, String> {
    List<Capsule> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(ObjectId ownerId);
    Optional<Capsule> findByIdAndOwnerIdAndDeletedAtIsNull(String id, ObjectId ownerId);
    Optional<Capsule> findByIdAndDeletedAtIsNull(String id);
    long countByOwnerIdAndDeletedAtIsNull(ObjectId ownerId);
    List<Capsule> findByOwnerIdAndVisibilityAndDeletedAtIsNullOrderByCreatedAtDesc(ObjectId ownerId, String visibility);
}
