// modules/footprint/topology/CenterMatcher.js
// 🔥 ПОИСК НАДЁЖНЫХ ТОЧЕК ПО ИЕРАРХИИ (ХАБЫ → МОСТЫ → ОСТАЛЬНЫЕ)

class CenterMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minLocalSimilarity = options.minLocalSimilarity || 0.5;
        this.minMorphologySimilarity = options.minMorphologySimilarity || 0.6;
        this.minConsistentPairs = options.minConsistentPairs || 1;
       
        // 🔥 МЯГКИЕ ПОРОГИ
        this.reliableMorphThreshold = 0.40;      // было 0.60
        this.reliableLocalThreshold = 0.50;       // было 0.65
        this.minGraphDistanceRatio = 0.5;
        this.minTriangleScore = 0.50;             // было 0.70
       
        this.localGroupSignature = options.localGroupSignature;
        this.morphologyEncoder = options.morphologyEncoder;
       
        this.centerMatches = new Map();
        this.depthUsage = new Map();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
       
        console.log('🎯 CenterMatcher (ИЕРАРХИЧЕСКИЙ) создан');
    }

    findCenterMatches(photoGraph, modelGraph, photoMorphology, modelMorphology) {
        console.log(`\n🔍 Ищу НАДЁЖНЫЕ точки по иерархии...`);

        // ========== ЭТАП 1: СБОР КАНДИДАТОВ ==========
        const candidates = [];
        const photoNodes = Array.from(photoGraph.nodes.entries());

        for (const [photoId, photoNode] of photoNodes) {
            const photoZone = this.getZone(photoNode.y);
           
            const depthResult = this.localGroupSignature.findOptimalDepth(
                photoId,
                photoGraph,
                modelGraph,
                modelGraph.nodes,
                photoMorphology
            );

            const depth = depthResult.optimalDepth || 2;
            this.depthUsage.set(depth, (this.depthUsage.get(depth) || 0) + 1);
            this.zoneStats[photoZone]++;

            for (const candidate of depthResult.candidates || []) {
                const modelNode = modelGraph.nodes.get(candidate.modelId);
                if (!modelNode) continue;

                const modelZone = this.getZone(modelNode.y);
               
                const morphScore = this.compareMorphology(
                    photoId, candidate.modelId,
                    photoMorphology, modelMorphology
                ) || 0.5;

                // 🔥 ОПРЕДЕЛЯЕМ РОЛИ
                const photoRole = this.getNodeRole(photoId, photoGraph);
                const modelRole = this.getNodeRole(candidate.modelId, modelGraph);

                candidates.push({
                    photoId,
                    modelId: candidate.modelId,
                    photoNode,
                    modelNode,
                    photoZone,
                    modelZone,
                    photoRole,
                    modelRole,
                    localScore: candidate.similarity || 0,
                    morphScore,
                    depth
                });
            }
        }

        console.log(`\n📊 ЭТАП 1: Найдено ${candidates.length} кандидатов`);

        // ========== ЭТАП 2: ГРУППИРОВКА ПО РОЛЯМ ==========
        const hubs = candidates.filter(c => c.photoRole === 'H' && c.modelRole === 'H');
        const bridges = candidates.filter(c => c.photoRole === 'B' && c.modelRole === 'B');
        const cliques = candidates.filter(c => c.photoRole === 'C' && c.modelRole === 'C');
        const others = candidates.filter(c =>
            c.photoRole === c.modelRole &&
            !['H', 'B', 'C'].includes(c.photoRole)
        );

        console.log(`\n📊 РАСПРЕДЕЛЕНИЕ ПО РОЛЯМ:`);
        console.log(`   Хабы (H): ${hubs.length}`);
        console.log(`   Мосты (B): ${bridges.length}`);
        console.log(`   Клики (C): ${cliques.length}`);
        console.log(`   Остальные: ${others.length}`);

        // ========== ЭТАП 3: ФИЛЬТРАЦИЯ ==========
        let morphReject = 0;
        let localReject = 0;
        let triangleReject = 0;
        let passed = 0;

        const filterByThresholds = (candidatesList) => {
            return candidatesList.filter(c => {
                if (c.morphScore < this.reliableMorphThreshold) {
                    morphReject++;
                    return false;
                }
                if (c.localScore < this.reliableLocalThreshold) {
                    localReject++;
                    return false;
                }
               
                const triangleScore = this.checkTriangles(
                    c.photoId, c.modelId,
                    photoGraph, modelGraph
                );
               
                if (triangleScore < this.minTriangleScore) {
                    triangleReject++;
                    return false;
                }
               
                passed++;
                return true;
            });
        };

        const filteredHubs = filterByThresholds(hubs);
        const filteredBridges = filterByThresholds(bridges);
        const filteredCliques = filterByThresholds(cliques);
        const filteredOthers = filterByThresholds(others);

        console.log(`\n📊 ДИАГНОСТИКА ФИЛЬТРАЦИИ:`);
        console.log(`   Всего кандидатов: ${candidates.length}`);
        console.log(`   ❌ Отсев по морфологии: ${morphReject}`);
        console.log(`   ❌ Отсев по локальному сходству: ${localReject}`);
        console.log(`   ❌ Отсев по треугольникам: ${triangleReject}`);
        console.log(`   ✅ Прошло: ${passed}`);

        // ========== ЭТАП 4: ГРУППИРОВКА ПО СОГЛАСОВАННОСТИ ==========
        const allFiltered = [
            ...filteredHubs,
            ...filteredBridges,
            ...filteredCliques,
            ...filteredOthers
        ];

        if (allFiltered.length < 3) {
            console.log(`\n⚠️ Недостаточно кандидатов (${allFiltered.length} < 3)`);
            return new Map();
        }

        const groups = [];
        for (let i = 0; i < allFiltered.length; i++) {
            let added = false;
            for (const group of groups) {
                let consistentWithAll = true;
                for (const j of group) {
                    if (!this.areConsistent(
                        allFiltered[i], allFiltered[j],
                        photoGraph, modelGraph
                    )) {
                        consistentWithAll = false;
                        break;
                    }
                }
                if (consistentWithAll) {
                    group.push(i);
                    added = true;
                    break;
                }
            }
            if (!added) groups.push([i]);
        }

        let maxGroup = [];
        for (const group of groups) {
            if (group.length > maxGroup.length) maxGroup = group;
        }

        console.log(`\n📊 ЭТАП 4: Найдено ${groups.length} групп, самая большая - ${maxGroup.length} точек`);

        if (maxGroup.length < 3) {
            console.log(`\n⚠️ Недостаточно согласованных точек (${maxGroup.length} < 3)`);
            return new Map();
        }

        // ========== ЭТАП 5: ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ==========
        const result = new Map();
        for (const idx of maxGroup) {
            const c = allFiltered[idx];
            result.set(c.photoId, {
                modelId: c.modelId,
                confidence: (c.morphScore + c.localScore) / 2,
                role: c.photoRole,
                zone: c.photoZone,
                depth: c.depth
            });
        }

        console.log(`\n🎯 ИТОГО: Найдено ${result.size} НАДЁЖНЫХ ТОЧЕК`);
        return result;
    }

    // ==================== ОПРЕДЕЛЕНИЕ РОЛИ ====================
    getNodeRole(nodeId, graph) {
        const neighbors = this.findNodeNeighbors(nodeId, graph);
        const degree = neighbors.length;
       
        if (degree === 1) return 'L';
        if (degree >= 6) return 'H';
       
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!this.areConnected(a.id, b.id, graph)) return 'B';
        }
       
        if (degree >= 3) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (!this.areConnected(neighbors[i].id, neighbors[j].id, graph)) {
                        allConnected = false;
                        break;
                    }
                }
                if (!allConnected) break;
            }
            if (allConnected) return 'C';
        }
       
        return 'R';
    }

    // ==================== ПРОВЕРКА СОГЛАСОВАННОСТИ ====================
    areConsistent(a, b, photoGraph, modelGraph) {
        const photoDist = this.graphDistance(a.photoId, b.photoId, photoGraph);
        const modelDist = this.graphDistance(a.modelId, b.modelId, modelGraph);
       
        if (photoDist === Infinity || modelDist === Infinity) return false;
       
        const minDist = Math.min(photoDist, modelDist);
        const maxDist = Math.max(photoDist, modelDist);
        return (minDist / maxDist) >= this.minGraphDistanceRatio;
    }

    // ==================== ПРОВЕРКА ТРЕУГОЛЬНИКОВ ====================
    checkTriangles(photoId, modelId, photoGraph, modelGraph) {
        const photoNeighbors = this.findNodeNeighbors(photoId, photoGraph);
        const modelNeighbors = this.findNodeNeighbors(modelId, modelGraph);
       
        if (photoNeighbors.length < 2 || modelNeighbors.length < 2) return 0.5;
       
        // Упрощённая проверка: достаточно 30% совпадения
        let matches = 0;
        for (let i = 0; i < Math.min(photoNeighbors.length, 5); i++) {
            for (let j = i + 1; j < Math.min(photoNeighbors.length, 5); j++) {
                if (i >= modelNeighbors.length || j >= modelNeighbors.length) continue;
                // Проверяем, есть ли ребро между соседями
                const photoEdge = [photoNeighbors[i].id, photoNeighbors[j].id].sort().join('--');
                const modelEdge = [modelNeighbors[i].id, modelNeighbors[j].id].sort().join('--');
               
                if (photoGraph.edges.has(photoEdge) && modelGraph.edges.has(modelEdge)) {
                    matches++;
                }
            }
        }
       
        return matches / 3; // нормализация
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================
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

    areConnected(aId, bId, graph) {
        const edgeId = [aId, bId].sort().join('--');
        return graph.edges.has(edgeId);
    }

    compareMorphology(photoId, modelId, photoMorph, modelMorph) {
        const pm = photoMorph?.get(photoId);
        const mm = modelMorph?.get(modelId);
        if (!pm || !mm || !pm.hasContour || !mm.hasContour) return 0.5;
       
        const score = this.morphologyEncoder.compare(pm, mm);
        return (score !== undefined && !isNaN(score)) ? score : 0.5;
    }

    getZone(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }

    getStats() {
        return {
            reliableMorphThreshold: this.reliableMorphThreshold,
            reliableLocalThreshold: this.reliableLocalThreshold,
            minGraphDistanceRatio: this.minGraphDistanceRatio,
            minTriangleScore: this.minTriangleScore,
            depthUsage: Object.fromEntries(this.depthUsage),
            zoneStats: this.zoneStats
        };
    }

    clear() {
        this.centerMatches.clear();
        this.depthUsage.clear();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
    }
}

module.exports = CenterMatcher;
