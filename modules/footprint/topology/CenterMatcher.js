// modules/footprint/topology/CenterMatcher.js
// 🔥 ПОИСК ПО ВСЕМУ СЛЕДУ С ДИНАМИЧЕСКОЙ ГЛУБИНОЙ

class CenterMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minLocalSimilarity = options.minLocalSimilarity || 0.5;
        this.minMorphologySimilarity = options.minMorphologySimilarity || 0.6;
        this.minConsistentPairs = options.minConsistentPairs || 1; // ⬅️ ПОНИЖЕНО ДО 1
       
        this.localGroupSignature = options.localGroupSignature;
        this.morphologyEncoder = options.morphologyEncoder;
       
        this.centerMatches = new Map();
        this.consistencyGraph = new Map();
        this.depthUsage = new Map();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
       
        console.log('🎯 CenterMatcher с ДИНАМИЧЕСКОЙ глубиной и ПОИСКОМ ПО ВСЕМУ СЛЕДУ создан');
    }

    findCenterMatches(photoGraph, modelGraph, photoMorphology, modelMorphology) {
        console.log(`\n🔍 Ищу общую область ПО ВСЕМУ СЛЕДУ с динамической глубиной...`);

        const candidates = [];
        const photoNodes = Array.from(photoGraph.nodes.entries());
        const modelNodes = Array.from(modelGraph.nodes.entries());

        // Обнуляем статистику
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
        this.depthUsage.clear();

        for (const [photoId, photoNode] of photoNodes) {
            // 🔥 ИЩЕМ ПО ВСЕМ ЗОНАМ, НЕ ТОЛЬКО ЦЕНТР
            const photoZone = this.getZone(photoNode.y);
           
            // 🔥 НАХОДИМ ОПТИМАЛЬНУЮ ГЛУБИНУ
            const depthResult = this.localGroupSignature.findOptimalDepth(
                photoId,
                photoGraph,
                modelGraph,
                modelGraph.nodes,
                photoMorphology
            );

            // Сохраняем статистику
            const depth = depthResult.optimalDepth;
            this.depthUsage.set(depth, (this.depthUsage.get(depth) || 0) + 1);
            this.zoneStats[photoZone]++;

            // Берём лучших кандидатов
            for (const candidate of depthResult.candidates) {
                const modelNode = modelGraph.nodes.get(candidate.modelId);
                if (!modelNode) continue;

                const modelZone = this.getZone(modelNode.y);
               
                // 🔥 БОНУС ЗА СОВПАДЕНИЕ ЗОНЫ
                const zoneBonus = (photoZone === modelZone) ? 0.2 : 0;

                const morphScore = this.compareMorphology(
                    photoId, candidate.modelId,
                    photoMorphology, modelMorphology
                );

                // 🔥 ИТОГОВЫЙ СЧЁТ С УЧЁТОМ ЗОНЫ
                const totalScore = candidate.similarity * 0.5 +
                                  morphScore * 0.3 +
                                  zoneBonus;

                candidates.push({
                    photoId,
                    modelId: candidate.modelId,
                    photoNode,
                    modelNode,
                    photoZone,
                    modelZone,
                    localScore: candidate.similarity,
                    morphScore,
                    totalScore,
                    depth: candidate.depth
                });
            }
        }

        // Сортируем по убыванию
        candidates.sort((a, b) => b.totalScore - a.totalScore);

        // 🔥 ДИАГНОСТИКА
        console.log(`\n📊 СТАТИСТИКА ПО ЗОНАМ:`);
        console.log(`   Центр: ${this.zoneStats.center} точек`);
        console.log(`   Носок: ${this.zoneStats.toe} точек`);
        console.log(`   Пятка: ${this.zoneStats.heel} точек`);

        console.log(`\n📊 ТОП-10 КАНДИДАТОВ:`);
        candidates.slice(0, 10).forEach((c, i) => {
            console.log(`   ${i+1}. ${c.photoZone}→${c.modelZone} | глубина:${c.depth} | ` +
                       `сходство:${(c.totalScore*100).toFixed(0)}% (local:${(c.localScore*100).toFixed(0)}% morph:${(c.morphScore*100).toFixed(0)}%)`);
        });

        // Строим граф согласованности
        this.buildConsistencyGraph(candidates.slice(0, 30), photoGraph, modelGraph);
       
        const consistentMatches = this.findMaxConsistentSet();
        const finalMatches = this.filterByZone(consistentMatches, photoGraph, modelGraph);

        return finalMatches;
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
        // Расстояние в фото (в шагах по графу)
        const photoDist = this.graphDistance(a.photoId, b.photoId, photoGraph);
        const modelDist = this.graphDistance(a.modelId, b.modelId, modelGraph);
       
        if (photoDist === Infinity || modelDist === Infinity) return false;
       
        // 🔥 РАЗНЫЕ ЗОНЫ МОГУТ БЫТЬ СОГЛАСОВАНЫ, НО С МЕНЬШИМ ВЕСОМ
        const minDist = Math.min(photoDist, modelDist);
        const maxDist = Math.max(photoDist, modelDist);
        const ratio = minDist / maxDist;
       
        // Если зоны совпадают, требуем ratio >= 0.3
        // Если зоны разные, требуем ratio >= 0.5 (более жёстко)
        const zoneMatch = (a.photoZone === a.modelZone) && (b.photoZone === b.modelZone);
        const threshold = zoneMatch ? 0.3 : 0.5;
       
        return ratio >= threshold;
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
       
        // 🔥 ДИАГНОСТИКА
        console.log(`\n🔗 Найдена согласованная группа из ${bestSet.size} точек`);
       
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
       
        // 🔥 ВОССТАНАВЛИВАЕМ ПОЛНУЮ ИНФОРМАЦИЮ
        // Здесь нужно передать candidates, но пока заглушка
       
        return result;
    }

    // ==================== ОПРЕДЕЛЕНИЕ ЗОНЫ ====================

    getZone(y) {
        if (y > 350) return 'HEEL';  // пятка
        if (y < 200) return 'TOE';    // носок
        return 'CENTER';               // центр
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            minLocalSimilarity: this.minLocalSimilarity,
            minMorphologySimilarity: this.minMorphologySimilarity,
            minConsistentPairs: this.minConsistentPairs,
            depthUsage: Object.fromEntries(this.depthUsage),
            zoneStats: this.zoneStats
        };
    }

    clear() {
        this.centerMatches.clear();
        this.consistencyGraph.clear();
        this.depthUsage.clear();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
    }
}

module.exports = CenterMatcher;
