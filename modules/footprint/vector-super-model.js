// modules/footprint/vector-super-model.js
// 🔥 ОБНОВЛЯЕМ ДЛЯ ДИНАМИЧЕСКОГО ЭТАЛОНА С СИНХРОНИЗИРОВАННЫМИ ПОРОГАМИ

const TemplateBuilder = require('./template-builder');

class VectorSuperModel {
    constructor(options = {}) {
        this.id = `vsm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблонная супер-модель';

        // 🔥 СИНХРОНИЗИРУЕМ ПОРОГИ С simple-manager.js (0.6 для "same")
        this.config = {
            // 🔥 ВНУТРЕННИЙ ПОРОГ ДЛЯ ТОЧНОГО СРАВНЕНИЯ
            matchThreshold: 0.05, // Для точного сравнения точек
         
            // 🔥 ВНЕШНИЙ ПОРОГ ДЛЯ РЕШЕНИЙ (СИНХРОННЫЙ С simple-manager.js)
            decisionThreshold: 0.6, // 60% - как в simple-manager.js
         
            minConfirmationsForHighConfidence: 2,
            bestGraphMinNodes: options.bestGraphMinNodes || 15,
            enableTemplateMode: true,
            enableDynamicReference: true,

            // 🔥 СОВМЕСТИМЫЕ ПОРОГИ С simple-manager.js
            similarityThresholds: {
                SAME: 0.6,      // 60% - синхронно с simple-manager.js DECISION_THRESHOLDS.PATTERN_SIMILARITY
                SIMILAR: 0.4,   // 40%
                DIFFERENT: 0.0
            },

            referenceUpdateThreshold: 1.15,
            minQualityForReference: 0.4,
            ...options
        };

        console.log(`🎯 VECTOR-MODEL пороги СИНХРОНИЗИРОВАНЫ:`);
        console.log(`   Внутренний matchThreshold: ${this.config.matchThreshold} (для точного сравнения)`);
        console.log(`   Решающий порог (SAME): ${this.config.similarityThresholds.SAME} (синхронно с simple-manager)`);

        // 🔥 ЗАМЕНЯЕМ СТАРУЮ ЛОГИКУ НА TEMPLATE BUILDER
        this.templateBuilder = new TemplateBuilder({
            name: `Шаблон_${this.name}`,
            enablePCA: false, // 🔥 ОТКЛЮЧАЕМ PCA
            cellSize: 25,     // 🔥 УВЕЛИЧИВАЕМ РАЗМЕР ЯЧЕЙКИ
         
            // 🔥 СИНХРОНИЗИРУЕМ ПОРОГИ TEMPLATE BUILDER
            matchThreshold: 0.05, // Для точного сравнения внутри шаблона
            decisionThreshold: 0.6, // Для решений
         
            // 🔥 ПЕРЕДАЕМ COORDINATE MANAGER ЕСЛИ ЕСТЬ
            coordinateManager: options.coordinateManager,
            useCoordinateManager: options.useCoordinateManager !== false,
         
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
            avgConfirmations: 0,
         
            // 🔥 ДОБАВЛЯЕМ СТАТИСТИКУ ПОРОГОВ
            thresholds: {
                match: this.config.matchThreshold,
                decision: this.config.decisionThreshold,
                same: this.config.similarityThresholds.SAME,
                similar: this.config.similarityThresholds.SIMILAR
            }
        };

        console.log(`🏗️ Создана ШАБЛОННАЯ векторная супер-модель "${this.name}" с ДИНАМИЧЕСКИМ эталоном и СИНХРОНИЗИРОВАННЫМИ порогами`);
    }

    // 🔥 НОВЫЙ МЕТОД: ПРОВЕРКА РЕШЕНИЯ С СИНХРОНИЗИРОВАННЫМ ПОРОГОМ
    checkDecisionWithSynchronizedThreshold(similarity) {
        console.log(`🎯 [VECTOR-MODEL] Проверка решения с синхронизированным порогом:`);
        console.log(`   Сходство: ${similarity.toFixed(3)}`);
        console.log(`   Порог "SAME": ${this.config.similarityThresholds.SAME}`);
        console.log(`   Порог "SIMILAR": ${this.config.similarityThresholds.SIMILAR}`);
     
        let decision, reason;
     
        if (similarity >= this.config.similarityThresholds.SAME) {
            decision = 'same';
            reason = `Сходство ${(similarity * 100).toFixed(1)}% ≥ порог ${(this.config.similarityThresholds.SAME * 100).toFixed(1)}%`;
        } else if (similarity >= this.config.similarityThresholds.SIMILAR) {
            decision = 'similar';
            reason = `Сходство ${(similarity * 100).toFixed(1)}% ≥ порог ${(this.config.similarityThresholds.SIMILAR * 100).toFixed(1)}%`;
        } else {
            decision = 'different';
            reason = `Сходство ${(similarity * 100).toFixed(1)}% < порог ${(this.config.similarityThresholds.SIMILAR * 100).toFixed(1)}%`;
        }
     
        console.log(`   Решение: ${decision} (${reason})`);
     
        return {
            decision,
            reason,
            similarity,
            thresholdUsed: this.config.similarityThresholds.SAME,
            isSynchronized: true
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД ИЗ ИНСТРУКЦИИ
    updateStats() {
        // Получаем реальные данные из TemplateBuilder
        const templateInfo = this.templateBuilder.getInfo();
        const visualizationData = this.templateBuilder.getVisualizationData();

        if (!visualizationData || visualizationData.cells.length === 0) {
            this.stats.confidence = 0;
            return;
        }

        // 🔥 БЕРЕМ РЕАЛЬНЫЕ ДАННЫЕ ИЗ ВИЗУАЛИЗАЦИИ
        const cells = visualizationData.cells;
        const stats = visualizationData.stats;

        // 🔥 ОБНОВЛЯЕМ СТАТИСТИКУ
        this.stats.templateCells = cells.length;
        this.stats.confirmedCells = stats.confirmedCells || 0;
        this.stats.totalConfirmations = stats.totalConfirmations || 0;  // 🔥 ВАЖНО!
        this.stats.averageConfirmations = stats.averageConfirmations || 0;

        // 🔥 РАСЧЕТ УВЕРЕННОСТИ
        const confirmedRatio = this.stats.confirmedCells / Math.max(1, this.stats.templateCells);
        const avgConfirmations = this.stats.averageConfirmations;

        // 🔥 НОВАЯ ФОРМУЛА УВЕРЕННОСТИ
        this.stats.confidence = Math.min(1.0,
            confirmedRatio * 0.5 +                    // 50% за долю подтвержденных
            Math.min(0.3, avgConfirmations * 0.15) +  // 30% за среднее подтверждений
            (this.bestGraphScore * 0.2)               // 20% за качество лучшего графа
        );
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Добавить граф с проверкой порогов
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к динамической супер-модели...`);
      
        // 🔥 ДИАГНОСТИКА: Проверяем входные данные
        console.log(`🔍 [VECTOR-MODEL-DIAG] Входные данные:`);
        console.log(`   Граф ID: ${graphId}`);
        console.log(`   Узлов в графе: ${graph?.nodes?.size || 0}`);
        console.log(`   Сходство из metadata: ${metadata.similarity || 'нет'}`);
        console.log(`   Порог SAME: ${this.config.similarityThresholds.SAME}`);

        // 🔥 ИСПРАВЛЕНИЕ: ПРОВЕРЯЕМ И ИСПРАВЛЯЕМ УГОЛ ПОВОРОТА
        if (graph.transformation && graph.transformation.rotationAngle !== 0) {
    const angle = graph.transformation.rotationAngle;
    console.log(`🎯 РЕАЛЬНО исправляю угол графа: ${angle.toFixed(1)}° → 0°`);
   
    // РЕАЛЬНО поворачиваем точки графа
    if (graph.nodes) {
        const center = graph.transformation.center || { x: 500, y: 500 };
        const rad = -angle * Math.PI / 180; // Обратный поворот
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
       
        for (const [id, node] of graph.nodes) {
            const dx = node.x - center.x;
            const dy = node.y - center.y;
           
            const newX = dx * cos - dy * sin;
            const newY = dx * sin + dy * cos;
           
            node.x = newX + center.x;
            node.y = newY + center.y;
        }
    }
   
    // Обновляем информацию
    graph.transformation.rotationAngle = 0;
    graph.transformation._correctedToZero = true;
    graph.transformation._originalAngle = angle;
   
    if (metadata.transformationInfo) {
        metadata.transformationInfo.rotationAngle = 0;
        metadata.transformationInfo._correctedToZero = true;
    }
}

        // 🔥 ПРОВЕРЯЕМ ПОРОГИ ИЗ МЕТАДАННЫХ (если есть)
        if (metadata.similarity !== undefined) {
            const decisionCheck = this.checkDecisionWithSynchronizedThreshold(metadata.similarity);
            const syncCheck = this.compareWithSimpleManagerThreshold(metadata.similarity);
          
            console.log(`📊 Решение из simple-manager: ${metadata.similarity.toFixed(3)} -> ${decisionCheck.decision}`);
         
            if (!syncCheck.isSynchronized || !syncCheck.decisionsMatch) {
                console.log(`⚠️ [VECTOR-MODEL-WARN] Расхождение порогов!`);
                console.log(`   Решение simple-manager: ${syncCheck.simpleManagerDecision}`);
                console.log(`   Решение vector-model: ${syncCheck.vectorModelDecision}`);
              
                // 🔥 ПРИНИМАЕМ РЕШЕНИЕ ОТ SIMPLE-MANAGER (главное)
                metadata.vectorDecisionOverride = syncCheck.simpleManagerDecision;
                metadata.vectorDecisionOverrideReason = 'Приоритет simple-manager при расхождении';
            } else {
                // 🔥 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О РЕШЕНИИ В МЕТАДАННЫЕ
                metadata.vectorDecision = decisionCheck.decision;
                metadata.vectorDecisionReason = decisionCheck.reason;
                metadata.vectorThresholdUsed = decisionCheck.thresholdUsed;
            }
        }

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
        console.log(`   СИНХРОНИЗИРОВАННЫЕ ПОРОГИ: SAME=${this.config.similarityThresholds.SAME}`);

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: СРАВНИТЬ С SIMPLE-MANAGER ПОРОГОМ
    compareWithSimpleManagerThreshold(similarity) {
        const simpleManagerThreshold = 0.6; // 🔥 ТОЧНОЕ ЗНАЧЕНИЕ ИЗ simple-manager.js
     
        console.log(`\n🔍 [SYNC-CHECK] Сравнение порогов:`);
        console.log(`   simple-manager порог: ${simpleManagerThreshold}`);
        console.log(`   vector-model порог: ${this.config.similarityThresholds.SAME}`);
        console.log(`   Сходство: ${similarity.toFixed(3)}`);
     
        const isSynchronized = Math.abs(this.config.similarityThresholds.SAME - simpleManagerThreshold) < 0.01;
        const simpleManagerDecision = similarity >= simpleManagerThreshold ? 'same' : 'different';
        const vectorModelDecision = similarity >= this.config.similarityThresholds.SAME ? 'same' : 'different';
     
        console.log(`   Пороги синхронизированы: ${isSynchronized ? '✅' : '❌'}`);
        console.log(`   Решение simple-manager: ${simpleManagerDecision}`);
        console.log(`   Решение vector-model: ${vectorModelDecision}`);
     
        return {
            isSynchronized,
            simpleManagerDecision,
            vectorModelDecision,
            decisionsMatch: simpleManagerDecision === vectorModelDecision
        };
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
                bestGraphUpdates: this.stats.bestGraphUpdates,
             
                // 🔥 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ПОРОГАХ
                thresholds: {
                    same: this.config.similarityThresholds.SAME,
                    similar: this.config.similarityThresholds.SIMILAR,
                    match: this.config.matchThreshold,
                    synchronized: true
                }
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
            dynamicReferenceEnabled: this.config.enableDynamicReference,
         
            // 🔥 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О СИНХРОНИЗАЦИИ ПОРОГОВ
            thresholdsSynchronized: {
                withSimpleManager: true,
                sameThreshold: this.config.similarityThresholds.SAME,
                note: 'Пороги синхронизированы с simple-manager.js (0.6 для SAME)'
            }
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
            decisionThreshold: 0.6, // 🔥 ГАРАНТИРУЕМ СИНХРОНИЗАЦИЮ
            enableDynamicReference: data.config?.enableDynamicReference !== false
        });

        model.id = data.id || model.id;
        model.stats = data.stats || model.stats;
        model.config = data.config || model.config;
     
        // 🔥 ГАРАНТИРУЕМ СИНХРОНИЗАЦИЮ ПОРОГОВ
        if (model.config.similarityThresholds) {
            model.config.similarityThresholds.SAME = 0.6; // СИНХРОНИЗИРУЕМ
            model.config.similarityThresholds.SIMILAR = 0.4;
        }

        // 🔥 ВОССТАНАВЛИВАЕМ TEMPLATE BUILDER
        if (data.templateBuilder) {
            try {
                model.templateBuilder = TemplateBuilder.fromJSON(data.templateBuilder);
                console.log(`📂 Восстановлен TemplateBuilder с ДИНАМИЧЕСКИМ эталоном`);
            } catch (error) {
                console.log(`⚠️ Ошибка восстановления TemplateBuilder:`, error.message);
                model.templateBuilder = new TemplateBuilder({
                    name: model.name,
                    enableDynamicReference: model.config.enableDynamicReference,
                    decisionThreshold: 0.6 // 🔥 СИНХРОНИЗИРУЕМ
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

        console.log(`📂 Загружена ШАБЛОННАЯ супер-модель "${model.name}" с СИНХРОНИЗИРОВАННЫМИ порогами`);
        console.log(`   Ячеек шаблона: ${model.templateBuilder?.templateCells?.size || 0}`);
        console.log(`   Лучший граф: ${model.bestGraphId || 'нет'}`);
        console.log(`   Эталонный граф: ${model.templateBuilder?.referenceGraphId || 'нет'}`);
        console.log(`   Качество эталона: ${model.templateBuilder?.referenceGraphQuality?.toFixed(3) || 0}`);
        console.log(`   Порог "SAME": ${model.config.similarityThresholds?.SAME || 0.6}`);

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
            _version: '3.0-dynamic-reference-synchronized', // 🔥 ОБНОВИЛИ ВЕРСИЮ
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
