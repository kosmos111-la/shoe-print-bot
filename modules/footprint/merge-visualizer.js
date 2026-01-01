// modules/footprint/merge-visualizer.js
// МИНИМАЛЬНЫЙ РАБОЧИЙ ВИЗУАЛИЗАТОР - С ДОБАВЛЕНИЕМ ВИЗУАЛИЗАЦИИ СУПЕР-МОДЕЛИ

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class MergeVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './temp/merge_visualizations',
            width: options.width || 1200,
            height: options.height || 900,
            backgroundColor: options.backgroundColor || '#ffffff',
            debug: options.debug || false,
            // Цвета для супер-модели
            confirmedNodeColor: '#FF0000',     // Красный - подтверждённые узлы
            unconfirmedNodeColor: '#000000',   // Чёрный - неподтверждённые
            confirmedEdgeColor: '#FF0000',     // Красный - совпавшие связи
            unconfirmedEdgeColor: '#CCCCCC',   // Серый - неподтверждённые связи
            lastModelOutlineColor: '#000000',  // Чёрная обводка для узлов последней модели
            nodeRadius: 3,                     // Маленькие точки
            lastModelOutlineWidth: 2,          // Толщина обводки
            ...options
        };
   
        // Создать директорию для визуализаций
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
   
        console.log(`🎨 MergeVisualizer создан: ${this.config.width}x${this.config.height}`);
    }

    // 🔴🔴🔴 ДОБАВЛЕНО: МЕТОДЫ-ЗАГЛУШКИ ДЛЯ СОВМЕСТИМОСТИ
    async visualizeMerge(footprint1, footprint2, comparisonResult, options = {}) {
        console.log('🔄 Автоматически вызываю visualizeSuperModel вместо visualizeMerge');
        // Если сравнение показывает схожесть, используем визуализацию супер-модели
        if (comparisonResult?.similarity > 0.7) {
            return await this.visualizeSuperModel(footprint1, footprint2, options);
        }
        // Иначе обычную визуализацию
        return await this.visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options);
    }

    async visualizeIntelligentMerge(footprint1, footprint2, comparisonResult, options = {}) {
        console.log('🧠 Автоматически вызываю visualizeSuperModel вместо visualizeIntelligentMerge');
        return await this.visualizeSuperModel(footprint1, footprint2, options);
    }

    async visualizeClassicMerge(footprint1, footprint2, comparisonResult, options = {}) {
        console.log('📊 Автоматически вызываю visualizeSuperModel вместо visualizeClassicMerge');
        return await this.visualizeSuperModel(footprint1, footprint2, options);
    }
    // 🔴🔴🔴 КОНЕЦ ДОБАВЛЕННЫХ МЕТОДОВ

    // 1. ОСНОВНОЙ МЕТОД - ПРОСТАЯ ВИЗУАЛИЗАЦИЯ
    async visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options = {}) {
        console.log('🎨 Запускаю простую визуализацию...');
    
        const timestamp = Date.now();
        const outputPath = options.outputPath ||
                          path.join(this.config.outputDir, `topology_merge_${timestamp}.png`);
   
        try {
            // Минимальная проверка
            if (!footprint1 || !footprint2) {
                throw new Error('Нет данных отпечатков');
            }
       
            // Создаем канвас
            const canvas = createCanvas(this.config.width, this.config.height);
            const ctx = canvas.getContext('2d');
       
            // ФОН
            ctx.fillStyle = this.config.backgroundColor;
            ctx.fillRect(0, 0, this.config.width, this.config.height);
       
            // ЗАГОЛОВОК
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 32px Arial';
            ctx.fillText('🏗️ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ', 50, 50);
       
            // СХОЖЕСТЬ
            const similarity = comparisonResult?.similarity || 0;
            ctx.font = '24px Arial';
            ctx.fillStyle = similarity > 0.7 ? '#00aa00' : '#ff0000';
            ctx.fillText(`Схожесть: ${(similarity * 100).toFixed(1)}%`, 50, 100);
       
            // ПРОСТАЯ СТАТИСТИКА
            ctx.fillStyle = '#000000';
            ctx.font = '18px Arial';
       
            let y = 200;
            const lineHeight = 30;
       
            // Получаем размеры графов безопасно
            const nodes1 = this.getNodeCount(footprint1);
            const nodes2 = this.getNodeCount(footprint2);
       
            ctx.fillText(`📊 След 1: ${nodes1} узлов`, 50, y);
            y += lineHeight;
            ctx.fillText(`📊 След 2: ${nodes2} узлов`, 50, y);
            y += lineHeight;
       
            // Информация о слиянии
            if (comparisonResult?.decision) {
                ctx.fillText(`✅ Решение: ${comparisonResult.decision}`, 50, y);
                y += lineHeight;
            }
       
            if (comparisonResult?.reason) {
                ctx.fillText(`💡 ${comparisonResult.reason}`, 50, y);
                y += lineHeight;
            }
       
            // Простая диаграмма (круги для наглядности)
            this.drawSimpleDiagram(ctx, nodes1, nodes2, similarity);
       
            // Информация о времени
            ctx.font = '14px Arial';
            ctx.fillStyle = '#666666';
            ctx.fillText(`🕒 ${new Date().toLocaleString('ru-RU')}`, 50, this.config.height - 50);
       
            // Сохраняем
            await this.saveCanvas(canvas, outputPath);
       
            console.log(`✅ Визуализация создана: ${outputPath}`);
       
            return {
                success: true,
                path: outputPath,
                stats: {
                    similarity: similarity,
                    nodes1: nodes1,
                    nodes2: nodes2
                }
            };
       
        } catch (error) {
            console.log(`❌ Ошибка визуализации: ${error.message}`);
            // Создаем самую простую картинку
            return await this.createErrorVisualization(error.message, outputPath);
        }
    }

    // 2. НОВЫЙ МЕТОД: ВИЗУАЛИЗАЦИЯ СУПЕР-МОДЕЛИ (ИСПРАВЛЕННЫЙ)
    async visualizeSuperModel(superModel, lastModel = null, options = {}) {
        console.log('🏗️ Визуализация супер-модели...');
     
        const timestamp = Date.now();
        const outputPath = options.outputPath ||
                          path.join(this.config.outputDir, `super_model_${timestamp}.png`);
     
        try {
            if (!superModel || !superModel.graph) {
                throw new Error('Нет данных супер-модели');
            }
         
            // Получаем информацию о подтверждениях узлов (ИСПРАВЛЕННЫЙ МЕТОД)
            const nodeConfirmations = this.getNodeConfirmations(superModel);
         
            // Создаем канвас
            const canvas = createCanvas(this.config.width, this.config.height);
            const ctx = canvas.getContext('2d');
         
            // БЕЛЫЙ ФОН
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, this.config.width, this.config.height);
         
            // Нормализуем позиции узлов для отображения
            const normalizedNodes = this.normalizeNodesForDisplay(superModel.graph.nodes);
         
            // РИСУЕМ СВЯЗИ
            this.drawEdges(ctx, superModel.graph, normalizedNodes, nodeConfirmations);
         
            // РИСУЕМ УЗЛЫ (ИСПРАВЛЕННЫЙ МЕТОД - с цветами по подтверждениям)
            this.drawNodes(ctx, normalizedNodes, nodeConfirmations, lastModel);
         
            // ДОБАВЛЯЕМ ЛЕГЕНДУ (ОБНОВЛЕННУЮ)
            this.drawLegend(ctx);
         
            // ДОБАВЛЯЕМ СТАТИСТИКУ (ОБНОВЛЕННУЮ)
            this.drawStats(ctx, superModel, nodeConfirmations);
         
            // Сохраняем
            await this.saveCanvas(canvas, outputPath);
         
            console.log(`✅ Визуализация супер-модели создана: ${outputPath}`);
         
            return {
                success: true,
                path: outputPath,
                stats: {
                    totalNodes: normalizedNodes.length,
                    confirmedNodes: nodeConfirmations.confirmedCount,
                    unconfirmedNodes: nodeConfirmations.unconfirmedCount,
                    averageConfirmations: nodeConfirmations.averageConfirmations,
                    trackerStats: nodeConfirmations.trackerStats
                }
            };
         
        } catch (error) {
            console.log(`❌ Ошибка визуализации супер-модели: ${error.message}`);
            return await this.createErrorVisualization(error.message, outputPath);
        }
    }

    // 3. ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ПОДТВЕРЖДЕНИЯХ УЗЛОВ (ИСПРАВЛЕННЫЙ)
    getNodeConfirmations(footprint) {
        console.log('🔍 Получаю подтверждения для супер-модели...');

        // ПРОВЕРЯЕМ: Есть ли у отпечатка PointTracker?
        let useTracker = false;
        let trackerStats = null;
        let trackerPointsMap = new Map();

        if (footprint.pointTracker && typeof footprint.pointTracker.getStats === 'function') {
            console.log('🎯 Использую PointTracker для подтверждений');
            useTracker = true;
            trackerStats = footprint.pointTracker.getStats();

            // 🔥 Собираем все точки трекера в карту для быстрого доступа
            for (const [trackerId, trackerPoint] of footprint.pointTracker.points) {
                trackerPointsMap.set(trackerId, trackerPoint);
            }
            console.log(`📊 Трекер содержит ${trackerPointsMap.size} точек`);
        }

        const confirmations = new Map();
        let confirmedCount = 0;
        let totalConfirmations = 0;

        // 🔥 ИСПРАВЛЕНИЕ: УБИРАЕМ ПОНЯТИЕ "НЕПОДТВЕРЖДЕННЫХ" УЗЛОВ
        // Теперь все узлы имеют минимум 1 подтверждение!
        let nodesWith0 = 0;
        let nodesWith1 = 0;
        let nodesWith2 = 0;
        let nodesWith3 = 0;
        let nodesWith4Plus = 0;

        // Проходим по всем узлам графа
        if (footprint.graph && footprint.graph.nodes) {
            for (const [nodeId, node] of footprint.graph.nodes) {
                let confirmationCount = 1; // 🔥 ИСПРАВЛЕНИЕ: МИНИМУМ 1 ПОДТВЕРЖДЕНИЕ!

                // 🔥 ПРИОРИТЕТ 1: Используем PointTracker если есть связь
                if (useTracker && node.pointTrackerId) {
                    const trackedPoint = trackerPointsMap.get(node.pointTrackerId);
                    if (trackedPoint && trackedPoint.confirmedCount > 0) {
                        confirmationCount = trackedPoint.confirmedCount;
                    }
                }
                // 🔥 ПРИОРИТЕТ 2: Используем confirmedCount из узла
                else if (node.confirmedCount !== undefined && node.confirmedCount > 0) {
                    confirmationCount = node.confirmedCount;
                }
                // 🔥 ПРИОРИТЕТ 3: Используем sources если есть
                else if (node.sources && Array.isArray(node.sources) && node.sources.length > 0) {
                    confirmationCount = Math.max(1, node.sources.length);
                }

                // 🔥 ГАРАНТИРУЕМ: минимум 1 подтверждение!
                confirmationCount = Math.max(1, confirmationCount);

                // Сохраняем информацию
                confirmations.set(nodeId, confirmationCount);

                // Считаем статистику
                if (confirmationCount >= 4) {
                    nodesWith4Plus++;
                    totalConfirmations += confirmationCount;
                } else if (confirmationCount === 3) {
                    nodesWith3++;
                    totalConfirmations += confirmationCount;
                } else if (confirmationCount === 2) {
                    nodesWith2++;
                    totalConfirmations += confirmationCount;
                } else if (confirmationCount === 1) {
                    nodesWith1++;
                    totalConfirmations += 1;
                } else {
                    // 🔥 НЕ ДОЛЖНО БЫТЬ НУЛЕВЫХ ПОДТВЕРЖДЕНИЙ!
                    nodesWith0++;
                    console.log(`⚠️ Узел ${nodeId} имеет 0 подтверждений! Принудительно устанавливаю 1`);
                    confirmations.set(nodeId, 1);
                    nodesWith1++;
                    totalConfirmations += 1;
                }

                // Считаем подтвержденные узлы (с 2+ подтверждениями)
                if (confirmationCount >= 2) {
                    confirmedCount++;
                }
            }
        }

        const totalNodes = (footprint.graph && footprint.graph.nodes) ? footprint.graph.nodes.size : 0;
       
        // 🔥 ИСПРАВЛЕНИЕ: "неподтвержденных" узлов теперь не существует
        // Все узлы имеют минимум 1 подтверждение
        const unconfirmedCount = 0; // Теперь это всегда 0

        const result = {
            map: confirmations,
            confirmedCount,           // Узлы с 2+ подтверждениями
            unconfirmedCount: 0,      // 🔥 ВСЕГДА 0 - нет неподтвержденных узлов
            nodesWith1: nodesWith1,   // Узлы с 1 подтверждением (СИНИЕ)
            nodesWith2: nodesWith2,   // Узлы с 2 подтверждениями (ОРАНЖЕВЫЕ)
            nodesWith3: nodesWith3,   // Узлы с 3 подтверждениями (ЖЁЛТЫЕ)
            nodesWith4Plus: nodesWith4Plus, // Узлы с 4+ подтверждениями (КРАСНЫЕ)
            totalNodes: totalNodes,
            averageConfirmations: totalNodes > 0 ? totalConfirmations / totalNodes : 1
        };

        // 🔥 Добавляем статистику из трекера если есть
        if (trackerStats) {
            result.trackerStats = trackerStats;
            console.log(`📊 PointTracker: ${trackerStats.highConfidencePoints} высоконадёжных точек`);
        }

        console.log(`📊 Подтверждения: ${confirmedCount} узлов с 2+ подтверждениями`);
        console.log(`📈 Распределение: 4+=${nodesWith4Plus}, 3=${nodesWith3}, 2=${nodesWith2}, 1=${nodesWith1}`);
        console.log(`🔵 Узлов с 1 подтверждением: ${nodesWith1} (СИНИЕ)`);

        return result;
    }

    // 4. НОРМАЛИЗАЦИЯ УЗЛОВ ДЛЯ ОТОБРАЖЕНИЯ
    normalizeNodesForDisplay(nodes) {
        const nodesArray = Array.from(nodes.values());
     
        if (nodesArray.length === 0) {
            return [];
        }
     
        // Находим границы
        const xs = nodesArray.map(n => n.x || n.center?.x || 0);
        const ys = nodesArray.map(n => n.y || n.center?.y || 0);
     
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
     
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
     
        // Поля для отображения
        const padding = 100;
        const availableWidth = this.config.width - padding * 2;
        const availableHeight = this.config.height - padding * 2;
     
        // Коэффициент масштабирования
        const scale = Math.min(
            availableWidth / width,
            availableHeight / height
        ) * 0.9;
     
        // Нормализуем позиции
        return nodesArray.map(node => {
            const x = (node.x || node.center?.x || 0) - minX;
            const y = (node.y || node.center?.y || 0) - minY;
         
            return {
                ...node,
                id: node.id || 'unknown',
                displayX: padding + x * scale,
                displayY: padding + y * scale
            };
        });
    }

    // 5. РИСОВАНИЕ СВЯЗЕЙ
    drawEdges(ctx, graph, normalizedNodes, nodeConfirmations) {
        if (!graph.edges || graph.edges.size === 0) {
            return;
        }
     
        // Создаем карту узлов для быстрого доступа
        const nodeMap = new Map();
        normalizedNodes.forEach(node => {
            nodeMap.set(node.id, node);
        });
     
        // Рисуем каждое ребро
        for (const [edgeId, edge] of graph.edges) {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
         
            if (!fromNode || !toNode) continue;
         
            // Определяем цвет ребра на основе подтверждений узлов
            const fromConf = nodeConfirmations.map.get(edge.from) || 1; // Мин. 1
            const toConf = nodeConfirmations.map.get(edge.to) || 1; // Мин. 1
         
            let edgeColor;
            if (fromConf > 1 && toConf > 1) {
                edgeColor = this.config.confirmedEdgeColor; // Оба узла имеют 2+ подтверждения - красный
            } else if (fromConf >= 1 && toConf >= 1) {
                edgeColor = '#0066CC'; // 🔥 СИНИЙ - хотя бы один узел с 1 подтверждением
            } else {
                edgeColor = this.config.unconfirmedEdgeColor; // Серый (не должно быть)
            }
         
            // Рисуем линию
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(fromNode.displayX, fromNode.displayY);
            ctx.lineTo(toNode.displayX, toNode.displayY);
            ctx.stroke();
        }
    }

    // 6. РИСОВАНИЕ УЗЛОВ (ИСПРАВЛЕННЫЙ - с цветами по подтверждениям)
    drawNodes(ctx, normalizedNodes, nodeConfirmations, lastModel = null) {
        console.log(`🎨 Рисую ${normalizedNodes.length} узлов с подтверждениями...`);
   
        // Собираем ID узлов последней модели (если есть)
        const lastModelNodeIds = new Set();
        if (lastModel && lastModel.graph && lastModel.graph.nodes) {
            for (const [nodeId] of lastModel.graph.nodes) {
                lastModelNodeIds.add(nodeId);
            }
        }
   
        // 🔥 ИСПРАВЛЕНИЕ: Сортируем узлы - сначала с подтверждениями, потом с 1 подтверждением
        const sortedNodes = [...normalizedNodes].sort((a, b) => {
            const confA = nodeConfirmations.map.get(a.id) || 1;
            const confB = nodeConfirmations.map.get(b.id) || 1;
            return confB - confA; // Сначала узлы с большим количеством подтверждений
        });
   
        // Рисуем каждый узел
        sortedNodes.forEach(node => {
            const confirmationCount = nodeConfirmations.map.get(node.id) || 1; // 🔥 МИНИМУМ 1!
       
            // 🔥 ИСПРАВЛЕНИЕ: ЦВЕТ УЗЛА на основе количества подтверждений
            let nodeColor;
            let nodeRadius = this.config.nodeRadius;
            let drawNumber = false; // Рисовать ли цифру подтверждения
       
            if (confirmationCount >= 4) {
                // 🔴 Красный - 4+ подтверждений (многократно подтвержденный)
                nodeColor = '#FF0000';
                nodeRadius = this.config.nodeRadius + 3;
                drawNumber = true;
            } else if (confirmationCount === 3) {
                // 🟡 Жёлтый - 3 подтверждения
                nodeColor = '#FFFF00';
                nodeRadius = this.config.nodeRadius + 2;
                drawNumber = true;
            } else if (confirmationCount === 2) {
                // 🟠 Оранжевый - 2 подтверждения
                nodeColor = '#FFA500';
                nodeRadius = this.config.nodeRadius + 1;
                drawNumber = true;
            } else if (confirmationCount === 1) {
                // 🔵 СИНИЙ - 1 подтверждение (однократно подтвержденный)
                nodeColor = '#0066CC';
                nodeRadius = this.config.nodeRadius;
                drawNumber = false; // Не показываем цифру "1"
            } else {
                // 🔥 ЭТО НЕ ДОЛЖНО ПРОИСХОДИТЬ! Но на всякий случай
                nodeColor = '#000000';
                nodeRadius = this.config.nodeRadius;
                drawNumber = false;
            }
       
            // Рисуем узел
            ctx.fillStyle = nodeColor;
            ctx.beginPath();
            ctx.arc(node.displayX, node.displayY, nodeRadius, 0, Math.PI * 2);
            ctx.fill();
       
            // Обводка для узлов последней модели (если узел из последней модели)
            if (lastModelNodeIds.has(node.id)) {
                ctx.strokeStyle = this.config.lastModelOutlineColor;
                ctx.lineWidth = this.config.lastModelOutlineWidth;
                ctx.beginPath();
                ctx.arc(node.displayX, node.displayY, nodeRadius + 2, 0, Math.PI * 2);
                ctx.stroke();
            }
       
            // 🔥 ЦИФРА ПОДТВЕРЖДЕНИЙ (для узлов с 2+ подтверждениями)
            if (drawNumber) {
                ctx.fillStyle = confirmationCount >= 4 ? '#FFFFFF' : '#000000';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(confirmationCount.toString(), node.displayX, node.displayY);
                ctx.textAlign = 'left';
            }
        });
   
        console.log(`✅ Узлы нарисованы: ${sortedNodes.length} точек`);
    }

    // 7. РИСОВАНИЕ ЛЕГЕНДЫ (ОБНОВЛЕННАЯ)
    drawLegend(ctx) {
        const legendX = this.config.width - 250;
        const legendY = 50;
   
        // Фон легенды (увеличили высоту для новых элементов)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(legendX - 10, legendY - 10, 240, 230);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX - 10, legendY - 10, 240, 230);
   
        // Заголовок
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('📖 ЛЕГЕНДА ПОДТВЕРЖДЕНИЙ', legendX, legendY);
   
        let y = legendY + 30;
        const lineHeight = 25;
   
        // Элементы легенды с новыми цветами
        const legendItems = [
            {
                color: '#FF0000',
                text: '🔴 Узел с 4+ подтверждениями',
                drawSample: (x, y) => {
                    ctx.fillStyle = '#FF0000';
                    ctx.beginPath();
                    ctx.arc(x, y, this.config.nodeRadius + 3, 0, Math.PI * 2);
                    ctx.fill();
                    // Цифра
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = 'bold 8px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('4+', x, y);
                    ctx.textAlign = 'left';
                }
            },
            {
                color: '#FFFF00',
                text: '🟡 Узел с 3 подтверждениями',
                drawSample: (x, y) => {
                    ctx.fillStyle = '#FFFF00';
                    ctx.beginPath();
                    ctx.arc(x, y, this.config.nodeRadius + 2, 0, Math.PI * 2);
                    ctx.fill();
                    // Цифра
                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 8px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('3', x, y);
                    ctx.textAlign = 'left';
                }
            },
            {
                color: '#FFA500',
                text: '🟠 Узел с 2 подтверждениями',
                drawSample: (x, y) => {
                    ctx.fillStyle = '#FFA500';
                    ctx.beginPath();
                    ctx.arc(x, y, this.config.nodeRadius + 1, 0, Math.PI * 2);
                    ctx.fill();
                    // Цифра
                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 8px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('2', x, y);
                    ctx.textAlign = 'left';
                }
            },
            {
                color: '#0066CC',
                text: '🔵 Узел с 1 подтверждением',
                drawSample: (x, y) => {
                    ctx.fillStyle = '#0066CC';
                    ctx.beginPath();
                    ctx.arc(x, y, this.config.nodeRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
            {
                color: '#000000',
                text: '⭕ Узел из последнего следа',
                drawSample: (x, y) => {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.arc(x, y, this.config.nodeRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = this.config.lastModelOutlineWidth;
                    ctx.beginPath();
                    ctx.arc(x, y, this.config.nodeRadius + 2, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        ];
   
        // Рисуем элементы легенды
        legendItems.forEach(item => {
            const sampleX = legendX;
            const sampleY = y - 8;
   
            item.drawSample(sampleX + 10, sampleY);
   
            ctx.fillStyle = '#000000';
            ctx.font = '12px Arial';
            ctx.fillText(item.text, sampleX + 30, y);
   
            y += lineHeight;
        });
    }

    // 8. РИСОВАНИЕ СТАТИСТИКИ (ОБНОВЛЕННАЯ)
    drawStats(ctx, superModel, nodeConfirmations) {
        const statsX = 20;
        const statsY = 50;
   
        // Фон статистики (увеличиваем высоту)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(statsX - 10, statsY - 10, 320, 180); // Было 300x140
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(statsX - 10, statsY - 10, 320, 180);
   
        // Заголовок
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('📊 СТАТИСТИКА СУПЕР-МОДЕЛИ', statsX, statsY);
   
        let y = statsY + 30;
        const lineHeight = 20;
   
        // 🔥 ИСПРАВЛЕНИЕ: Статистические данные с подтверждениями
        const statsItems = [
            `🏗️ Всего узлов: ${nodeConfirmations.totalNodes || 0}`,
            `🔴 4+ фото: ${nodeConfirmations.nodesWith4Plus || 0}`,
            `🟡 3 фото: ${nodeConfirmations.nodesWith3 || 0}`,
            `🟠 2 фото: ${nodeConfirmations.nodesWith2 || 0}`,
            `🔵 1 фото: ${nodeConfirmations.nodesWith1 || 0}`,
            `📊 Сред. подтверждений: ${nodeConfirmations.averageConfirmations?.toFixed(1) || '1.0'}`
        ];
   
        // Рисуем основную статистику
        statsItems.forEach(item => {
            ctx.fillStyle = '#000000';
            ctx.font = '12px Arial';
            ctx.fillText(item, statsX, y);
            y += lineHeight;
        });
   
        // 🔥 ИСПРАВЛЕНИЕ: Добавляем статистику из PointTracker если есть
        if (nodeConfirmations.trackerStats) {
            const tracker = nodeConfirmations.trackerStats;
   
            // Вторая колонка статистики
            const statsX2 = 180;
            y = statsY + 30;
   
            const trackerItems = [
                `🎯 Точек в трекере: ${tracker.totalPoints}`,
                `🟢 Высоконадёжных: ${tracker.highConfidencePoints}`,
                `📊 Средний рейтинг: ${tracker.avgRating?.toFixed(3) || '0.000'}`,
                `🔢 Сред. подтверждений: ${tracker.avgConfirmations?.toFixed(1) || '1.0'}`
            ];
   
            trackerItems.forEach(item => {
                ctx.fillStyle = '#0066CC';
                ctx.font = '12px Arial';
                ctx.fillText(item, statsX2, y);
                y += lineHeight;
            });
        }
    }

    // 9. ПРОСТАЯ ДИАГРАММА (старый метод)
    drawSimpleDiagram(ctx, nodes1, nodes2, similarity) {
        const centerX = this.config.width - 300;
        const centerY = 400;
   
        // Круг для первого следа
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(nodes1.toString(), centerX, centerY);
   
        // Круг для второго следа
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX + 200, centerY, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(nodes2.toString(), centerX + 200, centerY);
   
        // Линия схожести
        ctx.strokeStyle = similarity > 0.7 ? '#00aa00' : '#f39c12';
        ctx.lineWidth = Math.max(2, similarity * 5);
        ctx.beginPath();
        ctx.moveTo(centerX + 80, centerY);
        ctx.lineTo(centerX + 120, centerY);
        ctx.stroke();
   
        // Текст схожести
        ctx.fillStyle = '#000000';
        ctx.font = '20px Arial';
        ctx.fillText(`${(similarity * 100).toFixed(0)}%`, centerX + 100, centerY - 50);
    }

    // 10. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    // Безопасное получение количества узлов
    getNodeCount(footprint) {
        try {
            if (footprint?.graph?.nodes?.size !== undefined) {
                return footprint.graph.nodes.size;
            }
            if (footprint?.nodes?.size !== undefined) {
                return footprint.nodes.size;
            }
            if (Array.isArray(footprint?.nodes)) {
                return footprint.nodes.length;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    // Визуализация ошибки
    async createErrorVisualization(errorMessage, outputPath) {
        const canvas = createCanvas(this.config.width, this.config.height);
        const ctx = canvas.getContext('2d');
   
        // Фон
        ctx.fillStyle = '#ffebee';
        ctx.fillRect(0, 0, this.config.width, this.config.height);
   
        // Заголовок ошибки
        ctx.fillStyle = '#d32f2f';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('⚠️ ОШИБКА ВИЗУАЛИЗАЦИИ', 50, 50);
   
        // Сообщение об ошибке
        ctx.fillStyle = '#000000';
        ctx.font = '16px Arial';
   
        // Разбиваем сообщение на строки
        const lines = this.wrapText(errorMessage, 60);
        let y = 150;
   
        lines.forEach(line => {
            ctx.fillText(line, 50, y);
            y += 25;
        });
   
        // Инструкция
        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial';
        ctx.fillText('ℹ️ Система продолжает работу, но визуализация не создана', 50, y + 50);
   
        // Сохраняем
        await this.saveCanvas(canvas, outputPath);
   
        return {
            success: false,
            path: outputPath,
            error: errorMessage
        };
    }

    // Перенос текста
    wrapText(text, maxLength) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
   
        words.forEach(word => {
            if ((currentLine + ' ' + word).length <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });
   
        if (currentLine) {
            lines.push(currentLine);
        }
   
        return lines;
    }

    // Методы для совместимости со старым кодом
    async visualizeModelMerge(footprint1, footprint2, comparisonResult, options) {
        // Для слияния двух моделей используем визуализацию супер-модели
        // где первая модель считается супер-моделью, а вторая - последней
        return await this.visualizeSuperModel(footprint1, footprint2, options);
    }

    // Создание подписи
    createTopologyMergeCaption(footprint1, footprint2, stats) {
        return `<b>🏗️ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ</b>\n\n` +
               `<b>📸 ${footprint1?.name || 'След 1'}:</b> ${stats.points1 || 0} узлов\n` +
               `<b>📸 ${footprint2?.name || 'След 2'}:</b> ${stats.points2 || 0} узлов\n` +
               `<b>🎯 Схожесть:</b> ${((stats.similarity || 0) * 100).toFixed(1)}%\n` +
               `<b>🤔 Решение:</b> ${stats.decision || 'unknown'}\n\n` +
               `<i>🟦 След 1 | 🔴 След 2 | 🟢 Схожесть</i>`;
    }

    // НОВАЯ ПОДПИСЬ ДЛЯ СУПЕР-МОДЕЛИ (ОБНОВЛЕННАЯ)
    createSuperModelCaption(superModel, lastModel, stats) {
        let caption = `<b>🏗️ СУПЕР-МОДЕЛЬ С ПОДТВЕРЖДЕНИЯМИ</b>\n\n`;
        caption += `<b>🎯 Всего узлов:</b> ${stats.totalNodes || 0}\n`;
        caption += `<b>🔴 4+ фото:</b> ${stats.nodesWith4Plus || 0}\n`;
        caption += `<b>🟡 3 фото:</b> ${stats.nodesWith3 || 0}\n`;
        caption += `<b>🟠 2 фото:</b> ${stats.nodesWith2 || 0}\n`;
        caption += `<b>🔵 1 фото:</b> ${stats.nodesWith1 || 0}\n`;
        caption += `<b>📊 Сред. подтверждений:</b> ${stats.averageConfirmations?.toFixed(1) || '1.0'}\n\n`;

        if (stats.trackerStats) {
            caption += `<b>🎯 PointTracker:</b> ${stats.trackerStats.totalPoints} точек\n`;
            caption += `<b>🟢 Высоконадёжных:</b> ${stats.trackerStats.highConfidencePoints}\n`;
            caption += `<b>📊 Средний рейтинг:</b> ${stats.trackerStats.avgRating?.toFixed(3) || '0.000'}\n\n`;
        }

        caption += `<i>🔵 1 фото | 🟠 2 фото | 🟡 3 фото | 🔴 4+ фото</i>\n`;
        caption += `<i>Цифры на узлах - количество подтверждений</i>`;

        return caption;
    }

    // Сохранение канваса
    async saveCanvas(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
       
            out.on('finish', () => {
                console.log(`💾 Файл сохранен: ${filePath}`);
                resolve(filePath);
            });
       
            out.on('error', (error) => {
                console.log(`❌ Ошибка сохранения: ${error.message}`);
                reject(error);
            });
        });
    }

    // Очистка старых файлов
    cleanupOldFiles(maxAgeHours = 24) {
        try {
            const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
            let deleted = 0;
       
            if (fs.existsSync(this.config.outputDir)) {
                const files = fs.readdirSync(this.config.outputDir);
           
                files.forEach(file => {
                    if (file.endsWith('.png')) {
                        const filePath = path.join(this.config.outputDir, file);
                        const stats = fs.statSync(filePath);
                   
                        if (stats.mtimeMs < cutoffTime) {
                            fs.unlinkSync(filePath);
                            deleted++;
                        }
                    }
                });
           
                if (deleted > 0) {
                    console.log(`🗑️ Удалено ${deleted} старых файлов`);
                }
            }
       
            return { success: true, deleted: deleted };
        } catch (error) {
            console.log(`⚠️ Ошибка очистки: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = MergeVisualizer;
