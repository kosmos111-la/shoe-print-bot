// modules/footprint/clean/footprint-model.js
// 🎯 ПРОСТАЯ МОДЕЛЬ ОТПЕЧАТКА: ТОЧКИ + ПОДТВЕРЖДЕНИЯ

const crypto = require('crypto');

class CleanFootprint {
    /**
     * Конструктор: создаём отпечаток из точек
     */
    constructor(options = {}) {
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;

        // 🔥 ВАЖНО: Храним ОРИГИНАЛЬНЫЕ точки
        this.originalPoints = options.points || [];

        // Подтверждения: pointId -> {count, lastConfirmed, photoIds}
        this.confirmations = new Map();

        // История фото
        this.photos = [];

        // Статистика
        this.stats = {
            createdAt: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            totalPoints: this.originalPoints.length,
            confirmedPoints: 0,
            avgConfirmations: 0
        };

        console.log(`👣 Создан чистый отпечаток "${this.name}" с ${this.originalPoints.length} точками`);
    }

    /**
     * Получить точки для сравнения (уже нормализованные)
     */
    getComparisonPoints() {
        // Используем простую систему координат
        const SimpleCoordinateSystem = require('./coordinate-system');
       
        const points = this.originalPoints.map((point, index) => ({
            id: point.id || `pt_${index}`,
            x: point.x,
            y: point.y,
            confidence: point.confidence || 0.5
        }));

        return SimpleCoordinateSystem.normalize(points);
    }

    /**
     * Добавить новое фото и обновить подтверждения
     */
    addPhoto(photoPoints, photoId) {
        console.log(`📸 Добавляю фото ${photoId} к отпечатку ${this.id}`);

        // 1. Нормализуем точки фото
        const SimpleCoordinateSystem = require('./coordinate-system');
        const normalizedPhotoPoints = SimpleCoordinateSystem.normalize(photoPoints);

        // 2. Находим совпадения с существующими точками
        const matches = this.findMatches(normalizedPhotoPoints);

        // 3. Обновляем подтверждения
        let newConfirmations = 0;
        matches.forEach(match => {
            const pointId = match.existingPoint.id;
            const current = this.confirmations.get(pointId) || { count: 0, lastConfirmed: null, photoIds: [] };
           
            current.count++;
            current.lastConfirmed = new Date();
            if (!current.photoIds.includes(photoId)) {
                current.photoIds.push(photoId);
            }
           
            this.confirmations.set(pointId, current);
            newConfirmations++;
        });

        // 4. Добавляем новые точки (если есть)
        let newPoints = 0;
        const unmatchedPhotoPoints = normalizedPhotoPoints.filter(photoPoint =>
            !matches.some(match => match.photoPoint.id === photoPoint.id)
        );

        if (unmatchedPhotoPoints.length > 0) {
            console.log(`🆕 Добавляю ${unmatchedPhotoPoints.length} новых точек`);
            unmatchedPhotoPoints.forEach(point => {
                this.originalPoints.push(point);
                this.confirmations.set(point.id, {
                    count: 1,
                    lastConfirmed: new Date(),
                    photoIds: [photoId]
                });
                newPoints++;
            });
        }

        // 5. Обновляем статистику
        this.photos.push({
            id: photoId,
            timestamp: new Date(),
            points: normalizedPhotoPoints.length,
            matches: matches.length,
            newPoints: newPoints
        });

        this.updateStats();

        console.log(`✅ Фото добавлено: ${matches.length} совпадений, ${newPoints} новых точек, всего точек: ${this.originalPoints.length}`);

        return {
            matches: matches.length,
            newPoints: newPoints,
            totalPoints: this.originalPoints.length,
            newConfirmations: newConfirmations
        };
    }

    /**
     * Найти совпадения между точками фото и точками отпечатка
     */
    findMatches(photoPoints) {
        const matches = [];
        const threshold = 25; // Пикселей

        // Простой алгоритм: ближайший сосед
        photoPoints.forEach(photoPoint => {
            let bestMatch = null;
            let minDistance = Infinity;

            this.originalPoints.forEach(existingPoint => {
                const distance = Math.sqrt(
                    Math.pow(existingPoint.x - photoPoint.x, 2) +
                    Math.pow(existingPoint.y - photoPoint.y, 2)
                );

                if (distance < minDistance && distance < threshold) {
                    minDistance = distance;
                    bestMatch = {
                        photoPoint,
                        existingPoint,
                        distance
                    };
                }
            });

            if (bestMatch) {
                matches.push(bestMatch);
            }
        });

        return matches;
    }

    /**
     * Обновить статистику
     */
    updateStats() {
        let totalConfirmations = 0;
        let confirmedPoints = 0;

        for (const [pointId, confirmation] of this.confirmations) {
            totalConfirmations += confirmation.count;
            if (confirmation.count > 0) {
                confirmedPoints++;
            }
        }

        this.stats.totalPoints = this.originalPoints.length;
        this.stats.confirmedPoints = confirmedPoints;
        this.stats.avgConfirmations = this.originalPoints.length > 0 ?
            (totalConfirmations / this.originalPoints.length) : 0;
        this.stats.lastUpdated = new Date();
        this.stats.totalPhotos = this.photos.length;
    }

    /**
     * Получить информацию об отпечатке
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            stats: {
                ...this.stats,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU')
            },
            photos: this.photos.length,
            points: this.originalPoints.length,
            confirmations: Array.from(this.confirmations.entries()).length
        };
    }

    /**
     * Экспорт для сохранения
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            originalPoints: this.originalPoints,
            confirmations: Array.from(this.confirmations.entries()),
            photos: this.photos,
            stats: this.stats,
            _version: 'clean_v1',
            _savedAt: new Date().toISOString()
        };
    }

    /**
     * Импорт из сохранённых данных
     */
    static fromJSON(data) {
        const footprint = new CleanFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            points: data.originalPoints || []
        });

        if (data.confirmations) {
            data.confirmations.forEach(([pointId, confirmation]) => {
                footprint.confirmations.set(pointId, confirmation);
            });
        }

        if (data.photos) {
            footprint.photos = data.photos;
        }

        if (data.stats) {
            footprint.stats = { ...footprint.stats, ...data.stats };
            if (data.stats.createdAt && typeof data.stats.createdAt === 'string') {
                footprint.stats.createdAt = new Date(data.stats.createdAt);
            }
        }

        footprint.updateStats();
        console.log(`📂 Загружен чистый отпечаток "${footprint.name}" с ${footprint.originalPoints.length} точками`);

        return footprint;
    }
}

module.exports = CleanFootprint;
