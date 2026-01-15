// modules/footprint/rotation-invariance.js
// 🔥 ИСПРАВЛЕННАЯ ВЕРСИЯ С ПРАВИЛЬНОЙ ОРИЕНТАЦИЕЙ

const fs = require('fs');
const path = require('path');

class RotationInvariance {
    constructor(options = {}) {
        this.config = {
            debug: options.debug || false,
            autoCorrect: options.autoCorrect !== false,
            thresholdAngle: options.thresholdAngle || 45,
            ...options
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ ГЛАВНЫЙ МЕТОД
    normalizeToCanonical(graph, options = {}) {
        console.log(`\n🔄 ИСПРАВЛЕННАЯ НОРМАЛИЗАЦИЯ С УЧЕТОМ ЦИФЕРБЛАТА`);
       
        try {
            // 1. Получаем все точки
            const points = [];
            for (const [id, node] of graph.nodes) {
                points.push({ x: node.x, y: node.y, id });
            }
           
            if (points.length < 5) {
                console.log(`⚠️ Слишком мало точек: ${points.length}`);
                return {
                    graph: graph,
                    rotationAngle: 0,
                    isMirrored: false,
                    transformation: this.createIdentityTransformation(),
                    footType: 'unknown'
                };
            }
           
            console.log(`📊 Обрабатываю ${points.length} точек`);
           
            // 2. Определяем текущее направление мыска
            const noseDirection = this.findTrueNoseDirection(points);
            console.log(`🎯 Текущее направление мыска: ${noseDirection.toFixed(1)}°`);
           
            // 3. Конвертируем в часы
            const clockHours = this.degreesToClockHours(noseDirection);
            console.log(`🕐 Мысок смотрит на: ${clockHours} часов`);
           
            // 4. 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: НОВЫЙ АЛГОРИТМ
            // Всегда приводим к горизонтальному положению с мыском вправо (3 часа)
            let targetRotation = 0;
           
            // Диапазоны часов:
            // 12 часов = 90° (вверх)
            // 3 часа = 0° (вправо)
            // 6 часов = 270° или -90° (вниз)
            // 9 часов = 180° (влево)
           
            if (clockHours >= 10.5 || clockHours < 1.5) {
                // Зона 11, 12, 1 часов (мысок вверх-вправо)
                // Нужен поворот на -60° до -90°
                targetRotation = -noseDirection + 90; // 90° (12ч) → 0° (3ч)
                console.log(`🔧 Зона 11-1 часов: поворот ${targetRotation.toFixed(1)}°`);
            }
            else if (clockHours >= 1.5 && clockHours < 4.5) {
                // Зона 2, 3, 4 часов (мысок вправо)
                // Минимальный поворот к 0°
                targetRotation = -noseDirection;
                console.log(`🔧 Зона 2-4 часов: поворот ${targetRotation.toFixed(1)}°`);
            }
            else if (clockHours >= 4.5 && clockHours < 7.5) {
                // Зона 5, 6, 7 часов (мысок вниз-вправо)
                // Поворот на +60° до +90°
                targetRotation = -noseDirection - 90; // 270° (6ч) → 0° (3ч)
                console.log(`🔧 Зона 5-7 часов: поворот ${targetRotation.toFixed(1)}°`);
            }
            else if (clockHours >= 7.5 && clockHours < 10.5) {
                // Зона 8, 9, 10 часов (мысок влево)
                // Поворот на 180°
                targetRotation = -noseDirection + 180;
                console.log(`🔧 Зона 8-10 часов: поворот ${targetRotation.toFixed(1)}°`);
            }
           
            // 5. Нормализуем угол к диапазону -180..180
            if (targetRotation > 180) targetRotation -= 360;
            if (targetRotation < -180) targetRotation += 360;
           
            console.log(`📐 Итоговый необходимый поворот: ${targetRotation.toFixed(1)}°`);
           
            // 6. Применяем поворот
            const center = this.calculateCenter(points);
            const transformation = this.createRotationTransformation(targetRotation, center);
           
            console.log(`📐 Центр вращения: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
           
            // 7. Создаем повернутый граф
            const rotatedGraph = this.rotateGraph(graph, transformation);
           
            // 8. Проверяем результат
            const rotatedPoints = [];
            for (const [id, node] of rotatedGraph.nodes) {
                rotatedPoints.push({ x: node.x, y: node.y });
            }
           
            const finalDirection = this.findTrueNoseDirection(rotatedPoints);
            const finalHours = this.degreesToClockHours(finalDirection);
           
            console.log(`🎯 Результат: мысок на ${finalHours} часов (${finalDirection.toFixed(1)}°)`);
           
            // 9. Если не попали в 3 часа ±20° - корректируем
            const targetDirection = 0; // 0° = 3 часов (вправо)
            const tolerance = 20;
           
            if (Math.abs(finalDirection - targetDirection) > tolerance &&
                Math.abs(finalDirection - targetDirection - 360) > tolerance &&
                Math.abs(finalDirection - targetDirection + 360) > tolerance) {
               
                console.log(`⚠️ Не точное выравнивание! Нужна дополнительная коррекция...`);
                console.log(`   Отклонение: ${Math.abs(finalDirection - targetDirection).toFixed(1)}° (допуск: ${tolerance}°)`);
               
                // Дополнительный поворот к 0°
                const correction = -finalDirection;
                console.log(`🔄 Применяю коррекцию: ${correction.toFixed(1)}°`);
               
                const correctionTransformation = this.createRotationTransformation(correction, center);
                const correctedGraph = this.rotateGraph(rotatedGraph, correctionTransformation);
               
                // Обновляем общую трансформацию
                transformation.rotationAngle += correction;
               
                console.log(`✅ Коррекция применена. Итоговый поворот: ${transformation.rotationAngle.toFixed(1)}°`);
               
                return {
                    graph: correctedGraph,
                    rotationAngle: transformation.rotationAngle,
                    isMirrored: false,
                    transformation: transformation,
                    footType: this.determineFootType(correctedGraph)
                };
            }
           
            console.log(`✅ Выравнивание успешно! Мысок направлен вправо (3 часа)`);
           
            return {
                graph: rotatedGraph,
                rotationAngle: transformation.rotationAngle,
                isMirrored: false,
                transformation: transformation,
                footType: this.determineFootType(rotatedGraph)
            };
           
        } catch (error) {
            console.log(`❌ Ошибка в normalizeToCanonical: ${error.message}`);
            console.error(error.stack);
           
            return {
                graph: graph,
                rotationAngle: 0,
                isMirrored: false,
                transformation: this.createIdentityTransformation(),
                footType: 'unknown'
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Найти истинное направление мыска
    findTrueNoseDirection(points) {
        if (points.length < 5) return 0;
       
        // 1. Находим выпуклую оболочку (convex hull)
        const hull = this.computeConvexHull(points);
       
        // 2. Находим центр масс
        const center = this.calculateCenter(points);
       
        // 3. Находим самую дальнюю точку от центра (это, скорее всего, нос)
        let farthestPoint = null;
        let maxDistance = 0;
       
        for (const point of hull) {
            const distance = Math.sqrt(
                Math.pow(point.x - center.x, 2) +
                Math.pow(point.y - center.y, 2)
            );
           
            if (distance > maxDistance) {
                maxDistance = distance;
                farthestPoint = point;
            }
        }
       
        if (!farthestPoint) return 0;
       
        // 4. Вычисляем угол от центра к самой дальней точке
        const dx = farthestPoint.x - center.x;
        const dy = farthestPoint.y - center.y;
       
        // atan2 возвращает угол в радианах, конвертируем в градусы
        // 0° = вправо, 90° = вверх, 180° = влево, 270° = вниз
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
       
        if (this.config.debug) {
            console.log(`   👃 Самая дальняя точка: (${farthestPoint.x.toFixed(1)}, ${farthestPoint.y.toFixed(1)})`);
            console.log(`   📏 Расстояние от центра: ${maxDistance.toFixed(1)}px`);
            console.log(`   📐 Угол от центра: ${angle.toFixed(1)}°`);
        }
       
        return angle;
    }

    // 🔥 Конвертировать градусы в часы на циферблате
    degreesToClockHours(degrees) {
        // Приводим к диапазону 0-360°
        let normalized = degrees % 360;
        if (normalized < 0) normalized += 360;
       
        // Конвертируем:
        // 0° = 3 часа (вправо)
        // 90° = 12 часов (вверх)
        // 180° = 9 часов (влево)
        // 270° = 6 часов (вниз)
       
        // Формула: часы = ((450 - градусы) % 360) / 30
        // 450 = 360 + 90 для смещения
        let hours = ((450 - normalized) % 360) / 30;
       
        // 0 часов = 12 часов
        if (Math.abs(hours) < 0.001) hours = 12;
       
        // Округляем до 0.1 часа для читаемости
        hours = Math.round(hours * 10) / 10;
       
        return hours;
    }

    // 🔥 Вычислить выпуклую оболочку (алгоритм Грэхема)
    computeConvexHull(points) {
        if (points.length <= 3) return [...points];
       
        // Сортируем точки по X, затем по Y
        const sorted = [...points].sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            return a.y - b.y;
        });
       
        // Нижняя часть оболочки
        const lower = [];
        for (const point of sorted) {
            while (lower.length >= 2 &&
                   this.crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
                lower.pop();
            }
            lower.push(point);
        }
       
        // Верхняя часть оболочки
        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const point = sorted[i];
            while (upper.length >= 2 &&
                   this.crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
                upper.pop();
            }
            upper.push(point);
        }
       
        // Убираем последние точки (они дублируются)
        lower.pop();
        upper.pop();
       
        return [...lower, ...upper];
    }

    // 🔥 Векторное произведение для convex hull
    crossProduct(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    // 🔥 Создать трансформацию поворота
    createRotationTransformation(angle, center) {
        const rad = angle * Math.PI / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
       
        // Смещение для вращения вокруг центра
        const tx = center.x - (center.x * cosA - center.y * sinA);
        const ty = center.y - (center.x * sinA + center.y * cosA);
       
        if (this.config.debug) {
            console.log(`   📐 Матрица поворота ${angle}°:`);
            console.log(`      [${cosA.toFixed(4)}, ${sinA.toFixed(4)}, ${tx.toFixed(1)}]`);
            console.log(`      [${-sinA.toFixed(4)}, ${cosA.toFixed(4)}, ${ty.toFixed(1)}]`);
        }
       
        return {
            matrix: [cosA, sinA, tx, -sinA, cosA, ty, 0, 0, 1],
            rotationAngle: angle,
            center: center,
            cosA: cosA,
            sinA: sinA,
            translation: { x: tx, y: ty }
        };
    }

    // 🔥 Повернуть граф с использованием трансформации
    rotateGraph(graph, transformation) {
        const { cosA, sinA, center } = transformation;
       
        // Создаем копию графа
        const rotatedGraph = {
            nodes: new Map(),
            edges: new Map(),
            id: graph.id + '_rotated',
            name: graph.name ? graph.name + ' (повернутый)' : 'rotated'
        };
       
        // Копируем узлы
        for (const [id, node] of graph.nodes) {
            const dx = node.x - center.x;
            const dy = node.y - center.y;
           
            // Поворачиваем
            const rotatedX = dx * cosA - dy * sinA;
            const rotatedY = dx * sinA + dy * cosA;
           
            // Возвращаем на место
            rotatedGraph.nodes.set(id, {
                ...node,
                x: rotatedX + center.x,
                y: rotatedY + center.y,
                originalX: node.x,
                originalY: node.y
            });
        }
       
        // Копируем ребра
        for (const [id, edge] of graph.edges) {
            rotatedGraph.edges.set(id, { ...edge });
        }
       
        return rotatedGraph;
    }

    // 🔥 Создать единичную трансформацию
    createIdentityTransformation() {
        return {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            rotationAngle: 0,
            center: { x: 0, y: 0 },
            cosA: 1,
            sinA: 0,
            translation: { x: 0, y: 0 }
        };
    }

    // 🔥 Вычислить центр точек
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

    // 🔥 Определить тип стопы (левый/правый)
    determineFootType(graph) {
        // Простая реализация - всегда правый
        // В реальной системе здесь должна быть более сложная логика
        return 'right';
    }

    // 🔥 Старый метод для совместимости (использует PCA)
    calculatePrincipalAngle(graph) {
        const points = [];
        for (const [id, node] of graph.nodes) {
            points.push({ x: node.x, y: node.y });
        }
       
        if (points.length < 3) return 0;
       
        // Вычисляем центр масс
        const center = this.calculateCenter(points);
       
        // Вычисляем ковариационную матрицу
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
       
        // Собственные значения и векторы
        const trace = covXX + covYY;
        const determinant = covXX * covYY - covXY * covXY;
       
        const eigenvalue1 = trace / 2 + Math.sqrt(Math.pow(trace, 2) / 4 - determinant);
        const eigenvalue2 = trace / 2 - Math.sqrt(Math.pow(trace, 2) / 4 - determinant);
       
        // Главный собственный вектор
        let eigenvectorX, eigenvectorY;
       
        if (Math.abs(covXY) > 0.001) {
            eigenvectorX = eigenvalue1 - covYY;
            eigenvectorY = covXY;
        } else {
            eigenvectorX = 1;
            eigenvectorY = 0;
        }
       
        // Нормализуем
        const length = Math.sqrt(eigenvectorX * eigenvectorX + eigenvectorY * eigenvectorY);
        eigenvectorX /= length;
        eigenvectorY /= length;
       
        // Угол главной оси
        let angle = Math.atan2(eigenvectorY, eigenvectorX) * 180 / Math.PI;
       
        if (this.config.debug) {
            console.log(`   📐 PCA угол: ${angle.toFixed(1)}°`);
            console.log(`   📊 Собственные значения: ${eigenvalue1.toFixed(1)}, ${eigenvalue2.toFixed(1)}`);
        }
       
        return angle;
    }

    // 🔥 Для совместимости со старым кодом
    transformPointsBetweenSystems(points, sourceSystem, targetSystem) {
        // Упрощенная реализация
        return points.map(point => ({ ...point }));
    }

    // 🔥 Для отладки
    logPoints(points, label) {
        if (!this.config.debug) return;
       
        console.log(`\n${label} (${points.length} точек):`);
        points.slice(0, 5).forEach((point, i) => {
            console.log(`   ${i + 1}. (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        });
       
        if (points.length > 5) {
            console.log(`   ... и еще ${points.length - 5} точек`);
        }
    }
}

module.exports = RotationInvariance;
