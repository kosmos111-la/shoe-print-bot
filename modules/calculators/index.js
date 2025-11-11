const shoeSizeCalculator = require('./shoe-size');
const { WeatherService } = require('./weather-service');
// ВРЕМЕННО ЗАКОММЕНТИРУЕМ - SnowDepthCalculator = require('./snow-depth-calculator');

function initialize() {
    console.log('✅ Модуль калькуляторов загружен');
   
    const weatherService = new WeatherService();
    // ВРЕМЕННО ЗАКОММЕНТИРУЕМ - const snowCalculator = new SnowDepthCalculator();
   
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
       
        // 🔮 ВРЕМЕННАЯ ЗАГЛУШКА для расчета давности следа
        calculateSnowAge: async (coordinates, disappearanceTime, locationInfo = {}) => {
            try {
                // ВРЕМЕННАЯ ЗАГЛУШКА - возвращаем сообщение о разработке
                return `🔮 <b>ВЕРОЯТНОСТНАЯ МОДЕЛЬ СНЕГА</b>\n\n` +
                       `📍 Местоположение: ${coordinates.lat.toFixed(4)}, ${coordinates.lon.toFixed(4)}\n` +
                       `📅 Время пропажи: ${new Date(disappearanceTime).toLocaleString('ru-RU')}\n\n` +
                       `🚧 <i>Модуль находится в разработке</i>\n\n` +
                       `💡 Пока используйте простые расчеты через другие калькуляторы`;
            } catch (error) {
                return `❌ Ошибка расчета: ${error.message}`;
            }
        },
       
        // 🌤️ Погода с историей
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
                   
                    // История за 7 дней (если есть)
                    if (data.history && data.history.length > 0) {
                        message += `📅 <b>ИСТОРИЯ ПОГОДЫ ЗА 7 ДНЕЙ:</b>\n`;
                        data.history.forEach(day => {
                            message += `${day.date}: ${day.temperature}°C, ${day.condition}, осадки: ${day.precipitation}\n`;
                        });
                        message += '\n';
                    }
                   
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
