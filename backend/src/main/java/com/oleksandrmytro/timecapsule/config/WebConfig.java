package com.oleksandrmytro.timecapsule.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String uploadsRoot = Path.of(System.getProperty("user.dir"), "uploads").toAbsolutePath().toString();
        String uploadsRootLocation = "file:" + uploadsRoot + "/";
        String uploadsCoversLocation = "file:" + Path.of(uploadsRoot, "covers").toAbsolutePath() + "/";
        String classpathUploadsLocation = "classpath:/static/uploads/";

        // System tag assets bundled with backend
        registry.addResourceHandler("/static/tags/**")
                .addResourceLocations("classpath:/static/tags/");

        // Capsule covers: read from persistent uploads first, then fallback to classpath
        registry.addResourceHandler("/static/covers/**")
                .addResourceLocations(uploadsCoversLocation, "classpath:/static/covers/");

        // User uploads (chat, custom tags, capsule media, etc.)
        // Fallback to classpath allows bundling demo assets in src/main/resources/static/uploads
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadsRootLocation, classpathUploadsLocation);
    }
}
