// modules/footprint/analysis/PatternAnalyzer.js
// 🔥 АНАЛИЗ ТОПОЛОГИЧЕСКИХ ПАТТЕРНОВ - ИСПРАВЛЕННАЯ СЕРИАЛИЗАЦИЯ GAPPATTERN

class PatternAnalyzer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minPatternSize = options.minPatternSize || 3;
        this.maxPatternSize = options.maxPatternSize || 6;
        this.similarityThreshold = options.similarityThreshold || 0.85;
      
        console.log('🔷 PatternAnalyzer (полная версия) создан');
    }

    /**
     * Анализирует след и находит повторяющиеся паттерны
     */
    analyzeFootprint(footprint) {
        console.log(`\n🔍 Анализ топологических паттернов...`);
      
        const graph = footprint.graph;
        const roles = this.extractRoles(graph);
      
        const patterns = this.findRepeatingPatterns(graph, roles);
        const groups = this.groupPatterns(patterns);
        const stats = this.calculateStats(groups);
        const pointPatterns = this.mapPatternsToPoints(patterns, groups);
       
        // 🔥 ИСПРАВЛЕНО: передаем graph в analyzeGaps
        const gaps = this.analyzeGaps(graph, pointPatterns);
      
        console.log(`   • Найдено паттернов: ${patterns.length}`);
        console.log(`   • Уникальных групп: ${Object.keys(groups).length}`);
        console.log(`   • Типы: ${Object.keys(stats.typeDistribution).join(', ')}`);
      
        return {
            patterns: pointPatterns,
            groups,
            stats,
            gaps
        };
    }

    /**
     * Извлекает роли из графа
     */
    extractRoles(graph) {
        const roles = new Map();
        for (const [nodeId, node] of graph.nodes) {
            const degree = node.degree || 0;
            if (degree >= 6) roles.set(nodeId, 'H');
            else if (degree === 1) roles.set(nodeId, 'L');
            else if (degree >= 3 && this.isClique(nodeId, graph)) roles.set(nodeId, 'C');
            else if (degree === 2 && !this.areNeighborsConnected(nodeId, graph)) roles.set(nodeId, 'B');
            else roles.set(nodeId, 'R');
        }
        return roles;
    }

    /**
     * Проверяет, является ли узел частью клики
     */
    isClique(nodeId, graph) {
        const neighbors = this.findNodeNeighbors(nodeId, graph);
        if (neighbors.length < 2) return false;
      
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                if (!this.areConnected(neighbors[i].id, neighbors[j].id, graph)) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Проверяет, связаны ли соседи между собой
     */
    areNeighborsConnected(nodeId, graph) {
        const neighbors = this.findNodeNeighbors(nodeId, graph);
        if (neighbors.length !== 2) return false;
        return this.areConnected(neighbors[0].id, neighbors[1].id, graph);
    }

    /**
     * Находит повторяющиеся подграфы (паттерны)
     */
    findRepeatingPatterns(graph, roles) {
        const patterns = [];
        const visited = new Set();
      
        for (const [startId, startNode] of graph.nodes) {
            if (visited.has(startId)) continue;
          
            for (let size = this.minPatternSize; size <= this.maxPatternSize; size++) {
                const component = this.findConnectedComponent(startId, graph, size);
                if (!component) continue;
              
                component.forEach(id => visited.add(id));
              
                const subgraph = this.extractSubgraph(component, graph, roles);
                const signature = this.computePatternSignature(subgraph);
              
                patterns.push({
                    nodes: component,
                    signature,
                    size: component.length,
                    type: subgraph.type,
                    structure: subgraph,
                    center: this.findPatternCenter(component, graph)
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
          
            neighbors.sort((a, b) => a.id.localeCompare(b.id));
          
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
     * Находит центр паттерна
     */
    findPatternCenter(nodeIds, graph) {
        let center = nodeIds[0];
        let maxDegree = 0;
      
        for (const id of nodeIds) {
            const node = graph.nodes.get(id);
            if (node && node.degree > maxDegree) {
                maxDegree = node.degree;
                center = id;
            }
        }
      
        return center;
    }

    /**
     * Извлекает подграф и определяет его тип
     */
    extractSubgraph(nodeIds, graph, roles) {
        const nodes = nodeIds.map(id => graph.nodes.get(id));
        const edges = [];
        const adjacency = {};
      
        nodeIds.forEach(id => adjacency[id] = {});
      
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                if (this.areConnected(nodeIds[i], nodeIds[j], graph)) {
                    edges.push([nodeIds[i], nodeIds[j]]);
                    adjacency[nodeIds[i]][nodeIds[j]] = true;
                    adjacency[nodeIds[j]][nodeIds[i]] = true;
                }
            }
        }
      
        const type = this.classifySubgraph(adjacency, nodeIds.length, edges.length);
        const nodeRoles = nodeIds.map(id => roles.get(id) || 'R');
        const centrality = this.calculateCentrality(nodeIds, adjacency);
      
        return {
            nodes: nodeIds,
            edges,
            nodeCount: nodeIds.length,
            edgeCount: edges.length,
            density: edges.length / (nodeIds.length * (nodeIds.length - 1) / 2),
            type,
            nodeRoles: nodeRoles.sort().join(''),
            centrality
        };
    }

    /**
     * Классифицирует подграф
     */
    classifySubgraph(adjacency, nodeCount, edgeCount) {
        const maxEdges = nodeCount * (nodeCount - 1) / 2;
        const density = edgeCount / maxEdges;
      
        if (density === 1) return 'clique';
        if (this.isLine(adjacency, nodeCount)) return 'line';
        if (this.isStar(adjacency, nodeCount)) return 'star';
        if (this.isCycle(adjacency, nodeCount, edgeCount)) return 'cycle';
        if (edgeCount === nodeCount - 1) return 'tree';
        if (density > 0.7) return 'dense';
        if (density < 0.3) return 'sparse';
      
        return 'regular';
    }

    isLine(adjacency, nodeCount) {
        let degree1 = 0;
        let degree2 = 0;
      
        for (const node in adjacency) {
            const deg = Object.keys(adjacency[node]).length;
            if (deg === 1) degree1++;
            else if (deg === 2) degree2++;
            else return false;
        }
      
        return degree1 === 2 && degree2 === nodeCount - 2;
    }

    isStar(adjacency, nodeCount) {
        let center = null;
      
        for (const node in adjacency) {
            const deg = Object.keys(adjacency[node]).length;
            if (deg === nodeCount - 1) {
                if (center) return false;
                center = node;
            } else if (deg !== 1) {
                return false;
            }
        }
      
        return center !== null;
    }

    isCycle(adjacency, nodeCount, edgeCount) {
        if (edgeCount !== nodeCount) return false;
      
        for (const node in adjacency) {
            if (Object.keys(adjacency[node]).length !== 2) return false;
        }
      
        return true;
    }

    calculateCentrality(nodeIds, adjacency) {
        const centrality = {};
      
        for (const node of nodeIds) {
            centrality[node] = Object.keys(adjacency[node] || {}).length;
        }
      
        return centrality;
    }

    computePatternSignature(subgraph) {
        const components = [
            `S${subgraph.nodeCount}`,
            `E${subgraph.edgeCount}`,
            `T${subgraph.type}`,
            `R${subgraph.nodeRoles}`,
            `D${subgraph.density.toFixed(2)}`
        ];
      
        return components.join('_');
    }

    groupPatterns(patterns) {
        const groups = {};
      
        for (const pattern of patterns) {
            if (!groups[pattern.signature]) {
                groups[pattern.signature] = [];
            }
            groups[pattern.signature].push(pattern);
        }
      
        for (const [sig, pats] of Object.entries(groups)) {
            for (const pat of pats) {
                pat.frequency = pats.length;
            }
        }
      
        return groups;
    }

    /**
     * 🔥 ИСПРАВЛЕНО: всегда возвращаем строку
     */
    mapPatternsToPoints(patterns, groups) {
        const pointPatterns = {};
       
        for (const pattern of patterns) {
            const frequency = groups[pattern.signature]?.length || 1;
           
            for (const nodeId of pattern.nodes) {
                if (!pointPatterns[nodeId]) {
                    pointPatterns[nodeId] = {
                        patterns: [],
                        primaryType: pattern.type,
                        frequency: frequency,
                        totalOccurrences: frequency
                    };
                }
                pointPatterns[nodeId].patterns.push({
                    type: pattern.type,
                    size: pattern.size,
                    signature: pattern.signature,
                    center: pattern.center === nodeId
                });
            }
        }
       
        // Определяем primaryType для каждой точки
        for (const nodeId in pointPatterns) {
            const types = {};
            for (const p of pointPatterns[nodeId].patterns) {
                types[p.type] = (types[p.type] || 0) + 1;
            }
           
            let maxType = 'R';
            let maxCount = 0;
            for (const [type, count] of Object.entries(types)) {
                if (count > maxCount) {
                    maxCount = count;
                    maxType = type;
                }
            }
           
            pointPatterns[nodeId].primaryType = maxType;
        }
       
        return pointPatterns;
    }

    /**
     * 🔥 ИСПРАВЛЕНО: всегда возвращаем СТРОКУ, никогда объект
     */
    analyzeGaps(graph, pointPatterns) {
        const gaps = {};
       
        for (const [nodeId, node] of graph.nodes) {
            const pattern = pointPatterns[nodeId];
            if (!pattern) {
                gaps[nodeId] = '0';
                continue;
            }
           
            const neighbors = this.findNodeNeighbors(nodeId, graph);
            const neighborPatterns = neighbors
                .map(n => pointPatterns[n.id])
                .filter(p => p);
           
            const gapInfo = {};
           
            // Граница паттерна (есть соседи без паттерна)
            if (neighborPatterns.length < neighbors.length) {
                gapInfo.type = 'boundary';
                gapInfo.missingNeighbors = neighbors.length - neighborPatterns.length;
            }
           
            // Переход в другой паттерн
            const differentNeighbors = neighborPatterns.filter(
                p => p.primaryType !== pattern.primaryType
            ).length;
           
            if (differentNeighbors > 0) {
                gapInfo.type = gapInfo.type || 'transition';
                gapInfo.differentNeighbors = differentNeighbors;
            }
           
            // 🔥 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: ВСЕГДА СТРОКА
            gaps[nodeId] = Object.keys(gapInfo).length > 0
                ? JSON.stringify(gapInfo)
                : '0';
           
            // Для отладки можно раскомментировать
            // if (this.debug && gaps[nodeId] !== '0') {
            //     console.log(`   Точка ${nodeId.slice(0,8)}: gapPattern = ${gaps[nodeId]}`);
            // }
        }
       
        return gaps;
    }

    /**
     * Собирает статистику по паттернам
     */
    calculateStats(groups) {
        const stats = {
            totalPatterns: 0,
            uniqueTypes: Object.keys(groups).length,
            typeDistribution: {},
            sizeDistribution: {},
            frequencyStats: {
                unique: 0,
                rare: 0,
                common: 0
            }
        };
      
        for (const [signature, patterns] of Object.entries(groups)) {
            stats.totalPatterns += patterns.length;
            stats.typeDistribution[signature] = patterns.length;
          
            const size = patterns[0].size;
            stats.sizeDistribution[size] = (stats.sizeDistribution[size] || 0) + patterns.length;
          
            if (patterns.length === 1) {
                stats.frequencyStats.unique++;
            } else if (patterns.length <= 3) {
                stats.frequencyStats.rare++;
            } else {
                stats.frequencyStats.common++;
            }
        }
      
        return stats;
    }

    comparePatterns(patterns1, patterns2) {
        const groups1 = this.groupPatterns(patterns1);
        const groups2 = this.groupPatterns(patterns2);
      
        const comparison = {
            missing: [],
            extra: [],
            matched: []
        };
      
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
            } else if (pattern.type === 'cycle' && count > 1) {
                summary.push(`${count} циклов по ${pattern.size} точек`);
            } else if (count === 1) {
                summary.push(`Уникальный ${pattern.type} из ${pattern.size} точек`);
            }
        }
      
        return summary;
    }
}

module.exports = PatternAnalyzer;
