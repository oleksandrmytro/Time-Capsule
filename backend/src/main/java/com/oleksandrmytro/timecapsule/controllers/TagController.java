package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.models.Tag;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.services.TagService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @GetMapping
    public ResponseEntity<List<Tag>> listAll(Authentication auth) {
        String userId = null;
        if (auth != null && auth.getPrincipal() instanceof User u) {
            userId = u.getId();
        }

        if (userId != null) {
            return ResponseEntity.ok(tagService.listForUser(userId));
        } else {
            return ResponseEntity.ok(tagService.listSystem());
        }
    }

    @GetMapping("/search")
    public ResponseEntity<List<Tag>> search(@RequestParam(name = "q", defaultValue = "") String query,
                                            Authentication auth) {
        String userId = null;
        if (auth != null && auth.getPrincipal() instanceof User u) {
            userId = u.getId();
        }
        return ResponseEntity.ok(tagService.searchForUser(userId, query));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Tag> create(@RequestParam("name") String name,
                                      @RequestParam(value = "image", required = false) MultipartFile image,
                                      Authentication auth) throws IOException {
        String userId = currentUserId(auth);
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Tag name is required");
        }
        String imageUrl = saveImage(image);
        return ResponseEntity.ok(tagService.create(name, imageUrl, userId));
    }

    private String currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof User u)) {
            throw new IllegalArgumentException("Unauthorized");
        }
        return u.getId();
    }

    /**
     * Зберігає завантажений файл у uploads/tags/ (зовнішня папка),
     * яку віддає resource handler /uploads/**.
     */
    private String saveImage(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) return null;

        String ext = ".jpg";
        String original = file.getOriginalFilename();
        if (original != null && original.contains(".")) {
            ext = original.substring(original.lastIndexOf('.'));
        }
        String filename = UUID.randomUUID() + ext;

        // uploads/tags is served by WebConfig (file:${user.dir}/uploads/)
        Path dir = Path.of(System.getProperty("user.dir"), "uploads", "tags");
        Files.createDirectories(dir);

        Path target = dir.resolve(filename);
        file.getInputStream().transferTo(Files.newOutputStream(target));

        return "/uploads/tags/" + filename;
    }
}
