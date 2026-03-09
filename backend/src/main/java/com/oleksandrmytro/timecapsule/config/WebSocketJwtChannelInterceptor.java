package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.services.JwtService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;

// WebSocketJwtChannelInterceptor — це Spring-компонент, який реалізує ChannelInterceptor для обробки JWT-токенів у WebSocket-з'єднаннях.
@Component
public class WebSocketJwtChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public WebSocketJwtChannelInterceptor(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    // preSend — це метод, який виконується перед відправкою повідомлення через WebSocket. Він перевіряє наявність JWT-токена в заголовках повідомлення
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        // ВАЖЛИВО: використовуємо getAccessor() замість wrap(), бо wrap() створює immutable копію
        // і setUser() не пропагується — Spring не бачить principal, convertAndSendToUser не працює
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;
        if (StompCommand.CONNECT.equals(accessor.getCommand()) || StompCommand.SEND.equals(accessor.getCommand()) || StompCommand.SUBSCRIBE.equals(accessor.getCommand())) { // Перевіряємо, чи це команда CONNECT, SEND або SUBSCRIBE, оскільки саме в цих командах нам потрібно аутентифікувати користувача.
            // Шукаємо JWT - спочатку в STOMP header, потім в кукі, потім в атрибутах сесії WebSocket
            String bearer = resolveBearer(accessor);
            if (bearer != null && bearer.startsWith("Bearer ")) {
                String jwt = bearer.substring(7);
                // extractUsername повертає subject з JWT — тепер це userId
                String userId = jwtService.extractUsername(jwt);
                if (userId != null) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(userId);
                    if (jwtService.isTokenValid(jwt, userDetails)) {
                        // getUsername() тепер повертає userId, тому principalName = userId завжди
                        // convertAndSendToUser(peerId, ...) знайде з'єднання де principal.getName() == peerId
                        String principalName = userDetails.getUsername(); // = userId
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(principalName, null, userDetails.getAuthorities());
                        SecurityContextHolder.getContext().setAuthentication(auth);
                        accessor.setUser(auth);
                    } else {
                        System.out.println("[WS-AUTH] invalid JWT for userId=" + userId);
                    }
                } else {
                    System.out.println("[WS-AUTH] userId null from JWT");
                }
            } else {
                System.out.println("[WS-AUTH] bearer missing for command=" + accessor.getCommand());
            }
        }
        return message;
    }

    // resolveBearer — шукає JWT-токен у: 1) STOMP header Authorization, 2) STOMP header cookie, 3) WebSocket session attributes (з HTTP handshake cookie)
    private String resolveBearer(StompHeaderAccessor accessor) {
        // 1. STOMP header "Authorization"
        List<String> authHeaders = accessor.getNativeHeader("Authorization");
        if (authHeaders != null && !authHeaders.isEmpty() && StringUtils.hasText(authHeaders.get(0))) {
            return authHeaders.get(0);
        }
        // 2. STOMP header "cookie" (якщо клієнт передає cookie як STOMP native header)
        List<String> cookies = accessor.getNativeHeader("cookie");
        if (cookies != null) {
            for (String c : cookies) {
                for (String cookie : c.split(";")) {
                    String trimmed = cookie.trim();
                    if (trimmed.startsWith("accessToken=")) {
                        String token = trimmed.substring("accessToken=".length());
                        return "Bearer " + token;
                    }
                }
            }
        }
        // 3. WebSocket session attributes (токен витягнутий з HTTP cookie при handshake через CookieHandshakeInterceptor)
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes != null) {
            Object token = sessionAttributes.get(CookieHandshakeInterceptor.WS_ACCESS_TOKEN_ATTR);
            if (token instanceof String t && StringUtils.hasText(t)) {
                return "Bearer " + t;
            }
        }
        return null;
    }
}
