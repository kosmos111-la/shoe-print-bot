// modules/footprint/vector-super-model.js
// 🔥 ИСПРАВЛЕНИЕ: Добавляем метод compareWithPatterns для совместимости

const TemplateBuilder = require('./template-builder');

class VectorSuperModel {
    constructor(options = {}) {
        this.id = `vsm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблонная супер-модель';

        // 🔥 ЗАМЕНЯЕМ СТАРУЮ ЛОГИКУ НА TEMPLATE BUILDER
        this.templateBuilder = new TemplateBuilder({
            name: `Шаблон_${this.name}`,
            enablePCA: false, // 🔥 ОТКЛЮЧАЕМ PCA
            cellSize: 25,     // 🔥 УВЕЛИЧИВАЕМ РАЗМЕР ЯЧЕЙКИ
            ...options
        });

        // Для совместимости сохраняем старые поля
        this.nodes = []; // Устарело, но оставляем

        // 🔥 Храним ссылки на исходные графы
        this.sourceGraphs = new Map(); // graphId -> {graph, metadata, nodeCount, addedAt}

        // 🔥 Лучший след-представитель
        this.bestGraphId = null;
        this.bestGraphScore = 0;
        this.bestGraphMetadata = null;

        // Статистика
        this.stats = {
            totalMerges: 0,
            totalGraphsAdded: 0,
            confidence: 0,
            createdAt: new Date(),
            lastUpdated: new Date(),
            bestGraphUpdates: 0,
            sourceGraphsCount: 0,
            templateCells: 0,
            confirmedCells: 0,
            avgConfirmations: 0
        };

        // 🔥 НАСТРОЙКИ ДЛЯ ДИНАМИЧЕСКОГО ЭТАЛОНА
        this.config = {
            matchThreshold: options.matchThreshold || 0.08,
            minConfirmationsForHighConfidence: 2,
            bestGraphMinNodes: options.bestGraphMinNodes || 15,
            enableTemplateMode: true,
            enableDynamicReference: true, // 🔥 ВКЛЮЧАЕМ ДИНАМИЧЕСКИЙ ЭТАЛОН
            referenceUpdateThreshold: 1.15, // На 15% лучше
            minQualityForReference: 0.4,
            ...options
        };

        console.log(`🏗️ Создана ШАБЛОННАЯ векторная супер-модель "${this.name}" с ДИНАМИЧЕСКИМ эталоном`);
    }

 // 🔥 ДОБАВЛЯЕМ ОТСУТСТВУЮЩИЙ МЕТОД updateStats()
    updateStats() {
        console.log(`📊 VectorSuperModel.updateStats() - обновление статистики`);

        try {
            // Получаем реальные данные из TemplateBuilder
            const templateInfo = this.templateBuilder ? this.templateBuilder.getInfo() : null;
            const visualizationData = this.templateBuilder ? this.templateBuilder.getVisualizationData() : null;

            if (!visualizationData || !visualizationData.cells || visualizationData.cells.length === 0) {
                console.log('⚠️ Нет данных визуализации для обновления статистики');
                this.stats.confidence = 0;
                this.stats.templateCells = 0;
                this.stats.confirmedCells = 0;
                this.stats.avgConfirmations = 0;
                return;
            }

            // 🔥 БЕРЕМ РЕАЛЬНЫЕ ДАННЫЕ ИЗ ВИЗУАЛИЗАЦИИ
            const cells = visualizationData.cells;
            const stats = visualizationData.stats || {};

            // 🔥 ОБНОВЛЯЕМ СТАТИСТИКУ
            this.stats.templateCells = cells.length;
            this.stats.confirmedCells = stats.confirmedCells || 0;
            this.stats.totalConfirmations = stats.totalConfirmations || 0;  // 🔥 ВАЖНО!
            this.stats.averageConfirmations = stats.averageConfirmations || 0;
            this.stats.highConfidenceCells = stats.highConfidenceCells || 0;

            // 🔥 РАСЧЕТ УВЕРЕННОСТИ
            const confirmedRatio = this.stats.confirmedCells / Math.max(1, this.stats.templateCells);
            const avgConfirmations = this.stats.averageConfirmations;

            // 🔥 НОВАЯ ФОРМУЛА УВЕРЕННОСТИ
            this.stats.confidence = Math.min(1.0,
                confirmedRatio * 0.5 +                    // 50% за долю подтвержденных
                Math.min(0.3, avgConfirmations * 0.15) +  // 30% за среднее подтверждений
                (this.bestGraphScore * 0.2)               // 20% за качество лучшего графа
            );

            // 🔥 ОБНОВЛЯЕМ ВРЕМЯ ПОСЛЕДНЕГО ОБНОВЛЕНИЯ
            this.stats.lastUpdated = new Date();

            console.log(`✅ Статистика обновлена:`);
            console.log(`   Ячеек: ${this.stats.templateCells}`);
            console.log(`   Подтвержденных: ${this.stats.confirmedCells}`);
            console.log(`   Среднее подтверждений: ${this.stats.averageConfirmations.toFixed(2)}`);
            console.log(`   Уверенность: ${this.stats.confidence.toFixed(3)}`);

        } catch (error) {
            console.error(`❌ Ошибка обновления статистики:`, error.message);
            this.stats.confidence = 0;
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Добавить граф
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к динамической супер-модели...`);

        // 1. Сохраняем исходный граф
        this.saveSourceGraph(graph, graphId, metadata);

        // 2. 🔥 ДОБАВЛЯЕМ К TEMPLATE BUILDER (он сам решит, обновлять ли эталон)
        let addedToTemplate = false;

        if (this.templateBuilder.referenceGraphId === null) {
            // Первый граф
            console.log(`🎯 Устанавливаю граф ${graphId} как начальный эталон`);
            addedToTemplate = this.templateBuilder.setReferenceGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                this.bestGraphId = graphId;
                this.bestGraphScore = this.calculateGraphScore(graph);
                this.bestGraphMetadata = metadata;
                console.log(`🏆 Начальный эталон установлен: ${graphId}`);
            }
        } else {
            // Последующие графы - TemplateBuilder сам решит, обновлять ли эталон
            addedToTemplate = this.templateBuilder.addGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                // 🔥 ПРОВЕРЯЕМ, НЕ ИЗМЕНИЛСЯ ЛИ ЭТАЛОН В TEMPLATE BUILDER
                const newReferenceId = this.templateBuilder.referenceGraphId;

                if (newReferenceId !== this.bestGraphId) {
                    // Эталон обновился!
                    console.log(`🔄 ОБНОВЛЕНИЕ ЭТАЛОНА В СУПЕР-МОДЕЛИ:`);
                    console.log(`   Старый: ${this.bestGraphId}`);
                    console.log(`   Новый: ${newReferenceId}`);

                    this.bestGraphId = newReferenceId;
                    this.bestGraphScore = this.templateBuilder.referenceGraphQuality;

                    // Обновляем метаданные
                    const sourceGraph = this.sourceGraphs.get(newReferenceId);
                    if (sourceGraph) {
                        this.bestGraphMetadata = sourceGraph.metadata;
                    }

                    this.stats.bestGraphUpdates++;
                    console.log(`🏆 ЭТАЛОН ОБНОВЛЁН: ${newReferenceId} (оценка: ${this.bestGraphScore.toFixed(3)})`);
                }
            }
        }

        if (!addedToTemplate) {
            console.log(`⚠️ Граф ${graphId} не добавлен к шаблону`);
            return false;
        }

        // 3. 🔥 ВЫЗЫВАЕМ ОБНОВЛЕНИЕ СТАТИСТИКИ
        this.updateStats(); // 🔥 ЭТО ИСПРАВЛЯЕТ ОШИБКУ!

        // 4. Обновить остальную статистику
        this.stats.totalMerges++;
        this.stats.totalGraphsAdded++;
        this.stats.lastUpdated = new Date();

        // 5. Получить информацию о шаблоне
        const templateInfo = this.templateBuilder.getInfo();

        console.log(`✅ Граф добавлен. Динамическая статистика:`);
        console.log(`   Ячеек шаблона: ${templateInfo.templateCells}`);
        console.log(`   Подтвержденных ячеек: ${templateInfo.stats.confirmedCells}`);
        console.log(`   Лучший граф: ${this.bestGraphId} (${this.bestGraphScore.toFixed(3)})`);
        console.log(`   Всего графов: ${this.stats.sourceGraphsCount}`);

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить данные для визуализации шаблона
    getTemplateVisualizationData() {
        console.log(`🎨 VectorSuperModel.getTemplateVisualizationData() - получение данных для визуализации`);
       
        try {
            if (!this.templateBuilder) {
                console.log('⚠️ Нет TemplateBuilder для визуализации');
                return {
                    success: false,
                    error: 'No TemplateBuilder',
                    cells: [],
                    stats: {}
                };
            }

            const templateData = this.templateBuilder.getVisualizationData();
           
            if (!templateData || !templateData.cells) {
                console.log('⚠️ Нет данных визуализации из TemplateBuilder');
                return {
                    success: false,
                    error: 'No visualization data',
                    cells: [],
                    stats: {}
                };
            }

            // Обновляем статистику перед возвратом данных
            this.updateStats();

            const visualizationData = {
                success: true,
                id: this.id,
                name: this.name,
                cells: templateData.cells,
                stats: {
                    ...templateData.stats,
                    modelConfidence: this.stats.confidence,
                    bestGraphId: this.bestGraphId,
                    bestGraphScore: this.bestGraphScore,
                    totalGraphs: this.stats.sourceGraphsCount,
                    totalMerges: this.stats.totalMerges,
                    bestGraphUpdates: this.stats.bestGraphUpdates
                },
                metadata: {
                    createdAt: this.stats.createdAt,
                    lastUpdated: this.stats.lastUpdated,
                    dynamicReferenceEnabled: this.config.enableDynamicReference,
                    referenceGraphId: this.templateBuilder.referenceGraphId,
                    referenceGraphQuality: this.templateBuilder.referenceGraphQuality
                },
                referenceGraph: this.getReferenceGraphData()
            };

            console.log(`✅ Данные визуализации подготовлены: ${visualizationData.cells.length} ячеек`);
            return visualizationData;

        } catch (error) {
            console.error(`❌ Ошибка получения данных визуализации:`, error.message);
            return {
                success: false,
                error: error.message,
                cells: [],
                stats: {}
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получить данные эталонного графа
    getReferenceGraphData() {
        if (!this.bestGraphId || !this.sourceGraphs.has(this.bestGraphId)) {
            return null;
        }

        const sourceGraph = this.sourceGraphs.get(this.bestGraphId);
        if (!sourceGraph || !sourceGraph.graph) {
            return null;
        }

        try {
            const graph = sourceGraph.graph;
            const bounds = graph.calculateGraphBounds ? graph.calculateGraphBounds() : null;
           
            return {
                graphId: this.bestGraphId,
                nodeCount: sourceGraph.nodeCount,
                edgeCount: sourceGraph.edgeCount,
                quality: this.bestGraphScore,
                bounds: bounds,
                metadata: sourceGraph.metadata
            };
        } catch (error) {
            console.log(`⚠️ Ошибка получения данных эталонного графа: ${error.message}`);
            return null;
        }
    }

    // 🔥 ДОБАВЛЯЕМ МЕТОД для визуализации (совместимость)
    visualize() {
        console.log(`\n📊 ВИЗУАЛИЗАЦИЯ VECTOR SUPER MODEL "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Лучший граф: ${this.bestGraphId || 'нет'}`);
        console.log(`├─ Оценка лучшего графа: ${this.bestGraphScore.toFixed(3)}`);
        console.log(`├─ Всего графов: ${this.stats.sourceGraphsCount}`);
        console.log(`├─ Объединений: ${this.stats.totalMerges}`);
        console.log(`├─ Обновлений эталона: ${this.stats.bestGraphUpdates}`);
        console.log(`├─ Уверенность: ${this.stats.confidence.toFixed(3)}`);
        console.log(`├─ Дата создания: ${this.stats.createdAt.toLocaleString('ru-RU')}`);
        console.log(`└─ Последнее обновление: ${this.stats.lastUpdated.toLocaleString('ru-RU')}`);

        if (this.templateBuilder) {
            const templateInfo = this.templateBuilder.getInfo();
            console.log(`\n📊 ШАБЛОН:`);
            console.log(`├─ Ячеек: ${templateInfo.templateCells}`);
            console.log(`├─ Подтвержденных ячеек: ${templateInfo.stats.confirmedCells}`);
            console.log(`├─ Высоконадёжных ячеек: ${templateInfo.stats.highConfidenceCells}`);
            console.log(`├─ Среднее подтверждений: ${templateInfo.stats.avgConfirmations?.toFixed(2) || '0.00'}`);
            console.log(`├─ Эталонный граф: ${this.templateBuilder.referenceGraphId || 'нет'}`);
            console.log(`└─ Качество эталона: ${this.templateBuilder.referenceGraphQuality?.toFixed(3) || 0}`);
        }
    }
  
    // 🔥 НОВЫЙ МЕТОД: Сравнение с паттернами (для совместимости)
    compareWithPatterns(otherFootprint, options = {}) {
        console.log(`🎯 [FIX] VectorSuperModel.compareWithPatterns() - Сравнение с "${otherFootprint.name}"`);
       
        if (!this.templateBuilder) {
            console.log('⚠️ Нет шаблона для сравнения');
            return {
                success: false,
                matchCount: 0,
                percentage: 0,
                decision: 'different',
                reason: 'Нет шаблона для сравнения'
            };
        }

        try {
            // Получаем точки отпечатка для сравнения
            let footprintPoints = [];
           
            // Пробуем разные методы получения точек
            if (typeof otherFootprint.getPointsForPatternMatching === 'function') {
                footprintPoints = otherFootprint.getPointsForPatternMatching();
                console.log(`📊 Получено ${footprintPoints.length} точек через getPointsForPatternMatching()`);
            } else if (typeof otherFootprint.getAlignedPointsForComparison === 'function') {
                footprintPoints = otherFootprint.getAlignedPointsForComparison();
                console.log(`📊 Получено ${footprintPoints.length} точек через getAlignedPointsForComparison()`);
            } else {
                // Фаллбэк: получаем точки из графа
                if (otherFootprint.graph && otherFootprint.graph.nodes) {
                    otherFootprint.graph.nodes.forEach((node, nodeId) => {
                        footprintPoints.push({
                            id: nodeId,
                            x: node.x || 0,
                            y: node.y || 0,
                            confidence: node.confidence || 0.5
                        });
                    });
                    console.log(`📊 Получено ${footprintPoints.length} точек из графа`);
                }
            }

            if (footprintPoints.length === 0) {
                console.log('⚠️ Нет точек для сравнения');
                return {
                    success: false,
                    matchCount: 0,
                    percentage: 0,
                    decision: 'different',
                    reason: 'Нет точек для сравнения'
                };
            }

            // 🔥 ИСПРАВЛЕНИЕ: Выравниваем точки к системе шаблона
            const templateInfo = this.templateBuilder.getInfo();
            const alignedPoints = this.alignPointsToTemplateSystem(footprintPoints);
           
            console.log(`📊 Точки для сравнения: ${alignedPoints.length} (после выравнивания)`);

            // Получаем шаблон для сравнения
            const template = this.templateBuilder.getTemplateForComparison();
           
            if (!template || !template.cells || template.cells.length === 0) {
                console.log('⚠️ Шаблон пустой');
                return {
                    success: false,
                    matchCount: 0,
                    percentage: 0,
                    decision: 'different',
                    reason: 'Шаблон пустой'
                };
            }

            console.log(`📊 Шаблон для сравнения: ${template.cells.length} ячеек`);

            // 🔥 ИСПРАВЛЕННЫЙ МЕТОД СРАВНЕНИЯ: Реальный подсчет совпадений
            const comparisonResult = this.comparePointsWithTemplate(alignedPoints, template, options);
           
            console.log(`📊 Результат сравнения: ${comparisonResult.matchCount} совпадений (${comparisonResult.percentage.toFixed(1)}%)`);

            // 🔥 ИСПРАВЛЕНИЕ: Единое решение с другими модулями
            const finalDecision = this.makeConsistentDecision(comparisonResult, options);
           
            return {
                ...comparisonResult,
                decision: finalDecision,
                footprintPoints: alignedPoints.length,
                templateCells: template.cells.length,
                diagnostics: {
                    hasPoints: alignedPoints.length > 0,
                    hasTemplate: template.cells.length > 0,
                    avgConfidence: comparisonResult.avgConfidence || 0
                }
            };

        } catch (error) {
            console.error(`❌ Ошибка в compareWithPatterns:`, error.message);
           
            return {
                success: false,
                matchCount: 0,
                percentage: 0,
                decision: 'different',
                reason: `Ошибка сравнения: ${error.message}`,
                error: error.message
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение точек с шаблоном (реальная статистика)
    comparePointsWithTemplate(points, template, options = {}) {
        const MATCH_THRESHOLD = options.threshold || this.config.matchThreshold || 0.08;
       
        console.log(`🔍 Сравнение ${points.length} точек с ${template.cells.length} ячейками шаблона`);
        console.log(`   Порог совпадения: ${MATCH_THRESHOLD}`);

        let matchCount = 0;
        let totalConfidence = 0;
        const matchedPoints = [];
        const matchedCells = [];
        const unmatchedPoints = [];

        // 🔥 ДИАГНОСТИКА: Проверяем координаты точек
        const zeroPoints = points.filter(p => Math.abs(p.x) < 0.1 && Math.abs(p.y) < 0.1).length;
        if (zeroPoints > 0) {
            console.warn(`⚠️ ${zeroPoints} точек близко к (0,0)!`);
        }

        // Для каждой точки ищем совпадение в шаблоне
        points.forEach((point, index) => {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestCell = null;

            // 🔥 ОПТИМИЗАЦИЯ: Ищем только в ближайших ячейках
            const candidateCells = this.findNearbyCells(point, template.cells, 100); // 100px радиус
           
            candidateCells.forEach(cell => {
                const distance = Math.sqrt(
                    Math.pow(cell.x - point.x, 2) + Math.pow(cell.y - point.y, 2)
                );
               
                // 🔥 ИСПРАВЛЕНИЕ: Используем нормализованное расстояние
                const normalizedDistance = distance / Math.max(1, cell.size || 25);
               
                if (normalizedDistance < bestDistance) {
                    bestDistance = normalizedDistance;
                    bestMatch = {
                        point: point,
                        cell: cell,
                        distance: distance,
                        normalizedDistance: normalizedDistance,
                        confidence: Math.max(0.1, point.confidence || 0.5)
                    };
                    bestCell = cell;
                }
            });

            if (bestMatch && bestMatch.normalizedDistance <= MATCH_THRESHOLD) {
                matchCount++;
                totalConfidence += bestMatch.confidence;
                matchedPoints.push(bestMatch);
                matchedCells.push(bestCell);
               
                // Дебаг для первых совпадений
                if (matchCount <= 3) {
                    console.log(`   Совпадение ${matchCount}: расстояние=${bestMatch.distance.toFixed(1)}px, ` +
                              `норм.расстояние=${bestMatch.normalizedDistance.toFixed(3)}`);
                }
            } else {
                unmatchedPoints.push(point);
            }
        });

        // 🔥 ИСПРАВЛЕНИЕ: РЕАЛЬНЫЙ процент, а не 100%
        const percentage = points.length > 0 ? (matchCount / points.length) * 100 : 0;
        const avgConfidence = matchCount > 0 ? totalConfidence / matchCount : 0;

        // 🔥 ПРОВЕРКА НА ЛОЖНЫЕ 100%
        if (percentage > 99 && matchCount < 3) {
            console.warn(`⚠️ ЛОЖНЫЙ 100%: ${percentage.toFixed(1)}% при ${matchCount} совпадениях`);
        }

        console.log(`📊 Результат: ${matchCount}/${points.length} совпадений (${percentage.toFixed(1)}%)`);
        console.log(`   Средняя уверенность совпадений: ${avgConfidence.toFixed(3)}`);

        return {
            matchCount,
            percentage: Math.min(100, percentage), // Ограничиваем 100%
            avgConfidence,
            matchedPoints: matchedPoints.length,
            unmatchedPoints: unmatchedPoints.length,
            totalPoints: points.length,
            templateCells: template.cells.length
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Поиск ближайших ячеек
    findNearbyCells(point, cells, radius = 100) {
        if (!cells || cells.length === 0) return [];
       
        return cells.filter(cell => {
            const distance = Math.sqrt(
                Math.pow(cell.x - point.x, 2) + Math.pow(cell.y - point.y, 2)
            );
            return distance <= radius;
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Выравнивание точек к системе шаблона
    alignPointsToTemplateSystem(points) {
        console.log(`🎯 Выравнивание ${points.length} точек к системе шаблона...`);
       
        if (points.length === 0) return points;
       
        try {
            // Получаем текущий эталонный граф
            const referenceGraphId = this.templateBuilder.referenceGraphId;
            if (!referenceGraphId) {
                console.log('⚠️ Нет эталонного графа для выравнивания');
                return points;
            }
           
            // Получаем данные эталонного графа
            const referenceData = this.sourceGraphs.get(referenceGraphId);
            if (!referenceData || !referenceData.graph) {
                console.log('⚠️ Нет данных эталонного графа');
                return points;
            }
           
            const referenceGraph = referenceData.graph;
            const referenceBounds = referenceGraph.calculateGraphBounds ?
                referenceGraph.calculateGraphBounds() :
                { centerX: 500, centerY: 500 };
           
            // Вычисляем текущий центр точек
            const currentCenter = this.calculateCenter(points);
            const offsetX = referenceBounds.centerX - currentCenter.x;
            const offsetY = referenceBounds.centerY - currentCenter.y;
           
            console.log(`   Смещение: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
           
            // Применяем смещение
            return points.map(point => ({
                ...point,
                x: point.x + offsetX,
                y: point.y + offsetY,
                originalX: point.x,
                originalY: point.y,
                aligned: true
            }));
           
        } catch (error) {
            console.log(`⚠️ Ошибка выравнивания: ${error.message}`);
            return points; // Возвращаем как есть
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Единое решение для совместимости
    makeConsistentDecision(comparisonResult, options = {}) {
        const MIN_MATCHES = options.minMatches || 10; // Из логов: "Недостаточно: 9"
        const MIN_PERCENTAGE = options.minPercentage || 60;
       
        console.log(`🎯 Принятие решения: ${comparisonResult.matchCount} совпадений, ${comparisonResult.percentage.toFixed(1)}%`);
        console.log(`   Пороги: MIN_MATCHES=${MIN_MATCHES}, MIN_PERCENTAGE=${MIN_PERCENTAGE}`);
       
        const hasEnoughMatches = comparisonResult.matchCount >= MIN_MATCHES;
        const hasEnoughPercentage = comparisonResult.percentage >= MIN_PERCENTAGE;
       
        if (hasEnoughMatches && hasEnoughPercentage) {
            console.log(`✅ Достаточно совпадений: ${comparisonResult.matchCount} >= ${MIN_MATCHES} и ${comparisonResult.percentage.toFixed(1)}% >= ${MIN_PERCENTAGE}%`);
            return 'same';
        } else if (comparisonResult.matchCount >= MIN_MATCHES * 0.7) {
            console.log(`🟡 Умеренные совпадения: ${comparisonResult.matchCount} (нужно ${MIN_MATCHES})`);
            return 'similar';
        } else {
            console.log(`🔴 Недостаточно совпадений: ${comparisonResult.matchCount} (нужно ${MIN_MATCHES})`);
            return 'different';
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Расчет центра
    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    // 🔥 ДОБАВЛЯЕМ МЕТОД compare для совместимости
    compare(otherFootprint, options = {}) {
        console.log(`🔍 [FIX] VectorSuperModel.compare() - вызов через compareWithPatterns`);
        return this.compareWithPatterns(otherFootprint, options);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Добавить граф
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к динамической супер-модели...`);

        // 1. Сохраняем исходный граф
        this.saveSourceGraph(graph, graphId, metadata);

        // 2. 🔥 ДОБАВЛЯЕМ К TEMPLATE BUILDER (он сам решит, обновлять ли эталон)
        let addedToTemplate = false;

        if (this.templateBuilder.referenceGraphId === null) {
            // Первый граф
            console.log(`🎯 Устанавливаю граф ${graphId} как начальный эталон`);
            addedToTemplate = this.templateBuilder.setReferenceGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                this.bestGraphId = graphId;
                this.bestGraphScore = this.calculateGraphScore(graph);
                this.bestGraphMetadata = metadata;
                console.log(`🏆 Начальный эталон установлен: ${graphId}`);
            }
        } else {
            // Последующие графы - TemplateBuilder сам решит, обновлять ли эталон
            addedToTemplate = this.templateBuilder.addGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                // 🔥 ПРОВЕРЯЕМ, НЕ ИЗМЕНИЛСЯ ЛИ ЭТАЛОН В TEMPLATE BUILDER
                const newReferenceId = this.templateBuilder.referenceGraphId;

                if (newReferenceId !== this.bestGraphId) {
                    // Эталон обновился!
                    console.log(`🔄 ОБНОВЛЕНИЕ ЭТАЛОНА В СУПЕР-МОДЕЛИ:`);
                    console.log(`   Старый: ${this.bestGraphId}`);
                    console.log(`   Новый: ${newReferenceId}`);

                    this.bestGraphId = newReferenceId;
                    this.bestGraphScore = this.templateBuilder.referenceGraphQuality;

                    // Обновляем метаданные
                    const sourceGraph = this.sourceGraphs.get(newReferenceId);
                    if (sourceGraph) {
                        this.bestGraphMetadata = sourceGraph.metadata;
                    }

                    this.stats.bestGraphUpdates++;
                    console.log(`🏆 ЭТАЛОН ОБНОВЛЁН: ${newReferenceId} (оценка: ${this.bestGraphScore.toFixed(3)})`);
                }
            }
        }

        if (!addedToTemplate) {
            console.log(`⚠️ Граф ${graphId} не добавлен к шаблону`);
            return false;
        }

        // 3. Обновить статистику
        this.stats.totalMerges++;
        this.stats.totalGraphsAdded++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        // 4. Получить информацию о шаблоне
        const templateInfo = this.templateBuilder.getInfo();

        console.log(`✅ Граф добавлен. Динамическая статистика:`);
        console.log(`   Ячеек шаблона: ${templateInfo.templateCells}`);
        console.log(`   Подтвержденных ячеек: ${templateInfo.stats.confirmedCells}`);
        console.log(`   Лучший граф: ${this.bestGraphId} (${this.bestGraphScore.toFixed(3)})`);
        console.log(`   Всего графов: ${this.stats.sourceGraphsCount}`);

        return true;
    }

    // 🔥 СОХРАНИТЬ ИСХОДНЫЙ ГРАФ (без изменений)
    saveSourceGraph(graph, graphId, metadata) {
        const nodeCount = graph.nodes ? graph.nodes.size : 0;

        this.sourceGraphs.set(graphId, {
            graphId: graphId,
            nodeCount: nodeCount,
            edgeCount: graph.edges ? graph.edges.size : 0,
            metadata: metadata,
            addedAt: new Date(),
            invariants: graph.getBasicInvariants ? graph.getBasicInvariants() : null,
            graph: nodeCount <= 100 ? graph : null,
            graphData: nodeCount > 100 ? this.extractGraphData(graph) : null
        });

        this.stats.sourceGraphsCount = this.sourceGraphs.size;
        console.log(`💾 Сохранен исходный граф ${graphId} с ${nodeCount} узлами`);
    }

    // 🔥 ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ (ОСНОВАННЫЕ НА ШАБЛОНЕ)
    getVisualizationData() {
        // 🔥 ИСПОЛЬЗУЕМ ДАННЫЕ ИЗ TEMPLATE BUILDER
        const templateData = this.templateBuilder.getVisualizationData();

        // Добавляем информацию о супер-модели
        return {
            ...templateData,
            metadata: {
                id: this.id,
                name: this.name,
                merges: this.stats.totalMerges,
                createdAt: this.stats.createdAt,
                visualizationMethod: 'template_based',
                bestGraphId: this.bestGraphId,
                bestGraphScore: this.bestGraphScore,
                sourceGraphsCount: this.stats.sourceGraphsCount,
                dynamicReferenceEnabled: this.config.enableDynamicReference,
                bestGraphUpdates: this.stats.bestGraphUpdates
            }
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧИТЬ СТАТИСТИКУ ШАБЛОНА
    getTemplateStats() {
        if (!this.templateBuilder) return null;

        const templateInfo = this.templateBuilder.getInfo();
        const zones = this.templateBuilder.calculateZones ?
            this.templateBuilder.calculateZones() : {};

        return {
            templateId: this.templateBuilder.id,
            cells: {
                total: templateInfo.templateCells,
                confirmed: templateInfo.stats.confirmedCells,
                highConfidence: templateInfo.stats.highConfidenceCells,
                avgConfirmations: templateInfo.stats.avgConfirmations?.toFixed(2) || '0.00'
            },
            referenceGraphId: this.templateBuilder.referenceGraphId,
            referenceGraphQuality: this.templateBuilder.referenceGraphQuality,
            zones: zones,
            alignmentStats: {
                totalGraphs: templateInfo.stats.totalGraphs,
                transformations: this.templateBuilder.graphTransformations?.size || 0,
                avgError: templateInfo.stats.alignmentError?.toFixed(3) || '0.000'
            }
        };
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Получить информацию
    getInfo() {
        const templateStats = this.getTemplateStats();
        const bestGraphInfo = this.bestGraphId ? {
            bestGraphId: this.bestGraphId,
            bestGraphScore: Math.round(this.bestGraphScore * 1000) / 1000,
            bestGraphUpdates: this.stats.bestGraphUpdates,
            bestGraphNodeCount: this.sourceGraphs.get(this.bestGraphId)?.nodeCount || 0
        } : {};

        // 🔥 ИНФОРМАЦИЯ О ВСЕХ ГРАФАХ
        const allGraphsInfo = [];
        for (const [graphId, graphData] of this.sourceGraphs) {
            allGraphsInfo.push({
                id: graphId,
                nodeCount: graphData.nodeCount,
                edgeCount: graphData.edgeCount,
                quality: this.templateBuilder.graphQualities.get(graphId) || 0,
                isBest: graphId === this.bestGraphId,
                isReference: graphId === this.templateBuilder.referenceGraphId
            });
        }

        // Сортируем по качеству
        allGraphsInfo.sort((a, b) => b.quality - a.quality);

        return {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                confidence: Math.round(this.stats.confidence * 1000) / 1000,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU'),
                ...bestGraphInfo
            },
            template: templateStats,
            graphs: {
                total: allGraphsInfo.length,
                bestQuality: allGraphsInfo.length > 0 ? allGraphsInfo[0].quality : 0,
                referenceQuality: this.templateBuilder.referenceGraphQuality || 0,
                list: allGraphsInfo.slice(0, 5) // Только топ-5
            },
            config: this.config,
            hasTemplate: !!this.templateBuilder.referenceGraphId,
            dynamicReferenceEnabled: this.config.enableDynamicReference
        };
    }

    // 🔥 РАСЧЁТ ОЦЕНКИ ГРАФА (без изменений)
    calculateGraphScore(graph) {
        if (!graph || !graph.nodes) return 0;

        const nodeCount = graph.nodes.size;
        const edgeCount = graph.edges ? graph.edges.size : 0;

        if (nodeCount < this.config.bestGraphMinNodes) {
            return 0;
        }

        const factors = {
            nodeCount: Math.min(1, nodeCount / 50),
            connectivity: Math.min(1, edgeCount / (nodeCount * 1.5)),
            uniformity: this.calculateNodeUniformity(graph),
            clusterQuality: this.calculateClusterQuality(graph)
        };

        const weights = {
            nodeCount: 0.35,
            connectivity: 0.25,
            uniformity: 0.20,
            clusterQuality: 0.20
        };

        let totalScore = 0;
        for (const [factor, value] of Object.entries(factors)) {
            totalScore += value * weights[factor];
        }

        return Math.min(1, totalScore);
    }

    // 🔥 ЗАГРУЗИТЬ ИЗ JSON (ОБНОВЛЕННЫЙ)
    static fromJSON(data) {
        const model = new VectorSuperModel({
            name: data.name,
            matchThreshold: data.config?.matchThreshold,
            enableDynamicReference: data.config?.enableDynamicReference !== false
        });

        model.id = data.id || model.id;
        model.stats = data.stats || model.stats;
        model.config = data.config || model.config;

        // 🔥 ВОССТАНАВЛИВАЕМ TEMPLATE BUILDER
        if (data.templateBuilder) {
            try {
                model.templateBuilder = TemplateBuilder.fromJSON(data.templateBuilder);
                console.log(`📂 Восстановлен TemplateBuilder с ДИНАМИЧЕСКИМ эталоном`);
            } catch (error) {
                console.log(`⚠️ Ошибка восстановления TemplateBuilder:`, error.message);
                model.templateBuilder = new TemplateBuilder({
                    name: model.name,
                    enableDynamicReference: model.config.enableDynamicReference
                });
            }
        }

        // Восстанавливаем лучший граф
        if (data.bestGraphId) {
            model.bestGraphId = data.bestGraphId;
            model.bestGraphScore = data.bestGraphScore || 0;
            model.bestGraphMetadata = data.bestGraphMetadata || null;
        }

        // Восстанавливаем исходные графы
        if (data.sourceGraphs && Array.isArray(data.sourceGraphs)) {
            data.sourceGraphs.forEach(graphData => {
                if (graphData.graphId) {
                    model.sourceGraphs.set(graphData.graphId, graphData);
                }
            });
            model.stats.sourceGraphsCount = model.sourceGraphs.size;
        }

        // Восстановить даты
        if (model.stats.createdAt && typeof model.stats.createdAt === 'string') {
            model.stats.createdAt = new Date(model.stats.createdAt);
        }
        if (model.stats.lastUpdated && typeof model.stats.lastUpdated === 'string') {
            model.stats.lastUpdated = new Date(model.stats.lastUpdated);
        }

        console.log(`📂 Загружена ШАБЛОННАЯ супер-модель "${model.name}" с ДИНАМИЧЕСКИМ эталоном`);
        console.log(`   Ячеек шаблона: ${model.templateBuilder?.templateCells?.size || 0}`);
        console.log(`   Лучший граф: ${model.bestGraphId || 'нет'}`);
        console.log(`   Эталонный граф: ${model.templateBuilder?.referenceGraphId || 'нет'}`);
        console.log(`   Качество эталона: ${model.templateBuilder?.referenceGraphQuality?.toFixed(3) || 0}`);

        return model;
    }

    // 🔥 СОХРАНИТЬ В JSON (ОБНОВЛЕННЫЙ)
    toJSON() {
        const data = {
            id: this.id,
            name: this.name,
            stats: this.stats,
            config: this.config,
            bestGraphId: this.bestGraphId,
            bestGraphScore: this.bestGraphScore,
            bestGraphMetadata: this.bestGraphMetadata,
            _version: '3.0-dynamic-reference', // 🔥 ОБНОВИЛИ ВЕРСИЮ ДЛЯ ДИНАМИЧЕСКОГО ЭТАЛОНА
            _savedAt: new Date().toISOString()
        };

        // 🔥 СОХРАНЯЕМ TEMPLATE BUILDER
        if (this.templateBuilder) {
            data.templateBuilder = this.templateBuilder.toJSON();
        }

        // Сохраняем исходные графы
        if (this.sourceGraphs.size > 0) {
            data.sourceGraphs = Array.from(this.sourceGraphs.values());
        }

        return data;
    }

    // ============ СТАРЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ ============

    // 🔥 ОСТАВЛЯЕМ ДЛЯ СОВМЕСТИМОСТИ, НО ПОМЕЧАЕМ КАК УСТАРЕВШИЕ
    extractGraphData(graph) {
        const nodes = [];
        const edges = [];

        if (graph.nodes) {
            for (const [id, node] of graph.nodes) {
                nodes.push({
                    id: id,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5
                });
            }
        }

        return { nodes, edges };
    }

    calculateNodeUniformity(graph) {
        // Для совместимости
        if (!graph.nodes || graph.nodes.size < 10) return 0.5;

        const nodes = Array.from(graph.nodes.values());
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x || 0);
            maxX = Math.max(maxX, node.x || 0);
            minY = Math.min(minY, node.y || 0);
            maxY = Math.max(maxY, node.y || 0);
        });

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

        const avg = nodes.length / 9;
        let variance = 0;
        grid.forEach(count => {
            variance += Math.pow(count - avg, 2);
        });
        variance /= 9;

        const maxVariance = Math.pow(nodes.length, 2) / 9;
        const uniformity = 1 - (variance / maxVariance);

        return Math.max(0, Math.min(1, uniformity));
    }

    calculateClusterQuality(graph) {
        if (!graph.nodes || graph.nodes.size === 0) return 0;

        let totalNeighbors = 0;

        if (graph.edges && graph.edges.size > 0) {
            const degrees = new Map();

            for (const [edgeId, edge] of graph.edges) {
                degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
                degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
            }

            for (const degree of degrees.values()) {
                totalNeighbors += degree;
            }

            const avgDegree = totalNeighbors / graph.nodes.size;
            return Math.min(1, avgDegree / 4);
        }

        return 0.3;
    }

    getBestGraph() {
        if (!this.bestGraphId || !this.sourceGraphs.has(this.bestGraphId)) {
            return null;
        }

        const source = this.sourceGraphs.get(this.bestGraphId);

        if (source.graph) {
            return source.graph;
        }

        if (source.graphData) {
            return this.reconstructGraph(source.graphData);
        }

        return null;
    }

    reconstructGraph(graphData) {
        const SimpleGraph = require('./simple-graph');
        const graph = new SimpleGraph('Восстановленный граф');

        if (graphData.nodes) {
            const points = graphData.nodes.map(node => ({
                x: node.x,
                y: node.y,
                confidence: node.confidence || 0.5,
                id: node.id
            }));

            graph.buildFromPoints(points);
        }

        return graph;
    }

    getBestGraphInfo() {
        if (!this.bestGraphId || !this.sourceGraphs.has(this.bestGraphId)) {
            return null;
        }

        const source = this.sourceGraphs.get(this.bestGraphId);
        return {
            graphId: this.bestGraphId,
            score: this.bestGraphScore,
            nodeCount: source.nodeCount,
            edgeCount: source.edgeCount,
            addedAt: source.addedAt,
            metadata: source.metadata,
            canVisualize: !!(source.graph || source.graphData)
        };
    }
}

module.exports = VectorSuperModel;
