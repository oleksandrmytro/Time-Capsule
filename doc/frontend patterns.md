Ниже набросок **frontend\_patterns.md** – добавьте его рядом с `backend_patterns.md`, чтобы оба файла выглядели «одной рукой написанные».
Вёрстка, таблички и emoji‑акценты повторяют стиль backend‑документа и commit‑rules.md.

---

# Frontend Patterns & Code Style (React + JS / JSX)

| Раздел                     | TL;DR / что запомнить                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| **Файлы компонентов**      | `PascalCase.tsx` = имя default‑экспорта – `CreateEventForm.jsx`.             |
| **Hooks**                  | префикс **use** – `useParticipants`, `useDrawAssignments`.                   |
| **Состояние / переменные** | `camelCase` – `isLoading`, `currentPage`.                                    |
| **Параметры**              | только объект‑деструктуризация – `startGame({ participants, isAnonymous })`. |
| **Tailwind**               | utility‑first; повторяющиеся цепочки → `@apply` или `<UI.Button/>`.          |
| **Структура**              | **containers** (логика) ↔ **components** (чистый UI).                        |
| **Custom Hooks**           | всё, что использует `useState`/`useEffect` > 1 раза.                         |
| **Импорты**                | абсолютные алиасы – `@components/Header`, `@hooks/useApi`.                   |
| **Sanitize**               | каждый инпут через `sanitizeInput(value)` (+ DOMPurify для html).            |
| **API‑service**            | singleton `/services/api.js` с fetch/axios; ни одного fetch в UI.            |
| **Арх. паттерн**           | выбрать лучший - подробности ниже.                |
| **Тесты**                  | Jest + React Testing Library: unit / integration / e2e (Playwright).         |

---

## 1 . Дерево проекта

```
frontend/
├─ src/
│  ├─ components/        # чистый UI (stateless / “dumb”)
│  │   └─ CreateEventForm/
│  │       ├─ index.jsx  # default export CreateEventForm
│  │       └─ styles.css # @apply из Tailwind, только стили
│  ├─ containers/        # smart‑компоненты (state, hooks, routing)
│  │   └─ CreateEvent/
│  │       └─ index.jsx
│  ├─ hooks/             # useSomething.js
│  ├─ services/
│  │   └─ api.js         # axios instance + методы
│  ├─ utils/             # sanitizeInput.js, validators.js
│  ├─ pages/             # Next/Router entry‑points (если SPA‑router)
│  └─ index.jsx
└─ tailwind.config.js
```

*Папка соответствует ответственности; имена – одно слово.*

---

## 2 . Компоненты & Hooks

```jsx
// components/CreateEventForm/index.jsx
export default function CreateEventForm({
  participants,
  drawDate,
  onSubmit,
  isLoading,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* только вывод + вызов колбэков */}
    </form>
  );
}

// hooks/useParticipants.js
import { useState, useEffect } from 'react';
import api from '@services/api';

export default function useParticipants(eventId) {
  const [participants, setParticipants] = useState([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/events/${eventId}/participants`)
      .then(({ data }) => setParticipants(data))
      .finally(() => setLoading(false));
  }, [eventId]);

  return { participants, isLoading };
}
```

* UI‑компонент **никогда** не делает `fetch`, не мутирует стейт сам.
* Вся логика – в контейнере или hook\`е.

---

## 3 . Tailwind CSS

* **Utility‑first**: классами прямо в JSX.
* Повторяющиеся цепочки → `@apply` в `*.css` или выносим в re‑usable UI‑компонент (`<Button variant="primary"/>`).
* Глобальные переменные цвета/шрифтов – в `tailwind.config.js`.

---

## 4 . Sanitization & Validation

| Где                | Что делаем                                        |
| ------------------ | ------------------------------------------------- |
| **Input onChange** | `setValue(sanitizeInput(e.target.value))`         |
| **Dangerous HTML** | `DOMPurify.sanitize(markdownToHtml(md))`          |
| **API‑payload**    | `encodeURIComponent`, schema‑validation (Yup/Zod) |

`utils/sanitizeInput.js` – центральная функция; меняем её – чистим весь фронт.

---

## 5 . Архитектурные шаблоны UI

| Шаблон                          | Плюсы                                                      | Минусы / “не наше”                |
| ------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| **MVP** (Model‑View‑Presenter)  | Лёгкое тестирование Presenter                              | Много boilerplate, callbacks hell |
| **MVVM** (…‑View‑ViewModel)     | Двусторонний binding                                       | Binding ≠ React philosophy        |
| **MVVM‑C** (MVVM + Coordinator) | Чистая навигация                                           | Всё ещё нужен binding             |
| **MVI** (Model‑View‑Intent)     | Однонаправленный поток, Redux‑подобно                      | Болезненное иммутабельное дерево  |
| **MVI‑C** (MVI + Coordinator)     | ✔ Однонаправлено, ✔ hooks‑friendly, ✔ минимум кода во View | Чуть сложнее для новичков         |

> **То с чем я работал:** **MVI** –
> *Container* генерирует **Intents** (события UI), редьюсер превращает их в новое **Model** (состояние), а **View** (чистый компонент) лишь *отражает* состояние.
> Под React‑hooks это выглядит естественно: `useReducer` внутри контейнера + контекст или props‑drilling.

```
[User Action] ---> Intent ---> Reducer ---> Model (state) ---> View(UI)
                                         ▲
                                         ╰────────────── side‑effects(api)
```

* UI‑слой остаётся «тупым» ⇒ упрощённые snapshot‑тесты.
* Логику легко мемоизировать, мокать, покрывать unit‑тестами.

---

## 6 . API Service Layer

```js
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  r => r,
  err => {
    // глобальный обработчик ошибок / toaster
    return Promise.reject(err);
  }
);

export default api;
```

* Точка входа одна; переиспользование 100 %.
* В тестах мокаем через `axios-mock-adapter` — UI остаётся детерминированным.

---

## 7 . Тестирование

| Тип             | Инструмент | Что проверяем                     |
| --------------- | ---------- | --------------------------------- |
| **Unit**        | Jest + RTL | hook‑логика, редьюсеры, utils.    |
| **Integration** | RTL        | контейнер + mock api / router.    |
| **E2E**         | Playwright | сценарии пользователя в браузере. |

Названия: `CreateEventForm.test.jsx`, `useParticipants.test.js`.
CI: `npm run lint && npm test --coverage`.

---

## 8 . Lint + CI

* **ESLint** (airbnb‑config) + **Prettier** – обязательные git‑pre‑commit hooks (Husky).
* Jest‑coverage ≥ 80 %.
* GitHub Actions: lint → test → build → docker‑image → deploy.

---

## 9 . TL;DR

> **«Чистый UI, жирные контейнеры, одна ось данных»**
> Компонент ничего не знает про fetch, только отображает props.
> Любые данные проходят через: **sanitize → validate → service → reducer → view**.
> Один стиль на весь проект – читаем, добавляем, кайфуем. ✨
