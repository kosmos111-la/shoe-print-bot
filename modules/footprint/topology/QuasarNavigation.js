// modules/footprint/topology/QuasarNavigation.js
// 🔥 КВАЗАРНАЯ НАВИГАЦИЯ - координаты относительно якорей

class QuasarNavigation {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minAnchors = options.minAnchors || 3;
        this.similarityThreshold = options.similarityThreshold || 0.95;
       
        console.log('🌌 QuasarNavigation создан');
        console.log(`   Минимальное число якорей: ${this.minAnchors}`);
        console.log(`   Порог сходства: ${this.similarityThreshold * 100}%`);
    }
   
    // ==================== ВЫЧИСЛЕНИЕ КООРДИНАТ ====================
   
    getCoordinates(point, anchors, graph) {
        const distances = [];
       
        for (const [photoId, modelId] of anchors) {
            const anchor = graph.nodes.get(photoId);
            if (!anchor) continue;
           
            const dist = Math.sqrt(
                Math.pow(point.x - anchor.x, 2) +
                Math.pow(point.y - anchor.y, 2)
            );
            distances.push({ modelId, dist, anchor });
        }
       
        if (distances.length < this.minAnchors) {
            if (this.debug) console.log(`   ⚠️ Недостаточно якорей: ${distances.length}/${this.minAnchors}`);
            return null;
        }
       
        // Нормализуем относительно максимального расстояния
        const maxDist = Math.max(...distances.map(d => d.dist));
        const coordinates = {};
        const rawDistances = {};
       
        for (const { modelId, dist } of distances) {
            coordinates[modelId] = maxDist > 0 ? dist / maxDist : 0;
            rawDistances[modelId] = dist;
        }
       
        return {
            normalized: coordinates,
            raw: rawDistances,
            maxDist,
            anchorCount: distances.length
        };
    }
   
    // ==================== СРАВНЕНИЕ ТОЧЕК ====================
   
    comparePoints(coords1, coords2) {
        if (!coords1 || !coords2) return 0;
       
        let totalDiff = 0;
        let count = 0;
        let maxDiff = 0;
       
        // Сравниваем нормализованные расстояния до каждого якоря
        for (const [modelId, val1] of Object.entries(coords1.normalized)) {
            const val2 = coords2.normalized[modelId];
            if (val2 === undefined) continue;
           
            const diff = Math.abs(val1 - val2);
            totalDiff += diff;
            maxDiff = Math.max(maxDiff, diff);
            count++;
        }
       
        if (count === 0) return 0;
       
        const avgDiff = totalDiff / count;
        const similarity = 1 - avgDiff; // 1 = идеально, 0 = совсем разные
       
        return {
            similarity,
            avgDiff,
            maxDiff,
            matchedAnchors: count
        };
    }
   
    // ==================== ПОИСК ТОЧКИ В МОДЕЛИ ====================
   
    findPointInModel(targetCoords, modelGraph, anchors) {
        let bestMatch = null;
        let bestResult = { similarity: 0, avgDiff: 1, maxDiff: 1, matchedAnchors: 0 };
       
        for (const [nodeId, node] of modelGraph.nodes) {
            // Вычисляем координаты точки модели
            const nodeCoords = this.getCoordinates(
                node,
                anchors.map(a => [a.photoId, a.modelId]),
                modelGraph
            );
           
            if (!nodeCoords) continue;
           
            const result = this.comparePoints(targetCoords, nodeCoords);
           
            if (result.similarity > bestResult.similarity) {
                bestResult = result;
                bestMatch = nodeId;
            }
        }
       
        return {
            nodeId: bestMatch,
            ...bestResult
        };
    }
   
    // ==================== ПРОВЕРКА КАНДИДАТА ====================
   
    verifyCandidate(photoNode, modelNode, photoGraph, modelGraph, anchors) {
        const photoCoords = this.getCoordinates(photoNode, anchors, photoGraph);
        const modelCoords = this.getCoordinates(modelNode, anchors, modelGraph);
       
        if (!photoCoords || !modelCoords) return 0;
       
        const result = this.comparePoints(photoCoords, modelCoords);
        return result.similarity;
    }
   
    // ==================== ПОИСК ПО ВСЕМ ТОЧКАМ ====================
   
    findAllMatches(photoGraph, modelGraph, anchors) {
        const matches = new Map();
        const anchorSet = new Set(anchors.map(a => a.photoId));
       
        // Для каждой точки в фото, которая не якорь
        for (const [photoId, photoNode] of photoGraph.nodes) {
            if (anchorSet.has(photoId)) continue;
           
            const photoCoords = this.getCoordinates(photoNode, anchors, photoGraph);
            if (!photoCoords) continue;
           
            const match = this.findPointInModel(photoCoords, modelGraph, anchors);
           
            if (match.similarity >= this.similarityThreshold) {
                matches.set(photoId, {
                    modelId: match.nodeId,
                    similarity: match.similarity,
                    avgDiff: match.avgDiff,
                    maxDiff: match.maxDiff
                });
               
                if (this.debug) {
                    console.log(`   ✅ Квазар: ${photoId.substring(0,12)}... ↔ ${match.nodeId.substring(0,12)}... (${(match.similarity*100).toFixed(1)}%)`);
                }
            }
        }
       
        return matches;
    }
   
    // ==================== СТАТИСТИКА ====================
   
    getStats() {
        return {
            minAnchors: this.minAnchors,
            similarityThreshold: this.similarityThreshold
        };
    }
}

module.exports = QuasarNavigation;
