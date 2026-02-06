// modules/footprint/clean/manager.js - ОБНОВЛЕННЫЙ
// 🎯 МЕНЕДЖЕР С ГИБРИДНЫМ АЛГОРИТМОМ

const fs = require('fs');
const path = require('path');

class CleanFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints/clean',
            similarityThreshold: options.similarityThreshold || 0.6,
            minPoints: options.minPoints || 20, // 🔥 Увеличили для топологии
            debug: options.debug || true
        };

        // Загружаем модули
        this.CleanFootprint = require('./footprint-model');
        this.SimpleCoordinateSystem = require('./coordinate-system');

        // 🔥 ЗАГРУЗИМ ГИБРИДНЫЙ АЛГОРИТМ
        try {
            this.HybridAlgorithm = require('./hybrid-algorithm');
            console.log('✅ Гибридный алгоритм загружен');
        } catch (error) {
            console.log('⚠️ Гибридный алгоритм не найден');
            this.HybridAlgorithm = null;
        }

        // Хранилище
        this.footprints = new Map();
        this.users = new Map();

        // Статистика
        this.stats = {
            totalUsers: 0,
            totalFootprints: 0,
            totalComparisons: 0,
            successfulComparisons: 0,
            createdAt: new Date()
        };

        this.ensureDirectories();
        this.loadExistingData();

        console.log('🚀 Чистый менеджер отпечатков создан');
        console.log(`   • Порог схожести: ${this.config.similarityThreshold * 100}%`);
        console.log(`   • Минимально точек: ${this.config.minPoints}`);
        console.log(`   • Гибридный алгоритм: ${this.HybridAlgorithm ? '✅' : '❌'}`);
    }

    /**
     * ОСНОВНОЙ МЕТОД: Добавить фото для пользователя
     */
    async addPhoto(userId, points, photoInfo = {}) {
        console.log(`\n📸 Добавляю фото для пользователя ${userId}`);

        try {
            // Валидация точек
            if (!points || points.length < this.config.minPoints) {
                return {
                    success: false,
                    error: `Слишком мало точек: ${points?.length || 0} (минимум ${this.config.minPoints})`
                };
            }

            // Подготавливаем точки
            const preparedPoints = this.preparePoints(points, photoInfo);
            console.log(`📊 Подготовлено ${preparedPoints.length} точек`);

            // Проверяем, есть ли уже отпечаток у пользователя
            let footprint = this.footprints.get(userId);
            const photoId = photoInfo.id || `photo_${Date.now()}`;

            if (!footprint) {
                // Первое фото - создаём новый отпечаток
                return this.createNewFootprint(userId, preparedPoints, photoId);
            } else {
                // Последующие фото - сравниваем
                return await this.compareAndUpdate(footprint, preparedPoints, photoId);
            }

        } catch (error) {
            console.error(`❌ Ошибка добавления фото: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Подготовить точки для обработки
     */
    preparePoints(points, photoInfo) {
        return points.map((point, index) => {
            // 🔥 КЛЮЧЕВОЕ: Убедимся, что у точек есть оригинальные ID
            // В реальных данных от Робофло их может не быть
            let originalId;
           
            if (point.originalId) {
                originalId = point.originalId;
            } else if (point.id) {
                originalId = point.id;
            } else if (point.detection_id) {
                originalId = point.detection_id;
            } else {
                // Генерируем уникальный ID на основе координат и фото
                originalId = `pt_${photoInfo.id || 'photo'}_${point.x}_${point.y}`;
            }
           
            return {
                id: point.id || `photo_pt_${Date.now()}_${index}`,
                originalId: originalId,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                source: photoInfo.source || 'robokit'
            };
        });
    }

    /**
     * Создать новый отпечаток
     */
    createNewFootprint(userId, points, photoId) {
        console.log(`👣 Первое фото - создаю новый отпечаток`);
       
        const footprint = new this.CleanFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
            points: points
        });

        // Устанавливаем подтверждения для первой точки
        points.forEach(point => {
            footprint.confirmations.set(point.id, {
                count: 1,
                lastConfirmed: new Date(),
                photoIds: [photoId]
            });
        });

        this.footprints.set(userId, footprint);
        this.stats.totalFootprints++;

        console.log(`✅ Создан новый отпечаток с ${points.length} точками`);

        return {
            success: true,
            isNew: true,
            pointsAdded: points.length,
            footprintId: footprint.id,
            message: 'Создан новый отпечаток'
        };
    }

    /**
     * Сравнить и обновить отпечаток
     */
    async compareAndUpdate(footprint, photoPoints, photoId) {
        console.log(`🔍 Проверяю совпадение с существующим отпечатком...`);

        const comparison = await this.compareFootprints(
            footprint,
            { points: photoPoints }
        );

        console.log(`📊 Результат сравнения: ${comparison.similarity.toFixed(3)} (порог: ${this.config.similarityThreshold})`);

        if (comparison.similarity >= this.config.similarityThreshold) {
            // СОВПАДЕНИЕ - обновляем подтверждения
            const result = footprint.addPhoto(photoPoints, photoId);

            // Сохраняем
            this.saveFootprint(footprint.userId);

            console.log(`✅ Фото совпало! Добавлено подтверждений: ${result.matches}`);

            return {
                success: true,
                isNew: false,
                similarity: comparison.similarity,
                matches: result.matches,
                newPoints: result.newPoints,
                message: `След совпал (${(comparison.similarity * 100).toFixed(1)}%)`
            };

        } else {
            // НЕ СОВПАЛО - создаём новый отпечаток
            console.log(`🆕 След не совпал - создаю новый отпечаток`);

            const newFootprint = new this.CleanFootprint({
                userId: footprint.userId,
                name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`,
                points: photoPoints
            });

            // Заменяем старый отпечаток
            this.footprints.set(footprint.userId, newFootprint);

            // Сохраняем старый отпечаток в архив
            this.archiveFootprint(footprint);

            console.log(`✅ Создан новый отпечаток (старый сохранён в архив)`);

            return {
                success: true,
                isNew: true,
                similarity: comparison.similarity,
                pointsAdded: photoPoints.length,
                message: 'Создан новый отпечаток (следы разные)'
            };
        }
    }

    /**
     * Сравнить два отпечатка (используем гибридный алгоритм)
     */
    async compareFootprints(footprint1, footprint2) {
        this.stats.totalComparisons++;

        try {
            // Получаем точки для сравнения
            const points1 = footprint1.getComparisonPoints();
            const points2 = footprint2.getComparisonPoints
                ? footprint2.getComparisonPoints()
                : this.SimpleCoordinateSystem.normalize(footprint2.points || []);

            if (points1.length === 0 || points2.length === 0) {
                console.log('⚠️ Нет точек для сравнения');
                return {
                    similarity: 0,
                    decision: 'different',
                    reason: 'Нет точек'
                };
            }

            let similarity;
            let method;
            let result;

            // 🔥 ИСПОЛЬЗУЕМ ГИБРИДНЫЙ АЛГОРИТМ
            if (this.HybridAlgorithm) {
                const hybridAlgo = new this.HybridAlgorithm({
                    debug: this.config.debug,
                    minPoints: 20,
                    similarityThreshold: this.config.similarityThreshold,
                    fixedNeighbors: [-3, -2, -1, 1, 2, 3]
                });

                // Создаём гибридные отпечатки
                const fp1 = hybridAlgo.createFootprint(points1, 'fp1');
                const fp2 = hybridAlgo.createFootprint(points2, 'fp2');

                // Сравниваем
                result = hybridAlgo.compareFootprints(fp1, fp2);
                similarity = result.similarity;
                method = 'hybrid';

                console.log(`🎯 Гибридный алгоритм: ${(similarity * 100).toFixed(1)}% схожести`);

            } else {
                // Фаллбэк: простое сравнение по центрам
                similarity = this.fallbackComparison(points1, points2);
                method = 'simple_center_distance';
            }

            // Принимаем решение
            let decision, reason;
            if (similarity >= this.config.similarityThreshold) {
                decision = 'same';
                reason = `Схожесть ${(similarity * 100).toFixed(1)}% ≥ ${this.config.similarityThreshold * 100}%`;
                this.stats.successfulComparisons++;
            } else {
                decision = 'different';
                reason = `Схожесть ${(similarity * 100).toFixed(1)}% < ${this.config.similarityThreshold * 100}%`;
            }

            console.log(`🎯 Решение: ${decision} (${reason})`);

            return {
                similarity: similarity,
                decision: decision,
                reason: reason,
                method: method,
                points1: points1.length,
                points2: points2.length,
                matches: result?.matches || [],
                stats: result?.stats || {}
            };

        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            return {
                similarity: 0,
                decision: 'different',
                reason: `Ошибка: ${error.message}`,
                method: 'error'
            };
        }
    }

    /**
     * Простое сравнение по центрам (фаллбэк)
     */
    fallbackComparison(points1, points2) {
        const center1 = this.SimpleCoordinateSystem.calculateCenter(points1);
        const center2 = this.SimpleCoordinateSystem.calculateCenter(points2);

        const distance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );

        // Преобразуем расстояние в схожесть
        const maxDistance = 100;
        const similarity = Math.max(0, 1 - (distance / maxDistance));

        console.log(`📏 Простое сравнение: расстояние ${distance.toFixed(1)}px, схожесть ${similarity.toFixed(3)}`);

        return similarity;
    }

    // Остальные методы менеджера остаются без изменений...
    // saveFootprint, archiveFootprint, loadExistingData, ensureDirectories,
    // getStats, getFootprint, clearUserData

    saveFootprint(userId) {
        const footprint = this.footprints.get(userId);
        if (!footprint) return false;

        const userDir = path.join(this.config.dbPath, 'users', userId.toString());
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        const filePath = path.join(userDir, `footprint_${footprint.id}.json`);
        const data = footprint.toJSON();

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        console.log(`💾 Отпечаток сохранён: ${filePath}`);
        return true;
    }

    archiveFootprint(footprint) {
        const archiveDir = path.join(this.config.dbPath, 'archive');
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }

        const filePath = path.join(archiveDir, `footprint_${footprint.id}_${Date.now()}.json`);
        const data = footprint.toJSON();

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        console.log(`📦 Отпечаток заархивирован: ${filePath}`);
        return true;
    }

    loadExistingData() {
        const usersDir = path.join(this.config.dbPath, 'users');
        if (!fs.existsSync(usersDir)) {
            fs.mkdirSync(usersDir, { recursive: true });
            return;
        }

        const userDirs = fs.readdirSync(usersDir);
        let loadedCount = 0;

        userDirs.forEach(userId => {
            const userDir = path.join(usersDir, userId);
            if (!fs.statSync(userDir).isDirectory()) return;

            const files = fs.readdirSync(userDir)
                .filter(f => f.endsWith('.json'))
                .sort((a, b) => fs.statSync(path.join(userDir, b)).mtimeMs -
                               fs.statSync(path.join(userDir, a)).mtimeMs);

            if (files.length > 0) {
                const latestFile = files[0];
                const filePath = path.join(userDir, latestFile);

                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const footprint = this.CleanFootprint.fromJSON(data);

                    this.footprints.set(userId, footprint);
                    this.users.set(userId, { loadedFrom: latestFile });
                    loadedCount++;

                    console.log(`📂 Загружен отпечаток пользователя ${userId}: ${footprint.originalPoints.length} точек`);
                } catch (error) {
                    console.log(`⚠️ Ошибка загрузки ${filePath}: ${error.message}`);
                }
            }
        });

        this.stats.totalUsers = loadedCount;
        this.stats.totalFootprints = loadedCount;

        console.log(`📂 Загружено ${loadedCount} отпечатков`);
    }

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'users'),
            path.join(this.config.dbPath, 'archive'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'reports')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Создана директория: ${dir}`);
            }
        });
    }

    getStats() {
        const footprintsInfo = [];
        for (const [userId, footprint] of this.footprints) {
            footprintsInfo.push({
                userId,
                points: footprint.originalPoints.length,
                photos: footprint.photos.length,
                avgConfirmations: footprint.stats.avgConfirmations.toFixed(2)
            });
        }

        return {
            ...this.stats,
            activeUsers: this.footprints.size,
            footprintsInfo: footprintsInfo,
            uptime: new Date() - this.stats.createdAt,
            config: {
                similarityThreshold: this.config.similarityThreshold,
                minPoints: this.config.minPoints
            }
        };
    }

    getFootprint(userId) {
        return this.footprints.get(userId);
    }

    clearUserData(userId) {
        if (this.footprints.has(userId)) {
            this.footprints.delete(userId);

            const userDir = path.join(this.config.dbPath, 'users', userId.toString());
            if (fs.existsSync(userDir)) {
                fs.rmSync(userDir, { recursive: true });
                console.log(`🧹 Очищены данные пользователя ${userId}`);
            }

            return true;
        }
        return false;
    }
}

module.exports = CleanFootprintManager;
