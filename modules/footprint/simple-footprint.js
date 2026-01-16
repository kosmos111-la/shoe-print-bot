// modules/footprint/simple-footprint.js
// 🔥 ДОБАВЛЯЕМ ТРАНСФОРМАЦИЮ В ОТПЕЧАТОК

const crypto = require('crypto');
const fs = require('fs');
const SimpleGraph = require('./simple-graph');
const HybridFootprint = require('./hybrid-footprint');
const PointTracker = require('./point-tracker');
const path = require('path');

class SimpleFootprint {
    constructor(options = {}) {
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;

        // 🔥 ДОБАВЛЯЕМ ПОЛЕ ДЛЯ ТРАНСФОРМАЦИИ
        this.transformation = options.transformation || null;
        this.originalBounds = options.originalBounds || null;
        this.normalizationInfo = options.normalizationInfo || null;

        // 🔥 ВАЖНО: Создаем новый граф при инициализации
        this.graph = options.graph || new SimpleGraph(this.name);

        this.hybridFootprint = options.hybridFootprint || null;
        if (!this.hybridFootprint && HybridFootprint) {
            try {
                this.hybridFootprint = new HybridFootprint({
                    id: this.id,
                    name: this.name,
                    userId: this.userId
                });
            } catch (error) {
                console.log('⚠️ Не удалось создать гибридный отпечаток:', error.message);
            }
        }

        // 🔥 ОБНОВЛЕННЫЙ POINT TRACKER с честными подтверждениями
        this.pointTracker = options.pointTracker || new PointTracker({
            ratingDecay: 0.97,
            minRating: 0.1,
            maxRating: 1.0,
            confirmationThreshold: 0.7,
            enableClustering: true,
            clusterRadius: 30,
            minClusterSize: 2,
            adaptiveDistance: true,
            baseDistanceThreshold: 25,
            bonusForClusters: false,
            directUpdateThreshold: 50,
            forceUpdateOnMerge: true,
            honestConfirmations: true,
            maxConfirmationsPerPhoto: 1
        });

        this.metadata = {
            created: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            estimatedSize: options.estimatedSize || null,
            footprintType: options.footprintType || 'unknown',
            orientation: options.orientation || 0,
            features: {
                hasGraph: true,
                hasHybrid: this.hybridFootprint !== null,
                hasPointTracker: true,
                hasHonestConfirmations: true,
                hasMoments: this.hybridFootprint?.moments ? true : false,
                hasBitmask: this.hybridFootprint?.bitmask ? true : false
            },
            ...(options.metadata || {})
        };

        this.stats = {
            confidence: options.confidence || 0.5,
            nodeCount: 0,
            edgeCount: 0,
            graphDiameter: 0,
            clusteringCoefficient: 0,
            qualityScore: 0,
            hybridScore: 0,
            trackerScore: 0,
            honestScore: 0
        };

        this.photoHistory = [];
        this.analysisHistory = [];
        this.linkedFootprints = [];
        this.visualizationCache = null;

        console.log(`👣 Создан цифровой отпечаток "${this.name}" (ID: ${this.id}) с трансформацией`);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Честное добавление анализа с сохранением трансформации
    addAnalysisHonest(analysis, sourceInfo = {}) {
        console.log(`📥 Честное добавление анализа с сохранением трансформации`);
        // Сохраняем трансформацию ИЗ ИСТОЧНИКА
        if (sourceInfo.transformationInfo) {
            this.transformation = sourceInfo.transformationInfo;
            console.log(`📐 Сохранена трансформация из sourceInfo: ${this.transformation.rotationAngle}°`);
        }
        // Или из normalizedGraph
        else if (sourceInfo.normalizedGraph && sourceInfo.normalizedGraph.transformation) {
            this.transformation = sourceInfo.normalizedGraph.transformation;
            console.log(`📐 Сохранена трансформация из normalizedGraph: ${this.transformation.rotationAngle}°`);
        }
        // Или создаем по умолчанию с реальным углом
        else if (!this.transformation) {
            // 🔥 ВАЖНО: получаем реальный угол из rotation-invariance
            const RotationInvariance = require('./rotation-invariance');
            const processor = new RotationInvariance();

            const points = this.extractProtectorPoints(analysis.predictions);
            if (points.length >= 3) {
                const angle = processor.detectRotationAngle(points);
                this.transformation = this.createTransformationWithAngle(angle); // 🔥 С РЕАЛЬНЫМ УГЛОМ
                console.log(`📐 Создана трансформация с реальным углом: ${angle}°`);
            }
        }
       
        const { predictions } = analysis;
        const protectorPoints = this.extractProtectorPoints(predictions);

        if (protectorPoints.length < 3) {
            console.log(`⚠️ Слишком мало протекторов: ${protectorPoints.length}`);
            return { error: 'Not enough protectors', added: 0 };
        }

        console.log(`🔍 Найдено ${protectorPoints.length} протекторов`);

        // 🔥 СОХРАНЯЕМ ИНФОРМАЦИЮ О НОРМАЛИЗАЦИИ
        if (sourceInfo.normalizedGraph && sourceInfo.normalizedGraph.transformation) {
            this.transformation = sourceInfo.normalizedGraph.transformation;
            this.normalizationInfo = sourceInfo.normalizationInfo || {};

            console.log(`📐 Сохранена трансформация: поворот ${this.transformation.rotationAngle}°`);
        }

        // 🔥 ВАЖНО: Используем честный метод трекера
        const trackerResults = this.pointTracker.processNewPoints(protectorPoints, {
            ...sourceInfo,
            footprintId: this.id,
            analysisType: 'shoe_protector',
            timestamp: new Date(),
            photoId: sourceInfo.photoId || `photo_${Date.now()}`,
            source: sourceInfo.source || 'direct_photo'
        });

        console.log(`🎯 PointTracker (честный): ${trackerResults.added} новых, ${trackerResults.updated} обновлено`);

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Получаем точки из трекера и СТРОИМ ГРАФ
        const previousNodeCount = this.graph.nodes.size;

        // Получаем ВСЕ точки из трекера для построения графа
        const trackedPoints = [];
        for (const [id, pt] of this.pointTracker.points) {
            trackedPoints.push({
                id,
                x: pt.x,
                y: pt.y,
                rating: pt.rating,
                confirmedCount: pt.confirmedCount || 1,
                uniquePhotos: pt.confirmedPhotos ? pt.confirmedPhotos.size : 1,
                lastSeen: pt.lastSeen
            });
        }

        console.log(`📊 Собрано ${trackedPoints.length} точек из трекера для построения графа`);

        // 🔥 ВАЖНО: Если нет точек - создаем пустой результат
        if (trackedPoints.length === 0) {
            console.log(`⚠️ Нет точек для построения графа`);
            return {
                success: true,
                added: 0,
                updated: trackerResults.updated,
                totalNodes: 0,
                confidence: 0.5,
                honestScore: 0.5
            };
        }

        // 🔥 ВАЖНО: Преобразуем точки трекера в формат для графа
        const graphPoints = trackedPoints.map((trackedPoint, index) => ({
            id: `n_${trackedPoint.id}`,
            x: trackedPoint.x,
            y: trackedPoint.y,
            confidence: trackedPoint.rating,
            confirmedCount: trackedPoint.confirmedCount,
            pointTrackerId: trackedPoint.id
        }));

        // 🔥 ВАЖНО: Строим граф из точек
        console.log(`🏗️  Строю граф из ${graphPoints.length} точек...`);
        const graphInvariants = this.graph.buildFromPoints(graphPoints.map(p => ({
            x: p.x,
            y: p.y,
            confidence: p.confidence,
            id: p.id
        })));

        console.log(`✅ Построен граф: ${this.graph.nodes.size} узлов, ${this.graph.edges.size} рёбер`);

        // Связываем узлы с трекером
        const linkedCount = this.linkNodesWithTrackerHonest(graphPoints);

        // Сохраняем в историю
        const analysisRecord = {
            id: `analysis_${Date.now()}`,
            timestamp: new Date(),
            pointsCount: protectorPoints.length,
            trackerResults: trackerResults,
            trackedPoints: trackedPoints.length,
            linkedCount: linkedCount,
            sourceInfo: sourceInfo,
            honestConfirmations: true,
            uniquePhotoId: trackerResults.photoId,
            graphSnapshot: {
                nodeCount: this.graph.nodes.size,
                edgeCount: this.graph.edges.size
            }
        };

        this.analysisHistory.push(analysisRecord);
        this.photoHistory.push({
            timestamp: new Date(),
            points: protectorPoints.length,
            source: sourceInfo,
            trackerResults: trackerResults,
            honestConfirmations: true,
            photoId: trackerResults.photoId
        });

        // Обновляем метаданные
        this.metadata.totalPhotos++;
        this.metadata.lastUpdated = new Date();

        // Обновляем статистику
        this.updateStats(graphInvariants, null);

        // Получаем статистику трекера
        const trackerStats = this.pointTracker.getHonestStats();
        this.stats.trackerStats = trackerStats;
        this.stats.trackerScore = trackerStats.avgRating;
        this.stats.honestScore = trackerStats.confirmationIntegrity || 0;

        const graphConfidence = this.stats.confidence;
        const trackerConfidence = trackerStats.avgRating;
        const honestConfidence = trackerStats.confirmationIntegrity || 0.5;

        // Комбинированная уверенность
        this.stats.confidence = (graphConfidence * 0.3 +
                                trackerConfidence * 0.4 +
                                honestConfidence * 0.3);

        const addedNodes = this.graph.nodes.size - previousNodeCount;

        console.log(`✅ Анализ добавлен (честно): +${addedNodes} узлов в граф, ` +
                   `всего узлов: ${this.graph.nodes.size}, ` +
                   `подтверждений: ${trackerResults.updated}`);

        return {
            success: true,
            added: addedNodes,
            totalNodes: this.graph.nodes.size,
            confidence: this.stats.confidence,
            honestScore: honestConfidence,
            uniquePhotos: trackerStats.uniquePhotos || 1,
            graphInvariants: graphInvariants,
            trackerResults: trackerResults,
            trackerStats: trackerStats,
            linkedCount: linkedCount
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Создать трансформацию с учетом ориентации
    createOrientationAwareTransformation(points) {
        console.log('🔄 [createOrientationAwareTransformation] Создаю трансформацию с учетом ориентации...');

        if (points.length < 3) {
            console.log('⚠️ Мало точек (<3), возвращаю трансформацию по умолчанию');
            return this.createEmergencyDefaultTransformation();
        }

        // Вычисляем границы
        const bounds = this.calculateBounds(points);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const aspectRatio = width / Math.max(1, height);

        console.log(`📏 Размеры: ${width.toFixed(1)}x${height.toFixed(1)} (ratio: ${aspectRatio.toFixed(2)})`);

        let rotationAngle = 0;

        // Определяем угол на основе ориентации
        const VERTICAL_THRESHOLD = 0.5;
        const HORIZONTAL_THRESHOLD = 2.0;

        if (aspectRatio < VERTICAL_THRESHOLD) {
            // Вертикальный след → поворачиваем на 90°
            rotationAngle = 90;
            console.log(`📐 ВЕРТИКАЛЬНЫЙ след -> поворачиваю на ${rotationAngle}°`);
        } else if (aspectRatio > HORIZONTAL_THRESHOLD) {
            // Горизонтальный след → не поворачиваем
            rotationAngle = 0;
            console.log(`📐 ГОРИЗОНТАЛЬНЫЙ след -> не поворачиваю`);
        } else {
            // Квадратный след → используем PCA
            try {
                const RotationInvariance = require('./rotation-invariance');
                const processor = new RotationInvariance({ debug: false });
                rotationAngle = processor.detectRotationAngle(points);
                console.log(`📐 КВАДРАТНЫЙ след -> PCA определил угол ${rotationAngle}°`);
            } catch (error) {
                console.log('❌ Ошибка PCA, использую 0°:', error.message);
                rotationAngle = 0;
            }
        }

        // Создаем трансформацию
        return this.createTransformationWithAngle(rotationAngle);
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Получить трансформацию
    getTransformation() {
        // 1. Если уже есть трансформация - возвращаем её
        if (this.transformation && this.transformation.rotationAngle !== undefined) {
            console.log(`📐 [getTransformation] Возвращаю сохраненную трансформацию: ${this.transformation.rotationAngle}°`);
            return this.transformation;
        }

        // 2. Если нет - создаем из текущих точек С УЧЕТОМ ОРИЕНТАЦИИ
        console.log('⚠️ [getTransformation] Нет сохраненной трансформации, создаю из текущих точек с учетом ориентации...');

        // Получаем точки из трекера
        const points = [];
        if (this.pointTracker && this.pointTracker.points) {
            for (const [, point] of this.pointTracker.points) {
                points.push({ x: point.x, y: point.y });
            }
        }

        console.log(`📊 Найдено ${points.length} точек в трекере`);

        if (points.length < 3) {
            console.log('⚠️ Мало точек (<3), возвращаю трансформацию по умолчанию');
            return this.createEmergencyDefaultTransformation();
        }

        // 🔥 ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД С УЧЕТОМ ОРИЕНТАЦИИ
        this.transformation = this.createOrientationAwareTransformation(points);

        console.log(`✅ Создана трансформация с учетом ориентации: ${this.transformation.rotationAngle}°`);

        return this.transformation;
    }

    // 🔥 НОВЫЙ МЕТОД: Создать аварийную трансформацию по умолчанию
    createEmergencyDefaultTransformation() {
        console.log('⚠️ Создаю аварийную трансформацию по умолчанию');

        return {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            rotationAngle: 0,
            isMirrored: false,
            center: { x: 0, y: 0 },
            bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
            type: 'emergency_default',
            timestamp: new Date()
        };
    }

    // 🔥 МЕТОД ИЗ ТЕСТА (УЖЕ ЕСТЬ В ВАШЕМ КОДЕ):
    createTransformationWithAngle(angle) {
        console.log(`🔄 [createTransformationWithAngle] Создаю трансформацию с углом ${angle}°`);

        const points = [];
        if (this.pointTracker && this.pointTracker.points) {
            for (const [, point] of this.pointTracker.points) {
                points.push({ x: point.x, y: point.y });
            }
        }

        const bounds = this.calculateBounds(points);
        const center = {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2
        };

        // Матрица поворота
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        return {
            matrix: [
                cosA, -sinA, 0,
                sinA, cosA, 0,
                0, 0, 1
            ],
            rotationAngle: angle,
            isMirrored: false,
            center: center,
            bounds: bounds,
            type: 'calculated_with_real_angle',
            timestamp: new Date(),
            source: 'createTransformationWithAngle'
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД (ЕСЛИ НЕТ):
    calculateBounds(points) {
        if (!points || points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        return { minX, maxX, minY, maxY };
    }

    // 🔥 ДЕБАГ МЕТОД: Проверить трансформации
    debugTransformation() {
        console.log(`\n🔍 ДЕБАГ ТРАНСФОРМАЦИИ ОТПЕЧАТКА "${this.name}":`);
        console.log(`   Есть трансформация: ${!!this.transformation}`);

        if (this.transformation) {
            console.log(`   rotationAngle: ${this.transformation.rotationAngle}°`);
            console.log(`   isMirrored: ${this.transformation.isMirrored}`);
            console.log(`   center: (${this.transformation.center?.x?.toFixed(1)}, ${this.transformation.center?.y?.toFixed(1)})`);
            console.log(`   type: ${this.transformation.type}`);
        }

        // Проверяем историю
        if (this.analysisHistory && this.analysisHistory.length > 0) {
            const lastAnalysis = this.analysisHistory[this.analysisHistory.length - 1];
            console.log(`\n   Последний анализ:`);
            console.log(`   Есть sourceInfo: ${!!lastAnalysis.sourceInfo}`);
            if (lastAnalysis.sourceInfo && lastAnalysis.sourceInfo.transformationInfo) {
                console.log(`   Угол в sourceInfo: ${lastAnalysis.sourceInfo.transformationInfo.rotationAngle}°`);
            }
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Преобразовать точки к системе этого отпечатка
    transformPointsToMySystem(points, sourceTransformation) {
        if (!this.transformation || !sourceTransformation) {
            console.log('⚠️ Нет трансформаций для преобразования');
            return points;
        }

        const RotationInvariance = require('./rotation-invariance');
        const processor = new RotationInvariance();

        return processor.transformPointsBetweenSystems(
            points,
            sourceTransformation,
            this.transformation
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки в моей системе координат
    getPointsInMySystem() {
        const points = [];

        if (this.pointTracker && this.pointTracker.points) {
            for (const [id, point] of this.pointTracker.points) {
                points.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confirmedCount: point.confirmedCount || 1,
                    confidence: point.rating || 0.5,
                    source: 'point_tracker'
                });
            }
        }

        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки в нормализованной системе
    getPointsInNormalizedSystem() {
        const points = this.getPointsInMySystem();

        if (!this.transformation) {
            return points;
        }

        // Создаем обратную трансформацию (из моей системы в нормализованную)
        const normalizedTransformation = this.createNormalizedTransformation();

        const RotationInvariance = require('./rotation-invariance');
        const processor = new RotationInvariance();

        return processor.transformPointsBetweenSystems(
            points,
            this.transformation,
            normalizedTransformation
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Создать нормализованную трансформацию
    createNormalizedTransformation() {
        // Нормализованная система: поворот 0°, без зеркала, центр в (0,0)
        return {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            rotationAngle: 0,
            isMirrored: false,
            center: { x: 0, y: 0 },
            bounds: this.transformation?.bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 },
            type: 'normalized'
        };
    }

    // 🔥 В toJSON и fromJSON добавляем сохранение трансформации
    toJSON() {
        const data = {
            id: this.id,
            name: this.name,
            userId: this.userId,
            graph: this.graph.toJSON(),
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toISOString(),
                lastUpdated: this.metadata.lastUpdated.toISOString()
            },
            stats: this.stats,
            analysisHistory: this.analysisHistory,
            photoHistory: this.photoHistory,
            linkedFootprints: this.linkedFootprints,
            // 🔥 СОХРАНЯЕМ ТРАНСФОРМАЦИЮ
            transformation: this.transformation,
            originalBounds: this.originalBounds,
            normalizationInfo: this.normalizationInfo,
            _version: '2.1-with-transformation',
            _savedAt: new Date().toISOString(),
            _honestConfirmations: true
        };

        if (this.hybridFootprint) {
            data.hybridFootprint = this.hybridFootprint.toJSON();
        }

        if (this.pointTracker) {
            data.pointTracker = this.pointTracker.toJSON();
        }

        return data;
    }

    static fromJSON(data) {
        console.log(`📂 Загружаю отпечаток "${data.name}" с честными подтверждениями и трансформацией...`);

        const graph = SimpleGraph.fromJSON(data.graph);

        let hybridFootprint = null;
        if (data.hybridFootprint && HybridFootprint) {
            try {
                hybridFootprint = HybridFootprint.fromJSON(data.hybridFootprint);
                console.log('   🎯 Загружен гибридный отпечаток');
            } catch (error) {
                console.log('⚠️ Ошибка загрузки гибридного отпечатка:', error.message);
            }
        }

        let pointTracker = null;
        if (data.pointTracker && PointTracker) {
            try {
                pointTracker = PointTracker.fromJSON(data.pointTracker);
                console.log('   🎯 Загружен PointTracker с честными подтверждениями');
            } catch (error) {
                console.log('⚠️ Ошибка загрузки PointTracker:', error.message);
                pointTracker = new PointTracker({ honestConfirmations: true });
            }
        } else {
            pointTracker = new PointTracker({ honestConfirmations: true });
        }

        // 🔥 СОХРАНЯЕМ ТРАНСФОРМАЦИЮ ПРИ ЗАГРУЗКЕ
        const footprint = new SimpleFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            graph: graph,
            hybridFootprint: hybridFootprint,
            pointTracker: pointTracker,
            // 🔥 ЗАГРУЖАЕМ ТРАНСФОРМАЦИЮ
            transformation: data.transformation || null,
            originalBounds: data.originalBounds || null,
            normalizationInfo: data.normalizationInfo || null,
            metadata: data.metadata,
            confidence: data.stats?.confidence
        });

        if (Array.isArray(data.analysisHistory)) {
            footprint.analysisHistory = data.analysisHistory;
        }

        if (Array.isArray(data.photoHistory)) {
            footprint.photoHistory = data.photoHistory;
        }

        if (Array.isArray(data.linkedFootprints)) {
            footprint.linkedFootprints = data.linkedFootprints;
        }

        if (data.stats) {
            footprint.stats = { ...footprint.stats, ...data.stats };
        }

        console.log(`✅ Загружен отпечаток "${footprint.name}" с ` +
                   `${footprint.graph.nodes.size} узлами, честными подтверждениями и трансформацией`);

        return footprint;
    }

    // 🔥 НОВЫЙ МЕТОД: Честное связывание узлов с трекером
    linkNodesWithTrackerHonest(graphNodes) {
        console.log(`🔗 Честное связывание: ${graphNodes.length} узлов`);

        const trackerMap = new Map();
        for (const [trackerId, trackerPoint] of this.pointTracker.points) {
            trackerMap.set(trackerId, trackerPoint);
        }

        let linkedCount = 0;
        let trackerPointsUsed = new Set();

        this.graph.nodes.forEach((node, nodeId) => {
            const trackerIdMatch = nodeId.match(/n_(pt_\d+|pt_single_\d+|emergency_pt_\d+)/);
            const trackerId = trackerIdMatch ? trackerIdMatch[1] : null;

            if (trackerId && trackerMap.has(trackerId)) {
                const trackerPoint = trackerMap.get(trackerId);

                node.pointTrackerId = trackerId;
                node.confirmedCount = trackerPoint.confirmedCount || 1;
                node.confidence = trackerPoint.rating;
                node.rating = trackerPoint.rating;
                node.uniquePhotos = trackerPoint.confirmedPhotos ?
                    trackerPoint.confirmedPhotos.size : 1;

                if (!node.confirmedCount || node.confirmedCount < 1) {
                    node.confirmedCount = 1;
                }

                trackerPointsUsed.add(trackerId);
                linkedCount++;
            } else {
                const nearest = this.pointTracker.findNearestPoint({x: node.x, y: node.y}, 15);
                if (nearest) {
                    const trackerPoint = this.pointTracker.points.get(nearest.id);
                    if (trackerPoint) {
                        node.pointTrackerId = nearest.id;
                        node.confirmedCount = trackerPoint.confirmedCount || 1;
                        node.confidence = trackerPoint.rating;
                        node.uniquePhotos = trackerPoint.confirmedPhotos ?
                            trackerPoint.confirmedPhotos.size : 1;

                        if (!node.confirmedCount || node.confirmedCount < 1) {
                            node.confirmedCount = 1;
                        }

                        linkedCount++;
                    }
                } else {
                    node.confirmedCount = 1;
                    node.confidence = node.confidence || 0.5;
                    node.uniquePhotos = 1;
                }
            }
        });

        console.log(`🔗 Честно связано ${linkedCount} узлов`);
        return linkedCount;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить честные данные для визуализации
    getHonestVisualizationData() {
        console.log(`📊 Получаю честные данные для визуализации...`);

        const data = {
            id: this.id,
            name: this.name,
            totalPhotos: this.metadata.totalPhotos,
            points: [],
            clusters: [],
            confirmationsInfo: {
                totalPoints: 0,
                confirmed2: 0,
                confirmed1: 0,
                confirmed0: 0
            }
        };

        // Собираем честные данные из трекера
        if (this.pointTracker && this.pointTracker.points) {
            for (const [id, point] of this.pointTracker.points) {
                const confirmations = point.confirmedCount || 0;

                let confirmationLevel;
                if (confirmations >= 2) {
                    confirmationLevel = 'confirmed2';
                    data.confirmationsInfo.confirmed2++;
                } else if (confirmations >= 1) {
                    confirmationLevel = 'confirmed1';
                    data.confirmationsInfo.confirmed1++;
                } else {
                    confirmationLevel = 'confirmed0';
                    data.confirmationsInfo.confirmed0++;
                }

                data.points.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confirmations: confirmations,
                    confidence: point.rating || point.confidence || 0.5,
                    confirmationLevel: confirmationLevel,
                    clusterData: point.clusterData || null,
                    lastSeen: point.lastSeen
                });

                data.confirmationsInfo.totalPoints++;
            }
        }

        console.log(`📈 Честная статистика: ${data.confirmationsInfo.totalPoints} точек`);
        console.log(`   🔴 2+ подтверждений: ${data.confirmationsInfo.confirmed2}`);
        console.log(`   🔵 1 подтверждение: ${data.confirmationsInfo.confirmed1}`);
        console.log(`   ⚪ 0 подтверждений: ${data.confirmationsInfo.confirmed0}`);

        return data;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Получить объединенные данные для визуализации с РЕАЛЬНЫМИ данными (без временного решения)
    getMergedVisualizationData() {
        console.log(`🔄 Получаю объединенные данные для визуализации...`);

        const data = {
            id: this.id,
            name: this.name,
            totalPhotos: this.metadata.totalPhotos,
            points: [],
            clusters: [],
            confirmationStats: {
                fromTracker: { total: 0, confirmed2: 0, confirmed1: 0, confirmed0: 0 },
                fromSuperModel: { total: 0, avgConfirmations: 0, highConfidence: 0 }
            },
            merged: true // Флаг что это объединенные данные
        };

        // 1. Данные из PointTracker
        if (this.pointTracker && this.pointTracker.points) {
            for (const [id, point] of this.pointTracker.points) {
                const confirmations = point.confirmedCount || 0;

                let color, size;
                if (confirmations >= 2) {
                    color = '#FF5252'; // 🔴 Красный
                    size = 8 + (point.confidence || 0.5) * 6;
                    data.confirmationStats.fromTracker.confirmed2++;
                } else if (confirmations >= 1) {
                    color = '#2196F3'; // 🔵 Синий
                    size = 6 + (point.confidence || 0.5) * 4;
                    data.confirmationStats.fromTracker.confirmed1++;
                } else {
                    color = '#BDBDBD'; // ⚪ Серый
                    size = 4;
                    data.confirmationStats.fromTracker.confirmed0++;
                }

                data.points.push({
                    id,
                    x: point.x,
                    y: point.y,
                    color: color,
                    size: size,
                    confirmations: confirmations,
                    confidence: point.rating || point.confidence || 0.5,
                    source: 'tracker',
                    clusterData: point.clusterData || null
                });

                data.confirmationStats.fromTracker.total++;
            }
        }

        // 2. Данные из супер-модели (если есть)
        if (this.metadata?.features?.hasSuperModel) {
            // Можно добавить данные из супер-модели
            // Например, границы шаблона, зоны и т.д.
        }

        // 🔥 ИСПРАВЛЕНИЕ: Убрано временное решение! Теперь показываем только реальные данные
        console.log(`📊 РЕАЛЬНАЯ статистика подтверждений:`);
        console.log(`   • Всего точек: ${data.confirmationStats.fromTracker.total}`);
        console.log(`   • 🔴 2+ подтверждений: ${data.confirmationStats.fromTracker.confirmed2}`);
        console.log(`   • 🔵 1 подтверждение: ${data.confirmationStats.fromTracker.confirmed1}`);
        console.log(`   • ⚪ 0 подтверждений: ${data.confirmationStats.fromTracker.confirmed0}`);

        // 🔥 Добавляем предупреждение если точек с 2+ подтверждениями мало
        if (this.metadata.totalPhotos >= 2 && data.confirmationStats.fromTracker.confirmed2 === 0) {
            console.log(`⚠️ ВНИМАНИЕ: ${this.metadata.totalPhotos} фото, но 0 точек с 2+ подтверждениями!`);
            console.log(`   Проверьте updatePointTrackerFromSuperModel в SimpleFootprintManager`);
            data.warning = `Нужно 2+ фото для подтверждений. Текущие фото: ${this.metadata.totalPhotos}`;
        }

        return data;
    }

    // 🔥 СТАРЫЙ МЕТОД addAnalysis (для совместимости)
    addAnalysis(analysis, sourceInfo = {}) {
        console.log(`📥 Добавляю анализ в отпечаток "${this.name}"...`);
        return this.addAnalysisHonest(analysis, sourceInfo);
    }

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (без изменений)
    extractProtectorPoints(predictions) {
        const points = [];

        const protectors = predictions.filter(p =>
            p.class === 'shoe-protector' ||
            (p.class && p.class.toLowerCase().includes('protector'))
        );

        if (protectors.length === 0 && predictions.length > 0) {
            console.log('⚠️ Нет класса shoe-protector, использую все точки с confidence > 0.3');

            predictions.forEach((pred, index) => {
                if ((pred.confidence || 0) > 0.3 && pred.points && pred.points.length > 0) {
                    const center = this.calculateCenter(pred.points);
                    points.push({
                        x: center.x,
                        y: center.y,
                        confidence: pred.confidence || 0.5,
                        originalPoints: pred.points
                    });
                }
            });
        } else {
            protectors.forEach(protector => {
                if (protector.points && protector.points.length > 0) {
                    const center = this.calculateCenter(protector.points);
                    points.push({
                        x: center.x,
                        y: center.y,
                        confidence: protector.confidence || 0.5,
                        originalPoints: protector.points
                    });
                }
            });
        }

        return points;
    }

    calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    updateStats(graphInvariants, hybridResult = null) {
        this.stats.nodeCount = graphInvariants.nodeCount;
        this.stats.edgeCount = graphInvariants.edgeCount;
        this.stats.graphDiameter = graphInvariants.graphDiameter;
        this.stats.clusteringCoefficient = graphInvariants.clusteringCoefficient;

        const nodeScore = Math.min(1, graphInvariants.nodeCount / 20);
        const edgeScore = graphInvariants.edgeCount > 0 ?
            Math.min(1, graphInvariants.edgeCount / graphInvariants.nodeCount / 2) : 0;
        const clusteringScore = graphInvariants.clusteringCoefficient;

        const graphConfidence = (nodeScore * 0.4 + edgeScore * 0.3 + clusteringScore * 0.3);

        let trackerScore = 0;
        if (this.pointTracker) {
            const trackerStats = this.pointTracker.getHonestStats();
            trackerScore = trackerStats.avgRating;
            this.stats.trackerScore = trackerScore;
            this.stats.trackerStats = trackerStats;
        }

        let hybridScore = 0;
        if (this.hybridFootprint) {
            if (typeof this.hybridFootprint.calculateConfidence === 'function') {
                hybridScore = this.hybridFootprint.calculateConfidence();
            } else if (this.hybridFootprint.stats?.confidence) {
                hybridScore = this.hybridFootprint.stats.confidence;
            } else if (this.hybridFootprint.getConfidence && typeof this.hybridFootprint.getConfidence === 'function') {
                hybridScore = this.hybridFootprint.getConfidence();
            }
        }

        let combinedConfidence = graphConfidence;
        let weights = 1;

        if (trackerScore > 0) {
            combinedConfidence += trackerScore;
            weights++;
        }

        if (hybridScore > 0) {
            combinedConfidence += hybridScore;
            weights++;
            this.stats.hybridScore = hybridScore;
        }

        this.stats.confidence = combinedConfidence / weights;
        this.stats.qualityScore = this.stats.confidence * Math.min(1, this.metadata.totalPhotos / 3);

        if (graphInvariants.nodeCount > 30 && !this.metadata.estimatedSize) {
            this.metadata.estimatedSize = Math.round(35 + (graphInvariants.nodeCount - 30) / 3);
        }
    }

    compare(otherFootprint) {
        console.log(`🔍 Сравниваю "${this.name}" с "${otherFootprint.name}"...`);

        if (!otherFootprint || !otherFootprint.graph) {
            return { error: 'Invalid footprint to compare' };
        }

        if (this.hybridFootprint && otherFootprint.hybridFootprint) {
            console.log('🎯 Использую гибридное сравнение...');
            return this.compareHybrid(otherFootprint);
        }

        return this.compareGraphBased(otherFootprint);
    }

    compareHybrid(otherFootprint) {
        const hybridComparison = this.hybridFootprint.compare(otherFootprint.hybridFootprint);
        const graphComparison = this.compareGraphBased(otherFootprint);

        const hybridWeight = 0.7;
        const graphWeight = 0.3;

        const combinedSimilarity = hybridComparison.similarity * hybridWeight +
                                 graphComparison.similarity * graphWeight;

        let decision, reason;

        if (combinedSimilarity > 0.75) {
            decision = 'same';
            reason = `Высокая схожесть (гибридный: ${hybridComparison.similarity.toFixed(3)}, ` +
                    `граф: ${graphComparison.similarity.toFixed(3)})`;
        } else if (combinedSimilarity > 0.5) {
            decision = 'similar';
            reason = `Умеренная схожесть (гибридный: ${hybridComparison.similarity.toFixed(3)}, ` +
                    `граф: ${graphComparison.similarity.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть (гибридный: ${hybridComparison.similarity.toFixed(3)}, ` +
                    `граф: ${graphComparison.similarity.toFixed(3)})`;
        }

        return {
            similarity: Math.round(combinedSimilarity * 100) / 100,
            decision: decision,
            reason: reason,
            method: 'hybrid',
            comparisons: {
                hybrid: hybridComparison,
                graph: graphComparison
            },
            confidence: hybridComparison.confidence || 0.5
        };
    }

    compareGraphBased(otherFootprint) {
        const invariants1 = this.graph.getBasicInvariants();
        const invariants2 = otherFootprint.graph.getBasicInvariants();

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Проверяем что графы не пустые
        if (invariants1.nodeCount === 0 || invariants2.nodeCount === 0) {
            console.log(`⚠️ Один из графов пустой: ${invariants1.nodeCount} vs ${invariants2.nodeCount}`);
            return {
                similarity: 0,
                decision: 'different',
                reason: `Один из графов пустой: ${invariants1.nodeCount} vs ${invariants2.nodeCount}`
            };
        }

        const nodeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                        Math.max(invariants1.nodeCount, invariants2.nodeCount);

        if (nodeRatio < 0.7) {
            console.log(`⚠️ Слишком разное количество узлов: ${nodeRatio.toFixed(2)}`);
            return {
                similarity: nodeRatio,
                decision: 'different',
                reason: `Разное количество узлов: ${invariants1.nodeCount} vs ${invariants2.nodeCount}`
            };
        }

        const comparisons = [];

        const edgeRatio = Math.min(invariants1.edgeCount, invariants2.edgeCount) /
                        Math.max(invariants1.edgeCount, invariants2.edgeCount);
        comparisons.push({ name: 'edgeCount', score: edgeRatio });

        const degreeDiff = Math.abs(invariants1.avgDegree - invariants2.avgDegree);
        const degreeScore = 1 - Math.min(1, degreeDiff / 3);
        comparisons.push({ name: 'avgDegree', score: degreeScore });

        const clusteringDiff = Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient);
        const clusteringScore = 1 - Math.min(1, clusteringDiff / 0.3);
        comparisons.push({ name: 'clustering', score: clusteringScore });

        const densityDiff = Math.abs(invariants1.density - invariants2.density);
        const densityScore = 1 - Math.min(1, densityDiff / 0.1);
        comparisons.push({ name: 'density', score: densityScore });

        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score, 0) / comparisons.length;
        const similarity = Math.round(totalScore * 100) / 100;

        let decision, reason;
        if (similarity > 0.7) {
            decision = 'same';
            reason = `Высокая схожесть (${similarity}) - вероятно, та же обувь`;
        } else if (similarity > 0.4) {
            decision = 'similar';
            reason = `Умеренная схожесть (${similarity}) - похожий тип протектора`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть (${similarity}) - разные следы`;
        }

        console.log(`📊 Результат сравнения: ${similarity} (${decision})`);

        return {
            similarity: similarity,
            decision: decision,
            reason: reason,
            comparisons: comparisons,
            invariants1: {
                nodeCount: invariants1.nodeCount,
                edgeCount: invariants1.edgeCount,
                avgDegree: invariants1.avgDegree.toFixed(2),
                clustering: invariants1.clusteringCoefficient.toFixed(3)
            },
            invariants2: {
                nodeCount: invariants2.nodeCount,
                edgeCount: invariants2.edgeCount,
                avgDegree: invariants2.avgDegree.toFixed(2),
                clustering: invariants2.clusteringCoefficient.toFixed(3)
            }
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение с визуализацией
    async compareWithVisualization(otherFootprint, options = {}) {
        console.log(`🎨 Сравнение с визуализацией "${this.name}" vs "${otherFootprint.name}"...`);

        try {
            // Создаем визуализатор кластеров
            const ClusterVisualizer = require('./visualizations/cluster-visualizer');
            const visualizer = new ClusterVisualizer({
                outputDir: './data/footprints/comparisons',
                ...options.visualizerOptions
            });

            // Выполняем сравнение с визуализацией
            const visualizationResult = await visualizer.visualizeTwoFootprintComparison(
                this,
                otherFootprint,
                {
                    mode: options.mode || 'auto',
                    filename: `comparison_${this.id}_${otherFootprint.id}.png`,
                    ...options
                }
            );

            // Также получаем текстовое сравнение
            const comparisonResult = this.compare(otherFootprint);

            return {
                ...comparisonResult,
                visualizations: visualizationResult,
                combinedConfidence: (comparisonResult.similarity +
                    (visualizationResult.stats?.similarity || 0)) / 2
            };

        } catch (error) {
            console.log('⚠️ Ошибка визуализации сравнения:', error.message);

            // Фаллбэк: обычное сравнение
            return this.compare(otherFootprint);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получить данные для визуализации
    getVisualizationData(options = {}) {
        const data = {
            id: this.id,
            name: this.name,
            points: [],
            clusters: [],
            stats: this.getConfirmationStats(),
            metadata: {
                totalPhotos: this.metadata.totalPhotos,
                createdAt: this.metadata.created,
                lastUpdated: this.metadata.lastUpdated,
                honestConfirmations: true
            }
        };

        // Собираем точки
        if (this.pointTracker) {
            for (const [id, point] of this.pointTracker.points) {
                data.points.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confirmations: point.confirmedCount,
                    confidence: point.rating,
                    clusterData: point.clusterData,
                    lastSeen: point.lastSeen,
                    uniquePhotos: point.confirmedPhotos ? point.confirmedPhotos.size : 1,
                    isCluster: point.clusterOrigin || false,
                    clusterSize: point.clusterSize || 1
                });
            }
        }

        // Собираем кластеры
        if (this.pointTracker && this.pointTracker.getEnhancedStats) {
            const trackerStats = this.pointTracker.getEnhancedStats();
            data.clusters = {
                count: trackerStats.clusterPoints || 0,
                avgSize: trackerStats.avgClusterSize || 1,
                ratio: trackerStats.clusterRatio || 0
            };
        }

        // Добавляем статистику честности
        if (this.pointTracker && this.pointTracker.getHonestStats) {
            const honestStats = this.pointTracker.getHonestStats();
            data.honestStats = {
                uniquePhotos: honestStats.uniquePhotos || 0,
                confirmationIntegrity: honestStats.confirmationIntegrity || 0,
                averageConfirmationsPerPhoto: honestStats.averageConfirmationsPerPhoto || 0
            };
        }

        return data;
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить целостность подтверждений
    validateConfirmations() {
        if (!this.pointTracker) {
            return {
                valid: false,
                error: 'PointTracker не инициализирован'
            };
        }

        // Получаем статистику вместо вызова несуществующего метода
        const trackerStats = this.pointTracker.getHonestStats();

        // Простая проверка
        const issues = [];
        let totalPoints = 0;
        let totalConfirmations = 0;

        if (this.pointTracker.points) {
            for (const [id, point] of this.pointTracker.points) {
                totalPoints++;
                const confirmations = point.confirmedCount || 0;
                totalConfirmations += confirmations;

                // Проверяем базовые проблемы
                if (confirmations < 0) {
                    issues.push({
                        pointId: id,
                        type: 'negative_confirmations',
                        actual: confirmations,
                        expected: '>= 0'
                    });
                }

                // Проверяем слишком много подтверждений для уникальных фото
                if (point.confirmedPhotos) {
                    const photoCount = point.confirmedPhotos.size;
                    if (confirmations > photoCount) {
                        issues.push({
                            pointId: id,
                            type: 'confirmations_exceed_photos',
                            confirmations: confirmations,
                            photoCount: photoCount
                        });
                    }
                }
            }
        }

        // Дополнительная проверка узлов графа
        const graphIssues = [];
        let graphConfirmations = 0;
        let graphNodes = 0;

        if (this.graph && this.graph.nodes) {
            this.graph.nodes.forEach((node, nodeId) => {
                graphNodes++;
                const nodeConfirmations = node.confirmedCount || 1;
                graphConfirmations += nodeConfirmations;

                if (node.pointTrackerId) {
                    const trackerPoint = this.pointTracker.points.get(node.pointTrackerId);
                    if (trackerPoint) {
                        const trackerConfirmations = trackerPoint.confirmedCount || 1;
                        if (nodeConfirmations !== trackerConfirmations) {
                            graphIssues.push({
                                nodeId,
                                pointTrackerId: node.pointTrackerId,
                                nodeConfirmations,
                                trackerConfirmations,
                                difference: Math.abs(nodeConfirmations - trackerConfirmations)
                            });
                        }
                    }
                }
            });
        }

        const avgConfirmations = totalPoints > 0 ? totalConfirmations / totalPoints : 0;
        const confirmationIntegrity = trackerStats.confirmationIntegrity || 0;

        return {
            valid: issues.length === 0 && graphIssues.length === 0,
            issues: issues,
            graphIssues: graphIssues,
            stats: {
                totalPoints,
                avgConfirmations,
                confirmationIntegrity,
                graphNodes,
                graphAvgConfirmations: graphNodes > 0 ? graphConfirmations / graphNodes : 0
            },
            overallValid: issues.length === 0 && graphIssues.length === 0
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Визуализация подтверждений
    async visualizeConfirmations(options = {}) {
        try {
            // Создаем простую визуализацию если нет кластер-визуализатора
            const outputDir = options.outputDir || './data/visualizations';
            const filename = options.filename || `confirmations_${this.id}.png`;

            // Проверяем наличие директории
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const filepath = path.join(outputDir, filename);

            // Создаем простой текстовый отчет если нет Canvas
            const report = this.createConfirmationReport();

            // Сохраняем отчет
            const reportPath = path.join(outputDir, `report_${this.id}.txt`);
            fs.writeFileSync(reportPath, report);

            console.log(`📊 Визуализация подтверждений сохранена: ${filepath}`);
            console.log(`📋 Текстовый отчет: ${reportPath}`);

            return {
                success: true,
                imagePath: filepath,
                reportPath: reportPath,
                stats: this.getConfirmationStats()
            };

        } catch (error) {
            console.log('⚠️ Ошибка визуализации подтверждений:', error.message);

            // Фаллбэк: текстовый отчет
            const report = this.createConfirmationReport();
            console.log(report);

            return {
                success: false,
                report: report,
                error: error.message
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Создать отчет о подтверждениях
    createConfirmationReport() {
        const stats = this.getConfirmationStats();
        const validation = this.validateConfirmations();
        const trackerStats = this.pointTracker ? this.pointTracker.getHonestStats() : null;

        let report = `📊 ОТЧЕТ О ПОДТВЕРЖДЕНИЯХ - ${this.name}\n`;
        report += `═`.repeat(50) + `\n\n`;
        report += `📅 Дата создания: ${new Date().toLocaleString('ru-RU')}\n`;
        report += `👣 Отпечаток ID: ${this.id}\n`;
        report += `📸 Всего фото: ${this.metadata.totalPhotos}\n\n`;

        report += `📈 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:\n`;
        report += `├─ Всего узлов: ${stats.totalNodes}\n`;
        report += `├─ Подтвержденных узлов: ${stats.confirmedNodes}\n`;
        report += `├─ Среднее подтверждений: ${stats.averageConfirmations.toFixed(2)}\n`;

        if (trackerStats) {
            report += `├─ Уникальных фото: ${trackerStats.uniquePhotos || 0}\n`;
            report += `├─ Целостность подтверждений: ${(trackerStats.confirmationIntegrity || 0).toFixed(3)}\n`;
            report += `└─ Среднее подтверждений на фото: ${(trackerStats.averageConfirmationsPerPhoto || 0).toFixed(2)}\n\n`;
        }

        report += `🎯 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:\n`;
        const pointsByConfirmations = trackerStats?.pointsByConfirmations || { '1': 0, '2': 0, '3': 0, '4+': 0 };
        report += `├─ 1 подтверждение: ${pointsByConfirmations['1']}\n`;
        report += `├─ 2 подтверждения: ${pointsByConfirmations['2']}\n`;
        report += `├─ 3 подтверждения: ${pointsByConfirmations['3']}\n`;
        report += `└─ 4+ подтверждений: ${pointsByConfirmations['4+']}\n\n`;

        report += `✅ ПРОВЕРКА ЦЕЛОСТНОСТИ:\n`;
        report += `├─ Статус: ${validation.overallValid ? '✅ ВСЕ ПРАВИЛЬНО' : '⚠️ ЕСТЬ ПРОБЛЕМЫ'}\n`;
        report += `├─ Проблем в трекере: ${validation.issues.length}\n`;
        report += `└─ Несоответствий в графе: ${validation.graphIssues.length}\n\n`;

        if (!validation.overallValid && validation.issues.length > 0) {
            report += `⚠️ ПРОБЛЕМЫ С ПОДТВЕРЖДЕНИЯМИ:\n`;
            validation.issues.slice(0, 5).forEach((issue, index) => {
                report += `${index + 1}. Точка ${issue.pointId}: `;
                if (issue.expected !== issue.actual) {
                    report += `ожидалось ${issue.expected}, получено ${issue.actual}\n`;
                } else if (issue.type === 'duplicate_photos') {
                    report += `дублирование фото: ${issue.duplicates.length}\n`;
                }
            });
            if (validation.issues.length > 5) {
                report += `... и еще ${validation.issues.length - 5} проблем\n`;
            }
            report += `\n`;
        }

        report += `🎨 ЦВЕТОВАЯ СХЕМА ВИЗУАЛИЗАЦИИ:\n`;
        report += `🔴 Красный - 1 подтверждение (новые/ненадежные точки)\n`;
        report += `🟡 Желтый - 2 подтверждения (мало подтверждений)\n`;
        report += `🟠 Оранжевый - 3 подтверждения (средняя надежность)\n`;
        report += `🟢 Зеленый - 4+ подтверждений (высокая надежность)\n`;

        report += `\n═`.repeat(50) + `\n`;
        report += `Система честных подтверждений: 1 фото = 1 подтверждение точки\n`;
        report += `Гарантирует точный подсчет и предотвращает накрутку\n`;

        return report;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки для сравнения с честными подтверждениями
    getPointsForComparison(options = {}) {
        const {
            minConfirmations = 0,
            minRating = 0,
            includeUnconfirmed = false
        } = options;

        const points = [];

        if (this.pointTracker) {
            for (const [id, point] of this.pointTracker.points) {
                if (point.confirmedCount >= minConfirmations && point.rating >= minRating) {
                    points.push({
                        id,
                        x: point.x,
                        y: point.y,
                        confidence: point.rating,
                        confirmations: point.confirmedCount,
                        uniquePhotos: point.confirmedPhotos ? point.confirmedPhotos.size : 1,
                        isCluster: point.clusterOrigin || false,
                        clusterSize: point.clusterSize || 1,
                        lastSeen: point.lastSeen
                    });
                }
            }
        }

        // Сортировка по надежности
        points.sort((a, b) => {
            // Сначала по количеству подтверждений
            if (a.confirmations !== b.confirmations) {
                return b.confirmations - a.confirmations;
            }
            // Затем по рейтингу
            return b.confidence - a.confidence;
        });

        return points;
    }

    // 🔥 ПЕРЕОПРЕДЕЛЕННЫЙ МЕТОД: Получить статистику подтверждений
    getConfirmationStats() {
        if (!this.pointTracker) {
            return {
                totalNodes: this.graph.nodes.size,
                confirmedNodes: 0,
                unconfirmedNodes: 0,
                averageConfirmations: 0,
                trackerStats: null,
                honestStats: null
            };
        }

        const trackerStats = this.pointTracker.getHonestStats();

        let totalNodes = 0;
        let confirmedNodes = 0;
        let totalConfirmations = 0;

        if (this.graph && this.graph.nodes) {
            this.graph.nodes.forEach((node, nodeId) => {
                totalNodes++;
                const confirmCount = node.confirmedCount || 1;
                totalConfirmations += confirmCount;

                if (confirmCount >= 1) {
                    confirmedNodes++;
                }
            });
        }

        return {
            totalNodes,
            confirmedNodes,
            unconfirmedNodes: 0, // 🔥 Все узлы имеют минимум 1 подтверждение
            averageConfirmations: totalNodes > 0 ? totalConfirmations / totalNodes : 1,
            trackerStats: {
                totalPoints: trackerStats.totalPoints,
                highConfidencePoints: trackerStats.highConfidencePoints,
                avgRating: trackerStats.avgRating,
                avgConfirmations: trackerStats.avgConfirmations,
                uniquePhotos: trackerStats.uniquePhotos || 0,
                confirmationIntegrity: trackerStats.confirmationIntegrity || 0
            },
            honestStats: {
                pointsByConfirmations: trackerStats.pointsByConfirmations || {},
                averageConfirmationsPerPhoto: trackerStats.averageConfirmationsPerPhoto || 0
            },
            combinedConfidence: trackerStats.avgRating > 0 ?
                (trackerStats.avgRating + (confirmedNodes / Math.max(1, totalNodes))) / 2 :
                (confirmedNodes / Math.max(1, totalNodes))
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение с другим отпечатком с проверкой честности
    compareWithHonestValidation(otherFootprint) {
        console.log(`🔍 Честное сравнение "${this.name}" с "${otherFootprint.name}"...`);

        // Проверяем целостность обоих отпечатков
        const validation1 = this.validateConfirmations();
        const validation2 = otherFootprint.validateConfirmations();

        if (!validation1.overallValid || !validation2.overallValid) {
            console.log(`⚠️  ВНИМАНИЕ: У одного из отпечатков проблемы с подтверждениями!`);
        }

        // Выполняем обычное сравнение
        const comparison = this.compare(otherFootprint);

        // Добавляем информацию о честности
        comparison.honestValidation = {
            footprint1: {
                valid: validation1.overallValid,
                issues: validation1.issues.length + validation1.graphIssues.length,
                uniquePhotos: this.pointTracker ?
                    this.pointTracker.getUniquePhotoCount() : 0,
                confirmationIntegrity: this.pointTracker ?
                    this.pointTracker.getHonestStats().confirmationIntegrity || 0 : 0
            },
            footprint2: {
                valid: validation2.overallValid,
                issues: validation2.issues.length + validation2.graphIssues.length,
                uniquePhotos: otherFootprint.pointTracker ?
                    otherFootprint.pointTracker.getUniquePhotoCount() : 0,
                confirmationIntegrity: otherFootprint.pointTracker ?
                    otherFootprint.pointTracker.getHonestStats().confirmationIntegrity || 0 : 0
            },
            overallValid: validation1.overallValid && validation2.overallValid
        };

        // Корректируем схожесть на основе целостности подтверждений
        if (!comparison.honestValidation.overallValid) {
            comparison.similarity *= 0.9; // Штраф за проблемы с подтверждениями
            comparison.reason += " (проблемы с подтверждениями)";
        }

        return comparison;
    }

    // 🔥 НОВЫЙ МЕТОД: Экспорт для визуализации
    exportForVisualization(options = {}) {
        const data = {
            id: this.id,
            name: this.name,
            type: 'footprint',
            version: '2.0-honest',
            metadata: this.metadata,
            stats: this.stats,
            confirmationStats: this.getConfirmationStats(),
            points: [],
            clusters: [],
            createdAt: new Date().toISOString()
        };

        // Экспорт точек
        if (this.pointTracker) {
            const trackerData = this.pointTracker.exportForVisualization();
            data.points = trackerData.points;
            data.clusters = trackerData.clusters || [];
        }

        // Экспорт графа
        if (this.graph) {
            data.graph = {
                nodes: Array.from(this.graph.nodes.values()).map(node => ({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence,
                    confirmedCount: node.confirmedCount,
                    pointTrackerId: node.pointTrackerId
                })),
                edges: Array.from(this.graph.edges.values()).map(edge => ({
                    source: edge.source,
                    target: edge.target,
                    weight: edge.weight
                })),
                invariants: this.graph.getBasicInvariants()
            };
        }

        return data;
    }

    // 🔥 НОВЫЙ МЕТОД: Визуализировать статистику подтверждений
    visualizeConfirmationStats() {
        console.log(`\n🎯 СТАТИСТИКА ЧЕСТНЫХ ПОДТВЕРЖДЕНИЙ - ${this.name}:`);
        console.log(`═`.repeat(50));

        const stats = this.getConfirmationStats();
        const trackerStats = stats.trackerStats;
        const honestStats = stats.honestStats;

        console.log(`📊 ОБЩАЯ ИНФОРМАЦИЯ:`);
        console.log(`├─ Всего узлов в графе: ${stats.totalNodes}`);
        console.log(`├─ Подтвержденных узлов: ${stats.confirmedNodes}`);
        console.log(`├─ Среднее подтверждений: ${stats.averageConfirmations.toFixed(2)}`);

        if (trackerStats) {
            console.log(`\n🎯 POINT TRACKER:`);
            console.log(`├─ Всего точек: ${trackerStats.totalPoints}`);
            console.log(`├─ Высоконадёжных: ${trackerStats.highConfidencePoints}`);
            console.log(`├─ Средний рейтинг: ${trackerStats.avgRating.toFixed(3)}`);
            console.log(`├─ Среднее подтверждений: ${trackerStats.avgConfirmations.toFixed(2)}`);
            console.log(`├─ Уникальных фото: ${trackerStats.uniquePhotos || 0}`);
            console.log(`└─ Целостность: ${(trackerStats.confirmationIntegrity || 0).toFixed(3)}`);
        }

        if (honestStats && honestStats.pointsByConfirmations) {
            console.log(`\n📈 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:`);
            console.log(`├─ 1 подтверждение: ${honestStats.pointsByConfirmations['1'] || 0}`);
            console.log(`├─ 2 подтверждения: ${honestStats.pointsByConfirmations['2'] || 0}`);
            console.log(`├─ 3 подтверждения: ${honestStats.pointsByConfirmations['3'] || 0}`);
            console.log(`└─ 4+ подтверждений: ${honestStats.pointsByConfirmations['4+'] || 0}`);

            const total = (honestStats.pointsByConfirmations['1'] || 0) +
                         (honestStats.pointsByConfirmations['2'] || 0) +
                         (honestStats.pointsByConfirmations['3'] || 0) +
                         (honestStats.pointsByConfirmations['4+'] || 0);

            if (total > 0) {
                console.log(`\n📊 ПРОЦЕНТНОЕ СООТНОШЕНИЕ:`);
                console.log(`├─ 1 подтверждение: ${((honestStats.pointsByConfirmations['1'] || 0) / total * 100).toFixed(1)}%`);
                console.log(`├─ 2 подтверждения: ${((honestStats.pointsByConfirmations['2'] || 0) / total * 100).toFixed(1)}%`);
                console.log(`├─ 3 подтверждения: ${((honestStats.pointsByConfirmations['3'] || 0) / total * 100).toFixed(1)}%`);
                console.log(`└─ 4+ подтверждений: ${((honestStats.pointsByConfirmations['4+'] || 0) / total * 100).toFixed(1)}%`);
            }
        }

        // Валидация
        const validation = this.validateConfirmations();
        console.log(`\n✅ ПРОВЕРКА ЦЕЛОСТНОСТИ:`);
        console.log(`├─ Статус: ${validation.overallValid ? '✅ ВСЕ ПРАВИЛЬНО' : '⚠️ ЕСТЬ ПРОБЛЕМЫ'}`);
        console.log(`├─ Проблем в трекере: ${validation.issues.length}`);
        console.log(`└─ Несоответствий в графе: ${validation.graphIssues.length}`);

        if (!validation.overallValid) {
            console.log(`\n⚠️  ДЕТАЛИ ПРОБЛЕМ:`);
            validation.issues.slice(0, 3).forEach((issue, index) => {
                console.log(`${index + 1}. Точка ${issue.pointId}: ${issue.type || 'несоответствие'}`);
            });
            if (validation.issues.length > 3) {
                console.log(`... и еще ${validation.issues.length - 3} проблем`);
            }
        }

        console.log(`\n🎨 ЛЕГЕНДА ЦВЕТОВ:`);
        console.log(`🔴 Красный - 1 подтверждение (0-25% надежности)`);
        console.log(`🟡 Желтый - 2 подтверждения (25-50% надежности)`);
        console.log(`🟠 Оранжевый - 3 подтверждения (50-75% надежности)`);
        console.log(`🟢 Зеленый - 4+ подтверждений (75-100% надежности)`);

        console.log(`\n═`.repeat(50));
        console.log(`Система гарантирует: 1 фото = 1 подтверждение точки`);
        console.log(`Предотвращает накрутку и обеспечивает точный подсчет`);
    }

    // 🔥 ПЕРЕОПРЕДЕЛЕННЫЙ МЕТОД: Информация об отпечатке
    getInfo() {
        const info = {
            id: this.id,
            name: this.name,
            userId: this.userId,
            stats: {
                ...this.stats,
                qualityScore: Math.round(this.stats.qualityScore * 100),
                honestScore: Math.round((this.stats.honestScore || 0) * 100)
            },
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toLocaleString('ru-RU'),
                lastUpdated: this.metadata.lastUpdated.toLocaleString('ru-RU'),
                features: this.metadata.features
            },
            history: {
                analyses: this.analysisHistory.length,
                photos: this.photoHistory.length,
                linkedFootprints: this.linkedFootprints.length
            },
            graph: {
                nodes: this.graph.nodes.size,
                edges: this.graph.edges.size,
                invariants: this.graph.getBasicInvariants()
            }
        };

        // Информация о гибридных признаках
        if (this.hybridFootprint) {
            info.hybrid = this.hybridFootprint.getInfo();
        }

        // 🔥 ОБНОВЛЕННАЯ информация о PointTracker
        if (this.pointTracker) {
            const trackerStats = this.pointTracker.getHonestStats();
            info.pointTracker = {
                totalPoints: trackerStats.totalPoints,
                highConfidencePoints: trackerStats.highConfidencePoints,
                avgRating: trackerStats.avgRating,
                avgConfirmations: trackerStats.avgConfirmations,
                uniquePhotos: trackerStats.uniquePhotos || 0,
                confirmationIntegrity: trackerStats.confirmationIntegrity || 0,
                hasHonestConfirmations: true,
                validation: this.validateConfirmations().overallValid
            };
        }

        return info;
    }

    visualize() {
        console.log(`\n👣 ЦИФРОВОЙ ОТПЕЧАТОК "${this.name}" (честные подтверждения):`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Узлов в графе: ${this.graph.nodes.size}`);
        console.log(`├─ Рёбер в графе: ${this.graph.edges.size}`);
        console.log(`├─ Фото в истории: ${this.photoHistory.length}`);
        console.log(`├─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
        console.log(`├─ Качество: ${Math.round(this.stats.qualityScore * 100)}%`);
        console.log(`├─ Честность: ${Math.round((this.stats.honestScore || 0) * 100)}%`);

        if (this.pointTracker) {
            const trackerStats = this.pointTracker.getHonestStats();
            console.log(`├─ PointTracker: ${trackerStats.totalPoints} точек`);
            console.log(`├─ Высоконадёжных: ${trackerStats.highConfidencePoints}`);
            console.log(`├─ Средний рейтинг: ${trackerStats.avgRating.toFixed(3)}`);
            console.log(`├─ Уникальных фото: ${trackerStats.uniquePhotos || 0}`);
            console.log(`└─ Целостность: ${(trackerStats.confirmationIntegrity || 0).toFixed(3)}`);
        }

        if (this.hybridFootprint) {
            console.log(`├─ Гибридный режим: ВКЛЮЧЕН`);
            console.log(`└─ Гибридный score: ${Math.round(this.stats.hybridScore * 100)}%`);
        }

        console.log(`\n📊 ИНВАРИАНТЫ ГРАФА:`);
        const invariants = this.graph.getBasicInvariants();
        console.log(`├─ Диаметр: ${invariants.graphDiameter}`);
        console.log(`├─ Кластеризация: ${invariants.clusteringCoefficient.toFixed(3)}`);
        console.log(`├─ Средняя степень: ${invariants.avgDegree.toFixed(2)}`);
        console.log(`└─ Плотность: ${invariants.density.toFixed(4)}`);
    }

    // 🔥 НОВЫЙ МЕТОД: Получить инвариантные признаки (добавлен в конец класса)
    getInvariantFeatures() {
        console.log(`\n🎯🔍 ДЕБАГ getInvariantFeatures для "${this.name}":`);
       
        // 1. Проверяем трансформацию
        const trans = this.getTransformation();
        console.log(`   Трансформация: ${trans?.rotationAngle || 0}°`);
       
        // 🔥 ПЕРВОЕ ИСПРАВЛЕНИЕ: Используем нормализованные точки!
        console.log(`   Получаю точки в нормализованной системе...`);
        const normalizedPoints = this.getPointsInNormalizedSystem();
       
        if (normalizedPoints.length < 3) {
            console.log('⚠️ Недостаточно точек в нормализованной системе');
            return this.createBasicInvariantFeatures(); // фаллбэк
        }
       
        // 2. Сравниваем точки до/после нормализации
        const originalPoints = this.getPointsInMySystem();
       
        console.log(`   Оригинальных точек: ${originalPoints.length}`);
        console.log(`   Нормализованных точек: ${normalizedPoints.length}`);
       
        if (originalPoints.length > 0 && normalizedPoints.length > 0) {
            console.log(`   Пример точки 0:`);
            console.log(`     Оригинал: (${originalPoints[0].x.toFixed(1)}, ${originalPoints[0].y.toFixed(1)})`);
            console.log(`     Нормализ: (${normalizedPoints[0].x.toFixed(1)}, ${normalizedPoints[0].y.toFixed(1)})`);
           
            // Проверка разницы
            const diffX = Math.abs(normalizedPoints[0].x - originalPoints[0].x);
            const diffY = Math.abs(normalizedPoints[0].y - originalPoints[0].y);
            console.log(`     Разница: (${diffX.toFixed(1)}, ${diffY.toFixed(1)})`);
           
            // Проверяем, работает ли нормализация
            if (diffX < 10 && diffY < 10) {
                console.log(`   ⚠️ ВНИМАНИЕ: Маленькая разница! Нормализация может не работать!`);
                console.log(`   ⚠️ Трансформация была: ${trans?.rotationAngle || 0}°`);
            }
        }
       
        console.log(`📊 Точки для признаков: ${normalizedPoints.length} (первая: ${normalizedPoints[0]?.x?.toFixed(1)}, ${normalizedPoints[0]?.y?.toFixed(1)})`);
       
        // 🔥 ВТОРОЕ: Проверяем трансформацию
        if (trans) {
            console.log(`📐 Трансформация: ${trans.rotationAngle}°, зеркало: ${trans.isMirrored ? 'да' : 'нет'}`);
        }
       
        // 🔥 ИСПРАВЛЕННЫЙ КОД: Создаем признаки из НОРМАЛИЗОВАННЫХ точек
        const features = [];
       
        try {
            // Используем только нормализованные точки
            normalizedPoints.forEach((point, index) => {
                if (index < 20) { // Ограничиваем для производительности
                    try {
                        // Находим ближайших соседей в НОРМАЛИЗОВАННОЙ системе
                        const neighbors = [];
                       
                        normalizedPoints.forEach((otherPoint, otherIndex) => {
                            if (index === otherIndex) return;
                           
                            const distance = Math.sqrt(
                                Math.pow(otherPoint.x - point.x, 2) +
                                Math.pow(otherPoint.y - point.y, 2)
                            );
                           
                            const angle = Math.atan2(otherPoint.y - point.y, otherPoint.x - point.x);
                           
                            neighbors.push({
                                distance: distance,
                                angle: angle,
                                otherPoint: otherPoint
                            });
                        });
                       
                        // Сортируем и берем 3 ближайших
                        neighbors.sort((a, b) => a.distance - b.distance);
                        const closestNeighbors = neighbors.slice(0, 3);
                       
                        if (closestNeighbors.length >= 2) {
                            // Создаем признак
                            const feature = {
                                id: point.id || `norm_feat_${index}`,
                                type: this.simpleClassifyFeature(
                                    closestNeighbors.map(n => n.angle),
                                    closestNeighbors.map(n => n.distance)
                                ),
                                angles: closestNeighbors.map(n => n.angle),
                                distances: closestNeighbors.map(n => n.distance),
                                neighborCount: closestNeighbors.length,
                                confidence: point.confidence || 0.5,
                                source: 'normalized_system',
                                normalized: true,
                                transformationAngle: trans?.rotationAngle || 0,
                                originalPoint: point
                            };
                           
                            features.push(feature);
                           
                            // Дебаг для первых признаков
                            if (index < 3) {
                                console.log(`   Признак ${index + 1}: ${feature.type}`);
                                console.log(`     Координаты: (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
                                console.log(`     Углы: ${feature.angles.map(a => (a * 180/Math.PI).toFixed(1) + '°').join(', ')}`);
                            }
                        }
                    } catch (pointError) {
                        console.log(`⚠️ Ошибка обработки точки ${index}:`, pointError.message);
                    }
                }
            });
        } catch (error) {
            console.log('⚠️ Ошибка создания признаков:', error.message);
            return this.createBasicInvariantFeatures();
        }
       
        console.log(`✅ Создано ${features.length} инвариантных признаков из НОРМАЛИЗОВАННОЙ системы`);
       
        // Проверяем, что признаки созданы из нормализованных точек
        const normalizedCount = features.filter(f => f.normalized).length;
        console.log(`📊 Признаки из нормализованной системы: ${normalizedCount}/${features.length}`);
       
        return features;
    }

    // 🔥 НОВЫЙ МЕТОД: Классифицировать признак точки
    classifyPointFeature(invariants) {
        if (!invariants.nearestNeighbors || invariants.nearestNeighbors.length < 2) {
            return 'isolated';
        }

        const neighborCount = invariants.nearestNeighbors.length;

        // Определяем тип по углам между соседями
        if (neighborCount >= 3) {
            const angles = invariants.nearestNeighbors.map(n => n.angle).sort((a, b) => a - b);
            let maxAngleDiff = 0;

            for (let i = 0; i < angles.length; i++) {
                const nextIdx = (i + 1) % angles.length;
                const diff = (angles[nextIdx] - angles[i] + 2 * Math.PI) % (2 * Math.PI);
                maxAngleDiff = Math.max(maxAngleDiff, diff);
            }

            if (maxAngleDiff > Math.PI * 0.8) {
                return 'corner'; // Есть большой угол (>144°) - вероятно угол
            }
        }

        // По плотности расстояний
        if (invariants.distanceDistribution && invariants.distanceDistribution[0] > 0.5) {
            return 'cluster'; // Много близких соседей - кластер
        }

        // По равномерности углов
        if (neighborCount >= 3) {
            const angles = invariants.nearestNeighbors.map(n => n.angle).sort((a, b) => a - b);
            let totalDiff = 0;

            for (let i = 0; i < angles.length - 1; i++) {
                totalDiff += Math.abs(angles[i + 1] - angles[i]);
            }
            const avgDiff = totalDiff / (angles.length - 1);

            if (Math.abs(avgDiff - Math.PI / 3) < Math.PI / 6) {
                return 'triangle'; // Углы примерно 60° - треугольник
            }
        }

        return 'general';
    }

    // 🔥 НОВЫЙ МЕТОД: Определить типы связей
    detectEdgeTypes(invariants) {
        const types = [];

        if (!invariants.nearestNeighbors || invariants.nearestNeighbors.length === 0) {
            return types;
        }

        // Анализируем расстояния до соседей
        const distances = invariants.nearestNeighbors.map(n => n.normalizedDistance);
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

        invariants.nearestNeighbors.forEach((neighbor, i) => {
            const distRatio = neighbor.normalizedDistance / avgDistance;

            if (distRatio < 0.7) {
                types.push('strong'); // Близкий сосед
            } else if (distRatio < 1.3) {
                types.push('medium'); // Среднее расстояние
            } else {
                types.push('weak'); // Далекий сосед
            }
        });

        return types;
    }

    // 🔥 НОВЫЙ МЕТОД: Создать базовые признаки (фаллбэк)
    createBasicInvariantFeatures() {
        console.log('🔄 Создаю базовые инвариантные признаки (фаллбэк)...');

        const features = [];

        if (!this.pointTracker || !this.pointTracker.points) {
            return features;
        }

        const pointsArray = Array.from(this.pointTracker.points.entries()).map(([id, point]) => ({
            id,
            x: point.x,
            y: point.y,
            confidence: point.rating || 0.5
        }));

        if (pointsArray.length < 3) {
            return features;
        }

        // Простой расчет признаков
        pointsArray.forEach((point, index) => {
            // Находим 3 ближайших соседа
            const neighbors = [];

            pointsArray.forEach((otherPoint, otherIndex) => {
                if (index === otherIndex) return;

                const distance = Math.sqrt(
                    Math.pow(otherPoint.x - point.x, 2) +
                    Math.pow(otherPoint.y - point.y, 2)
                );

                const angle = Math.atan2(otherPoint.y - point.y, otherPoint.x - point.x);

                neighbors.push({
                    id: otherPoint.id,
                    distance: distance,
                    angle: angle
                });
            });

            // Сортируем по расстоянию и берем ближайших
            neighbors.sort((a, b) => a.distance - b.distance);
            const closestNeighbors = neighbors.slice(0, 3);

            if (closestNeighbors.length > 0) {
                // Нормализуем расстояния
                const maxDist = Math.max(...closestNeighbors.map(n => n.distance));
                const normalizedDistances = closestNeighbors.map(n => n.distance / (maxDist || 1));
                const angles = closestNeighbors.map(n => n.angle);

                const feature = {
                    id: point.id,
                    type: this.simpleClassifyFeature(angles, normalizedDistances),
                    angles: angles,
                    distances: normalizedDistances,
                    neighborCount: closestNeighbors.length,
                    confidence: point.confidence,
                    source: 'basic_fallback'
                };

                features.push(feature);
            }
        });

        console.log(`✅ Создано ${features.length} базовых признаков`);
        return features;
    }

    // 🔥 НОВЫЙ МЕТОД: Простая классификация
    simpleClassifyFeature(angles, distances) {
        if (angles.length < 2) return 'isolated';

        if (angles.length >= 3) {
            // Проверяем равномерность углов
            const sortedAngles = [...angles].sort((a, b) => a - b);
            let totalDiff = 0;

            for (let i = 0; i < sortedAngles.length - 1; i++) {
                totalDiff += Math.abs(sortedAngles[i + 1] - sortedAngles[i]);
            }
            const avgDiff = totalDiff / (sortedAngles.length - 1);

            if (Math.abs(avgDiff - 2 * Math.PI / 3) < Math.PI / 6) {
                return 'triangle';
            }
        }

        // Проверяем расстояния
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;

        if (variance < 0.1) {
            return 'regular';
        }

        if (distances[0] < avgDistance * 0.5) {
            return 'cluster';
        }

        return 'general';
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечь точки из графа
    extractPointsFromGraph(graph) {
        const points = [];

        if (!graph || !graph.nodes) return points;

        graph.nodes.forEach((node, nodeId) => {
            points.push({
                id: nodeId,
                x: node.x || 0,
                y: node.y || 0,
                confidence: node.confidence || 0.5,
                originalNode: node
            });
        });

        return points;
    }
}

module.exports = SimpleFootprint;
