package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.models.Tag;
import com.oleksandrmytro.timecapsule.repositories.TagRepository;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class TagService implements CommandLineRunner {
    private static final String STATIC_TAGS_PREFIX = "/static/tags/";
    private static final String UPLOADS_PREFIX = "/uploads/";
    private static final String[][] DEFAULT_TAG_SPECS = {
            {"Travel",      "/static/tags/travel.jpg"},
            {"Birthday",    "/static/tags/birthday.jpg"},
            {"Wedding",     "/static/tags/wedding.jpg"},
            {"Graduation",  "/static/tags/graduation.jpg"},
            {"Family",      "/static/tags/family.jpg"},
            {"Friends",     "/static/tags/friends.jpg"},
            {"Love",        "/static/tags/love.jpg"},
            {"Memory",      "/static/tags/memory.jpg"},
            {"Achievement", "/static/tags/achievement.jpg"},
            {"Holiday",     "/static/tags/holiday.jpg"},
            {"Music",       "/static/tags/music.jpg"},
            {"Nature",      "/static/tags/nature.jpg"},
            {"Food",        "/static/tags/food.jpg"},
            {"Sport",       "/static/tags/sport.jpg"},
            {"Art",         "/static/tags/art.jpg"},
            {"Pet",         "/static/tags/pet.jpg"},
    };

    // emoji for each default tag — rendered in SVG fallback
    private static final Map<String, String> TAG_EMOJI = Map.ofEntries(
        Map.entry("travel",      "✈️"),
        Map.entry("birthday",    ""),
        Map.entry("wedding",     ""),
        Map.entry("graduation",  ""),
        Map.entry("family",      "‍‍‍"),
        Map.entry("friends",     ""),
        Map.entry("love",        "❤️"),
        Map.entry("memory",      ""),
        Map.entry("achievement", ""),
        Map.entry("holiday",     ""),
        Map.entry("music",       ""),
        Map.entry("nature",      ""),
        Map.entry("food",        "️"),
        Map.entry("sport",       "⚽"),
        Map.entry("art",         ""),
        Map.entry("pet",         "")
    );

    private static final Map<String, String> TAG_COLOR = Map.ofEntries(
        Map.entry("travel",      "#3B82F6"),
        Map.entry("birthday",    "#EC4899"),
        Map.entry("wedding",     "#A855F7"),
        Map.entry("graduation",  "#8B5CF6"),
        Map.entry("family",      "#F97316"),
        Map.entry("friends",     "#22C55E"),
        Map.entry("love",        "#EF4444"),
        Map.entry("memory",      "#6366F1"),
        Map.entry("achievement", "#EAB308"),
        Map.entry("holiday",     "#F43F5E"),
        Map.entry("music",       "#06B6D4"),
        Map.entry("nature",      "#16A34A"),
        Map.entry("food",        "#EA580C"),
        Map.entry("sport",       "#0EA5E9"),
        Map.entry("art",         "#D946EF"),
        Map.entry("pet",         "#78716C")
    );

    private final TagRepository tagRepository;
    private final MongoTemplate mongoTemplate;

    public TagService(TagRepository tagRepository, MongoTemplate mongoTemplate) {
        this.tagRepository = tagRepository;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(String... args) {
        ensureTagImages();
        normalizeLegacySystemFlag();
        seedDefaultTags();
        normalizeCreatedByType();
        fixExistingPlaceholders();
    }

    private void normalizeLegacySystemFlag() {
        Query legacySystemTrue = new Query(Criteria.where("system").is(true));
        mongoTemplate.updateMulti(legacySystemTrue, new Update().set("isSystem", true), "tags");
    }

    private void normalizeCreatedByType() {
        Query query = new Query(Criteria.where("createdBy").type(2)); // string
        List<Document> invalidDocs = mongoTemplate.find(query, Document.class, "tags");
        for (Document doc : invalidDocs) {
            Object id = doc.get("_id");
            Object createdBy = doc.get("createdBy");
            if (id == null || createdBy == null) continue;
            String createdByValue = String.valueOf(createdBy);

            Query byId = new Query(Criteria.where("_id").is(id));
            if (ObjectId.isValid(createdByValue)) {
                mongoTemplate.updateFirst(byId, new Update().set("createdBy", new ObjectId(createdByValue)), "tags");
            } else {
                mongoTemplate.updateFirst(byId, new Update().unset("createdBy"), "tags");
            }
        }
    }

    /**
     * Якщо jpg-файл тегу відсутній у classpath static/tags/ —
     * генеруємо SVG-заглушку і кладемо її на місце jpg.
     * Це спрацьовує автоматично при кожному старті без ручних дій.
     */
    private void ensureTagImages() {
        String[] names = {"travel","birthday","wedding","graduation","family","friends",
                          "love","memory","achievement","holiday","music","nature",
                          "food","sport","art","pet"};
        Path staticDir = resolveStaticTagsDir();
        if (staticDir == null) return;

        for (String name : names) {
            Path jpg = staticDir.resolve(name + ".jpg");
            if (!Files.exists(jpg)) {
                // Перевіримо чи є svg-файл з таким самим іменем у ресурсах
                try {
                    ClassPathResource res = new ClassPathResource("static/tags/" + name + ".jpg");
                    if (res.exists()) {
                        try (InputStream in = res.getInputStream()) {
                            Files.copy(in, jpg, StandardCopyOption.REPLACE_EXISTING);
                        }
                    } else {
                        // Генеруємо SVG і зберігаємо як .jpg (браузер відкриє SVG нормально)
                        String svg = buildSvg(name);
                        Files.writeString(jpg, svg, StandardCharsets.UTF_8);
                    }
                } catch (IOException e) {
                    // ignore — не критично
                }
            }
        }
    }

    /** Знаходить реальну папку static/tags на диску (через ClassPathResource). */
    private Path resolveStaticTagsDir() {
        try {
            ClassPathResource res = new ClassPathResource("static/tags/");
            if (res.exists()) {
                return Path.of(res.getURI());
            }
            // Якщо папки немає — створюємо поруч з classes
            ClassPathResource base = new ClassPathResource(".");
            Path dir = Path.of(base.getURI()).resolve("static/tags");
            Files.createDirectories(dir);
            return dir;
        } catch (IOException e) {
            return null;
        }
    }

    private String buildSvg(String name) {
        String key = name.toLowerCase();
        String emoji = TAG_EMOJI.getOrDefault(key, "️");
        String color = TAG_COLOR.getOrDefault(key, "#6366F1");
        String label = name.substring(0, 1).toUpperCase() + name.substring(1);
        return """
                <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%%" stop-color="%s" stop-opacity="0.85"/>
                      <stop offset="100%%" stop-color="%s" stop-opacity="0.55"/>
                    </linearGradient>
                  </defs>
                  <rect width="400" height="300" fill="url(#g)" rx="16"/>
                  <text x="200" y="140" font-size="72" text-anchor="middle" dominant-baseline="middle">%s</text>
                  <text x="200" y="210" font-size="28" font-family="system-ui,sans-serif" font-weight="600"
                        text-anchor="middle" fill="white" opacity="0.95">%s</text>
                </svg>
                """.formatted(color, color, emoji, label);
    }

    private void seedDefaultTags() {
        for (String[] d : DEFAULT_TAG_SPECS) {
            Tag existing = tagRepository.findByNameIgnoreCase(d[0]).orElse(null);
            String url = d[1];
            if (existing != null) {
                String normalizedImage = normalizeTagImageUrl(existing.getImageUrl(), true);
                if (normalizedImage == null) {
                    normalizedImage = url;
                }
                mongoTemplate.updateFirst(
                        new Query(Criteria.where("_id").is(existing.getId())),
                        new Update()
                                .set("imageUrl", normalizedImage)
                                .set("isSystem", true),
                        Tag.class
                );
                continue;
            }
            Tag tag = new Tag(d[0], url, true);
            tagRepository.insert(tag);
        }
    }

    private void fixExistingPlaceholders() {
        tagRepository.findAll().forEach(tag -> {
            String current = tag.getImageUrl();
            if (tag.isSystem()) {
                String fallback = staticFallbackFor(tag);
                if (!fallback.equals(current) || isExternal(current)) {
                    mongoTemplate.updateFirst(
                            new Query(Criteria.where("name").is(tag.getName())),
                            new Update()
                                    .set("imageUrl", fallback)
                                    .set("isSystem", true),
                            Tag.class
                    );
                }
                return;
            }

            String normalized = normalizeTagImageUrl(current, false);
            boolean invalidCustomPath =
                    normalized == null
                            || (!normalized.startsWith(UPLOADS_PREFIX) && !normalized.startsWith(STATIC_TAGS_PREFIX));
            boolean missingCustomAsset =
                    !invalidCustomPath
                            && ((normalized.startsWith(UPLOADS_PREFIX) && isMissingUploadAsset(normalized))
                            || (normalized.startsWith(STATIC_TAGS_PREFIX) && isMissingStaticTagAsset(normalized)));

            if (invalidCustomPath) {
                if (current == null) return;
                mongoTemplate.updateFirst(
                        new Query(Criteria.where("name").is(tag.getName())),
                        new Update().unset("imageUrl"),
                        Tag.class
                );
                return;
            }

            // Do not erase stored URL when file is temporarily unavailable (e.g. startup race, volume remount).
            if (missingCustomAsset) {
                return;
            }

            if (!normalized.equals(current)) {
                mongoTemplate.updateFirst(
                        new Query(Criteria.where("name").is(tag.getName())),
                        new Update().set("imageUrl", normalized),
                        Tag.class
                );
            }
        });
    }

    private String staticFallbackFor(Tag tag) {
        String safeName = tag.getName() == null ? "default" : tag.getName().trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "-");
        return STATIC_TAGS_PREFIX + safeName + ".jpg";
    }

    private boolean hasFileExtension(String value) {
        int lastDot = value.lastIndexOf('.');
        return lastDot > 0 && lastDot < value.length() - 1;
    }

    private String normalizeTagImageUrl(String rawUrl, boolean isSystem) {
        if (rawUrl == null) return null;
        String value = rawUrl.trim();
        if (value.isBlank()) return null;

        value = value.replace('\\', '/');
        if (isExternal(value)) return null;

        if (value.startsWith(STATIC_TAGS_PREFIX)) return value;
        if (value.startsWith("static/tags/")) return "/" + value;
        if (value.startsWith(UPLOADS_PREFIX)) return value;
        if (value.startsWith("uploads/")) return "/" + value;
        if (value.startsWith("/static/uploads/")) return "/" + value.substring("/static/".length());
        if (value.startsWith("static/uploads/")) return "/" + value.substring("static/".length());
        if (value.startsWith("/tags/")) return isSystem ? "/static" + value : UPLOADS_PREFIX + value.substring(1);
        if (value.startsWith("tags/")) return isSystem ? "/static/" + value : UPLOADS_PREFIX + value;
        if (!value.contains("/") && hasFileExtension(value)) {
            return isSystem ? STATIC_TAGS_PREFIX + value : UPLOADS_PREFIX + "tags/" + value;
        }
        return value.startsWith("/") ? value : "/" + value;
    }

    private void sanitizeTagForResponse(Tag tag) {
        if (tag == null) return;
        if (tag.isSystem()) {
            tag.setImageUrl(staticFallbackFor(tag));
            return;
        }

        String normalized = normalizeTagImageUrl(tag.getImageUrl(), false);
        if (normalized == null
                || (!normalized.startsWith(UPLOADS_PREFIX) && !normalized.startsWith(STATIC_TAGS_PREFIX))
                || (normalized.startsWith(UPLOADS_PREFIX) && isMissingUploadAsset(normalized))
                || (normalized.startsWith(STATIC_TAGS_PREFIX) && isMissingStaticTagAsset(normalized))) {
            tag.setImageUrl(null);
            return;
        }
        tag.setImageUrl(normalized);
    }

    private boolean isExternal(String url) {
        if (url == null) return true;
        String lower = url.toLowerCase();
        return lower.startsWith("http://") || lower.startsWith("https://")
                || lower.contains("placeholder.com") || lower.contains("unsplash.com");
    }

    private boolean isStaticTagImage(String url) {
        return url != null && (url.startsWith(STATIC_TAGS_PREFIX) || url.startsWith("static/tags/"));
    }

    private boolean isMissingStaticTagAsset(String url) {
        if (url == null) return false;
        String normalized = url.trim().replace('\\', '/');
        if (normalized.startsWith("static/tags/")) {
            normalized = "/" + normalized;
        }
        if (!normalized.startsWith(STATIC_TAGS_PREFIX)) return false;

        String relative = normalized.substring(STATIC_TAGS_PREFIX.length());
        int queryIndex = relative.indexOf('?');
        if (queryIndex >= 0) {
            relative = relative.substring(0, queryIndex);
        }
        int hashIndex = relative.indexOf('#');
        if (hashIndex >= 0) {
            relative = relative.substring(0, hashIndex);
        }

        try {
            relative = URLDecoder.decode(relative, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            return true;
        }

        ClassPathResource classpathAsset = new ClassPathResource("static/tags/" + relative);
        if (classpathAsset.exists()) {
            return false;
        }

        Path projectStatic = Path.of(System.getProperty("user.dir"), "src", "main", "resources", "static", "tags", relative)
                .toAbsolutePath()
                .normalize();
        if (Files.exists(projectStatic)) {
            return false;
        }

        Path compiledStatic = Path.of(System.getProperty("user.dir"), "target", "classes", "static", "tags", relative)
                .toAbsolutePath()
                .normalize();
        return !Files.exists(compiledStatic);
    }

    private boolean isMissingUploadAsset(String url) {
        if (url == null) return false;
        String normalized = url.trim().replace('\\', '/');
        if (normalized.startsWith("uploads/")) {
            normalized = "/" + normalized;
        }
        if (!normalized.startsWith(UPLOADS_PREFIX)) return false;

        String relative = normalized.substring(UPLOADS_PREFIX.length());
        int queryIndex = relative.indexOf('?');
        if (queryIndex >= 0) {
            relative = relative.substring(0, queryIndex);
        }
        int hashIndex = relative.indexOf('#');
        if (hashIndex >= 0) {
            relative = relative.substring(0, hashIndex);
        }

        try {
            relative = URLDecoder.decode(relative, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            return true;
        }

        Path uploadsRoot = Path.of(System.getProperty("user.dir"), "uploads").toAbsolutePath().normalize();
        Path absolute = uploadsRoot.resolve(relative).normalize();
        if (absolute.startsWith(uploadsRoot) && Files.exists(absolute)) {
            return false;
        }
        return true;
    }

    private List<Tag> sanitizeAndFilterVisible(List<Tag> tags, String userId) {
        List<Tag> visible = new ArrayList<>();
        boolean hasUser = userId != null && ObjectId.isValid(userId);
        for (Tag tag : tags) {
            if (tag == null) continue;
            boolean isOwn = hasUser && tag.getCreatedBy() != null && userId.equals(tag.getCreatedBy().toHexString());
            if (!tag.isSystem() && !isOwn) continue;

            sanitizeTagForResponse(tag);
            visible.add(tag);
        }
        return visible;
    }

    private String colorForName(String name) { return ""; } // unused
    private String svgPlaceholder(String text, String color) { return ""; } // unused

    private void appendMissingDefaultSystemTags(List<Tag> tags) {
        if (tags == null) return;
        Set<String> existing = new HashSet<>(tags.stream()
                .map(Tag::getName)
                .filter(name -> name != null && !name.isBlank())
                .map(name -> name.trim().toLowerCase(Locale.ROOT))
                .toList());
        for (String[] spec : DEFAULT_TAG_SPECS) {
            String name = spec[0];
            String key = name.toLowerCase(Locale.ROOT);
            if (existing.contains(key)) continue;

            Tag fallback = new Tag();
            fallback.setId("fallback-" + key);
            fallback.setName(name);
            fallback.setSystem(true);
            fallback.setImageUrl(spec[1]);
            tags.add(fallback);
            existing.add(key);
        }
    }

    public List<Tag> listAll() {
        List<Tag> tags = tagRepository.findAll();
        tags.forEach(this::sanitizeTagForResponse);
        return tags;
    }

    public List<Tag> listForUser(String userId) {
        if (userId == null || !ObjectId.isValid(userId)) {
            return listSystem();
        }
        List<Tag> visible = sanitizeAndFilterVisible(tagRepository.findByIsSystemTrueOrCreatedBy(new ObjectId(userId)), userId);
        appendMissingDefaultSystemTags(visible);
        return visible;
    }

    public List<Tag> listSystem() {
        List<Tag> visible = sanitizeAndFilterVisible(tagRepository.findByIsSystemTrue(), null);
        appendMissingDefaultSystemTags(visible);
        return visible;
    }

    public List<Tag> search(String query) {
        return searchForUser(null, query);
    }

    public List<Tag> searchForUser(String userId, String query) {
        String q = query == null ? "" : query.trim().toLowerCase();
        List<Tag> visible = listForUser(userId);
        if (q.isBlank()) return visible;

        List<Tag> filtered = new ArrayList<>();
        for (Tag tag : visible) {
            if (tag.getName() != null && tag.getName().toLowerCase().contains(q)) {
                filtered.add(tag);
            }
        }
        return filtered;
    }

    public Tag create(String name, String imageUrl, String createdBy) {
        if (tagRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("Tag '" + name + "' already exists");
        }
        if (createdBy == null || !ObjectId.isValid(createdBy)) {
            throw new IllegalArgumentException("Invalid tag creator id");
        }
        Tag tag = new Tag();
        tag.setName(name.trim());
        tag.setImageUrl(normalizeTagImageUrl(imageUrl, false));
        tag.setSystem(false);
        tag.setCreatedBy(new ObjectId(createdBy));
        return tagRepository.save(tag);
    }

    public Tag getById(String id) {
        return tagRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tag not found"));
    }

    public void delete(String id) {
        tagRepository.deleteById(id);
    }

    public long count() {
        return tagRepository.count();
    }
}
