package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.services.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.util.StringUtils;

import java.io.IOException;

/**
 * JWT Authentication Filter that processes JWT tokens in requests.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    private final HandlerExceptionResolver handlerExceptionResolver;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            UserDetailsService userDetailsService,
            HandlerExceptionResolver handlerExceptionResolver
    ) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.handlerExceptionResolver = handlerExceptionResolver;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        // Шукаємо токен в Authorization header.
        final String authHeader = request.getHeader("Authorization");
        // bearer - означає предявний, тобто той, хто його має, отримує доступ
        String bearer = authHeader;

        // Якщо немає Authorization header, шукаємо в cookie з імям "accessToken"
        if (bearer == null) {
            String cookieJwt = extractCookie(request, "accessToken"); // читає кукі
            if (StringUtils.hasText(cookieJwt)) {
                bearer = "Bearer " + cookieJwt;
            }
        }

        if (bearer == null || !bearer.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        /*
        Які критерії має відповідати вхідний запит, щоб бути переданим у middleware додатку:
        1. URL запиту має відповідати /auth/signup або /auth/login
        2. Кожен запит має оброблятися як новий, не повинна створюватися або використовуватися сесія.
        3. Має використовуватися кастомний authentication provider (JwtAuthenticationProvider).
        4. Має виконуватися перед middleware додатку (UsernamePasswordAuthenticationFilter).
        5. CORS-конфігурація дозволяє лише POST та GET запити.
         */

        try {
            // Витягуємо subject з JWT — тепер це userId (раніше був email)
            final String jwt = bearer.substring(7);
            final String userId = jwtService.extractUsername(jwt);
            if (userId != null) {
                UserDetails userDetails;
                try {
                    // Завантажуємо користувача з бази за userId (ApplicationConfiguration шукає по findById)
                    userDetails = this.userDetailsService.loadUserByUsername(userId);
                } catch (UsernameNotFoundException e) {
                    // Treat missing user as anonymous and continue without failing the request
                    filterChain.doFilter(request, response);
                    return;
                }
                // Перевіряємо що JWT валідний та не expired
                if (jwtService.isTokenValid(jwt, userDetails)) {
                    // Створюємо Authentication з principal = User об'єкт
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,    // principal — це UserDetails, який містить інформацію про користувача
                            null,
                            userDetails.getAuthorities()
                    );

                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }

            filterChain.doFilter(request, response);
        } catch (Exception exception) {
            handlerExceptionResolver.resolveException(request, response, null, exception);
        }
    }

    private String extractCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
