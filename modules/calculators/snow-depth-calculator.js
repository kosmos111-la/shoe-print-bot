const axios = require('axios');

class SnowDepthCalculator {
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

    async calculateSnowDepth(lat, lon, disappearanceTime) {
        try {
            const now = new Date();
            const disappearanceDate = new Date(disappearanceTime);
           
            console.log(`🔍 Расчет снега с ${disappearanceDate} по ${now}`);

            const weatherHistory = await this.getWeatherHistory(
                lat, lon,
                disappearanceDate,
                now
            );

            if (!weatherHistory || weatherHistory.length === 0) {
                throw new Error('Не удалось получить данные погоды за период');
            }

            const snowEvolution = this.calculateSnowEvolution(weatherHistory);
            const currentSnow = snowEvolution[snowEvolution.length - 1];
            const warnings = this.analyzeDangers(snowEvolution);

            return {
                success: true,
                disappearanceTime: disappearanceDate.toISOString(),
                calculationTime: now.toISOString(),
                location: { lat, lon },
                periodDays: weatherHistory.length,
               
                estimatedSnowDepth: Math.round(currentSnow.totalDepth * 10) / 10,
                freshSnowDepth: Math.round(currentSnow.freshSnow * 10) / 10,
                compaction: Math.round(currentSnow.compaction * 10) / 10,
               
                totalPrecipitation: Math.round(snowEvolution.reduce((sum, day) => sum + day.precipitation, 0) * 10) / 10,
                totalCompaction: Math.round(snowEvolution.reduce((sum, day) => sum + day.compaction, 0) * 10) / 10,
                totalEvaporation: Math.round(snowEvolution.reduce((sum, day) => sum + day.evaporation, 0) * 10) / 10,
               
                warnings: warnings,
                hasCrust: currentSnow.hasCrust,
                crustDepth: Math.round(currentSnow.crustDepth * 10) / 10
            };

        } catch (error) {
            console.error('Snow calculation error:', error);
            return {
                success: false,
                error: `Ошибка расчета: ${error.message}`
            };
        }
    }

    calculateSnowEvolution(weatherHistory) {
        let snowPack = {
            totalDepth: 0,
            freshSnow: 0,
            compaction: 0,
            hasCrust: false,
            crustDepth: 0
        };

        const evolution = [];

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

            this.updateCrustFormation(snowPack, day, index);

            evolution.push({
                date: day.date,
                precipitation: day.precipitation,
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

    analyzeDangers(snowEvolution) {
        const warnings = [];
        const current = snowEvolution[snowEvolution.length - 1];

        if (current.hasCrust) {
            warnings.push({
                type: 'CRUST_WARNING',
                level: current.crustDepth > 1 ? 'HIGH' : 'MEDIUM',
                message: `⚠️ Образовался наст толщиной ${current.crustDepth.toFixed(1)} см`
            });
        }

        const hasThaw = snowEvolution.some(day => day.melting > 0);
        if (hasThaw) {
            warnings.push({
                type: 'THAW_WARNING',
                level: 'MEDIUM',
                message: 'За период были положительные температуры'
            });
        }

        const heavySnowDays = snowEvolution.filter(day => day.freshSnow > 10).length;
        if (heavySnowDays > 0) {
            warnings.push({
                type: 'HEAVY_SNOW_WARNING',
                level: 'HIGH',
                message: `Было ${heavySnowDays} дней с сильным снегопадом`
            });
        }

        return warnings;
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

module.exports = SnowDepthCalculator;
