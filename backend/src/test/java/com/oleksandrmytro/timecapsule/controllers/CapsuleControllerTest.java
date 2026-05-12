package com.oleksandrmytro.timecapsule.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oleksandrmytro.timecapsule.dto.CreateCapsuleRequest;
import com.oleksandrmytro.timecapsule.dto.UpdateCapsuleRequest;
import com.oleksandrmytro.timecapsule.repositories.AdminAuditLogRepository;
import com.oleksandrmytro.timecapsule.responses.CapsuleResponse;
import com.oleksandrmytro.timecapsule.services.CapsuleService;
import com.oleksandrmytro.timecapsule.services.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CapsuleController.class)
@AutoConfigureMockMvc(addFilters = false)
class CapsuleControllerTest {

    private static final String CAPSULE_ID = "507f1f77bcf86cd799439011";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CapsuleService capsuleService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private AdminAuditLogRepository adminAuditLogRepository;

    @Test
    void getEditableReturnsOkForAuthorizedEditor() throws Exception {
        CapsuleResponse response = new CapsuleResponse();
        response.setId(CAPSULE_ID);
        response.setTitle("Editable capsule");

        given(capsuleService.getEditable(CAPSULE_ID, "user")).willReturn(response);

        mockMvc.perform(get("/api/capsules/{id}/edit", CAPSULE_ID).principal(mockAuth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(CAPSULE_ID))
                .andExpect(jsonPath("$.title").value("Editable capsule"));
    }

    @Test
    void getEditableReturnsForbiddenWhenServiceRejectsAuthorization() throws Exception {
        given(capsuleService.getEditable(CAPSULE_ID, "user"))
                .willThrow(new SecurityException("Only owner or admin can edit this capsule"));

        mockMvc.perform(get("/api/capsules/{id}/edit", CAPSULE_ID).principal(mockAuth()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    void updateReturnsOkWhenPayloadValid() throws Exception {
        CapsuleResponse response = new CapsuleResponse();
        response.setId(CAPSULE_ID);
        response.setTitle("Updated title");

        given(capsuleService.update(eq(CAPSULE_ID), eq("user"), any(UpdateCapsuleRequest.class)))
                .willReturn(response);

        mockMvc.perform(put("/api/capsules/{id}", CAPSULE_ID)
                        .principal(mockAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validUpdatePayload())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(CAPSULE_ID))
                .andExpect(jsonPath("$.title").value("Updated title"));
    }

    @Test
    void createReturnsOkForDraftWithoutUnlockDate() throws Exception {
        CapsuleResponse response = new CapsuleResponse();
        response.setId(CAPSULE_ID);
        response.setTitle("Draft capsule");
        response.setStatus("draft");

        given(capsuleService.create(eq("user"), any(CreateCapsuleRequest.class)))
                .willReturn(response);

        mockMvc.perform(post("/api/capsules")
                        .principal(mockAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validCreatePayload())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(CAPSULE_ID))
                .andExpect(jsonPath("$.status").value("draft"));
    }

    @Test
    void updateReturnsForbiddenWhenServiceRejectsAuthorization() throws Exception {
        given(capsuleService.update(eq(CAPSULE_ID), eq("user"), any(UpdateCapsuleRequest.class)))
                .willThrow(new SecurityException("Only owner or admin can edit this capsule"));

        mockMvc.perform(put("/api/capsules/{id}", CAPSULE_ID)
                        .principal(mockAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validUpdatePayload())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    void updateReturnsBadRequestWhenValidationFails() throws Exception {
        UpdateCapsuleRequest payload = validUpdatePayload();
        payload.setTitle(" ");

        mockMvc.perform(put("/api/capsules/{id}", CAPSULE_ID)
                        .principal(mockAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_error"));

        verify(capsuleService, never()).update(eq(CAPSULE_ID), eq("user"), any(UpdateCapsuleRequest.class));
    }

    private UpdateCapsuleRequest validUpdatePayload() {
        UpdateCapsuleRequest request = new UpdateCapsuleRequest();
        request.setTitle("Updated title");
        request.setBody("Updated body");
        request.setVisibility("private");
        request.setStatus("sealed");
        request.setUnlockAt(Instant.now().plusSeconds(7200));
        request.setExpiresAt(Instant.now().plusSeconds(10_800));
        request.setAllowComments(false);
        request.setAllowReactions(false);
        request.setTags(java.util.List.of("travel", "future"));
        request.setCoverImageUrl("/uploads/covers/new-cover.jpg");
        request.setMedia(java.util.List.of());
        return request;
    }

    private CreateCapsuleRequest validCreatePayload() {
        CreateCapsuleRequest request = new CreateCapsuleRequest();
        request.setTitle("Draft capsule");
        request.setBody("Draft body");
        request.setVisibility("shared");
        request.setAllowComments(true);
        request.setAllowReactions(true);
        request.setTags(java.util.List.of("draft", "future"));
        request.setMedia(java.util.List.of());
        return request;
    }

    private UsernamePasswordAuthenticationToken mockAuth() {
        return new UsernamePasswordAuthenticationToken("user", "N/A");
    }
}
