// shoe-print-bot/modules/calculators/weather-service.js

const axios = require('axios');

class WeatherService {
    constructor() {
        this.openMeteoURL = 'https://api.open-meteo.com/v1/forecast';
        this.openMeteoArchiveURL = 'https://archive-api.open-meteo.com/v1/archive';
    this.geocodingAPI = 'https://geocoding-api.open-meteo.com/v1/search';

    // 💾 Кэш погоды (10 минут на точку) — защита от лимита Open-Meteo
    this.cache = new Map();
    this.cacheTTL = 10 * 60 * 1000;
    }

    getTemperatureEmoji(temp) {
        if (temp >= 25) return '🔥';
        if (temp >= 20) return '🟠';
        if (temp >= 10) return '🟡';
        if (temp >= 0) return '⚪';
        if (temp >= -10) return '🔵';
        if (temp >= -20) return '🔷';
        return '❄️';
    }

    formatTemperature(temp) {
        const emoji = this.getTemperatureEmoji(temp);
        return `${emoji} ${temp}°C`;
    }

    formatTimeWithStyle(hour, text) {
        const isDay = hour >= 6 && hour < 18;
        if (isDay) {
            return `<b>${text}</b>`;
        } else {
            return `<i>${text}</i>`;
        }
    }

    async getWeatherData(options = {}) {
        try {
            let locationName = 'Неизвестно';
            let lat, lon;
            let cacheKey = null;

            if (options.coordinates) {
                lat = options.coordinates.lat;
                lon = options.coordinates.lon;
                // 💾 Кэш: повторные запросы той же точки не бьют по лимиту
                cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
                const cached = this._cacheGet(cacheKey);
                if (cached) return cached;

                locationName = await this.getLocationName(lat, lon);
            } else if (options.location) {
                const geoData = await this.getCoordinates(options.location);
                if (!geoData) {
                    throw new Error('Город не найден');
                }
                lat = geoData.lat;
                lon = geoData.lon;
                locationName = options.location;
                cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
                const cached = this._cacheGet(cacheKey);
                if (cached) return cached;

            } else {
                return {
                    success: false,
                    error: 'Не указано местоположение'
                };
            }

            const isSimpleMode = options.simple === true;

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

            // ⚡ ОПТИМИЗАЦИЯ (фикс 429): 2 запроса вместо 7, ретраи на 429/5xx
            let forecastBundle = null;
            let fallbackData = null;
            try {
                forecastBundle = await this.getForecastBundle(lat, lon);
            } catch (fbError) {
                if (fbError.message.indexOf('429') !== -1) {
                    // 🔁 Резервный источник (wttr.in), если Open-Meteo исчерпал лимит
                    fallbackData = await this.getWeatherFallback(lat, lon);
                    if (!fallbackData) throw fbError;
                    locationName = locationName + ' (резерв)';
                } else {
                    throw fbError;
                }
            }

            const currentWeather = fallbackData ? fallbackData.current : forecastBundle.current;
            const hourlyForecast = fallbackData ? fallbackData.hourly : forecastBundle.hourly;
            const dailyForecast = fallbackData ? fallbackData.forecast : forecastBundle.forecast;
            const sunTimes = fallbackData ? fallbackData.sunTimes : forecastBundle.sunTimes;

            let archive = { history: [], hourlyPrecipitation: [], snowData: [] };
            if (fallbackData) {
                archive.history = fallbackData.history;
                archive.hourlyPrecipitation = fallbackData.hourlyPrecipitation;
                archive.snowData = fallbackData.snowData;
            } else {
                try {
                    archive = await this.getArchiveBundle(lat, lon, 7);
                } catch (archiveError) {
                    console.log('⚠️ Ошибка архива погоды (не критично):', archiveError.message);
                }
            }

            const weatherHistory = archive.history;
            const hourlyPrecipitation = archive.hourlyPrecipitation;
            const snowData = archive.snowData;

            // Формируем поисковую сводку
            const searchSummary = this.generateSearchSummary(
                currentWeather,
                locationName,
                hourlyForecast,
                weatherHistory,
                sunTimes
            );

            const payload = {
                success: true,
                result: {
                    location: locationName,
                    current: currentWeather,
                    hourly: hourlyForecast,
                    forecast: dailyForecast,
                    history: weatherHistory,
                    hourlyPrecipitation: hourlyPrecipitation,
                    snowData: snowData,
                    sunTimes: sunTimes,
                    searchSummary: searchSummary
                }
            };
            if (cacheKey) this._cacheSet(cacheKey, payload);
            return payload;

        } catch (error) {
            console.log('❌ Ошибка получения погоды:', error.message);
            return {
                success: false,
                error: `Ошибка получения погоды: ${error.message}`
            };
        }
    }

    async fetchWithRetry(url, params, retries = 2) {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await axios.get(url, { params, timeout: 10000 });
            } catch (error) {
                lastError = error;
                const status = error.response && error.response.status;
                if (status === 429 || (status >= 500 && status <= 599)) {
                    if (attempt < retries) {
                        const waitMs = status === 429 ? 2500 * (attempt + 1) : 1000 * (attempt + 1);
                        console.log(`⏳ Open-Meteo ${status}, повтор через ${waitMs} мс (попытка ${attempt + 2}/${retries + 1})`);
                        await new Promise(resolve => setTimeout(resolve, waitMs));
                        continue;
                    }
                    if (status === 429) {
                        throw new Error('Сервис погоды временно перегружен (429), попробуйте позже');
                    }
                }
                throw error;
            }
        }
        throw lastError;
    }

    _cacheGet(key) {
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.ts < this.cacheTTL) return hit.data;
        if (hit) this.cache.delete(key);
        return null;
    }

    _cacheSet(key, data) {
        this.cache.set(key, { ts: Date.now(), data });
        if (this.cache.size > 500) {
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
    }

    // ⚡ ОДИН запрос: текущая + почасовой + дневной + восход/закат
    async getForecastBundle(lat, lon) {
        const response = await this.fetchWithRetry(this.openMeteoURL, {
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
            hourly: 'temperature_2m,weather_code,precipitation',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset',
            forecast_days: 3,
            timezone: 'auto'
        });

        const data = response.data;
        const currentRaw = data.current;
        const current = {
            time: new Date(currentRaw.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            temperature: Math.round(currentRaw.temperature_2m),
            feels_like: Math.round(currentRaw.apparent_temperature),
            condition: this.getWeatherCondition(currentRaw.weather_code),
            wind_speed: currentRaw.wind_speed_10m.toFixed(1),
            humidity: currentRaw.relative_humidity_2m,
            precipitation: currentRaw.precipitation,
            cloudiness: this.getCloudiness(currentRaw.weather_code)
        };

        const hourly = data.hourly;
        const forecast = [];
        const now = new Date();
        let addedCount = 0;
        for (let i = 0; i < hourly.time.length && addedCount < 6; i++) {
            const forecastTime = new Date(hourly.time[i]);
            if (forecastTime < now) continue;
            const hoursDiff = Math.round((forecastTime - now) / (1000 * 60 * 60));
            let timeDisplay;
            if (hoursDiff === 0) timeDisplay = 'Сейчас';
            else if (hoursDiff === 1) timeDisplay = '+1 час';
            else if (hoursDiff >= 2 && hoursDiff <= 4) timeDisplay = `+${hoursDiff} часа`;
            else timeDisplay = `+${hoursDiff} часов`;
            forecast.push({
                time: timeDisplay,
                hour: forecastTime.getHours(),
                temperature: Math.round(hourly.temperature_2m[i]),
                condition: this.getWeatherCondition(hourly.weather_code[i]),
                precipitation: hourly.precipitation[i]
            });
            addedCount++;
        }

        const daily = data.daily;
        const forecastDays = [];
        for (let i = 0; i < 2; i++) {
            forecastDays.push({
                date: new Date(daily.time[i]).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                day_temp: Math.round(daily.temperature_2m_max[i]),
                night_temp: Math.round(daily.temperature_2m_min[i]),
                condition: this.getWeatherCondition(daily.weather_code[i]),
                precipitation: daily.precipitation_sum[i]
            });
        }

        let sunTimes = null;
        if (daily && daily.sunrise && daily.sunset) {
            const sunrise = new Date(daily.sunrise[0]);
            const sunset = new Date(daily.sunset[0]);
            sunTimes = {
                sunrise: sunrise,
                sunset: sunset,
                sunriseStr: sunrise.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                sunsetStr: sunset.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                dayLength: Math.round((sunset - sunrise) / 1000 / 60 / 60 * 10) / 10
            };
        }

        return { current, hourly: forecast, forecast: forecastDays, sunTimes };
    }

    async getCurrentWeather(lat, lon) {
        try {
            const bundle = await this.getForecastBundle(lat, lon);
            return bundle.current;
        } catch (error) {
            console.log('⚠️ Ошибка получения текущей погоды:', error.message);
            throw new Error('Не удалось получить текущую погоду');
        }
    }

    async getHourlyForecast(lat, lon) {
        try {
            const bundle = await this.getForecastBundle(lat, lon);
            return bundle.hourly;
        } catch (error) {
            console.log('⚠️ Ошибка получения почасового прогноза:', error.message);
            return [];
        }
    }

    async getDailyForecast(lat, lon) {
        try {
            const bundle = await this.getForecastBundle(lat, lon);
            return bundle.forecast;
        } catch (error) {
            console.log('⚠️ Ошибка получения прогноза:', error.message);
            return [];
        }
    }

    // 🔁 РЕЗЕРВНЫЙ ИСТОЧНИК (wttr.in, без ключа) — когда Open-Meteo отдаёт 429
    async getWeatherFallback(lat, lon) {
        try {
            const response = await axios.get('https://wttr.in/' + lat + ',' + lon + '?format=j1&lang=ru', { timeout: 8000 });
            const j = response.data;
            if (!j || !j.current_condition || !j.current_condition[0]) return null;
            const cc = j.current_condition[0];
            const now = new Date();
            const current = {
                time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                temperature: Math.round(Number(cc.temp_C)),
                feels_like: Math.round(Number(cc.FeelsLikeC)),
                condition: this.wttrCondition(Number(cc.weatherCode), Number(cc.cloudcover)),
                wind_speed: (Number(cc.windspeedKmph) / 3.6).toFixed(1),
                humidity: Number(cc.humidity),
                precipitation: Number(cc.precipMM || 0),
                cloudiness: Number(cc.cloudcover || 0)
            };

            const forecast = [];
            const weatherDays = j.weather || [];
            for (const day of weatherDays.slice(0, 2)) {
                const dt = new Date(day.date + 'T12:00:00');
                let precip = 0;
                for (const h of (day.hourly || [])) precip += Number(h.precipMM || 0);
                const h0 = (day.hourly || [])[0] || {};
                forecast.push({
                    date: dt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                    day_temp: Math.round(Number(day.maxtempC)),
                    night_temp: Math.round(Number(day.mintempC)),
                    condition: this.wttrCondition(Number(h0.weatherCode || cc.weatherCode), null),
                    precipitation: Math.round(precip * 10) / 10
                });
            }

            const hourly = [];
            const day0 = weatherDays[0] || {};
            for (const h of (day0.hourly || [])) {
                const hm = String(h.time).padStart(4, '0');
                const hourNum = parseInt(hm.slice(0, 2), 10);
                const slotDate = new Date(now);
                slotDate.setHours(hourNum, 0, 0, 0);
                if (slotDate <= now) continue;
                const hoursDiff = Math.round((slotDate - now) / (1000 * 60 * 60));
                let timeDisplay;
                if (hoursDiff === 0) timeDisplay = 'Сейчас';
                else if (hoursDiff === 1) timeDisplay = '+1 час';
                else if (hoursDiff >= 2 && hoursDiff <= 4) timeDisplay = `+${hoursDiff} часа`;
                else timeDisplay = `+${hoursDiff} часов`;
                hourly.push({
                    time: timeDisplay,
                    hour: hourNum,
                    temperature: Math.round(Number(h.tempC)),
                    condition: this.wttrCondition(Number(h.weatherCode), null),
                    precipitation: Number(h.precipMM || 0)
                });
                if (hourly.length >= 6) break;
            }

            let sunTimes = null;
            const ast = (day0.astronomy && day0.astronomy[0]) || null;
            if (ast && ast.sunrise && ast.sunset) {
                const mk = (s) => {
                    const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
                    if (!m) return null;
                    let hh = parseInt(m[1], 10);
                    if (m[3] === 'PM' && hh < 12) hh += 12;
                    if (m[3] === 'AM' && hh === 12) hh = 0;
                    const d = new Date(now);
                    d.setHours(hh, parseInt(m[2], 10), 0, 0);
                    return d;
                };
                const sr = mk(ast.sunrise);
                const ss = mk(ast.sunset);
                if (sr && ss) {
                    sunTimes = {
                        sunrise: sr,
                        sunset: ss,
                        sunriseStr: sr.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                        sunsetStr: ss.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                        dayLength: Math.round((ss - sr) / 1000 / 60 / 60 * 10) / 10
                    };
                }
            }

            return { current, hourly, forecast, history: [], hourlyPrecipitation: [], snowData: [], sunTimes };
        } catch (error) {
            console.log('⚠️ Резервный источник (wttr.in) недоступен:', error.message);
            return null;
        }
    }

    wttrCondition(code, cloudcover) {
        const map = {
            113: '☀️ Ясно', 116: '⛅️ Переменная облачность', 119: '☁️ Облачно',
            122: '🌫️ Пасмурно', 143: '🌫️ Туман', 152: '💨 Смог', 248: '🌫️ Туман', 260: '🌫️ Туман',
            176: '🌧️ Небольшой дождь', 263: '🌧️ Небольшой дождь', 293: '🌧️ Небольшой дождь',
            296: '🌧️ Дождь', 266: '🌧️ Дождь', 302: '🌧️ Дождь', 299: '🌧️ Небольшой дождь',
            305: '🌧️ Дождь', 353: '🌧️ Небольшой дождь', 356: '🌧️ Дождь',
            308: '🌧️ Сильный дождь', 359: '🌧️ Сильный дождь',
            179: '🌧️❄️ Дождь со снегом', 182: '🌧️❄️ Дождь со снегом', 185: '🌧️❄️ Дождь со снегом',
            281: '🌧️❄️ Дождь со снегом', 284: '🌧️❄️ Дождь со снегом', 311: '🌧️❄️ Дождь со снегом',
            314: '🌧️❄️ Дождь со снегом', 317: '🌧️❄️ Дождь со снегом', 320: '🌧️❄️ Дождь со снегом',
            350: '🌧️❄️ Ледяной дождь', 374: '🌧️❄️ Ледяной дождь', 377: '🌧️❄️ Ледяной дождь',
            200: '⛈️ Гроза', 386: '⛈️ Гроза', 389: '⛈️ Гроза',
            227: '🌨️ Мелкий снег', 323: '🌨️ Мелкий снег', 326: '🌨️ Снег', 329: '🌨️ Снег',
            332: '🌨️ Снег', 335: '🌨️ Снег', 338: '🌨️ Снег', 230: '🌨️ Снег',
            368: '🌨️ Мелкий снег', 371: '🌨️ Снег', 392: '🌨️❄️ Снег с грозой', 395: '🌨️❄️ Снег с грозой'
        };
        if (map[code]) return map[code];
        if (cloudcover != null && cloudcover <= 10) return '☀️ Ясно';
        if (cloudcover != null && cloudcover <= 50) return '⛅️ Переменная облачность';
        return '❓ Неизвестно';
    }

    // ⚡ ОДИН запрос: история + почасовые осадки + снег
    // ⚡ ОДИН запрос: история + почасовые осадки + снег (без snow_depth — Open-Meteo его больше не принимает)
    async getArchiveBundle(lat, lon, days = 7) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const response = await this.fetchWithRetry(this.openMeteoArchiveURL, {
            latitude: lat,
            longitude: lon,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,snowfall_sum',
            hourly: 'precipitation,weather_code,temperature_2m',
            timezone: 'auto'
        });

        const data = response.data;
        const daily = data.daily;

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

        const hourly = data.hourly;
        const hourlyPrecipitation = [];
        for (let i = 0; i < hourly.time.length; i++) {
            const date = new Date(hourly.time[i]);
            const hour = date.getHours();
            let timeOfDay;
            if (hour >= 6 && hour < 12) timeOfDay = 'morning';
            else if (hour >= 12 && hour < 18) timeOfDay = 'day';
            else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
            else timeOfDay = 'night';
            hourlyPrecipitation.push({
                date: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                hour: hour,
                timeOfDay: timeOfDay,
                precipitation: hourly.precipitation[i] || 0,
                temperature: hourly.temperature_2m[i],
                weather_code: hourly.weather_code[i]
            });
        }

        const snowData = [];
        for (let i = 0; i < daily.time.length; i++) {
            const date = new Date(daily.time[i]);
            snowData.push({
                date: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
                snowfall: daily.snowfall_sum ? (daily.snowfall_sum[i] || 0) : 0,
                snowDepth: 0
            });
        }

        return { history, hourlyPrecipitation, snowData };
    }

    async getWeatherHistory(lat, lon, days = 7) {
        try {
            const bundle = await this.getArchiveBundle(lat, lon, days);
            return bundle.history;
        } catch (error) {
            console.log('⚠️ Ошибка получения истории погоды:', error.message);
            return [];
        }
    }

    async getCoordinates(locationName) {
        try {
            const response = await this.fetchWithRetry(this.geocodingAPI, {
                name: locationName,
                count: 1,
                language: 'ru',
                format: 'json'
            }, 1);

            if (response.data && response.data.results && response.data.results.length > 0) {
                const result = response.data.results[0];
                return {
                    lat: result.latitude,
                    lon: result.longitude,
                    name: result.name,
                    country: result.country,
                    admin1: result.admin1
                };
            }
            return null;
        } catch (error) {
            console.log('⚠️ Ошибка геокодинга:', error.message);
            return null;
        }
    }

    async getLocationName(lat, lon) {
        try {
            // Обратный геокодинг: Open-Meteo /v1/search принимает только name (400 на lat/lon),
            // поэтому используем бесплатный BigDataCloud (без ключа, русская локаль)
            const response = await axios.get('https://api.bigdatacloud.net/data/reverse-geocode-client', {
                params: { latitude: lat, longitude: lon, localityLanguage: 'ru' },
                timeout: 5000
            });
            const d = response.data || {};
            const parts = [];
            if (d.city) parts.push(d.city);
            if (d.principalSubdivision && d.principalSubdivision !== d.city) parts.push(d.principalSubdivision);
            if (d.countryName && d.countryName !== d.city) parts.push(d.countryName);
            if (parts.length) return parts.join(', ');
        } catch (error) {
            console.log('⚠️ Ошибка получения названия:', error.message);
        }
        return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    }

    getWeatherCondition(weatherCode) {
        const conditions = {
            0: '☀️ Ясно',
            1: '🌤️ Преимущественно ясно',
            2: '⛅️ Переменная облачность',
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

    generateSearchSummary(currentData, location, hourlyForecast, weatherHistory, sunTimes = null) {
        const temp = currentData.temperature;
        let conditions = '';

        if (temp < 0) {
            conditions = '❄️ Холодно, возможен снег и наледь';
        } else if (temp < 10) {
            conditions = '🌧️ Прохладно, возможны осадки';
        } else if (temp < 20) {
            conditions = '⛅️ Умеренно, хорошие условия для поиска';
        } else {
            conditions = '☀️ Тепло, отличная видимость';
        }

        const clothingRecommendations = this.generateClothingRecommendations(currentData, hourlyForecast, weatherHistory);
       
        // Добавляем информацию о световом дне
        let daylightInfo = '';
        if (sunTimes) {
            const daylight = this.calculateEffectiveDaylight(sunTimes, currentData.cloudiness);
            if (daylight) {
                daylightInfo = `\n\n🌅 <b>СВЕТОВОЙ ДЕНЬ:</b>\n`;
                daylightInfo += `• Восход: ${sunTimes.sunriseStr}\n`;
                daylightInfo += `• Закат: ${sunTimes.sunsetStr}\n`;
                daylightInfo += `• Длительность: ${daylight.baseDayLength.toFixed(1)} ч\n`;
               
                if (currentData.cloudiness > 50) {
                    daylightInfo += `☁️ Облачность ${currentData.cloudiness}% — темнеет раньше\n`;
                    daylightInfo += `• Эффективный закат: ~${daylight.effectiveSunset.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n`;
                }
               
                if (daylight.hoursUntilSunset < 2 && daylight.hoursUntilSunset > 0) {
                    daylightInfo += `⚠️ <b>До заката менее ${Math.round(daylight.hoursUntilSunset)} часов!</b>\n`;
                    daylightInfo += `• Планируйте возвращение или подготовьте фонари\n`;
                } else if (daylight.isDark) {
                    daylightInfo += `🌙 <b>УЖЕ ТЕМНО</b>\n`;
                    daylightInfo += `• Используйте фонари, работайте в группе\n`;
                    daylightInfo += `• Будьте внимательны при передвижении\n`;
                }
            }
        }

        return `🔍 <b>УСЛОВИЯ ДЛЯ ПОИСКА В ${location.toUpperCase()}:</b>\n${conditions}\n\n` +
               `👕 <b>РЕКОМЕНДАЦИИ ПО ОДЕЖДЕ:</b>\n${clothingRecommendations}` +
               daylightInfo;
    }

    generateClothingRecommendations(currentData, hourlyForecast, weatherHistory) {
        const recommendations = [];
        const month = new Date().getMonth();
        const isWinter = month >= 11 || month <= 2;
        const isSummer = month >= 5 && month <= 7;

        const last24hPrecipitation = this.getLast24hPrecipitation(weatherHistory);
        const hasRecentRain = last24hPrecipitation > 0;

        const next8hPrecipitation = this.getNext8hPrecipitation(hourlyForecast);
        const hasUpcomingRain = next8hPrecipitation.rain > 0;
        const hasUpcomingWetSnow = next8hPrecipitation.wetSnow > 0;

        // ========== БАЗОВАЯ ОДЕЖДА ПО ТЕМПЕРАТУРЕ ==========
        if (currentData.temperature < -15) {
            recommendations.push('🧥 ЭКСТРЕМАЛЬНЫЙ ХОЛОД:');
            recommendations.push('• Многослойная экипировка (термобелье, флис, пуховик)');
            recommendations.push('• Утепленная обувь, две пары носков');
            recommendations.push('• Шапка-ушанка, балаклава, теплые перчатки');
            recommendations.push('⚠️ Контроль обморожений каждые 30 минут');
        }
        else if (currentData.temperature < -5) {
            recommendations.push('🧥 СИЛЬНЫЙ МОРОЗ:');
            recommendations.push('• Теплая куртка, шапка, перчатки');
            recommendations.push('• Утепленная обувь');
            recommendations.push('• Шарф или балаклава');
        }
        else if (currentData.temperature < 5) {
            recommendations.push('🧥 ХОЛОДНО:');
            recommendations.push('• Теплая куртка, шапка, перчатки');
            recommendations.push('• Непромокаемая обувь');
        }
        else if (currentData.temperature < 15) {
            recommendations.push('🧥 ПРОХЛАДНО:');
            recommendations.push('• Куртка или ветровка');
            recommendations.push('• Головной убор по желанию');
        }
        else if (currentData.temperature < 25) {
            recommendations.push('👕 ТЕПЛО:');
            recommendations.push('• Легкая дышащая одежда');
            recommendations.push('• Головной убор от солнца');
        }
        else {
            recommendations.push('☀️ ЖАРА:');
            recommendations.push('• Легкая светлая одежда');
            recommendations.push('• Обязательно головной убор');
            recommendations.push('💧 Питьевой режим: 0.5-1 литр в час');
            recommendations.push('⚠️ Риск теплового удара, делайте перерывы в тени');
        }

        // ========== СЕЗОННЫЕ РЕКОМЕНДАЦИИ ==========
        if (isWinter) {
            recommendations.push('❄️ ЗИМНИЙ СЕЗОН:');
           
            recommendations.push('• Запасные батареи для фонарей');
            recommendations.push('• Термос с горячим чаем');
            recommendations.push('• Следите за признаками обморожения');
        }

        if (isSummer) {
            recommendations.push('☀️ ЛЕТНИЙ СЕЗОН:');
            recommendations.push('• Защита от клещей (обработка одежды, осмотры)');
            recommendations.push('• Репелленты от комаров и мошки');
            recommendations.push('• Солнцезащитный крем');
            recommendations.push('• Достаточный запас воды');
        }

        // ========== ОСАДКИ И ВЛАЖНОСТЬ ==========
        if (hasRecentRain || currentData.humidity > 85) {
            recommendations.push('🌧️ ВЛАЖНОСТЬ:');
            recommendations.push('• Влагоотталкивающая одежда');
            recommendations.push('• Обувь с мембраной');
            recommendations.push('• Защита документов и электроники');
        }

        if (hasUpcomingRain) {
            recommendations.push('🎒 В БЛИЖАЙШИЕ ЧАСЫ ДОЖДЬ:');
            recommendations.push('• Взять с собой дождевик');
            recommendations.push('• Защитить технику от влаги');
        }

        if (hasUpcomingWetSnow) {
            recommendations.push('🌨️ В БЛИЖАЙШИЕ ЧАСЫ МОКРЫЙ СНЕГ:');
            recommendations.push('• Одежда с хорошей гидроизоляцией');
            recommendations.push('• Смена одежды в рюкзаке');
        }

        // ========== ВЕТЕР ==========
        if (currentData.wind_speed > 10) {
            recommendations.push('💨 СИЛЬНЫЙ ВЕТЕР:');
            recommendations.push('• Ветрозащитная одежда');
            recommendations.push('• Учитывать ветер при поиске (звук, следы)');
            recommendations.push('• Ветроустойчивая палатка при ночевке');
        }
        else if (currentData.wind_speed > 5) {
            recommendations.push('💨 ВЕТРЕНО:');
            recommendations.push('• Ветрозащитная одежда');
        }

        // ========== ДОПОЛНИТЕЛЬНЫЕ ПРЕДУПРЕЖДЕНИЯ ==========
        if (hasRecentRain) {
            recommendations.push('⚠️ В последние сутки был дождь:');
            recommendations.push('• Лес мокрый, дороги скользкие');
            recommendations.push('• Следы могут быть размыты');
        }

        if (currentData.temperature > 0 && currentData.temperature < 5 && hasUpcomingRain) {
            recommendations.push('⚠️ ОПАСНОСТЬ ГОЛОЛЕДА:');
            recommendations.push('• Дороги и тропы скользкие');
            recommendations.push('• Треккинговые палки');
        }

        return recommendations.join('\n');
    }

    getLast24hPrecipitation(weatherHistory) {
        if (!weatherHistory || weatherHistory.length === 0) return 0;
        let totalPrecip = 0;
        const daysToCheck = Math.min(2, weatherHistory.length);
        for (let i = 0; i < daysToCheck; i++) {
            totalPrecip += weatherHistory[i].precipitation || 0;
        }
        return totalPrecip;
    }

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

    async getHourlyPrecipitation(lat, lon, days = 7) {
        try {
            const bundle = await this.getArchiveBundle(lat, lon, days);
            return bundle.hourlyPrecipitation;
        } catch (error) {
            console.log('⚠️ Ошибка получения почасовых осадков:', error.message);
            return [];
        }
    }

    async getSnowData(lat, lon, days = 7) {
        try {
            const bundle = await this.getArchiveBundle(lat, lon, days);
            return bundle.snowData;
        } catch (error) {
            console.log('⚠️ Ошибка получения данных о снеге:', error.message);
            return [];
        }
    }

    async getSunTimes(lat, lon) {
        try {
            const bundle = await this.getForecastBundle(lat, lon);
            return bundle.sunTimes;
        } catch (error) {
            console.log('⚠️ Ошибка получения времени восхода/заката:', error.message);
            return null;
        }
    }

    calculateEffectiveDaylight(sunTimes, cloudiness, currentTime = new Date()) {
        if (!sunTimes) return null;

        const sunrise = sunTimes.sunrise;
        const sunset = sunTimes.sunset;

        const baseDayLength = (sunset - sunrise) / 1000 / 60 / 60;

        let cloudFactor = 1;
        if (cloudiness > 80) {
            cloudFactor = 0.7;
        } else if (cloudiness > 50) {
            cloudFactor = 0.85;
        } else if (cloudiness > 20) {
            cloudFactor = 0.95;
        }

        const effectiveSunset = new Date(sunset.getTime() - (sunset.getTime() - sunrise.getTime()) * (1 - cloudFactor));
        const effectiveDayLength = (effectiveSunset - sunrise) / 1000 / 60 / 60;

        const msUntilSunset = effectiveSunset - currentTime;
        const hoursUntilSunset = Math.max(0, msUntilSunset / 1000 / 60 / 60);

        return {
            sunrise: sunrise,
            sunset: sunset,
            effectiveSunset: effectiveSunset,
            baseDayLength: baseDayLength,
            effectiveDayLength: effectiveDayLength,
            hoursUntilSunset: hoursUntilSunset,
            cloudFactor: cloudFactor,
            isDark: currentTime >= effectiveSunset
        };
    }

    // ===== ЭПОХИ ДЛЯ МОДЕЛИ ДАВНОСТИ (адаптер Open-Meteo) =====
    async getEpochs(lat, lon, startDate, endDate) {
        try {
            const url = 'https://archive-api.open-meteo.com/v1/archive?' +
                'latitude=' + lat + '&longitude=' + lon +
                '&start_date=' + startDate + '&end_date=' + endDate +
                '&hourly=temperature_2m,precipitation,weather_code&timezone=auto';
            const resp = await axios.get(url);
            const hourly = resp.data && resp.data.hourly;
            if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) return [];
            const bucketOf = (h) => (h >= 21 || h < 3) ? 0 : (h >= 3 && h < 9) ? 1 : (h >= 9 && h < 15) ? 2 : 3;
            const buckets = {}; // key: 'date|bucket'
            for (let i = 0; i < hourly.time.length; i++) {
                const t = hourly.time[i];
                const date = t.slice(0, 10);
                const h = parseInt(t.slice(11, 13), 10);
                const T = Number(hourly.temperature_2m[i]);
                const P = Number(hourly.precipitation[i]) || 0;
                const b = bucketOf(h);
                const key = date + '|' + b;
                if (!buckets[key]) buckets[key] = { date, bucket: b, sumT: 0, sumP: 0, n: 0 };
                buckets[key].sumT += T;
                buckets[key].sumP += P;
                buckets[key].n++;
            }
            const names = ['ночь', 'утро', 'день', 'вечер'];
            const epochs = Object.keys(buckets).sort().map(key => {
                const g = buckets[key];
                const T = Math.round((g.sumT / g.n) * 10) / 10;
                const P = Math.round(g.sumP * 100) / 100;
                let type = 'нет';
                if (P > 0 && T > 0) type = 'дождь';
                else if (P > 0) type = 'снег';
                return { date: g.date, epoch: g.bucket, period: names[g.bucket], rank: g.bucket, T, P, type };
            });
            return epochs;
        } catch (e) {
            console.log('❌ Ошибка getEpochs:', e.message);
            return [];
        }
    }

}

module.exports = { WeatherService };
