# PADEL TOURNAMENTS

Статический каталог падел-турниров Москвы на Vite, React, TypeScript и CSS. Адаптивная сетка, поиск, фильтры, сортировка и shareable URL. Никаких серверов для работы демоверсии, регистрации и аналитики.

**Сейчас сайт показывает явно обозначенные синтетические демоданные, а не актуальные турниры LUNDA.**

## Локально

Node.js 22.18+:

```sh
npm install
npm run dev
```

Откройте `http://localhost:5173/Tourgames/`. Для телефона в той же Wi-Fi сети используйте адрес Network из вывода Vite и путь `/Tourgames/`.

```sh
npm test
npm run build
npm run preview
```

Production preview: `http://localhost:4173/Tourgames/`. Результат сборки — `dist/`. Сборка включает TypeScript-проверку; отдельного lint script нет.

## GitHub Pages

Remote сохранён: `https://github.com/OvsyankinVI/Tourgames.git`. После самостоятельного commit/push в `main`:

1. В GitHub откройте **Settings → Pages → Source → GitHub Actions**.
2. Workflow `.github/workflows/deploy.yml` выполнит `npm ci`, тесты, сборку и официальный Pages deployment. Если первый запуск произошёл до включения Pages, повторите его через Actions → Deploy to GitHub Pages → Run workflow.
3. Сайт: `https://ovsyankinvi.github.io/Tourgames/`.

Base path задаётся в **одном месте**, `PAGES_BASE` в `vite.config.ts`. Для другого репозитория поменяйте `/Tourgames/` на `/<repository>/`, для собственного домена — на `/`. Assets используют Vite base; маршрутизатора нет, фильтры находятся в query string. Деплой соответствует [руководству Vite для GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages).

## Источник и безопасность

Исходный cURL разобран до реализации:

- URL: `https://appcloud.lundapadel.ru/api/tourgame/load-list`, метод **POST** (`--data`), JSON `{ parameters: ... }`.
- `X-Auth-Token` — секрет авторизации, дублирован в Cookie `auth-token`. `X-Profile-Id` — привязанный к пользователю идентификатор. `Authorization`, Bearer, отдельные refresh token и API key в запросе отсутствуют.
- Для JSON нужны `Content-Type: application/json`, опционально `Accept: application/json`. Сервер требует credential: запрос без него 30.09.2026 вернул **401 / missing auth token**. Необходимость `X-Profile-Id`, app-version и других прикладных заголовков с действующим токеном не проверялась; не утверждается, что известен точный минимальный авторизованный набор.
- `Host`, `Origin`, `Connection`, `Sec-Fetch-*`, User-Agent, Priority — транспортные/browser headers, вручную в frontend не копируются. X-Request-ID не нужен UI.
- Preflight OPTIONS и POST проверены без credentials с origin `https://ovsyankinvi.github.io`: сервер вернул соответствующий `Access-Control-Allow-Origin`, разрешил POST и `content-type,x-auth-token,x-profile-id`. **Блокировка CORS для этого origin не обнаружена**, но полноценный авторизованный browser request не проверялся.
- **LIVE напрямую с GitHub Pages: NO.** Секрет нельзя безопасно раздать в публичном frontend. Нужен собственный server-side proxy с серверным хранением авторизации. Public CORS proxies не используются.
- Никогда не помещайте токены, cookies и персональный профиль в source, Git, `VITE_*`, URL, localStorage или bundle. Все `VITE_*` публичны.

`TournamentProvider` отделяет UI от источника. `DevelopmentTournamentProvider` создаёт 12 синтетических примеров с датами относительно дня открытия. `LundaTournamentProvider` работает только с будущим публичным HTTPS endpoint вашего proxy: POST `{ parameters: { offset, limit, ... } }`, ответ `{ result: { hasNext, infos } }`. В `.env.local` можно указать **только публичный URL без секрета** `VITE_TOURNAMENT_PROXY_URL`. Ключи LUNDA остаются на сервере. Proxy должен ограничивать выдачу Москвой, исключать приватные данные, разрешать origin сайта и возвращать только необходимые публичные поля. Сам proxy не входит в статический проект.

Локальные фильтры не делают запросов. Provider последовательно запрашивает страницы с limit=30 до hasNext=false, удаляет дубликаты, ограничивает загрузку 50 страницами (1500 исходных записей), останавливает повторяющиеся/пустые страницы. Неполная выдача явно помечается; ошибка загрузки не маскируется под полный каталог. Таймаут запроса — 20 секунд, поддерживается отмена.

В отличие от примера cURL, будущий общий каталог не ограничивается личным рейтингом, личным городом, диапазоном GRADE_1–GRADE_4, утром или только свободными местами. Эти ограничения скрыли бы данные от локальных фильтров. Выбор Москвы должен выполнять proxy независимо от личного профиля.

## Безопасная локальная проверка реального ответа

Сохраните **JSON body ответа**, не cURL/headers/HAR, вне репозитория. Для полного каталога передайте все последовательные страницы, начиная с offset=0, по порядку:

```sh
npm run import:lunda -- /absolute/path/page-0.json /absolute/path/page-30.json
npm run dev
```

Откройте `http://localhost:5173/Tourgames/?source=local`. Импортёр пропускает данные через whitelist normalizer и сохраняет только модель каталога в игнорируемый `.local/tournaments.json`. Raw JSON, owner, игроки и реклама не сохраняются. Локальный middleware включён только при `npm run dev`; снимок не входит в production build. Не передавайте исходные файлы в `src/` или `public/`. Импортёр не может проверить, что вы не пропустили промежуточную страницу; полнота снимка определяется переданной последней страницей. `hasNext=true` показывает предупреждение о неполном каталоге. Снимок не обновляется автоматически.

## Данные и фильтры

- Нормализация: `src/api/normalize.ts`. Отбираются только поля модели `Tournament`, приватные/некорректные записи пропускаются.
- Название продукта: `PRODUCT_NAME` в `src/config.ts`.
- Даты и часы: `Europe/Moscow`, независимо от часового пояса устройства. Неделя — от сегодня до воскресенья; утро 00–12, день 12–18, вечер 18–24. Семантика в `src/utils/dates.ts`.
- Поиск: название, клуб, адрес, организатор, формат. Дата/диапазон, время, несколько клубов и форматов, командность, уровень, состав, цена, рейтинг, длительность, свободные места. Сортировки: ближайшие, цена вверх/вниз, свободные места.
- Уровень проверяется на включение в диапазон. Текущая интерпретация GRADE_1…GRADE_8 → D…A+ централизована в `filters.ts`; неизвестные коды сохраняются и допускают точное совпадение. Это предположение по известным данным, а не подтверждённая полная enum-схема LUNDA.
- `teamType` централизован в `domain/tournament.ts`: известные текстовые значения распознаются, неизвестное значение → `null`, а не догадка по названию. Реальных значений enum в исходном cURL нет; перед live-подключением сверить по ответу.
- `genders=[MAN,WOMAN]` отображается в фильтре «Смешанные / открытые»; отсутствие пола не считается смешанным турниром. `duration` считается минутами, цена — рублями, plannedDate без timezone — временем Москвы; сверить эти единицы по реальному JSON перед live-подключением.
- Неизвестные числа остаются неизвестными. Свободные места: max(playersLimit−playersCount,0). Неизвестная вместимость не проходит фильтр «Есть места». Цена команды/участника не угадывается: карточка пишет «стоимость участия».
- В URL сохраняются все фильтры и сортировка, восстановление при reload и popstate. Внутреннее хранилище и cookies не используются.

## Мобильная версия и проверки

Одна карточка на телефоне, две на планшете, три на широком экране. Крупные controls, перенос длинных названий/адресов, native date inputs, модальная панель с черновиком фильтров, сбросом и числом результатов. Используется native dialog: focus trap, Escape, возврат фокуса; скролл фона блокируется. Учтены safe-area, reduced-motion и клавиатурная навигация.

Vitest проверяет normalizer, отсутствие лишних данных, teamType, места, club/date/format/level/combined filters, поиск, цены, рейтинг, сортировку, URL, ошибки и ограничения пагинации. Никакой E2E-инфраструктуры в проекте нет.

Проверено 30.09.2026: `npm run build` успешен, 22 targeted tests прошли; локальный importer и dev endpoint проверены на синтетическом ответе, отсутствие снимка и credentials в `dist` проверено. Layout просмотрен в Chrome на 320, 375, 390, 430, 768, 1024 и 1440 px; фильтр клуба, пересчёт результатов и восстановление URL проверены вручную. На физических iPhone/Android и в Safari проверка ещё не проводилась.

## Структура

`src/domain/` — модель; `src/api/` — normalizer; `src/providers/` — источники и pagination; `src/fixtures/` — синтетические примеры; `src/utils/` — чистая логика; `src/components/` и `src/styles.css` — UI; `scripts/` — локальный importer; `tests/` — targeted tests; `.github/workflows/` — Pages.

Commit, push, изменение remote и deployment при создании проекта не выполняются.
