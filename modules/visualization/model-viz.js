// modules/visualization/model-viz.js
// 🏗️ ВИЗУАЛИЗАЦИЯ ИТОГОВОЙ МОДЕЛИ С ТРАНСФОРМИРОВАННЫМ ФОТО

const { createCanvas } = require('canvas');
const path = require('path');
const fs = require('fs');

class ModelVisualization {
    constructor() {
        this.styleName = 'model';
        this.version = '2.0';
        console.log('🏗️ ModelVisualization для продакшена создан');
    }

    /**
     * Создаёт визуализацию модели с наложенным трансформированным фото
     * @param {Object} options - параметры визуализации
     * @returns {string} - путь к файлу
     */
    async createVisualization(options = {}) {
    try {
        const {
            points = [],
            photoPoints = [],
            transform = null,
            matches = new Map(),
            edges = [],
            triangles = [],
            structures = [],
            pointToStructure = new Map(),  // 🔥 ОДНО ОБЪЯВЛЕНИЕ
            width = 1200,
            height = 1000,
            padding = 50,
            outputPath = null
        } = options;

        if (!points || points.length === 0) {
            console.log('⚠️ Нет точек модели для визуализации');
            return null;
        }

        console.log(`   📊 Точек модели: ${points.length}`);
        console.log(`   📸 Точек фото: ${photoPoints?.length || 0}`);
        console.log(`   🔄 Трансформация: ${transform ? 'есть' : 'нет'}`);
        console.log(`   🔗 Соответствий: ${matches.size}`);
        console.log(`   🔍 pointToStructure содержит ${pointToStructure.size} записей`);

            // Применяем трансформацию к точкам фото, если она есть
            let transformedPhotoPoints = [];
if (transform && photoPoints && photoPoints.length > 0) {
    console.log(`   🔄 Применяю трансформацию к ${photoPoints.length} точкам фото:`);
    console.log(`      Масштаб: ${transform.scale.toFixed(3)}`);
    console.log(`      Поворот: ${(transform.rotation * 180 / Math.PI).toFixed(1)}°`);
   
    transformedPhotoPoints = photoPoints.map(p => ({
        ...p,
        originalX: p.x,
        originalY: p.y,
        transformed: this.applyTransform(p, transform)
    }));
   
    // Для отладки покажем первую точку
    if (transformedPhotoPoints[0]) {
        console.log(`      Пример трансформации:`);
        console.log(`         Исходная: (${transformedPhotoPoints[0].originalX.toFixed(0)}, ${transformedPhotoPoints[0].originalY.toFixed(0)})`);
        console.log(`         После: (${transformedPhotoPoints[0].transformed.x.toFixed(0)}, ${transformedPhotoPoints[0].transformed.y.toFixed(0)})`);
    }
}

            // Вычисляем общие границы для всех точек (модель + трансформированное фото)
            const allPoints = [
                ...points,
                ...transformedPhotoPoints.map(p => ({
                    x: p.transformed.x,
                    y: p.transformed.y
                }))
            ];
           
            const bounds = this.calculateBounds(allPoints, padding);
            const scale = this.calculateScale(bounds, width, height, padding);

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Фон
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);

           // 🔥 СОЗДАЁМ КАРТУ pointId → structureId (с защитой)
console.log(`   🔍 structures: ${structures.length} шт`);
if (structures.length > 0) {
    console.log(`   🔍 Первая структура:`, JSON.stringify(structures[0], null, 2).substring(0, 500));
}
      
// const pointToStructure = new Map();
for (const structure of structures) {
    const pointIds = Array.isArray(structure.pointIds) ? structure.pointIds : [];
    for (const pointId of pointIds) {
        pointToStructure.set(pointId, structure.id);
    }
}

// Находим главную структуру (самую большую)
let mainStructureId = null;
let maxPoints = 0;
for (const structure of structures) {
    const pointCount = structure.pointCount || (Array.isArray(structure.pointIds) ? structure.pointIds.length : 0);
    if (pointCount > maxPoints) {
        maxPoints = pointCount;
        mainStructureId = structure.id;
    }
}
       
        // 🔥 РИСУЕМ ТРЕУГОЛЬНИКИ (ПОД ТОЧКАМИ, НАД РЁБРАМИ)
        if (triangles.length > 0) {
    console.log(`   🔺 Рисую ${triangles.length} треугольников...`);
    let colored = 0;
   
    for (const triangle of triangles) {
        const p1 = points.find(p => p.id === triangle.p1.id);
        const p2 = points.find(p => p.id === triangle.p2.id);
        const p3 = points.find(p => p.id === triangle.p3.id);
       
        if (!p1 || !p2 || !p3) continue;
       
        const structId1 = pointToStructure.get(p1.id);
        const structId2 = pointToStructure.get(p2.id);
        const structId3 = pointToStructure.get(p3.id);
       
        let color = '#AAAAAA';
       
        if (structId1 && structId1 === structId2 && structId1 === structId3) {
            const isMain = structId1 === mainStructureId;
            color = isMain ? '#FF0000' : '#FFA500';
            colored++;
        }
               
                const x1 = this.projectX(p1.x, bounds, scale, width);
                const y1 = this.projectY(p1.y, bounds, scale, height);
                const x2 = this.projectX(p2.x, bounds, scale, width);
                const y2 = this.projectY(p2.y, bounds, scale, height);
                const x3 = this.projectX(p3.x, bounds, scale, width);
                const y3 = this.projectY(p3.y, bounds, scale, height);
               
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineTo(x3, y3);
                ctx.closePath();
               
                ctx.fillStyle = color + '40'; // полупрозрачная заливка
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
             console.log(`   🎨 Цветных треугольников: ${colored}/${triangles.length}`); 
        }
       
        // Рисуем рёбра (поверх треугольников, чтобы рёбра были видны)
        this.drawEdges(ctx, edges, points, bounds, scale, width, height);
       
        // Рисуем точки модели (поверх всего)
        this.drawModelPoints(ctx, points, matches, bounds, scale, width, height);

            // Рисуем трансформированные точки фото
            if (transformedPhotoPoints.length > 0) {
                this.drawTransformedPhotoPoints(ctx, transformedPhotoPoints, matches, bounds, scale, width, height);
            }

            // Рисуем легенду
            this.drawLegend(ctx, width, height, transform);

            // Сохраняем
            const finalOutputPath = outputPath ||
                path.join(this.ensureOutputDir(), `model_overlay_${Date.now()}.png`);
           
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(finalOutputPath, buffer);

            console.log(`✅ Модель с наложением сохранена: ${finalOutputPath}`);
            return finalOutputPath;

        } catch (error) {
            console.log('❌ Ошибка создания визуализации модели:', error.message);
            console.log(error.stack);
            return null;
        }
    }

    /**
     * Применяет преобразование к точке
     */
    applyTransform(point, transform) {
        const { scale, rotation, translation } = transform;
       
        // Поворот и масштаб
        const xRot = point.x * Math.cos(rotation) - point.y * Math.sin(rotation);
        const yRot = point.x * Math.sin(rotation) + point.y * Math.cos(rotation);
       
        // Масштаб и сдвиг
        return {
            x: xRot * scale + translation.x,
            y: yRot * scale + translation.y
        };
    }

    /**
     * Рисует точки модели
     */
    drawModelPoints(ctx, points, matches, bounds, scale, width, height) {
        // Создаём Set сопоставленных точек модели
        const matchedModelPoints = new Set();
        for (const [photoId, match] of matches) {
            if (match && match.modelId) {
                matchedModelPoints.add(match.modelId);
            }
        }

        let stats = { red: 0, orange: 0, yellow: 0, blue: 0, gray: 0, matched: 0 };

        for (const point of points) {
            const x = this.projectX(point.x, bounds, scale, width);
            const y = this.projectY(point.y, bounds, scale, height);

            const confirmations = point.confirmationCount || 0;
            const isMatched = matchedModelPoints.has(point.id);
           
            // Определяем цвет по количеству подтверждений
            let color;
            let size;
           
            if (isMatched) {
                color = '#FFD700'; // Золотой для сопоставленных точек модели
                size = 8;
                stats.matched++;
            } else if (confirmations >= 11) {
                color = '#FF0000'; // Красный
                size = 8;
                stats.red++;
            } else if (confirmations >= 5) {
                color = '#FFA500'; // Оранжевый
                size = 7;
                stats.orange++;
            } else if (confirmations >= 2) {
                color = '#FFD700'; // Жёлтый
                size = 6;
                stats.yellow++;
            } else if (confirmations >= 1) {
                color = '#4169E1'; // Синий
                size = 5;
                stats.blue++;
            } else {
                color = '#808080'; // Серый
                size = 4;
                stats.gray++;
            }

            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
           
            // Белая обводка для контраста
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Для красных точек добавляем номер
            if (confirmations >= 11 && point.pairNumber) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.pairNumber.toString(), x, y);
            }
        }

        console.log(`   📊 Модель: красных ${stats.red}, оранж ${stats.orange}, жёлт ${stats.yellow}, син ${stats.blue}, сер ${stats.gray}, сопоставлено ${stats.matched}`);
    }

    /**
     * Рисует трансформированные точки фото
     */
    drawTransformedPhotoPoints(ctx, photoPoints, matches, bounds, scale, width, height) {
        // Создаём карту соответствий для быстрого доступа
        const matchMap = new Map();
        for (const [photoId, match] of matches) {
            matchMap.set(photoId, match);
        }

        let stats = { matched: 0, unmatched: 0 };

        for (const point of photoPoints) {
            const hasMatch = matchMap.has(point.id);
            const tx = point.transformed.x;
            const ty = point.transformed.y;
           
            const x = this.projectX(tx, bounds, scale, width);
            const y = this.projectY(ty, bounds, scale, height);

            if (hasMatch) {
                // Сопоставленная точка - фиолетовая
                ctx.fillStyle = '#AA00FF';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, 2 * Math.PI);
                ctx.fill();
               
                // Белая обводка
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1;
                ctx.stroke();
               
                // Номер пары
                const match = matchMap.get(point.id);
                if (match && match.pairNumber) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = 'bold 8px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(match.pairNumber.toString(), x, y);
                }
               
                stats.matched++;
            } else {
                // Несопоставленная точка - полупрозрачная синяя
                ctx.fillStyle = 'rgba(65, 105, 225, 0.5)'; // Полупрозрачный синий
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fill();
               
                stats.unmatched++;
            }
        }

        console.log(`   📸 Фото: сопоставлено ${stats.matched}, не сопоставлено ${stats.unmatched}`);
    }

    /**
     * Рисует рёбра графа
     */
    drawEdges(ctx, edges, points, bounds, scale, width, height) {
        if (!edges || edges.length === 0) return;

        const pointsMap = new Map();
        points.forEach(p => pointsMap.set(p.id, p));

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        let drawn = 0;
        for (const edge of edges) {
            const [id1, id2] = edge.split('--');
            const p1 = pointsMap.get(id1);
            const p2 = pointsMap.get(id2);

            if (!p1 || !p2) continue;

            const x1 = this.projectX(p1.x, bounds, scale, width);
            const y1 = this.projectY(p1.y, bounds, scale, height);
            const x2 = this.projectX(p2.x, bounds, scale, width);
            const y2 = this.projectY(p2.y, bounds, scale, height);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            drawn++;
        }
       
        if (drawn > 0) {
            console.log(`   🔗 Нарисовано рёбер: ${drawn}`);
        }
    }

    /**
     * Рисует легенду
     */
    drawLegend(ctx, width, height, transform) {
        const legendX = width - 300;
        const legendY = 30;
        const lineHeight = 22;

        // Полупрозрачный фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(legendX - 15, legendY - 15, 280, transform ? 240 : 200);

        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('🏗️ МОДЕЛЬ С НАЛОЖЕНИЕМ', legendX, legendY);

        // Точки модели
        this.drawLegendItem(ctx, legendX, legendY + lineHeight, '#FF0000', 'Модель: 11+ подтверждений');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 2, '#FFA500', 'Модель: 5-10 подтверждений');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 3, '#FFD700', 'Модель: 2-4 подтверждения');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 4, '#4169E1', 'Модель: 1 подтверждение');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 5, '#808080', 'Модель: 0 подтверждений');

        // Точки фото
        ctx.fillStyle = '#AA00FF';
        ctx.beginPath();
        ctx.arc(legendX + 7, legendY + lineHeight * 6 - 8, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText('Фото: сопоставлено', legendX + 20, legendY + lineHeight * 6 - 5);

        ctx.fillStyle = 'rgba(65, 105, 225, 0.5)';
        ctx.beginPath();
        ctx.arc(legendX + 7, legendY + lineHeight * 7 - 8, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText('Фото: не сопоставлено', legendX + 20, legendY + lineHeight * 7 - 5);

        // Информация о трансформации
        if (transform) {
            ctx.font = '11px Arial';
            ctx.fillStyle = '#AAAAAA';
            ctx.fillText(`Масштаб: ${transform.scale.toFixed(3)}`, legendX, legendY + lineHeight * 8);
            ctx.fillText(`Поворот: ${(transform.rotation * 180 / Math.PI).toFixed(1)}°`, legendX, legendY + lineHeight * 9);
            ctx.fillText(`Сдвиг: (${transform.translation.x.toFixed(0)}, ${transform.translation.y.toFixed(0)})`, legendX, legendY + lineHeight * 10);
        }
    }

    drawLegendItem(ctx, x, y, color, text) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + 7, y - 8, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText(text, x + 20, y - 5);
    }

    projectX(x, bounds, scale, width) {
        return (x - bounds.minX) * scale + 50;
    }

    projectY(y, bounds, scale, height) {
        return (y - bounds.minY) * scale + 50;
    }

    calculateBounds(points, padding) {
        if (points.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
       
        minX -= rangeX * 0.1;
        maxX += rangeX * 0.1;
        minY -= rangeY * 0.1;
        maxY += rangeY * 0.1;

        return { minX, maxX, minY, maxY };
    }

    calculateScale(bounds, width, height, padding) {
        const rangeX = bounds.maxX - bounds.minX;
        const rangeY = bounds.maxY - bounds.minY;
       
        if (rangeX === 0 || rangeY === 0) return 1;
       
        const scaleX = (width - padding * 2) / rangeX;
        const scaleY = (height - padding * 2) / rangeY;
        return Math.min(scaleX, scaleY, 15);
    }

    ensureOutputDir() {
        const dir = path.join(__dirname, '../../data/footprints/visualizations/models');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }
}

module.exports = ModelVisualization;
