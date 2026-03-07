package com.oleksandrmytro.timecapsule.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
// OAuth2AuthorizationRequestResolver - це інтерфейс, який визначає методи для розв'язання запитів авторизації OAuth2. Він використовується для налаштування процесу авторизації,
// зокрема для додавання додаткових параметрів до запиту авторизації.
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GoogleAccountSelectAuthorizationRequestResolver — клас для кастомізації OAuth2 авторизації Google.
 * Додає параметр "prompt=select_account" до запиту, щоб користувач завжди міг вибрати акаунт Google.
 * Використовується у Spring Security для OAuth2 login.
 */
public class GoogleAccountSelectAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {
    // delegate — стандартний резолвер, який формує базовий запит авторизації
    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    /**
     * Конструктор: створює delegate для стандартного резолвера.
     * @param clientRegistrationRepository — репозиторій реєстрацій OAuth2 клієнтів
     */
    public GoogleAccountSelectAuthorizationRequestResolver(ClientRegistrationRepository clientRegistrationRepository) {
        // delegate формує стандартний запит авторизації
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");
    }

    /**
     * resolve — викликається Spring Security для формування запиту авторизації.
     * @param request — HTTP-запит
     * @return OAuth2AuthorizationRequest — запит авторизації
     */
    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        // Отримуємо стандартний запит авторизації
        OAuth2AuthorizationRequest authorizationRequest = delegate.resolve(request);
        // Кастомізуємо запит для Google
        return customizeGoogleRequest(authorizationRequest);
    }

    /**
     * resolve — перевантажений метод для формування запиту з clientRegistrationId.
     * @param request — HTTP-запит
     * @param clientRegistrationId — id OAuth2 клієнта
     * @return OAuth2AuthorizationRequest — запит авторизації
     */
    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        OAuth2AuthorizationRequest authorizationRequest = delegate.resolve(request, clientRegistrationId);
        return customizeGoogleRequest(authorizationRequest);
    }

    /**
     * customizeGoogleRequest — додає параметр "prompt=select_account" для Google.
     * @param authorizationRequest — запит авторизації
     * @return OAuth2AuthorizationRequest — модифікований запит
     */
    private OAuth2AuthorizationRequest customizeGoogleRequest(OAuth2AuthorizationRequest authorizationRequest) {
        // Перевіряємо, чи це Google
        if (authorizationRequest == null || !"google".equals(authorizationRequest.getAttribute("registration_id"))) {
            return authorizationRequest;
        }
        // Копіюємо додаткові параметри
        Map<String, Object> extraParameters = new LinkedHashMap<>(authorizationRequest.getAdditionalParameters());
        // Додаємо prompt=select_account
        extraParameters.put("prompt", "select_account");
        // Створюємо новий запит з додатковими параметрами
        return OAuth2AuthorizationRequest.from(authorizationRequest)
                .additionalParameters(extraParameters)
                .build();
    }
}

// --- Де використовується ---
// Цей клас використовується у Spring Security конфігурації (наприклад, у SecurityConfig),
// де замість стандартного OAuth2AuthorizationRequestResolver підставляється GoogleAccountSelectAuthorizationRequestResolver.
// Це дозволяє кастомізувати процес авторизації для Google.
