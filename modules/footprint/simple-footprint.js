// modules/footprint/simple-footprint.js
// 🔥 УПРОЩЕННЫЙ ДЛЯ СОВМЕСТИМОСТИ С АККУМУЛЯТИВНОЙ МОДЕЛЬЮ

const crypto = require('crypto');
const SimpleGraph = require('./simple-graph');
const PointTracker = require('./point-tracker');

class SimpleFootprint {
    constructor(options = {}) {
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;

        // 🔥 УПРОЩЕННЫЙ ГРАФ
        this.graph = options.graph || new SimpleGraph(this.name);
       
        // 🔥 УПРОЩЕННЫЙ ТРЕКЕР (только для совместимости)
        this.pointTracker = options.pointTracker || new PointTracker();

        // Метаданные
        this.metadata = {
            created: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            features: {
                hasGraph: true,
                hasPointTracker: true
            },
            ...(options.metadata || {})
        };

        // Статистика
        this.stats = {
            confidence: options.confidence || 0.5,
            nodeCount: 0,
            edgeCount: 0
        };

        // История
        this.photoHistory = [];
        this.analysisHistory = [];

        console.log(`👣 Создан упрощенный отпечаток "${this.name}"`);
    }

    // 🔥 ДОБАВЛЕНИЕ АНАЛИЗА (упрощенное)
    addAnalysis(analysis, sourceInfo = {}) {
        console.log(`📥 Добавляю анализ в отпечаток "${this.name}"...`);

        const { predictions } = analysis;
        const protectorPoints = this.extractProtectorPoints(predictions);

        if (protectorPoints.length < 3) {
            console.log(`⚠️ Слишком мало протекторов: ${protectorPoints.length}`);
            return { error: 'Not enough protectors', added: 0 };
        }

        console.log(`🔍 Найдено ${protectorPoints.length} протекторов`);

        // 🔥 ОБРАБАТЫВАЕМ ТОЧКИ В ТРЕКЕРЕ (для совместимости)
        const trackerResults = this.pointTracker.processNewPoints(protectorPoints, {
            ...sourceInfo,
            photoId: sourceInfo.photoId || `photo_${Date.now()}`
        });

        // 🔥 СТРОИМ ГРАФ ИЗ ВСЕХ ТОЧЕК ТРЕКЕРА
        const previousNodeCount = this.graph.nodes.size;
        const trackedPoints = [];

        // Получаем точки из трекера
        if (this.pointTracker && this.pointTracker.points) {
            for (const [id, pt] of this.pointTracker.points) {
                trackedPoints.push({
                    id,
                    x: pt.x,
                    y: pt.y,
                    confidence: pt.confidence || 0.5,
                    confirmedCount: pt.confirmedCount || 1
                });
            }
        }

        console.log(`📊 Собрано ${trackedPoints.length} точек из трекера`);

        // Строим граф
        if (trackedPoints.length > 0) {
            const graphPoints = trackedPoints.map(trackedPoint => ({
                id: `n_${trackedPoint.id}`,
                x: trackedPoint.x,
                y: trackedPoint.y,
                confidence: trackedPoint.confidence,
                confirmedCount: trackedPoint.confirmedCount
            }));

            console.log(`🏗️ Строю граф из ${graphPoints.length} точек...`);
            const graphInvariants = this.graph.buildFromPoints(graphPoints);
           
            console.log(`✅ Построен граф: ${this.graph.nodes.size} узлов, ${this.graph.edges.size} рёбер`);
        }

        // Сохраняем в историю
        const analysisRecord = {
            id: `analysis_${Date.now()}`,
            timestamp: new Date(),
            pointsCount: protectorPoints.length,
            trackerResults: trackerResults,
            sourceInfo: sourceInfo
        };

        this.analysisHistory.push(analysisRecord);
        this.photoHistory.push({
            timestamp: new Date(),
            points: protectorPoints.length,
            source: sourceInfo
        });

        // Обновляем метаданные
        this.metadata.totalPhotos++;
        this.metadata.lastUpdated = new Date();

        // Обновляем статистику
        this.updateStats();

        const addedNodes = this.graph.nodes.size - previousNodeCount;

        console.log(`✅ Анализ добавлен: +${addedNodes} узлов в граф, всего узлов: ${this.graph.nodes.size}`);

        return {
            success: true,
            added: addedNodes,
            totalNodes: this.graph.nodes.size,
            confidence: this.stats.confidence,
            trackerResults: trackerResults
        };
    }

    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК ПРОТЕКТОРОВ
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

    // 🔥 ОБНОВЛЕНИЕ СТАТИСТИКИ
    updateStats() {
        this.stats.nodeCount = this.graph.nodes.size;
        this.stats.edgeCount = this.graph.edges.size;

        // Простая уверенность
        const nodeScore = Math.min(1, this.stats.nodeCount / 30);
        const edgeScore = this.stats.edgeCount > 0 ?
            Math.min(1, this.stats.edgeCount / this.stats.nodeCount / 2) : 0;

        this.stats.confidence = (nodeScore * 0.6 + edgeScore * 0.4);
    }

    // 🔥 СЕРИАЛИЗАЦИЯ
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
            _version: 'simple_v1.0',
            _savedAt: new Date().toISOString()
        };

        if (this.pointTracker) {
            data.pointTracker = this.pointTracker.toJSON();
        }

        return data;
    }

    static fromJSON(data) {
        console.log(`📂 Загружаю упрощенный отпечаток "${data.name}"...`);

        const graph = SimpleGraph.fromJSON(data.graph);

        let pointTracker = null;
        if (data.pointTracker && PointTracker) {
            try {
                pointTracker = PointTracker.fromJSON(data.pointTracker);
                console.log('✅ Загружен PointTracker');
            } catch (error) {
                console.log('⚠️ Ошибка загрузки PointTracker:', error.message);
                pointTracker = new PointTracker();
            }
        } else {
            pointTracker = new PointTracker();
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

        console.log(`✅ Загружен отпечаток "${footprint.name}" с ${footprint.graph.nodes.size} узлами`);

        return footprint;
    }

    // 🔥 ПРОСТЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            stats: {
                ...this.stats,
                qualityScore: Math.round(this.stats.confidence * 100)
            },
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toLocaleString('ru-RU'),
                lastUpdated: this.metadata.lastUpdated.toLocaleString('ru-RU')
            },
            graph: {
                nodes: this.graph.nodes.size,
                edges: this.graph.edges.size
            }
        };
    }

    visualize() {
        console.log(`\n👣 УПРОЩЕННЫЙ ОТПЕЧАТОК "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Узлов в графе: ${this.graph.nodes.size}`);
        console.log(`├─ Рёбер в графе: ${this.graph.edges.size}`);
        console.log(`├─ Фото в истории: ${this.photoHistory.length}`);
        console.log(`└─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
    }
}

module.exports = SimpleFootprint;
