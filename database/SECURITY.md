# MongoDB Security Notes

This directory contains the local MongoDB sharded-cluster setup used by the
Time Capsule development environment.

## Current Setup

- `database/docker-compose.yml` starts one `mongos` router, three config-server
  nodes, three shard replica sets, an `init-cluster` job, and a `cli` helper.
- Application containers connect through `router01:27017` from the Docker
  network `database_default`.
- The database name used by the app and seed scripts is `time-capsule`.
- Schema validation and sharding are initialized by
  `database/scripts/init_schemas.js`.
- Seed data is imported from `database/data/*.csv` by
  `database/scripts/import_datasets.js`.

The current local connection strings use keyfile authentication and
`ssl=false`. There is no active TLS setup in this Docker Compose environment.
If TLS is enabled later, update both the MongoDB compose files and the
application connection strings together.

This database TLS setting is separate from client-facing HTTPS. The app stack
terminates browser HTTPS at nginx, then nginx forwards requests to the backend
over the private Docker network. MongoDB traffic remains internal to the Docker
network and currently uses the `ssl=false` connection string shown below.

## Environment Files

Use `database/.env.example` as the template for local database credentials:

```bash
cp database/.env.example database/.env
```

Use `deploy/dev.env.example` as the template for the app stack:

```bash
cp deploy/dev.env.example deploy/dev.env
```

Both `.env` and `dev.env` files are ignored by the root `.gitignore`. They must
contain local-only secrets.

## Required Secrets

- `MONGO_ADMIN_USER`
- `MONGO_ADMIN_PASSWORD`
- `SPRING_DATA_MONGODB_URI`
- `SECURITY_JWT_SECRET_KEY`
- OAuth client IDs/secrets, if OAuth login is tested locally
- SMTP username/password, if email flows are tested locally
- Optional map/Cesium tokens used by the frontend

Use different values for local, staging, and production. Rotate any value that
was ever shared or committed accidentally.

## Local Connection Strings

From the application containers:

```text
mongodb://time-capsule-admin:<password>@router01:27017/time-capsule?authSource=admin&readPreference=secondaryPreferred&ssl=false
```

From the host machine, after exposing the router on port `27017`:

```text
mongodb://time-capsule-admin:<password>@localhost:27017/time-capsule?authSource=admin&readPreference=secondaryPreferred&ssl=false
```

Replace `<password>` with the value from `database/.env`.

## Password Rules

- Use at least 16 characters.
- Mix uppercase, lowercase, digits, and symbols.
- Do not reuse personal or production passwords.
- Do not store real secrets in markdown, screenshots, issue comments, or chat.

## Operational Notes

- The `init_schemas.js` script drops and recreates managed collections when it
  initializes schemas. Do not run it against production data.
- Seed import resets the configured seed collections before inserting CSV data.
- The app performs targeted MongoDB updates for important flows such as capsule
  updates and user profile/password changes; keep shard keys in mind when adding
  new write paths.
