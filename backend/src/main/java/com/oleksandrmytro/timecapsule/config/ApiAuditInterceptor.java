package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.models.AdminAuditLog;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.AdminAuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
public class ApiAuditInterceptor implements HandlerInterceptor {

    private static final Set<String> MUTATION_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private final AdminAuditLogRepository adminAuditLogRepository;

    public ApiAuditInterceptor(AdminAuditLogRepository adminAuditLogRepository) {
        this.adminAuditLogRepository = adminAuditLogRepository;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        String method = request.getMethod();
        if (!MUTATION_METHODS.contains(method)) {
            return;
        }

        String path = request.getRequestURI();
        if (path == null || !path.startsWith("/api/")) {
            return;
        }

        if (response.getStatus() >= 400) {
            return;
        }

        User actor = resolveActor();
        if (actor == null) {
            return;
        }

        String[] segments = path.split("/");
        String entityType = segments.length > 2 ? segments[2] : "api";
        String entityId = segments.length > 3 ? segments[3] : null;

        var details = new LinkedHashMap<String, Object>();
        details.put("source", "api");
        details.put("method", method);
        details.put("path", path);
        details.put("status", response.getStatus());
        String query = request.getQueryString();
        if (query != null && !query.isBlank()) {
            details.put("query", query);
        }

        try {
            AdminAuditLog log = new AdminAuditLog();
            log.setActorId(actor.getId());
            log.setActorEmail(actor.getEmail());
            log.setActorRole(actor.getRoleDb());
            log.setAction("API_" + method + "_" + entityType.toUpperCase(Locale.ROOT));
            log.setEntityType(entityType);
            log.setEntityId(entityId);
            log.setDetails(details);
            log.setCreatedAt(Instant.now());
            adminAuditLogRepository.save(log);
        } catch (Exception ignored) {
            // Audit must never break request processing.
        }
    }

    private User resolveActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof User user) {
            return user;
        }
        return null;
    }

}
