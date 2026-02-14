// modules/footprint/topology/AnchorPropagator.js
// 🔥 РАСПРОСТРАНЕНИЕ УВЕРЕННОСТИ ОТ ЯКОРЕЙ

class AnchorPropagator {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minAnchors = options.minAnchors || 3; // Минимум якорей для проверки
       
        console.log('⚓ AnchorPropagator создан');
        console.log(`   Минимальное число якорей для проверки: ${this.minAnchors}`);
    }
   
    propagate(photoGraph, modelGraph, anchors) {
        console.log(`\n🔗 Распространяю уверенность от ${anchors.length} якорей...`);
       
        const matches = new Map(); // photoId -> modelId
        const queue = [...anchors]; // Начинаем с якорей
       
        // Помечаем якоря как найденные
        for (const anchor of anchors) {
            matches.set(anchor.photoId, anchor.modelId);
        }
       
        if (this.debug) {
            console.log(`\n📋 Якоря (первые 5):`);
            anchors.slice(0, 5).forEach((a, i) => {
                console.log(`   ${i+1}. ${a.photoId.substring(0,12)}... ↔ ${a.modelId.substring(0,12)}... (${(a.confidence*100).toFixed(1)}%)`);
            });
        }
       
        let iteration = 0;
        let foundInIteration = 0;
       
        // BFS-распространение
        while (queue.length > 0) {
            const current = queue.shift();
            iteration++;
           
            // Находим соседей текущей точки в фото
            const photoNeighbors = this.findNeighbors(current.photoId, photoGraph);
           
            // Находим соседей соответствующей точки в модели
            const modelNeighbors = this.findNeighbors(current.modelId, modelGraph);
           
            if (this.debug && iteration <= 3) {
                console.log(`\n   🔄 Итерация ${iteration}: точка ${current.photoId.substring(0,12)}...`);
                console.log(`      Соседей в фото: ${photoNeighbors.length}, в модели: ${modelNeighbors.length}`);
            }
           
            foundInIteration = 0;
           
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
                    foundInIteration++;
                   
                    if (this.debug && foundInIteration <= 3) {
                        console.log(`      ✅ Найдено: ${photoNeighbor.id.substring(0,12)}... ↔ ${bestMatch.id.substring(0,12)}... (score: ${bestScore.toFixed(2)})`);
                    }
                }
            }
           
            if (this.debug && iteration <= 3) {
                console.log(`      Найдено в этой итерации: ${foundInIteration}`);
            }
        }
       
        console.log(`\n📊 ИТОГ: найдено ${matches.size} точек из ${photoGraph.nodes.size}`);
        console.log(`   Якорей: ${anchors.length}, распространено: ${matches.size - anchors.length}`);
       
        return matches;
    }
   
    checkViaAnchors(photoNode, modelNode, photoGraph, modelGraph, matches) {
        // Находим якоря, с которыми связана точка в фото
        const photoAnchors = this.findConnectedAnchors(photoNode.id, photoGraph, matches);
       
        // Создаем обратное отображение для поиска в модели
        const reverseMatches = new Map();
        for (const [photoId, modelId] of matches) {
            reverseMatches.set(modelId, photoId);
        }
       
        // Находим якоря, с которыми связана точка в модели
        const modelAnchors = this.findConnectedAnchors(modelNode.id, modelGraph, reverseMatches);
       
        if (photoAnchors.length < this.minAnchors || modelAnchors.length < this.minAnchors) {
            return 0;
        }
       
        // Считаем, сколько общих якорей (в смысле соответствия)
        let commonAnchors = 0;
        for (const photoAnchor of photoAnchors) {
            const modelAnchorId = matches.get(photoAnchor);
            if (modelAnchors.includes(modelAnchorId)) {
                commonAnchors++;
            }
        }
       
        const score = commonAnchors / Math.min(photoAnchors.length, modelAnchors.length);
        return score;
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
