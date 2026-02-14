package com.oleksandrmytro.timecapsule.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oleksandrmytro.timecapsule.dto.RefreshTokenRequest;
import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import com.oleksandrmytro.timecapsule.services.AuthenticationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void refreshReturnsOk() throws Exception {
        given(authenticationService.refreshTokens(any())).willReturn(new LoginResponse("access", 1000, "refresh", 2000));

        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken("dummy");

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    void refreshCheckReturns304WhenNoRotation() throws Exception {
        given(authenticationService.refreshWithRotationCheck(any())).willReturn(null);

        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken("dummy");

        mockMvc.perform(post("/api/auth/refresh/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNotModified());
    }
}
