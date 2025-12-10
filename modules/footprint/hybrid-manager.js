// modules/footprint/hybrid-manager.js
const HybridFootprint = require('./hybrid-footprint');
const BitmaskFootprint = require('./bitmask-footprint');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class HybridManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/hybrid-footprints',
            autoSave: options.autoSave !== false,
            minSimilarityForSame: options.minSimilarityForSame || 0.85,
            minSimilarityForSimilar: options.minSimilarityForSimilar || 0.7,
            fastRejectBitmaskDistance: options.fastRejectBitmaskDistance || 15,
            ...options
        };

        // Кэширование
        this.userFootprints = new Map(); // userId -> HybridFootprint[]
        this.searchCache = new Map(); // queryHash -> results

        // Статистика
        this.stats = {
            totalComparisons: 0,
            fastRejects: 0,
            sameDecisions: 0,
            similarDecisions: 0,
            differentDecisions: 0,
            avgComparisonTime: 0
        };

        this.ensureDatabaseDirectory();
        console.log('🎭 Гибридный менеджер инициализирован');
    }

    ensureDatabaseDirectory() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'users'),
            path.join(this.config.dbPath, 'cache')
        ];

        dirs.forEach(dir => {
            if (!fsSync.existsSync(dir)) {
                fsSync.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // ОБНОВИТЬ СТАТИСТИКУ
    updateStats(comparisonResult) {
        this.stats.totalComparisons++;

        if (comparisonResult && comparisonResult.fastReject) {
            this.stats.fastRejects++;
        }

        if (comparisonResult && comparisonResult.decision) {
            if (comparisonResult.decision === 'same') {
                this.stats.sameDecisions++;
            } else if (comparisonResult.decision === 'similar') {
                this.stats.similarDecisions++;
            } else {
                this.stats.differentDecisions++;
            }
        }

        // Рассчитать среднее время
        if (comparisonResult && comparisonResult.timeMs) {
            const totalTime = this.stats.avgComparisonTime * (this.stats.totalComparisons - 1);
            this.stats.avgComparisonTime = (totalTime + comparisonResult.timeMs) / this.stats.totalComparisons;
        }

        // Сохранить статистику
        this.saveStats();
    }

    // СОХРАНИТЬ СТАТИСТИКУ
    saveStats() {
        if (!this.config.autoSave) return;

        try {
            const statsPath = path.join(this.config.dbPath, 'stats.json');
            const statsData = {
                ...this.stats,
                updatedAt: new Date().toISOString(),
                config: this.config
            };
           
            fsSync.writeFileSync(statsPath, JSON.stringify(statsData, null, 2));
        } catch (error) {
            console.log('⚠️ Не удалось сохранить статистику:', error.message);
        }
    }

    // 1. ОБРАБОТКА НОВОГО ФОТО
    async processPhoto(userId, analysis, photoInfo) {
        console.log(`📸 Обрабатываю фото через гибридную систему (user: ${userId})...`);

        try {
            // Извлечь точки из анализа
            const points = this.extractPointsFromAnalysis(analysis);

            if (points.length < 10) {
                return {
                    success: false,
                    reason: 'Недостаточно точек для анализа',
                    pointsCount: points.length
                };
            }

            // Создать временный отпечаток для поиска
            const tempFootprint = new HybridFootprint({
                name: `Запрос_${Date.now()}`,
                userId: userId
            });

            tempFootprint.createFromPoints(points, {
                photoId: photoInfo.photoId,
                chatId: photoInfo.chatId,
                timestamp: new Date(),
                ...photoInfo
            });

            // Загрузить отпечатки пользователя
            const userFootprints = await this.loadUserFootprints(userId);

            // Поиск похожих
            const searchResult = this.findSimilar(tempFootprint, userFootprints);

            let result = {
                success: true,
                pointsCount: points.length,
                bitmask: tempFootprint.bitmask.bitmask.toString(16).slice(0, 8),
                searchResult: searchResult
            };

            // Если найден похожий след
            if (searchResult.found && searchResult.bestMatch &&
                searchResult.bestMatch.similarity >= this.config.minSimilarityForSame) {
                console.log(`🎯 Найден похожий след: ${searchResult.bestMatch.similarity.toFixed(3)}`);

                // Объединить с найденным следом
                const mergeResult = searchResult.bestMatch.footprint.mergeWithTransformation(tempFootprint);

                if (mergeResult.success) {
                    result.merged = true;
                    result.footprintId = searchResult.bestMatch.footprint.id;
                    result.similarity = searchResult.bestMatch.similarity;
                    result.mergeResult = mergeResult;

                    // Обновить статистику
                    if (searchResult.bestMatch.decision === 'same') {
                        this.stats.sameDecisions++;
                    } else if (searchResult.bestMatch.decision === 'similar') {
                        this.stats.similarDecisions++;
                    } else {
                        this.stats.differentDecisions++;
                    }

                    // Сохранить обновлённый отпечаток
                    await this.saveFootprint(searchResult.bestMatch.footprint);
                }
            } else {
                // Создать новый отпечаток
                const newFootprint = new HybridFootprint({
                    name: photoInfo.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
                    userId: userId
                });

                newFootprint.createFromPoints(points, photoInfo);

                result.newFootprint = true;
                result.footprintId = newFootprint.id;
                result.confidence = newFootprint.stats.confidence;

                // Сохранить новый отпечаток
                await this.saveFootprint(newFootprint);

                // Добавить в кэш
                userFootprints.push(newFootprint);
                this.userFootprints.set(userId, userFootprints);

                // Обновить статистику
                this.stats.differentDecisions++;
            }

            return result;

        } catch (error) {
            console.log('❌ Ошибка обработки фото:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 2. ПОИСК ПОХОЖИХ ОТПЕЧАТКОВ
    findSimilar(queryFootprint, footprintList, options = {}) {
        const startTime = Date.now();
        const maxResults = options.maxResults || 5;
        const minSimilarity = options.minSimilarity || this.config.minSimilarityForSimilar;

        console.log(`🔍 Ищу похожие среди ${footprintList.length} отпечатков...`);

        const results = [];

        // ШАГ 1: Быстрый поиск по битовым маскам
        const bitmaskCandidates = footprintList.filter(footprint => {
            const distance = BitmaskFootprint.hammingDistance(
                queryFootprint.bitmask.bitmask,
                footprint.bitmask.bitmask
            );
            return distance <= this.config.fastRejectBitmaskDistance;
        });

        console.log(`   📊 После битовой маски: ${bitmaskCandidates.length} кандидатов`);

        if (bitmaskCandidates.length === 0) {
            this.updateStats({
                fastReject: 'bitmask',
                decision: 'different',
                timeMs: Date.now() - startTime
            });
           
            return {
                found: false,
                candidates: 0,
                timeMs: Date.now() - startTime,
                fastReject: 'bitmask'
            };
        }

        // ШАГ 2: Детальное сравнение
        bitmaskCandidates.forEach((footprint, index) => {
            if (results.length >= maxResults * 2) return; // Ограничиваем для производительности

            const comparison = queryFootprint.compare(footprint);
            this.updateStats(comparison);

            if (comparison.similarity >= minSimilarity) {
                results.push({
                    footprint: footprint,
                    similarity: comparison.similarity,
                    decision: comparison.decision,
                    details: comparison.details,
                    comparisonTime: comparison.timeMs
                });
            }
        });

        // Сортировка по схожести
        results.sort((a, b) => b.similarity - a.similarity);
        const topResults = results.slice(0, maxResults);

        const totalTime = Date.now() - startTime;

        return {
            found: topResults.length > 0,
            candidates: topResults.length,
            bestMatch: topResults[0],
            allMatches: topResults,
            totalCompared: bitmaskCandidates.length,
            timeMs: totalTime,
            stats: {
                bitmaskCandidates: bitmaskCandidates.length,
                detailedComparisons: results.length
            }
        };
    }

    // 3. ЗАГРУЗКА ОТПЕЧАТКОВ ПОЛЬЗОВАТЕЛЯ
    async loadUserFootprints(userId) {
        // Проверить кэш
        if (this.userFootprints.has(userId)) {
            return this.userFootprints.get(userId);
        }

        try {
            const userDir = path.join(this.config.dbPath, 'users', userId.toString());

            if (!fsSync.existsSync(userDir)) {
                return [];
            }

            const files = await fs.readdir(userDir);
            const footprints = [];

            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(userDir, file);
                        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

                        const footprint = HybridFootprint.fromJSON(data);
                        footprints.push(footprint);
                    } catch (error) {
                        console.log(`⚠️ Ошибка загрузки файла ${file}:`, error.message);
                    }
                }
            }

            console.log(`📂 Загружено ${footprints.length} отпечатков для пользователя ${userId}`);

            // Сохранить в кэш
            this.userFootprints.set(userId, footprints);

            return footprints;
        } catch (error) {
            console.log('❌ Ошибка загрузки отпечатков:', error);
            return [];
        }
    }

    // 4. СОХРАНЕНИЕ ОТПЕЧАТКА
    async saveFootprint(footprint) {
        try {
            const userDir = path.join(this.config.dbPath, 'users', footprint.userId.toString());
            await fs.mkdir(userDir, { recursive: true });

            const filePath = path.join(userDir, `${footprint.id}.json`);
            const data = JSON.stringify(footprint.toJSON(), null, 2);

            await fs.writeFile(filePath, data);

            console.log(`💾 Отпечаток сохранен: ${filePath}`);

            return { success: true, path: filePath };
        } catch (error) {
            console.log('❌ Ошибка сохранения отпечатка:', error);
            return { success: false, error: error.message };
        }
    }

    // 5. ИЗВЛЕЧЕНИЕ ТОЧЕК ИЗ АНАЛИЗА
    extractPointsFromAnalysis(analysis) {
        if (!analysis || !analysis.predictions) {
            return [];
        }

        const points = [];

        analysis.predictions.forEach(prediction => {
            if (prediction.class === 'shoe-protector' || (prediction.confidence || 0) > 0.3) {
                if (prediction.points && prediction.points.length > 0) {
                    // Взять центр точек
                    const xs = prediction.points.map(p => p.x);
                    const ys = prediction.points.map(p => p.y);

                    points.push({
                        x: (Math.min(...xs) + Math.max(...xs)) / 2,
                        y: (Math.min(...ys) + Math.max(...ys)) / 2,
                        confidence: prediction.confidence || 0.5
                    });
                }
            }
        });

        return points;
    }

    // 6. ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        const totalUsers = this.userFootprints.size;
        let totalFootprints = 0;
        this.userFootprints.forEach(footprints => {
            totalFootprints += footprints.length;
        });

        return {
            ...this.stats,
            totalUsers,
            totalFootprints,
            config: this.config,
            cache: {
                userFootprints: this.userFootprints.size,
                searchCache: this.searchCache.size
            }
        };
    }

    // 7. ОЧИСТКА КЭША
    clearCache() {
        this.userFootprints.clear();
        this.searchCache.clear();
        console.log('🧹 Кэш очищен');
    }

    // 8. ТЕСТИРОВАНИЕ МЕНЕДЖЕРА
    static async test() {
        console.log('🧪 ТЕСТ ГИБРИДНОГО МЕНЕДЖЕРА\n');

        const manager = new HybridManager({
            dbPath: './test-data/hybrid'
        });

        // Создаем тестовые данные
        const testPoints = Array.from({length: 25}, (_, i) => ({
            x: 100 + (i % 5) * 40,
            y: 100 + Math.floor(i / 5) * 40,
            confidence: 0.9
        }));

        const testAnalysis = {
            predictions: testPoints.map((point, i) => ({
                class: 'shoe-protector',
                confidence: 0.9,
                points: [
                    { x: point.x - 5, y: point.y - 5 },
                    { x: point.x + 5, y: point.y - 5 },
                    { x: point.x + 5, y: point.y + 5 },
                    { x: point.x - 5, y: point.y + 5 }
                ]
            }))
        };

        const photoInfo = {
            photoId: 'test_photo_1',
            chatId: 12345,
            name: 'Тестовый след',
            timestamp: new Date()
        };

        let results = [];

        try {
            // Тест 1: Первое фото (должен создать новый отпечаток)
            console.log('📸 Тест 1: Первое фото...');
            const result1 = await manager.processPhoto('test_user', testAnalysis, photoInfo);
            results.push({ test: 1, success: result1.success, new: result1.newFootprint });
            console.log(`   Результат: ${result1.success ? '✅' : '❌'} ${result1.newFootprint ? 'Новый отпечаток' : 'Объединён'}`);

            // Тест 2: То же самое фото (должен объединиться)
            console.log('\n📸 Тест 2: То же самое фото...');
            const result2 = await manager.processPhoto('test_user', testAnalysis, photoInfo);
            results.push({ test: 2, success: result2.success, merged: result2.merged });
            console.log(`   Результат: ${result2.success ? '✅' : '❌'} ${result2.merged ? 'Объединён' : 'Новый отпечаток'}`);

            // Тест 3: Другой след (случайные точки)
            console.log('\n📸 Тест 3: Другой след...');
            const randomAnalysis = {
                predictions: Array.from({length: 20}, () => ({
                    class: 'shoe-protector',
                    confidence: 0.8,
                    points: [
                        { x: Math.random() * 300, y: Math.random() * 300 },
                        { x: Math.random() * 300 + 10, y: Math.random() * 300 },
                        { x: Math.random() * 300, y: Math.random() * 300 + 10 },
                        { x: Math.random() * 300 + 10, y: Math.random() * 300 + 10 }
                    ]
                }))
            };

            const result3 = await manager.processPhoto('test_user', randomAnalysis, {
                ...photoInfo,
                photoId: 'test_photo_2',
                name: 'Случайный след'
            });
            results.push({ test: 3, success: result3.success, new: result3.newFootprint });
            console.log(`   Результат: ${result3.success ? '✅' : '❌'} ${result3.newFootprint ? 'Новый отпечаток' : 'Объединён'}`);

        } catch (error) {
            console.log('❌ Ошибка в тесте:', error.message);
            console.log(error.stack);
        }

        // Статистика
        console.log('\n📊 СТАТИСТИКА МЕНЕДЖЕРА:');
        const stats = manager.getStats();
        console.log(`   Всего сравнений: ${stats.totalComparisons}`);
        console.log(`   Быстрых отсевов: ${stats.fastRejects}`);
        console.log(`   Среднее время: ${stats.avgComparisonTime.toFixed(1)}ms`);
        console.log(`   Отпечатков: ${stats.totalFootprints}`);

        // Очистка тестовых данных
        if (fsSync.existsSync('./test-data/hybrid')) {
            fsSync.rmSync('./test-data/hybrid', { recursive: true, force: true });
        }

        // Итог теста
        const passed = results.filter(r => r.success).length;
        const total = results.length;

        console.log('\n🎯 ТЕСТ ЗАВЕРШЕН');
        console.log(`📈 Результат: ${passed}/${total} тестов пройдено (${total > 0 ? Math.round(passed/total*100) : 0}%)`);

        return {
            success: passed === total,
            stats: stats,
            results: results
        };
    }
}

module.exports = HybridManager;
