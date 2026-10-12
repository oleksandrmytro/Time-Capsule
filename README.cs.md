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

Time Capsule je webová platforma pro vytváření, ukládání, otevírání a interakci s časovými kapslemi. Uživatelé mohou ukládat zprávy, soubory, fotografie, videa, geoznačky, komentáře a aktivitu, která se zpřístupní až po dosažení zadaného data nebo splnění podmínek odemčení.

Projekt kombinuje Spring Boot backend, React/Vite frontend, sharded MongoDB a Docker Compose pro lokální spuštění a nasazení.

---

## 📖 Přehled projektu

Hlavním cílem projektu je umožnit uživateli nechat zprávy pro budoucnost. Podmínky odemčení kapsle mohou záviset na čase, autorizaci, dostupnosti obsahu nebo jiných pravidlech.

Tento projekt ukazuje nejen sociální platformu, ale i celý životní cyklus práce s:

- autorizací a profily
- CRUD pro kapsle
- mediálním obsahem
- mapami a geoznačkami
- chatem a aktivitou
- administrací a auditingem
- architekturou MongoDB se sharded úložištěm

---

## ✨ Hlavní funkce

- Vytváření, úprava a mazání časových kapslí
- Prohlížení kapslí v různých režimech: kalendář, mapa, seznam a profil
- Veřejné a soukromé kapsle
- Správa přístupu podle podmínek odemčení
- Ukládání médií: obrázky, video, soubory
- Komentáře, reakce, sledování a activity feed
- Chat s ostatními uživateli
- Admin panel pro správu uživatelů a dat
- OAuth přihlášení přes Google/GitHub
- Automatické spuštění přes Docker Compose

---

## 🛠️ Tech stack

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

## 🏗️ Architektura systému

Aplikace používá vrstvenou architekturu: vnější vstupní bod, frontend klient, backend API a sharded MongoDB data layer.

| Vrstva | Popis | Hlavní komponenty |
| --- | --- | --- |
| Edge layer | Veřejný přístup a HTTPS terminace | Nginx reverse proxy |
| Presentation layer | Uživatelské rozhraní a klientská navigace | React + Vite frontend |
| Application layer | Business logika, auth, API a realtime události | Spring Boot backend, OAuth, WebSocket |
| Data layer | Trvalé úložiště a distribuovaná databáze | MongoDB router, config servers, shards |

<p align="center">
  <img src="docs/images/image.png" alt="Time Capsule system architecture" width="1000" />
</p>

### Přehled architektury

- Aplikace je přístupná přes host a proxyována přes nginx.
- Frontend běží v samostatném Docker kontejneru a komunikuje s backend API.
- Backend zajišťuje autorizaci, logiku kapslí, přístup k médiím, admin operace a realtime aktualizace.
- MongoDB je nasazeno jako sharded cluster s config servery a replica sets pro odolnost.
- V systému se také objevují OAuth, notifikace a chatové toky.

### Hlavní domény systému

- Uživatelé a profily
- Časové kapsle
- Média a přílohy
- Komentáře, reakce a odběry
- Zprávy a chat
- Administrace a audit
- Geoznačky a aktivita na mapě

---

## 🧭 Architektura a dokumentace projektu

V repozitáři jsou již k dispozici skutečné diagramy a artefakty architektury. Tento README používá právě tato data místo vynálezu nových schémat.

- [doc/dev playbook.md](doc/dev%20playbook.md) — lokální architektura, Docker Compose, sharded MongoDB a HTTPS.
- [frontend/README.md](frontend/README.md) — frontend stack, routy a env proměnné.
- [backend/pom.xml](backend/pom.xml) — backend runtime a technologie Java/Spring Boot.

### Schéma nasazení systému

![Docker Compose deployment architecture](docs/images/image.png)

Tento diagram ukazuje hostitelské prostředí s veřejnou web aplikací, reverse proxy, frontend kontejnerem, backend API a MongoDB stackem.

### Topologie MongoDB clusteru

![MongoDB sharded cluster topology](docs/images/image4.png)

Diagram zobrazuje konfiguraci replica setů, config serverů a routeru `mongos`.

### Datový model / doménový model

![MongoDB data model](docs/images/image2.png)

Toto je klíčový doménový model. Zobrazuje vztahy mezi uživateli, kapslemi, komentáři, reakcemi, notifikacemi, followery, připomínkami, tagy a admin auditem.

### User flow / životní cyklus aplikace

![User lifecycle and app flow](docs/images/image7.png)

Tento flow popisuje logiku uživatele a administrátora: registrace, kontrola přístupu, správce panelů, profil a operace s kapslemi.

### Tok vytvoření kapsle

![Capsule creation flow](docs/images/image6.png)

Tento diagram odpovídá procesu vytváření kapsle, posouzení, zda bude veřejná nebo soukromá, a finální publikaci.

### Sequence diagram automatického otevření kapsle

![Automatic capsule opening flow](docs/images/image3.png)

Tento sekvenční diagram ukazuje automatický proces, kdy scheduler kontroluje stav kapsle, aktualizuje její status, spouští notifikace a posílá aktualizace do frontendu, jakmile je kapsle dostupná.

### Přehled use-case systému

![Use-case overview](docs/images/image5.png)

Tento diagram shrnuje hlavní use case systému: plánování, notifikace, email service, websocket doručování a akce související s kapslemi.

### Shrnutí z dokumentace

Repo obsahuje Spring Boot backend, React/Vite frontend, nginx dev proxy a lokální sharded MongoDB cluster. Stack je spuštěn přes Docker Compose a databázový stack se spouští dříve, protože aplikace očekává externí Docker síť `database_default`.

Dokumentace popisuje:

- MongoDB `mongos` router na portu `27017`
- tři config servery
- tři shard replica sets
- inicializaci schémat a import seed dat
- frontend přes nginx na `https://localhost`
- backend na `http://localhost:8080`
- přesměrování z `http://localhost` na `https://localhost`
- lokální self-signed certifikát pro vývoj

---

## 🗂️ Struktura projektu

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

## 🧱 Datový model

Projekt používá MongoDB collections včetně:

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

Tato struktura podporuje scénáře s aktivitou, médii, komentáři, notifikacemi, interakcí a administrativním auditem.

---

## 🚀 Začátek práce

### Předpoklady

- Docker Desktop / Docker Engine
- Java 17+
- Maven nebo `./mvnw`
- Bun pro frontend

### 1. Spuštění databáze

```bash
cd database
docker compose up -d --build
```

### 2. Spuštění hlavního stacku

```bash
cd deploy
docker compose up -d --build
```

### 3. Spuštění backendu lokálně

```bash
cd backend
./mvnw test
./mvnw package
```

### 4. Spuštění frontendu lokálně

```bash
cd frontend
bun install
bun run dev
```

### Výchozí lokální URL

- Frontend: https://localhost
- Backend: http://localhost:8080
- API health: https://localhost/api/hello
- OAuth: https://localhost/oauth2/authorization/google
- WebSocket: https://localhost/ws

---

## 🔐 Proměnné prostředí

Hlavní environment proměnné:

- `SPRING_DATA_MONGODB_URI`
- `SECURITY_JWT_SECRET_KEY`
- `VITE_API_URL`
- OAuth client ID / secret pro Google a GitHub
- SMTP nastavení pro email notifikace
- `VITE_CESIUM_ION_TOKEN` (volitelné)

---

## 💡 Hlavní user flows

### Registrace a přihlášení

Uživatel se zaregistruje, ověří účet a přihlásí se. Poté může přistupovat k profilu, vytvářet kapsle a komunikovat s ostatními uživateli.

### Vytvoření kapsle

Uživatel nastavuje jméno, popis, datum odemčení, viditelnost, umístění, mediální soubory a další parametry kapsle.

### Otevření kapsle

Systém zkontroluje, zda nastal čas odemčení, zda má daný uživatel přístup a zda už byla kapsle otevřena.

### Interakce

Po otevření kapsle může uživatel:
- prohlížet obsah
- přidávat komentáře
- přidávat reakce
- sdílet kapsli
- prohlížet historii aktivity

---

## 📘 Dokumentace projektu

Složka dokumentace obsahuje popisy architektury, pracovních procesů a diagramů projektu.

- [doc/dev playbook.md](doc/dev%20playbook.md)
- [frontend/README.md](frontend/README.md)
- [backend/pom.xml](backend/pom.xml)

---

## 📌 Poznámky

- Lokální HTTPS používá self-signed certifikát.
- Otevření kapslí závisí na ověření data a přístupových pravidlech.
- Pro produkci je doporučeno robustnější úložiště médií.
- Sharded MongoDB cluster je klíčovým prvkem architektury projektu.

---

## ✅ Shrnutí

Time Capsule je plnohodnotný full-stack projekt, který kombinuje profily uživatelů, sociální aktivitu, media, geolokaci, admin správu a logiku časových kapslí.

Je to dobrý příklad projektu postaveného na:
- Java / Spring Boot
- React / Vite
- MongoDB sharding
- Docker Compose
- OAuth a security
- dokumentací vázané architektury

---

<p align="center">
  <strong>Time Capsule</strong><br>
  <em>Dokumentace pro platformu paměti do budoucnosti</em>
</p>
