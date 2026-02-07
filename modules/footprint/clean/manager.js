// modules/footprint/clean/manager.js
// 🎯 ВЕКТОРНЫЙ МЕНЕДЖЕР ОТПЕЧАТКОВ

const fs = require('fs');
const path = require('path');

class CleanFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints/clean',
            similarityThreshold: options.similarityThreshold || 0.6,
            minPoints: options.minPoints || 15,
            debug: options.debug || true
        };

        // Загружаем модули
        this.CleanFootprint = require('./footprint-model');
        this.SimpleCoordinateSystem = require('./coordinate-system');

        // 🔥 ЗАГРУЖАЕМ ВЕКТОРНЫЙ АЛГОРИТМ
        try {
            this.VectorAlgorithm = require('./vector-algorithm');
            console.log('✅ Векторный алгоритм загружен');
        } catch (error) {
            console.log('⚠️ Векторный алгоритм не найден');
            this.VectorAlgorithm = null;
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

        console.log('🚀 Векторный менеджер отпечатков создан');
        console.log(`   • Порог схожести: ${this.config.similarityThreshold * 100}%`);
        console.log(`   • Минимально точек: ${this.config.minPoints}`);
        console.log(`   • Векторный алгоритм: ${this.VectorAlgorithm ? '✅' : '❌'}`);
    }

    // ============================================
    // 🎯 ОСНОВНОЙ МЕТОД: ДОБАВИТЬ ФОТО
    // ============================================
   
    async addPhoto(userId, points, photoInfo = {}) {
        console.log(`\n📸 Добавляю фото для пользователя ${userId}`);

        try {
            // Валидация
            if (!points || points.length < this.config.minPoints) {
                return {
                    success: false,
                    error: `Слишком мало точек: ${points?.length || 0} (минимум ${this.config.minPoints})`
                };
            }

            // 🔥 ПОДГОТАВЛИВАЕМ ВЕКТОРНЫЕ ТОЧКИ
            const vectorPoints = this.prepareVectorPoints(points, photoInfo);
            console.log(`📊 Подготовлено ${vectorPoints.length} векторных точек`);

            // Проверяем отпечаток
            let footprint = this.footprints.get(userId);
            const photoId = photoInfo.id || `photo_${Date.now()}`;

            if (!footprint) {
                // Первое фото
                return this.createNewVectorFootprint(userId, vectorPoints, photoId);
            } else {
                // Сравниваем
                return await this.compareAndUpdateVector(footprint, vectorPoints, photoId);
            }

        } catch (error) {
            console.error(`❌ Ошибка: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================
    // 🔥 ПОДГОТОВКА ВЕКТОРНЫХ ТОЧЕК
    // ============================================
   
    prepareVectorPoints(points, photoInfo) {
        return points.map((point, index) => {
            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ID (на основе углов, а не координат!)
            let geometricId;
           
            if (point.originalId) {
                geometricId = point.originalId;
            } else if (point.geometricHash) {
                geometricId = point.geometricHash;
            } else {
                // Временный ID - будет заменен векторным алгоритмом
                geometricId = `photo_${photoInfo.id || 'tmp'}_${index}`;
            }
           
            return {
                id: point.id || `vec_pt_${Date.now()}_${index}`,
                originalId: geometricId,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                source: photoInfo.source || 'robokit',
                // Сохраняем оригинальные данные для возможного пересчета
                originalData: {
                    x: point.x,
                    y: point.y,
                    width: point.width,
                    height: point.height,
                    class: point.class
                }
            };
        });
    }

    // ============================================
    // 🏗️ СОЗДАНИЕ НОВОГО ВЕКТОРНОГО ОТПЕЧАТКА
    // ============================================
   
    createNewVectorFootprint(userId, points, photoId) {
        console.log(`👣 Первое фото - создаю векторный отпечаток`);
       
        const footprint = new this.CleanFootprint({
            userId: userId,
            name: `Векторный_отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
            points: points
        });

        // Добавляем подтверждения
        points.forEach(point => {
            footprint.confirmations.set(point.id, {
                count: 1,
                lastConfirmed: new Date(),
                photoIds: [photoId]
            });
        });

        this.footprints.set(userId, footprint);
        this.stats.totalFootprints++;

        console.log(`✅ Создан векторный отпечаток с ${points.length} точками`);

        return {
            success: true,
            isNew: true,
            pointsAdded: points.length,
            footprintId: footprint.id,
            message: 'Создан новый векторный отпечаток'
        };
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ И ОБНОВЛЕНИЕ
    // ============================================
   
    async compareAndUpdateVector(footprint, photoPoints, photoId) {
        console.log(`🔍 Векторное сравнение с существующим отпечатком...`);

        const comparison = await this.compareFootprints(
            footprint,
            { points: photoPoints }
        );

        console.log(`📊 Векторная схожесть: ${comparison.similarity.toFixed(3)} (порог: ${this.config.similarityThreshold})`);

        if (comparison.similarity >= this.config.similarityThreshold) {
            // СОВПАДЕНИЕ
            const result = footprint.addPhoto(photoPoints, photoId);
            this.saveFootprint(footprint.userId);

            console.log(`✅ Векторное совпадение! Совпало точек: ${comparison.stats?.totalMatches || 0}`);
           
            return {
                success: true,
                isNew: false,
                similarity: comparison.similarity,
                matches: comparison.matches?.length || 0,
                newPoints: result.newPoints,
                message: `Векторное совпадение (${(comparison.similarity * 100).toFixed(1)}%)`
            };

        } else {
            // НЕ СОВПАЛО
            console.log(`🆕 Векторные следы разные - создаю новый отпечаток`);

            const newFootprint = new this.CleanFootprint({
                userId: footprint.userId,
                name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`,
                points: photoPoints
            });

            this.footprints.set(footprint.userId, newFootprint);
            this.archiveFootprint(footprint);

            console.log(`✅ Создан новый векторный отпечаток`);

            return {
                success: true,
                isNew: true,
                similarity: comparison.similarity,
                pointsAdded: photoPoints.length,
                message: 'Создан новый отпечаток (векторные следы разные)'
            };
        }
    }

    // ============================================
    // 🔍 ВЕКТОРНОЕ СРАВНЕНИЕ ОТПЕЧАТКОВ
    // ============================================
   
    async compareFootprints(footprint1, footprint2) {
        this.stats.totalComparisons++;

        try {
            // Получаем точки
            const points1 = footprint1.getComparisonPoints();
            const points2 = footprint2.getComparisonPoints
                ? footprint2.getComparisonPoints()
                : this.SimpleCoordinateSystem.normalize(footprint2.points || []);

            if (points1.length < 3 || points2.length < 3) {
                console.log('⚠️ Недостаточно точек для векторного сравнения');
                return {
                    similarity: 0,
                    decision: 'different'
                };
            }

            let similarity;
            let method;

            // 🔥 ИСПОЛЬЗУЕМ ВЕКТОРНЫЙ АЛГОРИТМ
            if (this.VectorAlgorithm) {
                const vectorAlgo = new this.VectorAlgorithm({
                    debug: this.config.debug,
                    minSimilarity: this.config.similarityThreshold,
                    neighborDepth: 2
                });

                const result = vectorAlgo.comparePoints(points1, points2, 'Отпечаток 1', 'Отпечаток 2');
                similarity = result.similarity;
                method = 'vector';
               
                console.log(`🎯 Векторный алгоритм: ${(similarity * 100).toFixed(1)}% схожести`);

            } else {
                // Фаллбэк
                similarity = this.fallbackComparison(points1, points2);
                method = 'simple';
            }

            // Решение
            const decision = similarity >= this.config.similarityThreshold ? 'same' : 'different';
           
            if (decision === 'same') {
                this.stats.successfulComparisons++;
            }

            console.log(`🎯 Решение: ${decision}`);

            return {
                similarity: similarity,
                decision: decision,
                method: method
            };

        } catch (error) {
            console.error(`❌ Ошибка векторного сравнения: ${error.message}`);
            return {
                similarity: 0,
                decision: 'different',
                error: error.message
            };
        }
    }

    // ============================================
    // 📏 ФАЛЛБЭК-СРАВНЕНИЕ
    // ============================================
   
    fallbackComparison(points1, points2) {
        const center1 = this.SimpleCoordinateSystem.calculateCenter(points1);
        const center2 = this.SimpleCoordinateSystem.calculateCenter(points2);

        const distance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );

        const maxDistance = 100;
        const similarity = Math.max(0, 1 - (distance / maxDistance));

        console.log(`📏 Простое сравнение: расстояние ${distance.toFixed(1)}px, схожесть ${similarity.toFixed(3)}`);

        return similarity;
    }

    // ============================================
    // 💾 МЕТОДЫ СОХРАНЕНИЯ/ЗАГРУЗКИ (без изменений)
    // ============================================
   
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
        console.log(`💾 Векторный отпечаток сохранён: ${filePath}`);
       
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

                    console.log(`📂 Загружен векторный отпечаток ${userId}: ${footprint.originalPoints.length} точек`);
                } catch (error) {
                    console.log(`⚠️ Ошибка загрузки ${filePath}: ${error.message}`);
                }
            }
        });

        this.stats.totalUsers = loadedCount;
        this.stats.totalFootprints = loadedCount;
        console.log(`📂 Загружено ${loadedCount} векторных отпечатков`);
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
                console.log(`🧹 Очищены векторные данные пользователя ${userId}`);
            }

            return true;
        }
        return false;
    }
}

module.exports = CleanFootprintManager;
