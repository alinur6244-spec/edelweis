# ORDO TECH — сайт

Статика, сборки нет: правишь файл — обновляешь страницу.

## Структура

    index.html              разметка страницы + логика компонента (инлайн-скрипт)
    assets/styles.css       шрифты, цветовые токены, глобальные стили
    assets/hologram.js      голограмма в первом экране
    assets/fonts/           Unbounded, Onest, JetBrains Mono (variable woff2)
    vendor/                 React 18.3.1, ReactDOM, dc-runtime

## Локальный запуск

Открывать `index.html` двойным кликом **нельзя** — рантайм читает исходник
страницы через `fetch`, а по `file://` это запрещено. Нужен http-сервер:

    npm run dev

Это обёртка над встроенным в macOS Python, ставить ничего не надо.
Затем открыть http://localhost:3000 — остановить `Ctrl+C`.

## Деплой на Vercel

1. Запушить репозиторий на GitHub.
2. Vercel → Add New → Project → импорт репозитория.
3. Framework Preset: **Other**. Build Command и Output Directory — пустые.
4. Settings → Domains → добавить домен, прописать выданные записи у регистратора.

## Где что править

| Что                        | Где                                                   |
|----------------------------|-------------------------------------------------------|
| Цвета                      | `assets/styles.css`, блок `:root`                      |
| Шрифты                     | `assets/styles.css`, блок `@font-face`                 |
| Голограмма                 | `assets/hologram.js` — города в `CITIES`, связи `LINKS` |
| Размер/позиция голограммы  | `assets/styles.css`, `#ordo-holo`                      |
| Тексты, кейсы, FAQ         | `index.html`, массивы данных в конце инлайн-скрипта     |
| Контакты                   | искать `wa.me` и `@ordotech` в `index.html`            |

## Цветовые токены

    --ink        #0a0b0d   фон, нейтральный графит
    --chalk      #eceae4   текст, тёплый мел
    --champagne  #dcd2be   основной акцент
    --taupe      #bbb09b   тёплый переход
    --frost      #a9bbc2   холодный контрапункт
    --titanium   #c6d0d4   светлый титан
    --clay       #c2a79d   внимание

## Перед публикацией

- [ ] Заменить телефон, WhatsApp, почту и Instagram на реальные
- [ ] Положить `assets/og.png` (1200×630) — превью для ссылок в мессенджерах
- [ ] Проверить, что консоль браузера чистая
