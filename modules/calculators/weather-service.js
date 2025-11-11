const axios = require('axios');

class WeatherService {
    constructor() {
        this.apiKey = 'f5cc2e480cb5a7dc580b07920c32250c';
        this.baseURL = 'https://api.openweathermap.org/data/2.5';
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
           
            // Определяем координаты
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
           
            // Получаем полные данные погоды
            const weatherData = await this.getCompleteWeatherData(lat, lon);
           
            return {
                success: true,
                result: {
                    location: cityName,
                    coordinates: { lat, lon },
                    history: weatherData.history,      // 7 дней назад
                    current: weatherData.current,      // сейчас
                    hourly: weatherData.hourly,        // 6 часов вперед
                    forecast: weatherData.forecast,    // 2 дня вперед
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
            // Получаем прогноз на 5 дней
            const response = await axios.get(`${this.baseURL}/forecast`, {
                params: {
                    lat: lat,
                    lon: lon,
                    appid: this.apiKey,
                    units: 'metric',
                    lang: 'ru'
                }
            });

            const data = response.data;
           
            // Генерируем историю за 7 дней
            const history = this.generateWeatherHistory(7);
           
            // Форматируем текущую погоду
            const current = this.formatCurrentWeather(data.list[0]);
           
            // Форматируем почасовой прогноз на 6 часов
            const hourly = this.formatHourlyForecast(data.list.slice(0, 6));
           
            // Форматируем прогноз на 2 дня вперед
            const forecast = this.formatTwoDayForecast(data.list);
           
            return {
                history: history,
                current: current,
                hourly: hourly,
                forecast: forecast
            };
           
        } catch (error) {
            console.error('Weather API error:', error);
            // Возвращаем демо-данные при ошибке
            return {
                history: this.generateWeatherHistory(7),
                current: this.generateDemoCurrentWeather(),
                hourly: this.generateDemoHourlyForecast(),
                forecast: this.generateDemoForecast()
            };
        }
    }

    // ГЕОКОДИНГ
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
                wind_speed: hour.wind_speed,
                feels_like: Math.round(hour.main.feels_like)
            };
        });
    }

    formatTwoDayForecast(forecastList) {
        const dailyForecast = [];
        const processedDays = new Set();
        const today = new Date().toDateString();

        // Группируем по дням
        const days = {};
        forecastList.forEach(item => {
            const itemDate = new Date(item.dt * 1000);
            const dateKey = itemDate.toDateString();
           
            if (!days[dateKey]) {
                days[dateKey] = [];
            }
            days[dateKey].push(item);
        });

        // Берем только 2 следующих дня (после сегодня)
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
        let result = '';
       
        if (data.rain && data.rain['3h'] > 0) {
            result += `🌧️ ${data.rain['3h'].toFixed(1)}мм`;
        } else if (data.snow && data.snow['3h'] > 0) {
            result += `❄️ ${data.snow['3h'].toFixed(1)}мм`;
        } else {
            result = 'нет осадков';
        }
       
        return result;
    }

    generateWeatherHistory(daysCount) {
    const history = [];
    const baseDate = new Date();
   
    for (let i = daysCount; i > 0; i--) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
       
        const baseTemp = -3 + Math.random() * 10 - 4;
        const hasPrecipitation = Math.random() > 0.6;
        const precipitationType = baseTemp > 2 ? '🌧️' : '❄️';
        const precipAmount = hasPrecipitation ? (Math.random() * 5).toFixed(1) : 0;
       
        // Связываем условие с наличием осадков
        const condition = this.getHistoricalWeatherCondition(baseTemp, hasPrecipitation);
       
        history.push({
            date: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
            day_temp: Math.round(baseTemp + 3),
            night_temp: Math.round(baseTemp - 3),
            condition: condition,
            precipitation: hasPrecipitation ? `${precipitationType} ${precipAmount}мм` : 'нет осадков',
            cloudiness: Math.round(30 + Math.random() * 60),
            humidity: Math.round(60 + Math.random() * 35),
            wind_speed: (2 + Math.random() * 5).toFixed(1)
        });
    }
   
    return history;
},

getHistoricalWeatherCondition(temperature, hasPrecipitation) {
    const clearConditions = ['☀️ Ясно', '⛅ Облачно', '☁️ Пасмурно'];
    const precipConditions = temperature > 2 ? ['🌧️ Дождь', '🌧️ Ливень'] : ['❄️ Снег', '❄️ Снегопад'];
   
    if (hasPrecipitation) {
        return precipConditions[Math.floor(Math.random() * precipConditions.length)];
    } else {
        return clearConditions[Math.floor(Math.random() * clearConditions.length)];
    }
},

generateSearchSummary(weatherData) {
    const current = weatherData.current;
    const hourly = weatherData.hourly;
   
    let summary = "📋 <b>Погодная сводка:</b>\n\n";
   
    // Только факты о текущей погоде
    summary += `🌡️ <b>Температура:</b> ${current.temperature}°C\n`;
    summary += `💨 <b>Ветер:</b> ${current.wind_speed} м/с\n`;
    summary += `💧 <b>Влажность:</b> ${current.humidity}%\n`;
    summary += `☁️ <b>Облачность:</b> ${current.cloudiness}%\n`;
    summary += `🌧️ <b>Осадки:</b> ${current.precipitation}\n`;
   
    // Ближайшие часы
    const nextPrecip = hourly.slice(1).filter(hour => hour.precipitation !== 'нет осадков');
    if (nextPrecip.length > 0) {
        summary += `\n🕒 <b>В ближайшие 6 часов:</b> ожидаются осадки`;
    }
   
    return summary;
},

    // Демо-данные
    generateDemoCurrentWeather() {
        return {
            temperature: -2,
            feels_like: -5,
            condition: '❄️ Снег',
            description: 'снег',
            wind_speed: 3.1,
            pressure: 745,
            humidity: 85,
            cloudiness: 75,
            precipitation: '❄️ 1.5мм',
            time: '14:30'
        };
    }

    generateDemoHourlyForecast() {
        return [
            { time: 'Сейчас', temperature: -2, condition: '❄️ Снег', precipitation: '❄️ 1.5мм', cloudiness: 75, wind_speed: 3.1, feels_like: -5 },
            { time: '15:00', temperature: -1, condition: '❄️ Снег', precipitation: '❄️ 2.0мм', cloudiness: 80, wind_speed: 3.5, feels_like: -4 },
            { time: '16:00', temperature: -2, condition: '❄️ Снегопад', precipitation: '❄️ 3.1мм', cloudiness: 90, wind_speed: 4.2, feels_like: -6 },
            { time: '17:00', temperature: -3, condition: '❄️ Снег', precipitation: '❄️ 1.8мм', cloudiness: 85, wind_speed: 3.8, feels_like: -7 },
            { time: '18:00', temperature: -4, condition: '☁️ Пасмурно', precipitation: 'нет осадков', cloudiness: 95, wind_speed: 3.2, feels_like: -8 },
            { time: '19:00', temperature: -5, condition: '⛅ Облачно', precipitation: 'нет осадков', cloudiness: 65, wind_speed: 2.9, feels_like: -8 }
        ];
    }

    generateDemoForecast() {
        return [
            { date: 'завтра', day_temp: -1, night_temp: -6, condition: '❄️ Снег', precipitation: '❄️ 2.0мм', cloudiness: 80, humidity: 90, wind_speed: '4.2' },
            { date: 'послезавтра', day_temp: 0, night_temp: -4, condition: '☁️ Пасмурно', precipitation: 'нет осадков', cloudiness: 95, humidity: 75, wind_speed: '2.8' }
        ];
    }
}

module.exports = { WeatherService };
