# LUNDA proxy — Cloudflare Worker

Минимальный отдельный сервис для статического сайта. Публикуется отдельно от GitHub Pages. Код готов, но Worker ещё не развёрнут и реальные credentials не установлены.

## Публикация

Нужен ваш Cloudflare account. Из корня проекта выполните:

```sh
npx wrangler@4 login
npx wrangler@4 deploy --config proxy/wrangler.toml
npx wrangler@4 secret put LUNDA_AUTH_TOKEN --config proxy/wrangler.toml
npx wrangler@4 secret put LUNDA_PROFILE_ID --config proxy/wrangler.toml
```

Каждая команда `secret put` запросит значение интерактивно. Введите токен из `X-Auth-Token` и идентификатор из `X-Profile-Id`. Cookie отдельно не задаётся: Worker формирует `auth-token` из того же токена. Пока secrets не установлены, endpoint отвечает 503. Не вставляйте значения в команды, файлы конфигурации или GitHub Variables. Это стандартный механизм [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

В `proxy/wrangler.toml` разрешён origin `https://ovsyankinvi.github.io` — без `/Tourgames/`. Если адрес сайта изменится, обновите `ALLOWED_ORIGIN` и повторите deploy. Сервис принимает только POST `/tournaments` и OPTIONS.

После публикации Wrangler покажет URL Worker. Добавьте `/tournaments`, например `https://tourgames-lunda-proxy.<ваш-subdomain>.workers.dev/tournaments`.

В GitHub откройте **Settings → Secrets and variables → Actions → Variables**, добавьте **repository variable**:

```text
VITE_TOURNAMENT_PROXY_URL=https://tourgames-lunda-proxy.<ваш-subdomain>.workers.dev/tournaments
```

Это публичный URL, не секрет. Workflow уже передаёт его сборке. Перезапустите Pages workflow: **Actions → Deploy to GitHub Pages → Run workflow**. До настройки URL сайт показывает демокаталог; после настройки обращается к Worker. Ошибка Worker не переключает сайт обратно на демоданные.

## Локально

Скопируйте `proxy/.dev.vars.example` в `proxy/.dev.vars`, заполните credentials только в этом игнорируемом файле. Запустите:

```sh
npx wrangler@4 dev --config proxy/wrangler.toml --port 8787
```

В корневом `.env.local` укажите только `VITE_TOURNAMENT_PROXY_URL=http://localhost:8787/tournaments`, затем `npm run dev`. Открывайте сайт именно с `http://localhost:5173/Tourgames/`, чтобы origin совпал с локальным примером. HTTP localhost разрешён только в Vite development mode, production требует HTTPS. Wrangler не нужен для обычной сборки сайта.

## Поведение и ограничения

- Токен, Cookie и профиль используются только для фиксированного POST метода LUNDA. Redirect запрещён, чтобы credential не отправился другому хосту.
- Клиент управляет только offset/limit: страницы 0, 30, …, 1470, limit=30. Остальные параметры фиксируются на сервере. Фильтры цены/времени/рейтинга остаются локальными и не сужают общий каталог заранее.
- `inMyCity=true`: город определяется профилем LUNDA. **У используемого профиля должна быть выбрана Москва**. Произвольного city-параметра в предоставленном cURL нет, поэтому он не придуман. `onlyMyRating`, `onlyMyInvite`, `onlyMyPartners`, `hideFilled` отключены.
- Ответ проходит существующий normalizer и явный whitelist. Приватные турниры исключаются. Owner, игроки, реклама, cookies и upstream headers не публикуются. Исходные ошибки и credentials не логируются кодом Worker.
- Таймаут 15 секунд, максимум тела запроса 4 КБ и ответа upstream 2 МБ. Кэш страниц 60 секунд, максимум 50 ключей; одинаковые параллельные запросы объединяются, одновременно выполняются максимум два upstream-запроса на isolate.
- CORS ограничивает браузеры, но **не является авторизацией или глобальным rate limit**: endpoint каталога публичный, Origin можно подделать вне браузера. При публичной нагрузке настройте ограничения запросов в Cloudflare; кэш и concurrency здесь действуют только в отдельном isolate.
- LUNDA может отозвать/просрочить токен. Автоматическое обновление не реализовано: повторите `secret put`. При ошибке API сайт покажет обычное состояние ошибки без внутренних деталей.
- Реальный авторизованный запрос пока не проверен. Enum `teamType`, единицы duration и шкала grade используют прежнюю нормализацию; перед эксплуатацией проверьте на реальном ответе.

Targeted tests: `npx vitest run tests/proxy.test.ts`. Typecheck Worker включён в `npm run build`. Секреты не входят ни в Worker source, ни в Pages bundle.
