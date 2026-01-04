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

        // 🔥 ИНВАРИАНТНАЯ АРХИТЕКТУРА
        this.referenceGraph = null;
        this.referenceGraphId = null;
        this.referencePoints = [];

        // 🔥 НОРМАЛИЗОВАННЫЕ ДАННЫЕ
        this.normalizedReferencePoints = [];
        this.normalizationTransform = null;

        // 🔥 ИНВАРИАНТНЫЕ ЯЧЕЙКИ (на основе относительных позиций)
        this.templateCells = new Map();
        this.cellAssignments = new Map();
        this.invariantCells = new Map(); // 🔥 НОВОЕ: инвариантные ячейки

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
            lastUpdated: new Date()
        };

        // 🔥 НАСТРОЙКИ С ИНВАРИАНТНОСТЬЮ
        this.config = {
            minPointsForReference: options.minPointsForReference || 3,
            cellSize: options.cellSize || 25,
            confirmationThreshold: options.confirmationThreshold || 2,
            highConfidenceThreshold: options.highConfidenceThreshold || 3,
            maxAlignmentError: options.maxAlignmentError || 100,
            enablePCA: false, // 🔥 ОТКЛЮЧАЕМ
            enableInvariantGrid: true, // 🔥 ВКЛЮЧАЕМ ИНВАРИАНТНОСТЬ
            useRelativeCoordinates: true, // 🔥 ИСПОЛЬЗУЕМ ОТНОСИТЕЛЬНЫЕ КООРДИНАТЫ
            debug: options.debug || false,
            ...options
        };

        console.log(`🏗️ Создан TemplateBuilder "${this.name}" с инвариантностью`);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: УСТАНОВИТЬ ЭТАЛОННЫЙ ГРАФ С ИНВАРИАНТНОСТЬЮ
    setReferenceGraph(graph, graphId, metadata = {}) {
        console.log(`🎯 Устанавливаю эталонный граф с ИНВАРИАНТНОСТЬЮ: ${graphId}`);

        if (!graph || !graph.nodes) {
            console.log(`❌ Граф не существует`);
            return false;
        }

        this.referenceGraph = graph;
        this.referenceGraphId = graphId;

        // 1. Извлекаем точки
        this.referencePoints = this.extractPointsFromGraph(graph);
        console.log(`📊 Извлечено ${this.referencePoints.length} точек эталона`);

        // 2. 🔥 НОРМАЛИЗУЕМ БЕЗ ПОВРЕЖДЕНИЯ КООРДИНАТ
        this.normalizeReferencePoints();

        // 3. 🔥 СОЗДАЕМ ИНВАРИАНТНУЮ СЕТКУ
        this.buildInvariantGrid();

        // 4. Сохраняем топологию
        this.extractTopologyFromGraph(graph);

        console.log(`✅ Эталон установлен с инвариантностью: ${this.invariantCells.size} ячеек`);
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: НОРМАЛИЗАЦИЯ БЕЗ ПОВРЕЖДЕНИЯ
    normalizeReferencePoints() {
        if (this.referencePoints.length === 0) return;

        const bounds = this.calculateBounds(this.referencePoints);

        // Сохраняем трансформацию нормализации
        this.normalizationTransform = {
            minX: bounds.minX,
            minY: bounds.minY,
            width: bounds.width,
            height: bounds.height,
            scale: Math.max(bounds.width, bounds.height) > 0 ?
                   1000 / Math.max(bounds.width, bounds.height) : 1
        };

        // Нормализуем к относительным координатам [0, 1]
        this.normalizedReferencePoints = this.referencePoints.map(point => ({
            ...point,
            nx: (point.x - bounds.minX) / Math.max(1, bounds.width),  // [0, 1]
            ny: (point.y - bounds.minY) / Math.max(1, bounds.height), // [0, 1]
            normalized: true
        }));

        console.log(`📐 Нормализовано: (${bounds.minX},${bounds.minY}) → ширина=${bounds.width}, высота=${bounds.height}`);
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: ДОБАВИТЬ ГРАФ С ИНВАРИАНТНОСТЬЮ
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} с ИНВАРИАНТНОСТЬЮ...`);

        if (!this.referenceGraph) {
            return this.setReferenceGraph(graph, graphId, metadata);
        }

        // 1. Извлекаем и нормализуем точки нового графа
        const points = this.extractPointsFromGraph(graph);
        const normalizedPoints = this.normalizePoints(points, this.normalizationTransform);

        console.log(`📊 Нормализовано ${normalizedPoints.length} точек`);

        // 2. 🔥 ИНВАРИАНТНОЕ СОПОСТАВЛЕНИЕ
        const invariantMatches = this.findInvariantMatches(normalizedPoints);

        if (invariantMatches.length < this.referencePoints.length * 0.3) {
            console.log(`❌ Недостаточно инвариантных совпадений: ${invariantMatches.length}`);
            return false;
        }

        console.log(`✅ Найдено ${invariantMatches.length} инвариантных совпадений`);

        // 3. Обновить подтверждения
        const updatedCells = this.updateInvariantCells(invariantMatches, graphId);

        // 4. Сохранить трансформацию
        this.graphTransformations.set(graphId, {
            metadata: metadata,
            timestamp: new Date(),
            pointsCount: points.length,
            invariantMatches: invariantMatches.length,
            matchedRatio: invariantMatches.length / Math.max(1, this.referencePoints.length)
        });

        // 5. Обновить статистику
        this.stats.totalGraphs++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        console.log(`✅ Граф добавлен с инвариантностью: ${updatedCells} ячеек обновлено`);
        return true;
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

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ИНВАРИАНТНОСТИ
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
        this.stats.avgConfirmations = this.invariantCells.size > 0 ?
            totalConfirmations / this.invariantCells.size : 0;
    }

    getVisualizationData() {
        const cellsArray = [];

        for (const [cellId, cell] of this.invariantCells) {
            cellsArray.push({
                id: cellId,
                x: cell.originalCenter.x,
                y: cell.originalCenter.y,
                nx: cell.normalizedCenter.nx,
                ny: cell.normalizedCenter.ny,
                radius: cell.radius * 100, // Масштабируем для визуализации
                confirmations: cell.confirmations || 0,
                confidence: cell.confidence || 0,
                sources: cell.sources ? Array.from(cell.sources) : [],
                pointCount: cell.points ? cell.points.length : 0,
                isHighConfidence: cell.confirmations >= this.config.highConfidenceThreshold,
                invariants: cell.invariants ? 'present' : 'none'
            });
        }

        // Рассчитать статистику по зонам
        const zones = this.calculateZones();

        return {
            templateId: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            cells: cellsArray,
            stats: {
                ...this.stats,
                zones: zones,
                cellCount: this.invariantCells.size,
                highConfidenceCells: cellsArray.filter(c => c.isHighConfidence).length,
                avgConfirmations: this.stats.avgConfirmations,
                invariantCells: this.invariantCells.size
            },
            referencePoints: this.normalizedReferencePoints,
            transformationsCount: this.graphTransformations.size,
            normalizationTransform: this.normalizationTransform
        };
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

    getInfo() {
        return {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU'),
                invariantCells: this.invariantCells.size
            },
            referenceGraphId: this.referenceGraphId,
            templateCells: this.templateCells.size,
            invariantCells: this.invariantCells.size,
            cellConnections: this.cellConnections.size,
            totalGraphs: this.stats.totalGraphs,
            config: {
                ...this.config,
                cellSize: this.config.cellSize
            }
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
                invariants: cell.invariants
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

        return {
            id: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            invariantCells: invariantCellsData,
            templateCells: templateCellsData,
            cellConnections: Object.fromEntries(this.cellConnections),
            cellAssignments: Object.fromEntries(this.cellAssignments),
            graphTransformations: transformationsData,
            stats: this.stats,
            config: this.config,
            referencePoints: this.normalizedReferencePoints,
            normalizationTransform: this.normalizationTransform,
            _version: '2.0-invariant',
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
        builder.normalizationTransform = data.normalizationTransform || null;

        // Восстановить инвариантные ячейки
        if (data.invariantCells) {
            for (const [cellId, cellData] of Object.entries(data.invariantCells)) {
                builder.invariantCells.set(cellId, {
                    ...cellData,
                    sources: new Set(cellData.sources || [])
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

        console.log(`📂 Загружен TemplateBuilder "${builder.name}" с ${builder.invariantCells.size} инвариантными ячейками`);
        return builder;
    }
}

module.exports = TemplateBuilder;
