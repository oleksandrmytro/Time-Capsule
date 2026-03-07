package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.services.JwtService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

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
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);           // Створюємо обгортку для зручного доступу до заголовків STOMP, wrap - це статичний метод, який приймає повідомлення і повертає об'єкт StompHeaderAccessor, що дозволяє легко читати та змінювати заголовки STOMP.
        if (StompCommand.CONNECT.equals(accessor.getCommand()) || StompCommand.SEND.equals(accessor.getCommand()) || StompCommand.SUBSCRIBE.equals(accessor.getCommand())) { // Перевіряємо, чи це команда CONNECT, SEND або SUBSCRIBE, оскільки саме в цих командах нам потрібно аутентифікувати користувача.
            String bearer = resolveBearer(accessor);
            if (bearer != null && bearer.startsWith("Bearer ")) {
                String jwt = bearer.substring(7);           // Витягуємо JWT-токен, видаляючи префікс "Bearer ".
                String username = jwtService.extractUsername(jwt);          // Використовуємо JwtService для отримання імені користувача з токена.
                if (username != null) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    if (jwtService.isTokenValid(jwt, userDetails)) {
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                        SecurityContextHolder.getContext().setAuthentication(auth);         // Встановлюємо аутентифікацію в SecurityContext, щоб вона була доступна в поточному контексті безпеки.
                        accessor.setUser(auth);         // Встановлюємо аутентифікацію в заголовках STOMP, щоб вона була доступна для подальшої обробки повідомлень.
                    }
                }
            }
        }
        return message;
    }

    // resolveBearer — це допоміжний метод, який шукає JWT-токен у заголовках "Authorization
    private String resolveBearer(StompHeaderAccessor accessor) {
        List<String> authHeaders = accessor.getNativeHeader("Authorization");           // Отримуємо заголовки "Authorization
        if (authHeaders != null && !authHeaders.isEmpty() && StringUtils.hasText(authHeaders.get(0))) {         // Якщо заголовки "Authorization" присутні і не порожні, повертаємо перший заголовок.
            return authHeaders.get(0);
        }
        List<String> cookies = accessor.getNativeHeader("cookie");          // Якщо заголовки "Authorization" відсутні, шукаємо заголовки "cookie", оскільки JWT-токен може бути переданий через cookie.
        if (cookies != null) {
            for (String c : cookies) {
                for (String cookie : c.split(";")) {
                    String trimmed = cookie.trim();         // Розділяємо cookie по ";", оскільки в одному заголовку "cookie" може бути декілька cookie, та перевіряємо кожен на наявність "accessToken=".
                    if (trimmed.startsWith("accessToken=")) {
                        String token = trimmed.substring("accessToken=".length());          // Якщо знайдено cookie з назвою "accessToken", витягуємо токен і повертаємо його
                        return "Bearer " + token;
                    }
                }
            }
        }
        return null;
    }
}

