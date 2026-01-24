// modules/footprint/vector-template-builder.js
const crypto = require('crypto');

class VectorTemplateBuilder {
    constructor(options = {}) {
        this.id = options.id || `template_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || 'Векторный шаблон';
        this.createdAt = new Date();
        this.lastUpdated = new Date();

        // Инвариантные ячейки - основные строительные блоки шаблона
        this.invariantCells = new Map(); // Map<cellId, Cell>

        // Статистика
        this.stats = {
            totalGraphsProcessed: 0,
            totalCellsCreated: 0,
            totalCellsMerged: 0,
            totalCellsRemoved: 0,
            avgCellConfidence: 0,
            avgCellConfirmations: 0
        };

        // Настройки
        this.settings = {
            cellSize: options.cellSize || 20, // размер ячейки в px
            minConfidence: options.minConfidence || 0.3,
            minConfirmations: options.minConfirmations || 2,
            enableAdaptiveCells: options.enableAdaptiveCells !== false,
            maxCells: options.maxCells || 1000,
            debugMode: options.debugMode || false
        };

        console.log(`🏗️  Создан VectorTemplateBuilder "${this.name}" (ID: ${this.id})`);
    }

    // 🔥 НОВЫЙ МЕТОД: Получить статистику
    getStats() {
        const cells = Array.from(this.invariantCells?.values() || []);

        let totalConfirmations = 0;
        let totalConfidence = 0;
        let highConfidenceCells = 0;
        let confirmedCells = 0;

        cells.forEach(cell => {
            totalConfirmations += cell.confirmations || 0;
            totalConfidence += cell.confidence || 0;
           
            if ((cell.confidence || 0) > 0.8) {
                highConfidenceCells++;
            }
           
            if ((cell.confirmations || 0) >= 2) {
                confirmedCells++;
            }
        });

        return {
            cells: cells.length,
            totalConfirmations: totalConfirmations,
            averageConfirmations: cells.length > 0 ? totalConfirmations / cells.length : 0,
            avgConfidence: cells.length > 0 ? totalConfidence / cells.length : 0,
            highConfidenceCells: highConfidenceCells,
            confirmedCells: confirmedCells,
            totalGraphsProcessed: this.stats.totalGraphsProcessed || 0,
            lastUpdated: this.lastUpdated
        };
    }

    // Установить эталонный граф
    setReferenceGraph(graph, graphId, metadata = {}) {
        console.log(`🎯 Устанавливаю эталонный граф ${graphId}...`);

        if (!graph || !graph.nodes || graph.nodes.size === 0) {
            console.log('⚠️ Граф пустой');
            return false;
        }

        // Очищаем существующие ячейки
        this.invariantCells.clear();

        // Извлекаем точки из графа
        const points = this.extractPointsFromGraph(graph);

        if (points.length < 3) {
            console.log(`⚠️ Недостаточно точек: ${points.length}`);
            return false;
        }

        // Создаем ячейки из точек
        let cellsCreated = 0;

        points.forEach((point, index) => {
            const cellId = this.generateCellId(point);

            // Создаем нормализованные координаты [0, 1]
            const normalizedCenter = this.normalizePoint(point);

            const cell = {
                id: cellId,
                originalPoint: point,
                normalizedCenter: normalizedCenter,
                confirmations: 1,
                confidence: point.confidence || 0.5,
                graphs: new Set([graphId]),
                firstSeen: new Date(),
                lastUpdated: new Date(),
                metadata: {
                    ...metadata,
                    sourceGraph: graphId,
                    sourcePointId: point.id
                }
            };

            this.invariantCells.set(cellId, cell);
            cellsCreated++;
        });

        this.stats.totalGraphsProcessed = 1;
        this.stats.totalCellsCreated = cellsCreated;
        this.updateStats();

        console.log(`✅ Эталонный граф установлен: создано ${cellsCreated} ячеек`);
        return true;
    }

    // Добавить граф к шаблону
    addGraph(graph, graphId, metadata = {}) {
        console.log(`➕ Добавляю граф ${graphId} к шаблону...`);
        this.stats.totalGraphsProcessed++;

        const points = this.extractPointsFromGraph(graph);

        if (points.length < 3) {
            console.log(`⚠️ Недостаточно точек: ${points.length}`);
            return false;
        }

        let cellsMerged = 0;
        let cellsCreated = 0;

        points.forEach(point => {
            const normalizedPoint = this.normalizePoint(point);
            const existingCell = this.findMatchingCell(normalizedPoint);

            if (existingCell) {
                // Обновляем существующую ячейку
                this.updateCell(existingCell, point, graphId, metadata);
                cellsMerged++;
            } else {
                // Создаем новую ячейку
                const cellId = this.generateCellId(point);
                const cell = this.createCell(cellId, point, graphId, metadata);
                this.invariantCells.set(cellId, cell);
                cellsCreated++;
            }
        });

        this.stats.totalCellsMerged += cellsMerged;
        this.stats.totalCellsCreated += cellsCreated;
        this.updateStats();

        console.log(`✅ Граф добавлен: ${cellsMerged} объединено, ${cellsCreated} создано`);
        return true;
    }

    // Сравнить граф с шаблоном
    compareGraphWithTemplate(graph, options = {}) {
        console.log(`🔍 Сравниваю граф с шаблоном...`);

        const points = this.extractPointsFromGraph(graph);

        if (points.length === 0) {
            return {
                similarity: 0,
                decision: 'no_points',
                matches: 0,
                totalPoints: 0
            };
        }

        if (this.invariantCells.size === 0) {
            return {
                similarity: 0,
                decision: 'no_template',
                matches: 0,
                totalPoints: points.length
            };
        }

        let matches = 0;
        const matchedCells = [];

        points.forEach(point => {
            const normalizedPoint = this.normalizePoint(point);
            const matchingCell = this.findMatchingCell(normalizedPoint, options.matchThreshold || 0.1);

            if (matchingCell) {
                matches++;
                matchedCells.push({
                    point,
                    cell: matchingCell,
                    distance: this.calculateDistance(normalizedPoint, matchingCell.normalizedCenter)
                });
            }
        });

        const similarity = matches / Math.max(points.length, this.invariantCells.size);
        let decision;

        if (similarity > 0.7) {
            decision = 'same';
        } else if (similarity > 0.4) {
            decision = 'similar';
        } else {
            decision = 'different';
        }

        return {
            similarity: Math.round(similarity * 1000) / 1000,
            decision,
            matches,
            totalPoints: points.length,
            totalCells: this.invariantCells.size,
            matchPercentage: (matches / points.length) * 100,
            matchedCells: options.detailed ? matchedCells : undefined,
            timestamp: new Date()
        };
    }

    // Валидация шаблона
    validate(force = false) {
        console.log(`✅ Валидация шаблона...`);

        const errors = [];
        const warnings = [];

        // Проверяем наличие ячеек
        if (this.invariantCells.size === 0) {
            warnings.push('Шаблон пустой - нет инвариантных ячеек');
        }

        // Проверяем среднюю уверенность
        let totalConfidence = 0;
        let totalConfirmations = 0;
        let lowConfidenceCells = 0;
        let unconfirmedCells = 0;

        for (const [cellId, cell] of this.invariantCells) {
            totalConfidence += cell.confidence || 0;
            totalConfirmations += cell.confirmations || 0;

            if (cell.confidence < this.settings.minConfidence) {
                lowConfidenceCells++;
            }

            if (cell.confirmations < this.settings.minConfirmations) {
                unconfirmedCells++;
            }
        }

        const avgConfidence = this.invariantCells.size > 0 ? totalConfidence / this.invariantCells.size : 0;
        const avgConfirmations = this.invariantCells.size > 0 ? totalConfirmations / this.invariantCells.size : 0;

        if (avgConfidence < 0.5) {
            warnings.push(`Низкая средняя уверенность: ${avgConfidence.toFixed(3)}`);
        }

        if (lowConfidenceCells > 0) {
            warnings.push(`${lowConfidenceCells} ячеек с уверенностью < ${this.settings.minConfidence}`);
        }

        if (unconfirmedCells > 0) {
            warnings.push(`${unconfirmedCells} ячеек с подтверждениями < ${this.settings.minConfirmations}`);
        }

        // Проверяем максимальное количество ячеек
        if (this.invariantCells.size > this.settings.maxCells * 0.9) {
            warnings.push(`Шаблон почти заполнен: ${this.invariantCells.size}/${this.settings.maxCells} ячеек`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            stats: {
                totalCells: this.invariantCells.size,
                avgConfidence,
                avgConfirmations,
                lowConfidenceCells,
                unconfirmedCells,
                lastValidation: new Date()
            }
        };
    }

    // Получить информацию о шаблоне
    getInfo(detailed = false) {
        const validation = this.validate();

        const info = {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt,
            lastUpdated: this.lastUpdated,
            cellsCount: this.invariantCells.size,
            highConfidenceCells: Array.from(this.invariantCells.values())
                .filter(cell => cell.confidence >= 0.7).length,
            avgConfidence: validation.stats?.avgConfidence || 0,
            avgConfirmations: validation.stats?.avgConfirmations || 0,
            validation: validation.valid ? 'VALID' : 'INVALID',
            warnings: validation.warnings.length,
            lastValidation: validation.stats?.lastValidation || null
        };

        if (detailed) {
            info.cellsByConfidence = {
                '0.0-0.3': Array.from(this.invariantCells.values()).filter(c => c.confidence < 0.3).length,
                '0.3-0.5': Array.from(this.invariantCells.values()).filter(c => c.confidence >= 0.3 && c.confidence < 0.5).length,
                '0.5-0.7': Array.from(this.invariantCells.values()).filter(c => c.confidence >= 0.5 && c.confidence < 0.7).length,
                '0.7-1.0': Array.from(this.invariantCells.values()).filter(c => c.confidence >= 0.7).length
            };

            info.cellsByConfirmations = {
                '1': Array.from(this.invariantCells.values()).filter(c => c.confirmations === 1).length,
                '2': Array.from(this.invariantCells.values()).filter(c => c.confirmations === 2).length,
                '3': Array.from(this.invariantCells.values()).filter(c => c.confirmations === 3).length,
                '4+': Array.from(this.invariantCells.values()).filter(c => c.confirmations >= 4).length
            };
        }

        return info;
    }

    // Получить данные для визуализации
    getVisualizationData(options = {}) {
        console.log(`🎨 Получаю данные для визуализации шаблона...`);

        const data = {
            id: this.id,
            name: this.name,
            cellsCount: this.invariantCells.size,
            points: [],
            cells: [],
            stats: this.getStats(), // 🔥 ТЕПЕРЬ МЕТОД СУЩЕСТВУЕТ
            metadata: {
                createdAt: this.createdAt,
                lastUpdated: this.lastUpdated,
                referenceGraphId: this.referenceGraphId,
                totalGraphsAdded: this.totalGraphsAdded
            }
        };

        // Преобразуем ячейки в точки для визуализации
        if (this.invariantCells && this.invariantCells.size > 0) {
            for (const [cellId, cell] of this.invariantCells) {
                // Точка центра ячейки
                data.points.push({
                    id: cellId,
                    x: cell.normalizedCenter.nx * 1000, // Преобразуем к [0, 1000]
                    y: cell.normalizedCenter.ny * 1000,
                    confidence: cell.confidence,
                    confirmations: cell.confirmations,
                    totalGraphs: cell.totalGraphs || 1,
                    isInvariant: cell.isInvariant || false,
                    type: 'template_cell'
                });

                // Данные ячейки
                data.cells.push({
                    id: cellId,
                    center: cell.normalizedCenter,
                    confirmations: cell.confirmations,
                    confidence: cell.confidence,
                    totalGraphs: cell.totalGraphs || 1,
                    lastUpdated: cell.lastUpdated,
                    isInvariant: cell.isInvariant || false,
                    features: cell.features || []
                });
            }
        }

        // Если нужны данные референсного графа
        if (options.includeReferenceGraph && this.referenceGraph) {
            data.referenceGraph = {
                nodes: Array.from(this.referenceGraph.nodes?.values() || []).map(node => ({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence
                })),
                edges: Array.from(this.referenceGraph.edges?.values() || []).map(edge => ({
                    source: edge.source,
                    target: edge.target,
                    weight: edge.weight
                }))
            };
        }

        console.log(`✅ Подготовлено ${data.points.length} точек для визуализации`);
        return data;
    }

    // Получить простые данные для визуализации
    getSimpleVisualizationData() {
        const points = [];

        if (this.invariantCells && this.invariantCells.size > 0) {
            for (const [cellId, cell] of this.invariantCells) {
                // Преобразуем nx/ny к пикселям (диапазон 0-1000)
                const x = cell.normalizedCenter.nx * 1000;
                const y = cell.normalizedCenter.ny * 1000;

                // Определяем цвет по уверенности
                let color;
                if (cell.confidence > 0.8) {
                    color = '#4CAF50'; // Зеленый - высокая уверенность
                } else if (cell.confidence > 0.5) {
                    color = '#FFC107'; // Желтый - средняя уверенность
                } else {
                    color = '#F44336'; // Красный - низкая уверенность
                }

                // Размер по количеству подтверждений
                const size = 4 + Math.min(cell.confirmations, 10);

                points.push({
                    id: cellId,
                    x: x,
                    y: y,
                    color: color,
                    size: size,
                    confidence: cell.confidence,
                    confirmations: cell.confirmations,
                    label: `Уверенность: ${(cell.confidence * 100).toFixed(0)}%`
                });
            }
        }

        return {
            points: points,
            cellCount: this.invariantCells?.size || 0,
            avgConfidence: this.getStats().avgConfidence,
            totalConfirmations: this.getStats().totalConfirmations
        };
    }

    // Вспомогательные методы

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

    normalizePoint(point) {
        // Простая нормализация к [0, 1] на основе текущих границ
        // В реальной реализации нужно использовать общие границы

        // Для простоты используем фиксированные границы
        const BOUNDS = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };

        const nx = (point.x - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX);
        const ny = (point.y - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY);

        return {
            nx: Math.max(0, Math.min(1, nx)),
            ny: Math.max(0, Math.min(1, ny)),
            originalX: point.x,
            originalY: point.y
        };
    }

    generateCellId(point) {
        // Генерируем ID на основе нормализованных координат
        const normalized = this.normalizePoint(point);
        const gridX = Math.floor(normalized.nx * 100);
        const gridY = Math.floor(normalized.ny * 100);

        return `cell_${gridX}_${gridY}_${crypto.randomBytes(2).toString('hex')}`;
    }

    findMatchingCell(normalizedPoint, threshold = 0.1) {
        for (const [cellId, cell] of this.invariantCells) {
            const distance = this.calculateDistance(normalizedPoint, cell.normalizedCenter);

            if (distance < threshold) {
                return cell;
            }
        }

        return null;
    }

    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point1.nx - point2.nx, 2) +
            Math.pow(point1.ny - point2.ny, 2)
        );
    }

    createCell(cellId, point, graphId, metadata) {
        const normalizedCenter = this.normalizePoint(point);

        return {
            id: cellId,
            originalPoint: point,
            normalizedCenter: normalizedCenter,
            confirmations: 1,
            confidence: point.confidence || 0.5,
            graphs: new Set([graphId]),
            firstSeen: new Date(),
            lastUpdated: new Date(),
            metadata: {
                ...metadata,
                sourceGraph: graphId,
                sourcePointId: point.id
            }
        };
    }

    updateCell(cell, point, graphId, metadata) {
        // Увеличиваем счетчик подтверждений
        cell.confirmations = (cell.confirmations || 1) + 1;

        // Обновляем уверенность (среднее)
        cell.confidence = (cell.confidence + (point.confidence || 0.5)) / 2;

        // Добавляем граф в историю
        cell.graphs.add(graphId);

        // Обновляем метаданные
        cell.metadata = {
            ...cell.metadata,
            lastGraph: graphId,
            lastUpdate: new Date()
        };

        cell.lastUpdated = new Date();

        // Для отладки
        if (this.settings.debugMode) {
            console.log(`   Обновлена ячейка ${cell.id}: подтверждений=${cell.confirmations}, уверенность=${cell.confidence.toFixed(3)}`);
        }
    }

    updateStats() {
        let totalConfidence = 0;
        let totalConfirmations = 0;

        for (const [cellId, cell] of this.invariantCells) {
            totalConfidence += cell.confidence || 0;
            totalConfirmations += cell.confirmations || 0;
        }

        this.stats.avgCellConfidence = this.invariantCells.size > 0 ?
            totalConfidence / this.invariantCells.size : 0;
        this.stats.avgCellConfirmations = this.invariantCells.size > 0 ?
            totalConfirmations / this.invariantCells.size : 0;

        this.lastUpdated = new Date();

        if (this.settings.debugMode) {
            console.log(`📊 Статистика шаблона:`);
            console.log(`   Ячеек: ${this.invariantCells.size}`);
            console.log(`   Средняя уверенность: ${this.stats.avgCellConfidence.toFixed(3)}`);
            console.log(`   Средние подтверждения: ${this.stats.avgCellConfirmations.toFixed(1)}`);
        }
    }

    toJSON() {
        // Преобразуем Set в массив для сериализации
        const serializableCells = {};

        for (const [cellId, cell] of this.invariantCells) {
            serializableCells[cellId] = {
                ...cell,
                graphs: Array.from(cell.graphs),
                firstSeen: cell.firstSeen.toISOString(),
                lastUpdated: cell.lastUpdated.toISOString()
            };
        }

        return {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt.toISOString(),
            lastUpdated: this.lastUpdated.toISOString(),
            stats: this.stats,
            settings: this.settings,
            invariantCells: serializableCells,
            _version: '1.0'
        };
    }

    static fromJSON(data) {
        console.log(`📂 Загружаю VectorTemplateBuilder "${data.name}"...`);

        const builder = new VectorTemplateBuilder({
            id: data.id,
            name: data.name,
            cellSize: data.settings?.cellSize,
            minConfidence: data.settings?.minConfidence,
            minConfirmations: data.settings?.minConfirmations,
            enableAdaptiveCells: data.settings?.enableAdaptiveCells,
            maxCells: data.settings?.maxCells,
            debugMode: data.settings?.debugMode
        });

        // Восстанавливаем даты
        builder.createdAt = new Date(data.createdAt);
        builder.lastUpdated = new Date(data.lastUpdated);

        // Восстанавливаем статистику
        if (data.stats) {
            builder.stats = { ...builder.stats, ...data.stats };
        }

        // Восстанавливаем ячейки
        if (data.invariantCells) {
            for (const [cellId, cellData] of Object.entries(data.invariantCells)) {
                builder.invariantCells.set(cellId, {
                    ...cellData,
                    graphs: new Set(cellData.graphs || []),
                    firstSeen: new Date(cellData.firstSeen),
                    lastUpdated: new Date(cellData.lastUpdated)
                });
            }
        }

        console.log(`✅ Загружен VectorTemplateBuilder "${builder.name}" с ` +
                   `${builder.invariantCells.size} ячейками`);

        return builder;
    }

    visualize() {
        console.log(`\n🏗️  VECTOR TEMPLATE BUILDER "${this.name}":`);
        console.log(`═`.repeat(60));
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Создан: ${this.createdAt.toLocaleString('ru-RU')}`);
        console.log(`├─ Последнее обновление: ${this.lastUpdated.toLocaleString('ru-RU')}`);
        console.log(`├─ Ячеек: ${this.invariantCells.size}`);
        console.log(`├─ Средняя уверенность: ${this.stats.avgCellConfidence.toFixed(3)}`);
        console.log(`├─ Средние подтверждения: ${this.stats.avgCellConfirmations.toFixed(1)}`);
        console.log(`├─ Обработано графов: ${this.stats.totalGraphsProcessed}`);
        console.log(`├─ Создано ячеек: ${this.stats.totalCellsCreated}`);
        console.log(`└─ Объединено ячеек: ${this.stats.totalCellsMerged}`);

        console.log(`\n⚙️  НАСТРОЙКИ:`);
        console.log(`   Размер ячейки: ${this.settings.cellSize}px`);
        console.log(`   Мин. уверенность: ${this.settings.minConfidence}`);
        console.log(`   Мин. подтверждения: ${this.settings.minConfirmations}`);
        console.log(`   Адаптивные ячейки: ${this.settings.enableAdaptiveCells ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   Макс. ячеек: ${this.settings.maxCells}`);
        console.log(`   Режим отладки: ${this.settings.debugMode ? 'ВКЛ' : 'ВЫКЛ'}`);
    }
}

module.exports = VectorTemplateBuilder;
