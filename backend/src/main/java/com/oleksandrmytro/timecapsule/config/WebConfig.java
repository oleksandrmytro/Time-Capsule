package com.oleksandrmytro.timecapsule.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final ApiAuditInterceptor apiAuditInterceptor;

    public WebConfig(ApiAuditInterceptor apiAuditInterceptor) {
        this.apiAuditInterceptor = apiAuditInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(apiAuditInterceptor)
                .addPathPatterns("/api/**")
                // Admin actions already have detailed manual audit in AdminService.
                .excludePathPatterns("/api/admin/**");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String uploadsRoot = Path.of(System.getProperty("user.dir"), "uploads").toAbsolutePath().toString();
        String uploadsRootLocation = "file:" + uploadsRoot + "/";
        String uploadsCoversLocation = "file:" + Path.of(uploadsRoot, "covers").toAbsolutePath() + "/";
        String tilesRootLocation = "file:" + Path.of(System.getProperty("user.dir"), "tiles3d").toAbsolutePath() + "/";
        String classpathTilesLocation = "classpath:/static/3dtiles/";

        // System tag assets bundled with backend
        registry.addResourceHandler("/static/tags/**")
                .addResourceLocations("classpath:/static/tags/");

        // Capsule covers: read from persistent uploads first, then fallback to classpath
        registry.addResourceHandler("/static/covers/**")
                .addResourceLocations(uploadsCoversLocation, "classpath:/static/covers/");

        // User uploads (chat, custom tags, capsule media, etc.) from persistent uploads only.
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadsRootLocation);

        // Apple-like path for custom 3D Tiles dataset.
        // Primary source: <project-root>/tiles3d
        // Fallback source: classpath static assets.
        registry.addResourceHandler("/3dtiles/**")
                .addResourceLocations(tilesRootLocation, classpathTilesLocation)
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic());
    }
}
