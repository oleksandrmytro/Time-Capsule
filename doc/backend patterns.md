# Backend Patterns & Code Style

This document describes the backend as it exists now, not a generic template.

## Stack

- Java 21 source level in `backend/pom.xml`.
- Spring Boot 3.5.3.
- Spring Web MVC, Spring Security, OAuth2 client/resource-server support.
- JWT access and refresh tokens stored only in HttpOnly cookies.
- MongoDB through Spring Data MongoDB and `MongoTemplate`.
- WebSocket/STOMP over SockJS at `/ws`.
- Mail delivery through Spring Mail.
- Local media storage under `backend/uploads`.
- Tests with JUnit 5, Spring Boot Test, Spring Security Test, Mockito.

## Package Layout

Base package:

```text
com.oleksandrmytro.timecapsule
```

Current packages:

```text
config        Spring security, CORS, WebSocket, scheduler, upload resources, audit interceptor
controllers   REST controllers and global exception handling
dto           request DTOs
events        WebSocket/event payloads
models        MongoDB documents and enums
repositories  Spring Data Mongo repositories
responses     API response DTOs
services      business logic and MongoTemplate write paths
```

Keep new backend code inside the existing package shape unless a new boundary is
really needed. Do not add generic `utils`, `impl`, or nested feature packages for
one-off helpers.

## Main Domain Model

Mongo collections represented in Java:

- `users`: credentials, profile fields, role, enabled/blocked/deleted state,
  OAuth providers, avatar URL, password-change flag.
- `pending_users`: pending registration flow.
- `capsules`: title/body, owner, status, visibility, media, cover, tags,
  unlock/expiry dates, geolocation marker reference, sharing token, soft delete.
- `geomarkers`: map marker records managed through `MongoTemplate` inside
  `CapsuleService`.
- `shares`: capsule access grants for selected users.
- `follows`: social graph relationships.
- `chat_messages`: persisted chat history and capsule-share messages.
- `comments`: threaded capsule comments with soft delete.
- `reactions`: per-user capsule reactions.
- `tags`: system and user-created tags.
- `admin_audit_logs`: mutation and admin-operation audit records.
- `email_digest_state`: internal digest-notification state used by
  `EmailService`.

Important enums:

- `CapsuleStatus`: `draft`, `sealed`, `opened`.
- `CapsuleVisibility`: `private`, `public`, `shared`.
- `ChatMessageType`: `text`, `image`, `video`, `capsule_share`.
- `ChatMessageStatus`: currently persisted as `sent`.
- `ReactionType`, `ShareRole`, `ShareStatus`, `ShareVia`.

## REST Surface

Authentication:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/verify`
- `GET /api/auth/verify`
- `POST /api/auth/verify-and-login`
- `POST /api/auth/resend`
- `POST /api/auth/refresh`
- `POST /api/auth/refresh/check`
- `POST /api/auth/logout`
- `POST /api/auth/impersonation/stop`
- `GET /api/auth/session`

Users:

- `GET/PATCH /api/users/me`
- `POST /api/users/me/password/request-code`
- `POST /api/users/me/password/confirm`
- `POST /api/users/me/password/change`
- `GET /api/users/search`
- `GET /api/users/suggestions`
- `GET /api/users/{idOrUsername}`
- `POST /api/users/{id}/follow`
- `POST /api/users/{id}/unfollow`
- `GET /api/users/{id}/followers`
- `GET /api/users/{id}/following`
- `GET /api/users/{id}/capsules`

Capsules:

- `POST /api/capsules`
- `GET /api/capsules`
- `GET /api/capsules/public`
- `GET /api/capsules/calendar`
- `GET /api/capsules/map`
- `GET /api/capsules/{id}/edit`
- `GET /api/capsules/{id}`
- `PUT /api/capsules/{id}`
- `POST /api/capsules/{id}/unlock`
- `POST /api/capsules/{id}/share`

Engagement:

- `GET/POST /api/capsules/{capsuleId}/comments`
- `PATCH/DELETE /api/capsules/{capsuleId}/comments/{commentId}`
- `GET/POST /api/capsules/{capsuleId}/reactions`

Media:

- `POST /api/media/cover`
- `POST /api/media/avatar`
- `POST /api/media/chat-attachment`
- `POST /api/media/tag-image`
- `POST /api/media/capsule-attachment`

Tags:

- `GET /api/tags`
- `GET /api/tags/search`
- `POST /api/tags`

Chat:

- `GET /api/chat/conversations`
- `GET /api/chat/{userId}/messages`
- `POST /api/chat/{userId}/messages`

Admin:

- `GET /api/admin/stats`
- CRUD/bulk endpoints for users, capsules, tags.
- `GET /api/admin/audit-logs`
- raw managed collection browsing/editing under `/api/admin/collections`.

## Security Rules

- TLS is terminated at nginx. External browser traffic uses HTTPS, while nginx
  forwards requests to backend over the private Docker network with HTTP.
- Backend must trust reverse-proxy headers through
  `server.forward-headers-strategy=framework`; cookie security and OAuth
  redirects depend on `X-Forwarded-Proto=https`.
- Authentication responses must not expose `accessToken` or `refreshToken` in
  JSON bodies. Refresh endpoints read the refresh token from the HttpOnly cookie.
- `/static/**` and `/uploads/**` are public static resources.
- `/ws/**` is allowed at HTTP handshake level; STOMP inbound messages are
  authenticated by `WebSocketJwtChannelInterceptor`.
- `/api/auth/**` and `/api/hello` are public.
- `GET /api/tags/**`, public capsule detail, public users, comments, and
  reactions are readable without login where controller/service rules allow it.
- All other `/api/**` paths require authentication.
- Admin endpoints additionally call `requireAdmin` in `AdminController`.

JWT subject is the Mongo user id. `User.getUsername()` intentionally returns
`id` for Spring Security; display username is `getUsernameField()`.

## Capsule Rules

- Creation validates `status`, `unlockAt`, and `expiresAt`.
- Sealed capsules require a future `unlockAt`.
- `expiresAt` must be after `unlockAt`.
- Non-admin users cannot edit opened capsules.
- Only an owner or admin can edit.
- Only an admin can set a capsule to `opened` through the edit path.
- Locked capsule responses hide `body` and `media` unless the edit endpoint
  explicitly requests locked content.
- `CapsuleUnlockScheduler` opens ready sealed capsules every 5 seconds and sends
  WebSocket plus email notifications.
- `listMine` and `getMine` also unlock ready owner capsules as a fallback.
- Map markers include the current user plus follow-related users; non-owned
  markers are returned only when the capsule is public.

## Media Rules

- Covers, avatars, and tag images accept JPEG, PNG, GIF, and WebP up to 10 MB.
- Chat and capsule attachments accept image/video files up to 50 MB.
- Chat/capsule videos accept MP4, WebM, and QuickTime.
- File URLs are local app URLs, not external object storage URLs.

## Audit & Notifications

- `ApiAuditInterceptor` records successful authenticated mutations under
  `/api/**`, excluding `/api/admin/**`.
- Admin operations are audited manually in `AdminService`.
- Capsule-opened emails are sent immediately.
- Chat and comment emails are batched through `email_digest_state` with
  threshold, cooldown, inactivity delay, and lock TTL settings.

## Coding Rules

- Controllers should stay thin: parse request, resolve actor, call service,
  return response.
- Business rules belong in services.
- Use request DTOs and response DTOs; do not return Mongo entities from regular
  user-facing controllers unless the existing endpoint already does so.
- For sharded collections, prefer targeted `MongoTemplate` updates that include
  the relevant ownership/shard-key criteria.
- Preserve soft-delete fields (`deletedAt`) in queries unless the feature is
  explicitly an admin include-deleted view.
- Keep comments short and useful. There are already many explanatory comments;
  new comments should clarify non-obvious behavior, not restate Java syntax.

## Tests

Current backend test files:

- `AuthenticationControllerTest`
- `CapsuleControllerTest`
- `CapsuleServiceUpdateTest`
- `UserServiceSuggestUsersTest`
- `TimeCapsuleApplicationTests`

Verified on 2026-04-19:

```bash
cd backend
.\mvnw.cmd test -DskipTests=false
```

Result: 15 tests passed, 0 failures, 0 errors. Maven emits warnings about
deprecated `@MockBean`, dynamic Mockito agent loading, and one deprecated API in
`ApplicationConfiguration`; these are warnings, not current build failures.
