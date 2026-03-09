package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.Reaction;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReactionRepository extends MongoRepository<Reaction, String> {
    List<Reaction> findByCapsuleIdAndDeletedAtIsNull(ObjectId capsuleId);
    Optional<Reaction> findByCapsuleIdAndUserIdAndTypeAndDeletedAtIsNull(ObjectId capsuleId, ObjectId userId, String type);
    List<Reaction> findByCapsuleIdAndUserIdAndDeletedAtIsNull(ObjectId capsuleId, ObjectId userId);
    long countByCapsuleIdAndTypeAndDeletedAtIsNull(ObjectId capsuleId, String type);
}

