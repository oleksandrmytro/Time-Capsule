package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.models.Follow;
import com.oleksandrmytro.timecapsule.models.User;
import com.oleksandrmytro.timecapsule.repositories.CapsuleRepository;
import com.oleksandrmytro.timecapsule.repositories.FollowRepository;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class UserServiceSuggestUsersTest {

    private static final String ME_ID = "507f1f77bcf86cd799439011";
    private static final String FOLLOWED_ID = "507f1f77bcf86cd799439012";
    private static final String FOLLOWER_ID = "507f1f77bcf86cd799439013";
    private static final String MUTUAL_ID = "507f1f77bcf86cd799439014";
    private static final String SECONDARY_ID = "507f1f77bcf86cd799439015";
    private static final String TERTIARY_ID = "507f1f77bcf86cd799439016";
    private static final String ADMIN_ID = "507f1f77bcf86cd799439017";

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private MongoTemplate mongoTemplate;

    @Mock
    private FollowRepository followRepository;

    @Mock
    private CapsuleRepository capsuleRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void suggestUsersRanksNetworkCandidatesAndSkipsAdmins() {
        User followed = user(FOLLOWED_ID, "followed-user", User.Role.REGULAR);
        User follower = user(FOLLOWER_ID, "follower-user", User.Role.REGULAR);
        User mutual = user(MUTUAL_ID, "aaa-mutual", User.Role.REGULAR);
        User secondary = user(SECONDARY_ID, "bbb-secondary", User.Role.REGULAR);
        User tertiary = user(TERTIARY_ID, "ccc-tertiary", User.Role.REGULAR);
        User admin = user(ADMIN_ID, "admin-user", User.Role.ADMIN);
        User me = user(ME_ID, "me-user", User.Role.REGULAR);

        Map<String, User> users = Map.of(
                ME_ID, me,
                FOLLOWED_ID, followed,
                FOLLOWER_ID, follower,
                MUTUAL_ID, mutual,
                SECONDARY_ID, secondary,
                TERTIARY_ID, tertiary,
                ADMIN_ID, admin
        );

        given(userRepository.findById(anyString()))
                .willAnswer(invocation -> Optional.ofNullable(users.get(invocation.getArgument(0, String.class))));

        given(followRepository.findByFollowerIdAndDeletedAtIsNull(eq(objectId(ME_ID))))
                .willReturn(List.of(follow(FOLLOWED_ID, ME_ID)));
        given(followRepository.findByUserIdAndDeletedAtIsNull(eq(objectId(ME_ID))))
                .willReturn(List.of(follow(ME_ID, FOLLOWER_ID)));

        given(followRepository.findByUserIdAndDeletedAtIsNull(eq(objectId(FOLLOWED_ID))))
                .willReturn(List.of(
                        follow(FOLLOWED_ID, MUTUAL_ID),
                        follow(FOLLOWED_ID, ME_ID)
                ));
        given(followRepository.findByFollowerIdAndDeletedAtIsNull(eq(objectId(FOLLOWED_ID))))
                .willReturn(List.of(
                        follow(MUTUAL_ID, FOLLOWED_ID),
                        follow(SECONDARY_ID, FOLLOWED_ID),
                        follow(ADMIN_ID, FOLLOWED_ID)
                ));
        given(followRepository.findByFollowerIdAndDeletedAtIsNull(eq(objectId(FOLLOWER_ID))))
                .willReturn(List.of(follow(TERTIARY_ID, FOLLOWER_ID)));

        List<User> suggestions = userService.suggestUsers(ME_ID, 12);

        assertEquals(List.of(MUTUAL_ID, SECONDARY_ID, TERTIARY_ID), suggestions.stream().map(User::getId).toList());
    }

    @Test
    void suggestUsersFallsBackToPublicSearchWhenGraphIsEmpty() {
        User fallbackOne = user("507f1f77bcf86cd799439018", "fallback-a", User.Role.REGULAR);
        User fallbackTwo = user("507f1f77bcf86cd799439019", "fallback-b", User.Role.REGULAR);

        given(followRepository.findByFollowerIdAndDeletedAtIsNull(eq(objectId(ME_ID)))).willReturn(List.of());
        given(followRepository.findByUserIdAndDeletedAtIsNull(eq(objectId(ME_ID)))).willReturn(List.of());
        given(mongoTemplate.find(any(Query.class), eq(User.class))).willReturn(List.of(fallbackOne, fallbackTwo));

        List<User> suggestions = userService.suggestUsers(ME_ID, 2);

        assertEquals(List.of(fallbackOne.getId(), fallbackTwo.getId()), suggestions.stream().map(User::getId).toList());
    }

    private Follow follow(String userId, String followerId) {
        Follow follow = new Follow();
        follow.setUserId(objectId(userId));
        follow.setFollowerId(objectId(followerId));
        return follow;
    }

    private ObjectId objectId(String id) {
        return new ObjectId(id);
    }

    private User user(String id, String username, User.Role role) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        user.setRole(role);
        user.setEnabled(true);
        return user;
    }
}
