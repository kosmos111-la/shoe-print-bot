const { createCanvas } = require('canvas');

class WeatherGraph {
    constructor() {
        this.colors = {
            background: '#0f172a',
            grid: '#1e293b',
            text: '#f1f5f9',
            textMuted: '#94a3b8',
            // Цвета для разных времен суток (для одной линии)
            morning: '#f59e0b',      // утро (6:00-11:59) - оранжевый
            day: '#f97316',          // день (12:00-17:59) - ярко-оранжевый
            evening: '#8b5cf6',      // вечер (18:00-21:59) - фиолетовый
            night: '#3b82f6',        // ночь (22:00-5:59) - синий
            precipitation: '#06b6d4',
            forecastPrecip: '#a855f7',
            zeroLine: '#10b981',
            separator: '#ef4444'
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
       
        // Рисуем ОДНУ линию температуры с цветами по времени суток
        this.drawTemperatureLineWithTimeColors(ctx, allDays, graphWidth, graphHeight, ranges);
       
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
            // Группируем по дням и времени суток
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
                        hours: [],
                        precipitation: 0,
                        type: 'history'
                    });
                }
               
                const dayData = daysMap.get(date);
                dayData.hours.push({
                    time: hourNum,
                    temp: hour.temperature,
                    timeOfDay: timeOfDay
                });
                dayData.precipitation += hour.precipitation || 0;
            });
           
            // Для каждого дня выбираем среднюю температуру по времени суток
            const sortedDays = Array.from(daysMap.values()).sort((a, b) => {
                return new Date(a.date) - new Date(b.date);
            });
           
            sortedDays.forEach(day => {
                // Группируем часы по времени суток
                const morningHours = day.hours.filter(h => h.timeOfDay === 'morning');
                const dayHours = day.hours.filter(h => h.timeOfDay === 'day');
                const eveningHours = day.hours.filter(h => h.timeOfDay === 'evening');
                const nightHours = day.hours.filter(h => h.timeOfDay === 'night');
               
                const morningTemp = morningHours.length > 0 ?
                    morningHours.reduce((sum, h) => sum + h.temp, 0) / morningHours.length : null;
                const dayTemp = dayHours.length > 0 ?
                    dayHours.reduce((sum, h) => sum + h.temp, 0) / dayHours.length : null;
                const eveningTemp = eveningHours.length > 0 ?
                    eveningHours.reduce((sum, h) => sum + h.temp, 0) / eveningHours.length : null;
                const nightTemp = nightHours.length > 0 ?
                    nightHours.reduce((sum, h) => sum + h.temp, 0) / nightHours.length : null;
               
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
       
        // Если нет почасовых данных, используем дневные/ночные
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
       
        // Добавляем прогноз
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
            const separatorX = (historyCount - 1) * stepX;
           
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

    // 🔥 ОСНОВНОЕ ИЗМЕНЕНИЕ: ОДНА ЛИНИЯ С РАЗНЫМИ ЦВЕТАМИ
    drawTemperatureLineWithTimeColors(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
       
        // Создаем массив всех точек с привязкой ко времени суток
        const allPoints = [];
       
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const day = allDays[i];
           
            // Добавляем точки в порядке: утро, день, вечер, ночь
            const points = [
                { temp: day.morning_temp, timeOfDay: 'morning', offset: -12, label: '🌅' },
                { temp: day.day_temp, timeOfDay: 'day', offset: 0, label: '☀️' },
                { temp: day.evening_temp, timeOfDay: 'evening', offset: 12, label: '🌆' },
                { temp: day.night_temp, timeOfDay: 'night', offset: 24, label: '🌙' }
            ];
           
            points.forEach(point => {
                if (point.temp !== null && point.temp !== undefined) {
                    allPoints.push({
                        x: x + point.offset,
                        y: height - ((point.temp - ranges.minTemp) / ranges.tempRange) * height,
                        temp: point.temp,
                        timeOfDay: point.timeOfDay,
                        label: point.label,
                        dateIndex: i,
                        date: day.date
                    });
                }
            });
        }
       
        // Сортируем точки по x координате
        allPoints.sort((a, b) => a.x - b.x);
       
        // Рисуем линию с изменяющимся цветом
        if (allPoints.length > 1) {
            for (let i = 0; i < allPoints.length - 1; i++) {
                const p1 = allPoints[i];
                const p2 = allPoints[i + 1];
               
                // Выбираем цвет для сегмента (по времени суток первой точки)
                let color;
                switch(p1.timeOfDay) {
                    case 'morning': color = this.colors.morning; break;
                    case 'day': color = this.colors.day; break;
                    case 'evening': color = this.colors.evening; break;
                    default: color = this.colors.night;
                }
               
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
       
        // Сохраняем точки для последующей отрисовки маркеров
        this.temperaturePoints = allPoints;
    }

    drawPrecipitationBars(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
        const barWidth = stepX * 0.6;
        const maxBarHeight = height * 0.35;
       
        for (let i = 0; i < allDays.length; i++) {
            const precip = allDays[i].precipitation;
            if (precip > 0) {
                const x = i * stepX - barWidth / 2;
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
       
        // Рисуем маркеры для каждой точки
        this.temperaturePoints.forEach(point => {
            let color;
            switch(point.timeOfDay) {
                case 'morning': color = this.colors.morning; break;
                case 'day': color = this.colors.day; break;
                case 'evening': color = this.colors.evening; break;
                default: color = this.colors.night;
            }
           
            ctx.fillStyle = color;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 7, 0, 2 * Math.PI);
            ctx.fill();
           
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 7, 0, 2 * Math.PI);
            ctx.stroke();
           
            // Подпись температуры
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "Segoe UI", Arial';
            ctx.fillText(`${Math.round(point.temp)}°`, point.x - 12, point.y - 10);
           
            // Иконка времени суток
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px "Segoe UI", Arial';
            ctx.fillText(point.label, point.x - 6, point.y + 12);
        });
    }

    drawLabels(ctx, allDays, width, height) {
        const stepX = width / (allDays.length - 1);
       
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const dateParts = allDays[i].date.split(' ');
            const dayOfWeek = dateParts[0];
            const dayNum = dateParts[1]?.replace(',', '') || '';
           
            ctx.fillStyle = this.colors.text;
            ctx.font = 'bold 13px "Segoe UI", Arial';
            ctx.fillText(dayOfWeek, x - 20, height + 30);
           
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '12px "Segoe UI", Arial';
            ctx.fillText(dayNum, x - 12, height + 50);
           
            if (allDays[i].type === 'forecast') {
                ctx.fillStyle = this.colors.forecastPrecip;
                ctx.font = '9px "Segoe UI", Arial';
                ctx.fillText('🔮 прогноз', x - 18, height + 75);
            } else if (allDays[i].type === 'history' && i === 0) {
                ctx.fillStyle = this.colors.precipitation;
                ctx.font = '9px "Segoe UI", Arial';
                ctx.fillText('📊 история', x - 16, height + 75);
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
        ctx.fillText(`Актуально на ${today} | История 7 дней + прогноз 2 дня | Почасовые данные`, 40, topMargin - 15);
       
        ctx.restore();
    }

    drawLegend(ctx, width, topMargin) {
        ctx.save();
       
        const startX = width - 320;
        const startY = topMargin - 40;
       
        ctx.font = 'bold 12px "Segoe UI", Arial';
        ctx.fillStyle = this.colors.text;
        ctx.fillText('📖 ТЕМПЕРАТУРА ПО ВРЕМЕНИ СУТОК:', startX, startY);
       
        const times = [
            { color: this.colors.morning, label: '🌅 Утро (6:00-11:59)', y: startY + 22, symbol: '●' },
            { color: this.colors.day, label: '☀️ День (12:00-17:59)', y: startY + 44, symbol: '●' },
            { color: this.colors.evening, label: '🌆 Вечер (18:00-21:59)', y: startY + 66, symbol: '●' },
            { color: this.colors.night, label: '🌙 Ночь (22:00-5:59)', y: startY + 88, symbol: '●' }
        ];
       
        times.forEach(time => {
            ctx.fillStyle = time.color;
            ctx.beginPath();
            ctx.arc(startX + 12, time.y - 2, 6, 0, 2 * Math.PI);
            ctx.fill();
           
            ctx.fillStyle = this.colors.text;
            ctx.font = '11px "Segoe UI", Arial';
            ctx.fillText(time.label, startX + 28, time.y);
        });
       
        // Добавляем пояснение про одну линию
        ctx.fillStyle = this.colors.textMuted;
        ctx.font = '10px "Segoe UI", Arial';
        ctx.fillText('🎨 Линия меняет цвет в зависимости от времени суток', startX, startY + 125);
        ctx.fillText('📈 Одна непрерывная линия температуры в течение дня', startX, startY + 145);
       
        ctx.restore();
    }
}

module.exports = { WeatherGraph };
