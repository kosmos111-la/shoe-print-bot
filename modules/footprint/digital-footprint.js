// modules/footprint/digital-footprint.js
// ОБНОВЛЕННАЯ ВЕРСИЯ С ТОПОЛОГИЧЕСКИМИ ИНВАРИАНТАМИ, ПОВОРОТОМ И ИНТЕГРАЦИЕЙ CLOUD ALIGNER

const crypto = require('crypto');
const fs = require('fs');
const TopologyUtils = require('./topology-utils'); // 🔥 НОВЫЙ ИМПОРТ
const PointCloudAligner = require('./point-cloud-aligner'); // 🔥 ДОБАВЛЯЕМ ИМПОРТ

class DigitalFootprint {
    constructor(options = {}) {
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.name = options.name || `Модель_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;
        this.sessionId = options.sessionId || null;

        // Основные данные модели
        this.nodes = new Map();
        this.edges = [];

        // Геометрические данные для визуализации
        this.bestContours = [];
        this.bestHeels = [];
        this.bestPhotoInfo = null;

        // 🔥 ДОБАВЛЯЕМ ТОПОЛОГИЧЕСКИЕ ИНВАРИАНТЫ
        this.topologyInvariants = {
            // Графовые инварианты
            degreeDistribution: null,
            adjacencyMatrix: null,
            graphDiameter: null,
            clusteringCoefficient: null,
            averagePathLength: null,

            // Геометрические инварианты (нормированные)
            normalizedNodes: new Map(), // {id: {x, y, confidence}} после нормализации
            boundingBox: null,
            principalAxes: null, // Главные оси (PCA)
            shapeDescriptors: null,

            // Статистические инварианты
            distanceHistogram: null,
            angleHistogram: null,
            densityMap: null,

            // Сигнатуры
            graphSpectrum: null,
            persistenceDiagram: null,

            // Метаданные нормализации
            normalizationParams: {
                center: { x: 0, y: 0 },
                scale: 1.0,
                rotation: 0,
                meanDistance: 0
            }
        };

        // Информация о зеркальности
        this.mirrorInfo = {
            isMirrored: false,
            originalId: null,
            mirrorScore: 0,
            checked: false
        };

        // Метаданные
        this.metadata = options.metadata || {
            estimatedSize: null,
            footprintType: 'unknown',
            orientation: 0,
            brand: null,
            model: null,
            isMirrored: false,
            distortionInfo: null
        };

        // Статистика
        this.stats = {
            totalSources: 0,
            confirmationCount: 0,
            lastUpdated: new Date(),
            created: new Date(),
            confidence: 0.3,
            totalPhotos: 0,
            avgPhotoQuality: 0,
            lastPhotoAdded: null,
            // 🔥 Добавляем топологическую статистику
            topologyQuality: 0,
            nodeUniformity: 0,
            graphConnectivity: 0
        };

        // Производительность
        this.hash = null;
        this.boundingBox = null;
        this.featureVector = null;
        this.version = '2.5'; // 🔥 Обновили версию для интеграции с PointCloudAligner
    }

    // 🔥 НОВЫЙ МЕТОД: Автоматическое совмещение нового анализа с существующей моделью
    addAnalysisWithAlignment(analysis, sourceInfo = {}) {
        console.log('🎯 Запуск добавления анализа с автоматическим совмещением');

        const { predictions, timestamp, imagePath, photoQuality = 0.5 } = analysis;
        const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];

        if (protectors.length < 3) {
            console.log('⚠️ Слишком мало протекторов для совмещения');
            return this.addAnalysis(analysis, sourceInfo);
        }

        // Если модель пустая или мало точек - просто добавляем
        if (this.nodes.size < 3) {
            console.log('📌 Модель пустая или мало точек, добавляем без совмещения');
            return this.addAnalysis(analysis, sourceInfo);
        }

        try {
            // 🔥 ИСПРАВЛЕНИЕ: Используем центры протекторов
            const modelPoints = Array.from(this.nodes.values()).map(node => ({
                x: node.center.x,
                y: node.center.y,
                confidence: node.confidence,
                id: node.id
            }));

            const newPoints = protectors.map((p, index) => {
                const center = this.calculateCenter(p.points);
                return {
                    x: center.x,
                    y: center.y,
                    confidence: p.confidence || 0.5,
                    id: `new_${index}`
                };
            });

            console.log(`🔍 Поиск совмещения: ${modelPoints.length} точек модели vs ${newPoints.length} новых точек`);

            // Создаем aligner
            const aligner = new PointCloudAligner({
                maxIterations: 200,
                inlierThreshold: 25,
                minInliersRatio: 0.55, // Чуть ниже для лучших результатов
                minInliersAbsolute: 3,
                mirrorCheck: true
            });

            // Ищем лучшее совмещение
            const alignmentResult = aligner.findBestAlignment(modelPoints, newPoints);

            console.log(`📊 Результат совмещения: ${(alignmentResult.score * 100).toFixed(1)}%`);

            if (alignmentResult.score > 0.6) {
                // 🔥 ХОРОШЕЕ СОВМЕЩЕНИЕ - трансформируем и добавляем
                console.log(`✅ Хорошее совмещение найдено!`);
                console.log(`   • Угол: ${alignmentResult.transform ? (alignmentResult.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
                console.log(`   • Масштаб: ${alignmentResult.transform?.scale?.toFixed(3)}`);
                console.log(`   • Зеркало: ${alignmentResult.mirrored ? 'да' : 'нет'}`);

                // Сохраняем информацию о трансформации
                sourceInfo.alignmentInfo = {
                    transform: alignmentResult.transform,
                    score: alignmentResult.score,
                    mirrored: alignmentResult.mirrored,
                    inliersCount: alignmentResult.inliers?.length || 0
                };

                // Добавляем анализ с информацией о трансформации
                return this.addAnalysis(analysis, sourceInfo);

            } else if (alignmentResult.score > 0.3) {
                // 🔥 СЛАБОЕ СОВМЕЩЕНИЕ - добавляем но помечаем
                console.log(`⚠️ Слабое совмещение (${(alignmentResult.score * 100).toFixed(1)}%)`);

                sourceInfo.alignmentInfo = {
                    transform: alignmentResult.transform,
                    score: alignmentResult.score,
                    mirrored: alignmentResult.mirrored,
                    inliersCount: alignmentResult.inliers?.length || 0,
                    isWeak: true
                };

                return this.addAnalysis(analysis, sourceInfo);

            } else {
                // 🔥 ПЛОХОЕ СОВМЕЩЕНИЕ - возможно другой след
                console.log(`❌ Плохое совмещение (${(alignmentResult.score * 100).toFixed(1)}%), добавляем как новый кластер`);

                sourceInfo.alignmentInfo = {
                    score: alignmentResult.score,
                    isNewCluster: true
                };

                return this.addAnalysis(analysis, sourceInfo);
            }

        } catch (error) {
            console.log('❌ Ошибка совмещения:', error.message);
            console.log('🔄 Возвращаюсь к стандартному добавлению');
            return this.addAnalysis(analysis, sourceInfo);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки модели для совмещения
    getNormalizedNodePoints() {
        const points = [];

        this.nodes.forEach((node, id) => {
            points.push({
                x: node.center.x,
                y: node.center.y,
                confidence: node.confidence,
                id: id
            });
        });

        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Трансформировать точки с результатом
    transformPointsWithResult(points, transformResult) {
        if (!transformResult || !points) return points;

        const aligner = new PointCloudAligner();
        return points.map(point => {
            const transformed = aligner.transformPoint(
                { x: point.x, y: point.y },
                transformResult.transform,
                transformResult.mirrored
            );

            return {
                ...point,
                x: transformed.x,
                y: transformed.y,
                transformed: true
            };
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Применить трансформацию к модели
    applyTransformation(transform, mirrored = false) {
        console.log(`🔄 Применение трансформации к модели: ${this.nodes.size} узлов`);

        if (!transform) {
            console.log('⚠️ Нет трансформации для применения');
            return;
        }

        const aligner = new PointCloudAligner();
        const transformedNodes = new Map();

        this.nodes.forEach((node, id) => {
            // Трансформируем центр узла
            const transformedCenter = aligner.transformPoint(
                node.center,
                transform,
                mirrored
            );

            // Создаем копию узла с новым центром
            const transformedNode = {
                ...node,
                center: transformedCenter,
                metadata: {
                    ...node.metadata,
                    transformed: true,
                    originalCenter: node.center,
                    transformApplied: {
                        rotation: transform.rotation,
                        scale: transform.scale,
                        translation: transform.translation,
                        mirrored: mirrored
                    }
                }
            };

            transformedNodes.set(id, transformedNode);
        });

        // Обновляем узлы модели
        this.nodes = transformedNodes;

        // Пересчитываем ребра
        this.rebuildEdges();

        // Обновляем топологические инварианты
        this.updateTopologyInvariants();

        // Помечаем в метаданных
        this.metadata.transformationApplied = true;
        this.metadata.lastAlignment = {
            timestamp: new Date(),
            transform: transform,
            mirrored: mirrored
        };

        console.log(`✅ Трансформация применена к ${this.nodes.size} узлам`);
    }

    // 🔥 НОВЫЙ МЕТОД: Совместить с другой моделью (для слияния моделей)
    alignWithOtherFootprint(otherFootprint, options = {}) {
        console.log(`🔍 Запуск совмещения моделей: "${this.name}" vs "${otherFootprint.name}"`);

        const points1 = this.getNormalizedNodePoints();
        const points2 = otherFootprint.getNormalizedNodePoints();

        if (points1.length < 3 || points2.length < 3) {
            console.log('⚠️ Недостаточно точек для совмещения моделей');
            return {
                success: false,
                score: 0,
                error: 'Недостаточно точек'
            };
        }

        const aligner = new PointCloudAligner({
            maxIterations: 300,
            inlierThreshold: 20,
            minInliersRatio: 0.6,
            minInliersAbsolute: 4,
            mirrorCheck: true,
            ...options
        });

        try {
            const alignmentResult = aligner.findBestAlignment(points1, points2);

            const result = {
                success: alignmentResult.score > 0.5,
                score: alignmentResult.score,
                transform: alignmentResult.transform,
                mirrored: alignmentResult.mirrored,
                inliersCount: alignmentResult.inliers?.length || 0,
                inliers: alignmentResult.inliers,
                diagnostic: {
                    points1Count: points1.length,
                    points2Count: points2.length,
                    iterations: alignmentResult.iterations || 0
                }
            };

            if (result.success) {
                console.log(`✅ Модели успешно совмещены! Счет: ${(result.score * 100).toFixed(1)}%`);
                console.log(`   • Угол: ${result.transform ? (result.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
                console.log(`   • Масштаб: ${result.transform?.scale?.toFixed(3)}`);
                console.log(`   • Зеркало: ${result.mirrored ? 'да' : 'нет'}`);
                console.log(`   • Inliers: ${result.inliersCount}/${points1.length}`);
            } else {
                console.log(`❌ Модели не совмещены. Счет: ${(result.score * 100).toFixed(1)}%`);
            }

            return result;

        } catch (error) {
            console.log('❌ Ошибка при совмещении моделей:', error.message);
            return {
                success: false,
                score: 0,
                error: error.message
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Объединить с другой моделью после совмещения
    mergeWithAlignedFootprint(otherFootprint, alignmentResult) {
        if (!alignmentResult.success) {
            console.log('❌ Нельзя объединить: совмещение неудачное');
            return false;
        }

        console.log(`🔄 Объединение моделей после совмещения`);

        // Применяем трансформацию ко второй модели
        const transformedOther = otherFootprint.clone();
        transformedOther.applyTransformation(alignmentResult.transform, alignmentResult.mirrored);

        // Объединяем узлы
        let mergedCount = 0;
        let addedCount = 0;

        transformedOther.nodes.forEach((otherNode, otherId) => {
            // Ищем похожий узел в текущей модели
            const similarNode = this.findSimilarNode(otherNode, 30); // Меньший допуск после совмещения

            if (similarNode) {
                // Объединяем узлы
                this.mergeNodes(similarNode.id, otherNode);
                mergedCount++;
            } else {
                // Добавляем как новый узел
                const newId = `merged_${crypto.randomBytes(3).toString('hex')}`;
                otherNode.id = newId;
                otherNode.metadata = {
                    ...otherNode.metadata,
                    sourceModel: otherFootprint.id,
                    merged: true,
                    mergeTimestamp: new Date()
                };
                this.nodes.set(newId, otherNode);
                addedCount++;
            }
        });

        // Объединяем контуры и каблуки
        if (transformedOther.allContours) {
            this.allContours = [...(this.allContours || []), ...transformedOther.allContours];
        }

        if (transformedOther.allHeels) {
            this.allHeels = [...(this.allHeels || []), ...transformedOther.allHeels];
        }

        // Обновляем модель
        this.rebuildEdges();
        this.updateTopologyInvariants();

        // Сохраняем информацию о слиянии
        this.metadata.merges = this.metadata.merges || [];
        this.metadata.merges.push({
            mergedModelId: otherFootprint.id,
            mergedModelName: otherFootprint.name,
            timestamp: new Date(),
            alignmentScore: alignmentResult.score,
            mergedNodes: mergedCount,
            addedNodes: addedCount,
            totalNodesAfter: this.nodes.size
        });

        console.log(`✅ Модели объединены!`);
        console.log(`   • Объединено узлов: ${mergedCount}`);
        console.log(`   • Добавлено узлов: ${addedCount}`);
        console.log(`   • Итого узлов: ${this.nodes.size}`);

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Создать копию модели
    clone() {
        const clone = new DigitalFootprint({
            id: `${this.id}_clone_${Date.now()}`,
            name: `${this.name} (копия)`,
            userId: this.userId,
            sessionId: this.sessionId,
            metadata: { ...this.metadata }
        });

        // Копируем узлы
        this.nodes.forEach((node, id) => {
            clone.nodes.set(id, {
                ...node,
                sources: node.sources ? [...node.sources] : []
            });
        });

        // Копируем ребра
        clone.edges = [...this.edges];

        // Копируем контуры и каблуки
        clone.bestContours = this.bestContours ? [...this.bestContours] : [];
        clone.bestHeels = this.bestHeels ? [...this.bestHeels] : [];
        clone.allContours = this.allContours ? [...this.allContours] : [];
        clone.allHeels = this.allHeels ? [...this.allHeels] : [];

        // Копируем статистику
        clone.stats = { ...this.stats };

        // Копируем топологические инварианты
        if (this.topologyInvariants.normalizedNodes) {
            clone.topologyInvariants.normalizedNodes = new Map(
                Array.from(this.topologyInvariants.normalizedNodes.entries())
            );
        }

        return clone;
    }

    // 🔥 НОВЫЙ МЕТОД: Экспорт точек для отладки совмещения
    exportPointsForDebug() {
        const nodes = Array.from(this.nodes.values());
        return {
            modelId: this.id,
            modelName: this.name,
            points: nodes.map(node => ({
                x: node.center.x,
                y: node.center.y,
                confidence: node.confidence,
                id: node.id
            })),
            boundingBox: this.boundingBox,
            stats: {
                totalPoints: nodes.length,
                avgConfidence: nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length,
                date: new Date().toISOString()
            }
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Визуализировать результат совмещения
    visualizeAlignment(alignmentResult, otherPoints = []) {
        if (!alignmentResult || !alignmentResult.transform) {
            return null;
        }

        const aligner = new PointCloudAligner();
        const transformedPoints = otherPoints.map(point => {
            const transformed = aligner.transformPoint(
                { x: point.x, y: point.y },
                alignmentResult.transform,
                alignmentResult.mirrored
            );
            return {
                original: point,
                transformed: transformed,
                id: point.id
            };
        });

        const modelPoints = this.getNormalizedNodePoints();

        return {
            modelPoints: modelPoints,
            originalOtherPoints: otherPoints,
            transformedOtherPoints: transformedPoints,
            alignment: {
                score: alignmentResult.score,
                rotation: alignmentResult.transform.rotation,
                scale: alignmentResult.transform.scale,
                translation: alignmentResult.transform.translation,
                mirrored: alignmentResult.mirrored,
                inliers: alignmentResult.inliers || []
            },
            visualization: {
                boundingBox1: this.calculateOverallBoundingBox(modelPoints),
                boundingBox2: this.calculateOverallBoundingBox(transformedPoints),
                overlapScore: this.calculateOverlapScore(modelPoints, transformedPoints)
            }
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Расчет общего bounding box
    calculateOverallBoundingBox(points) {
        if (!points || points.length === 0) return null;

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
            center: {
                x: (Math.min(...xs) + Math.max(...xs)) / 2,
                y: (Math.min(...ys) + Math.max(...ys)) / 2
            }
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Расчет перекрытия
    calculateOverlapScore(points1, points2) {
        if (!points1 || !points2 || points1.length === 0 || points2.length === 0) {
            return 0;
        }

        let matched = 0;
        const threshold = 20; // пикселей

        points1.forEach(p1 => {
            const closest = points2.reduce((min, p2) => {
                const dist = this.calculateDistance(p1, p2);
                return dist < min.dist ? { dist, point: p2 } : min;
            }, { dist: Infinity, point: null });

            if (closest.dist < threshold) {
                matched++;
            }
        });

        return matched / Math.max(points1.length, points2.length);
    }

    // 🔥 НОВЫЙ МЕТОД: Поиск оптимального поворота для сравнения
    findOptimalRotationForComparison(otherFootprint) {
        const nodes1 = Array.from(this.topologyInvariants.normalizedNodes.values());
        const nodes2 = Array.from(otherFootprint.topologyInvariants.normalizedNodes.values());

        if (nodes1.length < 3 || nodes2.length < 3) {
            return { angle: 0, score: 0 };
        }

        // Тестируем 8 углов (0°, 45°, 90°, 135°, 180°, -45°, -90°, -135°)
        const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -Math.PI/4, -Math.PI/2];
        let bestAngle = 0;
        let bestScore = -Infinity;

        angles.forEach(angle => {
            // Поворачиваем вторую модель
            const rotatedNodes2 = nodes2.map(node => ({
                x: node.x * Math.cos(angle) - node.y * Math.sin(angle),
                y: node.x * Math.sin(angle) + node.y * Math.cos(angle),
                confidence: node.confidence
            }));

            // Простое сравнение расстояний
            const score = this.calculateNodeSimilarity(nodes1, rotatedNodes2);

            if (score > bestScore) {
                bestScore = score;
                bestAngle = angle;
            }
        });

        console.log(`🔄 Найден оптимальный поворот: ${(bestAngle * 180 / Math.PI).toFixed(1)}° (сходство: ${(bestScore * 100).toFixed(1)}%)`);
        return { angle: bestAngle, score: bestScore };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Расчет сходства узлов
    calculateNodeSimilarity(nodes1, nodes2) {
        if (nodes1.length === 0 || nodes2.length === 0) return 0;

        // Сопоставляем узлы по ближайшему расстоянию
        let totalDistance = 0;
        let matched = 0;

        // Простой алгоритм: берем первые N узлов (где N = min(длин))
        const n = Math.min(nodes1.length, nodes2.length);

        for (let i = 0; i < n; i++) {
            const dx = nodes1[i].x - nodes2[i].x;
            const dy = nodes1[i].y - nodes2[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Если расстояние разумное (меньше 0.5 в нормализованных координатах)
            if (distance < 0.5) {
                totalDistance += distance;
                matched++;
            }
        }

        if (matched === 0) return 0;

        const avgDistance = totalDistance / matched;
        // Преобразуем расстояние в сходство (0-1)
        return Math.max(0, 1 - avgDistance / 0.5);
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД compareEnhanced с поворотом
    compareEnhanced(otherFootprint) {
        console.log(`🔍 Запускаю УЛУЧШЕННОЕ сравнение с поворотом: "${this.name}" vs "${otherFootprint.name}"`);

        if (!otherFootprint || !otherFootprint.nodes || otherFootprint.nodes.size === 0) {
            return {
                score: 0,
                matched: 0,
                total: 0,
                details: {
                    topology: 0,
                    graph: 0,
                    geometry: 0
                },
                isMirrored: false,
                confidence: 0
            };
        }

        // 🔄 ОБНОВЛЯЕМ ИНВАРИАНТЫ если нужно
        if (!this.topologyInvariants.normalizedNodes || this.topologyInvariants.normalizedNodes.size === 0) {
            this.updateTopologyInvariants();
        }

        if (!otherFootprint.topologyInvariants.normalizedNodes ||
            otherFootprint.topologyInvariants.normalizedNodes.size === 0) {
            otherFootprint.updateTopologyInvariants();
        }

        // 🔥 1. НАХОДИМ ОПТИМАЛЬНЫЙ ПОВОРОТ
        const rotationCheck = this.findOptimalRotationForComparison(otherFootprint);
        console.log(`🎯 Оптимальный поворот для сравнения: ${(rotationCheck.angle * 180 / Math.PI).toFixed(1)}°`);

        // 🔥 2. ВРЕМЕННО ПОВОРАЧИВАЕМ УЗЛЫ ВТОРОЙ МОДЕЛИ
        const originalNodes = Array.from(otherFootprint.topologyInvariants.normalizedNodes.values());
        const rotatedNodes = originalNodes.map((node, index) => {
            // Используем оригинальные данные узла
            const originalNode = node.originalNode ? node.originalNode : node;
            return {
                x: node.x * Math.cos(rotationCheck.angle) - node.y * Math.sin(rotationCheck.angle),
                y: node.x * Math.sin(rotationCheck.angle) + node.y * Math.cos(rotationCheck.angle),
                confidence: node.confidence,
                id: `rotated_${index}`,
                originalNode: originalNode
            };
        });

        // Сохраняем оригинальные данные
        const originalNormalized = otherFootprint.topologyInvariants.normalizedNodes;
        const originalNormalizedArray = Array.from(originalNormalized.entries());

        // Заменяем на повернутые узлы
        otherFootprint.topologyInvariants.normalizedNodes = new Map(
            rotatedNodes.map((node, i) => [node.id, node])
        );

        // 🔥 3. ВЫЧИСЛЯЕМ РАЗНЫЕ ТИПЫ СХОДСТВА С ПОВЕРНУТОЙ ВЕРСИЕЙ
        let topologyScore, graphScore, geometryScore;

        try {
            topologyScore = this.compareTopology(otherFootprint);
            graphScore = this.compareGraphInvariants(otherFootprint);
            geometryScore = this.compareNormalizedGeometry(otherFootprint);
        } catch (error) {
            console.log(`❌ Ошибка сравнения:`, error.message);
            topologyScore = 0;
            graphScore = 0;
            geometryScore = 0;
        }

        // 🔥 4. ВОССТАНАВЛИВАЕМ ОРИГИНАЛЬНЫЕ УЗЛЫ
        otherFootprint.topologyInvariants.normalizedNodes = new Map(originalNormalizedArray);

        // 🔥 5. ПРОВЕРКА ЗЕРКАЛЬНОСТИ (с учетом поворота)
        const mirrorCheck = this.checkMirrorSymmetry(otherFootprint);

        // 🔥 6. ВЕСОВЫЕ КОЭФФИЦИЕНТЫ (учитываем качество поворота)
        const WEIGHTS = {
            TOPOLOGY: 0.35,
            GRAPH: 0.35,
            GEOMETRY: 0.20,
            ROTATION_BONUS: rotationCheck.score > 0.7 ? 0.10 : 0.05,
            MIRROR_BONUS: 0.10
        };

        // 🔥 7. ИТОГОВАЯ ОЦЕНКА (учитываем качество поворота)
        let finalScore =
            topologyScore * WEIGHTS.TOPOLOGY +
            graphScore * WEIGHTS.GRAPH +
            geometryScore * WEIGHTS.GEOMETRY +
            rotationCheck.score * WEIGHTS.ROTATION_BONUS;

        // 🔥 8. КОРРЕКТИРУЕМ НА ЗЕРКАЛЬНОСТЬ
        if (mirrorCheck.isMirrored && mirrorCheck.score > 0.6) {
            finalScore = Math.min(1.0, finalScore + WEIGHTS.MIRROR_BONUS);
        }

        // 🔥 9. ПОДСЧЕТ СОПОСТАВЛЕННЫХ УЗЛОВ (с учетом поворота)
        const matchedNodes = this.countMatchedNodes(otherFootprint);

        // 🔥 10. ФОРМИРУЕМ РЕЗУЛЬТАТ
        const result = {
            score: Math.min(1.0, Math.max(0, finalScore)),
            matched: matchedNodes.count,
            total: Math.min(this.nodes.size, otherFootprint.nodes.size),
            details: {
                topology: topologyScore,
                graph: graphScore,
                geometry: geometryScore,
                rotation: rotationCheck.score,
                rotationAngle: rotationCheck.angle * 180 / Math.PI
            },
            isMirrored: mirrorCheck.isMirrored,
            mirrorDetails: mirrorCheck,
            rotationApplied: true,
            rotationAngleDegrees: rotationCheck.angle * 180 / Math.PI,
            confidence: this.calculateComparisonConfidence(otherFootprint),
            diagnostic: {
                nodes1: this.nodes.size,
                nodes2: otherFootprint.nodes.size,
                rotationUsed: true,
                rotationAngle: rotationCheck.angle * 180 / Math.PI,
                rotationQuality: rotationCheck.score
            }
        };

        // 🔥 11. ЛОГИРУЕМ РЕЗУЛЬТАТЫ С ПОВОРОТОМ
        console.log(`\n📊 ===== РЕЗУЛЬТАТЫ СРАВНЕНИЯ С ПОВОРОТОМ =====`);
        console.log(`🎯 Итоговая оценка: ${(result.score * 100).toFixed(1)}%`);
        console.log(`📈 Детализация:`);
        console.log(`   • Топология: ${(topologyScore * 100).toFixed(1)}%`);
        console.log(`   • Граф: ${(graphScore * 100).toFixed(1)}%`);
        console.log(`   • Геометрия: ${(geometryScore * 100).toFixed(1)}%`);
        console.log(`   • Поворот: ${(rotationCheck.score * 100).toFixed(1)}% (${(rotationCheck.angle * 180 / Math.PI).toFixed(1)}°)`);
        console.log(`   • Узлов сопоставлено: ${matchedNodes.count}/${result.total}`);

        if (mirrorCheck.isMirrored) {
            console.log(`   • 🪞 ЗЕРКАЛЬНАЯ ПАРА обнаружена!`);
        }

        if (rotationCheck.angle !== 0) {
            console.log(`   • 🔄 Применен поворот: ${(rotationCheck.angle * 180 / Math.PI).toFixed(1)}°`);
        }

        console.log(`============================================\n`);

        return result;
    }

    // 🔥 НОВЫЙ МЕТОД: Обновление топологических инвариантов
    updateTopologyInvariants() {
        console.log(`🔄 Обновляю топологические инварианты для модели "${this.name}"`);

        try {
            const nodesArray = Array.from(this.nodes.values());

            if (nodesArray.length < 2) {
                console.log('⚠️ Слишком мало узлов для топологического анализа');
                return;
            }

            // 1. НОРМАЛИЗАЦИЯ УЗЛОВ (центр + масштаб + ориентация)
            this.normalizeNodes();

            // 2. ВЫЧИСЛЕНИЕ ГРАФОВЫХ ИНВАРИАНТОВ
            this.calculateGraphInvariants();

            // 3. ВЫЧИСЛЕНИЕ ГЕОМЕТРИЧЕСКИХ ИНВАРИАНТОВ
            this.calculateGeometricInvariants();

            // 4. ВЫЧИСЛЕНИЕ СТАТИСТИЧЕСКИХ ИНВАРИАНТОВ
            this.calculateStatisticalInvariants();

            // 5. ОЦЕНКА КАЧЕСТВА ТОПОЛОГИИ
            this.assessTopologyQuality();

            console.log(`✅ Топологические инварианты обновлены (${this.topologyInvariants.normalizedNodes.size} узлов)`);

        } catch (error) {
            console.log('❌ Ошибка обновления топологических инвариантов:', error.message);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Нормализация узлов
    normalizeNodes() {
        const nodesArray = Array.from(this.nodes.values());

        if (nodesArray.length < 3) {
            console.log('⚠️ Недостаточно узлов для нормализации (нужно минимум 3)');
            return;
        }

        // Используем TopologyUtils
        const normalizedData = TopologyUtils.normalizeNodes(nodesArray);

        this.topologyInvariants.normalizedNodes.clear();
        this.topologyInvariants.normalizationParams = normalizedData.normalizationParams;

        // Сохраняем нормализованные узлы
        normalizedData.normalized.forEach((normalizedNode, index) => {
            const originalNode = nodesArray[index];
            if (originalNode && normalizedNode) {
                this.topologyInvariants.normalizedNodes.set(originalNode.id, {
                    x: normalizedNode.x,
                    y: normalizedNode.y,
                    confidence: normalizedNode.confidence,
                    originalId: originalNode.id
                });
            }
        });

        console.log(`📐 Нормализация: центр=(${normalizedData.normalizationParams.center.x.toFixed(1)}, ` +
                   `${normalizedData.normalizationParams.center.y.toFixed(1)}), ` +
                   `масштаб=${normalizedData.normalizationParams.scale.toFixed(4)}, ` +
                   `поворот=${(normalizedData.normalizationParams.rotation * 180 / Math.PI).toFixed(1)}°`);
    }

    // 🔥 НОВЫЙ МЕТОД: Вычисление графовых инвариантов
    calculateGraphInvariants() {
        const nodesArray = Array.from(this.nodes.values());

        if (nodesArray.length === 0 || this.edges.length === 0) {
            console.log('⚠️ Нет ребер для графового анализа');
            return;
        }

        // Используем TopologyUtils
        const graphData = TopologyUtils.calculateGraphInvariantsForFootprint(nodesArray, this.edges);

        this.topologyInvariants.adjacencyMatrix = graphData.adjacencyMatrix;
        this.topologyInvariants.degreeDistribution = graphData.degreeDistribution;
        this.topologyInvariants.graphDiameter = graphData.graphDiameter;
        this.topologyInvariants.clusteringCoefficient = graphData.clusteringCoefficient;
        this.topologyInvariants.averagePathLength = graphData.averagePathLength;

        console.log(`📊 Графовые инварианты: диаметр=${graphData.graphDiameter}, ` +
                   `кластеризация=${graphData.clusteringCoefficient.toFixed(3)}, ` +
                   `ср.путь=${graphData.averagePathLength.toFixed(2)}`);
    }

    // 🔥 НОВЫЙ МЕТОД: Вычисление геометрических инвариантов
    calculateGeometricInvariants() {
        const normalizedNodes = Array.from(this.topologyInvariants.normalizedNodes.values());

        if (normalizedNodes.length < 2) {
            return;
        }

        // Используем TopologyUtils
        const geometricData = TopologyUtils.calculateGeometricInvariantsForFootprint(
            normalizedNodes,
            this.topologyInvariants
        );

        this.topologyInvariants.boundingBox = geometricData.boundingBox;
        this.topologyInvariants.shapeDescriptors = geometricData.shapeDescriptors;

        console.log(`📏 Геометрия: ${geometricData.boundingBox?.width?.toFixed(3) || 0}x${geometricData.boundingBox?.height?.toFixed(3) || 0}`);
    }

    // 🔥 НОВЫЙ МЕТОД: Вычисление статистических инвариантов
    calculateStatisticalInvariants() {
        const normalizedNodes = Array.from(this.topologyInvariants.normalizedNodes.values());

        if (normalizedNodes.length < 3) {
            return;
        }

        // 1. Гистограмма расстояний
        const distances = [];
        for (let i = 0; i < normalizedNodes.length; i++) {
            for (let j = i + 1; j < normalizedNodes.length; j++) {
                const dist = TopologyUtils.calculateDistance(normalizedNodes[i], normalizedNodes[j]);
                distances.push(dist);
            }
        }

        // 🔥 ИСПРАВЛЕНИЕ: проверяем что есть расстояния
        if (distances.length > 0) {
            this.topologyInvariants.distanceHistogram =
                TopologyUtils.createHistogram(distances, 8);
        }

        // 2. Гистограмма углов
        const center = this.topologyInvariants.boundingBox?.center;
        if (center) {
            const angles = normalizedNodes.map(node => {
                const dx = node.x - center.x;
                const dy = node.y - center.y;
                return Math.atan2(dy, dx);
            });

            if (angles.length > 0) {
                this.topologyInvariants.angleHistogram =
                    TopologyUtils.createHistogram(angles, 12);
            }
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Оценка качества топологии
    assessTopologyQuality() {
        const nodesArray = Array.from(this.nodes.values());

        if (nodesArray.length === 0) {
            this.stats.topologyQuality = 0;
            return;
        }

        // Используем TopologyUtils
        const qualityData = TopologyUtils.assessTopologyQualityForFootprint(
            nodesArray,
            this.edges,
            this.topologyInvariants
        );

        this.stats.topologyQuality = qualityData.topologyQuality;
        this.stats.nodeUniformity = qualityData.nodeUniformity;
        this.stats.graphConnectivity = qualityData.graphConnectivity;

        console.log(`🎯 Качество топологии: ${(this.stats.topologyQuality * 100).toFixed(1)}%`);
    }

    // ОСНОВНОЙ МЕТОД: добавить данные из анализа
    addAnalysis(analysis, sourceInfo = {}) {
        const { predictions, timestamp, imagePath, photoQuality = 0.5 } = analysis;
        const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];
        const contours = predictions?.filter(p => p.class === 'Outline-trail') || [];
        const heels = predictions?.filter(p => p.class === 'Heel') || [];

        console.log(`🔍 Добавляю ${protectors.length} протекторов, ${contours.length} контуров, ${heels.length} каблуков`);

        // СОХРАНЯЕМ ЛОКАЛЬНЫЙ ПУТЬ К ФОТО
        let localPhotoPath = null;
        if (sourceInfo.localPath && fs.existsSync(sourceInfo.localPath)) {
            localPhotoPath = sourceInfo.localPath;
        } else if (imagePath && (imagePath.includes('temp/') || imagePath.includes('temp\\'))) {
            localPhotoPath = imagePath;
        }

        // Улучшенный sourceInfo
        const enhancedSourceInfo = {
            ...sourceInfo,
            localPhotoPath: localPhotoPath,
            imagePath: localPhotoPath || imagePath,
            photoQuality: photoQuality,
            timestamp: timestamp || new Date(),
            geometry: {
                protectors: protectors.map(p => ({
                    points: p.points,
                    confidence: p.confidence || 0.5,
                    class: p.class
                })),
                contours: contours.map(c => ({
                    points: c.points,
                    confidence: c.confidence || 0.5,
                    area: this.calculateArea(c.points),
                    // ✅ СОХРАНЯЕМ оригинальные координаты для ВСЕХ контуров
                    originalPoints: c.points
                })),
                heels: heels.map(h => ({
                    points: h.points,
                    confidence: h.confidence || 0.5,
                    area: this.calculateArea(h.points),
                    // ✅ СОХРАНЯЕМ оригинальные координаты для ВСЕХ каблуков
                    originalPoints: h.points
                }))
            }
        };

        const addedNodes = [];
        const mergedNodes = [];
        const weakNodes = [];

        // ✅ ИСПРАВЛЕНИЕ: объявляем переменную stats
        const stats = {
            skipped: 0
        };

        // Для каждого протектора
        // СЛОВАРЬ: протектор → найденный узел (чтобы не дублировать)
        const matchedProtectors = new Map(); // protectorIndex -> nodeId
        const matchedNodesInThisFrame = new Set(); // nodeId (чтобы узел не усиливался несколько раз из одного кадра)

        protectors.forEach((protector, protectorIndex) => {
            const node = this.createNodeFromProtector(protector, enhancedSourceInfo);

            // Определяем тип узла
            let nodeType = 'normal';
            if (node.confidence < 0.3) {
                nodeType = 'weak';
                weakNodes.push(node);
            } else if (node.confidence > 0.7) {
                nodeType = 'strong';
            }

            // Ищем похожий узел с БОЛЬШИМ допуском
            const similarNode = this.findSimilarNode(node);

            if (similarNode) {
                // Проверяем, не усиливали ли мы уже этот узел из этого кадра
                if (!matchedNodesInThisFrame.has(similarNode.id)) {
                    this.mergeNodes(similarNode.id, node);
                    matchedProtectors.set(protectorIndex, similarNode.id);
                    matchedNodesInThisFrame.add(similarNode.id);
                    mergedNodes.push({
                        existing: similarNode.id.slice(-3),
                        new: node.id.slice(-3),
                        type: nodeType,
                        confidence: node.confidence,
                        distance: this.calculateDistance(similarNode.center, node.center)
                    });

                    console.log(`🔗 Узел ${similarNode.id.slice(-3)} усилен из протектора ${protectorIndex}`);
                } else {
                    // Этот узел уже усилен из этого кадра - ПРОПУСКАЕМ!
                    console.log(`⚠️  Протектор ${protectorIndex} уже учтен в узле ${matchedProtectors.get(protectorIndex)}`);
                    stats.skipped = (stats.skipped || 0) + 1;
                }
            } else {
                // НОВЫЙ узел
                // Если слабый - понижаем рейтинг, но не отбрасываем
                if (nodeType === 'weak') {
                    node.confidence *= 0.7;
                    node.metadata.isWeak = true;
                }

                this.nodes.set(node.id, node);
                addedNodes.push({
                    id: node.id.slice(-3),
                    type: nodeType,
                    confidence: node.confidence
                });
            }
        });

        // ✅ СОХРАНЯЕМ ВСЕ КОНТУРЫ И КАБЛУКИ (не только лучшие!)
        this.saveAllContours(contours, enhancedSourceInfo);
        this.saveAllHeels(heels, enhancedSourceInfo);

        // Обновляем информацию о лучшем фото
        this.updateBestPhotoInfo(enhancedSourceInfo);

        // Статистика
        this.stats.totalSources++;
        this.stats.totalPhotos++;
        this.stats.avgPhotoQuality = (
            this.stats.avgPhotoQuality * (this.stats.totalPhotos - 1) + photoQuality
        ) / this.stats.totalPhotos;
        this.stats.lastUpdated = new Date();
        this.stats.lastPhotoAdded = new Date();

        // ПЕРЕСЧИТЫВАЕМ СВЯЗИ ТОЛЬКО ЕСЛИ ЕСТЬ НОВЫЕ УЗЛЫ
        if (addedNodes.length > 0 || mergedNodes.length > 0) {
            this.rebuildEdges();
            this.updateIndices();

            // 🔥 ОБНОВЛЯЕМ ТОПОЛОГИЧЕСКИЕ ИНВАРИАНТЫ если изменилось много узлов
            if (addedNodes.length > 0 || mergedNodes.length > 2) {
                this.updateTopologyInvariants();
            }
        }

        // ВЫВОД ПОДРОБНОЙ СТАТИСТИКИ
        console.log('\n📊 ========== ДЕТАЛЬНАЯ СТАТИСТИКА ==========');
        console.log(`👟 Протекторов в анализе: ${protectors.length}`);
        console.log(`🔗 Объединено узлов: ${mergedNodes.length} (расстояния: ${mergedNodes.map(m => m.distance.toFixed(0)).join(', ')})`);
        console.log(`✨ Новых узлов: ${addedNodes.length}`);
        console.log(`⚠️  Слабых узлов: ${weakNodes.length}`);
        console.log(`📈 Итого узлов в модели: ${this.nodes.size}`);
        console.log(`🔵 Контуров сохранено: ${contours.length}`);
        console.log(`👠 Каблуков сохранено: ${heels.length}`);

        // Группировка по типам
        if (mergedNodes.length > 0) {
            const strongMerged = mergedNodes.filter(n => n.type === 'strong').length;
            const weakMerged = mergedNodes.filter(n => n.type === 'weak').length;
            console.log(`💪 Сильные объединения: ${strongMerged}`);
            console.log(`🔍 Слабые объединения: ${weakMerged}`);
        }
        console.log('========================================\n');

        return {
            added: addedNodes.length,
            merged: mergedNodes.length,
            weak: weakNodes.length,
            contours: contours.length,
            heels: heels.length,
            totalNodes: this.nodes.size,
            confidence: this.stats.confidence,
            photoQuality: photoQuality
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Топологическое сравнение
    compareTopology(otherFootprint) {
        const nodes1 = Array.from(this.topologyInvariants.normalizedNodes.values());
        const nodes2 = Array.from(otherFootprint.topologyInvariants.normalizedNodes.values());

        if (nodes1.length === 0 || nodes2.length === 0) {
            return 0.3; // 🔥 НЕ 0, а 0.3!
        }

        // 🔥 ПРОСТОЕ СРАВНЕНИЕ ВМЕСТО Hungarian алгоритма
        const n = Math.min(nodes1.length, nodes2.length, 10); // Берем до 10 узлов
        let totalDistance = 0;
        let matched = 0;

        for (let i = 0; i < n; i++) {
            const dx = nodes1[i].x - nodes2[i].x;
            const dy = nodes1[i].y - nodes2[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 0.3) { // 🔥 Разумный порог
                totalDistance += distance;
                matched++;
            }
        }

        if (matched === 0) return 0.2; // 🔥 Хотя бы 20%

        const avgDistance = totalDistance / matched;
        return Math.max(0.2, 1 - avgDistance / 0.3); // 🔥 Минимум 20%
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение графовых инвариантов
    compareGraphInvariants(otherFootprint) {
        return TopologyUtils.compareGraphInvariants(
            this.topologyInvariants,
            otherFootprint.topologyInvariants
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение нормированной геометрии
    compareNormalizedGeometry(otherFootprint) {
        return TopologyUtils.compareNormalizedGeometryForFootprint(
            this.topologyInvariants,
            otherFootprint.topologyInvariants
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Проверка зеркальной симметрии
    checkMirrorSymmetry(otherFootprint) {
        const nodes1 = Array.from(this.topologyInvariants.normalizedNodes.values());
        const nodes2 = Array.from(otherFootprint.topologyInvariants.normalizedNodes.values());

        if (nodes1.length < 3 || nodes2.length < 3) {
            return {
                isMirrored: false,
                score: 0,
                originalDistance: 999,
                mirroredDistance: 999,
                distanceRatio: 1
            };
        }

        return TopologyUtils.checkMirrorSymmetry(nodes1, nodes2);
    }

    // 🔥 НОВЫЙ МЕТОД: Подсчет сопоставленных узлов
    countMatchedNodes(otherFootprint) {
        const nodes1 = Array.from(this.topologyInvariants.normalizedNodes.values());
        const nodes2 = Array.from(otherFootprint.topologyInvariants.normalizedNodes.values());

        if (nodes1.length === 0 || nodes2.length === 0) {
            return { count: 0, avgDistance: 999 };
        }

        return TopologyUtils.countMatchedNodesForFootprint(nodes1, nodes2);
    }

    // 🔥 НОВЫЙ МЕТОД: Расчет уверенности сравнения
    calculateComparisonConfidence(otherFootprint) {
        return TopologyUtils.calculateComparisonConfidenceForFootprint(
            this,
            otherFootprint
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Получить информацию о топологии
    getTopologyInfo() {
        return TopologyUtils.getTopologyInfoForFootprint(this);
    }

    // СОЗДАНИЕ УЗЛА ИЗ ПРОТЕКТОРА
    createNodeFromProtector(protector, sourceInfo) {
        const center = this.calculateCenter(protector.points);
        const size = this.calculateSize(protector.points);
        const shape = this.estimateShape(protector.points);

        return {
            id: `node_${crypto.randomBytes(3).toString('hex')}`,
            center: center,
            size: size,
            shape: shape,
            confidence: protector.confidence || 0.5,
            confirmationCount: 1,
            sources: [{
                ...sourceInfo,
                originalPoints: protector.points,
                timestamp: new Date()
            }],
            firstSeen: new Date(),
            lastSeen: new Date(),
            metadata: {
                isStable: false,
                isWeak: protector.confidence < 0.3,
                // ✅ Дополнительные данные для кластеризации
                clusterId: null,
                neighbors: []
            }
        };
    }

    // ПОИСК ПОХОЖЕГО УЗЛА С БОЛЬШИМ ДОПУСКОМ
    findSimilarNode(newNode, maxDistance = 60) {
        let bestMatch = null;
        let bestScore = 0;

        for (const [id, existingNode] of this.nodes) {
            // ПРОСТОЕ РАССТОЯНИЕ
            const distance = this.calculateDistance(existingNode.center, newNode.center);

            // Если слишком далеко - пропускаем
            if (distance > maxDistance) continue;

            // Похожесть по размеру (50% допуск)
            const sizeRatio = Math.min(existingNode.size, newNode.size) /
                            Math.max(existingNode.size, newNode.size);
            const sizeScore = sizeRatio > 0.5 ? 1.0 : sizeRatio * 2;

            // Похожесть по форме
            const shapeScore = existingNode.shape === newNode.shape ? 1.0 : 0.8;

            // Простая формула
            const distanceScore = 1 - (distance / maxDistance);
            const finalScore = (distanceScore * 0.4) + (sizeScore * 0.3) + (shapeScore * 0.3);

            if (finalScore > bestScore && finalScore > 0.4) {
                bestScore = finalScore;
                bestMatch = existingNode;
            }
        }

        return bestMatch;
    }

    // СЛИЯНИЕ УЗЛОВ
    mergeNodes(existingId, newNode) {
        const existing = this.nodes.get(existingId);
        if (!existing) return;

        const distance = this.calculateDistance(existing.center, newNode.center);

        // 1. Усредняем координаты (взвешенное среднее)
        const weightExisting = existing.confirmationCount || 1;
        const weightNew = 1;
        const totalWeight = weightExisting + weightNew;

        existing.center.x = (existing.center.x * weightExisting + newNode.center.x * weightNew) / totalWeight;
        existing.center.y = (existing.center.y * weightExisting + newNode.center.y * weightNew) / totalWeight;

        // 2. НЕБОЛЬШОЕ УСИЛЕНИЕ (максимум 1.0)
        const confidenceBoost = Math.min(0.1, 1.0 - existing.confidence);
        existing.confidence = Math.min(1.0, existing.confidence + confidenceBoost);

        // 3. Увеличиваем счетчик подтверждений (НО ТОЛЬКО НА 1!)
        existing.confirmationCount = (existing.confirmationCount || 1) + 1;
        existing.lastSeen = new Date();

        // 4. Добавляем источник
        if (!existing.sources) existing.sources = [];
        existing.sources.push(...newNode.sources);

        this.nodes.set(existingId, existing);

        console.log(`   → Узел ${existingId.slice(-3)} подтвержден: ${existing.confidence.toFixed(2)} уверенность, ${existing.confirmationCount} подтверждений (расстояние: ${distance.toFixed(1)}px)`);
    }

    // ✅ НОВЫЙ МЕТОД: Сохраняем ВСЕ контуры (не только лучшие)
    saveAllContours(contours, sourceInfo) {
        if (!contours || contours.length === 0) return;

        // Создаем специальное поле для ВСЕХ контуров
        if (!this.allContours) this.allContours = [];

        contours.forEach(contour => {
            const area = this.calculateArea(contour.points);
            const confidence = contour.confidence || 0.5;

            const contourData = {
                id: `contour_all_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                points: contour.points,
                area: area,
                confidence: confidence,
                source: {
                    ...sourceInfo,
                    timestamp: new Date()
                },
                timestamp: new Date(),
                // ✅ Дополнительные данные для визуализации
                boundingBox: this.calculateBoundingBox(contour.points),
                center: this.calculateCenter(contour.points)
            };

            this.allContours.push(contourData);
        });

        // Также сохраняем в bestContours (для обратной совместимости)
        this.updateBestContours(contours, sourceInfo);
    }

    // ✅ НОВЫЙ МЕТОД: Сохраняем ВСЕ каблуки
    saveAllHeels(heels, sourceInfo) {
        if (!heels || heels.length === 0) return;

        if (!this.allHeels) this.allHeels = [];

        heels.forEach(heel => {
            const area = this.calculateArea(heel.points);
            const confidence = heel.confidence || 0.5;

            const heelData = {
                id: `heel_all_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                points: heel.points,
                area: area,
                confidence: confidence,
                source: {
                    ...sourceInfo,
                    timestamp: new Date()
                },
                timestamp: new Date(),
                boundingBox: this.calculateBoundingBox(heel.points),
                center: this.calculateCenter(heel.points)
            };

            this.allHeels.push(heelData);
        });

        // Также сохраняем в bestHeels
        this.updateBestHeels(heels, sourceInfo);
    }

    // ОБНОВЛЕНИЕ ЛУЧШИХ КОНТУРОВ
    updateBestContours(contours, sourceInfo) {
        if (!contours || contours.length === 0) return;

        contours.forEach(contour => {
            const area = this.calculateArea(contour.points);
            const confidence = contour.confidence || 0.5;
            const qualityScore = area * confidence * (sourceInfo.photoQuality || 0.5);

            const contourData = {
                id: `contour_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                points: contour.points,
                area: area,
                confidence: confidence,
                qualityScore: qualityScore,
                source: sourceInfo,
                timestamp: new Date()
            };

            if (!this.bestContours) this.bestContours = [];

            // Сохраняем до 5 лучших контуров
            if (this.bestContours.length < 5) {
                this.bestContours.push(contourData);
            } else {
                const worstIndex = this.bestContours.reduce((worstIdx, current, idx, arr) =>
                    current.qualityScore < arr[worstIdx].qualityScore ? idx : worstIdx, 0
                );

                if (qualityScore > this.bestContours[worstIndex].qualityScore) {
                    this.bestContours[worstIndex] = contourData;
                }
            }
        });

        this.bestContours.sort((a, b) => b.qualityScore - a.qualityScore);
    }

    // ОБНОВЛЕНИЕ ЛУЧШИХ КАБЛУКОВ
    updateBestHeels(heels, sourceInfo) {
        if (!heels || heels.length === 0) return;

        heels.forEach(heel => {
            const area = this.calculateArea(heel.points);
            const confidence = heel.confidence || 0.5;
            const qualityScore = area * confidence * (sourceInfo.photoQuality || 0.5);

            const heelData = {
                id: `heel_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                points: heel.points,
                area: area,
                confidence: confidence,
                qualityScore: qualityScore,
                source: sourceInfo,
                timestamp: new Date()
            };

            if (!this.bestHeels) this.bestHeels = [];

            if (this.bestHeels.length < 3) {
                this.bestHeels.push(heelData);
            } else {
                const worstIndex = this.bestHeels.reduce((worstIdx, current, idx, arr) =>
                    current.qualityScore < arr[worstIdx].qualityScore ? idx : worstIdx, 0
                );

                if (qualityScore > this.bestHeels[worstIndex].qualityScore) {
                    this.bestHeels[worstIndex] = heelData;
                }
            }
        });

        this.bestHeels.sort((a, b) => b.qualityScore - a.qualityScore);
    }

    // ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ЛУЧШЕМ ФОТО
    updateBestPhotoInfo(sourceInfo) {
        if (!sourceInfo.localPhotoPath) return;

        const photoQuality = sourceInfo.photoQuality || 0.5;
        const nodeCount = sourceInfo.geometry?.protectors?.length || 0;
        const avgConfidence = sourceInfo.geometry?.protectors?.reduce((sum, p) => sum + p.confidence, 0) / nodeCount || 0;

        const photoScore = photoQuality * nodeCount * avgConfidence;

        if (!this.bestPhotoInfo || photoScore > this.bestPhotoInfo.score) {
            this.bestPhotoInfo = {
                path: sourceInfo.localPhotoPath,
                quality: photoQuality,
                nodeCount: nodeCount,
                avgConfidence: avgConfidence,
                score: photoScore,
                timestamp: new Date(),
                source: sourceInfo
            };
        }
    }

    // ПЕРЕСТРОЕНИЕ СВЯЗЕЙ
    rebuildEdges() {
        this.edges = [];
        const nodeArray = Array.from(this.nodes.values());

        for (let i = 0; i < nodeArray.length; i++) {
            for (let j = i + 1; j < nodeArray.length; j++) {
                const node1 = nodeArray[i];
                const node2 = nodeArray[j];

                // ✅ НЕ создаем связь если хотя бы один узел сомнительный
                if (node1.confidence < 0.3 || node2.confidence < 0.3) {
                    continue;
                }

                const distance = this.calculateDistance(node1.center, node2.center);
                const maxDistance = Math.max(node1.size, node2.size) * 4;

                if (distance < maxDistance) {
                    // Рассчитываем уверенность связи
                    let edgeConfidence = Math.min(node1.confidence, node2.confidence);

                    // Уменьшаем уверенность для слабых узлов
                    if (node1.confidence < 0.5 || node2.confidence < 0.5) {
                        edgeConfidence *= 0.7;
                    }

                    this.edges.push({
                        from: node1.id,
                        to: node2.id,
                        distance: distance,
                        confidence: edgeConfidence,
                        // ✅ Пометка о типе связи
                        type: this.getEdgeType(node1, node2),
                        isStable: node1.metadata?.isStable && node2.metadata?.isStable
                    });
                }
            }
        }

        this.edges.sort((a, b) => b.confidence - a.confidence);
    }

    // ✅ НОВЫЙ МЕТОД: Определяем тип связи
    getEdgeType(node1, node2) {
        if (node1.confidence > 0.7 && node2.confidence > 0.7) {
            return 'strong';
        } else if (node1.confidence > 0.4 && node2.confidence > 0.4) {
            return 'medium';
        } else {
            return 'weak';
        }
    }

    // ОБНОВЛЕНИЕ ИНДЕКСОВ
    updateIndices() {
        // Хеш модели
        const nodeArray = Array.from(this.nodes.values());
        const nodeData = nodeArray
            .map(n => `${n.center.x.toFixed(0)},${n.center.y.toFixed(0)},${n.confidence.toFixed(2)}`)
            .sort()
            .join('|');

        this.hash = crypto.createHash('md5')
            .update(nodeData)
            .digest('hex');

        // Bounding box
        if (nodeArray.length > 0) {
            const xs = nodeArray.map(n => n.center.x);
            const ys = nodeArray.map(n => n.center.y);

            this.boundingBox = {
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys),
                center: {
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2
                }
            };
        }

        // Пересчитываем общую уверенность
        const confidences = nodeArray.map(n => n.confidence);
        this.stats.confidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0.3;
    }

    // ГЕОМЕТРИЧЕСКИЕ МЕТОДЫ
    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    calculateSize(points) {
        if (!points || points.length < 2) return 0;

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        return Math.sqrt(width * width + height * height);
    }

    calculateDistance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    estimateShape(points) {
        if (!points || points.length < 3) return 'unknown';

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const ratio = width / Math.max(1, height);

        if (ratio > 1.5) return 'horizontal';
        if (ratio < 0.67) return 'vertical';
        if (Math.abs(ratio - 1) < 0.2) return 'square';
        return 'rectangle';
    }

    calculateArea(points) {
        if (!points || points.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }

        return Math.abs(area) / 2;
    }

    calculateBoundingBox(points) {
        if (!points || points.length === 0) return null;

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    // НОРМАЛИЗАЦИЯ ТОПОЛОГИИ (старый метод, оставляем для совместимости)
    normalizeTopology() {
        const nodes = Array.from(this.nodes.values());

        if (nodes.length < 3) return;

        // Центр масс
        const centerX = nodes.reduce((sum, n) => sum + n.center.x, 0) / nodes.length;
        const centerY = nodes.reduce((sum, n) => sum + n.center.y, 0) / nodes.length;

        // Максимальное расстояние от центра
        const distances = nodes.map(n =>
            Math.sqrt(Math.pow(n.center.x - centerX, 2) + Math.pow(n.center.y - centerY, 2))
        );
        const maxDistance = Math.max(...distances);

        if (maxDistance === 0) return;

        // Нормализуем
        nodes.forEach(node => {
            node.normalized = {
                x: (node.center.x - centerX) / maxDistance,
                y: (node.center.y - centerY) / maxDistance
            };
        });
    }

    // СРАВНЕНИЕ ТОПОЛОГИЙ (старый метод)
    compare(otherFootprint, options = {}) {
        if (!otherFootprint || !otherFootprint.nodes || otherFootprint.nodes.size === 0) {
            return { score: 0, matched: 0, total: 0, details: {} };
        }

        // Нормализуем обе модели
        this.normalizeTopology();
        otherFootprint.normalizeTopology();

        const thisNodes = Array.from(this.nodes.values()).filter(n => n.normalized);
        const otherNodes = Array.from(otherFootprint.nodes.values()).filter(n => n.normalized);

        if (thisNodes.length === 0 || otherNodes.length === 0) {
            return { score: 0, matched: 0, total: 0, details: {} };
        }

        // Простое сравнение: находим ближайшие нормализованные точки
        const matches = [];
        const usedOtherNodes = new Set();

        thisNodes.forEach(nodeA => {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;

            otherNodes.forEach((nodeB, index) => {
                if (usedOtherNodes.has(index)) return;

                const dx = nodeA.normalized.x - nodeB.normalized.x;
                const dy = nodeA.normalized.y - nodeB.normalized.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < bestDistance && distance < 0.3) {
                    bestDistance = distance;
                    bestMatch = nodeB;
                    bestIndex = index;
                }
            });

            if (bestMatch && bestIndex !== -1) {
                matches.push({
                    nodeA: nodeA.id,
                    nodeB: bestMatch.id,
                    distance: bestDistance,
                    score: Math.max(0, 1 - bestDistance / 0.3)
                });
                usedOtherNodes.add(bestIndex);
            }
        });

        // Общий счет (сколько узлов сопоставлено)
        const maxNodes = Math.max(thisNodes.length, otherNodes.length);
        const score = maxNodes > 0 ? matches.length / maxNodes : 0;

        return {
            score: Math.min(1, score),
            matched: matches.length,
            total: thisNodes.length,
            otherTotal: otherNodes.length,
            matches: matches.slice(0, 10)
        };
    }

    // 🔥 ОБНОВЛЯЕМ существующий метод toJSON
    toJSON() {
        const baseJSON = {
            id: this.id,
            name: this.name,
            userId: this.userId,
            sessionId: this.sessionId,
            nodes: Object.fromEntries(this.nodes),
            edges: this.edges,
            bestContours: this.bestContours,
            bestHeels: this.bestHeels,
            bestPhotoInfo: this.bestPhotoInfo,
            // ✅ СОХРАНЯЕМ ВСЕ КОНТУРЫ И КАБЛУКИ
            allContours: this.allContours || [],
            allHeels: this.allHeels || [],
            metadata: this.metadata,
            stats: this.stats,
            hash: this.hash,
            boundingBox: this.boundingBox
        };

        // 🔥 ДОБАВЛЯЕМ ТОПОЛОГИЧЕСКИЕ ДАННЫЕ
        const topologyData = {
            invariants: this.topologyInvariants,
            mirrorInfo: this.mirrorInfo,
            stats: this.stats,
            normalizationParams: this.topologyInvariants.normalizationParams
        };

        // Преобразуем Map в массив для сериализации
        if (this.topologyInvariants.normalizedNodes) {
            topologyData.normalizedNodes =
                Array.from(this.topologyInvariants.normalizedNodes.entries());
        }

        return {
            ...baseJSON,
            topology: topologyData,
            version: this.version,
            _topologyEnabled: true,
            _serializedAt: new Date().toISOString()
        };
    }

    // 🔥 ОБНОВЛЯЕМ существующий статический метод fromJSON
    static fromJSON(data) {
        const footprint = new DigitalFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            sessionId: data.sessionId,
            metadata: data.metadata
        });

        if (data.nodes && typeof data.nodes === 'object') {
            footprint.nodes = new Map(Object.entries(data.nodes));
        } else {
            footprint.nodes = new Map();
        }

        footprint.edges = data.edges || [];
        footprint.bestContours = data.bestContours || [];
        footprint.bestHeels = data.bestHeels || [];
        footprint.bestPhotoInfo = data.bestPhotoInfo;
        // ✅ ЗАГРУЖАЕМ ВСЕ КОНТУРЫ И КАБЛУКИ
        footprint.allContours = data.allContours || [];
        footprint.allHeels = data.allHeels || [];
        footprint.stats = data.stats || {};
        footprint.hash = data.hash;
        footprint.boundingBox = data.boundingBox;

        // 🔥 ЗАГРУЖАЕМ ТОПОЛОГИЧЕСКИЕ ДАННЫЕ
        if (data.topology) {
            footprint.topologyInvariants = data.topology.invariants || {};
            footprint.mirrorInfo = data.topology.mirrorInfo || {};
            footprint.stats = { ...footprint.stats, ...(data.topology.stats || {}) };

            // Восстанавливаем normalizedNodes из массива
            if (data.topology.normalizedNodes && Array.isArray(data.topology.normalizedNodes)) {
                footprint.topologyInvariants.normalizedNodes =
                    new Map(data.topology.normalizedNodes);
            }

            console.log(`✅ Загружены топологические данные для модели "${footprint.name}"`);
        } else {
            console.log(`⚠️ У модели "${footprint.name}" нет топологических данных`);
        }

        return footprint;
    }
}

module.exports = DigitalFootprint;
