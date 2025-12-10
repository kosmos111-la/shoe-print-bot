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
            fastRejectBitmaskDistance: options.fastRejectBitmaskDistance || 15, // НЕ ИСПОЛЬЗУЕТСЯ
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
        console.log(`   ⚡ БИТОВЫЙ ОТСЕВ ОТКЛЮЧЕН - все отпечатки проверяются`);
        console.log(`   Порог схожести (same): ${this.config.minSimilarityForSame}`);
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
        console.log(`\n📸 Обрабатываю фото через гибридную систему (user: ${userId})...`);

        try {
            // Извлечь точки из анализа
            const points = this.extractPointsFromAnalysis(analysis);

            console.log(`   📍 Извлечено точек: ${points.length}`);

            if (points.length < 10) {
                console.log(`   ❌ Недостаточно точек для анализа (нужно минимум 10, есть ${points.length})`);
                return {
                    success: false,
                    reason: 'Недостаточно точек для анализа',
                    pointsCount: points.length,
                    required: 10
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

            console.log(`   🔧 Создан временный отпечаток:`);
            console.log(`      - ID: ${tempFootprint.id}`);
            console.log(`      - Точек в матрице: ${tempFootprint.matrix ? tempFootprint.matrix.points.length : 'нет'}`);

            // Загрузить отпечатки пользователя
            const userFootprints = await this.loadUserFootprints(userId);
            console.log(`   📂 Загружено отпечатков пользователя: ${userFootprints.length}`);

            // Поиск похожих (БЕЗ БИТОВОГО ОТСЕВА)
            console.log(`\n🔍 НАЧИНАЮ ПОИСК ПОХОЖИХ ОТПЕЧАТКОВ...`);
            const searchResult = this.findSimilar(tempFootprint, userFootprints);

            // ДИАГНОСТИКА РЕЗУЛЬТАТОВ ПОИСКА
            console.log('\n📊 РЕЗУЛЬТАТЫ ПОИСКА:');
            console.log(`   Найдено совпадений: ${searchResult.found ? '✅ ДА' : '❌ НЕТ'}`);
            console.log(`   Кандидатов: ${searchResult.candidates}`);
            console.log(`   Всего проверено: ${searchResult.totalCompared || 0}`);
            console.log(`   Время поиска: ${searchResult.timeMs}ms`);

            if (searchResult.bestMatch) {
                console.log(`\n🎯 ЛУЧШЕЕ СОВПАДЕНИЕ:`);
                console.log(`   Схожесть: ${searchResult.bestMatch.similarity.toFixed(3)}`);
                console.log(`   Решение: ${searchResult.bestMatch.decision}`);
                console.log(`   Отпечаток: ${searchResult.bestMatch.footprint.name}`);
                console.log(`   ID: ${searchResult.bestMatch.footprint.id}`);
               
                if (searchResult.bestMatch.details) {
                    console.log(`   Детали: матрица=${searchResult.bestMatch.details.matrixSimilarity?.toFixed(3) || 'нет'}, векторы=${searchResult.bestMatch.details.vectorSimilarity?.toFixed(3) || 'нет'}`);
                }
               
                // Проверяем, проходит ли порог
                const meetsThreshold = searchResult.bestMatch.similarity >= this.config.minSimilarityForSame;
                console.log(`   Порог (${this.config.minSimilarityForSame}): ${meetsThreshold ? '✅ ПРОЙДЕН' : '❌ НЕ ПРОЙДЕН'}`);
            } else if (userFootprints.length > 0) {
                console.log(`\n🔧 ДИАГНОСТИКА (почему не нашлось совпадений):`);
               
                // Проверить все отпечатки вручную для диагностики
                for (let i = 0; i < Math.min(userFootprints.length, 3); i++) {
                    const fp = userFootprints[i];
                    const compareResult = tempFootprint.compare(fp);
                    console.log(`   [${i}] "${fp.name || 'Без названия'}":`);
                    console.log(`       схожесть=${compareResult.similarity.toFixed(3)}`);
                    console.log(`       решение=${compareResult.decision}`);
                    console.log(`       время=${compareResult.timeMs}ms`);
                   
                    if (compareResult.details) {
                        console.log(`       матрица=${compareResult.details.matrixSimilarity?.toFixed(3) || 'нет'}`);
                        console.log(`       векторы=${compareResult.details.vectorSimilarity?.toFixed(3) || 'нет'}`);
                    }
                   
                    // Порог
                    const meetsThreshold = compareResult.similarity >= this.config.minSimilarityForSame;
                    console.log(`       порог (${this.config.minSimilarityForSame}): ${meetsThreshold ? '✅' : '❌'}`);
                }
            }

            let result = {
                success: true,
                pointsCount: points.length,
                searchResult: searchResult
            };

            // Если найден похожий след
            if (searchResult.found && searchResult.bestMatch &&
                searchResult.bestMatch.similarity >= this.config.minSimilarityForSame) {
                console.log(`\n🔄 ОБНАРУЖЕН ПОХОЖИЙ СЛЕД! Объединяю...`);

                // Объединить с найденным следом
                const mergeResult = searchResult.bestMatch.footprint.mergeWithTransformation(tempFootprint);

                if (mergeResult.success) {
                    console.log(`   ✅ Успешно объединено!`);
                    console.log(`   📈 Улучшение: ${mergeResult.improvement ? mergeResult.improvement.toFixed(3) : 'нет'}`);
                   
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
                } else {
                    console.log(`   ❌ Ошибка объединения: ${mergeResult.error || 'неизвестная ошибка'}`);
                    result.mergeError = mergeResult.error;
                }
            } else {
                // Создать новый отпечаток
                console.log(`\n🆕 СОЗДАЮ НОВЫЙ ОТПЕЧАТОК...`);
                const newFootprint = new HybridFootprint({
                    name: photoInfo.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
                    userId: userId
                });

                newFootprint.createFromPoints(points, photoInfo);

                console.log(`   ✅ Создан новый отпечаток:`);
                console.log(`      - ID: ${newFootprint.id}`);
                console.log(`      - Название: ${newFootprint.name}`);
                console.log(`      - Уверенность: ${newFootprint.stats.confidence?.toFixed(3) || 'нет'}`);
                console.log(`      - Количество фото: ${newFootprint.metadata.photos?.length || 1}`);

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

            // Сохранить статистику
            this.saveStats();

            console.log(`\n✅ ОБРАБОТКА ЗАВЕРШЕНА`);
            console.log(`   Результат: ${result.merged ? 'ОБЪЕДИНЕНО' : 'НОВЫЙ ОТПЕЧАТОК'}`);

            return result;

        } catch (error) {
            console.log('❌ ОШИБКА ОБРАБОТКИ ФОТО:', error);
            console.log(error.stack);
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    // 2. ПОИСК ПОХОЖИХ ОТПЕЧАТКОВ (БЕЗ БИТОВОГО ОТСЕВА)
    findSimilar(queryFootprint, footprintList, options = {}) {
        const startTime = Date.now();
        const maxResults = options.maxResults || 5;
        const minSimilarity = options.minSimilarity || this.config.minSimilarityForSimilar;

        console.log(`\n🔍 ПОИСК ПОХОЖИХ СРЕДИ ${footprintList.length} ОТПЕЧАТКОВ...`);
        console.log(`   ⚡ БИТОВЫЙ ОТСЕВ ОТКЛЮЧЕН - проверяю ВСЕ отпечатки`);

        const results = [];

        // ПРЯМОЕ СРАВНЕНИЕ ВСЕХ ОТПЕЧАТКОВ (НИКАКОГО ФИЛЬТРА!)
        console.log(`\n   📊 ДЕТАЛЬНОЕ СРАВНЕНИЕ ${footprintList.length} отпечатков...`);
       
        for (let i = 0; i < footprintList.length; i++) {
            const footprint = footprintList[i];
           
            if (results.length >= maxResults * 2) {
                console.log(`   ⏹️  Достигнут лимит сравнений (${maxResults * 2})`);
                break;
            }

            console.log(`\n   🔍 Сравнение ${i + 1}/${footprintList.length}: "${footprint.name || 'Без названия'}"`);
           
            // ЗАПУСКАЕМ ПОЛНОЕ СРАВНЕНИЕ (включая каскадное и повороты)
            const comparison = queryFootprint.compare(footprint);
            this.updateStats(comparison);

            console.log(`      Результат: схожесть=${comparison.similarity.toFixed(3)}, решение=${comparison.decision}`);
           
            if (comparison.details) {
                console.log(`      Детали: матрица=${comparison.details.matrixSimilarity?.toFixed(3) || 'нет'}, векторы=${comparison.details.vectorSimilarity?.toFixed(3) || 'нет'}`);
               
                // Показать, если было вращение
                if (comparison.details.bestRotation !== undefined) {
                    console.log(`      Лучший поворот: ${comparison.details.bestRotation}°`);
                }
            }

            if (comparison.similarity >= minSimilarity) {
                console.log(`      ✅ Добавляю в кандидаты (>= ${minSimilarity})`);
                results.push({
                    footprint: footprint,
                    similarity: comparison.similarity,
                    decision: comparison.decision,
                    details: comparison.details,
                    comparisonTime: comparison.timeMs
                });
            } else {
                console.log(`      ❌ Слишком низкая схожесть (< ${minSimilarity})`);
            }
        }

        // Сортировка по схожести
        results.sort((a, b) => b.similarity - a.similarity);
        const topResults = results.slice(0, maxResults);

        const totalTime = Date.now() - startTime;

        console.log(`\n   📊 ИТОГ ПОИСКА:`);
        console.log(`      Проверено отпечатков: ${footprintList.length}`);
        console.log(`      Найдено кандидатов: ${results.length}`);
        console.log(`      Лучших результатов: ${topResults.length}`);
        console.log(`      Общее время: ${totalTime}ms`);

        return {
            found: topResults.length > 0,
            candidates: topResults.length,
            bestMatch: topResults[0],
            allMatches: topResults,
            totalCompared: footprintList.length, // ВСЕ были проверены!
            timeMs: totalTime,
            stats: {
                totalComparisons: footprintList.length,
                detailedComparisons: results.length
            }
        };
    }

    // 3. ЗАГРУЗКА ОТПЕЧАТКОВ ПОЛЬЗОВАТЕЛЯ
    async loadUserFootprints(userId) {
        // Проверить кэш
        if (this.userFootprints.has(userId)) {
            const cached = this.userFootprints.get(userId);
            console.log(`   📂 Загружено из кэша: ${cached.length} отпечатков`);
            return cached;
        }

        try {
            const userDir = path.join(this.config.dbPath, 'users', userId.toString());

            if (!fsSync.existsSync(userDir)) {
                console.log(`   📂 Папка пользователя не существует: ${userDir}`);
                return [];
            }

            const files = await fs.readdir(userDir);
            const footprints = [];

            console.log(`   📂 Найдено файлов в папке: ${files.length}`);

            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(userDir, file);
                        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

                        const footprint = HybridFootprint.fromJSON(data);
                        footprints.push(footprint);
                        console.log(`      ✅ Загружен: ${footprint.name || file} (${footprint.metadata.photos?.length || 1} фото)`);
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
            console.log(`   📊 Статистика: ${footprint.metadata.photos?.length || 1} фото, уверенность: ${footprint.stats.confidence?.toFixed(3) || 'нет'}`);

            return { success: true, path: filePath };
        } catch (error) {
            console.log('❌ Ошибка сохранения отпечатка:', error);
            return { success: false, error: error.message };
        }
    }

    // 5. ИЗВЛЕЧЕНИЕ ТОЧЕК ИЗ АНАЛИЗА
    extractPointsFromAnalysis(analysis) {
        if (!analysis || !analysis.predictions) {
            console.log('   ⚠️  Нет данных анализа или predictions');
            return [];
        }

        const points = [];
        console.log(`   📊 Всего predictions: ${analysis.predictions.length}`);

        analysis.predictions.forEach((prediction, index) => {
            const confidence = prediction.confidence || 0;
            const isShoeProtector = prediction.class === 'shoe-protector';
           
            if (isShoeProtector || confidence > 0.3) {
                if (prediction.points && prediction.points.length > 0) {
                    // Взять центр точек
                    const xs = prediction.points.map(p => p.x);
                    const ys = prediction.points.map(p => p.y);

                    const centerPoint = {
                        x: (Math.min(...xs) + Math.max(...xs)) / 2,
                        y: (Math.min(...ys) + Math.max(...ys)) / 2,
                        confidence: confidence,
                        class: prediction.class
                    };
                   
                    points.push(centerPoint);
                }
            }
        });

        console.log(`   📍 ИТОГО извлечено точек: ${points.length}`);
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
            dbPath: './test-data/hybrid',
            minSimilarityForSame: 0.8 // Понижаем для тестов
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

        } catch (error) {
            console.log('❌ Ошибка в тесте:', error.message);
            console.log(error.stack);
        }

        // Статистика
        console.log('\n📊 СТАТИСТИКА МЕНЕДЖЕРА:');
        const stats = manager.getStats();
        console.log(`   Всего сравнений: ${stats.totalComparisons}`);
        console.log(`   Решений "same": ${stats.sameDecisions}`);
        console.log(`   Решений "different": ${stats.differentDecisions}`);
        console.log(`   Среднее время: ${stats.avgComparisonTime.toFixed(1)}ms`);
        console.log(`   Отпечатков: ${stats.totalFootprints}`);

        // Очистка тестовых данных
        if (fsSync.existsSync('./test-data/hybrid')) {
            fsSync.rmSync('./test-data/hybrid, { recursive: true, force: true });
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
