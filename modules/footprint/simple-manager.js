// modules/footprint/simple-manager.js
const fs = require('fs');
const path = require('path');
const { DatabaseManager } = require('./database-manager');
const { Visualizer } = require('./visualizer');
const { VectorModelBuilder } = require('./vector-model-builder');
const { FootprintAligner } = require('./footprint-aligner');
const { TemplateUpdater } = require('./template-updater');

class SimpleFootprintManager {
    constructor(config = {}) {
        this.config = {
            databasePath: './data/footprint-database.json',
            visualizationPath: './data/visualizations',
            enableMergeVisualization: true,
            enableTemplateVisualization: true,
            enableAlignment: true,
            minSimilarity: 0.6,
            debugMode: false,
            ...config
        };

        this.database = new DatabaseManager(this.config.databasePath);
        this.visualizer = new Visualizer({
            outputPath: this.config.visualizationPath,
            debugMode: this.config.debugMode
        });
        this.vectorModelBuilder = new VectorModelBuilder();
        this.footprintAligner = new FootprintAligner();
        this.templateUpdater = new TemplateUpdater();
       
        this.sessions = new Map();
       
        // Создаем директории
        this.ensureDirectoryExists(this.config.visualizationPath);
        console.log(`✅ SimpleFootprintManager инициализирован`);
    }

    /**
     * Создает директорию если она не существует
     */
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Создана директория: ${dirPath}`);
        }
    }

    /**
     * Создает новую сессию для пользователя
     */
    createSession(userId) {
        const session = {
            userId: userId,
            photos: [],
            currentFootprint: null,
            vectorModel: null,
            lastTransformation: null,
            timestamp: Date.now()
        };
       
        this.sessions.set(userId, session);
        console.log(`🆕 Создана новая сессия для пользователя ${userId}`);
        return session;
    }

    /**
     * Получает сессию пользователя
     */
    getSession(userId) {
        if (!this.sessions.has(userId)) {
            return this.createSession(userId);
        }
        return this.sessions.get(userId);
    }

    /**
     * Добавляет фото в сессию и обновляет отпечаток
     */
    async addPhotoToSession(userId, photoData, bot = null, chatId = null) {
        try {
            const session = this.getSession(userId);
            console.log(`\n=== 📸 ДОБАВЛЕНИЕ ФОТО ${session.photos.length + 1} ДЛЯ ${userId} ===`);
           
            // Сохраняем фото в сессию
            session.photos.push({
                id: photoData.id || Date.now(),
                points: photoData.points,
                timestamp: Date.now()
            });
           
            let updatedFromTemplate = 0;
            let directUpdates = 0;
           
            // 🔥 ШАГ 1: Если это первое фото - создаем базовый отпечаток
            if (session.photos.length === 1) {
                console.log(`🆕 Первое фото в сессии, создаю базовый отпечаток...`);
                session.currentFootprint = this.createInitialFootprint(photoData.points);
                console.log(`✅ Создан отпечаток с ${session.currentFootprint.length} точками`);
            } else {
                // 🔥 ШАГ 2: Выравнивание с предыдущими фото
                let comparisonResult = null;
                let vectorModel = session.vectorModel;
               
                if (this.config.enableAlignment && vectorModel) {
                    console.log(`🔄 Выравниваю с использованием векторной модели...`);
                    comparisonResult = await this.footprintAligner.compareWithAlignment(
                        photoData.points,
                        vectorModel,
                        session.currentFootprint,
                        session.lastTransformation
                    );
                } else {
                    console.log(`🔍 Сравниваю точки напрямую...`);
                    comparisonResult = this.compareFootprints(photoData.points, session.currentFootprint);
                }
               
                const similarity = comparisonResult.similarity || 0;
                console.log(`📊 Сходство: ${similarity.toFixed(3)}`);
               
                if (similarity < this.config.minSimilarity) {
                    console.log(`⚠️ Сходство ${similarity.toFixed(3)} < ${this.config.minSimilarity}, фото игнорируется`);
                    return {
                        success: false,
                        similarity: similarity,
                        message: 'Фото слишком отличается от предыдущих'
                    };
                }
               
                // 🔥 ШАГ 3: Обновляем отпечаток
                console.log(`🔄 Обновляю отпечаток...`);
                const updateResult = this.updateFootprintWithPhoto(
                    session.currentFootprint,
                    photoData.points,
                    comparisonResult
                );
               
                updatedFromTemplate = updateResult.updatedFromTemplate;
                directUpdates = updateResult.directUpdates;
               
                console.log(`✅ Обновлено ${directUpdates} точек напрямую, ${updatedFromTemplate} из шаблона`);
               
                // 🔥 ШАГ 4: Обновляем векторную модель
                console.log(`📊 Обновляю векторную модель...`);
                vectorModel = this.vectorModelBuilder.updateModel(
                    vectorModel,
                    session.currentFootprint,
                    session.photos.length
                );
                session.vectorModel = vectorModel;
                session.lastTransformation = comparisonResult.transformation;
               
                // 🔥 ВИЗУАЛИЗАЦИЯ ПОДТВЕРЖДЕНИЙ
                let clusterVizResult = null;
                if (this.config.enableMergeVisualization) {
                    console.log(`🎨 Создаю визуализацию подтверждений...`);

                    clusterVizResult = await this.visualizeSingleFootprintConfirmations(
                        session.currentFootprint,
                        userId,
                        {
                            currentTransformation: comparisonResult.transformation,
                            previousTransformation: session.lastTransformation,
                            comparisonResult: comparisonResult
                        }
                    );

                    // 🔥 ВАЖНО: Проверяем результат визуализации
                    if (clusterVizResult && clusterVizResult.path) {
                        console.log(`✅ Визуализация создана: ${clusterVizResult.path}`);
                    } else {
                        console.log(`⚠️ Визуализация не создана или путь отсутствует`);
                    }
                }

                // 🔥 ВИЗУАЛИЗАЦИЯ ВЫРАВНИВАНИЯ (если есть результат от алайнера)
                let alignmentVizPath = null;
                if (comparisonResult.alignment && comparisonResult.alignment.visualization) {
                    alignmentVizPath = comparisonResult.alignment.visualization;
                    console.log(`🎨 Визуализация выравнивания: ${alignmentVizPath}`);
                }

                // 🔥 ВИЗУАЛИЗАЦИЯ ШАБЛОНА
                let templateVizPath = null;
                if (this.config.enableTemplateVisualization && vectorModel) {
                    templateVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);
                }

                // 🔥 РЕАЛЬНАЯ СТАТИСТИКА
                const stats = this.calculateConfirmationStats(session.currentFootprint);
                console.log(`📊 РЕАЛЬНАЯ СТАТИСТИКА ПОСЛЕ ${session.photos.length} ФОТО:`);
                console.log(`   • Всего точек: ${stats.totalPoints}`);
                console.log(`   • 🔴 Красные (2+): ${stats.confirmed2}`);
                console.log(`   • 🔵 Синие (1): ${stats.confirmed1}`);
                console.log(`   • ⚪️ Серые (0): ${stats.confirmed0}`);

                // 🔥 ОТПРАВКА В TELEGRAM
                if (bot && chatId) {
                    // Отправляем визуализацию подтверждений
                    if (clusterVizResult && clusterVizResult.path && this.fileExists(clusterVizResult.path)) {
                        try {
                            let caption = `🎯 <b>РЕАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ</b>\n\n`;
                            caption += `📊 Сходство: ${(similarity * 100).toFixed(1)}%\n`;
                           
                            if (comparisonResult.transformation && comparisonResult.transformation.rotationAngle) {
                                caption += `📐 Угол: ${comparisonResult.transformation.rotationAngle.toFixed(1)}°\n`;
                            }
                           
                            caption += `🔄 Метод сравнения: ${comparisonResult.method || 'alignment_based'}\n`;

                            if (comparisonResult.alignment && comparisonResult.alignment.quality) {
                                caption += `🎯 Качество выравнивания: ${(comparisonResult.alignment.quality * 100).toFixed(1)}%\n`;
                            }

                            caption += `\n📈 <b>СТАТИСТИКА (после ${session.photos.length} фото):</b>\n`;
                            caption += `• Всего точек: ${stats.totalPoints}\n`;
                            caption += `• 🔴 2+ подтверждений: ${stats.confirmed2}\n`;
                            caption += `• 🔵 1 подтверждение: ${stats.confirmed1}\n`;
                            caption += `• ⚪️ 0 подтверждений: ${stats.confirmed0}\n\n`;
                            caption += `🔄 Обновлено из шаблона: ${updatedFromTemplate} точек\n`;
                            caption += `🎯 Прямо обновлено: ${directUpdates} точек`;

                            console.log(`📤 Отправляю визуализацию в Telegram...`);
                            console.log(`📷 Путь к изображению: ${clusterVizResult.path}`);

                            await bot.sendPhoto(chatId, clusterVizResult.path, {
                                caption: caption,
                                parse_mode: 'HTML'
                            });
                            console.log('✅ Визуализация отправлена');

                            // 🔥 Дополнительно отправляем визуализацию выравнивания если есть
                            if (alignmentVizPath && this.fileExists(alignmentVizPath)) {
                                console.log(`📤 Отправляю визуализацию выравнивания в Telegram...`);
                                await bot.sendPhoto(chatId, alignmentVizPath, {
                                    caption: `🔄 <b>Визуализация выравнивания</b>\n${comparisonResult.reason || ''}`,
                                    parse_mode: 'HTML'
                                });
                                console.log('✅ Визуализация выравнивания отправлена');
                            }

                            // 🔥 Отправляем визуализацию шаблона если есть
                            if (templateVizPath && templateVizPath.template && this.fileExists(templateVizPath.template)) {
                                console.log(`📤 Отправляю визуализацию шаблона в Telegram...`);
                                await bot.sendPhoto(chatId, templateVizPath.template, {
                                    caption: `📊 <b>Шаблон после ${session.photos.length} фото</b>\n• Ячеек: ${templateVizPath.stats?.cells || 0}\n• Подтверждений: ${templateVizPath.stats?.totalConfirmations || 0}`,
                                    parse_mode: 'HTML'
                                });
                                console.log('✅ Визуализация шаблона отправлена');
                            }

                        } catch (sendError) {
                            console.log('❌ Ошибка отправки в Telegram:', sendError.message);
                        }
                    } else {
                        console.log('⚠️ Нет визуализации для отправки в Telegram или файл не существует');
                    }
                }
               
                // 🔥 ШАГ 5: Сохраняем в базу данных
                await this.saveToDatabase(userId, session);
               
                return {
                    success: true,
                    similarity: similarity,
                    footprint: session.currentFootprint,
                    stats: stats,
                    photosCount: session.photos.length,
                    updatedFromTemplate: updatedFromTemplate,
                    directUpdates: directUpdates,
                    visualizations: {
                        confirmations: clusterVizResult?.path,
                        alignment: alignmentVizPath,
                        template: templateVizPath?.template
                    }
                };
            }
           
            return {
                success: true,
                photosCount: session.photos.length,
                footprint: session.currentFootprint
            };
           
        } catch (error) {
            console.error('❌ Ошибка при добавлении фото:', error);
            throw error;
        }
    }

    /**
     * Проверяет существование файла
     */
    fileExists(filePath) {
        try {
            return fs.existsSync(filePath);
        } catch (error) {
            console.log(`❌ Ошибка проверки файла ${filePath}:`, error.message);
            return false;
        }
    }

    /**
     * Создает начальный отпечаток из первого фото
     */
    createInitialFootprint(points) {
        return points.map(point => ({
            x: point.x,
            y: point.y,
            confirmations: 1,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            sources: [{
                photoId: 1,
                timestamp: Date.now(),
                x: point.x,
                y: point.y
            }]
        }));
    }

    /**
     * Сравнивает два отпечатка
     */
    compareFootprints(newPoints, existingFootprint) {
        const THRESHOLD = 10; // пикселей
       
        let matched = 0;
        const transformation = {
            rotationAngle: 0,
            scale: 1,
            translation: { x: 0, y: 0 },
            method: 'direct_comparison'
        };
       
        // Простое сравнение расстояний
        for (const newPoint of newPoints) {
            let minDistance = Infinity;
           
            for (const existingPoint of existingFootprint) {
                const distance = Math.sqrt(
                    Math.pow(newPoint.x - existingPoint.x, 2) +
                    Math.pow(newPoint.y - existingPoint.y, 2)
                );
               
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
           
            if (minDistance < THRESHOLD) {
                matched++;
            }
        }
       
        const similarity = matched / Math.max(newPoints.length, existingFootprint.length);
       
        return {
            similarity: similarity,
            matchedPoints: matched,
            transformation: transformation,
            method: 'direct_comparison'
        };
    }

    /**
     * Обновляет отпечаток с новым фото
     */
    updateFootprintWithPhoto(footprint, newPoints, comparisonResult) {
        const THRESHOLD = 10; // пикселей
        let updatedFromTemplate = 0;
        let directUpdates = 0;
       
        // Если есть трансформация - применяем ее к новым точкам
        let transformedNewPoints = newPoints;
        if (comparisonResult.transformation) {
            transformedNewPoints = this.applyTransformation(newPoints, comparisonResult.transformation);
        }
       
        // Обновляем существующие точки
        for (const newPoint of transformedNewPoints) {
            let closestIndex = -1;
            let minDistance = Infinity;
           
            // Ищем ближайшую точку
            for (let i = 0; i < footprint.length; i++) {
                const existingPoint = footprint[i];
                const distance = Math.sqrt(
                    Math.pow(newPoint.x - existingPoint.x, 2) +
                    Math.pow(newPoint.y - existingPoint.y, 2)
                );
               
                if (distance < minDistance && distance < THRESHOLD) {
                    minDistance = distance;
                    closestIndex = i;
                }
            }
           
            if (closestIndex !== -1) {
                // Обновляем существующую точку
                footprint[closestIndex].confirmations++;
                footprint[closestIndex].lastSeen = Date.now();
                footprint[closestIndex].sources.push({
                    photoId: footprint[closestIndex].sources.length + 1,
                    timestamp: Date.now(),
                    x: newPoint.x,
                    y: newPoint.y
                });
                directUpdates++;
            } else {
                // Добавляем новую точку
                footprint.push({
                    x: newPoint.x,
                    y: newPoint.y,
                    confirmations: 1,
                    firstSeen: Date.now(),
                    lastSeen: Date.now(),
                    sources: [{
                        photoId: 1,
                        timestamp: Date.now(),
                        x: newPoint.x,
                        y: newPoint.y
                    }]
                });
            }
        }
       
        // Обновляем из шаблона если есть
        if (comparisonResult.templateUpdates) {
            updatedFromTemplate = comparisonResult.templateUpdates.length;
        }
       
        return {
            updatedFromTemplate: updatedFromTemplate,
            directUpdates: directUpdates
        };
    }

    /**
     * Применяет трансформацию к точкам
     */
    applyTransformation(points, transformation) {
        if (!transformation || transformation.rotationAngle === 0) {
            return points;
        }
       
        const angleRad = (transformation.rotationAngle * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const scale = transformation.scale || 1;
       
        return points.map(point => {
            // Поворачиваем вокруг центра
            const x = point.x * cos - point.y * sin;
            const y = point.x * sin + point.y * cos;
           
            // Масштабируем
            const scaledX = x * scale;
            const scaledY = y * scale;
           
            // Сдвигаем
            return {
                x: scaledX + (transformation.translation?.x || 0),
                y: scaledY + (transformation.translation?.y || 0)
            };
        });
    }

    /**
     * Создает визуализацию подтверждений для одного отпечатка
     */
    async visualizeSingleFootprintConfirmations(footprint, userId, context = {}) {
        try {
            console.log(`🎨 Визуализация подтверждений для ${userId}...`);
            console.log(`📊 Точек для визуализации: ${footprint.length}`);
           
            const vizResult = await this.visualizer.visualizeFootprintConfirmations(
                footprint,
                userId,
                context
            );
           
            if (vizResult && vizResult.path) {
                console.log(`✅ Визуализация сохранена: ${vizResult.path}`);
                return vizResult;
            } else {
                console.log(`❌ Визуализация не создана`);
                return null;
            }
        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return null;
        }
    }

    /**
     * Визуализирует векторную модель
     */
    async visualizeVectorSuperModel(userId, vectorModel) {
        try {
            if (!vectorModel || !vectorModel.cells || vectorModel.cells.length === 0) {
                console.log(`⚠️ Нет данных для визуализации шаблона`);
                return null;
            }
           
            console.log(`🎨 Визуализация векторной модели для ${userId}...`);
            console.log(`📊 Ячеек в модели: ${vectorModel.cells.length}`);
           
            const vizResult = await this.visualizer.visualizeVectorSuperModel(
                vectorModel,
                userId
            );
           
            if (vizResult && vizResult.path) {
                console.log(`✅ Визуализация шаблона сохранена: ${vizResult.path}`);
               
                // Подсчитываем статистику
                const stats = {
                    cells: vectorModel.cells.length,
                    totalConfirmations: vectorModel.cells.reduce((sum, cell) => sum + (cell.confirmations || 0), 0),
                    avgConfirmations: vectorModel.cells.reduce((sum, cell) => sum + (cell.confirmations || 0), 0) / vectorModel.cells.length
                };
               
                return {
                    template: vizResult.path,
                    stats: stats
                };
            }
           
            return null;
        } catch (error) {
            console.error('❌ Ошибка визуализации шаблона:', error);
            return null;
        }
    }

    /**
     * Вычисляет статистику подтверждений
     */
    calculateConfirmationStats(footprint) {
        if (!footprint || footprint.length === 0) {
            return {
                totalPoints: 0,
                confirmed0: 0,
                confirmed1: 0,
                confirmed2: 0,
                confirmed3: 0,
                confirmed4: 0,
                confirmed5: 0,
                avgConfirmations: 0
            };
        }
       
        const stats = {
            totalPoints: footprint.length,
            confirmed0: 0,
            confirmed1: 0,
            confirmed2: 0,
            confirmed3: 0,
            confirmed4: 0,
            confirmed5: 0
        };
       
        for (const point of footprint) {
            const confirmations = point.confirmations || 0;
           
            if (confirmations === 0) stats.confirmed0++;
            else if (confirmations === 1) stats.confirmed1++;
            else if (confirmations === 2) stats.confirmed2++;
            else if (confirmations === 3) stats.confirmed3++;
            else if (confirmations === 4) stats.confirmed4++;
            else if (confirmations >= 5) stats.confirmed5++;
        }
       
        stats.avgConfirmations = footprint.reduce((sum, point) => sum + (point.confirmations || 0), 0) / footprint.length;
       
        return stats;
    }

    /**
     * Сохраняет сессию в базу данных
     */
    async saveToDatabase(userId, session) {
        try {
            await this.database.saveUserFootprint(userId, {
                footprint: session.currentFootprint,
                vectorModel: session.vectorModel,
                photosCount: session.photos.length,
                lastUpdated: Date.now(),
                stats: this.calculateConfirmationStats(session.currentFootprint)
            });
           
            console.log(`💾 Сессия сохранена в базу данных для ${userId}`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения в базу данных:', error);
            return false;
        }
    }

    /**
     * Загружает сессию из базу данных
     */
    async loadFromDatabase(userId) {
        try {
            const data = await this.database.getUserFootprint(userId);
           
            if (data) {
                const session = {
                    userId: userId,
                    photos: [],
                    currentFootprint: data.footprint || [],
                    vectorModel: data.vectorModel || null,
                    lastTransformation: null,
                    timestamp: data.lastUpdated || Date.now()
                };
               
                // Восстанавливаем количество фото из данных
                for (let i = 0; i < (data.photosCount || 0); i++) {
                    session.photos.push({
                        id: i + 1,
                        timestamp: data.lastUpdated || Date.now()
                    });
                }
               
                this.sessions.set(userId, session);
                console.log(`📂 Сессия загружена из БД для ${userId}`);
                return session;
            }
           
            return null;
        } catch (error) {
            console.error('❌ Ошибка загрузки из БД:', error);
            return null;
        }
    }

    /**
     * Получает статистику по сессии
     */
    getSessionStats(userId) {
        const session = this.getSession(userId);
        if (!session || !session.currentFootprint) {
            return null;
        }
       
        return {
            userId: userId,
            photosCount: session.photos.length,
            footprintPoints: session.currentFootprint.length,
            stats: this.calculateConfirmationStats(session.currentFootprint),
            hasVectorModel: !!session.vectorModel,
            lastActivity: session.timestamp
        };
    }

    /**
     * Сбрасывает сессию пользователя
     */
    resetSession(userId) {
        if (this.sessions.has(userId)) {
            this.sessions.delete(userId);
            console.log(`🔄 Сессия сброшена для ${userId}`);
            return true;
        }
        return false;
    }

    /**
     * Экспортирует отпечаток
     */
    exportFootprint(userId, format = 'json') {
        const session = this.getSession(userId);
        if (!session || !session.currentFootprint) {
            return null;
        }
       
        if (format === 'json') {
            return {
                userId: userId,
                footprint: session.currentFootprint,
                stats: this.calculateConfirmationStats(session.currentFootprint),
                photosCount: session.photos.length,
                exportedAt: Date.now()
            };
        }
       
        return null;
    }
}

module.exports = { SimpleFootprintManager };
