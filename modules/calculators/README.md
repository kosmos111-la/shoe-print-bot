# modules/calculators — калькуляторы бота

## Что используется (после рефакторинга)

| Файл | Назначение |
|---|---|
| `index.js` | Точка входа (`initialize()`), меню, обвязка команд `/calc_shoe`, `/calc_reverse`, `/calc_snow_age`, `/calc_weather` |
| `tracker-tool.js` | **Новая проверенная модель давности следа** — JS-порт `tracker_tool.py` (послойная модель с обратным поиском, патчи «не знаю», цепочка замеров, наст). Сверка с Python: 137/137 случаев (см. `test-tracker-js.js`) |
| `epochs.json` | Эпохи дневника (сезоны 2022-23, 2023-24, 2024-25) — выгружены из `Дневник_clean.xlsx`, источник по умолчанию |
| `weather-service.js` | Погодный сервис Open-Meteo + **`getEpochs(lat, lon, startDate, endDate)`** — агрегация метео по 4 эпохам (ночь 21–03 / утро 03–09 / день 09–15 / вечер 15–21) для адаптера погоды |
| `weather-graph.js` | График погоды для `/calc_weather` |
| `shoe-size.js` | Калькуляторы размера обуви (`/calc_shoe`, `/calc_reverse`) |
| `height-estimate.js` | Оценка роста (не по теме, оставлен) |
| `test-tracker-js.js` + `py_reference.json` | Регрессионный тест JS-порта против эталона Python (134 замера 2024-25 + 3 CLI-примера) |

## Что удалено (мёртвые дубликаты)

- `snow-depth-calculator.js` — идентичен `probabilistic-snow-calculator.js` (MD5 совпадает), нигде не require-ится
- `probabilistic-snow-calculator.js` — то же
- `snow-depth.js`, `snow-calculator.js` — не require-ится нигде
- `weather.js` — заглушка «модуль в разработке», не используется

Проверка: `grep -r "snow-depth\|snow-calculator\|probabilistic\|weather'" modules/` — ссылок нет (кроме упоминаний в `PROJECT_PLAN.md`).

## Как работает `/calc_snow_age`

1. **Местоположение** → **дата пропажи** → **3–5 замеров глубины следа (см)** (новый шаг в `main.js`).
2. `calculateSnowAge(coordinates, disappearanceTime, { depths })` в `index.js`:
   - `season` выводится из даты (ноябрь–апрель → сезон дневника, иначе — нет);
   - без глубин → `«❌ Нужно 3–5 замеров глубины по следу (см)…»`;
   - сначала `tracker.estimateChain(season, date, depths, 'auto')` по эпохам **дневника**;
   - если дневник даёт `«недостаточно данных»` (вне дат дневника или другой район) и есть координаты —
     адаптер `weatherService.getEpochs(lat, lon, date−30, date)` (Open-Meteo) и повторный расчёт;
   - ответ: `formatForBot` (📍 глубина/разброс, 🎯 давность, 🧊 наст по архиву, ⚠️ предупреждения).
3. Ответ — строка; отправляется как текст с `parse_mode: 'HTML'`.

## Честные оговорки

- Модель калибрована на **эпохах дневника** (конкретный район, сезоны 2022–25). Эпохи Open-Meteo
  для произвольных координат — адаптер, не калиброванный; результат помечается предупреждениями.
- Класс 10+ дней (глубина насыщается) может дать уверенное, но неверное число; защита —
  патчи «неопределима» и предупреждение «проверьте вручную».

## Тесты

```bash
node --check modules/calculators/index.js
node --check modules/calculators/tracker-tool.js
node modules/calculators/test-tracker-js.js        # сверка с Python: 137/137
node test-epochs-js.js                             # агрегация getEpochs (со стабом axios)
node smoke-calculators.js                          # smoke: calculateSnowAge/calc_shoe/calc_reverse/calc_weather
```
