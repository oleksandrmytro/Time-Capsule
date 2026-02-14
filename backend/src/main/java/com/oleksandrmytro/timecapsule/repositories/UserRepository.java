package com.oleksandrmytro.timecapsule.repositories;

import com.oleksandrmytro.timecapsule.models.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for User entity operations.
 */
@Repository
public interface UserRepository extends MongoRepository<User, String> {
    
    Optional<User> findByEmail(String email);
    
    Optional<User> findByVerificationCode(String verificationCode);

    Optional<User> findByAuthProvidersProviderAndAuthProvidersProviderId(String provider, String providerId);
    
    boolean existsByEmail(String email);
    
    boolean existsByUsername(String username);
}