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

function getClothingLayers(temp, wind, precip) {
    const T = Number(temp);
    const W = Number(wind) || 0;
    const P = Number(precip) || 0;
    const L = {
        1: 'Слой 1 (база): влагоотводящее термобельё',
        2: 'Слой 2 (утепление): флисовое бельё',
        3: 'Слой 3 (флис): флисовая куртка',
        4: 'Слой 4 (ветровка): ветрозащитная куртка',
        5: 'Слой 5 (демисезон): мембранный костюм',
        6: 'Слой 6 (утеплённый): синтепоновый/пуховой костюм',
        7: 'Слой 7 (зимний): экстремальный утеплённый костюм',
    };
    let ids;
    if (T < -25) ids = [1, 2, 3, 5, 6, 7];
    else if (T < -15) ids = [1, 2, 3, 5, 6];
    else if (T < 0 && W > 0) ids = [1, 2, 3, 4, 5];
    else if (T < 0) ids = [1, 2, 5];
    else if (P > 0) ids = [1, 4, 5];
    else ids = [1];
    const out = ids.map(id => `• ${L[id]}`);
    if (T < 0) out.push('• Доп: шапка, баф, перчатки');
    return out;
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
    out.push(`🌡️ <b>Сейчас:</b> ${_fmtT(T)} (ощущается ${_fmtT(Number(cur.feels_like))})`);
    out.push(`💨 <b>Ветер:</b> ${W} м/с`);
    const vis = /туман|метель|снег|ливень|гроза/i.test(cond) ? 'ограничена (туман/снег)' : 'хорошая';
    out.push(`👁️ <b>Видимость:</b> ${vis}`);
    const hist3 = (data.history || []).slice(0, 3);
    const nast = (hist3.some(d => Number(d.day_temp) > 0) || /морозный|ледян/i.test(cond)) ? 'есть' : 'нет';
    const zanos = (W > 8 && (hist3.some(d => Number(d.precipitation) > 0) || /снег/i.test(cond))) ? 'высокий' : 'низкий';
    out.push(`❄️ <b>Риск для следов:</b> наст: ${nast}, занос: ${zanos}`);

    out.push('');
    // Блок 3: слои ВКПО
    out.push('👕 <b>Экипировка (ВКПО):</b>');
    out.push(...getClothingLayers(T, W, P));

    out.push('');
    // Блок 4: детали — свёрнутый спойлер (без пустых строк внутри)
    const det = [];
    det.push('📅 Детали: история и прогноз (нажмите, чтобы развернуть)');
    const hist = data.history || [];
    if (hist.length) det.push('📖 История 7 дней:');
    for (const d of hist) {
        det.push(`${d.date.slice(8, 10)}.${d.date.slice(5, 7)}: День ${_fmtT(d.day_temp)} / Ночь ${_fmtT(d.night_temp)}, ${d.condition}, ${Number(d.precipitation)}мм, 💨${d.wind_speed}м/с`);
    }
    const fc = data.forecast || [];
    if (fc.length) det.push('📈 Прогноз 2 дня:');
    for (const d of fc) {
        det.push(`${d.date.slice(8, 10)}.${d.date.slice(5, 7)}: День ${_fmtT(d.day_temp)} / Ночь ${_fmtT(d.night_temp)}, ${d.condition}, ${Number(d.precipitation)}мм`);
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

module.exports = { initialize, formatWeatherCompact, getClothingLayers };
