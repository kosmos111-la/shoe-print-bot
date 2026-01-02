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
    console.log(`🎨 Создаю визуализацию на основе лучшего следа...`);
   
    try {
        if (!vectorModel) {
            console.log('⚠️ Нет векторной модели');
            return null;
        }
       
        // Получаем информацию о лучшем графе
        const bestGraphInfo = vectorModel.getBestGraphInfo();
        const vizData = vectorModel.getVisualizationData();
        const stats = vectorModel.getInfo();
       
        console.log(`📊 Метод визуализации: ${vizData.metadata?.visualizationMethod || 'unknown'}`);
       
        // Определяем, используем ли мы лучший граф
        const usingBestGraph = bestGraphInfo && vizData.metadata?.visualizationMethod === 'best_graph_based';
       
        if (usingBestGraph) {
            console.log(`🏆 Использую лучший след: ${bestGraphInfo.graphId}`);
            console.log(`   Узлов в лучшем следе: ${bestGraphInfo.nodeCount}`);
            console.log(`   Оценка: ${bestGraphInfo.score.toFixed(3)}`);
        } else {
            console.log(`⚠️ Использую классическую визуализацию (лучший след не найден)`);
        }
       
        // Создаем канвас
        const canvasWidth = 1400;
        const canvasHeight = 1000;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
       
        // 1. ФОН
        ctx.fillStyle = usingBestGraph ? '#F0F9FF' : '#F8F9FA'; // Голубой если лучший граф
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
       
        // 2. ЗАГОЛОВОК
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
       
        if (usingBestGraph) {
            ctx.fillText('🏗️ СУПЕР-МОДЕЛЬ НА ОСНОВЕ ЛУЧШЕГО СЛЕДА', canvasWidth / 2, 50);
        } else {
            ctx.fillText('🏗️ ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ', canvasWidth / 2, 50);
        }
       
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`Уверенность: ${(stats.stats.confidence * 100).toFixed(1)}% | Узлов: ${stats.nodes}`,
                    canvasWidth / 2, 85);
       
        if (usingBestGraph && bestGraphInfo) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#0D6EFD';
            ctx.fillText(`Лучший след: ${bestGraphInfo.graphId?.slice(0, 12)}... (${bestGraphInfo.nodeCount} узлов)`,
                        canvasWidth / 2, 115);
        }
       
        // 3. РАЗДЕЛЕНИЕ НА ОБЛАСТИ
        const topologyWidth = 800;
        const topologyHeight = 700;
        const statsWidth = 500;
        const margin = 50;
       
        // 4. ТОПОЛОГИЧЕСКАЯ ДИАГРАММА
        const topologyX = margin;
        const topologyY = 150;
       
        // Рамка
        ctx.strokeStyle = usingBestGraph ? '#0D6EFD' : '#495057';
        ctx.lineWidth = 2;
        ctx.strokeRect(topologyX - 5, topologyY - 5, topologyWidth + 10, topologyHeight + 10);
       
        // Заголовок области
        ctx.fillStyle = usingBestGraph ? '#0D6EFD' : '#495057';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ТОПОЛОГИЯ ПРОТЕКТОРА', topologyX + topologyWidth / 2, topologyY - 15);
       
        if (usingBestGraph) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#6C757D';
            ctx.fillText('(на основе лучшего следа с наложением статистики подтверждений)',
                        topologyX + topologyWidth / 2, topologyY + 5);
        }
       
        // 5. РИСУЕМ ТОПОЛОГИЮ
        if (vizData.nodes && vizData.nodes.length > 0) {
            // Находим границы для масштабирования
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
           
            vizData.nodes.forEach(node => {
                // Используем реальные координаты если есть, иначе нормализованные
                const x = node.x !== undefined ? node.x : node.nx * 1000;
                const y = node.y !== undefined ? node.y : node.ny * 1000;
               
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            });
           
            // Добавляем отступы
            const padding = 50;
            const width = Math.max(1, maxX - minX) + padding * 2;
            const height = Math.max(1, maxY - minY) + padding * 2;
           
            // Масштабируем чтобы вместить в область
            const scaleX = topologyWidth / width;
            const scaleY = topologyHeight / height;
            const scale = Math.min(scaleX, scaleY) * 0.85;
           
            // Смещение
            const offsetX = topologyX + (topologyWidth - width * scale) / 2;
            const offsetY = topologyY + (topologyHeight - height * scale) / 2;
           
            // Сортируем узлы - сначала с высокими подтверждениями
            const sortedNodes = [...vizData.nodes].sort((a, b) => b.confirmedCount - a.confirmedCount);
           
            // Рисуем связи (только для узлов с подтверждениями)
            ctx.strokeStyle = 'rgba(108, 117, 125, 0.2)';
            ctx.lineWidth = 1;
           
            for (let i = 0; i < sortedNodes.length; i++) {
                for (let j = i + 1; j < sortedNodes.length; j++) {
                    const node1 = sortedNodes[i];
                    const node2 = sortedNodes[j];
                   
                    // Только если оба узла имеют подтверждения
                    if (node1.confirmedCount > 1 && node2.confirmedCount > 1) {
                        const x1 = offsetX + (node1.x - minX + padding) * scale;
                        const y1 = offsetY + (node1.y - minY + padding) * scale;
                        const x2 = offsetX + (node2.x - minX + padding) * scale;
                        const y2 = offsetY + (node2.y - minY + padding) * scale;
                       
                        // Расстояние
                        const dx = x2 - x1;
                        const dy = y2 - y1;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                       
                        // Рисуем только близкие связи
                        if (distance < 100) {
                            // Цвет связи в зависимости от подтверждений
                            const minConf = Math.min(node1.confirmedCount, node2.confirmedCount);
                            if (minConf >= 3) {
                                ctx.strokeStyle = 'rgba(220, 53, 69, 0.3)';
                            } else if (minConf === 2) {
                                ctx.strokeStyle = 'rgba(255, 193, 7, 0.3)';
                            } else {
                                ctx.strokeStyle = 'rgba(13, 110, 253, 0.2)';
                            }
                           
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();
                        }
                    }
                }
            }
           
            // Рисуем узлы
            sortedNodes.forEach(node => {
                const x = offsetX + (node.x - minX + padding) * scale;
                const y = offsetY + (node.y - minY + padding) * scale;
               
                // Цвет и размер по подтверждениям
                let color, radius;
                if (node.confirmedCount >= 3) {
                    color = '#DC3545'; // Красный - высокие
                    radius = 10;
                } else if (node.confirmedCount === 2) {
                    color = '#FFC107'; // Желтый - средние
                    radius = 8;
                } else {
                    color = '#0D6EFD'; // Синий - низкие
                    radius = 6;
                }
               
                // Рисуем узел
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
               
                // Обводка для узлов из лучшего графа
                if (node.isBestGraphNode) {
                    ctx.strokeStyle = '#28A745';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
               
                // Цифра подтверждений для 2+
                if (node.confirmedCount > 1) {
                    ctx.fillStyle = node.confirmedCount >= 3 ? '#FFFFFF' : '#000000';
                    ctx.font = `bold ${Math.max(10, radius / 1.2)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(node.confirmedCount.toString(), x, y);
                    ctx.textAlign = 'left';
                }
            });
           
            // Если у нас лучший граф, добавляем пояснение
            if (usingBestGraph) {
                ctx.fillStyle = '#28A745';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'left';
                ctx.fillText('🟢 Обводка - узлы из лучшего следа', topologyX + 10, topologyY + topologyHeight + 25);
            }
        }
       
        // 6. ПРАВАЯ КОЛОНКА - СТАТИСТИКА
        const statsX = topologyX + topologyWidth + margin;
        const statsY = topologyY;
        const statsPanelWidth = statsWidth - margin * 2;
       
        // Фон статистики
        ctx.fillStyle = 'rgba(248, 249, 250, 0.95)';
        ctx.fillRect(statsX - 15, statsY - 15, statsPanelWidth, topologyHeight);
        ctx.strokeStyle = '#6C757D';
        ctx.lineWidth = 2;
        ctx.strokeRect(statsX - 15, statsY - 15, statsPanelWidth, topologyHeight);
       
        // Заголовок статистики
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ', statsX, statsY + 20);
       
        let currentY = statsY + 60;
        const lineHeight = 28;
       
        // Основная статистика
        const statItems = [
            { label: 'Всего узлов:', value: stats.nodes, color: '#212529' },
            { label: 'Высоконадёжных (3+ фото):', value: stats.highConfidenceNodes || 0, color: '#DC3545' },
            { label: 'Подтверждённых (2 фото):', value: stats.confirmedNodes, color: '#FFC107' },
            { label: 'Новых (1 фото):', value: stats.nodes - stats.confirmedNodes, color: '#0D6EFD' },
            { label: 'Сред. подтверждений:', value: stats.stats.avgConfirmations?.toFixed(2) || '0.00', color: '#6C757D' },
            { label: 'Слияний моделей:', value: stats.stats.totalMerges, color: '#6C757D' }
        ];
       
        if (usingBestGraph && bestGraphInfo) {
            statItems.push(
                { label: 'Узлов в лучшем следе:', value: bestGraphInfo.nodeCount, color: '#28A745' },
                { label: 'Оценка лучшего следа:', value: bestGraphInfo.score.toFixed(3), color: '#28A745' }
            );
        }
       
        statItems.forEach(item => {
            ctx.fillStyle = '#6C757D';
            ctx.font = '16px Arial';
            ctx.fillText(item.label, statsX, currentY);
           
            ctx.fillStyle = item.color;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(item.value.toString(), statsX + statsPanelWidth - 30, currentY);
            ctx.textAlign = 'left';
           
            currentY += lineHeight;
        });
       
        // 7. КРУГОВАЯ ДИАГРАММА
        const pieChartX = statsX + statsPanelWidth / 2;
        const pieChartY = currentY + 100;
        const pieRadius = 80;
       
        const totalNodes = stats.nodes;
        const highPercent = totalNodes > 0 ? Math.round((stats.highConfidenceNodes || 0) / totalNodes * 100) : 0;
        const confirmedPercent = totalNodes > 0 ? Math.round(stats.confirmedNodes / totalNodes * 100) : 0;
        const newPercent = totalNodes > 0 ? 100 - confirmedPercent : 0;
       
        // Рисуем диаграмму
        if (totalNodes > 0) {
            let startAngle = 0;
           
            if (highPercent > 0) {
                const angle = (highPercent / 100) * Math.PI * 2;
                ctx.fillStyle = '#DC3545';
                ctx.beginPath();
                ctx.moveTo(pieChartX, pieChartY);
                ctx.arc(pieChartX, pieChartY, pieRadius, startAngle, startAngle + angle);
                ctx.closePath();
                ctx.fill();
                startAngle += angle;
            }
           
            if (confirmedPercent - highPercent > 0) {
                const angle = ((confirmedPercent - highPercent) / 100) * Math.PI * 2;
                ctx.fillStyle = '#FFC107';
                ctx.beginPath();
                ctx.moveTo(pieChartX, pieChartY);
                ctx.arc(pieChartX, pieChartY, pieRadius, startAngle, startAngle + angle);
                ctx.closePath();
                ctx.fill();
                startAngle += angle;
            }
           
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
       
        // 8. ЛЕГЕНДА
        const legendY = pieChartY + pieRadius + 60;
       
        ctx.fillStyle = '#495057';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📖 ЛЕГЕНДА', statsX, legendY);
       
        const legendItems = [
            { color: '#DC3545', label: '🔴 3+ фото (выс. надёжность)', example: '● 3' },
            { color: '#FFC107', label: '🟡 2 фото (ср. надёжность)', example: '● 2' },
            { color: '#0D6EFD', label: '🔵 1 фото (низ. надёжность)', example: '●' }
        ];
       
        if (usingBestGraph) {
            legendItems.push({ color: '#28A745', label: '🟢 Узел из лучшего следа', example: '🟢' });
        }
       
        let legendRowY = legendY + 35;
       
        legendItems.forEach((item, index) => {
            const y = legendRowY + index * 30;
           
            // Пример
            if (item.color === '#28A745') {
                // Для обводки
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(statsX + 15, y - 8, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#28A745';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(statsX + 15, y - 8, 8, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(statsX + 15, y - 8, 8, 0, Math.PI * 2);
                ctx.fill();
               
                // Цифра если есть
                if (item.example && item.example.includes('3')) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('3+', statsX + 15, y - 8);
                } else if (item.example && item.example.includes('2')) {
                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('2', statsX + 15, y - 8);
                }
                ctx.textAlign = 'left';
            }
           
            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '14px Arial';
            ctx.fillText(item.label, statsX + 35, y);
        });
       
        // 9. ПРОГРЕСС-БАР УВЕРЕННОСТИ
        const progressX = topologyX;
        const progressY = topologyY + topologyHeight + 60;
        const progressWidth = topologyWidth;
        const progressHeight = 25;
        const confidence = stats.stats.confidence;
       
        // Фон
        ctx.fillStyle = '#E9ECEF';
        ctx.fillRect(progressX, progressY, progressWidth, progressHeight);
       
        // Заполнение
        const fillWidth = progressWidth * confidence;
        let fillColor;
        if (confidence > 0.8) fillColor = '#198754';
        else if (confidence > 0.6) fillColor = '#20C997';
        else if (confidence > 0.4) fillColor = '#FFC107';
        else fillColor = '#DC3545';
       
        ctx.fillStyle = fillColor;
        ctx.fillRect(progressX, progressY, fillWidth, progressHeight);
       
        // Текст
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`УВЕРЕННОСТЬ СУПЕР-МОДЕЛИ: ${(confidence * 100).toFixed(1)}%`,
                    progressX + progressWidth / 2, progressY + progressHeight / 2);
       
        // Обводка
        ctx.strokeStyle = '#495057';
        ctx.lineWidth = 1;
        ctx.strokeRect(progressX, progressY, progressWidth, progressHeight);
       
        // 10. ОЦЕНКА КАЧЕСТВА
        const qualityY = progressY + progressHeight + 40;
       
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
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(qualityText, progressX + progressWidth / 2, qualityY);
       
        // 11. ФУТЕР
        const footerY = canvasHeight - 30;
       
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`ID: ${stats.id.slice(0, 10)} | ${new Date().toLocaleString('ru-RU')} | Метод: ${usingBestGraph ? 'лучший след' : 'классический'}`,
                    canvasWidth / 2, footerY);
       
        // 12. СОХРАНЕНИЕ
        const outputDir = path.join(this.config.dbPath, 'visualizations');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
       
        const outputPath = path.join(
            outputDir,
            `super_model_best_${userId}_${Date.now()}.png`
        );
       
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
           
            out.on('finish', () => {
                const fileSize = fs.statSync(outputPath).size;
                console.log(`✅ Визуализация создана: ${outputPath}`);
                console.log(`   Метод: ${usingBestGraph ? 'на основе лучшего следа' : 'классический'}`);
                console.log(`   Размер: ${canvasWidth}x${canvasHeight}px, Файл: ${(fileSize / 1024).toFixed(1)}KB`);
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
