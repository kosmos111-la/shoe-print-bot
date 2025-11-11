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
        getWeatherData: async (location = 'Москва') => {
            try {
                const result = await weatherService.getWeatherData({ location });
                if (result.success) {
                    return `🌤️ <b>ПОГОДА - ${result.result.location.toUpperCase()}</b>\n\n` +
                           `📅 <b>Текущие условия:</b>\n` +
                           `🌡️ Температура: <b>${result.result.current.temperature}°C</b>\n` +
                           `💨 Ощущается как: <b>${result.result.current.feels_like}°C</b>\n` +
                           `☁️ Погода: <b>${result.result.current.condition}</b>\n` +
                           `💨 Ветер: <b>${result.result.current.wind_speed} м/с</b>\n` +
                           `📡 Давление: <b>${result.result.current.pressure} гПа</b>\n` +
                           `💧 Влажность: <b>${result.result.current.humidity}%</b>\n\n` +
                          
                           `📊 <b>Прогноз на 2 дня:</b>\n` +
                           result.result.forecast.map(day =>
                               `📅 ${day.date}: ${day.temp_min}°C..${day.temp_max}°C, ${day.condition}`
                           ).join('\n') + '\n\n' +
                          
                           `🔍 <b>Для поисковых работ:</b>\n` +
                           `${result.result.searchSummary}`;
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
