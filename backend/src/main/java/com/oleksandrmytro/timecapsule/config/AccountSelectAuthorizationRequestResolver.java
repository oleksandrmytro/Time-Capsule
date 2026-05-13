package com.oleksandrmytro.timecapsule.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Adds provider-specific authorization parameters that force an account picker.
 */
public class AccountSelectAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {
    private static final Set<String> ACCOUNT_SELECT_PROVIDERS = Set.of("google", "github");

    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public AccountSelectAuthorizationRequestResolver(ClientRegistrationRepository clientRegistrationRepository) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return customize(delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        return customize(delegate.resolve(request, clientRegistrationId));
    }

    private OAuth2AuthorizationRequest customize(OAuth2AuthorizationRequest authorizationRequest) {
        if (authorizationRequest == null) {
            return null;
        }

        String registrationId = authorizationRequest.getAttribute("registration_id");
        if (!ACCOUNT_SELECT_PROVIDERS.contains(registrationId)) {
            return authorizationRequest;
        }

        Map<String, Object> extraParameters = new LinkedHashMap<>(authorizationRequest.getAdditionalParameters());
        extraParameters.put("prompt", "select_account");

        return OAuth2AuthorizationRequest.from(authorizationRequest)
                .additionalParameters(extraParameters)
                .build();
    }
}
