// modules/footprint/merge-visualizer.js
// ВИЗУАЛИЗАТОР СЛИЯНИЙ С ПОДДЕРЖКОЙ ТОПОЛОГИЧЕСКОЙ ВИЗУАЛИЗАЦИИ

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class MergeVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './temp/merge_visualizations',
            width: options.width || 1200,
            height: options.height || 800,
            backgroundColor: options.backgroundColor || '#0d1b2a',
            showStats: options.showStats !== false,
            showTopology: options.showTopology !== false,
            showForces: options.showForces || false,
            showTransformation: options.showTransformation !== false,
            debug: options.debug || false,
            ...options
        };
       
        // Создать директорию для визуализаций
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        // Поддиректории для разных типов визуализаций
        this.subdirs = {
            topology: path.join(this.config.outputDir, 'topology'),
            forces: path.join(this.config.outputDir, 'forces'),
            classic: path.join(this.config.outputDir, 'classic'),
            supermodels: path.join(this.config.outputDir, 'supermodels')
        };
       
        // Создать все поддиректории
        Object.values(this.subdirs).forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
       
        console.log(`🎨 MergeVisualizer создан: ${this.config.width}x${this.config.height}`);
        console.log(`   📁 Выходная директория: ${this.config.outputDir}`);
    }

    // 1. ОСНОВНОЙ МЕТОД: ВИЗУАЛИЗАЦИЯ СЛИЯНИЯ С ВЫБОРОМ ТИПА
    async visualizeMerge(footprint1, footprint2, comparisonResult, options = {}) {
        const mergeOptions = {
            ...this.config,
            ...options
        };
       
        // Определить тип визуализации на основе метода слияния
        const mergeMethod = comparisonResult.method ||
                          comparisonResult.details?.method ||
                          options.method ||
                          'classic';
       
        let result;
       
        switch (mergeMethod) {
            case 'topology':
            case 'topology_merge':
                result = await this.visualizeTopologyMerge(
                    footprint1, footprint2, comparisonResult, mergeOptions
                );
                break;
               
            case 'intelligent':
            case 'intelligent_merge':
                result = await this.visualizeIntelligentMerge(
                    footprint1, footprint2, comparisonResult, mergeOptions
                );
                break;
               
            case 'geometric':
            case 'geometric_fallback':
                result = await this.visualizeGeometricMerge(
                    footprint1, footprint2, comparisonResult, mergeOptions
                );
                break;
               
            default:
                result = await this.visualizeClassicMerge(
                    footprint1, footprint2, comparisonResult, mergeOptions
                );
        }
       
        return result;
    }

    // 2. ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ - ОСНОВНАЯ ВИЗУАЛИЗАЦИЯ
    async visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options) {
        const timestamp = Date.now();
        const outputPath = options.outputPath ||
                          path.join(this.subdirs.topology, `topology_merge_${timestamp}.png`);
       
        console.log(`🎨 Создаю визуализацию топологического слияния...`);
       
        const canvas = createCanvas(options.width, options.height);
        const ctx = canvas.getContext('2d');
       
        // Фон
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, options.width, options.height);
       
        // Получить графы
        const graph1 = footprint1.graph || footprint1;
        const graph2 = footprint2.graph || footprint2;
       
        // Найти общие масштабы и смещения
        const bounds = this.calculateCombinedBounds(graph1, graph2);
        const transform = this.calculateCanvasTransform(bounds, options);
       
        // 2.1 НАРИСОВАТЬ ОБЪЕДИНЁННЫЙ РЕЗУЛЬТАТ
        if (comparisonResult.topologyMergeResult?.mergedGraph) {
            this.drawTopologyMergeResult(
                ctx,
                comparisonResult.topologyMergeResult,
                transform,
                options
            );
        } else {
            // Если нет результата слияния, нарисовать оба графа
            this.drawDualGraphs(ctx, graph1, graph2, transform, options);
        }
       
        // 2.2 НАРИСОВАТЬ СТАТИСТИКУ ТОПОЛОГИИ
        if (options.showStats) {
            this.drawTopologyStats(
                ctx,
                comparisonResult,
                options
            );
        }
       
        // 2.3 НАРИСОВАТЬ СТРУКТУРНЫЕ СООТВЕТСТВИЯ
        if (comparisonResult.topologyMergeResult?.structuralMatches) {
            this.drawStructuralMatches(
                ctx,
                graph1,
                graph2,
                comparisonResult.topologyMergeResult.structuralMatches,
                transform,
                options
            );
        }
       
        // 2.4 ЗАГОЛОВОК И ЛЕГЕНДА
        this.drawTopologyHeader(ctx, comparisonResult, options);
       
        // Сохранить
        await this.saveCanvas(canvas, outputPath);
       
        return {
            success: true,
            path: outputPath,
            type: 'topology',
            stats: this.extractTopologyStats(comparisonResult),
            canvas: canvas
        };
    }

    // 3. ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ
    async visualizeIntelligentMerge(footprint1, footprint2, comparisonResult, options) {
        const timestamp = Date.now();
        const outputPath = options.outputPath ||
                          path.join(this.subdirs.classic, `intelligent_merge_${timestamp}.png`);
       
        console.log(`🎨 Создаю визуализацию интеллектуального слияния...`);
       
        const canvas = createCanvas(options.width, options.height);
        const ctx = canvas.getContext('2d');
       
        // Фон
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, options.width, options.height);
       
        // Получить графы
        const graph1 = footprint1.graph || footprint1;
        const graph2 = footprint2.graph || footprint2;
       
        // Найти общие масштабы и смещения
        const bounds = this.calculateCombinedBounds(graph1, graph2);
        const transform = this.calculateCanvasTransform(bounds, options);
       
        // Нарисовать оба графа
        this.drawDualGraphs(ctx, graph1, graph2, transform, {
            ...options,
            graph1Color: '#3498db', // Синий
            graph2Color: '#e74c3c', // Красный
            showNodes: true,
            showEdges: true
        });
       
        // Нарисовать трансформации (если есть)
        if (comparisonResult.transformation) {
            this.drawTransformationVectors(
                ctx,
                graph1,
                graph2,
                comparisonResult.transformation,
                transform,
                options
            );
        }
       
        // Нарисовать статистику
        if (options.showStats) {
            this.drawIntelligentStats(ctx, comparisonResult, options);
        }
       
        // Заголовок
        this.drawHeader(ctx, 'ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ', comparisonResult.similarity, options);
       
        // Сохранить
        await this.saveCanvas(canvas, outputPath);
       
        return {
            success: true,
            path: outputPath,
            type: 'intelligent',
            canvas: canvas
        };
    }

    // 4. КЛАССИЧЕСКОЕ СЛИЯНИЕ
    async visualizeClassicMerge(footprint1, footprint2, comparisonResult, options) {
        const timestamp = Date.now();
        const outputPath = options.outputPath ||
                          path.join(this.subdirs.classic, `classic_merge_${timestamp}.png`);
       
        console.log(`🎨 Создаю визуализацию классического слияния...`);
       
        const canvas = createCanvas(options.width, options.height);
        const ctx = canvas.getContext('2d');
       
        // Фон
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, options.width, options.height);
       
        // Получить графы
        const graph1 = footprint1.graph || footprint1;
        const graph2 = footprint2.graph || footprint2;
       
        // Найти общие масштабы и смещения
        const bounds = this.calculateCombinedBounds(graph1, graph2);
        const transform = this.calculateCanvasTransform(bounds, options);
       
        // Нарисовать оба графа
        this.drawDualGraphs(ctx, graph1, graph2, transform, {
            ...options,
            graph1Color: '#2ecc71', // Зелёный
            graph2Color: '#e67e22', // Оранжевый
            showNodes: true,
            showEdges: true
        });
       
        // Нарисовать статистику
        if (options.showStats) {
            this.drawClassicStats(ctx, comparisonResult, options);
        }
       
        // Заголовок
        this.drawHeader(ctx, 'КЛАССИЧЕСКОЕ СЛИЯНИЕ', comparisonResult.similarity, options);
       
        // Сохранить
        await this.saveCanvas(canvas, outputPath);
       
        return {
            success: true,
            path: outputPath,
            type: 'classic',
            canvas: canvas
        };
    }

    // 5. ГЕОМЕТРИЧЕСКОЕ СЛИЯНИЕ (запасной вариант)
    async visualizeGeometricMerge(footprint1, footprint2, comparisonResult, options) {
        const timestamp = Date.now();
        const outputPath = options.outputPath ||
                          path.join(this.subdirs.classic, `geometric_merge_${timestamp}.png`);
       
        console.log(`🎨 Создаю визуализацию геометрического слияния...`);
       
        const canvas = createCanvas(options.width, options.height);
        const ctx = canvas.getContext('2d');
       
        // Фон
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, options.width, options.height);
       
        // Нарисовать слияние точек
        if (comparisonResult.mergeResult?.points) {
            this.drawPointCloud(
                ctx,
                comparisonResult.mergeResult.points,
                options
            );
        } else {
            // Простой вариант
            const graph1 = footprint1.graph || footprint1;
            const graph2 = footprint2.graph || footprint2;
           
            const bounds = this.calculateCombinedBounds(graph1, graph2);
            const transform = this.calculateCanvasTransform(bounds, options);
           
            this.drawDualGraphs(ctx, graph1, graph2, transform, {
                ...options,
                graph1Color: '#9b59b6', // Фиолетовый
                graph2Color: '#1abc9c', // Бирюзовый
                opacity: 0.6
            });
        }
       
        // Заголовок
        this.drawHeader(ctx, 'ГЕОМЕТРИЧЕСКОЕ СЛИЯНИЕ (запасной вариант)',
                       comparisonResult.similarity, options);
       
        // Сохранить
        await this.saveCanvas(canvas, outputPath);
       
        return {
            success: true,
            path: outputPath,
            type: 'geometric',
            canvas: canvas
        };
    }

    // 6. ВИЗУАЛИЗАЦИЯ СУПЕР-МОДЕЛИ
    async visualizeSuperModel(superModel, mergedModels = [], outputPath = null, options = {}) {
        const timestamp = Date.now();
        const finalPath = outputPath ||
                         path.join(this.subdirs.supermodels, `super_model_${timestamp}.png`);
       
        console.log(`🎨 Создаю визуализацию супер-модели...`);
       
        const canvas = createCanvas(options.width || 1400, options.height || 1000);
        const ctx = canvas.getContext('2d');
       
        // Фон
        ctx.fillStyle = options.backgroundColor || '#0d1b2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
       
        // Получить граф супер-модели
        const superGraph = superModel.graph || superModel;
       
        // Найти масштабы
        const bounds = this.calculateGraphBounds(superGraph);
        const transform = this.calculateCanvasTransform(bounds, {
            width: canvas.width - 300, // Оставить место для статистики
            height: canvas.height - 150,
            padding: 100
        });
       
        // Нарисовать супер-модель
        this.drawSuperModelGraph(ctx, superGraph, transform, options);
       
        // Нарисовать статистику супер-модели
        this.drawSuperModelStats(ctx, superModel, mergedModels, canvas.width, options);
       
        // Нарисовать историю слияний (если есть)
        if (mergedModels.length > 0) {
            this.drawMergeHistory(ctx, mergedModels, canvas.width, canvas.height, options);
        }
       
        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.fillText('🌟 СТРУКТУРНАЯ СУПЕР-МОДЕЛЬ', 50, 50);
       
        if (superModel.name) {
            ctx.font = 'italic 24px Arial';
            ctx.fillStyle = '#cccccc';
            ctx.fillText(superModel.name, 50, 90);
        }
       
        // Сохранить
        await this.saveCanvas(canvas, finalPath);
       
        return {
            success: true,
            path: finalPath,
            type: 'super_model',
            stats: {
                nodes: superGraph.nodes.size,
                edges: superGraph.edges.size,
                mergedModels: mergedModels.length,
                timestamp: new Date().toISOString()
            }
        };
    }

    // 7. ВИЗУАЛИЗАЦИЯ ПРУЖИННЫХ СИЛ (для TopologyRefiner)
    async visualizeSpringForces(points, graph, forces, outputPath = null, options = {}) {
        const timestamp = Date.now();
        const finalPath = outputPath ||
                         path.join(this.subdirs.forces, `spring_forces_${timestamp}.png`);
       
        console.log(`🎨 Создаю визуализацию пружинных сил...`);
       
        const canvas = createCanvas(options.width || 1200, options.height || 800);
        const ctx = canvas.getContext('2d');
       
        // Фон
        ctx.fillStyle = options.backgroundColor || '#0d1b2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
       
        // Найти границы точек
        const bounds = this.calculatePointsBounds(points);
        const transform = this.calculateCanvasTransform(bounds, {
            width: canvas.width,
            height: canvas.height,
            padding: 100
        });
       
        // Нарисовать рёбра графа (пружины)
        this.drawSpringEdges(ctx, points, graph, transform, options);
       
        // Нарисовать точки с силами
        this.drawPointsWithForces(ctx, points, forces, transform, options);
       
        // Нарисовать информацию о силах
        this.drawForcesInfo(ctx, forces, canvas.width, canvas.height, options);
       
        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('🏗️ ПРУЖИННЫЕ СИЛЫ ТОПОЛОГИЧЕСКОЙ КОРРЕКЦИИ', 50, 40);
       
        // Легенда
        this.drawForcesLegend(ctx, canvas.width, canvas.height, options);
       
        // Сохранить
        await this.saveCanvas(canvas, finalPath);
       
        return {
            success: true,
            path: finalPath,
            type: 'spring_forces',
            stats: {
                points: points.length,
                forces: forces.length,
                maxForce: this.calculateMaxForce(forces)
            }
        };
    }

    // 8. МЕТОДЫ ОТРИСОВКИ

    drawTopologyMergeResult(ctx, mergeResult, transform, options) {
        const mergedGraph = mergeResult.mergedGraph;
        if (!mergedGraph) return;
       
        // Нарисовать рёбра объединённого графа
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
        ctx.lineWidth = 1.5;
       
        for (const [edgeId, edge] of mergedGraph.edges) {
            const fromNode = mergedGraph.nodes.get(edge.from);
            const toNode = mergedGraph.nodes.get(edge.to);
           
            if (fromNode && toNode) {
                const from = transform(fromNode.x, fromNode.y);
                const to = transform(toNode.x, toNode.y);
               
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        }
       
        // Нарисовать узлы объединённого графа
        for (const [nodeId, node] of mergedGraph.nodes) {
            const pos = transform(node.x, node.y);
           
            // Цвет в зависимости от источника узла
            let color;
            if (node.source === 'merged') {
                color = '#ffdd59'; // Жёлтый - слитые узлы
            } else if (node.source === 'graph1') {
                color = '#3498db'; // Синий - из первого графа
            } else if (node.source === 'graph2') {
                color = '#e74c3c'; // Красный - из второго графа
            } else {
                color = '#2ecc71'; // Зелёный - неизвестный источник
            }
           
            // Узел
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
            ctx.fill();
           
            // Обводка
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    drawDualGraphs(ctx, graph1, graph2, transform, options) {
        // Нарисовать рёбра первого графа
        ctx.strokeStyle = options.graph1Color ? options.graph1Color + '80' : 'rgba(52, 152, 219, 0.3)';
        ctx.lineWidth = 1;
       
        for (const [edgeId, edge] of graph1.edges) {
            const fromNode = graph1.nodes.get(edge.from);
            const toNode = graph1.nodes.get(edge.to);
           
            if (fromNode && toNode) {
                const from = transform(fromNode.x, fromNode.y);
                const to = transform(toNode.x, toNode.y);
               
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        }
       
        // Нарисовать рёбра второго графа
        ctx.strokeStyle = options.graph2Color ? options.graph2Color + '80' : 'rgba(231, 76, 60, 0.3)';
       
        for (const [edgeId, edge] of graph2.edges) {
            const fromNode = graph2.nodes.get(edge.from);
            const toNode = graph2.nodes.get(edge.to);
           
            if (fromNode && toNode) {
                const from = transform(fromNode.x, fromNode.y);
                const to = transform(toNode.x, toNode.y);
               
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        }
       
        // Нарисовать узлы первого графа
        const nodeSize = options.nodeSize || 5;
       
        ctx.fillStyle = options.graph1Color || '#3498db';
        for (const [nodeId, node] of graph1.nodes) {
            const pos = transform(node.x, node.y);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, nodeSize, 0, Math.PI * 2);
            ctx.fill();
        }
       
        // Нарисовать узлы второго графа
        ctx.fillStyle = options.graph2Color || '#e74c3c';
        for (const [nodeId, node] of graph2.nodes) {
            const pos = transform(node.x, node.y);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, nodeSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawStructuralMatches(ctx, graph1, graph2, matches, transform, options) {
        if (!matches || matches.length === 0) return;
       
        ctx.strokeStyle = '#ffdd59'; // Жёлтый для соответствий
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
       
        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());
       
        for (const match of matches) {
            if (match.node1 < nodes1.length && match.node2 < nodes2.length) {
                const node1 = nodes1[match.node1];
                const node2 = nodes2[match.node2];
               
                const pos1 = transform(node1.x, node1.y);
                const pos2 = transform(node2.x, node2.y);
               
                // Линия между соответствующими узлами
                ctx.beginPath();
                ctx.moveTo(pos1.x, pos1.y);
                ctx.lineTo(pos2.x, pos2.y);
                ctx.stroke();
               
                // Точки на концах
                ctx.fillStyle = '#ffdd59';
                ctx.beginPath();
                ctx.arc(pos1.x, pos1.y, 4, 0, Math.PI * 2);
                ctx.fill();
               
                ctx.beginPath();
                ctx.arc(pos2.x, pos2.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
       
        ctx.setLineDash([]); // Сбросить пунктир
    }

    drawTopologyStats(ctx, comparisonResult, options) {
        const stats = this.extractTopologyStats(comparisonResult);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
       
        let y = 120;
        const lineHeight = 25;
       
        // Основные метрики
        ctx.fillText('📊 ТОПОЛОГИЧЕСКИЕ МЕТРИКИ:', 30, y);
        y += lineHeight;
       
        ctx.font = '14px Arial';
       
        if (stats.structuralSimilarity !== undefined) {
            ctx.fillText(`🏗️ Структурная схожесть: ${(stats.structuralSimilarity * 100).toFixed(1)}%`, 40, y);
            y += lineHeight;
        }
       
        if (stats.structuralMatches !== undefined) {
            ctx.fillText(`🔗 Структурных соответствий: ${stats.structuralMatches}`, 40, y);
            y += lineHeight;
        }
       
        if (stats.preservedStructures !== undefined) {
            ctx.fillText(`💎 Сохранено структур: ${stats.preservedStructures}%`, 40, y);
            y += lineHeight;
        }
       
        if (stats.topologyImprovement !== undefined) {
            ctx.fillText(`📈 Улучшение топологии: ${stats.topologyImprovement}%`, 40, y);
            y += lineHeight;
        }
       
        // Метод слияния
        if (stats.method) {
            ctx.fillStyle = stats.method === 'topology_merge' ? '#2ecc71' : '#f39c12';
            ctx.fillText(`🔄 Метод: ${stats.method}`, 40, y);
        }
    }

    drawTopologyHeader(ctx, comparisonResult, options) {
        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.fillText('🏗️ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ', 50, 50);
       
        // Подзаголовок с similarity
        ctx.font = '20px Arial';
        ctx.fillStyle = comparisonResult.similarity > 0.7 ? '#2ecc71' :
                       comparisonResult.similarity > 0.5 ? '#f39c12' : '#e74c3c';
       
        const similarityText = `Схожесть: ${(comparisonResult.similarity * 100).toFixed(1)}%`;
        ctx.fillText(similarityText, 50, 85);
       
        // Решение
        ctx.font = '18px Arial';
        ctx.fillStyle = comparisonResult.decision === 'same' ? '#2ecc71' : '#f39c12';
        ctx.fillText(`Решение: ${comparisonResult.decision.toUpperCase()}`, 50, 110);
    }

    drawIntelligentStats(ctx, comparisonResult, options) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
       
        let y = 120;
        const lineHeight = 25;
       
        ctx.fillText('🧠 ИНТЕЛЛЕКТУАЛЬНЫЕ МЕТРИКИ:', 30, y);
        y += lineHeight;
       
        ctx.font = '14px Arial';
       
        if (comparisonResult.mergedNodes !== undefined) {
            ctx.fillText(`🔗 Слито узлов: ${comparisonResult.mergedNodes}`, 40, y);
            y += lineHeight;
        }
       
        if (comparisonResult.confidence !== undefined) {
            ctx.fillText(`💎 Уверенность: ${(comparisonResult.confidence * 100).toFixed(1)}%`, 40, y);
            y += lineHeight;
        }
       
        if (comparisonResult.transformation) {
            const trans = comparisonResult.transformation;
            ctx.fillText(`🔄 Трансформация: ${trans.type || 'unknown'}`, 40, y);
            y += lineHeight;
           
            if (trans.confidence !== undefined) {
                ctx.fillText(`   Уверенность трансформации: ${(trans.confidence * 100).toFixed(1)}%`, 50, y);
                y += lineHeight;
            }
        }
    }

    drawClassicStats(ctx, comparisonResult, options) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
       
        let y = 120;
        const lineHeight = 25;
       
        ctx.fillText('📊 КЛАССИЧЕСКИЕ МЕТРИКИ:', 30, y);
        y += lineHeight;
       
        ctx.font = '14px Arial';
       
        if (comparisonResult.mergedNodes !== undefined) {
            ctx.fillText(`🔗 Слито узлов: ${comparisonResult.mergedNodes}`, 40, y);
            y += lineHeight;
        }
       
        if (comparisonResult.totalNodes !== undefined) {
            ctx.fillText(`📈 Всего узлов: ${comparisonResult.totalNodes}`, 40, y);
            y += lineHeight;
        }
       
        if (comparisonResult.method) {
            ctx.fillText(`🔄 Метод сравнения: ${comparisonResult.method}`, 40, y);
            y += lineHeight;
        }
    }

    drawHeader(ctx, title, similarity, options) {
        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.fillText(title, 50, 50);
       
        // Similarity
        ctx.font = '18px Arial';
        ctx.fillStyle = similarity > 0.7 ? '#2ecc71' :
                       similarity > 0.5 ? '#f39c12' : '#e74c3c';
        ctx.fillText(`Схожесть: ${(similarity * 100).toFixed(1)}%`, 50, 85);
    }

    drawSuperModelGraph(ctx, graph, transform, options) {
        // Нарисовать рёбра
        ctx.strokeStyle = 'rgba(155, 89, 182, 0.4)'; // Фиолетовый
        ctx.lineWidth = 2;
       
        for (const [edgeId, edge] of graph.edges) {
            const fromNode = graph.nodes.get(edge.from);
            const toNode = graph.nodes.get(edge.to);
           
            if (fromNode && toNode) {
                const from = transform(fromNode.x, fromNode.y);
                const to = transform(toNode.x, toNode.y);
               
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        }
       
        // Нарисовать узлы с градиентом по confidence
        for (const [nodeId, node] of graph.nodes) {
            const pos = transform(node.x, node.y);
            const confidence = node.confidence || 0.5;
           
            // Цвет в зависимости от confidence
            const hue = 120 * confidence; // 0 = красный, 120 = зелёный
            const color = `hsl(${hue}, 70%, 50%)`;
           
            // Внешний круг (размер зависит от confidence)
            const radius = 4 + confidence * 4;
           
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
           
            // Внутренний белый круг
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawSuperModelStats(ctx, superModel, mergedModels, canvasWidth, options) {
        const statsX = canvasWidth - 350;
        let y = 150;
        const lineHeight = 25;
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('📊 СТАТИСТИКА СУПЕР-МОДЕЛИ', statsX, y);
        y += lineHeight + 10;
       
        ctx.font = '16px Arial';
       
        // Основные метрики
        const graph = superModel.graph || superModel;
        ctx.fillText(`🎯 Узлов: ${graph.nodes.size}`, statsX, y);
        y += lineHeight;
       
        ctx.fillText(`🔗 Рёбер: ${graph.edges.size}`, statsX, y);
        y += lineHeight;
       
        if (superModel.stats?.confidence) {
            ctx.fillText(`💎 Уверенность: ${(superModel.stats.confidence * 100).toFixed(1)}%`, statsX, y);
            y += lineHeight;
        }
       
        if (superModel.stats?.topologyScore) {
            ctx.fillText(`🏗️ Топологический score: ${(superModel.stats.topologyScore * 100).toFixed(1)}%`, statsX, y);
            y += lineHeight;
        }
       
        // История слияний
        if (mergedModels.length > 0) {
            y += 10;
            ctx.fillStyle = '#cccccc';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('📈 ИСТОРИЯ СЛИЯНИЙ:', statsX, y);
            y += lineHeight;
           
            ctx.font = '14px Arial';
            mergedModels.forEach((model, i) => {
                const modelGraph = model.graph || model;
                ctx.fillText(`${i + 1}. ${model.name || `Модель ${i + 1}`}: ${modelGraph.nodes.size} узлов`,
                           statsX + 20, y);
                y += lineHeight - 5;
            });
        }
       
        // Эффективность слияния
        if (mergedModels.length > 1) {
            const totalNodesBefore = mergedModels.reduce((sum, model) => {
                const modelGraph = model.graph || model;
                return sum + modelGraph.nodes.size;
            }, 0);
           
            const efficiency = totalNodesBefore > 0 ?
                (1 - graph.nodes.size / totalNodesBefore) * 100 : 0;
           
            y += 10;
            ctx.fillStyle = efficiency > 30 ? '#2ecc71' : '#f39c12';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(`📉 Эффективность сжатия: ${efficiency.toFixed(1)}%`, statsX, y);
        }
    }

    drawSpringEdges(ctx, points, graph, transform, options) {
        if (!graph || !graph.edges) return;
       
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.2)'; // Полупрозрачный синий
        ctx.lineWidth = 1;
       
        const nodeIds = Array.from(graph.nodes.keys());
       
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findPointIndex(edge.from, points, nodeIds);
            const toIdx = this.findPointIndex(edge.to, points, nodeIds);
           
            if (fromIdx !== -1 && toIdx !== -1 && points[fromIdx] && points[toIdx]) {
                const from = transform(points[fromIdx].x, points[fromIdx].y);
                const to = transform(points[toIdx].x, points[toIdx].y);
               
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        }
    }

    drawPointsWithForces(ctx, points, forces, transform, options) {
        points.forEach((point, idx) => {
            const pos = transform(point.x, point.y);
            const force = forces[idx] || { x: 0, y: 0 };
            const forceMagnitude = Math.sqrt(force.x * force.x + force.y * force.y);
           
            // Цвет точки в зависимости от величины силы
            const intensity = Math.min(1, forceMagnitude * 5);
            const r = Math.floor(100 + 155 * intensity);
            const g = Math.floor(200 - 150 * intensity);
            const b = Math.floor(255 - 100 * intensity);
           
            // Точка
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
            ctx.fill();
           
            // Обводка
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
            ctx.stroke();
           
            // Вектор силы (если достаточно большой)
            if (forceMagnitude > 0.1) {
                const arrowLength = Math.min(30, forceMagnitude * 20);
                const angle = Math.atan2(force.y, force.x);
               
                ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
               
                // Линия силы
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(
                    pos.x + Math.cos(angle) * arrowLength,
                    pos.y + Math.sin(angle) * arrowLength
                );
                ctx.stroke();
               
                // Наконечник стрелки
                ctx.beginPath();
                ctx.moveTo(
                    pos.x + Math.cos(angle) * arrowLength,
                    pos.y + Math.sin(angle) * arrowLength
                );
                ctx.lineTo(
                    pos.x + Math.cos(angle + 2.4) * (arrowLength - 6),
                    pos.y + Math.sin(angle + 2.4) * (arrowLength - 6)
                );
                ctx.lineTo(
                    pos.x + Math.cos(angle - 2.4) * (arrowLength - 6),
                    pos.y + Math.sin(angle - 2.4) * (arrowLength - 6)
                );
                ctx.closePath();
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fill();
            }
        });
    }

    drawForcesInfo(ctx, forces, width, height, options) {
        const infoX = 50;
        const infoY = height - 150;
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('⚡ ИНФОРМАЦИЯ О СИЛАХ:', infoX, infoY);
       
        ctx.font = '14px Arial';
       
        const stats = this.calculateForceStats(forces);
        let y = infoY + 30;
       
        ctx.fillText(`📊 Средняя сила: ${stats.mean.toFixed(3)}`, infoX, y);
        y += 20;
       
        ctx.fillText(`📈 Максимальная сила: ${stats.max.toFixed(3)}`, infoX, y);
        y += 20;
       
        ctx.fillText(`🎯 Точек с силой > 0.1: ${stats.significantForces} из ${stats.total}`, infoX, y);
    }

    drawForcesLegend(ctx, width, height, options) {
        const legendX = width - 250;
        const legendY = height - 150;
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🎨 ЛЕГЕНДА:', legendX, legendY);
       
        ctx.font = '14px Arial';
        let y = legendY + 30;
       
        // Синяя точка (малая сила)
        ctx.fillStyle = 'rgb(100, 200, 255)';
        ctx.beginPath();
        ctx.arc(legendX, y - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cccccc';
        ctx.fillText('Малая сила коррекции', legendX + 20, y);
        y += 25;
       
        // Красная точка (большая сила)
        ctx.fillStyle = 'rgb(255, 100, 100)';
        ctx.beginPath();
        ctx.arc(legendX, y - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cccccc';
        ctx.fillText('Большая сила коррекции', legendX + 20, y);
        y += 25;
       
        // Пружины
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX, y - 5);
        ctx.lineTo(legendX + 30, y - 5);
        ctx.stroke();
        ctx.fillStyle = '#cccccc';
        ctx.fillText('Пружинные связи', legendX + 40, y);
    }

    // 9. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    calculateCombinedBounds(graph1, graph2) {
        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());
        const allNodes = [...nodes1, ...nodes2];
       
        return this.calculatePointsBounds(allNodes.map(node => ({ x: node.x, y: node.y })));
    }

    calculateGraphBounds(graph) {
        const nodes = Array.from(graph.nodes.values());
        return this.calculatePointsBounds(nodes.map(node => ({ x: node.x, y: node.y })));
    }

    calculatePointsBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        }
       
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
       
        // Добавить немного padding
        const paddingX = (maxX - minX) * 0.1 || 10;
        const paddingY = (maxY - minY) * 0.1 || 10;
       
        return {
            minX: minX - paddingX,
            maxX: maxX + paddingX,
            minY: minY - paddingY,
            maxY: maxY + paddingY
        };
    }

    calculateCanvasTransform(bounds, options) {
        const width = options.width || this.config.width;
        const height = options.height || this.config.height;
        const padding = options.padding || 80;
       
        const contentWidth = width - 2 * padding;
        const contentHeight = height - 2 * padding;
       
        const graphWidth = bounds.maxX - bounds.minX;
        const graphHeight = bounds.maxY - bounds.minY;
       
        const scaleX = graphWidth > 0 ? contentWidth / graphWidth : 1;
        const scaleY = graphHeight > 0 ? contentHeight / graphHeight : 1;
        const scale = Math.min(scaleX, scaleY) * 0.9; // Небольшой margin
       
        const offsetX = padding - bounds.minX * scale;
        const offsetY = padding - bounds.minY * scale;
       
        return (x, y) => ({
            x: offsetX + x * scale,
            y: offsetY + y * scale
        });
    }

    extractTopologyStats(comparisonResult) {
        return {
            structuralSimilarity: comparisonResult.topologyMergeResult?.structuralSimilarity,
            structuralMatches: comparisonResult.topologyMergeResult?.structuralMatches?.length,
            preservedStructures: comparisonResult.metrics?.preservedStructures,
            topologyImprovement: comparisonResult.metrics?.topologyImprovement,
            method: comparisonResult.method || comparisonResult.topologyMergeResult?.method
        };
    }

    findPointIndex(nodeId, points, nodeIds) {
        if (!nodeIds || !points) return -1;
       
        const indexInGraph = nodeIds.indexOf(nodeId);
        if (indexInGraph === -1) return -1;
       
        // Найти точку с таким же nodeId
        for (let i = 0; i < points.length; i++) {
            if (points[i].nodeId === nodeId) {
                return i;
            }
        }
       
        return indexInGraph < points.length ? indexInGraph : -1;
    }

    calculateMaxForce(forces) {
        let max = 0;
        forces.forEach(force => {
            const magnitude = Math.sqrt(force.x * force.x + force.y * force.y);
            if (magnitude > max) max = magnitude;
        });
        return max;
    }

    calculateForceStats(forces) {
        let sum = 0;
        let max = 0;
        let significant = 0;
       
        forces.forEach(force => {
            const magnitude = Math.sqrt(force.x * force.x + force.y * force.y);
            sum += magnitude;
            if (magnitude > max) max = magnitude;
            if (magnitude > 0.1) significant++;
        });
       
        return {
            mean: forces.length > 0 ? sum / forces.length : 0,
            max: max,
            significantForces: significant,
            total: forces.length
        };
    }

    drawTransformationVectors(ctx, graph1, graph2, transformation, transform, options) {
        if (!transformation || !transformation.translation) return;
       
        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());
       
        if (nodes1.length === 0 || nodes2.length === 0) return;
       
        ctx.strokeStyle = 'rgba(255, 221, 89, 0.6)'; // Жёлтый
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
       
        // Нарисовать несколько векторов трансформации
        const sampleCount = Math.min(10, Math.min(nodes1.length, nodes2.length));
        const step = Math.max(1, Math.floor(nodes1.length / sampleCount));
       
        for (let i = 0; i < sampleCount; i++) {
            const idx = i * step;
            if (idx >= nodes1.length) break;
           
            const node1 = nodes1[idx];
            const pos1 = transform(node1.x, node1.y);
           
            // Применить трансформацию
            let x = node1.x + (transformation.translation.dx || 0);
            let y = node1.y + (transformation.translation.dy || 0);
           
            if (transformation.scale && transformation.scale !== 1) {
                x *= transformation.scale;
                y *= transformation.scale;
            }
           
            if (transformation.rotation && transformation.rotation !== 0) {
                const rad = transformation.rotation * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const newX = x * cos - y * sin;
                const newY = x * sin + y * cos;
                x = newX;
                y = newY;
            }
           
            const pos2 = transform(x, y);
           
            // Вектор трансформации
            ctx.beginPath();
            ctx.moveTo(pos1.x, pos1.y);
            ctx.lineTo(pos2.x, pos2.y);
            ctx.stroke();
        }
       
        ctx.setLineDash([]);
    }

    drawPointCloud(ctx, points, options) {
        if (!points || points.length === 0) return;
       
        const bounds = this.calculatePointsBounds(points);
        const transform = this.calculateCanvasTransform(bounds, options);
       
        // Нарисовать точки
        ctx.fillStyle = options.pointColor || '#3498db';
        points.forEach(point => {
            const pos = transform(point.x, point.y);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawMergeHistory(ctx, mergedModels, width, height, options) {
        const historyX = width - 350;
        const historyY = 350;
       
        ctx.fillStyle = '#cccccc';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('📈 ИСТОРИЯ СЛИЯНИЙ:', historyX, historyY);
       
        ctx.font = '14px Arial';
        let y = historyY + 30;
       
        // Нарисовать мини-график
        const maxModels = Math.min(5, mergedModels.length);
        const graphWidth = 200;
        const graphHeight = 100;
        const graphX = historyX;
        const graphY = y;
       
        // Фон графика
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(graphX, graphY, graphWidth, graphHeight);
       
        // Линия графика
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.beginPath();
       
        const modelsToShow = mergedModels.slice(-maxModels);
        const nodeCounts = modelsToShow.map(model => {
            const graph = model.graph || model;
            return graph.nodes.size;
        });
       
        const maxNodes = Math.max(...nodeCounts, 1);
       
        modelsToShow.forEach((model, i) => {
            const graph = model.graph || model;
            const x = graphX + (i / (modelsToShow.length - 1 || 1)) * graphWidth;
            const y = graphY + graphHeight - (graph.nodes.size / maxNodes) * graphHeight;
           
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
           
            // Точка на графике
            ctx.fillStyle = '#3498db';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
       
        ctx.stroke();
       
        // Подписи
        y += graphHeight + 20;
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(`От ${nodeCounts[0]} до ${nodeCounts[nodeCounts.length - 1]} узлов`,
                    historyX, y);
    }

    async saveCanvas(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
           
            out.on('finish', () => {
                console.log(`💾 Визуализация сохранена: ${filePath}`);
                resolve(filePath);
            });
           
            out.on('error', (error) => {
                console.log(`❌ Ошибка сохранения: ${error.message}`);
                reject(error);
            });
        });
    }

    // 10. УТИЛИТНЫЕ МЕТОДЫ

    // Создать подпись для изображения
    createTopologyMergeCaption(footprint1, footprint2, stats) {
        return `<b>🏗️ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1 || 0} узлов\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2 || 0} узлов\n` +
               `<b>🔗 Структурных соответствий:</b> ${stats.structuralMatches || 0}\n` +
               `<b>🏗️ Топологическая схожесть:</b> ${(stats.structuralSimilarity || 0).toFixed(3)}\n` +
               `<b>📊 Сохранено топологии:</b> ${stats.preservedStructures || 0}%\n\n` +
               `<i>🟣 Топологические соответствия | 🔵 Узлы графа | 🔴 Рёбра графа</i>`;
    }

    createIntelligentMergeCaption(footprint1, footprint2, stats) {
        return `<b>🧠 ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1 || 0} узлов\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2 || 0} узлов\n` +
               `<b>🔗 Слито узлов:</b> ${stats.mergedNodes || 0}\n` +
               `<b>💎 Уверенность:</b> ${((stats.confidence || 0) * 100).toFixed(1)}%\n` +
               `<b>🔄 Трансформация:</b> ${stats.transformationType || 'смещение'}\n\n` +
               `<i>🟡 Векторы трансформации | 🔵 Исходные точки | 🔴 Трансформированные точки</i>`;
    }

    createClassicMergeCaption(footprint1, footprint2, stats) {
        return `<b>📊 КЛАССИЧЕСКОЕ СЛИЯНИЕ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1 || 0} узлов\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2 || 0} узлов\n` +
               `<b>🎯 Схожесть:</b> ${((stats.similarity || 0) * 100).toFixed(1)}%\n` +
               `<b>🤔 Решение:</b> ${stats.decision || 'unknown'}\n` +
               `<b>🔄 Метод:</b> ${stats.method || 'graph_comparison'}\n\n` +
               `<i>🔵 Граф 1 | 🔴 Граф 2 | ⚫ Общие узлы</i>`;
    }

    createSuperModelCaption(superModel, mergedModels) {
        const mergedCount = mergedModels.length;
        const nodeReduction = mergedModels.reduce((sum, m) => {
            const graph = m.graph || m;
            return sum + graph.nodes.size;
        }, 0) - (superModel.graph?.nodes.size || 0);
       
        const efficiency = mergedModels.reduce((sum, m) => {
            const graph = m.graph || m;
            return sum + graph.nodes.size;
        }, 0) > 0 ?
            (nodeReduction / mergedModels.reduce((sum, m) => {
                const graph = m.graph || m;
                return sum + graph.nodes.size;
            }, 0) * 100).toFixed(1) : '0.0';
       
        return `<b>🌟 СТРУКТУРНАЯ СУПЕР-МОДЕЛЬ СОЗДАНА!</b>\n\n` +
               `<b>🎯 Объединено моделей:</b> ${mergedCount}\n` +
               `<b>📊 Узлов до:</b> ${mergedModels.reduce((sum, m) => {
                   const graph = m.graph || m;
                   return sum + graph.nodes.size;
               }, 0)}\n` +
               `<b>🎯 Узлов после:</b> ${superModel.graph?.nodes.size || 0} (${efficiency}% эффективность)\n` +
               `<b>🏗️ Топологический score:</b> ${Math.round((superModel.stats?.topologyScore || 0) * 100)}%\n` +
               `<b>💎 Общая уверенность:</b> ${Math.round((superModel.stats?.confidence || 0) * 100)}%\n\n` +
               `<i>🟣 Топологические соответствия | 🔵 Структурные узлы | 🔴 Сохранённые рёбра</i>`;
    }

    // Очистить старые визуализации
    cleanupOldVisualizations(maxAgeHours = 24) {
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
       
        Object.values(this.subdirs).forEach(dir => {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                let deleted = 0;
               
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                   
                    if (stats.mtimeMs < cutoffTime && file.endsWith('.png')) {
                        fs.unlinkSync(filePath);
                        deleted++;
                    }
                });
               
                if (deleted > 0) {
                    console.log(`🗑️ Удалено ${deleted} старых визуализаций из ${dir}`);
                }
            }
        });
       
        return { success: true, message: `Очистка завершена (старше ${maxAgeHours} часов)` };
    }

    // Получить статистику визуализаций
    getVisualizationStats() {
        const stats = {
            total: 0,
            byType: {},
            byDir: {}
        };
       
        Object.entries(this.subdirs).forEach(([type, dir]) => {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
                stats.byType[type] = files.length;
                stats.byDir[dir] = files.length;
                stats.total += files.length;
            }
        });
       
        return stats;
    }
}

module.exports = MergeVisualizer;
