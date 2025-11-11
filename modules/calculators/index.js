const shoeSizeCalculator = require('./shoe-size');
const { WeatherService } = require('./weather-service');

function initialize() {
    console.log('✅ Модуль калькуляторов загружен');
   
    const weatherService = new WeatherService();
   
    // 🎯 ИНТЕЛЛЕКТУАЛЬНАЯ ПРОВЕРКА СНЕГА ПО ПОГОДЕ
    const hasSnowConditions = async (coordinates) => {
        try {
            // Получаем текущую погоду для проверки
            const weatherResult = await weatherService.getWeatherData({
                coordinates: coordinates,
                simple: true // только основные данные
            });
           
            if (weatherResult.success) {
                const data = weatherResult.result;
                const temp = data.current.temperature;
                const condition = data.current.condition.toLowerCase();
               
                console.log('🔍 Проверка снежных условий:', { temp, condition });
               
                // Условия для снега: температура < +2°C и снег/мороз в описании
                const isColdEnough = temp < 2;
                const hasSnowKeywords = condition.includes('снег') ||
                                      condition.includes('мороз') ||
                                      condition.includes('метель') ||
                                      condition.includes('snow') ||
                                      condition.includes('frost');
               
                return isColdEnough || hasSnowKeywords;
            }
        } catch (error) {
            console.log('⚠️ Ошибка проверки снежных условий:', error);
        }
       
        // Если не удалось проверить, используем сезонную логику
        const now = new Date();
        const month = now.getMonth() + 1;
        return month >= 11 || month <= 3; // ноябрь-март
    };
   
    return {
        getMenu: async () => {
            const baseSections = [
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
                    name: "🌤️ Погода",
                    command: "/calc_weather",
                    description: "Метеоданные для анализа следов"
                }
            ];
           
            // Для меню используем сезонную логику (без координат)
            const now = new Date();
            const month = now.getMonth() + 1;
            const isWinterSeason = month >= 11 || month <= 3;
           
            if (isWinterSeason) {
                baseSections.splice(2, 0, {
                    name: "⏱️❄️ Калькулятор давности следа на снегу",
                    command: "/calc_snow_age",
                    description: "Расчет эволюции снежного покрова"
                });
            }
           
            const seasonIcon = isWinterSeason ? " ❄️" : " 🍂";
           
            return {
                title: "🧮 КАЛЬКУЛЯТОРЫ" + seasonIcon,
                sections: baseSections
            };
        },
       
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
       
        calculateSnowAge: async (coordinates, disappearanceTime, locationInfo = {}) => {
    try {
        console.log('❄️ Проверяю снежные условия для:', coordinates);
       
        // ПРОВЕРЯЕМ АКТУАЛЬНЫЕ УСЛОВИЯ
        const weatherResult = await weatherService.getWeatherData({
            coordinates: coordinates,
            simple: true
        });
       
        if (!weatherResult.success) {
            return `❌ Не удалось проверить погодные условия: ${weatherResult.error}`;
        }
       
        const data = weatherResult.result;
        const temp = data.current.temperature;
        const condition = data.current.condition.toLowerCase();
       
        console.log('🔍 Погодные условия:', { temp, condition });
       
        // Условия для снега: температура < +2°C и снег/мороз в описании
        const isColdEnough = temp < 2;
        const hasSnowKeywords = condition.includes('снег') ||
                              condition.includes('мороз') ||
                              condition.includes('метель') ||
                              condition.includes('snow') ||
                              condition.includes('frost') ||
                              condition.includes('ice');
       
        const snowConditions = isColdEnough || hasSnowKeywords;
       
        if (!snowConditions) {
            return `❄️ <b>СНЕЖНЫХ УСЛОВИЙ НЕТ</b>\n\n` +
                   `📍 Местоположение: ${data.location}\n` +
                   `🌡️ Сейчас: ${temp}°C, ${data.current.condition}\n` +
                   `💨 Ветер: ${data.current.wind_speed} м/с\n\n` +
                   `💡 <b>Снежный анализ невозможен:</b>\n` +
                   `• Температура выше +2°C\n` +
                   `• Отсутствует снежный покров\n` +
                   `• Условия не соответствуют зимним\n\n` +
                   `🎯 <b>Используйте другие инструменты:</b>\n` +
                   `• /calc_shoe - расчет размеров обуви\n` +
                   `• /calc_reverse - обратный расчет\n` +
                   `• /calc_weather - детальная погода\n\n` +
                   `❄️ Калькулятор снега активируется при температуре ниже +2°C и наличии снега`;
        }
       
        // ЕСЛИ УСЛОВИЯ ПОДХОДЯЩИЕ - ВЫПОЛНЯЕМ РАСЧЕТ
        return `🔮 <b>ВЕРОЯТНОСТНАЯ МОДЕЛЬ СНЕГА</b>\n\n` +
               `📍 Местоположение: ${data.location}\n` +
               `🌡️ Текущие условия: ${temp}°C, ${data.current.condition}\n` +
               `📅 Время пропажи: ${new Date(disappearanceTime).toLocaleString('ru-RU')}\n` +
               `❄️ Условия: подходящие для снежного анализа\n\n` +
               `🚧 <i>Модуль находится в разработке</i>\n\n` +
               `💡 Пока используйте простые расчеты через другие калькуляторы`;
    } catch (error) {
        console.log('❌ Ошибка снежного калькулятора:', error);
        return `❌ Ошибка расчета: ${error.message}`;
    }
},
       
        // 🌤️ Погода
        getWeatherData: async (options = {}) => {
            try {
                const result = await weatherService.getWeatherData(options);
                if (result.success) {
                    const data = result.result;
                   
                    // Определяем сезон по температуре
                    const season = data.current.temperature < 5 ? '❄️' : '🍂';
                   
                    let message = `🌤️ <b>ПОГОДА - ${data.location.toUpperCase()}</b> ${season}\n\n`;
                   
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
