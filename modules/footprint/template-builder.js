// modules/footprint/template-builder.js
const SimpleGraphMatcher = require('./simple-matcher');

class TemplateBuilder {
    constructor(options = {}) {
        this.id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблон протектора';

        // 🔥 ДОБАВЛЯЕМ МАТЧЕР
        this.matcher = new SimpleGraphMatcher({
            debug: options.debug || false
        });

        // 🔥 ОСНОВНОЙ КОНЦЕПТ: ШАБЛОН НА ОСНОВЕ ЭТАЛОНА
        this.referenceGraph = null;      // Граф-эталон (самый детализированный)
        this.referenceGraphId = null;    // ID эталонного графа
        this.referencePoints = [];       // Точки эталона (центрированные, нормализованные)

        // 🔥 АДАПТИВНАЯ СЕТКА ШАБЛОНА
        this.templateCells = new Map();  // Ячейки шаблона: cellId -> {center, points[], confirmations, confidence}
        this.cellAssignments = new Map(); // Привязка точек к ячейкам: pointId -> cellId

        // 🔥 ТРАНСФОРМАЦИИ ДЛЯ КАЖДОГО СЛЕДА
        this.graphTransformations = new Map(); // graphId -> {scale, rotation, translation, error}
        this.alignedPoints = new Map();        // graphId -> [{x, y, originalId, cellId}]

        // 🔥 ТОПОЛОГИЯ ШАБЛОНА (связи между ячейками)
        this.cellConnections = new Map(); // cellId -> [neighborCellIds]

        // 🔥 СТАТИСТИКА
        this.stats = {
            totalGraphs: 0,
            confirmedCells: 0,
            highConfidenceCells: 0,
            avgConfirmations: 0,
            alignmentError: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        // 🔥 НАСТРОЙКИ (ИСПРАВЛЕННЫЕ!)
        this.config = {
            minPointsForReference: options.minPointsForReference || 3, // Уменьшили
            cellSize: options.cellSize || 25, // Увеличили
            confirmationThreshold: options.confirmationThreshold || 2,
            highConfidenceThreshold: options.highConfidenceThreshold || 3,
            maxAlignmentError: options.maxAlignmentError || 100, // Увеличили
            enablePCA: false, // 🔥 ОТКЛЮЧАЕМ PCA
            enableAdaptiveGrid: options.enableAdaptiveGrid !== false,
            debug: options.debug || false,
            ...options
        };

        console.log(`🏗️ Создан TemplateBuilder "${this.name}"`);
    }

    // 🔥 ОСНОВНОЙ МЕТОД 1: УСТАНОВИТЬ ЭТАЛОННЫЙ ГРАФ (ИСПРАВЛЕННЫЙ!)
    setReferenceGraph(graph, graphId, metadata = {}) {
        console.log(`🎯 Устанавливаю эталонный граф: ${graphId} (${graph?.nodes?.size || 0} узлов)`);

        if (!graph || !graph.nodes) {
            console.log(`❌ Граф не существует`);
            return false;
        }

        const nodeCount = graph.nodes.size;

        if (nodeCount < this.config.minPointsForReference) {
            console.log(`⚠️ Граф мал для эталона (${nodeCount} < ${this.config.minPointsForReference}), ` +
                       `но все равно использую как эталон`);
            // ПРОДОЛЖАЕМ, а не возвращаем false!
        }

        this.referenceGraph = graph;
        this.referenceGraphId = graphId;

        // Извлекаем точки из графа
        this.referencePoints = this.extractPointsFromGraph(graph);
        console.log(`📊 Извлечено ${this.referencePoints.length} точек эталона`);

        // 🔥 ВМЕСТО PCA - ПРОСТОЕ ЦЕНТРИРОВАНИЕ
        this.centerReferencePoints();

        // 2. 🔥 ПРОСТАЯ СЕТКА ВМЕСТО АДАПТИВНОЙ
        this.buildSimpleGridFromPoints();

        // 3. СОХРАНЯЕМ ТОПОЛОГИЮ (связи между ячейками)
        this.extractTopologyFromGraph(graph);

        console.log(`✅ Эталон установлен: ${this.templateCells.size} ячеек шаблона`);
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: ПРОСТОЕ ЦЕНТРИРОВАНИЕ
    centerReferencePoints() {
        if (this.referencePoints.length === 0) return;

        const center = this.calculateCenter(this.referencePoints);

        // Сдвигаем все точки так, чтобы центр был в (0,0)
        this.referencePoints = this.referencePoints.map(p => ({
            ...p,
            x: p.x - center.x,
            y: p.y - center.y
        }));

        console.log(`🎯 Центрировал точки вокруг (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
    }

    // 🔥 НОВЫЙ МЕТОД: ПРОСТАЯ СЕТКА ИЗ ТОЧЕК
    buildSimpleGridFromPoints() {
        console.log(`🔲 Создаю простую сетку из ${this.referencePoints.length} точек...`);

        this.templateCells.clear();
        this.cellAssignments.clear();

        this.referencePoints.forEach((point, index) => {
            const cellId = `cell_${index}`;

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

        console.log(`✅ Создано ${this.templateCells.size} ячеек (простая сетка)`);
    }

    // 🔥 ОСНОВНОЙ МЕТОД 2: ДОБАВИТЬ ГРАФ К ШАБЛОНУ (ИСПРАВЛЕННЫЙ!)
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к шаблону...`);

        if (!this.referenceGraph) {
            console.log(`⚠️ Нет эталона! Устанавливаю этот граф как эталон`);
            return this.setReferenceGraph(graph, graphId, metadata);
        }

        // Извлекаем точки из графа
        const points = this.extractPointsFromGraph(graph);
        console.log(`📊 Точки для совмещения: ${points.length}`);

        // 🔥 ИСПОЛЬЗУЕМ МАТЧЕР ВМЕСТО СЛОЖНОЙ ТРАНСФОРМАЦИИ
        const matchResult = this.matcher.alignAndCompare(this.referenceGraph, graph, {
            templateMatch: true,
            graphId: graphId
        });

        if (!matchResult.matchedPairs || matchResult.matchedPairs.length === 0) {
            console.log(`❌ Не найдено совпадающих пар точек`);
            return false;
        }

        console.log(`✅ Найдено ${matchResult.matchedPairs.length} совпадающих пар, схожесть: ${matchResult.similarity.toFixed(3)}`);

        // 🔥 ПРОСТАЯ ТРАНСФОРМАЦИЯ НА ОСНОВЕ matchedPairs
        const transformation = this.calculateSimpleTransformationFromMatches(matchResult.matchedPairs);

        // Применяем трансформацию
        const alignedPoints = this.applySimpleTransformation(points, transformation);

        // Сопоставляем с ячейками
        const assignments = this.assignToCells(alignedPoints, graphId);

        // Обновляем подтверждения
        const updatedCells = this.updateCellConfirmations(assignments, graphId);

        // Сохранить трансформацию
        this.graphTransformations.set(graphId, {
            ...transformation,
            metadata: metadata,
            timestamp: new Date(),
            pointsCount: points.length,
            alignedPointsCount: alignedPoints.length,
            assignedCells: assignments.size,
            matchedPairs: matchResult.matchedPairs.length,
            similarity: matchResult.similarity
        });

        // Сохранить выровненные точки
        this.alignedPoints.set(graphId, alignedPoints);

        // Обновить статистику
        this.stats.totalGraphs++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        console.log(`✅ Граф добавлен к шаблону: ${updatedCells} ячеек обновлено`);
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: ПРОСТАЯ ТРАНСФОРМАЦИЯ
    calculateSimpleTransformationFromMatches(matchedPairs) {
        if (matchedPairs.length === 0) {
            return { translation: { x: 0, y: 0 }, scale: 1, rotation: 0 };
        }

        // Используем среднее смещение из совпавших пар
        let totalDX = 0;
        let totalDY = 0;

        matchedPairs.forEach(pair => {
            if (pair.node1Data && pair.node2Data) {
                totalDX += (pair.node1Data.x - pair.node2Data.x);
                totalDY += (pair.node1Data.y - pair.node2Data.y);
            }
        });

        return {
            translation: {
                x: -totalDX / matchedPairs.length, // Инвертируем направление
                y: -totalDY / matchedPairs.length
            },
            scale: 1,
            rotation: 0,
            error: 0
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ПРОСТОЕ ПРИМЕНЕНИЕ ТРАНСФОРМАЦИИ
    applySimpleTransformation(points, transformation) {
        return points.map(point => ({
            ...point,
            x: point.x + transformation.translation.x,
            y: point.y + transformation.translation.y,
            originalX: point.x,
            originalY: point.y
        }));
    }

    // 🔥 МЕТОД: СОПОСТАВИТЬ С ЯЧЕЙКАМИ ШАБЛОНА (ИСПРАВЛЕННЫЙ!)
    assignToCells(alignedPoints, graphId) {
        console.log(`📍 Сопоставляю ${alignedPoints.length} точек с ячейками...`);

        const assignments = new Map();

        // 🔥 УВЕЛИЧИВАЕМ РАДИУС ПОИСКА
        const searchRadius = this.config.cellSize * 2; // В 2 раза больше

        alignedPoints.forEach(point => {
            let bestCell = null;
            let minDistance = Infinity;

            // Ищем ближайшую ячейку
            for (const [cellId, cell] of this.templateCells) {
                const dx = point.x - cell.center.x;
                const dy = point.y - cell.center.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance && distance < searchRadius) {
                    minDistance = distance;
                    bestCell = cellId;
                }
            }

            if (bestCell) {
                assignments.set(point.id, bestCell);

                // Сохраняем информацию о сопоставлении
                const cell = this.templateCells.get(bestCell);
                if (!cell.matchedPoints) cell.matchedPoints = [];
                cell.matchedPoints.push({
                    pointId: point.id,
                    distance: minDistance,
                    confidence: point.confidence,
                    graphId: graphId
                });

                if (minDistance < 10) { // Очень точное сопоставление
                    console.log(`   ✅ Точное сопоставление: ${point.id} -> ${bestCell} (${minDistance.toFixed(1)}px)`);
                }
            } else if (this.config.debug) {
                console.log(`   ⚠️ Точка ${point.id} не сопоставлена (minDistance: ${minDistance.toFixed(1)}px)`);
            }
        });

        console.log(`✅ Сопоставлено ${assignments.size}/${alignedPoints.length} точек`);
        return assignments;
    }

    // 🔥 МЕТОД: ИЗВЛЕЧЬ ТОЧКИ ИЗ ГРАФА
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

    // 🔥 МЕТОД: ИЗВЛЕЧЬ ТОПОЛОГИЮ ИЗ ГРАФА
    extractTopologyFromGraph(graph) {
        if (!graph || !graph.edges) return;

        console.log(`🔗 Извлекаю топологию из графа...`);

        // Проходим по всем ребрам графа
        graph.edges.forEach((edge, edgeId) => {
            const fromCell = this.cellAssignments.get(edge.from);
            const toCell = this.cellAssignments.get(edge.to);

            if (fromCell && toCell && fromCell !== toCell) {
                // Добавить связь между ячейками
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

    // 🔥 МЕТОД: ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ В ЯЧЕЙКАХ
    updateCellConfirmations(assignments, graphId) {
        let updatedCells = 0;

        // Подсчитать сколько точек попало в каждую ячейку
        const cellCounts = new Map();
        assignments.forEach(cellId => {
            cellCounts.set(cellId, (cellCounts.get(cellId) || 0) + 1);
        });

        // Обновить ячейки
        cellCounts.forEach((count, cellId) => {
            const cell = this.templateCells.get(cellId);
            if (cell) {
                cell.confirmations += 1;
                cell.confidence = Math.min(1.0, cell.confidence + 0.15);
                if (cell.sources) {
                    cell.sources.add(graphId);
                }
                updatedCells++;
            }
        });

        return updatedCells;
    }

    // 🔥 МЕТОД: РАССЧИТАТЬ ЗОНЫ ПРОТЕКТОРА
    calculateZones() {
        if (this.referencePoints.length === 0) return {};

        // Найти min/max по X (после выравнивания ось X = направление стопы)
        const xs = this.referencePoints.map(p => p.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const rangeX = maxX - minX;

        // Разделить на 3 зоны
        const zoneWidth = rangeX / 3;

        const zones = {
            heel: { // Пятка (самая левая часть по X)
                minX: minX,
                maxX: minX + zoneWidth,
                cells: 0,
                confirmations: 0,
                confidence: 0
            },
            midfoot: { // Центр
                minX: minX + zoneWidth,
                maxX: minX + zoneWidth * 2,
                cells: 0,
                confirmations: 0,
                confidence: 0
            },
            forefoot: { // Носок
                minX: minX + zoneWidth * 2,
                maxX: maxX,
                cells: 0,
                confirmations: 0,
                confidence: 0
            }
        };

        // Посчитать статистику по зонам
        for (const [cellId, cell] of this.templateCells) {
            if (cell.center.x < zones.heel.maxX) {
                zones.heel.cells++;
                zones.heel.confirmations += cell.confirmations || 0;
                zones.heel.confidence += cell.confidence || 0;
            } else if (cell.center.x < zones.midfoot.maxX) {
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

    // 🔥 МЕТОД: ОБНОВИТЬ СТАТИСТИКУ
    updateStats() {
        let totalConfirmations = 0;
        let confirmedCells = 0;
        let highConfidenceCells = 0;

        for (const [cellId, cell] of this.templateCells) {
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
        this.stats.avgConfirmations = this.templateCells.size > 0 ?
            totalConfirmations / this.templateCells.size : 0;
    }

    // 🔥 МЕТОД: ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
    getVisualizationData() {
        const cellsArray = [];

        for (const [cellId, cell] of this.templateCells) {
            cellsArray.push({
                id: cellId,
                x: cell.center.x,
                y: cell.center.y,
                radius: cell.radius || this.config.cellSize / 2,
                confirmations: cell.confirmations || 0,
                confidence: cell.confidence || 0,
                sources: cell.sources ? Array.from(cell.sources) : [],
                pointCount: cell.points ? cell.points.length : 0,
                isHighConfidence: cell.confirmations >= this.config.highConfidenceThreshold,
                matchedPoints: cell.matchedPoints || []
            });
        }

        // Рассчитать статистику по зонам (нос/центр/пятка)
        const zones = this.calculateZones();

        return {
            templateId: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            cells: cellsArray,
            stats: {
                ...this.stats,
                zones: zones,
                cellCount: this.templateCells.size,
                highConfidenceCells: cellsArray.filter(c => c.isHighConfidence).length,
                avgConfirmations: this.stats.avgConfirmations
            },
            referencePoints: this.referencePoints,
            transformationsCount: this.graphTransformations.size
        };
    }

    // 🔥 МЕТОД: ПОЛУЧИТЬ ИНФОРМАЦИЮ
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU')
            },
            referenceGraphId: this.referenceGraphId,
            templateCells: this.templateCells.size,
            cellConnections: this.cellConnections.size,
            totalGraphs: this.stats.totalGraphs,
            config: {
                ...this.config,
                cellSize: this.config.cellSize
            }
        };
    }

    // 🔥 МЕТОД: СОХРАНИТЬ В JSON
    toJSON() {
        const cellsData = {};
        for (const [cellId, cell] of this.templateCells) {
            cellsData[cellId] = {
                center: cell.center,
                radius: cell.radius,
                confirmations: cell.confirmations,
                confidence: cell.confidence,
                sources: cell.sources ? Array.from(cell.sources) : [],
                clusterSize: cell.clusterSize
            };
        }

        const transformationsData = {};
        for (const [graphId, transform] of this.graphTransformations) {
            transformationsData[graphId] = transform;
        }

        return {
            id: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            templateCells: cellsData,
            cellConnections: Object.fromEntries(this.cellConnections),
            cellAssignments: Object.fromEntries(this.cellAssignments),
            graphTransformations: transformationsData,
            stats: this.stats,
            config: this.config,
            referencePoints: this.referencePoints,
            _version: '1.0',
            _savedAt: new Date().toISOString()
        };
    }

    // 🔥 МЕТОД: ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        const builder = new TemplateBuilder({
            name: data.name,
            ...data.config
        });

        builder.id = data.id || builder.id;
        builder.referenceGraphId = data.referenceGraphId;

        // Восстановить ячейки
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

        // Восстановить опорные точки
        builder.referencePoints = data.referencePoints || [];

        console.log(`📂 Загружен TemplateBuilder "${builder.name}" с ${builder.templateCells.size} ячейками`);
        return builder;
    }

    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    findPointMatches(points1, points2, threshold = this.config.cellSize * 2) {
        const matches = [];

        points1.forEach(p1 => {
            let bestMatch = null;
            let minDistance = Infinity;

            points2.forEach(p2 => {
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance && distance < threshold) {
                    minDistance = distance;
                    bestMatch = { p1, p2, distance };
                }
            });

            if (bestMatch) {
                matches.push(bestMatch);
            }
        });

        return matches;
    }
}

module.exports = TemplateBuilder;
