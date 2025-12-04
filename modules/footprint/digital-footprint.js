// modules/footprint/digital-footprint.js
const crypto = require('crypto');
const fs = require('fs');

class DigitalFootprint {
    constructor(options = {}) {
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.name = options.name || `Модель_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;
        this.sessionId = options.sessionId || null;
       
        // Основные данные модели
        this.nodes = new Map();
        this.edges = [];
       
        // Геометрические данные для визуализации
        this.bestContours = [];
        this.bestHeels = [];
        this.bestPhotoInfo = null;
       
        // Метаданные
        this.metadata = options.metadata || {
            estimatedSize: null,
            footprintType: 'unknown',
            orientation: 0,
            brand: null,
            model: null,
            isMirrored: false,
            distortionInfo: null
        };
       
        // Статистика
        this.stats = {
            totalSources: 0,
            confirmationCount: 0,
            lastUpdated: new Date(),
            created: new Date(),
            confidence: 0.3,
            totalPhotos: 0,
            avgPhotoQuality: 0,
            lastPhotoAdded: null
        };
       
        // Производительность
        this.hash = null;
        this.boundingBox = null;
        this.featureVector = null;
        this.version = '2.1'; // Обновили версию
    }

    // ОСНОВНОЙ МЕТОД: добавить данные из анализа
    addAnalysis(analysis, sourceInfo = {}) {
    const { predictions, timestamp, imagePath, photoQuality = 0.5 } = analysis;
    const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];
    const contours = predictions?.filter(p => p.class === 'Outline-trail') || [];
    const heels = predictions?.filter(p => p.class === 'Heel') || [];
   
    console.log(`🔍 Добавляю ${protectors.length} протекторов, ${contours.length} контуров, ${heels.length} каблуков`);
   
    // СОХРАНЯЕМ ЛОКАЛЬНЫЙ ПУТЬ К ФОТО
    let localPhotoPath = null;
    if (sourceInfo.localPath && fs.existsSync(sourceInfo.localPath)) {
        localPhotoPath = sourceInfo.localPath;
    } else if (imagePath && (imagePath.includes('temp/') || imagePath.includes('temp\\'))) {
        localPhotoPath = imagePath;
    }
   
    // Улучшенный sourceInfo
    const enhancedSourceInfo = {
        ...sourceInfo,
        localPhotoPath: localPhotoPath,
        imagePath: localPhotoPath || imagePath,
        photoQuality: photoQuality,
        timestamp: timestamp || new Date(),
        geometry: {
            protectors: protectors.map(p => ({
                points: p.points,
                confidence: p.confidence || 0.5,
                class: p.class
            })),
            contours: contours.map(c => ({
                points: c.points,
                confidence: c.confidence || 0.5,
                area: this.calculateArea(c.points)
            })),
            heels: heels.map(h => ({
                points: h.points,
                confidence: h.confidence || 0.5,
                area: this.calculateArea(h.points)
            }))
        }
    };
   
    const addedNodes = [];
    const mergedNodes = [];
    const weakNodes = [];
   
    // 🔴 ИСПРАВЛЕНИЕ: объявляем переменную stats
    const stats = {
        skipped: 0
    };
   
    // Для каждого протектора
    // СЛОВАРЬ: протектор → найденный узел (чтобы не дублировать)
    const matchedProtectors = new Map(); // protectorIndex -> nodeId
    const matchedNodesInThisFrame = new Set(); // nodeId (чтобы узел не усиливался несколько раз из одного кадра)
   
    protectors.forEach((protector, protectorIndex) => {
        const node = this.createNodeFromProtector(protector, enhancedSourceInfo);
       
        // Определяем тип узла
        let nodeType = 'normal';
        if (node.confidence < 0.3) {
            nodeType = 'weak';
            weakNodes.push(node);
        } else if (node.confidence > 0.7) {
            nodeType = 'strong';
        }
       
        // Ищем похожий узел с БОЛЬШИМ допуском
        const similarNode = this.findSimilarNode(node);
       
        if (similarNode) {
            // Проверяем, не усиливали ли мы уже этот узел из этого кадра
            if (!matchedNodesInThisFrame.has(similarNode.id)) {
                this.mergeNodes(similarNode.id, node);
                matchedProtectors.set(protectorIndex, similarNode.id);
                matchedNodesInThisFrame.add(similarNode.id);
                mergedNodes.push({
                    existing: similarNode.id.slice(-3),
                    new: node.id.slice(-3),
                    type: nodeType,
                    confidence: node.confidence,
                    distance: this.calculateDistance(similarNode.center, node.center)
                });
               
                console.log(`🔗 Узел ${similarNode.id.slice(-3)} усилен из протектора ${protectorIndex}`);
            } else {
                // Этот узел уже усилен из этого кадра - ПРОПУСКАЕМ!
                console.log(`⚠️  Протектор ${protectorIndex} уже учтен в узле ${matchedProtectors.get(protectorIndex)}`);
                stats.skipped = (stats.skipped || 0) + 1;
            }
        } else {
            // НОВЫЙ узел
            // Если слабый - понижаем рейтинг, но не отбрасываем
            if (nodeType === 'weak') {
                node.confidence *= 0.7;
                node.metadata.isWeak = true;
            }
           
            this.nodes.set(node.id, node);
            addedNodes.push({
                id: node.id.slice(-3),
                type: nodeType,
                confidence: node.confidence
            });
        }
    });
   
    // Сохраняем лучший контур и каблук
    this.updateBestContours(contours, enhancedSourceInfo);
    this.updateBestHeels(heels, enhancedSourceInfo);
   
    // Обновляем информацию о лучшем фото
    this.updateBestPhotoInfo(enhancedSourceInfo);
   
    // Статистика
    this.stats.totalSources++;
    this.stats.totalPhotos++;
    this.stats.avgPhotoQuality = (
        this.stats.avgPhotoQuality * (this.stats.totalPhotos - 1) + photoQuality
    ) / this.stats.totalPhotos;
    this.stats.lastUpdated = new Date();
    this.stats.lastPhotoAdded = new Date();
   
    // ПЕРЕСЧИТЫВАЕМ СВЯЗИ ТОЛЬКО ЕСЛИ ЕСТЬ НОВЫЕ УЗЛЫ
    if (addedNodes.length > 0 || mergedNodes.length > 0) {
        this.rebuildEdges();
        this.updateIndices();
    }
   
    // ВЫВОД ПОДРОБНОЙ СТАТИСТИКИ
    console.log('\n📊 ========== ДЕТАЛЬНАЯ СТАТИСТИКА ==========');
    console.log(`👟 Протекторов в анализе: ${protectors.length}`);
    console.log(`🔗 Объединено узлов: ${mergedNodes.length} (расстояния: ${mergedNodes.map(m => m.distance.toFixed(0)).join(', ')})`);
    console.log(`✨ Новых узлов: ${addedNodes.length}`);
    console.log(`⚠️  Слабых узлов: ${weakNodes.length}`);
    console.log(`📈 Итого узлов в модели: ${this.nodes.size}`);
   
    // Группировка по типам
    if (mergedNodes.length > 0) {
        const strongMerged = mergedNodes.filter(n => n.type === 'strong').length;
        const weakMerged = mergedNodes.filter(n => n.type === 'weak').length;
        console.log(`💪 Сильные объединения: ${strongMerged}`);
        console.log(`🔍 Слабые объединения: ${weakMerged}`);
    }
    console.log('========================================\n');
   
    return {
        added: addedNodes.length,
        merged: mergedNodes.length,
        weak: weakNodes.length,
        contours: contours.length,
        heels: heels.length,
        totalNodes: this.nodes.size,
        confidence: this.stats.confidence,
        photoQuality: photoQuality
    };
}

    // СОЗДАНИЕ УЗЛА ИЗ ПРОТЕКТОРА (упрощенное, без искажений)
    createNodeFromProtector(protector, sourceInfo) {
        const center = this.calculateCenter(protector.points);
        const size = this.calculateSize(protector.points);
        const shape = this.estimateShape(protector.points);
       
        return {
            id: `node_${crypto.randomBytes(3).toString('hex')}`,
            center: center,
            size: size,
            shape: shape,
            confidence: protector.confidence || 0.5,
            confirmationCount: 1,
            sources: [{
                ...sourceInfo,
                originalPoints: protector.points,
                timestamp: new Date()
            }],
            firstSeen: new Date(),
            lastSeen: new Date(),
            metadata: {
                isStable: false,
                isWeak: protector.confidence < 0.3
            }
        };
    }

    // ПОИСК ПОХОЖЕГО УЗЛА С БОЛЬШИМ ДОПУСКОМ
    findSimilarNode(newNode, maxDistance = 60) {
        let bestMatch = null;
        let bestScore = 0;
       
        for (const [id, existingNode] of this.nodes) {
            // ПРОСТОЕ РАССТОЯНИЕ
            const distance = this.calculateDistance(existingNode.center, newNode.center);
           
            // Если слишком далеко - пропускаем
            if (distance > maxDistance) continue;
           
            // Похожесть по размеру (50% допуск)
            const sizeRatio = Math.min(existingNode.size, newNode.size) /
                            Math.max(existingNode.size, newNode.size);
            const sizeScore = sizeRatio > 0.5 ? 1.0 : sizeRatio * 2;
           
            // Похожесть по форме
            const shapeScore = existingNode.shape === newNode.shape ? 1.0 : 0.8;
           
            // Простая формула
            const distanceScore = 1 - (distance / maxDistance);
            const finalScore = (distanceScore * 0.4) + (sizeScore * 0.3) + (shapeScore * 0.3);
           
            if (finalScore > bestScore && finalScore > 0.4) { // ПОРОГ 0.4!
                bestScore = finalScore;
                bestMatch = existingNode;
            }
        }
       
        return bestMatch;
    }

    // СЛИЯНИЕ УЗЛОВ (консервативное - только одно подтверждение за кадр)
    mergeNodes(existingId, newNode) {
        const existing = this.nodes.get(existingId);
        if (!existing) return;
       
        const distance = this.calculateDistance(existing.center, newNode.center);
       
        // 1. Усредняем координаты (взвешенное среднее)
        const weightExisting = existing.confirmationCount || 1;
        const weightNew = 1;
        const totalWeight = weightExisting + weightNew;
       
        existing.center.x = (existing.center.x * weightExisting + newNode.center.x * weightNew) / totalWeight;
        existing.center.y = (existing.center.y * weightExisting + newNode.center.y * weightNew) / totalWeight;
       
        // 2. НЕБОЛЬШОЕ УСИЛЕНИЕ (максимум 1.0)
        const confidenceBoost = Math.min(0.1, 1.0 - existing.confidence);
        existing.confidence = Math.min(1.0, existing.confidence + confidenceBoost);
       
        // 3. Увеличиваем счетчик подтверждений (НО ТОЛЬКО НА 1!)
        // Из одного кадра узел может получить максимум 1 подтверждение
        existing.confirmationCount = (existing.confirmationCount || 1) + 1;
        existing.lastSeen = new Date();
       
        // 4. Добавляем источник
        if (!existing.sources) existing.sources = [];
        existing.sources.push(...newNode.sources);
       
        this.nodes.set(existingId, existing);
       
        console.log(`   → Узел ${existingId.slice(-3)} подтвержден: ${existing.confidence.toFixed(2)} уверенность, ${existing.confirmationCount} подтверждений (расстояние: ${distance.toFixed(1)}px)`);
    }

    // ОБНОВЛЕНИЕ ЛУЧШИХ КОНТУРОВ
    updateBestContours(contours, sourceInfo) {
        if (!contours || contours.length === 0) return;
       
        contours.forEach(contour => {
            const area = this.calculateArea(contour.points);
            const confidence = contour.confidence || 0.5;
            const qualityScore = area * confidence * (sourceInfo.photoQuality || 0.5);
           
            const contourData = {
                id: `contour_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                points: contour.points,
                area: area,
                confidence: confidence,
                qualityScore: qualityScore,
                source: sourceInfo,
                timestamp: new Date()
            };
           
            if (!this.bestContours) this.bestContours = [];
           
            // Сохраняем до 5 лучших контуров
            if (this.bestContours.length < 5) {
                this.bestContours.push(contourData);
            } else {
                const worstIndex = this.bestContours.reduce((worstIdx, current, idx, arr) =>
                    current.qualityScore < arr[worstIdx].qualityScore ? idx : worstIdx, 0
                );
               
                if (qualityScore > this.bestContours[worstIndex].qualityScore) {
                    this.bestContours[worstIndex] = contourData;
                }
            }
        });
       
        this.bestContours.sort((a, b) => b.qualityScore - a.qualityScore);
    }

    // ОБНОВЛЕНИЕ ЛУЧШИХ КАБЛУКОВ
    updateBestHeels(heels, sourceInfo) {
        if (!heels || heels.length === 0) return;
       
        heels.forEach(heel => {
            const area = this.calculateArea(heel.points);
            const confidence = heel.confidence || 0.5;
            const qualityScore = area * confidence * (sourceInfo.photoQuality || 0.5);
           
            const heelData = {
                id: `heel_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                points: heel.points,
                area: area,
                confidence: confidence,
                qualityScore: qualityScore,
                source: sourceInfo,
                timestamp: new Date()
            };
           
            if (!this.bestHeels) this.bestHeels = [];
           
            if (this.bestHeels.length < 3) {
                this.bestHeels.push(heelData);
            } else {
                const worstIndex = this.bestHeels.reduce((worstIdx, current, idx, arr) =>
                    current.qualityScore < arr[worstIdx].qualityScore ? idx : worstIdx, 0
                );
               
                if (qualityScore > this.bestHeels[worstIndex].qualityScore) {
                    this.bestHeels[worstIndex] = heelData;
                }
            }
        });
       
        this.bestHeels.sort((a, b) => b.qualityScore - a.qualityScore);
    }

    // ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ЛУЧШЕМ ФОТО
    updateBestPhotoInfo(sourceInfo) {
        if (!sourceInfo.localPhotoPath) return;
       
        const photoQuality = sourceInfo.photoQuality || 0.5;
        const nodeCount = sourceInfo.geometry?.protectors?.length || 0;
        const avgConfidence = sourceInfo.geometry?.protectors?.reduce((sum, p) => sum + p.confidence, 0) / nodeCount || 0;
       
        const photoScore = photoQuality * nodeCount * avgConfidence;
       
        if (!this.bestPhotoInfo || photoScore > this.bestPhotoInfo.score) {
            this.bestPhotoInfo = {
                path: sourceInfo.localPhotoPath,
                quality: photoQuality,
                nodeCount: nodeCount,
                avgConfidence: avgConfidence,
                score: photoScore,
                timestamp: new Date(),
                source: sourceInfo
            };
        }
    }

    // ПЕРЕСТРОЕНИЕ СВЯЗЕЙ
    rebuildEdges() {
        this.edges = [];
        const nodeArray = Array.from(this.nodes.values());
       
        for (let i = 0; i < nodeArray.length; i++) {
            for (let j = i + 1; j < nodeArray.length; j++) {
                const node1 = nodeArray[i];
                const node2 = nodeArray[j];
               
                const distance = this.calculateDistance(node1.center, node2.center);
                const maxDistance = Math.max(node1.size, node2.size) * 4; // Увеличили в 4 раза
               
                if (distance < maxDistance) {
                    this.edges.push({
                        from: node1.id,
                        to: node2.id,
                        distance: distance,
                        confidence: Math.min(node1.confidence, node2.confidence),
                        isStable: node1.metadata?.isStable && node2.metadata?.isStable
                    });
                }
            }
        }
       
        this.edges.sort((a, b) => b.confidence - a.confidence);
    }

    // ОБНОВЛЕНИЕ ИНДЕКСОВ
    updateIndices() {
        // Хеш модели
        const nodeArray = Array.from(this.nodes.values());
        const nodeData = nodeArray
            .map(n => `${n.center.x.toFixed(0)},${n.center.y.toFixed(0)},${n.confidence.toFixed(2)}`)
            .sort()
            .join('|');
       
        this.hash = crypto.createHash('md5')
            .update(nodeData)
            .digest('hex');
       
        // Bounding box
        if (nodeArray.length > 0) {
            const xs = nodeArray.map(n => n.center.x);
            const ys = nodeArray.map(n => n.center.y);
           
            this.boundingBox = {
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys),
                center: {
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2
                }
            };
        }
       
        // Пересчитываем общую уверенность
        const confidences = nodeArray.map(n => n.confidence);
        this.stats.confidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0.3;
    }

    // ГЕОМЕТРИЧЕСКИЕ МЕТОДЫ (оставляем без изменений)
    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    calculateSize(points) {
        if (!points || points.length < 2) return 0;
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        return Math.sqrt(width * width + height * height);
    }

    calculateDistance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    estimateShape(points) {
        if (!points || points.length < 3) return 'unknown';
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const ratio = width / Math.max(1, height);
       
        if (ratio > 1.5) return 'horizontal';
        if (ratio < 0.67) return 'vertical';
        if (Math.abs(ratio - 1) < 0.2) return 'square';
        return 'rectangle';
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
 // НОРМАЛИЗАЦИЯ ТОПОЛОГИИ (центр масс + масштаб)
    normalizeTopology() {
        const nodes = Array.from(this.nodes.values());
       
        if (nodes.length < 3) return;
       
        // Центр масс
        const centerX = nodes.reduce((sum, n) => sum + n.center.x, 0) / nodes.length;
        const centerY = nodes.reduce((sum, n) => sum + n.center.y, 0) / nodes.length;
       
        // Максимальное расстояние от центра
        const distances = nodes.map(n =>
            Math.sqrt(Math.pow(n.center.x - centerX, 2) + Math.pow(n.center.y - centerY, 2))
        );
        const maxDistance = Math.max(...distances);
       
        if (maxDistance === 0) return;
       
        // Нормализуем
        nodes.forEach(node => {
            node.normalized = {
                x: (node.center.x - centerX) / maxDistance,
                y: (node.center.y - centerY) / maxDistance
            };
        });
    }

    // СРАВНЕНИЕ ТОПОЛОГИЙ (относительные координаты)
    compare(otherFootprint, options = {}) {
        if (!otherFootprint || !otherFootprint.nodes || otherFootprint.nodes.size === 0) {
            return { score: 0, matched: 0, total: 0, details: {} };
        }
       
        // Нормализуем обе модели
        this.normalizeTopology();
        otherFootprint.normalizeTopology();
       
        const thisNodes = Array.from(this.nodes.values()).filter(n => n.normalized);
        const otherNodes = Array.from(otherFootprint.nodes.values()).filter(n => n.normalized);
       
        if (thisNodes.length === 0 || otherNodes.length === 0) {
            return { score: 0, matched: 0, total: 0, details: {} };
        }
       
        // Простое сравнение: находим ближайшие нормализованные точки
        const matches = [];
        const usedOtherNodes = new Set();
       
        thisNodes.forEach(nodeA => {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;
           
            otherNodes.forEach((nodeB, index) => {
                if (usedOtherNodes.has(index)) return;
               
                const dx = nodeA.normalized.x - nodeB.normalized.x;
                const dy = nodeA.normalized.y - nodeB.normalized.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < bestDistance && distance < 0.3) { // 30% от нормированного размера
                    bestDistance = distance;
                    bestMatch = nodeB;
                    bestIndex = index;
                }
            });
           
            if (bestMatch && bestIndex !== -1) {
                matches.push({
                    nodeA: nodeA.id,
                    nodeB: bestMatch.id,
                    distance: bestDistance,
                    score: Math.max(0, 1 - bestDistance / 0.3)
                });
                usedOtherNodes.add(bestIndex);
            }
        });
       
        // Общий счет (сколько узлов сопоставлено)
        const maxNodes = Math.max(thisNodes.length, otherNodes.length);
        const score = maxNodes > 0 ? matches.length / maxNodes : 0;
       
        return {
            score: Math.min(1, score),
            matched: matches.length,
            total: thisNodes.length,
            otherTotal: otherNodes.length,
            matches: matches.slice(0, 10)
        };
    }

    // СРАВНЕНИЕ ФОРМ (добавляем если нет)
    compareShapes(shape1, shape2) {
        if (shape1 === shape2) return 1.0;
       
        const similarPairs = [
            ['horizontal', 'square'],
            ['vertical', 'square'],
            ['circle', 'square']
        ];
       
        return similarPairs.some(pair =>
            (pair[0] === shape1 && pair[1] === shape2) ||
            (pair[1] === shape1 && pair[0] === shape2)
        ) ? 0.7 : 0.3;
    }
    // СЕРИАЛИЗАЦИЯ
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            sessionId: this.sessionId,
            nodes: Object.fromEntries(this.nodes),
            edges: this.edges,
            bestContours: this.bestContours,
            bestHeels: this.bestHeels,
            bestPhotoInfo: this.bestPhotoInfo,
            metadata: this.metadata,
            stats: this.stats,
            hash: this.hash,
            boundingBox: this.boundingBox,
            version: this.version,
            _serializedAt: new Date().toISOString()
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
       
        if (data.nodes && typeof data.nodes === 'object') {
            footprint.nodes = new Map(Object.entries(data.nodes));
        } else {
            footprint.nodes = new Map();
        }
       
        footprint.edges = data.edges || [];
        footprint.bestContours = data.bestContours || [];
        footprint.bestHeels = data.bestHeels || [];
        footprint.bestPhotoInfo = data.bestPhotoInfo;
        footprint.stats = data.stats || {};
        footprint.hash = data.hash;
        footprint.boundingBox = data.boundingBox;
       
        return footprint;
    }
}

module.exports = DigitalFootprint;
