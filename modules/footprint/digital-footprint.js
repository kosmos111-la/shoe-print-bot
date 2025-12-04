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
       
        // Геометрические данные для визуализации
        this.bestContours = [];          // Лучшие контуры следа
        this.bestHeels = [];             // Лучшие обнаруженные каблуки
        this.bestPhotoInfo = null;       // Информация о лучшем фото
       
        // Метаданные
        this.metadata = options.metadata || {
            estimatedSize: null,
            footprintType: 'unknown',
            orientation: 0,
            brand: null,
            model: null,
            isMirrored: false,           // Является ли зеркальной копией
            distortionInfo: null         // Информация об искажениях
        };
       
        // Статистика
        this.stats = {
            totalSources: 0,             // Сколько фото/сессий внесли вклад
            confirmationCount: 0,        // Сколько раз модель подтверждалась
            lastUpdated: new Date(),
            created: new Date(),
            confidence: 0.3,             // Общая уверенность в модели (0-1)
            totalPhotos: 0,              // Общее количество фото
            avgPhotoQuality: 0,          // Среднее качество фото (0-1)
            lastPhotoAdded: null         // Когда добавлено последнее фото
        };
       
        // Производительность
        this.hash = null;               // Быстрый хеш для сравнения
        this.boundingBox = null;        // Ограничивающая рамка
        this.featureVector = null;      // Вектор признаков для быстрого поиска
        this.version = '2.0';           // Версия формата
    }

    // ОСНОВНОЙ МЕТОД: добавить данные из анализа
    addAnalysis(analysis, sourceInfo = {}) {
        const { predictions, timestamp, imagePath, photoQuality = 0.5 } = analysis;
        const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];
        const contours = predictions?.filter(p => p.class === 'Outline-trail') || [];
        const heels = predictions?.filter(p => p.class === 'Heel') || [];
        const animals = predictions?.filter(p => p.class === 'Animal' || p.class === 'animal-paw') || [];
       
        console.log(`🔍 Добавляю ${protectors.length} протекторов, ${contours.length} контуров, ${heels.length} каблуков из анализа`);
       
      // 🆕 ВАЖНО: Сохраняем путь к фото для визуализации
    if (sourceInfo.imagePath || sourceInfo.photoPath || sourceInfo.localPath) {
        // Инициализируем bestPhotoInfo если еще нет
        this.bestPhotoInfo = this.bestPhotoInfo || {};
       
        // Сохраняем первый найденный путь
        if (!this.bestPhotoInfo.path) {
            this.bestPhotoInfo.path = sourceInfo.imagePath ||
                                      sourceInfo.photoPath ||
                                      sourceInfo.localPath;
            this.bestPhotoInfo.timestamp = new Date();
            console.log(`📸 Сохраняю путь к фото для модели: ${this.bestPhotoInfo.path}`);
        }
       
        // Также добавляем в статистику качества
        if (sourceInfo.photoQuality && sourceInfo.photoQuality > (this.bestPhotoInfo.quality || 0)) {
            this.bestPhotoInfo.quality = sourceInfo.photoQuality;
        }
    }

      if (animals.length > 0) {
            console.log(`⚠️ Обнаружены следы животных: ${animals.length}, пропускаем`);
            return {
                added: 0,
                contours: 0,
                heels: 0,
                animals: animals.length,
                message: 'Обнаружены следы животных, данные пропущены'
            };
        }
       
        // Улучшенный sourceInfo с геометрией
        const enhancedSourceInfo = {
            ...sourceInfo,
            imagePath: imagePath || sourceInfo.imagePath,
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
       
        // Пересчитываем связи
        this.rebuildEdges();
       
        // Обновляем быстрые индексы
        this.updateIndices();
       
        return {
            added: protectors.length,
            contours: contours.length,
            heels: heels.length,
            merged: this.nodes.size,
            confidence: this.stats.confidence,
            photoQuality: photoQuality
        };
    }

    // СОЗДАНИЕ УЗЛА ИЗ ПРОТЕКТОРА С УЧЕТОМ ИСКАЖЕНИЙ
    createNodeFromProtector(protector, sourceInfo) {
        const center = this.calculateCenter(protector.points);
        const size = this.calculateSize(protector.points);
        const shape = this.estimateShape(protector.points);
       
        // Учет перспективных искажений
        const distortionCorrection = this.estimateDistortionCorrection(protector.points, sourceInfo);
       
        return {
            id: `node_${crypto.randomBytes(3).toString('hex')}`,
            center: center,
            size: size,
            shape: shape,
            confidence: protector.confidence || 0.5,
            confirmationCount: 1,
            sources: [{
                ...sourceInfo,
                distortionCorrection: distortionCorrection,
                originalPoints: protector.points,
                timestamp: new Date()
            }],
            firstSeen: new Date(),
            lastSeen: new Date(),
            metadata: {
                isStable: false,         // Устойчивый узел (подтвержден многими фото)
                isMirroredCandidate: false, // Кандидат на зеркальное отображение
                perspectiveFactor: distortionCorrection.perspectiveFactor,
                estimatedRealSize: size * distortionCorrection.scaleFactor
            }
        };
    }

    // ОЦЕНКА ИСКАЖЕНИЙ ПЕРСПЕКТИВЫ
    estimateDistortionCorrection(points, sourceInfo) {
        if (!points || points.length < 3) {
            return { perspectiveFactor: 1, scaleFactor: 1, rotation: 0, isDistorted: false };
        }
       
        // Анализ формы полигона
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const area = width * height;
        const perimeter = this.calculatePerimeter(points);
       
        // Коэффициент перспективы (отношение сторон)
        const aspectRatio = width / Math.max(1, height);
        const perspectiveFactor = Math.min(1, 1 / Math.abs(aspectRatio - 1));
       
        // Оценка масштаба (чем больше площадь, тем ближе съемка)
        const scaleFactor = Math.sqrt(area) / 100; // Нормализация
       
        // Оценка вращения через главные компоненты
        const rotation = this.estimateRotation(points);
       
        return {
            perspectiveFactor: perspectiveFactor,
            scaleFactor: scaleFactor,
            rotation: rotation,
            isDistorted: perspectiveFactor < 0.7 || scaleFactor < 0.5 || scaleFactor > 2,
            aspectRatio: aspectRatio,
            area: area,
            perimeter: perimeter
        };
    }

    // ПОИСК ПОХОЖЕГО УЗЛА С УЧЕТОМ ИСКАЖЕНИЙ
    findSimilarNode(newNode, tolerance = 20) {
        for (const [id, node] of this.nodes) {
            // Учитываем возможные искажения
            const distance = this.calculateDistanceWithDistortion(node.center, newNode.center, node, newNode);
            const sizeDiff = Math.abs(node.size - newNode.size) / Math.max(node.size, newNode.size);
            const shapeSimilarity = this.compareShapes(node.shape, newNode.shape);
           
            // Более сложный критерий с учетом искажений
            const similarityScore = (
                (1 - Math.min(1, distance / tolerance)) * 0.4 +
                (1 - Math.min(1, sizeDiff / 0.3)) * 0.3 +
                shapeSimilarity * 0.3
            );
           
            if (similarityScore > 0.7) { // Порог похожести
                return node;
            }
        }
        return null;
    }

    // СРАВНЕНИЕ ФОРМ
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

    // РАССТОЯНИЕ С УЧЕТОМ ИСКАЖЕНИЙ
    calculateDistanceWithDistortion(p1, p2, node1, node2) {
        const baseDistance = this.calculateDistance(p1, p2);
       
        // Коррекция на перспективные искажения
        const perspectiveCorrection = node1.metadata?.perspectiveFactor || 1;
        const scaleCorrection = node1.metadata?.estimatedRealSize || 1;
       
        return baseDistance * perspectiveCorrection / scaleCorrection;
    }

    // СЛИЯНИЕ УЗЛОВ С УЧЕТОМ ИСКАЖЕНИЙ
    mergeNodes(existingId, newNode) {
        const existing = this.nodes.get(existingId);
        if (!existing) return;
       
        // Взвешенное усреднение с учетом уверенности и искажений
        const weight1 = existing.confidence * (existing.metadata?.perspectiveFactor || 1);
        const weight2 = newNode.confidence * (newNode.metadata?.perspectiveFactor || 1);
        const totalWeight = weight1 + weight2;
       
        // Усредняем координаты
        existing.center.x = (existing.center.x * weight1 + newNode.center.x * weight2) / totalWeight;
        existing.center.y = (existing.center.y * weight1 + newNode.center.y * weight2) / totalWeight;
       
        // Усредняем размер с учетом масштаба
        const scale1 = existing.metadata?.scaleFactor || 1;
        const scale2 = newNode.metadata?.scaleFactor || 1;
        existing.size = (existing.size * scale1 + newNode.size * scale2) / (scale1 + scale2);
       
        // Обновляем метаданные искажений
        existing.metadata.perspectiveFactor = Math.min(1,
            (existing.metadata.perspectiveFactor * weight1 + (newNode.metadata?.perspectiveFactor || 1) * weight2) / totalWeight
        );
        existing.metadata.scaleFactor = (scale1 + scale2) / 2;
       
        // Увеличиваем уверенность (но не более 1.0)
        existing.confidence = Math.min(1.0, existing.confidence + 0.05);
        existing.confirmationCount++;
        existing.lastSeen = new Date();
       
        // Добавляем источник
        existing.sources.push(...newNode.sources);
       
        // Помечаем как стабильный если подтвержден много раз
        if (existing.confirmationCount >= 3) {
            existing.metadata.isStable = true;
        }
       
        this.nodes.set(existingId, existing);
    }

    // ОБНОВЛЕНИЕ ЛУЧШИХ КОНТУРОВ
    updateBestContours(contours, sourceInfo) {
        if (!contours || contours.length === 0) return;
       
        contours.forEach(contour => {
            const area = this.calculateArea(contour.points);
            const confidence = contour.confidence || 0.5;
            const qualityScore = area * confidence * (sourceInfo.photoQuality || 0.5);
           
            const contourData = {
                points: contour.points,
                area: area,
                confidence: confidence,
                qualityScore: qualityScore,
                source: sourceInfo,
                timestamp: new Date(),
                isDistorted: this.isContourDistorted(contour.points)
            };
           
            if (!this.bestContours) this.bestContours = [];
           
            // Добавляем если есть место или лучше существующих
            if (this.bestContours.length < 3) {
                this.bestContours.push(contourData);
            } else {
                // Находим худший контур в текущем списке
                const worstIndex = this.bestContours.reduce((worstIdx, current, idx, arr) =>
                    current.qualityScore < arr[worstIdx].qualityScore ? idx : worstIdx, 0
                );
               
                if (qualityScore > this.bestContours[worstIndex].qualityScore) {
                    this.bestContours[worstIndex] = contourData;
                }
            }
        });
       
        // Сортируем по качеству
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
                points: heel.points,
                area: area,
                confidence: confidence,
                qualityScore: qualityScore,
                source: sourceInfo,
                timestamp: new Date()
            };
           
            if (!this.bestHeels) this.bestHeels = [];
           
            if (this.bestHeels.length < 2) {
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
        if (!sourceInfo.imagePath) return;
       
        const photoQuality = sourceInfo.photoQuality || 0.5;
        const nodeCount = sourceInfo.geometry?.protectors?.length || 0;
        const avgConfidence = sourceInfo.geometry?.protectors?.reduce((sum, p) => sum + p.confidence, 0) / nodeCount || 0;
       
        const photoScore = photoQuality * nodeCount * avgConfidence;
       
        if (!this.bestPhotoInfo || photoScore > this.bestPhotoInfo.score) {
            this.bestPhotoInfo = {
                path: sourceInfo.imagePath,
                quality: photoQuality,
                nodeCount: nodeCount,
                avgConfidence: avgConfidence,
                score: photoScore,
                timestamp: new Date(),
                source: sourceInfo
            };
        }
    }

    // ПЕРЕСТРОЕНИЕ СВЯЗЕЙ С УЧЕТОМ ИСКАЖЕНИЙ
    rebuildEdges() {
        this.edges = [];
        const nodeArray = Array.from(this.nodes.values());
       
        for (let i = 0; i < nodeArray.length; i++) {
            for (let j = i + 1; j < nodeArray.length; j++) {
                const node1 = nodeArray[i];
                const node2 = nodeArray[j];
               
                // Расстояние с учетом искажений
                const distance = this.calculateDistanceWithDistortion(
                    node1.center,
                    node2.center,
                    node1,
                    node2
                );
               
                // Максимальное расстояние зависит от размера узлов
                const maxDistance = Math.max(node1.size, node2.size) * 3;
               
                if (distance < maxDistance) {
                    // Уверенность связи зависит от уверенности узлов и их стабильности
                    const node1Stable = node1.metadata?.isStable ? 1.2 : 1.0;
                    const node2Stable = node2.metadata?.isStable ? 1.2 : 1.0;
                   
                    this.edges.push({
                        from: node1.id,
                        to: node2.id,
                        distance: distance,
                        normalizedDistance: distance / maxDistance,
                        confidence: Math.min(
                            node1.confidence * node1Stable,
                            node2.confidence * node2Stable
                        ),
                        isStable: node1.metadata?.isStable && node2.metadata?.isStable
                    });
                }
            }
        }
       
        // Сортируем по уверенности
        this.edges.sort((a, b) => b.confidence - a.confidence);
    }

    // ОБНОВЛЕНИЕ ИНДЕКСОВ ДЛЯ БЫСТРОГО ПОИСКА
    updateIndices() {
        // Хеш модели с учетом геометрии
        const nodeData = Array.from(this.nodes.values())
            .map(n => `${n.center.x.toFixed(1)},${n.center.y.toFixed(1)},${n.confidence.toFixed(2)}`)
            .sort()
            .join('|');
       
        const geometryData = [
            this.bestContours.length,
            this.bestHeels.length,
            this.nodes.size
        ].join(',');
       
        this.hash = crypto.createHash('md5')
            .update(nodeData + geometryData)
            .digest('hex');
       
        // Bounding box
        const xs = Array.from(this.nodes.values())
            .filter(n => n.center && n.center.x != null)
            .map(n => n.center.x);
        const ys = Array.from(this.nodes.values())
            .filter(n => n.center && n.center.y != null)
            .map(n => n.center.y);
       
        if (xs.length > 0 && ys.length > 0) {
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
        const confidences = Array.from(this.nodes.values())
            .map(n => n.confidence)
            .filter(c => c > 0);
       
        this.stats.confidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0.3;
    }

    // СРАВНЕНИЕ С ДРУГОЙ МОДЕЛЬЮ С УЧЕТОМ ИСКАЖЕНИЙ
    compare(otherFootprint, options = {}) {
        if (!otherFootprint || !otherFootprint.nodes) {
            return { score: 0, matched: 0, total: 0, details: {} };
        }
       
        const {
            considerMirror = true,
            considerDistortion = true,
            matchThreshold = 0.7
        } = options;
       
        const matches = [];
        const otherNodes = Array.from(otherFootprint.nodes.values());
       
        // Простое сравнение по расстоянию
        this.nodes.forEach((node, nodeId) => {
            let bestMatch = null;
            let bestScore = 0;
           
            otherNodes.forEach(other => {
                let score = this.calculateNodeSimilarity(node, other, considerDistortion);
               
                // Проверяем зеркальность если нужно
                if (considerMirror) {
                    const mirroredScore = this.calculateMirroredSimilarity(node, other, considerDistortion);
                    if (mirroredScore > score) {
                        score = mirroredScore;
                        other.metadata = other.metadata || {};
                        other.metadata.isMirroredMatch = true;
                    }
                }
               
                if (score > bestScore && score >= matchThreshold) {
                    bestScore = score;
                    bestMatch = {
                        nodeId: node.id,
                        otherId: other.id,
                        score: score,
                        distance: this.calculateDistance(node.center, other.center),
                        isMirrored: other.metadata?.isMirroredMatch || false
                    };
                }
            });
           
            if (bestMatch) {
                matches.push(bestMatch);
            }
        });
       
        // Взвешенный счет с учетом уверенности узлов
        let weightedScore = 0;
        let totalWeight = 0;
       
        matches.forEach(match => {
            const node = this.nodes.get(match.nodeId);
            const other = otherFootprint.nodes.get(match.otherId);
           
            if (node && other) {
                const weight = Math.min(node.confidence, other.confidence);
                weightedScore += match.score * weight;
                totalWeight += weight;
            }
        });
       
        const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
       
        // Анализ зеркальности
        const mirroredMatches = matches.filter(m => m.isMirrored).length;
        const mirrorRatio = matches.length > 0 ? mirroredMatches / matches.length : 0;
       
        return {
            score: score,
            matched: matches.length,
            total: this.nodes.size,
            matches: matches.slice(0, 20), // Ограничиваем для производительности
            details: {
                mirroredMatches: mirroredMatches,
                mirrorRatio: mirrorRatio,
                isLikelyMirrored: mirrorRatio > 0.6,
                avgMatchScore: matches.length > 0 ?
                    matches.reduce((sum, m) => sum + m.score, 0) / matches.length : 0,
                boundingBoxSimilarity: this.compareBoundingBoxes(otherFootprint)
            }
        };
    }

    // РАСЧЕТ СХОДСТВА УЗЛОВ С УЧЕТОМ ИСКАЖЕНИЙ
    calculateNodeSimilarity(node1, node2, considerDistortion = true) {
        let distance;
       
        if (considerDistortion && node1.metadata && node2.metadata) {
            distance = this.calculateDistanceWithDistortion(node1.center, node2.center, node1, node2);
        } else {
            distance = this.calculateDistance(node1.center, node2.center);
        }
       
        const sizeDiff = Math.abs(node1.size - node2.size) / Math.max(node1.size, node2.size);
        const shapeSim = this.compareShapes(node1.shape, node2.shape);
        const confSim = Math.min(node1.confidence, node2.confidence);
       
        // Расстояние нормализуем (20px = порог)
        const distScore = Math.max(0, 1 - distance / 20);
        const sizeScore = Math.max(0, 1 - sizeDiff / 0.5);
       
        // Взвешенная сумма
        return (
            distScore * 0.4 +
            sizeScore * 0.3 +
            shapeSim * 0.2 +
            confSim * 0.1
        );
    }

    // РАСЧЕТ СХОДСТВА ДЛЯ ЗЕРКАЛЬНЫХ УЗЛОВ
    calculateMirroredSimilarity(node1, node2, considerDistortion = true) {
        // Создаем зеркальную копию node2
        const mirroredNode2 = {
            ...node2,
            center: {
                x: -node2.center.x,
                y: node2.center.y
            },
            metadata: {
                ...node2.metadata,
                isMirrored: true
            }
        };
       
        return this.calculateNodeSimilarity(node1, mirroredNode2, considerDistortion);
    }

    // СРАВНЕНИЕ BOUNDING BOX
    compareBoundingBoxes(otherFootprint) {
        if (!this.boundingBox || !otherFootprint.boundingBox) {
            return 0;
        }
       
        const area1 = this.boundingBox.width * this.boundingBox.height;
        const area2 = otherFootprint.boundingBox.width * otherFootprint.boundingBox.height;
       
        if (area1 === 0 || area2 === 0) return 0;
       
        const sizeRatio = Math.min(area1, area2) / Math.max(area1, area2);
        const aspectRatio1 = this.boundingBox.width / this.boundingBox.height;
        const aspectRatio2 = otherFootprint.boundingBox.width / otherFootprint.boundingBox.height;
        const aspectDiff = Math.abs(aspectRatio1 - aspectRatio2) / Math.max(aspectRatio1, aspectRatio2);
       
        return sizeRatio * (1 - aspectDiff);
    }

    // СОЗДАНИЕ ЗЕРКАЛЬНОЙ КОПИИ МОДЕЛИ
    createMirroredCopy() {
        const mirrored = new DigitalFootprint({
            id: `${this.id}_mirrored`,
            name: `${this.name} (зеркальная)`,
            userId: this.userId,
            sessionId: this.sessionId,
            metadata: {
                ...this.metadata,
                isMirrored: true,
                originalModelId: this.id
            }
        });
       
        // Копируем узлы с зеркальными координатами
        this.nodes.forEach((node, nodeId) => {
            const mirroredNode = {
                ...node,
                id: `${nodeId}_mirrored`,
                center: {
                    x: -node.center.x,
                    y: node.center.y
                },
                metadata: {
                    ...node.metadata,
                    isMirrored: true,
                    originalNodeId: nodeId
                }
            };
           
            mirrored.nodes.set(mirroredNode.id, mirroredNode);
        });
       
        // Копируем контуры и каблуки
        mirrored.bestContours = this.bestContours.map(contour => ({
            ...contour,
            points: contour.points.map(p => ({ x: -p.x, y: p.y }))
        }));
       
        mirrored.bestHeels = this.bestHeels.map(heel => ({
            ...heel,
            points: heel.points.map(p => ({ x: -p.x, y: p.y }))
        }));
       
        // Перестраиваем связи
        mirrored.rebuildEdges();
        mirrored.updateIndices();
       
        return mirrored;
    }

    // ПРОВЕРКА ИСКАЖЕНИЯ КОНТУРА
    isContourDistorted(points) {
        if (!points || points.length < 3) return false;
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const aspectRatio = width / Math.max(1, height);
       
        // Контур считается искаженным если сильно вытянут
        return aspectRatio > 2.5 || aspectRatio < 0.4;
    }

    // ВСПОМОГАТЕЛЬНЫЕ ГЕОМЕТРИЧЕСКИЕ МЕТОДЫ
    calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }
       
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

    calculatePerimeter(points) {
        if (!points || points.length < 2) return 0;
       
        let perimeter = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            perimeter += this.calculateDistance(points[i], points[j]);
        }
       
        return perimeter;
    }

    estimateRotation(points) {
        if (!points || points.length < 2) return 0;
       
        // Простой расчет угла через главную ось
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
       
        // Упрощенный PCA
        let sumXX = 0, sumYY = 0, sumXY = 0;
        points.forEach(p => {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            sumXX += dx * dx;
            sumYY += dy * dy;
            sumXY += dx * dy;
        });
       
        const angle = 0.5 * Math.atan2(2 * sumXY, sumXX - sumYY);
        return angle * 180 / Math.PI; // в градусах
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
       
        // Восстанавливаем Map из объекта
        if (data.nodes && typeof data.nodes === 'object') {
            footprint.nodes = new Map(Object.entries(data.nodes));
        } else {
            footprint.nodes = new Map();
        }
       
        // Восстанавливаем остальные данные
        footprint.edges = data.edges || [];
        footprint.bestContours = data.bestContours || [];
        footprint.bestHeels = data.bestHeels || [];
        footprint.bestPhotoInfo = data.bestPhotoInfo;
        footprint.stats = data.stats || {};
        footprint.hash = data.hash;
        footprint.boundingBox = data.boundingBox;
       
        // Миграция старых версий
        if (!footprint.stats.totalPhotos) {
            footprint.stats.totalPhotos = footprint.stats.totalSources || 0;
        }
       
        return footprint;
    }
}

module.exports = DigitalFootprint;
