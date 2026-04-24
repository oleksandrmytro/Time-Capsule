# Time Capsule Frontend

React SPA for the Time Capsule project.

## Stack

- React 19.1
- React Router 7
- TypeScript
- Vite 7
- Tailwind CSS 4
- Radix UI primitives
- Leaflet for 2D maps
- Cesium for globe mode
- STOMP/SockJS for realtime chat and capsule events
- Bun scripts

## Scripts

```bash
bun run dev
bun run typecheck
bun run build
bun run lint
bun run preview
```

`bun run build` runs `tsc --noEmit` before `vite build`.

## Environment

The API origin is resolved in `src/services/api.ts` from these variables, in
order:

- `VITE_API_ORIGIN`
- `VITE_API_BASE`
- `VITE_API_URL`
- current browser origin, with localhost `5173` mapped to backend `8080`

For Docker Compose development, `deploy/docker-compose.yml` sets:

```text
VITE_API_URL=https://localhost/api
```

The Docker nginx container terminates HTTPS on `https://localhost` and uses a
self-signed local certificate when no production certificate is mounted.

Optional:

```text
VITE_CESIUM_ION_TOKEN=<token>
```

## Main Routes

- `/`
- `/login`
- `/register`
- `/verify`
- `/account`
- `/account/settings`
- `/create`
- `/discover`
- `/capsules/:id`
- `/capsules/:id/edit`
- `/search`
- `/calendar`
- `/map`
- `/profile/:username`
- `/chat`
- `/chat/:userId`
- `/admin/*`
- `/auth/oauth2/redirect`

## Project Notes

- `App.tsx` handles route composition, auth session bootstrap, OAuth callback
  handling, capsule loading, and WebSocket lifecycle decisions.
- `src/services/api.ts` is the central REST client and type definition file.
- `src/services/ws.ts` handles STOMP/SockJS subscriptions.
- Heavy screens are lazy-loaded; Cesium is imported only when globe mode is
  activated.

## Verified Status

Verified on 2026-04-19:

- `bun run typecheck`: passed.
- `bun run build`: passed.
- `bun run lint`: 0 errors, 16 warnings.
