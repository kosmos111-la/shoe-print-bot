// modules/footprint/footprint-manager.js
// Главный менеджер, который будет интегрирован в main.js
const FootprintDatabase = require('./footprint-database');

class FootprintManager {
    constructor() {
        this.db = new FootprintDatabase();
        this.initialized = false;
        console.log('👣 FootprintManager создан (УМНАЯ версия)');
    }

    async initialize() {
        if (this.initialized) return true;

        try {
            await this.db.initialize();
            this.initialized = true;
            console.log('✅ FootprintManager инициализирован');
            return true;
        } catch (error) {
            console.log('❌ Ошибка инициализации FootprintManager:', error.message);
            return false;
        }
    }

    // ✅ УЛУЧШЕННЫЙ МЕТОД: СОХРАНИТЬ СЕССИЮ КАК МОДЕЛЬ
    async saveSessionAsModel(session, modelName = null, userId = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!session || !session.analysisResults || session.analysisResults.length === 0) {
            throw new Error('Сессия пуста или не содержит анализов');
        }

        const DigitalFootprint = require('./digital-footprint');
        const footprint = new DigitalFootprint({
            name: modelName || `Сессия_${session.id.slice(0, 8)}`,
            userId: userId || session.userId,
            sessionId: session.id,
            metadata: {
                estimatedSize: this.estimateSizeFromSession(session),
                footprintType: this.determineFootprintType(session),
                orientation: this.calculateAverageOrientation(session),
                photosCount: session.photos.length,
                // ✅ Дополнительные метаданные
                sessionDuration: this.calculateSessionDuration(session),
                avgPhotoQuality: this.calculateAvgPhotoQuality(session),
                hasMultipleAngles: this.checkMultipleAngles(session)
            }
        });

        console.log(`🔄 Создаю модель из ${session.analysisResults.length} анализов...`);

        // ✅ ПОДРОБНОЕ ЛОГИРОВАНИЕ
        console.log(`📸 Фото в сессии: ${session.photos.length}`);
        console.log(`🔍 Анализов в сессии: ${session.analysisResults.length}`);

        // Агрегируем все анализы сессии
        session.analysisResults.forEach((analysis, index) => {
            // Находим соответствующее фото из сессии
            const photo = session.photos[index];

            if (!photo) {
                console.log(`⚠️ Нет фото для анализа ${index}`);
                return;
            }

            // ✅ ПРОВЕРЯЕМ ЧТО ЕСТЬ ПУТЬ К ФОТО
            let localPhotoPath = null;
            const possiblePaths = [
                photo.localPath,
                photo.filePath,
                photo.path,
                analysis.localPhotoPath,
                analysis.imagePath
            ].filter(p => p && typeof p === 'string');

            for (const path of possiblePaths) {
                const fs = require('fs');
                if (fs.existsSync(path)) {
                    localPhotoPath = path;
                    console.log(`✅ Нашел фото для анализа ${index}: ${path}`);
                    break;
                }
            }

            if (!localPhotoPath) {
                console.log(`⚠️ Не найден локальный файл фото для анализа ${index}`);
            }

            // ✅ ПЕРЕДАЕМ ВСЕ ВОЗМОЖНЫЕ ПУТИ К ФОТО
            const sourceInfo = {
                sessionId: session.id,
                analysisIndex: index,
                photoId: photo?.fileId,
                timestamp: analysis.timestamp || new Date(),
                // Пути к фото
                localPath: localPhotoPath,
                imagePath: localPhotoPath,
                localPhotoPath: localPhotoPath,
                photoPath: photo?.fileUrl,
                filePath: localPhotoPath,
                // Информация о качестве
                photoQuality: photo?.quality || analysis.photoQuality || 0.5,
                // ✅ Дополнительная информация
                batchInfo: analysis.batchInfo || { index: index + 1, total: session.analysisResults.length },
                hasVisualization: !!(analysis.visualizationPaths?.analysis),
                hasTopology: !!(analysis.visualizationPaths?.topology)
            };

            // Добавляем анализ с путями к фото
            try {
                const added = footprint.addAnalysis(analysis, sourceInfo);

                console.log(`   Анализ ${index + 1}: добавлено ${added.added} узлов, фото: ${localPhotoPath ? '✅' : '❌'}`);

                // ✅ ПОДРОБНАЯ СТАТИСТИКА
                if (added.contours > 0) {
                    console.log(`       🔵 Контуров: ${added.contours}`);
                }
                if (added.heels > 0) {
                    console.log(`       👠 Каблуков: ${added.heels}`);
                }

            } catch (addError) {
                console.log(`❌ Ошибка добавления анализа ${index}:`, addError.message);
            }
        });

        // ✅ ПРОВЕРЯЕМ ЧТО МОДЕЛЬ СОЗДАНА
        if (footprint.nodes.size === 0) {
            throw new Error('Не удалось создать модель: нет узлов протектора');
        }

        console.log(`📊 Итог модели: ${footprint.nodes.size} узлов, ${footprint.allContours?.length || 0} контуров`);

        // ✅ ОБНОВЛЯЕМ МЕТАДАННЫЕ НА ОСНОВЕ РЕЗУЛЬТАТОВ
        this.updateMetadataFromResults(footprint, session);

        // ✅ ПРОВЕРЯЕМ ЧТО ЕСТЬ КОНТУРЫ
        if (!footprint.allContours || footprint.allContours.length === 0) {
            console.log('⚠️ В модели нет контуров');
        } else {
            console.log(`✅ Контуров сохранено: ${footprint.allContours.length}`);
        }

        // Сохраняем в базу
        const saved = await this.db.save(footprint);

        if (!saved) {
            throw new Error('Не удалось сохранить модель в базу');
        }

        // Ищем похожие модели
        const similar = await this.db.findSimilar(
            session.analysisResults[0],
            { userId, threshold: 0.7, limit: 3 }
        );

        return {
            footprint: saved,
            similar: similar.filter(s => s.footprint.id !== saved.id),
            stats: {
                nodes: saved.nodes.size,
                edges: saved.edges.length,
                confidence: saved.stats.confidence,
                sources: saved.stats.totalSources,
                photos: saved.stats.totalPhotos,
                // ✅ ДОПОЛНИТЕЛЬНАЯ СТАТИСТИКА
                contours: saved.allContours?.length || 0,
                heels: saved.allHeels?.length || 0,
                avgPhotoQuality: saved.stats.avgPhotoQuality,
                hasBestPhoto: !!saved.bestPhotoInfo
            }
        };
    }

    // ✅ НОВЫЙ МЕТОД: Обновляем метаданные на основе результатов
    updateMetadataFromResults(footprint, session) {
        if (!session.analysisResults || session.analysisResults.length === 0) return;

        // Собираем информацию из всех анализов
        const allSizes = [];
        const allTypes = [];
        const allOrientations = [];

        session.analysisResults.forEach(analysis => {
            if (analysis.intelligentAnalysis?.summary) {
                const summary = analysis.intelligentAnalysis.summary;

                if (summary.sizeEstimation) {
                    allSizes.push(summary.sizeEstimation);
                }

                if (summary.footprintType && summary.footprintType !== 'unknown') {
                    allTypes.push(summary.footprintType);
                }

                if (summary.orientation) {
                    const match = summary.orientation.match(/(\d+)/);
                    if (match) {
                        allOrientations.push(parseInt(match[1]));
                    }
                }
            }
        });

        // Обновляем метаданные
        if (allSizes.length > 0) {
            footprint.metadata.estimatedSize = this.calculateAverageSize(allSizes);
        }

        if (allTypes.length > 0) {
            footprint.metadata.footprintType = this.getMostFrequentType(allTypes);
        }

        if (allOrientations.length > 0) {
            footprint.metadata.orientation = this.calculateAverageOrientationArray(allOrientations);
        }

        console.log(`📋 Метаданные обновлены: размер=${footprint.metadata.estimatedSize || 'неизвестно'}, тип=${footprint.metadata.footprintType}`);
    }

    // ✅ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ МЕТАДАННЫХ
    calculateAverageSize(sizes) {
        if (!sizes || sizes.length === 0) return null;

        // Преобразуем строки в числа (если нужно)
        const numericSizes = sizes.map(size => {
            if (typeof size === 'string') {
                const match = size.match(/(\d+)/);
                return match ? parseInt(match[1]) : null;
            }
            return size;
        }).filter(Boolean);

        if (numericSizes.length === 0) return null;

        const avg = numericSizes.reduce((sum, size) => sum + size, 0) / numericSizes.length;
        return Math.round(avg);
    }

    getMostFrequentType(types) {
        const frequency = {};
        types.forEach(type => {
            frequency[type] = (frequency[type] || 0) + 1;
        });

        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    calculateAverageOrientationArray(orientations) {
        if (!orientations || orientations.length === 0) return 0;

        // Усреднение углов (учитываем циклическую природу)
        const sinSum = orientations.reduce((sum, angle) => sum + Math.sin(angle * Math.PI / 180), 0);
        const cosSum = orientations.reduce((sum, angle) => sum + Math.cos(angle * Math.PI / 180), 0);

        return Math.round(Math.atan2(sinSum, cosSum) * 180 / Math.PI);
    }

    calculateSessionDuration(session) {
        if (!session.startTime || !session.photos || session.photos.length === 0) {
            return 0;
        }

        const lastPhoto = session.photos[session.photos.length - 1];
        if (!lastPhoto.timestamp) return 0;

        const duration = (new Date(lastPhoto.timestamp) - new Date(session.startTime)) / 1000; // секунды
        return Math.round(duration);
    }

    calculateAvgPhotoQuality(session) {
        if (!session.analysisResults || session.analysisResults.length === 0) {
            return 0.5;
        }

        const qualities = session.analysisResults
            .map(a => a.photoQuality)
            .filter(q => q !== undefined);

        if (qualities.length === 0) return 0.5;

        return qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    }

    checkMultipleAngles(session) {
        if (!session.analysisResults || session.analysisResults.length < 2) {
            return false;
        }

        // Простая проверка: если есть анализы с разной ориентацией
        const orientations = [];
        session.analysisResults.forEach(analysis => {
            if (analysis.intelligentAnalysis?.summary?.orientation) {
                const match = analysis.intelligentAnalysis.summary.orientation.match(/(\d+)/);
                if (match) {
                    orientations.push(parseInt(match[1]));
                }
            }
        });

        if (orientations.length < 2) return false;

        // Проверяем разброс ориентаций
        const minOrientation = Math.min(...orientations);
        const maxOrientation = Math.max(...orientations);
        return (maxOrientation - minOrientation) > 30; // Разница более 30 градусов
    }

    // ПОИСК ПОХОЖИХ ДЛЯ АНАЛИЗА
    async findSimilarForAnalysis(analysis, userId = null, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        return await this.db.findSimilar(analysis, {
            userId,
            threshold: options.threshold || 0.6,
            limit: options.limit || 5,
            quickFirst: true
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Умный поиск похожих с топологической коррекцией
    async findSimilarWithTopologyCorrection(analysis, userId, options = {}) {
        console.log('🔍 Запускаю УМНЫЙ поиск с топологической коррекцией');

        if (!this.initialized) await this.initialize();

        // 1. Создаем временную модель из анализа
        const tempFootprint = this.createFootprintFromAnalysis(analysis, userId);

        // 2. Нормализуем её топологию
        tempFootprint.updateTopologyInvariants();

        // 3. Получаем все модели пользователя
        const userModels = await this.getUserModels(userId);
        if (!userModels || userModels.length === 0) return [];

        // 4. Сравниваем с каждой моделью
        const comparisons = [];

        for (const model of userModels) {
            try {
                // Обновляем инварианты модели (если ещё не обновлены)
                if (!model.topologyInvariants || !model.topologyInvariants.normalizedNodes) {
                    model.updateTopologyInvariants();
                }

                // УЛУЧШЕННОЕ сравнение
                const comparison = tempFootprint.compareEnhanced(model);

                if (comparison.score >= (options.threshold || 0.6)) {
                    comparisons.push({
                        footprint: model,
                        score: comparison.score,
                        details: comparison.details,
                        isMirrored: comparison.isMirrored
                    });
                }
            } catch (error) {
                console.log(`⚠️ Ошибка сравнения с моделью ${model.id}:`, error.message);
            }
        }

        // 5. Сортируем по убыванию оценки
        comparisons.sort((a, b) => b.score - a.score);

        // 6. Ограничиваем количество результатов
        const limit = options.limit || 5;
        const results = comparisons.slice(0, limit);

        console.log(`✅ Найдено ${results.length} похожих моделей`);

        return results;
    }

    // ПОЛУЧИТЬ МОДЕЛИ ПОЛЬЗОВАТЕЛЯ
    async getUserModels(userId) {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.db.getByUser(userId);
    }

    // УДАЛИТЬ МОДЕЛЬ
    async deleteModel(modelId, userId) {
        if (!this.initialized) {
            await this.initialize();
        }

        return await this.db.delete(modelId, userId);
    }

    // СТАТИСТИКА
    async getStats() {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.db.getStats();
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (оставлены для обратной совместимости)
    estimateSizeFromSession(session) {
        if (!session.analysisResults || session.analysisResults.length === 0) {
            return null;
        }

        // Берем размер из первого анализа с интеллектуальным анализом
        const firstWithIntel = session.analysisResults.find(a => a.intelligentAnalysis);
        if (firstWithIntel?.intelligentAnalysis?.summary?.sizeEstimation) {
            return firstWithIntel.intelligentAnalysis.summary.sizeEstimation;
        }

        return null;
    }

    determineFootprintType(session) {
        if (!session.analysisResults || session.analysisResults.length === 0) {
            return 'unknown';
        }

        // Анализируем типы следов в сессии
        const types = session.analysisResults
            .map(a => a.intelligentAnalysis?.summary?.footprintType)
            .filter(Boolean);

        if (types.length === 0) return 'unknown';

        // Находим самый частый тип
        const frequency = {};
        types.forEach(type => {
            frequency[type] = (frequency[type] || 0) + 1;
        });

        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    calculateAverageOrientation(session) {
        if (!session.analysisResults || session.analysisResults.length === 0) {
            return 0;
        }

        const orientations = session.analysisResults
            .map(a => {
                const orient = a.intelligentAnalysis?.summary?.orientation;
                if (!orient) return null;

                const match = orient.match(/(\d+)/);
                return match ? parseInt(match[1]) : null;
            })
            .filter(Boolean);

        if (orientations.length === 0) return 0;

        // Усреднение углов (учитываем циклическую природу)
        const sinSum = orientations.reduce((sum, angle) => sum + Math.sin(angle * Math.PI / 180), 0);
        const cosSum = orientations.reduce((sum, angle) => sum + Math.cos(angle * Math.PI / 180), 0);

        return Math.round(Math.atan2(sinSum, cosSum) * 180 / Math.PI);
    }

    // СОЗДАТЬ FOOTPRINT ИЗ ОДНОГО АНАЛИЗА (для поиска)
    createFootprintFromAnalysis(analysis, userId = null) {
        const DigitalFootprint = require('./digital-footprint');
        const footprint = new DigitalFootprint({
            name: 'Временная модель для поиска',
            userId
        });

        footprint.addAnalysis(analysis, {
            type: 'search',
            timestamp: new Date()
        });

        return footprint;
    }
}

// Экспортируем синглтон
module.exports = new FootprintManager();
