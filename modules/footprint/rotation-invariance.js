// modules/footprint/rotation-invariance.js
// 🔥 ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ - ВСЕ МЕТОДЫ ВКЛЮЧЕНЫ

const fs = require('fs');
const path = require('path');

class RotationInvariance {
    constructor(options = {}) {
        this.config = {
            debug: options.debug || false,
            autoCorrect: options.autoCorrect !== false,
            enablePCA: options.enablePCA !== false,
            normalizationMethod: options.normalizationMethod || 'nose_direction',
            ...options
        };
       
        this.stats = {
            processedGraphs: 0,
            totalRotations: 0,
            lastError: null
        };
       
        console.log(`🚀 RotationInvariance инициализирован (исправленная версия)`);
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Нормализация к каноническому виду
    normalizeToCanonical(graph, options = {}) {
        console.log(`\n🔄 НОРМАЛИЗАЦИЯ СЛЕДА: "${graph.name || graph.id}"`);
        this.stats.processedGraphs++;
       
        try {
            const startTime = Date.now();
           
            // 1. Получаем все точки
            const points = [];
            for (const [id, node] of graph.nodes) {
                points.push({ x: node.x, y: node.y, id, nodeId: id });
            }
           
            if (points.length < this.config.minPoints || points.length < 5) {
                console.log(`⚠️ Слишком мало точек: ${points.length}`);
                return this.createDefaultResult(graph);
            }
           
            console.log(`📊 Обрабатываю ${points.length} точек`);
           
            // 2. Определяем текущее состояние
            const bounds = this.calculateBounds(points);
            const center = this.calculateCenter(points);
            const ratio = bounds.width / Math.max(1, bounds.height);
           
            console.log(`📏 Размеры: ${bounds.width.toFixed(1)}x${bounds.height.toFixed(1)} (соотношение: ${ratio.toFixed(2)})`);
            console.log(`📐 Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
           
            // 3. Определяем направление мыска (НОВЫЙ ИСПРАВЛЕННЫЙ МЕТОД)
            let noseAngle = 0;
           
            if (this.config.normalizationMethod === 'nose_direction') {
                // 🔥 ИСПРАВЛЕННЫЙ АЛГОРИТМ: Определяем где нос
                noseAngle = this.findNoseDirectionEnhanced(points);
            } else {
                // Старый метод PCA (для совместимости)
                noseAngle = this.calculatePrincipalAngleFromPoints(points);
            }
           
            console.log(`🎯 Угол мыска: ${noseAngle.toFixed(1)}°`);
           
            // 4. Конвертируем в часы циферблата
            const clockHours = this.degreesToClockHours(noseAngle);
            console.log(`🕐 Мысок смотрит на: ${clockHours} часов`);
           
            // 5. 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Вычисляем необходимый поворот
            let targetRotation = this.calculateRequiredRotation(clockHours, noseAngle);
           
            // 6. Нормализуем угол к диапазону -180..180
            if (targetRotation > 180) targetRotation -= 360;
            if (targetRotation < -180) targetRotation += 360;
           
            console.log(`📐 Необходимый поворот: ${targetRotation.toFixed(1)}°`);
           
            // 7. Создаем трансформацию
            const transformation = this.createRotationTransformation(targetRotation, center);
           
            // 8. Применяем поворот
            const rotatedGraph = this.applyRotationToGraph(graph, transformation);
           
            // 9. Проверяем результат
            const rotatedPoints = Array.from(rotatedGraph.nodes.values())
                .map(node => ({ x: node.x, y: node.y }));
           
            const finalNoseAngle = this.findNoseDirectionEnhanced(rotatedPoints);
            const finalHours = this.degreesToClockHours(finalNoseAngle);
           
            console.log(`🎯 Результат: мысок на ${finalHours} часов (${finalNoseAngle.toFixed(1)}°)`);
           
            // 10. Если не точно - дополнительная коррекция
            let finalGraph = rotatedGraph;
            let finalTransformation = transformation;
           
            const needsCorrection = Math.abs(finalNoseAngle) > 15 && Math.abs(finalNoseAngle - 180) > 15;
           
            if (needsCorrection && this.config.autoCorrect) {
                console.log(`⚠️ Требуется коррекция (отклонение: ${Math.abs(finalNoseAngle).toFixed(1)}°)`);
               
                const correction = -finalNoseAngle;
                const correctionTransform = this.createRotationTransformation(correction, center);
               
                finalGraph = this.applyRotationToGraph(rotatedGraph, correctionTransform);
                finalTransformation.rotationAngle += correction;
                finalTransformation.correctionApplied = true;
               
                console.log(`✅ Коррекция ${correction.toFixed(1)}° применена`);
            }
           
            // 11. Определяем тип стопы
            const footType = this.determineFootType(finalGraph);
           
            // 12. Логируем статистику
            const elapsed = Date.now() - startTime;
            this.stats.totalRotations++;
           
            console.log(`✅ Нормализация завершена за ${elapsed}ms`);
            console.log(`   Итоговый угол: ${finalTransformation.rotationAngle.toFixed(1)}°`);
            console.log(`   Тип стопы: ${footType}`);
           
            return {
                graph: finalGraph,
                rotationAngle: finalTransformation.rotationAngle,
                isMirrored: false,
                transformation: finalTransformation,
                footType: footType,
                stats: {
                    originalPoints: points.length,
                    originalAngle: noseAngle,
                    originalHours: clockHours,
                    finalHours: finalHours,
                    correctionApplied: finalTransformation.correctionApplied || false,
                    processingTime: elapsed
                }
            };
           
        } catch (error) {
            console.log(`❌ Ошибка нормализации: ${error.message}`);
            this.stats.lastError = error.message;
           
            return this.createDefaultResult(graph);
        }
    }

    // 🔥 НАЙТИ НАПРАВЛЕНИЕ МЫСКА (улучшенный)
    findNoseDirectionEnhanced(points) {
        if (points.length < 5) return 0;
       
        try {
            // Метод 1: Выпуклая оболочка + самая дальняя точка
            const hull = this.computeConvexHull(points);
            const center = this.calculateCenter(points);
           
            // Ищем точку с максимальным расстоянием от центра
            let maxDistance = 0;
            let nosePoint = hull[0];
           
            for (const point of hull) {
                const dx = point.x - center.x;
                const dy = point.y - center.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance > maxDistance) {
                    maxDistance = distance;
                    nosePoint = point;
                }
            }
           
            // Угол от центра к носу
            const dx = nosePoint.x - center.x;
            const dy = nosePoint.y - center.y;
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
           
            // Метод 2: Проверяем по распределению точек
            const distribution = this.analyzePointDistribution(points);
           
            // Если нос неясен - используем PCA
            if (distribution.confidence < 0.7) {
                const pcaAngle = this.calculatePrincipalAngleFromPoints(points);
                console.log(`   📊 Нос неясен, использую PCA: ${pcaAngle.toFixed(1)}°`);
                return pcaAngle;
            }
           
            if (this.config.debug) {
                console.log(`   👃 Нос: (${nosePoint.x.toFixed(1)}, ${nosePoint.y.toFixed(1)})`);
                console.log(`   📏 Расстояние: ${maxDistance.toFixed(1)}px`);
                console.log(`   📐 Угол: ${angle.toFixed(1)}°`);
                console.log(`   🎯 Уверенность: ${distribution.confidence.toFixed(2)}`);
            }
           
            return angle;
           
        } catch (error) {
            console.log(`⚠️ Ошибка findNoseDirection: ${error.message}`);
            return this.calculatePrincipalAngleFromPoints(points);
        }
    }

    // 🔥 ВЫЧИСЛИТЬ НЕОБХОДИМЫЙ ПОВОРОТ (по часам)
    calculateRequiredRotation(clockHours, currentAngle) {
        // Всегда приводим к горизонтальному следу с мыском вправо (3 часа)
       
        if (clockHours >= 10.5 || clockHours < 1.5) {
            // 11, 12, 1 часов → Мысок вверх/вверх-вправо
            // Нужно повернуть так, чтобы 12 часов → 3 часа
            return -currentAngle + 90; // 90° → 0°
        }
        else if (clockHours >= 1.5 && clockHours < 4.5) {
            // 2, 3, 4 часов → Мысок вправо/вправо-вверх
            // Уже почти правильно, минимальный поворот к 0°
            return -currentAngle;
        }
        else if (clockHours >= 4.5 && clockHours < 7.5) {
            // 5, 6, 7 часов → Мысок вниз/вниз-вправо
            // Нужно повернуть так, чтобы 6 часов → 3 часа
            return -currentAngle - 90; // 270° → 0°
        }
        else if (clockHours >= 7.5 && clockHours < 10.5) {
            // 8, 9, 10 часов → Мысок влево/влево-вверх
            // Нужно повернуть на 180°
            return -currentAngle + 180;
        }
       
        // По умолчанию - минимальный поворот к 0°
        return -currentAngle;
    }

    // 🔥 ГРАДУСЫ → ЧАСЫ ЦИФЕРБЛАТА
    degreesToClockHours(degrees) {
        // 0° = 3 часа (вправо), 90° = 12 часов (вверх)
        // 180° = 9 часов (влево), 270° = 6 часов (вниз)
       
        let normalized = degrees % 360;
        if (normalized < 0) normalized += 360;
       
        // Формула: часы = ((450 - градусы) % 360) / 30
        let hours = ((450 - normalized) % 360) / 30;
       
        // 0 часов = 12 часов
        if (Math.abs(hours) < 0.001) hours = 12;
       
        // Округляем до 0.1
        hours = Math.round(hours * 10) / 10;
       
        return hours;
    }

    // 🔥 ВЫПУКЛАЯ ОБОЛОЧКА (Convex Hull - алгоритм Грэхема)
    computeConvexHull(points) {
        if (points.length <= 3) return [...points];
       
        // 1. Сортируем точки
        const sorted = [...points].sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            return a.y - b.y;
        });
       
        // 2. Нижняя оболочка
        const lower = [];
        for (const point of sorted) {
            while (lower.length >= 2 &&
                   this.cross(lower[lower.length-2], lower[lower.length-1], point) <= 0) {
                lower.pop();
            }
            lower.push(point);
        }
       
        // 3. Верхняя оболочка
        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const point = sorted[i];
            while (upper.length >= 2 &&
                   this.cross(upper[upper.length-2], upper[upper.length-1], point) <= 0) {
                upper.pop();
            }
            upper.push(point);
        }
       
        // 4. Убираем дубликаты
        lower.pop();
        upper.pop();
       
        return [...lower, ...upper];
    }

    // 🔥 ВЕКТОРНОЕ ПРОИЗВЕДЕНИЕ
    cross(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    // 🔥 АНАЛИЗ РАСПРЕДЕЛЕНИЯ ТОЧЕК
    analyzePointDistribution(points) {
        const bounds = this.calculateBounds(points);
        const center = this.calculateCenter(points);
       
        // Разделяем на квадранты
        const quadrants = { q1: 0, q2: 0, q3: 0, q4: 0 };
       
        for (const point of points) {
            if (point.x >= center.x && point.y >= center.y) quadrants.q1++;
            else if (point.x < center.x && point.y >= center.y) quadrants.q2++;
            else if (point.x < center.x && point.y < center.y) quadrants.q3++;
            else quadrants.q4++;
        }
       
        // Находим квадрант с наибольшим количеством точек
        const maxQuadrant = Math.max(quadrants.q1, quadrants.q2, quadrants.q3, quadrants.q4);
        const total = points.length;
        const confidence = maxQuadrant / total;
       
        // Определяем где скорее всего нос
        let noseQuadrant = 'unknown';
        if (maxQuadrant === quadrants.q1) noseQuadrant = 'q1'; // Право-верх
        else if (maxQuadrant === quadrants.q2) noseQuadrant = 'q2'; // Лево-верх
        else if (maxQuadrant === quadrants.q3) noseQuadrant = 'q3'; // Лево-низ
        else noseQuadrant = 'q4'; // Право-низ
       
        return {
            quadrants,
            noseQuadrant,
            confidence,
            center
        };
    }

    // 🔥 PCA ДЛЯ ТОЧЕК
    calculatePrincipalAngleFromPoints(points) {
        if (points.length < 3) return 0;
       
        const center = this.calculateCenter(points);
       
        let sumXX = 0, sumYY = 0, sumXY = 0;
       
        for (const point of points) {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            sumXX += dx * dx;
            sumYY += dy * dy;
            sumXY += dx * dy;
        }
       
        const n = points.length;
        const covXX = sumXX / n;
        const covYY = sumYY / n;
        const covXY = sumXY / n;
       
        // Собственные значения
        const trace = covXX + covYY;
        const det = covXX * covYY - covXY * covXY;
        const discriminant = Math.max(0, trace * trace / 4 - det);
       
        const lambda1 = trace / 2 + Math.sqrt(discriminant);
       
        // Главный собственный вектор
        let vx = lambda1 - covYY;
        let vy = covXY;
       
        const length = Math.sqrt(vx * vx + vy * vy);
        if (length > 0) {
            vx /= length;
            vy /= length;
        } else {
            vx = 1;
            vy = 0;
        }
       
        // Угол главной оси
        let angle = Math.atan2(vy, vx) * 180 / Math.PI;
       
        return angle;
    }

    // 🔥 СОЗДАТЬ ТРАНСФОРМАЦИЮ ПОВОРОТА
    createRotationTransformation(angle, center) {
        const rad = angle * Math.PI / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
       
        // Смещение для вращения вокруг центра
        const tx = center.x - (center.x * cosA - center.y * sinA);
        const ty = center.y - (center.x * sinA + center.y * cosA);
       
        const transformation = {
            matrix: [cosA, sinA, tx, -sinA, cosA, ty, 0, 0, 1],
            rotationAngle: angle,
            center: { ...center },
            cosA: cosA,
            sinA: sinA,
            translation: { x: tx, y: ty },
            timestamp: new Date(),
            type: 'rotation'
        };
       
        if (this.config.debug) {
            console.log(`   📐 Матрица поворота ${angle}°:`);
            console.log(`      [${cosA.toFixed(4)}, ${sinA.toFixed(4)}, ${tx.toFixed(1)}]`);
            console.log(`      [${-sinA.toFixed(4)}, ${cosA.toFixed(4)}, ${ty.toFixed(1)}]`);
        }
       
        return transformation;
    }

    // 🔥 ПРИМЕНИТЬ ПОВОРОТ К ГРАФУ
    applyRotationToGraph(graph, transformation) {
        const { cosA, sinA, center } = transformation;
       
        // Создаем новый граф
        const rotatedGraph = {
            nodes: new Map(),
            edges: new Map(),
            id: graph.id + '_rotated_' + Date.now(),
            name: graph.name ? `${graph.name} (нормализованный)` : 'normalized_graph',
            originalGraphId: graph.id,
            transformation: transformation
        };
       
        // Поворачиваем каждый узел
        for (const [id, node] of graph.nodes) {
            const dx = node.x - center.x;
            const dy = node.y - center.y;
           
            // Применяем матрицу поворота
            const rotatedX = dx * cosA - dy * sinA;
            const rotatedY = dx * sinA + dy * cosA;
           
            // Создаем новый узел
            rotatedGraph.nodes.set(id, {
                ...node,
                x: rotatedX + center.x,
                y: rotatedY + center.y,
                originalX: node.x,
                originalY: node.y,
                transformed: true,
                transformationId: transformation.timestamp
            });
        }
       
        // Копируем ребра
        for (const [id, edge] of graph.edges) {
            rotatedGraph.edges.set(id, { ...edge });
        }
       
        return rotatedGraph;
    }

    // 🔥 ВЫЧИСЛИТЬ ЦЕНТР ТОЧЕК
    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };
       
        let sumX = 0, sumY = 0;
        for (const point of points) {
            sumX += point.x;
            sumY += point.y;
        }
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 🔥 ВЫЧИСЛИТЬ ГРАНИЦЫ
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }

    // 🔥 ОПРЕДЕЛИТЬ ТИП СТОПЫ
    determineFootType(graph) {
        const points = Array.from(graph.nodes.values())
            .map(node => ({ x: node.x, y: node.y }));
       
        if (points.length < 10) return 'unknown';
       
        const bounds = this.calculateBounds(points);
        const center = this.calculateCenter(points);
       
        // Простой эвристический анализ
        let leftCount = 0, rightCount = 0;
       
        for (const point of points) {
            if (point.x < center.x) leftCount++;
            else rightCount++;
        }
       
        const ratio = leftCount / Math.max(1, rightCount);
       
        if (ratio > 1.5) return 'left';
        if (ratio < 0.67) return 'right';
       
        return 'unknown';
    }

    // 🔥 СОЗДАТЬ РЕЗУЛЬТАТ ПО УМОЛЧАНИЮ
    createDefaultResult(graph) {
        return {
            graph: graph,
            rotationAngle: 0,
            isMirrored: false,
            transformation: this.createIdentityTransformation(),
            footType: 'unknown',
            stats: {
                error: this.stats.lastError,
                defaultResult: true
            }
        };
    }

    // 🔥 СОЗДАТЬ ЕДИНИЧНУЮ ТРАНСФОРМАЦИЮ
    createIdentityTransformation() {
        return {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            rotationAngle: 0,
            center: { x: 0, y: 0 },
            cosA: 1,
            sinA: 0,
            translation: { x: 0, y: 0 },
            timestamp: new Date(),
            type: 'identity'
        };
    }

    // 🔥 СТАТИСТИКА
    getStats() {
        return {
            ...this.stats,
            timestamp: new Date()
        };
    }

    // 🔥 СБРОС СТАТИСТИКИ
    resetStats() {
        this.stats = {
            processedGraphs: 0,
            totalRotations: 0,
            lastError: null
        };
    }

    // 🔥 ТЕСТОВЫЙ МЕТОД
    testOrientation(points) {
        console.log(`\n🧪 ТЕСТ ОРИЕНТАЦИИ:`);
       
        const bounds = this.calculateBounds(points);
        const center = this.calculateCenter(points);
        const ratio = bounds.width / bounds.height;
       
        console.log(`   📏 Размеры: ${bounds.width.toFixed(1)}x${bounds.height.toFixed(1)}`);
        console.log(`   📐 Соотношение: ${ratio.toFixed(2)}`);
        console.log(`   📍 Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
       
        // Метод 1: Выпуклая оболочка
        const noseAngle = this.findNoseDirectionEnhanced(points);
        const hours = this.degreesToClockHours(noseAngle);
       
        console.log(`   🎯 Угол мыска: ${noseAngle.toFixed(1)}° (${hours} часов)`);
       
        // Метод 2: PCA
        const pcaAngle = this.calculatePrincipalAngleFromPoints(points);
        const pcaHours = this.degreesToClockHours(pcaAngle);
       
        console.log(`   📐 PCA угол: ${pcaAngle.toFixed(1)}° (${pcaHours} часов)`);
       
        // Метод 3: Распределение
        const distribution = this.analyzePointDistribution(points);
        console.log(`   📊 Распределение: Q1=${distribution.quadrants.q1}, Q2=${distribution.quadrants.q2}, Q3=${distribution.quadrants.q3}, Q4=${distribution.quadrants.q4}`);
        console.log(`   🎯 Вероятный нос: ${distribution.noseQuadrant}, уверенность: ${distribution.confidence.toFixed(2)}`);
       
        // Рекомендуемый поворот
        const requiredRotation = this.calculateRequiredRotation(hours, noseAngle);
        console.log(`   🔄 Рекомендуемый поворот: ${requiredRotation.toFixed(1)}°`);
       
        return {
            bounds,
            center,
            ratio,
            noseAngle,
            hours,
            pcaAngle,
            pcaHours,
            distribution,
            requiredRotation
        };
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    calculatePrincipalAngle(graph) {
        const points = Array.from(graph.nodes.values())
            .map(node => ({ x: node.x, y: node.y }));
        return this.calculatePrincipalAngleFromPoints(points);
    }

    transformPointsBetweenSystems(points, sourceSystem, targetSystem) {
        // Упрощенная реализация для совместимости
        return points.map(point => ({ ...point }));
    }
}

module.exports = RotationInvariance;
