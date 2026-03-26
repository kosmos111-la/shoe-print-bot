const { createCanvas } = require('canvas');

class WeatherGraph {
    constructor() {
        this.colors = {
            background: '#0f172a',
            grid: '#1e293b',
            text: '#f1f5f9',
            textMuted: '#94a3b8',
            historyDay: '#f97316',
            historyNight: '#3b82f6',
            forecastDay: '#fdba74',
            forecastNight: '#93c5fd',
            precipitation: '#06b6d4',
            forecastPrecip: '#a855f7',
            zeroLine: '#10b981',
            separator: '#ef4444'
        };
    }

    async generateWeatherGraph(history, forecast, location) {
        const allDays = this.prepareData(history, forecast);
        if (allDays.length === 0) return null;

        const canvas = createCanvas(1400, 900);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, 200);

        const margins = {
            top: 90,
            right: 100,
            bottom: 120,
            left: 80
        };

        const graphWidth = canvas.width - margins.left - margins.right;
        const graphHeight = canvas.height - margins.top - margins.bottom;

        const ranges = this.calculateRanges(allDays);
       
        ctx.save();
        ctx.translate(margins.left, margins.top);

        this.drawGrid(ctx, graphWidth, graphHeight, ranges);
        this.drawSeparator(ctx, allDays, graphWidth, graphHeight);
        this.drawTemperatureLines(ctx, allDays, graphWidth, graphHeight, ranges);
        this.drawPrecipitationBars(ctx, allDays, graphWidth, graphHeight, ranges);
        this.drawTemperaturePoints(ctx, allDays, graphWidth, graphHeight, ranges);
        this.drawLabels(ctx, allDays, graphWidth, graphHeight);
        this.drawHeader(ctx, canvas.width, margins.top, location);
        this.drawLegend(ctx, canvas.width, margins.top);
       
        ctx.restore();

        return canvas.toBuffer();
    }

    prepareData(history, forecast) {
        const allDays = [];
       
        if (history && history.length > 0) {
            const last7Days = history.slice(-7);
            last7Days.forEach((day) => {
                allDays.push({
                    date: day.date,
                    day_temp: day.day_temp,
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
                    day_temp: day.day_temp,
                    night_temp: day.night_temp,
                    precipitation: day.precipitation || 0,
                    type: 'forecast'
                });
            });
        }
       
        return allDays;
    }

    calculateRanges(allDays) {
        const dayTemps = allDays.map(d => d.day_temp);
        const nightTemps = allDays.map(d => d.night_temp);
        const allTemps = [...dayTemps, ...nightTemps];
       
        const maxTemp = Math.max(...allTemps, 25);
        const minTemp = Math.min(...allTemps, -15);
        const tempRange = maxTemp - minTemp;
       
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
            ctx.font = 'bold 10px "Segoe UI", Arial';
            ctx.fillText('ИСТОРИЯ →', separatorX - 60, height + 15);
            ctx.fillText('← ПРОГНОЗ', separatorX + 10, height + 15);
        }
    }

    drawTemperatureLines(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
       
        // Дневная температура
        ctx.beginPath();
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const y = height - ((allDays[i].day_temp - ranges.minTemp) / ranges.tempRange) * height;
           
            if (allDays[i].type === 'forecast') {
                ctx.strokeStyle = this.colors.forecastDay;
            } else {
                ctx.strokeStyle = this.colors.historyDay;
            }
           
            if (i === 0) {
                ctx.beginPath();
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
           
            if (i === allDays.length - 1 || allDays[i].type !== allDays[i+1]?.type) {
                ctx.stroke();
                if (i < allDays.length - 1) {
                    ctx.beginPath();
                    const nextX = (i + 1) * stepX;
                    const nextY = height - ((allDays[i+1].day_temp - ranges.minTemp) / ranges.tempRange) * height;
                    ctx.moveTo(x, y);
                    ctx.lineTo(nextX, nextY);
                    if (allDays[i+1].type === 'forecast') {
                        ctx.strokeStyle = this.colors.forecastDay;
                    }
                }
            }
        }
        ctx.stroke();
       
        // Ночная температура
        ctx.beginPath();
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const y = height - ((allDays[i].night_temp - ranges.minTemp) / ranges.tempRange) * height;
           
            if (allDays[i].type === 'forecast') {
                ctx.strokeStyle = this.colors.forecastNight;
            } else {
                ctx.strokeStyle = this.colors.historyNight;
            }
           
            if (i === 0) {
                ctx.beginPath();
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
           
            if (i === allDays.length - 1 || allDays[i].type !== allDays[i+1]?.type) {
                ctx.stroke();
                if (i < allDays.length - 1) {
                    ctx.beginPath();
                    const nextX = (i + 1) * stepX;
                    const nextY = height - ((allDays[i+1].night_temp - ranges.minTemp) / ranges.tempRange) * height;
                    ctx.moveTo(x, y);
                    ctx.lineTo(nextX, nextY);
                }
            }
        }
        ctx.stroke();
       
        // Заливка
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

    drawPrecipitationBars(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
        const barWidth = stepX * 0.5;
        const maxBarHeight = height * 0.3;
       
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
                ctx.fillText(`${precip.toFixed(1)}мм`, x + barWidth / 2 - 12, y - 5);
            }
        }
    }

    drawTemperaturePoints(ctx, allDays, width, height, ranges) {
        const stepX = width / (allDays.length - 1);
       
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
           
            const yDay = height - ((allDays[i].day_temp - ranges.minTemp) / ranges.tempRange) * height;
           
            if (allDays[i].type === 'forecast') {
                ctx.fillStyle = this.colors.forecastDay;
            } else {
                ctx.fillStyle = this.colors.historyDay;
            }
           
            ctx.beginPath();
            ctx.arc(x, yDay, 8, 0, 2 * Math.PI);
            ctx.fill();
           
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, yDay, 8, 0, 2 * Math.PI);
            ctx.stroke();
           
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px "Segoe UI", Arial';
            ctx.fillText(`${allDays[i].day_temp}°`, x - 12, yDay - 12);
           
            const yNight = height - ((allDays[i].night_temp - ranges.minTemp) / ranges.tempRange) * height;
           
            if (allDays[i].type === 'forecast') {
                ctx.fillStyle = this.colors.forecastNight;
            } else {
                ctx.fillStyle = this.colors.historyNight;
            }
           
            ctx.beginPath();
            ctx.rect(x - 6, yNight - 6, 12, 12);
            ctx.fill();
           
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(x - 6, yNight - 6, 12, 12);
            ctx.stroke();
           
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${allDays[i].night_temp}°`, x + 8, yNight - 8);
        }
    }

    drawLabels(ctx, allDays, width, height) {
        const stepX = width / (allDays.length - 1);
       
        for (let i = 0; i < allDays.length; i++) {
            const x = i * stepX;
            const dateParts = allDays[i].date.split(' ');
            const dayOfWeek = dateParts[0];
            const dayNum = dateParts[1]?.replace(',', '') || '';
           
            if (allDays[i].type === 'forecast') {
                ctx.fillStyle = this.colors.forecastDay;
            } else {
                ctx.fillStyle = this.colors.text;
            }
           
            ctx.font = 'bold 12px "Segoe UI", Arial';
            ctx.fillText(dayOfWeek, x - 15, height + 20);
           
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '11px "Segoe UI", Arial';
            ctx.fillText(dayNum, x - 10, height + 40);
           
            if (allDays[i].type === 'forecast') {
                ctx.fillStyle = this.colors.forecastDay;
                ctx.font = '9px "Segoe UI", Arial';
                ctx.fillText('прогноз', x - 12, height + 60);
            } else if (allDays[i].type === 'history' && i === 0) {
                ctx.fillStyle = this.colors.historyDay;
                ctx.font = '9px "Segoe UI", Arial';
                ctx.fillText('история', x - 10, height + 60);
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
        ctx.fillText(`Актуально на ${today} | История 7 дней + прогноз 2 дня`, 40, topMargin - 15);
       
        ctx.restore();
    }

    drawLegend(ctx, width, topMargin) {
        ctx.save();
       
        const startX = width - 280;
        const startY = topMargin - 40;
       
        ctx.font = '12px "Segoe UI", Arial';
        ctx.fillStyle = this.colors.text;
        ctx.fillText('📖 Легенда:', startX, startY);
       
        ctx.fillStyle = this.colors.historyDay;
        ctx.beginPath();
        ctx.arc(startX + 70, startY - 2, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Дневная (история)', startX + 82, startY);
       
        ctx.fillStyle = this.colors.historyNight;
        ctx.fillRect(startX + 70, startY + 15, 10, 10);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Ночная (история)', startX + 86, startY + 25);
       
        ctx.fillStyle = this.colors.forecastDay;
        ctx.beginPath();
        ctx.arc(startX + 200, startY - 2, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Дневная (прогноз)', startX + 212, startY);
       
        ctx.fillStyle = this.colors.forecastNight;
        ctx.fillRect(startX + 200, startY + 15, 10, 10);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Ночная (прогноз)', startX + 216, startY + 25);
       
        ctx.fillStyle = this.colors.precipitation;
        ctx.fillRect(startX + 70, startY + 40, 12, 12);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Осадки (история)', startX + 87, startY + 52);
       
        ctx.fillStyle = this.colors.forecastPrecip;
        ctx.fillRect(startX + 200, startY + 40, 12, 12);
        ctx.fillStyle = this.colors.text;
        ctx.fillText('Осадки (прогноз)', startX + 217, startY + 52);
       
        ctx.strokeStyle = this.colors.separator;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(startX + 70, startY + 70);
        ctx.lineTo(startX + 260, startY + 70);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = this.colors.separator;
        ctx.fillText('← История | Прогноз →', startX + 110, startY + 78);
       
        ctx.restore();
    }
}

module.exports = { WeatherGraph };
