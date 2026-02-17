// modules/footprint/topology/CenterMatcher.js
// 🔥 ПОИСК НАДЁЖНЫХ ТОЧЕК С ЗАЩИТОЙ ОТ UNDEFINED

class CenterMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minLocalSimilarity = options.minLocalSimilarity || 0.5;
        this.minMorphologySimilarity = options.minMorphologySimilarity || 0.6;
        this.minConsistentPairs = options.minConsistentPairs || 1;
       
        // 🔥 ПОРОГИ
        this.reliableMorphThreshold = 0.60;           // было 0.75
        this.reliableLocalThreshold = 0.65;           // было 0.70
        this.minGraphDistanceRatio = 0.5;
        this.minTriangleScore = 0.7;                    // было 0.95
       
        this.localGroupSignature = options.localGroupSignature;
        this.morphologyEncoder = options.morphologyEncoder;
       
        this.centerMatches = new Map();
        this.depthUsage = new Map();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
       
        console.log('🎯 CenterMatcher (исправленный) создан');
    }

    findCenterMatches(photoGraph, modelGraph, photoMorphology, modelMorphology) {
    console.log(`\n🔍 Ищу НАДЁЖНЫЕ точки по всему следу...`);
   
    // 🔥 ДИАГНОСТИКА ВХОДНЫХ ДАННЫХ
    console.log(`\n📊 ДИАГНОСТИКА ВХОДНЫХ ДАННЫХ:`);
    console.log(`   photoGraph: ${photoGraph ? 'есть' : 'нет'}`);
    console.log(`   photoGraph.nodes: ${photoGraph?.nodes?.size || 0} точек`);
    console.log(`   modelGraph: ${modelGraph ? 'есть' : 'нет'}`);
    console.log(`   modelGraph.nodes: ${modelGraph?.nodes?.size || 0} точек`);
    console.log(`   photoMorphology: ${photoMorphology ? 'есть' : 'нет'}`);
    console.log(`   modelMorphology: ${modelMorphology ? 'есть' : 'нет'}`);
    console.log(`   localGroupSignature: ${this.localGroupSignature ? 'есть' : 'нет'}`);
   
    // Проверяем первую точку
    const firstPhotoNode = Array.from(photoGraph.nodes.entries())[0];
    if (firstPhotoNode) {
        const [firstId, firstNode] = firstPhotoNode;
        console.log(`\n🔍 Тестовый вызов findOptimalDepth для первой точки:`);
        try {
            const testResult = this.localGroupSignature.findOptimalDepth(
                firstId,
                photoGraph,
                modelGraph,
                modelGraph.nodes,
                photoMorphology
            );
            console.log(`   ✅ findOptimalDepth отработал:`);
            console.log(`   optimalDepth: ${testResult.optimalDepth}`);
            console.log(`   candidates: ${testResult.candidates?.length || 0}`);
        } catch (e) {
            console.log(`   ❌ Ошибка в findOptimalDepth: ${e.message}`);
        }
    }

        const candidates = [];
        const photoNodes = Array.from(photoGraph.nodes.entries());

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
   
    // 🔥 ЗАЩИТА
    if (!depthResult || !depthResult.candidates) {
        continue;
    }
   
    const depth = depthResult.optimalDepth || 2;
            this.depthUsage.set(depth, (this.depthUsage.get(depth) || 0) + 1);
            this.zoneStats[photoZone]++;

            for (const candidate of depthResult.candidates) {
                const modelNode = modelGraph.nodes.get(candidate.modelId);
                if (!modelNode) continue;

                const modelZone = this.getZone(modelNode.y);
               
                // 🔥 ЗАЩИТА: morphScore всегда число
                const morphScore = this.compareMorphology(
                    photoId, candidate.modelId,
                    photoMorphology, modelMorphology
                ) || 0.5;

                candidates.push({
                    photoId,
                    modelId: candidate.modelId,
                    photoNode,
                    modelNode,
                    photoZone,
                    modelZone,
                    localScore: candidate.similarity || 0,
                    morphScore: morphScore,
                    depth: candidate.depth || 0
                });
            }
        }

        console.log(`\n📊 ЭТАП 1: Найдено ${candidates.length} кандидатов`);

        // 🔥 ЭТАП 2: ФИЛЬТРАЦИЯ
        let morphReject = 0;
        let localReject = 0;
        let triangleReject = 0;
        let passed = 0;

        const filteredCandidates = candidates.filter(c => {
            // 1. Морфология
            if (c.morphScore < this.reliableMorphThreshold) {
                morphReject++;
                return false;
            }
           
            // 2. Локальное сходство
            if (c.localScore < this.reliableLocalThreshold) {
                localReject++;
                return false;
            }
           
            // 4. Проверка треугольников
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

        console.log(`\n📊 ДИАГНОСТИКА ФИЛЬТРАЦИИ:`);
        console.log(`   Всего кандидатов: ${candidates.length}`);
        console.log(`   ❌ Отсев по морфологии: ${morphReject}`);
        console.log(`   ❌ Отсев по локальному сходству: ${localReject}`);
        console.log(`   ❌ Отсев по треугольникам: ${triangleReject}`);
        console.log(`   ✅ Прошло: ${passed}`);

        // 🔥 ЭТАП 3: ГРУППИРОВКА
        const groups = [];
       
        for (let i = 0; i < filteredCandidates.length; i++) {
            let added = false;
           
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
           
            if (!added) {
                groups.push([i]);
            }
        }

        let maxGroup = [];
        for (const group of groups) {
            if (group.length > maxGroup.length) {
                maxGroup = group;
            }
        }

        console.log(`\n📊 ЭТАП 3: Найдено ${groups.length} групп, самая большая - ${maxGroup.length} точек`);

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
           
            const triangleScore = this.checkTriangles(
                c.photoId, c.modelId,
                photoGraph, modelGraph
            );
           
            result.set(c.photoId, {
                modelId: c.modelId,
                confidence: (c.morphScore + c.localScore + triangleScore) / 3,
                zone: c.photoZone,
                depth: c.depth,
                triangleScore
            });
            count++;
           
            if (this.debug && count <= 10) {
                console.log(`   ✅ Надёжная точка ${count}: ${c.photoZone} | глуб:${c.depth} | морф:${(c.morphScore*100).toFixed(0)}% лок:${(c.localScore*100).toFixed(0)}% треуг:${(triangleScore*100).toFixed(0)}%`);
            }
        }

        console.log(`\n🎯 ИТОГО: Найдено ${result.size} НАДЁЖНЫХ ТОПОЛОГИЧЕСКИХ ТОЧЕК`);

        return result;
    }

    // ==================== ПРОВЕРКА СОГЛАСОВАННОСТИ ====================

    areConsistent(a, b, photoGraph, modelGraph) {
        const photoDist = this.graphDistance(a.photoId, b.photoId, photoGraph);
        const modelDist = this.graphDistance(a.modelId, b.modelId, modelGraph);
       
        if (photoDist === Infinity || modelDist === Infinity) return false;
       
        const minDist = Math.min(photoDist, modelDist);
        const maxDist = Math.max(photoDist, modelDist);
        const ratio = minDist / maxDist;
       
        return ratio >= this.minGraphDistanceRatio;
    }

    // ==================== ПРОВЕРКА ТРЕУГОЛЬНИКОВ ====================

    checkTriangles(photoId, modelId, photoGraph, modelGraph) {
        const photoNeighbors = this.findNodeNeighbors(photoId, photoGraph);
        if (photoNeighbors.length < 2) return 1.0;
       
        const modelNeighbors = this.findNodeNeighbors(modelId, modelGraph);
        if (modelNeighbors.length < 2) return 1.0;
       
        let photoTriangles = [];
        for (let i = 0; i < photoNeighbors.length; i++) {
            for (let j = i + 1; j < photoNeighbors.length; j++) {
                const edgeBetween = [photoNeighbors[i].id, photoNeighbors[j].id].sort().join('--');
                if (photoGraph.edges.has(edgeBetween)) {
                    photoTriangles.push({
                        a: photoId,
                        b: photoNeighbors[i].id,
                        c: photoNeighbors[j].id
                    });
                }
            }
        }
       
        let modelTriangles = [];
        for (let i = 0; i < modelNeighbors.length; i++) {
            for (let j = i + 1; j < modelNeighbors.length; j++) {
                const edgeBetween = [modelNeighbors[i].id, modelNeighbors[j].id].sort().join('--');
                if (modelGraph.edges.has(edgeBetween)) {
                    modelTriangles.push({
                        a: modelId,
                        b: modelNeighbors[i].id,
                        c: modelNeighbors[j].id
                    });
                }
            }
        }
       
        if (photoTriangles.length === 0 || modelTriangles.length === 0) return 0.5;
       
        let matches = 0;
        for (const pt of photoTriangles) {
            const p1 = photoGraph.nodes.get(pt.a);
            const p2 = photoGraph.nodes.get(pt.b);
            const p3 = photoGraph.nodes.get(pt.c);
            if (!p1 || !p2 || !p3) continue;
           
            const angles = this.computeTriangleAngles(p1, p2, p3);
           
            for (const mt of modelTriangles) {
                const m1 = modelGraph.nodes.get(mt.a);
                const m2 = modelGraph.nodes.get(mt.b);
                const m3 = modelGraph.nodes.get(mt.c);
                if (!m1 || !m2 || !m3) continue;
               
                const mAngles = this.computeTriangleAngles(m1, m2, m3);
               
                const score = this.compareAngles(angles, mAngles);
                if (score > 0.9) {
                    matches++;
                    break;
                }
            }
        }
       
        return matches / Math.max(photoTriangles.length, modelTriangles.length);
    }

    computeTriangleAngles(a, b, c) {
        const ab = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
        const bc = Math.sqrt(Math.pow(b.x - c.x, 2) + Math.pow(b.y - c.y, 2));
        const ca = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
       
        const angleA = Math.acos((ab*ab + ca*ca - bc*bc) / (2 * ab * ca));
        const angleB = Math.acos((ab*ab + bc*bc - ca*ca) / (2 * ab * bc));
        const angleC = Math.acos((bc*bc + ca*ca - ab*ab) / (2 * bc * ca));
       
        return [angleA, angleB, angleC].sort((x,y) => x - y);
    }

    compareAngles(angles1, angles2) {
        let score = 0;
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(angles1[i] - angles2[i]);
            score += Math.max(0, 1 - diff / 0.5);
        }
        return score / 3;
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
       
        const score = this.morphologyEncoder.compare(pm, mm);
        // 🔥 ЗАЩИТА ОТ UNDEFINED
        return (score !== undefined && !isNaN(score)) ? score : 0.5;
    }

    getZone(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }

    getStats() {
        return {
            minLocalSimilarity: this.minLocalSimilarity,
            minMorphologySimilarity: this.minMorphologySimilarity,
            minConsistentPairs: this.minConsistentPairs,
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
