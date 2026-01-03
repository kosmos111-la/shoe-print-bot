// modules/footprint/template-builder-fixed.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ - ПРОСТАЯ И РАБОТАЮЩАЯ

const SimpleGraphMatcher = require('./simple-matcher');

class TemplateBuilderFixed {
    constructor(options = {}) {
        this.id = `template_fixed_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблон протектора (исправленный)';

        // БАЗОВЫЕ ДАННЫЕ
        this.referenceGraph = null;
        this.referenceGraphId = null;
        this.referencePoints = [];

        // ПРОСТАЯ СЕТКА
        this.templateCells = new Map();
        this.cellAssignments = new Map();

        // ИСПОЛЬЗУЕМ СУЩЕСТВУЮЩИЙ МАТЧЕР
        this.matcher = new SimpleGraphMatcher({
            sameThreshold: 0.7,
            similarThreshold: 0.4,
            debug: options.debug || false
        });

        // СТАТИСТИКА
        this.stats = {
            totalGraphs: 0,
            confirmedCells: 0,
            highConfidenceCells: 0,
            avgConfirmations: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        // ПРОСТЫЕ НАСТРОЙКИ
        this.config = {
            cellSize: options.cellSize || 20, // Фиксированный размер ячейки
            confirmationThreshold: 2,
            enablePCA: false, // ОТКЛЮЧАЕМ PCA
            debug: options.debug || false,
            ...options
        };

        console.log(`🏗️ Создан исправленный TemplateBuilder "${this.name}"`);
    }

    // 🔥 ОСНОВНОЙ МЕТОД: УСТАНОВИТЬ ЭТАЛОН
    setReferenceGraph(graph, graphId) {
        console.log(`🎯 Устанавливаю эталонный граф: ${graphId}`);

        if (!graph || !graph.nodes) {
            console.log('❌ Граф не существует');
            return false;
        }

        this.referenceGraph = graph;
        this.referenceGraphId = graphId;

        // Извлекаем точки
        this.referencePoints = this.extractPointsFromGraph(graph);
        console.log(`📊 Извлечено ${this.referencePoints.length} точек эталона`);

        // 🔥 ПРОСТАЯ СЕТКА - ячейка на каждую точку
        this.buildSimpleGrid();

        console.log(`✅ Эталон установлен: ${this.templateCells.size} ячеек`);
        return true;
    }

    // 🔥 ПРОСТАЯ СЕТКА: ячейка на каждую точку эталона
    buildSimpleGrid() {
        console.log(`🔲 Создаю простую сетку на ${this.referencePoints.length} точек...`);

        this.referencePoints.forEach((point, index) => {
            const cellId = `cell_${index}`;
           
            this.templateCells.set(cellId, {
                center: { x: point.x, y: point.y },
                radius: this.config.cellSize / 2,
                points: [point.id],
                confirmations: 1, // Эталон уже подтверждает
                confidence: 0.8,
                sources: new Set([this.referenceGraphId]),
                matchedPoints: [] // Точки, которые попали в эту ячейку
            });

            this.cellAssignments.set(point.id, cellId);
        });

        console.log(`✅ Создано ${this.templateCells.size} ячеек (простая сетка)`);
    }

    // 🔥 ОСНОВНОЙ МЕТОД: ДОБАВИТЬ ГРАФ
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к шаблону...`);

        if (!this.referenceGraph) {
            console.log(`⚠️ Нет эталона! Устанавливаю этот граф как эталон`);
            return this.setReferenceGraph(graph, graphId);
        }

        // Извлекаем точки
        const points = this.extractPointsFromGraph(graph);
        console.log(`📊 Точки для совмещения: ${points.length}`);

        // 🔥 ИСПОЛЬЗУЕМ СУЩЕСТВУЮЩИЙ МАТЧЕР ДЛЯ ТРАНСФОРМАЦИИ
        const matchResult = this.matcher.alignAndCompare(this.referenceGraph, graph);
       
        if (!matchResult.matchedPairs || matchResult.matchedPairs.length === 0) {
            console.log(`❌ Не найдено совпадающих пар точек`);
            return false;
        }

        console.log(`✅ Найдено ${matchResult.matchedPairs.length} совпадающих пар`);

        // 🔥 ПРОСТАЯ ТРАНСФОРМАЦИЯ: используем среднее смещение
        const transformation = this.calculateSimpleTransformation(matchResult.matchedPairs);
       
        // Применяем трансформацию ко всем точкам
        const alignedPoints = points.map(point => {
            return {
                ...point,
                x: point.x + transformation.translation.x,
                y: point.y + transformation.translation.y
            };
        });

        // 🔥 СОПОСТАВЛЯЕМ С ЯЧЕЙКАМИ
        const updatedCells = this.assignPointsToCells(alignedPoints, graphId);

        // Обновляем статистику
        this.stats.totalGraphs++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        console.log(`✅ Граф добавлен: ${updatedCells} ячеек обновлено, схожесть: ${matchResult.similarity.toFixed(3)}`);
        return true;
    }

    // 🔥 ПРОСТАЯ ТРАНСФОРМАЦИЯ: среднее смещение по совпавшим парам
    calculateSimpleTransformation(matchedPairs) {
        if (matchedPairs.length === 0) {
            return { translation: { x: 0, y: 0 }, scale: 1, rotation: 0 };
        }

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
                x: totalDX / matchedPairs.length,
                y: totalDY / matchedPairs.length
            },
            scale: 1,
            rotation: 0
        };
    }

    // 🔥 СОПОСТАВЛЕНИЕ ТОЧЕК С ЯЧЕЙКАМИ
    assignPointsToCells(alignedPoints, graphId) {
        let updatedCells = 0;

        alignedPoints.forEach(point => {
            let bestCell = null;
            let minDistance = Infinity;

            // Ищем ближайшую ячейку
            for (const [cellId, cell] of this.templateCells) {
                const dx = point.x - cell.center.x;
                const dy = point.y - cell.center.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance && distance < this.config.cellSize) {
                    minDistance = distance;
                    bestCell = cellId;
                }
            }

            if (bestCell) {
                // Обновляем ячейку
                const cell = this.templateCells.get(bestCell);
                cell.confirmations++;
                cell.confidence = Math.min(1.0, cell.confidence + 0.1);
                cell.sources.add(graphId);
               
                // Сохраняем, какая точка попала в ячейку
                if (!cell.matchedPoints) cell.matchedPoints = [];
                cell.matchedPoints.push({
                    pointId: point.id,
                    distance: minDistance,
                    confidence: point.confidence
                });

                updatedCells++;
            }
        });

        return updatedCells;
    }

    // 🔥 ОБНОВИТЬ СТАТИСТИКУ
    updateStats() {
        let totalConfirmations = 0;
        let confirmedCells = 0;
        let highConfidenceCells = 0;

        for (const [cellId, cell] of this.templateCells) {
            totalConfirmations += cell.confirmations || 0;

            if (cell.confirmations > 0) {
                confirmedCells++;
            }

            if (cell.confirmations >= this.config.confirmationThreshold) {
                highConfidenceCells++;
            }
        }

        this.stats.confirmedCells = confirmedCells;
        this.stats.highConfidenceCells = highConfidenceCells;
        this.stats.avgConfirmations = this.templateCells.size > 0 ?
            totalConfirmations / this.templateCells.size : 0;
    }

    // 🔥 ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
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
                isHighConfidence: cell.confirmations >= this.config.confirmationThreshold,
                matchedPoints: cell.matchedPoints || []
            });
        }

        return {
            templateId: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            cells: cellsArray,
            stats: {
                ...this.stats,
                cellCount: this.templateCells.size,
                highConfidenceCells: cellsArray.filter(c => c.isHighConfidence).length,
                avgConfirmations: this.stats.avgConfirmations
            },
            referencePoints: this.referencePoints,
            totalGraphs: this.stats.totalGraphs
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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

    // 🔥 ПОЛУЧИТЬ ИНФОРМАЦИЮ
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
            config: {
                cellSize: this.config.cellSize
            }
        };
    }

    // 🔥 СОХРАНИТЬ В JSON
    toJSON() {
        const cellsData = {};
        for (const [cellId, cell] of this.templateCells) {
            cellsData[cellId] = {
                center: cell.center,
                radius: cell.radius,
                confirmations: cell.confirmations,
                confidence: cell.confidence,
                sources: cell.sources ? Array.from(cell.sources) : [],
                matchedPoints: cell.matchedPoints || []
            };
        }

        return {
            id: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            templateCells: cellsData,
            cellAssignments: Object.fromEntries(this.cellAssignments),
            stats: this.stats,
            config: this.config,
            referencePoints: this.referencePoints,
            _version: '2.0_fixed',
            _savedAt: new Date().toISOString()
        };
    }

    // 🔥 ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        const builder = new TemplateBuilderFixed({
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

        // Восстановить привязки
        if (data.cellAssignments) {
            for (const [pointId, cellId] of Object.entries(data.cellAssignments)) {
                builder.cellAssignments.set(pointId, cellId);
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

        builder.referencePoints = data.referencePoints || [];

        console.log(`📂 Загружен исправленный TemplateBuilder "${builder.name}"`);
        return builder;
    }
}

module.exports = TemplateBuilderFixed;
