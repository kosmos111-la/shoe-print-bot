// shoe-print-bot/modules/calculators/weather-graph.js

const { createCanvas } = require('canvas');

class WeatherGraph {
    constructor() {
        // Цветовая схема
        this.colors = {
            background: '#0f172a',
            grid: '#1e293b',
            text: '#f1f5f9',
            textMuted: '#94a3b8',
            dayTemp: '#f97316',
            nightTemp: '#3b82f6',
            precipitation: '#06b6d4',
            forecast: '#a855f7',
            zeroLine: '#10b981',
            warning: '#ef4444'
        };
    }

    // Основной метод генерации графика
    async generateWeatherGraph(history, forecast, location) {
        // Подготовка данных
        const allDays = this.prepareData(history, forecast);
        if (allDays.length === 0) return null;

        // Создаем холст 1200x800
        const canvas = createCanvas(1200, 800);
        const ctx = canvas.getContext('2d');

        // Заливка фона
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Рисуем декоративный градиент вверху
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, 200);

        // Настройки отступов
        const margins = {
            top: 80,
            right: 80,
            bottom: 100,
            left: 80
        };

        const graphWidth = canvas.width - margins.left - margins.right;
        const graphHeight = canvas.height - margins.top - margins.bottom;

        // Находим диапазоны значений
        const ranges = this.calculateRanges(allDays);
       
        // Рисуем график
        ctx.save();
        ctx.translate(margins.left, margins.top);

        // 1. Рисуем сетку
        this.drawGrid(ctx, graphWidth, graphHeight, ranges);
       
        // 2. Рисуем линии температур
        this.drawTemperatureLines(ctx, allDays, graphWidth, graphHeight, ranges);
       
        // 3. Рисуем столбцы осадков
        this.drawPrecipitationBars(ctx, allDays, graphWidth, graphHeight, ranges);
       
        // 4. Рисуем точки температур
        this.drawTemperaturePoints(ctx, allDays, graphWidth, graphHeight, ranges);
       
        // 5. Подписи
        this.drawLabels(ctx, allDays, graphWidth, graphHeight, ranges);
       
        // 6. Заголовок и легенда
        this.drawHeader(ctx, canvas.width, margins.top, location);
        this.drawLegend(ctx, canvas.width, margins.top);
       
        ctx.restore();

        // Возвращаем буфер изображения
        return canvas.toBuffer();
    }

    // Подготовка данных
    prepareData(history, forecast) {
        const allDays = [];
       
        // Добавляем историю (последние 7 дней)
        if (history && history.length > 0) {
            const last7Days = history.slice(-7);
            last7Days.forEach(day => {
                allDays.push({
                    date: day.date,
                    fullDate: day.date,
                    day_temp: day.day_temp,
                    night_temp: day.night_temp,
                    precipitation: day.precipitation || 0,
                    wind_speed: day.wind_speed,
                    type: 'history'
                });
            });
        }
       
        // Добавляем прогноз
        if (forecast && forecast.length > 0) {
            forecast.forEach(day => {
                allDays.push({
                    date: day.date,
                    fullDate: day.date,
                    day_temp: day.day_temp,
                    night_temp: day.night_temp,
                    precipitation: day.precipitation || 0,
                    type: 'forecast'
                });
            });
        }
       
        return allDays;
    }

    // Расчет диапазонов
    calculateRanges(allDays) {
        const dayTemps = allDays.map(d => d.day_temp);
        const nightTemps = allDays.map(d => d.night_temp);
        const allTemps = [...dayTemps, ...nightTemps];
       
        const maxTemp = Math.max(...allTemps, 25);
        const minTemp = Math.min(...allTemps, -15);
        const tempRange = maxTemp - minTemp;
       
        // Добавляем отступы для комфортного отображения
        const paddedMax = maxTemp + tempRange * 0.1;
        const paddedMin = minTemp - tempRange * 0.1;
       
        const maxPrecip = Math.max(...allDays.map(d => d.precipitation), 5);
       
        return {
            maxTemp: paddedMax,
            minTemp: paddedMin,
            tempRange: paddedMax - paddedMin,
            maxPrecip: maxPrecip
        };
    }

    // Рисуем сетку
    drawGrid(ctx, width, height, ranges) {
        ctx.save();
       
        // Вертикальные линии
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
       
        // Горизонтальные линии температуры
        const tempSteps = 8;
        for (let i = 0; i <= tempSteps; i++) {
            const temp = ranges.minTemp + (i / tempSteps) * ranges.tempRange;
            const y = height - ((temp - ranges.minTemp) / ranges.tempRange) * height;
           
            ctx.beginPath();
            ctx.strokeStyle = this.colors.grid;
            ctx.lineWidth = 0.5;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
           
            // Подписи температуры
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '12px "Segoe UI", Arial';
            ctx.fillText(`${Math.round(temp)}°C`, -35, y + 4);
        }
       
        // Линия нуля
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

    // Рисуем линии температур
    drawTemperatureLines(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
       
        // Дневная температура
        ctx.beginPath();
        ctx.strokeStyle = this.colors.dayTemp;
        ctx.lineWidth = 3;
       
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const y = height - ((allDays[i].day_temp - ranges.minTemp) / ranges.tempRange) * height;
           
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
       
        // Ночная температура
        ctx.beginPath();
        ctx.strokeStyle = this.colors.nightTemp;
        ctx.lineWidth = 3;
       
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const y = height - ((allDays[i].night_temp - ranges.minTemp) / ranges.tempRange) * height;
           
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
       
        // Заливка между линиями
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const yDay = height - ((allDays[i].day_temp - ranges.minTemp) / ranges.tempRange) * height;
            const yNight = height - ((allDays[i].night_temp - ranges.minTemp) / ranges.tempRange) * height;
           
            if (i === 0) {
                ctx.moveTo(x, yDay);
                ctx.lineTo(x, yNight);
            } else {
                ctx.lineTo(x, yDay);
                ctx.lineTo(x, yNight);
            }
        }
        ctx.fillStyle = this.colors.precipitation;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Рисуем столбцы осадков
    drawPrecipitationBars(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
        const barWidth = stepX * 0.5;
        const maxBarHeight = height * 0.25;
       
        for (let i = 0; i < allDays.length; i++) {
            const precip = allDays[i].precipitation;
            if (precip > 0) {
                const x = i * stepX - barWidth / 2;
                const barHeight = (precip / ranges.maxPrecip) * maxBarHeight;
                const y = height - barHeight;
               
                // Градиент для столбцов
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
               
                // Обводка
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, barWidth, barHeight);
               
                // Подпись осадков
                ctx.fillStyle = this.colors.text;
                ctx.font = '10px "Segoe UI", Arial';
                ctx.fillText(`${precip.toFixed(1)}мм`, x + barWidth / 2 - 12, y - 5);
            }
        }
    }

    // Рисуем точки температур
    drawTemperaturePoints(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
       
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
           
            // Дневная температура
            const yDay = height - ((allDays[i].day_temp - ranges.minTemp) / ranges.tempRange) * height;
            ctx.shadowBlur = 0;
            ctx.fillStyle = allDays[i].type === 'forecast' ? '#fdba74' : this.colors.dayTemp;
            ctx.beginPath();
            ctx.arc(x, yDay, 8, 0, 2 * Math.PI);
            ctx.fill();
           
            // Белая обводка
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, yDay, 8, 0, 2 * Math.PI);
            ctx.stroke();
           
            // Подпись дневной температуры
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px "Segoe UI", Arial';
            ctx.fillText(`${allDays[i].day_temp}°`, x - 12, yDay - 12);
           
            // Ночная температура
            const yNight = height - ((allDays[i].night_temp - ranges.minTemp) / ranges.tempRange) * height;
            ctx.fillStyle = allDays[i].type === 'forecast' ? '#93c5fd' : this.colors.nightTemp;
            ctx.beginPath();
            ctx.rect(x - 6, yNight - 6, 12, 12);
            ctx.fill();
           
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(x - 6, yNight - 6, 12, 12);
            ctx.stroke();
           
            // Подпись ночной температуры
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${allDays[i].night_temp}°`, x + 8, yNight - 8);
        }
    }

    // Рисуем подписи дат
    drawLabels(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
       
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const dateParts = allDays[i].date.split(' ');
            const dayOfWeek = dateParts[0];
            const dayNum = dateParts[1]?.replace(',', '') || '';
           
            // День недели
            ctx.fillStyle = this.colors.text;
            ctx.font = 'bold 12px "Segoe UI", Arial';
            ctx.fillText(dayOfWeek, x - 15, height + 15);
           
            // Число
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '11px "Segoe UI", Arial';
            ctx.fillText(dayNum, x - 10, height + 35);
           
            // Маркер прогноза
            if (allDays[i].type === 'forecast') {
                ctx.fillStyle = this.colors.forecast;
                ctx.font = '10px "Segoe UI", Arial';
                ctx.fillText('прогноз', x - 15, height + 55);
            }
        }
    }

    // Рисуем заголовок
    drawHeader(ctx, width, topMargin, location) {
        ctx.save();
       
        // Заголовок
        ctx.font = 'bold 24px "Segoe UI", Arial';
        ctx.fillStyle = this.colors.text;
        ctx.fillText(`🌤️ Погода: ${location.toUpperCase()}`, 40, topMargin - 35);
       
        // Дата
        ctx.font = '14px "Segoe UI", Arial';
        ctx.fillStyle = this.colors.textMuted;
        const today = new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        ctx.fillText(`Актуально на ${today}`, 40, topMargin - 10);
       
        ctx.restore();
    }

    // Рисуем легенду
    drawLegend(ctx, width, topMargin) {
        ctx.save();
       
        const startX = width - 240;
        const startY = topMargin - 45;
       
        ctx.font = '12px "Segoe UI", Arial';
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Легенда:', startX, startY);
       
        // Дневная температура
        ctx.fillStyle = this.colors.dayTemp;
        ctx.beginPath();
        ctx.arc(startX + 70, startY - 2, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Дневная t°', startX + 82, startY);
       
        // Ночная температура
        ctx.fillStyle = this.colors.nightTemp;
        ctx.fillRect(startX + 165, startY - 8, 10, 10);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Ночная t°', startX + 180, startY);
       
        // Осадки
        ctx.fillStyle = this.colors.precipitation;
        ctx.fillRect(startX + 70, startY + 15, 12, 12);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Осадки (мм)', startX + 87, startY + 27);
       
        // Прогноз
        ctx.fillStyle = this.colors.forecast;
        ctx.beginPath();
        ctx.arc(startX + 165, startY + 20, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Прогноз', startX + 177, startY + 25);
       
        ctx.restore();
    }
}

module.exports = { WeatherGraph };
