# Time Capsule — Dev Workspace   

*Docker Compose* + **React (Vite + Bun) hot-reload** + **Spring Boot DevTools**.  
Цель — чтобы любой разработчик клон-→ `docker compose up` → кодит, а всё
пересобирается/обновляется само.

---

## 1 . TL;DR (5-минутный старт)

```bash
git clone https://github.com/<you>/timecapsule.git
cp dev.env.example dev.env          # настроить локальные ENV при желании
docker compose up -d --build        # ⚡ фронт  + бек + nginx
````

| URL                                                      | Что это                            |
| -------------------------------------------------------- | ---------------------------------- |
| [http://localhost](http://localhost)                     | React dev-сервер (HMR) через nginx |
| [http://localhost/api/hello](http://localhost/api/hello) | Тестовый контроллер Spring Boot    |
| ws\://localhost/vite-dev/ws                              | Web-Socket HMR (Vite 7)            |
| `:5005` (IDE attach)                                     | Remote Debug (Java)                |

---

## 2 . Стек & структура

```
/backend         # Spring Boot 3.5 (Java 21)
  ├─ src/...
  └─ Dockerfile

/frontend        # React 18 (Vite 7 + Bun + Tailwind)
  ├─ src/...
  └─ Dockerfile

/nginx           # конфиг для проксирования / HMR / API
deploy/          # docker-compose.yml  + dev.env
*.md             # docs & conventions
```

* **backend\_patterns.md / frontend\_patterns.md** — правила кода
* **commit rules.md** — Conventional Commits (type + scope)

---

## 3 . Dev workflow (живой код без перезапуска контейнеров)

| Слой       | Что делаю          | Что происходит под капотом                                                                             |
| ---------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| **React**  | `Ctrl + S` JSX/CSS | Vite пересобирает ↔ nginx проксирует `/vite-dev/ws` → UI patch без F5                                  |
| **Java**   | `Rebuild module`   | IDEA компилит → volume `target/classes` обновляется → DevTools *Restart completed in 0.8 s* |
| **Docker** | —                  | Перезапуск *не нужен* — классы/HMR грузятся внутри работающих контейнеров                              |

> Если нужна IDE автокомпиляция — включи
> *Settings → Compiler → “Build project automatically”* и
> `compiler.automake.allow.when.app.running = true` через Registry.

---

## 4 . Переменные окружения

| Файл / место            | Что кладём                                              |
| ----------------------- | ------------------------------------------------------- |
| **deploy/dev.env**      | локальные значения (`MONGO_URI`, `REACT_APP_API_URL` …) |
| **application-dev.yml** | placeholders `${…}` — без секретов!                     |
| **vite.config.js**      | `VITE_API_URL = ${process.env.VITE_API_URL}`            |

На проде `dev.env` **не** коммитится — значения приходят из k8s Secret/ConfigMap.

---

## 5 . Git flow (ветки + коммиты)

| Ветка          | Назначение                    |
| -------------- | ----------------------------- |
| **main**       | Авто-деплой на production. До первого релиза == dev ветка |
| **dev**        | Текущая стабильная разработка |
| **feature/**\* | Каждая фича, дальше через **PR** добавляется в дев ветку |
| **hotfix/**\*  | Баг фикс, дальше через **PR** добавляется в дев\main ветку |

Коммит: `<type>(<scope>): <subject>` — полный список `type/scope` в *commit rules.md*.

---

## 6 . Запуск тестов

```bash
# frontend
docker compose exec frontend bun test

# backend
docker compose exec backend mvn -q test
```

CI проверяет: **lint → test → build docker-images**, затем выкатывает на staging.

---

## 7 . Частые вопросы 🤔

| Вопрос                                          | Ответ                                                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| «HMR не патчит React, вижу только *hmr update*» | Убедись, что nginx проксирует `/vite-dev/` и в `vite.config.js` указан `hmr.path = '/vite-dev/ws'`.               |
| «Java отдаёт старые данные»                     | Проверь, что пересобирается `target/classes` (смонтирован как volume) и в логе Spring есть `Restart completed …`. |
| «IDE не компилит автоматически»                 | *Build → Build Project Automatically* + Registry-флаг `compiler.automake.allow.when.app.running`.                 |
| «Где переменные для прода?»                     | В k3s — ConfigMap/Secret, docker image не содержит чувствительных данных.                                         |

---

## 8 . Полезные скрипты 
Команды для винды, в линуксе будет `docker compose`
```bash
# полный ребилд образов
docker-compose build --no-cache

# лог только бекенда
docker-compose logs -f backend

# curl изнутри nginx (debug proxy)
docker-compose exec nginx curl -I http://backend:8080/api/hello
```

---

## 9 . Дальше по чтению

* **backend\_patterns.md** — пакеты, сервисы, тест-пирамиды.
* **frontend\_patterns.md** — структура React, Tailwind, hooks.
* **commit rules.md** — как назвать ветку/коммит.
