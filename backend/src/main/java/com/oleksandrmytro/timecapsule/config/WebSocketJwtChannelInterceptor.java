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

@Component
public class WebSocketJwtChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public WebSocketJwtChannelInterceptor(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.CONNECT.equals(accessor.getCommand()) || StompCommand.SEND.equals(accessor.getCommand()) || StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String bearer = resolveBearer(accessor);
            if (bearer != null && bearer.startsWith("Bearer ")) {
                String jwt = bearer.substring(7);
                String username = jwtService.extractUsername(jwt);
                if (username != null) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    if (jwtService.isTokenValid(jwt, userDetails)) {
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                        SecurityContextHolder.getContext().setAuthentication(auth);
                        accessor.setUser(auth);
                    }
                }
            }
        }
        return message;
    }

    private String resolveBearer(StompHeaderAccessor accessor) {
        List<String> authHeaders = accessor.getNativeHeader("Authorization");
        if (authHeaders != null && !authHeaders.isEmpty() && StringUtils.hasText(authHeaders.get(0))) {
            return authHeaders.get(0);
        }
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
        return null;
    }
}

