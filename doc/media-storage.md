# Media Storage

Time Capsule currently stores uploaded media on the local filesystem under
`backend/uploads`. Static bundled tag images live in the backend resources.

## Runtime Folders

| Folder | Public URL | Used for |
| --- | --- | --- |
| `backend/uploads/covers` | `/static/covers/*` | capsule cover uploads |
| `backend/uploads/avatars` | `/uploads/avatars/*` | user avatars |
| `backend/uploads/chat` | `/uploads/chat/*` | chat image/video attachments |
| `backend/uploads/capsules` | `/uploads/capsules/*` | capsule image/video attachments |
| `backend/uploads/tags` | `/uploads/tags/*` | custom tag images |
| `backend/src/main/resources/static/tags` | `/static/tags/*` | bundled system tag images |
| `backend/tiles3d` | `/3dtiles/*` | optional local 3D Tiles dataset |
| `backend/src/main/resources/static/3dtiles` | `/3dtiles/*` fallback | packaged 3D Tiles fallback |

`WebConfig` registers the resource handlers. nginx proxies `/static/tags/`,
`/static/covers/`, `/uploads/`, and `/3dtiles/` to the backend.

## Upload Endpoints

| Endpoint | Max size | Accepted types | Output |
| --- | ---: | --- | --- |
| `POST /api/media/cover` | 10 MB | JPEG, PNG, GIF, WebP | `{ "url": "/static/covers/<file>" }` |
| `POST /api/media/avatar` | 10 MB | JPEG, PNG, GIF, WebP | `{ "url": "/uploads/avatars/<file>" }` |
| `POST /api/media/chat-attachment` | 50 MB | JPEG, PNG, GIF, WebP, MP4, WebM, QuickTime | URL, `mediaKind`, MIME type |
| `POST /api/media/tag-image` | 10 MB | JPEG, PNG, GIF, WebP | `{ "url": "/uploads/tags/<file>" }` |
| `POST /api/media/capsule-attachment` | 50 MB | JPEG, PNG, GIF, WebP, MP4, WebM, QuickTime | media item with id, URL, type, metadata |

The frontend upload helpers live in `frontend/src/services/api.ts`.

## Tag Images

System tags are seeded by `TagService` and point to `/static/tags/*.jpg`.
Current default tags:

- Travel
- Birthday
- Wedding
- Graduation
- Family
- Friends
- Love
- Memory
- Achievement
- Holiday
- Music
- Nature
- Food
- Sport
- Art
- Pet

`TagService` normalizes old paths, rejects external placeholder URLs, and
returns only system tags plus the current user's custom tags for regular tag
listing.

## Covers And Attachments

Capsule covers are stored separately from capsule media:

- `coverImageUrl` is a single image URL used as the capsule card/detail cover.
- `media` is a list of image/video attachments with `id`, `url`, `type`, and
  optional `meta`.

Locked capsule responses hide `body` and `media`; cover, title, timing, status,
visibility, tags, and location can still be returned depending on access rules.

## Development Notes

- Docker Compose mounts `../backend/uploads:/app/uploads`, so uploads survive
  backend container rebuilds as long as the local folder is kept.
- This is not production-grade storage. Production should move uploads to
  durable object storage and serve them through a CDN or signed URL layer.
- The current upload controller trusts the browser-provided content type. Add
  server-side file sniffing before using this storage path for untrusted public
  production uploads.
