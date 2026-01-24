// modules/footprint/vector-template-builder.js
const crypto = require('crypto');

class VectorTemplateBuilder {
    constructor(options = {}) {
        this.id = options.id || `template_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || 'Векторный шаблон';
        this.createdAt = new Date();
        this.lastUpdated = new Date();

        // Инвариантные ячейки
        this.invariantCells = new Map();

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
            cellSize: options.cellSize || 20,
            minConfidence: options.minConfidence || 0.3,
            minConfirmations: options.minConfirmations || 2,
            enableAdaptiveCells: options.enableAdaptiveCells !== false,
            maxCells: options.maxCells || 1000,
            debugMode: options.debugMode || false,
            // 🔥 НОВЫЕ НАСТРОЙКИ ДЛЯ ЗАЩИТЫ ПАМЯТИ
            maxIterations: options.maxIterations || 10000,
            maxPointsPerBatch: options.maxPointsPerBatch || 1000,
            enableMemoryProtection: options.enableMemoryProtection !== false
        };

        // 🔥 СТАТИСТИКА ПАМЯТИ
        this.memoryStats = {
            iterations: 0,
            maxPointsProcessed: 0,
            lastMemoryCheck: new Date(),
            memoryWarnings: 0
        };

        console.log(`🏗️  Создан VectorTemplateBuilder "${this.name}" (ID: ${this.id})`);
    }

    // 🔥 ЗАЩИЩЕННЫЙ МЕТОД: безопасная итерация
    safeIteration(callback, maxIterations = null) {
        const limit = maxIterations || this.settings.maxIterations;
        let iterations = 0;
       
        return {
            next: () => {
                if (iterations >= limit) {
                    console.error(`❌ VectorTemplateBuilder: ПРЕВЫШЕНО МАКСИМАЛЬНОЕ КОЛИЧЕСТВО ИТЕРАЦИЙ: ${limit}`);
                    throw new Error(`Превышено максимальное количество итераций: ${limit}`);
                }
               
                iterations++;
                this.memoryStats.iterations++;
               
                // Проверяем память каждые 100 итераций
                if (iterations % 100 === 0 && this.settings.enableMemoryProtection) {
                    this.checkMemoryUsage();
                }
               
                return callback(iterations);
            },
            getIterations: () => iterations,
            hasNext: () => iterations < limit
        };
    }

    // 🔥 ПРОВЕРКА ИСПОЛЬЗОВАНИЯ ПАМЯТИ
    checkMemoryUsage() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const memoryUsage = process.memoryUsage();
            const usedMB = memoryUsage.heapUsed / 1024 / 1024;
            const totalMB = memoryUsage.heapTotal / 1024 / 1024;
            const usagePercent = (usedMB / totalMB) * 100;

            if (usagePercent > 80) {
                console.warn(`⚠️  VectorTemplateBuilder: высокое использование памяти: ${usedMB.toFixed(2)}MB (${usagePercent.toFixed(1)}%)`);
                this.memoryStats.memoryWarnings++;
               
                if (usagePercent > 90) {
                    this.freeMemory();
                }
            }

            this.memoryStats.lastMemoryCheck = new Date();
            this.memoryStats.currentUsageMB = usedMB;
            this.memoryStats.usagePercent = usagePercent;
        }
    }

    // 🔥 ОСВОБОЖДЕНИЕ ПАМЯТИ
    freeMemory() {
        console.log('🧹 VectorTemplateBuilder: освобождаю память...');
       
        // 1. Очищаем ячейки с низкой уверенностью
        this.removeLowConfidenceCells(0.2);
       
        // 2. Ограничиваем размер invariantCells
        if (this.invariantCells.size > this.settings.maxCells) {
            this.trimCells();
        }
       
        // 3. Принудительный сбор мусора
        if (global.gc) {
            global.gc();
        }
       
        console.log(`✅ VectorTemplateBuilder: память освобождена. Ячеек: ${this.invariantCells.size}`);
    }

    // 🔥 ОБРЕЗКА ЯЧЕЕК
    trimCells() {
        const maxCells = Math.floor(this.settings.maxCells * 0.8); // Оставляем 80%
        console.log(`✂️  VectorTemplateBuilder: обрезаю ячейки с ${this.invariantCells.size} до ${maxCells}`);
       
        // Сортируем ячейки по уверенности и подтверждениям
        const sortedCells = Array.from(this.invariantCells.entries())
            .sort(([, a], [, b]) => {
                const scoreA = (a.confidence || 0) * 0.7 + (a.confirmations || 0) * 0.3;
                const scoreB = (b.confidence || 0) * 0.7 + (b.confirmations || 0) * 0.3;
                return scoreB - scoreA; // По убыванию
            })
            .slice(0, maxCells);
       
        this.invariantCells = new Map(sortedCells);
        this.updateStats();
    }

    // 🔥 УДАЛЕНИЕ ЯЧЕЕК С НИЗКОЙ УВЕРЕННОСТЬЮ
    removeLowConfidenceCells(threshold = 0.2) {
        let removed = 0;
        const newCells = new Map();
       
        for (const [cellId, cell] of this.invariantCells) {
            if (cell.confidence >= threshold) {
                newCells.set(cellId, cell);
            } else {
                removed++;
            }
        }
       
        this.invariantCells = newCells;
       
        if (removed > 0) {
            console.log(`🗑️  VectorTemplateBuilder: удалено ${removed} ячеек с уверенностью < ${threshold}`);
            this.updateStats();
        }
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

        // Извлекаем точки из графа с защитой
        const points = this.extractPointsFromGraph(graph, this.settings.maxPointsPerBatch);

        if (points.length < 3) {
            console.log(`⚠️ Недостаточно точек: ${points.length}`);
            return false;
        }

        // Создаем ячейки из точек с безопасной итерацией
        let cellsCreated = 0;
        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= points.length) return null;
           
            const point = points[iteration - 1];
            const cellId = this.generateCellId(point);
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
           
            return iteration;
        }, points.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при создании эталонных ячеек: ${error.message}`);
                break;
            }
        }

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

        const points = this.extractPointsFromGraph(graph, this.settings.maxPointsPerBatch);

        if (points.length < 3) {
            console.log(`⚠️ Недостаточно точек: ${points.length}`);
            return false;
        }

        let cellsMerged = 0;
        let cellsCreated = 0;

        // 🔥 ИСПОЛЬЗУЕМ БЕЗОПАСНУЮ ИТЕРАЦИЮ
        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= points.length) return null;
           
            const point = points[iteration - 1];
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
           
            return iteration;
        }, points.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при добавлении графа: ${error.message}`);
                break;
            }
        }

        this.stats.totalCellsMerged += cellsMerged;
        this.stats.totalCellsCreated += cellsCreated;
       
        // 🔥 ПРОВЕРЯЕМ, НЕ ПРЕВЫШАЕМ ЛИ МАКСИМАЛЬНОЕ КОЛИЧЕСТВО ЯЧЕЕК
        if (this.invariantCells.size > this.settings.maxCells) {
            console.log(`⚠️ Превышен лимит ячеек (${this.invariantCells.size}/${this.settings.maxCells}), обрезаю...`);
            this.trimCells();
        }
       
        this.updateStats();

        console.log(`✅ Граф добавлен: ${cellsMerged} объединено, ${cellsCreated} создано`);
        return true;
    }

    // Сравнить граф с шаблоном
    compareGraphWithTemplate(graph, options = {}) {
        console.log(`🔍 Сравниваю граф с шаблоном...`);

        const points = this.extractPointsFromGraph(graph, this.settings.maxPointsPerBatch);

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
        const matchThreshold = options.matchThreshold || 0.1;

        // 🔥 ИСПОЛЬЗУЕМ БЕЗОПАСНУЮ ИТЕРАЦИЮ
        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= points.length) return null;
           
            const point = points[iteration - 1];
            const normalizedPoint = this.normalizePoint(point);
           
            // 🔥 ОПТИМИЗИРОВАННЫЙ ПОИСК: используем пространственное разделение
            let foundMatch = false;
           
            // Проверяем только ближайшие ячейки
            const candidateCells = this.findNearbyCells(normalizedPoint, matchThreshold * 2);
           
            for (const cell of candidateCells) {
                const distance = this.calculateDistance(normalizedPoint, cell.normalizedCenter);
                if (distance < matchThreshold) {
                    matches++;
                    if (options.detailed) {
                        matchedCells.push({
                            point,
                            cell,
                            distance
                        });
                    }
                    foundMatch = true;
                    break;
                }
            }
           
            return iteration;
        }, points.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при сравнении графа: ${error.message}`);
                break;
            }
        }

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

    // 🔥 ОПТИМИЗИРОВАННЫЙ ПОИСК БЛИЖАЙШИХ ЯЧЕЕК
    findNearbyCells(point, radius) {
        const nearby = [];
       
        // 🔥 ЗАЩИТА: ограничиваем количество проверяемых ячеек
        const maxCellsToCheck = Math.min(this.invariantCells.size, 100);
        const cells = Array.from(this.invariantCells.values());
       
        // Быстрая проверка по сетке
        const gridStep = 0.1; // 10% от размера области
        const gridX = Math.floor(point.nx / gridStep);
        const gridY = Math.floor(point.ny / gridStep);
       
        for (let i = 0; i < Math.min(cells.length, maxCellsToCheck); i++) {
            const cell = cells[i];
            const cellGridX = Math.floor(cell.normalizedCenter.nx / gridStep);
            const cellGridY = Math.floor(cell.normalizedCenter.ny / gridStep);
           
            // Проверяем только ячейки в соседних квадратах
            if (Math.abs(cellGridX - gridX) <= 1 && Math.abs(cellGridY - gridY) <= 1) {
                nearby.push(cell);
            }
        }
       
        return nearby;
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

        // Проверяем среднюю уверенность с защитой от больших циклов
        let totalConfidence = 0;
        let totalConfirmations = 0;
        let lowConfidenceCells = 0;
        let unconfirmedCells = 0;
        let processedCells = 0;

        // 🔥 ИСПОЛЬЗУЕМ БЕЗОПАСНУЮ ИТЕРАЦИЮ
        const cells = Array.from(this.invariantCells.values());
        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= cells.length) return null;
           
            const cell = cells[iteration - 1];
            totalConfidence += cell.confidence || 0;
            totalConfirmations += cell.confirmations || 0;

            if (cell.confidence < this.settings.minConfidence) {
                lowConfidenceCells++;
            }

            if (cell.confirmations < this.settings.minConfirmations) {
                unconfirmedCells++;
            }
           
            processedCells++;
            return iteration;
        }, cells.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при валидации шаблона: ${error.message}`);
                break;
            }
        }

        const avgConfidence = processedCells > 0 ? totalConfidence / processedCells : 0;
        const avgConfirmations = processedCells > 0 ? totalConfirmations / processedCells : 0;

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
                processedCells,
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
            highConfidenceCells: 0,
            avgConfidence: validation.stats?.avgConfidence || 0,
            avgConfirmations: validation.stats?.avgConfirmations || 0,
            validation: validation.valid ? 'VALID' : 'INVALID',
            warnings: validation.warnings.length,
            lastValidation: validation.stats?.lastValidation || null,
            memoryStats: this.memoryStats
        };

        // 🔥 СЧИТАЕМ ТОЛЬКО ЕСЛИ НУЖНО И С ЗАЩИТОЙ
        if (detailed) {
            const cells = Array.from(this.invariantCells.values());
            const countsByConfidence = { '0.0-0.3': 0, '0.3-0.5': 0, '0.5-0.7': 0, '0.7-1.0': 0 };
            const countsByConfirmations = { '1': 0, '2': 0, '3': 0, '4+': 0 };
            let highConfidence = 0;

            // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ОБРАБАТЫВАЕМЫХ ЯЧЕЕК
            const maxCellsToProcess = Math.min(cells.length, 500);
            const iterator = this.safeIteration((iteration) => {
                if (iteration - 1 >= maxCellsToProcess) return null;
               
                const cell = cells[iteration - 1];
                const confidence = cell.confidence || 0;
                const confirmations = cell.confirmations || 1;
               
                // Подсчет по уверенности
                if (confidence >= 0.7) {
                    countsByConfidence['0.7-1.0']++;
                    highConfidence++;
                } else if (confidence >= 0.5) {
                    countsByConfidence['0.5-0.7']++;
                } else if (confidence >= 0.3) {
                    countsByConfidence['0.3-0.5']++;
                } else {
                    countsByConfidence['0.0-0.3']++;
                }
               
                // Подсчет по подтверждениям
                if (confirmations >= 4) {
                    countsByConfirmations['4+']++;
                } else if (confirmations === 3) {
                    countsByConfirmations['3']++;
                } else if (confirmations === 2) {
                    countsByConfirmations['2']++;
                } else {
                    countsByConfirmations['1']++;
                }
               
                return iteration;
            }, maxCellsToProcess);

            while (iterator.hasNext()) {
                try {
                    iterator.next();
                } catch (error) {
                    console.error(`Ошибка при подсчете статистики: ${error.message}`);
                    break;
                }
            }

            info.highConfidenceCells = highConfidence;
            info.cellsByConfidence = countsByConfidence;
            info.cellsByConfirmations = countsByConfirmations;
        }

        return info;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Получить данные для визуализации
    getVisualizationData(options = {}) {
        console.log(`🎨 Получаю данные для визуализации шаблона...`);

        const data = {
            id: this.id,
            name: this.name,
            cellsCount: this.invariantCells.size,
            points: [],
            cells: [],
            stats: this.getStats(),
            metadata: {
                createdAt: this.createdAt,
                lastUpdated: this.lastUpdated,
                totalGraphsProcessed: this.stats.totalGraphsProcessed
            }
        };

        // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ТОЧЕК ДЛЯ ВИЗУАЛИЗАЦИИ
        const maxPoints = Math.min(this.invariantCells.size, 1000);
        const cells = Array.from(this.invariantCells.values()).slice(0, maxPoints);

        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= cells.length) return null;
           
            const cell = cells[iteration - 1];
           
            // Точка центра ячейки
            data.points.push({
                id: cell.id,
                x: cell.normalizedCenter.nx * 1000,
                y: cell.normalizedCenter.ny * 1000,
                confidence: cell.confidence,
                confirmations: cell.confirmations,
                totalGraphs: cell.graphs?.size || 1,
                isInvariant: true,
                type: 'template_cell'
            });

            // Данные ячейки
            data.cells.push({
                id: cell.id,
                center: cell.normalizedCenter,
                confirmations: cell.confirmations,
                confidence: cell.confidence,
                totalGraphs: cell.graphs?.size || 1,
                lastUpdated: cell.lastUpdated,
                isInvariant: true,
                features: []
            });
           
            return iteration;
        }, cells.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при подготовке данных визуализации: ${error.message}`);
                break;
            }
        }

        console.log(`✅ Подготовлено ${data.points.length} точек для визуализации`);
        return data;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Получить статистику
    getStats() {
        let totalConfidence = 0;
        let totalConfirmations = 0;
        let processedCells = 0;
       
        // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ОБРАБАТЫВАЕМЫХ ЯЧЕЕК
        const maxCells = Math.min(this.invariantCells.size, 500);
        const cells = Array.from(this.invariantCells.values()).slice(0, maxCells);
       
        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= cells.length) return null;
           
            const cell = cells[iteration - 1];
            totalConfidence += cell.confidence || 0;
            totalConfirmations += cell.confirmations || 0;
            processedCells++;
           
            return iteration;
        }, cells.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при расчете статистики: ${error.message}`);
                break;
            }
        }

        const avgConfidence = processedCells > 0 ? totalConfidence / processedCells : 0;
        const avgConfirmations = processedCells > 0 ? totalConfirmations / processedCells : 0;

        return {
            totalCells: this.invariantCells.size,
            processedCells,
            avgConfidence,
            avgConfirmations,
            totalConfirmations,
            highConfidenceCells: processedCells > 0 ? cells.filter(cell => (cell.confidence || 0) > 0.8).length : 0,
            lastUpdated: this.lastUpdated
        };
    }

    // 🔥 ДОПОЛНИТЕЛЬНЫЙ МЕТОД: Получить простые данные для визуализации
    getSimpleVisualizationData() {
        const points = [];
        const maxPoints = Math.min(this.invariantCells.size, 500);
        const cells = Array.from(this.invariantCells.values()).slice(0, maxPoints);

        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= cells.length) return null;
           
            const cell = cells[iteration - 1];
            const x = cell.normalizedCenter.nx * 1000;
            const y = cell.normalizedCenter.ny * 1000;

            let color;
            if (cell.confidence > 0.8) {
                color = '#4CAF50';
            } else if (cell.confidence > 0.5) {
                color = '#FFC107';
            } else {
                color = '#F44336';
            }

            const size = 4 + Math.min(cell.confirmations, 10);

            points.push({
                id: cell.id,
                x: x,
                y: y,
                color: color,
                size: size,
                confidence: cell.confidence,
                confirmations: cell.confirmations,
                label: `Уверенность: ${(cell.confidence * 100).toFixed(0)}%`
            });
           
            return iteration;
        }, cells.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при подготовке простых данных визуализации: ${error.message}`);
                break;
            }
        }

        const stats = this.getStats();
        return {
            points: points,
            cellCount: this.invariantCells.size,
            avgConfidence: stats.avgConfidence,
            totalConfirmations: stats.totalConfirmations
        };
    }

    // Вспомогательные методы (остаются без изменений, но с защитой)
    extractPointsFromGraph(graph, maxPoints = 1000) {
        const points = [];

        if (!graph || !graph.nodes) return points;

        // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО УЗЛОВ
        const nodes = Array.from(graph.nodes.entries()).slice(0, maxPoints);
       
        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= nodes.length) return null;
           
            const [nodeId, node] = nodes[iteration - 1];
            points.push({
                id: nodeId,
                x: node.x || 0,
                y: node.y || 0,
                confidence: node.confidence || 0.5,
                originalNode: node
            });
           
            return iteration;
        }, nodes.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при извлечении точек из графа: ${error.message}`);
                break;
            }
        }

        return points;
    }

    normalizePoint(point) {
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
        const normalized = this.normalizePoint(point);
        const gridX = Math.floor(normalized.nx * 100);
        const gridY = Math.floor(normalized.ny * 100);
        return `cell_${gridX}_${gridY}_${crypto.randomBytes(2).toString('hex')}`;
    }

    findMatchingCell(normalizedPoint, threshold = 0.1) {
        // 🔥 ОПТИМИЗИРОВАННЫЙ ПОИСК: проверяем только ближайшие ячейки
        const nearbyCells = this.findNearbyCells(normalizedPoint, threshold * 2);
       
        for (const cell of nearbyCells) {
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
        cell.confirmations = (cell.confirmations || 1) + 1;
        cell.confidence = (cell.confidence + (point.confidence || 0.5)) / 2;
        cell.graphs.add(graphId);
        cell.metadata = {
            ...cell.metadata,
            lastGraph: graphId,
            lastUpdate: new Date()
        };
        cell.lastUpdated = new Date();

        if (this.settings.debugMode) {
            console.log(`   Обновлена ячейка ${cell.id}: подтверждений=${cell.confirmations}, уверенность=${cell.confidence.toFixed(3)}`);
        }
    }

    updateStats() {
        const stats = this.getStats();
        this.stats.avgCellConfidence = stats.avgConfidence;
        this.stats.avgCellConfirmations = stats.avgConfirmations;
        this.lastUpdated = new Date();

        if (this.settings.debugMode) {
            console.log(`📊 Статистика шаблона:`);
            console.log(`   Ячеек: ${this.invariantCells.size}`);
            console.log(`   Средняя уверенность: ${this.stats.avgCellConfidence.toFixed(3)}`);
            console.log(`   Средние подтверждения: ${this.stats.avgCellConfirmations.toFixed(1)}`);
        }
    }

    toJSON() {
        // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО СЕРИАЛИЗУЕМЫХ ЯЧЕЕК
        const maxCellsToSerialize = Math.min(this.invariantCells.size, 2000);
        const serializableCells = {};
        const cells = Array.from(this.invariantCells.entries()).slice(0, maxCellsToSerialize);

        const iterator = this.safeIteration((iteration) => {
            if (iteration - 1 >= cells.length) return null;
           
            const [cellId, cell] = cells[iteration - 1];
            serializableCells[cellId] = {
                ...cell,
                graphs: Array.from(cell.graphs),
                firstSeen: cell.firstSeen.toISOString(),
                lastUpdated: cell.lastUpdated.toISOString()
            };
           
            return iteration;
        }, cells.length);

        while (iterator.hasNext()) {
            try {
                iterator.next();
            } catch (error) {
                console.error(`Ошибка при сериализации ячеек: ${error.message}`);
                break;
            }
        }

        return {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt.toISOString(),
            lastUpdated: this.lastUpdated.toISOString(),
            stats: this.stats,
            settings: this.settings,
            invariantCells: serializableCells,
            memoryStats: this.memoryStats,
            _version: '1.1',
            _cellsSerialized: Object.keys(serializableCells).length,
            _totalCells: this.invariantCells.size
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

        builder.createdAt = new Date(data.createdAt);
        builder.lastUpdated = new Date(data.lastUpdated);

        if (data.stats) {
            builder.stats = { ...builder.stats, ...data.stats };
        }

        // Восстанавливаем ячейки с защитой
        if (data.invariantCells) {
            const entries = Object.entries(data.invariantCells);
            const maxCellsToLoad = Math.min(entries.length, 2000);
            let loadedCells = 0;

            const iterator = builder.safeIteration((iteration) => {
                if (iteration - 1 >= maxCellsToLoad) return null;
               
                const [cellId, cellData] = entries[iteration - 1];
                builder.invariantCells.set(cellId, {
                    ...cellData,
                    graphs: new Set(cellData.graphs || []),
                    firstSeen: new Date(cellData.firstSeen),
                    lastUpdated: new Date(cellData.lastUpdated)
                });
               
                loadedCells++;
               
                // Проверяем память каждые 100 ячеек
                if (loadedCells % 100 === 0 && builder.settings.enableMemoryProtection) {
                    builder.checkMemoryUsage();
                }
               
                return iteration;
            }, maxCellsToLoad);

            while (iterator.hasNext()) {
                try {
                    iterator.next();
                } catch (error) {
                    console.error(`Ошибка при загрузке ячеек: ${error.message}`);
                    break;
                }
            }
        }

        console.log(`✅ Загружен VectorTemplateBuilder "${builder.name}" с ${builder.invariantCells.size} ячейками`);
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
       
        console.log(`\n🧮 СТАТИСТИКА ПАМЯТИ:`);
        console.log(`   Всего итераций: ${this.memoryStats.iterations}`);
        console.log(`   Предупреждений памяти: ${this.memoryStats.memoryWarnings}`);
        console.log(`   Последняя проверка: ${this.memoryStats.lastMemoryCheck.toLocaleTimeString('ru-RU')}`);
    }
}

module.exports = VectorTemplateBuilder;
