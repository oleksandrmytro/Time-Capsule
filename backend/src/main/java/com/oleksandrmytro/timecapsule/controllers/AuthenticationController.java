package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.dto.LoginUserDto;
import com.oleksandrmytro.timecapsule.dto.RegisterUserDto;
import com.oleksandrmytro.timecapsule.dto.RefreshTokenRequest;
import com.oleksandrmytro.timecapsule.dto.VerifyUserDto;
import com.oleksandrmytro.timecapsule.dto.ResendVerificationDto;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.responses.AuthSessionResponse;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import com.oleksandrmytro.timecapsule.services.AuthenticationService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;


import java.net.URI;
/**
 * Controller for authentication endpoints.
 */
// RestController - використовується для створення RESTful веб-сервісів. Він поєднує в собі функціональність @Controller та @ResponseBody,
// що дозволяє повертати дані безпосередньо у відповідь на HTTP-запити, зазвичай у форматі JSON або XML.
@RestController
// RequestMapping - визначає базовий URL для всіх методів цього контролера. У цьому випадку всі ендпоінти будуть починатися з "/api/auth".
@RequestMapping("/api/auth")
public class AuthenticationController {
    
    private final AuthenticationService authenticationService;

    public AuthenticationController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    // PostMapping - визначає, що цей метод буде обробляти POST-запити на URL "/signup". Він приймає об'єкт RegisterUserDto у тілі запиту, який валідований за допомогою @Valid.
    @PostMapping("/signup")
    public ResponseEntity<String> register(@Valid @RequestBody RegisterUserDto registerUserDto) {
        authenticationService.signup(registerUserDto);
        return ResponseEntity.status(HttpStatus.CREATED).body("Verification email sent. Please check your inbox.");         // Повертаємо статус 201 Created та повідомлення про відправку верифікаційного листа
    }

    /**
     * Обробляє POST-запит на "/login" для аутентифікації користувача. Приймає LoginUserDto у тілі запиту, валідований за допомогою @Valid.
     * @param loginUserDto - дані для входу користувача (email та пароль)
     * @param request - HTTP-запит, використовується для визначення атрибутів запиту (наприклад, secure)
     * @param response - HTTP-відповідь, використовується для встановлення куків з токенами
     * @return
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> authenticate(@Valid @RequestBody LoginUserDto loginUserDto, HttpServletRequest request, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.authenticateAndIssueTokens(loginUserDto);
        writeAuthCookies(request, response, loginResponse);         // Встановлюємо куки з токенами у відповідь
        return ResponseEntity.ok(loginResponse);
    }

    /**
     * Обробляє POST-запит на "/verify" для верифікації користувача. Приймає VerifyUserDto у тілі запиту, валідований за допомогою @Valid.
     * @param verifyUserDto - дані для верифікації користувача (verification code)
     * @return
     */
    @PostMapping("/verify")
    public ResponseEntity<String> verifyUserPost(@Valid @RequestBody VerifyUserDto verifyUserDto) {
        authenticationService.verifyUser(verifyUserDto);
        return ResponseEntity.ok("Account verified successfully");
    }

    /**
     * Обробляє GET-запит на "/verify" для верифікації користувача. Приймає код верифікації як параметр запиту.
     * @param code - код верифікації, отриманий з посилання у верифікаційному листі
     * @return
     */
    @GetMapping("/verify")
    public ResponseEntity<String> verifyUserGet(@RequestParam("code") String code) {
        VerifyUserDto dto = new VerifyUserDto();
        dto.setCode(code);
        authenticationService.verifyUser(dto);
        return ResponseEntity.ok("Account verified successfully");
    }

    /**
     * Обробляє POST-запит на "/verify-and-login" для верифікації користувача та одночасного входу. Приймає VerifyUserDto у тілі запиту, валідований за допомогою @Valid.
     * @param verifyUserDto - дані для верифікації користувача (verification code)
     * @param request - HTTP-запит, використовується для визначення атрибутів запиту (наприклад, secure)
     * @param response - HTTP-відповідь, використовується для встановлення куків з токенами
     * @return
     */
    @PostMapping("/verify-and-login")
    public ResponseEntity<LoginResponse> verifyAndLogin(@Valid @RequestBody VerifyUserDto verifyUserDto, HttpServletRequest request, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.verifyUserAndIssueTokens(verifyUserDto);
        writeAuthCookies(request, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    /**
     * Обробляє POST-запит на "/resend" для повторної відправки верифікаційного коду. Приймає ResendVerificationDto у тілі запиту, валідований за допомогою @Valid.
     * @param dto - дані для повторної відправки верифікаційного коду (email користувача)
     * @return
     */
    @PostMapping("/resend")
    public ResponseEntity<String> resendVerificationCode(@Valid @RequestBody ResendVerificationDto dto) {
        authenticationService.resendVerificationCode(dto.getEmail());
        return ResponseEntity.ok("Verification code sent");
    }

    /**
     * Обробляє POST-запит на "/refresh" для оновлення токенів. Приймає RefreshTokenRequest у тілі запиту, валідований за допомогою @Valid.
     * @param request - дані для оновлення токенів (refresh token)
     * @param httpRequest - HTTP-запит, використовується для визначення атрибутів запиту (наприклад, secure)
     * @param response - HTTP-відповідь, використовується для встановлення куків з новими токенами
     * @return
     */
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        LoginResponse loginResponse = authenticationService.refreshTokens(request);
        writeAuthCookies(httpRequest, response, loginResponse);
        return ResponseEntity.ok(loginResponse);
    }

    /**
     * Обробляє POST-запит на "/refresh/check" для оновлення токенів з ротацією. Приймає RefreshTokenRequest у тілі запиту, валідований за допомогою @Valid.
     * @param request - дані для оновлення токенів (refresh token)
     * @param httpRequest - HTTP-запит, використовується для визначення атрибутів запиту (наприклад, secure)
     * @param response - HTTP-відповідь, використовується для встановлення куків з новими токенами, якщо ротація успішна
     * @return
     */
    @PostMapping("/refresh/check")
    public ResponseEntity<LoginResponse> refreshCheck(@Valid @RequestBody RefreshTokenRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        LoginResponse rotated = authenticationService.refreshWithRotationCheck(request);
        if (rotated != null) {
            writeAuthCookies(httpRequest, response, rotated);
            return ResponseEntity.ok(rotated);
        }
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
    }

    /**
     * Обробляє POST-запит на "/logout" для виходу користувача. Інвалідовує сесію, очищує контекст безпеки та видаляє куки з токенами.
     * @param request - HTTP-запит, використовується для отримання сесії та визначення атрибутів запиту (наприклад, secure)
     * @param response - HTTP-відповідь, використовується для видалення куків з токенами
     * @return
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);            // Отримуємо сессию, если она есть (false - не создавать новую)
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();           // Очищаем контекст безопасности, чтобы удалить аутентификацию

        clearCookie(request, response, "accessToken");
        clearCookie(request, response, "refreshToken");
        clearCookie(request, response, "JSESSIONID");
        clearCookie(request, response, "SESSION");
        return ResponseEntity.noContent().build();
    }

    /**
     * Обробляє GET-запит на "/session" для перевірки статусу аутентифікації користувача. Використовує об'єкт Authentication для визначення, чи користувач аутентифікований.
     * @param authentication - об'єкт Authentication, який містить інформацію про поточного користувача та його аутентифікацію
     * @return
     */
    @GetMapping("/session")
    public ResponseEntity<AuthSessionResponse> session(Authentication authentication) {
        boolean authenticated = authentication != null && authentication.getPrincipal() instanceof User;            // Проверяем, что объект Authentication не null и его principal является экземпляром User, что указывает на успешную аутентификацию.
        return ResponseEntity.ok(new AuthSessionResponse(authenticated));
    }

    /**
     * Допоміжний метод для очищення куків. Він встановлює заголовки "Set-Cookie" з однаковим ім'ям, але з Max-Age=0 та Expires в прошлом, щоб удалить куки на стороне клиента.
     * @param request - HTTP-запит, використовується для визначення атрибутів запиту (наприклад, secure)
     * @param response - HTTP-відповідь, використовується для встановлення заголовків для видалення куків
     * @param name - ім'я куки, яку потрібно очистити
     */
    private void clearCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        response.addHeader("Set-Cookie", buildExpiredCookie(name, false));          // Встановлюємо заголовок для видалення куки без атрибута Secure
        response.addHeader("Set-Cookie", buildExpiredCookie(name, true));           // Встановлюємо заголовок для видалення куки з атрибутом Secure, на випадок якщо кука була встановлена як Secure

        boolean secure = request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));            //Перевіряє чи запит був виконаний через HTTPS
        response.addHeader("Set-Cookie", buildExpiredCookie(name, secure));
    }

    private String buildExpiredCookie(String name, boolean secure) {
        return name + "=; HttpOnly; Path=/; Max-Age=0; Expires=Thu, 03 Oct 2004 00:00:00 GMT" + (secure ? "; Secure" : "");         // Формує строку для заголовка Set-Cookie, которая удаляет куку с указанным именем. Устанавливает Max-Age=0 и Expires в прошлом, чтобы гарантировать удаление куки на стороне клиента. Добавляет атрибут Secure, если указано.
    }

    /**
     * Допоміжний метод для встановлення куків з токенами. Він формує заголовки "Set-Cookie" для accessToken та refreshToken, використовуючи інформацію про безпеку запиту для визначення атрибута SameSite.
     * @param request - HTTP-запит, використовується для визначення атрибутів запиту (наприклад, secure)
     * @param response - HTTP-відповідь, використовується для встановлення заголовків з куками
     * @param tokens - об'єкт LoginResponse, який містить accessToken, refreshToken та їх час життя
     */
    private void writeAuthCookies(HttpServletRequest request, HttpServletResponse response, LoginResponse tokens) {
        response.addHeader("Set-Cookie", buildCookie(request, "accessToken", tokens.getAccessToken(), (int) (tokens.getExpiresIn() / 1000)));
        response.addHeader("Set-Cookie", buildCookie(request, "refreshToken", tokens.getRefreshToken(), (int) (tokens.getRefreshExpiresIn() / 1000)));
    }

    /**
     * Допоміжний метод для формування заголовка "Set-Cookie" з правильними атрибутами. Він визначає атрибут SameSite на основі безпеки запиту та наявності крос-сайт запиту, а також додає атрибут Secure, якщо запит був виконаний через HTTPS.
     * @param request - HTTP-запит, використовується для визначення атрибутів запиту (наприклад, secure)
     * @param name - ім'я куки, яку потрібно встановити
     * @param value - значення куки, яке потрібно встановити
     * @param maxAgeSeconds - час життя куки в секундах
     * @return
     */
    private String buildCookie(HttpServletRequest request, String name, String value, int maxAgeSeconds) {
        boolean secure = request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));            // Перевіряє чи запит був виконаний через HTTPS, враховуючи можливу проксі з заголовком X-Forwarded-Proto
        String sameSite = resolveSameSite(request, secure);         // Визначає атрибут SameSite на основі безпеки запиту та наявності крос-сайт запиту
        return name + "=" + value + "; HttpOnly; SameSite=" + sameSite + "; Path=/; Max-Age=" + maxAgeSeconds + (secure ? "; Secure" : "");
    }

    /**
     * Допоміжний метод для визначення атрибута SameSite. Якщо запит був виконаний через HTTPS та є крос-сайт запитом, повертає "None". В іншому випадку повертає "Lax", що забезпечує базовий захист від CSRF, дозволяючи при цьому нормальну роботу додатку.
     * @param request
     * @param secure
     * @return
     */
    private String resolveSameSite(HttpServletRequest request, boolean secure) {
        if (secure && isCrossSiteRequest(request)) {
            return "None";
        }
        return "Lax";
    }

    /**
     * Допоміжний метод для визначення, чи є запит крос-сайт запитом. Він перевіряє заголовок "Sec-Fetch-Site" на значення "cross-site", а також аналізує заголовок "Origin" для визначення, чи походить запит з іншого домену.
     * @param request
     * @return
     */
    private boolean isCrossSiteRequest(HttpServletRequest request) {
        String fetchSite = request.getHeader("Sec-Fetch-Site");
        if ("cross-site".equalsIgnoreCase(fetchSite)) {
            return true;
        }

        String origin = request.getHeader("Origin");
        if (origin == null || origin.isBlank()) {
            return false;
        }

        try {
            URI uri = URI.create(origin);
            String originHost = uri.getHost();
            return originHost != null && !originHost.equalsIgnoreCase(request.getServerName());
        } catch (Exception ignored) {
            return false;
        }
    }

}
