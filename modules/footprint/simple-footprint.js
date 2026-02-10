// modules/footprint/simple-footprint.js (ИСПРАВЛЕННАЯ ВЕРСИЯ)

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
       
        this.graph = options.graph || new SimpleGraph(this.name);
        this.photoCollections = new Map();
       
        this.pointTracker = options.pointTracker || new PointTracker({
            debug: false,
            maxConfirmations: 10
        });
       
        this.metadata = {
            created: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            footprintType: options.footprintType || 'unknown',
            features: {
                hasGraph: true,
                hasPointTracker: true,
                hasPhotoCollections: true,
                photoOriented: true
            },
            ...(options.metadata || {})
        };
       
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
   
    // 🔥 ИСПРАВЛЕНИЕ: Добавлена проверка типа predictions
    addPhotoAnalysis(photoId, analysis, sourceInfo = {}) {
        console.log(`📸 Добавление фото ${photoId} в отпечаток "${this.name}"`);
       
        if (!analysis) {
            console.log(`❌ Нет данных анализа для фото ${photoId}`);
            return {
                success: false,
                error: 'No analysis data',
                points: 0,
                photoId
            };
        }
       
        const points = this.extractProtectorPoints(analysis);
       
        if (points.length < 3) {
            console.log(`⚠️ Слишком мало протекторов: ${points.length}`);
            return {
                success: false,
                error: 'Not enough protectors',
                points: points.length,
                photoId
            };
        }
       
        // Строим граф Делоне для ЭТОГО ФОТО
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
       
        // Для совместимости
        if (this.pointTracker && points.length > 0) {
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
   
    buildPhotoGraph(points, photoId) {
        console.log(`🔨 Строю граф для фото ${photoId} из ${points.length} точек...`);
       
        const tempGraph = new SimpleGraph(`photo_${photoId}`);
       
        const graphPoints = points.map((p, idx) => ({
            id: `${photoId}_pt_${idx}`,
            x: p.x,
            y: p.y,
            confidence: p.confidence || 0.5,
            originalPoints: p.originalPoints
        }));
       
        tempGraph.buildFromPoints(graphPoints.map(p => ({
            x: p.x,
            y: p.y,
            confidence: p.confidence,
            id: p.id
        })));
       
        console.log(`✅ Граф фото ${photoId}: ${tempGraph.nodes.size} узлов, ${tempGraph.edges.size} рёбер`);
       
        return tempGraph;
    }
   
    // 🔥 ИСПРАВЛЕНИЕ: Добавлена проверка типа и логирование
    extractProtectorPoints(analysis) {
        console.log(`🔍 Извлечение точек из анализа...`);
       
        let predictions = [];
       
        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Проверяем разные форматы данных
        if (Array.isArray(analysis.predictions)) {
            predictions = analysis.predictions;
            console.log(`📊 Найден массив predictions: ${predictions.length} элементов`);
        } else if (analysis.predictions && typeof analysis.predictions === 'object') {
            // Может быть объект с массивом внутри
            if (Array.isArray(analysis.predictions.predictions)) {
                predictions = analysis.predictions.predictions;
                console.log(`📊 Найден predictions.predictions: ${predictions.length} элементов`);
            } else if (analysis.predictions.data && Array.isArray(analysis.predictions.data)) {
                predictions = analysis.predictions.data;
                console.log(`📊 Найден predictions.data: ${predictions.length} элементов`);
            } else {
                // Пытаемся преобразовать объект в массив
                predictions = Object.values(analysis.predictions);
                console.log(`📊 Преобразован объект в массив: ${predictions.length} элементов`);
            }
        } else {
            console.log(`❌ Неизвестный формат predictions:`, typeof analysis.predictions);
            return [];
        }
       
        const points = [];
        let protectorCount = 0;
        let otherCount = 0;
       
        console.log(`🔍 Обрабатываю ${predictions.length} предсказаний...`);
       
        for (let i = 0; i < predictions.length; i++) {
            const pred = predictions[i];
           
            // 🔥 ДИАГНОСТИКА: Логируем первые несколько предсказаний
            if (i < 3 && this.metadata.totalPhotos === 0) {
                console.log(`   Предсказание ${i}: class="${pred.class}", confidence=${pred.confidence}`);
            }
           
            if (!pred || typeof pred !== 'object') {
                console.log(`⚠️ Предсказание ${i} не является объектом:`, typeof pred);
                continue;
            }
           
            // Проверяем класс протектора
            const isProtector = pred.class === 'shoe-protector' ||
                               (pred.class && pred.class.toLowerCase().includes('protector'));
           
            if (isProtector && pred.points && Array.isArray(pred.points) && pred.points.length > 0) {
                const center = this.calculateCenter(pred.points);
                points.push({
                    x: center.x,
                    y: center.y,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points,
                    class: pred.class,
                    originalIndex: i
                });
                protectorCount++;
            } else if (pred.points && Array.isArray(pred.points) && pred.points.length > 0) {
                // 🔥 ДОБАВЛЕНО: Если не протектор, но есть точки - тоже учитываем
                const center = this.calculateCenter(pred.points);
                points.push({
                    x: center.x,
                    y: center.y,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points,
                    class: pred.class || 'unknown',
                    originalIndex: i,
                    note: 'not_protector'
                });
                otherCount++;
            }
        }
       
        console.log(`✅ Извлечено точек: ${points.length} (протекторы: ${protectorCount}, другие: ${otherCount})`);
       
        // Если не нашли протекторов, но нашли другие точки
        if (protectorCount === 0 && points.length > 0) {
            console.log(`⚠️ Не найдено протекторов, но найдено ${points.length} других точек`);
            console.log(`   Использую все точки с confidence > 0.3`);
           
            // Фильтруем по confidence
            return points.filter(p => (p.confidence || 0) > 0.3);
        }
       
        return points;
    }
   
    calculateCenter(points) {
        if (!points || !Array.isArray(points) || points.length === 0) {
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
   
    // 🔥 СТАРЫЙ МЕТОД для совместимости
    addAnalysisHonest(analysis, sourceInfo = {}) {
        console.log(`⚠️ [DEPRECATED] addAnalysisHonest() - используйте addPhotoAnalysis()`);
       
        const photoId = sourceInfo.photoId || `photo_${Date.now()}`;
       
        const result = this.addPhotoAnalysis(photoId, analysis, sourceInfo);
       
        return {
            success: result.success,
            added: result.points || 0,
            totalNodes: this.graph.nodes.size,
            confidence: this.stats.confidence,
            warning: 'Используйте addPhotoAnalysis() для топологического сравнения'
        };
    }
   
    // Другие методы остаются без изменений...
    getPhotoPoints(photoId) {
        const photoData = this.photoCollections.get(photoId);
        if (!photoData) {
            console.log(`⚠️ Данные фото ${photoId} не найдены`);
            return [];
        }
       
        return photoData.points;
    }
   
    getPhotoGraph(photoId) {
        const photoData = this.photoCollections.get(photoId);
        if (!photoData) {
            console.log(`⚠️ Граф фото ${photoId} не найден`);
            return null;
        }
       
        return photoData.graph;
    }
   
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
            photoCollections: photoCollectionsData,
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toISOString(),
                lastUpdated: this.metadata.lastUpdated.toISOString()
            },
            stats: this.stats,
            analysisHistory: this.analysisHistory,
            photoHistory: this.photoHistory,
            _version: '2.3-photo-oriented-fixed',
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
       
        if (data.photoCollections && typeof data.photoCollections === 'object') {
            Object.entries(data.photoCollections).forEach(([photoId, photoData]) => {
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
       
        footprint.updateStats();
       
        console.log(`✅ Загружен фото-ориентированный отпечаток "${footprint.name}"`);
        console.log(`   📊 Фото: ${footprint.photoCollections.size}, Точек: ${footprint.stats.totalPointsAcrossPhotos}`);
       
        return footprint;
    }
   
    visualize() {
        console.log(`\n👣 ФОТО-ОРИЕНТИРОВАННЫЙ ОТПЕЧАТОК "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Фото: ${this.photoCollections.size}`);
        console.log(`├─ Всего точек: ${this.stats.totalPointsAcrossPhotos}`);
        console.log(`├─ Среднее точек на фото: ${this.stats.avgPointsPerPhoto.toFixed(1)}`);
        console.log(`├─ Общий граф: ${this.graph.nodes.size} узлов`);
        console.log(`└─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
       
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
