### Conventional Commits: полный перечень **type** и основных **scope**

| `type`       | Когда использовать                                                                                                                             | Примеры subject                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **feat**     | Добавление новой пользовательской или бизнес‑функции.                                                                                          | `feat(r event): enable RSVP links`                |
| **fix**      | Исправление ошибки, баг‑фикса.                                                                                                                 | `fix(j participant): null‑pointer on save`        |
| **dev**      | Изменения в локальной среде разработчика (IDE‑файлы, запуск скриптов).                                                                         | `dev(env): add VS Code launch config`             |
| **docs**     | Любая документация — README, Javadoc, ADR.                                                                                                     | `docs(db): ER diagram for events schema`          |
| **style**    | Только форматирование, правка стиля кода/CSS, без изменения логики.                                                                            | `style(r): run Prettier`                          |
| **refactor** | Реструктуризация кода без изменения внешнего поведения.                                                                                        | `refactor(j user): split service into strategies` |
| **test**     | Добавление/правка тестов, моков, тест‑данных.                                                                                                  | `test(r hooks): add useDrawAssignments.spec.ts`   |
| **chore**    | «Домашние» задачи, не влияющие на исходники приложения (обновить зависимости, почистить скрипты).                                              | `chore: bump eslint‑config to 9.x`                |
| **build**    | Изменения системы сборки или зависимостей прод‑артефакта (Maven pom, webpack, Dockerfile labels).                                              | `build(j): add jlink step for slim image`         |
| **ci**       | Файлы конфигурации CI/CD, пайплайны.                                                                                                           | `ci(github): add staging deploy job`              |
| **perf**     | Улучшения производительности без изменения функционала.                                                                                        | `perf(j assignment): reduce SQL joins`            |
| **revert**   | Откат предыдущего коммита. Заголовок формируется автоматически: `revert: <original header>`                                                    | `revert: feat(r event): enable RSVP links`        |
| **env**      | Шаги, влияющие на окружение разработки или инфраструктуру, но **не** код приложения (например .gitignore, .editorconfig, Docker Desktop docs). | `env(env): add .env.example for local setup`      |

---

#### Основные `scope` — что ставить в круглых скобках

| `scope`                                      | Охват / директория                                                                    | Пример                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| **r …**                                      | Frontend (React, Tailwind). Уточняем модуль: `r ui`, `r hooks`, `r assignment`.       | `feat(r ui): add modal component`            |
| **j …**                                      | Backend (Java / Spring Boot). Уточняем bounded‑context: `j event`, `j participant`.   | `fix(j participant): validation message`     |
| **d**                                        | Docker‑сборки, Dockerfile, Compose.                                                   | `build(d): multi‑stage image`                |
| **k**                                        | Kubernetes/k3s манифесты, Helm Charts.                                                | `ci(k): bump ingress‑class annotation`       |
| **db**                                       | Миграции БД, схемы, seed‑данные.                                                      | `feat(db): add assignments table`            |
| **ci**                                       | Файлы CI‑конвейеров (GitHub Actions, GitLab CI).                                      | `ci: cache Maven deps`                       |
| **se**                                       | Документы, README, диаграммы, архитектурные схемы, ADR, PlantUML — «software engineering» документы.     | `docs(se): add C4 context diagram`           |
| **env**                                      | Файлы окружения разработчика: `.env`, `.gitignore`, `devcontainer.json`, IDE конфиги. | `env: ignore IntelliJ .idea/`                |              
| **event**, **participant**, **assignment** … | Доменные под‑модули (backend и/или frontend).                                         | `feat(event): support multi‑currency budget` |
| **\***                                       | Общесистемные изменения, нет точного модуля. Крайний случай.                          | `chore(*): regenerate lockfiles`             |

> **Правило выбора scope:**
> – Если затронут только фронт: `r …` и подпроект.
> – Только бэкенд: `j …`.
> – Если изменение затрагивает несколько частей, например `r` и `j`, то они записываются в формате `(r, j …)`.
> – Затронута инфраструктура: `d`, `k`, `ci`, `env`.
> – Конкретная бизнес‑область (events, participants) — используем её прямо, без префикса.
> – Если изменение охватывает весь репозиторий, допустимо `*`, но старайтесь избегать.

---

### Шаблон коммита

```
<type>(<scope>): <subject>         # ≤ 50 символов, без точки
(blank line)
Body: объясняем «что» и «почему».
Может быть несколько абзацев, списки, ссылки на Issue (#123).
(blank line)
BREAKING CHANGE: описание (если есть)
Co-Authored-By: Full Name <user@example.com>
```

**Пример**

```
feat(r assignment): add avoidance draw algorithm

Implements the “no self/gift loop” drawing strategy requested in #108.
Reuses Fisher–Yates shuffle with retry up to 5 attempts.

BREAKING CHANGE: endpoint /assignments/draw renamed to /assignments/random
```

Следуя этой таблице type + scope, история станет предсказуемой, а поиск по `git log --grep` — удобным.
