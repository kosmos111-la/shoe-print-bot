// modules/footprint/digital-footprint.js
// ПОЛНАЯ ОБНОВЛЁННАЯ ВЕРСИЯ С ИСПРАВЛЕНИЕМ КООРДИНАТ И ЛОГИРОВАНИЕМ
const crypto = require('crypto');
const fs = require('fs');
const TopologyUtils = require('./topology-utils');
const PointCloudAligner = require('./point-cloud-aligner');

class DigitalFootprint {
    constructor(options = {}) {
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.name = options.name || `Модель_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;
        this.sessionId = options.sessionId || null;

        // Основные данные модели
        this.nodes = new Map();
        this.edges = [];

        // 🔥 ДОБАВЛЯЕМ ХРАНЕНИЕ ОРИГИНАЛЬНЫХ КООРДИНАТ
        this.originalCoordinates = new Map(); // {nodeId: {x, y, points, timestamp}}

        // 🔥 ФЛАГ НОРМАЛИЗАЦИИ
        this.isNormalized = false;

        // Геометрические данные для визуализации
        this.bestContours = [];
        this.bestHeels = [];
        this.bestPhotoInfo = null;

        // 🔥 ДОБАВЛЯЕМ ДАННЫЕ ДЛЯ СОВМЕЩЕНИЯ
        this.alignmentHistory = [];
        this.alignmentStats = {
            totalAlignments: 0,
            successfulAlignments: 0,
            avgAlignmentScore: 0,
            bestAlignmentScore: 0
        };

        // 🔥 ДОБАВЛЯЕМ ТОПОЛОГИЧЕСКИЕ ИНВАРИАНТЫ
        this.topologyInvariants = {
            // Графовые инварианты
            degreeDistribution: null,
            adjacencyMatrix: null,
            graphDiameter: null,
            clusteringCoefficient: null,
            averagePathLength: null,

            // Геометрические инварианты (нормированные)
            normalizedNodes: new Map(),
            boundingBox: null,
            principalAxes: null,
            shapeDescriptors: null,

            // Статистические инварианты
            distanceHistogram: null,
            angleHistogram: null,
            densityMap: null,

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
            distortionInfo: null,
            autoAlignmentEnabled: true
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
            topologyQuality: 0,
            nodeUniformity: 0,
            graphConnectivity: 0,
            alignmentSuccessRate: 0
        };

        // Производительность
        this.hash = null;
        this.boundingBox = null;
        this.featureVector = null;
        this.version = '2.6'; // 🔥 Обновляем версию
    }

    // 🔥 НОВЫЙ МЕТОД: Диагностика координат
    diagnoseCoordinates() {
        console.log('🔍 ДИАГНОСТИКА КООРДИНАТ');

        const data = {
            nodes: this.nodes.size,
            originalCoords: this.originalCoordinates ? this.originalCoordinates.size : 0,
            normalizedCoords: this.topologyInvariants.normalizedNodes ?
                            this.topologyInvariants.normalizedNodes.size : 0,
            samples: []
        };

        // Берем первые 3 узла для анализа
        let count = 0;
        for (const [nodeId, node] of this.nodes) {
            if (count >= 3) break;

            const original = this.originalCoordinates.get(nodeId);
            const normalized = this.topologyInvariants.normalizedNodes.get(nodeId);

            data.samples.push({
                id: nodeId.slice(-3),
                original: original ? {
                    x: original.x ? original.x.toFixed(1) : 'N/A',
                    y: original.y ? original.y.toFixed(1) : 'N/A'
                } : 'нет',
                current: {
                    x: node.center ? node.center.x.toFixed(1) : 'N/A',
                    y: node.center ? node.center.y.toFixed(1) : 'N/A'
                },
                normalized: normalized ? {
                    x: normalized.x ? normalized.x.toFixed(3) : 'N/A',
                    y: normalized.y ? normalized.y.toFixed(3) : 'N/A'
                } : 'нет'
            });

            count++;
        }

        console.log('📊 Данные координат:', JSON.stringify(data, null, 2));
        return data;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Получить точки модели для совмещения (ИСПОЛЬЗУЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ!)
    getAlignmentPointsFromNodes() {
        console.log('🔍 DEBUG getAlignmentPointsFromNodes CALLED');
        console.log(`  - this.nodes.size: ${this.nodes.size}`);
        console.log(`  - this.originalCoordinates?.size: ${this.originalCoordinates?.size || 0}`);

        const points = [];

        // 🔥 ВАЖНО: Если есть оригинальные координаты - используем ИХ
        if (this.originalCoordinates && this.originalCoordinates.size > 0) {
            this.originalCoordinates.forEach((coord, nodeId) => {
                const node = this.nodes.get(nodeId);
                if (node && node.confidence >= 0.4 && coord && coord.x !== undefined && coord.y !== undefined) {
                    points.push({
                        x: coord.x,
                        y: coord.y,
                        confidence: node.confidence,
                        id: nodeId,
                        isOriginal: true,
                        node: node
                    });
                }
            });
        }

        // 🔥 Если оригинальных координат нет, используем текущие, но с предупреждением
        if (points.length === 0) {
            console.log('⚠️ Нет оригинальных координат, использую текущие');
            this.nodes.forEach((node, id) => {
                if (node.confidence >= 0.4 && node.center && node.center.x !== undefined) {
                    points.push({
                        x: node.center.x,
                        y: node.center.y,
                        confidence: node.confidence,
                        id: id,
                        isOriginal: false,
                        node: node
                    });
                }
            });
        }

        console.log(`  - Возвращаю ${points.length} точек`);
        if (points.length > 0) {
            console.log(`  - Пример точки: x=${points[0].x.toFixed(1)}, y=${points[0].y.toFixed(1)}`);
        }
       
        console.log(`📍 getAlignmentPoints: ${points.length} точек (${points.filter(p => p.isOriginal).length} оригинальных)`);
        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Сохранить оригинальные координаты узла
    saveOriginalCoordinates(nodeId, center, points = null) {
        if (!this.originalCoordinates) {
            this.originalCoordinates = new Map();
        }

        this.originalCoordinates.set(nodeId, {
            x: center.x,
            y: center.y,
            points: points,
            timestamp: new Date(),
            savedAt: Date.now()
        });

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить оригинальные координаты узла
    getOriginalCoordinates(nodeId) {
        if (!this.originalCoordinates || !this.originalCoordinates.has(nodeId)) {
            return null;
        }

        return this.originalCoordinates.get(nodeId);
    }

    // 🔥 НОВЫЙ МЕТОД: Автоматическое совмещение нового анализа с существующей моделью
    addAnalysisWithAlignment(analysis, sourceInfo = {}) {
    console.log('\n🎯 ===== ЗАПУСК АВТОМАТИЧЕСКОГО СОВМЕЩЕНИЯ =====');

    // 🔥 КРИТИЧЕСКАЯ ПРОВЕРКА 1: анализ данных
    console.log('🔍 ДИАГНОСТИКА анализа:');
    console.log('  - analysis type:', typeof analysis);
    console.log('  - predictions exists:', !!analysis.predictions);
    console.log('  - predictions count:', analysis.predictions?.length || 0);

    const { predictions } = analysis;
    const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];

    console.log('  - protectors count:', protectors.length);

    // 🔥 КРИТИЧЕСКАЯ ПРОВЕРКА 2: точки протекторов
    if (protectors.length > 0) {
        const firstProtector = protectors[0];
        console.log('🔍 ПЕРВЫЙ ПРОТЕКТОР:');
        console.log('  - class:', firstProtector.class);
        console.log('  - confidence:', firstProtector.confidence);
        console.log('  - points exists:', !!firstProtector.points);
        console.log('  - points count:', firstProtector.points?.length || 0);

        if (firstProtector.points && firstProtector.points.length > 0) {
            console.log('  - point[0]:', firstProtector.points[0]);

            // Проверяем не все ли точки (0,0)
            const allZero = firstProtector.points.every(p => p.x === 0 && p.y === 0);
            if (allZero) {
                console.log('🚨 КРИТИЧЕСКАЯ ОШИБКА: Все точки первого протектора (0,0)!');
                console.log('   Скорее всего, данные повреждены при передаче');
            }
        } else {
            console.log('⚠️ У протектора нет точек!');
        }
    }

    // Продолжение оригинального кода
    console.log(`📊 Текущая модель: ${this.nodes.size} узлов`);
    console.log(`📍 Оригинальных координат: ${this.originalCoordinates ? this.originalCoordinates.size : 0}`);

    const { timestamp, imagePath, photoQuality = 0.5 } = analysis;

    if (protectors.length < 3) {
        console.log('⚠️ Слишком мало протекторов для совмещения');
        return this.addAnalysis(analysis, sourceInfo);
    }

    // Если модель пустая или мало точек - просто добавляем
    if (this.nodes.size < 3) {
        console.log('📌 Модель пустая, добавляем как основу');
        return this.addAnalysis(analysis, sourceInfo);
    }

    try {
        // 🔥 ПОЛУЧАЕМ ТОЧКИ ИЗ ОРИГИНАЛЬНЫХ КООРДИНАТ
        const modelPoints = this.getAlignmentPointsFromNodes();
        const newPoints = this.extractAlignmentPointsFromProtectors(protectors);

        console.log(`🔍 Ищу совмещение: ${modelPoints.length} точек модели vs ${newPoints.length} новых точек`);

        if (modelPoints.length < 3) {
            console.log('⚠️ Недостаточно точек модели для совмещения');
            return this.addAnalysis(analysis, sourceInfo);
        }

        // 🔥 НАСТРОЙКА ALIGNER
        const aligner = new PointCloudAligner({
            maxIterations: 150,
            inlierThreshold: 25,
            minInliersRatio: 0.5,
            minInliersAbsolute: 3,
            mirrorCheck: true,
            mirrorAdvantageThreshold: 0.15,
            maxRandomScore: 0.3,
            adaptiveInlierThreshold: true
        });

        // 🔥 ПОИСК НАИЛУЧШЕГО СОВМЕЩЕНИЯ
        const alignmentResult = aligner.findBestAlignment(modelPoints, newPoints);

        // 🔥 СОХРАНЯЕМ ИСТОРИЮ СОВМЕЩЕНИЙ
        const alignmentRecord = {
            timestamp: new Date(),
            score: alignmentResult.score,
            transform: alignmentResult.transform,
            mirrored: alignmentResult.mirrored,
            inliersCount: alignmentResult.inliers?.length || 0,
            quality: alignmentResult.quality?.message || 'unknown',
            modelPointsCount: modelPoints.length,
            newPointsCount: newPoints.length,
            sourceInfo: {
                imagePath: sourceInfo.imagePath || imagePath,
                photoQuality: photoQuality,
                protectorCount: protectors.length
            }
        };

        this.alignmentHistory.push(alignmentRecord);
        this.updateAlignmentStats(alignmentResult);

        console.log(`📊 Результат совмещения: ${(alignmentResult.score * 100).toFixed(1)}%`);

        // 🔥 ПРИНЯТИЕ РЕШЕНИЯ НА ОСНОВЕ SCORE
        if (alignmentResult.score > 0.7) {
            console.log(`✅ Отличное совмещение! Трансформирую и добавляю...`);
            return this.addTransformedAnalysis(analysis, sourceInfo, alignmentResult);

        } else if (alignmentResult.score > 0.5) {
            console.log(`✅ Хорошее совмещение. Добавляю с пометкой...`);
            sourceInfo.alignmentInfo = {
                ...alignmentRecord,
                confidence: 'good',
                applied: true
            };
            return this.addAnalysis(analysis, sourceInfo);

        } else if (alignmentResult.score > 0.3) {
            console.log(`⚠️ Слабое совмещение. Возможно новый кластер...`);
            sourceInfo.alignmentInfo = {
                ...alignmentRecord,
                confidence: 'weak',
                isNewCluster: true
            };
            return this.addAnalysis(analysis, sourceInfo);

        } else {
            console.log(`❌ Плохое совмещение. Добавляю как отдельный след...`);
            sourceInfo.alignmentInfo = {
                ...alignmentRecord,
                confidence: 'poor',
                isSeparateCluster: true,
                warning: 'Возможно другой след'
            };
            return this.addAnalysis(analysis, sourceInfo);
        }

    } catch (error) {
        console.log('❌ Ошибка совмещения:', error.message);
        console.log('🔄 Возвращаюсь к стандартному добавлению');
        return this.addAnalysis(analysis, sourceInfo);
    }
}

    // 🔥 НОВЫЙ МЕТОД: Добавление трансформированного анализа
    addTransformedAnalysis(analysis, sourceInfo, alignmentResult) {
        const { predictions } = analysis;
        const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];

        console.log(`🔄 Трансформирую ${protectors.length} протекторов...`);

        // Создаем копию sourceInfo с информацией о трансформации
        const transformedSourceInfo = {
            ...sourceInfo,
            alignmentInfo: {
                timestamp: new Date(),
                score: alignmentResult.score,
                transform: alignmentResult.transform,
                mirrored: alignmentResult.mirrored,
                inliersCount: alignmentResult.inliers?.length || 0,
                applied: true
            }
        };

        const addedNodes = [];
        const mergedNodes = [];

        protectors.forEach((protector, protectorIndex) => {
            try {
                // Трансформируем центр протектора
                const originalCenter = this.calculateCenter(protector.points);
                const transformedCenter = this.transformPointWithAlignment(
                    originalCenter,
                    alignmentResult
                );

                // Создаем узел с трансформированным центром
                const node = this.createNodeFromProtector(protector, transformedSourceInfo);
                node.center = transformedCenter;
                node.metadata = {
                    ...node.metadata,
                    transformed: true,
                    originalCenter: originalCenter,
                    alignmentScore: alignmentResult.score,
                    alignmentTransform: alignmentResult.transform
                };

                // 🔥 ВАЖНО: Сохраняем ТРАНСФОРМИРОВАННЫЕ координаты как оригинальные для этой модели
                // Потому что после трансформации это становится "оригиналом" для данной модели
                this.saveOriginalCoordinates(node.id, transformedCenter, protector.points);

                // Ищем похожий узел (с меньшим допуском после трансформации)
                const similarNode = this.findSimilarNode(node, 40);

                if (similarNode) {
                    // Усиливаем существующий узел
                    this.mergeNodes(similarNode.id, node);
                    mergedNodes.push({
                        existingId: similarNode.id,
                        newId: node.id,
                        distance: this.calculateDistance(similarNode.center, node.center)
                    });
                } else {
                    // Добавляем новый узел
                    this.nodes.set(node.id, node);
                    addedNodes.push({
                        id: node.id,
                        confidence: node.confidence,
                        transformed: true
                    });
                }
            } catch (error) {
                console.log(`⚠️ Ошибка обработки протектора ${protectorIndex}:`, error.message);
            }
        });

        // Сохраняем контуры и каблуки (трансформированные)
        this.saveAllContoursTransformed(
            predictions?.filter(p => p.class === 'Outline-trail') || [],
            transformedSourceInfo,
            alignmentResult
        );

        this.saveAllHeelsTransformed(
            predictions?.filter(p => p.class === 'Heel') || [],
            transformedSourceInfo,
            alignmentResult
        );

        // Обновляем модель
        if (addedNodes.length > 0 || mergedNodes.length > 0) {
            this.rebuildEdges();
            this.updateIndices();

            // 🔥 ВАЖНО: Обновляем топологические инварианты, НО не нормализуем узлы
            // Мы сохраняем оригинальные координаты для будущих совмещений
            this.updateTopologyInvariants(true); // true = skip normalization
        }

        // Статистика
        this.stats.totalSources++;
        this.stats.totalPhotos++;
        this.stats.lastUpdated = new Date();
        this.stats.lastPhotoAdded = new Date();

        console.log('\n📊 ===== РЕЗУЛЬТАТ ТРАНСФОРМАЦИИ =====');
        console.log(`✅ Добавлено новых узлов: ${addedNodes.length}`);
        console.log(`✅ Объединено существующих: ${mergedNodes.length}`);
        console.log(`🎯 Score совмещения: ${(alignmentResult.score * 100).toFixed(1)}%`);

        if (alignmentResult.transform) {
            const angleDeg = alignmentResult.transform.rotation * 180 / Math.PI;
            console.log(`📐 Трансформация:`);
            console.log(`   • Поворот: ${angleDeg.toFixed(1)}°`);
            console.log(`   • Масштаб: ${alignmentResult.transform.scale?.toFixed(3) || 1.0}`);
            console.log(`   • Смещение: (${alignmentResult.transform.translation?.x?.toFixed(1) || 0}, ${alignmentResult.transform.translation?.y?.toFixed(1) || 0})`);
        }

        if (alignmentResult.mirrored) {
            console.log('🪞 Обнаружено зеркальное отражение');
        }

        console.log(`📈 Всего узлов в модели: ${this.nodes.size}`);
        console.log(`📍 Оригинальных координат: ${this.originalCoordinates.size}`);
        console.log('========================================\n');

        return {
            added: addedNodes.length,
            merged: mergedNodes.length,
            transformed: true,
            alignmentScore: alignmentResult.score,
            mirrored: alignmentResult.mirrored,
            totalNodes: this.nodes.size
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечь точки из протекторов для совмещения
    extractAlignmentPointsFromProtectors(protectors) {
    console.log('🔍 DEBUG extractAlignmentPointsFromProtectors CALLED');
    console.log(`  - protectors.length: ${protectors.length}`);
   
    if (!protectors || protectors.length === 0) {
        console.log('⚠️ Нет протекторов для совмещения');
        return [];
    }
   
    // 🔥 КРИТИЧЕСКАЯ ПРОВЕРКА: не все ли точки (0,0)?
    const firstProtector = protectors[0];
    if (firstProtector && firstProtector.points) {
        const samplePoint = firstProtector.points[0];
        console.log(`  - Пример точки: x=${samplePoint?.x || 'N/A'}, y=${samplePoint?.y || 'N/A'}`);
       
        // Если первая точка (0,0), проверяем все
        if (samplePoint && samplePoint.x === 0 && samplePoint.y === 0) {
            const allZero = protectors.every(p =>
                p.points && p.points.every(pt => pt.x === 0 && pt.y === 0)
            );
            if (allZero) {
                console.log('🚨 КРИТИЧЕСКАЯ ОШИБКА: Все точки протектора в (0,0)!');
                console.log('   Возвращаю пустой массив для предотвращения ошибки');
                return [];
            }
        }
    }
   
    // Нормальная обработка
    return protectors.map((p, index) => {
        const center = this.calculateCenter(p.points);
        console.log(`  - Протектор ${index}: center=(${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
        return {
            x: center.x,
            y: center.y,
            confidence: p.confidence || 0.5,
            id: `new_${Date.now()}_${index}`
        };
    });
}

    // 🔥 НОВЫЙ МЕТОД: Трансформировать точку с результатом совмещения
    transformPointWithAlignment(point, alignmentResult) {
        if (!alignmentResult || !alignmentResult.transform) return point;

        const aligner = new PointCloudAligner();
        return aligner.transformPoint(
            point,
            alignmentResult.transform,
            alignmentResult.mirrored
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Обновить статистику совмещений
    updateAlignmentStats(alignmentResult) {
        this.alignmentStats.totalAlignments++;

        if (alignmentResult.score > 0.5) {
            this.alignmentStats.successfulAlignments++;
        }

        // Обновляем средний score
        const totalScore = this.alignmentStats.avgAlignmentScore * (this.alignmentStats.totalAlignments - 1);
        this.alignmentStats.avgAlignmentScore = (totalScore + alignmentResult.score) / this.alignmentStats.totalAlignments;

        // Обновляем лучший score
        if (alignmentResult.score > this.alignmentStats.bestAlignmentScore) {
            this.alignmentStats.bestAlignmentScore = alignmentResult.score;
        }

        // Обновляем статистику в stats
        if (this.alignmentStats.totalAlignments > 0) {
            this.stats.alignmentSuccessRate = this.alignmentStats.successfulAlignments / this.alignmentStats.totalAlignments;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Сохранить трансформированные контуры
    saveAllContoursTransformed(contours, sourceInfo, alignmentResult) {
        if (!contours || contours.length === 0) return;
        if (!this.allContours) this.allContours = [];

        contours.forEach(contour => {
            try {
                const transformedPoints = contour.points.map(point =>
                    this.transformPointWithAlignment(point, alignmentResult)
                );

                this.allContours.push({
                    id: `contour_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                    points: transformedPoints,
                    originalPoints: contour.points,
                    confidence: contour.confidence || 0.5,
                    source: sourceInfo,
                    alignmentScore: alignmentResult.score,
                    transformed: true,
                    timestamp: new Date()
                });
            } catch (error) {
                console.log('⚠️ Ошибка трансформации контура:', error.message);
            }
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Сохранить трансформированные каблуки
    saveAllHeelsTransformed(heels, sourceInfo, alignmentResult) {
        if (!heels || heels.length === 0) return;
        if (!this.allHeels) this.allHeels = [];

        heels.forEach(heel => {
            try {
                const transformedPoints = heel.points.map(point =>
                    this.transformPointWithAlignment(point, alignmentResult)
                );

                this.allHeels.push({
                    id: `heel_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                    points: transformedPoints,
                    originalPoints: heel.points,
                    confidence: heel.confidence || 0.5,
                    source: sourceInfo,
                    alignmentScore: alignmentResult.score,
                    transformed: true,
                    timestamp: new Date()
                });
            } catch (error) {
                console.log('⚠️ Ошибка трансформации каблука:', error.message);
            }
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Получить статистику совмещений
    getAlignmentStats() {
        return {
            ...this.alignmentStats,
            historyCount: this.alignmentHistory.length,
            lastAlignment: this.alignmentHistory.length > 0 ?
                this.alignmentHistory[this.alignmentHistory.length - 1] : null,
            successRate: this.stats.alignmentSuccessRate
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Получить данные для визуализации совмещения
    getAlignmentVisualizationData() {
        const modelPoints = this.getAlignmentPointsFromNodes();
        const alignmentRecords = this.alignmentHistory.filter(record => record.score > 0.5);

        return {
            modelPoints: modelPoints,
            alignmentHistory: alignmentRecords,
            stats: this.getAlignmentStats(),
            modelInfo: {
                nodeCount: this.nodes.size,
                edgeCount: this.edges.length,
                confidence: this.stats.confidence,
                originalCoordinatesCount: this.originalCoordinates ? this.originalCoordinates.size : 0
            }
        };
    }

    // 🔥 ОСНОВНОЙ МЕТОД: добавить данные из анализа (оригинальный)
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
                    originalPoints: c.points
                })),
                heels: heels.map(h => ({
                    points: h.points,
                    confidence: h.confidence || 0.5,
                    area: this.calculateArea(h.points),
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
        const matchedProtectors = new Map();
        const matchedNodesInThisFrame = new Set();

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

        // ✅ СОХРАНЯЕМ ВСЕ КОНТУРЫ И КАБЛУКИ
        this.saveAllContours(contours, enhancedSourceInfo);
        this.saveAllHeels(heels, enhancedSourceInfo);

        // Обновляем информацию о лучшем фото
        this.updateBestPhotoInfo(enhancedSourceInfo);

        // 🔥 ВАЖНО: Если есть alignmentInfo в sourceInfo, сохраняем его
        if (sourceInfo.alignmentInfo) {
            this.alignmentHistory.push({
                ...sourceInfo.alignmentInfo,
                timestamp: new Date(),
                applied: sourceInfo.alignmentInfo.applied || false
            });
            this.updateAlignmentStats({ score: sourceInfo.alignmentInfo.score || 0 });
        }

        // Статистика
        this.stats.totalSources++;
        this.stats.totalPhotos++;
        this.stats.avgPhotoQuality = (
            this.stats.avgPhotoQuality * (this.stats.totalPhotos - 1) + photoQuality
        ) / this.stats.totalPhotos;
        this.stats.lastUpdated = new Date();
        this.stats.lastPhotoAdded = new Date();

        // ПЕРЕСЧИТЫВАЕМ СВЯЗИ ТОЛЬКО ЕСЛИ ЕСТЬ НОВЫЕ УЗЛОВ
        if (addedNodes.length > 0 || mergedNodes.length > 0) {
            this.rebuildEdges();
            this.updateIndices();

            // 🔥 ВАЖНО: Обновляем топологические инварианты, НО не нормализуем узлы
            // Мы сохраняем оригинальные координаты для будущих совмещений
            if (addedNodes.length > 0 || mergedNodes.length > 2) {
                this.updateTopologyInvariants(true); // true = skip normalization
            }
        }

        // ВЫВОД ПОДРОБНОЙ СТАТИСТИКИ
        console.log('\n📊 ========== ДЕТАЛЬНАЯ СТАТИСТИКА ==========');
        console.log(`👟 Протекторов в анализе: ${protectors.length}`);
        console.log(`🔗 Объединено узлов: ${mergedNodes.length}`);
        console.log(`✨ Новых узлов: ${addedNodes.length}`);
        console.log(`⚠️  Слабых узлов: ${weakNodes.length}`);
        console.log(`📈 Итого узлов в модели: ${this.nodes.size}`);
        console.log(`📍 Оригинальных координат: ${this.originalCoordinates.size}`);
        console.log(`🔵 Контуров сохранено: ${contours.length}`);
        console.log(`👠 Каблуков сохранено: ${heels.length}`);
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

    // СОЗДАНИЕ УЗЛА ИЗ ПРОТЕКТОРА
    createNodeFromProtector(protector, sourceInfo) {
        const center = this.calculateCenter(protector.points);
        const size = this.calculateSize(protector.points);
        const shape = this.estimateShape(protector.points);

        const nodeId = `node_${crypto.randomBytes(3).toString('hex')}`;

        // 🔥 ВАЖНО: Сохраняем ОРИГИНАЛЬНЫЕ координаты
        this.saveOriginalCoordinates(nodeId, center, protector.points);

        return {
            id: nodeId,
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
                clusterId: null,
                neighbors: []
            }
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Обновление топологических инвариантов
    updateTopologyInvariants(skipNormalization = false) {
        console.log(`🔄 Обновляю топологические инварианты для модели "${this.name}"`);
        console.log(`📌 Пропуск нормализации: ${skipNormalization}`);

        try {
            const nodesArray = Array.from(this.nodes.values());

            if (nodesArray.length < 2) {
                console.log('⚠️ Слишком мало узлов для топологического анализа');
                return;
            }

            // 🔥 ВАЖНОЕ ИЗМЕНЕНИЕ: Нормализуем только если явно не отключено
            if (!skipNormalization) {
                this.normalizeNodes();
            } else {
                console.log('📌 Пропускаю нормализацию - сохраняю оригинальные координаты для совмещения');
            }

            // 2. ВЫЧИСЛЕНИЕ ГРАФОВЫХ ИНВАРИАНТОВ
            this.calculateGraphInvariants();

            // 3. ВЫЧИСЛЕНИЕ ГЕОМЕТРИЧЕСКИХ ИНВАРИАНТОВ
            this.calculateGeometricInvariants();

            // 4. ВЫЧИСЛЕНИЕ СТАТИСТИЧЕСКИХ ИНВАРИАНТОВ
            this.calculateStatisticalInvariants();

            // 5. ОЦЕНКА КАЧЕСТВА ТОПОЛОГИИ
            this.assessTopologyQuality();

            console.log(`✅ Топологические инварианты обновлены (${this.topologyInvariants.normalizedNodes.size} нормализованных узлов)`);

        } catch (error) {
            console.log('❌ Ошибка обновления топологических инвариантов:', error.message);
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Нормализация узлов
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
                    originalId: originalNode.id,
                    originalCenter: originalNode.center
                });
            }
        });

        console.log(`📐 Нормализация: центр=(${normalizedData.normalizationParams.center.x.toFixed(1)}, ` +
                   `${normalizedData.normalizationParams.center.y.toFixed(1)}), ` +
                   `масштаб=${normalizedData.normalizationParams.scale.toFixed(4)}, ` +
                   `поворот=${(normalizedData.normalizationParams.rotation * 180 / Math.PI).toFixed(1)}°`);
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
            allContours: this.allContours || [],
            allHeels: this.allHeels || [],
            metadata: this.metadata,
            stats: this.stats,
            hash: this.hash,
            boundingBox: this.boundingBox
        };

        // 🔥 ДОБАВЛЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
        const extendedData = {
            originalCoordinates: Array.from(this.originalCoordinates.entries()),
            alignmentHistory: this.alignmentHistory,
            alignmentStats: this.alignmentStats,
            topologyInvariants: {
                ...this.topologyInvariants,
                normalizedNodes: Array.from(this.topologyInvariants.normalizedNodes.entries())
            },
            mirrorInfo: this.mirrorInfo,
            version: this.version,
            _alignmentEnabled: true,
            _serializedAt: new Date().toISOString()
        };

        return {
            ...baseJSON,
            ...extendedData
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

        // 🔥 ВОССТАНАВЛИВАЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
        if (data.originalCoordinates && Array.isArray(data.originalCoordinates)) {
            footprint.originalCoordinates = new Map(data.originalCoordinates);
            console.log(`✅ Восстановлено ${footprint.originalCoordinates.size} оригинальных координат`);
        } else {
            footprint.originalCoordinates = new Map();
            console.log(`⚠️ У модели "${footprint.name}" нет оригинальных координат, создаю пустые`);
        }

        footprint.edges = data.edges || [];
        footprint.bestContours = data.bestContours || [];
        footprint.bestHeels = data.bestHeels || [];
        footprint.bestPhotoInfo = data.bestPhotoInfo;
        footprint.allContours = data.allContours || [];
        footprint.allHeels = data.allHeels || [];
        footprint.stats = data.stats || {};
        footprint.hash = data.hash;
        footprint.boundingBox = data.boundingBox;

        // 🔥 ЗАГРУЖАЕМ ДАННЫЕ СОВМЕЩЕНИЙ
        footprint.alignmentHistory = data.alignmentHistory || [];
        footprint.alignmentStats = data.alignmentStats || {
            totalAlignments: 0,
            successfulAlignments: 0,
            avgAlignmentScore: 0,
            bestAlignmentScore: 0
        };

        // 🔥 ЗАГРУЖАЕМ ТОПОЛОГИЧЕСКИЕ ДАННЫЕ
        if (data.topologyInvariants) {
            footprint.topologyInvariants = data.topologyInvariants;
            footprint.mirrorInfo = data.mirrorInfo || {};

            // Восстанавливаем normalizedNodes из массива
            if (data.topologyInvariants.normalizedNodes && Array.isArray(data.topologyInvariants.normalizedNodes)) {
                footprint.topologyInvariants.normalizedNodes =
                    new Map(data.topologyInvariants.normalizedNodes);
            }

            console.log(`✅ Загружены топологические данные для модели "${footprint.name}"`);
        } else {
            console.log(`⚠️ У модели "${footprint.name}" нет топологических данных`);
        }

        footprint.version = data.version || '2.6';

        console.log(`✅ Загружена модель "${footprint.name}" с ${footprint.alignmentHistory.length} совмещениями`);
        console.log(`📍 Оригинальных координат: ${footprint.originalCoordinates.size}`);
        return footprint;
    }

    // ОСТАЛЬНЫЕ МЕТОДЫ (без изменений)

    // ✅ НОВЫЙ МЕТОД: Сохраняем ВСЕ контуры
    saveAllContours(contours, sourceInfo) {
        if (!contours || contours.length === 0) return;

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
                boundingBox: this.calculateBoundingBox(contour.points),
                center: this.calculateCenter(contour.points)
            };

            this.allContours.push(contourData);
        });

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

        // 2. НЕБОЛЬШОЕ УСИЛЕНИЕ
        const confidenceBoost = Math.min(0.1, 1.0 - existing.confidence);
        existing.confidence = Math.min(1.0, existing.confidence + confidenceBoost);

        // 3. Увеличиваем счетчик подтверждений
        existing.confirmationCount = (existing.confirmationCount || 1) + 1;
        existing.lastSeen = new Date();

        // 4. Добавляем источник
        if (!existing.sources) existing.sources = [];
        existing.sources.push(...newNode.sources);

        this.nodes.set(existingId, existing);

        console.log(`   → Узел ${existingId.slice(-3)} подтвержден: ${existing.confidence.toFixed(2)} уверенность, ${existing.confirmationCount} подтверждений`);
    }

    // ПЕРЕСТРОЕНИЕ СВЯЗЕЙ
    rebuildEdges() {
        this.edges = [];
        const nodeArray = Array.from(this.nodes.values());

        for (let i = 0; i < nodeArray.length; i++) {
            for (let j = i + 1; j < nodeArray.length; j++) {
                const node1 = nodeArray[i];
                const node2 = nodeArray[j];

                if (node1.confidence < 0.3 || node2.confidence < 0.3) {
                    continue;
                }

                const distance = this.calculateDistance(node1.center, node2.center);
                const maxDistance = Math.max(node1.size, node2.size) * 4;

                if (distance < maxDistance) {
                    let edgeConfidence = Math.min(node1.confidence, node2.confidence);

                    if (node1.confidence < 0.5 || node2.confidence < 0.5) {
                        edgeConfidence *= 0.7;
                    }

                    this.edges.push({
                        from: node1.id,
                        to: node2.id,
                        distance: distance,
                        confidence: edgeConfidence,
                        type: this.getEdgeType(node1, node2),
                        isStable: node1.metadata?.isStable && node2.metadata?.isStable
                    });
                }
            }
        }

        this.edges.sort((a, b) => b.confidence - a.confidence);
    }

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

    // ВЫЧИСЛЕНИЕ ГРАФОВЫХ ИНВАРИАНТОВ
    calculateGraphInvariants() {
        const nodesArray = Array.from(this.nodes.values());

        if (nodesArray.length === 0 || this.edges.length === 0) {
            console.log('⚠️ Нет ребер для графового анализа');
            return;
        }

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

    // ВЫЧИСЛЕНИЕ ГЕОМЕТРИЧЕСКИХ ИНВАРИАНТОВ
    calculateGeometricInvariants() {
        const normalizedNodes = Array.from(this.topologyInvariants.normalizedNodes.values());

        if (normalizedNodes.length < 2) {
            return;
        }

        const geometricData = TopologyUtils.calculateGeometricInvariantsForFootprint(
            normalizedNodes,
            this.topologyInvariants
        );

        this.topologyInvariants.boundingBox = geometricData.boundingBox;
        this.topologyInvariants.shapeDescriptors = geometricData.shapeDescriptors;
    }

    // ВЫЧИСЛЕНИЕ СТАТИСТИЧЕСКИХ ИНВАРИАНТЫ
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

    // ОЦЕНКА КАЧЕСТВА ТОПОЛОГИИ
    assessTopologyQuality() {
        const nodesArray = Array.from(this.nodes.values());

        if (nodesArray.length === 0) {
            this.stats.topologyQuality = 0;
            return;
        }

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
}

module.exports = DigitalFootprint;
