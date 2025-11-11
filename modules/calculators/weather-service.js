const axios = require('axios');

class WeatherService {
    constructor() {
        this.apiKey = 'f5cc2e480cb5a7dc580b07920c32250c';
        this.baseURL = 'https://api.openweathermap.org/data/2.5';
        this.setupWeatherConditions();
    }

    setupWeatherConditions() {
        this.weatherConditions = {
            '200': '⛈️ Гроза с дождем', '201': '⛈️ Гроза', '202': '⛈️ Сильная гроза',
            '210': '⛈️ Легкая гроза', '211': '⛈️ Гроза', '212': '⛈️ Сильная гроза',
           
            '300': '🌧️ Легкая морось', '301': '🌧️ Морось', '302': '🌧️ Сильная морось',
            '310': '🌧️ Моросящий дождь', '311': '🌧️ Моросящий дождь', '312': '🌧️ Сильный моросящий дождь',
           
            '500': '🌧️ Легкий дождь', '501': '🌧️ Умеренный дождь', '502': '🌧️ Сильный дождь',
            '503': '🌧️ Очень сильный дождь', '504': '🌧️ Экстремальный дождь',
            '511': '🌧️❄️ Ледяной дождь', '520': '🌦️ Легкий ливень', '521': '🌦️ Ливень',
           
            '600': '❄️ Легкий снег', '601': '❄️ Снег', '602': '❄️ Сильный снег',
            '611': '🌧️❄️ Мокрый снег', '612': '🌧️❄️ Мокрый снег', '613': '🌧️❄️ Ливень с мокрым снегом',
            '615': '🌧️❄️ Легкий дождь со снегом', '616': '🌧️❄️ Дождь со снегом',
            '620': '❄️ Легкий снегопад', '621': '❄️ Снегопад', '622': '❄️ Сильный снегопад',
           
            '701': '🌫️ Туман', '711': '🌫️ Дым', '721': '🌫️ Дымка', '731': '🌫️ Песчаная буря',
            '741': '🌫️ Туман', '751': '🌫️ Песок',
           
            '800': '☀️ Ясно', '801': '⛅ Малооблачно', '802': '⛅ Облачно',
            '803': '☁️ Пасмурно', '804': '☁️ Пасмурно'
        };
    }

    async getWeatherData(options) {
        try {
            const { location, coordinates } = options;
           
            // Используем координаты или Москву по умолчанию
            const lat = coordinates?.lat || 55.7558;
            const lon = coordinates?.lon || 37.6173;
           
            // Получаем текущую погоду и прогноз
            const [current, forecast] = await Promise.all([
                this.getCurrentWeather(lat, lon),
                this.getWeatherForecast(lat, lon)
            ]);

            // Генерируем историю
            const history = this.generateWeatherHistory(7);

            return {
                success: true,
                result: {
                    location: location || current.city || `Координаты: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                    current: current,
                    forecast: forecast,
                    history: history,
                    searchSummary: this.generateSearchSummary(current, history)
                }
            };
           
        } catch (error) {
            console.error('Weather service error:', error);
            return {
                success: false,
                error: 'Не удалось получить данные погоды',
                details: error.message
            };
        }
    }

    async getCurrentWeather(lat, lon) {
        const response = await axios.get(`${this.baseURL}/weather`, {
            params: {
                lat: lat,
                lon: lon,
                appid: this.apiKey,
                units: 'metric',
                lang: 'ru'
            }
        });

        const data = response.data;
       
        return {
            temperature: Math.round(data.main.temp),
            feels_like: Math.round(data.main.feels_like),
            condition: this.weatherConditions[data.weather[0].id] || data.weather[0].description,
            wind_speed: data.wind.speed,
            pressure: data.main.pressure,
            humidity: data.main.humidity,
            city: data.name
        };
    }

    async getWeatherForecast(lat, lon) {
        const response = await axios.get(`${this.baseURL}/forecast`, {
            params: {
                lat: lat,
                lon: lon,
                appid: this.apiKey,
                units: 'metric',
                lang: 'ru'
            }
        });

        const forecast = [];
        const processedDays = new Set();

        response.data.list.forEach(item => {
            const date = item.dt_txt.split(' ')[0];
            if (!processedDays.has(date) && forecast.length < 2) {
                processedDays.add(date);
               
                forecast.push({
                    date: date,
                    temp_min: Math.round(item.main.temp_min),
                    temp_max: Math.round(item.main.temp_max),
                    condition: this.weatherConditions[item.weather[0].id] || item.weather[0].description
                });
            }
        });

        return forecast;
    }

    generateWeatherHistory(daysCount) {
        const history = [];
        const baseDate = new Date();
       
        for (let i = daysCount; i > 0; i--) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - i);
           
            const baseTemp = -3 + Math.random() * 8 - 4;
           
            history.push({
                date: date.toISOString().split('T')[0],
                temperature: Math.round(baseTemp),
                condition: this.getRandomWeatherCondition(baseTemp),
                wind_speed: (1.5 + Math.random() * 5).toFixed(1),
                precipitation: Math.random() > 0.7 ? (Math.random() * 4).toFixed(1) : 0
            });
        }
       
        return history;
    }

    getRandomWeatherCondition(temperature) {
        if (temperature > 5) {
            return ['☀️ Ясно', '⛅ Облачно', '☁️ Пасмурно'][Math.floor(Math.random() * 3)];
        } else if (temperature > 0) {
            return ['⛅ Облачно', '☁️ Пасмурно', '🌧️ Дождь'][Math.floor(Math.random() * 3)];
        } else {
            return ['❄️ Снег', '☁️ Пасмурно', '⛅ Облачно', '❄️ Снегопад'][Math.floor(Math.random() * 4)];
        }
    }

    generateSearchSummary(current, history) {
        let summary = "📊 <b>Условия для поиска:</b>\n\n";
       
        summary += `🌡️ <b>Температура:</b> ${current.temperature}°C\n`;
       
        if (current.temperature > 0) {
            summary += "⚠️ <b>Следы:</b> Быстро разрушаются (температура выше нуля)\n";
        } else if (current.temperature > -5) {
            summary += "✅ <b>Следы:</b> Сохраняются 1-2 дня\n";
        } else {
            summary += "🔄 <b>Следы:</b> Сохраняются 3-5 дней\n";
        }
       
        const hasRecentSnow = history.some(day => day.precipitation > 0 && day.temperature < 2);
        if (hasRecentSnow) {
            summary += "❄️ <b>Снег:</b> Недавние осадки могут скрывать следы\n";
        }
       
        return summary;
    }
}

module.exports = { WeatherService };
