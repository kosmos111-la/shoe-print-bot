// modules/footprint/digital-footprint.js
// ОБНОВЛЕННАЯ ВЕРСИЯ С ТОПОЛОГИЧЕСКИМИ ИНВАРИАНТАМИ

const crypto = require('crypto');
const fs = require('fs');
// 🔥 ВРЕМЕННЫЙ ЗАГЛУШКА TopologyUtils пока не создан файл
let TopologyUtils = {
    normalizeNodes: () => ({ normalized: [], params: { center: { x: 0, y: 0 }, scale: 1, rotation: 0, meanDistance: 0 } }),
    calculateGraphInvariants: () => ({
        adjacencyMatrix: [],
        degreeDistribution: { values: [], bins: [] },
        graphDiameter: 0,
        clusteringCoefficient: 0,
        averagePathLength: 0
    }),
    calculateGeometricInvariants: () => ({
        boundingBox: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, center: { x: 0, y: 0 } },
        shapeDescriptors: { aspectRatio: 0, area: 0, compactness: 0, elongation: 0 },
        principalAxes: null
    }),
    calculateStatisticalInvariants: () => ({
        distanceHistogram: { values: [], bins: [] },
        angleHistogram: { values: [], bins: [] },
        distanceCount: 0,
        angleCount: 0
    }),
    assessTopologyQuality: () => ({
        topologyQuality: 0,
        nodeUniformity: 0,
        graphConnectivity: 0
    }),
    compareTopology: () => 0,
    compareGraphInvariants: () => 0,
    compareNormalizedGeometry: () => 0,
    checkMirrorSymmetry: () => ({ isMirrored: false, score: 0, originalDistance: 999, mirroredDistance: 999, distanceRatio: 1 }),
    countMatchedNodes: () => ({ count: 0, avgDistance: 999, matchRate: 0 }),
    calculateComparisonConfidence: () => 0,
    hungarianMatching: () => [],
    calculateCenterOfMass: (points) => ({x: 0, y: 0}),
    calculateDistance: (p1, p2) => 0,
    calculatePCA: () => null,
    buildAdjacencyMatrix: () => [],
    getDegreeDistribution: () => ({values: [], bins: []}),
    calculateGraphDiameter: () => 0,
    calculateClusteringCoefficient: () => 0,
    calculateAveragePathLength: () => 0,
    createHistogram: () => ({values: [], bins: []}),
    compareHistograms: () => 0,
    rotatePoints: (points) => points,
    scalePoints: (points) => points,
    translatePoints: (points) => points
};

// Пытаемся импортировать реальный модуль
try {
    const realUtils = require('./topology-utils');
    if (realUtils) {
        TopologyUtils = realUtils;
        console.log('✅ TopologyUtils загружен успешно');
    }
} catch (error) {
    console.log('⚠️ TopologyUtils не найден, используем заглушку');
}

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
       
        // ✅ СОХРАНЯЕМ ВСЕ КОНТУРЫ И КАБЛУКИ
        this.allContours = [];
        this.allHeels = [];

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
        this.version = '2.3'; // 🔥 Обновили версию для топологии
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

        if (nodesArray.length < 2) {
            console.log('⚠️ Недостаточно узлов для нормализации');
            return;
        }

        // Преобразуем узлы в простой формат для TopologyUtils
        const simpleNodes = nodesArray.map(node => ({
            x: node.center.x,
            y: node.center.y,
            confidence: node.confidence || 0.5,
            id: node.id,
            size: node.size || 10
        }));

        // Используем TopologyUtils для нормализации
        const result = TopologyUtils.normalizeNodes(simpleNodes);

        // Сохраняем параметры нормализации
        this.topologyInvariants.normalizationParams = result.params;

        // Сохраняем нормированные узлы
        this.topologyInvariants.normalizedNodes.clear();

        simpleNodes.forEach((node, index) => {
            const normalized = result.normalized[index];
            if (normalized) {
                this.topologyInvariants.normalizedNodes.set(node.id, {
                    x: normalized.x,
                    y: normalized.y,
                    confidence: node.confidence,
                    size: node.size * result.params.scale,
                    originalId: node.id
                });
            }
        });

        console.log(`📐 Нормализация: ${this.topologyInvariants.normalizedNodes.size} узлов`);
    }

    // 🔥 НОВЫЙ МЕТОД: Вычисление графовых инвариантов
    calculateGraphInvariants() {
        const nodesArray = Array.from(this.nodes.values());

        if (nodesArray.length === 0 || this.edges.length === 0) {
            console.log('⚠️ Нет ребер для графового анализа');
            return;
        }

        // Используем TopologyUtils
        const graphData = TopologyUtils.calculateGraphInvariants(nodesArray, this.edges);

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
        const geometryData = TopologyUtils.calculateGeometricInvariants(normalizedNodes);

        this.topologyInvariants.boundingBox = geometryData.boundingBox;
        this.topologyInvariants.shapeDescriptors = geometryData.shapeDescriptors;
        this.topologyInvariants.principalAxes = geometryData.principalAxes;

        console.log(`📏 Геометрия: ${geometryData.boundingBox.width.toFixed(3)}x${geometryData.boundingBox.height.toFixed(3)}, ` +
                   `соотношение=${geometryData.shapeDescriptors.aspectRatio.toFixed(3)}`);
    }

    // 🔥 НОВЫЙ МЕТОД: Вычисление статистических инвариантов
    calculateStatisticalInvariants() {
        const normalizedNodes = Array.from(this.topologyInvariants.normalizedNodes.values());

        if (normalizedNodes.length < 3) {
            return;
        }

        // Используем TopologyUtils
        const statsData = TopologyUtils.calculateStatisticalInvariants(normalizedNodes);

        this.topologyInvariants.distanceHistogram = statsData.distanceHistogram;
        this.topologyInvariants.angleHistogram = statsData.angleHistogram;

        console.log(`📈 Статистика: ${statsData.distanceCount} расстояний, ${statsData.angleCount} углов`);
    }

    // 🔥 НОВЫЙ МЕТОД: Оценка качества топологии
    assessTopologyQuality() {
        const nodesArray = Array.from(this.nodes.values());

        if (nodesArray.length === 0) {
            this.stats.topologyQuality = 0;
            return;
        }

        // Используем TopologyUtils
        const qualityData = TopologyUtils.assessTopologyQuality(
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

    // 🔥 НОВЫЙ МЕТОД: Улучшенное сравнение с топологической коррекцией
    compareEnhanced(otherFootprint) {
        console.log(`🔍 Запускаю УЛУЧШЕННОЕ сравнение: "${this.name}" vs "${otherFootprint.name}"`);

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

        // 📊 ВЫЧИСЛЯЕМ РАЗНЫЕ ТИПЫ СХОДСТВА

        // 1. ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ (инвариантное к искажениям)
        const topologyScore = this.compareTopology(otherFootprint);

        // 2. ГРАФОВОЕ СРАВНЕНИЕ (абсолютно инвариантное)
        const graphScore = this.compareGraphInvariants(otherFootprint);

        // 3. ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ (нормированное)
        const geometryScore = this.compareNormalizedGeometry(otherFootprint);

        // 4. ПРОВЕРКА ЗЕРКАЛЬНОСТИ
        const mirrorCheck = this.checkMirrorSymmetry(otherFootprint);

        // 🎯 ВЕСОВЫЕ КОЭФФИЦИЕНТЫ (настраиваемые)
        const WEIGHTS = {
            TOPOLOGY: 0.40,   // Самый важный - инвариантен к искажениям
            GRAPH: 0.30,      // Важный - абсолютно инвариантен
            GEOMETRY: 0.20,   // Менее важный - чувствителен к искажениям
            MIRROR_BONUS: 0.10 // Бонус за обнаружение зеркальности
        };

        // 📈 ВЫЧИСЛЯЕМ ИТОГОВУЮ ОЦЕНКУ
        let finalScore =
            topologyScore * WEIGHTS.TOPOLOGY +
            graphScore * WEIGHTS.GRAPH +
            geometryScore * WEIGHTS.GEOMETRY;

        // 🪞 КОРРЕКТИРУЕМ НА ЗЕРКАЛЬНОСТЬ
        if (mirrorCheck.isMirrored && mirrorCheck.score > 0.6) {
            // Если зеркальная версия лучше, даем бонус
            finalScore = Math.min(1.0, finalScore + WEIGHTS.MIRROR_BONUS);
        }

        // 🔍 ПОДСЧИТЫВАЕМ КОЛИЧЕСТВО СОПОСТАВЛЕННЫХ УЗЛОВ
        const matchedNodes = this.countMatchedNodes(otherFootprint);

        // 📊 ФОРМИРУЕМ РЕЗУЛЬТАТ
        const result = {
            score: Math.min(1.0, Math.max(0, finalScore)),
            matched: matchedNodes.count,
            total: Math.min(this.nodes.size, otherFootprint.nodes.size),
            details: {
                topology: topologyScore,
                graph: graphScore,
                geometry: geometryScore,
                rawScores: {
                    topology: topologyScore,
                    graph: graphScore,
                    geometry: geometryScore
                }
            },
            isMirrored: mirrorCheck.isMirrored,
            mirrorDetails: mirrorCheck,
            confidence: this.calculateComparisonConfidence(otherFootprint),
            // 🔥 Дополнительная диагностика
            diagnostic: {
                nodes1: this.nodes.size,
                nodes2: otherFootprint.nodes.size,
                normalized1: this.topologyInvariants.normalizedNodes.size,
                normalized2: otherFootprint.topologyInvariants.normalizedNodes.size,
                topologyQuality1: this.stats.topologyQuality,
                topologyQuality2: otherFootprint.stats.topologyQuality || 0
            }
        };

        // 📝 ЛОГИРУЕМ РЕЗУЛЬТАТЫ
        console.log(`\n📊 ===== РЕЗУЛЬТАТЫ СРАВНЕНИЯ =====`);
        console.log(`🎯 Итоговая оценка: ${(result.score * 100).toFixed(1)}%`);
        console.log(`📈 Детализация:`);
        console.log(`   • Топология: ${(topologyScore * 100).toFixed(1)}%`);
        console.log(`   • Граф: ${(graphScore * 100).toFixed(1)}%`);
        console.log(`   • Геометрия: ${(geometryScore * 100).toFixed(1)}%`);
        console.log(`   • Узлов сопоставлено: ${matchedNodes.count}/${result.total}`);

        if (mirrorCheck.isMirrored) {
            console.log(`   • 🪞 ЗЕРКАЛЬНАЯ ПАРА обнаружена!`);
            console.log(`     (зеркальная версия лучше на ${((mirrorCheck.mirroredDistance / mirrorCheck.originalDistance - 1) * -100).toFixed(1)}%)`);
        }

        console.log(`===================================\n`);

        return result;
    }

    // 🔥 НОВЫЙ МЕТОД: Топологическое сравнение
    compareTopology(otherFootprint) {
        const nodes1 = Array.from(this.topologyInvariants.normalizedNodes.values());
        const nodes2 = Array.from(otherFootprint.topologyInvariants.normalizedNodes.values());

        if (nodes1.length === 0 || nodes2.length === 0) {
            return 0;
        }

        // Используем TopologyUtils
        return TopologyUtils.compareTopology(nodes1, nodes2);
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение графовых инвариантов
    compareGraphInvariants(otherFootprint) {
        // Используем TopologyUtils для сравнения
        return TopologyUtils.compareGraphInvariants(
            this.topologyInvariants,
            otherFootprint.topologyInvariants
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение нормированной геометрии
    compareNormalizedGeometry(otherFootprint) {
        const nodes1 = Array.from(this.topologyInvariants.normalizedNodes.values());
        const nodes2 = Array.from(otherFootprint.topologyInvariants.normalizedNodes.values());

        if (nodes1.length === 0 || nodes2.length === 0) {
            return 0;
        }

        return TopologyUtils.compareNormalizedGeometry(
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

        return TopologyUtils.countMatchedNodes(nodes1, nodes2);
    }

    // 🔥 НОВЫЙ МЕТОД: Расчет уверенности сравнения
    calculateComparisonConfidence(otherFootprint) {
        const nodes1 = this.nodes.size;
        const nodes2 = otherFootprint.nodes.size;

        if (nodes1 === 0 || nodes2 === 0) {
            return 0;
        }

        // Используем TopologyUtils
        return TopologyUtils.calculateComparisonConfidence(
            this,
            otherFootprint
        );
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

    // ОБНОВЛЕНИЕ ЛУЧШИХ КОНТУРОВ (для обратной совместимости)
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

    // ОБНОВЛЕНИЕ ЛУЧШИХ КАБЛУКОВ (для обратной совместимости)
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

    // ПЕРЕСТРОЕНИЕ СВЯЗЕЙ (с учетом уверенности)
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

    // ✅ НОВЫЙ МЕТОД: Расчет bounding box
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

    // НОРМАЛИЗАЦИЯ ТОПОЛОГИИ
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

    // СРАВНЕНИЕ ТОПОЛОГИЙ
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

    // 🔥 НОВЫЙ МЕТОД: Получить информацию о топологии
    getTopologyInfo() {
        return {
            nodes: this.nodes.size,
            edges: this.edges.length,
            normalizedNodes: this.topologyInvariants.normalizedNodes.size,
            graphDiameter: this.topologyInvariants.graphDiameter,
            clusteringCoefficient: this.topologyInvariants.clusteringCoefficient,
            averagePathLength: this.topologyInvariants.averagePathLength,
            topologyQuality: this.stats.topologyQuality,
            isNormalized: this.topologyInvariants.normalizedNodes.size > 0,
            mirrorChecked: this.mirrorInfo.checked,
            isMirrored: this.mirrorInfo.isMirrored
        };
    }
  // 🔥 ДОБАВЛЯЕМ normalizeNodes
    static normalizeNodes(nodes) {
        console.log('🔧 TopologyUtils.normalizeNodes вызван с', nodes?.length, 'узлами');
       
        if (!nodes || nodes.length < 2) {
            console.log('⚠️ Недостаточно узлов для нормализации');
            return {
                normalized: nodes ? nodes.map(n => ({
                    x: n.x || n.center?.x || 0,
                    y: n.y || n.center?.y || 0
                })) : [],
                params: {
                    center: {x: 0, y: 0},
                    scale: 1,
                    rotation: 0,
                    meanDistance: 0
                }
            };
        }
       
        // Преобразуем узлы в простые точки
        const points = nodes.map(n => {
            // Поддерживаем разные форматы: {x, y} или {center: {x, y}}
            const x = n.x || (n.center && n.center.x) || 0;
            const y = n.y || (n.center && n.center.y) || 0;
            const confidence = n.confidence || 0.5;
            const id = n.id || `node_${Math.random().toString(36).substr(2, 9)}`;
           
            return { x, y, confidence, id, originalNode: n };
        });
       
        console.log(`📊 Исходные точки: ${points.map(p => `(${p.x},${p.y})`).join(', ')}`);
       
        // 1. ЦЕНТР МАСС
        const center = this.calculateCenterOfMass(points);
        console.log(`📍 Центр масс: (${center.x.toFixed(2)}, ${center.y.toFixed(2)})`);
       
        // 2. ЦЕНТРИРУЕМ (переносим в начало координат)
        const centered = points.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y,
            confidence: p.confidence,
            id: p.id
        }));
       
        // 3. СРЕДНЕЕ РАССТОЯНИЕ между всеми парами точек
        const distances = [];
        for (let i = 0; i < centered.length; i++) {
            for (let j = i + 1; j < centered.length; j++) {
                const dist = this.calculateDistance(centered[i], centered[j]);
                distances.push(dist);
            }
        }
       
        const meanDistance = distances.length > 0
            ? distances.reduce((sum, d) => sum + d, 0) / distances.length
            : 1;
       
        console.log(`📏 Среднее расстояние: ${meanDistance.toFixed(2)}`);
       
        // 4. МАСШТАБИРОВАНИЕ (делаем среднее расстояние = 1)
        const scale = meanDistance > 0 ? 1.0 / meanDistance : 1.0;
       
        // 5. PCA - находим главную ось для выравнивания
        const pca = this.calculatePCA(points);
        let rotationAngle = 0;
       
        if (pca && pca.eigenvectors && pca.eigenvectors[0]) {
            const principalAxis = pca.eigenvectors[0];
            // Угол главной оси относительно горизонтали
            rotationAngle = -Math.atan2(principalAxis.y, principalAxis.x);
            console.log(`🔄 Угол поворота: ${(rotationAngle * 180 / Math.PI).toFixed(1)}°`);
        }
       
        // 6. ПРИМЕНЯЕМ преобразования к каждой точке
        const normalized = centered.map(point => {
            // Масштабирование
            let x = point.x * scale;
            let y = point.y * scale;
           
            // Поворот (делаем главную ось горизонтальной)
            const cos = Math.cos(rotationAngle);
            const sin = Math.sin(rotationAngle);
            const rotatedX = x * cos - y * sin;
            const rotatedY = x * sin + y * cos;
           
            return {
                x: rotatedX,
                y: rotatedY,
                confidence: point.confidence,
                id: point.id,
                // Сохраняем оригинальные координаты для отладки
                original: { x: point.x + center.x, y: point.y + center.y }
            };
        });
       
        console.log(`🎯 Нормализовано ${normalized.length} узлов`);
        console.log(`📐 Параметры: масштаб=${scale.toFixed(4)}, поворот=${(rotationAngle * 180 / Math.PI).toFixed(1)}°`);
       
        return {
            normalized: normalized.map(n => ({ x: n.x, y: n.y })),
            fullNormalized: normalized,
            params: {
                center,
                scale,
                rotation: rotationAngle,
                meanDistance
            }
        };
    }

    // 🔥 ДОБАВЛЯЕМ compareGraphInvariants (нужен для тестов)
    static compareGraphInvariants(invariants1, invariants2) {
        console.log('🔍 TopologyUtils.compareGraphInvariants вызван');
       
        if (!invariants1 || !invariants2) {
            console.log('⚠️ Нет данных для сравнения');
            return 0.5;
        }
       
        let totalScore = 0;
        let factors = 0;
       
        // 1. Сравнение распределения степеней
        if (invariants1.degreeDistribution && invariants2.degreeDistribution) {
            const degreeScore = this.compareHistograms(
                invariants1.degreeDistribution,
                invariants2.degreeDistribution
            );
            totalScore += degreeScore * 0.4;
            factors += 0.4;
            console.log(`   • Распределение степеней: ${(degreeScore * 100).toFixed(1)}%`);
        }
       
        // 2. Сравнение диаметра графа
        if (invariants1.graphDiameter !== null && invariants2.graphDiameter !== null) {
            const diam1 = invariants1.graphDiameter;
            const diam2 = invariants2.graphDiameter;
            const maxDiam = Math.max(diam1, diam2, 1);
            const diamScore = 1 - Math.abs(diam1 - diam2) / maxDiam;
            totalScore += diamScore * 0.3;
            factors += 0.3;
            console.log(`   • Диаметр графа: ${(diamScore * 100).toFixed(1)}% (${diam1} vs ${diam2})`);
        }
       
        // 3. Сравнение коэффициента кластеризации
        if (invariants1.clusteringCoefficient !== null &&
            invariants2.clusteringCoefficient !== null) {
            const cc1 = invariants1.clusteringCoefficient;
            const cc2 = invariants2.clusteringCoefficient;
            const ccScore = 1 - Math.abs(cc1 - cc2);
            totalScore += ccScore * 0.3;
            factors += 0.3;
            console.log(`   • Коэффициент кластеризации: ${(ccScore * 100).toFixed(1)}% (${cc1.toFixed(3)} vs ${cc2.toFixed(3)})`);
        }
       
        const finalScore = factors > 0 ? totalScore / factors : 0.5;
        console.log(`   🎯 Итоговый score: ${(finalScore * 100).toFixed(1)}%`);
       
        return finalScore;
    }
}

module.exports = TopologyUtils;
