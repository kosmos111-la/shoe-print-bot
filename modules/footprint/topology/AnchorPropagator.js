// modules/footprint/topology/AnchorPropagator.js
// 🔥 РАСПРОСТРАНЕНИЕ УВЕРЕННОСТИ ОТ ЯКОРЕЙ

class AnchorPropagator {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minAnchors = options.minAnchors || 3; // Минимум якорей для проверки
    }
    
    propagate(photoGraph, modelGraph, anchors) {
        console.log(`\n🔗 Распространяю уверенность от ${anchors.length} якорей...`);
        
        const matches = new Map(); // photoId -> modelId
        const queue = [...anchors]; // Начинаем с якорей
        
        // Помечаем якоря как найденные
        for (const anchor of anchors) {
            matches.set(anchor.photoId, anchor.modelId);
        }
        
        // BFS-распространение
        while (queue.length > 0) {
            const current = queue.shift();
            
            // Находим соседей текущей точки в фото
            const photoNeighbors = this.findNeighbors(current.photoId, photoGraph);
            
            // Находим соседей соответствующей точки в модели
            const modelNeighbors = this.findNeighbors(current.modelId, modelGraph);
            
            // Для каждого соседа в фото ищем соответствие в модели
            for (const photoNeighbor of photoNeighbors) {
                if (matches.has(photoNeighbor.id)) continue; // уже найдено
                
                let bestMatch = null;
                let bestScore = 0;
                
                for (const modelNeighbor of modelNeighbors) {
                    if (Array.from(matches.values()).includes(modelNeighbor.id)) continue;
                    
                    // Проверяем через связи с уже найденными якорями
                    const score = this.checkViaAnchors(
                        photoNeighbor, modelNeighbor,
                        photoGraph, modelGraph,
                        matches
                    );
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = modelNeighbor;
                    }
                }
                
                // Если нашли хорошее соответствие
                if (bestScore > 0.7) {
                    matches.set(photoNeighbor.id, bestMatch.id);
                    queue.push({
                        photoId: photoNeighbor.id,
                        modelId: bestMatch.id
                    });
                    
                    if (this.debug) {
                        console.log(`   ✅ Найдено: ${photoNeighbor.id.substring(0,12)}... ↔ ${bestMatch.id.substring(0,12)}... (score: ${bestScore.toFixed(2)})`);
                    }
                }
            }
        }
        
        console.log(`\n📊 ИТОГ: найдено ${matches.size} точек из ${photoGraph.nodes.size}`);
        return matches;
    }
    
    checkViaAnchors(photoNode, modelNode, photoGraph, modelGraph, matches) {
        // Находим общие якоря, с которыми связаны обе точки
        const photoAnchors = this.findConnectedAnchors(photoNode.id, photoGraph, matches);
        const modelAnchors = this.findConnectedAnchors(modelNode.id, modelGraph, 
            new Map(Array.from(matches.entries()).map(([p, m]) => [m, p]))
        );
        
        if (photoAnchors.length < this.minAnchors) return 0;
        
        // Считаем, сколько общих якорей
        let commonAnchors = 0;
        for (const photoAnchor of photoAnchors) {
            const modelAnchorId = matches.get(photoAnchor);
            if (modelAnchors.includes(modelAnchorId)) {
                commonAnchors++;
            }
        }
        
        return commonAnchors / Math.max(photoAnchors.length, modelAnchors.length);
    }
    
    findConnectedAnchors(nodeId, graph, matches) {
        const anchors = [];
        const neighbors = this.findNeighbors(nodeId, graph);
        
        for (const neighbor of neighbors) {
            if (matches.has(neighbor.id)) {
                anchors.push(neighbor.id);
            }
        }
        
        return anchors;
    }
    
    findNeighbors(nodeId, graph) {
        const neighbors = [];
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
}

module.exports = AnchorPropagator;
