// modules/footprint/visualizations/cluster-visualizer.js
// 🎨 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ - С УНИКАЛЬНЫМИ ТОЧКАМИ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/topology',
            canvasWidth: options.canvasWidth || 1000,
            canvasHeight: options.canvasHeight || 1000,
            debug: options.debug || false,
            showEdges: options.showEdges !== false,
            fontSize: options.fontSize || 14,
            pointSize: options.pointSize || 10,
            ...options
        };

        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 ClusterVisualizer (с уникальными точками) создан');
    }

    async visualizeTopologicalModel(topologyData, options = {}) {
        console.log('🎨 Визуализация топологической модели...');

        try {
            if (!topologyData || !topologyData.points || topologyData.points.length === 0) {
                console.log('⚠️ Нет данных для визуализации');
                return this.createTopologyReport(topologyData, null);
            }

            console.log(`📊 Всего точек в модели: ${topologyData.points.length}`);

            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createTopologyReport(topologyData, error);
            }

            // ========== ВИЗУАЛИЗАЦИЯ 1: МОДЕЛЬ ==========
            const modelPath = await this.drawModel(topologyData, options);

            // ========== ВИЗУАЛИЗАЦИЯ 2: ФОТО ==========
            const photoPath = await this.drawPhoto(topologyData, options);

            return {
                modelPath,
                photoPath,
                stats: topologyData.stats,
                success: true
            };

        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createTopologyReport(topologyData, error);
        }
    }

    async drawModel(topologyData, options) {
        const canvas = require('canvas').createCanvas(this.config.canvasWidth, this.config.canvasHeight);
        const ctx = canvas.getContext('2d');

        // ФОН
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

        // ЗАГОЛОВОК
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`🏗️ ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ`, this.config.canvasWidth / 2, 45);

        // Вычисляем границы с отступами
        const validPoints = topologyData.points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        const { minX, maxX, minY, maxY } = this.calculateBounds(validPoints);

        const scale = this.calculateScale(minX, maxX, minY, maxY,
            this.config.canvasWidth * 0.8, this.config.canvasHeight * 0.7);

        const centerX = this.config.canvasWidth / 2;
        const centerY = this.config.canvasHeight / 2 + 50;
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;

        // Рёбра
        if (this.config.showEdges && topologyData.edges) {
            this.drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
        }

        const modelMatchMap = topologyData.modelMatchMap || new Map();
        console.log(`   📋 modelMatchMap содержит ${modelMatchMap.size} записей`);

        // 🔥 ПЕРЕДАЁМ UNIQUE POINTS МОДЕЛИ
        this.drawModelPoints(ctx, topologyData, modelMatchMap, avgX, avgY, centerX, centerY, scale, topologyData.uniquePoints?.model);

        this.drawStats(ctx, topologyData.stats, this.config.canvasWidth);

    // 🔥 ДОБАВИТЬ: рисуем легенду структур
    this.drawStructureLegend(ctx, topologyData.structures || [], this.config.canvasWidth);

        const filename = options.filename ? options.filename.replace('.png', '_model.png') : `model_${Date.now()}.png`;
        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            out.on('finish', () => {
                console.log(`✅ Модель сохранена: ${outputPath}`);
                resolve(outputPath);
            });
            out.on('error', reject);
        });
    }

    async drawPhoto(topologyData, options) {
        const canvas = require('canvas').createCanvas(this.config.canvasWidth, this.config.canvasHeight);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

        ctx.fillStyle = '#212529';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`📸 ФОТО - ТОЧКИ`, this.config.canvasWidth / 2, 45);

        const validPoints = topologyData.points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        const { minX, maxX, minY, maxY } = this.calculateBounds(validPoints);

        const scale = this.calculateScale(minX, maxX, minY, maxY,
            this.config.canvasWidth * 0.8, this.config.canvasHeight * 0.7);

        const centerX = this.config.canvasWidth / 2;
        const centerY = this.config.canvasHeight / 2 + 50;
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;

        if (this.config.showEdges && topologyData.edges) {
            this.drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
        }

        const photoPoints = topologyData.photoPoints || [];
        console.log(`   📸 Рисую ${photoPoints.length} точек фото`);

        const matchMap = topologyData.matchMap || new Map();
        console.log(`   📋 matchMap содержит ${matchMap.size} записей`);

        // 🔥 ПЕРЕДАЁМ TRANSFORM И UNIQUE POINTS
        this.drawPhotoPoints(ctx, photoPoints, matchMap, avgX, avgY, centerX, centerY, scale,
            topologyData.transform, topologyData.uniquePoints?.photo);

        this.drawPhotoStats(ctx, topologyData.stats, this.config.canvasWidth, matchMap.size);

        const filename = options.filename ? options.filename.replace('.png', '_photo.png') : `photo_${Date.now()}.png`;
        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            out.on('finish', () => {
                console.log(`✅ Фото сохранено: ${outputPath}`);
                resolve(outputPath);
            });
            out.on('error', reject);
        });
    }

drawModelPoints(ctx, topologyData, modelMatchMap, avgX, avgY, centerX, centerY, scale, uniqueInModel = []) {
    const points = topologyData.points;
    const structures = topologyData.structures || [];

    console.log(`   🖌 Отрисовка ${points.length} узлов модели...`);
    console.log(`   📋 modelMatchMap в drawModelPoints: ${modelMatchMap.size} записей`);

    // Создаём карту структур для быстрого доступа
    const structureMap = new Map();
    for (const structure of structures) {
        structureMap.set(structure.id, structure);
    }

    // Сначала рисуем уникальные точки в модели (синие)
    let uniqueInModelPoints = 0;
    for (const point of uniqueInModel) {
        const x = centerX + (point.x - avgX) * scale;
        const y = centerY + (point.y - avgY) * scale;

        ctx.fillStyle = '#0000FF'; // СИНИЙ
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        uniqueInModelPoints++;
    }

    // Отрисовываем точки с цветами структур
    for (const point of points) {
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') continue;

        // Пропускаем уникальные точки модели (уже нарисованы)
        if (uniqueInModel.some(p => p.id === point.id)) continue;

        const x = centerX + (point.x - avgX) * scale;
        const y = centerY + (point.y - avgY) * scale;

        const confirmations = point.confirmationCount || 0;
        const pairNumber = modelMatchMap.get(point.id)?.pairNumber;
        const structureId = point.structureId;
        const structureColor = point.structureColor;

        // 🔥 ОПРЕДЕЛЯЕМ ЦВЕТ: приоритет — цвет структуры
        let color, size, label = '';

        if (structureId && structureColor) {
            // Цвет структуры (для всех точек, входящих в структуру)
            color = structureColor;
            size = 8;
            // Добавляем номер пары, если есть
            if (pairNumber) label = pairNumber.toString();

            if (this.debug && pairNumber) {
                console.log(`      🎨 Точка ${point.id.substring(0,8)}: структура ${structureId.substring(0,8)}, пара ${pairNumber}`);
            }
        } else if (pairNumber) {
            // Якоря и подтверждённые точки без структуры
            color = '#FFD700'; // Золотой
            size = 8;
            label = pairNumber.toString();
        } else if (confirmations >= 2) {
            // Подтверждённые точки
            color = '#FFA500'; // Оранжевый
            size = 7;
        } else if (confirmations >= 1) {
            // Новые точки
            color = '#4169E1'; // Синий
            size = 5;
        } else {
            // Неподтверждённые
            color = '#808080'; // Серый
            size = 4;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (label) {
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, y);
        }
    }

    // Статистика
    const structureStats = {};
    for (const point of points) {
        if (point.structureId) {
            structureStats[point.structureId] = (structureStats[point.structureId] || 0) + 1;
        }
    }

    console.log(`   🎯 Модель: ${structures.length} структур, уникальных: ${uniqueInModelPoints}, остальных: ${points.length - uniqueInModelPoints}`);
    console.log(`   🎨 Структуры:`, Object.entries(structureStats).slice(0, 5).map(([id, count]) => `${id.substring(0,8)}:${count}`).join(', '));
}

drawStructureLegend(ctx, structures, canvasWidth) {
    if (!structures || structures.length === 0) return;

    const legendX = canvasWidth - 220;
    const legendY = 120;
    const lineHeight = 20;

    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;
    ctx.fillText('🏗️ СТРУКТУРЫ:', legendX, legendY - 5);
    ctx.shadowBlur = 0;

    // Показываем только первые 8 структур
    const topStructures = structures
        .sort((a, b) => b.pointCount - a.pointCount)
        .slice(0, 8);

    topStructures.forEach((structure, idx) => {
        const y = legendY + idx * lineHeight;

        // Цветной квадратик
        ctx.fillStyle = structure.color;
        ctx.fillRect(legendX, y - 8, 12, 12);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(legendX, y - 8, 12, 12);

        // Текст
        ctx.font = '10px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(
            `${structure.id.substring(0,6)}: ${structure.pointCount} точек, ${(structure.confidence * 100).toFixed(0)}%`,
            legendX + 18, y
        );
    });

    if (structures.length > 8) {
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(`+ еще ${structures.length - 8} структур`, legendX, legendY + 8 * lineHeight);
    }
}

    drawPhotoPoints(ctx, points, matchMap, avgX, avgY, centerX, centerY, scale, transform, uniqueInPhoto = []) {
        console.log(`   🖌 Отрисовка ${points.length} узлов фото...`);
        console.log(`   📋 matchMap в drawPhotoPoints: ${matchMap.size} записей`);

        const photoToPair = new Map();
        const photoToStatus = new Map();

        for (const [photoId, match] of matchMap) {
            if (match && match.pairNumber) {
                photoToPair.set(photoId, match.pairNumber);
                photoToStatus.set(photoId, match.status || 'anchor');
                if (this.config.debug) {
                    console.log(`      🔢 Фото ${photoId.slice(0,12)}... → номер ${match.pairNumber} [${match.status || 'anchor'}]`);
                }
            }
        }

        let anchorPoints = 0, confirmedPoints = 0, candidatePoints = 0,
            uniqueInPhotoPoints = 0, unmatchedPoints = 0;

        // 🔥 Сначала рисуем уникальные точки в фото (фиолетовые)
        for (const point of uniqueInPhoto) {
            const x = centerX + (point.x - avgX) * scale;
            const y = centerY + (point.y - avgY) * scale;

            ctx.fillStyle = '#AA00FF'; // ФИОЛЕТОВЫЙ
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Рисуем ? в центре
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', x, y);

            uniqueInPhotoPoints++;
        }

        for (const point of points) {
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') continue;

            const x = centerX + (point.x - avgX) * scale;
            const y = centerY + (point.y - avgY) * scale;

            const pairNumber = photoToPair.get(point.id);
            const status = photoToStatus.get(point.id);
            const hasMatch = matchMap.has(point.id);

            let color, size;
            let label = '';

            if (hasMatch) {
                if (status === 'anchor') {
                    color = '#FF0000'; // КРАСНЫЙ - старые якоря
                    label = pairNumber.toString();
                    anchorPoints++;
                } else if (status === 'confirmed' || status === 'validator_found') {
                    color = '#00FF00'; // ЗЕЛЁНЫЙ - новые подтверждённые
                    label = '✓' + pairNumber;
                    confirmedPoints++;
                } else if (status === 'candidate') {
                    color = '#FFA500'; // ОРАНЖЕВЫЙ - кандидаты
                    label = '?' + pairNumber;
                    candidatePoints++;
                } else {
                    color = '#4CAF50';
                    label = pairNumber.toString();
                    confirmedPoints++;
                }
                size = 8;
            } else {
                color = '#2196F3'; // СИНИЙ - новые точки
                size = 5;
                unmatchedPoints++;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();

            if (label) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, x, y);
            }
        }

        console.log(`   🎯 Фото: 🔴 ${anchorPoints} якорей, 🟢 ${confirmedPoints} подтверждённых, 🟠 ${candidatePoints} кандидатов, 🟣 ${uniqueInPhotoPoints} только в фото, 🔵 ${unmatchedPoints} новых`);
    }

    drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale) {
        const pointsMap = new Map();
        topologyData.points.forEach(point => {
            if (point && point.id) pointsMap.set(point.id, point);
        });

        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.lineWidth = 1;
        let edgesDrawn = 0;

        if (topologyData.edges && Array.isArray(topologyData.edges)) {
            for (const edgeStr of topologyData.edges) {
                const [nodeAId, nodeBId] = edgeStr.split('--');
                const pointA = pointsMap.get(nodeAId);
                const pointB = pointsMap.get(nodeBId);

                if (pointA && pointB) {
                    const x1 = centerX + (pointA.x - avgX) * scale;
                    const y1 = centerY + (pointA.y - avgY) * scale;
                    const x2 = centerX + (pointB.x - avgX) * scale;
                    const y2 = centerY + (pointB.y - avgY) * scale;

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    edgesDrawn++;
                }
            }
        }

        console.log(`   🔗 Рёбер отрисовано: ${edgesDrawn}`);
    }

    drawStats(ctx, stats, canvasWidth) {
        if (!stats) return;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#343A40';
        ctx.textAlign = 'left';

        const rows = [
            `Узлов: ${stats.totalNodes || 0}`,
            `Рёбер: ${stats.totalEdges || 0}`,
            `🔴 С номерами: ${stats.confirmed3 || 0}`,
            `🟡 Подтвержденных: ${stats.confirmed2 || 0}`,
            `🔵 Новых: ${stats.confirmed1 || 0}`,
            `⚪ Неподтвержденных: ${stats.confirmed0 || 0}`
        ];

        rows.forEach((text, i) => {
            ctx.fillText(text, 50, 120 + i * 25);
        });
    }

    drawPhotoStats(ctx, stats, canvasWidth, matchedCount) {
        if (!stats) return;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#343A40';
        ctx.textAlign = 'left';

        const rows = [
            `Узлов в фото: ${matchedCount}`,
            `✅ Сопоставлено: ${matchedCount || 0}`,
            `🟠 Новых: 0`
        ];

        rows.forEach((text, i) => {
            ctx.fillText(text, 50, 120 + i * 25);
        });
    }

    calculateBounds(points) {
        const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');

        if (validPoints.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        validPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });

        const padding = Math.max(maxX - minX, maxY - minY) * 0.15;
        return {
            minX: minX - padding,
            maxX: maxX + padding,
            minY: minY - padding,
            maxY: maxY + padding
        };
    }

    calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return Math.min(targetWidth / width, targetHeight / height, 4);
    }

    createTopologyReport(topologyData, error) {
        const outputPath = path.join(this.config.outputDir, `topology_report_${Date.now()}.txt`);

        let report = `🏗️ ОТЧЕТ О ТОПОЛОГИЧЕСКОЙ МОДЕЛИ\n`;
        report += `═`.repeat(50) + `\n\n`;

        if (error) report += `❌ ОШИБКА: ${error.message}\n\n`;

        if (topologyData) {
            report += `📋 ИНФОРМАЦИЯ О МОДЕЛИ:\n`;
            report += `• Название: ${topologyData.modelName || 'Неизвестная'}\n`;
            report += `• Узлов: ${topologyData.stats?.totalNodes || 0}\n`;
            report += `• Рёбер: ${topologyData.stats?.totalEdges || 0}\n`;
        }

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            stats: topologyData?.stats,
            note: 'Текстовый отчет'
        };
    }
}

module.exports = ClusterVisualizer;
