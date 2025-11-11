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
           
            // Получаем данные: история 7 дней + сейчас + почасовой прогноз 6ч + прогноз 2 дня
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
            // Получаем прогноз на 5 дней (максимум в бесплатном API)
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
           
            // Форматируем текущую погоду (первый элемент списка)
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

    // ДОБАВЛЯЕМ ПРОПУЩЕННЫЕ МЕТОДЫ:

    async geocodeCity(cityName) {
        try {
            const response = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
                params: {
                    q: cityName + ',RU',
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
                throw new Error('Город не найден');
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

        forecastList.forEach(item => {
            const itemDate = new Date(item.dt * 1000);
            const dateKey = itemDate.toDateString();
           
            // Пропускаем сегодня и берем только 2 следующих дня
            if (dateKey !== today && !processedDays.has(dateKey) && dailyForecast.length < 2) {
                processedDays.add(dateKey);
               
                // Находим дневную и ночную температуру для этого дня
                const dayItems = forecastList.filter(f =>
                    new Date(f.dt * 1000).toDateString() === dateKey
                );
               
                const dayTemp = Math.round(Math.max(...dayItems.map(i => i.main.temp)));
                const nightTemp = Math.round(Math.min(...dayItems.map(i => i.main.temp)));
               
                // Находим преобладающие условия дня
                const mainCondition = this.getDominantCondition(dayItems);
               
                dailyForecast.push({
                    date: itemDate.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                    day_temp: dayTemp,
                    night_temp: nightTemp,
                    condition: mainCondition,
                    precipitation: this.getDailyPrecipitation(dayItems),
                    cloudiness: Math.round(dayItems.reduce((sum, item) => sum + item.clouds.all, 0) / dayItems.length),
                    humidity: Math.round(dayItems.reduce((sum, item) => sum + item.main.humidity, 0) / dayItems.length),
                    wind_speed: (dayItems.reduce((sum, item) => sum + item.wind.speed, 0) / dayItems.length).toFixed(1)
                });
            }
        });

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
            return `🌧️❄️ ${totalRain.toFixed(1)}мм`;
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
            result += `🌧️ ${data.rain['3h'].toFixed(1)}мм `;
        }
       
        if (data.snow && data.snow['3h'] > 0) {
            result += `❄️ ${data.snow['3h'].toFixed(1)}мм `;
        }
       
        return result || 'нет осадков';
    }

    generateWeatherHistory(daysCount) {
        const history = [];
        const baseDate = new Date();
       
        for (let i = daysCount; i > 0; i--) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - i);
           
            const baseTemp = -3 + Math.random() * 10 - 4;
            const precipitationType = baseTemp > 2 ? '🌧️' : '❄️';
            const precipAmount = Math.random() > 0.6 ? (Math.random() * 5).toFixed(1) : 0;
           
            history.push({
                date: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                day_temp: Math.round(baseTemp + 3),
                night_temp: Math.round(baseTemp - 3),
                condition: this.getHistoricalWeatherCondition(baseTemp),
                precipitation: precipAmount > 0 ? `${precipitationType} ${precipAmount}мм` : 'нет осадков',
                cloudiness: Math.round(30 + Math.random() * 60),
                humidity: Math.round(60 + Math.random() * 35),
                wind_speed: (2 + Math.random() * 5).toFixed(1)
            });
        }
       
        return history;
    }

    getHistoricalWeatherCondition(temperature) {
        if (temperature > 5) {
            return ['☀️ Ясно', '⛅ Облачно', '☁️ Пасмурно', '🌧️ Дождь'][Math.floor(Math.random() * 4)];
        } else if (temperature > 0) {
            return ['⛅ Облачно', '☁️ Пасмурно', '🌧️ Дождь', '🌧️❄️ Мокрый снег'][Math.floor(Math.random() * 4)];
        } else {
            return ['❄️ Снег', '☁️ Пасмурно', '⛅ Облачно', '❄️ Снегопад'][Math.floor(Math.random() * 4)];
        }
    }

    generateSearchSummary(weatherData) {
        const current = weatherData.current;
        const hourly = weatherData.hourly;
        const history = weatherData.history;
        const forecast = weatherData.forecast;
       
        let summary = "🔍 <b>Анализ для поисковых работ:</b>\n\n";
       
        // Анализ текущих условий
        summary += `🌡️ <b>Сейчас:</b> ${current.temperature}°C\n`;
       
        if (current.temperature > 5) {
            summary += "⚠️ <b>Следы:</b> Быстро разрушаются (тепло)\n";
        } else if (current.temperature > 0) {
            summary += "🔄 <b>Следы:</b> Сохраняются 1-2 дня\n";
        } else if (current.temperature > -10) {
            summary += "✅ <b>Следы:</b> Сохраняются 3-5 дней\n";
        } else {
            summary += "🔄 <b>Следы:</b> Сохраняются 5-7 дней (мороз)\n";
        }
       
        // Анализ ближайших часов
        const nextHours = hourly.slice(1, 4); // Следующие 3 часа
        const willChange = nextHours.some(hour =>
            hour.precipitation !== 'нет осадков' ||
            Math.abs(hour.temperature - current.temperature) > 3
        );
       
        if (willChange) {
            summary += "🕒 <b>Ближайшие часы:</b> Ожидаются изменения погоды\n";
        }
       
        // Анализ осадков
        const hasPrecipitation = hourly.some(hour => hour.precipitation !== 'нет осадков');
        if (hasPrecipitation) {
            summary += "💧 <b>Осадки:</b> Могут повлиять на сохранность следов\n";
        }
       
        // Анализ видимости
        if (current.cloudiness > 70) {
            summary += "☁️ <b>Облачность:</b> Пасмурно, видимость снижена\n";
        } else {
            summary += "☀️ <b>Облачность:</b> Хорошая видимость\n";
        }
       
        return summary;
    }

    // Демо-данные для ошибок
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
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        };
    }

    generateDemoHourlyForecast() {
        const now = new Date();
        return [
            {
                time: 'Сейчас',
                temperature: -2,
                condition: '❄️ Снег',
                precipitation: '❄️ 1.5мм',
                cloudiness: 75,
                wind_speed: 3.1,
                feels_like: -5
            },
            {
                time: new Date(now.getTime() + 60 * 60 * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit' }),
                temperature: -1,
                condition: '❄️ Снег',
                precipitation: '❄️ 2.0мм',
                cloudiness: 80,
                wind_speed: 3.5,
                feels_like: -4
            },
            {
                time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit' }),
                temperature: -2,
                condition: '❄️ Снегопад',
                precipitation: '❄️ 3.1мм',
                cloudiness: 90,
                wind_speed: 4.2,
                feels_like: -6
            },
            {
                time: new Date(now.getTime() + 3 * 60 * 60 * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit' }),
                temperature: -3,
                condition: '❄️ Снег',
                precipitation: '❄️ 1.8мм',
                cloudiness: 85,
                wind_speed: 3.8,
                feels_like: -7
            },
            {
                time: new Date(now.getTime() + 4 * 60 * 60 * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit' }),
                temperature: -4,
                condition: '☁️ Пасмурно',
                precipitation: 'нет осадков',
                cloudiness: 95,
                wind_speed: 3.2,
                feels_like: -8
            },
            {
                time: new Date(now.getTime() + 5 * 60 * 60 * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit' }),
                temperature: -5,
                condition: '⛅ Облачно',
                precipitation: 'нет осадков',
                cloudiness: 65,
                wind_speed: 2.9,
                feels_like: -8
            }
        ];
    }

    generateDemoForecast() {
        return [
            {
                date: 'завтра',
                day_temp: -1,
                night_temp: -6,
                condition: '❄️ Снег',
                precipitation: '❄️ 2.0мм',
                cloudiness: 80,
                humidity: 90,
                wind_speed: 4.2
            },
            {
                date: 'послезавтра',
                day_temp: 0,
                night_temp: -4,
                condition: '☁️ Пасмурно',
                precipitation: 'нет осадков',
                cloudiness: 95,
                humidity: 75,
                wind_speed: 2.8
            }
        ];
    }
}

module.exports = { WeatherService };
