// modules/footprint/template-visualizer.js
// ОБНОВЛЯЕМ С ФАЛЛБЭКОМ

let canvas;
try {
    canvas = require('canvas');
    console.log('✅ Canvas библиотека загружена');
} catch (error) {
    console.log('⚠️ Canvas не установлен, использую текстовый режим');
    canvas = null;
}

const fs = require('fs');
const path = require('path');

class TemplateVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/visualizations/templates',
            debug: options.debug || false,
            useCanvas: canvas !== null, // Автоматическое определение
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
            cellColors: {
                confirmed0: '#E9ECEF',    // 0 подтверждений - серый
                confirmed1: '#0D6EFD',    // 1 подтверждение - синий
                confirmed2: '#20C997',    // 2 подтверждения - зеленый
                confirmed3: '#FFC107',    // 3 подтверждения - желтый
                confirmed4: '#FD7E14',    // 4 подтверждения - оранжевый
                confirmed5: '#DC3545'     // 5+ подтверждений - красный
            },
            zoneColors: {
                heel: 'rgba(13, 110, 253, 0.1)',     // Пятка - синий
                midfoot: 'rgba(32, 201, 151, 0.1)',  // Центр - зеленый
                forefoot: 'rgba(255, 193, 7, 0.1)'   // Носок - желтый
            },
            ...options
        };

        // Создаем директорию если не существует
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log(`🎨 TemplateVisualizer инициализирован (режим: ${this.config.useCanvas ? 'canvas' : 'text'})`);
    }

    // 🔥 ОСНОВНОЙ МЕТОД С АВТОВЫБОРОМ РЕЖИМА
    async visualizeTemplate(templateData, options = {}) {
        if (this.config.useCanvas) {
            return this.visualizeWithCanvas(templateData, options);
        } else {
            return this.visualizeAsText(templateData, options);
        }
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ С CANVAS (если доступен)
    async visualizeWithCanvas(templateData, options = {}) {
        console.log(`🎨 Визуализирую шаблон "${templateData.name}" (Canvas)...`);

        const startTime = Date.now();
        const canvasWidth = options.width || this.config.canvasWidth;
        const canvasHeight = options.height || this.config.canvasHeight;

        // Создаем канвас
        const canvas = require('canvas').createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // 1. ФОН
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. МАСШТАБИРОВАНИЕ И ПЕРЕНОС
        const { offsetX, offsetY, scale } = this.calculateScaling(templateData, canvasWidth, canvasHeight);

        // 3. РИСУЕМ ЗОНЫ ПРОТЕКТОРА (если есть данные)
        if (templateData.stats?.zones) {
            this.drawZones(ctx, templateData.stats.zones, offsetX, offsetY, scale);
        }

        // 4. РИСУЕМ СВЯЗИ МЕЖДУ ЯЧЕЙКАМИ (если есть топология)
        if (templateData.cellConnections) {
            this.drawCellConnections(ctx, templateData, offsetX, offsetY, scale);
        }

        // 5. РИСУЕМ ЯЧЕЙКИ ШАБЛОНА
        const cellStats = this.drawTemplateCells(ctx, templateData.cells, offsetX, offsetY, scale, options);

        // 6. РИСУЕМ ОСЬ СТОПЫ
        this.drawFootAxis(ctx, templateData, offsetX, offsetY, scale);

        // 7. ДОБАВЛЯЕМ ИНФОРМАЦИЮ
        this.drawInfo(ctx, templateData, cellStats, canvasWidth, canvasHeight);

        // 8. СОХРАНЯЕМ ИЗОБРАЖЕНИЕ
        const outputPath = await this.saveCanvas(canvas, templateData, options);

        const timeMs = Date.now() - startTime;
        console.log(`✅ Шаблон визуализирован: ${outputPath} (${timeMs}мс)`);

        return {
            path: outputPath,
            templateId: templateData.templateId,
            cellStats: cellStats,
            timeMs: timeMs
        };
    }

    // 🔥 ТЕКСТОВАЯ ВИЗУАЛИЗАЦИЯ (фаллбэк)
    async visualizeAsText(templateData, options) {
        console.log(`🎨 Создаю текстовый отчет шаблона "${templateData.name}"...`);

        const startTime = Date.now();

        // Создаем текстовый отчет
        const SimpleTemplateVisualizer = require('./simple-template-visualizer');
        const textVisualizer = new SimpleTemplateVisualizer(this.config);

        const result = await textVisualizer.visualizeTemplate(templateData, options);

        const timeMs = Date.now() - startTime;
        console.log(`✅ Текстовый отчет создан: ${result.path} (${timeMs}мс)`);

        return result;
    }

    // 🔥 РАСЧЕТ МАСШТАБИРОВАНИЯ
    calculateScaling(templateData, canvasWidth, canvasHeight) {
        if (!templateData.cells || templateData.cells.length === 0) {
            return { offsetX: canvasWidth / 2, offsetY: canvasHeight / 2, scale: 1 };
        }

        // Находим границы всех ячеек
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        templateData.cells.forEach(cell => {
            const radius = cell.radius || 10;
            minX = Math.min(minX, cell.x - radius);
            maxX = Math.max(maxX, cell.x + radius);
            minY = Math.min(minY, cell.y - radius);
            maxY = Math.max(maxY, cell.y + radius);
        });

        // Добавляем отступы
        const padding = 50;
        const width = Math.max(1, maxX - minX) + padding * 2;
        const height = Math.max(1, maxY - minY) + padding * 2;

        // Масштабируем чтобы вместить в канвас
        const scaleX = (canvasWidth * 0.7) / width; // 70% ширины под шаблон
        const scaleY = (canvasHeight * 0.7) / height;
        const scale = Math.min(scaleX, scaleY);

        // Центрируем
        const offsetX = (canvasWidth - width * scale) / 2;
        const offsetY = (canvasHeight - height * scale) / 2 + padding;

        return {
            offsetX: offsetX - minX * scale,
            offsetY: offsetY - minY * scale,
            scale: scale
        };
    }

    // 🔥 РИСОВАНИЕ ЗОН ПРОТЕКТОРА
    drawZones(ctx, zones, offsetX, offsetY, scale) {
        if (!zones.heel || !zones.midfoot || !zones.forefoot) return;

        const drawZone = (zone, color) => {
            const zoneWidth = (zone.maxX - zone.minX) * scale;
            const zoneX = offsetX + zone.minX * scale;

            ctx.fillStyle = color;
            ctx.fillRect(zoneX, offsetY - 100, zoneWidth, 200 * scale);

            // Обводка зоны
            ctx.strokeStyle = color.replace('0.1', '0.3');
            ctx.lineWidth = 1;
            ctx.strokeRect(zoneX, offsetY - 100, zoneWidth, 200 * scale);
        };

        drawZone(zones.heel, this.config.zoneColors.heel);
        drawZone(zones.midfoot, this.config.zoneColors.midfoot);
        drawZone(zones.forefoot, this.config.zoneColors.forefoot);
    }

    // 🔥 РИСОВАНИЕ СВЯЗЕЙ МЕЖДУ ЯЧЕЙКАМИ
    drawCellConnections(ctx, templateData, offsetX, offsetY, scale) {
        if (!templateData.cellConnections || Object.keys(templateData.cellConnections).length === 0) {
            return;
        }

        ctx.strokeStyle = 'rgba(108, 117, 125, 0.15)';
        ctx.lineWidth = 1;

        // Создаем карту ячеек для быстрого доступа
        const cellMap = new Map();
        templateData.cells.forEach(cell => {
            cellMap.set(cell.id, cell);
        });

        // Рисуем связи
        for (const [cellId, connections] of Object.entries(templateData.cellConnections)) {
            const cell1 = cellMap.get(cellId);
            if (!cell1) continue;

            const x1 = offsetX + cell1.x * scale;
            const y1 = offsetY + cell1.y * scale;

            connections.forEach(connectedCellId => {
                const cell2 = cellMap.get(connectedCellId);
                if (!cell2) return;

                const x2 = offsetX + cell2.x * scale;
                const y2 = offsetY + cell2.y * scale;

                // Рисуем только близкие связи
                const dx = x2 - x1;
                const dy = y2 - y1;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) { // Максимальная длина связи
                    // Цвет связи в зависимости от подтверждений
                    const minConfirmations = Math.min(
                        cell1.confirmations || 0,
                        cell2.confirmations || 0
                    );

                    if (minConfirmations >= 3) {
                        ctx.strokeStyle = 'rgba(220, 53, 69, 0.2)';
                    } else if (minConfirmations >= 2) {
                        ctx.strokeStyle = 'rgba(255, 193, 7, 0.2)';
                    } else {
                        ctx.strokeStyle = 'rgba(13, 110, 253, 0.1)';
                    }

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            });
        }
    }

    // 🔥 РИСОВАНИЕ ЯЧЕЕК ШАБЛОНА
    drawTemplateCells(ctx, cells, offsetX, offsetY, scale, options) {
        if (!cells || !Array.isArray(cells)) {
            return { total: 0, drawn: 0 };
        }

        let stats = {
            total: cells.length,
            drawn: 0,
            byConfirmations: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 }
        };

        // Сортируем ячейки по количеству подтверждений (сначала больше)
        const sortedCells = [...cells].sort((a, b) => b.confirmations - a.confirmations);

        sortedCells.forEach(cell => {
            const x = offsetX + cell.x * scale;
            const y = offsetY + cell.y * scale;
            const radius = (cell.radius || 8) * scale * 0.8;
            const confirmations = cell.confirmations || 0;

            // Определяем цвет по количеству подтверждений
            let color;
            if (confirmations >= 5) {
                color = this.config.cellColors.confirmed5;
                stats.byConfirmations['5+']++;
            } else if (confirmations === 4) {
                color = this.config.cellColors.confirmed4;
                stats.byConfirmations[4]++;
            } else if (confirmations === 3) {
                color = this.config.cellColors.confirmed3;
                stats.byConfirmations[3]++;
            } else if (confirmations === 2) {
                color = this.config.cellColors.confirmed2;
                stats.byConfirmations[2]++;
            } else if (confirmations === 1) {
                color = this.config.cellColors.confirmed1;
                stats.byConfirmations[1]++;
            } else {
                color = this.config.cellColors.confirmed0;
                stats.byConfirmations[0]++;
            }

            // Рисуем ячейку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Обводка для ячеек с подтверждениями
            if (confirmations > 0) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = Math.max(1, radius * 0.15);
                ctx.stroke();
            }

            // Цифра подтверждений (для 2+)
            if (confirmations >= 2 && radius > 8) {
                ctx.fillStyle = confirmations >= 3 ? '#FFFFFF' : '#000000';
                ctx.font = `bold ${Math.max(8, radius / 1.5)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(confirmations.toString(), x, y);
                ctx.textAlign = 'left';
            }

            stats.drawn++;
        });

        return stats;
    }

    // 🔥 РИСОВАНИЕ ОСИ СТОПЫ
    drawFootAxis(ctx, templateData, offsetX, offsetY, scale) {
        if (!templateData.referencePoints || templateData.referencePoints.length < 2) {
            return;
        }

        // Находим min/max по X (ось стопы)
        const xs = templateData.referencePoints.map(p => p.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);

        // Рисуем ось
        const centerY = offsetY;
        const axisY = centerY;

        ctx.strokeStyle = 'rgba(108, 117, 125, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(offsetX + minX * scale, axisY);
        ctx.lineTo(offsetX + maxX * scale, axisY);
        ctx.stroke();

        ctx.setLineDash([]);

        // Стрелки направления (нос -> пятка)
        ctx.fillStyle = '#6C757D';

        // Стрелка к носку (правая)
        const arrowSize = 10;
        const rightX = offsetX + maxX * scale;
        ctx.beginPath();
        ctx.moveTo(rightX, axisY);
        ctx.lineTo(rightX - arrowSize, axisY - arrowSize / 2);
        ctx.lineTo(rightX - arrowSize, axisY + arrowSize / 2);
        ctx.closePath();
        ctx.fill();

        // Текст "носок"
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('носок', rightX - 15, axisY - 15);

        // Стрелка к пятке (левая)
        const leftX = offsetX + minX * scale;
        ctx.beginPath();
        ctx.moveTo(leftX, axisY);
        ctx.lineTo(leftX + arrowSize, axisY - arrowSize / 2);
        ctx.lineTo(leftX + arrowSize, axisY + arrowSize / 2);
        ctx.closePath();
        ctx.fill();

        // Текст "пятка"
        ctx.textAlign = 'left';
        ctx.fillText('пятка', leftX + 15, axisY - 15);
    }

    // 🔥 ДОБАВЛЕНИЕ ИНФОРМАЦИИ
    drawInfo(ctx, templateData, cellStats, canvasWidth, canvasHeight) {
        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`ШАБЛОН ПРОТЕКТОРА: ${templateData.name}`, canvasWidth / 2, 40);

        // Подзаголовок
        ctx.font = '16px Arial';
        ctx.fillStyle = '#6C757D';
        ctx.fillText(`Эталон: ${templateData.referenceGraphId?.slice(0, 12) || 'не установлен'}...`,
                    canvasWidth / 2, 70);

        // Статистика слева
        const leftX = 30;
        let y = 120;
        const lineHeight = 22;

        ctx.textAlign = 'left';
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#212529';
        ctx.fillText('📊 СТАТИСТИКА ШАБЛОНА', leftX, y);

        y += lineHeight + 10;
        ctx.font = '14px Arial';

        const statsItems = [
            `Ячеек шаблона: ${cellStats.total}`,
            `Подтвержденных: ${cellStats.drawn}`,
            `Высоконадёжных (3+): ${cellStats.byConfirmations[3] + cellStats.byConfirmations[4] + cellStats.byConfirmations['5+']}`,
            `Среднее подтверждений: ${templateData.stats?.avgConfirmations?.toFixed(2) || '0.00'}`,
            `Графов в шаблоне: ${templateData.transformationsCount || 0}`,
            `Уверенность модели: ${templateData.stats?.confidence ? (templateData.stats.confidence * 100).toFixed(1) + '%' : 'N/A'}`
        ];

        statsItems.forEach(item => {
            ctx.fillStyle = '#495057';
            ctx.fillText(item, leftX, y);
            y += lineHeight;
        });

        // Распределение подтверждений справа
        const rightX = canvasWidth - 250;
        y = 120;

        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#212529';
        ctx.fillText('📈 РАСПРЕДЕЛЕНИЕ', rightX, y);

        y += lineHeight + 10;
        ctx.font = '14px Arial';

        // Легенда подтверждений
        const legendItems = [
            { color: this.config.cellColors.confirmed5, text: '5+ подтверждений' },
            { color: this.config.cellColors.confirmed4, text: '4 подтверждения' },
            { color: this.config.cellColors.confirmed3, text: '3 подтверждения' },
            { color: this.config.cellColors.confirmed2, text: '2 подтверждения' },
            { color: this.config.cellColors.confirmed1, text: '1 подтверждение' },
            { color: this.config.cellColors.confirmed0, text: 'нет подтверждений' }
        ];

        legendItems.forEach((item, index) => {
            // Квадратик цвета
            ctx.fillStyle = item.color;
            ctx.fillRect(rightX, y - 10, 12, 12);

            // Текст
            ctx.fillStyle = '#495057';
            ctx.fillText(item.text, rightX + 20, y);

            // Количество
            const count = index === 0 ? cellStats.byConfirmations['5+'] :
                         index === 1 ? cellStats.byConfirmations[4] :
                         index === 2 ? cellStats.byConfirmations[3] :
                         index === 3 ? cellStats.byConfirmations[2] :
                         index === 4 ? cellStats.byConfirmations[1] :
                         cellStats.byConfirmations[0];

            ctx.textAlign = 'right';
            ctx.fillText(count.toString(), rightX + 180, y);
            ctx.textAlign = 'left';

            y += lineHeight;
        });

        // Зоны протектора (если есть)
        if (templateData.stats?.zones) {
            y += 10;
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#212529';
            ctx.fillText('👣 ЗОНЫ ПРОТЕКТОРА', rightX, y);

            y += lineHeight + 10;
            ctx.font = '14px Arial';

            const zones = templateData.stats.zones;
            const zoneItems = [
                { name: 'Пятка', zone: zones.heel, color: this.config.zoneColors.heel },
                { name: 'Центр', zone: zones.midfoot, color: this.config.zoneColors.midfoot },
                { name: 'Носок', zone: zones.forefoot, color: this.config.zoneColors.forefoot }
            ];

            zoneItems.forEach(item => {
                if (item.zone) {
                    ctx.fillStyle = item.color.replace('0.1', '0.7');
                    ctx.fillRect(rightX, y - 10, 12, 12);

                    ctx.fillStyle = '#495057';
                    ctx.fillText(item.name, rightX + 20, y);

                    ctx.textAlign = 'right';
                    ctx.fillText(`${item.zone.confirmations || 0} подтв.`, rightX + 180, y);
                    ctx.textAlign = 'left';

                    y += lineHeight;
                }
            });
        }

        // Футер
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`ID шаблона: ${templateData.templateId?.slice(0, 12)}... | ${new Date().toLocaleString('ru-RU')}`,
                    canvasWidth / 2, canvasHeight - 20);
    }

    // 🔥 СОХРАНЕНИЕ КАНВАСА
    async saveCanvas(canvas, templateData, options) {
        const filename = options.filename ||
                        `template_${templateData.templateId || 'unknown'}_${Date.now()}.png`;

        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);

            out.on('finish', () => {
                const fileSize = fs.statSync(outputPath).size;
                console.log(`💾 Шаблон сохранен: ${outputPath} (${(fileSize / 1024).toFixed(1)} KB)`);
                resolve(outputPath);
            });

            out.on('error', (error) => {
                console.log(`❌ Ошибка сохранения шаблона: ${error.message}`);
                reject(error);
            });
        });
    }

    // 🔥 СОЗДАНИЕ ТЕПЛОВОЙ КАРТЫ (фаллбэк)
    async createHeatmap(templateData, options = {}) {
        if (this.config.useCanvas) {
            console.log(`🔥 Создаю тепловую карту подтверждений...`);

            const canvasWidth = options.width || 800;
            const canvasHeight = options.height || 600;
            const canvas = require('canvas').createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // Градиент для тепловой карты
            const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
            gradient.addColorStop(0, '#0D6EFD');   // Синий - мало подтверждений
            gradient.addColorStop(0.5, '#20C997'); // Зеленый - средне
            gradient.addColorStop(1, '#DC3545');   // Красный - много подтверждений

            // Фон
            ctx.fillStyle = '#F8F9FA';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            if (!templateData.cells || templateData.cells.length === 0) {
                return this.saveCanvas(canvas, templateData, {
                    filename: `heatmap_empty_${Date.now()}.png`
                });
            }

            // Находим максимальное количество подтверждений
            const maxConfirmations = Math.max(...templateData.cells.map(c => c.confirmations || 0));

            // Рисуем тепловую карту
            templateData.cells.forEach(cell => {
                const confirmations = cell.confirmations || 0;
                const intensity = maxConfirmations > 0 ? confirmations / maxConfirmations : 0;

                // Цвет в зависимости от интенсивности
                let color;
                if (intensity < 0.2) {
                    color = 'rgba(13, 110, 253, 0.3)';
                } else if (intensity < 0.4) {
                    color = 'rgba(32, 201, 151, 0.4)';
                } else if (intensity < 0.6) {
                    color = 'rgba(255, 193, 7, 0.5)';
                } else if (intensity < 0.8) {
                    color = 'rgba(253, 126, 20, 0.6)';
                } else {
                    color = 'rgba(220, 53, 69, 0.7)';
                }

                const radius = (cell.radius || 10) * (0.5 + intensity * 0.5);
                const x = (cell.x / 1000) * canvasWidth;
                const y = (cell.y / 1000) * canvasHeight;

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            });

            // Легенда
            this.drawHeatmapLegend(ctx, canvasWidth, canvasHeight, maxConfirmations);

            const outputPath = await this.saveCanvas(canvas, templateData, {
                filename: `heatmap_${templateData.templateId || 'unknown'}_${Date.now()}.png`
            });

            return outputPath;
        } else {
            console.log('⚠️ Тепловая карта временно недоступна (canvas)');

            // Альтернатива: сохраняем данные в JSON
            return this.saveTemplateData(templateData, {
                ...options,
                filename: `heatmap_data_${templateData.templateId || 'unknown'}_${Date.now()}.json`
            });
        }
    }

    // 🔥 РИСОВАНИЕ ЛЕГЕНДЫ ТЕПЛОВОЙ КАРТЫ
    drawHeatmapLegend(ctx, canvasWidth, canvasHeight, maxConfirmations) {
        const legendWidth = 200;
        const legendHeight = 20;
        const legendX = canvasWidth - legendWidth - 20;
        const legendY = canvasHeight - 40;

        // Градиентная полоса
        const gradient = ctx.createLinearGradient(legendX, legendY, legendX + legendWidth, legendY);
        gradient.addColorStop(0, '#0D6EFD');
        gradient.addColorStop(0.5, '#20C997');
        gradient.addColorStop(1, '#DC3545');

        ctx.fillStyle = gradient;
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

        // Рамка
        ctx.strokeStyle = '#6C757D';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

        // Подписи
        ctx.fillStyle = '#495057';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('0', legendX, legendY + 35);
        ctx.fillText(Math.floor(maxConfirmations / 2), legendX + legendWidth / 2, legendY + 35);
        ctx.fillText(maxConfirmations, legendX + legendWidth, legendY + 35);

        ctx.fillStyle = '#212529';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Подтверждения', legendX + legendWidth / 2, legendY - 10);
    }

    // 🔥 СОХРАНЕНИЕ ДАННЫХ В JSON
    async saveTemplateData(templateData, options = {}) {
        const filename = options.filename ||
                        `template_data_${templateData.templateId || 'unknown'}_${Date.now()}.json`;

        const outputPath = path.join(this.config.outputDir, filename);

        const dataToSave = {
            ...templateData,
            savedAt: new Date().toISOString(),
            visualizationMethod: this.config.useCanvas ? 'canvas' : 'text'
        };

        return new Promise((resolve, reject) => {
            const jsonData = JSON.stringify(dataToSave, null, 2);

            fs.writeFile(outputPath, jsonData, 'utf8', (error) => {
                if (error) {
                    console.log(`❌ Ошибка сохранения JSON: ${error.message}`);
                    reject(error);
                } else {
                    const fileSize = Buffer.byteLength(jsonData, 'utf8');
                    console.log(`💾 Данные сохранены: ${outputPath} (${(fileSize / 1024).toFixed(1)} KB)`);
                    resolve(outputPath);
                }
            });
        });
    }
}

module.exports = TemplateVisualizer;
