// modules/footprint/clean/manager.js
// 🎯 ПРОСТОЙ МЕНЕДЖЕР: СОХРАНЕНИЕ, СРАВНЕНИЕ, ВИЗУАЛИЗАЦИЯ

const fs = require('fs');
const path = require('path');

class CleanFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints/clean',
            similarityThreshold: options.similarityThreshold || 0.6, // 60%
            minPoints: options.minPoints || 20, // Увеличено для топологии
            debug: options.debug || true
        };

        // Загружаем модули
        this.CleanFootprint = require('./footprint-model');
        this.SimpleCoordinateSystem = require('./coordinate-system');

        // 🔥 ЗАГРУЗИМ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ
        try {
            this.TopologyAlgorithm = require('./topology-algorithm');
            console.log('✅ Топологический алгоритм загружен');
        } catch (error) {
            console.log('⚠️ Топологический алгоритм не найден, используем простой');
            this.TopologyAlgorithm = null;
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
        console.log(`   • Топологический алгоритм: ${this.TopologyAlgorithm ? '✅' : '❌'}`);
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
     * Сравнить два отпечатка (используем топологический алгоритм)
     */
    async compareFootprints(footprint1, footprint2) {
        this.stats.totalComparisons++;

        try {
            // Получаем точки для сравнения
            const points1 = footprint1.getComparisonPoints();
            const points2 = footprint2.getComparisonPoints
                ? footprint2.getComparisonPoints()
                : (footprint2.points || []);

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
            let resultDetails;

            // 🔥 ИСПОЛЬЗУЕМ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ
            if (this.TopologyAlgorithm) {
                const topologyAlgo = new this.TopologyAlgorithm({
                    debug: this.config.debug,
                    minPoints: Math.max(20, Math.min(points1.length, points2.length) * 0.3),
                    similarityThreshold: this.config.similarityThreshold,
                    neighborsCount: Math.min(10, Math.min(points1.length, points2.length) - 1),
                    rotationStep: 15,
                    pointMatchThreshold: 20
                });

                // Сравниваем точки напрямую
                const result = topologyAlgo.comparePoints(
                    points1,
                    points2,
                    `Отпечаток ${footprint1.userId || '1'}`,
                    `Отпечаток ${footprint2.userId || '2'}`
                );

                similarity = result.similarity;
                method = 'topology';
                resultDetails = result;

                console.log(`🎯 Топологический алгоритм: ${(result.similarity * 100).toFixed(1)}% схожести`);
                console.log(`   Найдено совпадений: ${result.stats?.matchedPoints || 0} из ${Math.min(points1.length, points2.length)}`);

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
                points2: points2.length,
                details: resultDetails
            };

        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            console.error(error.stack);
            return {
                similarity: 0,
                decision: 'different',
                reason: `Ошибка: ${error.message}`,
                method: 'error'
            };
        }
    }

    /**
     * Специализированный метод для топологического анализа
     */
    async analyzeTopology(userId, newPoints, options = {}) {
        console.log(`\n🔬 Топологический анализ для пользователя ${userId}`);

        const footprint = this.footprints.get(userId);
        if (!footprint) {
            return {
                success: false,
                error: 'Отпечаток не найден'
            };
        }

        if (!this.TopologyAlgorithm) {
            return {
                success: false,
                error: 'Топологический алгоритм не загружен'
            };
        }

        try {
            const points1 = footprint.getComparisonPoints();
            const points2 = newPoints || [];

            if (points1.length < 20 || points2.length < 20) {
                return {
                    success: false,
                    error: `Недостаточно точек: ${points1.length} и ${points2.length} (минимум 20)`
                };
            }

            const topologyAlgo = new this.TopologyAlgorithm({
                debug: true,
                minPoints: options.minPoints || 20,
                similarityThreshold: options.similarityThreshold || 0.5,
                neighborsCount: options.neighborsCount || 8,
                rotationStep: options.rotationStep || 10,
                pointMatchThreshold: options.pointMatchThreshold || 15
            });

            // Создаем топологические отпечатки
            const fp1 = topologyAlgo.createFootprint(points1, `Существующий (${points1.length} точек)`);
            const fp2 = topologyAlgo.createFootprint(points2, `Новый (${points2.length} точек)`);

            // Сравниваем
            const result = topologyAlgo.compareFootprints(fp1, fp2);

            // Детальный анализ
            const analysis = {
                topologyResult: result,
                footprint1: {
                    points: points1.length,
                    descriptors: fp1.descriptors?.length || 0
                },
                footprint2: {
                    points: points2.length,
                    descriptors: fp2.descriptors?.length || 0
                },
                timestamp: new Date().toISOString()
            };

            // Генерируем визуализацию, если нужно
            if (options.generateVisualization) {
                await this.generateTopologyVisualization(analysis, userId);
            }

            return {
                success: true,
                analysis: analysis,
                decision: result.decision,
                similarity: result.similarity,
                matchedPoints: result.stats?.matchedPoints || 0
            };

        } catch (error) {
            console.error(`❌ Ошибка топологического анализа: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Генерация визуализации топологического анализа
     */
    async generateTopologyVisualization(analysis, userId) {
        try {
            const visDir = path.join(this.config.dbPath, 'visualizations', userId.toString());
            if (!fs.existsSync(visDir)) {
                fs.mkdirSync(visDir, { recursive: true });
            }

            const fileName = `topology_${Date.now()}.json`;
            const filePath = path.join(visDir, fileName);

            // Сохраняем анализ для последующей визуализации
            fs.writeFileSync(filePath, JSON.stringify(analysis, null, 2));

            console.log(`📊 Визуализация сохранена: ${filePath}`);

            return filePath;
        } catch (error) {
            console.error(`❌ Ошибка генерации визуализации: ${error.message}`);
            return null;
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
            },
            algorithm: {
                topology: this.TopologyAlgorithm ? 'available' : 'unavailable',
                minPointsForTopology: 20
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

    /**
     * Тест топологического алгоритма
     */
    async runTopologyTest() {
        console.log('\n🧪 ЗАПУСК ТЕСТА ТОПОЛОГИЧЕСКОГО АЛГОРИТМА');
        console.log('='.repeat(60));

        if (!this.TopologyAlgorithm) {
            console.log('❌ Топологический алгоритм не загружен');
            return { success: false, error: 'Algorithm not loaded' };
        }

        try {
            const TopologyAlgorithm = require('./topology-algorithm');
            const test = require('./test-topology-algorithm');
           
            console.log('✅ Тестовые модули загружены');
           
            // Запускаем тест из файла
            await test.testTopologyAlgorithm();
           
            return { success: true, message: 'Тест выполнен' };
        } catch (error) {
            console.error(`❌ Ошибка теста: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = CleanFootprintManager;
