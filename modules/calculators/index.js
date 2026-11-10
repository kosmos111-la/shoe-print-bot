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
function initialize() {
    console.log('✅ Модуль калькуляторов загружен');

    const weatherService = new WeatherService();

    // Вспомогательные функции форматирования (внутри initialize)
    function formatWeatherShort(data, weatherService) {
    const currentHour = new Date().getHours();
    const timeIcon = (currentHour >= 6 && currentHour < 18) ? '☀️' : '🌙';
   
    let message = `🌤️ <b>${data.location.toUpperCase()}</b> ${timeIcon}\n\n`;
   
    message += `📊 <b>Сейчас:</b> ${weatherService.formatTemperature(data.current.temperature)} (ощущается ${weatherService.formatTemperature(data.current.feels_like)})\n`;
    message += `${data.current.condition} | 💨 ${data.current.wind_speed} м/с | 💧 ${data.current.humidity}%\n\n`;
   
    if (data.forecast && data.forecast[0]) {
        const today = data.forecast[0];
        message += `📈 <b>Сегодня:</b> День ${weatherService.formatTemperature(today.day_temp)} / Ночь ${weatherService.formatTemperature(today.night_temp)}\n`;
        message += `${today.condition}`;
        if (today.precipitation > 0) {
            message += ` | 🌧️ ${today.precipitation}мм`;
        }
        message += `\n\n`;
    }
   
    if (data.current.temperature < 5) {
        message += `🧥 Рекомендация: теплая одежда`;
    } else if (data.current.temperature < 15) {
        message += `🧥 Рекомендация: куртка или ветровка`;
    } else {
        message += `👕 Рекомендация: легкая одежда`;
    }
   
    if (data.current.wind_speed > 5) {
        message += `, ветрозащита`;
    }
   
    // Добавляем ссылку на полный отчет
    message += `\n\n📋 <i>Подробный отчет отправлен ниже 👇</i>`;
   
    return message;
}

    function formatWeatherFull(data, weatherService) {
        let message = `🌤️ <b>ПОГОДА - ${data.location.toUpperCase()}</b>\n\n`;

        const currentHour = new Date().getHours();
        const currentTimeFormatted = weatherService.formatTimeWithStyle(currentHour, `📊 <b>СЕЙЧАС (${data.current.time}):</b>`);
        message += `${currentTimeFormatted}\n`;
        message += `🌡️ ${weatherService.formatTemperature(data.current.temperature)} (ощущается ${weatherService.formatTemperature(data.current.feels_like)})\n`;
        message += `${data.current.condition}\n`;
        message += `💨 Ветер: ${data.current.wind_speed} м/с | 💧 Влажность: ${data.current.humidity}%\n`;
        message += `🌧️ Осадки: ${data.current.precipitation} | ☁️ Облачность: ${data.current.cloudiness}%\n\n`;

        message += `🕒 <b>БЛИЖАЙШИЕ 6 ЧАСОВ:</b>\n`;
        data.hourly.slice(0, 6).forEach(hour => {
            const hourNum = hour.hour;
            const timeText = weatherService.formatTimeWithStyle(hourNum, `${hour.time}`);
            const tempFormatted = weatherService.formatTemperature(hour.temperature);
            message += `${timeText} ${tempFormatted}, ${hour.condition}, ${hour.precipitation}\n`;
        });
        message += '\n';

        message += `📈 <b>ПРОГНОЗ НА 2 ДНЯ:</b>\n`;
        data.forecast.forEach(day => {
            const dayTemp = weatherService.formatTemperature(day.day_temp);
            const nightTemp = weatherService.formatTemperature(day.night_temp);
            message += `${day.date}: День ${dayTemp} / Ночь ${nightTemp}, ${day.condition}, ${day.precipitation}\n`;
        });
        message += '\n';

        if (data.history && data.history.length > 0) {
            message += `📅 <b>ИСТОРИЯ ПОГОДЫ ЗА 7 СУТОК:</b>\n`;
            const reversedHistory = [...data.history].reverse();
            reversedHistory.forEach(day => {
                const precipIcon = day.precipitation > 0 ? '🌧️' : '';
                const dayTemp = weatherService.formatTemperature(day.day_temp);
                const nightTemp = weatherService.formatTemperature(day.night_temp);
                message += `${day.date}: День ${dayTemp} / Ночь ${nightTemp}, ${day.condition}, ${precipIcon}${day.precipitation}мм, 💨${day.wind_speed}м/с\n`;
            });
            message += '\n';
        }

        message += data.searchSummary;

        return message;
    }

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
                   return '❌ Нужно 3–5 замеров глубины по следу (см), например: 1.5 1.8 1.6';
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
        getWeatherData: async (options = {}, chatId = null, bot = null) => {
    try {
        const result = await weatherService.getWeatherData(options);
        if (!result.success) {
            return `❌ ${result.error}`;
        }

        const data = result.result;

        // Формируем полный текстовый отчет (как было раньше)
        const fullTextReport = formatWeatherFull(data, weatherService);
       
        // Формируем краткую подпись для графика (ограничиваем до 900 символов)
        const shortCaption = formatWeatherShort(data, weatherService);

        // Пытаемся отправить график
        if (chatId && bot) {
            try {
                const weatherGraph = new WeatherGraph();
                const graphBuffer = await weatherGraph.generateWeatherGraph(
    data.history,
    data.forecast,
    data.location,
    data.hourlyPrecipitation,
    data.snowData  // 🆕 передаем данные о снеге
);

                if (graphBuffer) {
                    // Отправляем график с краткой подписью
                    await bot.sendPhoto(chatId, graphBuffer, {
                        caption: shortCaption,
                        parse_mode: 'HTML'
                    });
                   
                    // Отправляем полный текстовый отчет отдельным сообщением
                    await bot.sendMessage(chatId, fullTextReport, { parse_mode: 'HTML' });
                   
                    return null; // Все отправлено
                }
            } catch (graphError) {
                console.log('⚠️ Ошибка генерации графика:', graphError.message);
                // Если график не удался, отправляем только текст
                return fullTextReport;
            }
        }

        // Fallback: если нет chatId/bot, отправляем только текст
        return fullTextReport;

    } catch (error) {
        console.error('❌ Ошибка:', error);
        return `❌ Ошибка получения погоды: ${error.message}`;
    }
},

        getShoeTypes: () => {
            return shoeSizeCalculator.getFootwearTypesList();
        }
    };
}

module.exports = { initialize };
