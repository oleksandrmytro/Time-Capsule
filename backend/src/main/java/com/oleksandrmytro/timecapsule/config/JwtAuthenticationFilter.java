package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.services.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
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
        final String authHeader = request.getHeader("Authorization");
        String bearer = authHeader;

        // Fallback to cookie-based auth if no header
        if (bearer == null) {
            String cookieJwt = extractCookie(request, "accessToken");
            if (StringUtils.hasText(cookieJwt)) {
                bearer = "Bearer " + cookieJwt;
            }
        }

        if (bearer == null || !bearer.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        /*
        What criteria an incoming request must match before being forwarded to the application middleware:
        1. The request url path has to match /auth/signup and /auth/login
        2. Every request must be treated like the new one, no session should be created or used.
        3. Must use custom authentication provider (JwtAuthenticationProvider).
        4. Must be executed before the application middleware (UsernamePasswordAuthenticationFilter).
        5. The cors configuration will only allow POST and GET requests.
         */

        try {
            final String jwt = bearer.substring(7);
            final String userEmail = jwtService.extractUsername(jwt);

            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            if (userEmail != null && authentication == null) {
                UserDetails userDetails = this.userDetailsService.loadUserByUsername(userEmail);

                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
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
