// modules/footprint/rotation-invariance.js
// АВТООПРЕДЕЛЕНИЕ УГЛА ПОВОРОТА И НОРМАЛИЗАЦИЯ ПРОТЕКТОРА (ИСПРАВЛЕННАЯ ВЕРСИЯ)

class RotationInvariance {
    constructor(options = {}) {
        this.config = {
            canonicalOrientation: 'horizontal',
            rotationStep: 15,
            maxRotationAngle: 180,
            enableAutoRotation: true,
            debug: options.debug || true,
            verbose: options.verbose || true,
            ...options
        };

        console.log('🎯 RotationInvariance инициализирован (режим отладки ВКЛЮЧЕН)');
        console.log(`   Режим отладки: ${this.config.debug ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   Детальный вывод: ${this.config.verbose ? 'ВКЛ' : 'ВЫКЛ'}`);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Нормализация с проверкой направления носа
    normalizeToCanonical(graph, options = {}) {
        console.log(`\n🔄 ИСПРАВЛЕННАЯ НОРМАЛИЗАЦИЯ С ПРОВЕРКОЙ ОТРАЖЕНИЯ`);

        // 1. Определяем угол PCA
        const angle = this.calculatePrincipalAngle(graph);
        console.log(`📐 Исходный угол PCA: ${angle.toFixed(1)}°`);

        // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Определяем, нужно ли вращать на 180°
        const normalizedAngle = this.normalizeAngle(angle);
        console.log(`📐 Нормализованный угол: ${normalizedAngle.toFixed(1)}°`);

        // 2. Получаем точки для анализа ДО трансформации
        const originalPoints = [];
        for (const [id, node] of graph.nodes) {
            originalPoints.push({ x: node.x, y: node.y });
        }

        // 3. Определяем форму ДО поворота
        const originalBounds = this.calculateBounds(originalPoints);
        const originalRatio = originalBounds.width / Math.max(1, originalBounds.height);
        console.log(`📏 Исходные размеры: ${originalBounds.width.toFixed(1)}x${originalBounds.height.toFixed(1)}`);
        console.log(`📐 Исходное соотношение: ${originalRatio.toFixed(2)}`);

        // 4. Определяем тип следа (горизонтальный/вертикальный)
        const isVerticalOrientation = originalRatio < 0.7; // Ширина < 70% высоты
        console.log(`🧭 Исходная ориентация: ${isVerticalOrientation ? 'ВЕРТИКАЛЬНЫЙ' : 'ГОРИЗОНТАЛЬНЫЙ'}`);

        // 🔥 ВАЖНО: Для вертикальных следов используем ДРУГУЮ логику!
        let targetAngle = 0;

        if (isVerticalOrientation) {
            // Для вертикальных следов целевой угол должен быть 90° или -90°, а не 0°!
            console.log(`🎯 ВЕРТИКАЛЬНЫЙ СЛЕД: Целевой угол = 90° (нос вверх)`);

            // Определяем, куда смотрит нос (вверх или вниз)
            const noseDirection = this.determineVerticalNoseDirection(originalPoints);
            console.log(`🎯 Нос смотрит: ${noseDirection}`);

            if (noseDirection === 'up') {
                targetAngle = 90; // Нормализуем к 90° (нос вверх)
            } else {
                targetAngle = -90; // Нормализуем к -90° (нос вверх через отражение)
            }
        } else {
            // Горизонтальные следы - к 0°
            console.log(`🎯 ГОРИЗОНТАЛЬНЫЙ СЛЕД: Целевой угол = 0° (нос вправо)`);
            targetAngle = 0;
        }

        console.log(`🎯 Целевой угол нормализации: ${targetAngle}°`);

        // 5. Вычисляем необходимый поворот
        const rotationNeeded = targetAngle - normalizedAngle;
        console.log(`🔄 Необходимый поворот: ${rotationNeeded.toFixed(1)}°`);

        // 6. Применяем поворот
        const transformation = this.createRotationTransformation(
            rotationNeeded,
            originalPoints
        );

        // 7. Создаем повернутый граф
        const rotatedGraph = this.rotateGraph(graph, transformation);

        // 8. 🔥 ПРОВЕРКА ПОСЛЕ ПОВОРОТА
        const finalPoints = [];
        for (const [id, node] of rotatedGraph.nodes) {
            finalPoints.push({ x: node.x, y: node.y });
        }

        const finalBounds = this.calculateBounds(finalPoints);
        const finalRatio = finalBounds.width / Math.max(1, finalBounds.height);

        console.log(`📏 Финальные размеры: ${finalBounds.width.toFixed(1)}x${finalBounds.height.toFixed(1)}`);
        console.log(`📐 Финальное соотношение: ${finalRatio.toFixed(2)}`);

        // 9. Проверяем направление носа ПОСЛЕ поворота
        const finalNoseDirection = this.checkNoseDirection(finalPoints, isVerticalOrientation);
        console.log(`🎯 Направление носа после нормализации: ${finalNoseDirection}`);

        // 10. Если направление неправильное - применяем коррекцию 180°
        const expectedDirection = isVerticalOrientation ? 'up' : 'right';

        if (finalNoseDirection !== expectedDirection) {
            console.log(`⚠️ ОШИБКА! Нос смотрит ${finalNoseDirection}, а должен ${expectedDirection}`);
            console.log(`🔄 Применяю дополнительный поворот на 180°...`);

            // Поворачиваем еще на 180°
            const correctionTransformation = this.createRotationTransformation(
                180,
                finalPoints
            );

            const correctedGraph = this.rotateGraph(rotatedGraph, correctionTransformation);

            // Обновляем трансформацию
            transformation.rotationAngle = (transformation.rotationAngle + 180) % 360;
            transformation.corrected180 = true;

            console.log(`✅ Коррекция 180° применена`);
            return {
                graph: correctedGraph,
                rotationAngle: transformation.rotationAngle,
                isMirrored: false,
                transformation: transformation,
                footType: this.determineFootType(correctedGraph)
            };
        }

        return {
            graph: rotatedGraph,
            rotationAngle: transformation.rotationAngle,
            isMirrored: false,
            transformation: transformation,
            footType: this.determineFootType(rotatedGraph)
        };
    }

    // 🔥 Определение направления носа для вертикальных следов
    determineVerticalNoseDirection(points) {
        if (points.length < 5) return 'unknown';

        // Сортируем по Y (вертикальная ось)
        const sortedByY = [...points].sort((a, b) => a.y - b.y);

        // Верхние 30% точек (нос)
        const topPoints = sortedByY.slice(0, Math.floor(points.length * 0.3));
        // Нижние 30% точек (пятка)
        const bottomPoints = sortedByY.slice(-Math.floor(points.length * 0.3));

        // Нос уже пятки
        const topBounds = this.calculateBounds(topPoints);
        const bottomBounds = this.calculateBounds(bottomPoints);

        console.log(`   Верх (нос?): ${topBounds.width.toFixed(1)}x${topBounds.height.toFixed(1)}`);
        console.log(`   Низ (пятка?): ${bottomBounds.width.toFixed(1)}x${bottomBounds.height.toFixed(1)}`);

        // Если верхняя часть уже - это нос вверх
        if (topBounds.width < bottomBounds.width * 0.8) {
            return 'up';
        }
        // Если нижняя часть уже - это нос вниз
        else if (bottomBounds.width < topBounds.width * 0.8) {
            return 'down';
        }

        return 'unknown';
    }

    // 🔥 Проверка направления носа после нормализации
    checkNoseDirection(points, isVertical) {
        if (points.length < 5) return 'unknown';

        if (isVertical) {
            // Для вертикальных следов смотрим по Y
            const sortedByY = [...points].sort((a, b) => a.y - b.y);
            const topPoints = sortedByY.slice(0, Math.floor(points.length * 0.3));
            const bottomPoints = sortedByY.slice(-Math.floor(points.length * 0.3));

            const topCenter = this.calculateCenter(topPoints);
            const bottomCenter = this.calculateCenter(bottomPoints);

            // Нос там, где точки более сконцентрированы (меньший разброс)
            const topSpread = this.calculateSpread(topPoints);
            const bottomSpread = this.calculateSpread(bottomPoints);

            return topSpread < bottomSpread ? 'up' : 'down';
        } else {
            // Для горизонтальных следов смотрим по X
            const sortedByX = [...points].sort((a, b) => a.x - b.x);
            const leftPoints = sortedByX.slice(0, Math.floor(points.length * 0.3));
            const rightPoints = sortedByX.slice(-Math.floor(points.length * 0.3));

            const leftSpread = this.calculateSpread(leftPoints);
            const rightSpread = this.calculateSpread(rightPoints);

            return leftSpread < rightSpread ? 'right' : 'left';
        }
    }

    // 🔥 Вычисление "разброса" точек (дисперсия)
    calculateSpread(points) {
        if (points.length < 2) return 0;

        const center = this.calculateCenter(points);
        let spread = 0;

        for (const point of points) {
            spread += Math.sqrt(
                Math.pow(point.x - center.x, 2) +
                Math.pow(point.y - center.y, 2)
            );
        }

        return spread / points.length;
    }

    // 🔥 Нормализация угла к диапазону -90..90
    normalizeAngle(angle) {
        let normalized = angle % 360;

        // Приводим к диапазону -180..180
        if (normalized > 180) normalized -= 360;
        if (normalized < -180) normalized += 360;

        // Для следов важно направление, а не знак
        // Углы 90° и -90° одинаковы для следов (вертикальные)
        // Углы 0° и 180° одинаковы (горизонтальные, но противоположные направления!)

        if (normalized > 90 && normalized <= 180) {
            return normalized - 180; // 150° → -30° (это тот же след, развернутый на 180°)
        }

        if (normalized < -90 && normalized >= -180) {
            return normalized + 180; // -150° → 30°
        }

        return normalized;
    }

    // 🔥 ОПРЕДЕЛЕНИЕ УГЛА ПОВОРОТА С ПОМОЩЬЮ PCA
    calculatePrincipalAngle(graph) {
        const points = this.extractPointsFromGraph(graph);
        if (points.length < 3) return 0;

        console.log(`\n📐 РАСЧЕТ УГЛА PCA:`);
        console.log(`   Количество точек: ${points.length}`);

        // 1. Вычисляем центр масс
        const center = this.calculateCenter(points);
        console.log(`   Центр масс: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);

        // 2. Центрируем точки
        const centeredPoints = points.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y
        }));

        // 3. Строим ковариационную матрицу
        const covMatrix = this.calculateCovarianceMatrix(centeredPoints);
        console.log(`   Ковариационная матрица:`);
        console.log(`       [${covMatrix[0][0].toFixed(1)}, ${covMatrix[0][1].toFixed(1)}]`);
        console.log(`       [${covMatrix[1][0].toFixed(1)}, ${covMatrix[1][1].toFixed(1)}]`);

        // 4. Находим собственные векторы (PCA)
        const eigenvectors = this.calculateEigenvectors(covMatrix);
        console.log(`   Собственные векторы:`);
        console.log(`       Главный: [${eigenvectors[0][0].toFixed(3)}, ${eigenvectors[0][1].toFixed(3)}]`);
        console.log(`       Второй:  [${eigenvectors[1][0].toFixed(3)}, ${eigenvectors[1][1].toFixed(3)}]`);

        // 5. Главная ось = собственный вектор с максимальным собственным значением
        const mainAxis = eigenvectors[0];

        // 6. Вычисляем угол относительно горизонтали
        let angleRad = Math.atan2(mainAxis[1], mainAxis[0]);
        let angleDeg = angleRad * (180 / Math.PI);

        console.log(`   Угол в радианах: ${angleRad.toFixed(3)}`);
        console.log(`   Угол в градусах: ${angleDeg.toFixed(1)}°`);

        return angleDeg;
    }

    // 🔥 СОЗДАНИЕ ТРАНСФОРМАЦИИ ПОВОРОТА
    createRotationTransformation(rotationAngle, points) {
        const center = this.calculateCenter(points);
        const angleRad = rotationAngle * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        return {
            matrix: [
                cosA, -sinA, 0,
                sinA, cosA,  0,
                0,    0,     1
            ],
            rotationAngle: rotationAngle,
            center: center,
            translation: { x: 0, y: 0 },
            type: 'rotation'
        };
    }

    // 🔥 ПОВОРОТ ГРАФА С ТРАНСФОРМАЦИЕЙ
    rotateGraph(graph, transformation) {
        const SimpleGraph = require('./simple-graph');
        const rotatedGraph = new SimpleGraph(`${graph.name || 'graph'} (нормализованный)`);

        const matrix = transformation.matrix;
        const center = transformation.center;

        // Поворачиваем и добавляем узлы
        graph.nodes.forEach((node, nodeId) => {
            const relX = node.x - center.x;
            const relY = node.y - center.y;

            const transformedX = relX * matrix[0] + relY * matrix[1] + center.x + matrix[2];
            const transformedY = relX * matrix[3] + relY * matrix[4] + center.y + matrix[5];

            rotatedGraph.addNode(
                { x: transformedX, y: transformedY },
                node.confidence || 0.5
            );
        });

        return rotatedGraph;
    }

    // 🔥 ОПРЕДЕЛЕНИЕ ТИПА НОГИ
    determineFootType(graph) {
        const points = this.extractPointsFromGraph(graph);
        if (points.length < 10) return 'unknown';

        const center = this.calculateCenter(points);
        const leftPoints = points.filter(p => p.x < center.x);
        const rightPoints = points.filter(p => p.x >= center.x);

        const leftDensity = leftPoints.length / points.length;
        const rightDensity = rightPoints.length / points.length;

        if (leftDensity > rightDensity * 1.2) return 'right';
        if (rightDensity > leftDensity * 1.2) return 'left';
        return 'unknown';
    }

    // 🔥 РАСЧЕТ ГРАНИЦ
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК ИЗ ГРАФА
    extractPointsFromGraph(graph) {
        const points = [];

        if (!graph || !graph.nodes) return points;

        graph.nodes.forEach((node, nodeId) => {
            points.push({
                id: nodeId,
                x: node.x || 0,
                y: node.y || 0,
                confidence: node.confidence || 0.5
            });
        });

        return points;
    }

    // 🔥 ВЫЧИСЛЕНИЕ ЦЕНТРА
    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 🔥 ВЫЧИСЛЕНИЕ КОВАРИАЦИОННОЙ МАТРИЦЫ
    calculateCovarianceMatrix(points) {
        let xx = 0, xy = 0, yy = 0;

        points.forEach(p => {
            xx += p.x * p.x;
            xy += p.x * p.y;
            yy += p.y * p.y;
        });

        const n = points.length;
        return [
            [xx / n, xy / n],
            [xy / n, yy / n]
        ];
    }

    // 🔥 ВЫЧИСЛЕНИЕ СОБСТВЕННЫХ ВЕКТОРОВ
    calculateEigenvectors(matrix) {
        const a = matrix[0][0];
        const b = matrix[0][1];
        const c = matrix[1][0];
        const d = matrix[1][1];

        const trace = a + d;
        const det = a * d - b * c;

        const lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;
        const lambda2 = (trace - Math.sqrt(trace * trace - 4 * det)) / 2;

        let eigenvector1, eigenvector2;

        if (Math.abs(b) > 1e-10) {
            eigenvector1 = [lambda1 - d, c];
            eigenvector2 = [lambda2 - d, c];
        } else if (Math.abs(c) > 1e-10) {
            eigenvector1 = [b, lambda1 - a];
            eigenvector2 = [b, lambda2 - a];
        } else {
            eigenvector1 = [1, 0];
            eigenvector2 = [0, 1];
        }

        const norm1 = Math.sqrt(eigenvector1[0]*eigenvector1[0] + eigenvector1[1]*eigenvector1[1]);
        const norm2 = Math.sqrt(eigenvector2[0]*eigenvector2[0] + eigenvector2[1]*eigenvector2[1]);

        if (norm1 > 0) {
            eigenvector1[0] /= norm1;
            eigenvector1[1] /= norm1;
        }
        if (norm2 > 0) {
            eigenvector2[0] /= norm2;
            eigenvector2[1] /= norm2;
        }

        if (lambda1 >= lambda2) {
            return [eigenvector1, eigenvector2];
        } else {
            return [eigenvector2, eigenvector1];
        }
    }

    // 🔥 СТАРЫЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ (с исправлениями)
    detectRotationAngle(points) {
        return this.normalizeAngle(this.calculatePrincipalAngle({ nodes: new Map(points.map((p, i) => [i, p])) }));
    }

    // 🔥 СТАРЫЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    normalizeWithRelativePreservation(graph, metadata = {}) {
        console.log(`\n🔄 НОРМАЛИЗАЦИЯ С СОХРАНЕНИЕМ ПРОПОРЦИЙ:`);
        return this.normalizeToCanonical(graph, metadata);
    }

    // 🔥 СТАРЫЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    compareWithRotationInvariance(graph1, graph2, options = {}) {
        console.log(`\n🔄 СРАВНЕНИЕ С ПОВОРОТНОЙ ИНВАРИАНТНОСТЬЮ:`);
       
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);

        const nodeRatio = Math.min(points1.length, points2.length) /
                        Math.max(points1.length, points2.length);

        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );

        const sizeSimilarity = Math.max(0, Math.min(1, nodeRatio));
        const centerSimilarity = Math.max(0, Math.min(1, 1 - centerDistance / 300));
        const totalSimilarity = (sizeSimilarity * 0.6 + centerSimilarity * 0.4);

        return {
            similarity: totalSimilarity,
            decision: totalSimilarity > 0.7 ? 'same' :
                    totalSimilarity > 0.5 ? 'similar' : 'different',
            reason: `Простое сравнение: ${totalSimilarity.toFixed(3)}`,
            details: {
                nodeCount1: points1.length,
                nodeCount2: points2.length,
                nodeRatio: nodeRatio,
                centerDistance: centerDistance,
                sizeSimilarity: sizeSimilarity,
                centerSimilarity: centerSimilarity
            },
            method: 'simple_rotation_invariant'
        };
    }

    // 🔥 СТАРЫЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    compareWithAllMethods(graph1, graph2, options = {}) {
        console.log(`\n🔍 КОМБИНИРОВАННОЕ ИНВАРИАНТНОЕ СРАВНЕНИЕ:`);
       
        const huResult = this.compareWithHuMoments(graph1, graph2);
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);
        const sizeRatio = Math.min(points1.length, points2.length) /
                        Math.max(points1.length, points2.length);
        const sizeScore = Math.max(0, Math.min(1, sizeRatio * 1.5 - 0.5));

        const totalSimilarity = huResult.similarity * 0.7 + sizeScore * 0.3;

        let decision, reason;
        if (totalSimilarity >= 0.7) {
            decision = 'same';
            reason = `Инвариантная схожесть (${totalSimilarity.toFixed(3)})`;
        } else if (totalSimilarity >= 0.5) {
            decision = 'similar';
            reason = `Умеренная схожесть (${totalSimilarity.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть (${totalSimilarity.toFixed(3)})`;
        }

        return {
            similarity: totalSimilarity,
            decision: decision,
            reason: reason,
            details: {
                huMoments: huResult.similarity,
                sizeScore: sizeScore
            },
            method: 'safe_invariant_comparison'
        };
    }

    // 🔥 СТАРЫЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    compareWithHuMoments(graph1, graph2) {
        const hu1 = this.calculateHuMoments(graph1);
        const hu2 = this.calculateHuMoments(graph2);

        let similarity = 0;
        const weights = [0.2, 0.2, 0.15, 0.15, 0.1, 0.1, 0.1];

        for (let i = 0; i < 7; i++) {
            const diff = Math.abs(hu1[i] - hu2[i]);
            const maxAbs = Math.max(Math.abs(hu1[i]), Math.abs(hu2[i]));
            const normalizedDiff = maxAbs > 0 ? diff / maxAbs : 0;
            similarity += (1 - normalizedDiff) * weights[i];
        }

        return {
            similarity: Math.max(0, Math.min(1, similarity)),
            method: 'hu_moments'
        };
    }

    // 🔥 СТАРЫЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    calculateHuMoments(graph) {
        const points = this.extractPointsFromGraph(graph);
        if (points.length < 3) return Array(7).fill(0);

        const center = this.calculateCenter(points);

        let m00 = 0, m10 = 0, m01 = 0;
        let m20 = 0, m02 = 0, m11 = 0;
        let m30 = 0, m03 = 0, m12 = 0, m21 = 0;

        points.forEach(p => {
            const x = p.x - center.x;
            const y = p.y - center.y;

            m00 += 1;
            m10 += x;
            m01 += y;
            m20 += x * x;
            m02 += y * y;
            m11 += x * y;
            m30 += x * x * x;
            m03 += y * y * y;
            m12 += x * y * y;
            m21 += x * x * y;
        });

        const n20 = m20 / m00;
        const n02 = m02 / m00;
        const n11 = m11 / m00;
        const n30 = m30 / m00;
        const n03 = m03 / m00;
        const n12 = m12 / m00;
        const n21 = m21 / m00;

        const hu = [
            n20 + n02,
            Math.pow((n20 - n02), 2) + 4 * Math.pow(n11, 2),
            Math.pow((n30 - 3 * n12), 2) + Math.pow((3 * n21 - n03), 2),
            Math.pow((n30 + n12), 2) + Math.pow((n21 + n03), 2),
            (n30 - 3 * n12) * (n30 + n12) * (Math.pow((n30 + n12), 2) - 3 * Math.pow((n21 + n03), 2)) +
            (3 * n21 - n03) * (n21 + n03) * (3 * Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2)),
            (n20 - n02) * (Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2)) +
            4 * n11 * (n30 + n12) * (n21 + n03),
            (3 * n21 - n03) * (n30 + n12) * (Math.pow((n30 + n12), 2) - 3 * Math.pow((n21 + n03), 2)) -
            (n30 - 3 * n12) * (n21 + n03) * (3 * Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2))
        ];

        return hu.map(h => Math.log(Math.abs(h) + 1e-10));
    }
}

module.exports = RotationInvariance;
