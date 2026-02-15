// modules/footprint/topology/RelativePositioning.js
// 🔥 ОТНОСИТЕЛЬНАЯ ПРИВЯЗКА - достраиваем точки относительно центра

class RelativePositioning {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Компоненты
        this.localGroupSignature = options.localGroupSignature;
       
        // Пороги
        this.minPathSimilarity = options.minPathSimilarity || 0.7; // сходство путей
        this.maxPathLengthDiff = options.maxPathLengthDiff || 2;   // макс. разница в длине пути
       
        console.log('🧩 RelativePositioning создан');
        console.log(`   Мин. сходство путей: ${this.minPathSimilarity * 100}%`);
        console.log(`   Макс. разница длины: ${this.maxPathLengthDiff}`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    positionPoints(photoGraph, modelGraph, centerMatches, photoMorphology, modelMorphology) {
        console.log(`\n🧩 Достраиваю точки относительно центра (${centerMatches.size} опорных)...`);
       
        const photoToModel = new Map(); // photoId -> { modelId, confidence, path }
        const modelToPhoto = new Map(); // modelId -> photoId
       
        // Сначала добавляем опорные точки из центра
        for (const [photoId, match] of centerMatches) {
            photoToModel.set(photoId, {
                modelId: match.modelId,
                confidence: 1.0,
                source: 'center'
            });
            modelToPhoto.set(match.modelId, photoId);
        }
       
        // Находим все пути от опорных точек к остальным
        const photoPaths = this.computeAllPaths(photoGraph, Array.from(centerMatches.keys()));
        const modelPaths = this.computeAllPaths(modelGraph, Array.from(centerMatches.values()).map(m => m.modelId));
       
        // Пытаемся сопоставить остальные точки
        let matched = 0;
        let totalPoints = photoGraph.nodes.size - centerMatches.size;
       
        for (const [photoId, photoNode] of photoGraph.nodes) {
            if (photoToModel.has(photoId)) continue; // уже есть
           
            const photoPathInfo = photoPaths.get(photoId);
            if (!photoPathInfo) continue;
           
            let bestMatch = null;
            let bestScore = 0;
           
            for (const [modelId, modelNode] of modelGraph.nodes) {
                if (modelToPhoto.has(modelId)) continue; // уже занято
               
                const modelPathInfo = modelPaths.get(modelId);
                if (!modelPathInfo) continue;
               
                // Сравниваем пути от опорных точек
                const score = this.comparePaths(
                    photoPathInfo,
                    modelPathInfo,
                    photoGraph,
                    modelGraph,
                    photoMorphology,
                    modelMorphology
                );
               
                if (score > bestScore && score >= this.minPathSimilarity) {
                    bestScore = score;
                    bestMatch = modelId;
                }
            }
           
            if (bestMatch) {
                photoToModel.set(photoId, {
                    modelId: bestMatch,
                    confidence: bestScore,
                    source: 'relative',
                    pathInfo: photoPathInfo
                });
                modelToPhoto.set(bestMatch, photoId);
                matched++;
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
                        anchorPaths: new Map(), // пути (последовательности узлов)
                        bestAnchor: null,
                        bestDist: Infinity
                    });
                }
               
                const info = paths.get(nodeId);
                info.toAnchors.push({
                    anchorId,
                    distance: dist,
                    normalizedDist: dist / Math.max(...distances.values()) // нормализация
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
               
                // Вычисляем подпись пути
                info.pathSignature = this.computePathSignature(path, graph);
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
        // BFS для поиска кратчайшего пути
        const queue = [{ id: fromId, path: [fromId] }];
        const visited = new Set([fromId]);
       
        while (queue.length > 0) {
            const { id, path } = queue.shift();
           
            if (id === toId) return path;
           
            const neighbors = this.findNodeNeighbors(id, graph);
           
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({
                        id: neighbor.id,
                        path: [...path, neighbor.id]
                    });
                }
            }
        }
       
        return [fromId]; // нет пути, возвращаем только старт
    }

    computePathSignature(path, graph) {
        if (path.length < 2) return '';
       
        const signatures = [];
       
        for (let i = 0; i < path.length; i++) {
            const nodeId = path[i];
            const node = graph.nodes.get(nodeId);
            if (!node) continue;
           
            // Роль узла
            const neighbors = this.findNodeNeighbors(nodeId, graph);
            const role = this.getNodeRole(nodeId, neighbors, graph);
           
            signatures.push(role);
        }
       
        return signatures.join('→');
    }

    // ==================== СРАВНЕНИЕ ПУТЕЙ ====================

    comparePaths(photoPathInfo, modelPathInfo, photoGraph, modelGraph, photoMorphology, modelMorphology) {
        // 1. Сравниваем расстояния до опорных точек
        let distanceScore = 0;
        let pairCount = 0;
       
        for (const photoAnchor of photoPathInfo.toAnchors) {
            // Ищем соответствующий якорь в модели
            const modelAnchor = modelPathInfo.toAnchors.find(
                a => a.anchorId === photoAnchor.anchorId
            );
           
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
           
            // Сравниваем строки ролей
            const minLen = Math.min(photoPath.length, modelPath.length);
            let matches = 0;
            for (let i = 0; i < minLen; i++) {
                if (photoPath[i] === modelPath[i]) matches++;
            }
            pathScore = matches / Math.max(photoPath.length, modelPath.length);
        }
       
        // 3. Если есть морфология, используем её для подтверждения
        let morphScore = 1.0;
        if (photoMorphology && modelMorphology) {
            // Найдём ID точек (нужно передавать)
            // Пока заглушка
        }
       
        // Итоговый score
        return (distanceScore * 0.5 + pathScore * 0.3 + morphScore * 0.2);
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

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
