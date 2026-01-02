// ШАБЛОННАЯ МОДЕЛЬ СУПЕР-МОДЕЛИ - заменяет простой merge

class TemplateBuilder {
    constructor(options = {}) {
        this.id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблон протектора';
       
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
       
        // 🔥 НАСТРОЙКИ
        this.config = {
            minPointsForReference: options.minPointsForReference || 15,
            cellSize: options.cellSize || 20, // Размер ячейки в пикселях (после нормализации)
            confirmationThreshold: options.confirmationThreshold || 2,
            highConfidenceThreshold: options.highConfidenceThreshold || 3,
            maxAlignmentError: options.maxAlignmentError || 0.15,
            enablePCA: options.enablePCA !== false, // Определение оси стопы
            enableAdaptiveGrid: options.enableAdaptiveGrid !== false,
            ...options
        };
       
        console.log(`🏗️ Создан TemplateBuilder "${this.name}"`);
    }
   
    // 🔥 ОСНОВНОЙ МЕТОД 1: УСТАНОВИТЬ ЭТАЛОННЫЙ ГРАФ
    setReferenceGraph(graph, graphId, metadata = {}) {
        console.log(`🎯 Устанавливаю эталонный граф: ${graphId}`);
       
        if (!graph || !graph.nodes || graph.nodes.size < this.config.minPointsForReference) {
            console.log(`⚠️ Граф слишком мал для эталона: ${graph?.nodes?.size || 0} узлов`);
            return false;
        }
       
        this.referenceGraph = graph;
        this.referenceGraphId = graphId;
       
        // Извлекаем точки из графа
        this.referencePoints = this.extractPointsFromGraph(graph);
        console.log(`📊 Извлечено ${this.referencePoints.length} точек эталона`);
       
        // 1. ОПРЕДЕЛЯЕМ ОСЬ СТОПЫ (PCA)
        if (this.config.enablePCA) {
            this.alignToFootAxis();
        }
       
        // 2. СОЗДАЕМ АДАПТИВНУЮ СЕТКУ
        this.buildAdaptiveGrid();
       
        // 3. СОХРАНЯЕМ ТОПОЛОГИЮ (связи между ячейками)
        this.extractTopologyFromGraph(graph);
       
        console.log(`✅ Эталон установлен: ${this.templateCells.size} ячеек шаблона`);
        return true;
    }
   
    // 🔥 ОСНОВНОЙ МЕТОД 2: ДОБАВИТЬ ГРАФ К ШАБЛОНУ
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к шаблону...`);
       
        if (!this.referenceGraph) {
            console.log(`⚠️ Нет эталона! Устанавливаю этот граф как эталон`);
            return this.setReferenceGraph(graph, graphId, metadata);
        }
       
        // Извлекаем точки из графа
        const points = this.extractPointsFromGraph(graph);
        console.log(`📊 Точки для совмещения: ${points.length}`);
       
        // 1. НАЙТИ ТРАНСФОРМАЦИЮ К ЭТАЛОНУ
        const transformation = this.findTransformation(points, graphId);
       
        if (!transformation || transformation.error > this.config.maxAlignmentError) {
            console.log(`❌ Ошибка совмещения: ${transformation?.error || 'unknown'}`);
            return false;
        }
       
        // 2. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
        const alignedPoints = this.applyTransformation(points, transformation);
       
        // 3. СОПОСТАВИТЬ С ЯЧЕЙКАМИ ШАБЛОНА
        const assignments = this.assignToCells(alignedPoints, graphId);
       
        // 4. ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ В ЯЧЕЙКАХ
        const updatedCells = this.updateCellConfirmations(assignments, graphId);
       
        // 5. СОХРАНИТЬ ТРАНСФОРМАЦИЮ
        this.graphTransformations.set(graphId, {
            ...transformation,
            metadata: metadata,
            timestamp: new Date(),
            pointsCount: points.length,
            alignedPointsCount: alignedPoints.length,
            assignedCells: assignments.size
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
   
    // 🔥 ОСНОВНОЙ МЕТОД 3: ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
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
                isHighConfidence: cell.confirmations >= this.config.highConfidenceThreshold
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
   
    // 🔥 МЕТОД: ВЫРАВНИВАНИЕ ПО ОСИ СТОПЫ (PCA)
    alignToFootAxis() {
        if (this.referencePoints.length < 3) return;
       
        console.log(`🧭 Определяю ось стопы (PCA)...`);
       
        // 1. ВЫЧИСЛИТЬ ЦЕНТР МАСС
        const center = this.calculateCenter(this.referencePoints);
       
        // 2. ЦЕНТРИРОВАТЬ ТОЧКИ
        const centeredPoints = this.referencePoints.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y
        }));
       
        // 3. ВЫЧИСЛИТЬ КОВАРИАЦИОННУЮ МАТРИЦУ
        const covMatrix = this.calculateCovarianceMatrix(centeredPoints);
       
        // 4. НАЙТИ СОБСТВЕННЫЕ ВЕКТОРЫ (главные оси)
        const eigenvectors = this.calculateEigenvectors(covMatrix);
       
        // 5. ПОВЕРНУТЬ К ГОРИЗОНТАЛИ (главная ось = ось X)
        const rotationAngle = Math.atan2(eigenvectors[0].y, eigenvectors[0].x);
        this.applyRotation(-rotationAngle);
       
        console.log(`🎯 Поворот на ${(-rotationAngle * 180 / Math.PI).toFixed(1)}°`);
    }
   
    // 🔥 МЕТОД: ПОСТРОИТЬ АДАПТИВНУЮ СЕТКУ
    buildAdaptiveGrid() {
        console.log(`🔲 Строю адаптивную сетку...`);
       
        // 1. DBSCAN КЛАСТЕРИЗАЦИЯ для определения плотности
        const clusters = this.performDBSCAN(this.referencePoints);
       
        // 2. СОЗДАТЬ ЯЧЕЙКИ ВОКРУГ КЛАСТЕРОВ
        clusters.forEach((cluster, clusterIndex) => {
            if (cluster.points.length < 2) return;
           
            // Вычислить центр кластера
            const center = this.calculateCenter(cluster.points);
           
            // Определить радиус кластера
            const radius = this.calculateClusterRadius(cluster.points, center);
           
            // Создать ячейку
            const cellId = `cell_${clusterIndex}`;
            this.templateCells.set(cellId, {
                center: center,
                radius: radius,
                points: cluster.points.map(p => p.id),
                confirmations: 1, // Эталон уже подтверждает
                confidence: 0.7,
                sources: new Set([this.referenceGraphId]),
                clusterSize: cluster.points.length
            });
           
            // Привязать точки к ячейке
            cluster.points.forEach(point => {
                this.cellAssignments.set(point.id, cellId);
            });
        });
       
        console.log(`✅ Создано ${this.templateCells.size} ячеек адаптивной сетки`);
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
   
    // 🔥 МЕТОД: НАЙТИ ТРАНСФОРМАЦИЮ К ЭТАЛОНУ
    findTransformation(points, graphId) {
        if (points.length < 3 || this.referencePoints.length < 3) {
            console.log(`⚠️ Слишком мало точек для трансформации`);
            return null;
        }
       
        console.log(`🔍 Ищу трансформацию для графа ${graphId}...`);
       
        // Упрощенный алгоритм (можно заменить на RANSAC/ICP)
        // 1. Сопоставить ключевые точки
        const matches = this.findPointMatches(points, this.referencePoints);
       
        if (matches.length < 3) {
            console.log(`❌ Недостаточно совпадений: ${matches.length}`);
            return null;
        }
       
        // 2. Вычислить трансформацию по совпавшим точкам
        const transform = this.calculateTransformation(matches);
       
        // 3. Оценить ошибку
        const error = this.calculateAlignmentError(points, transform, matches);
       
        console.log(`📐 Трансформация: scale=${transform.scale.toFixed(2)}, ` +
                   `rotation=${(transform.rotation * 180 / Math.PI).toFixed(1)}°, ` +
                   `error=${error.toFixed(3)}`);
       
        return {
            ...transform,
            error: error,
            matches: matches.length
        };
    }
   
    // 🔥 МЕТОД: ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
    applyTransformation(points, transformation) {
        return points.map(point => {
            // Поворот
            const cos = Math.cos(transformation.rotation);
            const sin = Math.sin(transformation.rotation);
           
            const rotatedX = point.x * cos - point.y * sin;
            const rotatedY = point.x * sin + point.y * cos;
           
            // Масштабирование
            const scaledX = rotatedX * transformation.scale;
            const scaledY = rotatedY * transformation.scale;
           
            // Смещение
            const alignedX = scaledX + transformation.translation.x;
            const alignedY = scaledY + transformation.translation.y;
           
            return {
                id: point.id,
                x: alignedX,
                y: alignedY,
                originalX: point.x,
                originalY: point.y,
                confidence: point.confidence,
                originalNode: point.originalNode
            };
        });
    }
   
    // 🔥 МЕТОД: СОПОСТАВИТЬ С ЯЧЕЙКАМИ ШАБЛОНА
    assignToCells(alignedPoints, graphId) {
        const assignments = new Map(); // pointId -> cellId
       
        alignedPoints.forEach(point => {
            let bestCell = null;
            let minDistance = Infinity;
           
            // Ищем ближайшую ячейку
            for (const [cellId, cell] of this.templateCells) {
                const dx = point.x - cell.center.x;
                const dy = point.y - cell.center.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                // Расстояние должно быть меньше радиуса ячейки
                if (distance < minDistance && distance < (cell.radius || this.config.cellSize)) {
                    minDistance = distance;
                    bestCell = cellId;
                }
            }
           
            if (bestCell) {
                assignments.set(point.id, bestCell);
               
                // Добавить точку в ячейку
                const cell = this.templateCells.get(bestCell);
                if (!cell.assignedPoints) cell.assignedPoints = [];
                cell.assignedPoints.push({
                    id: point.id,
                    x: point.x,
                    y: point.y,
                    graphId: graphId,
                    confidence: point.confidence
                });
            }
        });
       
        console.log(`📍 Сопоставлено ${assignments.size}/${alignedPoints.length} точек с ячейками`);
        return assignments;
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
   
    // 🔥 МЕТОД: ВСПОМОГАТЕЛЬНЫЙ - DBSCAN
    performDBSCAN(points, eps = this.config.cellSize * 1.5, minPts = 2) {
        const clusters = [];
        const visited = new Set();
        const noise = new Set();
       
        points.forEach((point, index) => {
            if (visited.has(point.id)) return;
           
            visited.add(point.id);
           
            // Найти соседей
            const neighbors = this.findNeighbors(points, point, eps);
           
            if (neighbors.length < minPts) {
                noise.add(point.id);
            } else {
                // Расширить кластер
                const cluster = { points: [point] };
                this.expandCluster(points, point, neighbors, cluster, visited, eps, minPts);
                clusters.push(cluster);
            }
        });
       
        return clusters;
    }
   
    // 🔥 МЕТОД: РАСШИРИТЬ КЛАСТЕР
    expandCluster(points, point, neighbors, cluster, visited, eps, minPts) {
        neighbors.forEach(neighborId => {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                const neighbor = points.find(p => p.id === neighborId);
                const neighborNeighbors = this.findNeighbors(points, neighbor, eps);
               
                if (neighborNeighbors.length >= minPts) {
                    neighbors.push(...neighborNeighbors.filter(n => !neighbors.includes(n)));
                }
            }
           
            // Добавить в кластер, если еще не добавлен
            if (!cluster.points.some(p => p.id === neighborId)) {
                const neighbor = points.find(p => p.id === neighborId);
                if (neighbor) {
                    cluster.points.push(neighbor);
                }
            }
        });
    }
   
    // 🔥 МЕТОД: НАЙТИ СОСЕДЕЙ
    findNeighbors(points, point, eps) {
        const neighbors = [];
       
        points.forEach(p => {
            if (p.id === point.id) return;
           
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
           
            if (distance <= eps) {
                neighbors.push(p.id);
            }
        });
       
        return neighbors;
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
   
    calculateCovarianceMatrix(points) {
        if (points.length < 2) return [[0, 0], [0, 0]];
       
        const n = points.length;
        let covXX = 0, covYY = 0, covXY = 0;
       
        points.forEach(p => {
            covXX += p.x * p.x;
            covYY += p.y * p.y;
            covXY += p.x * p.y;
        });
       
        return [
            [covXX / n, covXY / n],
            [covXY / n, covYY / n]
        ];
    }
   
    calculateEigenvectors(matrix) {
        // Упрощенный расчет для 2x2 матрицы
        const a = matrix[0][0];
        const b = matrix[0][1];
        const c = matrix[1][1];
       
        // Собственные значения
        const trace = a + c;
        const determinant = a * c - b * b;
        const discriminant = trace * trace - 4 * determinant;
       
        if (discriminant < 0) {
            return [{ x: 1, y: 0 }, { x: 0, y: 1 }];
        }
       
        const sqrtDisc = Math.sqrt(discriminant);
        const lambda1 = (trace + sqrtDisc) / 2;
        const lambda2 = (trace - sqrtDisc) / 2;
       
        // Собственные векторы
        const eigenvec1 = { x: b, y: lambda1 - a };
        const eigenvec2 = { x: b, y: lambda2 - a };
       
        // Нормализовать
        const len1 = Math.sqrt(eigenvec1.x * eigenvec1.x + eigenvec1.y * eigenvec1.y);
        const len2 = Math.sqrt(eigenvec2.x * eigenvec2.x + eigenvec2.y * eigenvec2.y);
       
        return [
            { x: eigenvec1.x / len1, y: eigenvec1.y / len1 },
            { x: eigenvec2.x / len2, y: eigenvec2.y / len2 }
        ];
    }
   
    applyRotation(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
       
        this.referencePoints = this.referencePoints.map(p => ({
            ...p,
            x: p.x * cos - p.y * sin,
            y: p.x * sin + p.y * cos
        }));
    }
   
    calculateClusterRadius(points, center) {
        if (points.length === 0) return this.config.cellSize / 2;
       
        const maxDistance = Math.max(...points.map(p => {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            return Math.sqrt(dx * dx + dy * dy);
        }));
       
        return Math.max(this.config.cellSize / 2, maxDistance * 1.2);
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
   
    calculateTransformation(matches) {
        if (matches.length < 3) {
            return {
                scale: 1,
                rotation: 0,
                translation: { x: 0, y: 0 },
                error: 1
            };
        }
       
        // Упрощенный расчет: центры масс
        const center1 = this.calculateCenter(matches.map(m => m.p1));
        const center2 = this.calculateCenter(matches.map(m => m.p2));
       
        // Среднее смещение
        const translation = {
            x: center2.x - center1.x,
            y: center2.y - center1.y
        };
       
        // Упрощенный масштаб и поворот
        let scaleSum = 0;
        let rotationSum = 0;
       
        matches.forEach(match => {
            const dx1 = match.p1.x - center1.x;
            const dy1 = match.p1.y - center1.y;
            const dx2 = match.p2.x - center2.x;
            const dy2 = match.p2.y - center2.y;
           
            const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
           
            if (dist1 > 0 && dist2 > 0) {
                scaleSum += dist2 / dist1;
               
                const angle1 = Math.atan2(dy1, dx1);
                const angle2 = Math.atan2(dy2, dx2);
                rotationSum += angle2 - angle1;
            }
        });
       
        return {
            scale: scaleSum / matches.length,
            rotation: rotationSum / matches.length,
            translation: translation,
            error: 0
        };
    }
   
    calculateAlignmentError(points, transform, matches) {
        if (matches.length === 0) return 1;
       
        let totalError = 0;
       
        matches.forEach(match => {
            const aligned = this.applyTransformation([match.p1], transform)[0];
            const dx = aligned.x - match.p2.x;
            const dy = aligned.y - match.p2.y;
            totalError += Math.sqrt(dx * dx + dy * dy);
        });
       
        return totalError / matches.length;
    }
}

module.exports = TemplateBuilder;
