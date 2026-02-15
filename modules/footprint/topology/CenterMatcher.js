// modules/footprint/topology/CenterMatcher.js
// 🔥 ПОИСК ОБЩЕЙ ОБЛАСТИ (ЦЕНТР) - надёжные соответствия в центре следа

class CenterMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Пороги для отбора
        this.minLocalSimilarity = options.minLocalSimilarity || 0.7;  // мин. сходство локальных групп
        this.minMorphologySimilarity = options.minMorphologySimilarity || 0.8; // мин. сходство морфологии
        this.minConsistentPairs = options.minConsistentPairs || 3;    // сколько нужно для подтверждения
       
        // Компоненты
        this.localGroupSignature = options.localGroupSignature;
        this.morphologyEncoder = options.morphologyEncoder;
       
        // Результаты
        this.centerMatches = new Map(); // nodeId -> { modelId, confidence }
        this.consistencyGraph = new Map(); // граф согласованности
       
        console.log('🎯 CenterMatcher создан');
        console.log(`   Порог локальных групп: ${this.minLocalSimilarity * 100}%`);
        console.log(`   Порог морфологии: ${this.minMorphologySimilarity * 100}%`);
        console.log(`   Мин. согласованных пар: ${this.minConsistentPairs}`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    findCenterMatches(photoGraph, modelGraph, photoMorphology, modelMorphology) {
        console.log(`\n🔍 Ищу общую область (центр)...`);
       
        // 1. Собираем кандидатов по локальным группам
        const candidates = this.findCandidates(photoGraph, modelGraph, photoMorphology, modelMorphology);
       
        // 2. Строим граф согласованности
        this.buildConsistencyGraph(candidates, photoGraph, modelGraph);
       
        // 3. Находим максимальную клику (наиболее согласованный набор)
        const consistentMatches = this.findMaxConsistentSet();
       
        // 4. Фильтруем по зоне (только центр)
        const centerMatches = this.filterByZone(consistentMatches, photoGraph, modelGraph);
       
        console.log(`\n📊 ИТОГ ПОИСКА ЦЕНТРА:`);
        console.log(`   Кандидатов всего: ${candidates.length}`);
        console.log(`   Согласованных: ${consistentMatches.size}`);
        console.log(`   В центре: ${centerMatches.size}`);
       
        if (centerMatches.size >= this.minConsistentPairs) {
            console.log(`   ✅ Найдена общая область (${centerMatches.size} точек)`);
        } else {
            console.log(`   ⚠️ Недостаточно точек в центре (нужно ${this.minConsistentPairs})`);
        }
       
        this.centerMatches = centerMatches;
        return centerMatches;
    }

    // ==================== ПОИСК КАНДИДАТОВ ====================

    findCandidates(photoGraph, modelGraph, photoMorphology, modelMorphology) {
        const candidates = [];
       
        // Для каждой точки в фото
        for (const [photoId, photoNode] of photoGraph.nodes) {
            // Проверяем зону - нас интересует только центр
            if (!this.isCenterZone(photoNode)) continue;
           
            // Вычисляем локальную подпись для точки в фото
            const photoSignature = this.localGroupSignature.computeLocalSignature(
                photoId,
                photoGraph,
                photoMorphology
            );
           
            let bestMatch = null;
            let bestScore = 0;
           
            // Ищем похожую точку в модели
            for (const [modelId, modelNode] of modelGraph.nodes) {
                if (!this.isCenterZone(modelNode)) continue;
               
                const modelSignature = this.localGroupSignature.computeLocalSignature(
                    modelId,
                    modelGraph,
                    modelMorphology
                );
               
                // Сравниваем локальные группы
                const localScore = this.localGroupSignature.compareSignatures(
                    photoSignature,
                    modelSignature
                );
               
                if (localScore < this.minLocalSimilarity) continue;
               
                // Сравниваем морфологию (если есть)
                let morphScore = 1.0;
                if (photoMorphology && modelMorphology) {
                    const photoMorph = photoMorphology.get(photoId);
                    const modelMorph = modelMorphology.get(modelId);
                   
                    if (photoMorph && modelMorph && photoMorph.hasContour && modelMorph.hasContour) {
                        morphScore = this.morphologyEncoder.compare(photoMorph, modelMorph);
                        if (morphScore < this.minMorphologySimilarity) continue;
                    }
                }
               
                // Общий score
                const totalScore = (localScore * 0.6 + morphScore * 0.4);
               
                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestMatch = {
                        photoId,
                        modelId,
                        photoNode,
                        modelNode,
                        localScore,
                        morphScore,
                        totalScore
                    };
                }
            }
           
            if (bestMatch) {
                candidates.push(bestMatch);
            }
        }
       
        // Сортируем по убыванию score
        candidates.sort((a, b) => b.totalScore - a.totalScore);
       
        if (this.debug) {
            console.log(`\n📋 ТОП-5 КАНДИДАТОВ В ЦЕНТРЕ:`);
            candidates.slice(0, 5).forEach((c, i) => {
                console.log(`   ${i+1}. photo: ${c.photoId.substring(0,12)}... model: ${c.modelId.substring(0,12)}... score: ${(c.totalScore*100).toFixed(1)}% (local:${(c.localScore*100).toFixed(0)}% morph:${(c.morphScore*100).toFixed(0)}%)`);
            });
        }
       
        return candidates;
    }

    // ==================== ПРОВЕРКА СОГЛАСОВАННОСТИ ====================

    buildConsistencyGraph(candidates, photoGraph, modelGraph) {
        this.consistencyGraph.clear();
       
        // Для каждой пары кандидатов проверяем, согласованы ли они
        for (let i = 0; i < candidates.length; i++) {
            const a = candidates[i];
           
            for (let j = i + 1; j < candidates.length; j++) {
                const b = candidates[j];
               
                if (this.areConsistent(a, b, photoGraph, modelGraph)) {
                    // Добавляем связь в граф
                    if (!this.consistencyGraph.has(a.photoId)) {
                        this.consistencyGraph.set(a.photoId, new Set());
                    }
                    if (!this.consistencyGraph.has(b.photoId)) {
                        this.consistencyGraph.set(b.photoId, new Set());
                    }
                   
                    this.consistencyGraph.get(a.photoId).add(b.photoId);
                    this.consistencyGraph.get(b.photoId).add(a.photoId);
                }
            }
        }
       
        if (this.debug) {
            console.log(`\n🔗 Граф согласованности:`);
            console.log(`   Узлов: ${this.consistencyGraph.size}`);
            let edges = 0;
            for (const neighbors of this.consistencyGraph.values()) {
                edges += neighbors.size;
            }
            console.log(`   Связей: ${edges/2}`);
        }
    }

    areConsistent(matchA, matchB, photoGraph, modelGraph) {
        // Две пары согласованы, если расстояния между точками в фото и модели похожи
       
        const photoNodeA = matchA.photoNode;
        const photoNodeB = matchB.photoNode;
        const modelNodeA = matchA.modelNode;
        const modelNodeB = matchB.modelNode;
       
        // Расстояние в фото (в шагах по графу, не в пикселях!)
        const photoDist = this.graphDistance(photoNodeA.id, photoNodeB.id, photoGraph);
       
        // Расстояние в модели
        const modelDist = this.graphDistance(modelNodeA.id, modelNodeB.id, modelGraph);
       
        if (photoDist === Infinity || modelDist === Infinity) return false;
       
        // Нормализованное отношение расстояний
        const minDist = Math.min(photoDist, modelDist);
        const maxDist = Math.max(photoDist, modelDist);
        const ratio = minDist / maxDist;
       
        // Согласованы, если расстояния отличаются не более чем в 2 раза
        return ratio >= 0.3;  // было 0.5 (ещё мягче)
    }

    graphDistance(nodeA, nodeB, graph) {
        // BFS для поиска кратчайшего пути в рёбрах
        if (nodeA === nodeB) return 0;
       
        const queue = [{ id: nodeA, dist: 0 }];
        const visited = new Set([nodeA]);
       
        while (queue.length > 0) {
            const { id, dist } = queue.shift();
           
            const neighbors = this.findNodeNeighbors(id, graph);
           
            for (const neighbor of neighbors) {
                if (neighbor.id === nodeB) {
                    return dist + 1;
                }
               
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({ id: neighbor.id, dist: dist + 1 });
                }
            }
        }
       
        return Infinity; // нет пути
    }

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        if (!graph || !graph.edges) return neighbors;
       
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

    // ==================== ПОИСК МАКСИМАЛЬНОЙ КЛИКИ ====================

    findMaxConsistentSet() {
        if (this.consistencyGraph.size === 0) return new Map();
       
        // Жадный алгоритм: начинаем с узла с максимальной степенью
        let bestSet = new Set();
        const nodes = Array.from(this.consistencyGraph.keys());
       
        for (const startNode of nodes) {
            const candidate = this.growClique(startNode, new Set([startNode]));
            if (candidate.size > bestSet.size) {
                bestSet = candidate;
            }
        }
       
        // Преобразуем Set photoId в Map photoId -> modelId
        const result = new Map();
        for (const photoId of bestSet) {
            // Ищем соответствующий кандидат
            for (const [candPhotoId, neighbors] of this.consistencyGraph) {
                if (candPhotoId === photoId) {
                    // Нужно восстановить modelId
                    // Пока заглушка
                    break;
                }
            }
        }
       
        return result;
    }

    growClique(node, currentClique) {
        // Находим всех соседей, которые связаны со всеми в текущей клике
        const neighbors = Array.from(this.consistencyGraph.get(node) || []);
       
        for (const neighbor of neighbors) {
            // Проверяем, связан ли neighbor со всеми в currentClique
            let connectedToAll = true;
            for (const member of currentClique) {
                if (member === neighbor) continue;
                const memberNeighbors = this.consistencyGraph.get(member) || new Set();
                if (!memberNeighbors.has(neighbor)) {
                    connectedToAll = false;
                    break;
                }
            }
           
            if (connectedToAll && !currentClique.has(neighbor)) {
                currentClique.add(neighbor);
                this.growClique(neighbor, currentClique);
            }
        }
       
        return currentClique;
    }

    // ==================== ФИЛЬТРАЦИЯ ПО ЗОНЕ ====================

    filterByZone(matches, photoGraph, modelGraph) {
        const centerMatches = new Map();
       
        // Восстанавливаем полную информацию о matches
        // Пока заглушка - нужно передавать candidates
       
        return centerMatches;
    }

    isCenterZone(node) {
        const y = node.y;
        // Центр: между 200 и 350 пикселей
        return y >= 200 && y <= 350;
    }

    // ==================== ПОЛУЧЕНИЕ РЕЗУЛЬТАТОВ ====================

    getCenterPoints() {
        return this.centerMatches;
    }

    getConfidence(photoId) {
        const match = this.centerMatches.get(photoId);
        return match ? match.confidence : 0;
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            centerMatches: this.centerMatches.size,
            minLocalSimilarity: this.minLocalSimilarity,
            minMorphologySimilarity: this.minMorphologySimilarity,
            minConsistentPairs: this.minConsistentPairs
        };
    }

    clear() {
        this.centerMatches.clear();
        this.consistencyGraph.clear();
        console.log('🧹 CenterMatcher очищен');
    }
}

module.exports = CenterMatcher;
