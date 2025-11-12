const axios = require('axios');

class WeatherService {
    constructor() {
        // OpenWeather API (текущая погода + прогноз)
        this.openWeatherKey = process.env.OPENWEATHER_API_KEY; // ← ИСПОЛЬЗУЕМ ПЕРЕМЕННУЮ ОКРУЖЕНИЯ
        this.openWeatherURL = 'https://api.openweathermap.org/data/2.5';
        this.openWeatherGeoURL = 'http://api.openweathermap.org/geo/1.0';
       
        // Open-Meteo API (история)
        this.openMeteoArchiveURL = 'https://archive-api.open-meteo.com/v1/archive';
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

            // 🔧 ПРОСТОЙ РЕЖИМ - только текущая погода (OpenWeather)
            if (isSimpleMode) {
                const currentWeather = await this.getOpenWeatherCurrent(lat, lon);
                return {
                    success: true,
                    result: {
                        location: locationName,
                        current: currentWeather
                    }
                };
            }

            // 📊 ПОЛНЫЙ РЕЖИМ - комбинированный подход
            const currentWeather = await this.getOpenWeatherCurrent(lat, lon);
            const hourlyForecast = await this.getOpenWeatherForecast(lat, lon);
            const dailyForecast = await this.getOpenWeatherDailyForecast(lat, lon);
            const weatherHistory = await this.getOpenMeteoHistory(lat, lon, 7); // история за 7 дней из Open-Meteo

            return {
                success: true,
                result: {
                    location: locationName,
                    current: currentWeather,
                    hourly: hourlyForecast,
                    forecast: dailyForecast,
                    history: weatherHistory,
                    searchSummary: this.generateSearchSummary(currentWeather, locationName)
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

    // 🌤️ ТЕКУЩАЯ ПОГОДА (OpenWeather)
    async getOpenWeatherCurrent(lat, lon) {
        try {
            const response = await axios.get(`${this.openWeatherURL}/weather`, {
                params: {
                    lat: lat,
                    lon: lon,
                    appid: this.openWeatherKey,
                    units: 'metric',
                    lang: 'ru'
                }
            });

            const data = response.data;
            return {
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                temperature: Math.round(data.main.temp),
                feels_like: Math.round(data.main.feels_like),
                condition: data.weather[0].description,
                wind_speed: data.wind.speed,
                humidity: data.main.humidity,
                precipitation: data.rain ? `${data.rain['1h'] || 0} mm` : '0 mm',
                cloudiness: data.clouds.all,
                pressure: data.main.pressure
            };
        } catch (error) {
            console.log('⚠️ Ошибка OpenWeather текущей погоды:', error.message);
            throw new Error('Не удалось получить текущую погоду');
        }
    }

    // 🕒 ПОЧАСОВОЙ ПРОГНОЗ (OpenWeather)
    async getOpenWeatherForecast(lat, lon) {
        try {
            const response = await axios.get(`${this.openWeatherURL}/forecast`, {
                params: {
                    lat: lat,
                    lon: lon,
                    appid: this.openWeatherKey,
                    units: 'metric',
                    lang: 'ru'
                }
            });

            const forecast = [];
            // Ближайшие 6 периодов (3 часа каждый)
            for (let i = 0; i < 6; i++) {
                const item = response.data.list[i];
                forecast.push({
                    time: new Date(item.dt * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                    temperature: Math.round(item.main.temp),
                    condition: item.weather[0].description,
                    precipitation: item.rain ? `${item.rain['3h'] || 0} mm` : '0 mm'
                });
            }
            
            return forecast;
        } catch (error) {
            console.log('⚠️ Ошибка OpenWeather прогноза:', error.message);
            return [];
        }
    }

    // 📅 ПРОГНОЗ НА 2 ДНЯ (OpenWeather)
    async getOpenWeatherDailyForecast(lat, lon) {
        try {
            const response = await axios.get(`${this.openWeatherURL}/forecast`, {
                params: {
                    lat: lat,
                    lon: lon,
                    appid: this.openWeatherKey,
                    units: 'metric',
                    lang: 'ru'
                }
            });

            const dailyData = {};
            
            response.data.list.forEach(item => {
                const date = new Date(item.dt * 1000).toLocaleDateString('ru-RU');
                if (!dailyData[date]) {
                    dailyData[date] = {
                        date: date,
                        day_temp: Math.round(item.main.temp),
                        night_temp: Math.round(item.main.temp - 3), // упрощенная ночная температура
                        condition: item.weather[0].description,
                        precipitation: item.rain ? `${item.rain['3h'] || 0} mm` : '0 mm'
                    };
                }
            });
            
            return Object.values(dailyData).slice(0, 2);
        } catch (error) {
            console.log('⚠️ Ошибка OpenWeather daily прогноза:', error.message);
            return [];
        }
    }

    // 📊 ИСТОРИЯ ПОГОДЫ ЗА 7 ДНЕЙ (Open-Meteo)
    async getOpenMeteoHistory(lat, lon, days = 7) {
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
                    daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum',
                    timezone: 'auto'
                }
            });

            const daily = response.data.daily;
            const history = [];
            
            for (let i = 0; i < daily.time.length; i++) {
                history.push({
                    date: new Date(daily.time[i]).toLocaleDateString('ru-RU'),
                    temperature: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
                    condition: this.getOpenMeteoWeatherCondition(daily.weather_code[i]),
                    precipitation: `${daily.precipitation_sum[i]} mm`
                });
            }
            
            return history;
        } catch (error) {
            console.log('⚠️ Ошибка Open-Meteo истории:', error.message);
            return []; // возвращаем пустой массив вместо фейков
        }
    }

    // 📍 ГЕОКОДИНГ (OpenWeather)
    async getCoordinates(locationName) {
        try {
            const response = await axios.get(`${this.openWeatherGeoURL}/direct`, {
                params: {
                    q: locationName,
                    limit: 1,
                    appid: this.openWeatherKey
                }
            });

            if (response.data && response.data.length > 0) {
                return {
                    lat: response.data[0].lat,
                    lon: response.data[0].lon
                };
            }
        } catch (error) {
            console.log('⚠️ Ошибка геокодинга:', error.message);
        }
        return null;
    }

    async getLocationName(lat, lon) {
        try {
            const response = await axios.get(`${this.openWeatherGeoURL}/reverse`, {
                params: {
                    lat: lat,
                    lon: lon,
                    limit: 1,
                    appid: this.openWeatherKey
                }
            });
            
            if (response.data && response.data.length > 0) {
                return response.data[0].name;
            }
        } catch (error) {
            console.log('⚠️ Ошибка получения названия:', error.message);
        }
        return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }

    // 🎯 КОДЫ ПОГОДЫ WMO (для Open-Meteo)
    getOpenMeteoWeatherCondition(weatherCode) {
        const conditions = {
            0: 'Ясно',
            1: 'Преимущественно ясно',
            2: 'Переменная облачность',
            3: 'Пасмурно',
            45: 'Туман',
            48: 'Туман с инеем',
            51: 'Морось',
            53: 'Морось',
            55: 'Морось',
            61: 'Дождь',
            63: 'Дождь',
            65: 'Дождь',
            71: 'Снег',
            73: 'Снег',
            75: 'Снег',
            77: 'Снежные зерна',
            80: 'Ливень',
            81: 'Ливень',
            82: 'Ливень',
            85: 'Снегопад',
            86: 'Снегопад',
            95: 'Гроза',
            96: 'Гроза с градом',
            99: 'Гроза с градом'
        };
        return conditions[weatherCode] || 'Неизвестно';
    }

    // 🔍 СВОДКА ДЛЯ ПОИСКА
    generateSearchSummary(currentData, location) {
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
        
        return `🔍 <b>УСЛОВИЯ ДЛЯ ПОИСКА В ${location.toUpperCase()}:</b>\n${conditions}\n\n` +
               `💡 <b>Рекомендации:</b>\n` +
               `• Учитывайте тип грунта и осадки\n` +
               `• Проверяйте видимость следов\n` +
               `• Уточняйте время последних осадков`;
    }
}

module.exports = { WeatherService };
