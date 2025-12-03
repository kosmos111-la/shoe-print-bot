// modules/footprint/digital-footprint.js
const crypto = require('crypto');

class DigitalFootprint {
    constructor(options = {}) {
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.name = options.name || `Модель_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;
        this.sessionId = options.sessionId || null;
       
        // Основные данные модели
        this.nodes = new Map();          // nodeId -> Node
        this.edges = [];                 // Связи между узлами
        this.metadata = options.metadata || {
            estimatedSize: null,
            footprintType: 'unknown',
            orientation: 0,
            brand: null,
            model: null
        };
       
        // Статистика
        this.stats = {
            totalSources: 0,             // Сколько фото/сессий внесли вклад
            confirmationCount: 0,        // Сколько раз модель подтверждалась
            lastUpdated: new Date(),
            created: new Date(),
            confidence: 0.3,             // Общая уверенность в модели (0-1)
        };
       
        // Производительность
        this.hash = null;               // Быстрый хеш для сравнения
        this.boundingBox = null;        // Ограничивающая рамка
        this.featureVector = null;      // Вектор признаков для быстрого поиска
    }

    // ОСНОВНОЙ МЕТОД: добавить данные из анализа
    addAnalysis(analysis, sourceInfo = {}) {addAnalysis(analysis, sourceInfo = {}) {
    const { predictions, timestamp, imagePath } = analysis;
    const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];
    const contours = predictions?.filter(p => p.class === 'Outline-trail') || [];
    const heels = predictions?.filter(p => p.class === 'Heel') || [];
   
    console.log(`🔍 Добавляю ${protectors.length} протекторов, ${contours.length} контуров из анализа`);
   
    // Сохраняем контуры и каблуки в sourceInfo
    const enhancedSourceInfo = {
        ...sourceInfo,
        imagePath: imagePath || sourceInfo.imagePath,
        contours: contours.map(c => ({ points: c.points })),
        heels: heels.map(h => ({ points: h.points })),
        timestamp: timestamp || new Date()
    };
   
    // Для каждого протектора
    protectors.forEach(protector => {
        const node = this.createNodeFromProtector(protector, enhancedSourceInfo);
       
        // Проверяем, нет ли уже похожего узла
        const similarNode = this.findSimilarNode(node);
       
        if (similarNode) {
            // УСИЛИВАЕМ существующий узел
            this.mergeNodes(similarNode.id, node);
        } else {
            // ДОБАВЛЯЕМ новый узел
            this.nodes.set(node.id, node);
        }
    });
   
    // Сохраняем лучший контур и каблук если их еще нет или новые лучше
    this.updateBestContours(contours, enhancedSourceInfo);
    this.updateBestHeels(heels, enhancedSourceInfo);
   
    this.stats.totalSources++;
    this.stats.lastUpdated = new Date();
   
    // Пересчитываем связи
    this.rebuildEdges();
   
    // Обновляем быстрые индексы
    this.updateIndices();
   
    return {
        added: protectors.length,
        contours: contours.length,
        heels: heels.length,
        merged: this.nodes.size,
        confidence: this.stats.confidence
    };
}

// НОВЫЕ МЕТОДЫ:
updateBestContours(contours, sourceInfo) {
    if (!contours || contours.length === 0) return;
   
    // Находим самый большой контур (по площади)
    let bestContour = null;
    let maxArea = 0;
   
    contours.forEach(contour => {
        const area = this.calculateArea(contour.points);
        if (area > maxArea) {
            maxArea = area;
            bestContour = {
                points: contour.points,
                area: area,
                source: sourceInfo,
                timestamp: new Date()
            };
        }
    });
   
    if (bestContour) {
        if (!this.bestContours) this.bestContours = [];
        this.bestContours.push(bestContour);
       
        // Оставляем только 3 лучших контура
        this.bestContours.sort((a, b) => b.area - a.area);
        if (this.bestContours.length > 3) {
            this.bestContours = this.bestContours.slice(0, 3);
        }
    }
}

updateBestHeels(heels, sourceInfo) {
    if (!heels || heels.length === 0) return;
   
    // Находим самый четкий каблук (по уверенности если есть)
    let bestHeel = null;
    let maxConfidence = 0;
   
    heels.forEach(heel => {
        const confidence = heel.confidence || 0.5;
        if (confidence > maxConfidence) {
            maxConfidence = confidence;
            bestHeel = {
                points: heel.points,
                confidence: confidence,
                source: sourceInfo,
                timestamp: new Date()
            };
        }
    });
   
    if (bestHeel) {
        if (!this.bestHeels) this.bestHeels = [];
        this.bestHeels.push(bestHeel);
       
        // Оставляем только 2 лучших каблука
        this.bestHeels.sort((a, b) => b.confidence - a.confidence);
        if (this.bestHeels.length > 2) {
            this.bestHeels = this.bestHeels.slice(0, 2);
        }
    }
}

calculateArea(points) {
    if (!points || points.length < 3) return 0;
   
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
   
    return Math.abs(area) / 2;
}

    // Поиск похожего узла
    findSimilarNode(newNode, tolerance = 15) {
        for (const [id, node] of this.nodes) {
            const distance = this.calculateDistance(node.center, newNode.center);
            const sizeDiff = Math.abs(node.size - newNode.size) / node.size;
           
            if (distance < tolerance && sizeDiff < 0.3) {
                return node;
            }
        }
        return null;
    }

    // Слияние узлов
    mergeNodes(existingId, newNode) {
        const existing = this.nodes.get(existingId);
        if (!existing) return;
       
        // Усредняем координаты (взвешенно по уверенности)
        const totalConfidence = existing.confidence + newNode.confidence;
        existing.center.x = (existing.center.x * existing.confidence +
                           newNode.center.x * newNode.confidence) / totalConfidence;
        existing.center.y = (existing.center.y * existing.confidence +
                           newNode.center.y * newNode.confidence) / totalConfidence;
       
        // Увеличиваем уверенность
        existing.confidence = Math.min(1.0, existing.confidence + 0.1);
        existing.confirmationCount++;
        existing.lastSeen = new Date();
       
        // Добавляем источник
        existing.sources.push(...newNode.sources);
       
        this.nodes.set(existingId, existing);
    }

    // Перестроение связей
    rebuildEdges() {
        this.edges = [];
        const nodeArray = Array.from(this.nodes.values());
       
        for (let i = 0; i < nodeArray.length; i++) {
            for (let j = i + 1; j < nodeArray.length; j++) {
                const distance = this.calculateDistance(
                    nodeArray[i].center,
                    nodeArray[j].center
                );
               
                if (distance < 100) { // Максимальное расстояние для связи
                    this.edges.push({
                        from: nodeArray[i].id,
                        to: nodeArray[j].id,
                        distance: distance,
                        confidence: Math.min(
                            nodeArray[i].confidence,
                            nodeArray[j].confidence
                        )
                    });
                }
            }
        }
    }

    // Обновление индексов для быстрого поиска
    updateIndices() {
        // Хеш модели (быстрое сравнение)
        const nodeData = Array.from(this.nodes.values())
            .map(n => `${n.center.x},${n.center.y},${n.confidence}`)
            .sort()
            .join('|');
       
        this.hash = crypto.createHash('md5').update(nodeData).digest('hex');
       
        // Bounding box
        const xs = Array.from(this.nodes.values()).map(n => n.center.x);
        const ys = Array.from(this.nodes.values()).map(n => n.center.y);
       
        this.boundingBox = {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
       
        // Пересчитываем общую уверенность
        const confidences = Array.from(this.nodes.values()).map(n => n.confidence);
        this.stats.confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }

    // Сравнение с другой моделью
    compare(otherFootprint) {
        if (!otherFootprint || !otherFootprint.nodes) {
            return { score: 0, matched: 0, total: 0 };
        }
       
        const matches = [];
        const otherNodes = Array.from(otherFootprint.nodes.values());
       
        // Простое сравнение по расстоянию
        this.nodes.forEach((node, nodeId) => {
            const bestMatch = this.findBestMatch(node, otherNodes);
            if (bestMatch && bestMatch.distance < 20) {
                matches.push({
                    nodeId,
                    otherId: bestMatch.otherId,
                    distance: bestMatch.distance,
                    confidence: node.confidence * bestMatch.confidence
                });
            }
        });
       
        const score = matches.length > 0
            ? matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
            : 0;
       
        return {
            score: score,
            matched: matches.length,
            total: this.nodes.size,
            matches: matches.slice(0, 10) // Только топ-10 для экономии памяти
        };
    }

    findBestMatch(node, otherNodes) {
        let best = null;
       
        otherNodes.forEach(other => {
            const distance = this.calculateDistance(node.center, other.center);
            const sizeDiff = Math.abs(node.size - other.size) / Math.max(node.size, other.size);
           
            if (sizeDiff < 0.4) { // Размер не должен сильно отличаться
                if (!best || distance < best.distance) {
                    best = {
                        otherId: other.id,
                        distance: distance,
                        confidence: other.confidence
                    };
                }
            }
        });
       
        return best;
    }

    // Вспомогательные геометрические методы
    calculateCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    calculateSize(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        return Math.sqrt(width * width + height * height); // Диагональ
    }

    calculateDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    estimateShape(points) {
        if (points.length < 3) return 'unknown';
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const ratio = width / height;
       
        if (ratio > 1.5) return 'horizontal';
        if (ratio < 0.67) return 'vertical';
        return 'square';
    }

    // Сериализация
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            sessionId: this.sessionId,
            nodes: Object.fromEntries(this.nodes),
            edges: this.edges,
            metadata: this.metadata,
            stats: this.stats,
            hash: this.hash,
            boundingBox: this.boundingBox,
            _version: '1.0'
        };
    }

    static fromJSON(data) {
        const footprint = new DigitalFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            sessionId: data.sessionId,
            metadata: data.metadata
        });
       
        footprint.nodes = new Map(Object.entries(data.nodes || {}));
        footprint.edges = data.edges || [];
        footprint.stats = data.stats || {};
        footprint.hash = data.hash;
        footprint.boundingBox = data.boundingBox;
       
        return footprint;
    }
}

module.exports = DigitalFootprint;
