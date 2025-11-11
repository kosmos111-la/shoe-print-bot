const axios = require('axios');

class WeatherService {
    constructor() {
        this.apiKey = process.env.OPENWEATHER_API_KEY || 'your_api_key_here';
        this.baseURL = 'https://api.openweathermap.org/data/2.5';
    }

    async getWeatherData(options = {}) {
        try {
            let locationName = 'Неизвестно';
            let currentData = {};
           
            // 🔧 ПРОСТОЙ РЕЖИМ - только основные данные
            const isSimpleMode = options.simple === true;

            // Определяем местоположение
            if (options.coordinates) {
                const { lat, lon } = options.coordinates;
                const geoResult = await this.getLocationName(lat, lon);
                locationName = geoResult.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
               
                // Получаем погоду по координатам
                const weatherUrl = `${this.baseURL}/weather`;
                const weatherResponse = await axios.get(weatherUrl, {
                    params: {
                        lat: lat,
                        lon: lon,
                        appid: this.apiKey,
                        units: 'metric',
                        lang: 'ru'
                    }
                });

                currentData = this.formatCurrentWeather(weatherResponse.data);
               
            } else if (options.location) {
                locationName = options.location;
               
                // Получаем погоду по названию города
                const weatherUrl = `${this.baseURL}/weather`;
                const weatherResponse = await axios.get(weatherUrl, {
                    params: {
                        q: options.location,
                        appid: this.apiKey,
                        units: 'metric',
                        lang: 'ru'
                    }
                });

                currentData = this.formatCurrentWeather(weatherResponse.data);
            } else {
                return {
                    success: false,
                    error: 'Не указано местоположение'
                };
            }

            // 🔧 ЕСЛИ ПРОСТОЙ РЕЖИМ - возвращаем только основные данные
            if (isSimpleMode) {
                return {
                    success: true,
                    result: {
                        location: locationName,
                        current: {
                            time: currentData.time,
                            temperature: currentData.temperature,
                            condition: currentData.condition,
                            feels_like: currentData.feels_like,
                            wind_speed: currentData.wind_speed,
                            humidity: currentData.humidity,
                            precipitation: currentData.precipitation,
                            cloudiness: currentData.cloudiness
                        }
                    }
                };
            }

            // 📊 ПОЛНЫЙ РЕЖИМ - получаем дополнительные данные
            let hourlyData = [];
            let forecastData = [];
            let historyData = [];
            let searchSummary = '';

            try {
                // Прогноз на 5 дней
                const forecastUrl = `${this.baseURL}/forecast`;
                const forecastResponse = await axios.get(forecastUrl, {
                    params: {
                        q: locationName,
                        appid: this.apiKey,
                        units: 'metric',
                        lang: 'ru'
                    }
                });

                hourlyData = this.formatHourlyForecast(forecastResponse.data);
                forecastData = this.formatDailyForecast(forecastResponse.data);
               
                // История за 5 дней (эмулируем)
                historyData = this.generateWeatherHistory();
               
                searchSummary = this.generateSearchSummary(currentData, locationName);

            } catch (forecastError) {
                console.log('⚠️ Ошибка получения прогноза:', forecastError.message);
                // Продолжаем без прогноза
            }

            return {
                success: true,
                result: {
                    location: locationName,
                    current: currentData,
                    hourly: hourlyData,
                    forecast: forecastData,
                    history: historyData,
                    searchSummary: searchSummary
                }
            };

        } catch (error) {
            console.log('❌ Ошибка получения погоды:', error.message);
            return {
                success: false,
                error: `Ошибка получения погоды: ${error.response?.data?.message || error.message}`
            };
        }
    }

    // 📍 Получение названия местоположения по координатам
    async getLocationName(lat, lon) {
        try {
            const response = await axios.get('http://api.openweathermap.org/geo/1.0/reverse', {
                params: {
                    lat: lat,
                    lon: lon,
                    limit: 1,
                    appid: this.apiKey
                }
            });
           
            if (response.data && response.data.length > 0) {
                const location = response.data[0];
                return {
                    name: location.name || 'Неизвестно',
                    country: location.country || ''
                };
            }
        } catch (error) {
            console.log('⚠️ Ошибка получения названия местоположения:', error.message);
        }
       
        return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, country: '' };
    }

    // 🌡️ Форматирование текущей погоды
    formatCurrentWeather(data) {
        const now = new Date();
        return {
            time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            temperature: Math.round(data.main.temp),
            feels_like: Math.round(data.main.feels_like),
            condition: data.weather[0].description,
            wind_speed: data.wind.speed,
            humidity: data.main.humidity,
            precipitation: data.rain ? `${data.rain['1h'] || 0} mm` : '0 mm',
            cloudiness: data.clouds.all,
            pressure: data.main.pressure
        };
    }

    // 🕒 Форматирование почасового прогноза
    formatHourlyForecast(data) {
        return data.list.slice(0, 6).map(item => ({
            time: new Date(item.dt * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            temperature: Math.round(item.main.temp),
            condition: item.weather[0].description,
            precipitation: item.rain ? `${item.rain['3h'] || 0} mm` : '0 mm'
        }));
    }

    // 📅 Форматирование ежедневного прогноза
    formatDailyForecast(data) {
        const dailyData = {};
       
        data.list.forEach(item => {
            const date = new Date(item.dt * 1000).toLocaleDateString('ru-RU');
            if (!dailyData[date]) {
                dailyData[date] = {
                    date: date,
                    day_temp: Math.round(item.main.temp),
                    night_temp: Math.round(item.main.temp - 5), // Эмуляция ночной температуры
                    condition: item.weather[0].description,
                    precipitation: item.rain ? `${item.rain['3h'] || 0} mm` : '0 mm'
                };
            }
        });
       
        return Object.values(dailyData).slice(0, 2);
    }

    // 📊 Генерация истории погоды (эмуляция)
    generateWeatherHistory() {
        const history = [];
        const now = new Date();
       
        for (let i = 6; i >= 1; i--) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
           
            history.push({
                date: date.toLocaleDateString('ru-RU'),
                temperature: Math.round(5 + Math.random() * 15), // Случайная температура 5-20°C
                condition: ['Ясно', 'Облачно', 'Пасмурно', 'Небольшой дождь'][Math.floor(Math.random() * 4)],
                precipitation: Math.random() > 0.7 ? `${(Math.random() * 5).toFixed(1)} mm` : '0 mm'
            });
        }
       
        return history;
    }

    // 🔍 Генерация сводки для поиска
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
