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

Time Capsule — це веб-платформа для створення, зберігання, відкриття та взаємодії з капсулами часу. Користувачі можуть залишати повідомлення, файли, фото, відео, геомітки, коментарі та активність, які стають доступними лише після настання заданої дати або виконання умов розблокування.

Проєкт поєднує Spring Boot backend, React/Vite frontend, шардований MongoDB і Docker Compose для локального запуску та розгортання.

---

## 📖 Огляд проєкту

Основна ідея проєкту — надати користувачеві можливість залишати повідомлення для майбутнього. Умови відкриття капсули можуть залежати від дати, авторизації, наявності контенту або інших правил.

Цей проєкт демонструє не лише функціональність соціальної платформи, а й повний цикл роботи з:

- авторизацією та профілями
- CRUD для капсул
- медіа-контентом
- картами та геомітками
- чатом і активністю
- адміністративним управлінням
- архітектурою MongoDB із шардованим сховищем

---

## ✨ Основні можливості

- Створення, редагування та видалення капсул часу
- Перегляд капсул у різних режимах: календар, карта, список і профіль
- Публічні та приватні капсули
- Система доступу до капсул за умовами відкриття
- Зберігання медіа: зображення, відео, файли
- Коментарі, реакції, підписки та стрічка активності
- Чат з іншими користувачами
- Адмін-панель для керування користувачами та даними
- OAuth-логін через Google/GitHub
- Автоматизований запуск через Docker Compose

---

## 🛠️ Технологічний стек

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

## 🏗️ Архітектура системи

Застосунок має класичну шарову архітектуру: зовнішня точка входу, клієнтський інтерфейс, бекенд API та шардоване сховище MongoDB.

| Шар | Опис | Основні компоненти |
| --- | --- | --- |
| Edge layer | Публічний доступ і завершення HTTPS | Nginx reverse proxy |
| Presentation layer | Інтерфейс користувача та клієнтська навігація | React + Vite frontend |
| Application layer | Бізнес-логіка, авторизація, API та events | Spring Boot backend, OAuth, WebSocket |
| Data layer | Постійне сховище та розподілена база даних | MongoDB router, config servers, shards |

<p align="center">
  <img src="docs/images/image.png" alt="Time Capsule system architecture" width="1000" />
</p>

### Огляд архітектури

- Застосунок доступний через хост і проксується через nginx.
- Фронтенд запускається в окремому Docker-контейнері і взаємодіє з бекенд API.
- Бекенд відповідає за авторизацію, логіку капсул, доступ до медіа, адміністративні операції та оновлення в реальному часі.
- MongoDB розгорнуто як шардований кластер із config-серверами та replica sets для надійності.
- У системі також є потоки OAuth, сповіщень і чату.

### Основні домени системи

- Користувачі та профілі
- Капсули часу
- Медіа та вкладення
- Коментарі, реакції та підписки
- Повідомлення й чат
- Адміністрування та аудит
- Геомітки та активність на карті

---

## 🧭 Архітектура та документація проєкту

У репозиторії вже є реальні діаграми й артефакти архітектури. Цей README використовує саме ці матеріали, а не вигадані схеми.

- [doc/dev playbook.md](doc/dev%20playbook.md) — локальна архітектура, Docker Compose, шардований MongoDB і HTTPS.
- [frontend/README.md](frontend/README.md) — стек фронтенду, маршрути й конвенції змінних середовища.
- [backend/pom.xml](backend/pom.xml) — стек технологій бекенду та Java/Spring Boot.

### Схема розгортання системи

![Docker Compose deployment architecture](docs/images/image.png)

Ця діаграма показує хост-середовище з веб-додатком, reverse proxy, frontend-контейнером, backend API та стеком MongoDB.

### Топологія MongoDB-кластера

![MongoDB sharded cluster topology](docs/images/image4.png)

Ця діаграма відображає конфігурацію репліка-сетів, config-серверів і маршрутизатора `mongos`.

### Модель даних / доменна модель

![MongoDB data model](docs/images/image2.png)

Це основна доменна модель. Вона показує зв’язки між користувачами, капсулами, коментарями, реакціями, сповіщеннями, підписками, нагадуваннями, тегами й аудитом адміністратора.

### Флоу користувача / життєвий цикл додатку

![User lifecycle and app flow](docs/images/image7.png)

Цей флоу описує логіку користувача й адміністратора: реєстрація, перевірка доступу, управління панеллю, профіль та операції з капсулами.

### Потік створення капсули

![Capsule creation flow](docs/images/image6.png)

Ця діаграма відповідає процесу створення капсули, перевірці публічності/приватності та остаточному логічному публікуванню.

### Sequence diagram автоматичного відкриття капсули

![Automatic capsule opening flow](docs/images/image3.png)

Ця діаграма показує автоматизований процес, у якому планувальник перевіряє статус капсули, оновлює її стан, запускає сповіщення й надсилає оновлення на фронтенд, коли капсула стає доступною.

### Огляд use-case системи

![Use-case overview](docs/images/image5.png)

Ця схема підсумовує основні сценарії системи: планування, сповіщення, email-сервіс, websocket-передачу, клієнтські дії та операції з капсулами.

### Резюме з документації

Репозиторій містить Spring Boot backend, React/Vite frontend, nginx dev proxy і локальний шардований MongoDB cluster. Стек запускається через Docker Compose, а базовий стек БД стартує раніше, бо основний compose очікує зовнішню Docker мережу `database_default`.

Документація описує:

- MongoDB `mongos` router на порту `27017`
- три config-сервери
- три shard replica sets
- ініціалізацію схем і імпорт seed-даних
- frontend через nginx на `https://localhost`
- backend на `http://localhost:8080`
- редірект з `http://localhost` на `https://localhost`
- локальний self-signed certificate для розробки

---

## 🗂️ Структура проєкту

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

## 🧱 Модель даних

Проєкт працює з колекціями MongoDB, серед яких:

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

Ця структура підтримує сценарії з активністю, медіа, коментарями, сповіщеннями, взаємодією та адміністративним аудитом.

---

## 🚀 Початок роботи

### Передумови

- Docker Desktop / Docker Engine
- Java 17+
- Maven або `./mvnw`
- Bun для фронтенду

### 1. Запуск бази даних

```bash
cd database
docker compose up -d --build
```

### 2. Запуск основного стеку

```bash
cd deploy
docker compose up -d --build
```

### 3. Локальний запуск backend

```bash
cd backend
./mvnw test
./mvnw package
```

### 4. Локальний запуск frontend

```bash
cd frontend
bun install
bun run dev
```

### Типові локальні URL

- Frontend: https://localhost
- Backend: http://localhost:8080
- API health: https://localhost/api/hello
- OAuth: https://localhost/oauth2/authorization/google
- WebSocket: https://localhost/ws

---

## 🔐 Змінні середовища

Основні змінні середовища:

- `SPRING_DATA_MONGODB_URI`
- `SECURITY_JWT_SECRET_KEY`
- `VITE_API_URL`
- OAuth client ID / secret для Google і GitHub
- SMTP налаштування для email-сповіщень
- `VITE_CESIUM_ION_TOKEN` (необов’язково)

---

## 💡 Основні сценарії користувача

### Реєстрація та вхід

Користувач реєструється, підтверджує обліковий запис і входить у систему. Після цього має доступ до профілю, створення капсул і взаємодії з іншими користувачами.

### Створення капсули

Користувач задає назву, опис, дату відкриття, видимість, місце розташування, медіа-файли та інші параметри капсули.

### Відкриття капсули

Система перевіряє, чи настав час відкриття, чи є доступ у користувача і чи капсула вже була відкрита.

### Взаємодія

Після відкриття капсули користувач може:
- переглядати вміст
- залишати коментарі
- ставити реакції
- ділитися капсулою
- переглядати історію активності

---

## 📘 Документація проєкту

Папка з документацією містить опис архітектури, робочих процесів і діаграм проєкту.

- [doc/dev playbook.md](doc/dev%20playbook.md)
- [frontend/README.md](frontend/README.md)
- [backend/pom.xml](backend/pom.xml)

---

## 📌 Примітки

- Локальний HTTPS використовує самопідписаний сертифікат.
- Відкриття капсул залежить від перевірки дати й прав доступу.
- Для продакшну рекомендовано більш надійне сховище медіа.
- Шардований MongoDB кластер є ключовим елементом архітектури проєкту.

---

## ✅ Підсумок

Time Capsule — це повноцінний full-stack проєкт, що поєднує профілі користувачів, соціальну активність, медіа, геолокацію, адміністрування та логіку капсул часу.

Це хороший приклад проєкту, що побудований на:
- Java / Spring Boot
- React / Vite
- MongoDB sharding
- Docker Compose
- OAuth і security
- архітектурі, прив’язаної до документації

---

<p align="center">
  <strong>Time Capsule</strong><br>
  <em>Документація для платформи пам’яті на майбутнє</em>
</p>
