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
    console.log(`🎨 Создаю визуализацию супер-модели с нормальными пропорциями...`);
   
    try {
        if (!vectorModel) {
            console.log('⚠️ Нет векторной модели');
            return null;
        }
       
        const vizData = vectorModel.getVisualizationData();
        const stats = vectorModel.getInfo();
       
        console.log(`📊 Визуализирую: ${vizData.nodes.length} узлов, уверенность: ${(stats.stats.confidence * 100).toFixed(1)}%`);
       
        // Сохраняем хорошее разрешение
        const canvasWidth = 1600;
        const canvasHeight = 1200;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
       
        // 1. ФОН
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
       
        // 2. ЗАГОЛОВОК
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🏗️ ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ', canvasWidth / 2, 60);
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`Уверенность: ${(stats.stats.confidence * 100).toFixed(1)}% | Узлов: ${stats.nodes} | Слияний: ${stats.stats.totalMerges}`,
                    canvasWidth / 2, 95);
       
        // 3. ВЫСЧИТЫВАЕМ РЕАЛЬНЫЕ ГРАНИЦЫ ТОПОЛОГИИ
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        if (vizData.nodes && vizData.nodes.length > 0) {
            vizData.nodes.forEach(node => {
                if (node.nx < minX) minX = node.nx;
                if (node.nx > maxX) maxX = node.nx;
                if (node.ny < minY) minY = node.ny;
                if (node.ny > maxY) maxY = node.ny;
            });
        } else {
            minX = maxX = minY = maxY = 0.5;
        }
       
        // Добавляем небольшие отступы
        const padding = 0.05;
        minX = Math.max(0, minX - padding);
        maxX = Math.min(1, maxX + padding);
        minY = Math.max(0, minY - padding);
        maxY = Math.min(1, maxY + padding);
       
        const topologyWidth = maxX - minX;
        const topologyHeight = maxY - minY;
       
        console.log(`📐 Границы топологии: X[${minX.toFixed(3)}-${maxX.toFixed(3)}], Y[${minY.toFixed(3)}-${maxY.toFixed(3)}]`);
        console.log(`📏 Размеры: ${topologyWidth.toFixed(3)}x${topologyHeight.toFixed(3)}`);
       
        // 4. ОПРЕДЕЛЯЕМ МАСШТАБ ДЛЯ СОХРАНЕНИЯ ПРОПОРЦИЙ
        const diagramWidth = 700;  // Уменьшаем размер диаграммы
        const diagramHeight = 700;
       
        // Масштаб с сохранением пропорций
        const scaleX = diagramWidth / (topologyWidth > 0 ? topologyWidth : 1);
        const scaleY = diagramHeight / (topologyHeight > 0 ? topologyHeight : 1);
        const scale = Math.min(scaleX, scaleY) * 0.9; // Сохраняем пропорции
       
        // 5. ТОПОЛОГИЧЕСКАЯ ДИАГРАММА (в центре, меньше)
        const diagramX = (canvasWidth - diagramWidth) / 2 - 200; // Сдвигаем левее
        const diagramY = 150;
       
        // Рамка диаграммы
        ctx.strokeStyle = '#495057';
        ctx.lineWidth = 2;
        ctx.strokeRect(diagramX - 5, diagramY - 5, diagramWidth + 10, diagramHeight + 10);
       
        // Заголовок диаграммы
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ТОПОЛОГИЯ ПРОТЕКТОРА', diagramX + diagramWidth / 2, diagramY - 15);
       
        // 6. РИСУЕМ ТОПОЛОГИЮ С ПРАВИЛЬНЫМИ ПРОПОРЦИЯМИ
        if (vizData.nodes && vizData.nodes.length > 0) {
            // Сортируем узлы по подтверждениям
            const sortedNodes = [...vizData.nodes].sort((a, b) => a.confirmedCount - b.confirmedCount);
           
            // Рисуем связи между близкими узлами
            ctx.strokeStyle = 'rgba(108, 117, 125, 0.15)';
            ctx.lineWidth = 1;
           
            for (let i = 0; i < sortedNodes.length; i++) {
                for (let j = i + 1; j < sortedNodes.length; j++) {
                    const node1 = sortedNodes[i];
                    const node2 = sortedNodes[j];
                   
                    // Расстояние в нормализованном пространстве
                    const dx = node1.nx - node2.nx;
                    const dy = node1.ny - node2.ny;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                   
                    // Рисуем связь только для очень близких узлов
                    if (distance < 0.1) {
                        const x1 = diagramX + (node1.nx - minX) * scale;
                        const y1 = diagramY + (node1.ny - minY) * scale;
                        const x2 = diagramX + (node2.nx - minX) * scale;
                        const y2 = diagramY + (node2.ny - minY) * scale;
                       
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                }
            }
           
            // Рисуем узлы
            sortedNodes.forEach(node => {
                // Координаты с сохранением пропорций
                const x = diagramX + (node.nx - minX) * scale;
                const y = diagramY + (node.ny - minY) * scale;
               
                // Цвет и размер
                let color, radius;
                if (node.confirmedCount >= 3) {
                    color = '#DC3545';
                    radius = 10;
                } else if (node.confirmedCount === 2) {
                    color = '#FFC107';
                    radius = 8;
                } else {
                    color = '#0D6EFD';
                    radius = 6;
                }
               
                // Рисуем узел
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
               
                // Число подтверждений для 2+
                if (node.confirmedCount > 1) {
                    ctx.fillStyle = node.confirmedCount >= 3 ? '#FFFFFF' : '#000000';
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
                    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
        }
       
        // 7. ПРАВАЯ КОЛОНКА - СТАТИСТИКА (увеличиваем, чтобы текст помещался)
        const statsX = diagramX + diagramWidth + 50;
        const statsY = diagramY;
        const statsWidth = 450; // Шире для текста
        const statsHeight = 500;
       
        // Фон статистики
        ctx.fillStyle = 'rgba(248, 249, 250, 0.95)';
        ctx.fillRect(statsX - 15, statsY - 15, statsWidth, statsHeight);
        ctx.strokeStyle = '#6C757D';
        ctx.lineWidth = 2;
        ctx.strokeRect(statsX - 15, statsY - 15, statsWidth, statsHeight);
       
        // Заголовок статистики
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'left';
        const statsTitle = '📊 СТАТИСТИКА';
        ctx.fillText(statsTitle, statsX, statsY + 20);
       
        // Проверяем ширину текста
        const titleWidth = ctx.measureText(statsTitle).width;
        if (titleWidth > statsWidth - 30) {
            console.log(`⚠️ Заголовок статистики выходит за границы: ${titleWidth}px > ${statsWidth - 30}px`);
        }
       
        let currentY = statsY + 60;
        const lineHeight = 28;
       
        // Элементы статистики (с проверкой)
        const statItems = [
            { label: 'Всего узлов:', value: stats.nodes, color: '#212529' },
            { label: 'Высоконадёжных (3+ фото):', value: stats.highConfidenceNodes || 0, color: '#DC3545' },
            { label: 'Подтверждённых (2+ фото):', value: stats.confirmedNodes, color: '#FFC107' },
            { label: 'Новых (1 фото):', value: stats.nodes - stats.confirmedNodes, color: '#0D6EFD' },
            { label: 'Сред. подтверждений:', value: stats.stats.avgConfirmations?.toFixed(2) || '0.00', color: '#6C757D' },
            { label: 'Слияний моделей:', value: stats.stats.totalMerges, color: '#6C757D' }
        ];
       
        statItems.forEach(item => {
            ctx.fillStyle = '#6C757D';
            ctx.font = '16px Arial';
           
            // Обрезаем текст если не помещается
            let label = item.label;
            const maxLabelWidth = 250;
            let labelWidth = ctx.measureText(label).width;
           
            if (labelWidth > maxLabelWidth) {
                // Пробуем укоротить
                while (label.length > 10 && labelWidth > maxLabelWidth) {
                    label = label.substring(0, label.length - 1);
                    labelWidth = ctx.measureText(label + '...').width;
                }
                if (labelWidth > maxLabelWidth) {
                    label = label.substring(0, label.length - 3) + '...';
                }
            }
           
            ctx.fillText(label, statsX, currentY);
           
            ctx.fillStyle = item.color;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'right';
           
            // Значение
            const valueText = item.value.toString();
            const valueWidth = ctx.measureText(valueText).width;
            const maxValueX = statsX + statsWidth - 30;
           
            if (valueWidth > 100) {
                // Если значение слишком длинное
                ctx.font = 'bold 14px Arial';
            }
           
            ctx.fillText(valueText, maxValueX, currentY);
            ctx.textAlign = 'left';
           
            currentY += lineHeight;
        });
       
        // 8. КРУГОВАЯ ДИАГРАММА (ниже статистики)
        const pieChartX = statsX + statsWidth / 2;
        const pieChartY = currentY + 100;
        const pieRadius = 70;
       
        const totalNodes = stats.nodes;
        const highConfidencePercent = totalNodes > 0 ?
            Math.round((stats.highConfidenceNodes || 0) / totalNodes * 100) : 0;
        const confirmedPercent = totalNodes > 0 ?
            Math.round(stats.confirmedNodes / totalNodes * 100) : 0;
        const newPercent = totalNodes > 0 ?
            100 - confirmedPercent : 0;
       
        // Рисуем диаграмму
        if (totalNodes > 0) {
            let startAngle = 0;
           
            // Высоконадёжные
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
           
            // Подтверждённые
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
           
            // Новые
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
       
        // Обводка
        ctx.strokeStyle = '#E9ECEF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pieChartX, pieChartY, pieRadius, 0, Math.PI * 2);
        ctx.stroke();
       
        // Подпись
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('РАСПРЕДЕЛЕНИЕ УЗЛОВ', pieChartX, pieChartY + pieRadius + 25);
       
        // 9. ЛЕГЕНДА (под диаграммой)
        const legendY = pieChartY + pieRadius + 60;
        const legendHeight = 120;
       
        ctx.fillStyle = 'rgba(248, 249, 250, 0.9)';
        ctx.fillRect(statsX - 15, legendY - 10, statsWidth, legendHeight);
        ctx.strokeStyle = '#6C757D';
        ctx.lineWidth = 1;
        ctx.strokeRect(statsX - 15, legendY - 10, statsWidth, legendHeight);
       
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📖 ОБОЗНАЧЕНИЯ', statsX, legendY + 20);
       
        // Легенда в 2 колонки
        const legendItems = [
            { color: '#DC3545', label: '3+ фото (выс.)', size: 10 },
            { color: '#FFC107', label: '2 фото (ср.)', size: 8 },
            { color: '#0D6EFD', label: '1 фото (низ.)', size: 6 },
            { color: '#28A745', label: 'Новый узел', size: 0 }
        ];
       
        let legendRowY = legendY + 50;
       
        legendItems.forEach((item, index) => {
            const colX = statsX + (index % 2) * 180;
            const colY = legendRowY + Math.floor(index / 2) * 35;
           
            // Пример
            if (item.size > 0) {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(colX + 15, colY - 8, item.size, 0, Math.PI * 2);
                ctx.fill();
               
                // Цифра для 2+
                if (item.color !== '#0D6EFD') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = 'bold 9px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const label = item.color === '#DC3545' ? '3+' : '2';
                    ctx.fillText(label, colX + 15, colY - 8);
                    ctx.textAlign = 'left';
                }
            } else {
                // Новый узел
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(colX + 15, colY - 8, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#28A745';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(colX + 15, colY - 8, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
           
            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
           
            // Проверяем помещается ли текст
            const text = item.label;
            const textWidth = ctx.measureText(text).width;
            const maxTextWidth = 150;
           
            if (textWidth > maxTextWidth) {
                ctx.font = '12px Arial';
            }
           
            ctx.fillText(text, colX + 35, colY);
        });
       
        // 10. ПРОГРЕСС-БАР УВЕРЕННОСТИ (внизу, под диаграммой)
        const progressX = diagramX;
        const progressY = diagramY + diagramHeight + 50;
        const progressWidth = diagramWidth;
        const progressHeight = 25;
        const confidence = stats.stats.confidence;
       
        // Фон
        ctx.fillStyle = '#E9ECEF';
        ctx.fillRect(progressX, progressY, progressWidth, progressHeight);
       
        // Заполнение
        const fillWidth = progressWidth * confidence;
        let fillColor;
        if (confidence > 0.7) fillColor = '#198754';
        else if (confidence > 0.4) fillColor = '#FFC107';
        else fillColor = '#DC3545';
       
        ctx.fillStyle = fillColor;
        ctx.fillRect(progressX, progressY, fillWidth, progressHeight);
       
        // Текст
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const progressText = `УВЕРЕННОСТЬ: ${(confidence * 100).toFixed(1)}%`;
       
        // Проверяем помещается ли текст
        const progressTextWidth = ctx.measureText(progressText).width;
        if (progressTextWidth > fillWidth - 20) {
            ctx.font = 'bold 14px Arial';
        }
       
        ctx.fillText(progressText, progressX + fillWidth / 2, progressY + progressHeight / 2);
       
        // Обводка
        ctx.strokeStyle = '#495057';
        ctx.lineWidth = 1;
        ctx.strokeRect(progressX, progressY, progressWidth, progressHeight);
       
        // 11. ИНФОРМАЦИЯ О КАЧЕСТВЕ
        const qualityY = progressY + progressHeight + 30;
       
        let qualityText, qualityColor;
        if (confidence > 0.8) {
            qualityText = '✅ ВЫСОКОЕ КАЧЕСТВО';
            qualityColor = '#198754';
        } else if (confidence > 0.6) {
            qualityText = '⚠️ ХОРОШЕЕ КАЧЕСТВО';
            qualityColor = '#20C997';
        } else if (confidence > 0.4) {
            qualityText = 'ℹ️ СРЕДНЕЕ КАЧЕСТВО';
            qualityColor = '#FFC107';
        } else {
            qualityText = '❌ НИЗКОЕ КАЧЕСТВО';
            qualityColor = '#DC3545';
        }
       
        ctx.fillStyle = qualityColor;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
       
        // Проверяем помещается ли
        const qualityWidth = ctx.measureText(qualityText).width;
        if (qualityWidth > progressWidth) {
            ctx.font = 'bold 18px Arial';
        }
       
        ctx.fillText(qualityText, progressX + progressWidth / 2, qualityY);
       
        // 12. ФУТЕР
        const footerY = canvasHeight - 30;
       
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
       
        const footerText = `ID: ${stats.id.slice(0, 10)} | ${new Date().toLocaleString('ru-RU')}`;
        const footerWidth = ctx.measureText(footerText).width;
       
        if (footerWidth > canvasWidth - 40) {
            ctx.font = '11px Arial';
        }
       
        ctx.fillText(footerText, canvasWidth / 2, footerY);
       
        // 13. СОХРАНЕНИЕ
        const outputDir = path.join(this.config.dbPath, 'visualizations');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
       
        const outputPath = path.join(
            outputDir,
            `super_model_${userId}_${Date.now()}.png`
        );
       
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
           
            out.on('finish', () => {
                console.log(`✅ Визуализация создана: ${outputPath}`);
                resolve(outputPath);
            });
           
            out.on('error', (error) => {
                console.log(`❌ Ошибка сохранения: ${error.message}`);
                reject(error);
            });
        });
       
        return outputPath;
       
    } catch (error) {
        console.log(`❌ Ошибка создания визуализации: ${error.message}`);
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
