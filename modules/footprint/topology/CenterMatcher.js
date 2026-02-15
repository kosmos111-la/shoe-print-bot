// modules/footprint/topology/CenterMatcher.js
// 🔥 ПОИСК ОБЩЕЙ ОБЛАСТИ С ДИНАМИЧЕСКОЙ ГЛУБИНОЙ

class CenterMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minLocalSimilarity = options.minLocalSimilarity || 0.5;
        this.minMorphologySimilarity = options.minMorphologySimilarity || 0.6;
        this.minConsistentPairs = options.minConsistentPairs || 2;
       
        this.localGroupSignature = options.localGroupSignature;
        this.morphologyEncoder = options.morphologyEncoder;
       
        this.centerMatches = new Map();
        this.consistencyGraph = new Map();
        this.depthUsage = new Map();
       
        console.log('🎯 CenterMatcher с ДИНАМИЧЕСКОЙ глубиной создан');
    }

    findCenterMatches(photoGraph, modelGraph, photoMorphology, modelMorphology) {
        console.log(`\n🔍 Ищу общую область с динамической глубиной...`);

        const candidates = [];
        const photoNodes = Array.from(photoGraph.nodes.entries());
        const modelNodes = Array.from(modelGraph.nodes.entries());

        for (const [photoId, photoNode] of photoNodes) {
            if (!this.isCenterZone(photoNode)) continue;

            // 🔥 НАХОДИМ ОПТИМАЛЬНУЮ ГЛУБИНУ ДЛЯ ЭТОЙ ТОЧКИ
            const depthResult = this.localGroupSignature.findOptimalDepth(
                photoId,
                photoGraph,
                modelGraph,
                modelGraph.nodes,
                photoMorphology
            );

            // Сохраняем статистику по глубинам
            const depth = depthResult.optimalDepth;
            this.depthUsage.set(depth, (this.depthUsage.get(depth) || 0) + 1);

            // Берём лучших кандидатов
            for (const candidate of depthResult.candidates) {
                const modelNode = modelGraph.nodes.get(candidate.modelId);
                if (!modelNode || !this.isCenterZone(modelNode)) continue;

                const morphScore = this.compareMorphology(
                    photoId, candidate.modelId,
                    photoMorphology, modelMorphology
                );

                const totalScore = candidate.similarity * 0.7 + morphScore * 0.3;

                candidates.push({
                    photoId,
                    modelId: candidate.modelId,
                    photoNode,
                    modelNode,
                    localScore: candidate.similarity,
                    morphScore,
                    totalScore,
                    depth: candidate.depth
                });
            }
        }

        // Сортируем и строим граф согласованности
        candidates.sort((a, b) => b.totalScore - a.totalScore);
        this.buildConsistencyGraph(candidates.slice(0, 50), photoGraph, modelGraph);
       
        const consistentMatches = this.findMaxConsistentSet();
        const centerMatches = this.filterByZone(consistentMatches, photoGraph, modelGraph);

        // Выводим статистику по глубинам
        console.log(`\n📊 СТАТИСТИКА ИСПОЛЬЗОВАНИЯ ГЛУБИН:`);
        for (let d = 1; d <= 4; d++) {
            const count = this.depthUsage.get(d) || 0;
            console.log(`   Глубина ${d}: использована ${count} раз`);
        }

        return centerMatches;
    }

    compareMorphology(photoId, modelId, photoMorph, modelMorph) {
        const pm = photoMorph?.get(photoId);
        const mm = modelMorph?.get(modelId);
       
        if (!pm || !mm || !pm.hasContour || !mm.hasContour) return 0.5;
       
        return this.morphologyEncoder.compare(pm, mm);
    }

    buildConsistencyGraph(candidates, photoGraph, modelGraph) {
        this.consistencyGraph.clear();
       
        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                if (this.areConsistent(candidates[i], candidates[j], photoGraph, modelGraph)) {
                    if (!this.consistencyGraph.has(candidates[i].photoId)) {
                        this.consistencyGraph.set(candidates[i].photoId, new Set());
                    }
                    if (!this.consistencyGraph.has(candidates[j].photoId)) {
                        this.consistencyGraph.set(candidates[j].photoId, new Set());
                    }
                    this.consistencyGraph.get(candidates[i].photoId).add(candidates[j].photoId);
                    this.consistencyGraph.get(candidates[j].photoId).add(candidates[i].photoId);
                }
            }
        }
    }

    areConsistent(a, b, photoGraph, modelGraph) {
        const photoDist = this.graphDistance(a.photoId, b.photoId, photoGraph);
        const modelDist = this.graphDistance(a.modelId, b.modelId, modelGraph);
       
        if (photoDist === Infinity || modelDist === Infinity) return false;
       
        const minDist = Math.min(photoDist, modelDist);
        const maxDist = Math.max(photoDist, modelDist);
        const ratio = minDist / maxDist;
       
        return ratio >= 0.3; // допускаем разницу в 3 раза
    }

    graphDistance(nodeA, nodeB, graph) {
        if (nodeA === nodeB) return 0;
       
        const queue = [{ id: nodeA, dist: 0 }];
        const visited = new Set([nodeA]);
       
        while (queue.length > 0) {
            const { id, dist } = queue.shift();
           
            const neighbors = this.findNodeNeighbors(id, graph);
            for (const neighbor of neighbors) {
                if (neighbor.id === nodeB) return dist + 1;
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({ id: neighbor.id, dist: dist + 1 });
                }
            }
        }
        return Infinity;
    }

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        if (!graph?.edges) return neighbors;
       
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) {
                const node = graph.nodes.get(b);
                if (node) neighbors.push(node);
            }
            if (b === nodeId) {
                const node = graph.nodes.get(a);
                if (node) neighbors.push(node);
            }
        }
        return neighbors;
    }

    findMaxConsistentSet() {
        if (this.consistencyGraph.size === 0) return new Map();
       
        let bestSet = new Set();
        const nodes = Array.from(this.consistencyGraph.keys());
       
        for (const startNode of nodes) {
            const candidate = this.growClique(startNode, new Set([startNode]));
            if (candidate.size > bestSet.size) bestSet = candidate;
        }
       
        return bestSet;
    }

    growClique(node, currentClique) {
        const neighbors = Array.from(this.consistencyGraph.get(node) || []);
       
        for (const neighbor of neighbors) {
            if (currentClique.has(neighbor)) continue;
           
            let connectedToAll = true;
            for (const member of currentClique) {
                const memberNeighbors = this.consistencyGraph.get(member) || new Set();
                if (!memberNeighbors.has(neighbor)) {
                    connectedToAll = false;
                    break;
                }
            }
           
            if (connectedToAll) {
                currentClique.add(neighbor);
                this.growClique(neighbor, currentClique);
            }
        }
       
        return currentClique;
    }

    filterByZone(matches, photoGraph, modelGraph) {
        const result = new Map();
        // В реальном коде нужно восстановить полные данные
        return result;
    }

    isCenterZone(node) {
        return node.y >= 200 && node.y <= 350;
    }

    getStats() {
        return {
            minLocalSimilarity: this.minLocalSimilarity,
            minMorphologySimilarity: this.minMorphologySimilarity,
            minConsistentPairs: this.minConsistentPairs,
            depthUsage: Object.fromEntries(this.depthUsage)
        };
    }

    clear() {
        this.centerMatches.clear();
        this.consistencyGraph.clear();
        this.depthUsage.clear();
    }
}

module.exports = CenterMatcher;
