// modules/footprint/template-builder.js
// 🔥 ПЕРЕРАБОТАННЫЙ С ДИНАМИЧЕСКИМ ЭТАЛОНОМ
const SimpleGraphMatcher = require('./simple-matcher');

class TemplateBuilder {
    constructor(options = {}) {
        this.id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблон протектора';

        // 🔥 ДОБАВЛЯЕМ МАТЧЕР
        this.matcher = new SimpleGraphMatcher({
            debug: options.debug || false
        });

        // 🔥 ИНВАРИАНТНАЯ АРХИТЕКТУРА С ДИНАМИЧЕСКИМ ЭТАЛОНОМ
        this.referenceGraph = null;
        this.referenceGraphId = null;
        this.referenceGraphQuality = 0; // 🔥 ОЦЕНКА КАЧЕСТВА ЭТАЛОНА

        // 🔥 ХРАНИМ ВСЕ ГРАФЫ (не только эталон)
        this.allGraphs = new Map(); // graphId -> {graph, metadata, quality, transformation}
        this.graphQualities = new Map(); // graphId -> качество

        // 🔥 ЛУЧШИЙ ГРАФ (может меняться)
        this.bestGraphId = null;
        this.bestGraphQuality = 0;

        // 🔥 НОРМАЛИЗОВАННЫЕ ДАННЫЕ
        this.referencePoints = [];
        this.normalizedReferencePoints = [];
        this.normalizationTransform = null;

        // 🔥 ИНВАРИАНТНЫЕ ЯЧЕЙКИ (на основе относительных позиций)
        this.templateCells = new Map();
        this.cellAssignments = new Map();
        this.invariantCells = new Map();

        // 🔥 ТРАНСФОРМАЦИИ
        this.graphTransformations = new Map();
        this.alignedPoints = new Map();

        // 🔥 ТОПОЛОГИЯ ШАБЛОНА
        this.cellConnections = new Map();

        // 🔥 СТАТИСТИКА
        this.stats = {
            totalGraphs: 0,
            confirmedCells: 0,
            highConfidenceCells: 0,
            avgConfirmations: 0,
            alignmentError: 0,
            createdAt: new Date(),
            lastUpdated: new Date(),
            totalConfirmations: 0 // 🔥 ДОБАВЛЯЕМ
        };

        // 🔥 НАСТРОЙКИ С ИНВАРИАНТНОСТЬЮ И ДИНАМИЧЕСКИМ ЭТАЛОНОМ
        this.config = {
            minPointsForReference: options.minPointsForReference || 3,
            cellSize: options.cellSize || 25,
            confirmationThreshold: options.confirmationThreshold || 2,
            highConfidenceThreshold: options.highConfidenceThreshold || 3,
            maxAlignmentError: options.maxAlignmentError || 100,
            enablePCA: false,
            enableInvariantGrid: true,
            useRelativeCoordinates: true,
            debug: options.debug || false,
            enableDynamicReference: true, // 🔥 ВКЛЮЧАЕМ ДИНАМИЧЕСКИЙ ЭТАЛОН
            referenceUpdateThreshold: 1.15, // На 15% лучше
            minQualityForReference: 0.4,
            ...options
        };

        console.log(`🏗️ Создан TemplateBuilder "${this.name}" с ДИНАМИЧЕСКИМ эталоном`);
    }

    // 🔥 ДОБАВЛЕННЫЙ МЕТОД ИЗ ИНСТРУКЦИИ
    getVisualizationData() {
        const cellsArray = [];

        let totalConfirmations = 0;  // 🔥 ДОБАВИТЬ
        let totalCells = 0;          // 🔥 ДОБАВИТЬ

        for (const [cellId, cell] of this.invariantCells) {
            const confirmations = cell.confirmations || 1;  // 🔥 УБЕДИТЕСЬ, что есть значение
            totalConfirmations += confirmations;            // 🔥 СУММИРУЕМ
            totalCells++;                                   // 🔥 СЧИТАЕМ

            cellsArray.push({
                id: cellId,
                x: cell.originalCenter.x,
                y: cell.originalCenter.y,
                nx: cell.normalizedCenter.nx,
                ny: cell.normalizedCenter.ny,
                radius: cell.radius * 100,
                confirmations: confirmations,               // 🔥 ПЕРЕДАЕМ корректное значение
                confidence: cell.confidence || 0.7,
                sources: cell.sources ? Array.from(cell.sources) : [],
                pointCount: cell.points ? cell.points.length : 0,
                isHighConfidence: cell.confirmations >= this.config.highConfidenceThreshold,
                invariants: cell.invariants ? 'present' : 'none',
                isNew: cell.isNew || false, // 🔥 ДОБАВЛЯЕМ
                needsConfirmation: cell.needsConfirmation || false // 🔥 ДОБАВЛЯЕМ
            });
        }

        // 🔥 ДОБАВИТЬ правильную статистику
        return {
            templateId: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            cells: cellsArray,
            stats: {
                totalCells: totalCells,
                totalConfirmations: totalConfirmations,                // 🔥 ДОБАВИТЬ!
                averageConfirmations: totalCells > 0 ?
                    totalConfirmations / totalCells : 0,               // 🔥 ВЫЧИСЛИТЬ!
                confirmedCells: cellsArray.filter(c => c.confirmations > 1).length,
                highConfidenceCells: cellsArray.filter(c => c.confidence > 0.8).length,
                ...this.stats,
                cellCount: this.invariantCells.size,
                avgConfirmations: this.stats.avgConfirmations,
                invariantCells: this.invariantCells.size,
                referenceGraphQuality: this.referenceGraphQuality, // 🔥 ДОБАВЛЯЕМ
                bestGraphQuality: this.bestGraphQuality // 🔥 ДОБАВЛЯЕМ
            },
            referencePoints: this.normalizedReferencePoints,
            transformationsCount: this.graphTransformations.size,
            normalizationTransform: this.normalizationTransform
        };
    }

    // 🔥 ОБЕСПЕЧИВАЕМ СОВМЕСТИМУЮ НОРМАЛИЗАЦИЮ (как в инструкции)
    normalizeReferencePoints() {
        if (this.referencePoints.length === 0) return;

        const bounds = this.calculateBounds(this.referencePoints);

        // Используем ТУ ЖЕ логику, что и в SimpleMatcher
        this.normalizationTransform = {
            minX: bounds.minX,
            minY: bounds.minY,
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height)
        };

        this.normalizedReferencePoints = this.referencePoints.map(point => ({
            ...point,
            nx: (point.x - bounds.minX) / Math.max(1, bounds.width),
            ny: (point.y - bounds.minY) / Math.max(1, bounds.height),
            normalized: true
        }));

        console.log(`📐 Нормализация совместима с SimpleMatcher: ` +
                   `ширина=${bounds.width.toFixed(1)}, высота=${bounds.height.toFixed(1)}`);
    }

    calculateBounds(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
            height: Math.max(1, Math.max(...ys) - Math.min(...ys))
        };
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: Установить эталонный граф с оценкой качества
    setReferenceGraph(graph, graphId, metadata = {}) {
        console.log(`🎯 Устанавливаю эталонный граф с ДИНАМИЧЕСКИМ ЭТАЛОНОМ: ${graphId}`);

        if (!graph || !graph.nodes) {
            console.log(`❌ Граф не существует`);
            return false;
        }

        // 🔥 ОЦЕНИВАЕМ КАЧЕСТВО ГРАФА
        const quality = this.calculateGraphQuality(graph, metadata);
        console.log(`📈 Качество графа ${graphId}: ${quality.toFixed(3)}`);

        this.referenceGraph = graph;
        this.referenceGraphId = graphId;
        this.referenceGraphQuality = quality;

        // 1. Извлекаем точки
        this.referencePoints = this.extractPointsFromGraph(graph);
        console.log(`📊 Извлечено ${this.referencePoints.length} точек эталона`);

        // 2. 🔥 НОРМАЛИЗУЕМ БЕЗ ПОВРЕЖДЕНИЯ КООРДИНАТ
        this.normalizeReferencePoints();

        // 🔥 СОХРАНЯЕМ ГРАФ В КОЛЛЕКЦИИ
        this.saveGraph(graph, graphId, metadata, quality);

        // 🔥 ЭТО ПОКА ЛУЧШИЙ ГРАФ
        this.bestGraphId = graphId;
        this.bestGraphQuality = quality;

        // 3. 🔥 СОЗДАЕМ ИНВАРИАНТНУЮ СЕТКУ
        this.buildInvariantGrid();

        // 4. Сохраняем топологию
        this.extractTopologyFromGraph(graph);

        console.log(`✅ Эталон установлен с качеством ${quality.toFixed(3)} и ${this.invariantCells.size} ячейками`);
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Оценка качества графа
    calculateGraphQuality(graph, metadata = {}) {
        if (!graph || !graph.nodes) return 0;

        const nodes = Array.from(graph.nodes.values());
        const edges = Array.from(graph.edges?.values() || []);

        if (nodes.length < 5) {
            return Math.min(0.5, nodes.length / 10); // Мало точек = низкое качество
        }

        let totalScore = 0;
        let weightSum = 0;

        // 1. Количество узлов (больше = лучше, но с убывающей отдачей)
        const nodeScore = Math.min(1, nodes.length / 40); // Оптимум 40 узлов
        totalScore += nodeScore * 0.25;
        weightSum += 0.25;

        // 2. Равномерность распределения узлов
        const uniformityScore = this.calculateNodeUniformity(nodes);
        totalScore += uniformityScore * 0.20;
        weightSum += 0.20;

        // 3. Связность графа
        const connectivityScore = this.calculateConnectivityScore(nodes, edges);
        totalScore += connectivityScore * 0.20;
        weightSum += 0.20;

        // 4. Уверенность детекции (если есть в метаданных)
        const confidenceScore = this.calculateConfidenceScore(nodes, metadata);
        totalScore += confidenceScore * 0.20;
        weightSum += 0.20;

        // 5. Покрытие площади (насколько заполнена bounding box)
        const coverageScore = this.calculateCoverageScore(nodes);
        totalScore += coverageScore * 0.15;
        weightSum += 0.15;

        const finalScore = weightSum > 0 ? totalScore / weightSum : 0;

        // 🔥 БОНУС ЗА ХОРОШУЮ МЕТАДАННУЮ
        if (metadata.photoQuality && metadata.photoQuality > 0.7) {
            return Math.min(1, finalScore * 1.1); // +10% за хорошее фото
        }

        return Math.max(0, Math.min(1, finalScore));
    }

    // 🔥 НОВЫЙ МЕТОД: Сохранить граф в коллекции
    saveGraph(graph, graphId, metadata, quality) {
        const graphData = {
            id: graphId,
            graph: graph,
            metadata: metadata,
            quality: quality,
            nodeCount: graph.nodes?.size || 0,
            edgeCount: graph.edges?.size || 0,
            addedAt: new Date(),
            transformation: graph.transformation || null
        };

        this.allGraphs.set(graphId, graphData);
        this.graphQualities.set(graphId, quality);

        // 🔥 ОБНОВЛЯЕМ ЛУЧШИЙ ГРАФ ЕСЛИ НУЖНО
        if (quality > this.bestGraphQuality) {
            const oldBest = this.bestGraphId;
            this.bestGraphId = graphId;
            this.bestGraphQuality = quality;

            console.log(`🏆 НОВЫЙ ЛУЧШИЙ ГРАФ: ${graphId} (${quality.toFixed(3)})`);
            console.log(`   Было: ${oldBest || 'нет'} (${this.bestGraphQuality.toFixed(3)})`);

            // 🔥 АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ ЭТАЛОНА
            this.autoUpdateReferenceGraph(graphId);
        }

        console.log(`💾 Сохранён граф ${graphId} (качество: ${quality.toFixed(3)})`);
    }

    // 🔥 НОВЫЙ МЕТОД: Автоматическое обновление эталонного графа
    autoUpdateReferenceGraph(newBestGraphId) {
        if (!newBestGraphId || newBestGraphId === this.referenceGraphId) {
            return false;
        }

        const graphData = this.allGraphs.get(newBestGraphId);
        if (!graphData) {
            console.log(`❌ Граф ${newBestGraphId} не найден для обновления эталона`);
            return false;
        }

        const newQuality = graphData.quality;
        const currentQuality = this.referenceGraphQuality;

        // 🔥 ПОРОГ ДЛЯ ОБНОВЛЕНИЯ ЭТАЛОНА
        const improvementThreshold = 1.15; // На 15% лучше

        if (newQuality > currentQuality * improvementThreshold) {
            console.log(`🔄 АВТООБНОВЛЕНИЕ ЭТАЛОНА:`);
            console.log(`   Старый: ${this.referenceGraphId} (${currentQuality.toFixed(3)})`);
            console.log(`   Новый: ${newBestGraphId} (${newQuality.toFixed(3)})`);
            console.log(`   Улучшение: ${(newQuality / currentQuality).toFixed(2)}x`);

            // 🔥 СОХРАНЯЕМ СТАРЫЕ ПОДТВЕРЖДЕНИЯ
            const oldConfirmations = this.collectAllConfirmations();

            // Обновляем эталон
            this.referenceGraph = graphData.graph;
            this.referenceGraphId = newBestGraphId;
            this.referenceGraphQuality = newQuality;

            // 🔥 ПЕРЕСТРАИВАЕМ ШАБЛОН НА ОСНОВЕ НОВОГО ЭТАЛОНА
            this.rebuildTemplateWithNewReference(graphData.graph, newBestGraphId);

            // 🔥 ВОССТАНАВЛИВАЕМ ПОДТВЕРЖДЕНИЯ
            this.restoreConfirmations(oldConfirmations, newBestGraphId);

            console.log(`✅ Эталон обновлён на ${newBestGraphId}`);
            return true;
        }

        console.log(`📊 Новый граф лучше, но недостаточно для замены эталона:`);
        console.log(`   Нужно: ${(currentQuality * improvementThreshold).toFixed(3)}`);
        console.log(`   Есть: ${newQuality.toFixed(3)}`);

        return false;
    }

    // 🔥 НОВЫЙ МЕТОД: Собрать все подтверждения
    collectAllConfirmations() {
        const confirmations = {
            cells: new Map(),
            points: new Map(),
            sources: new Map()
        };

        // Собираем подтверждения из invariantCells
        for (const [cellId, cell] of this.invariantCells) {
            if (cell.confirmations > 1) {
                confirmations.cells.set(cellId, {
                    confirmations: cell.confirmations,
                    confidence: cell.confidence,
                    sources: cell.sources ? new Set(cell.sources) : new Set()
                });
            }
        }

        // Собираем подтверждения из templateCells
        for (const [cellId, cell] of this.templateCells) {
            if (cell.confirmations > 1) {
                confirmations.points.set(cellId, {
                    confirmations: cell.confirmations,
                    sources: cell.sources ? new Set(cell.sources) : new Set()
                });
            }
        }

        console.log(`📊 Собрано подтверждений: ${confirmations.cells.size} ячеек, ${confirmations.points.size} точек`);
        return confirmations;
    }

    // 🔥 НОВЫЙ МЕТОД: Перестроить шаблон с новым эталоном
    rebuildTemplateWithNewReference(newReferenceGraph, newGraphId) {
        console.log(`🏗️ Перестраиваю шаблон с новым эталоном ${newGraphId}...`);

        // 1. Сохраняем старые данные
        const oldInvariantCells = new Map(this.invariantCells);
        const oldTemplateCells = new Map(this.templateCells);
        const oldNormalizationTransform = this.normalizationTransform;

        // 2. Сбрасываем шаблон
        this.invariantCells.clear();
        this.templateCells.clear();
        this.cellAssignments.clear();
        this.cellConnections.clear();

        // 3. Устанавливаем новый эталон как базу
        this.referencePoints = this.extractPointsFromGraph(newReferenceGraph);
        this.normalizeReferencePoints();

        // 4. Создаем новую инвариантную сетку
        this.buildInvariantGrid();

        // 5. Извлекаем топологию из нового графа
        this.extractTopologyFromGraph(newReferenceGraph);

        console.log(`✅ Шаблон перестроен с ${this.invariantCells.size} ячейками`);

        // Возвращаем старые данные для восстановления
        return {
            oldInvariantCells,
            oldTemplateCells,
            oldNormalizationTransform
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Восстановить подтверждения после смены эталона
    restoreConfirmations(oldConfirmations, newReferenceGraphId) {
        if (!oldConfirmations || oldConfirmations.cells.size === 0) {
            console.log('📊 Нет старых подтверждений для восстановления');
            return 0;
        }

        console.log(`🔄 Восстанавливаю подтверждения на новом эталоне...`);
        let restoredCount = 0;

        // Для каждой ячейки в старом шаблоне ищем соответствующую в новом
        for (const [oldCellId, oldData] of oldConfirmations.cells) {
            // 🔥 НУЖЕН ИНВАРИАНТНЫЙ ПОИСК СООТВЕТСТВИЙ
            // Пока используем простую логику - подтверждаем все ячейки в новом шаблоне
            for (const [newCellId, newCell] of this.invariantCells) {
                if (newCell.confirmations < oldData.confirmations) {
                    newCell.confirmations = oldData.confirmations;
                    newCell.confidence = Math.max(newCell.confidence, oldData.confidence || 0.7);

                    if (oldData.sources) {
                        if (!newCell.sources) newCell.sources = new Set();
                        oldData.sources.forEach(source => newCell.sources.add(source));
                    }

                    restoredCount++;
                }
            }
        }

        console.log(`✅ Восстановлено ${restoredCount} подтверждений`);
        return restoredCount;
    }

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТНАЯ СЕТКА
    buildInvariantGrid() {
        console.log(`🔲 Создаю ИНВАРИАНТНУЮ сетку из ${this.normalizedReferencePoints.length} точек...`);

        this.invariantCells.clear();
        this.templateCells.clear();
        this.cellAssignments.clear();

        // Создаем ячейки на основе ОТНОСИТЕЛЬНЫХ позиций
        this.normalizedReferencePoints.forEach((point, index) => {
            const cellId = `cell_${index}`;

            // 🔥 ИНВАРИАНТНАЯ ЯЧЕЙКА хранит ОТНОСИТЕЛЬНЫЕ координаты
            const invariantCell = {
                normalizedCenter: { nx: point.nx, ny: point.ny },
                originalCenter: { x: point.x, y: point.y },
                radius: 0.05, // 5% от размера (относительно!)
                points: [point.id],
                confirmations: 1,
                confidence: 0.8,
                sources: new Set([this.referenceGraphId]),
                invariants: this.calculatePointInvariants(point, this.normalizedReferencePoints)
            };

            this.invariantCells.set(cellId, invariantCell);

            // Также сохраняем в templateCells для совместимости
            this.templateCells.set(cellId, {
                center: { x: point.x, y: point.y },
                radius: this.config.cellSize / 2,
                points: [point.id],
                confirmations: 1,
                confidence: 0.8,
                sources: new Set([this.referenceGraphId]),
                matchedPoints: []
            });

            this.cellAssignments.set(point.id, cellId);
        });

        console.log(`✅ Создано ${this.invariantCells.size} инвариантных ячеек`);
    }

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТЫ ТОЧКИ
    calculatePointInvariants(point, allPoints) {
        const invariants = {
            nearestNeighbors: [],
            distanceDistribution: [],
            angularDistribution: []
        };

        if (allPoints.length < 2) return invariants;

        // Находим 5 ближайших соседей
        const distances = allPoints
            .filter(p => p.id !== point.id)
            .map(p => ({
                id: p.id,
                distance: Math.sqrt(Math.pow(p.nx - point.nx, 2) + Math.pow(p.ny - point.ny, 2)),
                angle: Math.atan2(p.ny - point.ny, p.nx - point.nx)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);

        invariants.nearestNeighbors = distances.map(d => ({
            id: d.id,
            normalizedDistance: d.distance,
            angle: d.angle
        }));

        // Распределение расстояний
        const allDistances = allPoints
            .filter(p => p.id !== point.id)
            .map(p => Math.sqrt(Math.pow(p.nx - point.nx, 2) + Math.pow(p.ny - point.ny, 2)));

        invariants.distanceDistribution = this.createDistanceHistogram(allDistances, 5);

        return invariants;
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: Добавить граф с динамическим эталоном
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к шаблону с динамическим эталоном...`);

        // 🔥 ЕСЛИ ЭТО ПЕРВЫЙ ГРАФ - УСТАНАВЛИВАЕМ КАК ЭТАЛОН
        if (!this.referenceGraph) {
            console.log(`🎯 Первый граф, устанавливаю как эталон`);
            return this.setReferenceGraph(graph, graphId, metadata);
        }

        // 1. ОЦЕНИВАЕМ КАЧЕСТВО НОВОГО ГРАФА
        const newQuality = this.calculateGraphQuality(graph, metadata);
        console.log(`📈 Качество нового графа ${graphId}: ${newQuality.toFixed(3)}`);

        // 🔥 2. ПРОВЕРЯЕМ, НЕ ЯВЛЯЕТСЯ ЛИ ОН НОВЫМ ЛУЧШИМ
        this.saveGraph(graph, graphId, metadata, newQuality);

        // 3. СРАВНИВАЕМ С ЭТАЛОНОМ (даже если он не лучший)
        const points = this.extractPointsFromGraph(graph);
        const normalizedPoints = this.normalizePoints(points, this.normalizationTransform);

        console.log(`📊 Нормализовано ${normalizedPoints.length} точек`);

        // 4. ИНВАРИАНТНОЕ СОПОСТАВЛЕНИЕ
        const invariantMatches = this.findInvariantMatches(normalizedPoints);

        if (invariantMatches.length < Math.max(3, this.referencePoints.length * 0.2)) {
            console.log(`❌ Недостаточно инвариантных совпадений: ${invariantMatches.length}`);
            console.log(`   Ожидалось: минимум ${Math.max(3, this.referencePoints.length * 0.2)}`);
            return false;
        }

        console.log(`✅ Найдено ${invariantMatches.length} инвариантных совпадений`);

        // 5. ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ
        const updatedCells = this.updateInvariantCells(invariantMatches, graphId);

        // 🔥 6. ДОБАВЛЯЕМ НОВЫЕ ТОЧКИ (если есть)
        const newPointsAdded = this.addNewPointsFromGraph(
            normalizedPoints,
            invariantMatches,
            graphId
        );

        console.log(`📈 Добавлено ${newPointsAdded} новых точек из графа ${graphId}`);

        // 7. Сохранить трансформацию
        this.graphTransformations.set(graphId, {
            metadata: metadata,
            timestamp: new Date(),
            pointsCount: points.length,
            invariantMatches: invariantMatches.length,
            matchedRatio: invariantMatches.length / Math.max(1, this.referencePoints.length),
            quality: newQuality,
            newPointsAdded: newPointsAdded
        });

        // 8. Обновить статистику
        this.stats.totalGraphs++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        console.log(`✅ Граф добавлен: ${updatedCells} ячеек обновлено, ${newPointsAdded} новых точек`);
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Добавить новые точки из графа
    addNewPointsFromGraph(normalizedPoints, existingMatches, graphId) {
        if (normalizedPoints.length === 0) return 0;

        // Находим точки, которые не попали в matches
        const matchedPointIds = new Set();
        existingMatches.forEach(match => {
            if (match.newPoint && match.newPoint.id) {
                matchedPointIds.add(match.newPoint.id);
            }
        });

        const unmatchedPoints = normalizedPoints.filter(point =>
            point.id && !matchedPointIds.has(point.id)
        );

        if (unmatchedPoints.length === 0) return 0;

        console.log(`📊 Найдено ${unmatchedPoints.length} новых точек (не совпали с эталоном)`);

        let addedCount = 0;
        const maxNewPoints = 20; // Ограничиваем количество новых точек за раз

        // Добавляем новые точки как "неподтверждённые"
        unmatchedPoints.slice(0, maxNewPoints).forEach((point, index) => {
            const cellId = `new_${graphId}_${index}_${Date.now()}`;

            // 🔥 СОЗДАЕМ НОВУЮ ЯЧЕЙКУ С 1 ПОДТВЕРЖДЕНИЕМ (этот граф)
            const newCell = {
                normalizedCenter: { nx: point.nx || 0, ny: point.ny || 0 },
                originalCenter: { x: point.x || 0, y: point.y || 0 },
                radius: 0.05,
                points: [point.id],
                confirmations: 1, // 🔥 ТОЛЬКО 1 ПОДТВЕРЖДЕНИЕ (пока)
                confidence: point.confidence || 0.6,
                sources: new Set([graphId]),
                invariants: point.invariants || null,
                isNew: true, // 🔥 ФЛАГ - НОВАЯ ТОЧКА
                needsConfirmation: true // 🔥 ТРЕБУЕТ ДОПОЛНИТЕЛЬНЫХ ПОДТВЕРЖДЕНИЙ
            };

            this.invariantCells.set(cellId, newCell);
            addedCount++;

            if (addedCount <= 3) {
                console.log(`   + Новая точка ${cellId}: (${point.x?.toFixed(1)}, ${point.y?.toFixed(1)})`);
            }
        });

        return addedCount;
    }

    // 🔥 МЕТОД: ОБНОВИТЬ ИНВАРИАНТНЫЕ ЯЧЕЙКИ
    updateInvariantCells(matches, graphId) {
        let updatedCells = 0;

        matches.forEach(match => {
            const cell = this.invariantCells.get(match.cellId);
            if (cell) {
                cell.confirmations += 1;
                cell.confidence = Math.min(1.0, cell.confidence + 0.15);
                if (cell.sources) {
                    cell.sources.add(graphId);
                }
                updatedCells++;
            }

            // Также обновляем templateCells для совместимости
            const templateCell = this.templateCells.get(match.cellId);
            if (templateCell) {
                templateCell.confirmations += 1;
                templateCell.confidence = Math.min(1.0, templateCell.confidence + 0.15);
                if (templateCell.sources) {
                    templateCell.sources.add(graphId);
                }
            }
        });

        return updatedCells;
    }

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТНОЕ СОПОСТАВЛЕНИЕ
    findInvariantMatches(normalizedPoints) {
        const matches = [];

        // Для каждой точки нового графа ищем инвариантно-похожую точку эталона
        normalizedPoints.forEach(newPoint => {
            let bestMatch = null;
            let bestScore = 0;

            for (const [cellId, cell] of this.invariantCells) {
                // 🔥 СРАВНИВАЕМ ИНВАРИАНТЫ, А НЕ КООРДИНАТЫ!
                const score = this.compareInvariants(newPoint, cell);

                if (score > bestScore && score > 0.6) {
                    bestScore = score;
                    bestMatch = {
                        newPoint: newPoint,
                        cellId: cellId,
                        cell: cell,
                        score: score
                    };
                }
            }

            if (bestMatch) {
                matches.push(bestMatch);
            }
        });

        return matches;
    }

    // 🔥 НОВЫЙ МЕТОД: СРАВНЕНИЕ ИНВАРИАНТОВ
    compareInvariants(point, cell) {
        if (!cell.invariants) return 0;

        let totalScore = 0;
        let weightSum = 0;

        // 1. Сравнение позиции (относительной)
        const posScore = 1 - Math.sqrt(
            Math.pow(point.nx - cell.normalizedCenter.nx, 2) +
            Math.pow(point.ny - cell.normalizedCenter.ny, 2)
        );
        totalScore += posScore * 0.3;
        weightSum += 0.3;

        // 2. Сравнение распределения расстояний до соседей
        if (point.invariants && point.invariants.distanceDistribution) {
            const distScore = this.compareHistograms(
                point.invariants.distanceDistribution,
                cell.invariants.distanceDistribution
            );
            totalScore += distScore * 0.4;
            weightSum += 0.4;
        }

        // 3. Сравнение углового распределения
        if (point.invariants && point.invariants.nearestNeighbors) {
            const angleScore = this.compareAngularDistributions(
                point.invariants.nearestNeighbors,
                cell.invariants.nearestNeighbors
            );
            totalScore += angleScore * 0.3;
            weightSum += 0.3;
        }

        return weightSum > 0 ? totalScore / weightSum : 0;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ОЦЕНКИ КАЧЕСТВА

    calculateNodeUniformity(nodes) {
        if (nodes.length < 4) return 0.5;

        // Разбиваем на сетку 3x3 и проверяем равномерность распределения
        const xs = nodes.map(n => n.x || 0);
        const ys = nodes.map(n => n.y || 0);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        const grid = Array(9).fill(0);
        const cellWidth = width / 3;
        const cellHeight = height / 3;

        nodes.forEach(node => {
            const gridX = Math.min(2, Math.floor((node.x - minX) / cellWidth));
            const gridY = Math.min(2, Math.floor((node.y - minY) / cellHeight));
            const cellIndex = gridY * 3 + gridX;
            grid[cellIndex]++;
        });

        // Рассчитываем равномерность (чем меньше дисперсия, тем лучше)
        const mean = nodes.length / 9;
        let variance = 0;
        grid.forEach(count => {
            variance += Math.pow(count - mean, 2);
        });
        variance /= 9;

        const maxVariance = Math.pow(nodes.length, 2) / 9;
        const uniformity = 1 - (variance / maxVariance);

        return Math.max(0, Math.min(1, uniformity));
    }

    calculateConnectivityScore(nodes, edges) {
        if (edges.length === 0 || nodes.length < 2) return 0.3;

        // Средняя степень узла
        const degrees = new Map();
        edges.forEach(edge => {
            degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
            degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
        });

        let totalDegree = 0;
        let nodesWithEdges = 0;

        for (const degree of degrees.values()) {
            totalDegree += degree;
            nodesWithEdges++;
        }

        const avgDegree = nodesWithEdges > 0 ? totalDegree / nodesWithEdges : 0;

        // Нормализуем: 2-3 связи на узел = оптимально
        return Math.min(1, avgDegree / 3);
    }

    calculateConfidenceScore(nodes, metadata) {
        // 1. Уверенность из узлов
        let totalConfidence = 0;
        nodes.forEach(node => {
            totalConfidence += node.confidence || 0.5;
        });
        const avgNodeConfidence = nodes.length > 0 ? totalConfidence / nodes.length : 0.5;

        // 2. Уверенность из метаданных (если есть)
        let metadataConfidence = 0.5;
        if (metadata.photoQuality) {
            metadataConfidence = metadata.photoQuality;
        } else if (metadata.confidence) {
            metadataConfidence = metadata.confidence;
        }

        // Комбинируем
        return (avgNodeConfidence * 0.7 + metadataConfidence * 0.3);
    }

    calculateCoverageScore(nodes) {
        if (nodes.length < 3) return 0.3;

        const xs = nodes.map(n => n.x || 0);
        const ys = nodes.map(n => n.y || 0);

        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);

        // Площадь bounding box
        const bboxArea = width * height;
        if (bboxArea < 1) return 0.3;

        // Приблизительная площадь, занимаемая точками
        // (чем плотнее точки, тем лучше покрытие)
        const pointDensity = nodes.length / bboxArea;

        // Нормализуем (эмпирически)
        const normalizedDensity = Math.min(1, pointDensity * 0.1);

        return normalizedDensity;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ИНВАРИАНТНОСТИ
    normalizePoints(points, transform) {
        if (!transform) return points;

        return points.map(point => {
            const normalizedPoint = {
                ...point,
                nx: (point.x - transform.minX) / Math.max(1, transform.width),
                ny: (point.y - transform.minY) / Math.max(1, transform.height),
                normalized: true
            };

            // Вычисляем инварианты для этой точки
            normalizedPoint.invariants = this.calculatePointInvariants(
                normalizedPoint,
                [...this.normalizedReferencePoints, normalizedPoint]
            );

            return normalizedPoint;
        });
    }

    createDistanceHistogram(distances, bins = 5) {
        if (distances.length === 0) return Array(bins).fill(0);

        const min = Math.min(...distances);
        const max = Math.max(...distances);
        const range = max - min;

        if (range === 0) return Array(bins).fill(distances.length / bins);

        const histogram = Array(bins).fill(0);
        const binSize = range / bins;

        distances.forEach(distance => {
            const binIndex = Math.min(bins - 1, Math.floor((distance - min) / binSize));
            histogram[binIndex]++;
        });

        // Нормализуем
        const total = distances.length;
        return histogram.map(count => count / total);
    }

    compareHistograms(hist1, hist2) {
        if (!hist1 || !hist2 || hist1.length !== hist2.length) return 0;

        let sum = 0;
        for (let i = 0; i < hist1.length; i++) {
            sum += 1 - Math.abs(hist1[i] - hist2[i]);
        }

        return sum / hist1.length;
    }

    compareAngularDistributions(neighbors1, neighbors2) {
        if (!neighbors1 || !neighbors2) return 0;

        // Сравниваем углы до ближайших соседей
        const angles1 = neighbors1.map(n => n.angle).sort((a, b) => a - b);
        const angles2 = neighbors2.map(n => n.angle).sort((a, b) => a - b);

        const minLength = Math.min(angles1.length, angles2.length);
        if (minLength === 0) return 0;

        let score = 0;
        for (let i = 0; i < minLength; i++) {
            const diff = Math.abs(angles1[i] - angles2[i]);
            score += 1 - Math.min(1, diff / Math.PI); // Нормализуем к [0, π]
        }

        return score / minLength;
    }

    // ============ СУЩЕСТВУЮЩИЕ МЕТОДЫ С КОРРЕКТИРОВКАМИ ============

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

    extractTopologyFromGraph(graph) {
        if (!graph || !graph.edges) return;

        console.log(`🔗 Извлекаю топологию из графа...`);

        graph.edges.forEach((edge, edgeId) => {
            const fromCell = this.cellAssignments.get(edge.from);
            const toCell = this.cellAssignments.get(edge.to);

            if (fromCell && toCell && fromCell !== toCell) {
                if (!this.cellConnections.has(fromCell)) {
                    this.cellConnections.set(fromCell, []);
                }
                if (!this.cellConnections.has(toCell)) {
                    this.cellConnections.set(toCell, []);
                }

                if (!this.cellConnections.get(fromCell).includes(toCell)) {
                    this.cellConnections.get(fromCell).push(toCell);
                }
                if (!this.cellConnections.get(toCell).includes(fromCell)) {
                    this.cellConnections.get(toCell).push(fromCell);
                }
            }
        });

        console.log(`✅ Топология: ${this.cellConnections.size} ячеек со связями`);
    }

    updateStats() {
        let totalConfirmations = 0;
        let confirmedCells = 0;
        let highConfidenceCells = 0;

        for (const [cellId, cell] of this.invariantCells) {
            totalConfirmations += cell.confirmations || 0;

            if (cell.confirmations > 0) {
                confirmedCells++;
            }

            if (cell.confirmations >= this.config.highConfidenceThreshold) {
                highConfidenceCells++;
            }
        }

        this.stats.confirmedCells = confirmedCells;
        this.stats.highConfidenceCells = highConfidenceCells;
        this.stats.totalConfirmations = totalConfirmations; // 🔥 ДОБАВЛЯЕМ
        this.stats.avgConfirmations = this.invariantCells.size > 0 ?
            totalConfirmations / this.invariantCells.size : 0;
    }

    calculateZones() {
        if (this.normalizedReferencePoints.length === 0) return {};

        // Используем нормализованные координаты для зон
        const xs = this.normalizedReferencePoints.map(p => p.nx);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const rangeX = maxX - minX;

        const zoneWidth = rangeX / 3;

        const zones = {
            heel: {
                minX: minX,
                maxX: minX + zoneWidth,
                cells: 0,
                confirmations: 0,
                confidence: 0
            },
            midfoot: {
                minX: minX + zoneWidth,
                maxX: minX + zoneWidth * 2,
                cells: 0,
                confirmations: 0,
                confidence: 0
            },
            forefoot: {
                minX: minX + zoneWidth * 2,
                maxX: maxX,
                cells: 0,
                confirmations: 0,
                confidence: 0
            }
        };

        // Посчитать статистику по зонам
        for (const [cellId, cell] of this.invariantCells) {
            if (cell.normalizedCenter.nx < zones.heel.maxX) {
                zones.heel.cells++;
                zones.heel.confirmations += cell.confirmations || 0;
                zones.heel.confidence += cell.confidence || 0;
            } else if (cell.normalizedCenter.nx < zones.midfoot.maxX) {
                zones.midfoot.cells++;
                zones.midfoot.confirmations += cell.confirmations || 0;
                zones.midfoot.confidence += cell.confidence || 0;
            } else {
                zones.forefoot.cells++;
                zones.forefoot.confirmations += cell.confirmations || 0;
                zones.forefoot.confidence += cell.confidence || 0;
            }
        }

        // Нормализовать уверенность
        Object.keys(zones).forEach(zone => {
            if (zones[zone].cells > 0) {
                zones[zone].confidence = zones[zone].confidence / zones[zone].cells;
                zones[zone].avgConfirmations = zones[zone].confirmations / zones[zone].cells;
            }
        });

        return zones;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Получить информацию
    getInfo() {
        const info = {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU'),
                invariantCells: this.invariantCells.size,
                totalGraphs: this.allGraphs.size,
                bestGraphQuality: this.bestGraphQuality.toFixed(3)
            },
            referenceGraphId: this.referenceGraphId,
            referenceGraphQuality: this.referenceGraphQuality.toFixed(3),
            bestGraphId: this.bestGraphId,
            bestGraphQuality: this.bestGraphQuality.toFixed(3),
            graphStats: {
                total: this.allGraphs.size,
                qualities: Array.from(this.graphQualities.entries())
                    .map(([id, quality]) => ({ id: id.slice(0, 8), quality: quality.toFixed(3) }))
                    .sort((a, b) => b.quality - a.quality)
                    .slice(0, 5) // Только топ-5
            },
            templateCells: this.templateCells.size,
            invariantCells: this.invariantCells.size,
            cellConnections: this.cellConnections.size,
            config: {
                ...this.config,
                cellSize: this.config.cellSize
            }
        };

        return info;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить лучший граф
    getBestGraph() {
        if (!this.bestGraphId || !this.allGraphs.has(this.bestGraphId)) {
            return this.referenceGraph;
        }

        return this.allGraphs.get(this.bestGraphId).graph;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить все графы отсортированные по качеству
    getAllGraphsSortedByQuality() {
        const graphs = Array.from(this.allGraphs.values());
        return graphs.sort((a, b) => b.quality - a.quality);
    }

    // 🔥 НОВЫЙ МЕТОД: Получить нормализационную трансформацию
    getNormalizationTransform() {
        return this.normalizationTransform || {
            minX: 0, maxX: 1, minY: 0, maxY: 1,
            width: 1, height: 1
        };
    }

    toJSON() {
        const invariantCellsData = {};
        for (const [cellId, cell] of this.invariantCells) {
            invariantCellsData[cellId] = {
                normalizedCenter: cell.normalizedCenter,
                originalCenter: cell.originalCenter,
                radius: cell.radius,
                confirmations: cell.confirmations,
                confidence: cell.confidence,
                sources: cell.sources ? Array.from(cell.sources) : [],
                invariants: cell.invariants,
                isNew: cell.isNew || false,
                needsConfirmation: cell.needsConfirmation || false
            };
        }

        const templateCellsData = {};
        for (const [cellId, cell] of this.templateCells) {
            templateCellsData[cellId] = {
                center: cell.center,
                radius: cell.radius,
                confirmations: cell.confirmations,
                confidence: cell.confidence,
                sources: cell.sources ? Array.from(cell.sources) : []
            };
        }

        const transformationsData = {};
        for (const [graphId, transform] of this.graphTransformations) {
            transformationsData[graphId] = transform;
        }

        const allGraphsData = {};
        for (const [graphId, graphData] of this.allGraphs) {
            allGraphsData[graphId] = {
                id: graphData.id,
                metadata: graphData.metadata,
                quality: graphData.quality,
                nodeCount: graphData.nodeCount,
                edgeCount: graphData.edgeCount,
                addedAt: graphData.addedAt
            };
        }

        return {
            id: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            referenceGraphQuality: this.referenceGraphQuality,
            bestGraphId: this.bestGraphId,
            bestGraphQuality: this.bestGraphQuality,
            invariantCells: invariantCellsData,
            templateCells: templateCellsData,
            cellConnections: Object.fromEntries(this.cellConnections),
            cellAssignments: Object.fromEntries(this.cellAssignments),
            graphTransformations: transformationsData,
            allGraphs: allGraphsData,
            graphQualities: Object.fromEntries(this.graphQualities),
            stats: this.stats,
            config: this.config,
            referencePoints: this.normalizedReferencePoints,
            normalizationTransform: this.normalizationTransform,
            _version: '3.0-dynamic-reference',
            _savedAt: new Date().toISOString()
        };
    }

    static fromJSON(data) {
        const builder = new TemplateBuilder({
            name: data.name,
            ...data.config
        });

        builder.id = data.id || builder.id;
        builder.referenceGraphId = data.referenceGraphId;
        builder.referenceGraphQuality = data.referenceGraphQuality || 0;
        builder.bestGraphId = data.bestGraphId || null;
        builder.bestGraphQuality = data.bestGraphQuality || 0;
        builder.normalizationTransform = data.normalizationTransform || null;

        // Восстановить все графы
        if (data.allGraphs) {
            for (const [graphId, graphData] of Object.entries(data.allGraphs)) {
                builder.allGraphs.set(graphId, graphData);
            }
        }

        // Восстановить качества графов
        if (data.graphQualities) {
            for (const [graphId, quality] of Object.entries(data.graphQualities)) {
                builder.graphQualities.set(graphId, quality);
            }
        }

        // Восстановить инвариантные ячейки
        if (data.invariantCells) {
            for (const [cellId, cellData] of Object.entries(data.invariantCells)) {
                builder.invariantCells.set(cellId, {
                    ...cellData,
                    sources: new Set(cellData.sources || []),
                    isNew: cellData.isNew || false,
                    needsConfirmation: cellData.needsConfirmation || false
                });
            }
        }

        // Восстановить templateCells для совместимости
        if (data.templateCells) {
            for (const [cellId, cellData] of Object.entries(data.templateCells)) {
                builder.templateCells.set(cellId, {
                    ...cellData,
                    sources: new Set(cellData.sources || [])
                });
            }
        }

        // Восстановить связи
        if (data.cellConnections) {
            for (const [cellId, connections] of Object.entries(data.cellConnections)) {
                builder.cellConnections.set(cellId, connections);
            }
        }

        // Восстановить привязки
        if (data.cellAssignments) {
            for (const [pointId, cellId] of Object.entries(data.cellAssignments)) {
                builder.cellAssignments.set(pointId, cellId);
            }
        }

        // Восстановить трансформации
        if (data.graphTransformations) {
            for (const [graphId, transform] of Object.entries(data.graphTransformations)) {
                builder.graphTransformations.set(graphId, transform);
            }
        }

        // Восстановить статистику
        if (data.stats) {
            builder.stats = { ...builder.stats, ...data.stats };
            if (typeof data.stats.createdAt === 'string') {
                builder.stats.createdAt = new Date(data.stats.createdAt);
            }
            if (typeof data.stats.lastUpdated === 'string') {
                builder.stats.lastUpdated = new Date(data.stats.lastUpdated);
            }
        }

        // Восстановить нормализованные точки
        builder.normalizedReferencePoints = data.referencePoints || [];
        builder.referencePoints = builder.normalizedReferencePoints.map(p => ({
            ...p,
            x: p.x || (p.normalizedCenter ? p.normalizedCenter.x * 100 : 0),
            y: p.y || (p.normalizedCenter ? p.normalizedCenter.y * 100 : 0)
        }));

        console.log(`📂 Загружен TemplateBuilder "${builder.name}" с ДИНАМИЧЕСКИМ эталоном`);
        console.log(`   Ячеек: ${builder.invariantCells.size}, Графов: ${builder.allGraphs.size}`);
        console.log(`   Текущий эталон: ${builder.referenceGraphId} (${builder.referenceGraphQuality.toFixed(3)})`);
        console.log(`   Лучший граф: ${builder.bestGraphId} (${builder.bestGraphQuality.toFixed(3)})`);

        return builder;
    }
}

module.exports = TemplateBuilder;
