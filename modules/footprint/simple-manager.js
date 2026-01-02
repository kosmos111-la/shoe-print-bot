// modules/footprint/simple-manager.js
// УПРОЩЕННЫЙ МЕНЕДЖЕР ЦИФРОВЫХ ОТПЕЧАТКОВ С АВТОСОВМЕЩЕНИЕМ И POINT TRACKER

const fs = require('fs');
const path = require('path');
const SimpleFootprint = require('./simple-footprint');
const SimpleMatcher = require('./simple-matcher');
const MergeVisualizer = require('./merge-visualizer');
const VectorSuperModel = require('./vector-super-model');
const crypto = require('crypto');
const { createCanvas } = require('canvas');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,

            // 🔥 ВАЖНЫЕ НАСТРОЙКИ ДЛЯ ПОДТВЕРЖДЕНИЙ
            usePointTracker: true, // Всегда использовать PointTracker
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableIntelligentMerge: options.enableIntelligentMerge !== false,
            enableTopologySuperModel: options.enableTopologySuperModel !== false,

            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            highConfidenceThreshold: options.highConfidenceThreshold || 0.8,
            minPointsForFootprint: options.minPointsForFootprint || 5,

            // Настройки PointTracker
            trackerConfirmationThreshold: 2, // Минимум 2 подтверждения для высокой уверенности
            ...options
        };

        // Сессии пользователей: userId -> session
        this.userSessions = new Map();

        // Загруженные модели: modelId -> SimpleFootprint
        this.loadedModels = new Map();

        // Визуализатор объединений
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        // Матчер для сравнения графов
        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        // История последних визуализаций объединения: userId -> [{path, timestamp, similarity}]
        this.lastMergeVisualizations = new Map();

        // Добавить векторные супер-модели
        this.vectorSuperModels = new Map(); // userId -> VectorSuperModel

        // Статистика системы
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulMerges: 0,
            totalPhotosProcessed: 0,
            trackerConfirmations: 0,
            lastActivity: new Date()
        };

        // Обеспечиваем существование директорий
        this.ensureDirectories();

        // Загружаем существующие модели
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager инициализирован`);
        console.log(`   📁 База данных: ${this.config.dbPath}`);
        console.log(`   🎯 Auto Alignment: ${this.config.autoAlignment ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎨 Визуализация объединения: ${this.config.enableMergeVisualization ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎯 PointTracker: ВКЛ (подтверждения узлов)`);
        console.log(`   🏗️  VectorSuperModel: ВКЛ`);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД addPhotoToSession
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО В СЕССИЮ (упрощенная версия)`);

        try {
            // Проверяем анализ
            if (!analysis || !analysis.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // Извлекаем точки
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < 5) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            console.log(`🔍 Извлечено ${points.length} точек протекторов`);

            // Получаем или создаем сессию
            let session = this.userSessions.get(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                // 🔥 ИСПРАВЛЕНИЕ: проверка на существование id
                console.log(`🆕 Создана новая сессия: ${session.id ? session.id.slice(0, 8) : 'unknown'}...`);
            }

            // Обновляем сессию
            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length
            });
            session.lastActivity = new Date();

            // Если нет текущего отпечатка - создаем
            if (!session.currentFootprint) {
                console.log(`👣 Создаю новый отпечаток (первое фото)`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
                });

                // Добавляем анализ
                const addResult = session.currentFootprint.addAnalysis(analysis, photoInfo);

                // Создаем векторную супер-модель
                const vectorModel = new VectorSuperModel({
                    name: `Супер-модель_${String(userId).slice(0, 6)}`
                });
                vectorModel.addGraph(session.currentFootprint.graph, session.currentFootprint.id);
                this.vectorSuperModels.set(userId, vectorModel);

                console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);

                return {
                    success: true,
                    isNewSession: true,
                    nodesAdded: addResult.added,
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    sessionId: session.id
                };
            }

            // Есть существующий отпечаток - сравниваем
            console.log(`🔍 Сравниваю с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Создаем временный отпечаток для сравнения
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`
            });
            const tempResult = tempFootprint.addAnalysis(analysis, photoInfo);

            // 🔥 ИСПРАВЛЕНИЕ: Правильный вызов matcher
            const alignmentResult = this.matcher.compareGraphs(
                session.currentFootprint.graph,
                tempFootprint.graph,
                { userId: userId, photoId: photoInfo.photoId }
            );

            console.log(`📊 Результат сравнения: similarity=${alignmentResult.similarity.toFixed(3)}, decision=${alignmentResult.decision}`);

            // 🔥 ИСПРАВЛЕНИЕ: Получаем векторную модель
            let vectorModel = this.vectorSuperModels.get(userId);
            let vectorVizPath = null;

            if (alignmentResult.similarity > 0.6 && alignmentResult.decision === 'same') {
                // СЛЕДЫ СОВПАДАЮТ
                console.log(`✅ Следы совпали (${alignmentResult.similarity.toFixed(3)})`);

                // Создаем или получаем векторную модель
                if (!vectorModel) {
                    vectorModel = new VectorSuperModel({
                        name: `Супер-модель_${String(userId).slice(0, 6)}`
                    });
                    this.vectorSuperModels.set(userId, vectorModel);

                    // Добавляем текущий граф
                    vectorModel.addGraph(
                        session.currentFootprint.graph,
                        session.currentFootprint.id,
                        { isFirst: true }
                    );
                }

                // Добавляем временный граф
                vectorModel.addGraph(
                    tempFootprint.graph,
                    tempFootprint.id,
                    { similarity: alignmentResult.similarity, timestamp: new Date() }
                );

                // 🔥 ПРОСТОЕ ОБЪЕДИНЕНИЕ (не копирование всех узлов!)
                const mergeResult = this.simpleMergeGraphs(
                    session.currentFootprint.graph,
                    tempFootprint.graph,
                    alignmentResult
                );

                // Визуализация
                if (this.config.enableMergeVisualization && vectorModel) {
                    vectorVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);

                    // Отправляем в Telegram
                    if (bot && chatId && vectorVizPath) {
                        const stats = vectorModel.getInfo();
                        await bot.sendPhoto(chatId, vectorVizPath, {
                            caption: `✅ **Следы совпали - супер-модель обновлена!**\n\n` +
                                    `🎯 Уверенность: ${(stats.stats.confidence * 100).toFixed(1)}%\n` +
                                    `📊 Узлов: ${stats.nodes}\n` +
                                    `🔄 Подтверждённых: ${stats.confirmedNodes}\n` +
                                    `📈 Слияний: ${stats.stats.totalMerges}`
                        });
                    }
                }

                return {
                    success: true,
                    similarity: alignmentResult.similarity,
                    decision: alignmentResult.decision,
                    mergeMethod: 'vector_super_model',
                    vectorModelStats: vectorModel ? vectorModel.getInfo() : null,
                    visualization: vectorVizPath,
                    nodesAdded: mergeResult.added || tempResult.added
                };

            } else {
                // СЛЕДЫ РАЗНЫЕ
                console.log(`🆕 Следы разные (${alignmentResult.similarity.toFixed(3)}) - начинаю новую модель`);

                // Сохраняем текущий отпечаток
                if (session.currentFootprint.graph.nodes.size >= 10) {
                    this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
                }

                // Создаем новый отпечаток
                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
                });

                const addResult = session.currentFootprint.addAnalysis(analysis, photoInfo);

                return {
                    success: true,
                    similarity: alignmentResult.similarity,
                    decision: 'different',
                    isNewModel: true,
                    nodesAdded: addResult.added
                };
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: ПРОСТОЕ ОБЪЕДИНЕНИЕ ГРАФОВ (не копировать все узлы!)
    simpleMergeGraphs(mainGraph, tempGraph, alignmentResult) {
        console.log(`🔄 Простое объединение графов: ${mainGraph.nodes.size} + ${tempGraph.nodes.size} узлов`);

        const previousSize = mainGraph.nodes.size;
        let addedCount = 0;
        let matchedCount = 0;

        // 🔥 ИСПРАВЛЕНИЕ: Используем matchedPairs из alignmentResult если есть
        if (alignmentResult.matchedPairs && alignmentResult.matchedPairs.length > 0) {
            console.log(`🔍 Использую ${alignmentResult.matchedPairs.length} совпавших пар`);

            // Просто добавляем узлы, которые не совпали
            tempGraph.nodes.forEach((tempNode, tempId) => {
                const isMatched = alignmentResult.matchedPairs.some(pair =>
                    pair.node2 === tempId || pair.node2Id === tempId
                );

                if (!isMatched) {
                    // Уникальный узел - добавляем
                    const newNodeId = `merged_${Date.now()}_${tempId}`;
                    mainGraph.nodes.set(newNodeId, {
                        ...tempNode,
                        id: newNodeId,
                        confirmedCount: 1,
                        isNew: true
                    });
                    addedCount++;
                } else {
                    matchedCount++;
                }
            });
        } else {
            // Простая проверка расстояния
            tempGraph.nodes.forEach((tempNode, tempId) => {
                let isUnique = true;

                mainGraph.nodes.forEach((mainNode, mainId) => {
                    const dx = mainNode.x - tempNode.x;
                    const dy = mainNode.y - tempNode.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 40) { // 🔥 Увеличить порог до 40px
                        isUnique = false;
                    }
                });

                if (isUnique) {
                    const newNodeId = `merged_${Date.now()}_${tempId}`;
                    mainGraph.nodes.set(newNodeId, {
                        ...tempNode,
                        id: newNodeId,
                        confirmedCount: 1,
                        isNew: true
                    });
                    addedCount++;
                } else {
                    matchedCount++;
                }
            });
        }

        // Перестраиваем граф только если добавили узлы
        if (addedCount > 0) {
            const points = Array.from(mainGraph.nodes.values()).map(node => ({
                x: node.x,
                y: node.y,
                confidence: node.confidence || 0.5,
                id: node.id
            }));

            mainGraph.buildFromPoints(points);
        }

        console.log(`✅ Объединение: +${addedCount} новых, ${matchedCount} совпало`);
        return { added: addedCount, matched: matchedCount, total: mainGraph.nodes.size };
    }

    // 🔥 ИСПРАВЛЕННАЯ ВИЗУАЛИЗАЦИЯ ВЕКТОРНОЙ СУПЕР-МОДЕЛИ
    async visualizeVectorSuperModel(userId, vectorModel) {
    console.log(`🎨 Создаю НАГЛЯДНУЮ визуализацию супер-модели...`);
   
    try {
        if (!vectorModel) {
            console.log('⚠️ Нет векторной модели');
            return null;
        }
       
        const vizData = vectorModel.getVisualizationData();
        const stats = vectorModel.getInfo();
       
        console.log(`📊 Визуализирую: ${vizData.nodes.length} узлов, уверенность: ${(stats.stats.confidence * 100).toFixed(1)}%`);
       
        // Создаем большой канвас для детализации
        const canvas = createCanvas(1000, 800);
        const ctx = canvas.getContext('2d');
       
        // 1. ФОН С СЕТКОЙ
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, 0, 1000, 800);
       
        // Сетка для ориентира
        ctx.strokeStyle = '#E9ECEF';
        ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < 1000; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 800);
            ctx.stroke();
        }
        for (let y = 0; y < 800; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1000, y);
            ctx.stroke();
        }
       
        // 2. ЗАГОЛОВОК
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🏗️ ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ', 500, 50);
        ctx.font = '20px Arial';
        ctx.fillText(`Уверенность: ${(stats.stats.confidence * 100).toFixed(1)}% | Слияний: ${stats.stats.totalMerges}`, 500, 85);
       
        // 3. ГЛАВНАЯ ДИАГРАММА - СУПЕР-МОДЕЛЬ
        const diagramX = 100;
        const diagramY = 150;
        const diagramSize = 600;
        const diagramTitle = 'СУПЕР-МОДЕЛЬ (нормализованное пространство)';
       
        // Рамка диаграммы
        ctx.strokeStyle = '#495057';
        ctx.lineWidth = 2;
        ctx.strokeRect(diagramX - 10, diagramY - 30, diagramSize + 20, diagramSize + 60);
       
        // Заголовок диаграммы
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(diagramTitle, diagramX, diagramY - 10);
       
        // 4. РИСУЕМ УЗЛЫ СУПЕР-МОДЕЛИ
        if (vizData.nodes && vizData.nodes.length > 0) {
            // Сортируем узлы по подтверждениям (самые подтвержденные рисуем последними)
            const sortedNodes = [...vizData.nodes].sort((a, b) => a.confirmedCount - b.confirmedCount);
           
            sortedNodes.forEach(node => {
                // Преобразуем нормализованные координаты [0,1] в координаты канваса
                const x = diagramX + node.nx * diagramSize;
                const y = diagramY + node.ny * diagramSize;
               
                // Цвет и размер в зависимости от подтверждений
                let color, radius, labelColor;
                if (node.confirmedCount >= 3) {
                    // 🔴 Высоконадёжные (3+ фото)
                    color = '#DC3545';
                    radius = 12;
                    labelColor = '#FFFFFF';
                } else if (node.confirmedCount === 2) {
                    // 🟡 Средняя надёжность (2 фото)
                    color = '#FFC107';
                    radius = 9;
                    labelColor = '#000000';
                } else {
                    // 🔵 Ненадёжные (1 фото)
                    color = '#0D6EFD';
                    radius = 6;
                    labelColor = '#FFFFFF';
                }
               
                // Тень для объемности
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 5;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
               
                // Рисуем узел
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
               
                // Убираем тень для текста
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
               
                // Число подтверждений (только для 2+)
                if (node.confirmedCount > 1) {
                    ctx.fillStyle = labelColor;
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(node.confirmedCount.toString(), x, y);
                }
               
                // Обводка для новых узлов
                if (node.isNew) {
                    ctx.strokeStyle = '#28A745';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
           
            // 5. СОЕДИНЕНИЯ МЕЖДУ БЛИЗКИМИ УЗЛАМИ (для визуализации структуры)
            ctx.strokeStyle = 'rgba(108, 117, 125, 0.15)';
            ctx.lineWidth = 1;
           
            // Рисуем связи между близкими узлами
            for (let i = 0; i < sortedNodes.length; i++) {
                for (let j = i + 1; j < sortedNodes.length; j++) {
                    const node1 = sortedNodes[i];
                    const node2 = sortedNodes[j];
                   
                    // Расстояние в нормализованном пространстве
                    const dx = node1.nx - node2.nx;
                    const dy = node1.ny - node2.ny;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                   
                    // Рисуем связь если узлы близки
                    if (distance < 0.2) { // Порог 0.2 в нормализованном пространстве
                        const x1 = diagramX + node1.nx * diagramSize;
                        const y1 = diagramY + node1.ny * diagramSize;
                        const x2 = diagramX + node2.nx * diagramSize;
                        const y2 = diagramY + node2.ny * diagramSize;
                       
                        // Более толстая линия для узлов с подтверждениями
                        const lineWidth = Math.min(3,
                            (node1.confirmedCount + node2.confirmedCount) / 2
                        );
                        ctx.lineWidth = lineWidth;
                       
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                }
            }
        }
       
        // 6. БОКОВАЯ ПАНЕЛЬ С СТАТИСТИКОЙ
        const statsX = 750;
        const statsY = 150;
       
        // Фон статистики
        ctx.fillStyle = 'rgba(248, 249, 250, 0.9)';
        ctx.fillRect(statsX - 10, statsY - 10, 240, 350);
        ctx.strokeStyle = '#6C757D';
        ctx.lineWidth = 1;
        ctx.strokeRect(statsX - 10, statsY - 10, 240, 350);
       
        // Заголовок статистики
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📊 СТАТИСТИКА', statsX, statsY + 20);
       
        let currentY = statsY + 50;
        const lineHeight = 28;
       
        // Элементы статистики
        const statItems = [
            { label: 'Всего узлов:', value: stats.nodes, color: '#212529' },
            { label: 'Подтверждённых (2+):', value: stats.confirmedNodes, color: '#DC3545' },
            { label: 'Высоконадёжных (3+):', value: stats.highlyConfirmed || 0, color: '#DC3545' },
            { label: 'Новых (1 фото):', value: stats.nodes - stats.confirmedNodes, color: '#0D6EFD' },
            { label: 'Сред. подтверждений:', value: stats.stats.avgConfirmations?.toFixed(2) || '0.00', color: '#6C757D' },
            { label: 'Слияний:', value: stats.stats.totalMerges, color: '#6C757D' },
            { label: 'Уверенность:', value: `${(stats.stats.confidence * 100).toFixed(1)}%`, color: '#198754' }
        ];
       
        statItems.forEach(item => {
            ctx.fillStyle = '#6C757D';
            ctx.font = '16px Arial';
            ctx.fillText(item.label, statsX, currentY);
           
            ctx.fillStyle = item.color;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(item.value.toString(), statsX + 200, currentY);
           
            currentY += lineHeight;
        });
       
        // 7. ЛЕГЕНДА
        const legendX = 750;
        const legendY = 520;
       
        ctx.fillStyle = 'rgba(248, 249, 250, 0.9)';
        ctx.fillRect(legendX - 10, legendY - 10, 240, 150);
        ctx.strokeStyle = '#6C757D';
        ctx.strokeRect(legendX - 10, legendY - 10, 240, 150);
       
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📖 ЛЕГЕНДА', legendX, legendY + 20);
       
        // Элементы легенды
        const legendItems = [
            { color: '#DC3545', label: '🔴 3+ фото (высокая надёжность)', size: 12 },
            { color: '#FFC107', label: '🟡 2 фото (средняя надёжность)', size: 9 },
            { color: '#0D6EFD', label: '🔵 1 фото (низкая надёжность)', size: 6 },
            { color: '#28A745', label: '🟢 Обводка - новый узел', size: 0 }
        ];
       
        currentY = legendY + 50;
        legendItems.forEach(item => {
            if (item.size > 0) {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(legendX + 10, currentY - 5, item.size, 0, Math.PI * 2);
                ctx.fill();
            }
           
            ctx.fillStyle = '#495057';
            ctx.font = '14px Arial';
            ctx.fillText(item.label, legendX + 30, currentY);
            currentY += 25;
        });
       
        // 8. ПРОГРЕСС БАР УВЕРЕННОСТИ
        const progressX = 100;
        const progressY = 750;
        const progressWidth = 600;
        const progressHeight = 25;
        const confidence = stats.stats.confidence;
       
        // Фон прогресс-бара
        ctx.fillStyle = '#E9ECEF';
        ctx.fillRect(progressX, progressY, progressWidth, progressHeight);
       
        // Заполнение прогресс-бара
        const fillWidth = progressWidth * confidence;
        let progressColor;
        if (confidence > 0.7) progressColor = '#198754';
        else if (confidence > 0.4) progressColor = '#FFC107';
        else progressColor = '#DC3545';
       
        ctx.fillStyle = progressColor;
        ctx.fillRect(progressX, progressY, fillWidth, progressHeight);
       
        // Текст прогресс-бара
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Уверенность супер-модели: ${(confidence * 100).toFixed(1)}%`,
                     progressX + progressWidth / 2, progressY + progressHeight / 2);
       
        // Обводка прогресс-бара
        ctx.strokeStyle = '#6C757D';
        ctx.lineWidth = 1;
        ctx.strokeRect(progressX, progressY, progressWidth, progressHeight);
       
        // 9. ПОДВАЛ
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Супер-модель создана: ${new Date().toLocaleString('ru-RU')} | ID: ${stats.id.slice(0, 8)}`,
                     500, 790);
       
        // 10. СОХРАНЕНИЕ
        const outputPath = path.join(
            this.mergeVisualizer.config.outputDir,
            `super_model_detailed_${Date.now()}.png`
        );
       
        // Создаем директорию если нет
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
       
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
           
            out.on('finish', () => {
                console.log(`✅ Детальная визуализация создана: ${outputPath}`);
                resolve(outputPath);
            });
           
            out.on('error', (error) => {
                console.log(`❌ Ошибка сохранения: ${error.message}`);
                reject(error);
            });
        });
       
        return outputPath;
       
    } catch (error) {
        console.log(`❌ Ошибка создания детальной визуализации: ${error.message}`);
        console.error(error.stack);
        return null;
    }
}

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД СОЗДАНИЯ СЕССИИ
    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId, // ✅ Правильный ID
            userId: String(userId), // ✅ Конвертируем в строку
            name: name || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            analyses: [],
            comparisons: [],
            confirmedPhotos: 0,
            currentFootprint: null,
            metadata: {
                created: new Date(),
                autoAlignment: this.config.autoAlignment,
                usePointTracker: true
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)}... для пользователя ${userId}`);

        return session;
    }

    // ПОЛУЧИТЬ ВЕКТОРНУЮ СУПЕР-МОДЕЛЬ
    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    // Сохранение сессии как модели
    saveSessionAsModel(userId, modelName = null) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        const footprint = session.currentFootprint;

        // Обновляем имя если указано
        if (modelName) {
            footprint.name = modelName;
        }

        // Сохраняем модель
        const modelPath = path.join(this.config.dbPath, 'models', `${footprint.id}.json`);

        try {
            const modelData = footprint.toJSON();
            modelData.metadata.sessionInfo = {
                sessionId: session.id,
                photosCount: session.photos.length,
                confirmedPhotos: session.confirmedPhotos || 0,
                analysesCount: session.analyses.length
            };

            fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));

            // Добавляем в загруженные модели
            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels = this.loadedModels.size;

            console.log(`💾 Модель сохранена: ${footprint.id} (${footprint.graph.nodes.size} узлов)`);

            // Очищаем сессию
            this.userSessions.delete(userId);

            return {
                success: true,
                modelId: footprint.id,
                modelName: footprint.name,
                modelPath: modelPath,
                modelStats: {
                    nodes: footprint.graph.nodes.size,
                    edges: footprint.graph.edges.size,
                    confidence: footprint.stats.confidence,
                    confirmedNodes: 0
                },
                sessionInfo: {
                    photos: session.photos.length,
                    analyses: session.analyses.length,
                    confirmedPhotos: session.confirmedPhotos || 0
                }
            };

        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ДОБАВЛЕНИЕ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ В ИСТОРИЮ
    addMergeVisualization(userId, vizInfo) {
        const history = this.lastMergeVisualizations.get(userId) || [];
        history.unshift(vizInfo);

        // Ограничиваем историю 10 последними визуализациями
        if (history.length > 10) {
            history.pop();
        }

        this.lastMergeVisualizations.set(userId, history);
        return history.length;
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ ПОСЛЕДНЕЙ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ
    getLastMergeVisualization(userId) {
        const history = this.lastMergeVisualizations.get(userId);
        return history && history.length > 0 ? history[0] : null;
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ СТАТИСТИКИ ПОДТВЕРЖДЕНИЙ ДЛЯ СЕССИИ
    getSessionConfirmationStats(userId) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return null;
        }

        const footprint = session.currentFootprint;

        // Получаем статистику из отпечатка
        const stats = {
            totalNodes: footprint.graph.nodes.size,
            confirmedNodes: 0,
            averageConfirmations: 0
        };

        // Добавляем информацию о сессии
        return {
            sessionId: session.id,
            sessionName: session.name,
            photosCount: session.photos.length,
            confirmedPhotos: session.confirmedPhotos || 0,
            analysesCount: session.analyses.length,
            footprintStats: stats,
            lastActivity: session.lastActivity
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ КОЛИЧЕСТВА ВИЗУАЛИЗАЦИЙ ОБЪЕДИНЕНИЯ
    getMergeVisualizationCount() {
        let total = 0;
        for (const [userId, history] of this.lastMergeVisualizations) {
            total += history.length;
        }
        return total;
    }

    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

    // Вспомогательные методы
    extractPointsFromAnalysis(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        predictions.forEach(pred => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                points.push({
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points
                });
            }
        });

        return points;
    }

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    loadExistingModels() {
        const modelsDir = path.join(this.config.dbPath, 'models');

        if (!fs.existsSync(modelsDir)) {
            console.log('📁 Директория моделей не существует, создаю...');
            fs.mkdirSync(modelsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'));

        console.log(`📂 Загрузка моделей из ${modelsDir} (${files.length} файлов)`);

        let loadedCount = 0;

        files.slice(0, 100).forEach(file => { // Ограничиваем загрузку 100 моделями
            try {
                const filePath = path.join(modelsDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                const footprint = SimpleFootprint.fromJSON(data);
                this.loadedModels.set(footprint.id, footprint);
                loadedCount++;

            } catch (error) {
                console.log(`⚠️ Ошибка загрузки модели ${file}:`, error.message);
            }
        });

        this.systemStats.totalModels = loadedCount;
        console.log(`✅ Загружено ${loadedCount} моделей`);
    }

    // Остальные методы остаются без изменений
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    getUserModels(userId) {
        return Array.from(this.loadedModels.values())
            .filter(model => model.userId === userId)
            .sort((a, b) => new Date(b.metadata.created) - new Date(a.metadata.created));
    }

    getModelById(modelId) {
        return this.loadedModels.get(modelId);
    }

    getSystemStats() {
        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            mergeVisualizations: this.getMergeVisualizationCount(),
            vectorModels: this.vectorSuperModels.size,
            config: {
                autoAlignment: this.config.autoAlignment,
                enableMergeVisualization: this.config.enableMergeVisualization,
                usePointTracker: this.config.usePointTracker,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold
            },
            system: {
                uptime: Math.floor(process.uptime()),
                memoryUsage: process.memoryUsage()
            }
        };
    }

    endSession(userId, reason = 'manual') {
        const session = this.userSessions.get(userId);
        if (!session) {
            return { success: false, error: 'Сессия не найдена' };
        }

        const result = {
            success: true,
            sessionId: session.id,
            userId: userId,
            reason: reason,
            duration: new Date() - session.startTime,
            photos: session.photos.length,
            analyses: session.analyses.length,
            confirmedPhotos: session.confirmedPhotos || 0,
            footprint: session.currentFootprint ? {
                id: session.currentFootprint.id,
                nodes: session.currentFootprint.graph.nodes.size,
                confidence: session.currentFootprint.stats.confidence
            } : null
        };

        // Удаляем сессию
        this.userSessions.delete(userId);

        console.log(`🏁 Сессия завершена: ${session.id.slice(0, 8)}... (${reason})`);

        return result;
    }

    saveSession(userId) {
        const session = this.userSessions.get(userId);
        if (!session) return false;

        try {
            const sessionPath = path.join(this.config.dbPath, 'sessions', `${session.id}.json`);
            const sessionData = {
                id: session.id,
                userId: session.userId,
                name: session.name,
                startTime: session.startTime.toISOString(),
                lastActivity: session.lastActivity.toISOString(),
                photos: session.photos,
                analyses: session.analyses,
                comparisons: session.comparisons,
                confirmedPhotos: session.confirmedPhotos,
                metadata: session.metadata
            };

            fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
            return true;
        } catch (error) {
            console.log('⚠️ Ошибка сохранения сессии:', error.message);
            return false;
        }
    }

    // Визуализация сравнения
    async visualizeComparison(modelId1, modelId2) {
        try {
            const model1 = this.getModelById(modelId1);
            const model2 = this.getModelById(modelId2);

            if (!model1 || !model2) {
                return { success: false, error: 'Модели не найдены' };
            }

            const comparison = model1.compare(model2);
            const vizPath = await this.mergeVisualizer.visualizeMerge(
                model1,
                model2,
                comparison
            );

            return {
                success: true,
                visualization: vizPath.path,
                comparison: comparison
            };

        } catch (error) {
            console.log('❌ Ошибка визуализации сравнения:', error);
            return { success: false, error: error.message };
        }
    }

    // Визуализация сессии
    async visualizeSession(userId) {
        const session = this.getActiveSession(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии' };
        }

        try {
            const GraphVisualizer = require('./graph-visualizer');
            const visualizer = new GraphVisualizer();

            const vizPath = await visualizer.visualizeSessionHistory(session, {
                filename: `session_${session.id.slice(0, 8)}.png`
            });

            return {
                success: true,
                visualization: vizPath,
                sessionId: session.id,
                footprint: {
                    nodes: session.currentFootprint.graph.nodes.size,
                    edges: session.currentFootprint.graph.edges.size
                }
            };

        } catch (error) {
            console.log('❌ Ошибка визуализации сессии:', error);
            return { success: false, error: error.message };
        }
    }

    // Поиск похожих моделей
    findSimilarModels(footprint, userId, options = {}) {
        const userModels = this.getUserModels(userId);
        const maxResults = options.maxResults || 5;
        const minSimilarity = options.minSimilarity || 0.4;

        const similarities = [];

        userModels.forEach(model => {
            if (model.id === footprint.id) return; // Пропускаем ту же модель

            const comparison = footprint.compare(model);

            if (comparison.similarity >= minSimilarity) {
                similarities.push({
                    model: model,
                    similarity: comparison.similarity,
                    decision: comparison.decision,
                    reason: comparison.reason
                });
            }
        });

        // Сортировка по схожести
        similarities.sort((a, b) => b.similarity - a.similarity);

        return {
            success: true,
            similarCount: similarities.length,
            similarModels: similarities.slice(0, maxResults),
            searchedModels: userModels.length
        };
    }

    // Очистка старых сессий
    cleanupOldSessions(maxAgeHours = 24) {
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let cleaned = 0;

        for (const [userId, session] of this.userSessions) {
            if (session.lastActivity.getTime() < cutoffTime) {
                this.userSessions.delete(userId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Очищено ${cleaned} старых сессий`);
        }

        return cleaned;
    }
}

module.exports = SimpleFootprintManager;
