// modules/footprint/simple-footprint.js
// ЦИФРОВОЙ ОТПЕЧАТОК - ОБЁРТКА НАД ГРАФОМ + МЕТАДАННЫХ

const crypto = require('crypto');
const SimpleGraph = require('./simple-graph');

class SimpleFootprint {
    constructor(options = {}) {
        // Идентификаторы
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;
       
        // Граф - основа отпечатка
        this.graph = options.graph || new SimpleGraph(this.name);
       
        // Метаданные
        this.metadata = {
            created: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            estimatedSize: options.estimatedSize || null,
            footprintType: options.footprintType || 'unknown',
            orientation: options.orientation || 0,
            ...(options.metadata || {})
        };
       
        // Статистика
        this.stats = {
            confidence: options.confidence || 0.5,
            nodeCount: 0,
            edgeCount: 0,
            graphDiameter: 0,
            clusteringCoefficient: 0,
            qualityScore: 0
        };
       
        // История фото/анализов
        this.photoHistory = [];
        this.analysisHistory = [];
       
        // Связанные отпечатки (для объединения/сравнения)
        this.linkedFootprints = [];
       
        console.log(`👣 Создан цифровой отпечаток "${this.name}" (ID: ${this.id})`);
    }
   
    // 1. ДОБАВИТЬ АНАЛИЗ (основной метод)
    addAnalysis(analysis, sourceInfo = {}) {
        console.log(`📥 Добавляю анализ в отпечаток "${this.name}"...`);
       
        const { predictions } = analysis;
       
        // Проверка входных данных
        if (!predictions || !Array.isArray(predictions)) {
            console.log('⚠️ Нет предсказаний в анализе');
            return { error: 'No predictions', added: 0 };
        }
       
        // Извлечь точки протекторов
        const protectorPoints = this.extractProtectorPoints(predictions);
       
        if (protectorPoints.length < 3) {
            console.log(`⚠️ Слишком мало протекторов: ${protectorPoints.length}`);
            return { error: 'Not enough protectors', added: 0 };
        }
       
        console.log(`🔍 Найдено ${protectorPoints.length} протекторов`);
       
        // Обновить граф
        const previousNodeCount = this.graph.nodes.size;
        const graphInvariants = this.graph.buildFromPoints(protectorPoints);
       
        // Сохранить в историю
        const analysisRecord = {
            id: `analysis_${Date.now()}`,
            timestamp: new Date(),
            pointsCount: protectorPoints.length,
            sourceInfo: sourceInfo,
            graphSnapshot: {
                nodeCount: this.graph.nodes.size,
                edgeCount: this.graph.edges.size
            }
        };
       
        this.analysisHistory.push(analysisRecord);
        this.photoHistory.push({
            timestamp: new Date(),
            points: protectorPoints.length,
            source: sourceInfo
        });
       
        // Обновить метаданные
        this.metadata.totalPhotos++;
        this.metadata.lastUpdated = new Date();
       
        // Обновить статистику
        this.updateStats(graphInvariants);
       
        const addedNodes = this.graph.nodes.size - previousNodeCount;
       
        console.log(`✅ Анализ добавлен: +${addedNodes} новых узлов, ` +
                   `всего ${this.graph.nodes.size} узлов`);
       
        return {
            success: true,
            added: addedNodes,
            totalNodes: this.graph.nodes.size,
            confidence: this.stats.confidence,
            graphInvariants: graphInvariants
        };
    }
   
    // 2. ИЗВЛЕЧЬ ТОЧКИ ПРОТЕКТОРОВ ИЗ АНАЛИЗА
    extractProtectorPoints(predictions) {
        const points = [];
       
        // Фильтруем только протекторы обуви
        const protectors = predictions.filter(p =>
            p.class === 'shoe-protector' ||
            (p.class && p.class.toLowerCase().includes('protector'))
        );
       
        // Если нет класса shoe-protector, но есть точки с confidence
        if (protectors.length === 0 && predictions.length > 0) {
            console.log('⚠️ Нет класса shoe-protector, использую все точки с confidence > 0.3');
           
            predictions.forEach((pred, index) => {
                if ((pred.confidence || 0) > 0.3 && pred.points && pred.points.length > 0) {
                    // Берем центр точек
                    const center = this.calculateCenter(pred.points);
                    points.push({
                        x: center.x,
                        y: center.y,
                        confidence: pred.confidence || 0.5,
                        originalPoints: pred.points
                    });
                }
            });
        } else {
            // Нормальный случай: есть протекторы
            protectors.forEach(protector => {
                if (protector.points && protector.points.length > 0) {
                    const center = this.calculateCenter(protector.points);
                    points.push({
                        x: center.x,
                        y: center.y,
                        confidence: protector.confidence || 0.5,
                        originalPoints: protector.points
                    });
                }
            });
        }
       
        return points;
    }
   
    // 3. РАССЧИТАТЬ ЦЕНТР ТОЧЕК
    calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }
   
    // 4. ОБНОВИТЬ СТАТИСТИКУ
    updateStats(graphInvariants) {
        this.stats.nodeCount = graphInvariants.nodeCount;
        this.stats.edgeCount = graphInvariants.edgeCount;
        this.stats.graphDiameter = graphInvariants.graphDiameter;
        this.stats.clusteringCoefficient = graphInvariants.clusteringCoefficient;
       
        // Рассчитать confidence на основе инвариантов
        const nodeScore = Math.min(1, graphInvariants.nodeCount / 20); // Хотя бы 20 узлов
        const edgeScore = graphInvariants.edgeCount > 0 ?
            Math.min(1, graphInvariants.edgeCount / graphInvariants.nodeCount / 2) : 0;
        const clusteringScore = graphInvariants.clusteringCoefficient;
       
        this.stats.confidence = (nodeScore * 0.4 + edgeScore * 0.3 + clusteringScore * 0.3);
        this.stats.qualityScore = this.stats.confidence * Math.min(1, this.metadata.totalPhotos / 3);
       
        // Обновить метаданные
        if (graphInvariants.nodeCount > 30 && !this.metadata.estimatedSize) {
            // Очень грубая оценка размера по количеству протекторов
            this.metadata.estimatedSize = Math.round(35 + (graphInvariants.nodeCount - 30) / 3);
        }
    }
   
    // 5. СРАВНИТЬ С ДРУГИМ ОТПЕЧАТКОМ
    compare(otherFootprint) {
        console.log(`🔍 Сравниваю "${this.name}" с "${otherFootprint.name}"...`);
       
        if (!otherFootprint || !otherFootprint.graph) {
            return { error: 'Invalid footprint to compare' };
        }
       
        const invariants1 = this.graph.getBasicInvariants();
        const invariants2 = otherFootprint.graph.getBasicInvariants();
       
        // Быстрое сравнение по количеству узлов (±30%)
        const nodeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);
       
        if (nodeRatio < 0.7) {
            console.log(`⚠️ Слишком разное количество узлов: ${nodeRatio.toFixed(2)}`);
            return {
                similarity: nodeRatio,
                decision: 'different',
                reason: `Разное количество узлов: ${invariants1.nodeCount} vs ${invariants2.nodeCount}`
            };
        }
       
        // Сравнение инвариантов
        const comparisons = [];
       
        // 1. Сравнение количества рёбер
        const edgeRatio = Math.min(invariants1.edgeCount, invariants2.edgeCount) /
                        Math.max(invariants1.edgeCount, invariants2.edgeCount);
        comparisons.push({ name: 'edgeCount', score: edgeRatio });
       
        // 2. Сравнение средней степени
        const degreeDiff = Math.abs(invariants1.avgDegree - invariants2.avgDegree);
        const degreeScore = 1 - Math.min(1, degreeDiff / 3); // Допуск 3
        comparisons.push({ name: 'avgDegree', score: degreeScore });
       
        // 3. Сравнение коэффициента кластеризации
        const clusteringDiff = Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient);
        const clusteringScore = 1 - Math.min(1, clusteringDiff / 0.3); // Допуск 0.3
        comparisons.push({ name: 'clustering', score: clusteringScore });
       
        // 4. Сравнение плотности графа
        const densityDiff = Math.abs(invariants1.density - invariants2.density);
        const densityScore = 1 - Math.min(1, densityDiff / 0.1); // Допуск 0.1
        comparisons.push({ name: 'density', score: densityScore });
       
        // Рассчитать общую схожесть
        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score, 0) / comparisons.length;
        const similarity = Math.round(totalScore * 100) / 100; // Округлить до 2 знаков
       
        // Принять решение
        let decision, reason;
        if (similarity > 0.7) {
            decision = 'same';
            reason = `Высокая схожесть (${similarity}) - вероятно, та же обувь`;
        } else if (similarity > 0.4) {
            decision = 'similar';
            reason = `Умеренная схожесть (${similarity}) - похожий тип протектора`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть (${similarity}) - разные следы`;
        }
       
        console.log(`📊 Результат сравнения: ${similarity} (${decision})`);
       
        return {
            similarity: similarity,
            decision: decision,
            reason: reason,
            comparisons: comparisons,
            invariants1: {
                nodeCount: invariants1.nodeCount,
                edgeCount: invariants1.edgeCount,
                avgDegree: invariants1.avgDegree.toFixed(2),
                clustering: invariants1.clusteringCoefficient.toFixed(3)
            },
            invariants2: {
                nodeCount: invariants2.nodeCount,
                edgeCount: invariants2.edgeCount,
                avgDegree: invariants2.avgDegree.toFixed(2),
                clustering: invariants2.clusteringCoefficient.toFixed(3)
            }
        };
    }
   
    // 6. ОБЪЕДИНИТЬ С ДРУГИМ ОТПЕЧАТКОМ (если это тот же след)
    merge(otherFootprint) {
        console.log(`🔄 Объединяю "${this.name}" с "${otherFootprint.name}"...`);
       
        const comparison = this.compare(otherFootprint);
       
        if (comparison.decision !== 'same') {
            console.log(`❌ Не могу объединить: ${comparison.reason}`);
            return {
                success: false,
                reason: comparison.reason,
                similarity: comparison.similarity
            };
        }
       
        // Объединить историю
        this.analysisHistory.push(...otherFootprint.analysisHistory);
        this.photoHistory.push(...otherFootprint.photoHistory);
       
        // Обновить метаданные
        this.metadata.totalPhotos += otherFootprint.metadata.totalPhotos;
        this.metadata.lastUpdated = new Date();
       
        // Добавить в связанные
        this.linkedFootprints.push({
            id: otherFootprint.id,
            name: otherFootprint.name,
            mergedAt: new Date(),
            similarity: comparison.similarity
        });
       
        // Обновить статистику (усреднить)
        this.stats.confidence = (this.stats.confidence + otherFootprint.stats.confidence) / 2;
        this.stats.qualityScore = Math.max(this.stats.qualityScore, otherFootprint.stats.qualityScore);
       
        console.log(`✅ Объединено успешно! Теперь ${this.metadata.totalPhotos} фото в отпечатке`);
       
        return {
            success: true,
            mergedPhotos: otherFootprint.metadata.totalPhotos,
            newTotalPhotos: this.metadata.totalPhotos,
            similarity: comparison.similarity
        };
    }
   
    // 7. ПОЛУЧИТЬ ИНФОРМАЦИЮ ОБ ОТПЕЧАТКЕ
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            stats: {
                ...this.stats,
                qualityScore: Math.round(this.stats.qualityScore * 100)
            },
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toLocaleString('ru-RU'),
                lastUpdated: this.metadata.lastUpdated.toLocaleString('ru-RU')
            },
            history: {
                analyses: this.analysisHistory.length,
                photos: this.photoHistory.length,
                linkedFootprints: this.linkedFootprints.length
            },
            graph: {
                nodes: this.graph.nodes.size,
                edges: this.graph.edges.size,
                invariants: this.graph.getBasicInvariants()
            }
        };
    }
   
    // 8. СОХРАНИТЬ В JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            graph: this.graph.toJSON(),
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toISOString(),
                lastUpdated: this.metadata.lastUpdated.toISOString()
            },
            stats: this.stats,
            analysisHistory: this.analysisHistory,
            photoHistory: this.photoHistory,
            linkedFootprints: this.linkedFootprints,
            _version: '1.0',
            _savedAt: new Date().toISOString()
        };
    }
   
    // 9. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        console.log(`📂 Загружаю отпечаток "${data.name}"...`);
       
        // Создать граф из данных
        const graph = SimpleGraph.fromJSON(data.graph);
       
        // Создать отпечаток
        const footprint = new SimpleFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            graph: graph,
            metadata: data.metadata,
            confidence: data.stats?.confidence
        });
       
        // Восстановить историю
        if (Array.isArray(data.analysisHistory)) {
            footprint.analysisHistory = data.analysisHistory;
        }
       
        if (Array.isArray(data.photoHistory)) {
            footprint.photoHistory = data.photoHistory;
        }
       
        if (Array.isArray(data.linkedFootprints)) {
            footprint.linkedFootprints = data.linkedFootprints;
        }
       
        // Восстановить статистику
        if (data.stats) {
            footprint.stats = { ...footprint.stats, ...data.stats };
        }
       
        console.log(`✅ Загружен отпечаток "${footprint.name}" с ${footprint.graph.nodes.size} узлами`);
       
        return footprint;
    }
   
    // 10. ВИЗУАЛИЗАЦИЯ ДЛЯ ОТЛАДКИ
    visualize() {
        console.log(`\n👣 ЦИФРОВОЙ ОТПЕЧАТОК "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Узлов в графе: ${this.graph.nodes.size}`);
        console.log(`├─ Рёбер в графе: ${this.graph.edges.size}`);
        console.log(`├─ Фото в истории: ${this.photoHistory.length}`);
        console.log(`├─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
        console.log(`├─ Качество: ${Math.round(this.stats.qualityScore * 100)}%`);
        console.log(`└─ Создан: ${this.metadata.created.toLocaleString('ru-RU')}`);
       
        // Показать инварианты графа
        const invariants = this.graph.getBasicInvariants();
        console.log(`\n📊 ИНВАРИАНТЫ ГРАФА:`);
        console.log(`├─ Диаметр: ${invariants.graphDiameter}`);
        console.log(`├─ Кластеризация: ${invariants.clusteringCoefficient.toFixed(3)}`);
        console.log(`├─ Средняя степень: ${invariants.avgDegree.toFixed(2)}`);
        console.log(`└─ Плотность: ${invariants.density.toFixed(4)}`);
    }
}

module.exports = SimpleFootprint;
