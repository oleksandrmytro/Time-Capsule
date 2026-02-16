package com.oleksandrmytro.timecapsule.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Adds Google-specific auth params to always show account selection.
 */
public class GoogleAccountSelectAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public GoogleAccountSelectAuthorizationRequestResolver(ClientRegistrationRepository clientRegistrationRepository) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        OAuth2AuthorizationRequest authorizationRequest = delegate.resolve(request);
        return customizeGoogleRequest(authorizationRequest);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        OAuth2AuthorizationRequest authorizationRequest = delegate.resolve(request, clientRegistrationId);
        return customizeGoogleRequest(authorizationRequest);
    }

    private OAuth2AuthorizationRequest customizeGoogleRequest(OAuth2AuthorizationRequest authorizationRequest) {
        if (authorizationRequest == null || !"google".equals(authorizationRequest.getAttribute("registration_id"))) {
            return authorizationRequest;
        }

        Map<String, Object> extraParameters = new LinkedHashMap<>(authorizationRequest.getAdditionalParameters());
        extraParameters.put("prompt", "select_account");

        return OAuth2AuthorizationRequest.from(authorizationRequest)
                .additionalParameters(extraParameters)
                .build();
    }
}