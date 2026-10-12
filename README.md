# Time Capsule

<p align="center">
  <a href="README.md"><img alt="en" src="https://img.shields.io/badge/lang-en-red.svg"></a>
  <a href="README.cs.md"><img alt="cs" src="https://img.shields.io/badge/lang-cs-blue.svg"></a>
  <a href="README.ua.md"><img alt="ua" src="https://img.shields.io/badge/lang-ua-green.svg"></a>
  <a href="README.ru.md"><img alt="ru" src="https://img.shields.io/badge/lang-ru-yellow.svg"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 17" />
  <img src="https://img.shields.io/badge/Spring%20Boot-3.5.3-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot 3.5.3" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MongoDB-Sharded-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

Time Capsule is a web platform for creating, storing, opening and interacting with time capsules. Users can leave messages, files, photos, videos, geotags, comments and activity that become available only after a configured date or unlock condition is met.

The project combines a Spring Boot backend, a React/Vite frontend, a sharded MongoDB deployment and Docker Compose for local development and deployment.

---

## 📖 Overview

The main idea of the project is to let users leave messages for the future. Capsule unlock conditions may depend on time, authentication, content availability or other rules.

This project demonstrates not only a social platform, but the full lifecycle of:

- authentication and profiles
- capsule CRUD flows
- media content management
- maps and geotags
- chat and user activity
- administration and auditing
- MongoDB sharded architecture

---

## ✨ Features

- Create, edit and delete time capsules
- View capsules in multiple modes: calendar, map, list and profile
- Public and private capsules
- Access management based on unlock conditions
- Media storage for images, video and files
- Comments, reactions, subscriptions and activity feed
- Chat with other users
- Admin panel for user and data management
- OAuth login with Google and GitHub
- Automated startup via Docker Compose

---

## 🛠️ Tech Stack

### Frontend
- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Leaflet / Cesium
- STOMP / SockJS

### Backend
- Java 17
- Spring Boot 3.5
- Spring Web
- Spring Security
- Spring Data MongoDB
- Validation
- Actuator

### Data layer
- MongoDB sharded cluster
- Replica sets
- Config servers
- `mongos` router

### Infrastructure
- Docker Compose
- Nginx reverse proxy
- HTTPS termination for local development

---

## 🏗️ System Architecture

The application follows a layered architecture: public entry point, frontend client, backend API and a sharded MongoDB data layer.

| Layer | Description | Main components |
| --- | --- | --- |
| Edge layer | Public access and HTTPS termination | Nginx reverse proxy |
| Presentation layer | User interface and client-side navigation | React + Vite frontend |
| Application layer | Business logic, auth, API and realtime events | Spring Boot backend, OAuth, WebSocket |
| Data layer | Persistent storage and distributed database topology | MongoDB router, config servers, shards |

<p align="center">
  <img src="docs/images/image.png" alt="Time Capsule system architecture" width="1000" />
</p>

### Architecture overview

- The application is exposed through the host and proxied by nginx.
- The frontend runs in its own Docker container and communicates with the backend API.
- The backend handles authentication, capsule logic, media access, admin operations and realtime updates.
- MongoDB is deployed as a sharded cluster with config servers and replica sets for resilience.
- The platform also includes OAuth, notification and chat-related communication flows.

### Core domains

- Users and profiles
- Time capsules
- Media and attachments
- Comments, reactions and subscriptions
- Messages and chat
- Administration and audit
- Geotags and map activity

---

## 🧭 Architecture and project documentation

The repository already contains the real project diagrams and architecture artifacts. This README uses those actual materials instead of inventing new diagrams.

- [doc/dev playbook.md](doc/dev%20playbook.md) — local architecture, Docker Compose setup, MongoDB cluster and HTTPS notes.
- [frontend/README.md](frontend/README.md) — frontend stack, routes and environment conventions.
- [backend/pom.xml](backend/pom.xml) — backend runtime and technology stack.

### System deployment architecture

![Docker Compose deployment architecture](docs/images/image.png)

This diagram shows the host environment with the public web app, the reverse proxy, the frontend container, backend API and the MongoDB database stack.

### MongoDB cluster topology

![MongoDB sharded cluster topology](docs/images/image4.png)

This diagram visualizes the replicated shard configuration: config servers, the `mongos` router and the replica sets.

### Data model / domain model

![MongoDB data model](docs/images/image2.png)

This is the core domain model. It captures the relationships between users, capsules, comments, reactions, notifications, follows, reminders, tags and admin audit records.

### User flow / main application lifecycle

![User lifecycle and app flow](docs/images/image7.png)

This flow shows the main logic for users and administrators: registration, access checks, profile access and capsule operations.

### Capsule creation flow

![Capsule creation flow](docs/images/image6.png)

This diagram corresponds to the workflow for creating a capsule, evaluating whether it should be public or private, and deciding the final publication logic.

### Sequence diagram for automatic capsule opening

![Automatic capsule opening flow](docs/images/image3.png)

This sequence diagram illustrates the automated process in which the scheduler checks capsule status, updates it, triggers notifications and pushes updates to the frontend once a capsule becomes available.

### App use-case overview

![Use-case overview](docs/images/image5.png)

This diagram summarizes the main use cases of the system: scheduling, notifications, email service, websocket delivery and capsule-related actions.

### Architecture summary from the docs

The repository contains a Spring Boot backend, a React/Vite frontend, an nginx dev proxy and a local sharded MongoDB cluster. The app stack is launched in Docker Compose, with the database stack started first because the application compose expects the external Docker network `database_default`.

The documentation describes:

- a MongoDB `mongos` router on port `27017`
- three config server nodes
- three shard replica sets
- schema initialization and seed data import
- frontend served through nginx on `https://localhost`
- backend exposed on `http://localhost:8080`
- HTTPS redirect from `http://localhost` to `https://localhost`
- local self-signed certificate usage for development

---

## 🗂️ Project Structure

```text
Time-Capsule/
├── backend/                     # Spring Boot REST API
│   ├── src/main/java/
│   ├── src/test/java/
│   ├── pom.xml
│   └── mvnw / mvnw.cmd
├── frontend/                    # React + Vite frontend
│   ├── src/
│   ├── package.json
│   └── README.md
├── database/                    # MongoDB cluster and initialization scripts
│   ├── docker-compose.yml
│   ├── scripts/
│   ├── schemas/
│   └── data/
├── deploy/                      # main app stack docker-compose
│   └── docker-compose.yml
├── nginx/                       # reverse proxy config
├── doc/                         # docs and diagrams
├── docs/
│   └── images/                  # screenshots from documentation
├── target/
├── .gitignore
├── pom.xml
├── package.json
├── mvnw
├── mvnw.cmd
├── README.md
└── LICENSE
```

---

## 🧱 Data Model

The project uses MongoDB collections including:

- `users`
- `capsules`
- `geomarkers`
- `chat_messages`
- `comments`
- `reactions`
- `feed_events`
- `notifications`
- `follows`
- `shares`
- `tags`
- `media`
- `reminders`
- `pending_users`
- `admin_audit_logs`

This structure supports user activity, media content, comments, notifications, interaction and administrative auditing.

---

## 🚀 Getting Started

### Prerequisites

- Docker Desktop / Docker Engine
- Java 17+
- Maven or `./mvnw`
- Bun for frontend

### 1. Start the database

```bash
cd database
docker compose up -d --build
```

### 2. Start the app stack

```bash
cd deploy
docker compose up -d --build
```

### 3. Run the backend locally

```bash
cd backend
./mvnw test
./mvnw package
```

### 4. Run the frontend locally

```bash
cd frontend
bun install
bun run dev
```

### Default local URLs

- Frontend: https://localhost
- Backend: http://localhost:8080
- API health: https://localhost/api/hello
- OAuth: https://localhost/oauth2/authorization/google
- WebSocket: https://localhost/ws

---

## 🔐 Environment Variables

Main environment variables:

- `SPRING_DATA_MONGODB_URI`
- `SECURITY_JWT_SECRET_KEY`
- `VITE_API_URL`
- OAuth client ID and secret for Google and GitHub
- SMTP settings for email notifications
- `VITE_CESIUM_ION_TOKEN` (optional)

---

## 💡 User Flows

### Registration and login

A user registers, verifies the account and signs in. After that, they can access the profile, create capsules and interact with other users.

### Create capsule

The user sets the name, description, unlock date, visibility, location, media files and other capsule parameters.

### Open capsule

The system checks whether the unlock time has arrived, whether the user has access and whether the capsule has already been opened.

### Interaction

After opening the capsule, the user can:
- view the content
- leave comments
- add reactions
- share the capsule
- review activity history

---

## 📘 Project Documentation

The project documentation folder contains architecture notes, workflow descriptions and diagrams.

- [doc/dev playbook.md](doc/dev%20playbook.md)
- [frontend/README.md](frontend/README.md)
- [backend/pom.xml](backend/pom.xml)

---

## 📌 Notes

- Local HTTPS uses a self-signed certificate.
- Capsule opening depends on date validation and user access rules.
- For production, a more robust media storage strategy is recommended.
- The MongoDB sharded cluster is a key architecture element of the project.

---

## ✅ Summary

Time Capsule is a full-stack platform combining user profiles, social activity, media storage, geolocation, admin management and time-based capsule logic.

It is a strong example of a project built with:
- Java / Spring Boot
- React / Vite
- MongoDB sharding
- Docker Compose
- OAuth and security
- documentation-based architecture design

---

<p align="center">
  <strong>Time Capsule</strong><br>
  <em>Documentation for a future-proof memory platform</em>
</p>
