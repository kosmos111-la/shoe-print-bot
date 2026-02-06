// modules/footprint/clean/manager.js
// 🎯 ПРОСТОЙ МЕНЕДЖЕР: СОХРАНЕНИЕ, СРАВНЕНИЕ, ВИЗУАЛИЗАЦИЯ

const fs = require('fs');
const path = require('path');

class CleanFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints/clean',
            similarityThreshold: options.similarityThreshold || 0.6, // 60%
            minPoints: options.minPoints || 5,
            debug: options.debug || true
        };

        // Загружаем модули
        this.CleanFootprint = require('./footprint-model');
        this.SimpleCoordinateSystem = require('./coordinate-system');
       
        // 🔥 ЗАГРУЗИМ ТВОЙ АЛГОРИТМ (после того как создашь файл)
        try {
            this.GeometricAlgorithm = require('./geometric-hash-algorithm');
            console.log('✅ Геометрический алгоритм загружен');
        } catch (error) {
            console.log('⚠️ Геометрический алгоритм не найден, используем простой');
            this.GeometricAlgorithm = null;
        }

        // Хранилище
        this.footprints = new Map(); // userId -> CleanFootprint
        this.users = new Map();      // userId -> { info }

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
        console.log(`   • Геометрический алгоритм: ${this.GeometricAlgorithm ? '✅' : '❌'}`);
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
            const preparedPoints = points.map((point, index) => ({
                id: point.id || `photo_pt_${Date.now()}_${index}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                source: photoInfo.source || 'unknown'
            }));

            console.log(`📊 Подготовлено ${preparedPoints.length} точек`);

            // Проверяем, есть ли уже отпечаток у пользователя
            let footprint = this.footprints.get(userId);
            const photoId = photoInfo.id || `photo_${Date.now()}`;

            if (!footprint) {
                // Первое фото - создаём новый отпечаток
                console.log(`👣 Первое фото - создаю новый отпечаток`);
                footprint = new this.CleanFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
                    points: preparedPoints
                });

                // Устанавливаем подтверждения для первой точки
                preparedPoints.forEach(point => {
                    footprint.confirmations.set(point.id, {
                        count: 1,
                        lastConfirmed: new Date(),
                        photoIds: [photoId]
                    });
                });

                this.footprints.set(userId, footprint);
                this.stats.totalFootprints++;

                console.log(`✅ Создан новый отпечаток с ${preparedPoints.length} точками`);

                return {
                    success: true,
                    isNew: true,
                    pointsAdded: preparedPoints.length,
                    footprintId: footprint.id,
                    message: 'Создан новый отпечаток'
                };

            } else {
                // Последующие фото - сравниваем
                console.log(`🔍 Проверяю совпадение с существующим отпечатком...`);

                const comparison = await this.compareFootprints(
                    footprint,
                    { points: preparedPoints }
                );

                console.log(`📊 Результат сравнения: ${comparison.similarity.toFixed(3)} (порог: ${this.config.similarityThreshold})`);

                if (comparison.similarity >= this.config.similarityThreshold) {
                    // СОВПАДЕНИЕ - обновляем подтверждения
                    const result = footprint.addPhoto(preparedPoints, photoId);
                   
                    // Сохраняем
                    this.saveFootprint(userId);

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
                        userId: userId,
                        name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`,
                        points: preparedPoints
                    });

                    // Заменяем старый отпечаток (можно хранить историю, но упрощаем)
                    this.footprints.set(userId, newFootprint);

                    // Сохраняем старый отпечаток в архив
                    this.archiveFootprint(footprint);

                    console.log(`✅ Создан новый отпечаток (старый сохранён в архив)`);

                    return {
                        success: true,
                        isNew: true,
                        similarity: comparison.similarity,
                        pointsAdded: preparedPoints.length,
                        message: 'Создан новый отпечаток (следы разные)'
                    };
                }
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
     * Сравнить два отпечатка (используем твой алгоритм)
     */
    async compareFootprints(footprint1, footprint2) {
        this.stats.totalComparisons++;

        try {
            // Получаем точки для сравнения (уже нормализованные)
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

            // 🔥 ИСПОЛЬЗУЕМ ТВОЙ АЛГОРИТМ, ЕСЛИ ОН ЕСТЬ
            if (this.GeometricAlgorithm) {
                const geoAlgorithm = new this.GeometricAlgorithm({
                    neighborOffsets: [-2, -1, 1, 2],
                    angleTolerance: 10,
                    minSimilarity: 0.3,
                    debug: this.config.debug
                });

                // Создаём геометрические отпечатки
                const geo1 = geoAlgorithm.createFootprint(points1, 'fp1');
                const geo2 = geoAlgorithm.createFootprint(points2, 'fp2');

                // Сравниваем
                const result = geoAlgorithm.compareFootprints(geo1, geo2);
               
                // Берем процент совпадений от первого к второму
                const percentMatch = parseFloat(result.stats.percent1to2) / 100;
                similarity = percentMatch;
                method = 'geometric_hash';

                console.log(`🎯 Геометрический алгоритм: ${result.stats.percent1to2}% совпадений`);

            } else {
                // Фаллбэк: простое сравнение по центрам
                const center1 = this.SimpleCoordinateSystem.calculateCenter(points1);
                const center2 = this.SimpleCoordinateSystem.calculateCenter(points2);

                const distance = Math.sqrt(
                    Math.pow(center2.x - center1.x, 2) +
                    Math.pow(center2.y - center1.y, 2)
                );

                // Преобразуем расстояние в схожесть (0-100px = 1.0-0.0)
                const maxDistance = 100;
                similarity = Math.max(0, 1 - (distance / maxDistance));
                method = 'simple_center_distance';

                console.log(`📏 Простое сравнение: расстояние ${distance.toFixed(1)}px, схожесть ${similarity.toFixed(3)}`);
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
                points2: points2.length
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
     * Сохранить отпечаток пользователя
     */
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

    /**
     * Архивировать старый отпечаток
     */
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

    /**
     * Загрузить существующие данные
     */
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

    /**
     * Создать необходимые директории
     */
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

    /**
     * Получить статистику системы
     */
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

    /**
     * Получить отпечаток пользователя
     */
    getFootprint(userId) {
        return this.footprints.get(userId);
    }

    /**
     * Очистить данные пользователя
     */
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
