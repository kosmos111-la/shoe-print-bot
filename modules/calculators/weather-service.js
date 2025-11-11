const axios = require('axios');

class WeatherService {
    constructor() {
        this.apiKey = 'f5cc2e480cb5a7dc580b07920c32250c';
        this.baseURL = 'https://api.openweathermap.org/data/2.5';
        this.openMeteoURL = 'https://archive-api.open-meteo.com/v1/archive';
        this.setupWeatherConditions();
    }

    setupWeatherConditions() {
        this.weatherConditions = {
            '200': '⛈️ Гроза', '201': '⛈️ Гроза', '202': '⛈️ Сильная гроза',
            '210': '⛈️ Гроза', '211': '⛈️ Гроза', '212': '⛈️ Сильная гроза',
            '221': '⛈️ Гроза', '230': '⛈️ Гроза', '231': '⛈️ Гроза', '232': '⛈️ Сильная гроза',
           
            '300': '🌧️ Морось', '301': '🌧️ Морось', '302': '🌧️ Сильная морось',
            '310': '🌧️ Морось', '311': '🌧️ Морось', '312': '🌧️ Сильная морось',
            '313': '🌧️ Ливень', '314': '🌧️ Сильный ливень', '321': '🌧️ Ливень',
           
            '500': '🌧️ Легкий дождь', '501': '🌧️ Дождь', '502': '🌧️ Сильный дождь',
            '503': '🌧️ Очень сильный дождь', '504': '🌧️ Экстремальный дождь',
            '511': '🌧️❄️ Ледяной дождь', '520': '🌦️ Ливень', '521': '🌦️ Ливень',
            '522': '🌦️ Сильный ливень', '531': '🌦️ Ливень',
           
            '600': '❄️ Легкий снег', '601': '❄️ Снег', '602': '❄️ Сильный снег',
            '611': '🌧️❄️ Мокрый снег', '612': '🌧️❄️ Мокрый снег', '613': '🌧️❄️ Мокрый снег',
            '615': '🌧️❄️ Дождь со снегом', '616': '🌧️❄️ Дождь со снегом',
            '620': '❄️ Легкий снегопад', '621': '❄️ Снегопад', '622': '❄️ Сильный снегопад',
           
            '701': '🌫️ Туман', '711': '🌫️ Дым', '721': '🌫️ Дымка',
            '731': '🌫️ Песчаная буря', '741': '🌫️ Туман', '751': '🌫️ Песок',
            '761': '🌫️ Пыль', '762': '🌫️ Вулканический пепел', '771': '💨 Шквал',
            '781': '🌪️ Торнадо',
           
            '800': '☀️ Ясно', '801': '⛅ Малооблачно', '802': '⛅ Облачно',
            '803': '☁️ Пасмурно', '804': '☁️ Пасмурно'
        };
    }

    async getWeatherData(options) {
        try {
            const { location, coordinates } = options;
           
            let lat, lon, cityName;
            if (coordinates) {
                lat = coordinates.lat;
                lon = coordinates.lon;
                cityName = await this.reverseGeocode(lat, lon);
            } else {
                const coords = await this.geocodeCity(location || 'Москва');
                lat = coords.lat;
                lon = coords.lon;
                cityName = coords.name;
            }
           
            const weatherData = await this.getCompleteWeatherData(lat, lon);
           
            return {
                success: true,
                result: {
                    location: cityName,
                    coordinates: { lat, lon },
                    history: weatherData.history,
                    current: weatherData.current,
                    hourly: weatherData.hourly,
                    forecast: weatherData.forecast,
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

    async getCompleteWeatherData(lat, lon) {
    try {
        const [forecastData, historyData] = await Promise.all([
            this.getOpenWeatherForecast(lat, lon),
            this.getRealWeatherHistory(lat, lon, 7)  // ← Должен возвращать историю
        ]);

        console.log('📊 История получена:', historyData.length, 'дней'); // Для отладки

        return {
            history: historyData,  // ← Должен быть заполнен
            current: this.formatCurrentWeather(forecastData.list[0]),
            hourly: this.formatHourlyForecast(forecastData.list.slice(0, 6)),
            forecast: this.formatTwoDayForecast(forecastData.list)
        };
       
    } catch (error) {
        console.error('Weather API error:', error);
        return this.getDemoData();
    }
}

    async getOpenWeatherForecast(lat, lon) {
        const response = await axios.get(`${this.baseURL}/forecast`, {
            params: {
                lat: lat,
                lon: lon,
                appid: this.apiKey,
                units: 'metric',
                lang: 'ru'
            }
        });
        return response.data;
    }

    async getRealWeatherHistory(lat, lon, daysCount) {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        console.log('🔍 Запрос истории:', startDate, 'до', endDate);
       
        const response = await axios.get(this.openMeteoURL, {
            params: {
                latitude: lat,
                longitude: lon,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
                timezone: 'auto'
            }
        });

        console.log('✅ История получена от OpenMeteo');
        return this.formatOpenMeteoHistory(response.data);
    } catch (error) {
        console.error('❌ OpenMeteo history error:', error.message);
        return this.generateFallbackHistory(daysCount);
    }
}

    formatOpenMeteoHistory(openMeteoData) {
        if (!openMeteoData.daily) return [];
       
        const daily = openMeteoData.daily;
       
        return daily.time.map((date, index) => {
            const dayTemp = Math.round(daily.temperature_2m_max[index]);
            const nightTemp = Math.round(daily.temperature_2m_min[index]);
            const precipitation = daily.precipitation_sum[index];
            const weatherCode = daily.weather_code[index];
           
            return {
                date: new Date(date).toLocaleDateString('ru-RU', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                }),
                day_temp: dayTemp,
                night_temp: nightTemp,
                condition: this.getConditionFromWeatherCode(weatherCode),
                precipitation: precipitation > 0 ?
                    `${this.getPrecipitationEmoji(weatherCode)} ${precipitation.toFixed(1)}мм` : 'нет осадков',
                cloudiness: this.getCloudinessFromCode(weatherCode),
                humidity: 65 + Math.random() * 25,
                wind_speed: (3 + Math.random() * 4).toFixed(1)
            };
        });
    }

    getConditionFromWeatherCode(code) {
        const conditions = {
            0: '☀️ Ясно',
            1: '⛅ Малооблачно',
            2: '⛅ Облачно',
            3: '☁️ Пасмурно',
            45: '🌫️ Туман',
            48: '🌫️ Туман',
            51: '🌧️ Морось',
            53: '🌧️ Морось',
            55: '🌧️ Морось',
            61: '🌧️ Дождь',
            63: '🌧️ Дождь',
            65: '🌧️ Сильный дождь',
            71: '❄️ Снег',
            73: '❄️ Снег',
            75: '❄️ Сильный снег',
            77: '❄️ Снег',
            80: '🌦️ Ливень',
            81: '🌦️ Ливень',
            82: '🌦️ Сильный ливень',
            85: '❄️ Снегопад',
            86: '❄️ Сильный снегопад',
            95: '⛈️ Гроза',
            96: '⛈️ Гроза',
            99: '⛈️ Сильная гроза'
        };
       
        return conditions[code] || '⛅ Облачно';
    }

    getPrecipitationEmoji(code) {
        if (code >= 71 && code <= 86) return '❄️';
        if (code >= 51 && code <= 67) return '🌧️';
        if (code >= 80 && code <= 82) return '🌦️';
        if (code >= 95 && code <= 99) return '⛈️';
        return '🌧️';
    }

    getCloudinessFromCode(code) {
        if (code === 0) return 10;
        if (code === 1) return 30;
        if (code === 2) return 60;
        if (code === 3) return 90;
        return 50;
    }

    formatCurrentWeather(currentData) {
        return {
            temperature: Math.round(currentData.main.temp),
            feels_like: Math.round(currentData.main.feels_like),
            condition: this.weatherConditions[currentData.weather[0].id] || currentData.weather[0].description,
            description: currentData.weather[0].description,
            wind_speed: currentData.wind.speed,
            pressure: currentData.main.pressure,
            humidity: currentData.main.humidity,
            cloudiness: currentData.clouds.all,
            precipitation: this.getPrecipitationInfo(currentData),
            time: new Date(currentData.dt * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        };
    }

    formatHourlyForecast(hourlyData) {
        return hourlyData.map((hour, index) => {
            const time = new Date(hour.dt * 1000);
            const isNow = index === 0;
           
            return {
                time: isNow ? 'Сейчас' : time.toLocaleTimeString('ru-RU', { hour: '2-digit' }),
                temperature: Math.round(hour.main.temp),
                condition: this.weatherConditions[hour.weather[0].id] || hour.weather[0].description,
                precipitation: this.getPrecipitationInfo(hour),
                cloudiness: hour.clouds.all,
                wind_speed: hour.wind.speed,
                feels_like: Math.round(hour.main.feels_like)
            };
        });
    }

    formatTwoDayForecast(forecastList) {
        const dailyForecast = [];
        const processedDays = new Set();
        const today = new Date().toDateString();

        const days = {};
        forecastList.forEach(item => {
            const itemDate = new Date(item.dt * 1000);
            const dateKey = itemDate.toDateString();
           
            if (!days[dateKey]) days[dateKey] = [];
            days[dateKey].push(item);
        });

        const dayKeys = Object.keys(days).sort();
        let daysAdded = 0;
       
        for (const dateKey of dayKeys) {
            if (dateKey !== today && daysAdded < 2) {
                const dayItems = days[dateKey];
                const dayTemp = Math.round(Math.max(...dayItems.map(i => i.main.temp)));
                const nightTemp = Math.round(Math.min(...dayItems.map(i => i.main.temp)));
                const mainCondition = this.getDominantCondition(dayItems);
               
                dailyForecast.push({
                    date: new Date(dateKey).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                    day_temp: dayTemp,
                    night_temp: nightTemp,
                    condition: mainCondition,
                    precipitation: this.getDailyPrecipitation(dayItems),
                    cloudiness: Math.round(dayItems.reduce((sum, item) => sum + item.clouds.all, 0) / dayItems.length),
                    humidity: Math.round(dayItems.reduce((sum, item) => sum + item.main.humidity, 0) / dayItems.length),
                    wind_speed: (dayItems.reduce((sum, item) => sum + item.wind.speed, 0) / dayItems.length).toFixed(1)
                });
               
                daysAdded++;
            }
        }

        return dailyForecast;
    }

    getDominantCondition(dayItems) {
        const conditions = {};
        dayItems.forEach(item => {
            const condition = this.weatherConditions[item.weather[0].id] || item.weather[0].description;
            conditions[condition] = (conditions[condition] || 0) + 1;
        });
       
        return Object.keys(conditions).reduce((a, b) => conditions[a] > conditions[b] ? a : b);
    }

    getDailyPrecipitation(dayItems) {
        let totalRain = 0;
        let totalSnow = 0;
       
        dayItems.forEach(item => {
            if (item.rain && item.rain['3h']) totalRain += item.rain['3h'];
            if (item.snow && item.snow['3h']) totalSnow += item.snow['3h'];
        });
       
        if (totalRain > 0 && totalSnow > 0) {
            return `🌧️❄️ ${(totalRain + totalSnow).toFixed(1)}мм`;
        } else if (totalRain > 0) {
            return `🌧️ ${totalRain.toFixed(1)}мм`;
        } else if (totalSnow > 0) {
            return `❄️ ${totalSnow.toFixed(1)}мм`;
        } else {
            return 'нет осадков';
        }
    }

    getPrecipitationInfo(data) {
        if (data.rain && data.rain['3h'] > 0) {
            return `🌧️ ${data.rain['3h'].toFixed(1)}мм`;
        } else if (data.snow && data.snow['3h'] > 0) {
            return `❄️ ${data.snow['3h'].toFixed(1)}мм`;
        } else {
            return 'нет осадков';
        }
    }

    generateFallbackHistory(daysCount) {
        console.log('Используются резервные данные истории');
        const history = [];
        const baseDate = new Date();
       
        for (let i = daysCount; i > 0; i--) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - i);
           
            history.push({
                date: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                day_temp: 0,
                night_temp: 0,
                condition: '⛅ Облачно',
                precipitation: 'нет данных',
                cloudiness: 50,
                humidity: 70,
                wind_speed: '3.0'
            });
        }
       
        return history;
    }

    generateSearchSummary(weatherData) {
        const current = weatherData.current;
       
        let summary = "📋 <b>Погодная сводка:</b>\n\n";
        summary += `🌡️ <b>Температура:</b> ${current.temperature}°C\n`;
        summary += `💨 <b>Ветер:</b> ${current.wind_speed} м/с\n`;
        summary += `💧 <b>Влажность:</b> ${current.humidity}%\n`;
        summary += `☁️ <b>Облачность:</b> ${current.cloudiness}%\n`;
        summary += `🌧️ <b>Осадки:</b> ${current.precipitation}\n`;
       
        return summary;
    }

    getDemoData() {
        return {
            history: this.generateFallbackHistory(7),
            current: this.generateDemoCurrentWeather(),
            hourly: this.generateDemoHourlyForecast(),
            forecast: this.generateDemoForecast()
        };
    }

    generateDemoCurrentWeather() {
        return {
            temperature: 5,
            feels_like: 5,
            condition: '☁️ Пасмурно',
            description: 'пасмурно',
            wind_speed: 0.25,
            pressure: 1017,
            humidity: 74,
            cloudiness: 100,
            precipitation: 'нет осадков',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        };
    }

    generateDemoHourlyForecast() {
        return [
            { time: 'Сейчас', temperature: 5, condition: '☁️ Пасмурно', precipitation: 'нет осадков', cloudiness: 100, wind_speed: 0.25, feels_like: 5 },
            { time: '15:00', temperature: 5, condition: '☁️ Пасмурно', precipitation: 'нет осадков', cloudiness: 100, wind_speed: 0.25, feels_like: 5 },
            { time: '18:00', temperature: 5, condition: '☁️ Пасмурно', precipitation: 'нет осадков', cloudiness: 100, wind_speed: 0.25, feels_like: 5 },
            { time: '21:00', temperature: 5, condition: '☁️ Пасмурно', precipitation: 'нет осадков', cloudiness: 100, wind_speed: 0.25, feels_like: 5 },
            { time: '00:00', temperature: 5, condition: '☁️ Пасмурно', precipitation: 'нет осадков', cloudiness: 100, wind_speed: 0.25, feels_like: 5 },
            { time: '03:00', temperature: 5, condition: '☁️ Пасмурно', precipitation: 'нет осадков', cloudiness: 100, wind_speed: 0.25, feels_like: 5 }
        ];
    }

    generateDemoForecast() {
        return [
            { date: 'завтра', day_temp: 8, night_temp: 6, condition: '☁️ Пасмурно', precipitation: '🌧️ 0.9мм', cloudiness: 95, humidity: 80, wind_speed: '2.5' },
            { date: 'послезавтра', day_temp: 5, night_temp: 0, condition: '☁️ Пасмурно', precipitation: '🌧️❄️ 1.9мм', cloudiness: 90, humidity: 75, wind_speed: '3.0' }
        ];
    }

    async geocodeCity(cityName) {
        try {
            const response = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
                params: {
                    q: cityName,
                    limit: 1,
                    appid: this.apiKey
                }
            });

            if (response.data && response.data.length > 0) {
                return {
                    lat: response.data[0].lat,
                    lon: response.data[0].lon,
                    name: response.data[0].name
                };
            } else {
                return { lat: 55.7558, lon: 37.6173, name: 'Москва' };
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            return { lat: 55.7558, lon: 37.6173, name: 'Москва' };
        }
    }

    async reverseGeocode(lat, lon) {
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
                return response.data[0].name;
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
        }
       
        return `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
}

module.exports = { WeatherService };
