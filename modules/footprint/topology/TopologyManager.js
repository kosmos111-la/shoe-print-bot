// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ТОПОЛОГИЧЕСКИМИ МОДЕЛЯМИ (С ПОДДЕРЖКОЙ ПЕСОЧНИЦЫ)
// 🔥 ПОЛНАЯ ВЕРСИЯ С ПЕРЕДАЧЕЙ patternData И clusterData

const TopologyBuilder = require('./TopologyBuilder');
const TopologicalAccumulator = require('./TopologicalAccumulator');

class TopologyManager {
    constructor(options = {}) {
        this.userId = options.userId || 'default';
        this.name = options.name || `Топология_${this.userId}`;
        this.debug = options.debug || false;

        // 🔥 РЕЖИМ ПЕСОЧНИЦЫ - по умолчанию false для накопления!
        this.sandboxMode = options.sandboxMode === true;
        console.log(`   🔥 sandboxMode: ${this.sandboxMode ? 'ДА (изолированные модели)' : 'НЕТ (накопление)'}`);

        // Аккумулятор с поддержкой треугольников
        this.accumulator = new TopologicalAccumulator({
            name: this.name,
            debug: this.debug,
            similarityThreshold: options.similarityThreshold || 0.6,
            minMatchesForEnhancement: options.minMatchesForEnhancement || 3,
            wlIterations: options.wlIterations || 3,
            tolerances: options.tolerances // передаем допуски
        });

        // Связь с существующей системой
        this.linkedFootprints = new Map();

        // 🔥 ВРЕМЕННЫЕ МОДЕЛИ ДЛЯ ПЕСОЧНИЦЫ (сессия -> модель)
        this.sandboxModels = new Map();

        // 🔥 ХРАНИЛИЩЕ ПАТТЕРНОВ И КЛАСТЕРОВ
        this.patterns = new Map();     // modelId -> patternData
        this.clusters = new Map();      // modelId -> clusterData

        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🔥 Режим: ${this.sandboxMode ? 'ПЕСОЧНИЦА (изолированные модели)' : 'ПРОДАКШН (накопление)'}`);
        console.log(`   🔥 Аккумулятор с поддержкой треугольников`);
        console.log(`   🔥 Сохранение паттернов и кластеров: включено`);
    }

    // ==================== ГЛАВНЫЙ МЕТОД ====================

    async processFootprint(footprint, analysisData, photoInfo = {}) {
        console.log(`\n🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото ${photoInfo.photoId || 'без ID'}...`);

        // Извлекаем точки и контуры
        let points = [];
        let contours = [];

        if (Array.isArray(analysisData)) {
            points = analysisData;
            contours = [];
            console.log(`📦 Получен массив точек (старый формат): ${points.length}`);
        } else if (analysisData && typeof analysisData === 'object') {
            if (analysisData.predictions) {
                const extracted = this.extractPointsFromCurrentPhoto(analysisData, photoInfo);
                points = extracted.points;
                contours = extracted.contours;
            } else {
                points = analysisData.points || [];
                contours = analysisData.contours || [];
            }
            console.log(`📦 Получены точки (${points.length}) и контуры (${contours.length})`);
        }

        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек для топологии');
            return {
                success: false,
                error: 'Недостаточно точек для топологической обработки',
                points: points.length
            };
        }

        console.log(`📊 Извлечено ${points.length} точек ИЗ ТЕКУЩЕГО ФОТО`);

        // Диагностика точек
        if (this.debug && points.length > 0) {
            console.log(`📋 Первые 3 точки текущего фото:`);
            points.slice(0, 3).forEach((p, i) => {
                console.log(`   ${i+1}. ${p.id || 'no-id'}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
            });
        }

        // 🔥 ОПРЕДЕЛЯЕМ МОДЕЛЬ ДЛЯ СРАВНЕНИЯ
        let modelId;

        if (this.sandboxMode) {
            // В песочнице - всегда новая временная модель
            const sessionId = photoInfo.sessionId || 'default_sandbox';
            modelId = this.sandboxModels.get(sessionId);

            if (!modelId) {
                modelId = `sandbox_${sessionId}_${Date.now()}`;
                this.sandboxModels.set(sessionId, modelId);
                console.log(`🏖️ Создана временная модель для сессии ${sessionId}`);
            }
        } else {
            // 🔥 НАКОПЛЕНИЕ: используем одну модель для всей сессии
            if (!this.accumulator.currentModelId) {
                console.log(`🆕 Первое фото, создаю базовую модель`);
            } else {
                console.log(`🔄 Использую существующую модель ${this.accumulator.currentModelId}`);
            }
            modelId = this.accumulator.currentModelId;
        }

        // 🔥 НОВОЕ: Добавляем диагностику
    const outlineContour = contours.find(c => c.class === 'Outline-trail' || c.type === 'footprint_outline');
    if (outlineContour && this.debug) {
        console.log(`📐 В процессе обработки найден контур следа (${outlineContour.points.length} точек)`);
    }

    // Передаём точки и контуры в аккумулятор
        console.log(`\n🔍 TopologyManager: ПЕРЕД ВЫЗОВОМ accumulator.processPoints:`);
console.log(`   modelId = ${modelId?.substring(0,20)}`);
console.log(`   accumulator.currentModelId = ${this.accumulator.currentModelId?.substring(0,20)}`);
console.log(`   accumulator.models.size = ${this.accumulator.models.size}`);

// Передаём точки и контуры в аккумулятор
const result = await this.accumulator.processPoints(points, {
    modelId: modelId,
    source: `photo_${photoInfo.photoId || Date.now()}`,
    name: photoInfo.name || `Фото_${new Date().toLocaleTimeString('ru-RU')}`,
    footprintId: footprint.id,
    photoInfo: photoInfo,
    photoId: photoInfo.photoId,
    contours: contours
});

// ========== ДИАГНОСТИКА СРАЗУ ПОСЛЕ ВОЗВРАТА ИЗ accumulator.processPoints ==========
console.log(`\n🔍 СРАЗУ ПОСЛЕ ВОЗВРАТА ИЗ accumulator.processPoints:`);
const modelImmediate = this.accumulator.getCurrentModel();
if (modelImmediate && modelImmediate.graph) {
    let red = 0, orange = 0, yellow = 0, blue = 0;
    for (const node of modelImmediate.graph.nodes.values()) {
        const count = node.confirmationCount || 0;
        if (count >= 4) red++;
        else if (count === 3) orange++;
        else if (count === 2) yellow++;
        else if (count === 1) blue++;
    }
    console.log(`   Состояние модели: красных ${red}, оранж ${orange}, жёлт ${yellow}, син ${blue}`);
    console.log(`   Всего узлов: ${modelImmediate.graph.nodes.size}`);
}
// ========== КОНЕЦ ДИАГНОСТИКИ ==========

// ========== ДИАГНОСТИКА ПОСЛЕ accumulator.processPoints (оставляем для сравнения) ==========
console.log(`\n🔍 ПОСЛЕ accumulator.processPoints в TopologyManager (после всех операций):`);
const modelAfterProcess = this.accumulator.getCurrentModel();
if (modelAfterProcess && modelAfterProcess.graph) {
    let red = 0, orange = 0, yellow = 0, blue = 0;
    for (const node of modelAfterProcess.graph.nodes.values()) {
        const count = node.confirmationCount || 0;
        if (count >= 4) red++;
        else if (count === 3) orange++;
        else if (count === 2) yellow++;
        else if (count === 1) blue++;
    }
    console.log(`   Состояние модели: красных ${red}, оранж ${orange}, жёлт ${yellow}, син ${blue}`);
    console.log(`   Всего узлов: ${modelAfterProcess.graph.nodes.size}`);
}
// ========== КОНЕЦ ДИАГНОСТИКИ ==========

// 🔥 СОХРАНЯЕМ patternData И clusterData
if (result.modelId && this.accumulator.models.has(result.modelId)) {
    const model = this.accumulator.models.get(result.modelId);
    if (model.patternData) {
        this.patterns.set(result.modelId, model.patternData);
    }
    if (model.clusterData) {
        this.clusters.set(result.modelId, model.clusterData);
    }
}

        // 🔥 ВАЖНО: обновляем текущий modelId для следующих вызовов
if (result.modelId) {
    modelId = result.modelId;
    if (!this.sandboxMode) {
        this.linkedFootprints.set(footprint.id, result.modelId);
        console.log(`🔄 Обновлена связь: след ${footprint.id} → модель ${result.modelId}`);
    }
    // Также обновляем в аккумуляторе, если нужно
    if (this.accumulator.currentModelId !== result.modelId) {
        this.accumulator.currentModelId = result.modelId;
        console.log(`🔄 Обновлён currentModelId в аккумуляторе: ${result.modelId}`);
    }
}

        // Получаем обновленную информацию о модели
        const modelInfo = this.accumulator.getModelInfo(result.modelId);

        // 🔥 СОХРАНЯЕМ matchMap ИЗ РЕЗУЛЬТАТА (для визуализации)
        const matchMap = result.matchMap || null;
       
        if (matchMap) {
            console.log(`🔍 matchMap передан в результат: ${matchMap.size} пар`);
        }

        // ========== ДИАГНОСТИКА ПЕРЕД ВОЗВРАТОМ ИЗ processFootprint ==========
console.log(`\n🔍 ПЕРЕД ВОЗВРАТОМ ИЗ processFootprint:`);
const modelBeforeReturn = this.accumulator.getCurrentModel();
if (modelBeforeReturn && modelBeforeReturn.graph) {
    let red = 0, orange = 0, yellow = 0, blue = 0;
    for (const node of modelBeforeReturn.graph.nodes.values()) {
        const count = node.confirmationCount || 0;
        if (count >= 4) red++;
        else if (count === 3) orange++;
        else if (count === 2) yellow++;
        else if (count === 1) blue++;
    }
    console.log(`   Состояние модели: красных ${red}, оранж ${orange}, жёлт ${yellow}, син ${blue}`);
}
// ========== КОНЕЦ ДИАГНОСТИКИ ==========

return {
    success: true,
    topologicalResult: {
        ...result,
        matchMap: matchMap
    },
    modelInfo: modelInfo,
    pointsCount: points.length,
    modelId: result.modelId,
    similarity: result.similarity || 0,
    decision: this.getDecisionFromResult(result),
    sandboxMode: this.sandboxMode,
    patternData: this.patterns.get(result.modelId),
    clusterData: this.clusters.get(result.modelId)
};
    }

    // ==================== ИЗВЛЕЧЕНИЕ ТОЧЕК И КОНТУРОВ ====================

    extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
        const points = [];
        const contours = [];

        if (!analysis?.predictions) {
            console.log('⚠️ Нет данных анализа для извлечения точек');
            return { points, contours };
        }

        const photoId = photoInfo.photoId || `photo_${Date.now()}`;
        const predictions = analysis.predictions || [];
        let protectorCount = 0;

        predictions.forEach((pred, idx) => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                const pointId = `${photoId}_pt_${protectorCount}`;
               
                // Сохраняем контур
                contours.push({
                    id: `${photoId}_contour_${protectorCount}`,
                    pointId: pointId,
                    points: pred.points,
                    class: pred.class,
                    confidence: pred.confidence || 0.5
                });

                // Сохраняем точку (центр контура)
                points.push({
                    id: pointId,
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    source: 'current_photo',
                    photoId: photoId,
                    originalIndex: protectorCount,
                    originalPoints: pred.points,
                    contourId: `${photoId}_contour_${protectorCount}`
                });
                protectorCount++;
            }
        });

        console.log(`📸 Извлечено ${points.length} точек и ${contours.length} контуров из ТЕКУЩЕГО ФОТО ${photoId}`);

        return { points, contours };
    }

    // ==================== ПОЛУЧЕНИЕ РЕШЕНИЯ ====================

    getDecisionFromResult(result) {
        if (!result) return 'unknown';

        if (result.status === 'created') {
            return 'new_footprint';
        } else if (result.status === 'enhanced_full' || result.status === 'enhanced_fast' || result.status === 'enhanced_optimal') {
            return 'same_footprint_enhanced';
        } else if (result.similarity >= 0.6) {
            return 'same_footprint';
        } else {
            return 'different_footprint';
        }
    }

    // ==================== ВИЗУАЛИЗАЦИЯ ====================

    getAccumulativeVisualizationData(modelId = null) {
        console.log(`\n🔍 getAccumulativeVisualizationData ВЫЗВАН`);
        console.log(new Error().stack.split('\n').slice(1, 5).join('\n'));
       
        const targetModelId = modelId || this.accumulator.currentModelId;

        if (!targetModelId) {
            console.log('⚠️ Нет активной топологической модели');
            return null;
        }

        const model = this.accumulator.models.get(targetModelId);
        if (!model) {
            console.log('⚠️ Модель не найдена');
            return null;
        }

         const graph = model.graph;
   
    // 🔥 ПРОВЕРЯЕМ, ЧТО triangleList АКТУАЛЕН
    if (!graph.triangleList || graph.triangleList.length === 0) {
        console.log(`   ⚠️ triangleList пуст, пересчитываю...`);
        this.accumulator.recalculateTriangles(graph);
    }
   
    const triangles = graph.triangleList || [];
    console.log(`   📊 getAccumulativeVisualizationData: triangles.length = ${triangles.length}`);
       
        // 🔥 ИСПРАВЛЕНО: Копируем ВСЕ поля, включая morphology и sourceContours
        const points = Array.from(graph.nodes.values()).map(node => ({
            id: node.id,
            x: node.x,
            y: node.y,
            confirmationCount: node.confirmationCount || 0,
            degree: node.degree || 0,
            triangles: node.triangles || 0,
            // 🔥 КРИТИЧНО: Копируем морфологию и историю контуров
            morphology: node.morphology || null,
            sourceContours: node.sourceContours || [],
            // Остальные поля
            clusterId: node.clusterId,
            patternType: node.patternType,
            addedFrom: node.addedFrom
        }));

        // 🔥 ДИАГНОСТИКА
        let pointsWithContour = 0;
        let pointsWithHistory = 0;
        for (const point of points) {
            if (point.morphology?.contour) pointsWithContour++;
            if (point.sourceContours?.length > 0) pointsWithHistory++;
        }
        console.log(`   📊 getAccumulativeVisualizationData: точек с контуром ${pointsWithContour}, с историей ${pointsWithHistory}`);

        const edges = Array.from(graph.edges);
       
        // Получаем структуры
        const structures = (model.structures || []).map(s => ({
            id: s.id,
            pointIds: s.pointIds || [],
            triangleIds: s.triangleIds || [],
            triangles: s.triangles || [],
            confidence: s.confidence || 0,
            transform: s.transform || null,
            rays: s.rays || []
        }));

        // Получаем треугольники
        const triangles = this.accumulator.extractTrianglesFromGraph(graph);

        // Получаем pointToStructure
        const pointToStructure = model.pointToStructure || new Map();

        // Получаем уникальные точки
        const uniquePoints = model.uniquePoints || { model: [], photo: [] };

        // Получаем matchMap
        const matchMap = model.lastTriangleResult?.matchMap || new Map();
        const modelMatchMap = model.lastTriangleResult?.modelMatchMap || new Map();

        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            confirmed3: points.filter(p => p.confirmationCount >= 3).length,
            confirmed2: points.filter(p => p.confirmationCount === 2).length,
            confirmed1: points.filter(p => p.confirmationCount === 1).length,
            confirmed0: points.filter(p => !p.confirmationCount).length,
            structureCount: structures.length,
            // 🔥 Дополнительная статистика
            uniquePoints: graph.nodes.size,
            confirmedPoints: points.filter(p => p.confirmationCount >= 2).length,
            stability: graph.nodes.size > 0 ?
                (points.filter(p => p.confirmationCount >= 2).length / graph.nodes.size * 100).toFixed(1) : 0
        };

        const vizData = {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: points,
            photoPoints: model.originalPoints || [],
            edges: edges,
            triangles: triangles,
            structures: structures,
            pointToStructure: pointToStructure,
            uniquePoints: uniquePoints,
            matchMap: matchMap,
            modelMatchMap: modelMatchMap,
            outlineContour: model.metadata?.outlineContour || null,
            transform: model.transform || model.lastTransform || null,
            stats: stats,
            metadata: model.metadata
        };

        // Добавляем паттерны и кластеры
        vizData.patternData = this.patterns.get(targetModelId);
        vizData.clusterData = this.clusters.get(targetModelId);

        return vizData;
    }

    // ==================== РАБОТА С ПАТТЕРНАМИ И КЛАСТЕРАМИ ====================

    getPatterns(modelId = null) {
        const targetId = modelId || this.accumulator.currentModelId;
        return targetId ? this.patterns.get(targetId) : null;
    }

    getClusters(modelId = null) {
        const targetId = modelId || this.accumulator.currentModelId;
        return targetId ? this.clusters.get(targetId) : null;
    }

    comparePatterns(modelId1, modelId2) {
        const patterns1 = this.patterns.get(modelId1);
        const patterns2 = this.patterns.get(modelId2);
       
        if (!patterns1 || !patterns2) {
            return { error: 'Pattern data not found' };
        }

        // Используем PatternAnalyzer для сравнения
        const PatternAnalyzer = require('../analysis/PatternAnalyzer');
        const analyzer = new PatternAnalyzer({ debug: this.debug });
       
        return analyzer.comparePatterns(patterns1.patterns, patterns2.patterns);
    }

    // ==================== ИНФОРМАЦИЯ О МОДЕЛЯХ ====================

    getUserModelsInfo() {
        const stats = this.accumulator.getStats();
       
        // Добавляем информацию о паттернах и кластерах
        const models = [];
        for (const [modelId, model] of this.accumulator.models) {
            const patternData = this.patterns.get(modelId);
            const clusterData = this.clusters.get(modelId);
           
            models.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                patterns: patternData ? Object.keys(patternData.groups || {}).length : 0,
                clusters: clusterData ? Object.keys(clusterData.clusters || {}).length : 0,
                createdAt: model.metadata.createdAt
            });
        }

        return {
            ...stats,
            models: {
                total: this.accumulator.models.size,
                list: models
            }
        };
    }

    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
        this.sandboxModels.clear();
        this.patterns.clear();
        this.clusters.clear();

        console.log(`🧹 Очищены все топологические модели пользователя ${this.userId}`);
        return { success: true, message: 'Топологические модели очищены' };
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    exportUserModels() {
        const models = [];

        for (const [modelId, model] of this.accumulator.models) {
    // 🔥 Экспортируем ТОЛЬКО points, без графа
    models.push({
        id: modelId,
        points: model.points || Array.from(model.graph?.nodes?.values() || []),
        metadata: model.metadata,
        patternData: this.patterns.get(modelId),
        clusterData: this.clusters.get(modelId),
        exportedAt: new Date().toISOString()
    });
}

        return {
            userId: this.userId,
            models: models,
            linkedFootprints: Array.from(this.linkedFootprints.entries()),
            exportedAt: new Date().toISOString(),
            version: '2.0-topological'
        };
    }

    importUserModels(data) {
        if (!data || !data.models || !Array.isArray(data.models)) {
            return { success: false, error: 'Неверный формат данных' };
        }

        let importedCount = 0;

        for (const modelData of data.models) {
    // 🔥 Импортируем модель с точками
    const modelId = modelData.id;
   
    // Строим граф из точек
    const points = modelData.points || [];
    const graph = points.length >= 3
        ? this.accumulator.graphBuilder.buildGraph(points, 'imported_model')
        : this.accumulator.graphBuilder.buildMinimalGraph(points);
   
    const model = {
        id: modelId,
        points: points,
        graph: graph,
        knnGraph: null,
        knnFingerprints: new Map(),
        morphologyMap: new Map(),
        metadata: modelData.metadata || {},
        patternData: modelData.patternData,
        clusterData: modelData.clusterData,
        history: []
    };
   
    this.accumulator.models.set(modelId, model);
   
    if (modelData.patternData) {
        this.patterns.set(modelId, modelData.patternData);
    }
    if (modelData.clusterData) {
        this.clusters.set(modelId, modelData.clusterData);
    }
    importedCount++;
}

        // Восстанавливаем связи след-модель
        if (data.linkedFootprints && Array.isArray(data.linkedFootprints)) {
            data.linkedFootprints.forEach(([footprintId, modelId]) => {
                this.linkedFootprints.set(footprintId, modelId);
            });
        }

        console.log(`📥 Импортировано ${importedCount} топологических моделей для пользователя ${this.userId}`);
        console.log(`   • Восстановлено паттернов: ${this.patterns.size}`);
        console.log(`   • Восстановлено кластеров: ${this.clusters.size}`);

        return {
            success: true,
            importedCount: importedCount,
            totalModels: this.accumulator.models.size,
            patternsCount: this.patterns.size,
            clustersCount: this.clusters.size
        };
    }

    // ==================== ДИАГНОСТИКА ====================

    debugModel(modelId = null) {
        const targetId = modelId || this.accumulator.currentModelId;
        if (!targetId || !this.accumulator.models.has(targetId)) {
            return { error: 'Model not found' };
        }

        const model = this.accumulator.models.get(targetId);
        const patternData = this.patterns.get(targetId);
        const clusterData = this.clusters.get(targetId);

        return {
            modelId: targetId,
            nodes: model.graph.nodes.size,
            edges: model.graph.edges.size,
            patterns: patternData ? {
                total: Object.keys(patternData.patterns || {}).length,
                groups: Object.keys(patternData.groups || {}).length,
                gaps: Object.keys(patternData.gaps || {}).length
            } : null,
            clusters: clusterData ? {
                total: Object.keys(clusterData.clusters || {}).length,
                relations: clusterData.relations ? clusterData.relations.size : 0
            } : null,
            morphology: Array.from(model.graph.nodes.values())
                .filter(n => n.morphology && n.hasContour).length
        };
    }
}

module.exports = TopologyManager;
