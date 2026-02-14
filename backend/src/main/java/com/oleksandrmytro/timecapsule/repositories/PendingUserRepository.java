package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.PendingUser;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PendingUserRepository extends MongoRepository<PendingUser, String> {
    Optional<PendingUser> findByEmail(String email);
    Optional<PendingUser> findByVerificationCode(String code);
    void deleteByEmail(String email);
}
