package com.oleksandrmytro.timecapsule.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.savedrequest.NullRequestCache;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Spring Security configuration.
 * Основний клас для налаштування Spring Security.
 * Визначає політики доступу, фільтри, CORS, JWT, OAuth2, WebSocket.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfiguration {
    
    /**
     * логіка аутентифікації (наприклад, через JWT).
     */
    private final AuthenticationProvider authenticationProvider;
    /**
     * фільтр для перевірки JWT-токенів.
     */
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    /**
     * обробники OAuth2 login.
     */
    private final OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;
    private final OAuth2AuthenticationFailureHandler oAuth2AuthenticationFailureHandler;
    /**
     * репозиторій OAuth2-клієнтів (Google, GitHub).
     */
    private final ClientRegistrationRepository clientRegistrationRepository;
    private final List<String> corsAllowedOrigins;

    /**
     * Інжектить всі залежності для роботи з безпекою, JWT, OAuth2.
     */
    public SecurityConfiguration(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            AuthenticationProvider authenticationProvider,
            OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler,
            OAuth2AuthenticationFailureHandler oAuth2AuthenticationFailureHandler,
            ClientRegistrationRepository clientRegistrationRepository,
            @Value("${cors.allowed-origins:https://localhost,https://localhost:443,https://localhost:5173,http://localhost,http://localhost:5173,http://localhost:80}") String corsAllowedOrigins
    ) {
        this.authenticationProvider = authenticationProvider;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.oAuth2AuthenticationSuccessHandler = oAuth2AuthenticationSuccessHandler;
        this.oAuth2AuthenticationFailureHandler = oAuth2AuthenticationFailureHandler;
        this.clientRegistrationRepository = clientRegistrationRepository;
        this.corsAllowedOrigins = Arrays.stream(corsAllowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toList();
    }

    @Bean
    @Order(0)
    public SecurityFilterChain staticResourcesFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/static/**", "/uploads/**")
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    /**
     * wsSecurityFilterChain — налаштування безпеки для WebSocket.
     * Дозволяє всі запити, вимикає CSRF, сесії stateless.
     */
    @Bean // Позначає метод як Spring Bean(щоб можна було використовувати як конфігурацію безпеки)
    @Order(1) // ws chain
    public SecurityFilterChain wsSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/ws/**")                                                                  // Застосовує цей ланцюг для всіх маршрутів, що починаються з /ws/
                .csrf(AbstractHttpConfigurer::disable)                                                      // Вимикає CSRF-захист для WebSocket
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))                          // Включає CORS(механізм браузера який дозволяє/забороняє веб робити HTTP запити до іншого домена) з кастомним джерелом(дозволяє запити з фронтенду)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())                               // Дозволяє всі запити без авторизації
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));          // Встановлює stateless-сесії (без збереження стану)
        return http.build(); // Створює та повертає SecurityFilterChain
    }

    /**
     * apiSecurityFilterChain — налаштування безпеки для REST API.
     * Дозволяє /api/auth/** та /api/hello, інші — тільки для авторизованих.
     * Встановлює JWT-фільтр, вимикає CSRF, сесії stateless.
     */
    @Bean
    @Order(2)
    public SecurityFilterChain apiSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/**")                         // Застосовує ланцюг для всіх маршрутів що починаються з /api/
                .csrf(AbstractHttpConfigurer::disable)              // Вимикає CSRF-захист для API (бо API зазвичай stateless)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))              // Включає CORS для API (дозволяє запити з фронтенду)
                .formLogin(AbstractHttpConfigurer::disable)             // Вимикає стандартний form login (бо API не використовує форми)
                .httpBasic(AbstractHttpConfigurer::disable)             // Вимикає http basic auth (бо використовується JWT)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/api/hello").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/tags/**").permitAll()
                        .requestMatchers("/api/admin/**").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/capsules/*/comments").permitAll()    // Публічний перегляд коментарів
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/capsules/*/reactions").permitAll()   // Публічний перегляд реакцій
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/capsules/*").permitAll()             // Публічний перегляд капсул
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/users/**").permitAll()               // Публічний перегляд профілів
                        .anyRequest().authenticated()               // Всі інші запити — тільки для авторизованих користувачів
                )
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))            // Якщо не авторизований — повертає 401
                .requestCache(cache -> cache.requestCache(new NullRequestCache()))              // Вимикає кешування запитів (бо API stateless)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))              // Встановлює stateless-сесії (без збереження стану)
                .authenticationProvider(authenticationProvider)             // Встановлює кастомний authenticationProvider (логіка аутентифікації)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);          // Додає JWT-фільтр перед стандартним фільтром аутентифікації

        return http.build();
    }

    /**
     * oauthSecurityFilterChain — налаштування для OAuth2 login.
     * Дозволяє всі запити, кастомізує Google OAuth2, встановлює success/failure handler-и.
     */
    @Bean
    @Order(3)
    public SecurityFilterChain oauthSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/oauth2/**", "/login/oauth2/**", "/error")            // Застосовує ланцюг для маршрутів, пов'язаних з OAuth2 login та помилками
                .csrf(AbstractHttpConfigurer::disable)          // Вимикає CSRF-захист для OAuth2 login (бо це не API)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))          // Включає CORS для OAuth2 login (дозволяє запити з фронтенду)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())           // Дозволяє всі запити без авторизації (бо це маршрути для входу та помилок)
                .oauth2Login(oauth2 -> oauth2
                        .authorizationEndpoint(authorization -> authorization
                                .authorizationRequestResolver(new GoogleAccountSelectAuthorizationRequestResolver(clientRegistrationRepository))            // Використовує кастомний резолвер для запитів авторизації OAuth2 (щоб додати параметр prompt=select_account для Google)
                        )
                        .successHandler(oAuth2AuthenticationSuccessHandler)
                        .failureHandler(oAuth2AuthenticationFailureHandler)
                )
                .requestCache(cache -> cache.requestCache(new NullRequestCache()))          // Вимикає кешування запитів (бо OAuth2 login stateless)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED));            // Встановлює сесії тільки якщо потрібно (для OAuth2 login може бути stateful)

        return http.build();
    }

    /**
     * fallbackSecurityFilterChain — для всіх інших маршрутів.
     * Забороняє всі запити.
     */
    @Bean
    @Order(3)
    public SecurityFilterChain fallbackSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)          // Вимикає CSRF-захист (бо це fallback для всіх інших маршрутів)
                .authorizeHttpRequests(auth -> auth.anyRequest().denyAll());            // Забороняє всі запити (якщо маршрут не підпадає під попередні ланцюги, він буде заборонений)

        return http.build();
    }

    /**
     * corsConfigurationSource — налаштування CORS для фронтенду.
     * Дозволяє потрібні origin, методи, заголовки.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsAllowedOrigins);           // Дозволяє запити з цих origin (фронтенд працює на localhost:5173)
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));            // Дозволяє ці HTTP-методи для CORS-запитів
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));          // Дозволяє ці заголовки в CORS-запитах (Authorization для JWT, Content-Type для JSON)
        configuration.setAllowCredentials(true);            // Дозволяє відправляти куки та авторизаційні заголовки в CORS-запитах
        configuration.setExposedHeaders(List.of("Authorization"));          // Дозволяє фронтенду отримувати заголовок Authorization в CORS-відповідях (щоб отримати JWT-токен після входу)
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();         // Створює джерело CORS-конфігурації, яке базується на URL-шляхах
        source.registerCorsConfiguration("/**", configuration);         // Реєструє CORS-конфігурацію для всіх маршрутів (/**)
        return source;
    }
}
