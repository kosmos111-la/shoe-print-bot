// modules/footprint/mirror-detection.js
// ОПРЕДЕЛЕНИЕ ЛЕВОГО/ПРАВОГО СЛЕДА И ЗЕРКАЛЬНОЙ ИНВАРИАНТНОСТИ

class MirrorDetection {
    constructor(options = {}) {
        this.config = {
            symmetryThreshold: 0.15, // Порог для определения симметрии
            footTypeConfidenceThreshold: 0.7,
            enableMirrorCorrection: true,
            debug: options.debug || false,
            ...options
        };

        console.log('🪞 MirrorDetection инициализирован');
    }

    // 1. ОСНОВНОЙ МЕТОД: Определить тип следа (левый/правый)
    detectFootType(graph) {
        console.log(`🦶 Определяю тип следа для "${graph.name}"...`);

        const points = this.extractPointsFromGraph(graph);
        if (points.length < 10) {
            return {
                footType: 'unknown',
                confidence: 0,
                reason: 'Недостаточно точек',
                isMirrored: false
            };
        }

        // 1. Определяем ориентацию (носок направлен вправо или влево)
        const orientation = this.detectOrientation(points);
       
        // 2. Определяем симметрию (для проверки зеркальности)
        const symmetry = this.calculateSymmetry(points);
       
        // 3. Анализируем распределение по квадрантам
        const quadrantAnalysis = this.analyzeQuadrants(points);
       
        // 4. Определяем тип следа
        let footType = 'unknown';
        let confidence = 0;
        let isMirrored = false;
       
        if (orientation.direction === 'right' && quadrantAnalysis.rightBias > 0.1) {
            footType = 'right';
            confidence = orientation.confidence * 0.6 + quadrantAnalysis.rightBias * 0.4;
            isMirrored = false;
        } else if (orientation.direction === 'left' && quadrantAnalysis.leftBias > 0.1) {
            footType = 'left';
            confidence = orientation.confidence * 0.6 + quadrantAnalysis.leftBias * 0.4;
            isMirrored = true; // Левый след зеркален относительно правого
        } else if (symmetry.score > this.config.symmetryThreshold) {
            // Высокая симметрия - возможно это отпечаток без четкой левости/правости
            footType = 'neutral';
            confidence = symmetry.score;
            isMirrored = false;
        }
       
        // Порог уверенности
        if (confidence < this.config.footTypeConfidenceThreshold) {
            footType = 'unknown';
            confidence = 0;
        }
       
        const result = {
            footType: footType,
            confidence: Math.max(0, Math.min(1, confidence)),
            isMirrored: isMirrored,
            orientation: orientation,
            symmetry: symmetry,
            quadrantAnalysis: quadrantAnalysis,
            pointCount: points.length
        };
       
        console.log(`✅ Тип следа: ${footType}, уверенность: ${result.confidence.toFixed(3)}, зеркало: ${isMirrored}`);
       
        return result;
    }

    // 2. МЕТОД: Определение ориентации (куда направлен носок)
    detectOrientation(points) {
        if (points.length < 3) {
            return { direction: 'unknown', confidence: 0, angle: 0 };
        }
       
        // Находим bounding box
        const bounds = this.calculateBounds(points);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
       
        // Определяем главную ось через PCA
        const center = this.calculateCenter(points);
        const centeredPoints = points.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y
        }));
       
        const covMatrix = this.calculateCovarianceMatrix(centeredPoints);
        const eigenvectors = this.calculateEigenvectors(covMatrix);
        const mainAxis = eigenvectors[0];
       
        // Угол главной оси
        const angleRad = Math.atan2(mainAxis[1], mainAxis[0]);
        const angleDeg = angleRad * (180 / Math.PI);
       
        // Определяем направление по углу
        let direction = 'unknown';
        let confidence = Math.abs(mainAxis[0]); // Уверенность по компоненте X
       
        // Нормализуем угол
        let normalizedAngle = angleDeg;
        while (normalizedAngle < -90) normalizedAngle += 180;
        while (normalizedAngle > 90) normalizedAngle -= 180;
       
        if (Math.abs(normalizedAngle) < 45) {
            // Примерно горизонтально
            if (mainAxis[0] > 0) {
                direction = 'right'; // Носок направлен вправо
            } else {
                direction = 'left';  // Носок направлен влево
            }
            confidence = Math.abs(mainAxis[0]);
        } else {
            // Более вертикально
            if (mainAxis[1] > 0) {
                direction = 'up';    // Носок направлен вверх
            } else {
                direction = 'down';  // Носок направлен вниз
            }
            confidence = Math.abs(mainAxis[1]);
        }
       
        return {
            direction: direction,
            confidence: Math.max(0, Math.min(1, confidence)),
            angle: normalizedAngle,
            mainAxis: mainAxis,
            width: width,
            height: height,
            aspectRatio: width / height
        };
    }

    // 3. МЕТОД: Расчет симметрии относительно вертикальной оси
    calculateSymmetry(points) {
        if (points.length < 6) {
            return { score: 0, axis: 'vertical', symmetric: false };
        }
       
        const center = this.calculateCenter(points);
        const bounds = this.calculateBounds(points);
        const width = bounds.maxX - bounds.minX;
       
        // Разделяем точки на левую и правую половины
        const leftPoints = points.filter(p => p.x < center.x);
        const rightPoints = points.filter(p => p.x >= center.x);
       
        if (leftPoints.length === 0 || rightPoints.length === 0) {
            return { score: 0, axis: 'vertical', symmetric: false };
        }
       
        // Зеркалим правые точки относительно вертикальной оси
        const mirroredRightPoints = rightPoints.map(p => ({
            x: center.x - (p.x - center.x), // Зеркальное отражение
            y: p.y,
            original: p
        }));
       
        // Для каждой зеркальной правой точки ищем ближайшую левую
        let totalMatchScore = 0;
        let matchedPairs = 0;
       
        mirroredRightPoints.forEach(mirroredPoint => {
            let bestMatch = null;
            let bestDistance = Infinity;
           
            leftPoints.forEach(leftPoint => {
                const distance = Math.sqrt(
                    Math.pow(leftPoint.x - mirroredPoint.x, 2) +
                    Math.pow(leftPoint.y - mirroredPoint.y, 2)
                );
               
                // Нормализованное расстояние (относительно ширины)
                const normalizedDistance = distance / (width / 2);
               
                if (normalizedDistance < 0.2 && normalizedDistance < bestDistance) {
                    bestDistance = normalizedDistance;
                    bestMatch = {
                        leftPoint: leftPoint,
                        mirroredRightPoint: mirroredPoint,
                        distance: distance,
                        normalizedDistance: normalizedDistance
                    };
                }
            });
           
            if (bestMatch) {
                const matchScore = 1 - Math.min(1, bestMatch.normalizedDistance * 3);
                totalMatchScore += matchScore;
                matchedPairs++;
            }
        });
       
        const symmetryScore = matchedPairs > 0 ?
            totalMatchScore / Math.max(leftPoints.length, rightPoints.length) : 0;
       
        const isSymmetric = symmetryScore > this.config.symmetryThreshold;
       
        return {
            score: symmetryScore,
            axis: 'vertical',
            symmetric: isSymmetric,
            matchedPairs: matchedPairs,
            leftCount: leftPoints.length,
            rightCount: rightPoints.length
        };
    }

    // 4. МЕТОД: Анализ распределения по квадрантам
    analyzeQuadrants(points) {
        const bounds = this.calculateBounds(points);
        const center = this.calculateCenter(points);
       
        const quadrants = {
            topLeft: 0,     // x < center.x, y < center.y
            topRight: 0,    // x >= center.x, y < center.y
            bottomLeft: 0,  // x < center.x, y >= center.y
            bottomRight: 0  // x >= center.x, y >= center.y
        };
       
        points.forEach(point => {
            if (point.y < center.y) {
                if (point.x < center.x) quadrants.topLeft++;
                else quadrants.topRight++;
            } else {
                if (point.x < center.x) quadrants.bottomLeft++;
                else quadrants.bottomRight++;
            }
        });
       
        const total = points.length;
        const proportions = {
            topLeft: quadrants.topLeft / total,
            topRight: quadrants.topRight / total,
            bottomLeft: quadrants.bottomLeft / total,
            bottomRight: quadrants.bottomRight / total
        };
       
        // Для правой обуви ожидаем больше точек в левой части (носок вправо)
        // Для левой обуви ожидаем больше точек в правой части (носок влево)
        const leftBias = (quadrants.topLeft + quadrants.bottomLeft) / total;
        const rightBias = (quadrants.topRight + quadrants.bottomRight) / total;
       
        return {
            quadrants: proportions,
            leftBias: leftBias,
            rightBias: rightBias,
            asymmetry: Math.abs(leftBias - rightBias),
            totalPoints: total
        };
    }

    // 5. МЕТОД: Зеркальное отражение графа
    mirrorGraph(graph, axis = 'vertical') {
        console.log(`🪞 Зеркалю граф "${graph.name}" относительно оси ${axis}...`);
       
        const points = this.extractPointsFromGraph(graph);
        const center = this.calculateCenter(points);
       
        const SimpleGraph = require('./simple-graph');
        const mirroredGraph = new SimpleGraph(`${graph.name} (зеркальный)`);
       
        // Зеркалим каждый узел
        graph.nodes.forEach((node, nodeId) => {
            let mirroredX = node.x;
            let mirroredY = node.y;
           
            if (axis === 'vertical') {
                // Отражение относительно вертикальной оси через центр
                mirroredX = center.x - (node.x - center.x);
            } else if (axis === 'horizontal') {
                // Отражение относительно горизонтальной оси
                mirroredY = center.y - (node.y - center.y);
            } else if (axis === 'both') {
                // Отражение относительно обеих осей
                mirroredX = center.x - (node.x - center.x);
                mirroredY = center.y - (node.y - center.y);
            }
           
            mirroredGraph.addNode(
                { x: mirroredX, y: mirroredY },
                node.confidence || 0.5
            );
        });
       
        // Восстанавливаем рёбра
        this.rebuildEdges(mirroredGraph);
       
        // Сохраняем метаданные зеркалирования
        mirroredGraph.mirrorMetadata = {
            originalGraphId: graph.id,
            mirrorAxis: axis,
            mirrorCenter: center,
            mirroredAt: new Date()
        };
       
        console.log(`✅ Граф зеркалирован: ${mirroredGraph.nodes.size} узлов`);
       
        return mirroredGraph;
    }

    // 6. МЕТОД: Автокоррекция зеркальности (приведение всех следов к одному "типу")
    autoCorrectMirroring(graph, targetFootType = 'right') {
        console.log(`🔄 Автокоррекция зеркальности к типу: ${targetFootType}...`);
       
        // Определяем текущий тип
        const detection = this.detectFootType(graph);
       
        let correctedGraph = graph;
        let correctionApplied = false;
        let correctionType = 'none';
       
        // Если текущий тип не соответствует целевому и уверенность достаточна
        if (detection.footType !== targetFootType &&
            detection.confidence > this.config.footTypeConfidenceThreshold) {
           
            if (targetFootType === 'right' && detection.footType === 'left') {
                // Нужно зеркалить левый след, чтобы сделать его "правым"
                correctedGraph = this.mirrorGraph(graph, 'vertical');
                correctionApplied = true;
                correctionType = 'mirrored_vertical';
            } else if (targetFootType === 'left' && detection.footType === 'right') {
                // Нужно зеркалить правый след, чтобы сделать его "левым"
                correctedGraph = this.mirrorGraph(graph, 'vertical');
                correctionApplied = true;
                correctionType = 'mirrored_vertical';
            }
        }
       
        // Проверяем результат
        const correctedDetection = this.detectFootType(correctedGraph);
       
        return {
            graph: correctedGraph,
            originalDetection: detection,
            correctedDetection: correctedDetection,
            correctionApplied: correctionApplied,
            correctionType: correctionType,
            targetFootType: targetFootType,
            success: correctedDetection.footType === targetFootType ||
                    correctedDetection.confidence < this.config.footTypeConfidenceThreshold
        };
    }

    // 7. МЕТОД: Сравнение с учетом зеркальности
    compareWithMirrorInvariance(graph1, graph2, options = {}) {
        console.log(`🔍 Сравнение с зеркальной инвариантностью...`);
       
        const startTime = Date.now();
       
        // Определяем типы следов
        const type1 = this.detectFootType(graph1);
        const type2 = this.detectFootType(graph2);
       
        console.log(`   Тип 1: ${type1.footType} (уверенность: ${type1.confidence.toFixed(3)})`);
        console.log(`   Тип 2: ${type2.footType} (уверенность: ${type2.confidence.toFixed(3)})`);
       
        // Используем существующий матчер
        const SimpleGraphMatcher = require('./simple-matcher');
        const matcher = new SimpleGraphMatcher({
            debug: this.config.debug
        });
       
        const results = [];
       
        // Вариант 1: Прямое сравнение
        const directComparison = matcher.compareGraphs(graph1, graph2, {
            ...options,
            mirrorInfo: { type1: type1.footType, type2: type2.footType }
        });
        results.push({
            method: 'direct',
            similarity: directComparison.similarity,
            decision: directComparison.decision,
            mirrored: false
        });
       
        // Вариант 2: Сравнение с зеркальной версией graph2
        const mirroredGraph2 = this.mirrorGraph(graph2, 'vertical');
        const mirroredComparison = matcher.compareGraphs(graph1, mirroredGraph2, {
            ...options,
            mirrorInfo: { type1: type1.footType, type2: type2.footType + '_mirrored' }
        });
        results.push({
            method: 'mirrored',
            similarity: mirroredComparison.similarity,
            decision: mirroredComparison.decision,
            mirrored: true
        });
       
        // Выбираем лучший результат
        let bestResult = results[0];
        if (mirroredComparison.similarity > directComparison.similarity) {
            bestResult = results[1];
        }
       
        // Определяем, нужно ли зеркалить для совпадения типов
        const shouldMirrorForMatch = bestResult.mirrored;
        const footTypesMatch = type1.footType === type2.footType ||
                             (type1.footType === 'unknown' || type2.footType === 'unknown');
       
        const finalResult = {
            similarity: bestResult.similarity,
            decision: bestResult.decision,
            shouldMirror: shouldMirrorForMatch,
            footTypes: {
                graph1: type1,
                graph2: type2,
                match: footTypesMatch,
                sameType: type1.footType === type2.footType
            },
            comparisons: results,
            processingTime: Date.now() - startTime,
            method: 'mirror_invariant_comparison'
        };
       
        console.log(`✅ Сравнение с зеркальностью: ${finalResult.similarity.toFixed(3)}`);
        console.log(`   Нужно зеркалить: ${finalResult.shouldMirror ? 'да' : 'нет'}`);
       
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
   
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
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
   
    rebuildEdges(graph) {
        const nodes = Array.from(graph.nodes.values());
       
        graph.edges.clear();
       
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
           
            distances.sort((a, b) => a.distance - b.distance);
            const nearest = distances.slice(0, 3);
           
            nearest.forEach(neighbor => {
                const nodeId1 = Array.from(graph.nodes.keys())[i];
                const nodeId2 = Array.from(graph.nodes.keys())[neighbor.index];
                graph.addEdge(nodeId1, nodeId2);
            });
        });
    }

    // 8. МЕТОД: Визуализация анализа зеркальности
    visualizeMirrorAnalysis(graph, options = {}) {
        const analysis = this.detectFootType(graph);
        const points = this.extractPointsFromGraph(graph);
        const center = this.calculateCenter(points);
        const bounds = this.calculateBounds(points);
       
        return {
            analysis: analysis,
            points: {
                total: points.length,
                byQuadrant: this.analyzeQuadrants(points).quadrants,
                center: center,
                bounds: bounds
            },
            symmetry: this.calculateSymmetry(points),
            recommendations: this.generateMirrorRecommendations(analysis),
            visualizationData: this.generateVisualizationData(graph, analysis)
        };
    }
   
    generateMirrorRecommendations(analysis) {
        const recommendations = [];
       
        if (analysis.confidence > this.config.footTypeConfidenceThreshold) {
            recommendations.push({
                type: 'foot_type',
                message: `Определен тип следа: ${analysis.footType} (уверенность: ${(analysis.confidence * 100).toFixed(1)}%)`,
                action: 'auto_correct_if_needed'
            });
        } else {
            recommendations.push({
                type: 'uncertain',
                message: 'Тип следа не определен с достаточной уверенностью',
                action: 'collect_more_data'
            });
        }
       
        if (analysis.symmetry.score > this.config.symmetryThreshold) {
            recommendations.push({
                type: 'symmetry',
                message: 'След демонстрирует высокую симметрию',
                action: 'mirror_invariant_comparison'
            });
        }
       
        return recommendations;
    }
   
    generateVisualizationData(graph, analysis) {
        const points = this.extractPointsFromGraph(graph);
        const center = this.calculateCenter(points);
       
        return {
            points: points.map(p => ({
                x: p.x,
                y: p.y,
                quadrant: this.getPointQuadrant(p, center)
            })),
            center: center,
            axes: {
                vertical: { x: center.x, y1: 0, y2: 1000 },
                horizontal: { y: center.y, x1: 0, x2: 1000 }
            },
            footType: analysis.footType,
            confidence: analysis.confidence
        };
    }
   
    getPointQuadrant(point, center) {
        if (point.x < center.x) {
            return point.y < center.y ? 'topLeft' : 'bottomLeft';
        } else {
            return point.y < center.y ? 'topRight' : 'bottomRight';
        }
    }
}

module.exports = MirrorDetection;
