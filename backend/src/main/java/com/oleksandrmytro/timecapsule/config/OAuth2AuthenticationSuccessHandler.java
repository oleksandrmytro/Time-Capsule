package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import com.oleksandrmytro.timecapsule.services.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2AuthenticationSuccessHandler.class);

    @Value("${frontend.url:http://localhost}")
    private String defaultFrontendUrl;

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final MongoTemplate mongoTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OAuth2AuthenticationSuccessHandler(UserRepository userRepository, JwtService jwtService, MongoTemplate mongoTemplate) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        String registrationId = oauthToken.getAuthorizedClientRegistrationId(); // github, google, etc.
        OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();

        // 1. Email (GitHub может вернуть null)
        String email = (String) oauth2User.getAttributes().get("email");
        if (email == null) {
            Object loginAttr = oauth2User.getAttributes().get("login");
            if (loginAttr != null) {
                email = loginAttr.toString() + "@" + registrationId + ".local";
            } else {
                email = oauth2User.getName() + "@" + registrationId + ".local";
            }
        }

        // 2. Name fallback
        String name = (String) oauth2User.getAttributes().get("name");
        if (name == null || name.isBlank()) {
            Object loginAttr = oauth2User.getAttributes().get("login");
            name = loginAttr != null ? loginAttr.toString() : email.split("@")[0];
        }

        // 3. Avatar (GitHub: avatar_url, Google: picture)
        String picture = null;
        Object ghAvatar = oauth2User.getAttributes().get("avatar_url");
        if (ghAvatar != null) picture = ghAvatar.toString();
        Object googlePic = oauth2User.getAttributes().get("picture");
        if (picture == null && googlePic != null) picture = googlePic.toString();

        final String finalEmail = email;
        final String finalName = name;
        final String finalPicture = picture;
        final String finalRegistrationId = registrationId;
        final OAuth2User finalOauth2User = oauth2User;

        // 1. Сначала ищем по OAuth провайдеру и ID (самый надежный способ)
        Optional<User> existingByOAuth = Optional.empty();
        try {
            System.out.println("Searching for user with provider: " + registrationId + " and providerId: " + oauth2User.getName());
            existingByOAuth = userRepository.findByAuthProvidersProviderAndAuthProvidersProviderId(registrationId, oauth2User.getName());
            if (existingByOAuth.isPresent()) {
                System.out.println("Found existing user by OAuth: " + existingByOAuth.get().getId());
            } else {
                System.out.println("No user found by OAuth provider and ID");
            }
        } catch (Exception e) {
            // Если метод не найден или есть проблема с базой, игнорируем
            System.err.println("Warning: Could not search by OAuth provider and ID: " + e.getMessage());
            e.printStackTrace();
        }

        // 2. Если не найден по OAuth, ищем по email
        Optional<User> existingByEmail = Optional.empty();
        if (existingByOAuth.isEmpty()) {
            System.out.println("Searching for user by email: " + finalEmail);
            existingByEmail = userRepository.findByEmail(finalEmail);
            if (existingByEmail.isPresent()) {
                System.out.println("Found existing user by email: " + existingByEmail.get().getId());
            } else {
                System.out.println("No user found by email");
            }
        }

        // 3. Берем найденного пользователя или создаем нового
        User user = existingByOAuth.orElse(existingByEmail.orElseGet(() -> {
            User u = new User(finalName, finalEmail, "");
            u.setEnabled(true);
            // Используем новый метод для добавления OAuth провайдера
            u.addAuthProvider(finalRegistrationId, finalOauth2User.getName());
            if (finalPicture != null) {
                u.setAvatarUrl(finalPicture);
            }
            return u;
        }));

        // Обновляем OAuth данные, если их нет
        if (!user.hasAuthProvider(registrationId, oauth2User.getName())) {
            user.addAuthProvider(registrationId, oauth2User.getName());
        }

        // Обновляем email, если он отсутствует
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            user.setEmail(email);
        }

        // Обновляем аватар, если он отсутствует или пустой
        if (picture != null && (user.getAvatarUrl() == null || user.getAvatarUrl().isBlank())) {
            user.setAvatarUrl(picture);
        }

        user.setEnabled(true); // social login users are trusted as verified

        try {
            saveUserRespectingShardKey(user);
        } catch (Exception e) {
            log.error("Failed to upsert user after OAuth success. userId={}, email={}, reason={}", user.getId(), user.getEmail(), e.getMessage(), e);
            throw e;
        }

        LoginResponse tokens = buildTokens(user);

        String redirectUri = request.getParameter("redirect_uri");
        if (redirectUri == null || redirectUri.isBlank()) {
            redirectUri = defaultFrontendUrl;
        }

        if (shouldRedirect(request)) {
            sendRedirectWithCookies(response, redirectUri, tokens);
        } else {
            writeJsonResponse(response, tokens);
        }
    }

    private boolean shouldRedirect(HttpServletRequest request) {
        String redirectFlag = request.getParameter("redirect");
        return redirectFlag == null || Boolean.parseBoolean(redirectFlag);
    }

    private void sendRedirectWithCookies(HttpServletResponse response, String redirectUri, LoginResponse tokens) throws IOException {
        // Set HttpOnly cookies for access and refresh tokens
        String accessCookie = buildCookie("accessToken", tokens.getAccessToken(), (int) (tokens.getExpiresIn() / 1000));
        String refreshCookie = buildCookie("refreshToken", tokens.getRefreshToken(), (int) (tokens.getRefreshExpiresIn() / 1000));
        response.addHeader("Set-Cookie", accessCookie);
        response.addHeader("Set-Cookie", refreshCookie);

        String target = UriComponentsBuilder.fromUriString(redirectUri)
                .build()
                .toUriString();

        log.info("OAuth success redirect to {}", target);
        response.sendRedirect(target);
    }

    private String buildCookie(String name, String value, int maxAgeSeconds) {
        // Secure flag for HTTPS; SameSite=Lax to allow OAuth redirect
        return name + "=" + value + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + maxAgeSeconds;
    }

    private void writeJsonResponse(HttpServletResponse response, LoginResponse tokens) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");

        Map<String, Object> payload = new HashMap<>();
        payload.put("accessToken", tokens.getAccessToken());
        payload.put("refreshToken", tokens.getRefreshToken());
        payload.put("expiresIn", tokens.getExpiresIn());
        payload.put("refreshExpiresIn", tokens.getRefreshExpiresIn());
        payload.put("tokenType", "Bearer");

        response.getWriter().write(objectMapper.writeValueAsString(payload));
        response.getWriter().flush();
    }

    private LoginResponse buildTokens(User user) {
        String accessToken = jwtService.generateToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        return new LoginResponse(accessToken, jwtService.getExpirationTime(), refreshToken, jwtService.getRefreshExpiration());
    }

    private void saveUserRespectingShardKey(User user) {
        if (user.getId() == null) {
            mongoTemplate.insert(user);
            return;
        }
        Query query = new Query(Criteria.where("_id").is(user.getId()));
        mongoTemplate.findAndReplace(query, user);
    }
}
