// shoe-print-bot/modules/calculators/index.js

const shoeSizeCalculator = require('./shoe-size');
const { WeatherService } = require('./weather-service');
const { WeatherGraph } = require('./weather-graph');  // ← ДОБАВИТЬ ЭТУ СТРОКУ
const tracker = require('./tracker-tool'); // новая проверенная модель давности (порт tracker_tool.py)
const axios = require('axios');



// ---------- helpers для новой модели давности ----------
function pad2(n) { return String(n).padStart(2, '0'); }
function parseDateOnly(input) {
    const d = (input instanceof Date) ? new Date(input.getTime()) : new Date(input);
    if (isNaN(d.getTime())) return null;
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}
function isoDate(p) { return p.y + '-' + pad2(p.m) + '-' + pad2(p.d); }
function seasonForDate(y, m) {
    // сезоны дневника: ноябрь–апрель; май–октябрь — сезона нет
    if (m >= 11 || m <= 4) {
        const y0 = m >= 11 ? y : y - 1;
        return y0 + '-' + pad2((y0 + 1) % 100);
    }
    return null;
}
function addDaysISO(iso, t) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + t);
    return d.toISOString().slice(0, 10);
}

// ---------- погода: компактный вывод для поисковика (штурм / сводка / ВКПО / спойлер) ----------
function _fmtT(t) {
    const v = Number(t);
    if (isNaN(v)) return '—°C';
    return `${Math.round(v)}°C`;
}

function _ddmm(s) {
    const str = String(s || '');
    const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (iso) return `${iso[3]}.${iso[2]}`;
    const MON = { 'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04', 'май': '05', 'июн': '06', 'июл': '07', 'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12' };
    const m = /(\d+)[^а-яё]*([а-яё]{3})/.exec(str);
    if (m) return `${String(Number(m[1])).padStart(2, '0')}.${MON[m[2]] || '??'}`;
    return str;
}

function getVkpoKit(temp, wind, precip, condition = '') {
    const T = Number(temp);
    const W = Number(wind) || 0;
    const P = Number(precip) || 0;
    const L = {
        1: 'Слой 1: лёгкое термобельё',
        2: 'Слой 2: тёплое термобельё',
        3: 'Слой 3: флиска',
        4: 'Слой 4: летний костюм — в жару',
        5: 'Слой 5: софтшел — лёгкая защита от дождя и ветра',
        6: 'Слой 6: харшел (мембрана) — защита от ветра и дождя',
        7: 'Слой 7: утеплённый внешний слой — зимний',
    };
    // динамика (в движении) — база: софтшел почти всегда, кроме жары
    let ids;
    if (T < -15) ids = [1, 2, 3, 5, 7];
    else if (T < 0 && W > 0) ids = [1, 2, 3, 5];
    else if (T < 0) ids = [1, 2, 5];
    else if (P > 2) ids = [1, 6];
    else if (P > 0) ids = [1, 5];
    else if (T >= 20) ids = [1, 4];
    else ids = [1, 5];
    // мокрый снег / морозный дождь при морозе — мембрана нужна
    if (T < 0 && /морозный|мокрый/i.test(String(condition || '')) && !ids.includes(6)) {
        ids = [...ids, 6];
    }
    // статика: утепление для стоянки/штаба — в рюкзак
    let backpack = null;
    if (T >= 20) backpack = null;
    else if (T < 0) backpack = 7;
    else backpack = 3;
    // головной убор
    let headwear;
    if (T >= 20) headwear = 'панама';
    else if (T < 0) headwear = 'тёплая зимняя шапка-ушанка';
    else headwear = 'лёгкая флисовая шапка';
    return {
        layers: ids.map(id => `• ${L[id]}`),
        ids: ids,
        backpack: backpack,
        headwear: headwear,
        cold: T < 0,
    };
}
function _stormReason(data) {
    const reasons = [];
    const cur = data.current || {};
    const T = Number(cur.temperature);
    const W = Number(cur.wind_speed) || 0;
    const cond = String(cur.condition || '').toLowerCase();
    if (W > 10) reasons.push(`ветер ${W} м/с`);
    const h6 = (data.hourly || []).slice(0, 6);
    if (h6.some(h => /снег/i.test(h.condition || '') && Number(h.precipitation) > 5)) reasons.push('сильный снегопад в ближайшие часы');
    if (h6.some(h => /морозный|ледян|мокрый/i.test(h.condition || ''))) reasons.push('ледяной/морозный дождь');
    if (h6.some(h => /ливень|сильный дождь|гроза/i.test(h.condition || ''))) reasons.push('сильный дождь/гроза');
    if (/гроза/i.test(cond)) reasons.push('гроза сейчас');
    const hist = data.history || [];
    if (hist.length) {
        const prevDay = Number(hist[0].day_temp);
        if (!isNaN(prevDay) && !isNaN(T) && prevDay - T > 5) reasons.push(`резкое падение температуры: было ${_fmtT(prevDay)}, сейчас ${_fmtT(T)}`);
    }
    const fc = data.forecast || [];
    if (fc.length) {
        const d = Number(fc[0].day_temp), n = Number(fc[0].night_temp);
        if (!isNaN(d) && !isNaN(n) && d - n > 5) reasons.push('резкое похолодание к ночи');
    }
    return reasons.length ? reasons.join('; ') : null;
}

function formatWeatherCompact(data) {
    const cur = data.current || {};
    const T = Number(cur.temperature);
    const W = Number(cur.wind_speed) || 0;
    const P = Number(cur.precipitation) || 0;
    const cond = String(cur.condition || '');
    const loc = String(data.location || '').toUpperCase();
    const out = [];

    // шапка
    out.push(`🌤️ <b>${loc}</b>`);

    // Блок 1: штурмовое предупреждение (если есть)
    const storm = _stormReason(data);
    if (storm) out.push(`⚠️ <b>ШТУРМОВОЕ ПРЕДУПРЕЖДЕНИЕ:</b> ${storm}`);

    out.push('');
    // Блок 2: сводка
    out.push(`🌡️ <b>Сейчас:</b> ${_fmtT(T)}${cond ? `, ${cond}` : ''} (ощущается ${_fmtT(Number(cur.feels_like))})`);
    out.push(`💨 <b>Ветер:</b> ${W} м/с`);
    const vis = /туман|метель|снег|ливень|гроза/i.test(cond) ? 'ограничена (туман/снег)' : 'хорошая';
    out.push(`👁️ <b>Видимость:</b> ${vis}`);

    // Световой день: восход / закат / эффективное потемнение (если есть данные)
    const st = data.sunTimes;
    if (st && st.sunriseStr && st.sunsetStr) {
        out.push(`🌅 <b>Восход:</b> ${st.sunriseStr}`);
        out.push(`🌇 <b>Закат:</b> ${st.sunsetStr}`);
        const cloud = Number(cur.cloudiness) || 0;
        if (cloud > 50 && st.sunrise instanceof Date && st.sunset instanceof Date) {
              let cf = 1;
              if (cloud > 80) cf = 0.7; else if (cloud > 50) cf = 0.85;
              const dayLen = (st.sunset - st.sunrise) / 1000 / 60 / 60;
              const effSunset = new Date(st.sunset.getTime() - dayLen * (1 - cf) * 3600 * 1000);
              out.push(`🌆 <b>Эффективное потемнение:</b> ~${effSunset.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (облачность ${cloud}%)`);
              const now = new Date();
              const hoursLeft = (effSunset - now) / 1000 / 60 / 60;
              if (now >= effSunset) out.push('🌙 <b>Уже темно</b> — нужны фонари');
              else if (hoursLeft < 2) out.push(`⚠️ <b>Темнеет через ${Math.round(hoursLeft)} ч</b> — готовьте фонари`);
        }
    }

    out.push('');
    // Блок 3: слои ВКПО
    out.push('👕 <b>Экипировка (ВКПО):</b>');
    const kit = getVkpoKit(T, W, P, cond);
    out.push('🏃 <b>В движении (база):</b>');
    out.push(...kit.layers);
    if (kit.backpack) {
        const bpText = kit.backpack === 7 ? '• Слой 7: утеплённый внешний слой — зимний' : '• Слой 3: флиска';
        const worn = kit.ids.includes(kit.backpack);
        out.push(`🎒 <b>Для стоянки/штаба (в рюкзак):</b> ${bpText}${worn ? ' (уже надет — берите запасной/толще)' : ' — утеплиться при остановке'}`);
    } else {
        out.push('🎒 <b>Для стоянки/штаба:</b> утепление не нужно (тепло)');
    }
    out.push(`🧢 <b>Головной убор:</b> ${kit.headwear}${kit.cold ? ' (+ баф, перчатки)' : ''}`);

    out.push('');
    // Блок 4: детали — свёрнутый спойлер (без пустых строк внутри)
    const det = [];
    det.push('📅 Детали: история и прогноз (нажмите, чтобы развернуть)');
    const hist = data.history || [];
    if (hist.length) det.push('📖 История 7 дней:');
    for (const d of hist) {
        det.push(`${_ddmm(d.date)}: День ${_fmtT(d.day_temp)} / Ночь ${_fmtT(d.night_temp)}, ${d.condition}, ${Number(d.precipitation)}мм, 💨${d.wind_speed}м/с`);
    }
    const fc = data.forecast || [];
    if (fc.length) det.push('📈 Прогноз 2 дня:');
    for (const d of fc) {
        det.push(`${_ddmm(d.date)}: День ${_fmtT(d.day_temp)} / Ночь ${_fmtT(d.night_temp)}, ${d.condition}, ${Number(d.precipitation)}мм`);
    }
    det.push('</blockquote>');
    out.push('<blockquote expandable>' + det.join('\n'));

    return out.join('\n');
}
function initialize() {
    console.log('✅ Модуль калькуляторов загружен');

    const weatherService = new WeatherService();

       return {
        getMenu: () => ({
            title: "🧮 КАЛЬКУЛЯТОРЫ",
            sections: [
                {
                    name: "📏 Калькулятор размеров обуви",
                    command: "/calc_shoe",
                    description: "Расчет длины отпечатка по размеру обуви"
                },
                {
                    name: "🔄 Обратный калькулятор",
                    command: "/calc_reverse",
                    description: "Расчет размера обуви по длине отпечатка"
                },
                {
                    name: "⏱️❄️ Калькулятор давности следа на снегу",
                    command: "/calc_snow_age",
                    description: "Расчет эволюции снежного покрова на реальных данных"
                },
                {
                    name: "🌤️ Погода",
                    command: "/calc_weather",
                    description: "Метеоданные для анализа следов"
                }
            ]
        }),

        // 📏 Калькулятор размеров обуви
        calculateShoeSize: (size, type) => {
            const result = shoeSizeCalculator.calculate({ size, type });
            return result.success ? result.result : `❌ ${result.error}`;
        },

        // 🔄 Обратный калькулятор
        calculateReverse: (footprintLength) => {
            const result = shoeSizeCalculator.calculateReverse(footprintLength);
            return result.success ? result.result : `❌ ${result.error}`;
        },

        // 🔮 СНЕЖНЫЙ КАЛЬКУЛЯТОР
       // ⏱️❄️ ДАВНОСТЬ СЛЕДА — новая проверенная модель (порт tracker_tool.py)
       calculateSnowAge: async (coordinates, disappearanceTime, options = {}) => {
           try {
               const p = parseDateOnly(disappearanceTime);
               if (!p) return '❌ Неверная дата пропажи';
               const season = seasonForDate(p.y, p.m);
               const depths = options.depths || (options.depth != null ? [options.depth] : null);
               if (!depths || depths.length < 3 || depths.length > 5 || depths.some(d => isNaN(Number(d)))) {
                   return '❌ Нужно 3–5 замеров глубины в ЦЕПИ следов (10–15 м друг от друга, см), например: 1.5 1.8 1.6';
               }
               const nums = depths.map(Number);
               const visitDate = isoDate(p);
               let chain = null;
               let est = null;
               if (season) {
                   chain = tracker.estimateChain(season, visitDate, nums, 'auto');
                   est = chain['оценка'];
               }
               // Адаптер погоды: если по дневнику данных нет — пробуем эпохи Open-Meteo
               if ((!chain || est.status === 'недостаточно данных') && coordinates && !options.epochs) {
                   const meteo = await weatherService.getEpochs(
                       coordinates.lat, coordinates.lon, addDaysISO(visitDate, -30), visitDate
                   );
                   if (meteo && meteo.length) {
                       chain = tracker.estimateChain(season || 'meteo', visitDate, nums, 'auto', meteo);
                       est = chain['оценка'];
                   }
               }
               if (!chain) return '❌ Недостаточно данных: нет истории погоды (дневник и метео недоступны)';
               return tracker.formatForBot(est, chain);
           } catch (e) {
               console.log('❌ Ошибка калькулятора давности:', e);
               return `❌ Ошибка расчета: ${e.message}`;
           }
       },

        // 🌤️ Погода с графиком
        // 🌤️ Погода с графиком (компактный вывод)
        getWeatherData: async (options = {}, chatId = null, bot = null) => {
            try {
                const result = await weatherService.getWeatherData(options);
                if (!result.success) {
                    return `❌ ${result.error}`;
                }

                const data = result.result;
                // Компактный отчёт: штурм / сводка / слои ВКПО / детали-спойлер
                const compactReport = formatWeatherCompact(data);

                if (chatId && bot) {
                    try {
                        const weatherGraph = new WeatherGraph();
                        const graphBuffer = await weatherGraph.generateWeatherGraph(
                            data.history,
                            data.forecast,
                            data.location,
                            data.hourlyPrecipitation,
                            data.snowData
                        );
                        if (graphBuffer) {
                            // Сначала — текст решения, затем график (легенда графика убрана)
                            await bot.sendMessage(chatId, compactReport, { parse_mode: 'HTML' });
                            const graphCaption = `📊 <b>${(data.location || '').toUpperCase()}</b> — температура, осадки, снежный покров (7 дней + прогноз 2 дня)`;
                            await bot.sendPhoto(chatId, graphBuffer, { caption: graphCaption, parse_mode: 'HTML' });
                            return null;
                        }
                    } catch (graphError) {
                        console.log('⚠️ Ошибка генерации графика:', graphError.message);
                        return compactReport;
                    }
                }

                return compactReport;
            } catch (error) {
                console.error('❌ Ошибка:', error);
                return `❌ Ошибка получения погоды: ${error.message}`;
            }
        },        getShoeTypes: () => {
            return shoeSizeCalculator.getFootwearTypesList();
        }
    };
}

module.exports = { initialize, formatWeatherCompact, getVkpoKit };
