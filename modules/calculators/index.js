const shoeSizeCalculator = require('./shoe-size');
const { WeatherService } = require('./weather-service');
const ProbabilisticSnowCalculator = require('./probabilistic-snow-calculator');

function initialize() {
    console.log('✅ Модуль калькуляторов загружен');
   
    const weatherService = new WeatherService();
    const snowCalculator = new ProbabilisticSnowCalculator();
   
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
                    name: "⏱️❄️ Калькулятор давности следа на снегу",
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
       
        // ❄️ Простой калькулятор снега
        calculateSnowDepth: (trackDepth, snowType = 'fresh') => {
            try {
                const depth = parseFloat(trackDepth);
                const factors = {
                    'fresh': 2.2,
                    'уплотненный': 1.6,
                    'плотный': 1.3,
                    'ледяной': 1.1,
                    'settled': 1.6,
                    'compact': 1.3,
                    'icy': 1.1
                };
               
                const factor = factors[snowType] || 2.0;
                const estimatedDepth = depth * factor;
               
                return `❄️ <b>РАСЧЕТ ВЫСОТЫ СНЕГА</b>\n\n` +
                       `📏 Глубина следа: <b>${depth} см</b>\n` +
                       `🎯 Тип снега: <b>${snowType}</b>\n` +
                       `📊 Коэффициент: <b>${factor}</b>\n` +
                       `📐 Высота снега: <b>${Math.round(estimatedDepth * 10) / 10} см</b>\n\n` +
                       `💡 Используйте /calc_snow_age для точного расчета с историей погоды`;
            } catch (error) {
                return `❌ Ошибка расчета снега: ${error.message}`;
            }
        },
       
        // 🔮 ВЕРОЯТНОСТНЫЙ расчет давности следа
        calculateSnowAge: async (coordinates, disappearanceTime, locationInfo = {}) => {
            try {
                const result = await snowCalculator.calculateSnowWithUncertainty(
                    coordinates,
                    disappearanceTime,
                    locationInfo
                );
               
                if (result.success) {
                    return this.formatProbabilisticResult(result);
                } else {
                    return `❌ ${result.error}`;
                }
            } catch (error) {
                return `❌ Ошибка расчета: ${error.message}`;
            }
        },
       
        // 🌤️ Погода
        getWeatherData: async (options = {}) => {
            try {
                const result = await weatherService.getWeatherData(options);
                if (result.success) {
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
       
        // 📋 Форматирование вероятностного результата
        formatProbabilisticResult: (result) => {
            const base = result.base;
            const prob = result.probability;
           
            let message = `🌲 <b>ВЕРОЯТНОСТНЫЙ РАСЧЕТ СНЕГА</b>\n\n`;
           
            message += `📍 <b>Место:</b> ${base.location.lat.toFixed(4)}, ${base.location.lon.toFixed(4)}\n`;
            message += `📅 <b>Период анализа:</b> ${base.periodDays} дней\n`;
            message += `⏰ <b>Время пропажи:</b> ${new Date(base.disappearanceTime).toLocaleString('ru-RU')}\n\n`;
           
            message += `📊 <b>БАЗОВЫЙ РАСЧЕТ:</b> ${base.estimatedSnowDepth} см снега\n\n`;
           
            message += `🎯 <b>ВЕРОЯТНОСТНЫЕ КОРИДОРЫ:</b>\n\n`;
           
            message += `📏 <b>ГЛУБИНА СНЕГА:</b>\n`;
            message += `• 80% вероятность: ${prob.depth.high_confidence.min.toFixed(1)} - ${prob.depth.high_confidence.max.toFixed(1)} см\n`;
            message += `• 95% вероятность: ${prob.depth.medium_confidence.min.toFixed(1)} - ${prob.depth.medium_confidence.max.toFixed(1)} см\n`;
            message += `• 99% вероятность: ${prob.depth.low_confidence.min.toFixed(1)} - ${prob.depth.low_confidence.max.toFixed(1)} см\n\n`;
           
            message += `🎲 <b>ВЕРОЯТНОСТИ:</b>\n`;
            message += `• Обнаружения следа: ${(prob.detection_probability * 100).toFixed(0)}%\n`;
            message += `• Наличия наста: ${(prob.crust_probability * 100).toFixed(0)}%\n`;
            message += `• Сохранения следа: ${(prob.preservation_probability * 100).toFixed(0)}%\n\n`;
           
            message += `⚠️ <b>НЕОПРЕДЕЛЕННОСТИ:</b>\n`;
            message += `• Осадки: ±${(result.uncertainties.precipitation * 100).toFixed(0)}%\n`;
            message += `• Температура: ±${(result.uncertainties.temperature * 100).toFixed(0)}%\n`;
            message += `• Плотность снега: ±${(result.uncertainties.snowDensity * 100).toFixed(0)}%\n`;
            message += `• Локальные условия: ±${(result.uncertainties.localEffects * 100).toFixed(0)}%\n\n`;
           
            message += `🎯 <b>РЕКОМЕНДАЦИИ:</b>\n`;
            result.recommendations.forEach((rec, index) => {
                message += `${index + 1}. ${rec.message}\n`;
            });
           
            return message;
        },
       
        getShoeTypes: () => {
            return shoeSizeCalculator.getFootwearTypesList();
        }
    };
}

module.exports = { initialize };
