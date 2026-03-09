package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Application configuration for authentication and database.
 */
@Configuration
public class ApplicationConfiguration {
    
    private final UserRepository userRepository;

    public ApplicationConfiguration(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * UserDetailsService — завантажує користувача з бази за ідентифікатором.
     *
     * Раніше JWT зберігав email як subject, тому тут шукали по email.
     * Тепер JWT зберігає userId як subject — шукаємо по userId (MongoDB _id).
     * Fallback на email залишено для старих токенів (наприклад, якщо хтось ще має старий токен).
     */
    @Bean
    UserDetailsService userDetailsService() {
        return userId -> {
            // Спочатку шукаємо по userId (новий формат JWT, subject = userId)
            var byId = userRepository.findById(userId);
            if (byId.isPresent()) return byId.get();
            // Fallback: шукаємо по email (старі токени де subject = email)
            return userRepository.findByEmail(userId)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userId));
        };
    }

    @Bean
    BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(passwordEncoder());

        authProvider.setUserDetailsService(userDetailsService());

        return authProvider;
    }

}

