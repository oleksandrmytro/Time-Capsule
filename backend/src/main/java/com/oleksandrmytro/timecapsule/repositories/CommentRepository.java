package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.Comment;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommentRepository extends MongoRepository<Comment, String> {
    List<Comment> findByCapsuleIdAndDeletedAtIsNullOrderByCreatedAtDesc(ObjectId capsuleId);
    Optional<Comment> findByIdAndDeletedAtIsNull(String id);
    long countByCapsuleIdAndDeletedAtIsNull(ObjectId capsuleId);
}

