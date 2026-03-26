const { createCanvas } = require('canvas');

class WeatherGraph {
    constructor() {
        this.colors = {
            background: '#0f172a',
            grid: '#1e293b',
            text: '#f1f5f9',
            textMuted: '#94a3b8',
            temperature: '#f97316',      // основной цвет температуры
            precipitation: '#06b6d4',
            forecastPrecip: '#a855f7',
            zeroLine: '#10b981',
            separator: '#ef4444',
            timeDivider: '#334155'       // серый для вертикальных линий
        };
    }

    async generateWeatherGraph(history, forecast, location, hourlyData = null) {
        const allDays = await this.prepareDataWithHourly(history, forecast, hourlyData);
        if (allDays.length === 0) return null;

        const canvas = createCanvas(1800, 1100);
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

        this.drawGrid(ctx, graphWidth, graphHeight, ranges);
        this.drawSeparator(ctx, allDays, graphWidth, graphHeight);
       
        // Рисуем плавную линию температуры (один цвет)
        this.drawSmoothTemperatureLine(ctx, allDays, graphWidth, graphHeight, ranges);
       
        // Рисуем вертикальные линии для разделения времени суток
        this.drawTimeDividers(ctx, allDays, graphWidth, graphHeight);
       
        // Рисуем столбцы осадков
        this.drawPrecipitationBars(ctx, allDays, graphWidth, graphHeight, ranges);
       
        // Рисуем точки температур
        this.drawTemperaturePoints(ctx, allDays, graphWidth, graphHeight, ranges);
       
        this.drawLabels(ctx, allDays, graphWidth, graphHeight);
        this.drawHeader(ctx, canvas.width, margins.top, location);
        this.drawLegend(ctx, canvas.width, margins.top);
       
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
       
        const maxTemp = Math.max(...allTemps, 30);
        const minTemp = Math.min(...allTemps, -20);
        const tempRange = maxTemp - minTemp;
       
        const paddedMax = maxTemp + tempRange * 0.1;
        const paddedMin = minTemp - tempRange * 0.1;
       
        const maxPrecip = Math.max(...allDays.map(d => d.precipitation), 10);
       
        return {
            maxTemp: paddedMax,
            minTemp: paddedMin,
            tempRange: paddedMax - paddedMin,
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
       
        const tempSteps = 10;
        for (let i = 0; i <= tempSteps; i++) {
            const temp = ranges.minTemp + (i / tempSteps) * ranges.tempRange;
            const y = height - ((temp - ranges.minTemp) / ranges.tempRange) * height;
           
            ctx.beginPath();
            ctx.strokeStyle = this.colors.grid;
            ctx.lineWidth = 0.5;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
           
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '12px "Segoe UI", Arial';
            ctx.fillText(`${Math.round(temp)}°C`, -35, y + 4);
        }
       
        const zeroY = height - ((0 - ranges.minTemp) / ranges.tempRange) * height;
        ctx.beginPath();
        ctx.strokeStyle = this.colors.zeroLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.moveTo(0, zeroY);
        ctx.lineTo(width, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);
       
        ctx.restore();
    }

    drawSeparator(ctx, allDays, width, height) {
        const historyCount = allDays.filter(d => d.type === 'history').length;
        const forecastCount = allDays.filter(d => d.type === 'forecast').length;
       
        if (historyCount > 0 && forecastCount > 0) {
            const stepX = width / (allDays.length - 1);
            const separatorX = (historyCount - 1) * stepX + stepX;
           
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

    // Плавная линия температуры (одного цвета)
    drawSmoothTemperatureLine(ctx, allDays, width, height, ranges) {
        const totalPoints = allDays.length * 4; // 4 точки на день
        const stepX = width / (totalPoints - 1);
       
        // Собираем все точки в правильном порядке
        const points = [];
       
        for (let i = 0; i < allDays.length; i++) {
            const day = allDays[i];
            const baseX = i * (width / (allDays.length - 1)) * 4;
           
            // Точки в порядке: утро, день, вечер, ночь
            const temps = [
                { temp: day.morning_temp, label: 'morning' },
                { temp: day.day_temp, label: 'day' },
                { temp: day.evening_temp, label: 'evening' },
                { temp: day.night_temp, label: 'night' }
            ];
           
            temps.forEach((t, idx) => {
                if (t.temp !== null && t.temp !== undefined) {
                    const x = baseX + idx * stepX;
                    const y = height - ((t.temp - ranges.minTemp) / ranges.tempRange) * height;
                    points.push({ x, y, temp: t.temp, timeOfDay: t.label, dateIndex: i });
                }
            });
        }
       
        // Рисуем плавную линию
        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
           
            // Используем квадратичную интерполяцию для плавности
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
           
            ctx.strokeStyle = this.colors.temperature;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
       
        // Сохраняем точки для маркеров
        this.temperaturePoints = points;
    }

    // Вертикальные линии для разделения времени суток
    drawTimeDividers(ctx, allDays, width, height) {
        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);
       
        for (let i = 0; i < allDays.length; i++) {
            const baseX = i * (width / (allDays.length - 1)) * 4;
           
            // Вертикальные линии между утро/день, день/вечер, вечер/ночь
            const dividerPositions = [
                { x: baseX + stepX, label: 'Утро' },
                { x: baseX + stepX * 2, label: 'День' },
                { x: baseX + stepX * 3, label: 'Вечер' }
            ];
           
            dividerPositions.forEach(divider => {
                ctx.beginPath();
                ctx.strokeStyle = this.colors.timeDivider;
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.moveTo(divider.x, 0);
                ctx.lineTo(divider.x, height);
                ctx.stroke();
                ctx.setLineDash([]);
               
                // Подписи времени суток
                ctx.fillStyle = this.colors.textMuted;
                ctx.font = '10px "Segoe UI", Arial';
                ctx.fillText(divider.label, divider.x - 15, height + 12);
            });
        }
    }

    drawPrecipitationBars(ctx, allDays, width, height, ranges) {
        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);
       
        for (let i = 0; i < allDays.length; i++) {
            const baseX = i * (width / (allDays.length - 1)) * 4;
            const barWidth = stepX * 0.8;
            const maxBarHeight = height * 0.35;
            const precip = allDays[i].precipitation;
           
            if (precip > 0) {
                // Центрируем столбец в середине дня
                const x = baseX + stepX * 1.5 - barWidth / 2;
                const barHeight = (precip / ranges.maxPrecip) * maxBarHeight;
                const y = height - barHeight;
               
                const gradient = ctx.createLinearGradient(x, y, x + barWidth, y + barHeight);
                if (allDays[i].type === 'forecast') {
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
               
                ctx.fillStyle = this.colors.text;
                ctx.font = '10px "Segoe UI", Arial';
                ctx.fillText(`${precip.toFixed(1)}мм`, x + barWidth / 2 - 14, y - 5);
            }
        }
    }

    drawTemperaturePoints(ctx, allDays, width, height, ranges) {
        if (!this.temperaturePoints) return;
       
        this.temperaturePoints.forEach(point => {
            ctx.fillStyle = this.colors.temperature;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            ctx.fill();
           
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            ctx.stroke();
           
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "Segoe UI", Arial';
            ctx.fillText(`${Math.round(point.temp)}°`, point.x - 10, point.y - 8);
        });
    }

    drawLabels(ctx, allDays, width, height) {
        const totalPoints = allDays.length * 4;
        const stepX = width / (totalPoints - 1);
       
        for (let i = 0; i < allDays.length; i++) {
            const baseX = i * (width / (allDays.length - 1)) * 4;
            const x = baseX + stepX * 1.5; // Центр дня
           
            const dateParts = allDays[i].date.split(' ');
            const dayOfWeek = dateParts[0];
            const dayNum = dateParts[1]?.replace(',', '') || '';
           
            ctx.fillStyle = this.colors.text;
            ctx.font = 'bold 13px "Segoe UI", Arial';
            ctx.fillText(dayOfWeek, x - 20, height + 45);
           
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '12px "Segoe UI", Arial';
            ctx.fillText(dayNum, x - 12, height + 65);
           
            if (allDays[i].type === 'forecast') {
                ctx.fillStyle = this.colors.forecastPrecip;
                ctx.font = '9px "Segoe UI", Arial';
                ctx.fillText('🔮 прогноз', x - 18, height + 90);
            } else if (allDays[i].type === 'history' && i === 0) {
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

    drawLegend(ctx, width, topMargin) {
        ctx.save();
       
        const startX = width - 320;
        const startY = topMargin - 40;
       
        ctx.font = 'bold 12px "Segoe UI", Arial';
        ctx.fillStyle = this.colors.text;
        ctx.fillText('📖 ЛЕГЕНДА:', startX, startY);
       
        // Температура
        ctx.fillStyle = this.colors.temperature;
        ctx.beginPath();
        ctx.arc(startX + 12, startY + 20, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = this.colors.text;
        ctx.font = '11px "Segoe UI", Arial';
        ctx.fillText('Температура (плавная линия)', startX + 28, startY + 24);
       
        // Вертикальные линии
        ctx.beginPath();
        ctx.strokeStyle = this.colors.timeDivider;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(startX + 12, startY + 44);
        ctx.lineTo(startX + 24, startY + 44);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Разделение времени суток', startX + 32, startY + 48);
       
        // Осадки
        ctx.fillStyle = this.colors.precipitation;
        ctx.fillRect(startX + 12, startY + 66, 12, 12);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Осадки (история)', startX + 32, startY + 78);
       
        ctx.fillStyle = this.colors.forecastPrecip;
        ctx.fillRect(startX + 12, startY + 94, 12, 12);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Осадки (прогноз)', startX + 32, startY + 106);
       
        ctx.fillStyle = this.colors.textMuted;
        ctx.font = '10px "Segoe UI", Arial';
        ctx.fillText('⏰ 4 точки в сутки: Утро, День, Вечер, Ночь', startX, startY + 130);
        ctx.fillText('📈 Плавная линия температуры', startX, startY + 148);
       
        ctx.restore();
    }
}

module.exports = { WeatherGraph };
