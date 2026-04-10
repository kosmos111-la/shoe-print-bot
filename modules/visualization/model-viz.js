// modules/visualization/model-viz.js
// 🏗️ ВИЗУАЛИЗАЦИЯ ИТОГОВОЙ МОДЕЛИ С ТРАНСФОРМИРОВАННЫМ ФОТО
// 🔥 ДОБАВЛЕНА ОТРИСОВКА ВСЕХ КОНТУРОВ ПРОТЕКТОРОВ

const { createCanvas } = require('canvas');
const path = require('path');
const fs = require('fs');

class ModelVisualization {
    constructor() {
        this.styleName = 'model';
        this.version = '2.1'; // 🔥 Версия обновлена
        console.log('🏗️ ModelVisualization для продакшена создан (с контурами протекторов)');
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
                pointToStructure = new Map(),
                outlineContour = null,
                photoOutlineContour = null,
                width = 1200,
                height = 1000,
                padding = 50,
                outputPath = null
            } = options;

            // ========== ДИАГНОСТИКА ==========
            console.log(`\n🔍 createVisualization: получены данные`);
            console.log(`   points.length: ${points.length}`);
           
            let redCount = 0, orangeCount = 0, yellowCount = 0, blueCount = 0, grayCount = 0;
            let pointsWithContour = 0;
            let totalHistoryContours = 0;
           
            for (const point of points) {
                const confirmations = point.confirmationCount || 0;
                if (confirmations >= 4) redCount++;
                else if (confirmations === 3) orangeCount++;
                else if (confirmations === 2) yellowCount++;
                else if (confirmations === 1) blueCount++;
                else grayCount++;
               
                if (point.morphology?.contour && point.morphology.contour.length > 0) {
                    pointsWithContour++;
                }
                if (point.sourceContours && point.sourceContours.length > 0) {
                    totalHistoryContours += point.sourceContours.length;
                }
            }
           
            console.log(`   Статистика ПОЛУЧЕННЫХ точек: красных ${redCount}, оранж ${orangeCount}, жёлт ${yellowCount}, син ${blueCount}, сер ${grayCount}`);
            console.log(`   Точек с контурами: ${pointsWithContour}/${points.length}`);
            console.log(`   Всего исторических контуров: ${totalHistoryContours}`);
            console.log(`   matches.size: ${matches.size}`);
            console.log(`   triangles.length: ${triangles.length}`);
            console.log(`   structures.length: ${structures.length}`);
           
            // 🔥 ДИАГНОСТИКА КОНТУРОВ
            if (outlineContour) {
                console.log(`   📐 Контур модели (outline): ${outlineContour.points?.length || 0} точек`);
            }
            if (photoOutlineContour) {
                console.log(`   📐 Контур фото (outline): ${photoOutlineContour.points?.length || 0} точек`);
            }

            if (!points || points.length === 0) {
                console.log('⚠️ Нет точек модели для визуализации');
                return null;
            }

            // Применяем трансформацию к точкам фото, если она есть
            let transformedPhotoPoints = [];
            let transformedPhotoContours = [];
           
            if (transform && photoPoints && photoPoints.length > 0) {
                console.log(`   🔄 Применяю трансформацию к ${photoPoints.length} точкам фото:`);
                console.log(`      Масштаб: ${transform.scale?.toFixed(3) || 'нет'}`);
                console.log(`      Поворот: ${transform.rotation ? (transform.rotation * 180 / Math.PI).toFixed(1) : 'нет'}°`);
               
                transformedPhotoPoints = photoPoints.map(p => ({
                    ...p,
                    originalX: p.x,
                    originalY: p.y,
                    transformed: this.applyTransform(p, transform)
                }));
               
                // 🔥 Трансформируем также контуры протекторов из фото (если есть)
                if (photoPoints.some(p => p.morphology?.contour)) {
                    for (const p of photoPoints) {
                        if (p.morphology?.contour) {
                            transformedPhotoContours.push({
                                pointId: p.id,
                                contour: p.morphology.contour.map(cp => this.applyTransform(cp, transform)),
                                confidence: p.morphology.confidence || p.confidence || 0.5
                            });
                        }
                    }
                }
               
                // Для отладки покажем первую точку
                if (transformedPhotoPoints[0]) {
                    console.log(`      Пример трансформации:`);
                    console.log(`         Исходная: (${transformedPhotoPoints[0].originalX.toFixed(0)}, ${transformedPhotoPoints[0].originalY.toFixed(0)})`);
                    console.log(`         После: (${transformedPhotoPoints[0].transformed.x.toFixed(0)}, ${transformedPhotoPoints[0].transformed.y.toFixed(0)})`);
                }
            }

            // Вычисляем общие границы для всех точек
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

            // 🔥 СОЗДАЁМ КАРТУ pointId → structureId
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
                   
                    ctx.fillStyle = color + '40';
                    ctx.fill();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                console.log(`   🎨 Цветных треугольников: ${colored}/${triangles.length}`);
            }

            // 🔥 РИСУЕМ КОНТУР СЛЕДА МОДЕЛИ (пунктиром)
            if (outlineContour && outlineContour.points) {
                console.log(`   🎨 Рисую контур модели (outline): ${outlineContour.points.length} точек`);
                this.drawFootprintContour(ctx, outlineContour.points, bounds, scale, width, height, false);
            }

            // 🔥 РИСУЕМ КОНТУР СЛЕДА ФОТО (пунктиром)
            if (photoOutlineContour && photoOutlineContour.points && transform) {
                const transformedPoints = photoOutlineContour.points.map(p => this.applyTransform(p, transform));
                console.log(`   🎨 Рисую контур фото (outline, трансформированный): ${transformedPoints.length} точек`);
                this.drawFootprintContour(ctx, transformedPoints, bounds, scale, width, height, true);
            }

            // 🔥 РИСУЕМ ВСЕ КОНТУРЫ ПРОТЕКТОРОВ (ИСТОРИЮ) - ТОНКИЕ ЛИНИИ
            this.drawProtectorContoursHistory(ctx, points, transformedPhotoContours, bounds, scale, width, height);

            // 🔥 РИСУЕМ ФИНАЛЬНЫЕ КОНТУРЫ ПРОТЕКТОРОВ МОДЕЛИ - ЖИРНЫЕ ЗЕЛЁНЫЕ
            this.drawProtectorContoursFinal(ctx, points, bounds, scale, width, height);

            // Рисуем рёбра (поверх треугольников и контуров)
            this.drawEdges(ctx, edges, points, bounds, scale, width, height);

            // Рисуем точки модели (поверх всего)
            this.drawModelPoints(ctx, points, matches, bounds, scale, width, height);

            // Рисуем трансформированные точки фото
            if (transformedPhotoPoints.length > 0) {
                this.drawTransformedPhotoPoints(ctx, transformedPhotoPoints, matches, bounds, scale, width, height);
            }

            // Рисуем легенду
            this.drawLegend(ctx, width, height, transform, pointsWithContour > 0);

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
        if (!transform) return { x: point.x, y: point.y };
       
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
     * 🔥 НОВОЕ: Рисует ВСЕ контуры протекторов из истории (тонкие линии)
     */
    drawProtectorContoursHistory(ctx, modelPoints, photoContours, bounds, scale, width, height) {
        let historyDrawn = 0;
        let photoContoursDrawn = 0;
       
        // 1. Рисуем исторические контуры из модели
        for (const point of modelPoints) {
            const history = point.sourceContours;
            if (!history || history.length === 0) continue;
           
            for (const item of history) {
                if (!item.points || item.points.length < 3) continue;
               
                // 🔥 ЯРКИЕ ЦВЕТА ДЛЯ ИСТОРИИ
                if (item.type === 'model_existing') {
                    ctx.strokeStyle = '#888888'; // Серый, непрозрачный
                } else if (item.type === 'photo_new') {
                    ctx.strokeStyle = '#D2B48C'; // Бежевый (тан), непрозрачный
                } else {
                    ctx.strokeStyle = '#AAAAAA';
                }
               
                ctx.lineWidth = 1.2; // Чуть толще для видимости
                this.drawPolygon(ctx, item.points, bounds, scale, width, height);
                historyDrawn++;
            }
        }
       
        // 2. Рисуем контуры из текущего фото (если есть)
        if (photoContours && photoContours.length > 0) {
            ctx.strokeStyle = '#AA00FF'; // Фиолетовый, непрозрачный
            ctx.lineWidth = 1.2;
           
            for (const pc of photoContours) {
                if (pc.contour && pc.contour.length >= 3) {
                    this.drawPolygon(ctx, pc.contour, bounds, scale, width, height);
                    photoContoursDrawn++;
                }
            }
        }
       
        if (historyDrawn > 0 || photoContoursDrawn > 0) {
            console.log(`   📜 Исторических контуров: ${historyDrawn} из модели, ${photoContoursDrawn} из текущего фото`);
        }
    }

    /**
     * 🔥 НОВОЕ: Рисует ФИНАЛЬНЫЕ контуры протекторов (жирные зелёные)
     */
    drawProtectorContoursFinal(ctx, modelPoints, bounds, scale, width, height) {
        let finalDrawn = 0;
       
        ctx.save();
        ctx.strokeStyle = '#00FF00'; // Ярко-зелёный
        ctx.lineWidth = 2.5; // Жирная линия
       
        for (const point of modelPoints) {
            const contour = point.morphology?.contour;
            if (!contour || contour.length < 3) continue;
           
            this.drawPolygon(ctx, contour, bounds, scale, width, height);
           
            // Добавляем очень слабую заливку
            ctx.fillStyle = 'rgba(0, 255, 0, 0.04)';
            ctx.fill();
           
            finalDrawn++;
        }
       
        ctx.restore();
       
        if (finalDrawn > 0) {
            console.log(`   🟢 Финальных контуров модели: ${finalDrawn}`);
        }
    }

    /**
     * Рисует полигон (контур)
     */
    drawPolygon(ctx, points, bounds, scale, width, height) {
        if (!points || points.length < 3) return;
       
        ctx.beginPath();
        const first = this.project(points[0], bounds, scale, width, height);
        ctx.moveTo(first.x, first.y);
       
        for (let i = 1; i < points.length; i++) {
            const p = this.project(points[i], bounds, scale, width, height);
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    /**
     * Проецирует точку на canvas
     */
    project(p, bounds, scale, width, height) {
        return {
            x: this.projectX(p.x, bounds, scale, width),
            y: this.projectY(p.y, bounds, scale, height)
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

        let stats = { red: 0, orange: 0, yellow: 0, blue: 0, gray: 0 };

        for (const point of points) {
            const x = this.projectX(point.x, bounds, scale, width);
            const y = this.projectY(point.y, bounds, scale, height);

            const confirmations = point.confirmationCount || 0;

            let color, size;

            if (confirmations >= 4) {
                color = '#FF0000';
                size = 8;
                stats.red++;
            } else if (confirmations >= 3) {
                color = '#FFA500';
                size = 7;
                stats.orange++;
            } else if (confirmations >= 2) {
                color = '#FFD700';
                size = 6;
                stats.yellow++;
            } else if (confirmations >= 1) {
                color = '#4169E1';
                size = 5;
                stats.blue++;
            } else {
                color = '#808080';
                size = 4;
                stats.gray++;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
           
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        console.log(`   📊 Модель: красных ${stats.red}, оранж ${stats.orange}, жёлт ${stats.yellow}, син ${stats.blue}, сер ${stats.gray}`);
    }

    /**
     * Рисует трансформированные точки фото
     */
    drawTransformedPhotoPoints(ctx, photoPoints, matches, bounds, scale, width, height) {
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
                ctx.fillStyle = '#AA00FF';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, 2 * Math.PI);
                ctx.fill();
               
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1;
                ctx.stroke();
               
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
                ctx.fillStyle = 'rgba(65, 105, 225, 0.5)';
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

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
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
     * Рисует контур следа (пунктирной линией)
     */
    drawFootprintContour(ctx, points, bounds, scale, width, height, isPhoto = false) {
        if (!points || points.length < 3) return;

        const transformedPoints = points.map(p => ({
            x: this.projectX(p.x, bounds, scale, width),
            y: this.projectY(p.y, bounds, scale, height)
        }));

        ctx.beginPath();
        ctx.moveTo(transformedPoints[0].x, transformedPoints[0].y);
        for (let i = 1; i < transformedPoints.length; i++) {
            ctx.lineTo(transformedPoints[i].x, transformedPoints[i].y);
        }
        ctx.closePath();

        ctx.strokeStyle = isPhoto ? '#AA00FF' : '#00AAFF';
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
       
        ctx.fillStyle = isPhoto ? 'rgba(170, 0, 255, 0.04)' : 'rgba(0, 170, 255, 0.04)';
        ctx.fill();
    }

    /**
     * Рисует легенду
     */
    drawLegend(ctx, width, height, transform, hasContours = false) {
        const legendX = width - 300;
        const legendY = 30;
        const lineHeight = 22;

        let legendHeight = 220;
        if (transform) legendHeight += 70;
        if (hasContours) legendHeight += 50; // Увеличиваем для новых элементов

        // Полупрозрачный фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(legendX - 15, legendY - 15, 280, legendHeight);

        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('🏗️ МОДЕЛЬ С НАЛОЖЕНИЕМ', legendX, legendY);

        let currentY = legendY + lineHeight;

        // Точки модели
        this.drawLegendItem(ctx, legendX, currentY, '#FF0000', '🔴 4+ фото (очень надёжно)');
        currentY += lineHeight;
        this.drawLegendItem(ctx, legendX, currentY, '#FFA500', '🟠 3 фото (надёжно)');
        currentY += lineHeight;
        this.drawLegendItem(ctx, legendX, currentY, '#FFD700', '🟡 2 фото (подтверждено)');
        currentY += lineHeight;
        this.drawLegendItem(ctx, legendX, currentY, '#4169E1', '🔵 1 фото (новое)');
        currentY += lineHeight;
        this.drawLegendItem(ctx, legendX, currentY, '#808080', '⚪ 0 фото (ожидание)');
        currentY += lineHeight;

        // Точки фото
        ctx.fillStyle = '#AA00FF';
        ctx.beginPath();
        ctx.arc(legendX + 7, currentY - 8, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText('Фото: сопоставлено', legendX + 20, currentY - 5);
        currentY += lineHeight;

        ctx.fillStyle = 'rgba(65, 105, 225, 0.5)';
        ctx.beginPath();
        ctx.arc(legendX + 7, currentY - 8, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText('Фото: не сопоставлено', legendX + 20, currentY - 5);
        currentY += lineHeight;

        // 🔥 НОВОЕ: Контуры в легенде
        if (hasContours) {
            // Финальный контур (зелёный)
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(legendX, currentY - 8);
            ctx.lineTo(legendX + 14, currentY - 8);
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.fillText('🟢 Финальный контур модели', legendX + 20, currentY - 5);
            currentY += lineHeight;

            // Исторический контур (серый)
            ctx.strokeStyle = '#888888';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(legendX, currentY - 8);
            ctx.lineTo(legendX + 14, currentY - 8);
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.fillText('📜 История (предыдущие фото)', legendX + 20, currentY - 5);
            currentY += lineHeight;

            // Контур из текущего фото (фиолетовый)
            ctx.strokeStyle = '#AA00FF';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(legendX, currentY - 8);
            ctx.lineTo(legendX + 14, currentY - 8);
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.fillText('🟣 Текущее фото (трансформировано)', legendX + 20, currentY - 5);
            currentY += lineHeight;
        }

        // Информация о трансформации
        if (transform) {
            ctx.font = '11px Arial';
            ctx.fillStyle = '#AAAAAA';
            ctx.fillText(`Масштаб: ${transform.scale?.toFixed(3) || 'нет'}`, legendX, currentY);
            currentY += lineHeight;
            ctx.fillText(`Поворот: ${transform.rotation ? (transform.rotation * 180 / Math.PI).toFixed(1) : 'нет'}°`, legendX, currentY);
            currentY += lineHeight;
            ctx.fillText(`Сдвиг: (${transform.translation?.x?.toFixed(0) || 0}, ${transform.translation?.y?.toFixed(0) || 0})`, legendX, currentY);
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
            if (p.x === undefined || p.y === undefined) continue;
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        if (minX === Infinity) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
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
