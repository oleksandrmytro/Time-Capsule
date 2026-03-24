package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.Tag;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends MongoRepository<Tag, String> {
    Optional<Tag> findByNameIgnoreCase(String name);
    List<Tag> findByIsSystemTrue();
    List<Tag> findByIsSystemTrueOrCreatedBy(ObjectId createdBy);
    List<Tag> findByNameContainingIgnoreCase(String query);
    boolean existsByNameIgnoreCase(String name);
}
