// modules/footprint/topology/CenterMatcher.js
// 🔥 ПОИСК НАДЁЖНЫХ ТОЧЕК (ТОПОЛОГИЧЕСКИЙ, БЕЗ ПИКСЕЛЕЙ)

class CenterMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minLocalSimilarity = options.minLocalSimilarity || 0.5;
        this.minMorphologySimilarity = options.minMorphologySimilarity || 0.6;
        this.minConsistentPairs = options.minConsistentPairs || 1;
       
        // 🔥 ПОРОГИ ДЛЯ НАДЁЖНЫХ ТОЧЕК (ТОПОЛОГИЧЕСКИЕ)
        this.reliableMorphThreshold = 0.95;           // морфология 95%+
        this.reliableLocalThreshold = 0.85;           // локальное сходство 85%+
        this.minGraphDistanceRatio = 0.7;              // мин. соотношение расстояний в графе 70%
       
        this.localGroupSignature = options.localGroupSignature;
        this.morphologyEncoder = options.morphologyEncoder;
       
        this.centerMatches = new Map();
        this.depthUsage = new Map();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
       
        console.log('🎯 CenterMatcher с ТОПОЛОГИЧЕСКИМ отбором создан');
        console.log(`   🔥 Морфология ≥ ${this.reliableMorphThreshold * 100}%`);
        console.log(`   🔥 Локальное сходство ≥ ${this.reliableLocalThreshold * 100}%`);
        console.log(`   🔥 Мин. соотношение расстояний в графе: ${this.minGraphDistanceRatio * 100}%`);
    }

    findCenterMatches(photoGraph, modelGraph, photoMorphology, modelMorphology) {
        console.log(`\n🔍 Ищу НАДЁЖНЫЕ точки по всему следу...`);

        const candidates = [];
        const photoNodes = Array.from(photoGraph.nodes.entries());

        // Обнуляем статистику
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
        this.depthUsage.clear();

        // 🔥 ЭТАП 1: СБОР КАНДИДАТОВ
        for (const [photoId, photoNode] of photoNodes) {
            const photoZone = this.getZone(photoNode.y);
           
            const depthResult = this.localGroupSignature.findOptimalDepth(
                photoId,
                photoGraph,
                modelGraph,
                modelGraph.nodes,
                photoMorphology
            );

            const depth = depthResult.optimalDepth;
            this.depthUsage.set(depth, (this.depthUsage.get(depth) || 0) + 1);
            this.zoneStats[photoZone]++;

            for (const candidate of depthResult.candidates) {
                const modelNode = modelGraph.nodes.get(candidate.modelId);
                if (!modelNode) continue;

                const modelZone = this.getZone(modelNode.y);
               
                const morphScore = this.compareMorphology(
                    photoId, candidate.modelId,
                    photoMorphology, modelMorphology
                );

                candidates.push({
                    photoId,
                    modelId: candidate.modelId,
                    photoNode,
                    modelNode,
                    photoZone,
                    modelZone,
                    localScore: candidate.similarity,
                    morphScore,
                    depth: candidate.depth
                });
            }
        }

        console.log(`\n📊 ЭТАП 1: Найдено ${candidates.length} кандидатов`);

        // 🔥 ЭТАП 2: ЖЁСТКАЯ ФИЛЬТРАЦИЯ ПО ИНДИВИДУАЛЬНЫМ КРИТЕРИЯМ
        const filteredCandidates = candidates.filter(c => {
            // 1. Морфология должна быть почти идеальной
            if (c.morphScore < this.reliableMorphThreshold) {
                return false;
            }
           
            // 2. Локальное сходство высокое
            if (c.localScore < this.reliableLocalThreshold) {
                return false;
            }
           
            // 3. ЗОНЫ ДОЛЖНЫ СОВПАДАТЬ
            if (c.photoZone !== c.modelZone) {
                return false;
            }
           
            return true;
        });

        console.log(`\n📊 ЭТАП 2: После фильтрации осталось ${filteredCandidates.length} кандидатов`);

        // 🔥 ЭТАП 3: ПРОВЕРКА СОГЛАСОВАННОСТИ ГРУППЫ (ТОПОЛОГИЧЕСКАЯ)
        const groups = []; // каждая группа - массив индексов
       
        for (let i = 0; i < filteredCandidates.length; i++) {
            let added = false;
           
            // Пробуем добавить точку в существующую группу
            for (const group of groups) {
                let consistentWithAll = true;
               
                for (const j of group) {
                    if (!this.areConsistent(
                        filteredCandidates[i],
                        filteredCandidates[j],
                        photoGraph,
                        modelGraph
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
           
            // Если не добавили ни в одну группу, создаём новую
            if (!added) {
                groups.push([i]);
            }
        }

        // Находим самую большую группу
        let maxGroup = [];
        for (const group of groups) {
            if (group.length > maxGroup.length) {
                maxGroup = group;
            }
        }

        console.log(`\n📊 ЭТАП 3: Найдено ${groups.length} групп, самая большая - ${maxGroup.length} точек`);

        // Если нет групп, берём одиночные точки с максимальной уверенностью
        if (maxGroup.length === 0 && filteredCandidates.length > 0) {
            filteredCandidates.sort((a, b) => (b.morphScore + b.localScore) - (a.morphScore + a.localScore));
            maxGroup = [0];
            console.log(`\n⚠️ Согласованных групп нет, беру лучшую точку`);
        }

        // 🔥 ЭТАП 4: ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
        const result = new Map();
        let count = 0;
       
        for (const idx of maxGroup) {
            const c = filteredCandidates[idx];
            result.set(c.photoId, {
                modelId: c.modelId,
                confidence: (c.morphScore + c.localScore) / 2,
                zone: c.photoZone,
                depth: c.depth
            });
            count++;
           
            if (this.debug && count <= 10) {
                console.log(`   ✅ Надёжная точка ${count}: ${c.photoZone} | глубина:${c.depth} | морф:${(c.morphScore*100).toFixed(0)}% лок:${(c.localScore*100).toFixed(0)}%`);
            }
        }

        console.log(`\n🎯 ИТОГО: Найдено ${result.size} НАДЁЖНЫХ ТОПОЛОГИЧЕСКИХ точек`);

        return result;
    }

    // ==================== ПРОВЕРКА СОГЛАСОВАННОСТИ ====================

    areConsistent(a, b, photoGraph, modelGraph) {
        // 🔥 РАССТОЯНИЕ В ШАГАХ ПО ГРАФУ (НЕ В ПИКСЕЛЯХ!)
        const photoDist = this.graphDistance(a.photoId, b.photoId, photoGraph);
        const modelDist = this.graphDistance(a.modelId, b.modelId, modelGraph);
       
        if (photoDist === Infinity || modelDist === Infinity) return false;
       
        // Нормализованное отношение расстояний
        const minDist = Math.min(photoDist, modelDist);
        const maxDist = Math.max(photoDist, modelDist);
        const ratio = minDist / maxDist;
       
        const consistent = ratio >= this.minGraphDistanceRatio;
       
        if (this.debug && !consistent && ratio > 0.5) {
            console.log(`   ❌ Несогласованы: расстояние в фото ${photoDist} шагов, в модели ${modelDist} шагов, ratio ${(ratio*100).toFixed(0)}%`);
        }
       
        return consistent;
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
       
        const edgesArray = Array.from(graph.edges);
        for (const edge of edgesArray) {
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

    compareMorphology(photoId, modelId, photoMorph, modelMorph) {
        const pm = photoMorph?.get(photoId);
        const mm = modelMorph?.get(modelId);
       
        if (!pm || !mm || !pm.hasContour || !mm.hasContour) return 0.5;
       
        return this.morphologyEncoder.compare(pm, mm);
    }

    // ==================== ОПРЕДЕЛЕНИЕ ЗОНЫ ====================

    getZone(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            minLocalSimilarity: this.minLocalSimilarity,
            minMorphologySimilarity: this.minMorphologySimilarity,
            minConsistentPairs: this.minConsistentPairs,
            reliableMorphThreshold: this.reliableMorphThreshold,
            reliableLocalThreshold: this.reliableLocalThreshold,
            minGraphDistanceRatio: this.minGraphDistanceRatio,
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
