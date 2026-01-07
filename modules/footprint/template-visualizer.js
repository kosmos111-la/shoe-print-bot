// modules/footprint/template-visualizer.js
const fs = require('fs');
const path = require('path');

// 🔥 ПРОВЕРКА ДОСТУПНОСТИ CANVAS
let canvas;
try {
    canvas = require('canvas');
    console.log('✅ Canvas библиотека загружена');
} catch (error) {
    console.log('⚠️ Canvas не установлен, буду использовать текстовый режим');
    canvas = null;
}

class TemplateVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/templates',
            debug: options.debug || false,
            useCanvas: canvas !== null && (options.useCanvas !== false), // Автоопределение
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

        // 🔥 Принудительно отключаем canvas если он недоступен
        if (this.config.useCanvas && !canvas) {
            this.config.useCanvas = false;
            console.log('⚠️ Canvas библиотека не найдена, переключаюсь на текстовый режим');
        }

        // 🔥 Создаем абсолютный путь
        this.config.outputDir = path.resolve(this.config.outputDir);

        // 🔥 Создаем директорию если не существует
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
            console.log(`📁 Создана директория: ${this.config.outputDir}`);
        }

        console.log(`🎨 TemplateVisualizer инициализирован`);
        console.log(`   📁 Выходная директория: ${this.config.outputDir}`);
        console.log(`   🎯 Режим: ${this.config.useCanvas ? 'canvas (PNG)' : 'text (отчеты)'}`);
    }

    // 🔥 ГЛАВНЫЙ МЕТОД ВИЗУАЛИЗАЦИИ
    async visualizeTemplate(templateData, options = {}) {
        console.log(`🎨 Визуализация шаблона "${templateData.name || 'без названия'}"...`);

        try {
            if (this.config.useCanvas) {
                return await this.visualizeWithCanvas(templateData, options);
            } else {
                return await this.visualizeAsText(templateData, options);
            }
        } catch (error) {
            console.log(`❌ Ошибка визуализации: ${error.message}`);
            // 🔥 ФАЛЛБЭК: всегда возвращаем хотя бы текстовый отчет
            return this.createSimpleTextReport(templateData);
        }
    }

    // 🔥 CANVAS ВИЗУАЛИЗАЦИЯ
    async visualizeWithCanvas(templateData, options = {}) {
        const startTime = Date.now();

        if (!canvas) {
            console.log('⚠️ Canvas недоступен, создаю текстовый отчет');
            return this.visualizeAsText(templateData, options);
        }

        console.log(`🎨 Создаю PNG визуализацию...`);

        const canvasWidth = options.width || this.config.canvasWidth;
        const canvasHeight = options.height || this.config.canvasHeight;

        // Создаем канвас
        const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
        const ctx = canvasInstance.getContext('2d');

        // 1. ФОН
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. РИСУЕМ ШАБЛОН
        if (templateData.cells && templateData.cells.length > 0) {
            const { offsetX, offsetY, scale } = this.calculateScaling(templateData, canvasWidth, canvasHeight);

            // Рисуем зоны если есть
            if (templateData.stats?.zones) {
                this.drawZones(ctx, templateData.stats.zones, offsetX, offsetY, scale);
            }

            // Рисуем ячейки
            const cellStats = this.drawTemplateCells(ctx, templateData.cells, offsetX, offsetY, scale, options);

            // Рисуем ось
            this.drawFootAxis(ctx, templateData, offsetX, offsetY, scale);

            // Добавляем информацию
            this.drawInfo(ctx, templateData, cellStats, canvasWidth, canvasHeight);
        } else {
            // Если нет ячеек, показываем сообщение
            ctx.fillStyle = '#6C757D';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('ШАБЛОН ПУСТ', canvasWidth / 2, canvasHeight / 2);

            ctx.font = '16px Arial';
            ctx.fillText('Нет данных для визуализации', canvasWidth / 2, canvasHeight / 2 + 40);
        }

        // 3. СОХРАНЯЕМ
        const filename = options.filename ||
                        `template_${templateData.templateId || 'unknown'}_${Date.now()}.png`;
        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvasInstance.createPNGStream();

            stream.pipe(out);

            out.on('finish', () => {
                const timeMs = Date.now() - startTime;
                const fileSize = fs.statSync(outputPath).size;

                console.log(`✅ PNG создан: ${outputPath}`);
                console.log(`   📊 Размер: ${(fileSize / 1024).toFixed(1)} KB`);
                console.log(`   ⏱️  Время: ${timeMs}мс`);

                resolve({
                    path: outputPath,
                    templateId: templateData.templateId,
                    method: 'canvas',
                    timeMs: timeMs,
                    sizeKB: Math.round(fileSize / 1024)
                });
            });

            out.on('error', reject);
        });
    }

    // 🔥 ТЕКСТОВАЯ ВИЗУАЛИЗАЦИЯ
    async visualizeAsText(templateData, options = {}) {
        console.log(`📝 Создаю текстовый отчет...`);

        const startTime = Date.now();
        const filename = options.filename ||
                        `template_report_${templateData.templateId || 'unknown'}_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);

        try {
            // Создаем подробный текстовый отчет
            const report = this.createTextReport(templateData);

            fs.writeFileSync(outputPath, report);

            const timeMs = Date.now() - startTime;
            const fileSize = Buffer.byteLength(report, 'utf8');

            console.log(`✅ Текстовый отчет создан: ${outputPath}`);
            console.log(`   📊 Размер: ${(fileSize / 1024).toFixed(1)} KB`);
            console.log(`   ⏱️  Время: ${timeMs}мс`);

            return {
                path: outputPath,
                templateId: templateData.templateId,
                method: 'text_report',
                timeMs: timeMs,
                sizeKB: Math.round(fileSize / 1024)
            };
        } catch (error) {
            console.log(`❌ Ошибка создания текстового отчета: ${error.message}`);
            return this.createSimpleTextReport(templateData);
        }
    }

    // 🔥 ПОДРОБНЫЙ ТЕКСТОВЫЙ ОТЧЕТ
    createTextReport(templateData) {
        const cells = templateData.cells || [];
        const stats = templateData.stats || {};

        let report = `
========================================
ШАБЛОН ПРОТЕКТОРА - ТЕКСТОВЫЙ ОТЧЕТ
========================================

📊 ОБЩАЯ ИНФОРМАЦИЯ:
Название: ${templateData.name || 'Без названия'}
ID шаблона: ${templateData.templateId || 'N/A'}
Дата создания: ${new Date().toLocaleString('ru-RU')}
Эталонный граф: ${templateData.referenceGraphId?.slice(0, 12) || 'N/A'}...
Статус: ${templateData.status || 'active'}

📈 СТАТИСТИКА:
- Всего ячеек: ${cells.length}
- Подтвержденных ячеек: ${stats.confirmedCells || 0}
- Высоконадежных ячеек: ${stats.highConfidenceCells || 0}
- Среднее подтверждений: ${stats.avgConfirmations?.toFixed(2) || '0.00'}
- Графов в шаблоне: ${stats.totalGraphs || 0}
- Дата обновления: ${templateData.updatedAt ? new Date(templateData.updatedAt).toLocaleString('ru-RU') : 'N/A'}

🔢 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:
${this.getConfirmationsDistribution(cells)}

🗺️ ЯЧЕЙКИ ШАБЛОНА (первые 50):
${this.formatCellsTable(cells.slice(0, 50))}

${cells.length > 50 ? `... и еще ${cells.length - 50} ячеек\n` : ''}

🏗️ ТОПОЛОГИЯ:
${this.formatTopologyInfo(templateData)}

📊 МЕТАДАННЫЕ:
${JSON.stringify(templateData.metadata || {}, null, 2)}

🎯 РЕКОМЕНДАЦИИ:
${this.getRecommendations(stats)}

========================================
Создано системой анализа следов обуви
========================================
`;

        return report;
    }

    // 🔥 ПРОСТОЙ ТЕКСТОВЫЙ ОТЧЕТ (фаллбэк)
    createSimpleTextReport(templateData) {
        const filename = `template_simple_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);

        const content = `
ПРОСТОЙ ОТЧЕТ ШАБЛОНА
=====================

Название: ${templateData.name || 'Без названия'}
ID: ${templateData.templateId || 'N/A'}
Дата: ${new Date().toLocaleString('ru-RU')}
Ячеек: ${templateData.cells?.length || 0}
Статус: ${templateData.status || 'active'}

Для полной визуализации установите библиотеку canvas:
npm install canvas

Или проверьте данные в JSON формате:
${JSON.stringify(templateData, null, 2).substring(0, 2000)}...
`;

        fs.writeFileSync(outputPath, content);

        console.log(`📄 Создан простой отчет: ${outputPath}`);

        return {
            path: outputPath,
            templateId: templateData.templateId,
            method: 'simple_text',
            timeMs: 0
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ТЕКСТОВОГО ОТЧЕТА
    getConfirmationsDistribution(cells) {
        const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 };

        cells.forEach(cell => {
            const confirmations = cell.confirmations || 0;
            if (confirmations >= 5) distribution['5+']++;
            else if (confirmations >= 0 && confirmations <= 4) distribution[confirmations]++;
        });

        return Object.entries(distribution)
            .map(([key, count]) => `  ${key} подтверждений: ${count} ячеек (${((count / cells.length) * 100).toFixed(1)}%)`)
            .join('\n');
    }

    formatCellsTable(cells) {
        if (cells.length === 0) return 'Нет ячеек';

        let table = '№   X       Y       Подтв.  Уверен.  Источники\n';
        table += '--- ------- ------- ------- -------- ----------\n';

        cells.forEach((cell, index) => {
            const x = cell.x?.toFixed(1) || '0.0';
            const y = cell.y?.toFixed(1) || '0.0';
            const conf = cell.confirmations || 0;
            const confidence = cell.confidence?.toFixed(2) || '0.00';
            const sources = cell.sources?.length || 0;

            table += `${(index + 1).toString().padStart(3)} ${x.padStart(7)} ${y.padStart(7)} ${conf.toString().padStart(7)} ${confidence.padStart(8)} ${sources.toString().padStart(10)}\n`;
        });

        return table;
    }

    formatTopologyInfo(templateData) {
        const zones = templateData.stats?.zones;
        if (!zones) return 'Нет данных о топологии';

        let info = 'ЗОНЫ ПРОТЕКТОРА:\n';
        if (zones.heel) {
            info += `  🦶 Пятка: ${zones.heel.cells || 0} ячеек, уверенность: ${(zones.heel.confidence * 100).toFixed(1)}%\n`;
        }
        if (zones.midfoot) {
            info += `  👣 Центр: ${zones.midfoot.cells || 0} ячеек, уверенность: ${(zones.midfoot.confidence * 100).toFixed(1)}%\n`;
        }
        if (zones.forefoot) {
            info += `  👞 Носок: ${zones.forefoot.cells || 0} ячеек, уверенность: ${(zones.forefoot.confidence * 100).toFixed(1)}%\n`;
        }

        return info;
    }

    getRecommendations(stats) {
        const recommendations = [];

        if ((stats.avgConfirmations || 0) < 2) {
            recommendations.push('📸 Добавьте больше фото для повышения уверенности модели');
        }

        if ((stats.confirmedCells || 0) < (stats.totalCells || 1) * 0.7) {
            recommendations.push('🔍 Снимите протектор с разных ракурсов для лучшего покрытия');
        }

        if ((stats.highConfidenceCells || 0) > 20) {
            recommendations.push('✅ Модель имеет хорошее количество высоконадежных точек');
        }

        return recommendations.length > 0
            ? recommendations.join('\n')
            : '✅ Модель в хорошем состоянии, продолжайте сбор данных';
    }

    // 🔥 МЕТОДЫ ДЛЯ CANVAS (сохранены из вашего кода)
    calculateScaling(templateData, canvasWidth, canvasHeight) {
        if (!templateData.cells || templateData.cells.length === 0) {
            return { offsetX: canvasWidth / 2, offsetY: canvasHeight / 2, scale: 1 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        templateData.cells.forEach(cell => {
            const radius = cell.radius || 10;
            minX = Math.min(minX, cell.x - radius);
            maxX = Math.max(maxX, cell.x + radius);
            minY = Math.min(minY, cell.y - radius);
            maxY = Math.max(maxY, cell.y + radius);
        });

        const padding = 50;
        const width = Math.max(1, maxX - minX) + padding * 2;
        const height = Math.max(1, maxY - minY) + padding * 2;

        const scaleX = (canvasWidth * 0.7) / width;
        const scaleY = (canvasHeight * 0.7) / height;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (canvasWidth - width * scale) / 2;
        const offsetY = (canvasHeight - height * scale) / 2 + padding;

        return {
            offsetX: offsetX - minX * scale,
            offsetY: offsetY - minY * scale,
            scale: scale
        };
    }

    drawZones(ctx, zones, offsetX, offsetY, scale) {
        if (!zones.heel || !zones.midfoot || !zones.forefoot) return;

        const drawZone = (zone, color) => {
            const zoneWidth = (zone.maxX - zone.minX) * scale;
            const zoneX = offsetX + zone.minX * scale;

            ctx.fillStyle = color;
            ctx.fillRect(zoneX, offsetY - 100, zoneWidth, 200 * scale);

            ctx.strokeStyle = color.replace('0.1', '0.3');
            ctx.lineWidth = 1;
            ctx.strokeRect(zoneX, offsetY - 100, zoneWidth, 200 * scale);
        };

        drawZone(zones.heel, this.config.zoneColors.heel);
        drawZone(zones.midfoot, this.config.zoneColors.midfoot);
        drawZone(zones.forefoot, this.config.zoneColors.forefoot);
    }

    drawTemplateCells(ctx, cells, offsetX, offsetY, scale, options) {
        if (!cells || !Array.isArray(cells)) {
            return { total: 0, drawn: 0 };
        }

        let stats = {
            total: cells.length,
            drawn: 0,
            byConfirmations: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 }
        };

        const sortedCells = [...cells].sort((a, b) => b.confirmations - a.confirmations);

        sortedCells.forEach(cell => {
            const x = offsetX + cell.x * scale;
            const y = offsetY + cell.y * scale;
            const radius = (cell.radius || 8) * scale * 0.8;
            const confirmations = cell.confirmations || 0;

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

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();

            if (confirmations > 0) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = Math.max(1, radius * 0.15);
                ctx.stroke();
            }

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

    drawFootAxis(ctx, templateData, offsetX, offsetY, scale) {
        if (!templateData.referencePoints || templateData.referencePoints.length < 2) {
            return;
        }

        const xs = templateData.referencePoints.map(p => p.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
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

        const arrowSize = 10;
        const rightX = offsetX + maxX * scale;
        ctx.fillStyle = '#6C757D';

        ctx.beginPath();
        ctx.moveTo(rightX, axisY);
        ctx.lineTo(rightX - arrowSize, axisY - arrowSize / 2);
        ctx.lineTo(rightX - arrowSize, axisY + arrowSize / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('носок', rightX - 15, axisY - 15);

        const leftX = offsetX + minX * scale;
        ctx.beginPath();
        ctx.moveTo(leftX, axisY);
        ctx.lineTo(leftX + arrowSize, axisY - arrowSize / 2);
        ctx.lineTo(leftX + arrowSize, axisY + arrowSize / 2);
        ctx.closePath();
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.fillText('пятка', leftX + 15, axisY - 15);
    }

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

        const legendItems = [
            { color: this.config.cellColors.confirmed5, text: '5+ подтверждений' },
            { color: this.config.cellColors.confirmed4, text: '4 подтверждения' },
            { color: this.config.cellColors.confirmed3, text: '3 подтверждения' },
            { color: this.config.cellColors.confirmed2, text: '2 подтверждения' },
            { color: this.config.cellColors.confirmed1, text: '1 подтверждение' },
            { color: this.config.cellColors.confirmed0, text: 'нет подтверждений' }
        ];

        legendItems.forEach((item, index) => {
            ctx.fillStyle = item.color;
            ctx.fillRect(rightX, y - 10, 12, 12);

            ctx.fillStyle = '#495057';
            ctx.fillText(item.text, rightX + 20, y);

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

        // Футер
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`ID шаблона: ${templateData.templateId?.slice(0, 12)}... | ${new Date().toLocaleString('ru-RU')}`,
                    canvasWidth / 2, canvasHeight - 20);
    }

    // 🔥 ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ
    async createHeatmap(templateData, options = {}) {
        console.log(`🔥 Создаю тепловую карту шаблона...`);

        if (!this.config.useCanvas || !canvas) {
            console.log('⚠️ Canvas недоступен для тепловой карты');
            return await this.createHeatmapTextReport(templateData, options);
        }

        const startTime = Date.now();

        // 🔥 УМЕНЬШАЕМ РАЗМЕР ДЛЯ СКОРОСТИ
        const canvasWidth = 800;  // Было 1200 - уменьшили в 1.5 раза
        const canvasHeight = 600; // Было 800 - уменьшили в 1.33 раза

        // Создаем канвас для тепловой карты
        const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
        const ctx = canvasInstance.getContext('2d');

        // 1. ФОН
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. ПАРАМЕТРЫ ТЕПЛОВОЙ КАРТЫ
        const heatmapRadius = 20; // 🔥 Уменьшаем радиус (было 40)
        const maxIntensity = 5; // Максимальное количество подтверждений

        // 3. ИСПОЛЬЗУЕМ СУММАРНУЮ КАРТУ ДЛЯ БЫСТРОТЫ
        if (templateData.cells && templateData.cells.length > 0) {
            const { offsetX, offsetY, scale } = this.calculateScaling(templateData, canvasWidth, canvasHeight);

            // 🔥 СОЗДАЕМ СУММАРНУЮ КАРТУ (массив чисел вместо рисования)
            const intensityMap = this.createIntensityMap(
                templateData.cells,
                canvasWidth,
                canvasHeight,
                offsetX,
                offsetY,
                scale,
                heatmapRadius
            );

            // 🔥 РИСУЕМ ПО СУММАРНОЙ КАРТЕ ОДИН РАЗ
            const imageData = ctx.createImageData(canvasWidth, canvasHeight);
            const data = imageData.data;
           
            let maxVal = 0;
            for (let i = 0; i < intensityMap.length; i++) {
                if (intensityMap[i] > maxVal) maxVal = intensityMap[i];
            }
           
            // Нормализуем и рисуем
            for (let i = 0; i < intensityMap.length; i++) {
                const intensity = maxVal > 0 ? intensityMap[i] / maxVal : 0;
                const { r, g, b } = this.intensityToColor(intensity);
               
                const idx = i * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255; // Полная непрозрачность
            }
           
            ctx.putImageData(imageData, 0, 0);

            // 🔥 ПРИМЕНЯЕМ БЫСТРОЕ РАЗМЫТИЕ
            this.applyFastBlur(ctx, canvasWidth, canvasHeight, 3);

            // 🔥 УПРОЩАЕМ КОНТУР (не рисуем выпуклую оболочку)
            this.drawSimpleContour(ctx, templateData, offsetX, offsetY, scale);

            // 7. ЛЕГЕНДА ТЕПЛОВОЙ КАРТЫ
            this.drawHeatmapLegend(ctx, canvasWidth, canvasHeight, maxIntensity);

            // 8. ИНФОРМАЦИЯ
            this.drawHeatmapInfo(ctx, templateData, canvasWidth);
        }

        // 9. СОХРАНЯЕМ
        const filename = options.filename ||
                        `heatmap_${templateData.templateId || 'unknown'}_${Date.now()}.png`;
        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvasInstance.createPNGStream();

            stream.pipe(out);

            out.on('finish', () => {
                const timeMs = Date.now() - startTime;
                const fileSize = fs.statSync(outputPath).size;

                console.log(`🔥 Тепловая карта создана: ${outputPath}`);
                console.log(`   📊 Размер: ${(fileSize / 1024).toFixed(1)} KB`);
                console.log(`   ⏱️  Время: ${timeMs}мс`);

                resolve({
                    path: outputPath,
                    templateId: templateData.templateId,
                    method: 'heatmap',
                    timeMs: timeMs,
                    sizeKB: Math.round(fileSize / 1024)
                });
            });

            out.on('error', reject);
        });
    }

    // 🔥 НОВЫЙ МЕТОД: СОЗДАНИЕ СУММАРНОЙ КАРТЫ
    createIntensityMap(cells, width, height, offsetX, offsetY, scale, radius) {
        const intensityMap = new Float32Array(width * height).fill(0);
       
        // Ограничиваем количество обрабатываемых ячеек для скорости
        const maxCells = 5000;
        const cellsToProcess = cells.length > maxCells ?
            cells.slice(0, maxCells) : cells;
           
        if (cells.length > maxCells) {
            console.log(`   ⚡ Обрабатываю ${maxCells} из ${cells.length} ячеек для скорости`);
        }
       
        // Быстрое заполнение карты
        for (const cell of cellsToProcess) {
            const x = Math.floor(offsetX + cell.x * scale);
            const y = Math.floor(offsetY + cell.y * scale);
            const confirmations = cell.confirmations || 0;
           
            if (x >= 0 && x < width && y >= 0 && y < height) {
                // Добавляем интенсивность в центральную точку
                const centerIdx = y * width + x;
                intensityMap[centerIdx] += confirmations;
               
                // Добавляем в соседние пиксели (упрощенный радиус)
                const r = Math.floor(radius * scale);
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                       
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const distance = Math.sqrt(dx*dx + dy*dy);
                            if (distance <= r) {
                                const idx = ny * width + nx;
                                // Гауссово распределение интенсивности
                                const weight = Math.exp(-distance * distance / (r * r));
                                intensityMap[idx] += confirmations * weight * 0.5;
                            }
                        }
                    }
                }
            }
        }
       
        return intensityMap;
    }

    // 🔥 НОВЫЙ МЕТОД: БЫСТРОЕ РАЗМЫТИЕ
    applyFastBlur(ctx, width, height, radius) {
        // Используем встроенное размытие если доступно
        if (typeof ctx.filter !== 'undefined') {
            ctx.filter = `blur(${radius}px)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            ctx.filter = 'none';
            return;
        }
       
        // Фолбэк: простое размытие
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const tempData = new Uint8ClampedArray(data);
       
        // Только один проход вместо radius проходов
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
               
                // Быстрое усреднение
                let r = 0, g = 0, b = 0;
                let count = 0;
               
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nIdx = ((y + dy) * width + (x + dx)) * 4;
                        r += tempData[nIdx];
                        g += tempData[nIdx + 1];
                        b += tempData[nIdx + 2];
                        count++;
                    }
                }
               
                data[idx] = r / count;
                data[idx + 1] = g / count;
                data[idx + 2] = b / count;
            }
        }
       
        ctx.putImageData(imageData, 0, 0);
    }

    // 🔥 НОВЫЙ МЕТОД: ПРОСТОЙ КОНТУР
    drawSimpleContour(ctx, templateData, offsetX, offsetY, scale) {
        if (!templateData.cells || templateData.cells.length < 10) return;
       
        // Находим границы точек
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        for (const cell of templateData.cells) {
            const x = offsetX + cell.x * scale;
            const y = offsetY + cell.y * scale;
           
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
       
        // Рисуем простой прямоугольник вместо сложного контура
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }

    // 🔥 НОВЫЙ МЕТОД: ПРЕОБРАЗОВАНИЕ ИНТЕНСИВНОСТИ В ЦВЕТ
    intensityToColor(intensity) {
        // intensity от 0 до 1
        if (intensity < 0.3) {
            // Синий для низкой интенсивности
            return {
                r: 0,
                g: 0,
                b: Math.floor(100 + 155 * (intensity * 3.33))
            };
        } else if (intensity < 0.7) {
            // Желтый для средней
            const val = (intensity - 0.3) * 2.5;
            return {
                r: Math.floor(255 * val),
                g: Math.floor(255 * val),
                b: 0
            };
        } else {
            // Красный для высокой
            const val = (intensity - 0.7) * 3.33;
            return {
                r: 255,
                g: Math.floor(255 * (1 - val)),
                b: 0
            };
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ТЕПЛОВОЙ КАРТЫ
    drawHeatmapLegend(ctx, canvasWidth, canvasHeight, maxIntensity) {
        const legendWidth = 200;
        const legendHeight = 20;
        const legendX = canvasWidth - legendWidth - 20;
        const legendY = 20;

        // Градиент для легенды
        const gradient = ctx.createLinearGradient(
            legendX, legendY,
            legendX + legendWidth, legendY
        );

        gradient.addColorStop(0, 'blue');
        gradient.addColorStop(0.5, 'yellow');
        gradient.addColorStop(1, 'red');

        ctx.fillStyle = gradient;
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

        // Рамка
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

        // Подписи
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        ctx.fillText('0', legendX, legendY + legendHeight + 15);
        ctx.fillText(Math.floor(maxIntensity / 2).toString(),
                     legendX + legendWidth / 2, legendY + legendHeight + 15);
        ctx.fillText(maxIntensity.toString(),
                     legendX + legendWidth, legendY + legendHeight + 15);

        ctx.textAlign = 'right';
        ctx.fillText('подтверждения', legendX - 10, legendY + legendHeight / 2 + 4);
    }

    drawHeatmapInfo(ctx, templateData, canvasWidth) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ТЕПЛОВАЯ КАРТА ПОДТВЕРЖДЕНИЙ', canvasWidth / 2, 40);

        ctx.font = '14px Arial';
        ctx.fillText(`Шаблон: ${templateData.name || 'без названия'}`, canvasWidth / 2, 70);

        if (templateData.stats) {
            ctx.fillText(
                `Высоконадежных ячеек: ${templateData.stats.highConfidenceCells || 0}`,
                canvasWidth / 2, 95
            );
        }
    }

    // 🔥 АЛЬТЕРНАТИВА ДЛЯ ТЕКСТОВОЙ ТЕПЛОВОЙ КАРТЫ
    async createHeatmapTextReport(templateData, options = {}) {
        console.log('📝 Создаю текстовый отчет тепловой карты...');

        const cells = templateData.cells || [];

        // Группируем по уровням подтверждений
        const levels = {
            high: [],      // 4+ подтверждений
            medium: [],    // 2-3 подтверждения
            low: [],       // 1 подтверждение
            none: []       // 0 подтверждений
        };

        cells.forEach(cell => {
            const confirmations = cell.confirmations || 0;

            if (confirmations >= 4) levels.high.push(cell);
            else if (confirmations >= 2) levels.medium.push(cell);
            else if (confirmations >= 1) levels.low.push(cell);
            else levels.none.push(cell);
        });

        // Создаем ASCII-визуализацию
        const gridSize = 20;
        const heatGrid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));

        cells.forEach(cell => {
            const gridX = Math.min(gridSize - 1, Math.floor(cell.nx * gridSize));
            const gridY = Math.min(gridSize - 1, Math.floor(cell.ny * gridSize));

            heatGrid[gridY][gridX] = Math.max(
                heatGrid[gridY][gridX],
                cell.confirmations || 0
            );
        });

        let asciiHeatmap = 'ТЕПЛОВАЯ КАРТА (ASCII)\n';
        asciiHeatmap += '══════════════════════════════\n';
        asciiHeatmap += 'Легенда: ░░░ = низкая, ▒▒▒ = средняя, ▓▓▓ = высокая\n\n';

        for (let y = 0; y < gridSize; y++) {
            let row = '';
            for (let x = 0; x < gridSize; x++) {
                const value = heatGrid[y][x];

                if (value >= 4) row += '▓▓▓';
                else if (value >= 2) row += '▒▒▒';
                else if (value >= 1) row += '░░░';
                else row += '   ';
            }
            asciiHeatmap += row + '\n';
        }

        const report = `
${asciiHeatmap}

СТАТИСТИКА ТЕПЛОВОЙ КАРТЫ:
══════════════════════════════
Всего ячеек: ${cells.length}
Высокая теплота (4+): ${levels.high.length} (${((levels.high.length / cells.length) * 100).toFixed(1)}%)
Средняя теплота (2-3): ${levels.medium.length} (${((levels.medium.length / cells.length) * 100).toFixed(1)}%)
Низкая теплота (1): ${levels.low.length} (${((levels.low.length / cells.length) * 100).toFixed(1)}%)
Нет подтверждений: ${levels.none.length} (${((levels.none.length / cells.length) * 100).toFixed(1)}%)

РАСПРЕДЕЛЕНИЕ ПО ЗОНАМ:
══════════════════════════════
${this.getZoneHeatDistribution(templateData)}

ДАТА ОТЧЕТА: ${new Date().toLocaleString('ru-RU')}
`;

        const filename = options.filename ||
                        `heatmap_report_${templateData.templateId || 'unknown'}_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);

        fs.writeFileSync(outputPath, report);

        return {
            path: outputPath,
            templateId: templateData.templateId,
            method: 'heatmap_text',
            note: 'Установите Canvas для PNG тепловых карт'
        };
    }

    getZoneHeatDistribution(templateData) {
        const zones = templateData.stats?.zones;
        if (!zones) return 'Нет данных по зонам';

        let report = '';

        ['heel', 'midfoot', 'forefoot'].forEach(zone => {
            if (zones[zone]) {
                const avgHeat = zones[zone].avgConfirmations || 0;
                let heatLevel = '❄️';

                if (avgHeat >= 3) heatLevel = '🔥🔥🔥';
                else if (avgHeat >= 2) heatLevel = '🔥🔥';
                else if (avgHeat >= 1) heatLevel = '🔥';

                report += `${this.getZoneName(zone)}: ${heatLevel} (${avgHeat.toFixed(1)} подтверждений)\n`;
            }
        });

        return report;
    }

    getZoneName(zone) {
        const names = {
            heel: '🦶 Пятка',
            midfoot: '👣 Центр',
            forefoot: '👞 Носок'
        };

        return names[zone] || zone;
    }

    // 🔥 УТИЛИТЫ
    async saveTemplateData(templateData, options = {}) {
        const filename = options.filename ||
                        `template_data_${templateData.templateId || 'unknown'}_${Date.now()}.json`;
        const outputPath = path.join(this.config.outputDir, filename);

        const dataToSave = {
            ...templateData,
            savedAt: new Date().toISOString(),
            visualizations: this.config.useCanvas ? 'canvas' : 'text'
        };

        return new Promise((resolve, reject) => {
            const jsonData = JSON.stringify(dataToSave, null, 2);

            fs.writeFile(outputPath, jsonData, 'utf8', (error) => {
                if (error) {
                    reject(error);
                } else {
                    const fileSize = Buffer.byteLength(jsonData, 'utf8');
                    console.log(`💾 JSON сохранен: ${outputPath} (${(fileSize / 1024).toFixed(1)} KB)`);
                    resolve({
                        path: outputPath,
                        templateId: templateData.templateId,
                        sizeKB: Math.round(fileSize / 1024)
                    });
                }
            });
        });
    }

    // 🔥 ПРОВЕРКА РАБОТОСПОСОБНОСТИ
    async healthCheck() {
        console.log('🔍 Проверка визуализатора...');

        const checks = {
            canvas: !!canvas,
            outputDir: fs.existsSync(this.config.outputDir),
            writable: false
        };

        // Проверяем возможность записи
        try {
            const testFile = path.join(this.config.outputDir, `.test_${Date.now()}`);
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            checks.writable = true;
        } catch (error) {
            console.log(`⚠️ Ошибка записи в ${this.config.outputDir}: ${error.message}`);
        }

        console.log('📊 Результаты проверки:');
        console.log(`   Canvas доступен: ${checks.canvas ? '✅' : '❌'}`);
        console.log(`   Директория существует: ${checks.outputDir ? '✅' : '❌'}`);
        console.log(`   Можно записывать: ${checks.writable ? '✅' : '❌'}`);

        if (!checks.canvas) {
            console.log('💡 Совет: установите Canvas для PNG визуализации:');
            console.log('   npm install canvas');
        }

        return checks;
    }
}

module.exports = TemplateVisualizer;
