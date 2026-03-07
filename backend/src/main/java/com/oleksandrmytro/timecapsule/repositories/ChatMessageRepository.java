package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.ChatMessage;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    List<ChatMessage> findByFromUserIdAndToUserIdOrFromUserIdAndToUserIdOrderByCreatedAtAsc(ObjectId from, ObjectId to, ObjectId from2, ObjectId to2);
    List<ChatMessage> findByFromUserIdOrToUserIdOrderByCreatedAtDesc(ObjectId from, ObjectId to);
}

