// modules/footprint/rotation-invariance.js
// АВТООПРЕДЕЛЕНИЕ УГЛА ПОВОРОТА И НОРМАЛИЗАЦИЯ ПРОТЕКТОРА (ИСПРАВЛЕННАЯ ВЕРСИЯ)

class RotationInvariance {
    constructor(options = {}) {
        this.config = {
            canonicalOrientation: 'horizontal',
            rotationStep: 15,
            maxRotationAngle: 180,
            enableAutoRotation: true,
            debug: options.debug || false,
            ...options
        };

        console.log('🎯 RotationInvariance инициализирован (безопасная версия)');
    }

    // 1. ОСНОВНОЙ МЕТОД: Автоматическая нормализация графа к канонической ориентации
    normalizeToCanonical(graph, metadata = {}) {
        console.log(`🔄 Нормализую граф "${graph.name}" к канонической ориентации...`);

        // Извлечь точки из графа
        const points = this.extractPointsFromGraph(graph);

        if (points.length < 3) {
            console.log('⚠️ Недостаточно точек для определения ориентации');
            return { graph, rotationAngle: 0, isMirrored: false };
        }

        // 1. Определить текущий угол поворота
        const rotationAngle = this.detectRotationAngle(points);
        console.log(`📐 Определён угол поворота: ${rotationAngle.toFixed(1)}°`);

        // 2. Определить зеркальность
        const mirrorInfo = this.detectMirroring(points);
        console.log(`🪞 Зеркальность: ${mirrorInfo.isMirrored ? 'зеркальный' : 'оригинал'}, тип: ${mirrorInfo.footType || 'неизвестно'}`);

        // 3. Повернуть граф к канонической ориентации
        const normalizedGraph = this.rotateGraph(graph, -rotationAngle, mirrorInfo.isMirrored);

        // 4. Перестроить связи после поворота
        this.rebuildEdges(normalizedGraph);

        // 5. Сохранить метаданные поворота
        normalizedGraph.rotationMetadata = {
            originalAngle: rotationAngle,
            normalizedAngle: 0,
            isMirrored: mirrorInfo.isMirrored,
            footType: mirrorInfo.footType,
            normalizationDate: new Date(),
            ...metadata
        };

        console.log(`✅ Граф нормализован к канонической ориентации`);

        return {
            graph: normalizedGraph,
            rotationAngle: rotationAngle,
            isMirrored: mirrorInfo.isMirrored,
            footType: mirrorInfo.footType,
            metadata: normalizedGraph.rotationMetadata
        };
    }

    // 2. МЕТОД: Определение угла поворота с помощью PCA
    detectRotationAngle(points) {
        if (points.length < 3) return 0;

        // 1. Вычисляем центр масс
        const center = this.calculateCenter(points);

        // 2. Центрируем точки
        const centeredPoints = points.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y
        }));

        // 3. Строим ковариационную матрицу
        const covMatrix = this.calculateCovarianceMatrix(centeredPoints);

        // 4. Находим собственные векторы (PCA)
        const eigenvectors = this.calculateEigenvectors(covMatrix);

        // 5. Главная ось = собственный вектор с максимальным собственным значением
        const mainAxis = eigenvectors[0];

        // 6. Вычисляем угол относительно горизонтали
        let angleRad = Math.atan2(mainAxis[1], mainAxis[0]);
        let angleDeg = angleRad * (180 / Math.PI);

        // 7. Нормализуем угол к [-90°, 90°]
        if (angleDeg > 90) angleDeg -= 180;
        if (angleDeg < -90) angleDeg += 180;

        return angleDeg;
    }

    // 3. МЕТОД: Определение зеркальности
    detectMirroring(points) {
        if (points.length < 10) {
            return { isMirrored: false, footType: 'unknown', confidence: 0 };
        }

        const center = this.calculateCenter(points);

        // Разделяем точки на левую и правую половины
        const leftPoints = points.filter(p => p.x < center.x);
        const rightPoints = points.filter(p => p.x >= center.x);

        const leftDensity = leftPoints.length / points.length;
        const rightDensity = rightPoints.length / points.length;

        const asymmetry = leftDensity - rightDensity;
        const threshold = 0.1;

        let isMirrored = false;
        let footType = 'unknown';
        let confidence = Math.min(1, Math.abs(asymmetry) / 0.3);

        if (Math.abs(asymmetry) > threshold) {
            if (asymmetry > 0) {
                footType = 'right';
                isMirrored = false;
            } else {
                footType = 'left';
                isMirrored = true;
            }
        }

        console.log(`🦶 Асимметрия: ${asymmetry.toFixed(3)}, тип: ${footType}, уверенность: ${confidence.toFixed(2)}`);

        return { isMirrored, footType, confidence, asymmetry };
    }

    // 4. МЕТОД: Поворот графа на заданный угол
    rotateGraph(graph, angleDeg, mirror = false) {
        const angleRad = angleDeg * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const center = this.calculateCenter(Array.from(graph.nodes.values()));

        // Создаем копию графа
        const SimpleGraph = require('./simple-graph');
        const rotatedGraph = new SimpleGraph(`${graph.name} (нормализованный)`);

        // Поворачиваем и добавляем узлы
        graph.nodes.forEach((node, nodeId) => {
            // Сдвигаем к центру
            let x = node.x - center.x;
            let y = node.y - center.y;

            // Поворачиваем
            let rotatedX = x * cosA - y * sinA;
            let rotatedY = x * sinA + y * cosA;

            // Зеркалим если нужно
            if (mirror) {
                rotatedX = -rotatedX;
            }

            // Возвращаем на место
            rotatedX += center.x;
            rotatedY += center.y;

            // Добавляем узел
            rotatedGraph.addNode(
                { x: rotatedX, y: rotatedY },
                node.confidence || 0.5
            );
        });

        // Копируем метаданные
        rotatedGraph.originalGraphId = graph.id;
        rotatedGraph.originalName = graph.name;

        return rotatedGraph;
    }

    // 5. МЕТОД: Перестроение рёбер после поворота
    rebuildEdges(graph) {
        const nodes = Array.from(graph.nodes.values());

        // Очищаем существующие рёбра
        graph.edges.clear();

        // Для каждого узла находим 3 ближайших соседа
        nodes.forEach((node1, i) => {
            const distances = [];

            nodes.forEach((node2, j) => {
                if (i !== j) {
                    const dist = Math.sqrt(
                        Math.pow(node2.x - node1.x, 2) +
                        Math.pow(node2.y - node1.y, 2)
                    );
                    distances.push({ index: j, distance: dist, node: node2 });
                }
            });

            // Сортируем по расстоянию и берём ближайших
            distances.sort((a, b) => a.distance - b.distance);
            const nearest = distances.slice(0, 3);

            // Добавляем рёбра
            nearest.forEach(neighbor => {
                const nodeId1 = Array.from(graph.nodes.keys())[i];
                const nodeId2 = Array.from(graph.nodes.keys())[neighbor.index];
                graph.addEdge(nodeId1, nodeId2);
            });
        });

        console.log(`🔗 Перестроено ${graph.edges.size} рёбер после поворота`);
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: БЕЗ РЕКУРСИИ
    compareWithRotationInvariance(graph1, graph2, options = {}) {
        console.log(`🔄 Сравнение с поворотной инвариантностью (безопасная версия)...`);

        const startTime = Date.now();

        // 🔥 ПРОСТОЕ СРАВНЕНИЕ БЕЗ СОЗДАНИЯ SimpleGraphMatcher
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);

        // 1. Простое сравнение по количеству точек
        const nodeRatio = Math.min(points1.length, points2.length) /
                         Math.max(points1.length, points2.length);

        // 2. Сравнить центры
        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );

        // 3. Простая оценка схожести
        const sizeSimilarity = Math.max(0, Math.min(1, nodeRatio));
        const centerSimilarity = Math.max(0, Math.min(1, 1 - centerDistance / 300));

        const totalSimilarity = (sizeSimilarity * 0.6 + centerSimilarity * 0.4);

        const result = {
            similarity: totalSimilarity,
            decision: totalSimilarity > 0.7 ? 'same' :
                     totalSimilarity > 0.5 ? 'similar' : 'different',
            reason: `Простое сравнение: ${totalSimilarity.toFixed(3)}`,
            method: 'simple_rotation_invariant',
            timeMs: Date.now() - startTime
        };

        console.log(`✅ Простое сравнение: ${totalSimilarity.toFixed(3)}`);

        return result;
    }

    // 7. МЕТОД: Создание полярных координат
    createPolarDescriptors(graph) {
        const nodes = Array.from(graph.nodes.values());
        const center = this.calculateCenter(nodes);

        // Преобразуем в полярные координаты относительно центра
        const polarPoints = nodes.map(node => {
            const dx = node.x - center.x;
            const dy = node.y - center.y;

            return {
                r: Math.sqrt(dx * dx + dy * dy),
                theta: Math.atan2(dy, dx),
                originalNode: node
            };
        });

        // Сортируем по углу
        polarPoints.sort((a, b) => a.theta - b.theta);

        // Нормализуем углы к [0, 2π]
        const normalized = polarPoints.map(p => ({
            r: p.r,
            theta: p.theta < 0 ? p.theta + 2 * Math.PI : p.theta,
            originalNode: p.originalNode
        }));

        return {
            center,
            polarPoints: normalized,
            nodeCount: nodes.length
        };
    }

    // 8. МЕТОД: Сравнение по полярным дескрипторам
    comparePolarDescriptors(desc1, desc2) {
        if (desc1.nodeCount < 5 || desc2.nodeCount < 5) {
            return { similarity: 0, method: 'polar_invalid' };
        }

        // Приводим к одинаковому количеству точек
        const normalized1 = this.normalizePolarDescriptor(desc1);
        const normalized2 = this.normalizePolarDescriptor(desc2);

        // Сравниваем радиальные распределения
        const radialSimilarity = this.compareRadialDistributions(normalized1, normalized2);

        // Сравниваем угловые распределения
        const angularSimilarity = this.compareAngularDistributions(normalized1, normalized2);

        // Комбинируем
        const similarity = radialSimilarity * 0.6 + angularSimilarity * 0.4;

        return {
            similarity: Math.max(0, Math.min(1, similarity)),
            radialSimilarity,
            angularSimilarity,
            method: 'polar_comparison'
        };
    }

    // 9. МЕТОД: Нормализация полярного дескриптора
    normalizePolarDescriptor(desc, targetPoints = 36) {
        if (desc.polarPoints.length === 0) {
            return { radii: Array(targetPoints).fill(0), angles: Array(targetPoints).fill(0) };
        }

        // Интерполируем к фиксированному количеству точек
        const radii = [];
        const angles = [];

        const angleStep = (2 * Math.PI) / targetPoints;

        for (let i = 0; i < targetPoints; i++) {
            const targetAngle = i * angleStep;

            // Находим ближайшие точки для интерполяции
            const nearest = this.findNearestAngles(desc.polarPoints, targetAngle);

            if (nearest.before && nearest.after) {
                // Линейная интерполяция по углу
                const t = (targetAngle - nearest.before.theta) /
                         (nearest.after.theta - nearest.before.theta);
                const interpRadius = nearest.before.r * (1 - t) + nearest.after.r * t;

                radii.push(interpRadius);
                angles.push(targetAngle);
            } else {
                radii.push(0);
                angles.push(targetAngle);
            }
        }

        // Нормализуем радиусы к [0, 1]
        const maxRadius = Math.max(...radii.filter(r => !isNaN(r)));
        const normalizedRadii = maxRadius > 0 ?
            radii.map(r => r / maxRadius) : Array(targetPoints).fill(0);

        return {
            radii: normalizedRadii,
            angles: angles,
            center: desc.center,
            originalPoints: desc.polarPoints.length
        };
    }

    // 10. МЕТОД: Поиск ближайших углов для интерполяции
    findNearestAngles(polarPoints, targetAngle) {
        let before = null;
        let after = null;

        for (const point of polarPoints) {
            if (point.theta <= targetAngle) {
                if (!before || point.theta > before.theta) {
                    before = point;
                }
            }
            if (point.theta >= targetAngle) {
                if (!after || point.theta < after.theta) {
                    after = point;
                }
            }
        }

        // Замыкаем круг
        if (!before && polarPoints.length > 0) {
            before = polarPoints[polarPoints.length - 1];
            before = { ...before, theta: before.theta - 2 * Math.PI };
        }
        if (!after && polarPoints.length > 0) {
            after = polarPoints[0];
            after = { ...after, theta: after.theta + 2 * Math.PI };
        }

        return { before, after };
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: БЕЗ РЕКУРСИИ
    compareWithAllMethods(graph1, graph2, options = {}) {
        console.log(`🔍 Комбинированное инвариантное сравнение (безопасная версия)...`);

        const startTime = Date.now();

        // 🔥 ИСПОЛЬЗУЕМ ТОЛЬКО ПРОСТЫЕ МЕТОДЫ БЕЗ СОЗДАНИЯ SimpleGraphMatcher

        // 1. Сравнение с Hu моментами
        const huResult = this.compareWithHuMoments(graph1, graph2);

        // 2. Сравнение по полярным дескрипторам
        const polarDesc1 = this.createPolarDescriptors(graph1);
        const polarDesc2 = this.createPolarDescriptors(graph2);
        const polarResult = this.comparePolarDescriptors(polarDesc1, polarDesc2);

        // 3. Простая проверка размеров
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);
        const sizeRatio = Math.min(points1.length, points2.length) /
                         Math.max(points1.length, points2.length);
        const sizeScore = Math.max(0, Math.min(1, sizeRatio * 1.5 - 0.5));

        // 4. Простая оценка
        const totalSimilarity =
            huResult.similarity * 0.4 +
            polarResult.similarity * 0.4 +
            sizeScore * 0.2;

        // 5. Определение решения
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

        const finalResult = {
            similarity: totalSimilarity,
            decision: decision,
            reason: reason,
            details: {
                huMoments: huResult.similarity,
                polarDescriptors: polarResult.similarity,
                sizeScore: sizeScore
            },
            processingTime: Date.now() - startTime,
            method: 'safe_invariant_comparison'
        };

        console.log(`✅ Безопасное сравнение: ${totalSimilarity.toFixed(3)} (${decision})`);

        return finalResult;
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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

    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

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

    calculateEigenvectors(matrix) {
        // Простой расчет для 2x2 матрицы
        const a = matrix[0][0];
        const b = matrix[0][1];
        const c = matrix[1][0];
        const d = matrix[1][1];

        // Характеристическое уравнение: λ² - (a+d)λ + (ad - bc) = 0
        const trace = a + d;
        const det = a * d - b * c;

        // Собственные значения
        const lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;
        const lambda2 = (trace - Math.sqrt(trace * trace - 4 * det)) / 2;

        // Собственные векторы (нормализованные)
        let eigenvector1, eigenvector2;

        if (Math.abs(b) > 1e-10) {
            eigenvector1 = [lambda1 - d, c];
            eigenvector2 = [lambda2 - d, c];
        } else if (Math.abs(c) > 1e-10) {
            eigenvector1 = [b, lambda1 - a];
            eigenvector2 = [b, lambda2 - a];
        } else {
            // Диагональная матрица
            eigenvector1 = [1, 0];
            eigenvector2 = [0, 1];
        }

        // Нормализуем
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

        // Возвращаем отсортированные по собственным значениям
        if (lambda1 >= lambda2) {
            return [eigenvector1, eigenvector2];
        } else {
            return [eigenvector2, eigenvector1];
        }
    }

    compareRadialDistributions(desc1, desc2) {
        if (desc1.radii.length !== desc2.radii.length) return 0;

        let sumDiff = 0;
        for (let i = 0; i < desc1.radii.length; i++) {
            sumDiff += Math.abs(desc1.radii[i] - desc2.radii[i]);
        }

        return Math.max(0, 1 - sumDiff / desc1.radii.length);
    }

    compareAngularDistributions(desc1, desc2) {
        // Сдвигаем второй дескриптор для поиска наилучшего совпадения
        const len = desc1.angles.length;
        let bestScore = 0;

        for (let shift = 0; shift < len; shift++) {
            let score = 0;
            for (let i = 0; i < len; i++) {
                const j = (i + shift) % len;
                const angleDiff = Math.abs(desc1.angles[i] - desc2.angles[j]);
                const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff) / Math.PI;
                score += 1 - normalizedDiff;
            }
            score /= len;
            bestScore = Math.max(bestScore, score);
        }

        return bestScore;
    }

    // 12. МЕТОД: Расчет Hu моментов
    calculateHuMoments(graph) {
        const points = this.extractPointsFromGraph(graph);
        if (points.length < 3) return Array(7).fill(0);

        const center = this.calculateCenter(points);

        // Центрированные моменты
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

        // Нормализованные центральные моменты
        const n20 = m20 / m00;
        const n02 = m02 / m00;
        const n11 = m11 / m00;
        const n30 = m30 / m00;
        const n03 = m03 / m00;
        const n12 = m12 / m00;
        const n21 = m21 / m00;

        // Hu моменты (инвариантные)
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

        // Логарифмическая шкала
        return hu.map(h => Math.log(Math.abs(h) + 1e-10));
    }

    // 13. МЕТОД: Инвариантное сравнение с Hu моментами
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
}

module.exports = RotationInvariance;
