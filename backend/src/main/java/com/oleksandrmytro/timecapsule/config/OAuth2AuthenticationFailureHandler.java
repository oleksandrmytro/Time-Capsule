package com.oleksandrmytro.timecapsule.config;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Handles OAuth2 authentication failures.
 * Redirects to frontend with error information.
 */
@Component
public class OAuth2AuthenticationFailureHandler extends SimpleUrlAuthenticationFailureHandler {

    @Value("${frontend.url:http://localhost:5173}")
    private String frontendUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {

        String errorMessage = exception.getLocalizedMessage();
        
        String targetUrl = UriComponentsBuilder.fromUriString(frontendUrl + "/auth/oauth2/redirect")
                .queryParam("error", URLEncoder.encode(errorMessage, StandardCharsets.UTF_8))
                .build().toUriString();
        
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}