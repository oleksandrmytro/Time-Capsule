package com.oleksandrmytro.timecapsule.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import static org.assertj.core.api.Assertions.assertThat;

class AccountSelectAuthorizationRequestResolverTest {
    @Test
    void addsAccountPickerPromptForGithub() {
        OAuth2AuthorizationRequest request = resolve("github");

        assertThat(request).isNotNull();
        assertThat(request.getAdditionalParameters()).containsEntry("prompt", "select_account");
    }

    @Test
    void addsAccountPickerPromptForGoogle() {
        OAuth2AuthorizationRequest request = resolve("google");

        assertThat(request).isNotNull();
        assertThat(request.getAdditionalParameters()).containsEntry("prompt", "select_account");
    }

    @Test
    void leavesOtherProvidersUnchanged() {
        OAuth2AuthorizationRequest request = resolve("demo");

        assertThat(request).isNotNull();
        assertThat(request.getAdditionalParameters()).doesNotContainKey("prompt");
    }

    private OAuth2AuthorizationRequest resolve(String registrationId) {
        AccountSelectAuthorizationRequestResolver resolver = new AccountSelectAuthorizationRequestResolver(
                new InMemoryClientRegistrationRepository(registration(registrationId))
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/" + registrationId);

        return resolver.resolve(request);
    }

    private ClientRegistration registration(String registrationId) {
        return ClientRegistration.withRegistrationId(registrationId)
                .clientId("client-id")
                .clientSecret("client-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .scope("read:user")
                .authorizationUri("https://example.com/oauth/authorize")
                .tokenUri("https://example.com/oauth/token")
                .userInfoUri("https://example.com/user")
                .userNameAttributeName("id")
                .clientName(registrationId)
                .build();
    }
}
