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
        // 🔥 АБСОЛЮТНАЯ ЗАЩИТА: преобразуем anchors в массив
        const anchorsArray = Array.isArray(anchors) ? anchors : Array.from(anchors || []);
       
        const distances = [];
       
        // Проверяем, что anchorsArray - массив пар [photoId, modelId] или объектов
        for (const anchor of anchorsArray) {
            let photoId, modelId;
           
            // Поддерживаем разные форматы
            if (Array.isArray(anchor) && anchor.length >= 2) {
                [photoId, modelId] = anchor;
            } else if (anchor && typeof anchor === 'object') {
                photoId = anchor.photoId;
                modelId = anchor.modelId;
            } else {
                continue; // Пропускаем некорректные якоря
            }
           
            const anchorNode = graph.nodes.get(photoId);
            if (!anchorNode) continue;
           
            const dist = Math.sqrt(
                Math.pow(point.x - anchorNode.x, 2) +
                Math.pow(point.y - anchorNode.y, 2)
            );
            distances.push({ modelId, dist, anchorNode });
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
        if (!coords1 || !coords2) return { similarity: 0, avgDiff: 1, maxDiff: 1, matchedAnchors: 0 };
       
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
       
        if (count === 0) return { similarity: 0, avgDiff: 1, maxDiff: 1, matchedAnchors: 0 };
       
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
            const nodeCoords = this.getCoordinates(node, anchors, modelGraph);
           
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
        // 🔥 АБСОЛЮТНАЯ ЗАЩИТА: любой вход → массив
        let anchorsArray;
       
        if (!anchors) {
            console.log('⚠️ anchors is null/undefined');
            anchorsArray = [];
        } else if (Array.isArray(anchors)) {
            anchorsArray = anchors;
            if (this.debug) console.log(`✅ anchors уже массив, длина: ${anchorsArray.length}`);
        } else if (anchors && typeof anchors[Symbol.iterator] === 'function') {
            // Это итерируемый объект (Map, Set и т.д.)
            anchorsArray = Array.from(anchors);
            if (this.debug) console.log(`🔄 anchors преобразован из итератора в массив, длина: ${anchorsArray.length}`);
        } else {
            console.log(`⚠️ anchors неожиданный тип: ${typeof anchors}, пробую преобразовать`);
            try {
                anchorsArray = Array.from(anchors);
            } catch (e) {
                console.log(`❌ Не удалось преобразовать anchors: ${e.message}`);
                anchorsArray = [];
            }
        }
       
        // 🔥 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА
        if (anchorsArray.length > 0 && anchorsArray[0]) {
            const firstAnchor = anchorsArray[0];
            let photoId = firstAnchor.photoId || (Array.isArray(firstAnchor) ? firstAnchor[0] : null);
            let modelId = firstAnchor.modelId || (Array.isArray(firstAnchor) ? firstAnchor[1] : null);
           
            if (this.debug) {
                console.log(`   Пример якоря: photoId=${photoId?.substring(0, 12) || 'unknown'}, modelId=${modelId?.substring(0, 12) || 'unknown'}`);
            }
        }
       
        const matches = new Map();
        const anchorSet = new Set();
       
        // Строим Set photoId якорей
        for (const anchor of anchorsArray) {
            if (Array.isArray(anchor) && anchor.length >= 2) {
                anchorSet.add(anchor[0]);
            } else if (anchor && typeof anchor === 'object') {
                if (anchor.photoId) anchorSet.add(anchor.photoId);
            }
        }
       
        if (this.debug) console.log(`   AnchorSet содержит ${anchorSet.size} photoId`);
       
        // Для каждой точки в фото, которая не якорь
        for (const [photoId, photoNode] of photoGraph.nodes) {
            if (anchorSet.has(photoId)) continue;
           
            const photoCoords = this.getCoordinates(photoNode, anchorsArray, photoGraph);
            if (!photoCoords) continue;
           
            const match = this.findPointInModel(photoCoords, modelGraph, anchorsArray);
           
            if (match.similarity >= this.similarityThreshold) {
                matches.set(photoId, {
                    modelId: match.nodeId,
                    similarity: match.similarity,
                    avgDiff: match.avgDiff,
                    maxDiff: match.maxDiff
                });
               
                if (this.debug) {
                    console.log(`   ✅ Квазар: ${photoId.substring(0,12)}... ↔ ${match.nodeId?.substring(0,12)}... (${(match.similarity*100).toFixed(1)}%)`);
                }
            }
        }
       
        if (this.debug) console.log(`   🌌 Квазаром найдено всего: ${matches.size} точек`);
       
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
