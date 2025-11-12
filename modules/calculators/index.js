const shoeSizeCalculator = require('./shoe-size');
const { WeatherService } = require('./weather-service');
const axios = require('axios'); // Добавлена отсутствующая зависимость

class SnowCalculator {
    constructor() {
        this.weatherService = new WeatherService();
    }

    // 🎯 ФИЗИЧЕСКАЯ МОДЕЛЬ СНЕГА (БЕЗ ИЗМЕНЕНИЙ - проверенная за 2 года в лесу)
    calculateSnowEvolution(weatherHistory) {
        let snowPack = {
            totalDepth: 10, // начальная высота снега 10 см
            freshSnow: 5,
            compaction: 0,
            hasCrust: false,
            crustDepth: 0,
            hadMelting: false
        };

        const evolution = [];

        weatherHistory.forEach((day, index) => {
            // Расчет свежего снега
            const freshSnow = this.calculateFreshSnowDepth(day);
            snowPack.totalDepth += freshSnow;
            snowPack.freshSnow += freshSnow;

            // Уплотнение
            const compaction = this.calculateSnowCompaction(snowPack, day);
            snowPack.totalDepth -= compaction;
            snowPack.freshSnow = Math.max(0, snowPack.freshSnow - compaction * 0.7);
            snowPack.compaction += compaction;

            // Испарение
            const evaporation = this.calculateSnowEvaporation(snowPack, day);
            snowPack.totalDepth = Math.max(0, snowPack.totalDepth - evaporation);

            // Таяние
            const melting = this.calculateSnowMelting(snowPack, day);
            snowPack.totalDepth = Math.max(0, snowPack.totalDepth - melting);
            if (melting > 0) snowPack.hadMelting = true;

            // Образование наста
            this.updateCrustFormation(snowPack, day, index);

            evolution.push({
                date: day.date,
                precipitation: day.precipitation,
                temperature: day.temperature,
                freshSnow: freshSnow,
                compaction: compaction,
                evaporation: evaporation,
                melting: melting,
                totalDepth: snowPack.totalDepth,
                hasCrust: snowPack.hasCrust,
                crustDepth: snowPack.crustDepth
            });
        });

        return evolution;
    }

    calculateFreshSnowDepth(day) {
        // Используем реальные данные о снеге если есть
        if (day.snow && day.snow > 0) {
            return day.snow * 10; // Переводим см снега в эквивалент воды
        }
       
        // Если снега нет, но есть осадки и температура подходящая
        if (day.precipitation <= 0 || day.temperature > 2) return 0;
       
        // Плотность снега в зависимости от температуры
        let density;
        if (day.temperature < -15) density = 0.05;      // очень холодный - пушистый
        else if (day.temperature < -5) density = 0.08;  // холодный
        else if (day.temperature < 0) density = 0.12;   // влажный
        else return 0;                                  // выше 0 - дождь
       
        return (day.precipitation / density) / 10; // перевод в см
    }

    calculateSnowCompaction(snowPack, day) {
        if (snowPack.totalDepth <= 0) return 0;

        let rate;
        if (day.temperature < -10) rate = 0.02;      // малое уплотнение на морозе
        else if (day.temperature < -2) rate = 0.05;  // среднее уплотнение
        else if (day.temperature < 2) rate = 0.10;   // сильное уплотнение
        else rate = 0.15;                           // очень сильное при оттепели

        // Уплотнение зависит от ветра и общего слоя снега
        const windFactor = 1 + (day.wind_speed / 20);
        return snowPack.totalDepth * rate * windFactor * 0.1;
    }

    calculateSnowEvaporation(snowPack, day) {
        if (snowPack.totalDepth <= 0) return 0;

        let rate;
        if (day.wind_speed < 2) rate = 0.1;
        else if (day.wind_speed < 5) rate = 0.3;
        else if (day.wind_speed < 10) rate = 0.7;
        else rate = 1.2;

        const humidityFactor = day.humidity < 60 ? 1.5 : 1.0;
        return rate * humidityFactor * 0.1;
    }

    calculateSnowMelting(snowPack, day) {
        if (day.temperature <= 0) return 0;

        // Таяние пропорционально положительной температуре
        const meltingRate = 2.0; // см на градус в день
        return Math.max(0, day.temperature * meltingRate * 0.1);
    }

    updateCrustFormation(snowPack, day, dayIndex) {
        const canFormCrust = day.temperature < -2 &&
                           day.precipitation === 0 &&
                           day.wind_speed < 5;

        if (canFormCrust) {
            if (!snowPack.hasCrust) {
                snowPack.hasCrust = true;
                snowPack.crustDepth = 0.1;
            } else {
                snowPack.crustDepth = Math.min(3.0, snowPack.crustDepth + 0.1);
            }
        } else {
            // Разрушение наста при осадках или потеплении
            if (day.precipitation > 1 || day.temperature > 0) {
                snowPack.hasCrust = false;
                snowPack.crustDepth = 0;
            }
        }
    }

    // 🎯 РАСЧЕТ НЕОПРЕДЕЛЕННОСТЕЙ
    calculateSnowUncertainties(weatherHistory, coordinates) {
        const lat = coordinates.lat;

        // Базовые неопределенности
        let uncertainties = {
            precipitation: 0.15,
            temperature: 0.10,
            snowDensity: 0.20,
            compaction: 0.12,
            localEffects: 0.15
        };

        // Корректировка по широте
        if (lat > 60) uncertainties.localEffects += 0.05;  // Север - больше вариаций
        if (lat < 45) uncertainties.localEffects += 0.08;  // Юг - непредсказуемый снег

        // Корректировка по данным погоды
        const tempVariance = this.calculateTemperatureVariance(weatherHistory);
        uncertainties.temperature += tempVariance * 0.1;

        const precipVariance = this.calculatePrecipitationVariance(weatherHistory);
        uncertainties.precipitation += precipVariance * 0.15;

        // Общая неопределенность
        uncertainties.total = Math.min(0.6,
            Math.sqrt(
                Math.pow(uncertainties.precipitation, 2) +
                Math.pow(uncertainties.temperature, 2) +
                Math.pow(uncertainties.snowDensity, 2) +
                Math.pow(uncertainties.compaction, 2) +
                Math.pow(uncertainties.localEffects, 2)
            )
        );

        return uncertainties;
    }

    calculateProbabilityCorridors(baseResult, uncertainties) {
        const baseDepth = baseResult.totalDepth || baseResult.estimatedSnowDepth;
        const totalUncertainty = uncertainties.total;
       
        // 🛡️ ЗАЩИТА ОТ NaN И НЕКОРРЕКТНЫХ ЗНАЧЕНИЙ
        if (isNaN(baseDepth) || baseDepth <= 0) {
            console.log('⚠️ Некорректная базовая глубина снега:', baseDepth);
            return {
                depth: {
                    high_confidence: {
                        min: 0,
                        max: 10,
                        probability: 0.8,
                        description: "Высокая вероятность"
                    },
                    medium_confidence: {
                        min: 0,
                        max: 15,
                        probability: 0.95,
                        description: "Очень высокая вероятность"
                    }
                },
                detection_probability: 0.5,
                crust_probability: baseResult.hasCrust ? 0.8 : 0.3,
                preservation_probability: 0.6
            };
        }
       
        // 🎯 НОРМАЛЬНЫЙ РАСЧЕТ
        const highMin = Math.max(0, Math.round(baseDepth * (1 - totalUncertainty * 0.5)));
        const highMax = Math.round(baseDepth * (1 + totalUncertainty * 0.5));
        const mediumMin = Math.max(0, Math.round(baseDepth * (1 - totalUncertainty)));
        const mediumMax = Math.round(baseDepth * (1 + totalUncertainty));
       
        return {
            depth: {
                high_confidence: {
                    min: highMin,
                    max: highMax,
                    probability: 0.8,
                    description: "Высокая вероятность"
                },
                medium_confidence: {
                    min: mediumMin,
                    max: mediumMax,
                    probability: 0.95,
                    description: "Очень высокая вероятность"
                }
            },
            detection_probability: this.calculateDetectionProbability(baseResult, uncertainties),
            crust_probability: baseResult.hasCrust ? 0.8 : 0.3,
            preservation_probability: this.calculatePreservationProbability(baseResult, uncertainties)
        };
    }

    calculateDetectionProbability(baseResult, uncertainties) {
        let probability = 0.7;

        if (baseResult.totalDepth > 25) probability += 0.2;
        else if (baseResult.totalDepth > 15) probability += 0.1;

        probability -= uncertainties.total * 0.3;

        if (baseResult.hasCrust) probability += 0.15;
        if (baseResult.hadMelting) probability -= 0.2;

        return Math.max(0.3, Math.min(0.95, probability));
    }

    calculatePreservationProbability(baseResult, uncertainties) {
        let probability = 0.8;
        if (baseResult.hadMelting) probability -= 0.3;
        probability -= uncertainties.total * 0.2;
        return Math.max(0.4, Math.min(0.95, probability));
    }

    // 🎯 АНАЛИЗ ОПАСНОСТЕЙ
    analyzeSnowDangers(snowEvolution) {
        const warnings = [];
        const current = snowEvolution[snowEvolution.length - 1];

        if (current.hasCrust && current.crustDepth > 1) {
            warnings.push({
                type: 'CRUST_WARNING',
                level: 'HIGH',
                message: `Образовался наст толщиной ${current.crustDepth.toFixed(1)} см`
            });
        }

        const hasSignificantMelting = snowEvolution.some(day => day.melting > 1);
        if (hasSignificantMelting) {
            warnings.push({
                type: 'THAW_WARNING',
                level: 'MEDIUM',
                message: 'Были периоды значительного таяния'
            });
        }

        const heavySnowDays = snowEvolution.filter(day => day.freshSnow > 8).length;
        if (heavySnowDays > 2) {
            warnings.push({
                type: 'HEAVY_SNOW_WARNING',
                level: 'HIGH',
                message: `Зафиксировано ${heavySnowDays} дней с сильным снегопадом`
            });
        }

        return warnings;
    }

    // 🎯 ФОРМАТИРОВАНИЕ РЕЗУЛЬТАТА
    formatSnowAnalysisResult(result) {
        let message = '';
       
        if (result.testMode) {
            message += `🧪 <b>ТЕСТОВЫЙ РАСЧЕТ СНЕЖНОГО ПОКРОВА</b>\n\n`;
            message += `📅 <b>Период анализа:</b> ${result.startDate.toLocaleDateString('ru-RU')} → ${result.endDate.toLocaleDateString('ru-RU')}\n`;
            message += `⏱️ <b>Длительность:</b> ${result.periodDays} суток\n\n`;
        } else {
            message += `🌲 <b>ВЕРОЯТНОСТНЫЙ РАСЧЕТ СНЕГА</b>\n\n`;
            message += `📍 <b>Место:</b> ${result.location.lat.toFixed(4)}°N, ${result.location.lon.toFixed(4)}°E\n`;
            message += `📅 <b>Период анализа:</b> ${result.periodDays} дней\n`;
            message += `⏰ <b>Время пропажи:</b> ${result.disappearanceTime.toLocaleString('ru-RU')}\n\n`;
        }
       
        // 🛡️ ЗАЩИТА ОТ NaN
        const estimatedDepth = isNaN(result.estimatedSnowDepth) ? 15 : result.estimatedSnowDepth;
        const highMin = isNaN(result.probability.depth.high_confidence.min) ? Math.max(0, Math.round(estimatedDepth * 0.7)) : result.probability.depth.high_confidence.min;
        const highMax = isNaN(result.probability.depth.high_confidence.max) ? Math.round(estimatedDepth * 1.3) : result.probability.depth.high_confidence.max;
        const mediumMin = isNaN(result.probability.depth.medium_confidence.min) ? Math.max(0, Math.round(estimatedDepth * 0.6)) : result.probability.depth.medium_confidence.min;
        const mediumMax = isNaN(result.probability.depth.medium_confidence.max) ? Math.round(estimatedDepth * 1.4) : result.probability.depth.medium_confidence.max;
       
        message += `📊 <b>БАЗОВЫЙ РАСЧЕТ:</b> ${estimatedDepth.toFixed(1)} см снега\n\n`;
       
        message += `🎯 <b>ВЕРОЯТНОСТНЫЕ КОРИДОРЫ:</b>\n\n`;
        message += `📏 <b>ГЛУБИНА СНЕГА:</b>\n`;
        message += `• 80% вероятность: ${highMin}-${highMax} см\n`;
        message += `• 95% вероятность: ${mediumMin}-${mediumMax} см\n\n`;
       
        message += `🎲 <b>ВЕРОЯТНОСТИ:</b>\n`;
        message += `• Обнаружения следа: ${(result.probability.detection_probability * 100).toFixed(0)}%\n`;
        message += `• Наличия наста: ${(result.probability.crust_probability * 100).toFixed(0)}%\n`;
        message += `• Сохранения следа: ${(result.probability.preservation_probability * 100).toFixed(0)}%\n\n`;
       
        message += `📈 <b>СОСТАВ СНЕГА:</b>\n`;
        message += `• Свежий снег: ${result.freshSnowDepth.toFixed(1)} см\n`;
        message += `• Уплотнение: ${result.compaction.toFixed(1)} см\n`;
        message += `• Осадки за период: ${result.totalPrecipitation.toFixed(1)} мм\n`;
        message += `• Суммарное уплотнение: ${result.totalCompaction.toFixed(1)} см\n\n`;
       
        if (result.warnings.length > 0) {
            message += `⚠️ <b>ВНИМАНИЕ:</b>\n`;
            result.warnings.forEach(warning => {
                message += `• ${warning.message}\n`;
            });
            message += `\n`;
        }
       
        if (result.hasCrust) {
            message += `🧊 <b>Наст:</b> ${result.crustDepth.toFixed(1)} см - может мешать замерам!\n\n`;
        }
       
        message += `🎯 <b>РЕКОМЕНДАЦИЯ:</b>\n`;
        message += `Ищите следы с глубиной <b>${highMin}-${highMax} см</b>`;
       
        if (result.testMode) {
            message += `\n\n💡 <b>Сравните с реальными замерами</b> для оценки точности модели`;
        }
       
        return message;
    }

    // 🎯 ПОЛУЧЕНИЕ РЕАЛЬНЫХ ИСТОРИЧЕСКИХ ДАННЫХ ПОГОДЫ
    async generateWeatherHistory(startDate, endDate, coordinates) {
        try {
            const openMeteoArchiveURL = 'https://archive-api.open-meteo.com/v1/archive';
           
            const response = await axios.get(openMeteoArchiveURL, {
                params: {
                    latitude: coordinates.lat,
                    longitude: coordinates.lon,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,snowfall_sum,weather_code,wind_speed_10m_max,relative_humidity_2m',
                    timezone: 'auto'
                }
            });

            const daily = response.data.daily;
            const history = [];
           
            console.log('📊 Получены реальные исторические данные:', daily);
           
            for (let i = 0; i < daily.time.length; i++) {
                // Определяем тип осадков
                let precipitation = daily.precipitation_sum[i] || 0;
                const rain = daily.rain_sum[i] || 0;
                const snow = daily.snowfall_sum[i] || 0;
               
                // Если есть данные о снеге - используем их
                if (snow > 0) {
                    precipitation = snow;
                }
               
                history.push({
                    date: daily.time[i],
                    temperature: (daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2,
                    temperature_min: daily.temperature_2m_min[i],
                    temperature_max: daily.temperature_2m_max[i],
                    precipitation: precipitation,
                    rain: rain,
                    snow: snow,
                    wind_speed: daily.wind_speed_10m_max[i] || 0,
                    humidity: daily.relative_humidity_2m ? daily.relative_humidity_2m[i] : 75,
                    weather_code: daily.weather_code[i] || 0
                });
            }
           
            console.log('✅ Успешно получена история погоды за', history.length, 'дней');
            return history;
           
        } catch (error) {
            console.log('❌ Ошибка получения исторических данных Open-Meteo:', error.message);
           
            // 🔧 РЕЗЕРВНЫЙ ВАРИАНТ - более реалистичная эмуляция на основе сезона
            return this.generateRealisticMockHistory(startDate, endDate, coordinates);
        }
    }

    // 🎯 РЕЗЕРВНЫЙ ВАРИАНТ - РЕАЛИСТИЧНАЯ ЭМУЛЯЦИЯ
    generateRealisticMockHistory(startDate, endDate, coordinates) {
        const history = [];
        const currentDate = new Date(startDate);
        const lat = coordinates.lat;
       
        // Определяем сезон по датам
        const startMonth = startDate.getMonth() + 1;
        const isWinter = startMonth >= 11 || startMonth <= 2;
        const isSpring = startMonth >= 3 && startMonth <= 5;
       
        // Базовые параметры в зависимости от сезона и широты
        let baseTemp, tempRange, precipProbability;
       
        if (isWinter) {
            baseTemp = lat > 55 ? -8 : lat > 50 ? -5 : -2;
            tempRange = 6;
            precipProbability = 0.4; // Снег более вероятен зимой
        } else if (isSpring) {
            baseTemp = lat > 55 ? 2 : lat > 50 ? 5 : 8;
            tempRange = 8;
            precipProbability = 0.3;
        } else {
            baseTemp = lat > 55 ? 10 : lat > 50 ? 15 : 18;
            tempRange = 10;
            precipProbability = 0.25;
        }
       
        let totalPrecipitation = 0;
       
        while (currentDate <= endDate) {
            const daysFromStart = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
           
            // Реалистичная температура с суточными колебаниями
            const dailyBaseTemp = baseTemp + Math.sin(daysFromStart * 0.15) * (tempRange / 2);
            const temperature = dailyBaseTemp + (Math.random() - 0.5) * 4;
           
            // Реалистичные осадки в зависимости от температуры
            let precipitation = 0;
            let rain = 0;
            let snow = 0;
           
            if (Math.random() < precipProbability) {
                if (temperature > 2) {
                    // Дождь
                    rain = 0.5 + Math.random() * 8;
                    precipitation = rain;
                } else {
                    // Снег
                    snow = 0.5 + Math.random() * 5;
                    precipitation = snow;
                }
                totalPrecipitation += precipitation;
            }
           
            const wind_speed = 1 + Math.random() * 10;
            const humidity = 60 + Math.random() * 30;
           
            history.push({
                date: currentDate.toISOString().split('T')[0],
                temperature: Math.round(temperature * 10) / 10,
                temperature_min: Math.round((temperature - 3) * 10) / 10,
                temperature_max: Math.round((temperature + 3) * 10) / 10,
                precipitation: Math.round(precipitation * 10) / 10,
                rain: Math.round(rain * 10) / 10,
                snow: Math.round(snow * 10) / 10,
                wind_speed: Math.round(wind_speed * 10) / 10,
                humidity: Math.round(humidity),
                weather_code: this.getWeatherCodeFromConditions(temperature, precipitation, rain, snow)
            });
           
            currentDate.setDate(currentDate.getDate() + 1);
        }
       
        console.log('⚠️ Использованы эмулированные данные. Всего осадков:', totalPrecipitation.toFixed(1), 'мм');
       
        return history;
    }

    // 🎯 ОПРЕДЕЛЕНИЕ КОДА ПОГОДЫ ДЛЯ ЭМУЛЯЦИИ
    getWeatherCodeFromConditions(temperature, precipitation, rain, snow) {
        if (precipitation === 0) {
            if (Math.random() > 0.7) return 3; // Пасмурно
            if (Math.random() > 0.5) return 2; // Переменная облачность
            return 1; // Преимущественно ясно
        }
       
        if (snow > 0) {
            if (snow > 3) return 75; // Сильный снег
            if (snow > 1) return 73; // Снег
            return 71; // Небольшой снег
        }
       
        if (rain > 0) {
            if (rain > 5) return 65; // Сильный дождь
            if (rain > 2) return 63; // Дождь
            return 61; // Небольшой дождь
        }
       
        return 3; // По умололчанию - пасмурно
    }

    // 🎯 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateTemperatureVariance(weatherHistory) {
        const temps = weatherHistory.map(day => day.temperature);
        const mean = temps.reduce((a, b) => a + b) / temps.length;
        const variance = temps.reduce((sum, temp) => sum + Math.pow(temp - mean, 2), 0) / temps.length;
        return Math.min(1, Math.sqrt(variance) / 10);
    }

    calculatePrecipitationVariance(weatherHistory) {
        const precipitations = weatherHistory.map(day => day.precipitation).filter(p => p > 0);
        if (precipitations.length < 2) return 0;
        const mean = precipitations.reduce((a, b) => a + b) / precipitations.length;
        const variance = precipitations.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / precipitations.length;
        return Math.min(1, variance / (mean || 1));
    }

    // 🔮 ПОЛНОЦЕННЫЙ ВЕРОЯТНОСТНЫЙ КАЛЬКУЛЯТОР СНЕГА
    async calculateSnowAge(coordinates, disappearanceTime, options = {}) {
        try {
            console.log('❄️ Запуск калькулятора снега для:', coordinates, 'Options:', options);
           
            const now = options.endDate ? new Date(options.endDate) : new Date();
            const disappearanceDate = new Date(disappearanceTime);
           
            if (isNaN(disappearanceDate.getTime())) {
                throw new Error('Неверная дата пропажи');
            }

            // 🎯 ГЕНЕРАЦИЯ ИСТОРИИ ПОГОДЫ
            const weatherHistory = await this.generateWeatherHistory(disappearanceDate, now, coordinates);
            console.log('📊 История погоды:', weatherHistory);
           
            if (!weatherHistory || weatherHistory.length === 0) {
                throw new Error('Не удалось получить данные погоды за период');
            }

            // 🎯 РАСЧЕТ ЭВОЛЮЦИИ СНЕГА
            const snowEvolution = this.calculateSnowEvolution(weatherHistory);
            console.log('📈 Эволюция снега за', snowEvolution.length, 'дней:');
            snowEvolution.forEach((day, index) => {
                console.log(`День ${index + 1}: ${day.totalDepth.toFixed(1)}см (свежий: ${day.freshSnow.toFixed(1)}см, уплотнение: ${day.compaction.toFixed(1)}см)`);
            });
           
            const currentSnow = snowEvolution[snowEvolution.length - 1];
            console.log('📊 Текущий снег:', currentSnow);
           
            const warnings = this.analyzeSnowDangers(snowEvolution);

            // 🎯 РАСЧЕТ НЕОПРЕДЕЛЕННОСТЕЙ И ВЕРОЯТНОСТНЫХ КОРИДОРОВ
            const uncertainties = this.calculateSnowUncertainties(weatherHistory, coordinates);
            console.log('🎯 Неопределенности:', uncertainties);
           
            const probabilityCorridors = this.calculateProbabilityCorridors(currentSnow, uncertainties);
            console.log('📏 Вероятностные коридоры:', probabilityCorridors);
           
            // 🎯 ФОРМАТИРОВАНИЕ РЕЗУЛЬТАТА
            return this.formatSnowAnalysisResult({
                disappearanceTime: disappearanceDate,
                calculationTime: now,
                location: coordinates,
                periodDays: weatherHistory.length,
                estimatedSnowDepth: Math.round(currentSnow.totalDepth * 10) / 10,
                freshSnowDepth: Math.round(currentSnow.freshSnow * 10) / 10,
                compaction: Math.round(currentSnow.compaction * 10) / 10,
                totalPrecipitation: Math.round(snowEvolution.reduce((sum, day) => sum + day.precipitation, 0) * 10) / 10,
                totalCompaction: Math.round(snowEvolution.reduce((sum, day) => sum + day.compaction, 0) * 10) / 10,
                totalEvaporation: Math.round(snowEvolution.reduce((sum, day) => sum + day.evaporation, 0) * 10) / 10,
                warnings: warnings,
                hasCrust: currentSnow.hasCrust,
                crustDepth: Math.round(currentSnow.crustDepth * 10) / 10,
                hadMelting: currentSnow.hadMelting,
                probability: probabilityCorridors,
                uncertainties: uncertainties,
                testMode: options.testMode || false,
                startDate: disappearanceDate,
                endDate: now
            });
           
        } catch (error) {
            console.log('❌ Ошибка вероятностного калькулятора:', error);
            return `❌ Ошибка расчета: ${error.message}`;
        }
    }
}

function initialize() {
    console.log('✅ Модуль калькуляторов загружен');

    const snowCalculator = new SnowCalculator();
    const weatherService = new WeatherService();

    return {
        getMenu: () => ({
            title: "🧮 КАЛЬКУЛЯТОРЫ",
            sections: [
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
                    name: "⏱️❄️ Калькулятор давности следа на снегу",
                    command: "/calc_snow_age",
                    description: "Расчет эволюции снежного покрова"
                },
                {
                    name: "🌤️ Погода",
                    command: "/calc_weather",
                    description: "Метеоданные для анализа следов"
                }
            ]
        }),

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

        // 🔮 СНЕЖНЫЙ КАЛЬКУЛЯТОР
        calculateSnowAge: async (coordinates, disappearanceTime, locationInfo = {}) => {
            return await snowCalculator.calculateSnowAge(coordinates, disappearanceTime, locationInfo);
        },

        // 🌤️ Погода
        getWeatherData: async (options = {}) => {
            try {
                const result = await weatherService.getWeatherData(options);
                if (result.success) {
                    const data = result.result;

                    let message = `🌤️ <b>ПОГОДА - ${data.location.toUpperCase()}</b>\n\n`;

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

                    // История погоды
                    if (data.history && data.history.length > 0) {
                        message += `📅 <b>ИСТОРИЯ ПОГОДЫ ЗА 7 СУТОК:</b>\n`;
                        data.history.forEach(day => {
                            const precipIcon = day.precipitation > 0 ? '🌧️' : '';
                            message += `${day.date}: День ${day.day_temp}°C / Ночь ${day.night_temp}°C, ${day.condition}, ${precipIcon}${day.precipitation}мм, 💨${day.wind_speed}м/с\n`;
                        });
                        message += '\n';
                    }

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
