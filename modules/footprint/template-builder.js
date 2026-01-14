// modules/footprint/template-builder.js
// 🔥 ПЕРЕРАБОТАННЫЙ С ДИНАМИЧЕСКИМ ЭТАЛОНОМ И ЕДИНОЙ СИСТЕМОЙ КООРДИНАТ
const SimpleGraphMatcher = require('./simple-matcher');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');

class TemplateBuilder {
    constructor(options = {}) {
        this.id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблон протектора';

        // 🔥 ДОБАВЛЯЕМ МАТЧЕР И КОНВЕРТЕР КООРДИНАТ
        this.matcher = new SimpleGraphMatcher({
            debug: options.debug || false
        });

        this.coordinateConverter = new CoordinateSystemConverter({
            debug: options.debug || false
        });

        // 🔥 ИНВАРИАНТНАЯ АРХИТЕКТУРА С ДИНАМИЧЕСКИМ ЭТАЛОНОМ
        this.referenceGraph = null;
        this.referenceGraphId = null;
        this.referenceGraphQuality = 0;

        // 🔥 СИСТЕМА КООРДИНАТ ШАБЛОНА
        this.templateCoordinateSystem = null;

        // 🔥 ХРАНИМ ВСЕ ГРАФЫ
        this.allGraphs = new Map();
        this.graphQualities = new Map();

        // 🔥 ЛУЧШИЙ ГРАФ (может меняться)
        this.bestGraphId = null;
        this.bestGraphQuality = 0;

        // 🔥 НОРМАЛИЗОВАННЫЕ ДАННЫЕ
        this.referencePoints = [];
        this.normalizedReferencePoints = [];
        this.normalizationTransform = null;

        // 🔥 ИНВАРИАНТНЫЕ ЯЧЕЙКИ
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
            totalConfirmations: 0,
            bestGraphUpdates: 0
        };

        // 🔥 НАСТРОЙКИ
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
            enableDynamicReference: true,
            referenceUpdateThreshold: 1.15,
            minQualityForReference: 0.4,
            ...options
        };

        console.log(`🏗️ Создан TemplateBuilder "${this.name}" с ЕДИНОЙ системой координат`);
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: Установить эталон с ПРАВИЛЬНОЙ системой координат
    setReferenceGraphWithRealPoints(graph, graphId, realPoints, metadata = {}) {
        console.log(`🎯 Устанавливаю эталонный граф с ПРАВИЛЬНОЙ системой координат: ${graphId}`);

        if (realPoints.length < 3) {
            console.log(`❌ Недостаточно реальных точек: ${realPoints.length}`);
            return false;
        }

        // 1. Сохраняем РЕАЛЬНЫЕ координаты
        this.referenceGraph = graph;
        this.referenceGraphId = graphId;
        this.referencePoints = realPoints; // 🔥 РЕАЛЬНЫЕ координаты, не нормализованные!

        console.log(`📊 Сохранено ${realPoints.length} РЕАЛЬНЫХ точек эталона`);
        console.log(`   Пример: (${realPoints[0]?.x?.toFixed(1)}, ${realPoints[0]?.y?.toFixed(1)})`);

        // 2. Вычисляем bounding box РЕАЛЬНЫХ координат
        const bounds = this.calculateBounds(realPoints);

        // 3. Сохраняем трансформацию для конвертации
        this.normalizationTransform = {
            minX: bounds.minX,
            minY: bounds.minY,
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
            originalBounds: bounds,
            isRealCoordinates: true // 🔥 ФЛАГ: это реальные координаты
        };

        console.log(`📐 Реальные границы эталона:`);
        console.log(`   X: ${bounds.minX.toFixed(1)} - ${bounds.maxX.toFixed(1)} (ширина: ${bounds.width.toFixed(1)})`);
        console.log(`   Y: ${bounds.minY.toFixed(1)} - ${bounds.maxY.toFixed(1)} (высота: ${bounds.height.toFixed(1)})`);

        // 4. Нормализуем точки для шаблона (0-1 диапазон)
        this.normalizedReferencePoints = realPoints.map(point => ({
            ...point,
            nx: (point.x - bounds.minX) / Math.max(1, bounds.width),
            ny: (point.y - bounds.minY) / Math.max(1, bounds.height),
            normalized: true,
            originalX: point.x, // 🔥 Сохраняем оригинальные координаты
            originalY: point.y
        }));

        // 5. Определяем систему координат шаблона
        this.templateCoordinateSystem = {
            type: 'template_normalized',
            rotationAngle: 0, // Шаблон всегда в 0°
            isMirrored: false,
            bounds: bounds,
            center: {
                x: (bounds.minX + bounds.maxX) / 2,
                y: (bounds.minY + bounds.maxY) / 2
            },
            description: 'Нормализованная система шаблона (0-1 диапазон)'
        };

        // 6. Создаем инвариантную сетку на НОРМАЛИЗОВАННЫХ координатах
        this.buildInvariantGrid();

        // 7. Извлекаем топологию
        this.extractTopologyFromGraph(graph);

        console.log(`✅ Эталон установлен с ${this.invariantCells.size} ячейками в РЕАЛЬНОЙ системе координат`);
        return true;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Нормализовать к системе шаблона ПРАВИЛЬНО
    normalizeToTemplateSystem(points, metadata) {
        if (!this.normalizationTransform) {
            console.log(`⚠️ Нет трансформации шаблона, использую прямую нормализацию`);
            const bounds = this.calculateBounds(points);
            return points.map(point => ({
                ...point,
                nx: (point.x - bounds.minX) / Math.max(1, bounds.width),
                ny: (point.y - bounds.minY) / Math.max(1, bounds.height),
                normalized: true
            }));
        }

        console.log(`📐 Нормализую ${points.length} точек к системе шаблона...`);

        // 🔥 ВАЖНО: Проверяем, в какой системе координат находятся точки
        const samplePoint = points[0];
        const bounds = this.normalizationTransform;

        // Проверяем, нужно ли применять трансформацию из метаданных
        if (metadata.transformationInfo && metadata.transformationInfo.matrix) {
            console.log(`🔄 Применяю трансформацию из метаданных перед нормализацией`);
            points = this.applyTransformationToPoints(points, metadata.transformationInfo);
        }

        // Нормализуем к диапазону 0-1
        const normalized = points.map(point => {
            const nx = (point.x - bounds.minX) / Math.max(1, bounds.width);
            const ny = (point.y - bounds.minY) / Math.max(1, bounds.height);

            return {
                ...point,
                nx: nx,
                ny: ny,
                normalized: true,
                originalX: point.x, // Сохраняем оригинальные координаты
                originalY: point.y
            };
        });

        // Дебаг: показываем диапазон
        const nxs = normalized.map(p => p.nx);
        const nys = normalized.map(p => p.ny);
        console.log(`📊 Нормализованный диапазон: X[${Math.min(...nxs).toFixed(3)}-${Math.max(...nxs).toFixed(3)}], Y[${Math.min(...nys).toFixed(3)}-${Math.max(...nys).toFixed(3)}]`);

        return normalized;
    }

    // 🔥 НОВЫЙ МЕТОД: Преобразовать точки в систему шаблона
    convertPointsToTemplateSystem(points, sourceSystem, metadata = {}) {
        console.log(`🔄 Преобразую ${points.length} точек в систему шаблона...`);

        // Если точки уже в системе шаблона
        if (this.arePointsInTemplateSystem(points)) {
            console.log(`✅ Точки уже в системе шаблона`);
            return points;
        }

        // Определяем исходную систему координат
        const sourceCoordinateSystem = sourceSystem || this.extractCoordinateSystemFromPoints(points, metadata);

        // Преобразуем точки
        const convertedPoints = this.coordinateConverter.convertPoints(
            points,
            sourceCoordinateSystem,
            this.templateCoordinateSystem
        );

        console.log(`✅ Преобразовано ${convertedPoints.length} точек в систему шаблона`);
        return convertedPoints;
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечь систему координат из точек
    extractCoordinateSystemFromPoints(points, metadata = {}) {
        const bounds = this.calculateBounds(points);

        return {
            type: metadata.transformationInfo ? 'transformed' : 'raw',
            rotationAngle: metadata.transformationInfo?.rotationAngle || 0,
            isMirrored: metadata.transformationInfo?.isMirrored || false,
            matrix: metadata.transformationInfo?.matrix,
            center: metadata.transformationInfo?.center || {
                x: (bounds.minX + bounds.maxX) / 2,
                y: (bounds.minY + bounds.maxY) / 2
            },
            bounds: bounds,
            pointCount: points.length
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить, находятся ли точки в системе шаблона
    arePointsInTemplateSystem(points) {
        if (!points || points.length === 0) return false;

        // Проверяем первую точку
        const firstPoint = points[0];

        // Точки в системе шаблона должны иметь координаты в диапазоне 0-1
        // или быть близкими к границам эталона
        if (firstPoint.nx !== undefined && firstPoint.ny !== undefined) {
            // Уже нормализованные
            return true;
        }

        if (this.normalizationTransform) {
            const bounds = this.normalizationTransform;
            const sampleX = firstPoint.x;
            const sampleY = firstPoint.y;

            // Проверяем, находятся ли координаты в пределах границ эталона
            const isInBounds = sampleX >= bounds.minX - 100 &&
                              sampleX <= bounds.maxX + 100 &&
                              sampleY >= bounds.minY - 100 &&
                              sampleY <= bounds.maxY + 100;

            return isInBounds;
        }

        return false;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Добавить граф
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} с ПРАВИЛЬНОЙ системой координат...`);

        // 🔥 ВАЖНО: Получаем РЕАЛЬНЫЕ координаты из графа
        const realPoints = this.extractRealPointsFromGraph(graph, metadata);

        if (realPoints.length < 3) {
            console.log(`❌ Недостаточно реальных точек: ${realPoints.length}`);
            return false;
        }

        console.log(`📊 Реальные точки: ${realPoints.length} (первая: ${realPoints[0]?.x?.toFixed(1)}, ${realPoints[0]?.y?.toFixed(1)})`);

        // 1. Если первый граф - устанавливаем эталон
        if (!this.referenceGraph) {
            console.log(`🎯 Первый граф, устанавливаю как эталон с реальными координатами`);
            return this.setReferenceGraphWithRealPoints(graph, graphId, realPoints, metadata);
        }

        // 2. 🔥 ПРЕОБРАЗУЕМ В СИСТЕМУ ШАБЛОНА
        const pointsInTemplateSystem = this.convertPointsToTemplateSystem(realPoints, null, metadata);

        // 3. Нормализуем к системе шаблона (0-1 диапазон)
        const normalizedPoints = this.normalizeToTemplateSystem(pointsInTemplateSystem, metadata);

        // 4. Ищем совпадения в НОРМАЛИЗОВАННОЙ системе
        const matchResults = this.findMatchesInNormalizedSystem(normalizedPoints, graphId);

        if (matchResults.totalMatches < Math.max(3, this.referencePoints.length * 0.2)) {
            console.log(`❌ Недостаточно совпадений: ${matchResults.totalMatches}`);
            console.log(`   Возможно, это другой протектор`);
            return false;
        }

        console.log(`✅ Найдено ${matchResults.totalMatches} совпадений:`);
        console.log(`   • Точные совпадения: ${matchResults.exactMatchesCount}`);
        console.log(`   • Частичные совпадения: ${matchResults.partialMatchesCount}`);
        console.log(`   • Новые точки: ${matchResults.newPointsCount}`);

        // 5. 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ СУЩЕСТВУЮЩИХ ТОЧЕК
        const updatedCells = this.updateTemplateWithMatches(matchResults, graphId);

        // 6. 🔥 ДОБАВЛЯЕМ НОВЫЕ ТОЧКИ В ШАБЛОН
        const newCellsAdded = this.addNewPointsToTemplate(
            matchResults.unmatchedPoints,
            graphId,
            metadata
        );

        // 7. 🔥 УТОЧНЯЕМ КООРДИНАТЫ СУЩЕСТВУЮЩИХ ТОЧЕК
        const refinedCells = this.refineTemplatePoints(
            matchResults,
            graphId
        );

        // 8. 🔥 ОБРАБАТЫВАЕМ НИЗКОКАЧЕСТВЕННЫЕ ТОЧКИ
        const lowQualityProcessed = this.processLowQualityPoints(
            matchResults.lowQualityMatches,
            graphId
        );

        // 9. Сохранить трансформацию и статистику
        this.graphTransformations.set(graphId, {
            metadata: metadata,
            timestamp: new Date(),
            pointsCount: realPoints.length,
            matchResults: {
                totalMatches: matchResults.totalMatches,
                exactMatches: matchResults.exactMatchesCount,
                partialMatches: matchResults.partialMatchesCount,
                newPoints: matchResults.newPointsCount
            },
            quality: matchResults.quality || 0.5,
            actions: {
                updatedCells,
                newCellsAdded,
                refinedCells,
                lowQualityProcessed
            }
        });

        // 10. Обновить статистику
        this.stats.totalGraphs++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        // 🔥 11. ПРОВЕРЯЕМ, НЕ НУЖНО ЛИ ПЕРЕСТРОИТЬ ШАБЛОН
        if (newCellsAdded > this.invariantCells.size * 0.3) {
            console.log(`⚠️ Много новых точек (${newCellsAdded}), проверяю необходимость реструктуризации...`);
            this.checkAndRestructureTemplate();
        }

        console.log(`✅ Граф добавлен с НАКОПЛЕНИЕМ:`);
        console.log(`   • Обновлено ячеек: ${updatedCells}`);
        console.log(`   • Добавлено новых: ${newCellsAdded}`);
        console.log(`   • Уточнено координат: ${refinedCells}`);
        console.log(`   • Всего ячеек в шаблоне: ${this.invariantCells.size}`);

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Применить трансформацию к точкам
    applyTransformationToPoints(points, transformationInfo) {
        if (!transformationInfo || !transformationInfo.matrix) return points;

        const matrix = transformationInfo.matrix;
        const center = transformationInfo.center || { x: 0, y: 0 };

        return points.map(point => {
            const relX = point.x - center.x;
            const relY = point.y - center.y;

            const transformedX = relX * matrix[0] + relY * matrix[1] + center.x + matrix[2];
            const transformedY = relX * matrix[3] + relY * matrix[4] + center.y + matrix[5];

            return {
                ...point,
                x: transformedX,
                y: transformedY,
                transformed: true,
                originalX: point.x,
                originalY: point.y
            };
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечь РЕАЛЬНЫЕ координаты
    extractRealPointsFromGraph(graph, metadata) {
        const points = [];

        if (!graph || !graph.nodes) return points;

        // 🔥 КЛЮЧЕВОЙ МОМЕНТ: Используем оригинальные координаты из узлов
        graph.nodes.forEach((node, nodeId) => {
            // Если у узла есть originalCoordinates - используем их
            if (node.originalCoordinates) {
                points.push({
                    id: nodeId,
                    x: node.originalCoordinates.x || node.x,
                    y: node.originalCoordinates.y || node.y,
                    confidence: node.confidence || 0.5
                });
            } else {
                // Иначе используем текущие координаты
                points.push({
                    id: nodeId,
                    x: node.x || 0,
                    y: node.y || 0,
                    confidence: node.confidence || 0.5
                });
            }
        });

        return points;
    }

    // 🔥 Метод остается без изменений
    findMatchesInNormalizedSystem(normalizedPoints, graphId) {
        const results = {
            exactMatches: [],
            partialMatches: [],
            lowQualityMatches: [],
            unmatchedPoints: [],
            totalMatches: 0,
            exactMatchesCount: 0,
            partialMatchesCount: 0,
            newPointsCount: 0,
            quality: 0
        };

        const EXACT_THRESHOLD = 0.02;
        const PARTIAL_THRESHOLD = 0.05;
        const LOW_QUALITY_THRESHOLD = 0.1;

        // Для каждой точки нового графа ищем ближайшую в шаблоне
        normalizedPoints.forEach(newPoint => {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestCellId = null;

            // Ищем ближайшую ячейку в шаблоне
            for (const [cellId, cell] of this.invariantCells) {
                const distance = Math.sqrt(
                    Math.pow(cell.normalizedCenter.nx - newPoint.nx, 2) +
                    Math.pow(cell.normalizedCenter.ny - newPoint.ny, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = cell;
                    bestCellId = cellId;
                }
            }

            // Классифицируем результат
            if (bestMatch && minDistance < EXACT_THRESHOLD) {
                results.exactMatches.push({
                    newPoint,
                    cellId: bestCellId,
                    cell: bestMatch,
                    distance: minDistance,
                    matchType: 'exact'
                });
                results.exactMatchesCount++;
            } else if (bestMatch && minDistance < PARTIAL_THRESHOLD) {
                results.partialMatches.push({
                    newPoint,
                    cellId: bestCellId,
                    cell: bestMatch,
                    distance: minDistance,
                    matchType: 'partial'
                });
                results.partialMatchesCount++;
            } else if (bestMatch && minDistance < LOW_QUALITY_THRESHOLD) {
                results.lowQualityMatches.push({
                    newPoint,
                    cellId: bestCellId,
                    cell: bestMatch,
                    distance: minDistance,
                    matchType: 'low_quality'
                });
            } else {
                results.unmatchedPoints.push({
                    newPoint,
                    distanceToNearest: minDistance,
                    matchType: 'new'
                });
                results.newPointsCount++;
            }
        });

        results.totalMatches = results.exactMatchesCount + results.partialMatchesCount;

        // Рассчитываем общее качество совпадений
        results.quality = this.calculateMatchQuality(results);

        console.log(`🔍 Классификация совпадений для ${normalizedPoints.length} точек:`);
        console.log(`   • Точные (<2%): ${results.exactMatchesCount}`);
        console.log(`   • Частичные (2-5%): ${results.partialMatchesCount}`);
        console.log(`   • Низкокачественные (5-10%): ${results.lowQualityMatches.length}`);
        console.log(`   • Новые (>10%): ${results.newPointsCount}`);
        console.log(`   • Общее качество: ${results.quality.toFixed(3)}`);

        return results;
    }

    // 🔥 Метод остается без изменений
    calculateMatchQuality(matchResults) {
        const totalPoints = matchResults.exactMatchesCount + matchResults.partialMatchesCount +
                           matchResults.lowQualityMatches.length + matchResults.newPointsCount;

        if (totalPoints === 0) return 0;

        // Весовые коэффициенты
        const exactWeight = 1.0;
        const partialWeight = 0.7;
        const lowQualityWeight = 0.3;
        const newWeight = 0.0; // Новые точки не дают качества

        const weightedScore =
            (matchResults.exactMatchesCount * exactWeight +
             matchResults.partialMatchesCount * partialWeight +
             matchResults.lowQualityMatches.length * lowQualityWeight +
             matchResults.newPointsCount * newWeight) / totalPoints;

        return Math.min(1.0, weightedScore);
    }

    // 🔥 Метод остается без изменений
    updateTemplateWithMatches(matches, graphId) {
        let updatedCount = 0;
        let refinedCount = 0;

        matches.exactMatches.forEach(match => {
            const cell = this.invariantCells.get(match.cellId);
            if (cell) {
                const oldConfirmations = cell.confirmations || 1;
                cell.confirmations = oldConfirmations + 1;
                cell.confidence = Math.min(1.0, (cell.confidence || 0.7) + 0.1);

                if (!cell.sources) cell.sources = new Set();
                cell.sources.add(graphId);

                if (cell.confirmations > 1) {
                    const weight = 1.0 / cell.confirmations;
                    cell.normalizedCenter.nx = cell.normalizedCenter.nx * (1 - weight) +
                                              match.newPoint.nx * weight;
                    cell.normalizedCenter.ny = cell.normalizedCenter.ny * (1 - weight) +
                                              match.newPoint.ny * weight;
                    refinedCount++;
                }

                updatedCount++;
            }
        });

        matches.partialMatches.forEach(match => {
            const cell = this.invariantCells.get(match.cellId);
            if (cell) {
                const oldConfirmations = cell.confirmations || 1;
                cell.confirmations = oldConfirmations + 1;
                cell.confidence = Math.min(1.0, (cell.confidence || 0.7) + 0.05);

                if (!cell.sources) cell.sources = new Set();
                cell.sources.add(graphId);

                if (cell.confirmations > 2) {
                    const weight = 0.5 / cell.confirmations;
                    cell.normalizedCenter.nx = cell.normalizedCenter.nx * (1 - weight) +
                                              match.newPoint.nx * weight;
                    cell.normalizedCenter.ny = cell.normalizedCenter.ny * (1 - weight) +
                                              match.newPoint.ny * weight;
                    refinedCount++;
                }

                updatedCount++;
            }
        });

        console.log(`📈 Обновлено ${updatedCount} ячеек, уточнено ${refinedCount} координат`);
        return updatedCount;
    }

    // 🔥 Метод остается без изменений
    addNewPointsToTemplate(unmatchedPoints, graphId, metadata) {
        if (unmatchedPoints.length === 0) {
            console.log(`📊 Нет новых точек для добавления`);
            return 0;
        }

        console.log(`🆕 Добавляю ${unmatchedPoints.length} новых точек в шаблон...`);

        let addedCount = 0;
        const maxNewPoints = Math.min(30, Math.max(5, unmatchedPoints.length / 2));

        const filteredPoints = unmatchedPoints.filter(point => {
            const pointQuality = this.evaluatePointQuality(point.newPoint, metadata);
            return pointQuality > 0.4;
        });

        const pointsToAdd = filteredPoints.slice(0, maxNewPoints);

        pointsToAdd.forEach((pointData, index) => {
            const point = pointData.newPoint;
            const pointQuality = this.evaluatePointQuality(point, metadata);

            const cellId = `cell_new_${graphId}_${index}_${Date.now()}`;

            const newCell = {
                normalizedCenter: {
                    nx: point.nx || 0,
                    ny: point.ny || 0
                },
                originalCenter: {
                    x: point.x || 0,
                    y: point.y || 0
                },
                radius: 0.04,
                points: [point.id],
                confirmations: 1,
                confidence: pointQuality,
                sources: new Set([graphId]),
                invariants: point.invariants || null,
                isNew: true,
                needsConfirmation: true,
                addedFromGraph: graphId,
                addedAt: new Date(),
                metadata: {
                    distanceToNearest: pointData.distanceToNearest,
                    originalConfidence: point.confidence || 0.5
                }
            };

            this.invariantCells.set(cellId, newCell);

            this.templateCells.set(cellId, {
                center: { x: point.x || 0, y: point.y || 0 },
                radius: this.config.cellSize / 2,
                points: [point.id],
                confirmations: 1,
                confidence: pointQuality,
                sources: new Set([graphId]),
                matchedPoints: [],
                isNew: true
            });

            addedCount++;
        });

        this.createConnectionsForNewPoints(addedCount);

        console.log(`✅ Добавлено ${addedCount} новых точек (из ${unmatchedPoints.length} кандидатов)`);
        return addedCount;
    }

    // 🔥 Метод остается без изменений
    evaluatePointQuality(point, metadata) {
        let quality = 0;
        quality += (point.confidence || 0.5) * 0.4;

        if (metadata.quality) {
            quality += metadata.quality * 0.3;
        } else if (metadata.photoQuality) {
            quality += metadata.photoQuality * 0.3;
        } else {
            quality += 0.3 * 0.5;
        }

        if (point.invariants && point.invariants.nearestNeighbors) {
            quality += 0.1;
        }

        if (point.nx && point.ny) {
            const edgeDistance = Math.min(
                point.nx, 1 - point.nx,
                point.ny, 1 - point.ny
            );
            if (edgeDistance > 0.1) {
                quality += 0.2;
            }
        }

        return Math.min(1, Math.max(0, quality));
    }

    // 🔥 Метод остается без изменений
    refineTemplatePoints(matches, graphId) {
        let refinedCount = 0;
        const cellMatches = new Map();

        matches.exactMatches.concat(matches.partialMatches).forEach(match => {
            if (!cellMatches.has(match.cellId)) {
                cellMatches.set(match.cellId, []);
            }
            cellMatches.get(match.cellId).push(match);
        });

        for (const [cellId, matchList] of cellMatches) {
            if (matchList.length >= 2) {
                const cell = this.invariantCells.get(cellId);
                if (cell && cell.confirmations >= 3) {
                    const nxValues = matchList.map(m => m.newPoint.nx).sort((a, b) => a - b);
                    const nyValues = matchList.map(m => m.newPoint.ny).sort((a, b) => a - b);

                    const medianNX = nxValues[Math.floor(nxValues.length / 2)];
                    const medianNY = nyValues[Math.floor(nyValues.length / 2)];

                    const updateWeight = 0.5;
                    cell.normalizedCenter.nx = cell.normalizedCenter.nx * (1 - updateWeight) +
                                              medianNX * updateWeight;
                    cell.normalizedCenter.ny = cell.normalizedCenter.ny * (1 - updateWeight) +
                                              medianNY * updateWeight;

                    refinedCount++;
                }
            }
        }

        return refinedCount;
    }

    // 🔥 Метод остается без изменений
    processLowQualityPoints(lowQualityMatches, graphId) {
        if (lowQualityMatches.length === 0) return 0;

        console.log(`⚠️ Обрабатываю ${lowQualityMatches.length} низкокачественных совпадений...`);

        let processedCount = 0;
        const TEMPORARY_CONFIRMATIONS_THRESHOLD = 3;

        lowQualityMatches.forEach(match => {
            const cell = this.invariantCells.get(match.cellId);
            if (!cell) return;

            if (!cell.temporaryConfirmations) {
                cell.temporaryConfirmations = new Map();
            }

            const currentTemp = cell.temporaryConfirmations.get(graphId) || 0;
            cell.temporaryConfirmations.set(graphId, currentTemp + 1);

            const totalTempConfirmations = Array.from(cell.temporaryConfirmations.values())
                .reduce((sum, val) => sum + val, 0);

            if (totalTempConfirmations >= TEMPORARY_CONFIRMATIONS_THRESHOLD) {
                cell.confirmations = (cell.confirmations || 1) + 1;
                cell.confidence = Math.min(1.0, (cell.confidence || 0.7) + 0.05);
                cell.temporaryConfirmations.clear();
                processedCount++;
            }
        });

        return processedCount;
    }

    // 🔥 Метод остается без изменений
    createConnectionsForNewPoints(newPointsCount) {
        if (newPointsCount === 0 || this.invariantCells.size < 2) return;

        console.log(`🔗 Создаю связи для новых точек...`);

        const newCellIds = Array.from(this.invariantCells.entries())
            .filter(([id, cell]) => cell.isNew)
            .map(([id]) => id);

        if (newCellIds.length === 0) return;

        newCellIds.forEach(newCellId => {
            const newCell = this.invariantCells.get(newCellId);
            if (!newCell) return;

            const distances = [];

            for (const [otherCellId, otherCell] of this.invariantCells) {
                if (otherCellId === newCellId) continue;

                const distance = Math.sqrt(
                    Math.pow(otherCell.normalizedCenter.nx - newCell.normalizedCenter.nx, 2) +
                    Math.pow(otherCell.normalizedCenter.ny - newCell.normalizedCenter.ny, 2)
                );

                distances.push({
                    cellId: otherCellId,
                    distance: distance,
                    cell: otherCell
                });
            }

            distances.sort((a, b) => a.distance - b.distance);
            const nearest = distances.slice(0, 2);

            nearest.forEach(neighbor => {
                if (!this.cellConnections.has(newCellId)) {
                    this.cellConnections.set(newCellId, []);
                }
                if (!this.cellConnections.has(neighbor.cellId)) {
                    this.cellConnections.set(neighbor.cellId, []);
                }

                if (!this.cellConnections.get(newCellId).includes(neighbor.cellId)) {
                    this.cellConnections.get(newCellId).push(neighbor.cellId);
                }
                if (!this.cellConnections.get(neighbor.cellId).includes(newCellId)) {
                    this.cellConnections.get(neighbor.cellId).push(newCellId);
                }
            });
        });

        console.log(`✅ Создано связей для ${newCellIds.length} новых точек`);
    }

    // 🔥 Метод остается без изменений
    checkAndRestructureTemplate() {
        if (this.invariantCells.size < 10) return false;

        const cells = Array.from(this.invariantCells.values());
        const avgDistance = this.calculateAverageCellDistance(cells);

        console.log(`📏 Среднее расстояние между ячейками: ${avgDistance.toFixed(4)}`);

        if (avgDistance < 0.03) {
            console.log(`⚠️ Точки слишком плотные, проверяю необходимость кластеризации...`);
            return this.clusterClosePoints();
        }

        return false;
    }

    // 🔥 Метод остается без изменений
    calculateAverageCellDistance(cells) {
        if (cells.length < 2) return 0;

        let totalDistance = 0;
        let pairCount = 0;

        for (let i = 0; i < cells.length; i++) {
            for (let j = i + 1; j < cells.length; j++) {
                const dist = Math.sqrt(
                    Math.pow(cells[i].normalizedCenter.nx - cells[j].normalizedCenter.nx, 2) +
                    Math.pow(cells[i].normalizedCenter.ny - cells[j].normalizedCenter.ny, 2)
                );
                totalDistance += dist;
                pairCount++;
            }
        }

        return pairCount > 0 ? totalDistance / pairCount : 0;
    }

    // 🔥 Метод остается без изменений
    clusterClosePoints() {
        const CLUSTER_DISTANCE = 0.02;

        console.log(`🎯 Кластеризую точки ближе ${CLUSTER_DISTANCE}...`);

        const cells = Array.from(this.invariantCells.entries());
        const visited = new Set();
        const clusters = [];

        for (let i = 0; i < cells.length; i++) {
            const [cellId1, cell1] = cells[i];
            if (visited.has(cellId1)) continue;

            const cluster = [cellId1];
            visited.add(cellId1);

            for (let j = i + 1; j < cells.length; j++) {
                const [cellId2, cell2] = cells[j];
                if (visited.has(cellId2)) continue;

                const distance = Math.sqrt(
                    Math.pow(cell1.normalizedCenter.nx - cell2.normalizedCenter.nx, 2) +
                    Math.pow(cell1.normalizedCenter.ny - cell2.normalizedCenter.ny, 2)
                );

                if (distance < CLUSTER_DISTANCE) {
                    cluster.push(cellId2);
                    visited.add(cellId2);
                }
            }

            if (cluster.length > 1) {
                clusters.push(cluster);
            }
        }

        if (clusters.length === 0) {
            console.log(`📊 Нет близких точек для кластеризации`);
            return false;
        }

        console.log(`📊 Найдено ${clusters.length} кластеров близких точек`);

        let mergedCount = 0;
        clusters.forEach((cluster, clusterIndex) => {
            if (cluster.length < 2) return;

            console.log(`   Кластер ${clusterIndex + 1}: ${cluster.length} точек`);

            let totalNX = 0;
            let totalNY = 0;
            let totalWeight = 0;
            let totalConfirmations = 0;
            const sources = new Set();

            cluster.forEach(cellId => {
                const cell = this.invariantCells.get(cellId);
                if (!cell) return;

                const weight = cell.confirmations || 1;
                totalNX += cell.normalizedCenter.nx * weight;
                totalNY += cell.normalizedCenter.ny * weight;
                totalWeight += weight;
                totalConfirmations += cell.confirmations || 1;

                if (cell.sources) {
                    cell.sources.forEach(source => sources.add(source));
                }
            });

            if (totalWeight === 0) return;

            const centerNX = totalNX / totalWeight;
            const centerNY = totalNY / totalWeight;

            const mergedCellId = `cluster_${clusterIndex}_${Date.now()}`;
            const mergedCell = {
                normalizedCenter: { nx: centerNX, ny: centerNY },
                originalCenter: {
                    x: centerNX * (this.normalizationTransform?.width || 1) + (this.normalizationTransform?.minX || 0),
                    y: centerNY * (this.normalizationTransform?.height || 1) + (this.normalizationTransform?.minY || 0)
                },
                radius: 0.03,
                points: cluster.flatMap(cellId => {
                    const cell = this.invariantCells.get(cellId);
                    return cell?.points || [];
                }),
                confirmations: Math.round(totalConfirmations / cluster.length),
                confidence: 0.8,
                sources: sources,
                invariants: null,
                isMerged: true,
                mergedFrom: cluster,
                mergedAt: new Date()
            };

            cluster.forEach(cellId => {
                this.invariantCells.delete(cellId);
                this.templateCells.delete(cellId);
            });

            this.invariantCells.set(mergedCellId, mergedCell);
            this.templateCells.set(mergedCellId, {
                center: mergedCell.originalCenter,
                radius: this.config.cellSize / 2,
                points: mergedCell.points,
                confirmations: mergedCell.confirmations,
                confidence: mergedCell.confidence,
                sources: mergedCell.sources,
                matchedPoints: [],
                isMerged: true
            });

            mergedCount += cluster.length;

            console.log(`   → Объединено в ${mergedCellId} (${centerNX.toFixed(4)}, ${centerNY.toFixed(4)})`);
        });

        console.log(`✅ Кластеризация: удалено ${mergedCount} точек, создано ${clusters.length} объединенных`);
        this.rebuildCellConnections();

        return true;
    }

    // 🔥 Метод остается без изменений
    rebuildCellConnections() {
        console.log(`🔗 Перестраиваю связи между ячейками...`);

        this.cellConnections.clear();
        const cellIds = Array.from(this.invariantCells.keys());

        cellIds.forEach((cellId, i) => {
            const cell = this.invariantCells.get(cellId);
            if (!cell) return;

            const distances = [];

            cellIds.forEach((otherCellId, j) => {
                if (i === j) return;

                const otherCell = this.invariantCells.get(otherCellId);
                if (!otherCell) return;

                const distance = Math.sqrt(
                    Math.pow(otherCell.normalizedCenter.nx - cell.normalizedCenter.nx, 2) +
                    Math.pow(otherCell.normalizedCenter.ny - cell.normalizedCenter.ny, 2)
                );

                distances.push({
                    cellId: otherCellId,
                    distance: distance
                });
            });

            distances.sort((a, b) => a.distance - b.distance);
            const nearest = distances.slice(0, 3);

            this.cellConnections.set(cellId, nearest.map(n => n.cellId));
        });

        console.log(`✅ Перестроено связей для ${cellIds.length} ячеек`);
    }

    // 🔥 Метод остается без изменений
    buildInvariantGrid() {
        console.log(`🔲 Создаю ИНВАРИАНТНУЮ сетку из ${this.normalizedReferencePoints.length} точек...`);

        this.invariantCells.clear();
        this.templateCells.clear();
        this.cellAssignments.clear();

        this.normalizedReferencePoints.forEach((point, index) => {
            const cellId = `cell_${index}`;

            const invariantCell = {
                normalizedCenter: { nx: point.nx, ny: point.ny },
                originalCenter: { x: point.x, y: point.y },
                radius: 0.05,
                points: [point.id],
                confirmations: 1,
                confidence: 0.8,
                sources: new Set([this.referenceGraphId]),
                invariants: this.calculatePointInvariants(point, this.normalizedReferencePoints)
            };

            this.invariantCells.set(cellId, invariantCell);

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

    // 🔥 Метод остается без изменений
    calculatePointInvariants(point, allPoints) {
        const invariants = {
            nearestNeighbors: [],
            distanceDistribution: [],
            angularDistribution: []
        };

        if (allPoints.length < 2) return invariants;

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

        const allDistances = allPoints
            .filter(p => p.id !== point.id)
            .map(p => Math.sqrt(Math.pow(p.nx - point.nx, 2) + Math.pow(p.ny - point.ny, 2)));

        invariants.distanceDistribution = this.createDistanceHistogram(allDistances, 5);

        return invariants;
    }

    // 🔥 Метод остается без изменений
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

        const total = distances.length;
        return histogram.map(count => count / total);
    }

    // 🔥 Метод остается без изменений
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY)
        };
    }

    // 🔥 Метод остается без изменений
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

    // 🔥 Метод остается без изменений
    getVisualizationData() {
        const cellsArray = [];
        let totalConfirmations = 0;
        let totalCells = 0;
        let newCellsCount = 0;
        let unconfirmedCells = 0;

        for (const [cellId, cell] of this.invariantCells) {
            const confirmations = cell.confirmations || 1;
            totalConfirmations += confirmations;
            totalCells++;

            if (cell.isNew) newCellsCount++;
            if (confirmations === 1) unconfirmedCells++;

            cellsArray.push({
                id: cellId,
                x: cell.originalCenter.x,
                y: cell.originalCenter.y,
                nx: cell.normalizedCenter.nx,
                ny: cell.normalizedCenter.ny,
                radius: cell.radius * 100,
                confirmations: confirmations,
                confidence: cell.confidence || 0.7,
                sources: cell.sources ? Array.from(cell.sources) : [],
                pointCount: cell.points ? cell.points.length : 0,
                isHighConfidence: cell.confirmations >= this.config.highConfidenceThreshold,
                invariants: cell.invariants ? 'present' : 'none',
                isNew: cell.isNew || false,
                needsConfirmation: cell.needsConfirmation || false,
                isMerged: cell.isMerged || false,
                status: this.getCellStatus(cell)
            });
        }

        const confirmedCells = cellsArray.filter(c => c.confirmations > 1).length;
        const avgConfirmations = totalCells > 0 ? totalConfirmations / totalCells : 0;
        const confirmationRate = totalCells > 0 ? confirmedCells / totalCells : 0;

        return {
            templateId: this.id,
            name: this.name,
            referenceGraphId: this.referenceGraphId,
            referenceGraphQuality: this.referenceGraphQuality,
            cells: cellsArray,
            stats: {
                totalCells: totalCells,
                totalConfirmations: totalConfirmations,
                averageConfirmations: avgConfirmations,
                confirmedCells: confirmedCells,
                confirmationRate: confirmationRate,
                highConfidenceCells: cellsArray.filter(c => c.confidence > 0.8).length,
                newCells: newCellsCount,
                unconfirmedCells: unconfirmedCells,
                mergedCells: cellsArray.filter(c => c.isMerged).length,
                ...this.stats,
                cellCount: this.invariantCells.size,
                avgConfirmations: avgConfirmations
            },
            referencePoints: this.normalizedReferencePoints,
            transformationsCount: this.graphTransformations.size,
            normalizationTransform: this.normalizationTransform,
            templateCoordinateSystem: this.templateCoordinateSystem,
            dynamicInfo: {
                bestGraphId: this.bestGraphId,
                bestGraphQuality: this.bestGraphQuality,
                totalGraphs: this.allGraphs.size,
                referenceUpdateCount: this.stats.bestGraphUpdates || 0
            }
        };
    }

    // 🔥 Метод остается без изменений
    getCellStatus(cell) {
        if (cell.isNew && cell.confirmations === 1) {
            return 'new_unconfirmed';
        } else if (cell.isNew && cell.confirmations > 1) {
            return 'new_confirmed';
        } else if (cell.confirmations >= 3) {
            return 'high_confidence';
        } else if (cell.confirmations >= 2) {
            return 'confirmed';
        } else if (cell.temporaryConfirmations && cell.temporaryConfirmations.size > 0) {
            return 'temporary';
        } else {
            return 'single';
        }
    }

    // 🔥 Метод остается без изменений
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
            templateCoordinateSystem: this.templateCoordinateSystem,
            graphStats: {
                total: this.allGraphs.size,
                qualities: Array.from(this.graphQualities.entries())
                    .map(([id, quality]) => ({ id: id.slice(0, 8), quality: quality.toFixed(3) }))
                    .sort((a, b) => b.quality - a.quality)
                    .slice(0, 5)
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

    // 🔥 Метод остается без изменений
    getNormalizationTransform() {
        return this.normalizationTransform || {
            minX: 0, maxX: 1, minY: 0, maxY: 1,
            width: 1, height: 1
        };
    }

    // 🔥 Метод остается без изменений
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
        this.stats.totalConfirmations = totalConfirmations;
        this.stats.avgConfirmations = this.invariantCells.size > 0 ?
            totalConfirmations / this.invariantCells.size : 0;
    }

    // 🔥 Метод остается без изменений
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
            templateCoordinateSystem: this.templateCoordinateSystem,
            _version: '3.1-unified-coordinate-system',
            _savedAt: new Date().toISOString()
        };
    }

    // 🔥 Метод остается без изменений
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
        builder.templateCoordinateSystem = data.templateCoordinateSystem || null;

        // Инициализируем конвертер
        builder.coordinateConverter = new CoordinateSystemConverter({
            debug: builder.config.debug || false
        });

        if (data.allGraphs) {
            for (const [graphId, graphData] of Object.entries(data.allGraphs)) {
                builder.allGraphs.set(graphId, graphData);
            }
        }

        if (data.graphQualities) {
            for (const [graphId, quality] of Object.entries(data.graphQualities)) {
                builder.graphQualities.set(graphId, quality);
            }
        }

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

        if (data.templateCells) {
            for (const [cellId, cellData] of Object.entries(data.templateCells)) {
                builder.templateCells.set(cellId, {
                    ...cellData,
                    sources: new Set(cellData.sources || [])
                });
            }
        }

        if (data.cellConnections) {
            for (const [cellId, connections] of Object.entries(data.cellConnections)) {
                builder.cellConnections.set(cellId, connections);
            }
        }

        if (data.cellAssignments) {
            for (const [pointId, cellId] of Object.entries(data.cellAssignments)) {
                builder.cellAssignments.set(pointId, cellId);
            }
        }

        if (data.graphTransformations) {
            for (const [graphId, transform] of Object.entries(data.graphTransformations)) {
                builder.graphTransformations.set(graphId, transform);
            }
        }

        if (data.stats) {
            builder.stats = { ...builder.stats, ...data.stats };
            if (typeof data.stats.createdAt === 'string') {
                builder.stats.createdAt = new Date(data.stats.createdAt);
            }
            if (typeof data.stats.lastUpdated === 'string') {
                builder.stats.lastUpdated = new Date(data.stats.lastUpdated);
            }
        }

        builder.normalizedReferencePoints = data.referencePoints || [];
        builder.referencePoints = builder.normalizedReferencePoints.map(p => ({
            ...p,
            x: p.x || (p.normalizedCenter ? p.normalizedCenter.x * 100 : 0),
            y: p.y || (p.normalizedCenter ? p.normalizedCenter.y * 100 : 0)
        }));

        console.log(`📂 Загружен TemplateBuilder "${builder.name}" с ЕДИНОЙ системой координат`);
        console.log(`   Ячеек: ${builder.invariantCells.size}, Графов: ${builder.allGraphs.size}`);
        console.log(`   Текущий эталон: ${builder.referenceGraphId} (${builder.referenceGraphQuality.toFixed(3)})`);
        console.log(`   Лучший граф: ${builder.bestGraphId} (${builder.bestGraphQuality.toFixed(3)})`);

        return builder;
    }
}

module.exports = TemplateBuilder;
