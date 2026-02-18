// modules/footprint/visualizations/cluster-visualizer.js
// 🎨 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ - МОДЕЛЬ + ФОТО С НОМЕРАМИ ЯКОРЕЙ (ИСПРАВЛЕНО)

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/topology',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
            debug: options.debug || false,
            showEdges: options.showEdges !== false,
            ...options
        };

        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 ClusterVisualizer (с номерами якорей) создан');
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
        ctx.fillText(`🏗️ ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ (ЯКОРЯ 1-12)`, this.config.canvasWidth / 2, 45);

        // Вычисляем границы
        const validPoints = topologyData.points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        const { minX, maxX, minY, maxY } = this.calculateBounds(validPoints);
        const scale = this.calculateScale(minX, maxX, minY, maxY, this.config.canvasWidth * 0.7, this.config.canvasHeight * 0.5);
        const centerX = this.config.canvasWidth / 2;
        const centerY = this.config.canvasHeight * 0.6;
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;

        // Рёбра
        if (this.config.showEdges && topologyData.edges) {
            this.drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
        }

        // Точки модели с номерами ТОЛЬКО для якорей
        this.drawModelPoints(ctx, topologyData, avgX, avgY, centerX, centerY, scale);

        // Статистика
        this.drawStats(ctx, topologyData.stats, this.config.canvasWidth);

        // Сохраняем
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

        // ФОН
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

        // ЗАГОЛОВОК
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`📸 ФОТО - ТОЧКИ (ЯКОРЯ 1-12)`, this.config.canvasWidth / 2, 45);

        // Вычисляем границы
        const validPoints = topologyData.points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        const { minX, maxX, minY, maxY } = this.calculateBounds(validPoints);
        const scale = this.calculateScale(minX, maxX, minY, maxY, this.config.canvasWidth * 0.7, this.config.canvasHeight * 0.5);
        const centerX = this.config.canvasWidth / 2;
        const centerY = this.config.canvasHeight * 0.6;
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;

        // Рёбра
        if (this.config.showEdges && topologyData.edges) {
            this.drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
        }

        // 🔥 Используем photoPoints, если они есть, иначе points
        const photoPoints = topologyData.photoPoints || topologyData.points;
        const matchMap = topologyData.matchMap || new Map();

        this.drawPhotoPoints(ctx, photoPoints, matchMap, avgX, avgY, centerX, centerY, scale);

        // Статистика
        this.drawPhotoStats(ctx, topologyData.stats, this.config.canvasWidth, matchMap.size);

        // Сохраняем
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

    drawModelPoints(ctx, topologyData, avgX, avgY, centerX, centerY, scale) {
        const points = topologyData.points;
        const matchMap = topologyData.matchMap || new Map();

        // 🔥 СОЗДАЁМ КАРТУ ТОЛЬКО ДЛЯ ЯКОРЕЙ (первые 12 пар)
        // Якоря - это точки с наивысшей уверенностью, которые есть в matchMap
        const anchorPairs = new Map();
        let anchorCount = 0;
       
        // Сортируем matchMap по pairNumber чтобы взять первые 12
        const sortedMatches = Array.from(matchMap.entries())
            .sort((a, b) => (a[1].pairNumber || 0) - (b[1].pairNumber || 0));
       
        for (const [photoId, match] of sortedMatches) {
            if (match && match.modelId && anchorCount < 12) {
                anchorPairs.set(match.modelId, match.pairNumber);
                anchorCount++;
            }
        }

        console.log(`   🎯 Якорей для отображения на МОДЕЛИ: ${anchorPairs.size}`);

        // Создаём обратную карту modelId -> pairNumber для всех (нужно для отладки)
        const modelToPair = new Map();
        for (const [photoId, match] of matchMap) {
            if (match && match.modelId) {
                modelToPair.set(match.modelId, match.pairNumber);
            }
        }

        console.log(`   🖌 Отрисовка ${points.length} узлов модели...`);

        let anchorPoints = 0, regularPoints = 0;

        for (const point of points) {
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') continue;

            const x = centerX + (point.x - avgX) * scale;
            const y = centerY + (point.y - avgY) * scale;

            const confirmations = point.confirmationCount || 0;
           
            // 🔥 Проверяем, является ли точка ЯКОРЕМ (есть в anchorPairs)
            const pairNumber = anchorPairs.get(point.id);
            const isAnchor = pairNumber !== undefined;

            // Цвет и размер
            let color, size;

            if (isAnchor) {
                color = '#FF0000'; // 🔴 Красный - якорь
                size = 12;
                anchorPoints++;
            } else if (confirmations >= 3) {
                color = '#FF0000'; // 🔴 Ядро (3+)
                size = 10;
                regularPoints++;
            } else if (confirmations >= 2) {
                color = '#FFC107'; // 🟡 Подтверждённый (2)
                size = 8;
                regularPoints++;
            } else if (confirmations >= 1) {
                color = '#2196F3'; // 🔵 Новый (1)
                size = 6;
                regularPoints++;
            } else {
                color = '#BDBDBD'; // ⚪ Неподтверждённый (0)
                size = 5;
                regularPoints++;
            }

            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 🔥 РИСУЕМ НОМЕР ТОЛЬКО ДЛЯ ЯКОРЕЙ (1-12)
            if (isAnchor) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
               
                // Белый фон для номера (для читаемости)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(x - 12, y - size - 22, 24, 18);
               
                ctx.fillStyle = '#000000';
                ctx.fillText(pairNumber.toString(), x, y - size - 12);
               
                if (this.config.debug) {
                    console.log(`      Якорь ${pairNumber} на модели: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
                }
            }
        }

        console.log(`   🎯 Модель: 🔴 ${anchorPoints} якорей, остальных: ${regularPoints}`);
    }

    drawPhotoPoints(ctx, points, matchMap, avgX, avgY, centerX, centerY, scale) {
        console.log(`   🖌 Отрисовка ${points.length} узлов фото...`);

        // 🔥 СОЗДАЁМ КАРТУ ТОЛЬКО ДЛЯ ЯКОРЕЙ (первые 12 пар)
        const anchorPairs = new Map();
        let anchorCount = 0;
       
        // Сортируем matchMap по pairNumber чтобы взять первые 12
        const sortedMatches = Array.from(matchMap.entries())
            .sort((a, b) => (a[1].pairNumber || 0) - (b[1].pairNumber || 0));
       
        for (const [photoId, match] of sortedMatches) {
            if (match && match.pairNumber && anchorCount < 12) {
                anchorPairs.set(photoId, match.pairNumber);
                anchorCount++;
            }
        }

        console.log(`   🎯 Якорей для отображения на ФОТО: ${anchorPairs.size}`);

        let anchorPoints = 0, matchedPoints = 0, unmatchedPoints = 0;

        for (const point of points) {
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') continue;

            const x = centerX + (point.x - avgX) * scale;
            const y = centerY + (point.y - avgY) * scale;

            // 🔥 Проверяем, является ли точка ЯКОРЕМ
            const pairNumber = anchorPairs.get(point.id);
            const isAnchor = pairNumber !== undefined;
           
            // Проверяем, есть ли вообще пара (не обязательно якорь)
            const hasMatch = matchMap.has(point.id);

            // Цвет
            let color;
            if (isAnchor) {
                color = '#FF0000'; // 🔴 Красный - якорь (совпадает с моделью)
                anchorPoints++;
            } else if (hasMatch) {
                color = '#4CAF50'; // 🟢 Зелёный - есть пара, но не якорь
                matchedPoints++;
            } else {
                color = '#FF9800'; // 🟠 Оранжевый - новая точка
                unmatchedPoints++;
            }

            // Размер (якоря чуть крупнее)
            const size = isAnchor ? 10 : 8;

            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 🔥 РИСУЕМ НОМЕР ТОЛЬКО ДЛЯ ЯКОРЕЙ (1-12)
            if (isAnchor) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
               
                // Белый фон для номера
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(x - 10, y - size - 20, 20, 16);
               
                ctx.fillStyle = '#000000';
                ctx.fillText(pairNumber.toString(), x, y - size - 10);
               
                if (this.config.debug) {
                    console.log(`      Якорь ${pairNumber} на фото: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
                }
            }
        }

        console.log(`   🎯 Фото: 🔴 ${anchorPoints} якорей, 🟢 ${matchedPoints} пар, 🟠 ${unmatchedPoints} новых`);
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

        console.log(`   🔗 Рёбер отрисовано: ${edgesDrawn}`);
    }

    drawStats(ctx, stats, canvasWidth) {
        if (!stats) return;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#343A40';
        ctx.textAlign = 'left';

        const rows = [
            `Узлов: ${stats.totalNodes || 0}`,
            `Рёбер: ${stats.totalEdges || 0}`,
            `Средняя степень: ${stats.avgDegree?.toFixed(2) || '?'}`,
            `🔴 Якорей (первые 12): 12`,
            `🔴 3+ подтверждений: ${stats.confirmed3 || 0}`,
            `🟡 2 подтверждения: ${stats.confirmed2 || 0}`,
            `🔵 1 подтверждение: ${stats.confirmed1 || 0}`,
            `⚪ 0 подтверждений: ${stats.confirmed0 || 0}`
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
            `Узлов в фото: ${stats.totalNodes || 0}`,
            `🔴 Якорей (первые 12): 12`,
            `✅ Сопоставлено всего: ${matchedCount || 0}`,
            `🟠 Новых: ${(stats.totalNodes || 0) - (matchedCount || 0)}`
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

        const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
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
        return Math.min(targetWidth / width, targetHeight / height, 3);
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
            report += `• Якорей: 12\n`;
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
