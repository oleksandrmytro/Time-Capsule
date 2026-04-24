# Commit Rules

Use Conventional Commits:

```text
<type>(<scope>): <subject>
```

Keep the subject short, imperative, and without a trailing period.

## Types

| Type | Use for |
| --- | --- |
| `feat` | New product or business behavior |
| `fix` | Bug fixes |
| `docs` | Markdown, diagrams, ADRs, README files |
| `test` | Test code, test data, mocks |
| `refactor` | Code restructuring without behavior changes |
| `perf` | Performance changes without behavior changes |
| `style` | Formatting or visual/code style only |
| `build` | Maven, Bun, Vite, Dockerfile, dependency/build artifact changes |
| `ci` | CI/CD pipeline files |
| `dev` | Local developer workflow and IDE/dev-server support |
| `env` | Environment templates, `.gitignore`, Docker Compose env wiring |
| `chore` | Maintenance that does not fit another type |
| `revert` | Revert of an earlier commit |

## Scopes

Prefer scopes that match the current project boundaries:

| Scope | Area |
| --- | --- |
| `backend` | Spring Boot backend in `backend/` |
| `frontend` | React app in `frontend/` |
| `db` | MongoDB schemas, seed data, sharding scripts in `database/` |
| `deploy` | Docker Compose and container wiring in `deploy/` |
| `nginx` | nginx proxy config |
| `auth` | login, registration, verification, JWT/OAuth, sessions |
| `capsules` | capsule create/edit/detail/unlock/share flows |
| `media` | cover/avatar/chat/tag/capsule upload and static serving |
| `chat` | conversations, messages, STOMP delivery |
| `map` | Leaflet map, Cesium globe, geomarkers |
| `users` | profiles, search, follow graph, suggestions |
| `admin` | admin panel, moderation, audit, impersonation |
| `tags` | system/custom tag model and picker |
| `docs` | documentation-only changes |

When a change spans several areas, use the smallest honest scope:

```text
feat(capsules): support editing sealed capsules
fix(chat): persist capsule share messages once
docs(docs): refresh project documentation
build(frontend): split map and 3d vendor chunks
env(deploy): add digest notification settings
```

For broad changes across the whole repository, use `repo`:

```text
chore(repo): normalize line endings
```

## Body

Add a body when the subject cannot explain the reason. Use it to describe what
changed and why, not to repeat the diff.

```text
fix(capsules): hide locked media from public detail

Locked capsules already hid the body, but media was still included in the
response for public access. The service now returns media only after unlock or
through the edit endpoint.
```

## Breaking Changes

Use the standard footer when an API, data shape, route, or command changes in a
non-compatible way:

```text
BREAKING CHANGE: /api/capsules/:id now returns 404 for inaccessible private capsules.
```
