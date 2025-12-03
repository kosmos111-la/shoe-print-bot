const axios = require('axios');

class ProbabilisticSnowCalculator {
    constructor() {
        this.openMeteoURL = 'https://archive-api.open-meteo.com/v1/archive';
        this.setupSnowPhysics();
    }

    setupSnowPhysics() {
        this.params = {
            snowDensity: {
                'very_cold': 0.05,
                'cold': 0.08,
                'medium': 0.12,
                'wet': 0.18,
                'very_wet': 0.25
            },
           
            compactionRate: {
                'very_cold': 0.02,
                'cold': 0.05,
                'medium': 0.10,
                'wet': 0.20,
                'very_wet': 0.35
            },
           
            evaporationRate: {
                'calm': 0.1,
                'light': 0.3,
                'moderate': 0.7,
                'strong': 1.2
            },
           
            meltingRate: 2.0,
           
            crustFormation: {
                tempThreshold: -2,
                timeThreshold: 24,
                windThreshold: 3
            }
        };
    }

    async calculateSnowWithUncertainty(coordinates, disappearanceTime, locationInfo = {}) {
        try {
            const now = new Date();
            const disappearanceDate = new Date(disappearanceTime);
           
            console.log(`🔍 Вероятностный расчет снега с ${disappearanceDate} по ${now}`);

            const weatherHistory = await this.getWeatherHistory(
                coordinates.lat, coordinates.lon,
                disappearanceDate,
                now
            );

            if (!weatherHistory || weatherHistory.length === 0) {
                throw new Error('Не удалось получить данные погоды за период');
            }

            // БАЗОВЫЙ РАСЧЕТ
            const baseResult = this.calculateDetailedSnowEvolution(weatherHistory, coordinates, disappearanceDate);
           
            // РАСЧЕТ НЕОПРЕДЕЛЕННОСТЕЙ
            const uncertainties = this.calculateUncertainties(weatherHistory, locationInfo);
           
            // ВЕРОЯТНОСТНЫЕ КОРИДОРЫ
            const probabilityCorridors = this.calculateProbabilityCorridors(baseResult, uncertainties);
           
            return {
                success: true,
                base: baseResult,
                uncertainties: uncertainties,
                probability: probabilityCorridors,
                recommendations: this.generateProbabilisticRecommendations(probabilityCorridors, baseResult)
            };

        } catch (error) {
            console.error('Probabilistic snow calculation error:', error);
            return {
                success: false,
                error: `Ошибка расчета: ${error.message}`
            };
        }
    }

    calculateDetailedSnowEvolution(weatherHistory, location, disappearanceTime) {
        let snowPack = {
            totalDepth: 0,
            freshSnow: 0,
            compaction: 0,
            hasCrust: false,
            crustDepth: 0,
            hadMelting: false
        };

        const dailyStates = [];

        weatherHistory.forEach((day, index) => {
            const freshSnow = this.calculateFreshSnowDepth(day);
            snowPack.totalDepth += freshSnow;
            snowPack.freshSnow += freshSnow;

            const compaction = this.calculateCompaction(snowPack, day);
            snowPack.totalDepth -= compaction;
            snowPack.freshSnow = Math.max(0, snowPack.freshSnow - compaction);
            snowPack.compaction += compaction;

            const evaporation = this.calculateEvaporation(snowPack, day);
            snowPack.totalDepth = Math.max(0, snowPack.totalDepth - evaporation);

            const melting = this.calculateMelting(snowPack, day);
            snowPack.totalDepth = Math.max(0, snowPack.totalDepth - melting);
            if (melting > 0) snowPack.hadMelting = true;

            this.updateCrustFormation(snowPack, day, index);

            dailyStates.push({
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

        return {
            location: location,
            disappearanceTime: disappearanceTime,
            periodDays: weatherHistory.length,
            estimatedSnowDepth: Math.round(snowPack.totalDepth * 10) / 10,
            freshSnowDepth: Math.round(snowPack.freshSnow * 10) / 10,
            compaction: Math.round(snowPack.compaction * 10) / 10,
            hasCrust: snowPack.hasCrust,
            crustDepth: Math.round(snowPack.crustDepth * 10) / 10,
            hadMelting: snowPack.hadMelting,
            totalPrecipitation: Math.round(dailyStates.reduce((sum, day) => sum + day.precipitation, 0) * 10) / 10,
            totalCompaction: Math.round(dailyStates.reduce((sum, day) => sum + day.compaction, 0) * 10) / 10,
            totalEvaporation: Math.round(dailyStates.reduce((sum, day) => sum + day.evaporation, 0) * 10) / 10,
            dailyStates: dailyStates
        };
    }

    // 🔮 РАСЧЕТ НЕОПРЕДЕЛЕННОСТЕЙ
    calculateUncertainties(weatherHistory, location) {
        const uncertainties = {
            precipitation: this.calculatePrecipitationUncertainty(weatherHistory),
            temperature: this.calculateTemperatureUncertainty(weatherHistory),
            snowDensity: this.calculateDensityUncertainty(weatherHistory),
            compaction: this.calculateCompactionUncertainty(weatherHistory),
            localEffects: this.calculateLocalUncertainty(location),
            forestMicroclimate: this.calculateForestUncertainty(location),
            temporal: this.calculateTemporalUncertainty(weatherHistory)
        };

        uncertainties.total = this.aggregateUncertainties(uncertainties);
       
        return uncertainties;
    }

    calculatePrecipitationUncertainty(weatherHistory) {
        let uncertainty = 0.1;
        const smallPrecipDays = weatherHistory.filter(day => day.precipitation > 0 && day.precipitation < 1).length;
        uncertainty += smallPrecipDays * 0.05;
        const precipVariance = this.calculatePrecipitationVariance(weatherHistory);
        uncertainty += precipVariance * 0.1;
        return Math.min(0.4, uncertainty);
    }

    calculateTemperatureUncertainty(weatherHistory) {
        let uncertainty = 0.08;
        const nearZeroDays = weatherHistory.filter(day => Math.abs(day.temperature) < 2).length;
        uncertainty += nearZeroDays * 0.03;
        const tempSwings = this.calculateTemperatureSwings(weatherHistory);
        uncertainty += tempSwings * 0.02;
        return Math.min(0.3, uncertainty);
    }

    calculateDensityUncertainty(weatherHistory) {
        let uncertainty = 0.15;
        const tempRange = this.calculateTemperatureRange(weatherHistory);
        uncertainty += tempRange * 0.1;
        const mixedPrecipDays = weatherHistory.filter(day =>
            day.temperature > -2 && day.temperature < 2 && day.precipitation > 0
        ).length;
        uncertainty += mixedPrecipDays * 0.05;
        return Math.min(0.5, uncertainty);
    }

    calculateCompactionUncertainty(weatherHistory) {
        return 0.12;
    }

    calculateLocalUncertainty(location) {
        let uncertainty = 0.1;
        if (location.terrain === 'complex') uncertainty += 0.2;
        else if (location.terrain === 'hills') uncertainty += 0.15;
        else if (location.terrain === 'flat') uncertainty += 0.05;
       
        if (location.forestType === 'dense_spruce') uncertainty += 0.1;
        else if (location.forestType === 'mixed') uncertainty += 0.05;
        else if (location.forestType === 'clearing') uncertainty += 0.15;
       
        return Math.min(0.4, uncertainty);
    }

    calculateForestUncertainty(location) {
        return 0.08;
    }

    calculateTemporalUncertainty(weatherHistory) {
        return 0.05;
    }

    // 🔮 РАСЧЕТ ВЕРОЯТНОСТНЫХ КОРИДОРОВ
    calculateProbabilityCorridors(baseResult, uncertainties) {
        const baseDepth = baseResult.estimatedSnowDepth;
        const totalUncertainty = uncertainties.total;
       
        return {
            depth: {
                high_confidence: {
                    min: baseDepth * (1 - totalUncertainty * 0.5),
                    max: baseDepth * (1 + totalUncertainty * 0.5),
                    probability: 0.8,
                    description: "Высокая вероятность"
                },
                medium_confidence: {
                    min: baseDepth * (1 - totalUncertainty),
                    max: baseDepth * (1 + totalUncertainty),
                    probability: 0.95,
                    description: "Очень высокая вероятность"
                },
                low_confidence: {
                    min: baseDepth * (1 - totalUncertainty * 1.5),
                    max: baseDepth * (1 + totalUncertainty * 1.5),
                    probability: 0.99,
                    description: "Практически гарантировано"
                }
            },
           
            detection_probability: this.calculateDetectionProbability(baseResult, uncertainties),
            crust_probability: this.calculateCrustProbability(baseResult),
            preservation_probability: this.calculatePreservationProbability(baseResult, uncertainties)
        };
    }

    calculateDetectionProbability(baseResult, uncertainties) {
        let probability = 0.7;
        if (baseResult.estimatedSnowDepth > 20) probability += 0.2;
        else if (baseResult.estimatedSnowDepth > 10) probability += 0.1;
        probability -= uncertainties.total * 0.3;
        if (baseResult.hasCrust) probability += 0.15;
        if (baseResult.hadMelting) probability -= 0.2;
        return Math.max(0.1, Math.min(0.95, probability));
    }

    calculateCrustProbability(baseResult) {
        if (baseResult.hasCrust) return 0.9;
        const crustFavorableDays = baseResult.dailyStates.filter(day =>
            day.temperature < -2 && day.precipitation === 0
        ).length;
        return Math.min(0.7, crustFavorableDays * 0.15);
    }

    calculatePreservationProbability(baseResult, uncertainties) {
        let probability = 0.8;
        if (baseResult.hadMelting) probability -= 0.3;
        probability -= uncertainties.total * 0.2;
        return Math.max(0.3, Math.min(0.95, probability));
    }

    // 📊 ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ
    generateProbabilisticRecommendations(probability, baseResult) {
        const recommendations = [];
       
        const depthCorridor = probability.depth.high_confidence;
        recommendations.push({
            type: 'DEPTH_SEARCH',
            priority: 'HIGH',
            message: `Ищите следы на глубине ${depthCorridor.min.toFixed(1)}-${depthCorridor.max.toFixed(1)} см (вероятность 80%)`,
            action: 'Замеряйте снег в разных точках'
        });
       
        if (probability.detection_probability > 0.8) {
            recommendations.push({
                type: 'HIGH_DETECTION_PROB',
                priority: 'HIGH',
                message: `Высокая вероятность (${(probability.detection_probability * 100).toFixed(0)}%) обнаружения следов`,
                action: 'Тщательно обследуйте район'
            });
        } else if (probability.detection_probability < 0.4) {
            recommendations.push({
                type: 'LOW_DETECTION_PROB',
                priority: 'MEDIUM',
                message: `Низкая вероятность (${(probability.detection_probability * 100).toFixed(0)}%) сохранения следов`,
                action: 'Расширьте зону поиска, ищите другие признаки'
            });
        }
       
        if (probability.crust_probability > 0.6) {
            recommendations.push({
                type: 'CRUST_WARNING',
                priority: 'HIGH',
                message: `Высокая вероятность наста (${(probability.crust_probability * 100).toFixed(0)}%)`,
                action: 'Проверяйте прочность снега, используйте щуп'
            });
        }
       
        return recommendations;
    }

    // 📈 АГРЕГАЦИЯ НЕОПРЕДЕЛЕННОСТЕЙ
    aggregateUncertainties(uncertainties) {
        const sumOfSquares =
            Math.pow(uncertainties.precipitation, 2) +
            Math.pow(uncertainties.temperature, 2) +
            Math.pow(uncertainties.snowDensity, 2) +
            Math.pow(uncertainties.compaction, 2) +
            Math.pow(uncertainties.localEffects, 2) +
            Math.pow(uncertainties.forestMicroclimate, 2) +
            Math.pow(uncertainties.temporal, 2);
           
        return Math.min(0.8, Math.sqrt(sumOfSquares));
    }

    // 🏔️ БАЗОВЫЕ ФИЗИЧЕСКИЕ РАСЧЕТЫ
    calculateFreshSnowDepth(day) {
        if (day.precipitation <= 0) return 0;
        const tempCategory = this.getTemperatureCategory(day.temperature);
        const density = this.params.snowDensity[tempCategory];
        return (day.precipitation / density) / 10;
    }

    calculateCompaction(snowPack, day) {
        if (snowPack.totalDepth <= 0) return 0;
        const tempCategory = this.getTemperatureCategory(day.temperature);
        const rate = this.params.compactionRate[tempCategory];
        return snowPack.totalDepth * rate;
    }

    calculateEvaporation(snowPack, day) {
        const windCategory = this.getWindCategory(day.wind_speed);
        const rate = this.params.evaporationRate[windCategory];
        const humidityFactor = day.humidity < 60 ? 1.5 : 1.0;
        return rate * humidityFactor;
    }

    calculateMelting(snowPack, day) {
        if (day.temperature <= 0) return 0;
        return day.temperature * this.params.meltingRate;
    }

    updateCrustFormation(snowPack, day, dayIndex) {
        const crustParams = this.params.crustFormation;
        const canFormCrust = day.temperature < crustParams.tempThreshold &&
                           day.precipitation === 0 &&
                           day.wind_speed < crustParams.windThreshold;
       
        if (canFormCrust) {
            if (!snowPack.hasCrust) {
                snowPack.hasCrust = true;
                snowPack.crustDepth = 0.1;
            } else {
                snowPack.crustDepth = Math.min(2.0, snowPack.crustDepth + 0.1);
            }
        } else {
            if (day.precipitation > 1 || day.temperature > 0) {
                snowPack.hasCrust = false;
                snowPack.crustDepth = 0;
            }
        }
    }

    getTemperatureCategory(temp) {
        if (temp < -20) return 'very_cold';
        if (temp < -10) return 'cold';
        if (temp < -2) return 'medium';
        if (temp <= 0) return 'wet';
        return 'very_wet';
    }

    getWindCategory(windSpeed) {
        if (windSpeed < 2) return 'calm';
        if (windSpeed < 5) return 'light';
        if (windSpeed < 10) return 'moderate';
        return 'strong';
    }

    // 📊 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ СТАТИСТИКИ
    calculatePrecipitationVariance(weatherHistory) {
        const precipitations = weatherHistory.map(day => day.precipitation).filter(p => p > 0);
        if (precipitations.length < 2) return 0;
        const mean = precipitations.reduce((a, b) => a + b) / precipitations.length;
        const variance = precipitations.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / precipitations.length;
        return Math.min(1, variance / mean);
    }

    calculateTemperatureSwings(weatherHistory) {
        let swings = 0;
        for (let i = 1; i < weatherHistory.length; i++) {
            swings += Math.abs(weatherHistory[i].temperature - weatherHistory[i-1].temperature);
        }
        return Math.min(10, swings / (weatherHistory.length - 1)) / 10;
    }

    calculateTemperatureRange(weatherHistory) {
        const temps = weatherHistory.map(day => day.temperature);
        const min = Math.min(...temps);
        const max = Math.max(...temps);
        return Math.min(1, (max - min) / 30);
    }

    async getWeatherHistory(lat, lon, startDate, endDate) {
        try {
            const response = await axios.get(this.openMeteoURL, {
                params: {
                    latitude: lat,
                    longitude: lon,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
                    timezone: 'auto'
                }
            });

            return this.formatWeatherData(response.data);
        } catch (error) {
            console.error('Weather history error:', error);
            throw new Error('Не удалось получить историю погоды');
        }
    }

    formatWeatherData(apiData) {
        return apiData.daily.time.map((date, index) => ({
            date: date,
            temperature: (apiData.daily.temperature_2m_max[index] + apiData.daily.temperature_2m_min[index]) / 2,
            temperature_min: apiData.daily.temperature_2m_min[index],
            temperature_max: apiData.daily.temperature_2m_max[index],
            precipitation: apiData.daily.precipitation_sum[index],
            wind_speed: apiData.daily.wind_speed_10m_max[index],
            humidity: 80
        }));
    }
}

module.exports = ProbabilisticSnowCalculator;
