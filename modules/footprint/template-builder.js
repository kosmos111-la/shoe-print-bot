// modules/footprint/template-builder.js
// 🔥 ПЕРЕРАБОТАННЫЙ С ДИНАМИЧЕСКИМ ЭТАЛОНОМ И ПОЛНЫМ НАКОПЛЕНИЕМ
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
        this.referenceGraphQuality = 0;

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

        console.log(`🏗️ Создан TemplateBuilder "${this.name}" с ДИНАМИЧЕСКИМ эталоном и полным накоплением`);
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: Добавить граф с ПРАВИЛЬНОЙ системой координат
    addGraph(graph, graphId, metadata = {}) {
    console.log(`\n🎯 ======== ДОБАВЛЕНИЕ ГРАФА ${graphId.slice(0, 8)} ========`);

    // 🔥 ВАЖНОЕ ИЗМЕНЕНИЕ: ЕСЛИ УЖЕ ПОДТВЕРЖДЕНО СРАВНЕНИЕМ
    if (metadata.isConfirmedMatch && metadata.similarity > 0.6) {
        console.log(`✅ ПРИНИМАЮ РЕШЕНИЕ О СОВПАДЕНИИ:`);
        console.log(`   Сходство: ${metadata.similarity.toFixed(3)}`);
        console.log(`   Совпало точек: ${metadata.matchDetails?.pointsMatched || 'N/A'}`);
        console.log(`   Пропускаю свою проверку, доверяю сравнению`);

        return this.addConfirmedMatch(graph, graphId, metadata);
    }

    // 🔥 ПРОВЕРЯЕМ ЕСТЬ ЛИ ДАННЫЕ СРАВНЕНИЯ
    if (metadata.comparisonResult && metadata.comparisonResult.similarity > 0.6) {
        console.log(`📊 Использую данные сравнения из SimpleManager`);
        console.log(`   Сходство: ${metadata.comparisonResult.similarity.toFixed(3)}`);
        return this.addConfirmedMatch(graph, graphId, {
            ...metadata,
            similarity: metadata.comparisonResult.similarity,
            transformationInfo: metadata.comparisonResult.alignmentInfo
        });
    }

    // Старая логика для следов без предварительной проверки
    console.log(`🔄 Добавляю граф ${graphId} с ПРАВИЛЬНОЙ системой координат...`);

    const realPoints = this.extractRealPointsFromGraph(graph, metadata);

    if (realPoints.length < 3) {
        console.log(`❌ Недостаточно реальных точек: ${realPoints.length}`);
        return false;
    }

    console.log(`📊 Реальные точки: ${realPoints.length} (первая: ${realPoints[0]?.x?.toFixed(1)}, ${realPoints[0]?.y?.toFixed(1)})`);

    // Если первый граф - устанавливаем эталон
    if (!this.referenceGraph) {
        console.log(`🎯 Первый граф, устанавливаю как эталон с реальными координатами`);
        return this.setReferenceGraphWithRealPoints(graph, graphId, realPoints, metadata);
    }

    // Продолжение старой логики...
    const normalizedPoints = this.normalizeToTemplateSystem(realPoints, metadata);
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

    const updatedCells = this.updateTemplateWithMatches(matchResults, graphId);
    const newCellsAdded = this.addNewPointsToTemplate(
        matchResults.unmatchedPoints,
        graphId,
        metadata
    );
    const refinedCells = this.refineTemplatePoints(matchResults, graphId);
    const lowQualityProcessed = this.processLowQualityPoints(
        matchResults.lowQualityMatches,
        graphId
    );

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

    this.stats.totalGraphs++;
    this.stats.lastUpdated = new Date();
    this.updateStats();

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

// 🔥 НОВЫЙ МЕТОД: Добавить подтверждённый след
addConfirmedMatch(graph, graphId, metadata) {
    console.log(`🔄 Добавляю подтверждённый след ${graphId}...`);

    // 1. Получаем реальные точки
    const realPoints = this.extractRealPointsFromGraph(graph, metadata);
    console.log(`📊 Реальные точки: ${realPoints.length}`);

    // 2. 🔥 ИСПОЛЬЗУЕМ ТУ ЖЕ ТРАНСФОРМАЦИЮ ЧТО И ПРИ СРАВНЕНИИ
    const RotationInvariance = require('./rotation-invariance');
    const processor = new RotationInvariance({ debug: false });

    // Если есть информация о трансформации из сравнения - используем её
    let pointsToAdd = realPoints;

    if (metadata.transformationInfo) {
        const angle = metadata.transformationInfo.rotationAngle || 0;
        console.log(`📐 Применяю трансформацию из сравнения: ${angle.toFixed(1)}° → 0°`);

        // Поворачиваем к 0° (как в compareWithPatterns)
        pointsToAdd = processor.transformPointsSimple(realPoints, angle, 0);

        // Центрируем к (500, 500) - как в compareWithPatterns
        pointsToAdd = processor.alignPointsToCommonSystem(pointsToAdd);
    }

    // 3. Нормализуем к системе шаблона
    const normalizedPoints = this.normalizeToTemplateSystem(pointsToAdd, metadata);

    // 4. 🔥 ПРОСТО ДОБАВЛЯЕМ ВСЕ ТОЧКИ БЕЗ ПРОВЕРКИ
    const addedCount = this.addAllPointsToTemplate(
        normalizedPoints,
        graphId,
        metadata,
        metadata.similarity || 0.7
    );

    // 5. Сохраняем информацию о добавлении
    this.graphTransformations.set(graphId, {
        metadata: metadata,
        timestamp: new Date(),
        pointsCount: realPoints.length,
        addedAsConfirmedMatch: true,
        similarity: metadata.similarity,
        matchDetails: metadata.matchDetails,
        addedCount: addedCount
    });

    // 6. Обновляем статистику
    this.stats.totalGraphs++;
    this.stats.lastUpdated = new Date();
    this.updateStats();

    console.log(`✅ Подтверждённый след добавлен: ${addedCount} точек`);
   
    // 🔥 ПРОВЕРЯЕМ, НЕ ЛУЧШЕ ЛИ ЭТОТ СЛЕД
    if (metadata.similarity > this.bestGraphQuality) {
        console.log(`🏆 Этот след лучше текущего эталона!`);
        console.log(`   Новое качество: ${metadata.similarity.toFixed(3)}`);
        console.log(`   Старое качество: ${this.bestGraphQuality.toFixed(3)}`);
       
        if (metadata.similarity > this.bestGraphQuality * 1.1) {
            console.log(`🔄 Обновляю эталон на ${graphId}`);
            this.autoUpdateReferenceGraph(graphId);
        }
    }

    return true;
}

// 🔥 НОВЫЙ МЕТОД: Добавить все точки без проверки
addAllPointsToTemplate(normalizedPoints, graphId, metadata, confidence = 0.7) {
    console.log(`🆕 Добавляю ${normalizedPoints.length} точек без проверки...`);

    let addedCount = 0;
    let updatedCount = 0;

    normalizedPoints.forEach((point, index) => {
        // Ищем ближайшую существующую ячейку
        let nearestCellId = null;
        let minDistance = Infinity;

        for (const [cellId, cell] of this.invariantCells) {
            const distance = Math.sqrt(
                Math.pow(cell.normalizedCenter.nx - point.nx, 2) +
                Math.pow(cell.normalizedCenter.ny - point.ny, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestCellId = cellId;
            }
        }

        // 🔥 ПРАВИЛО: Если близко (<5%) - обновляем существующую
        //           Если далеко - создаём новую
        if (nearestCellId && minDistance < 0.05) {
            // Обновляем существующую ячейку
            const cell = this.invariantCells.get(nearestCellId);
            if (cell) {
                cell.confirmations = (cell.confirmations || 1) + 1;
                cell.confidence = Math.min(1.0, (cell.confidence || 0.5) + 0.1);

                if (!cell.sources) cell.sources = new Set();
                cell.sources.add(graphId);

                // Немного корректируем центр (с малым весом)
                const weight = 0.3 / cell.confirmations;
                cell.normalizedCenter.nx = cell.normalizedCenter.nx * (1 - weight) + point.nx * weight;
                cell.normalizedCenter.ny = cell.normalizedCenter.ny * (1 - weight) + point.ny * weight;

                updatedCount++;
            }
        } else {
            // Создаём новую ячейку
            const cellId = `cell_confirmed_${graphId}_${index}`;

            const newCell = {
                normalizedCenter: { nx: point.nx || 0, ny: point.ny || 0 },
                originalCenter: { x: point.x || 0, y: point.y || 0 },
                radius: 0.04,
                points: [point.id || `point_${index}`],
                confirmations: 1,
                confidence: confidence,
                sources: new Set([graphId]),
                invariants: point.invariants || null,
                isNew: true,
                addedFromConfirmedMatch: true,
                addedAt: new Date(),
                metadata: {
                    originalConfidence: point.confidence || 0.5,
                    fromGraph: graphId
                }
            };

            this.invariantCells.set(cellId, newCell);
            addedCount++;
        }
    });

    console.log(`📈 Результат: +${addedCount} новых, ${updatedCount} обновлено`);
    return addedCount + updatedCount;
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

        // Если есть трансформация в метаданных - применяем ОБРАТНУЮ трансформацию
        if (metadata.transformationInfo && metadata.transformationInfo.matrix) {
            console.log(`📐 Применяю обратную трансформацию к ${points.length} точкам`);
            return this.applyInverseTransformationToPoints(points, metadata.transformationInfo);
        }

        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Применить обратную трансформацию к точкам
    applyInverseTransformationToPoints(points, transformationInfo) {
        if (!transformationInfo || !transformationInfo.matrix) return points;

        const matrix = transformationInfo.matrix;
        const center = transformationInfo.center || { x: 0, y: 0 };

        // Проверяем, является ли матрица обратимой
        const determinant = matrix[0] * matrix[4] - matrix[1] * matrix[3];
        if (Math.abs(determinant) < 0.0001) {
            console.log(`⚠️ Матрица трансформации вырождена, пропускаю обратную трансформацию`);
            return points;
        }

        // Вычисляем обратную матрицу для поворота
        const cosAngle = Math.cos(-transformationInfo.rotationAngle * Math.PI / 180);
        const sinAngle = Math.sin(-transformationInfo.rotationAngle * Math.PI / 180);

        return points.map(point => {
            // Переносим в систему координат с центром в центре трансформации
            const dx = point.x - center.x;
            const dy = point.y - center.y;

            // Применяем обратное вращение
            const rotatedX = dx * cosAngle - dy * sinAngle;
            const rotatedY = dx * sinAngle + dy * cosAngle;

            // Возвращаем в исходную систему координат
            return {
                ...point,
                x: rotatedX + center.x,
                y: rotatedY + center.y,
                originalCoordinates: { x: point.x, y: point.y } // Сохраняем оригинальные
            };
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Нормализовать к системе шаблона
    normalizeToTemplateSystem(points, metadata) {
        if (!this.normalizationTransform) {
            console.log(`⚠️ Нет трансформации шаблона, использую прямую нормализацию`);
            return this.normalizePoints(points, {
                minX: 0, maxX: 1, minY: 0, maxY: 1,
                width: 1, height: 1
            });
        }

        // Нормализуем к системе шаблона
        const normalized = points.map(point => {
            const nx = (point.x - this.normalizationTransform.minX) / this.normalizationTransform.width;
            const ny = (point.y - this.normalizationTransform.minY) / this.normalizationTransform.height;

            return {
                ...point,
                nx: nx,
                ny: ny,
                normalized: true
            };
        });

        console.log(`📐 Нормализовано ${normalized.length} точек к системе шаблона`);
        return normalized;
    }

    // 🔥 НОВЫЙ МЕТОД: Установить эталонный граф с реальными точками
    setReferenceGraphWithRealPoints(graph, graphId, realPoints, metadata) {
        console.log(`🎯 Устанавливаю эталонный граф с РЕАЛЬНЫМИ координатами: ${graphId}`);

        this.referenceGraph = graph;
        this.referenceGraphId = graphId;

        // Сохраняем реальные точки как эталонные
        this.referencePoints = realPoints;

        // Нормализуем для создания системы координат шаблона
        this.normalizeReferencePoints();

        // 🔥 СОХРАНЯЕМ ГРАФ В КОЛЛЕКЦИИ
        const quality = this.calculateGraphQuality(graph, metadata);
        this.saveGraph(graph, graphId, metadata, quality);

        // 🔥 ЭТО ПОКА ЛУЧШИЙ ГРАФ
        this.bestGraphId = graphId;
        this.bestGraphQuality = quality;

        // Создаем инвариантную сетку на основе реальных точек
        this.buildInvariantGrid();

        // Извлекаем топологию
        this.extractTopologyFromGraph(graph);

        console.log(`✅ Эталон установлен с ${realPoints.length} реальными точками`);
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Найти совпадения в нормализованной системе
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

    // 🔥 НОВЫЙ МЕТОД: Рассчитать качество совпадений
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

    // 🔥 Остальные методы без изменений...
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

    // 🔥 Остальные методы остаются без изменений...
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
            dynamicInfo: {
                bestGraphId: this.bestGraphId,
                bestGraphQuality: this.bestGraphQuality,
                totalGraphs: this.allGraphs.size,
                referenceUpdateCount: this.stats.bestGraphUpdates || 0
            }
        };
    }

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

    normalizeReferencePoints() {
        if (this.referencePoints.length === 0) return;

        const bounds = this.calculateBounds(this.referencePoints);

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

    setReferenceGraph(graph, graphId, metadata = {}) {
        console.log(`🎯 Устанавливаю эталонный граф с ДИНАМИЧЕСКИМ ЭТАЛОНОМ: ${graphId}`);

        if (!graph || !graph.nodes) {
            console.log(`❌ Граф не существует`);
            return false;
        }

        const quality = this.calculateGraphQuality(graph, metadata);
        console.log(`📈 Качество графа ${graphId}: ${quality.toFixed(3)}`);

        this.referenceGraph = graph;
        this.referenceGraphId = graphId;
        this.referenceGraphQuality = quality;

        this.referencePoints = this.extractPointsFromGraph(graph);
        console.log(`📊 Извлечено ${this.referencePoints.length} точек эталона`);

        this.normalizeReferencePoints();

        this.saveGraph(graph, graphId, metadata, quality);

        this.bestGraphId = graphId;
        this.bestGraphQuality = quality;

        this.buildInvariantGrid();

        this.extractTopologyFromGraph(graph);

        console.log(`✅ Эталон установлен с качеством ${quality.toFixed(3)} и ${this.invariantCells.size} ячейками`);
        return true;
    }

    calculateGraphQuality(graph, metadata = {}) {
        if (!graph || !graph.nodes) return 0;

        const nodes = Array.from(graph.nodes.values());
        const edges = Array.from(graph.edges?.values() || []);

        if (nodes.length < 5) {
            return Math.min(0.5, nodes.length / 10);
        }

        let totalScore = 0;
        let weightSum = 0;

        const nodeScore = Math.min(1, nodes.length / 40);
        totalScore += nodeScore * 0.25;
        weightSum += 0.25;

        const uniformityScore = this.calculateNodeUniformity(nodes);
        totalScore += uniformityScore * 0.20;
        weightSum += 0.20;

        const connectivityScore = this.calculateConnectivityScore(nodes, edges);
        totalScore += connectivityScore * 0.20;
        weightSum += 0.20;

        const confidenceScore = this.calculateConfidenceScore(nodes, metadata);
        totalScore += confidenceScore * 0.20;
        weightSum += 0.20;

        const coverageScore = this.calculateCoverageScore(nodes);
        totalScore += coverageScore * 0.15;
        weightSum += 0.15;

        const finalScore = weightSum > 0 ? totalScore / weightSum : 0;

        if (metadata.photoQuality && metadata.photoQuality > 0.7) {
            return Math.min(1, finalScore * 1.1);
        }

        return Math.max(0, Math.min(1, finalScore));
    }

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

        if (quality > this.bestGraphQuality) {
            const oldBest = this.bestGraphId;
            this.bestGraphId = graphId;
            this.bestGraphQuality = quality;

            console.log(`🏆 НОВЫЙ ЛУЧШИЙ ГРАФ: ${graphId} (${quality.toFixed(3)})`);
            console.log(`   Было: ${oldBest || 'нет'} (${this.bestGraphQuality.toFixed(3)})`);

            this.autoUpdateReferenceGraph(graphId);
        }

        console.log(`💾 Сохранён граф ${graphId} (качество: ${quality.toFixed(3)})`);
    }

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

        const improvementThreshold = 1.15;

        if (newQuality > currentQuality * improvementThreshold) {
            console.log(`🔄 АВТООБНОВЛЕНИЕ ЭТАЛОНА:`);
            console.log(`   Старый: ${this.referenceGraphId} (${currentQuality.toFixed(3)})`);
            console.log(`   Новый: ${newBestGraphId} (${newQuality.toFixed(3)})`);
            console.log(`   Улучшение: ${(newQuality / currentQuality).toFixed(2)}x`);

            const oldConfirmations = this.collectAllConfirmations();

            this.referenceGraph = graphData.graph;
            this.referenceGraphId = newBestGraphId;
            this.referenceGraphQuality = newQuality;

            this.rebuildTemplateWithNewReference(graphData.graph, newBestGraphId);

            this.restoreConfirmations(oldConfirmations, newBestGraphId);

            console.log(`✅ Эталон обновлён на ${newBestGraphId}`);
            return true;
        }

        console.log(`📊 Новый граф лучше, но недостаточно для замены эталона:`);
        console.log(`   Нужно: ${(currentQuality * improvementThreshold).toFixed(3)}`);
        console.log(`   Есть: ${newQuality.toFixed(3)}`);

        return false;
    }

    collectAllConfirmations() {
        const confirmations = {
            cells: new Map(),
            points: new Map(),
            sources: new Map()
        };

        for (const [cellId, cell] of this.invariantCells) {
            if (cell.confirmations > 1) {
                confirmations.cells.set(cellId, {
                    confirmations: cell.confirmations,
                    confidence: cell.confidence,
                    sources: cell.sources ? new Set(cell.sources) : new Set()
                });
            }
        }

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

    rebuildTemplateWithNewReference(newReferenceGraph, newGraphId) {
        console.log(`🏗️ Перестраиваю шаблон с новым эталоном ${newGraphId}...`);

        const oldInvariantCells = new Map(this.invariantCells);
        const oldTemplateCells = new Map(this.templateCells);
        const oldNormalizationTransform = this.normalizationTransform;

        this.invariantCells.clear();
        this.templateCells.clear();
        this.cellAssignments.clear();
        this.cellConnections.clear();

        this.referencePoints = this.extractPointsFromGraph(newReferenceGraph);
        this.normalizeReferencePoints();

        this.buildInvariantGrid();

        this.extractTopologyFromGraph(newReferenceGraph);

        console.log(`✅ Шаблон перестроен с ${this.invariantCells.size} ячейками`);

        return {
            oldInvariantCells,
            oldTemplateCells,
            oldNormalizationTransform
        };
    }

    restoreConfirmations(oldConfirmations, newReferenceGraphId) {
        if (!oldConfirmations || oldConfirmations.cells.size === 0) {
            console.log('📊 Нет старых подтверждений для восстановления');
            return 0;
        }

        console.log(`🔄 Восстанавливаю подтверждения на новом эталоне...`);
        let restoredCount = 0;

        for (const [oldCellId, oldData] of oldConfirmations.cells) {
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

    calculateNodeUniformity(nodes) {
        if (nodes.length < 4) return 0.5;

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

        return Math.min(1, avgDegree / 3);
    }

    calculateConfidenceScore(nodes, metadata) {
        let totalConfidence = 0;
        nodes.forEach(node => {
            totalConfidence += node.confidence || 0.5;
        });
        const avgNodeConfidence = nodes.length > 0 ? totalConfidence / nodes.length : 0.5;

        let metadataConfidence = 0.5;
        if (metadata.photoQuality) {
            metadataConfidence = metadata.photoQuality;
        } else if (metadata.confidence) {
            metadataConfidence = metadata.confidence;
        }

        return (avgNodeConfidence * 0.7 + metadataConfidence * 0.3);
    }

    calculateCoverageScore(nodes) {
        if (nodes.length < 3) return 0.3;

        const xs = nodes.map(n => n.x || 0);
        const ys = nodes.map(n => n.y || 0);

        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);

        const bboxArea = width * height;
        if (bboxArea < 1) return 0.3;

        const pointDensity = nodes.length / bboxArea;

        const normalizedDensity = Math.min(1, pointDensity * 0.1);

        return normalizedDensity;
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

        const angles1 = neighbors1.map(n => n.angle).sort((a, b) => a - b);
        const angles2 = neighbors2.map(n => n.angle).sort((a, b) => a - b);

        const minLength = Math.min(angles1.length, angles2.length);
        if (minLength === 0) return 0;

        let score = 0;
        for (let i = 0; i < minLength; i++) {
            const diff = Math.abs(angles1[i] - angles2[i]);
            score += 1 - Math.min(1, diff / Math.PI);
        }

        return score / minLength;
    }

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
        this.stats.totalConfirmations = totalConfirmations;
        this.stats.avgConfirmations = this.invariantCells.size > 0 ?
            totalConfirmations / this.invariantCells.size : 0;
    }

    calculateZones() {
        if (this.normalizedReferencePoints.length === 0) return {};

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

        Object.keys(zones).forEach(zone => {
            if (zones[zone].cells > 0) {
                zones[zone].confidence = zones[zone].confidence / zones[zone].cells;
                zones[zone].avgConfirmations = zones[zone].confirmations / zones[zone].cells;
            }
        });

        return zones;
    }

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

    getBestGraph() {
        if (!this.bestGraphId || !this.allGraphs.has(this.bestGraphId)) {
            return this.referenceGraph;
        }

        return this.allGraphs.get(this.bestGraphId).graph;
    }

    getAllGraphsSortedByQuality() {
        const graphs = Array.from(this.allGraphs.values());
        return graphs.sort((a, b) => b.quality - a.quality);
    }

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

        console.log(`📂 Загружен TemplateBuilder "${builder.name}" с ДИНАМИЧЕСКИМ эталоном и накоплением`);
        console.log(`   Ячеек: ${builder.invariantCells.size}, Графов: ${builder.allGraphs.size}`);
        console.log(`   Текущий эталон: ${builder.referenceGraphId} (${builder.referenceGraphQuality.toFixed(3)})`);
        console.log(`   Лучший граф: ${builder.bestGraphId} (${builder.bestGraphQuality.toFixed(3)})`);

        return builder;
    }
}

module.exports = TemplateBuilder;
