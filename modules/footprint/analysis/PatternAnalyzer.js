// modules/footprint/analysis/PatternAnalyzer.js
// 🔥 АНАЛИЗ ТОПОЛОГИЧЕСКИХ ПАТТЕРНОВ (инвариантный)

class PatternAnalyzer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minPatternSize = options.minPatternSize || 3;
        this.maxPatternSize = options.maxPatternSize || 6;
        this.similarityThreshold = options.similarityThreshold || 0.85;
       
        console.log('🔷 PatternAnalyzer создан');
    }

    /**
     * Анализирует след и находит повторяющиеся паттерны
     */
    analyzeFootprint(footprint) {
        console.log(`\n🔍 Анализ топологических паттернов...`);
       
        const graph = footprint.graph;
        const roles = footprint.roles || new Map();
       
        // 1. Находим все повторяющиеся подграфы
        const patterns = this.findRepeatingPatterns(graph, roles);
       
        // 2. Группируем по типу
        const groups = this.groupPatterns(patterns);
       
        // 3. Собираем статистику
        const stats = this.calculateStats(groups);
       
        console.log(`   • Найдено паттернов: ${patterns.length}`);
        console.log(`   • Уникальных групп: ${Object.keys(groups).length}`);
       
        return {
            patterns,
            groups,
            stats,
            summary: this.generateSummary(groups)
        };
    }

    /**
     * Находит повторяющиеся подграфы (паттерны)
     */
    findRepeatingPatterns(graph, roles) {
        const patterns = [];
        const visited = new Set();
       
        // Перебираем все точки как потенциальные начала паттернов
        for (const [startId, startNode] of graph.nodes) {
            if (visited.has(startId)) continue;
           
            // Ищем все связные компоненты заданного размера
            for (let size = this.minPatternSize; size <= this.maxPatternSize; size++) {
                const component = this.findConnectedComponent(startId, graph, size);
                if (!component) continue;
               
                // Извлекаем подграф
                const subgraph = this.extractSubgraph(component, graph, roles);
               
                // Вычисляем сигнатуру паттерна (инвариантную!)
                const signature = this.computePatternSignature(subgraph);
               
                patterns.push({
                    nodes: component,
                    signature,
                    size: component.length,
                    type: subgraph.type,
                    structure: subgraph
                });
            }
        }
       
        return patterns;
    }

    /**
     * Находит связный компонент заданного размера
     */
    findConnectedComponent(startId, graph, targetSize) {
        const component = [startId];
        const queue = [startId];
        const visited = new Set([startId]);
       
        while (queue.length > 0 && component.length < targetSize) {
            const currentId = queue.shift();
            const neighbors = this.findNodeNeighbors(currentId, graph);
           
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    component.push(neighbor.id);
                    queue.push(neighbor.id);
                   
                    if (component.length >= targetSize) break;
                }
            }
        }
       
        return component.length === targetSize ? component : null;
    }

    /**
     * Извлекает подграф и определяет его тип
     */
    extractSubgraph(nodeIds, graph, roles) {
        const nodes = nodeIds.map(id => graph.nodes.get(id));
        const edges = [];
       
        // Собираем все ребра между узлами подграфа
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                if (this.areConnected(nodeIds[i], nodeIds[j], graph)) {
                    edges.push([nodeIds[i], nodeIds[j]]);
                }
            }
        }
       
        // Определяем тип подграфа по его структуре
        const type = this.classifySubgraph(edges.length, nodeIds.length);
       
        // Собираем роли узлов
        const nodeRoles = nodeIds.map(id => roles.get(id) || 'R');
       
        return {
            nodes: nodeIds,
            edges,
            nodeCount: nodeIds.length,
            edgeCount: edges.length,
            density: edges.length / (nodeIds.length * (nodeIds.length - 1) / 2),
            type,
            nodeRoles: nodeRoles.sort().join('')
        };
    }

    /**
     * Классифицирует подграф по его структуре
     */
    classifySubgraph(edgeCount, nodeCount) {
        const maxEdges = nodeCount * (nodeCount - 1) / 2;
        const density = edgeCount / maxEdges;
       
        if (density === 1) return 'clique';           // Полный граф
        if (density > 0.7) return 'dense';            // Плотный
        if (this.isLine(edgeCount, nodeCount)) return 'line';  // Линия
        if (this.isStar(edgeCount, nodeCount)) return 'star';  // Звезда
        if (density < 0.3) return 'sparse';           // Разреженный
        return 'regular';
    }

    /**
     * Проверяет, является ли подграф линией
     */
    isLine(edgeCount, nodeCount) {
        return edgeCount === nodeCount - 1; // Дерево без ветвлений
    }

    /**
     * Проверяет, является ли подграф звездой
     */
    isStar(edgeCount, nodeCount) {
        return edgeCount === nodeCount - 1; // Центральный узел со всеми
    }

    /**
     * Вычисляет инвариантную сигнатуру паттерна
     */
    computePatternSignature(subgraph) {
        const components = [
            `S${subgraph.nodeCount}`,           // размер
            `E${subgraph.edgeCount}`,            // количество связей
            `T${subgraph.type}`,                 // тип структуры
            `R${subgraph.nodeRoles}`             // роли узлов
        ];
       
        return components.join('_');
    }

    /**
     * Группирует похожие паттерны
     */
    groupPatterns(patterns) {
        const groups = {};
       
        for (const pattern of patterns) {
            if (!groups[pattern.signature]) {
                groups[pattern.signature] = [];
            }
            groups[pattern.signature].push(pattern);
        }
       
        return groups;
    }

    /**
     * Собирает статистику по паттернам
     */
    calculateStats(groups) {
        const stats = {
            totalPatterns: 0,
            uniqueTypes: Object.keys(groups).length,
            typeDistribution: {},
            sizeDistribution: {}
        };
       
        for (const [signature, patterns] of Object.entries(groups)) {
            stats.totalPatterns += patterns.length;
            stats.typeDistribution[signature] = patterns.length;
           
            const size = patterns[0].size;
            stats.sizeDistribution[size] = (stats.sizeDistribution[size] || 0) + patterns.length;
        }
       
        return stats;
    }

    /**
     * Генерирует человеко-читаемое описание
     */
    generateSummary(groups) {
        const summary = [];
       
        for (const [signature, patterns] of Object.entries(groups)) {
            const pattern = patterns[0];
            const count = patterns.length;
           
            if (pattern.type === 'clique' && count > 1) {
                summary.push(`${count} групп по ${pattern.size} точек в клике`);
            } else if (pattern.type === 'line' && count > 1) {
                summary.push(`${count} линий по ${pattern.size} точек`);
            } else if (pattern.type === 'star' && count > 1) {
                summary.push(`${count} звезд по ${pattern.size} точек`);
            }
        }
       
        return summary;
    }

    /**
     * Сравнивает паттерны двух следов
     */
    comparePatterns(patterns1, patterns2) {
        const groups1 = this.groupPatterns(patterns1);
        const groups2 = this.groupPatterns(patterns2);
       
        const comparison = {
            missing: [],
            extra: [],
            matched: []
        };
       
        // Ищем совпадающие и пропавшие паттерны
        for (const [sig, pats1] of Object.entries(groups1)) {
            if (groups2[sig]) {
                const pats2 = groups2[sig];
                const min = Math.min(pats1.length, pats2.length);
               
                comparison.matched.push({
                    signature: sig,
                    count: min,
                    type: pats1[0].type,
                    size: pats1[0].size
                });
               
                if (pats1.length > pats2.length) {
                    comparison.missing.push({
                        signature: sig,
                        count: pats1.length - pats2.length,
                        type: pats1[0].type
                    });
                }
            } else {
                comparison.missing.push({
                    signature: sig,
                    count: pats1.length,
                    type: pats1[0].type
                });
            }
        }
       
        // Ищем новые паттерны
        for (const [sig, pats2] of Object.entries(groups2)) {
            if (!groups1[sig]) {
                comparison.extra.push({
                    signature: sig,
                    count: pats2.length,
                    type: pats2[0].type
                });
            }
        }
       
        return comparison;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) neighbors.push({id: b});
            if (b === nodeId) neighbors.push({id: a});
        }
        return neighbors;
    }

    areConnected(aId, bId, graph) {
        const edgeId = [aId, bId].sort().join('--');
        return graph.edges.has(edgeId);
    }
}

module.exports = PatternAnalyzer;
