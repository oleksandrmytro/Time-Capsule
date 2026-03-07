package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.Share;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShareRepository extends MongoRepository<Share, String> {
    Optional<Share> findByCapsuleIdAndGranteeIdAndDeletedAtIsNull(ObjectId capsuleId, ObjectId granteeId);
    boolean existsByCapsuleIdAndGranteeIdAndDeletedAtIsNull(ObjectId capsuleId, ObjectId granteeId);
    List<Share> findByGranteeIdAndDeletedAtIsNull(ObjectId granteeId);
    List<Share> findByCapsuleIdAndDeletedAtIsNull(ObjectId capsuleId);
}

