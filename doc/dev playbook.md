# Time Capsule Dev Playbook

This repository contains a Spring Boot backend, a React/Vite frontend, an nginx
dev proxy, and a local sharded MongoDB cluster.

## Prerequisites

- Docker Desktop or compatible Docker engine.
- Java 21+ for local Maven commands. The wrapper currently ran successfully on
  Java 25, but the project is configured for Java 21 source compatibility.
- Bun for frontend local scripts.
- Maven wrapper files are included in `backend/`.

## Environment Setup

Create local env files from templates:

```bash
cp database/.env.example database/.env
cp deploy/dev.env.example deploy/dev.env
```

Do not commit real env files. The root `.gitignore` excludes `.env` and
`dev.env` patterns.

Required app values:

- `SPRING_DATA_MONGODB_URI`
- `SECURITY_JWT_SECRET_KEY`
- OAuth client settings for Google/GitHub if OAuth is tested
- SMTP settings if registration/password emails are tested
- `VITE_API_URL`
- optional `VITE_CESIUM_ION_TOKEN`

## Start The Database

The application compose file expects the external Docker network
`database_default`, so start the database stack first:

```bash
cd database
docker compose up -d --build
```

The database stack starts:

- one `mongos` router on host port `27017`
- three config server nodes
- three shard replica sets
- `init-cluster`, which initializes sharding, schemas, and seed CSV data
- `cli`, a helper container with a `mongo` alias

The schema initializer manages 14 collections including `users`, `capsules`,
`geomarkers`, `chat_messages`, `tags`, and `admin_audit_logs`.

## Start The App Stack

```bash
cd deploy
docker compose up -d --build
```

Services:

- `backend`: Spring Boot dev server on container port `8080`, bound to
  `127.0.0.1:8080` for local debugging only.
- `frontend`: Vite dev server on container port `5173`.
- `nginx`: public dev entrypoint on host ports `80` and `443`.

Primary URLs:

- App through nginx: `https://localhost`
- HTTP redirect: `http://localhost` redirects to `https://localhost`
- Backend direct: `http://localhost:8080`
- Test endpoint: `https://localhost/api/hello`
- OAuth start: `https://localhost/oauth2/authorization/google` or
  `https://localhost/oauth2/authorization/github`
- SockJS/STOMP endpoint: `https://localhost/ws`

## Local HTTPS

The Docker nginx container terminates TLS for local development:

```text
Browser --HTTPS--> nginx --HTTP--> frontend/backend inside Docker networks
```

Port `80` is kept only as a redirect endpoint. Requests to `http://localhost`
return `301 Moved Permanently` with `Location: https://localhost/...`.

If no mounted certificate is present, nginx generates a self-signed localhost
certificate during container startup. Browsers will show a "not secure" warning
for this local certificate because it is not signed by a trusted certificate
authority. The connection still uses HTTPS, but the certificate is not trusted.

For production, replace the generated certificate with a certificate issued for
the real domain, for example by Let's Encrypt. The expected paths inside the
nginx container are:

```text
/etc/nginx/certs/fullchain.pem
/etc/nginx/certs/privkey.pem
```

Spring Boot receives `X-Forwarded-*` headers from nginx and uses
`server.forward-headers-strategy=framework`, so secure cookies and redirect
URLs are resolved from the external HTTPS request.

## Hot Reload

Backend:

- Source is mounted from `backend/src`.
- Compiled classes are mounted through `backend/target/classes`.
- Spring Boot DevTools watches `target/classes`.
- Java debug port `5005` is exposed when `JAVA_DEBUG_OPTS` is set.

Frontend:

- Source is mounted from `frontend/`.
- Vite runs with host `0.0.0.0`.
- nginx proxies HMR through `/vite-dev`.
- `vite.config.ts` configures HMR path `/vite-dev`, protocol `wss`, and client
  port `443`.

## Run Checks Locally

Backend:

```bash
cd backend
.\mvnw.cmd test -DskipTests=false
.\mvnw.cmd -DskipTests package
```

Frontend:

```bash
cd frontend
bun run typecheck
bun run build
bun run lint
```

Verified on 2026-04-19:

- Backend tests: 15 passed, 0 failures.
- Backend package: passed and produced `target/timecapsule-0.0.1-SNAPSHOT.jar`.
- Frontend typecheck: passed.
- Frontend build: passed.
- Frontend lint: completed with 0 errors and 16 warnings.

## Useful Commands

```bash
# App stack logs
cd deploy
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# Rebuild app containers
docker compose build --no-cache

# Check backend through nginx
curl -k https://localhost/api/hello

# Check HTTP -> HTTPS redirect
curl -I http://localhost/

# Database shell helper
cd database
docker compose exec cli sh
mongo
```

## Known Local Caveats

- `frontend/dist`, backend `target`, uploads, and generated assets are build or
  runtime outputs. Do not treat them as source of truth.
- `bun run lint` currently returns warnings. Avoid documenting lint as fully
  clean until those warnings are fixed.
- Local HTTPS uses a self-signed certificate. Browser warnings on
  `https://localhost` are expected until a trusted certificate is installed.
- The app uses local filesystem media storage; production would need a durable
  object store/CDN strategy.
- Some backend tests intentionally log handled error cases through
  `GlobalExceptionHandler`; those log lines are not test failures.
