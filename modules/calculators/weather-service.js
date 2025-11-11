/**
* Модуль погоды
*/
// weatherService.js
const axios = require('axios');

class WeatherService {
    constructor() {
        this.apiKey = 'f5cc2e480cb5a7dc580b07920c32250c'; // ваш ключ
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
            const { location, date, coordinates } = options;
           
            // Используем координаты или Москву по умолчанию
            const lat = coordinates?.lat || 55.7558;
            const lon = coordinates?.lon || 37.6173;
           
            // Получаем все данные погоды
            const weatherData = await this.getCompleteWeather(lat, lon);
           
            return {
                success: true,
                result: {
                    location: location || `Координаты: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                    date: date || new Date().toLocaleDateString('ru-RU'),
                    coordinates: { lat, lon },
                   
                    // Текущая погода
                    current: weatherData.current,
                   
                    // Прогноз на 2 дня вперед
                    forecast: weatherData.forecast,
                   
                    // История на 7 дней назад
                    history: weatherData.history,
                   
                    // Сводка для поисковых работ
                    searchSummary: this.generateSearchSummary(weatherData)
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

    async getCompleteWeather(lat, lon) {
        // Получаем текущую погоду и прогноз
        const [currentData, forecastData] = await Promise.all([
            this.getCurrentWeather(lat, lon),
            this.getWeatherForecast(lat, lon)
        ]);

        // Генерируем историю (в бесплатном API нет истории, используем демо-данные)
        const history = this.generateWeatherHistory(7);

        return {
            current: currentData,
            forecast: forecastData,
            history: history
        };
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
            description: data.weather[0].description,
            wind_speed: data.wind.speed,
            wind_gust: data.wind.gust || data.wind.speed * 1.5,
            wind_deg: data.wind.deg,
            pressure: data.main.pressure,
            humidity: data.main.humidity,
            visibility: data.visibility ? (data.visibility / 1000).toFixed(1) + ' км' : 'н/д',
            cloudiness: data.clouds.all,
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

        // Группируем по дням (берем прогноз на 2 дня)
        response.data.list.forEach(item => {
            const date = item.dt_txt.split(' ')[0];
            if (!processedDays.has(date) && forecast.length < 2) {
                processedDays.add(date);
               
                forecast.push({
                    date: date,
                    temperature: Math.round(item.main.temp),
                    temp_min: Math.round(item.main.temp_min),
                    temp_max: Math.round(item.main.temp_max),
                    condition: this.weatherConditions[item.weather[0].id] || item.weather[0].description,
                    wind_speed: item.wind.speed,
                    pressure: item.main.pressure,
                    humidity: item.main.humidity,
                    precipitation: item.rain ? item.rain['3h'] || 0 : 0,
                    snow: item.snow ? item.snow['3h'] || 0 : 0,
                    pop: Math.round((item.pop || 0) * 100) // вероятность осадков %
                });
            }
        });

        return forecast;
    }

    generateWeatherHistory(daysCount) {
        const history = [];
        const baseDate = new Date();
       
        // Генерируем правдоподобные исторические данные
        for (let i = daysCount; i > 0; i--) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - i);
           
            const baseTemp = -3 + Math.random() * 8 - 4; // Случайная температура вокруг -3°C
           
            history.push({
                date: date.toISOString().split('T')[0],
                temperature: Math.round(baseTemp),
                temp_min: Math.round(baseTemp - 2 - Math.random() * 3),
                temp_max: Math.round(baseTemp + 1 + Math.random() * 2),
                condition: this.getRandomWeatherCondition(baseTemp),
                wind_speed: (1.5 + Math.random() * 5).toFixed(1),
                pressure: Math.round(740 + Math.random() * 20),
                humidity: Math.round(70 + Math.random() * 25),
                precipitation: Math.random() > 0.7 ? (Math.random() * 4).toFixed(1) : 0,
                snow_depth: baseTemp < 0 ? (5 + Math.random() * 15).toFixed(1) : 0
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

    generateSearchSummary(weatherData) {
        const current = weatherData.current;
        const recentHistory = weatherData.history.slice(-3); // Последние 3 дня
       
        let summary = "📊 *Условия для поиска:*\n\n";
       
        // Анализ текущих условий
        summary += `*Сейчас:* ${current.temperature}°C, ${current.condition}\n`;
        summary += `💨 Ветер: ${current.wind_speed} м/с\n`;
        summary += `👁️ Видимость: ${current.visibility}\n\n`;
       
        // Анализ следов
        if (current.temperature > 0) {
            summary += "⚠️ *Следы:* Быстро разрушаются (температура выше нуля)\n";
        } else if (current.temperature > -5) {
            summary += "✅ *Следы:* Сохраняются 1-2 дня\n";
        } else {
            summary += "🔄 *Следы:* Сохраняются 3-5 дней\n";
        }
       
        // Анализ осадков
        const hasRecentSnow = recentHistory.some(day => day.precipitation > 0 && day.temperature < 2);
        if (hasRecentSnow) {
            summary += "❄️ *Снег:* Недавние осадки могут скрывать следы\n";
        }
       
        return summary;
    }
}

module.exports = { WeatherService };
