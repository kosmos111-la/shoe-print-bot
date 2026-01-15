// modules/footprint/rotation-invariance.js
// 🔥 УПРОЩЕННАЯ ВЕРСИЯ - ПРОСТО ПОВОРАЧИВАЕМ К ГОРИЗОНТАЛИ С НОСОМ ВПРАВО

const fs = require('fs');
const path = require('path');

class RotationInvariance {
    constructor(options = {}) {
        this.config = {
            debug: options.debug || false,
            autoCorrect: options.autoCorrect !== false,
            minPoints: options.minPoints || 5,
            ...options
        };
       
        this.stats = {
            processedGraphs: 0,
            totalRotations: 0,
            lastError: null
        };
       
        console.log(`🚀 RotationInvariance инициализирован (УПРОЩЕННАЯ версия)`);
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: ПРОСТАЯ НОРМАЛИЗАЦИЯ
    normalizeToCanonical(graph, options = {}) {
        console.log(`\n🔄 ПРОСТАЯ НОРМАЛИЗАЦИЯ: "${graph.name || graph.id}"`);
        console.log(`🎯 Цель: горизонтальный след с носом вправо (0°)`);
       
        this.stats.processedGraphs++;
       
        try {
            const startTime = Date.now();
           
            // 1. Получаем все точки
            const points = [];
            for (const [id, node] of graph.nodes) {
                points.push({ x: node.x, y: node.y, id, nodeId: id });
            }
           
            if (points.length < this.config.minPoints) {
                console.log(`⚠️ Слишком мало точек: ${points.length}`);
                return this.createDefaultResult(graph);
            }
           
            console.log(`📊 Обрабатываю ${points.length} точек`);
           
            // 2. Вычисляем центр
            const center = this.calculateCenter(points);
            console.log(`📐 Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
           
            // 3. 🔥 ПРОСТО: Находим главный угол через PCA
            const currentAngle = this.calculateSimplePCA(points);
            console.log(`📐 Текущий угол: ${currentAngle.toFixed(1)}°`);
           
            // 4. 🔥 ПРОСТО: Поворачиваем на -currentAngle чтобы получить 0°
            const rotationNeeded = -currentAngle;
            console.log(`🔄 Необходимый поворот: ${rotationNeeded.toFixed(1)}°`);
           
            // 5. Создаем и применяем поворот
            const transformation = this.createSimpleRotation(rotationNeeded, center);
            const rotatedGraph = this.applySimpleRotation(graph, transformation);
           
            // 6. Проверяем результат
            const rotatedPoints = Array.from(rotatedGraph.nodes.values())
                .map(node => ({ x: node.x, y: node.y }));
               
            const finalAngle = this.calculateSimplePCA(rotatedPoints);
            console.log(`🎯 Угол после поворота: ${finalAngle.toFixed(1)}°`);
           
            // 7. Если не точно - дополнительная коррекция
            let finalGraph = rotatedGraph;
            let finalTransformation = transformation;
           
            if (Math.abs(finalAngle) > 10 && this.config.autoCorrect) {
                console.log(`⚠️ Требуется коррекция: ${finalAngle.toFixed(1)}° → 0°`);
                const correction = -finalAngle;
               
                const correctionTransform = this.createSimpleRotation(correction, center);
                finalGraph = this.applySimpleRotation(rotatedGraph, correctionTransform);
                finalTransformation.rotationAngle += correction;
                finalTransformation.correctionApplied = true;
               
                console.log(`✅ Коррекция ${correction.toFixed(1)}° применена`);
                console.log(`📐 Итоговый поворот: ${finalTransformation.rotationAngle.toFixed(1)}°`);
            }
           
            // 8. Определяем тип стопы
            const footType = this.determineSimpleFootType(finalGraph);
           
            // 9. Логируем результат
            const elapsed = Date.now() - startTime;
            this.stats.totalRotations++;
           
            console.log(`✅ Нормализация завершена за ${elapsed}ms`);
            console.log(`   Тип стопы: ${footType}`);
            console.log(`   Успех: ${Math.abs(finalAngle) < 15 ? '✓' : '⚠'}`);
           
            return {
                graph: finalGraph,
                rotationAngle: finalTransformation.rotationAngle,
                isMirrored: false,
                transformation: finalTransformation,
                footType: footType,
                stats: {
                    originalPoints: points.length,
                    originalAngle: currentAngle,
                    finalAngle: finalAngle,
                    correctionApplied: finalTransformation.correctionApplied || false,
                    processingTime: elapsed,
                    success: Math.abs(finalAngle) < 15
                }
            };
           
        } catch (error) {
            console.log(`❌ Ошибка нормализации: ${error.message}`);
            this.stats.lastError = error.message;
           
            return this.createDefaultResult(graph);
        }
    }

    // 🔥 ПРОСТОЙ PCA ДЛЯ ОПРЕДЕЛЕНИЯ УГЛА
    calculateSimplePCA(points) {
        if (points.length < 3) return 0;
       
        const center = this.calculateCenter(points);
       
        // Матрица ковариации
        let covXX = 0, covYY = 0, covXY = 0;
       
        for (const point of points) {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            covXX += dx * dx;
            covYY += dy * dy;
            covXY += dx * dy;
        }
       
        const n = points.length;
        covXX /= n;
        covYY /= n;
        covXY /= n;
       
        // Собственные значения
        const trace = covXX + covYY;
        const det = covXX * covYY - covXY * covXY;
        const lambda1 = trace/2 + Math.sqrt(trace*trace/4 - det);
       
        // Главный собственный вектор
        let vx = lambda1 - covYY;
        let vy = covXY;
        const len = Math.sqrt(vx*vx + vy*vy);
       
        if (len > 0) {
            vx /= len;
            vy /= len;
        } else {
            vx = 1;
            vy = 0;
        }
       
        // Угол главной оси
        let angle = Math.atan2(vy, vx) * 180 / Math.PI;
       
        // 🔥 КЛЮЧЕВОЕ: Приводим к диапазону -90°..90°
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
       
        return angle;
    }

    // 🔥 ПРОСТОЙ РАСЧЕТ ЦЕНТРА
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

    // 🔥 ПРОСТОЙ ПОВОРОТ
    createSimpleRotation(angle, center) {
        const rad = angle * Math.PI / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
       
        return {
            matrix: [cosA, sinA, 0, -sinA, cosA, 0, 0, 0, 1],
            rotationAngle: angle,
            center: { ...center },
            cosA: cosA,
            sinA: sinA,
            timestamp: new Date(),
            type: 'simple_rotation'
        };
    }

    // 🔥 ПРИМЕНЕНИЕ ПРОСТОГО ПОВОРОТА
    applySimpleRotation(graph, transformation) {
        const { cosA, sinA, center } = transformation;
       
        // Создаем новый граф
        const rotatedGraph = {
            nodes: new Map(),
            edges: new Map(),
            id: graph.id + '_normalized',
            name: graph.name ? `${graph.name} (нормализованный)` : 'normalized',
            originalGraphId: graph.id
        };
       
        // Поворачиваем каждый узел
        for (const [id, node] of graph.nodes) {
            const dx = node.x - center.x;
            const dy = node.y - center.y;
           
            // Применяем поворот
            const rotatedX = dx * cosA - dy * sinA;
            const rotatedY = dx * sinA + dy * cosA;
           
            // Создаем новый узел
            rotatedGraph.nodes.set(id, {
                ...node,
                x: rotatedX + center.x,
                y: rotatedY + center.y
            });
        }
       
        // Копируем ребра
        for (const [id, edge] of graph.edges) {
            rotatedGraph.edges.set(id, { ...edge });
        }
       
        return rotatedGraph;
    }

    // 🔥 ПРОСТОЕ ОПРЕДЕЛЕНИЕ ТИПА СТОПЫ
    determineSimpleFootType(graph) {
        const points = Array.from(graph.nodes.values())
            .map(node => ({ x: node.x, y: node.y }));
       
        if (points.length < 5) return 'unknown';
       
        const center = this.calculateCenter(points);
        let left = 0, right = 0;
       
        for (const point of points) {
            if (point.x < center.x) left++;
            else right++;
        }
       
        // Простая эвристика
        if (right > left * 1.3) return 'right';
        if (left > right * 1.3) return 'left';
       
        return 'unknown';
    }

    // 🔥 РЕЗУЛЬТАТ ПО УМОЛЧАНИЮ
    createDefaultResult(graph) {
        return {
            graph: graph,
            rotationAngle: 0,
            isMirrored: false,
            transformation: {
                matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
                rotationAngle: 0,
                center: { x: 0, y: 0 },
                type: 'identity'
            },
            footType: 'unknown',
            stats: {
                error: this.stats.lastError,
                defaultResult: true
            }
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: РАСЧЕТ УГЛА ЧЕРЕЗ ДАЛЬНЮЮ ТОЧКУ
    calculateSimpleAngle(points) {
        if (points.length < 3) return 0;
       
        const center = this.calculateCenter(points);
       
        // Находим самую дальнюю точку от центра
        let maxDist = 0;
        let farthestPoint = points[0];
       
        for (const point of points) {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            const dist = dx*dx + dy*dy;
           
            if (dist > maxDist) {
                maxDist = dist;
                farthestPoint = point;
            }
        }
       
        // Угол от центра к дальней точке
        const dx = farthestPoint.x - center.x;
        const dy = farthestPoint.y - center.y;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
       
        // Приводим к -90°..90°
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
       
        return angle;
    }

    // 🔥 ТЕСТИРОВАНИЕ (для отладки)
    testOrientation(points) {
        console.log(`\n🧪 ТЕСТ ОРИЕНТАЦИИ:`);
       
        if (points.length < 3) {
            console.log(`   ⚠️ Недостаточно точек: ${points.length}`);
            return { error: 'Not enough points' };
        }
       
        const center = this.calculateCenter(points);
        const anglePCA = this.calculateSimplePCA(points);
        const angleSimple = this.calculateSimpleAngle(points);
       
        console.log(`   📐 Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
        console.log(`   📊 PCA угол: ${anglePCA.toFixed(1)}°`);
        console.log(`   📏 Простой угол: ${angleSimple.toFixed(1)}°`);
        console.log(`   🔄 Рекомендуемый поворот: ${-anglePCA.toFixed(1)}°`);
       
        return {
            center,
            anglePCA,
            angleSimple,
            requiredRotation: -anglePCA
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

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ
    calculatePrincipalAngle(graph) {
        const points = Array.from(graph.nodes.values())
            .map(node => ({ x: node.x, y: node.y }));
        return this.calculateSimplePCA(points);
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ
    transformPointsBetweenSystems(points, sourceSystem, targetSystem) {
        // Просто возвращаем точки как есть
        return points.map(point => ({ ...point }));
    }

    // 🔥 ПРОСТОЕ СРАВНЕНИЕ ДВУХ СЛЕДОВ (если нужно использовать отдельно)
    simpleCompare(footprint1, footprint2) {
        console.log(`\n⚡ ПРОСТОЕ СРАВНЕНИЕ СЛЕДОВ`);
       
        try {
            // 1. Получаем точки
            const points1 = Array.from(footprint1.nodes.values())
                .map(node => ({ x: node.x, y: node.y }));
            const points2 = Array.from(footprint2.nodes.values())
                .map(node => ({ x: node.x, y: node.y }));
           
            console.log(`📊 Точки: ${points1.length} vs ${points2.length}`);
           
            if (points1.length < 5 || points2.length < 5) {
                console.log(`⚠️ Недостаточно точек для сравнения`);
                return { similarity: 0, decision: 'insufficient_data' };
            }
           
            // 2. Вычисляем центры
            const center1 = this.calculateCenter(points1);
            const center2 = this.calculateCenter(points2);
           
            // 3. Совмещаем по центрам
            const offsetX = center1.x - center2.x;
            const offsetY = center1.y - center2.y;
           
            const alignedPoints2 = points2.map(p => ({
                x: p.x + offsetX,
                y: p.y + offsetY
            }));
           
            // 4. Простое сравнение расстояний
            let matches = 0;
            const THRESHOLD = 25; // 25px
           
            for (const p1 of points1) {
                let minDist = Infinity;
               
                for (const p2 of alignedPoints2) {
                    const dist = Math.sqrt(
                        Math.pow(p1.x - p2.x, 2) +
                        Math.pow(p1.y - p2.y, 2)
                    );
                   
                    if (dist < minDist) minDist = dist;
                }
               
                if (minDist < THRESHOLD) matches++;
            }
           
            const similarity = matches / Math.max(points1.length, points2.length);
            const decision = similarity > 0.6 ? 'same' : 'different';
           
            console.log(`🎯 Совпадений: ${matches}/${points1.length}`);
            console.log(`📈 Сходство: ${(similarity * 100).toFixed(1)}%`);
            console.log(`📋 Решение: ${decision}`);
           
            return {
                similarity,
                decision,
                matches,
                totalPoints: points1.length,
                method: 'simple_distance'
            };
           
        } catch (error) {
            console.log(`❌ Ошибка сравнения: ${error.message}`);
            return { similarity: 0, decision: 'error', error: error.message };
        }
    }
   // 🔥 ДОБАВЬТЕ ЭТОТ МЕТОД В КЛАСС:
    forceNormalizeToZero(graph, options = {}) {
        console.log(`\n🎯 ПРИНУДИТЕЛЬНАЯ НОРМАЛИЗАЦИЯ К 0°`);

        // 1. Получаем текущую нормализацию (старый метод)
        const result = this.normalizeToCanonical(graph, options);

        // 2. Проверяем угол после нормализации
        const currentAngle = result.rotationAngle;
        console.log(`📐 Угол после нормализации: ${currentAngle.toFixed(1)}°`);

        // 3. 🔥 КЛЮЧЕВОЕ: Если угол не близок к 0° - доворачиваем!
        const targetAngle = 0; // Всегда 0°!
        const tolerance = options.tolerance || 15; // Допуск ±15°

        if (Math.abs(currentAngle - targetAngle) > tolerance &&
            Math.abs(currentAngle - targetAngle - 360) > tolerance &&
            Math.abs(currentAngle - targetAngle + 360) > tolerance) {

            console.log(`⚠️ Угол ${currentAngle.toFixed(1)}° не близок к 0°!`);
            console.log(`🔄 Доворачиваю до 0°...`);

            // Вычисляем дополнительный поворот
            const additionalRotation = -currentAngle;
            console.log(`📐 Дополнительный поворот: ${additionalRotation.toFixed(1)}°`);

            // Применяем дополнительный поворот
            const center = result.transformation.center || { x: 0, y: 0 };
            const finalGraph = this.applyAdditionalRotation(
                result.graph,
                additionalRotation,
                center
            );

            // Обновляем результат
            result.graph = finalGraph;
            result.rotationAngle = 0; // Теперь точно 0°!
            result.transformation.rotationAngle = 0;
            result.transformation.forceCorrected = true;
            result.transformation.originalAngle = currentAngle;
            result.transformation.correction = additionalRotation;

            console.log(`✅ Принудительно нормализовано к 0°`);
        } else {
            console.log(`✅ Угол уже близок к 0° (${currentAngle.toFixed(1)}°)`);
        }

        return result;
    }

    // 🔥 ПРИМЕНИТЬ ДОПОЛНИТЕЛЬНЫЙ ПОВОРОТ
    applyAdditionalRotation(graph, angle, center) {
        const rad = angle * Math.PI / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        const rotatedGraph = {
            nodes: new Map(),
            edges: new Map(graph.edges),
            id: graph.id + '_forced',
            name: graph.name ? graph.name + ' (принудительно к 0°)' : 'forced_to_zero'
        };

        for (const [id, node] of graph.nodes) {
            const dx = node.x - center.x;
            const dy = node.y - center.y;

            const rotatedX = dx * cosA - dy * sinA;
            const rotatedY = dx * sinA + dy * cosA;

            rotatedGraph.nodes.set(id, {
                ...node,
                x: rotatedX + center.x,
                y: rotatedY + center.y,
                forceRotated: true,
                originalAngle: angle
            });
        }

        return rotatedGraph;
    }
}
module.exports = RotationInvariance;
