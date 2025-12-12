// modules/footprint/topology-visualizer.js
// ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКИХ СТРУКТУР И СООТВЕТСТВИЙ

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class TopologyVisualizer {
    constructor(options = {}) {
        this.config = {
            nodeSize: options.nodeSize || 6,
            edgeWidth: options.edgeWidth || 1.5,
            matchLineWidth: options.matchLineWidth || 2,
            highlightColor: options.highlightColor || '#FF4081',
            structureColors: options.structureColors || [
                '#4FC3F7', // Синий - структура 1
                '#FF5252', // Красный - структура 2 
                '#7C4DFF', // Фиолетовый - совпадения
                '#4CAF50', // Зелёный - сохранённые связи
                '#FF9800'  // Оранжевый - улучшенные
            ],
            debug: options.debug || false,
            ...options
        };
       
        console.log('🎨 Создан топологический визуализатор');
    }

    // 1. ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ
    async visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options = {}) {
        console.log('🎨 Создаю визуализацию топологического слияния...');
       
        try {
            const {
                showStructuralMatches = true,
                showTopologyPreservation = true,
                showNodeSignatures = false,
                showEdgeCorrespondence = true,
                outputPath = null,
                title = 'ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ',
                width = 1400,
                height = 900
            } = options;

            // Извлечь графы
            const graph1 = footprint1.graph || footprint1;
            const graph2 = footprint2.graph || footprint2;

            // Получить топологические соответствия (если есть)
            let structuralMatches = options.structuralMatches || [];
            let topologyMetrics = options.topologyMetrics || {};
           
            // Если нет данных, попробовать их получить
            if (structuralMatches.length === 0 && footprint1.hybridFootprint && footprint2.hybridFootprint) {
                const topologyMerger = require('./topology-merger');
                const merger = new topologyMerger();
                const vectorGraph1 = merger.graphToVectorGraph(graph1);
                const vectorGraph2 = merger.graphToVectorGraph(graph2);
                structuralMatches = merger.findStructuralMatches(vectorGraph1, vectorGraph2);
                topologyMetrics = {
                    structuralSimilarity: merger.calculateStructuralSimilarity(vectorGraph1, vectorGraph2, structuralMatches),
                    topologyPreservation: merger.calculateTopologyPreservation(vectorGraph1, vectorGraph2, structuralMatches)
                };
            }

            console.log(`📊 Визуализация: ${graph1.nodes.size} + ${graph2.nodes.size} узлов, ${structuralMatches.length} структурных соответствий`);

            // Создать холст
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Фон
            this.drawTopologyBackground(ctx, width, height);

            // Заголовок
            this.drawTopologyTitle(ctx, title, width);

            // ОБЛАСТЬ 1: ИСХОДНЫЕ СТРУКТУРЫ
            const area1 = { x: 50, y: 100, width: 400, height: 350 };
            this.drawOriginalStructures(ctx, graph1, graph2, area1, 'ИСХОДНЫЕ СТРУКТУРЫ');

            // ОБЛАСТЬ 2: СТРУКТУРНЫЕ СООТВЕТСТВИЯ
            const area2 = { x: 500, y: 100, width: 400, height: 350 };
            this.drawStructuralMatches(ctx, graph1, graph2, structuralMatches, area2, 'СТРУКТУРНЫЕ СООТВЕТСТВИЯ');

            // ОБЛАСТЬ 3: СОХРАНЕНИЕ ТОПОЛОГИИ
            const area3 = { x: 950, y: 100, width: 400, height: 350 };
            this.drawTopologyPreservation(ctx, graph1, graph2, structuralMatches, topologyMetrics, area3, 'СОХРАНЕНИЕ ТОПОЛОГИИ');

            // ОБЛАСТЬ 4: РЕЗУЛЬТАТ СЛИЯНИЯ
            const area4 = { x: 50, y: 500, width: 1300, height: 350 };
            this.drawMergedTopology(ctx, graph1, graph2, structuralMatches, comparisonResult, area4, 'РЕЗУЛЬТАТ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ');

            // СТАТИСТИКА И МЕТРИКИ
            this.drawTopologyMetrics(ctx, graph1, graph2, structuralMatches, topologyMetrics, comparisonResult, 50, 480);

            // ЛЕГЕНДА
            this.drawTopologyLegend(ctx, width - 350, 480);

            // Сохранение
            if (outputPath) {
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const buffer = canvas.toBuffer('image/png');
                fs.writeFileSync(outputPath, buffer);
                console.log(`✅ Топологическая визуализация сохранена: ${outputPath}`);
            }

            return {
                canvas,
                buffer: canvas.toBuffer('image/png'),
                stats: {
                    graph1Nodes: graph1.nodes.size,
                    graph1Edges: graph1.edges.size,
                    graph2Nodes: graph2.nodes.size,
                    graph2Edges: graph2.edges.size,
                    structuralMatches: structuralMatches.length,
                    topologySimilarity: topologyMetrics.structuralSimilarity || 0,
                    topologyPreservation: topologyMetrics.topologyPreservation || 0
                }
            };

        } catch (error) {
            console.log(`❌ Ошибка топологической визуализации: ${error.message}`);
            console.error(error.stack);
            throw error;
        }
    }

    // 2. ФОН ДЛЯ ТОПОЛОГИЧЕСКОЙ ВИЗУАЛИЗАЦИИ
    drawTopologyBackground(ctx, width, height) {
        // Градиентный фон
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0d1b2a');
        gradient.addColorStop(0.5, '#1b263b');
        gradient.addColorStop(1, '#415a77');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Сетка (если нужно)
        if (this.config.debug) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 0.5;
           
            // Вертикальные линии
            for (let x = 50; x < width; x += 50) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
           
            // Горизонтальные линии
            for (let y = 50; y < height; y += 50) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }
    }

    // 3. ЗАГОЛОВОК
    drawTopologyTitle(ctx, title, width) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';

        ctx.strokeText(title, width / 2, 50);
        ctx.fillText(title, width / 2, 50);

        ctx.textAlign = 'left';
    }

    // 4. ИСХОДНЫЕ СТРУКТУРЫ
    drawOriginalStructures(ctx, graph1, graph2, area, title) {
        // Рамка области
        this.drawAreaBorder(ctx, area, this.config.structureColors[0]);

        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(title, area.x + 10, area.y - 10);

        // Разделить область пополам
        const leftArea = {
            x: area.x + 10,
            y: area.y + 10,
            width: (area.width - 30) / 2,
            height: area.height - 30
        };

        const rightArea = {
            x: area.x + 20 + leftArea.width,
            y: area.y + 10,
            width: leftArea.width,
            height: leftArea.height
        };

        // Граф 1 (слева)
        ctx.fillStyle = this.config.structureColors[0];
        ctx.font = '14px Arial';
        ctx.fillText(`Граф 1: ${graph1.nodes.size} узлов`, leftArea.x, area.y - 25);
        this.drawGraphInArea(ctx, graph1, leftArea, this.config.structureColors[0]);

        // Граф 2 (справа)
        ctx.fillStyle = this.config.structureColors[1];
        ctx.font = '14px Arial';
        ctx.fillText(`Граф 2: ${graph2.nodes.size} узлов`, rightArea.x, area.y - 25);
        this.drawGraphInArea(ctx, graph2, rightArea, this.config.structureColors[1]);
    }

    // 5. СТРУКТУРНЫЕ СООТВЕТСТВИЯ
    drawStructuralMatches(ctx, graph1, graph2, matches, area, title) {
        // Рамка области
        this.drawAreaBorder(ctx, area, this.config.structureColors[2]);

        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(title, area.x + 10, area.y - 10);

        if (matches.length === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Нет структурных соответствий', area.x + area.width / 2, area.y + area.height / 2);
            ctx.textAlign = 'left';
            return;
        }

        // Нормализация для отображения обоих графов
        const allNodes = [
            ...Array.from(graph1.nodes.values()),
            ...Array.from(graph2.nodes.values())
        ];

        const { scale, offsetX, offsetY } = this.normalizeNodesForArea(allNodes, {
            ...area,
            width: area.width - 20,
            height: area.height - 40,
            x: area.x + 10,
            y: area.y + 20
        });

        // Нарисовать узлы графа 1 (полупрозрачные)
        const nodes1 = Array.from(graph1.nodes.values());
        nodes1.forEach((node, index) => {
            const x = offsetX + node.x * scale;
            const y = offsetY + node.y * scale;
           
            // Проверить, есть ли соответствие
            const hasMatch = matches.some(m => m.node1 === index);
            const color = hasMatch ? this.config.highlightColor : this.config.structureColors[0] + '80';
            const size = hasMatch ? this.config.nodeSize * 1.5 : this.config.nodeSize;
           
            this.drawNode(ctx, x, y, color, size);
        });

        // Нарисовать узлы графа 2 (полупрозрачные)
        const nodes2 = Array.from(graph2.nodes.values());
        nodes2.forEach((node, index) => {
            const x = offsetX + node.x * scale;
            const y = offsetY + node.y * scale;
           
            // Проверить, есть ли соответствие
            const hasMatch = matches.some(m => m.node2 === index);
            const color = hasMatch ? this.config.highlightColor : this.config.structureColors[1] + '80';
            const size = hasMatch ? this.config.nodeSize * 1.5 : this.config.nodeSize;
           
            this.drawNode(ctx, x, y, color, size);
        });

        // Нарисовать линии соответствий
        ctx.strokeStyle = this.config.structureColors[2];
        ctx.lineWidth = this.config.matchLineWidth;
        ctx.setLineDash([5, 3]);

        matches.forEach((match, index) => {
            const node1 = nodes1[match.node1];
            const node2 = nodes2[match.node2];

            if (node1 && node2) {
                const x1 = offsetX + node1.x * scale;
                const y1 = offsetY + node1.y * scale;
                const x2 = offsetX + node2.x * scale;
                const y2 = offsetY + node2.y * scale;

                // Интенсивность линии в зависимости от score
                const opacity = Math.min(0.9, 0.3 + match.score * 0.6);
                ctx.globalAlpha = opacity;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                // Точка в середине с score
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                ctx.fillStyle = this.config.highlightColor;
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(midX, midY, 3, 0, Math.PI * 2);
                ctx.fill();

                // Score (если достаточно места)
                if (match.score !== undefined && area.width > 200) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(match.score.toFixed(2), midX, midY - 8);
                    ctx.textAlign = 'left';
                }
            }
        });

        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Подпись
        ctx.fillStyle = '#cccccc';
        ctx.font = '14px Arial';
        ctx.fillText(`${matches.length} соответствий`, area.x + 10, area.y + area.height - 10);
    }

    // 6. СОХРАНЕНИЕ ТОПОЛОГИИ
    drawTopologyPreservation(ctx, graph1, graph2, matches, metrics, area, title) {
        // Рамка области
        this.drawAreaBorder(ctx, area, this.config.structureColors[3]);

        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(title, area.x + 10, area.y - 10);

        if (matches.length < 2) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Недостаточно соответствий', area.x + area.width / 2, area.y + area.height / 2);
            ctx.textAlign = 'left';
            return;
        }

        // Внутренняя область
        const innerArea = {
            x: area.x + 20,
            y: area.y + 40,
            width: area.width - 40,
            height: area.height - 60
        };

        // Нарисовать сохранённые связи
        const topologyPreservation = metrics.topologyPreservation || this.calculateTopologyPreservationRate(matches, graph1, graph2);
       
        // Круговая диаграмма сохранения
        const centerX = innerArea.x + innerArea.width / 2;
        const centerY = innerArea.y + innerArea.height / 2;
        const radius = Math.min(innerArea.width, innerArea.height) / 2 - 20;

        // Фон
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Сохранённая часть
        const preservedAngle = topologyPreservation * Math.PI * 2;
        ctx.fillStyle = this.config.structureColors[3];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + preservedAngle);
        ctx.closePath();
        ctx.fill();

        // Текст в центре
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(topologyPreservation * 100)}%`, centerX, centerY);

        ctx.font = '14px Arial';
        ctx.fillText('сохранено', centerX, centerY + 25);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // Примеры сохранённых/потерянных связей
        this.drawTopologyExamples(ctx, graph1, graph2, matches, innerArea);
    }

    // 7. РАСЧЁТ СОХРАНЕНИЯ ТОПОЛОГИИ
    calculateTopologyPreservationRate(matches, graph1, graph2) {
        if (matches.length < 2) return 1;

        let preserved = 0;
        let total = 0;

        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());
       
        const nodeId1 = Array.from(graph1.nodes.keys());
        const nodeId2 = Array.from(graph2.nodes.keys());

        // Простая проверка: сохранились ли связи между соответствующими узлами
        for (let i = 0; i < matches.length; i++) {
            for (let j = i + 1; j < matches.length; j++) {
                const match1 = matches[i];
                const match2 = matches[j];

                // Проверить, есть ли связь в графе 1
                const hasEdge1 = this.hasEdgeBetween(graph1, nodeId1[match1.node1], nodeId1[match2.node1]);
               
                // Проверить, есть ли связь в графе 2
                const hasEdge2 = this.hasEdgeBetween(graph2, nodeId2[match1.node2], nodeId2[match2.node2]);

                total++;
                if (hasEdge1 === hasEdge2) {
                    preserved++;
                }
            }
        }

        return total > 0 ? preserved / total : 1;
    }

    // 8. ПРИМЕРЫ СОХРАНЕНИЯ ТОПОЛОГИИ
    drawTopologyExamples(ctx, graph1, graph2, matches, area) {
        if (matches.length < 2) return;

        // Взять первые 3 соответствия для примера
        const exampleMatches = matches.slice(0, Math.min(3, matches.length));
       
        const nodeId1 = Array.from(graph1.nodes.keys());
        const nodeId2 = Array.from(graph2.nodes.keys());

        let y = area.y + area.height - 50;

        exampleMatches.forEach((match, index) => {
            const node1Id = nodeId1[match.node1];
            const node2Id = nodeId2[match.node2];

            ctx.fillStyle = '#cccccc';
            ctx.font = '12px Arial';
            ctx.fillText(`Соответствие ${index + 1}:`, area.x, y);
           
            // Найти связи этого узла
            const edges1 = this.getNodeEdges(graph1, node1Id);
            const edges2 = this.getNodeEdges(graph2, node2Id);

            const edgeCount1 = edges1.length;
            const edgeCount2 = edges2.length;

            ctx.fillStyle = edgeCount1 === edgeCount2 ? this.config.structureColors[3] : '#FF5252';
            ctx.fillText(` Связей: ${edgeCount1} → ${edgeCount2}`, area.x + 120, y);

            y += 15;
        });
    }

    // 9. РЕЗУЛЬТАТ СЛИЯНИЯ
    drawMergedTopology(ctx, graph1, graph2, matches, comparisonResult, area, title) {
        // Рамка области
        this.drawAreaBorder(ctx, area, this.config.structureColors[4]);

        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(title, area.x + 10, area.y - 10);

        // Создать гипотетический объединённый граф
        const mergedNodes = this.createMergedGraphNodes(graph1, graph2, matches);
       
        // Нормализация
        const { scale, offsetX, offsetY } = this.normalizeNodesForArea(mergedNodes, {
            ...area,
            width: area.width - 20,
            height: area.height - 40,
            x: area.x + 10,
            y: area.y + 20
        });

        // Нарисовать объединённые узлы
        mergedNodes.forEach((node, index) => {
            const x = offsetX + node.x * scale;
            const y = offsetY + node.y * scale;

            let color, size;

            switch (node.type) {
                case 'merged':
                    color = this.config.highlightColor;
                    size = this.config.nodeSize * 1.8;
                    break;
                case 'graph1':
                    color = this.config.structureColors[0] + 'CC';
                    size = this.config.nodeSize * 1.2;
                    break;
                case 'graph2':
                    color = this.config.structureColors[1] + 'CC';
                    size = this.config.nodeSize * 1.2;
                    break;
                default:
                    color = '#CCCCCC';
                    size = this.config.nodeSize;
            }

            this.drawNode(ctx, x, y, color, size);

            // Подпись для слитых узлов
            if (node.type === 'merged') {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('★', x, y - 12);
                ctx.textAlign = 'left';
            }
        });

        // Нарисовать гипотетические рёбра
        this.drawMergedEdges(ctx, mergedNodes, scale, offsetX, offsetY);

        // Статистика
        const mergedCount = mergedNodes.filter(n => n.type === 'merged').length;
        const unique1Count = mergedNodes.filter(n => n.type === 'graph1').length;
        const unique2Count = mergedNodes.filter(n => n.type === 'graph2').length;

        ctx.fillStyle = '#cccccc';
        ctx.font = '14px Arial';
        ctx.fillText(`Слито: ${mergedCount}`, area.x + 10, area.y + area.height - 30);
        ctx.fillText(`Уникальных: ${unique1Count + unique2Count}`, area.x + 100, area.y + area.height - 30);
        ctx.fillText(`Всего: ${mergedNodes.length}`, area.x + 250, area.y + area.height - 30);

        if (comparisonResult?.similarity) {
            ctx.fillStyle = '#4CAF50';
            ctx.fillText(`Схожесть: ${comparisonResult.similarity.toFixed(3)}`, area.x + 350, area.y + area.height - 30);
        }
    }

    // 10. СОЗДАНИЕ ОБЪЕДИНЁННЫХ УЗЛОВ
    createMergedGraphNodes(graph1, graph2, matches) {
        const mergedNodes = [];
       
        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());

        const usedIndices1 = new Set();
        const usedIndices2 = new Set();

        // Слитые узлы
        matches.forEach(match => {
            const node1 = nodes1[match.node1];
            const node2 = nodes2[match.node2];

            if (node1 && node2) {
                // Усреднённая позиция
                mergedNodes.push({
                    x: (node1.x + node2.x) / 2,
                    y: (node1.y + node2.y) / 2,
                    type: 'merged',
                    confidence: match.score || 0.8,
                    source1: match.node1,
                    source2: match.node2
                });

                usedIndices1.add(match.node1);
                usedIndices2.add(match.node2);
            }
        });

        // Уникальные узлы из графа 1
        nodes1.forEach((node, index) => {
            if (!usedIndices1.has(index)) {
                mergedNodes.push({
                    x: node.x,
                    y: node.y,
                    type: 'graph1',
                    confidence: node.confidence || 0.5,
                    source: index
                });
            }
        });

        // Уникальные узлы из графа 2
        nodes2.forEach((node, index) => {
            if (!usedIndices2.has(index)) {
                mergedNodes.push({
                    x: node.x,
                    y: node.y,
                    type: 'graph2',
                    confidence: node.confidence || 0.5,
                    source: index
                });
            }
        });

        return mergedNodes;
    }

    // 11. РЁБРА ОБЪЕДИНЁННОГО ГРАФА
    drawMergedEdges(ctx, mergedNodes, scale, offsetX, offsetY) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = this.config.edgeWidth;

        // Простая эвристика: соединить близкие узлы
        for (let i = 0; i < mergedNodes.length; i++) {
            for (let j = i + 1; j < mergedNodes.length; j++) {
                const node1 = mergedNodes[i];
                const node2 = mergedNodes[j];

                // Расстояние
                const dx = node2.x - node1.x;
                const dy = node2.y - node1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Если узлы близко и одного типа (или один слитый)
                if (distance < 80 && (
                    node1.type === node2.type ||
                    node1.type === 'merged' ||
                    node2.type === 'merged'
                )) {
                    const x1 = offsetX + node1.x * scale;
                    const y1 = offsetY + node1.y * scale;
                    const x2 = offsetX + node2.x * scale;
                    const y2 = offsetY + node2.y * scale;

                    // Цвет в зависимости от типов
                    let edgeColor;
                    if (node1.type === 'merged' && node2.type === 'merged') {
                        edgeColor = this.config.highlightColor + 'CC';
                        ctx.lineWidth = this.config.edgeWidth * 1.5;
                    } else if (node1.type === node2.type) {
                        edgeColor = node1.type === 'graph1'
                            ? this.config.structureColors[0] + '99'
                            : this.config.structureColors[1] + '99';
                    } else {
                        edgeColor = '#CCCCCC99';
                    }

                    ctx.strokeStyle = edgeColor;

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            }
        }

        // Вернуть настройки по умолчанию
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = this.config.edgeWidth;
    }

    // 12. МЕТРИКИ ТОПОЛОГИИ
    drawTopologyMetrics(ctx, graph1, graph2, matches, metrics, comparisonResult, x, y) {
        const boxWidth = 400;
        const boxHeight = 150;

        ctx.fillStyle = 'rgba(25, 25, 35, 0.9)';
        ctx.strokeStyle = 'rgba(100, 100, 200, 0.5)';
        ctx.lineWidth = 2;

        this.drawRoundedRect(ctx, x, y, boxWidth, boxHeight, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('📊 ТОПОЛОГИЧЕСКИЕ МЕТРИКИ', x + 10, y + 30);

        ctx.font = '14px Arial';
        let lineY = y + 60;

        const metricItems = [
            `🔗 Структурных соответствий: ${matches.length}`,
            `🏗️ Топологическая схожесть: ${(metrics.structuralSimilarity || 0).toFixed(3)}`,
            `📊 Сохранение топологии: ${Math.round((metrics.topologyPreservation || this.calculateTopologyPreservationRate(matches, graph1, graph2)) * 100)}%`,
            `📈 Эффективность слияния: ${matches.length > 0 ? Math.round((matches.length / Math.min(graph1.nodes.size, graph2.nodes.size)) * 100) : 0}%`,
            `🎯 Средний score: ${matches.length > 0 ? (matches.reduce((s, m) => s + (m.score || 0), 0) / matches.length).toFixed(3) : 0}`
        ];

        metricItems.forEach(item => {
            ctx.fillStyle = '#cccccc';
            ctx.fillText(item, x + 15, lineY);
            lineY += 20;
        });
    }

    // 13. ЛЕГЕНДА
    drawTopologyLegend(ctx, x, y) {
        const boxWidth = 300;
        const boxHeight = 180;

        ctx.fillStyle = 'rgba(35, 35, 45, 0.9)';
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.3)';
        ctx.lineWidth = 2;

        this.drawRoundedRect(ctx, x, y, boxWidth, boxHeight, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('📋 ЛЕГЕНДА', x + 10, y + 30);

        const legendItems = [
            { color: this.config.structureColors[0], text: '🔵 Узлы графа 1' },
            { color: this.config.structureColors[1], text: '🔴 Узлы графа 2' },
            { color: this.config.structureColors[2], text: '🟣 Структурные соответствия' },
            { color: this.config.highlightColor, text: '⭐ Слитые узлы (★)' },
            { color: this.config.structureColors[3], text: '🟢 Сохранённые связи' },
            { color: this.config.structureColors[4], text: '🟠 Улучшенная структура' }
        ];

        let startY = y + 60;
        legendItems.forEach((item, index) => {
            ctx.fillStyle = item.color;
            ctx.fillRect(x + 10, startY - 8, 20, 20);

            ctx.fillStyle = '#cccccc';
            ctx.font = '12px Arial';
            ctx.fillText(item.text, x + 35, startY);

            startY += 25;
        });
    }

    // 14. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    // Отрисовка графа в области
    drawGraphInArea(ctx, graph, area, color) {
        const nodes = Array.from(graph.nodes.values());
        const edges = Array.from(graph.edges.values());

        // Нормализация
        const { scale, offsetX, offsetY } = this.normalizeNodesForArea(nodes, area);

        // Рёбра
        ctx.strokeStyle = color + '80';
        ctx.lineWidth = this.config.edgeWidth * 0.7;

        edges.forEach(edge => {
            const fromNode = graph.nodes.get(edge.from);
            const toNode = graph.nodes.get(edge.to);

            if (fromNode && toNode) {
                const x1 = offsetX + fromNode.x * scale;
                const y1 = offsetY + fromNode.y * scale;
                const x2 = offsetX + toNode.x * scale;
                const y2 = offsetY + toNode.y * scale;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        });

        // Узлы
        nodes.forEach(node => {
            const x = offsetX + node.x * scale;
            const y = offsetY + node.y * scale;
            this.drawNode(ctx, x, y, color, this.config.nodeSize);
        });
    }

    // Отрисовка узла
    drawNode(ctx, x, y, color, size) {
        // Внешний круг (свечение)
        ctx.beginPath();
        ctx.arc(x, y, size + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();

        // Основной круг
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Внутренний круг для контраста
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
    }

    // Нормализация узлов для области
    normalizeNodesForArea(nodes, area) {
        if (nodes.length === 0) {
            return {
                scale: 1,
                offsetX: area.x + area.width / 2,
                offsetY: area.y + area.height / 2
            };
        }

        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;

        const scaleX = (area.width * 0.9) / width;
        const scaleY = (area.height * 0.9) / height;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = area.x + (area.width - width * scale) / 2;
        const offsetY = area.y + (area.height - height * scale) / 2;

        return { scale, offsetX, offsetY, minX, minY };
    }

    // Рамка области
    drawAreaBorder(ctx, area, color) {
        ctx.strokeStyle = color + 'CC';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(area.x, area.y, area.width, area.height);
        ctx.setLineDash([]);

        // Полупрозрачная заливка
        ctx.fillStyle = 'rgba(30, 30, 40, 0.7)';
        ctx.fillRect(area.x + 1, area.y + 1, area.width - 2, area.height - 2);
    }

    // Закруглённый прямоугольник
    drawRoundedRect(ctx, x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // Проверка наличия ребра
    hasEdgeBetween(graph, nodeId1, nodeId2) {
        for (const [_, edge] of graph.edges) {
            if ((edge.from === nodeId1 && edge.to === nodeId2) ||
                (edge.from === nodeId2 && edge.to === nodeId1)) {
                return true;
            }
        }
        return false;
    }

    // Получение рёбер узла
    getNodeEdges(graph, nodeId) {
        const edges = [];
        for (const [_, edge] of graph.edges) {
            if (edge.from === nodeId || edge.to === nodeId) {
                edges.push(edge);
            }
        }
        return edges;
    }

    // 15. ДОПОЛНИТЕЛЬНАЯ ВИЗУАЛИЗАЦИЯ: ТОПОЛОГИЧЕСКИЕ ИНВАРИАНТЫ
    async visualizeTopologyInvariants(graph, options = {}) {
        console.log('🎨 Визуализация топологических инвариантов...');

        try {
            const {
                outputPath = null,
                title = 'ТОПОЛОГИЧЕСКИЕ ИНВАРИАНТЫ',
                width = 1000,
                height = 700
            } = options;

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Фон
            this.drawTopologyBackground(ctx, width, height);

            // Заголовок
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(title, width / 2, 50);
            ctx.textAlign = 'left';

            // Рассчитать инварианты
            const invariants = this.calculateTopologyInvariants(graph);

            // Область 1: Граф
            const area1 = { x: 50, y: 100, width: 400, height: 500 };
            this.drawGraphInArea(ctx, graph, area1, '#4FC3F7');
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(`Граф: ${graph.nodes.size} узлов, ${graph.edges.size} рёбер`, area1.x, area1.y - 10);

            // Область 2: Инварианты
            const area2 = { x: 500, y: 100, width: 450, height: 500 };
            this.drawInvariantsArea(ctx, invariants, area2);

            // Сохранение
            if (outputPath) {
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const buffer = canvas.toBuffer('image/png');
                fs.writeFileSync(outputPath, buffer);
                console.log(`✅ Визуализация инвариантов сохранена: ${outputPath}`);
            }

            return {
                canvas,
                buffer: canvas.toBuffer('image/png'),
                invariants
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации инвариантов: ${error.message}`);
            throw error;
        }
    }

    // 16. РАСЧЁТ ТОПОЛОГИЧЕСКИХ ИНВАРИАНТОВ
    calculateTopologyInvariants(graph) {
        const nodes = Array.from(graph.nodes.values());
        const edges = Array.from(graph.edges.values());

        // Базовые инварианты
        const invariants = {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            avgDegree: edges.length * 2 / Math.max(1, nodes.length),
            density: edges.length / Math.max(1, nodes.length * (nodes.length - 1) / 2),
            connectedComponents: this.calculateConnectedComponents(graph),
            avgClustering: this.calculateAverageClustering(graph),
            degreeDistribution: this.calculateDegreeDistribution(graph),
            eccentricities: this.calculateEccentricities(graph)
        };

        return invariants;
    }

    // 17. ОТРИСОВКА ИНВАРИАНТОВ
    drawInvariantsArea(ctx, invariants, area) {
        // Рамка
        this.drawAreaBorder(ctx, area, '#4CAF50');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('📊 ТОПОЛОГИЧЕСКИЕ ИНВАРИАНТЫ', area.x + 10, area.y - 10);

        let y = area.y + 30;
        const lineHeight = 25;

        const invariantItems = [
            `🎯 Узлов: ${invariants.nodeCount}`,
            `🔗 Рёбер: ${invariants.edgeCount}`,
            `📈 Средняя степень: ${invariants.avgDegree.toFixed(2)}`,
            `🧮 Плотность: ${invariants.density.toFixed(4)}`,
            `🔄 Компонент связности: ${invariants.connectedComponents}`,
            `🎲 Средний коэффициент кластеризации: ${invariants.avgClustering.toFixed(3)}`
        ];

        invariantItems.forEach(item => {
            ctx.fillStyle = '#cccccc';
            ctx.font = '14px Arial';
            ctx.fillText(item, area.x + 20, y);
            y += lineHeight;
        });

        // Гистограмма распределения степеней
        y += 20;
        this.drawDegreeDistribution(ctx, invariants.degreeDistribution, area.x + 20, y, area.width - 40, 150);
    }

    // 18. ГИСТОГРАММА РАСПРЕДЕЛЕНИЯ СТЕПЕНЕЙ
    drawDegreeDistribution(ctx, distribution, x, y, width, height) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('📊 Распределение степеней:', x, y - 10);

        if (!distribution || distribution.length === 0) return;

        const maxFreq = Math.max(...distribution.map(d => d.frequency));
        const barWidth = width / distribution.length;

        distribution.forEach((item, index) => {
            const barX = x + index * barWidth + 5;
            const barHeight = (item.frequency / maxFreq) * (height - 30);
            const barY = y + height - 30 - barHeight;

            // Столбец
            ctx.fillStyle = `rgba(79, 195, 247, ${0.5 + item.frequency / maxFreq * 0.5})`;
            ctx.fillRect(barX, barY, barWidth - 10, barHeight);

            // Подпись
            ctx.fillStyle = '#cccccc';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.degree.toString(), barX + (barWidth - 10) / 2, y + height - 15);
            ctx.fillText(item.frequency.toString(), barX + (barWidth - 10) / 2, barY - 5);
            ctx.textAlign = 'left';
        });
    }

    // 19. РАСЧЁТ КОМПОНЕНТ СВЯЗНОСТИ
    calculateConnectedComponents(graph) {
        const visited = new Set();
        let components = 0;

        for (const [nodeId] of graph.nodes) {
            if (!visited.has(nodeId)) {
                components++;
                this.dfs(graph, nodeId, visited);
            }
        }

        return components;
    }

    dfs(graph, startNode, visited) {
        const stack = [startNode];
       
        while (stack.length > 0) {
            const nodeId = stack.pop();
            if (visited.has(nodeId)) continue;
           
            visited.add(nodeId);
           
            // Добавить всех соседей
            for (const [_, edge] of graph.edges) {
                if (edge.from === nodeId && !visited.has(edge.to)) {
                    stack.push(edge.to);
                } else if (edge.to === nodeId && !visited.has(edge.from)) {
                    stack.push(edge.from);
                }
            }
        }
    }

    // 20. СРЕДНИЙ КОЭФФИЦИЕНТ КЛАСТЕРИЗАЦИИ
    calculateAverageClustering(graph) {
        const nodes = Array.from(graph.nodes.keys());
        let totalClustering = 0;
        let count = 0;

        for (const nodeId of nodes) {
            const neighbors = this.getNeighbors(graph, nodeId);
            const k = neighbors.length;
           
            if (k < 2) continue;

            // Количество возможных связей между соседями
            const maxPossible = k * (k - 1) / 2;
            let actualConnections = 0;

            // Подсчитать реальные связи между соседями
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (this.hasEdgeBetween(graph, neighbors[i], neighbors[j])) {
                        actualConnections++;
                    }
                }
            }

            const clustering = maxPossible > 0 ? actualConnections / maxPossible : 0;
            totalClustering += clustering;
            count++;
        }

        return count > 0 ? totalClustering / count : 0;
    }

    // 21. ПОЛУЧЕНИЕ СОСЕДЕЙ УЗЛА
    getNeighbors(graph, nodeId) {
        const neighbors = [];
       
        for (const [_, edge] of graph.edges) {
            if (edge.from === nodeId) {
                neighbors.push(edge.to);
            } else if (edge.to === nodeId) {
                neighbors.push(edge.from);
            }
        }
       
        return [...new Set(neighbors)]; // Уникальные
    }

    // 22. РАСПРЕДЕЛЕНИЕ СТЕПЕНЕЙ
    calculateDegreeDistribution(graph) {
        const degreeMap = new Map();
       
        for (const [nodeId] of graph.nodes) {
            const degree = this.getNeighbors(graph, nodeId).length;
            degreeMap.set(degree, (degreeMap.get(degree) || 0) + 1);
        }

        return Array.from(degreeMap.entries())
            .map(([degree, frequency]) => ({ degree, frequency }))
            .sort((a, b) => a.degree - b.degree);
    }

    // 23. ЭКСЦЕНТРИСИТЕТЫ (для больших графов)
    calculateEccentricities(graph) {
        // Упрощённая версия - только для небольших графов
        const nodes = Array.from(graph.nodes.keys());
        if (nodes.length > 100) {
            return { avgEccentricity: 0, diameter: 0, radius: 0 };
        }

        // TODO: Реализовать алгоритм Флойда-Уоршелла или BFS для всех пар
        return { avgEccentricity: 0, diameter: 0, radius: 0 };
    }

    // 24. СОЗДАНИЕ АНИМАЦИИ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ (опционально)
    async createTopologyMergeAnimation(graph1, graph2, matches, outputDir, frameCount = 10) {
        console.log('🎬 Создаю анимацию топологического слияния...');
       
        const frames = [];
       
        // Создать промежуточные состояния
        for (let frame = 0; frame <= frameCount; frame++) {
            const progress = frame / frameCount;
           
            const outputPath = path.join(outputDir, `frame_${frame.toString().padStart(3, '0')}.png`);
           
            // Создать промежуточный граф
            const intermediateGraph = this.createIntermediateGraph(graph1, graph2, matches, progress);
           
            // Визуализировать кадр
            const result = await this.visualizeTopologyMerge(
                { graph: intermediateGraph, name: `Кадр ${frame}` },
                { graph: intermediateGraph, name: `Кадр ${frame}` },
                { similarity: progress },
                {
                    outputPath,
                    title: `ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ (${Math.round(progress * 100)}%)`,
                    width: 800,
                    height: 600
                }
            );
           
            frames.push(outputPath);
            console.log(`   📷 Создан кадр ${frame + 1}/${frameCount + 1}`);
        }
       
        console.log(`✅ Анимация создана: ${frames.length} кадров`);
        return frames;
    }

    // 25. ПРОМЕЖУТОЧНЫЙ ГРАФ ДЛЯ АНИМАЦИИ
    createIntermediateGraph(graph1, graph2, matches, progress) {
        const SimpleGraph = require('./simple-graph');
        const intermediate = new SimpleGraph(`Промежуточный граф (${Math.round(progress * 100)}%)`);
       
        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());
       
        const usedIndices1 = new Set();
        const usedIndices2 = new Set();
       
        // Слитые узлы (интерполированные)
        matches.forEach(match => {
            const node1 = nodes1[match.node1];
            const node2 = nodes2[match.node2];
           
            if (node1 && node2) {
                const interpX = node1.x * (1 - progress) + node2.x * progress;
                const interpY = node1.y * (1 - progress) + node2.y * progress;
                const interpConfidence = (node1.confidence || 0.5) * (1 - progress) + (node2.confidence || 0.5) * progress;
               
                intermediate.addNode({
                    id: `merged_${match.node1}_${match.node2}`,
                    x: interpX,
                    y: interpY,
                    confidence: interpConfidence,
                    source: 'interpolated'
                });
               
                usedIndices1.add(match.node1);
                usedIndices2.add(match.node2);
            }
        });
       
        // Уникальные узлы из графа 1 (исчезают)
        nodes1.forEach((node, index) => {
            if (!usedIndices1.has(index)) {
                const opacity = 1 - progress * 0.7; // Постепенно исчезают
                if (opacity > 0.1) {
                    intermediate.addNode({
                        id: `unique1_${index}`,
                        x: node.x,
                        y: node.y,
                        confidence: (node.confidence || 0.5) * opacity,
                        source: 'graph1_fading'
                    });
                }
            }
        });
       
        // Уникальные узлы из графа 2 (появляются)
        nodes2.forEach((node, index) => {
            if (!usedIndices2.has(index)) {
                const opacity = progress * 0.7; // Постепенно появляются
                if (opacity > 0.1) {
                    intermediate.addNode({
                        id: `unique2_${index}`,
                        x: node.x,
                        y: node.y,
                        confidence: (node.confidence || 0.5) * opacity,
                        source: 'graph2_appearing'
                    });
                }
            }
        });
       
        // TODO: Интерполировать рёбра
        return intermediate;
    }
}

module.exports = TopologyVisualizer;
