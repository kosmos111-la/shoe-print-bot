// modules/footprint/topology/RelativePositioning.js
// 🔥 ОТНОСИТЕЛЬНАЯ ПРИВЯЗКА - с проверкой по инвариантным признакам

class RelativePositioning {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.localGroupSignature = options.localGroupSignature;
        this.minPathSimilarity = options.minPathSimilarity || 0.5;
        this.maxPathLengthDiff = options.maxPathLengthDiff || 3;
        this.confidenceThreshold = options.confidenceThreshold || 0.7;
       
        // 🔥 ДОПУСКИ ДЛЯ ПРОВЕРКИ ПО ПРИЗНАКАМ
        this.tolerances = {
            compactness: 0.4,
            eccentricity: 0.15,
            normalizedArea: 0.75,
            radialProfile: 0.3,
            degree: 2,
            role: 'soft'
        };
       
        console.log('🧩 RelativePositioning с проверкой по признакам создан');
        console.log(`   Порог уверенности: ${this.confidenceThreshold * 100}%`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    positionPoints(photoGraph, modelGraph, anchorMatches, photoMorphology, modelMorphology, options = {}) {
        const confidenceThreshold = options.confidenceThreshold || this.confidenceThreshold;
        console.log(`\n🧩 Достраиваю точки относительно ${anchorMatches.size} опорных...`);
        console.log(`   🔧 Порог уверенности: ${(confidenceThreshold * 100).toFixed(0)}%`);
        console.log(`   🔧 Проверка по признакам: включена`);

        const photoToModel = new Map(); // photoId -> { modelId, confidence, path }
        const modelToPhoto = new Map(); // modelId -> photoId

        // 🔥 1. Сначала добавляем опорные точки (якоря)
        for (const [photoId, match] of anchorMatches) {
            photoToModel.set(photoId, {
                modelId: match.modelId,
                confidence: 1.0,
                source: 'anchor'
            });
            modelToPhoto.set(match.modelId, photoId);
        }

        // 🔥 2. Вычисляем пути от опорных точек ко всем остальным
        const anchorIds = Array.from(anchorMatches.keys());
        const modelAnchorIds = Array.from(anchorMatches.values()).map(m => m.modelId);
       
        const photoPaths = this.computeAllPaths(photoGraph, anchorIds);
        const modelPaths = this.computeAllPaths(modelGraph, modelAnchorIds);

        // 🔥 3. Пытаемся сопоставить остальные точки
        let matched = 0;
        let lowConfidence = 0;
        let totalPoints = photoGraph.nodes.size - anchorMatches.size;

        // Сортируем точки по расстоянию от ближайшего якоря (ближайшие сначала)
        const photoNodes = Array.from(photoGraph.nodes.entries())
            .filter(([id]) => !photoToModel.has(id))
            .map(([id, node]) => {
                const pathInfo = photoPaths.get(id);
                return {
                    id,
                    node,
                    minDist: pathInfo ? pathInfo.bestDist : Infinity
                };
            })
            .sort((a, b) => a.minDist - b.minDist);

        // 🔥 Временное хранилище кандидатов
        const candidates = [];

        for (const { id: photoId, node: photoNode, minDist } of photoNodes) {
            if (minDist === Infinity) {
                if (this.debug) console.log(`   ⚠️ Точка ${photoId.substring(0,12)}... недостижима от якорей`);
                continue;
            }

            const photoPathInfo = photoPaths.get(photoId);
            if (!photoPathInfo) continue;

            let bestMatch = null;
            let bestScore = 0;
            let bestModelId = null;

            // Ищем среди всех точек модели, которые ещё не сопоставлены
            for (const [modelId, modelNode] of modelGraph.nodes) {
                if (modelToPhoto.has(modelId)) continue; // уже занято

                const modelPathInfo = modelPaths.get(modelId);
                if (!modelPathInfo) continue;

                // Сравниваем пути и признаки
                const score = this.comparePathsWithFeatures(
                    photoId, photoNode,
                    photoPathInfo,
                    modelId, modelNode,
                    modelPathInfo,
                    photoGraph, modelGraph,
                    photoMorphology, modelMorphology,
                    photoToModel, modelToPhoto
                );

                if (score > bestScore) {
                    bestScore = score;
                    bestModelId = modelId;
                    bestMatch = {
                        modelId,
                        confidence: score,
                        pathInfo: photoPathInfo
                    };
                }
            }

            if (bestMatch && bestScore >= confidenceThreshold) {
                candidates.push({
                    photoId,
                    modelId: bestMatch.modelId,
                    score: bestScore,
                    photoNode,
                    pathInfo: photoPathInfo
                });
            } else if (bestMatch) {
                lowConfidence++;
                if (this.debug && lowConfidence <= 5) {
                    console.log(`   ⚠️ Низкая уверенность: ${photoId.slice(0,12)}... ↔ ${bestMatch.modelId.slice(0,12)}... (${(bestScore*100).toFixed(0)}%)`);
                }
            }
        }

        // 🔥 4. ВЗАИМНАЯ ПРОВЕРКА КАНДИДАТОВ
        const photoToCandidate = new Map();
        const modelToCandidate = new Map();

        // Сначала собираем всех кандидатов
        for (const cand of candidates) {
            photoToCandidate.set(cand.photoId, cand);
           
            if (!modelToCandidate.has(cand.modelId)) {
                modelToCandidate.set(cand.modelId, []);
            }
            modelToCandidate.get(cand.modelId).push(cand);
        }

        // Проверяем взаимность
        const mutualCandidates = [];
        const conflictCandidates = [];

        for (const cand of candidates) {
            const competitors = modelToCandidate.get(cand.modelId) || [];
           
            if (competitors.length === 1) {
                mutualCandidates.push(cand);
            } else {
                competitors.sort((a, b) => b.score - a.score);
                const best = competitors[0];
               
                if (!conflictCandidates.includes(best)) {
                    conflictCandidates.push(best);
                }
            }
        }

        // 🔥 5. НАЗНАЧАЕМ ТОЛЬКО ВЗАИМНО ПРОВЕРЕННЫЕ
        const usedModelIds = new Set();
        const finalCandidates = [];

        // Сначала назначаем mutual (они безопаснее)
        for (const cand of mutualCandidates) {
            if (!usedModelIds.has(cand.modelId)) {
                usedModelIds.add(cand.modelId);
                finalCandidates.push(cand);
            }
        }

        // Потом назначаем лучших из конфликтующих
        for (const cand of conflictCandidates) {
            if (!usedModelIds.has(cand.modelId)) {
                usedModelIds.add(cand.modelId);
                finalCandidates.push(cand);
            }
        }

        // Назначаем финальных кандидатов
        for (const cand of finalCandidates) {
            photoToModel.set(cand.photoId, {
                modelId: cand.modelId,
                confidence: cand.score,
                source: 'relative'
            });
            modelToPhoto.set(cand.modelId, cand.photoId);
            matched++;
           
            if (this.debug && matched <= 5) {
                console.log(`   ✅ Сопоставлено: ${cand.photoId.substring(0,12)}... ↔ ${cand.modelId.substring(0,12)}... (${(cand.score*100).toFixed(0)}%)`);
            }
        }

        console.log(`   ✅ Сопоставлено: ${matched}/${totalPoints} точек (уверенность ≥${(confidenceThreshold*100).toFixed(0)}%)`);
        console.log(`   ⚠️ Низкая уверенность/конфликты: ${lowConfidence} точек (кандидаты на новые)`);
        console.log(`   🎯 Всего в фото: ${photoGraph.nodes.size} точек`);
        console.log(`   🎯 Сопоставлено всего: ${photoToModel.size}/${photoGraph.nodes.size}`);

       // ===== ДЕДУПЛИКАЦИЯ: каждая точка модели получает максимум +1 =====
const uniqueByModelId = new Map();
for (const [photoId, match] of photoToModel) {
    const existing = uniqueByModelId.get(match.modelId);
    if (!existing || match.confidence > existing.confidence) {
        uniqueByModelId.set(match.modelId, { photoId, match });
    }
}

const deduplicatedMap = new Map();
for (const [modelId, { photoId, match }] of uniqueByModelId) {
    deduplicatedMap.set(photoId, match);
}
return deduplicatedMap;
    }

    /**
     * Сравнивает пути с учетом инвариантных признаков
     */
    comparePathsWithFeatures(photoId, photoNode, photoPathInfo,
                            modelId, modelNode, modelPathInfo,
                            photoGraph, modelGraph,
                            photoMorphology, modelMorphology,
                            photoToModel, modelToPhoto) {
       
        let distanceScore = 0;
        let pairCount = 0;
       
        // Сравнение расстояний до якорей
        for (const photoAnchor of photoPathInfo.toAnchors) {
            const photoAnchorId = photoAnchor.anchorId;
            const modelAnchorId = photoToModel.get(photoAnchorId)?.modelId;
           
            if (!modelAnchorId) continue;
           
            const modelAnchor = modelPathInfo.toAnchors.find(a => a.anchorId === modelAnchorId);
           
            if (modelAnchor) {
                const diff = Math.abs(photoAnchor.normalizedDist - modelAnchor.normalizedDist);
                const sim = Math.max(0, 1 - diff);
                distanceScore += sim;
                pairCount++;
            }
        }
       
        if (pairCount === 0) return 0;
        distanceScore /= pairCount;
       
        // Сравнение путей
        let pathScore = 0;
        if (photoPathInfo.pathSignature && modelPathInfo.pathSignature) {
            const photoPath = photoPathInfo.pathSignature;
            const modelPath = modelPathInfo.pathSignature;
           
            const minLen = Math.min(photoPath.length, modelPath.length);
            let matches = 0;
            for (let i = 0; i < minLen; i++) {
                if (photoPath[i] === modelPath[i]) matches++;
            }
            pathScore = matches / Math.max(photoPath.length, modelPath.length);
        }
       
        const lengthDiff = Math.abs(photoPathInfo.pathLength - modelPathInfo.pathLength);
        const lengthScore = lengthDiff <= this.maxPathLengthDiff ? 1.0 : 0.5;
       
        // 🔥 ПРОВЕРКА ПО ИНВАРИАНТНЫМ ПРИЗНАКАМ
        const morphScore = this.compareMorphologyWithTolerances(
            photoId, photoNode,
            modelId, modelNode,
            photoMorphology, modelMorphology
        );
       
        // Роли соседей
        const neighborRolesScore = this.compareNeighborRoles(
            photoId, modelId,
            photoGraph, modelGraph
        );
       
        // Комбинируем все оценки
        const totalScore = distanceScore * 0.3 +
                          pathScore * 0.2 +
                          lengthScore * 0.1 +
                          morphScore * 0.3 +
                          neighborRolesScore * 0.1;
       
       // if (this.debug && totalScore > 0.7 && totalScore < 0.8) {
       //     console.log(`      Сравнение ${photoId.slice(0,8)}... ↔ ${modelId.slice(0,8)}... = ${(totalScore*100).toFixed(0)}% (морфология: ${(morphScore*100).toFixed(0)}%)`);
       // }
       
        return totalScore;
    }

    /**
     * Сравнивает морфологию с допусками
     */
    compareMorphologyWithTolerances(photoId, photoNode, modelId, modelNode, photoMorphology, modelMorphology) {
        const photoMorph = photoMorphology.get(photoId);
        const modelMorph = modelMorphology.get(modelId);
       
        if (!photoMorph || !modelMorph || !photoMorph.hasContour || !modelMorph.hasContour) {
            return 0.5;
        }
       
        let score = 0;
        let checks = 0;
       
        // Компактность
        if (photoMorph.compactness && modelMorph.compactness) {
            const ratio = Math.min(photoMorph.compactness, modelMorph.compactness) /
                         Math.max(photoMorph.compactness, modelMorph.compactness);
            if (ratio >= 1 - this.tolerances.compactness) {
                score += ratio;
                checks++;
            }
        }
       
        // Эксцентриситет
        if (photoMorph.eccentricity && modelMorph.eccentricity) {
            const diff = Math.abs(photoMorph.eccentricity - modelMorph.eccentricity);
            if (diff <= this.tolerances.eccentricity) {
                score += 1 - diff;
                checks++;
            }
        }
       
        // Площадь
        if (photoMorph.normalizedArea && modelMorph.normalizedArea) {
            const ratio = Math.min(photoMorph.normalizedArea, modelMorph.normalizedArea) /
                         Math.max(photoMorph.normalizedArea, modelMorph.normalizedArea);
            if (ratio >= 1 - this.tolerances.normalizedArea) {
                score += ratio;
                checks++;
            }
        }
       
        // Радиальный профиль
        if (photoMorph.radialProfile && modelMorph.radialProfile) {
            let sum = 0;
            const len = Math.min(photoMorph.radialProfile.length, modelMorph.radialProfile.length);
            for (let i = 0; i < len; i++) {
                sum += 1 - Math.min(Math.abs(photoMorph.radialProfile[i] - modelMorph.radialProfile[i]), 1);
            }
            const profileSim = sum / len;
            if (profileSim >= 1 - this.tolerances.radialProfile) {
                score += profileSim;
                checks++;
            }
        }
       
        return checks > 0 ? score / checks : 0.5;
    }

    /**
     * Сравнивает роли соседей
     */
    compareNeighborRoles(photoId, modelId, photoGraph, modelGraph) {
        const photoNeighbors = this.findNodeNeighbors(photoId, photoGraph);
        const modelNeighbors = this.findNodeNeighbors(modelId, modelGraph);
       
        // Простое сравнение количества
        const diff = Math.abs(photoNeighbors.length - modelNeighbors.length);
        if (diff <= 2) {
            return 1 - (diff / 4);
        }
        return 0;
    }

    // ==================== ИТЕРАТИВНАЯ СТАБИЛИЗАЦИЯ ====================

    iterativeStabilization(photoGraph, modelGraph, initialAnchors, photoMorphology, modelMorphology, options = {}) {
    const updatedPointsThisPhoto = options.updatedPointsThisPhoto;
    console.log(`\n🔍 iterativeStabilization: НАЧАЛО`);
    const startTime = Date.now();  // ← ДОБАВИТЬ ЭТУ СТРОКУ!
   
    console.log(`\n🔄 ИТЕРАТИВНАЯ СТАБИЛИЗАЦИЯ ТОЧЕК...`);
   
    let currentAnchors = new Map(initialAnchors);
        let allMatches = new Map(initialAnchors);
        let iteration = 0;
        let newAnchorsAdded = 0;
       
        const modelToPhoto = new Map();
        for (const [photoId, match] of initialAnchors) {
            modelToPhoto.set(match.modelId, photoId);
        }
       
        console.log(`\n📊 Начальное состояние: ${currentAnchors.size} якорей`);
       
        do {
            iteration++;
            newAnchorsAdded = 0;
           
            console.log(`\n=== ИТЕРАЦИЯ ${iteration} ===`);
           
            // Создаём пространственный индекс для быстрого поиска ближайших якорей
            const anchorPositions = [];
            for (const [photoId, match] of currentAnchors) {
                const node = photoGraph.nodes.get(photoId);
                if (node) {
                    anchorPositions.push({
                        id: photoId,
                        modelId: match.modelId,
                        x: node.x,
                        y: node.y
                    });
                }
            }
           
            // Находим кандидатов
            const candidates = [];
           
            for (const [photoId, photoNode] of photoGraph.nodes) {
                if (allMatches.has(photoId)) continue;
               
                // Находим ближайшие якоря
                const nearestAnchors = this.findNearestAnchors(photoNode, anchorPositions, 5);
                if (nearestAnchors.length < 3) continue;
               
                const top3 = nearestAnchors.slice(0, 3);
               
                const photoDists = top3.map(a =>
                    this.graphDistance(photoId, a.id, photoGraph)
                );
               
                if (photoDists.includes(Infinity)) continue;
               
                // Ищем соответствие в модели
                let bestMatch = null;
                let bestScore = 0;
               
                for (const [modelId, modelNode] of modelGraph.nodes) {
                    if (modelToPhoto.has(modelId)) continue;
                   
                    const modelDists = top3.map(a =>
                        this.graphDistance(modelId, currentAnchors.get(a.id).modelId, modelGraph)
                    );
                   
                    if (modelDists.includes(Infinity)) continue;
                   
                    // Сравниваем расстояния
                    let totalDiff = 0;
                    for (let i = 0; i < 3; i++) {
                        totalDiff += Math.abs(photoDists[i] - modelDists[i]);
                    }
                   
                    const baseScore = Math.max(0, 1 - totalDiff / 6);
                   
                    // Проверяем морфологию
                    const morphScore = this.compareMorphologyWithTolerances(
                        photoId, photoNode,
                        modelId, modelNode,
                        photoMorphology, modelMorphology
                    );
                   
                    const score = baseScore * 0.6 + morphScore * 0.4;
                   
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = modelId;
                    }
                }
               
                if (bestMatch && bestScore > 0.7) {
    candidates.push({
        photoId,
        modelId: bestMatch,
        score: bestScore,
        photoNode,
        anchors: top3.map(a => a.id.substring(0,6)).join(',')
    });
}
            }
           
            // Взаимная проверка
            const photoToCandidate = new Map();
            const modelToCandidate = new Map();
           
            for (const cand of candidates) {
                photoToCandidate.set(cand.photoId, cand);
                if (!modelToCandidate.has(cand.modelId)) {
                    modelToCandidate.set(cand.modelId, []);
                }
                modelToCandidate.get(cand.modelId).push(cand);
            }
           
            // Выбираем лучших
            const usedModelIds = new Set();
            const selectedCandidates = [];
           
            for (const cand of candidates) {
                if (usedModelIds.has(cand.modelId)) continue;
               
                const competitors = modelToCandidate.get(cand.modelId) || [];
                competitors.sort((a, b) => b.score - a.score);
                const best = competitors[0];
               
                usedModelIds.add(best.modelId);
                selectedCandidates.push(best);
            }
           
            // ===== ДЕДУПЛИКАЦИЯ: каждая точка модели получает максимум +1 за итерацию =====
const uniqueByModelId = new Map(); // modelId -> best candidate
for (const cand of candidates) {
    const existing = uniqueByModelId.get(cand.modelId);
    if (!existing || cand.score > existing.score) {
        uniqueByModelId.set(cand.modelId, cand);
    }
}
const deduplicatedCandidates = Array.from(uniqueByModelId.values());

for (const cand of deduplicatedCandidates) {
    // 🔥 ПРОВЕРКА: не обновляли ли уже эту точку модели в текущем фото
    if (updatedPointsThisPhoto && updatedPointsThisPhoto.has(cand.modelId)) {
      //  if (this.debug) {
            console.log(`   ⏭️ Пропускаем повторное обновление точки модели ${cand.modelId.substring(0,12)} (уже обновлена в этом фото)`);
     //   }
        continue;
    }

    // Добавляем в Set, чтобы не обновить повторно
    if (updatedPointsThisPhoto) {
        updatedPointsThisPhoto.add(cand.modelId);
    }

    allMatches.set(cand.photoId, {
        modelId: cand.modelId,
        confidence: cand.score,
        source: 'iterative'
    });

    currentAnchors.set(cand.photoId, {
        modelId: cand.modelId,
        confidence: cand.score
    });

    modelToPhoto.set(cand.modelId, cand.photoId);
    newAnchorsAdded++;
}
           
            console.log(`📊 Итерация ${iteration}: добавлено ${newAnchorsAdded} новых якорей`);
           
        } while (newAnchorsAdded > 0 && currentAnchors.size < photoGraph.nodes.size);
       
        console.log(`\n🎯 ИТОГ ИТЕРАТИВНОЙ СТАБИЛИЗАЦИИ:`);
        console.log(`   Всего стабилизировано: ${currentAnchors.size} точек`);
        console.log(`   Выполнено итераций: ${iteration}`);

        // ===== ФИНАЛЬНАЯ ДЕДУПЛИКАЦИЯ МЕЖДУ ИТЕРАЦИЯМИ =====
        const finalUniqueByModelId = new Map();
        for (const [photoId, match] of allMatches) {
            const existing = finalUniqueByModelId.get(match.modelId);
            if (!existing || match.confidence > existing.confidence) {
                finalUniqueByModelId.set(match.modelId, { photoId, match });
            }
        }

        const deduplicatedAllMatches = new Map();
        for (const [modelId, { photoId, match }] of finalUniqueByModelId) {
            deduplicatedAllMatches.set(photoId, match);
        }

        if (this.debug && allMatches.size !== deduplicatedAllMatches.size) {
            console.log(`   🔧 Финальная дедупликация iterativeStabilization: ${allMatches.size} → ${deduplicatedAllMatches.size}`);
        }

    // В конце метода, перед return:
    console.log(`\n🔍 iterativeStabilization: КОНЕЦ, время ${Date.now() - startTime}ms`);
    return deduplicatedAllMatches;
}

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

    findNearestAnchors(point, anchors, count) {
        const distances = anchors.map(anchor => {
            const dx = point.x - anchor.x;
            const dy = point.y - anchor.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            return { ...anchor, distance: dist };
        });
       
        return distances
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count);
    }

    computeAllPaths(graph, anchorIds) {
        const anchorSet = new Set(anchorIds);
        const paths = new Map();

        for (const anchorId of anchorIds) {
            const distances = this.bfsDistances(anchorId, graph);
           
            for (const [nodeId, dist] of distances) {
                if (nodeId === anchorId) continue;
               
                if (!paths.has(nodeId)) {
                    paths.set(nodeId, {
                        toAnchors: [],
                        anchorPaths: new Map(),
                        bestAnchor: null,
                        bestDist: Infinity
                    });
                }
               
                const info = paths.get(nodeId);
                info.toAnchors.push({
                    anchorId,
                    distance: dist,
                    normalizedDist: dist / (Math.max(...distances.values()) || 1)
                });
               
                if (dist < info.bestDist) {
                    info.bestDist = dist;
                    info.bestAnchor = anchorId;
                }
            }
        }

        for (const [nodeId, info] of paths) {
            if (info.bestAnchor) {
                const path = this.findPath(info.bestAnchor, nodeId, graph);
                info.anchorPaths.set(info.bestAnchor, path);
                info.pathSignature = this.computePathSignature(path, graph);
                info.pathLength = path.length - 1;
            }
        }

        return paths;
    }

    bfsDistances(startId, graph) {
        const distances = new Map();
        const queue = [{ id: startId, dist: 0 }];
        const visited = new Set([startId]);
       
        distances.set(startId, 0);
       
        while (queue.length > 0) {
            const { id, dist } = queue.shift();
           
            const neighbors = this.findNodeNeighbors(id, graph);
           
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    const newDist = dist + 1;
                    distances.set(neighbor.id, newDist);
                    queue.push({ id: neighbor.id, dist: newDist });
                }
            }
        }
       
        return distances;
    }

    findPath(fromId, toId, graph) {
        if (fromId === toId) return [fromId];
       
        const queue = [{ id: fromId, path: [fromId] }];
        const visited = new Set([fromId]);
       
        while (queue.length > 0) {
            const { id, path } = queue.shift();
           
            const neighbors = this.findNodeNeighbors(id, graph);
           
            for (const neighbor of neighbors) {
                if (neighbor.id === toId) {
                    return [...path, neighbor.id];
                }
               
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({
                        id: neighbor.id,
                        path: [...path, neighbor.id]
                    });
                }
            }
        }
       
        return [fromId];
    }

    computePathSignature(path, graph) {
        if (path.length < 2) return 'S';
       
        const roles = [];
       
        for (let i = 0; i < path.length; i++) {
            const nodeId = path[i];
            const node = graph.nodes.get(nodeId);
            if (!node) continue;
           
            const neighbors = this.findNodeNeighbors(nodeId, graph);
            const role = this.getNodeRole(nodeId, neighbors, graph);
           
            roles.push(role);
        }
       
        return roles.join('');
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

    getNodeRole(nodeId, neighbors, graph) {
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

    areConnected(aId, bId, graph) {
        const edgeId = [aId, bId].sort().join('--');
        return graph.edges.has(edgeId);
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            minPathSimilarity: this.minPathSimilarity,
            maxPathLengthDiff: this.maxPathLengthDiff,
            confidenceThreshold: this.confidenceThreshold,
            tolerances: this.tolerances
        };
    }

    clear() {
        console.log('🧹 RelativePositioning очищен');
    }
}

module.exports = RelativePositioning;
