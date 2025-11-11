const shoeSizeCalculator = require('./shoe-size');
const { WeatherService } = require('./weather-service');
const SnowDepthCalculator = require('./snow-depth-calculator'); // ← ДОБАВИЛИ

function initialize() {
    console.log('✅ Модуль калькуляторов загружен');
   
    const weatherService = new WeatherService();
    const snowDepthCalculator = new SnowDepthCalculator(); // ← ДОБАВИЛИ
   
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
                    name: "❄️ Снежный покров",
                    command: "/calc_snow",
                    description: "Расчет высоты снега по следам"
                },
                {
                    name: "⏱️❄️ Калькулятор давности следа на снегу", // ← НОВЫЙ КАЛЬКУЛЯТОР
                    command: "/calc_snow_age",
                    description: "Расчет эволюции снежного покрова"
                },
                {
                    name: "🌤️ Погода",
                    command: "/calc_weather",
                    description: "Метеоданные для анализа следов"
                }
            ]
        }),
       
        // Существующие методы...
        calculateShoeSize: (size, type) => {
            const result = shoeSizeCalculator.calculate({ size, type });
            return result.success ? result.result : `❌ ${result.error}`;
        },
       
        calculateReverse: (footprintLength) => {
            const result = shoeSizeCalculator.calculateReverse(footprintLength);
            return result.success ? result.result : `❌ ${result.error}`;
        },
       
        // Старый простой калькулятор снега
        calculateSnowDepth: (trackDepth, snowType = 'fresh', compression = 'medium') => {
            try {
                const depth = parseFloat(trackDepth);
                const factors = {
                    'fresh': { low: 1.8, medium: 2.2, high: 2.5 },
                    'settled': { low: 1.3, medium: 1.6, high: 1.9 },
                    'compact': { low: 1.1, medium: 1.3, high: 1.5 },
                    'icy': { low: 1.0, medium: 1.1, high: 1.2 }
                };
               
                const factor = factors[snowType]?.[compression] || 2.0;
                const estimatedDepth = depth * factor;
               
                return `❄️ <b>РАСЧЕТ ВЫСОТЫ СНЕГА</b>\n\n` +
                       `📏 Глубина следа: <b>${depth} см</b>\n` +
                       `📊 Коэффициент: <b>${factor}</b>\n` +
                       `📐 Высота снега: <b>${Math.round(estimatedDepth * 10) / 10} см</b>\n\n` +
                       `💡 Используйте /calc_snow_age для точного расчета с историей погоды`;
            } catch (error) {
                return `❌ Ошибка расчета снега: ${error.message}`;
            }
        },
       
        // НОВЫЙ МЕТОД - расчет давности следа
        calculateSnowAge: async (coordinates, disappearanceTime) => {
            try {
                const result = await snowDepthCalculator.calculateSnowDepth(
                    coordinates.lat,
                    coordinates.lon,
                    disappearanceTime
                );
               
                if (result.success) {
                    let message = `❄️ <b>РАСЧЕТ СНЕЖНОГО ПОКРОВА</b>\n\n`;
                   
                    message += `📍 Место: ${result.location.lat}, ${result.location.lon}\n`;
                    message += `📅 Период анализа: ${result.periodDays} дней\n`;
                    message += `⏰ Время пропажи: ${new Date(result.disappearanceTime).toLocaleString('ru-RU')}\n\n`;
                   
                    message += `📏 <b>Ожидаемая высота снега:</b>\n`;
                    message += `• Общая: <b>${result.estimatedSnowDepth} см</b>\n`;
                    message += `• Свежего снега: <b>${result.freshSnowDepth} см</b>\n`;
                    message += `• Уплотнение: <b>${result.compaction} см</b>\n\n`;
                   
                    message += `📊 <b>Суммарные изменения:</b>\n`;
                    message += `• Осадки: ${result.totalPrecipitation} мм\n`;
                    message += `• Уплотнение: ${result.totalCompaction} см\n`;
                    message += `• Испарение: ${result.totalEvaporation} см\n\n`;
                   
                    if (result.warnings.length > 0) {
                        message += `⚠️ <b>ВНИМАНИЕ:</b>\n`;
                        result.warnings.forEach(warning => {
                            message += `• ${warning.message}\n`;
                        });
                        message += `\n`;
                    }
                   
                    if (result.hasCrust) {
                        message += `🧊 <b>Наст:</b> ${result.crustDepth} см - может мешать замерам!\n\n`;
                    }
                   
                    message += `🎯 <b>Рекомендация:</b>\n`;
                    message += `Ищите следы с глубиной <b>${result.estimatedSnowDepth} ±3 см</b>`;
                   
                    return message;
                } else {
                    return `❌ ${result.error}`;
                }
            } catch (error) {
                return `❌ Ошибка расчета: ${error.message}`;
            }
        },
       
        getWeatherData: async (options = {}) => {
            try {
                const result = await weatherService.getWeatherData(options);
                if (result.success) {
                    // ... существующий код вывода погоды
                    const data = result.result;
                   
                    let message = `🌤️ <b>ПОГОДА - ${data.location.toUpperCase()}</b>\n\n`;
                   
                    // Сейчас
                    message += `📊 <b>СЕЙЧАС (${data.current.time}):</b>\n`;
                    message += `🌡️ ${data.current.temperature}°C (ощущается ${data.current.feels_like}°C)\n`;
                    message += `${data.current.condition}\n`;
                    message += `💨 Ветер: ${data.current.wind_speed} м/с | 💧 Влажность: ${data.current.humidity}%\n`;
                    message += `🌧️ Осадки: ${data.current.precipitation} | ☁️ Облачность: ${data.current.cloudiness}%\n\n`;
                   
                    // Почасовой прогноз
                    message += `🕒 <b>БЛИЖАЙШИЕ 6 ЧАСОВ:</b>\n`;
                    data.hourly.forEach(hour => {
                        message += `${hour.time}: ${hour.temperature}°C, ${hour.condition}, ${hour.precipitation}\n`;
                    });
                    message += '\n';
                   
                    // Прогноз на 2 дня
                    message += `📈 <b>ПРОГНОЗ НА 2 ДНЯ:</b>\n`;
                    data.forecast.forEach(day => {
                        message += `${day.date}: День ${day.day_temp}°C / Ночь ${day.night_temp}°C, ${day.condition}, ${day.precipitation}\n`;
                    });
                    message += '\n';
                   
                    // Погодная сводка
                    message += data.searchSummary;
                   
                    return message;
                } else {
                    return `❌ ${result.error}`;
                }
            } catch (error) {
                return `❌ Ошибка получения погоды: ${error.message}`;
            }
        },
       
        getShoeTypes: () => {
            return shoeSizeCalculator.getFootwearTypesList();
        }
    };
}

module.exports = { initialize };
