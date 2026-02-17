// modules/footprint/topology/RelativePositioning.js
// 🔥 ОТНОСИТЕЛЬНАЯ ПРИВЯЗКА - с взаимной проверкой кандидатов

class RelativePositioning {
    constructor(options = {}) {
    this.debug = options.debug || false;
    this.localGroupSignature = options.localGroupSignature;
    this.minPathSimilarity = options.minPathSimilarity || 0.5;
    this.maxPathLengthDiff = options.maxPathLengthDiff || 3;
    this.confidenceThreshold = options.confidenceThreshold || 0.8; // 🔥 80% вместо 70%
   
    console.log('🧩 RelativePositioning создан');
    console.log(`   Порог уверенности: ${this.confidenceThreshold * 100}%`);
}

    // ==================== ОСНОВНОЙ МЕТОД ====================

    positionPoints(photoGraph, modelGraph, anchorMatches, photoMorphology, modelMorphology) {
        console.log(`\n🧩 Достраиваю точки относительно ${anchorMatches.size} опорных...`);

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

                // Сравниваем пути
                const score = this.comparePaths(
                    photoId,
                    photoPathInfo,
                    modelId,
                    modelPathInfo,
                    photoGraph,
                    modelGraph,
                    photoMorphology,
                    modelMorphology,
                    photoToModel,
                    modelToPhoto
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

            if (bestMatch && bestScore >= this.confidenceThreshold) {
                candidates.push({
                    photoId,
                    modelId: bestMatch.modelId,
                    score: bestScore,
                    photoNode,
                    pathInfo: photoPathInfo
                });
            } else if (bestMatch) {
                lowConfidence++;
            }
        }

        // 🔥 4. ВЗАИМНАЯ ПРОВЕРКА КАНДИДАТОВ
        // Создаём карты для двунаправленной проверки
        const photoToCandidate = new Map(); // photoId -> candidate
        const modelToCandidate = new Map(); // modelId -> candidate

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
            // Для этого кандидата смотрим, есть ли у его модели другие претенденты
            const competitors = modelToCandidate.get(cand.modelId) || [];
           
            if (competitors.length === 1) {
                // У модели только один претендент - проверяем взаимность
                mutualCandidates.push(cand);
            } else {
                // Конфликт - несколько точек хотят одну модель
                // Сортируем по уверенности и берём лучшего
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

        console.log(`   ✅ Сопоставлено: ${matched}/${totalPoints} точек (уверенность ≥${this.confidenceThreshold*100}%)`);
        console.log(`   ⚠️ Низкая уверенность/конфликты: ${lowConfidence} точек (кандидаты на новые)`);
        console.log(`   🎯 Всего в фото: ${photoGraph.nodes.size} точек`);
        console.log(`   🎯 Сопоставлено всего: ${photoToModel.size}/${photoGraph.nodes.size}`);

        return photoToModel;
    }

    // ==================== ИТЕРАТИВНАЯ СТАБИЛИЗАЦИЯ ====================

    iterativeStabilization(photoGraph, modelGraph, initialAnchors, photoMorphology, modelMorphology) {
      console.time('🔄 iterative_total'); // ← добавить
        console.log(`\n🔄 ИТЕРАТИВНАЯ СТАБИЛИЗАЦИЯ ТОЧЕК...`);
       
        let currentAnchors = new Map(initialAnchors); // текущие якоря
        let allMatches = new Map(initialAnchors); // все найденные соответствия
        let iteration = 0;
        let newAnchorsAdded = 0;
       
        // Для обратного отображения
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
           
            // 1. Сначала вычисляем расстояния для всех точек фото
            const photoCandidates = [];
           
            for (const [photoId, photoNode] of photoGraph.nodes) {
                if (allMatches.has(photoId)) continue; // уже сопоставлена
               
                // Находим 5 ближайших якорей для этой точки
                const nearestAnchors = this.findNearestAnchors(photoNode, anchorPositions, 5);
                if (nearestAnchors.length < 3) continue;
               
                // Берём 3 ближайших
                const top3 = nearestAnchors.slice(0, 3);
               
                // Вычисляем расстояния до этих 3 якорей
                const photoDists = top3.map(a =>
                    this.graphDistance(photoId, a.id, photoGraph)
                );
               
                if (photoDists.includes(Infinity)) continue;
               
                photoCandidates.push({
                    photoId,
                    photoNode,
                    anchors: top3,
                    photoDists
                });
            }
           
            console.log(`\n📋 ТАБЛИЦА СТАБИЛИЗАЦИИ (итерация ${iteration}):`);
            console.log(`┌─────┬──────────────────────┬─────────────────────┬──────────────────────┬─────────────────────┐`);
            console.log(`│  #  │   ТОЧКА В ФОТО 2      │   БЛИЖАЙШИЕ ЯКОРЯ   │   ТОЧКА В МОДЕЛИ      │   КООРД. ФОТО 2     │`);
            console.log(`│     │                      │   (расстояния)      │                      │                     │`);
            console.log(`├─────┼──────────────────────┼─────────────────────┼──────────────────────┼─────────────────────┤`);
           
            let count = 0;
            const candidates = [];
           
            // Для каждого кандидата ищем соответствие в модели
            for (const cand of photoCandidates) {
                const { photoId, photoNode, anchors, photoDists } = cand;
               
                // Ищем точку в модели с похожими расстояниями до тех же якорей
                let bestMatch = null;
                let bestScore = 0;
               
                for (const [modelId, modelNode] of modelGraph.nodes) {
                    if (modelToPhoto.has(modelId)) continue; // уже занято
                   
                    // Вычисляем расстояния от точки модели до тех же якорей
                    const modelDists = anchors.map(a =>
                        this.graphDistance(modelId, currentAnchors.get(a.id).modelId, modelGraph)
                    );
                   
                    if (modelDists.includes(Infinity)) continue;
                   
                    // Сравниваем расстояния
                    let totalDiff = 0;
                    for (let i = 0; i < 3; i++) {
                        totalDiff += Math.abs(photoDists[i] - modelDists[i]);
                    }
                   
                    const score = Math.max(0, 1 - totalDiff / 6); // допуск до 2 шагов на якорь
                   
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
                        anchors: anchors.map(a => a.id.substring(0,6)).join(',')
                    });
                }
            }
           
            // 🔥 ВЗАИМНАЯ ПРОВЕРКА ДЛЯ ИТЕРАТИВНОЙ СТАБИЛИЗАЦИИ
            candidates.sort((a, b) => b.score - a.score);
           
            // Создаём карты для проверки
            const iterPhotoToCandidate = new Map();
            const iterModelToCandidate = new Map();
           
            for (const cand of candidates) {
                iterPhotoToCandidate.set(cand.photoId, cand);
                if (!iterModelToCandidate.has(cand.modelId)) {
                    iterModelToCandidate.set(cand.modelId, []);
                }
                iterModelToCandidate.get(cand.modelId).push(cand);
            }
           
            // Выбираем лучших
            const usedModelIds = new Set();
            const selectedCandidates = [];
           
            for (const cand of candidates) {
                if (usedModelIds.has(cand.modelId)) continue;
               
                const competitors = iterModelToCandidate.get(cand.modelId) || [];
                competitors.sort((a, b) => b.score - a.score);
                const best = competitors[0];
               
                usedModelIds.add(best.modelId);
                selectedCandidates.push(best);
            }
           
            // Добавляем выбранных кандидатов
            for (const cand of selectedCandidates) {
                if (count >= 20) break;
                count++;
               
                const modelNode = modelGraph.nodes.get(cand.modelId);
                if (!modelNode) continue;
               
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
               
                console.log(
                    `│ ${count.toString().padEnd(3)} │ ${cand.photoId.substring(0,20).padEnd(20)} │ ` +
                    `${cand.anchors.padEnd(19)} │ ` +
                    `${cand.modelId.substring(0,20).padEnd(20)} │ ` +
                    `(${cand.photoNode.x.toFixed(1).padStart(6)}, ${cand.photoNode.y.toFixed(1).padStart(6)}) │`
                );
            }
           
            console.log(`└─────┴──────────────────────┴─────────────────────┴──────────────────────┴─────────────────────┘`);
            console.log(`\n📊 Итерация ${iteration}: добавлено ${newAnchorsAdded} новых якорей`);
           
        } while (newAnchorsAdded > 0 && currentAnchors.size < photoGraph.nodes.size);
       
        console.log(`\n🎯 ИТОГ ИТЕРАТИВНОЙ СТАБИЛИЗАЦИИ:`);
        console.log(`   Всего стабилизировано: ${currentAnchors.size} точек`);
        console.log(`   Выполнено итераций: ${iteration}`);
       
        return allMatches;
      console.timeEnd('🔄 iterative_total'); // ← добавить
    }

    // ==================== ПОИСК БЛИЖАЙШИХ ЯКОРЕЙ ====================

    findNearestAnchors(point, anchors, count) {
        const distances = anchors.map(anchor => {
            const dx = point.x - anchor.x;
            const dy = point.y - anchor.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            return {
                ...anchor,
                distance: dist
            };
        });
       
        return distances
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count);
    }

    // ==================== ВЫЧИСЛЕНИЕ ПУТЕЙ ====================

    computePathsFromAnchor(anchorId, graph) {
        const paths = new Map();
        paths.set(anchorId, { dist: 0, signature: 'S' });
       
        const queue = [{ id: anchorId, path: [anchorId], dist: 0 }];
        const visited = new Set([anchorId]);
       
        while (queue.length > 0) {
            const { id, path, dist } = queue.shift();
           
            const neighbors = this.findNodeNeighbors(id, graph);
           
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    const newPath = [...path, neighbor.id];
                    const newDist = dist + 1;
                   
                    const signature = this.computePathSignature(newPath, graph);
                   
                    paths.set(neighbor.id, {
                        dist: newDist,
                        signature: signature,
                        path: newPath
                    });
                   
                    queue.push({
                        id: neighbor.id,
                        path: newPath,
                        dist: newDist
                    });
                }
            }
        }
       
        return paths;
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

    // ==================== СРАВНЕНИЕ ПУТЕЙ ====================

    comparePaths(photoId, photoPathInfo, modelId, modelPathInfo, photoGraph, modelGraph, photoMorphology, modelMorphology, photoToModel, modelToPhoto) {
        let distanceScore = 0;
        let pairCount = 0;
       
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
       
        let morphScore = 1.0;
        if (photoMorphology && modelMorphology) {
            const photoMorph = photoMorphology.get(photoId);
            const modelMorph = modelMorphology.get(modelId);
           
            if (photoMorph && modelMorph && photoMorph.hasContour && modelMorph.hasContour) {
                morphScore = this.compareMorphology(photoMorph, modelMorph);
            }
        }
       
        const totalScore = distanceScore * 0.4 + pathScore * 0.3 + lengthScore * 0.1 + morphScore * 0.2;
       
        if (this.debug && totalScore > 0.7) {
            console.log(`      Сравнение ${photoId.substring(0,8)}... ↔ ${modelId.substring(0,8)}... = ${(totalScore*100).toFixed(0)}%`);
        }
       
        return totalScore;
    }

    compareMorphology(m1, m2) {
        if (!m1 || !m2) return 0.5;
       
        const aspectSim = 1 - Math.min(1, Math.abs(m1.aspectRatio - m2.aspectRatio) / 2);
        const compactSim = 1 - Math.min(1, Math.abs(m1.compactness - m2.compactness) / 5);
       
        return (aspectSim + compactSim) / 2;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

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
            confidenceThreshold: this.confidenceThreshold
        };
    }

    clear() {
        console.log('🧹 RelativePositioning очищен');
    }
}

module.exports = RelativePositioning;
