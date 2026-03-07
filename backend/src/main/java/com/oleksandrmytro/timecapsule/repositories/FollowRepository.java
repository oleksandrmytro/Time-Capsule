package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.Follow;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import org.bson.types.ObjectId;

import java.util.List;
import java.util.Optional;

@Repository
public interface FollowRepository extends MongoRepository<Follow, String> {
    List<Follow> findByUserIdAndDeletedAtIsNull(ObjectId userId);
    List<Follow> findByFollowerIdAndDeletedAtIsNull(ObjectId followerId);
    boolean existsByUserIdAndFollowerIdAndDeletedAtIsNull(ObjectId userId, ObjectId followerId);
    Optional<Follow> findByUserIdAndFollowerIdAndDeletedAtIsNull(ObjectId userId, ObjectId followerId);
    long countByUserIdAndDeletedAtIsNull(ObjectId userId);
    long countByFollowerIdAndDeletedAtIsNull(ObjectId followerId);
}
