// modules/footprint/simple-footprint.js (ФОТО-ОРИЕНТИРОВАННАЯ ВЕРСИЯ)
// 🔥 ХРАНИМ ТОЧКИ ПО ОТДЕЛЬНОСТИ ДЛЯ КАЖДОГО ФОТО

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
       
        // 🔥 ИЗМЕНЕНИЕ 1: Граф для визуализации (не для сравнения)
        this.graph = options.graph || new SimpleGraph(this.name);
       
        // 🔥 ИЗМЕНЕНИЕ 2: ХРАНЕНИЕ ТОЧЕК ПО ФОТО
        this.photoCollections = new Map(); // photoId -> {points, graph, fingerprints, metadata}
       
        // 🔥 ИЗМЕНЕНИЕ 3: PointTracker ТОЛЬКО для совместимости
        this.pointTracker = options.pointTracker || new PointTracker({
            debug: false,
            maxConfirmations: 10
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
                hasPhotoCollections: true, // 🔥 НОВОЕ
                photoOriented: true // 🔥 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ
            },
            ...(options.metadata || {})
        };
       
        // Статистика
        this.stats = {
            confidence: options.confidence || 0.5,
            photoCount: 0,
            totalPointsAcrossPhotos: 0,
            avgPointsPerPhoto: 0
        };
       
        this.photoHistory = [];
        this.analysisHistory = [];
       
        console.log(`👣 Создан ФОТО-ОРИЕНТИРОВАННЫЙ цифровой отпечаток "${this.name}"`);
    }
   
    // 🔥 НОВЫЙ МЕТОД: Добавление фото с отдельным хранением
    addPhotoAnalysis(photoId, analysis, sourceInfo = {}) {
        console.log(`📸 Добавление фото ${photoId} в отпечаток "${this.name}"`);
       
        const points = this.extractProtectorPoints(analysis);
       
        if (points.length < 3) {
            console.log(`⚠️ Слишком мало протекторов: ${points.length}`);
            return {
                success: false,
                error: 'Not enough protectors',
                points: 0,
                photoId
            };
        }
       
        // 🔥 ИЗМЕНЕНИЕ 4: Строим граф Делоне для ЭТОГО ФОТО
        const photoGraph = this.buildPhotoGraph(points, photoId);
       
        // Сохраняем данные фото
        const photoData = {
            id: photoId,
            points: points,
            graph: photoGraph,
            analysis: analysis,
            sourceInfo: sourceInfo,
            timestamp: new Date(),
            stats: {
                points: points.length,
                nodes: photoGraph.nodes ? photoGraph.nodes.size : 0,
                edges: photoGraph.edges ? photoGraph.edges.size : 0
            }
        };
       
        this.photoCollections.set(photoId, photoData);
       
        // 🔥 ИЗМЕНЕНИЕ 5: НЕ добавляем точки в общий PointTracker
        // Только для диагностики сохраняем минимум данных
        if (this.pointTracker) {
            // Добавляем первую точку как маркер фото (для совместимости)
            if (points.length > 0) {
                const markerPoint = points[0];
                this.pointTracker.processNewPoints([{
                    x: markerPoint.x,
                    y: markerPoint.y,
                    confidence: markerPoint.confidence || 0.5,
                    photoId: photoId
                }], {
                    ...sourceInfo,
                    photoId
                });
            }
        }
       
        // Сохраняем в историю
        this.analysisHistory.push({
            id: `analysis_${photoId}_${Date.now()}`,
            timestamp: new Date(),
            photoId: photoId,
            pointsCount: points.length,
            sourceInfo: sourceInfo
        });
       
        this.photoHistory.push({
            timestamp: new Date(),
            photoId: photoId,
            points: points.length,
            source: sourceInfo
        });
       
        // Обновляем метаданные
        this.metadata.totalPhotos++;
        this.metadata.lastUpdated = new Date();
       
        // Обновляем статистику
        this.updateStats();
       
        console.log(`✅ Фото ${photoId} сохранено отдельно: ${points.length} точек`);
       
        return {
            success: true,
            photoId: photoId,
            points: points.length,
            totalPhotos: this.metadata.totalPhotos,
            note: 'Точки сохранены отдельно для топологического сравнения'
        };
    }
   
    // 🔥 НОВЫЙ МЕТОД: Построение графа для одного фото
    buildPhotoGraph(points, photoId) {
        console.log(`🔨 Строю граф для фото ${photoId} из ${points.length} точек...`);
       
        // Создаем временный граф для этого фото
        const tempGraph = new SimpleGraph(`photo_${photoId}`);
       
        const graphPoints = points.map((p, idx) => ({
            id: `${photoId}_pt_${idx}`,
            x: p.x,
            y: p.y,
            confidence: p.confidence || 0.5,
            originalPoints: p.originalPoints
        }));
       
        const invariants = tempGraph.buildFromPoints(graphPoints.map(p => ({
            x: p.x,
            y: p.y,
            confidence: p.confidence,
            id: p.id
        })));
       
        console.log(`✅ Граф фото ${photoId}: ${tempGraph.nodes.size} узлов, ${tempGraph.edges.size} рёбер`);
       
        return tempGraph;
    }
   
    // 🔥 СТАРЫЙ МЕТОД для совместимости (помечен как deprecated)
    addAnalysisHonest(analysis, sourceInfo = {}) {
        console.log(`⚠️ [DEPRECATED] addAnalysisHonest() - используйте addPhotoAnalysis()`);
        console.log(`⚠️ Этот метод аккумулирует точки - может нарушить топологическое сравнение`);
       
        const photoId = sourceInfo.photoId || `photo_${Date.now()}`;
       
        // 🔥 Используем новый метод, но с предупреждением
        const result = this.addPhotoAnalysis(photoId, analysis, sourceInfo);
       
        // Для совместимости возвращаем старый формат
        return {
            success: result.success,
            added: result.points || 0,
            totalNodes: this.graph.nodes.size,
            confidence: this.stats.confidence,
            warning: 'Используйте addPhotoAnalysis() для топологического сравнения'
        };
    }
   
    // 🔥 НОВЫЙ МЕТОД: Получить точки конкретного фото
    getPhotoPoints(photoId) {
        const photoData = this.photoCollections.get(photoId);
        if (!photoData) {
            console.log(`⚠️ Данные фото ${photoId} не найдены`);
            return [];
        }
       
        return photoData.points;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Получить граф конкретного фото
    getPhotoGraph(photoId) {
        const photoData = this.photoCollections.get(photoId);
        if (!photoData) {
            console.log(`⚠️ Граф фото ${photoId} не найден`);
            return null;
        }
       
        return photoData.graph;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Получить все фото
    getAllPhotos() {
        const photos = [];
       
        for (const [photoId, photoData] of this.photoCollections) {
            photos.push({
                id: photoId,
                points: photoData.points.length,
                timestamp: photoData.timestamp,
                source: photoData.sourceInfo
            });
        }
       
        return photos;
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
                        originalPoints: pred.points,
                        class: pred.class,
                        originalIndex: index
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
                        originalPoints: protector.points,
                        class: protector.class
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
   
    updateStats() {
        let totalPoints = 0;
       
        for (const [photoId, photoData] of this.photoCollections) {
            totalPoints += photoData.points.length;
        }
       
        this.stats.photoCount = this.photoCollections.size;
        this.stats.totalPointsAcrossPhotos = totalPoints;
        this.stats.avgPointsPerPhoto = this.photoCollections.size > 0 ?
            totalPoints / this.photoCollections.size : 0;
           
        this.stats.confidence = Math.min(1, this.photoCollections.size / 5 * 0.3 +
            Math.min(1, totalPoints / 100) * 0.7);
    }
   
    // 🔥 УПРОЩЕННЫЙ toJSON (с поддержкой фото-коллекций)
    toJSON() {
        const photoCollectionsData = {};
       
        for (const [photoId, photoData] of this.photoCollections) {
            photoCollectionsData[photoId] = {
                id: photoData.id,
                points: photoData.points,
                timestamp: photoData.timestamp.toISOString(),
                sourceInfo: photoData.sourceInfo,
                stats: photoData.stats
            };
        }
       
        const data = {
            id: this.id,
            name: this.name,
            userId: this.userId,
            graph: this.graph.toJSON(),
            photoCollections: photoCollectionsData, // 🔥 НОВОЕ
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toISOString(),
                lastUpdated: this.metadata.lastUpdated.toISOString()
            },
            stats: this.stats,
            analysisHistory: this.analysisHistory,
            photoHistory: this.photoHistory,
            _version: '2.3-photo-oriented',
            _photoCount: this.photoCollections.size,
            _savedAt: new Date().toISOString()
        };
       
        if (this.pointTracker) {
            data.pointTracker = this.pointTracker.toJSON();
        }
       
        return data;
    }
   
    static fromJSON(data) {
        console.log(`📂 Загружаю ФОТО-ОРИЕНТИРОВАННЫЙ отпечаток "${data.name}"`);
       
        const graph = SimpleGraph.fromJSON(data.graph);
       
        let pointTracker = null;
        if (data.pointTracker && PointTracker) {
            try {
                pointTracker = PointTracker.fromJSON(data.pointTracker);
                console.log('   🎯 Загружен PointTracker (для совместимости)');
            } catch (error) {
                console.log('⚠️ Ошибка загрузки PointTracker:', error.message);
                pointTracker = new PointTracker({ debug: false });
            }
        } else {
            pointTracker = new PointTracker({ debug: false });
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
       
        // 🔥 ВОССТАНАВЛИВАЕМ ФОТО-КОЛЛЕКЦИИ
        if (data.photoCollections && typeof data.photoCollections === 'object') {
            Object.entries(data.photoCollections).forEach(([photoId, photoData]) => {
                // Восстанавливаем дату
                if (photoData.timestamp && typeof photoData.timestamp === 'string') {
                    photoData.timestamp = new Date(photoData.timestamp);
                }
               
                footprint.photoCollections.set(photoId, {
                    ...photoData,
                    id: photoId
                });
            });
            console.log(`   📸 Загружено ${Object.keys(data.photoCollections).length} фото-коллекций`);
        }
       
        if (Array.isArray(data.analysisHistory)) {
            footprint.analysisHistory = data.analysisHistory;
        }
       
        if (Array.isArray(data.photoHistory)) {
            footprint.photoHistory = data.photoHistory;
        }
       
        if (data.stats) {
            footprint.stats = { ...footprint.stats, ...data.stats };
        }
       
        // Обновляем статистику
        footprint.updateStats();
       
        console.log(`✅ Загружен фото-ориентированный отпечаток "${footprint.name}"`);
        console.log(`   📊 Фото: ${footprint.photoCollections.size}, Точек: ${footprint.stats.totalPointsAcrossPhotos}`);
       
        return footprint;
    }
   
    // 🔥 ПРОСТОЙ МЕТОД ДЛЯ ВИЗУАЛИЗАЦИИ
    visualize() {
        console.log(`\n👣 ФОТО-ОРИЕНТИРОВАННЫЙ ОТПЕЧАТОК "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Фото: ${this.photoCollections.size}`);
        console.log(`├─ Всего точек: ${this.stats.totalPointsAcrossPhotos}`);
        console.log(`├─ Среднее точек на фото: ${this.stats.avgPointsPerPhoto.toFixed(1)}`);
        console.log(`├─ Общий граф: ${this.graph.nodes.size} узлов`);
        console.log(`└─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
       
        // Показываем информацию по фото
        if (this.photoCollections.size > 0) {
            console.log(`\n📸 ФОТО В КОЛЛЕКЦИИ:`);
            let count = 0;
            for (const [photoId, photoData] of this.photoCollections) {
                if (count++ >= 3) {
                    console.log(`   ... и еще ${this.photoCollections.size - 3} фото`);
                    break;
                }
                console.log(`   ${photoId}: ${photoData.points.length} точек`);
            }
        }
    }
}

module.exports = SimpleFootprint;
