# Frontend Patterns & Code Style

This document describes the current React app in `frontend/`.

## Stack

- React 19.1.
- React Router 7.
- TypeScript 5.9.
- Vite 7 with `@vitejs/plugin-react`.
- Tailwind CSS 4 through `@tailwindcss/vite`.
- Radix UI primitives for dialogs, tabs, selects, switches, dropdowns, avatars,
  labels, scroll areas, and slots.
- Leaflet and `leaflet.markercluster` for 2D maps.
- Cesium plus `vite-plugin-cesium` for globe mode.
- STOMP + SockJS for realtime chat and capsule status events.
- Bun for local dependency install and scripts.

## Source Layout

```text
frontend/src
  App.tsx                         route composition and session bootstrap
  main.tsx                        React root, BrowserRouter, global polyfills
  index.css                       Tailwind 4 theme tokens and global styles
  services/
    api.ts                        typed REST client and DTO types
    ws.ts                         STOMP/SockJS client
    scene-transition.ts           landing/background scene transitions
  lib/
    asset-url.ts                  static/upload URL normalization
    media-types.ts                accepted media MIME helpers
    native-file-picker.ts         file picker helper
    space-scene.ts                custom background scene
    tag-image-url.ts              tag image URL normalization
    utils.ts                      small shared utilities
  components/
    account/
    admin/
    auth/
    capsules/
    chat/
    landing/
    media/
    ui/
    users/
```

There is no `containers/` directory in the current app. Route-level orchestration
mostly lives in `App.tsx`, while feature components own local UI state.

## Routing

Current SPA routes:

- `/`
- `/landing-concept`
- `/landing-concept/account-preview`
- `/login`
- `/register`
- `/verify`
- `/account`
- `/account/settings`
- `/create`
- `/discover`
- `/capsules`
- `/capsules/:id`
- `/capsules/:id/edit`
- `/search`
- `/calendar`
- `/map`
- `/admin/*`
- `/profile/:username`
- `/chat`
- `/chat/:userId`
- `/auth/oauth2/redirect`

Heavy route components are lazy-loaded with `React.lazy` and `Suspense`.
Map/globe code is further split so Cesium is imported only when globe mode is
activated.

## API Layer

Use `frontend/src/services/api.ts` for backend calls. Components should not
hard-code endpoint origins.

`api.ts` resolves the backend origin from:

1. `VITE_API_ORIGIN`
2. `VITE_API_BASE`
3. `VITE_API_URL`
4. the current browser origin, with a localhost Vite fallback from `5173` to
   backend port `8080`

Requests use `credentials: 'include'` because auth tokens are HttpOnly cookies.
FormData uploads intentionally omit the JSON `Content-Type` header.

## Realtime

`services/ws.ts` connects to `/ws` through SockJS/STOMP and subscribes to user
queues used by the backend:

- `/user/queue/capsules/status`
- `/user/queue/chat`

`App.tsx` currently opens the WebSocket connection only where realtime is needed:
account/profile capsule views and chat routes.

## UI Components

Use existing primitives in `components/ui` before adding another component:

- `button`
- `input`
- `textarea`
- `dialog`
- `sheet`
- `tabs`
- `select`
- `switch`
- `avatar`
- `dropdown-menu`
- `label`
- `separator`
- `scroll-area`
- `skeleton`

Domain components are grouped by feature:

- `capsules`: cards, detail, create/edit form, calendar, map, comments,
  reactions, sharing, tags, media upload.
- `chat`: conversation list and message window.
- `users`: search, profile, user cards, followers/following views.
- `admin`: admin shell, users workspace, audit workspace, capsules/tags/data
  tables.
- `auth`: auth layout, login, register, verification.

## Styling Rules

- Tailwind classes are the default styling mechanism.
- Shared colors, radius, typography, and semantic tokens live in `index.css`.
- Feature-specific CSS exists where the UI needs more than utility classes:
  `auth-layout.css`, `create-capsule-form.css`, `chat-window.css`, and
  `cosmic-landing-concept.css`.
- Keep layout-stability in mind for fixed UI surfaces such as map controls,
  chat panes, capsule cards, and admin tables.
- Prefer existing page shells and visual language over introducing a new theme
  for one feature.

## Forms & Validation

Important current forms:

- login/register/verify
- account profile and password change
- create/edit capsule
- location picker inside the capsule form
- media, cover, avatar, tag image upload
- user search
- comments/replies/edit comment
- share capsule dialog
- chat composer with reply and attachment state
- admin user/capsule/tag/data editors

Validate user input before calling `api.ts`, but keep backend validation as the
source of truth. Surface backend errors through the existing error/empty-state
patterns.

## Build & Lint

Verified on 2026-04-19:

```bash
cd frontend
bun run typecheck
bun run build
bun run lint
```

Results:

- `bun run typecheck`: passed.
- `bun run build`: passed; Vite produced split `vendor`, `map-vendor`,
  `3d-vendor`, and `realtime-vendor` chunks.
- `bun run lint`: 0 errors, 16 warnings. Warnings are unused variables/args,
  hook dependency warnings, and Fast Refresh export warnings.

Do not document lint as clean until those warnings are resolved.
