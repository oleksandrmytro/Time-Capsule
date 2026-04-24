package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.repositories.AdminAuditLogRepository;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import com.oleksandrmytro.timecapsule.services.AuthenticationService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthenticationController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthenticationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthenticationService authenticationService;

    @MockBean
    private com.oleksandrmytro.timecapsule.services.JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private AdminAuditLogRepository adminAuditLogRepository;

    @Test
    void refreshReturnsOk() throws Exception {
        given(authenticationService.refreshTokens(eq("dummy"))).willReturn(new LoginResponse("access", 1000, "refresh", 2000));

        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refreshToken", "dummy")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.expiresIn").value(1000))
                .andExpect(jsonPath("$.refreshExpiresIn").value(2000));
    }

    @Test
    void refreshCheckReturns304WhenNoRotation() throws Exception {
        given(authenticationService.refreshWithRotationCheck(eq("dummy"))).willReturn(null);

        mockMvc.perform(post("/api/auth/refresh/check").cookie(new Cookie("refreshToken", "dummy")))
                .andExpect(status().isNotModified());
    }
}
