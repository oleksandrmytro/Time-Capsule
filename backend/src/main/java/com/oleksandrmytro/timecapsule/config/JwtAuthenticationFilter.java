package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.models.User;
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
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.io.IOException;
import java.time.LocalDateTime;

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
        String bearer = authHeader;

        if (bearer == null) {
            // Якщо немає Authorization header, шукаємо JWT у cookie "accessToken".
            String cookieJwt = extractCookie(request, "accessToken");
            if (StringUtils.hasText(cookieJwt)) {
                bearer = "Bearer " + cookieJwt;
            }
        }

        if (bearer == null || !bearer.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            final String jwt = bearer.substring(7);
            // Витягуємо subject з JWT — у нашому форматі це userId.
            final String userId = jwtService.extractUsername(jwt);
            if (userId != null) {
                UserDetails userDetails;
                try {
                    // Завантажуємо користувача з бази за userId.
                    userDetails = this.userDetailsService.loadUserByUsername(userId);
                } catch (UsernameNotFoundException e) {
                    // Якщо користувач не знайдений — пропускаємо запит як анонімний.
                    filterChain.doFilter(request, response);
                    return;
                }

                if (jwtService.isTokenValid(jwt, userDetails) && isAllowedForSession(userDetails)) {
                    // Передаємо імперсонацію в request attributes для контролерів/UI.
                    String adminId = jwtService.extractClaim(jwt, claims -> claims.get("impersonatedByAdminId", String.class));
                    String adminEmail = jwtService.extractClaim(jwt, claims -> claims.get("impersonatedByAdminEmail", String.class));
                    Boolean active = jwtService.extractClaim(jwt, claims -> claims.get("impersonationActive", Boolean.class));
                    request.setAttribute("impersonation.active", Boolean.TRUE.equals(active) || (adminId != null && !adminId.isBlank()));
                    request.setAttribute("impersonation.adminId", adminId);
                    request.setAttribute("impersonation.adminEmail", adminEmail);

                    // Створюємо Authentication з principal = User об'єкт.
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                } else {
                    SecurityContextHolder.clearContext();
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

    private boolean isAllowedForSession(UserDetails userDetails) {
        if (!(userDetails instanceof User user)) {
            return true;
        }
        if (user.getDeletedAt() != null) {
            return false;
        }
        if (!user.isEnabled()) {
            return false;
        }
        return user.getBlockedUntil() == null || !user.getBlockedUntil().isAfter(LocalDateTime.now());
    }
}
