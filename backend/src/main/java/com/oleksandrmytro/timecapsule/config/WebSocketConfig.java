package com.oleksandrmytro.timecapsule.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

// WebSocket configuration for STOMP messaging with JWT authentication.
@Configuration
// @EnableWebSocketMessageBroker — включає підтримку WebSocket з STOMP-протоколом для обміну повідомленнями між клієнтом і сервером.
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketJwtChannelInterceptor webSocketJwtChannelInterceptor;
    private final CookieHandshakeInterceptor cookieHandshakeInterceptor;
    private final String[] allowedOriginPatterns;

    public WebSocketConfig(WebSocketJwtChannelInterceptor webSocketJwtChannelInterceptor,
                           CookieHandshakeInterceptor cookieHandshakeInterceptor,
                           @Value("${websocket.allowed-origin-patterns:https://localhost*,https://127.0.0.1*,http://localhost*,http://127.0.0.1*,https://*.local*,http://*.local*,https://*.test*,http://*.test*,https://*.lan*,http://*.lan*}") String allowedOriginPatterns) {
        this.webSocketJwtChannelInterceptor = webSocketJwtChannelInterceptor;
        this.cookieHandshakeInterceptor = cookieHandshakeInterceptor;
        this.allowedOriginPatterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(pattern -> !pattern.isBlank())
                .toArray(String[]::new);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setUserDestinationPrefix("/user");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                // Дозволяємо локальні origin, включно з 127.0.0.1 та будь-якими портами (Vite/Next/nginx)
                .setAllowedOriginPatterns(allowedOriginPatterns)
                .addInterceptors(cookieHandshakeInterceptor)
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(webSocketJwtChannelInterceptor);
    }
}
