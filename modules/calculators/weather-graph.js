const { createCanvas } = require('canvas');

class WeatherGraph {
    constructor() {
        this.colors = {
            background: '#0f172a',
            grid: '#1e293b',
            text: '#f1f5f9',
            textMuted: '#94a3b8',
            temperature: '#f97316',
            precipitation: '#06b6d4',
            forecastPrecip: '#a855f7',
            zeroLine: '#10b981',
            separator: '#ef4444',
            timeDivider: '#334155',
            snow: '#7dd3fc',
            dayBandEven: 'rgba(255, 255, 255, 0.07)',
            dayBandOdd: 'rgba(0, 0, 0, 0.06)',
            dayBoundary: 'rgba(51, 65, 85, 0.3)',
            cloudLight: 'rgba(148, 163, 184, 0.3)',
            cloudMid: 'rgba(100, 116, 139, 0.5)',
            cloudHeavy: 'rgba(51, 65, 85, 0.7)'
        };
    }

    async generateWeatherGraph(history, forecast, location, hourlyPrecipitation = null, snowData = null, sunTimes = null) {
        const allDays = await this.prepareDataWithHourly(history, forecast, hourlyPrecipitation);
        if (allDays.length === 0) return null;

        const canvas = createCanvas(1800, 1200);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, 200);

        const margins = {
            top: 100,
            right: 100,
            bottom: 140,
            left: 80
        };

        const graphWidth = canvas.width - margins.left - margins.right;
        const graphHeight = canvas.height - margins.top - margins.bottom;

        const ranges = this.calculateRanges(allDays);

        ctx.save();
        ctx.translate(margins.left, margins.top);

        this.drawDayBands(ctx, allDays, graphWidth, graphHeight);
        this.drawDayNight(ctx, allDays, graphWidth, graphHeight, sunTimes);
        this.drawGrid(ctx, graphWidth, graphHeight, ranges);
        this.drawSeparator(ctx, allDays, graphWidth, graphHeight);
        this.drawSmoothTemperatureLine(ctx, allDays, graphWidth, graphHeight, ranges);
        this.drawTimeDividers(ctx, allDays, graphWidth, graphHeight);
        this.drawPrecipitationBars(ctx, allDays, graphWidth, graphHeight, ranges, hourlyPrecipitation);
        this.drawSnowLayer(ctx, allDays, snowData, graphWidth, graphHeight, ranges);
        this.drawCloudBand(ctx, allDays, graphWidth, graphHeight, hourlyPrecipitation);
        this.drawTemperaturePoints(ctx, graphWidth, graphHeight);
        this.drawLabels(ctx, allDays, graphWidth, graphHeight);
        this.drawHeader(ctx, canvas.width, margins.top, location);
        

        ctx.restore();

        return canvas.toBuffer();
    }

    async prepareDataWithHourly(history, forecast, hourlyData) {
        const allDays = [];

        if (hourlyData && hourlyData.length > 0) {
            const daysMap = new Map();

            hourlyData.forEach(hour => {
                const date = hour.date;
                const hourNum = hour.hour;
                let timeOfDay;

                if (hourNum >= 6 && hourNum < 12) timeOfDay = 'morning';
                else if (hourNum >= 12 && hourNum < 18) timeOfDay = 'day';
                else if (hourNum >= 18 && hourNum < 22) timeOfDay = 'evening';
                else timeOfDay = 'night';

                if (!daysMap.has(date)) {
                    daysMap.set(date, {
                        date: date,
                        morning: [],
                        day: [],
                        evening: [],
                        night: [],
                        precipitation: 0,
                        type: 'history'
                    });
                }

                const dayData = daysMap.get(date);
                dayData[timeOfDay].push(hour.temperature);
                dayData.precipitation += hour.precipitation || 0;
            });

            const sortedDays = Array.from(daysMap.values()).sort((a, b) => {
                return new Date(a.date) - new Date(b.date);
            });

            sortedDays.forEach(day => {
                const morningTemp = day.morning.length > 0 ?
                    day.morning.reduce((sum, t) => sum + t, 0) / day.morning.length : null;
                const dayTemp = day.day.length > 0 ?
                    day.day.reduce((sum, t) => sum + t, 0) / day.day.length : null;
                const eveningTemp = day.evening.length > 0 ?
                    day.evening.reduce((sum, t) => sum + t, 0) / day.evening.length : null;
                const nightTemp = day.night.length > 0 ?
                    day.night.reduce((sum, t) => sum + t, 0) / day.night.length : null;

                allDays.push({
                    date: day.date,
                    morning_temp: morningTemp,
                    day_temp: dayTemp,
                    evening_temp: eveningTemp,
                    night_temp: nightTemp,
                    precipitation: day.precipitation,
                    type: 'history'
                });
            });
        }

        if (allDays.length === 0 && history && history.length > 0) {
            const last7Days = history.slice(-7);
            last7Days.forEach((day) => {
                allDays.push({
                    date: day.date,
                    morning_temp: day.night_temp,
                    day_temp: day.day_temp,
                    evening_temp: day.day_temp,
                    night_temp: day.night_temp,
                    precipitation: day.precipitation || 0,
                    wind_speed: day.wind_speed,
                    type: 'history'
                });
            });
        }

        if (forecast && forecast.length > 0) {
            forecast.forEach((day) => {
                allDays.push({
                    date: day.date,
                    morning_temp: day.night_temp,
                    day_temp: day.day_temp,
                    evening_temp: day.day_temp,
                    night_temp: day.night_temp,
                    precipitation: day.precipitation || 0,
                    type: 'forecast'
                });
            });
        }

        return allDays;
    }

    calculateRanges(allDays) {
        const allTemps = [];
        allDays.forEach(day => {
            if (day.morning_temp !== null) allTemps.push(day.morning_temp);
            if (day.day_temp !== null) allTemps.push(day.day_temp);
            if (day.evening_temp !== null) allTemps.push(day.evening_temp);
            if (day.night_temp !== null) allTemps.push(day.night_temp);
        });

        let minTemp, maxTemp;
        if (allTemps.length === 0) {
            minTemp = -30;
            maxTemp = 30;
        } else {
            const rawMin = Math.min(...allTemps);
            const rawMax = Math.max(...allTemps);
            // динамическая шкала: шаг 5°C, запас ±5°C, минимум диапазон 15°C
            minTemp = Math.round(rawMin / 5) * 5 - 5;
            maxTemp = Math.round(rawMax / 5) * 5 + 5;
            if (maxTemp - minTemp < 15) {
                const need = 15 - (maxTemp - minTemp);
                minTemp -= Math.ceil(need / 2 / 5) * 5;
                maxTemp += Math.ceil(need / 2 / 5) * 5;
            }
        }

        const maxPrecip = Math.max(...allDays.map(d => d.precipitation), 10);

        return {
            maxTemp: maxTemp,
            minTemp: minTemp,
            tempRange: maxTemp - minTemp,
            maxPrecip: maxPrecip
        };
    }

    drawGrid(ctx, width, height, ranges) {
        ctx.save();

        const stepX = width / 10;
        for (let i = 0; i <= 10; i++) {
            const x = i * stepX;
            ctx.beginPath();
            ctx.strokeStyle = this.colors.grid;
            ctx.lineWidth = 0.5;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // горизонтальные линии — каждые 5°C по динамической шкале
        for (let temp = ranges.minTemp; temp <= ranges.maxTemp; temp += 5) {
            const y = height - ((temp - ranges.minTemp) / ranges.tempRange) * height;

            ctx.beginPath();
            ctx.strokeStyle = this.colors.grid;
            ctx.lineWidth = 0.5;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();

            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '12px "Segoe UI", Arial';
            ctx.fillText(`${temp}°C`, -35, y + 4);
        }

        // нулевая линия — только если 0°C внутри шкалы
        if (ranges.minTemp <= 0 && ranges.maxTemp >= 0) {
            const zeroY = height - ((0 - ranges.minTemp) / ranges.tempRange) * height;
            ctx.beginPath();
            ctx.strokeStyle = this.colors.zeroLine;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.moveTo(0, zeroY);
            ctx.lineTo(width, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    drawSeparator(ctx, allDays, width, height) {
        const historyCount = allDays.filter(d => d.type === 'history').length;
        const forecastCount = allDays.filter(d => d.type === 'forecast').length;

        if (historyCount > 0 && forecastCount > 0) {
            const totalPoints = allDays.length * 4;
            const stepX = width / (totalPoints - 1);
            const separatorIndex = historyCount * 4 - 2;
            const separatorX = separatorIndex * stepX;

            ctx.beginPath();
            ctx.strokeStyle = this.colors.separator;
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.moveTo(separatorX, 0);
            ctx.lineTo(separatorX, height);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = this.colors.separator;
            ctx.font = 'bold 11px "Segoe UI", Arial';
            ctx.fillText('📊 ИСТОРИЯ →', separatorX - 70, height + 25);
            ctx.fillText('← ПРОГНОЗ 🔮', separatorX + 10, height + 25);
        }
    }

    drawSmoothTemperatureLine(ctx, allDays, width, height, ranges) {
        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);
        const points = [];

        for (let dayIndex = 0; dayIndex < allDays.length; dayIndex++) {
            const day = allDays[dayIndex];
            const baseIndex = dayIndex * 4;

            const temps = [
                { temp: day.morning_temp, label: 'morning' },
                { temp: day.day_temp, label: 'day' },
                { temp: day.evening_temp, label: 'evening' },
                { temp: day.night_temp, label: 'night' }
            ];

            temps.forEach((t, idx) => {
                if (t.temp !== null && t.temp !== undefined) {
                    const pointIndex = baseIndex + idx;
                    const x = pointIndex * stepX;
                    const y = height - ((t.temp - ranges.minTemp) / ranges.tempRange) * height;
                    points.push({ x, y, temp: t.temp });
                }
            });
        }

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length - 1; i++) {
                const p0 = points[i - 1];
                const p1 = points[i];
                const p2 = points[i + 1];

                const cp1x = p1.x - (p2.x - p0.x) / 6;
                const cp1y = p1.y - (p2.y - p0.y) / 6;
                const cp2x = p1.x + (p2.x - p0.x) / 6;
                const cp2y = p1.y + (p2.y - p0.y) / 6;

                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
            }

            ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

            // градиент линии по температуре
            const grad = ctx.createLinearGradient(0, height, 0, 0);
            const stops = [
                { t: -30, c: '#1e40af' },
                { t: -10, c: '#38bdf8' },
                { t: 0, c: '#ffffff' },
                { t: 10, c: '#f97316' },
                { t: 30, c: '#ef4444' }
            ];
            const span = ranges.tempRange;
            for (const s of stops) {
                const pos = Math.max(0, Math.min(1, (s.t - ranges.minTemp) / span));
                grad.addColorStop(pos, s.c);
            }

            ctx.strokeStyle = grad;
            ctx.lineWidth = 5;
            ctx.stroke();
        }

        this.temperaturePoints = points;
    }

    drawTimeDividers(ctx, allDays, width, height) {
        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);

        for (let dayIndex = 0; dayIndex < allDays.length; dayIndex++) {
            const baseIndex = dayIndex * 4;

            const dividerPositions = [
                { x: (baseIndex + 0.5) * stepX, label: 'Утро' },
                { x: (baseIndex + 1.5) * stepX, label: 'День' },
                { x: (baseIndex + 2.5) * stepX, label: 'Вечер' }
            ];

            dividerPositions.forEach(divider => {
                if (divider.x >= 0 && divider.x <= width) {
                    ctx.beginPath();
                    ctx.strokeStyle = this.colors.timeDivider;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);
                    ctx.moveTo(divider.x, 0);
                    ctx.lineTo(divider.x, height);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.fillStyle = this.colors.textMuted;
                    ctx.font = '10px "Segoe UI", Arial';
                    ctx.fillText(divider.label, divider.x - 12, height + 12);
                }
            });
        }
    }

    drawPrecipitationBars(ctx, allDays, width, height, ranges, hourlyPrecipitation) {
    const totalPoints = allDays.length * 4;
    const stepX = width / (totalPoints - 1);
    const maxBarHeight = height * 0.35;

    for (let dayIndex = 0; dayIndex < allDays.length; dayIndex++) {
        const baseIndex = dayIndex * 4;
        const dayDate = allDays[dayIndex].date;

        const dayPrecipitations = { morning: 0, day: 0, evening: 0, night: 0 };

        if (hourlyPrecipitation) {
            const dayHours = hourlyPrecipitation.filter(h => h.date === dayDate);
            dayHours.forEach(hour => {
                if (hour.timeOfDay === 'morning') dayPrecipitations.morning += hour.precipitation;
                else if (hour.timeOfDay === 'day') dayPrecipitations.day += hour.precipitation;
                else if (hour.timeOfDay === 'evening') dayPrecipitations.evening += hour.precipitation;
                else if (hour.timeOfDay === 'night') dayPrecipitations.night += hour.precipitation;
            });
        } else {
            const totalPrecip = allDays[dayIndex].precipitation;
            dayPrecipitations.morning = totalPrecip * 0.2;
            dayPrecipitations.day = totalPrecip * 0.4;
            dayPrecipitations.evening = totalPrecip * 0.3;
            dayPrecipitations.night = totalPrecip * 0.1;
        }

        const positions = [
            { time: 'morning', x: (baseIndex + 0.5) * stepX, precip: dayPrecipitations.morning },
            { time: 'day', x: (baseIndex + 1.5) * stepX, precip: dayPrecipitations.day },
            { time: 'evening', x: (baseIndex + 2.5) * stepX, precip: dayPrecipitations.evening },
            { time: 'night', x: (baseIndex + 3.5) * stepX, precip: dayPrecipitations.night }
        ];

        const barWidth = stepX * 0.5;

        positions.forEach(pos => {
            if (pos.precip > 0) {
                const barHeight = (pos.precip / ranges.maxPrecip) * maxBarHeight;
                const x = pos.x - barWidth / 2;
                const y = height - barHeight;

                const gradient = ctx.createLinearGradient(x, y, x + barWidth, y + barHeight);
                if (allDays[dayIndex].type === 'forecast') {
                    gradient.addColorStop(0, '#c084fc');
                    gradient.addColorStop(1, '#a855f7');
                } else {
                    gradient.addColorStop(0, '#06b6d4');
                    gradient.addColorStop(1, '#0891b2');
                }

                ctx.fillStyle = gradient;
                ctx.fillRect(x, y, barWidth, barHeight);

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, barWidth, barHeight);

                // 🔥 УБРАНО УСЛОВИЕ: показываем подписи для всех осадков
                ctx.fillStyle = this.colors.text;
                ctx.font = '9px "Segoe UI", Arial';
                ctx.fillText(`${pos.precip.toFixed(1)}мм`, x + barWidth / 2 - 14, y - 5);
            }
        });
    }
}

    drawSnowLayer(ctx, allDays, snowData, width, height, ranges) {
        if (!snowData || snowData.length === 0) return;

        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);
        const maxSnowDepth = Math.max(...snowData.map(s => s.snowDepth), 50);
        const maxSnowHeight = height * 0.25;

        for (let dayIndex = 0; dayIndex < allDays.length; dayIndex++) {
            const baseIndex = dayIndex * 4;
            const dayDate = allDays[dayIndex].date;
            const snowForDay = snowData.find(s => s.date === dayDate);
           
            if (!snowForDay || snowForDay.snowDepth <= 0) continue;

            const x = (baseIndex + 1.5) * stepX;
            const barWidth = stepX * 1.2;
            const barHeight = (snowForDay.snowDepth / maxSnowDepth) * maxSnowHeight;
            const y = height - barHeight;

            const gradient = ctx.createLinearGradient(x, y, x + barWidth, y + barHeight);
            gradient.addColorStop(0, '#e0f2fe');
            gradient.addColorStop(1, '#7dd3fc');

            ctx.fillStyle = gradient;
            ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - barWidth / 2, y, barWidth, barHeight);

            ctx.fillStyle = this.colors.text;
            ctx.font = '9px "Segoe UI", Arial';
            ctx.fillText(`${snowForDay.snowDepth} см`, x - barWidth / 2 + 5, y - 3);

            if (snowForDay.snowfall > 0) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px "Segoe UI", Arial';
                ctx.fillText('❄️', x + barWidth / 2 - 10, y - 8);
            }
        }
    }

    drawTemperaturePoints(ctx, width, height) {
        if (!this.temperaturePoints) return;

        this.temperaturePoints.forEach(point => {
            ctx.fillStyle = this.colorForTemp(point.temp);
            ctx.beginPath();
            ctx.arc(point.x, point.y, 7, 0, 2 * Math.PI);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 7, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "Segoe UI", Arial';
            ctx.fillText(`${Math.round(point.temp)}°`, point.x - 10, point.y - 8);
        });
    }

    drawDayBands(ctx, allDays, width, height) {
        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);

        // чередующиеся фоны дней: чётный — светлее, нечётный — темнее
        for (let dayIndex = 0; dayIndex < allDays.length; dayIndex++) {
            const x0 = dayIndex * 4 * stepX;
            const x1 = (dayIndex + 1) * 4 * stepX;
            ctx.fillStyle = (dayIndex % 2 === 0) ? this.colors.dayBandEven : this.colors.dayBandOdd;
            ctx.fillRect(x0, 0, x1 - x0, height);
        }

        // тонкие границы дней
        ctx.strokeStyle = this.colors.dayBoundary;
        ctx.lineWidth = 1;
        for (let dayIndex = 1; dayIndex < allDays.length; dayIndex++) {
            const x = dayIndex * 4 * stepX;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    drawDayNight(ctx, allDays, width, height, sunTimes) {
        // реальные восход/закат из OM, иначе фиксированные 6:00–18:00
        let sunriseH = 6;
        let sunsetH = 18;
        if (sunTimes && sunTimes.sunrise instanceof Date && sunTimes.sunset instanceof Date) {
            const sr = sunTimes.sunrise.getHours();
            const ss = sunTimes.sunset.getHours();
            if (Number.isFinite(sr) && Number.isFinite(ss) && sr < ss) {
                sunriseH = sr;
                sunsetH = ss;
            }
        }

        // середины 4 слотов суток: утро, день, вечер, ночь
        const slotHours = [9, 15, 20, 2];
        const isDay = slotHours.map(h => h >= sunriseH && h <= sunsetH);

        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);

        for (let dayIndex = 0; dayIndex < allDays.length; dayIndex++) {
            const base = dayIndex * 4;
            let lightStart = 4;
            let lightEnd = -1;
            for (let s = 0; s < 4; s++) {
                if (isDay[s]) {
                    if (lightStart === 4) lightStart = s;
                    lightEnd = s;
                }
            }

            const xOf = (slot) => (base + slot) * stepX;

            // тёмный участок до восхода
            if (lightStart > 0) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
                ctx.fillRect(xOf(0), 0, xOf(lightStart) - xOf(0), height);
            }
            // светлый участок от восхода до заката
            if (lightEnd >= lightStart) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.fillRect(xOf(lightStart), 0, xOf(lightEnd + 1) - xOf(lightStart), height);
            }
            // тёмный участок после заката
            if (lightEnd >= 0 && lightEnd < 3) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
                ctx.fillRect(xOf(lightEnd + 1), 0, xOf(4) - xOf(lightEnd + 1), height);
            }
        }
    }

    drawCloudBand(ctx, allDays, width, height, hourlyPrecipitation) {
        if (!hourlyPrecipitation || hourlyPrecipitation.length === 0) return;

        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);
        const bandY = height - 8;
        const bandH = 8;
        const slotNames = ['morning', 'day', 'evening', 'night'];

        const colorForCloud = (c) => {
            if (c < 20) return null;
            if (c < 50) return this.colors.cloudLight;
            if (c < 80) return this.colors.cloudMid;
            return this.colors.cloudHeavy;
        };

        for (let dayIndex = 0; dayIndex < allDays.length; dayIndex++) {
            const base = dayIndex * 4;
            const date = allDays[dayIndex].date;
            const dayHours = hourlyPrecipitation.filter(h => h.date === date);
            if (dayHours.length === 0) continue;

            for (let s = 0; s < 4; s++) {
                const slotHours = dayHours.filter(h => h.timeOfDay === slotNames[s] && h.cloudiness != null);
                if (slotHours.length === 0) continue;
                const avg = slotHours.reduce((sum, h) => sum + h.cloudiness, 0) / slotHours.length;
                const color = colorForCloud(avg);
                if (!color) continue;

                const x0 = (base + s) * stepX;
                const x1 = (base + s + 1) * stepX;
                ctx.fillStyle = color;
                ctx.fillRect(x0, bandY, x1 - x0, bandH);
            }
        }

        ctx.fillStyle = this.colors.textMuted;
        ctx.font = '10px "Segoe UI", Arial';
        ctx.fillText('☁️ облачность (полоса внизу)', 2, height - 14);
    }

    colorForTemp(temp) {
        const stops = [
            { t: -30, c: '#1e40af' },
            { t: -10, c: '#38bdf8' },
            { t: 0, c: '#ffffff' },
            { t: 10, c: '#f97316' },
            { t: 30, c: '#ef4444' }
        ];
        if (temp <= stops[0].t) return stops[0].c;
        if (temp >= stops[stops.length - 1].t) return stops[stops.length - 1].c;
        for (let i = 0; i < stops.length - 1; i++) {
            const a = stops[i];
            const b = stops[i + 1];
            if (temp >= a.t && temp <= b.t) {
                return this._lerpHex(a.c, b.c, (temp - a.t) / (b.t - a.t));
            }
        }
        return stops[0].c;
    }

    _lerpHex(c1, c2, f) {
        const p1 = [parseInt(c1.slice(1, 3), 16), parseInt(c1.slice(3, 5), 16), parseInt(c1.slice(5, 7), 16)];
        const p2 = [parseInt(c2.slice(1, 3), 16), parseInt(c2.slice(3, 5), 16), parseInt(c2.slice(5, 7), 16)];
        const ch = (i) => Math.round(p1[i] + (p2[i] - p1[i]) * f).toString(16).padStart(2, '0');
        return `#${ch(0)}${ch(1)}${ch(2)}`;
    }

    drawLabels(ctx, allDays, width, height) {
        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);

        for (let dayIndex = 0; dayIndex < allDays.length; dayIndex++) {
            const baseIndex = dayIndex * 4;
            const x = (baseIndex + 1.5) * stepX;

            const dateParts = allDays[dayIndex].date.split(' ');
            const dayOfWeek = dateParts[0];
            const dayNum = dateParts[1]?.replace(',', '') || '';

            ctx.fillStyle = this.colors.text;
            ctx.font = 'bold 13px "Segoe UI", Arial';
            ctx.fillText(dayOfWeek, x - 20, height + 45);

            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '12px "Segoe UI", Arial';
            ctx.fillText(dayNum, x - 12, height + 65);

            if (allDays[dayIndex].type === 'forecast') {
                ctx.fillStyle = this.colors.forecastPrecip;
                ctx.font = '9px "Segoe UI", Arial';
                ctx.fillText('🔮 прогноз', x - 18, height + 90);
            } else if (allDays[dayIndex].type === 'history' && dayIndex === 0) {
                ctx.fillStyle = this.colors.precipitation;
                ctx.font = '9px "Segoe UI", Arial';
                ctx.fillText('📊 история', x - 16, height + 90);
            }
        }
    }

    drawHeader(ctx, width, topMargin, location) {
        ctx.save();

        ctx.font = 'bold 28px "Segoe UI", Arial';
        ctx.fillStyle = this.colors.text;
        ctx.fillText(`🌤️ Погода: ${location.toUpperCase()}`, 40, topMargin - 40);

        ctx.font = '14px "Segoe UI", Arial';
        ctx.fillStyle = this.colors.textMuted;
        const today = new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        ctx.fillText(`Актуально на ${today} | История 7 дней + прогноз 2 дня | 4 точки в сутки`, 40, topMargin - 15);

        ctx.restore();
    }



}

module.exports = { WeatherGraph };
