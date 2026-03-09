package com.oleksandrmytro.timecapsule.config;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * Перехоплює HTTP handshake при встановленні WebSocket з'єднання.
 * Витягує accessToken з HttpOnly cookie і зберігає його в WebSocket session attributes,
 * щоб ChannelInterceptor (WebSocketJwtChannelInterceptor) міг його прочитати
 * на рівні STOMP CONNECT.
 *
 * Це стандартний Spring-підхід, оскільки браузер відправляє cookies
 * при HTTP Upgrade request, але вони НЕ потрапляють у STOMP native headers.
 */
@Component
public class CookieHandshakeInterceptor implements HandshakeInterceptor {

    public static final String WS_ACCESS_TOKEN_ATTR = "ws.accessToken";

    @Override
    // Під час HTTP Upgrade запиту браузер надсилає всі cookies, включаючи HttpOnly. Цей метод перехоплює запит, витягує accessToken з cookie і зберігає його в атрибутах WebSocket сесії
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpRequest = servletRequest.getServletRequest();
            Cookie[] cookies = httpRequest.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("accessToken".equals(cookie.getName())) {
                        // Зберігаємо JWT в session attributes WebSocket з'єднання
                        attributes.put(WS_ACCESS_TOKEN_ATTR, cookie.getValue());
                        break;
                    }
                }
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // нічого не потрібно
    }
}

