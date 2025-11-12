const axios = require('axios');

class WeatherService {
    constructor() {
        this.openMeteoURL = 'https://api.open-meteo.com/v1/forecast';
        this.openMeteoArchiveURL = 'https://archive-api.open-meteo.com/v1/archive';
        this.geocodingAPI = 'https://geocoding-api.open-meteo.com/v1/search';
    }

    async getWeatherData(options = {}) {
        try {
            let locationName = 'Неизвестно';
            let currentData = {};
           
            const isSimpleMode = options.simple === true;

            // Определяем местоположение
            let lat, lon;
            if (options.coordinates) {
                lat = options.coordinates.lat;
                lon = options.coordinates.lon;
                locationName = await this.getLocationName(lat, lon);
            } else if (options.location) {
                const geoData = await this.getCoordinates(options.location);
                if (!geoData) {
                    throw new Error('Город не найден');
                }
                lat = geoData.lat;
                lon = geoData.lon;
                locationName = options.location;
            } else {
                return {
                    success: false,
                    error: 'Не указано местоположение'
                };
            }

            // 🔧 ПРОСТОЙ РЕЖИМ - только текущая погода
            if (isSimpleMode) {
                const currentWeather = await this.getCurrentWeather(lat, lon);
                return {
                    success: true,
                    result: {
                        location: locationName,
                        current: currentWeather
                    }
                };
            }

            // 📊 ПОЛНЫЙ РЕЖИМ - текущая погода + прогноз + история
            const currentWeather = await this.getCurrentWeather(lat, lon);
            const hourlyForecast = await this.getHourlyForecast(lat, lon);
            const dailyForecast = await this.getDailyForecast(lat, lon);
            const weatherHistory = await this.getWeatherHistory(lat, lon, 7);

            return {
                success: true,
                result: {
                    location: locationName,
                    current: currentWeather,
                    hourly: hourlyForecast,
                    forecast: dailyForecast,
                    history: weatherHistory,
                    searchSummary: this.generateSearchSummary(currentWeather, locationName, hourlyForecast, weatherHistory)
                }
            };

        } catch (error) {
            console.log('❌ Ошибка получения погоды:', error.message);
            return {
                success: false,
                error: `Ошибка получения погоды: ${error.message}`
            };
        }
    }

    // 🌤️ ТЕКУЩАЯ ПОГОДА
    async getCurrentWeather(lat, lon) {
        try {
            const response = await axios.get(this.openMeteoURL, {
                params: {
                    latitude: lat,
                    longitude: lon,
                    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
                    timezone: 'auto'
                }
            });

            const current = response.data.current;
            return {
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                temperature: Math.round(current.temperature_2m),
                feels_like: Math.round(current.apparent_temperature),
                condition: this.getWeatherCondition(current.weather_code),
                wind_speed: current.wind_speed_10m.toFixed(1),
                humidity: current.relative_humidity_2m,
                precipitation: current.precipitation,
                cloudiness: this.getCloudiness(current.weather_code)
            };
        } catch (error) {
            console.log('⚠️ Ошибка получения текущей погоды:', error.message);
            throw new Error('Не удалось получить текущую погоду');
        }
    }

    // 🕒 ПОЧАСОВОЙ ПРОГНОЗ
    async getHourlyForecast(lat, lon) {
        try {
            const response = await axios.get(this.openMeteoURL, {
                params: {
                    latitude: lat,
                    longitude: lon,
                    hourly: 'temperature_2m,weather_code,precipitation',
                    forecast_days: 2,
                    timezone: 'auto'
                }
            });

            const hourly = response.data.hourly;
            const forecast = [];
           
            // Ближайшие 6 периодов
            for (let i = 0; i < 6; i++) {
                forecast.push({
                    time: new Date(hourly.time[i]).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                    temperature: Math.round(hourly.temperature_2m[i]),
                    condition: this.getWeatherCondition(hourly.weather_code[i]),
                    precipitation: hourly.precipitation[i]
                });
            }
           
            return forecast;
        } catch (error) {
            console.log('⚠️ Ошибка получения почасового прогноза:', error.message);
            return [];
        }
    }

    // 📅 ПРОГНОЗ НА 2 ДНЯ
    async getDailyForecast(lat, lon) {
        try {
            const response = await axios.get(this.openMeteoURL, {
                params: {
                    latitude: lat,
                    longitude: lon,
                    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
                    forecast_days: 3,
                    timezone: 'auto'
                }
            });

            const daily = response.data.daily;
            const forecast = [];
           
            for (let i = 0; i < 2; i++) {
                forecast.push({
                    date: new Date(daily.time[i]).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                    day_temp: Math.round(daily.temperature_2m_max[i]),
                    night_temp: Math.round(daily.temperature_2m_min[i]),
                    condition: this.getWeatherCondition(daily.weather_code[i]),
                    precipitation: daily.precipitation_sum[i]
                });
            }
           
            return forecast;
        } catch (error) {
            console.log('⚠️ Ошибка получения прогноза:', error.message);
            return [];
        }
    }

    // 📊 ИСТОРИЯ ПОГОДЫ ЗА 7 СУТОК С ВЕТРОМ
    async getWeatherHistory(lat, lon, days = 7) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);

            const response = await axios.get(this.openMeteoArchiveURL, {
                params: {
                    latitude: lat,
                    longitude: lon,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max',
                    timezone: 'auto'
                }
            });

            const daily = response.data.daily;
            const history = [];
           
            for (let i = 0; i < daily.time.length; i++) {
                history.push({
                    date: new Date(daily.time[i]).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                    day_temp: Math.round(daily.temperature_2m_max[i]),
                    night_temp: Math.round(daily.temperature_2m_min[i]),
                    condition: this.getWeatherCondition(daily.weather_code[i]),
                    precipitation: daily.precipitation_sum[i],
                    wind_speed: daily.wind_speed_10m_max[i].toFixed(1)
                });
            }
           
            return history;
        } catch (error) {
            console.log('⚠️ Ошибка получения истории погоды:', error.message);
            return [];
        }
    }

    // 📍 ГЕОКОДИНГ
    async getCoordinates(locationName) {
        try {
            const response = await axios.get(this.geocodingAPI, {
                params: {
                    name: locationName,
                    count: 1,
                    language: 'ru',
                    format: 'json'
                }
            });

            if (response.data.results && response.data.results.length > 0) {
                return {
                    lat: response.data.results[0].latitude,
                    lon: response.data.results[0].longitude
                };
            }
        } catch (error) {
            console.log('⚠️ Ошибка геокодинга:', error.message);
        }
        return null;
    }

    async getLocationName(lat, lon) {
        try {
            const response = await axios.get(this.geocodingAPI, {
                params: {
                    latitude: lat,
                    longitude: lon,
                    count: 1,
                    language: 'ru'
                }
            });
           
            if (response.data.results && response.data.results.length > 0) {
                return response.data.results[0].name;
            }
        } catch (error) {
            console.log('⚠️ Ошибка получения названия:', error.message);
        }
        return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }

    // 🎯 КОДЫ ПОГОДЫ WMO
    getWeatherCondition(weatherCode) {
        const conditions = {
            0: '☀️ Ясно',
            1: '🌤️ Преимущественно ясно',
            2: '⛅ Переменная облачность',
            3: '☁️ Пасмурно',
            45: '🌫️ Туман',
            48: '🌫️ Туман с инеем',
            51: '🌧️ Морось',
            53: '🌧️ Морось',
            55: '🌧️ Морось',
            56: '🌧️❄️ Морозная морось',
            57: '🌧️❄️ Морозная морось',
            61: '🌧️ Небольшой дождь',
            63: '🌧️ Дождь',
            65: '🌧️ Сильный дождь',
            66: '🌧️❄️ Морозный дождь',
            67: '🌧️❄️ Морозный дождь',
            71: '❄️ Небольшой снег',
            73: '❄️ Снег',
            75: '❄️ Сильный снег',
            77: '❄️ Снежные зерна',
            80: '🌧️ Небольшой ливень',
            81: '🌧️ Ливень',
            82: '🌧️ Сильный ливень',
            85: '❄️ Небольшой снегопад',
            86: '❄️ Снегопад',
            95: '⛈️ Гроза',
            96: '⛈️ Гроза с градом',
            99: '⛈️ Гроза с градом'
        };
        return conditions[weatherCode] || '❓ Неизвестно';
    }

    getCloudiness(weatherCode) {
        if (weatherCode === 0) return 0;
        if (weatherCode <= 2) return 30;
        if (weatherCode === 3) return 80;
        return 50;
    }

    // 🔍 СВОДКА ДЛЯ ПОИСКА С РЕКОМЕНДАЦИЯМИ ПО ОДЕЖДЕ
    generateSearchSummary(currentData, location, hourlyForecast, weatherHistory) {
        const temp = currentData.temperature;
        let conditions = '';
       
        if (temp < 0) {
            conditions = '❄️ Холодно, возможен снег и наледь';
        } else if (temp < 10) {
            conditions = '🌧️ Прохладно, возможны осадки';
        } else if (temp < 20) {
            conditions = '⛅ Умеренно, хорошие условия для поиска';
        } else {
            conditions = '☀️ Тепло, отличная видимость';
        }

        // 🎯 АНАЛИЗ ДЛЯ РЕКОМЕНДАЦИЙ ПО ОДЕЖДЕ
        const clothingRecommendations = this.generateClothingRecommendations(currentData, hourlyForecast, weatherHistory);
       
        return `🔍 <b>УСЛОВИЯ ДЛЯ ПОИСКА В ${location.toUpperCase()}:</b>\n${conditions}\n\n` +
               `👕 <b>РЕКОМЕНДАЦИИ ПО ОДЕЖДЕ:</b>\n${clothingRecommendations}`;
    }

    // 👕 ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ ПО ОДЕЖДЕ
    generateClothingRecommendations(currentData, hourlyForecast, weatherHistory) {
        const recommendations = [];
       
        // Проверяем осадки за последние 24 часа
        const last24hPrecipitation = this.getLast24hPrecipitation(weatherHistory);
        const hasRecentRain = last24hPrecipitation > 0;
       
        // Проверяем осадки в ближайшие 8 часов
        const next8hPrecipitation = this.getNext8hPrecipitation(hourlyForecast);
        const hasUpcomingRain = next8hPrecipitation.rain > 0;
        const hasUpcomingWetSnow = next8hPrecipitation.wetSnow > 0;
       
        // Базовые рекомендации по температуре
        if (currentData.temperature < 5) {
            recommendations.push('• 🧥 Теплая куртка, шапка, перчатки');
        } else if (currentData.temperature < 15) {
            recommendations.push('• 🧥 Куртка или ветровка');
        } else {
            recommendations.push('• 👕 Легкая одежда');
        }
       
        // Рекомендации по влажности/осадкам
        if (hasRecentRain || currentData.humidity > 85) {
            recommendations.push('• 🌧️ Одеваться на "мокрый лес" - влагоотталкивающая одежда');
        }
       
        if (hasUpcomingRain || hasUpcomingWetSnow) {
            recommendations.push('• 🎒 Взять с собой защиту от дождя/мокрого снега');
        }
       
        if (currentData.wind_speed > 5) {
            recommendations.push('• 💨 Ветрозащитная одежда');
        }
       
        // Предупреждения
        if (hasRecentRain) {
            recommendations.push('⚠️ В последние сутки шел дождь - лес мокрый');
        }
       
        if (hasUpcomingRain) {
            recommendations.push('⚠️ В ближайшие 8 часов ожидается дождь');
        }
       
        if (hasUpcomingWetSnow) {
            recommendations.push('⚠️ В ближайшие 8 часов ожидается мокрый снег');
        }
       
        return recommendations.join('\n');
    }

    // 📊 ПОЛУЧИТЬ ОСАДКИ ЗА ПОСЛЕДНИЕ 24 ЧАСА
    getLast24hPrecipitation(weatherHistory) {
        if (!weatherHistory || weatherHistory.length === 0) return 0;
       
        // Берем данные за последние 1-2 дня (история может быть дневной)
        let totalPrecip = 0;
        const daysToCheck = Math.min(2, weatherHistory.length);
       
        for (let i = 0; i < daysToCheck; i++) {
            totalPrecip += weatherHistory[i].precipitation || 0;
        }
       
        return totalPrecip;
    }

    // 📊 ПОЛУЧИТЬ ОСАДКИ НА БЛИЖАЙШИЕ 8 ЧАСОВ
    getNext8hPrecipitation(hourlyForecast) {
        let rain = 0;
        let wetSnow = 0;
       
        if (!hourlyForecast || hourlyForecast.length === 0) {
            return { rain, wetSnow };
        }
       
        const hoursToCheck = Math.min(8, hourlyForecast.length);
       
        for (let i = 0; i < hoursToCheck; i++) {
            const hour = hourlyForecast[i];
            const precip = hour.precipitation || 0;
           
            // Определяем тип осадков по условию и температуре
            if (precip > 0) {
                if (hour.temperature > 1) {
                    rain += precip;
                } else {
                    wetSnow += precip;
                }
            }
        }
       
        return { rain, wetSnow };
    }
}

module.exports = { WeatherService };
