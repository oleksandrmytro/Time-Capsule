package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.CreateCapsuleRequest;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.responses.CapsuleResponse;
import org.bson.types.ObjectId;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CapsuleService {

    private final CapsuleRepository capsuleRepository;

    public CapsuleService(CapsuleRepository capsuleRepository) {
        this.capsuleRepository = capsuleRepository;
    }

    public CapsuleResponse create(String ownerId, CreateCapsuleRequest request) {
        // Validate business rules
        validateCapsuleRequest(request);

        Capsule capsule = new Capsule();
        capsule.setOwnerId(new ObjectId(ownerId));
        capsule.setTitle(request.getTitle());
        capsule.setBody(request.getBody());
        capsule.setVisibility(request.getVisibility());
        capsule.setStatus(request.getStatus());
        capsule.setUnlockAt(request.getUnlockAt());
        capsule.setExpiresAt(request.getExpiresAt());
        capsule.setAllowComments(request.getAllowComments() != null ? request.getAllowComments() : true);
        capsule.setAllowReactions(request.getAllowReactions() != null ? request.getAllowReactions() : true);
        capsule.setTags(request.getTags());
        capsule.setMedia(mapMediaRequest(request.getMedia()));

        // Only set location if provided
        if (request.getLocation() != null) {
            capsule.setLocation(mapGeo(request.getLocation()));
        }

        // Generate shareToken for shared capsules
        if ("shared".equals(request.getVisibility())) {
            capsule.setShareToken(generateShareToken());
        }

        capsule.setCreatedAt(Instant.now());
        capsule.setUpdatedAt(Instant.now());

        Capsule saved = capsuleRepository.save(capsule);
        return toResponse(saved);
    }

    private void validateCapsuleRequest(CreateCapsuleRequest request) {
        // Validate unlockAt is in the future for sealed capsules
        if ("sealed".equals(request.getStatus())) {
            if (request.getUnlockAt() == null) {
                throw new IllegalArgumentException("Unlock date is required for sealed capsules");
            }
            if (request.getUnlockAt().isBefore(Instant.now())) {
                throw new IllegalArgumentException("Unlock date must be in the future for sealed capsules");
            }
        }

        // Validate expiresAt is after unlockAt if both provided
        if (request.getExpiresAt() != null && request.getUnlockAt() != null) {
            if (request.getExpiresAt().isBefore(request.getUnlockAt())) {
                throw new IllegalArgumentException("Expiration date must be after unlock date");
            }
        }
    }

    private String generateShareToken() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    public List<CapsuleResponse> listMine(String ownerId) {
        ObjectId owner = new ObjectId(ownerId);
        return capsuleRepository.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public CapsuleResponse getMine(String id, String ownerId) {
        ObjectId owner = new ObjectId(ownerId);
        Capsule capsule = capsuleRepository.findByIdAndOwnerIdAndDeletedAtIsNull(id, owner)
                .orElseThrow(() -> new IllegalArgumentException("Capsule not found"));
        return toResponse(capsule);
    }

    private CapsuleResponse toResponse(Capsule capsule) {
        CapsuleResponse resp = new CapsuleResponse();
        resp.setId(capsule.getId());
        resp.setOwnerId(capsule.getOwnerId() != null ? capsule.getOwnerId().toHexString() : null);
        resp.setTitle(capsule.getTitle());
        resp.setBody(capsule.getBody());
        resp.setVisibility(capsule.getVisibility());
        resp.setStatus(capsule.getStatus());
        resp.setUnlockAt(capsule.getUnlockAt());
        resp.setOpenedAt(capsule.getOpenedAt());
        resp.setExpiresAt(capsule.getExpiresAt());
        resp.setAllowComments(capsule.getAllowComments());
        resp.setAllowReactions(capsule.getAllowReactions());
        resp.setShareToken(capsule.getShareToken());
        resp.setTags(capsule.getTags());
        resp.setLocation(mapGeo(capsule.getLocation()));
        resp.setMedia(mapMediaResponse(capsule.getMedia()));
        resp.setCreatedAt(capsule.getCreatedAt());
        resp.setUpdatedAt(capsule.getUpdatedAt());
        return resp;
    }

    private List<CapsuleResponse.Media> mapMediaResponse(List<Capsule.Media> media) {
        if (media == null) return null;
        return media.stream().map(m -> {
            CapsuleResponse.Media rm = new CapsuleResponse.Media();
            rm.setUrl(m.getUrl());
            rm.setType(m.getType());
            rm.setMeta(m.getMeta());
            return rm;
        }).collect(Collectors.toList());
    }

    private List<Capsule.Media> mapMediaRequest(List<CreateCapsuleRequest.MediaDto> media) {
        if (media == null) return null;
        return media.stream().map(m -> {
            Capsule.Media cm = new Capsule.Media();
            cm.setUrl(m.getUrl());
            cm.setType(m.getType());
            cm.setMeta(m.getMeta());
            return cm;
        }).collect(Collectors.toList());
    }

    private CapsuleResponse.GeoPoint mapGeo(Capsule.GeoPoint geo) {
        if (geo == null) return null;
        CapsuleResponse.GeoPoint g = new CapsuleResponse.GeoPoint();
        g.setType(geo.getType());
        g.setCoordinates(geo.getCoordinates());
        return g;
    }

    private Capsule.GeoPoint mapGeo(CreateCapsuleRequest.GeoPointDto geo) {
        if (geo == null) return null;
        Capsule.GeoPoint g = new Capsule.GeoPoint();
        g.setType(geo.getType());
        g.setCoordinates(geo.getCoordinates());
        return g;
    }
}
