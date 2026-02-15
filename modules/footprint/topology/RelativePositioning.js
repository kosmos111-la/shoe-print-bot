// modules/footprint/topology/RelativePositioning.js
// 🔥 ОТНОСИТЕЛЬНАЯ ПРИВЯЗКА - достраиваем точки относительно найденных соответствий

class RelativePositioning {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.localGroupSignature = options.localGroupSignature;
        this.minPathSimilarity = options.minPathSimilarity || 0.5;
        this.maxPathLengthDiff = options.maxPathLengthDiff || 3;
       
        console.log('🧩 RelativePositioning создан');
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

                if (score > bestScore && score >= this.minPathSimilarity) {
                    bestScore = score;
                    bestModelId = modelId;
                    bestMatch = {
                        modelId,
                        confidence: score,
                        pathInfo: photoPathInfo
                    };
                }
            }

            if (bestMatch) {
                photoToModel.set(photoId, {
                    modelId: bestMatch.modelId,
                    confidence: bestMatch.confidence,
                    source: 'relative'
                });
                modelToPhoto.set(bestMatch.modelId, photoId);
                matched++;
               
                if (this.debug && matched <= 5) {
                    console.log(`   ✅ Сопоставлено: ${photoId.substring(0,12)}... ↔ ${bestMatch.modelId.substring(0,12)}... (${(bestScore*100).toFixed(0)}%)`);
                }
            }
        }

        console.log(`   ✅ Сопоставлено: ${matched}/${totalPoints} точек`);
        console.log(`   🎯 Всего: ${photoToModel.size}/${photoGraph.nodes.size}`);

        return photoToModel;
    }

    // ==================== ВЫЧИСЛЕНИЕ ПУТЕЙ ====================

    computeAllPaths(graph, anchorIds) {
        const anchorSet = new Set(anchorIds);
        const paths = new Map(); // nodeId -> { distances, paths }

        // Для каждой опорной точки запускаем BFS
        for (const anchorId of anchorIds) {
            const distances = this.bfsDistances(anchorId, graph);
           
            for (const [nodeId, dist] of distances) {
                if (nodeId === anchorId) continue;
               
                if (!paths.has(nodeId)) {
                    paths.set(nodeId, {
                        toAnchors: [], // расстояния до каждой опорной точки
                        anchorPaths: new Map(), // пути
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

        // Для каждой точки находим путь к ближайшему якорю
        for (const [nodeId, info] of paths) {
            if (info.bestAnchor) {
                const path = this.findPath(info.bestAnchor, nodeId, graph);
                info.anchorPaths.set(info.bestAnchor, path);
                info.pathSignature = this.computePathSignature(path, graph);
                info.pathLength = path.length - 1; // количество шагов
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
       
        return [fromId]; // нет пути
    }

    computePathSignature(path, graph) {
        if (path.length < 2) return '';
       
        const signatures = [];
       
        for (let i = 0; i < path.length; i++) {
            const nodeId = path[i];
            const node = graph.nodes.get(nodeId);
            if (!node) continue;
           
            const neighbors = this.findNodeNeighbors(nodeId, graph);
            const role = this.getNodeRole(nodeId, neighbors, graph);
           
            signatures.push(role);
        }
       
        return signatures.join('→');
    }

    // ==================== СРАВНЕНИЕ ПУТЕЙ ====================

    comparePaths(photoId, photoPathInfo, modelId, modelPathInfo, photoGraph, modelGraph, photoMorphology, modelMorphology, photoToModel, modelToPhoto) {
        // 1. Сравниваем расстояния до опорных точек
        let distanceScore = 0;
        let pairCount = 0;
       
        for (const photoAnchor of photoPathInfo.toAnchors) {
            // Находим соответствующий якорь в модели
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
       
        // 2. Сравниваем подписи путей
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
       
        // 3. Сравниваем длину пути
        const lengthDiff = Math.abs(photoPathInfo.pathLength - modelPathInfo.pathLength);
        const lengthScore = lengthDiff <= this.maxPathLengthDiff ? 1.0 : 0.5;
       
        // 4. Морфология (если есть)
        let morphScore = 1.0;
        if (photoMorphology && modelMorphology) {
            const photoMorph = photoMorphology.get(photoId);
            const modelMorph = modelMorphology.get(modelId);
           
            if (photoMorph && modelMorph && photoMorph.hasContour && modelMorph.hasContour) {
                morphScore = this.compareMorphology(photoMorph, modelMorph);
            }
        }
       
        // Итоговый score
        const totalScore = distanceScore * 0.4 + pathScore * 0.3 + lengthScore * 0.1 + morphScore * 0.2;
       
        if (this.debug && totalScore > 0.8) {
            console.log(`      Сравнение ${photoId.substring(0,8)}... ↔ ${modelId.substring(0,8)}... = ${(totalScore*100).toFixed(0)}% (dist:${(distanceScore*100).toFixed(0)}% path:${(pathScore*100).toFixed(0)}% len:${lengthScore} morph:${(morphScore*100).toFixed(0)}%)`);
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
            maxPathLengthDiff: this.maxPathLengthDiff
        };
    }

    clear() {
        console.log('🧹 RelativePositioning очищен');
    }
}

module.exports = RelativePositioning;
