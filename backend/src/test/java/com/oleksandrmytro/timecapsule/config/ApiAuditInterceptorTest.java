package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.models.AdminAuditLog;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.AdminAuditLogRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ApiAuditInterceptorTest {

    @Mock
    private AdminAuditLogRepository adminAuditLogRepository;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void afterCompletionPersistsSuccessfulApiMutationForAuthenticatedUser() {
        ApiAuditInterceptor interceptor = new ApiAuditInterceptor(adminAuditLogRepository);
        User actor = user();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, "N/A"));
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/capsules/507f1f77bcf86cd799439011");
        request.setQueryString("draft=false");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(200);

        interceptor.afterCompletion(request, response, new Object(), null);

        ArgumentCaptor<AdminAuditLog> captor = ArgumentCaptor.forClass(AdminAuditLog.class);
        verify(adminAuditLogRepository).save(captor.capture());
        AdminAuditLog log = captor.getValue();
        assertEquals(actor.getId(), log.getActorId());
        assertEquals(actor.getEmail(), log.getActorEmail());
        assertEquals("API_PUT_CAPSULES", log.getAction());
        assertEquals("capsules", log.getEntityType());
        assertEquals("507f1f77bcf86cd799439011", log.getEntityId());
        assertEquals("api", log.getDetails().get("source"));
        assertEquals("PUT", log.getDetails().get("method"));
        assertEquals("/api/capsules/507f1f77bcf86cd799439011", log.getDetails().get("path"));
        assertEquals("draft=false", log.getDetails().get("query"));
        assertNotNull(log.getCreatedAt());
    }

    @Test
    void afterCompletionSkipsReadRequestsAndFailedResponses() {
        ApiAuditInterceptor interceptor = new ApiAuditInterceptor(adminAuditLogRepository);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user(), "N/A"));

        interceptor.afterCompletion(new MockHttpServletRequest("GET", "/api/capsules"), new MockHttpServletResponse(), new Object(), null);

        MockHttpServletResponse failed = new MockHttpServletResponse();
        failed.setStatus(403);
        interceptor.afterCompletion(new MockHttpServletRequest("POST", "/api/capsules"), failed, new Object(), null);

        verify(adminAuditLogRepository, never()).save(org.mockito.ArgumentMatchers.any(AdminAuditLog.class));
    }

    private User user() {
        User user = new User();
        user.setId("507f1f77bcf86cd799439099");
        user.setEmail("admin@example.com");
        user.setUsername("admin");
        user.setRole(User.Role.ADMIN);
        return user;
    }
}
