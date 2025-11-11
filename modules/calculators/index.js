const shoeSizeCalculator = require('./shoe-size');
//const heightCalculator = { estimate: () => ({ success: false, error: 'В разработке' }) };
const { SnowCalculator } = require('./snow-calculator');
const { WeatherService } = require('./weather-service');

/**
* Меню калькуляторов
*/
function initialize() {
    console.log('✅ Модуль калькуляторов загружен');
   
    // Инициализируем калькуляторы
    const snowCalc = new SnowCalculator();
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
                    name: "❄️ Снежный покров",
                    command: "/calc_snow",
                    description: "Расчет высоты снега по следам"
                },
                {
                    name: "🌤️ Погода",
                    command: "/calc_weather",
                    description: "Метеоданные для анализа следов"
                }
            ]
        }),
       
        // Прямой расчет размеров
        calculateShoeSize: (size, type) => {
            const result = shoeSizeCalculator.calculate({ size, type });
            if (result.success) {
                return result.result;
            } else {
                return `❌ ${result.error}`;
            }
        },
       
        // Обратный расчет размеров
        calculateReverse: (footprintLength) => {
            const result = shoeSizeCalculator.calculateReverse(footprintLength);
            if (result.success) {
                return result.result;
            } else {
                return `❌ ${result.error}`;
            }
        },
       
        // Калькулятор снега
        calculateSnowDepth: (trackDepth, snowType = 'fresh', compression = 'medium') => {
            try {
                const result = snowCalc.calculateSnowDepth({
                    trackDepth: parseFloat(trackDepth),
                    snowType: snowType,
                    compression: compression
                });
               
                if (result.success) {
                    return `❄️ <b>РАСЧЕТ ВЫСОТЫ СНЕГА</b>\n\n` +
                           `📏 Глубина следа: <b>${result.result.trackDepth} см</b>\n` +
                           `🏷️ Тип снега: <b>${result.result.snowType}</b>\n` +
                           `📊 Коэффициент уплотнения: <b>${result.result.compressionFactor}</b>\n` +
                           `📐 Расчетная высота снега: <b>${result.result.estimatedSnowDepth} см</b>\n\n` +
                           `💡 <i>${result.result.message}</i>`;
                } else {
                    return `❌ ${result.error}`;
                }
            } catch (error) {
                return `❌ Ошибка расчета снега: ${error.message}`;
            }
        },
       
        // Модуль погоды - теперь асинхронный
        getWeatherData: async (options = {}) => {
    try {
        const result = await weatherService.getWeatherData(options);
        if (result.success) {
            const data = result.result;
           
            let message = `🌤️ <b>ПОГОДА - ${data.location.toUpperCase()}</b>\n\n`;
           
            // История за 7 дней
            message += `📅 <b>ИСТОРИЯ (7 ДНЕЙ):</b>\n`;
            data.history.forEach(day => {
                message += `${day.date}: День ${day.day_temp}°C / Ночь ${day.night_temp}°C, ${day.condition}, ${day.precipitation}\n`;
            });
            message += '\n';
           
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
            message += `📈 <b>ПРОГНОЗ (2 ДНЯ):</b>\n`;
            data.forecast.forEach(day => {
                message += `${day.date}: День ${day.day_temp}°C / Ночь ${day.night_temp}°C, ${day.condition}, ${day.precipitation}\n`;
            });
            message += '\n';
           
            // Анализ
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
