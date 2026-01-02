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
    console.log(`🎨 Создаю ДЕТАЛЬНУЮ визуализацию супер-модели (высокое разрешение)...`);
   
    try {
        if (!vectorModel) {
            console.log('⚠️ Нет векторной модели');
            return null;
        }
       
        const vizData = vectorModel.getVisualizationData();
        const stats = vectorModel.getInfo();
       
        console.log(`📊 Визуализирую: ${vizData.nodes.length} узлов, уверенность: ${(stats.stats.confidence * 100).toFixed(1)}%`);
       
        // ✅ УВЕЛИЧИВАЕМ РАЗРЕШЕНИЕ
        const canvasWidth = 1600;  // Было 1000
        const canvasHeight = 1200; // Было 800
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
       
        // 1. ФОН С СЕТКОЙ
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
       
        // Сетка для ориентира (меньший шаг для высокого разрешения)
        ctx.strokeStyle = '#E9ECEF';
        ctx.lineWidth = 1;
        const gridSize = 40; // Было 50
        for (let x = 0; x < canvasWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }
        for (let y = 0; y < canvasHeight; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
       
        // 2. ЗАГОЛОВОК (увеличиваем шрифт для высокого разрешения)
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 42px Arial'; // Было 32px
        ctx.textAlign = 'center';
        ctx.fillText('🏗️ ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ ОТПЕЧАТКА', canvasWidth / 2, 70);
        ctx.font = 'bold 24px Arial'; // Было 20px
        ctx.fillText(`Уверенность: ${(stats.stats.confidence * 100).toFixed(1)}% | Слияний: ${stats.stats.totalMerges} | Узлов: ${stats.nodes}`,
                    canvasWidth / 2, 110);
       
        // 3. РАЗДЕЛЕНИЕ НА КОЛОНКИ
        const leftColumnWidth = 1000;  // Основная диаграмма
        const rightColumnWidth = 550;  // Статистика и легенда
        const margin = 50;
       
        // 4. ГЛАВНАЯ ДИАГРАММА - СУПЕР-МОДЕЛЬ (БОЛЬШЕ МЕСТА)
        const diagramX = margin;
        const diagramY = 180; // Опускаем ниже для заголовка
        const diagramSize = 900; // Было 600 - УВЕЛИЧИЛИ!
        const diagramTitle = 'СУПЕР-МОДЕЛЬ В НОРМАЛИЗОВАННОМ ПРОСТРАНСТВЕ';
       
        // Рамка диаграммы
        ctx.strokeStyle = '#495057';
        ctx.lineWidth = 3; // Толще для высокого разрешения
        ctx.strokeRect(diagramX - 15, diagramY - 40, diagramSize + 30, diagramSize + 80);
       
        // Заголовок диаграммы
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 22px Arial'; // Было 18px
        ctx.textAlign = 'left';
        ctx.fillText(diagramTitle, diagramX, diagramY - 15);
       
        // Подзаголовок
        ctx.fillStyle = '#6C757D';
        ctx.font = '16px Arial';
        ctx.fillText(`Масштаб: нормализованный [0,1] | Показано: ${vizData.nodes.length} узлов`,
                    diagramX, diagramY);
       
        // 5. РИСУЕМ УЗЛЫ СУПЕР-МОДЕЛИ (увеличиваем размеры)
        if (vizData.nodes && vizData.nodes.length > 0) {
            // Сортируем узлы по подтверждениям
            const sortedNodes = [...vizData.nodes].sort((a, b) => a.confirmedCount - b.confirmedCount);
           
            // Сначала рисуем связи (чтобы они были под узлами)
            ctx.strokeStyle = 'rgba(108, 117, 125, 0.1)';
            ctx.lineWidth = 1.5;
           
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
                    if (distance < 0.15) { // Уменьшаем порог для более аккуратных связей
                        const x1 = diagramX + node1.nx * diagramSize;
                        const y1 = diagramY + node1.ny * diagramSize;
                        const x2 = diagramX + node2.nx * diagramSize;
                        const y2 = diagramY + node2.ny * diagramSize;
                       
                        // Цвет связи в зависимости от подтверждений
                        const avgConfirmations = (node1.confirmedCount + node2.confirmedCount) / 2;
                        if (avgConfirmations >= 3) {
                            ctx.strokeStyle = 'rgba(220, 53, 69, 0.3)'; // Красный для высоких
                        } else if (avgConfirmations >= 2) {
                            ctx.strokeStyle = 'rgba(255, 193, 7, 0.3)'; // Желтый для средних
                        } else {
                            ctx.strokeStyle = 'rgba(13, 110, 253, 0.2)'; // Синий для низких
                        }
                       
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                }
            }
           
            // Теперь рисуем узлы поверх связей
            sortedNodes.forEach(node => {
                // Преобразуем нормализованные координаты
                const x = diagramX + node.nx * diagramSize;
                const y = diagramY + node.ny * diagramSize;
               
                // Цвет и размер в зависимости от подтверждений (УВЕЛИЧИВАЕМ!)
                let color, radius, labelColor, shadowSize;
                if (node.confirmedCount >= 3) {
                    // 🔴 Высоконадёжные (3+ фото)
                    color = '#DC3545';
                    radius = 18; // Было 12
                    labelColor = '#FFFFFF';
                    shadowSize = 8;
                } else if (node.confirmedCount === 2) {
                    // 🟡 Средняя надёжность (2 фото)
                    color = '#FFC107';
                    radius = 14; // Было 9
                    labelColor = '#000000';
                    shadowSize = 6;
                } else {
                    // 🔵 Ненадёжные (1 фото)
                    color = '#0D6EFD';
                    radius = 10; // Было 6
                    labelColor = '#FFFFFF';
                    shadowSize = 4;
                }
               
                // Тень для объемности (увеличиваем)
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                ctx.shadowBlur = shadowSize;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;
               
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
                    ctx.font = `bold ${Math.max(12, radius / 1.5)}px Arial`; // Адаптивный размер шрифта
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(node.confirmedCount.toString(), x, y);
                }
               
                // Обводка для новых узлов
                if (node.isNew) {
                    ctx.strokeStyle = '#28A745';
                    ctx.lineWidth = 3; // Толще
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
        }
       
        // 6. ПРАВАЯ КОЛОНКА - СТАТИСТИКА И ИНФОРМАЦИЯ
        const statsX = leftColumnWidth + margin;
        const statsY = 180;
        const statsWidth = rightColumnWidth - margin * 2;
       
        // 6.1. ОБЩАЯ СТАТИСТИКА
        ctx.fillStyle = 'rgba(248, 249, 250, 0.95)';
        ctx.fillRect(statsX - 15, statsY - 15, statsWidth, 400);
        ctx.strokeStyle = '#6C757D';
        ctx.lineWidth = 2;
        ctx.strokeRect(statsX - 15, statsY - 15, statsWidth, 400);
       
        // Заголовок статистики
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📊 СТАТИСТИКА СУПЕР-МОДЕЛИ', statsX, statsY + 20);
       
        let currentY = statsY + 60;
        const lineHeight = 32; // Увеличиваем межстрочный интервал
       
        // Рассчитываем проценты для круговой диаграммы
        const totalNodes = stats.nodes;
        const highConfidencePercent = totalNodes > 0 ?
            Math.round((stats.highConfidenceNodes || 0) / totalNodes * 100) : 0;
        const confirmedPercent = totalNodes > 0 ?
            Math.round(stats.confirmedNodes / totalNodes * 100) : 0;
        const newPercent = totalNodes > 0 ?
            100 - confirmedPercent : 0;
       
        // Элементы статистики с процентами
        const statItems = [
            { label: 'Всего узлов:', value: stats.nodes, color: '#212529', percent: '100%' },
            { label: 'Высоконадёжных (3+ фото):', value: stats.highConfidenceNodes || 0, color: '#DC3545', percent: `${highConfidencePercent}%` },
            { label: 'Подтверждённых (2+ фото):', value: stats.confirmedNodes, color: '#FFC107', percent: `${confirmedPercent}%` },
            { label: 'Новых (1 фото):', value: stats.nodes - stats.confirmedNodes, color: '#0D6EFD', percent: `${newPercent}%` },
            { label: 'Сред. подтверждений:', value: stats.stats.avgConfirmations?.toFixed(2) || '0.00', color: '#6C757D', percent: '' },
            { label: 'Слияний моделей:', value: stats.stats.totalMerges, color: '#6C757D', percent: '' },
            { label: 'Дата создания:', value: stats.stats.createdAt ? new Date(stats.stats.createdAt).toLocaleDateString('ru-RU') : 'н/д', color: '#6C757D', percent: '' }
        ];
       
        statItems.forEach(item => {
            ctx.fillStyle = '#6C757D';
            ctx.font = '18px Arial';
            ctx.fillText(item.label, statsX, currentY);
           
            ctx.fillStyle = item.color;
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'right';
           
            // Отображаем значение и процент
            const displayText = item.percent ?
                `${item.value} (${item.percent})` :
                item.value.toString();
            ctx.fillText(displayText, statsX + statsWidth - 30, currentY);
           
            currentY += lineHeight;
        });
       
        // 6.2. КРУГОВАЯ ДИАГРАММА РАСПРЕДЕЛЕНИЯ
        const pieChartX = statsX + statsWidth / 2;
        const pieChartY = currentY + 120;
        const pieRadius = 80;
       
        // Фон круговой диаграммы
        ctx.strokeStyle = '#E9ECEF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pieChartX, pieChartY, pieRadius, 0, Math.PI * 2);
        ctx.stroke();
       
        // Рисуем сегменты если есть узлы
        if (totalNodes > 0) {
            let startAngle = 0;
           
            // Сегмент высоконадёжных (3+ фото)
            if (highConfidencePercent > 0) {
                const angle = (highConfidencePercent / 100) * Math.PI * 2;
                ctx.fillStyle = '#DC3545';
                ctx.beginPath();
                ctx.moveTo(pieChartX, pieChartY);
                ctx.arc(pieChartX, pieChartY, pieRadius, startAngle, startAngle + angle);
                ctx.closePath();
                ctx.fill();
                startAngle += angle;
            }
           
            // Сегмент подтверждённых (2 фото)
            if (confirmedPercent - highConfidencePercent > 0) {
                const angle = ((confirmedPercent - highConfidencePercent) / 100) * Math.PI * 2;
                ctx.fillStyle = '#FFC107';
                ctx.beginPath();
                ctx.moveTo(pieChartX, pieChartY);
                ctx.arc(pieChartX, pieChartY, pieRadius, startAngle, startAngle + angle);
                ctx.closePath();
                ctx.fill();
                startAngle += angle;
            }
           
            // Сегмент новых (1 фото)
            if (newPercent > 0) {
                const angle = (newPercent / 100) * Math.PI * 2;
                ctx.fillStyle = '#0D6EFD';
                ctx.beginPath();
                ctx.moveTo(pieChartX, pieChartY);
                ctx.arc(pieChartX, pieChartY, pieRadius, startAngle, startAngle + angle);
                ctx.closePath();
                ctx.fill();
            }
        }
       
        // Подпись круговой диаграммы
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Распределение узлов по надёжности', pieChartX, pieChartY + pieRadius + 40);
       
        // 7. ЛЕГЕНДА (ниже круговой диаграммы)
        const legendX = statsX;
        const legendY = pieChartY + pieRadius + 80;
       
        ctx.fillStyle = 'rgba(248, 249, 250, 0.95)';
        ctx.fillRect(legendX - 15, legendY - 15, statsWidth, 180);
        ctx.strokeStyle = '#6C757D';
        ctx.strokeRect(legendX - 15, legendY - 15, statsWidth, 180);
       
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📖 ЛЕГЕНДА И ОБОЗНАЧЕНИЯ', legendX, legendY + 20);
       
        // Элементы легенды в 2 колонки
        const legendItems = [
            { color: '#DC3545', label: '🔴 3+ фото (высокая надёжность)', example: '● 3' },
            { color: '#FFC107', label: '🟡 2 фото (средняя надёжность)', example: '● 2' },
            { color: '#0D6EFD', label: '🔵 1 фото (низкая надёжность)', example: '●' },
            { color: '#28A745', label: '🟢 Обводка - новый узел', example: '🟢' },
            { color: 'rgba(220, 53, 69, 0.3)', label: 'Красные линии - связи между высоконадёжными узлами', example: '━━' },
            { color: 'rgba(13, 110, 253, 0.2)', label: 'Синие линии - связи между новыми узлами', example: '━━' }
        ];
       
        let legendRowY = legendY + 50;
        const legendCol1X = legendX;
        const legendCol2X = legendX + statsWidth / 2 + 30;
        const legendRowHeight = 30;
       
        legendItems.forEach((item, index) => {
            const colX = index < 3 ? legendCol1X : legendCol2X;
            const colY = legendRowY + (index % 3) * legendRowHeight;
           
            // Пример элемента
            ctx.fillStyle = item.color;
            if (item.color.includes('rgba')) {
                // Для линий
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(colX, colY - 5);
                ctx.lineTo(colX + 30, colY - 5);
                ctx.stroke();
            } else {
                // Для точек
                ctx.beginPath();
                ctx.arc(colX + 15, colY - 8, 8, 0, Math.PI * 2);
                ctx.fill();
               
                // Текст примера если есть
                if (item.example) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(item.example.charAt(item.example.length - 1), colX + 15, colY - 8);
                }
            }
           
            // Описание
            ctx.fillStyle = '#495057';
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, colX + 40, colY);
        });
       
        // 8. ПРОГРЕСС БАР УВЕРЕННОСТИ (широкий, внизу)
        const progressX = margin;
        const progressY = diagramY + diagramSize + 100;
        const progressWidth = diagramSize;
        const progressHeight = 35; // Выше
        const confidence = stats.stats.confidence;
       
        // Фон прогресс-бара с тенями
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
       
        ctx.fillStyle = '#E9ECEF';
        ctx.fillRect(progressX, progressY, progressWidth, progressHeight);
       
        ctx.shadowColor = 'transparent';
       
        // Заполнение прогресс-бара с градиентом
        const fillWidth = progressWidth * confidence;
       
        // Создаем градиент
        const gradient = ctx.createLinearGradient(progressX, progressY, progressX + fillWidth, progressY);
        if (confidence > 0.7) {
            gradient.addColorStop(0, '#198754');
            gradient.addColorStop(1, '#20C997');
        } else if (confidence > 0.4) {
            gradient.addColorStop(0, '#FFC107');
            gradient.addColorStop(1, '#FFD85C');
        } else {
            gradient.addColorStop(0, '#DC3545');
            gradient.addColorStop(1, '#FD7E14');
        }
       
        ctx.fillStyle = gradient;
        ctx.fillRect(progressX, progressY, fillWidth, progressHeight);
       
        // Текст прогресс-бара (большой и жирный)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`УВЕРЕННОСТЬ СУПЕР-МОДЕЛИ: ${(confidence * 100).toFixed(1)}%`,
                     progressX + progressWidth / 2, progressY + progressHeight / 2);
       
        // Обводка прогресс-бара
        ctx.strokeStyle = '#495057';
        ctx.lineWidth = 2;
        ctx.strokeRect(progressX, progressY, progressWidth, progressHeight);
       
        // Маркеры на прогресс-баре
        ctx.fillStyle = '#6C757D';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('0%', progressX, progressY + progressHeight + 20);
        ctx.fillText('50%', progressX + progressWidth / 2, progressY + progressHeight + 20);
        ctx.fillText('100%', progressX + progressWidth, progressY + progressHeight + 20);
       
        // 9. ИНФОРМАЦИЯ О СИСТЕМЕ (в самом низу)
        const infoY = canvasHeight - 40;
       
        ctx.fillStyle = '#6C757D';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Система анализа следов | Супер-модель ID: ${stats.id.slice(0, 12)} | ` +
                    `Создано: ${new Date().toLocaleString('ru-RU')}`,
                    canvasWidth / 2, infoY);
       
        // 10. ИНФОРМАЦИОННАЯ ПАНЕЛЬ КАЧЕСТВА
        const qualityX = statsX;
        const qualityY = legendY + 180;
        const qualityWidth = statsWidth;
        const qualityHeight = 120;
       
        ctx.fillStyle = 'rgba(248, 249, 250, 0.95)';
        ctx.fillRect(qualityX - 15, qualityY - 15, qualityWidth, qualityHeight);
        ctx.strokeStyle = confidence > 0.7 ? '#198754' : confidence > 0.4 ? '#FFC107' : '#DC3545';
        ctx.lineWidth = 3;
        ctx.strokeRect(qualityX - 15, qualityY - 15, qualityWidth, qualityHeight);
       
        // Оценка качества
        let qualityLevel, qualityColor, qualityDescription;
        if (confidence > 0.8) {
            qualityLevel = 'ВЫСОКОЕ КАЧЕСТВО';
            qualityColor = '#198754';
            qualityDescription = 'Модель готова для идентификации';
        } else if (confidence > 0.6) {
            qualityLevel = 'ХОРОШЕЕ КАЧЕСТВО';
            qualityColor = '#20C997';
            qualityDescription = 'Модель можно использовать';
        } else if (confidence > 0.4) {
            qualityLevel = 'СРЕДНЕЕ КАЧЕСТВО';
            qualityColor = '#FFC107';
            qualityDescription = 'Нужны дополнительные фото';
        } else {
            qualityLevel = 'НИЗКОЕ КАЧЕСТВО';
            qualityColor = '#DC3545';
            qualityDescription = 'Требуются подтверждения';
        }
       
        ctx.fillStyle = qualityColor;
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🏆 ОЦЕНКА КАЧЕСТВА', qualityX + qualityWidth / 2, qualityY + 30);
       
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 26px Arial';
        ctx.fillText(qualityLevel, qualityX + qualityWidth / 2, qualityY + 65);
       
        ctx.fillStyle = '#6C757D';
        ctx.font = '16px Arial';
        ctx.fillText(qualityDescription, qualityX + qualityWidth / 2, qualityY + 95);
       
        // 11. СОХРАНЕНИЕ В ФАЙЛ ВЫСОКОГО КАЧЕСТВА
        const outputDir = path.join(this.config.dbPath, 'visualizations', 'high_quality');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
       
        const outputPath = path.join(
            outputDir,
            `super_model_hq_${userId}_${Date.now()}.png`
        );
       
        // Увеличиваем качество PNG
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream({
                compressionLevel: 0, // Максимальное качество
                filters: canvas.PNG_ALL_FILTERS,
                palette: undefined
            });
           
            stream.pipe(out);
           
            out.on('finish', () => {
                const fileSize = fs.statSync(outputPath).size;
                console.log(`✅ Детальная визуализация создана: ${outputPath}`);
                console.log(`   📏 Размер: ${canvasWidth}x${canvasHeight}px, Размер файла: ${(fileSize / 1024).toFixed(1)}KB`);
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
