// modules/footprint/simple-footprint.js (УПРОЩЕННАЯ ВЕРСИЯ)
// 🔥 УДАЛЕНО ВСЁ ПРО ТРАНСФОРМАЦИИ, ОСТАВЛЕНА ТОЛЬКО БАЗОВАЯ ЛОГИКА

const crypto = require('crypto');
const fs = require('fs');
const SimpleGraph = require('./simple-graph');
const PointTracker = require('./point-tracker');
const path = require('path');

class SimpleFootprint {
    constructor(options = {}) {
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;
       
        // 🔥 УДАЛЕНО: transformation, originalBounds, normalizationInfo
        // 🔥 ТОЛЬКО БАЗОВЫЕ ДАННЫЕ
       
        // Граф
        this.graph = options.graph || new SimpleGraph(this.name);
       
        // 🔥 УПРОЩЕННЫЙ POINT TRACKER (только для хранения точек)
        this.pointTracker = options.pointTracker || new PointTracker({
            ratingDecay: 0.97,
            minRating: 0.1,
            maxRating: 1.0,
            confirmationThreshold: 0.7,
            debug: false, // 🔥 ОТКЛЮЧАЕМ ДЕБАГ
            enableClustering: false, // 🔥 ОТКЛЮЧАЕМ КЛАСТЕРИЗАЦИЮ
            honestConfirmations: true
        });
       
        // Метаданные
        this.metadata = {
            created: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            footprintType: options.footprintType || 'unknown',
            features: {
                hasGraph: true,
                hasPointTracker: true,
                hasHonestConfirmations: true,
                // 🔥 УДАЛЕНО: hasMoments, hasBitmask, hasHybrid
            },
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
       
        this.photoHistory = [];
        this.analysisHistory = [];
       
        console.log(`👣 Создан УПРОЩЕННЫЙ цифровой отпечаток "${this.name}" (без трансформаций)`);
    }
   
    // 🔥 УПРОЩЕННЫЙ МЕТОД: Добавление анализа (БЕЗ ТРАНСФОРМАЦИЙ)
    addAnalysisHonest(analysis, sourceInfo = {}) {
        console.log(`📥 Добавление анализа в упрощенный отпечаток`);
       
        const { predictions } = analysis;
        const protectorPoints = this.extractProtectorPoints(predictions);
       
        if (protectorPoints.length < 3) {
            console.log(`⚠️ Слишком мало протекторов: ${protectorPoints.length}`);
            return { error: 'Not enough protectors', added: 0 };
        }
       
        console.log(`🔍 Найдено ${protectorPoints.length} протекторов`);
       
        // 🔥 ПРОСТАЯ ОБРАБОТКА ЧЕРЕЗ POINT TRACKER
        const trackerResults = this.pointTracker.processNewPoints(protectorPoints, {
            ...sourceInfo,
            footprintId: this.id,
            photoId: sourceInfo.photoId || `photo_${Date.now()}`,
            source: sourceInfo.source || 'direct_photo'
        });
       
        console.log(`🎯 PointTracker: ${trackerResults.added} новых, ${trackerResults.updated} обновлено`);
       
        // 🔥 ПРОСТОЕ ПОСТРОЕНИЕ ГРАФА ИЗ ТОЧЕК ТРЕКЕРА
        const previousNodeCount = this.graph.nodes.size;
       
        // Получаем точки из трекера
        const trackedPoints = [];
        for (const [id, pt] of this.pointTracker.points) {
            trackedPoints.push({
                id,
                x: pt.x,
                y: pt.y,
                rating: pt.rating,
                confirmedCount: pt.confirmedCount || 1
            });
        }
       
        console.log(`📊 Точки для графа: ${trackedPoints.length} из трекера`);
       
        if (trackedPoints.length === 0) {
            console.log(`⚠️ Нет точек для построения графа`);
            return {
                success: true,
                added: 0,
                updated: trackerResults.updated,
                totalNodes: 0,
                confidence: 0.5
            };
        }
       
        // Строим граф из точек
        const graphPoints = trackedPoints.map(trackedPoint => ({
            id: `n_${trackedPoint.id}`,
            x: trackedPoint.x,
            y: trackedPoint.y,
            confidence: trackedPoint.rating,
            confirmedCount: trackedPoint.confirmedCount,
            pointTrackerId: trackedPoint.id
        }));
       
        const graphInvariants = this.graph.buildFromPoints(graphPoints.map(p => ({
            x: p.x,
            y: p.y,
            confidence: p.confidence,
            id: p.id
        })));
       
        console.log(`✅ Построен граф: ${this.graph.nodes.size} узлов, ${this.graph.edges.size} рёбер`);
       
        // Связываем узлы с трекером
        this.linkNodesWithTracker(graphPoints);
       
        // Сохраняем в историю
        this.analysisHistory.push({
            id: `analysis_${Date.now()}`,
            timestamp: new Date(),
            pointsCount: protectorPoints.length,
            trackerResults: trackerResults,
            sourceInfo: sourceInfo
        });
       
        this.photoHistory.push({
            timestamp: new Date(),
            points: protectorPoints.length,
            source: sourceInfo,
            trackerResults: trackerResults,
            photoId: trackerResults.photoId
        });
       
        // Обновляем метаданные
        this.metadata.totalPhotos++;
        this.metadata.lastUpdated = new Date();
       
        // Обновляем статистику
        this.updateStats(graphInvariants);
       
        const addedNodes = this.graph.nodes.size - previousNodeCount;
       
        console.log(`✅ Анализ добавлен: +${addedNodes} узлов, всего: ${this.graph.nodes.size}`);
       
        return {
            success: true,
            added: addedNodes,
            totalNodes: this.graph.nodes.size,
            confidence: this.stats.confidence,
            trackerResults: trackerResults
        };
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (без изменений)
    extractProtectorPoints(predictions) {
        const points = [];
       
        const protectors = predictions.filter(p =>
            p.class === 'shoe-protector' ||
            (p.class && p.class.toLowerCase().includes('protector'))
        );
       
        if (protectors.length === 0 && predictions.length > 0) {
            console.log('⚠️ Нет класса shoe-protector, использую все точки с confidence > 0.3');
           
            predictions.forEach((pred, index) => {
                if ((pred.confidence || 0) > 0.3 && pred.points && pred.points.length > 0) {
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
   
    linkNodesWithTracker(graphPoints) {
        let linkedCount = 0;
       
        this.graph.nodes.forEach((node, nodeId) => {
            const trackerIdMatch = nodeId.match(/n_(pt_\d+)/);
            const trackerId = trackerIdMatch ? trackerIdMatch[1] : null;
           
            if (trackerId && this.pointTracker.points.has(trackerId)) {
                const trackerPoint = this.pointTracker.points.get(trackerId);
                node.pointTrackerId = trackerId;
                node.confirmedCount = trackerPoint.confirmedCount || 1;
                node.confidence = trackerPoint.rating;
                linkedCount++;
            }
        });
       
        console.log(`🔗 Связано ${linkedCount} узлов с трекером`);
        return linkedCount;
    }
   
    updateStats(graphInvariants) {
        this.stats.nodeCount = graphInvariants.nodeCount;
        this.stats.edgeCount = graphInvariants.edgeCount;
        this.stats.graphDiameter = graphInvariants.graphDiameter;
        this.stats.clusteringCoefficient = graphInvariants.clusteringCoefficient;
       
        const nodeScore = Math.min(1, graphInvariants.nodeCount / 20);
        const edgeScore = graphInvariants.edgeCount > 0 ?
            Math.min(1, graphInvariants.edgeCount / graphInvariants.nodeCount / 2) : 0;
        const clusteringScore = graphInvariants.clusteringCoefficient;
       
        this.stats.confidence = (nodeScore * 0.4 + edgeScore * 0.3 + clusteringScore * 0.3);
        this.stats.qualityScore = this.stats.confidence * Math.min(1, this.metadata.totalPhotos / 3);
       
        if (graphInvariants.nodeCount > 30 && !this.metadata.estimatedSize) {
            this.metadata.estimatedSize = Math.round(35 + (graphInvariants.nodeCount - 30) / 3);
        }
    }
   
    // 🔥 УПРОЩЕННЫЙ toJSON (без трансформаций)
    toJSON() {
        const data = {
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
            _version: '2.2-simplified-no-transformations',
            _savedAt: new Date().toISOString(),
            _simplified: true
        };
       
        if (this.pointTracker) {
            data.pointTracker = this.pointTracker.toJSON();
        }
       
        return data;
    }
   
    static fromJSON(data) {
        console.log(`📂 Загружаю УПРОЩЕННЫЙ отпечаток "${data.name}"`);
       
        const graph = SimpleGraph.fromJSON(data.graph);
       
        let pointTracker = null;
        if (data.pointTracker && PointTracker) {
            try {
                pointTracker = PointTracker.fromJSON(data.pointTracker);
                console.log('   🎯 Загружен PointTracker');
            } catch (error) {
                console.log('⚠️ Ошибка загрузки PointTracker:', error.message);
                pointTracker = new PointTracker({ honestConfirmations: true });
            }
        } else {
            pointTracker = new PointTracker({ honestConfirmations: true });
        }
       
        const footprint = new SimpleFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            graph: graph,
            pointTracker: pointTracker,
            metadata: data.metadata,
            confidence: data.stats?.confidence
        });
       
        if (Array.isArray(data.analysisHistory)) {
            footprint.analysisHistory = data.analysisHistory;
        }
       
        if (Array.isArray(data.photoHistory)) {
            footprint.photoHistory = data.photoHistory;
        }
       
        if (data.stats) {
            footprint.stats = { ...footprint.stats, ...data.stats };
        }
       
        console.log(`✅ Загружен упрощенный отпечаток "${footprint.name}"`);
       
        return footprint;
    }
   
    // 🔥 ПРОСТОЙ МЕТОД ДЛЯ ПОЛУЧЕНИЯ ТОЧЕК
    getPoints() {
        const points = [];
       
        if (this.pointTracker && this.pointTracker.points) {
            for (const [id, point] of this.pointTracker.points) {
                points.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || 0.5,
                    confirmedCount: point.confirmedCount || 1,
                    source: 'point_tracker'
                });
            }
        }
       
        return points;
    }
   
    // 🔥 ПРОСТОЙ МЕТОД ДЛЯ ВИЗУАЛИЗАЦИИ
    visualize() {
        console.log(`\n👣 УПРОЩЕННЫЙ ОТПЕЧАТОК "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Узлов: ${this.graph.nodes.size}`);
        console.log(`├─ Рёбер: ${this.graph.edges.size}`);
        console.log(`├─ Фото: ${this.photoHistory.length}`);
        console.log(`└─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
       
        if (this.pointTracker) {
            const trackerStats = this.pointTracker.getHonestStats();
            console.log(`📊 PointTracker: ${trackerStats.totalPoints} точек`);
            console.log(`   Средний рейтинг: ${trackerStats.avgRating.toFixed(3)}`);
            console.log(`   Уникальных фото: ${trackerStats.uniquePhotos || 0}`);
        }
    }
}

module.exports = SimpleFootprint;
