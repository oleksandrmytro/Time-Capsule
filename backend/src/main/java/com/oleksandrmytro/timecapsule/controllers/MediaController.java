package com.oleksandrmytro.timecapsule.controllers;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Ендпоінт для завантаження обкладинки капсули.
 * POST /api/media/cover — зберігає файл у uploads/covers/ і повертає URL.
 */
@RestController
@RequestMapping("/api/media")
public class MediaController {

    private static final long COVER_MAX_SIZE = 10L * 1024 * 1024; // 10 MB
    private static final long CHAT_MEDIA_MAX_SIZE = 50L * 1024 * 1024; // 50 MB

    private static final Set<String> ALLOWED_COVER_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp"
    );
    private static final Set<String> ALLOWED_CHAT_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp"
    );
    private static final Set<String> ALLOWED_CHAT_VIDEO_TYPES = Set.of(
            "video/mp4", "video/webm", "video/quicktime"
    );

    @PostMapping(value = "/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadCover(
            @RequestParam("file") MultipartFile file) throws IOException {

        String contentType = normalizeContentType(file);
        if (contentType == null || !ALLOWED_COVER_TYPES.contains(contentType)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only JPEG, PNG, GIF, WebP allowed"));
        }
        if (file.getSize() > COVER_MAX_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "File too large (max 10MB)"));
        }

        String ext = extensionFrom(contentType, ".jpg");
        String filename = UUID.randomUUID() + ext;

        Path dir = Path.of(System.getProperty("user.dir"), "uploads", "covers");
        Files.createDirectories(dir);
        Path target = dir.resolve(filename);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target);
        }

        String url = "/static/covers/" + filename;
        return ResponseEntity.ok(Map.of("url", url));
    }

    @PostMapping(value = "/chat-attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadChatAttachment(
            @RequestParam("file") MultipartFile file) throws IOException {

        String contentType = normalizeContentType(file);
        if (contentType == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is required"));
        }
        if (file.getSize() > CHAT_MEDIA_MAX_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "File too large (max 50MB)"));
        }

        String kind;
        if (ALLOWED_CHAT_IMAGE_TYPES.contains(contentType)) {
            kind = "image";
        } else if (ALLOWED_CHAT_VIDEO_TYPES.contains(contentType)) {
            kind = "video";
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Only image/video files are allowed"));
        }

        String ext = extensionFrom(contentType, kind.equals("video") ? ".mp4" : ".jpg");
        String filename = UUID.randomUUID() + ext;

        Path dir = Path.of(System.getProperty("user.dir"), "uploads", "chat");
        Files.createDirectories(dir);
        Path target = dir.resolve(filename);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target);
        }

        return ResponseEntity.ok(Map.of(
                "url", "/uploads/chat/" + filename,
                "mediaKind", kind,
                "mimeType", contentType
        ));
    }

    private String normalizeContentType(MultipartFile file) {
        if (file == null || file.isEmpty()) return null;
        String contentType = file.getContentType();
        return contentType == null ? null : contentType.toLowerCase();
    }

    private String extensionFrom(String contentType, String fallback) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "video/mp4" -> ".mp4";
            case "video/webm" -> ".webm";
            case "video/quicktime" -> ".mov";
            default -> fallback;
        };
    }
}
