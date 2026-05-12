package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.dto.CreateCapsuleRequest;
import com.oleksandrmytro.timecapsule.dto.UpdateCapsuleRequest;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.repositories.FollowRepository;
import com.oleksandrmytro.timecapsule.repositories.ShareRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.responses.CapsuleResponse;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CapsuleServiceUpdateTest {

    private static final String CAPSULE_ID = "507f1f77bcf86cd799439011";
    private static final String OWNER_ID = "507f1f77bcf86cd799439012";
    private static final String OTHER_USER_ID = "507f1f77bcf86cd799439013";
    private static final String ADMIN_ID = "507f1f77bcf86cd799439014";

    @Mock
    private CapsuleRepository capsuleRepository;

    @Mock
    private MongoTemplate mongoTemplate;

    @Mock
    private CapsuleNotificationService capsuleNotificationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FollowRepository followRepository;

    @Mock
    private ShareRepository shareRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ChatService chatService;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private CapsuleService capsuleService;

    @Test
    void ownerCanUpdateOwnCapsule() {
        Capsule capsule = capsule(OWNER_ID, "draft");
        User owner = user(OWNER_ID, User.Role.REGULAR);
        UpdateCapsuleRequest request = validRequest();
        request.setVisibility("private");
        request.setAllowComments(true);
        request.setAllowReactions(true);

        given(userRepository.findById(OWNER_ID)).willReturn(Optional.of(owner));
        given(capsuleRepository.findByIdAndDeletedAtIsNull(CAPSULE_ID)).willReturn(Optional.of(capsule));
        given(mongoTemplate.findOne(any(Query.class), eq(Capsule.class))).willAnswer(invocation -> capsule);

        CapsuleResponse response = capsuleService.update(CAPSULE_ID, OWNER_ID, request);

        assertEquals("Updated title", response.getTitle());
        assertEquals("private", response.getVisibility());
        assertFalse(Boolean.TRUE.equals(response.getAllowComments()));
        assertFalse(Boolean.TRUE.equals(response.getAllowReactions()));
        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Capsule.class));
    }

    @Test
    void createDefaultsToDraftWithoutUnlockDate() {
        CreateCapsuleRequest request = new CreateCapsuleRequest();
        request.setTitle("Fresh draft");
        request.setBody("Draft body");
        request.setVisibility("shared");
        request.setAllowComments(true);
        request.setAllowReactions(true);
        request.setTags(List.of("draft"));

        given(capsuleRepository.save(any(Capsule.class))).willAnswer(invocation -> {
            Capsule capsule = invocation.getArgument(0);
            capsule.setId(CAPSULE_ID);
            return capsule;
        });

        CapsuleResponse response = capsuleService.create(OWNER_ID, request);

        assertEquals("draft", response.getStatus());
        assertNull(response.getUnlockAt());
        assertNull(response.getExpiresAt());
        assertNull(response.getShareToken());
        assertFalse(Boolean.TRUE.equals(response.getAllowComments()));
        assertFalse(Boolean.TRUE.equals(response.getAllowReactions()));
    }

    @Test
    void ownerCanUpdateDraftWithoutUnlockDate() {
        Capsule capsule = capsule(OWNER_ID, "sealed");
        User owner = user(OWNER_ID, User.Role.REGULAR);
        UpdateCapsuleRequest request = validRequest();
        request.setStatus("draft");
        request.setVisibility("public");
        request.setUnlockAt(null);
        request.setExpiresAt(null);
        request.setAllowComments(true);
        request.setAllowReactions(true);

        given(userRepository.findById(OWNER_ID)).willReturn(Optional.of(owner));
        given(capsuleRepository.findByIdAndDeletedAtIsNull(CAPSULE_ID)).willReturn(Optional.of(capsule));
        given(mongoTemplate.findOne(any(Query.class), eq(Capsule.class))).willAnswer(invocation -> capsule);

        CapsuleResponse response = capsuleService.update(CAPSULE_ID, OWNER_ID, request);

        assertEquals("draft", response.getStatus());
        assertNull(response.getUnlockAt());
        assertNull(response.getExpiresAt());
        assertNull(response.getShareToken());
        assertFalse(Boolean.TRUE.equals(response.getAllowComments()));
        assertFalse(Boolean.TRUE.equals(response.getAllowReactions()));
        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Capsule.class));
    }

    @Test
    void adminCanUpdateForeignOpenedCapsule() {
        Capsule capsule = capsule(OWNER_ID, "opened");
        capsule.setOpenedAt(Instant.now().minusSeconds(3600));
        User admin = user(ADMIN_ID, User.Role.ADMIN);
        UpdateCapsuleRequest request = validRequest();
        request.setStatus("opened");

        given(userRepository.findById(ADMIN_ID)).willReturn(Optional.of(admin));
        given(capsuleRepository.findByIdAndDeletedAtIsNull(CAPSULE_ID)).willReturn(Optional.of(capsule));
        given(mongoTemplate.findOne(any(Query.class), eq(Capsule.class))).willAnswer(invocation -> capsule);

        CapsuleResponse response = capsuleService.update(CAPSULE_ID, ADMIN_ID, request);

        assertEquals("opened", response.getStatus());
        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Capsule.class));
    }

    @Test
    void nonOwnerNonAdminCannotUpdateCapsule() {
        Capsule capsule = capsule(OWNER_ID, "sealed");
        User other = user(OTHER_USER_ID, User.Role.REGULAR);

        given(userRepository.findById(OTHER_USER_ID)).willReturn(Optional.of(other));
        given(capsuleRepository.findByIdAndDeletedAtIsNull(CAPSULE_ID)).willReturn(Optional.of(capsule));

        assertThrows(SecurityException.class, () -> capsuleService.update(CAPSULE_ID, OTHER_USER_ID, validRequest()));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(Capsule.class));
    }

    @Test
    void ownerCannotUpdateOpenedCapsule() {
        Capsule capsule = capsule(OWNER_ID, "opened");
        capsule.setOpenedAt(Instant.now().minusSeconds(300));
        User owner = user(OWNER_ID, User.Role.REGULAR);

        given(userRepository.findById(OWNER_ID)).willReturn(Optional.of(owner));
        given(capsuleRepository.findByIdAndDeletedAtIsNull(CAPSULE_ID)).willReturn(Optional.of(capsule));

        assertThrows(SecurityException.class, () -> capsuleService.update(CAPSULE_ID, OWNER_ID, validRequest()));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(Capsule.class));
    }

    @Test
    void updateRejectsInvalidExpiryOrder() {
        Capsule capsule = capsule(OWNER_ID, "sealed");
        User owner = user(OWNER_ID, User.Role.REGULAR);
        UpdateCapsuleRequest request = validRequest();
        request.setExpiresAt(request.getUnlockAt().minusSeconds(60));

        given(userRepository.findById(OWNER_ID)).willReturn(Optional.of(owner));
        given(capsuleRepository.findByIdAndDeletedAtIsNull(CAPSULE_ID)).willReturn(Optional.of(capsule));

        assertThrows(IllegalArgumentException.class, () -> capsuleService.update(CAPSULE_ID, OWNER_ID, request));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(Capsule.class));
    }

    @Test
    void sharedDraftCannotBeViewedByGrantee() {
        Capsule capsule = capsule(OWNER_ID, "draft");
        capsule.setVisibility("shared");
        capsule.setUnlockAt(null);
        capsule.setExpiresAt(null);

        given(capsuleRepository.findByIdAndOwnerIdAndDeletedAtIsNull(CAPSULE_ID, new ObjectId(OTHER_USER_ID)))
                .willReturn(Optional.empty());
        given(shareRepository.existsByCapsuleIdAndGranteeIdAndDeletedAtIsNull(new ObjectId(CAPSULE_ID), new ObjectId(OTHER_USER_ID)))
                .willReturn(true);
        given(capsuleRepository.findByIdAndDeletedAtIsNull(CAPSULE_ID)).willReturn(Optional.of(capsule));

        assertThrows(IllegalArgumentException.class, () -> capsuleService.getMine(CAPSULE_ID, OTHER_USER_ID));
    }

    private Capsule capsule(String ownerId, String status) {
        Capsule capsule = new Capsule();
        capsule.setId(CAPSULE_ID);
        capsule.setOwnerId(new ObjectId(ownerId));
        capsule.setTitle("Old title");
        capsule.setBody("Old body");
        capsule.setVisibility("private");
        capsule.setStatus(status);
        capsule.setUnlockAt(Instant.now().plusSeconds(7200));
        capsule.setExpiresAt(Instant.now().plusSeconds(10_800));
        capsule.setAllowComments(false);
        capsule.setAllowReactions(false);
        capsule.setTags(List.of("old"));
        capsule.setCreatedAt(Instant.now().minusSeconds(3000));
        capsule.setUpdatedAt(Instant.now().minusSeconds(1000));
        return capsule;
    }

    private User user(String id, User.Role role) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setEmail(id + "@example.com");
        user.setUsername("u-" + id.substring(id.length() - 4));
        return user;
    }

    private UpdateCapsuleRequest validRequest() {
        UpdateCapsuleRequest request = new UpdateCapsuleRequest();
        request.setTitle("Updated title");
        request.setBody("Updated body");
        request.setVisibility("shared");
        request.setStatus("sealed");
        request.setUnlockAt(Instant.now().plusSeconds(7200));
        request.setExpiresAt(Instant.now().plusSeconds(12_000));
        request.setAllowComments(true);
        request.setAllowReactions(true);
        request.setTags(List.of("travel", "future"));
        request.setCoverImageUrl("/uploads/covers/updated.jpg");
        request.setMedia(List.of());
        return request;
    }
}
