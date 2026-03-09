package com.oleksandrmytro.timecapsule.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

// WebSocket configuration for STOMP messaging with JWT authentication.
@Configuration
// @EnableWebSocketMessageBroker — включає підтримку WebSocket з STOMP-протоколом для обміну повідомленнями між клієнтом і сервером.
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketJwtChannelInterceptor webSocketJwtChannelInterceptor;
    private final CookieHandshakeInterceptor cookieHandshakeInterceptor;

    public WebSocketConfig(WebSocketJwtChannelInterceptor webSocketJwtChannelInterceptor,
                           CookieHandshakeInterceptor cookieHandshakeInterceptor) {
        this.webSocketJwtChannelInterceptor = webSocketJwtChannelInterceptor;
        this.cookieHandshakeInterceptor = cookieHandshakeInterceptor;
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
                .setAllowedOriginPatterns("http://localhost*", "http://127.0.0.1*", "http://*.local*", "http://*.test*", "http://*.lan*")
                .addInterceptors(cookieHandshakeInterceptor)
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(webSocketJwtChannelInterceptor);
    }
}
