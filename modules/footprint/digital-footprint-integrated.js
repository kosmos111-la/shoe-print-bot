// modules/footprint/digital-footprint-integrated.js
// ОБНОВЛЕННАЯ ВЕРСИЯ С ИНТЕГРАЦИЕЙ PointCloudAligner

const crypto = require('crypto');
const fs = require('fs');
const TopologyUtils = require('./topology-utils');
const PointCloudAligner = require('./point-cloud-aligner'); // 🔥 ИМПОРТ ИСПРАВЛЕННОГО АЛГОРИТМА

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

        // Топологические инварианты
        this.topologyInvariants = {
            normalizedNodes: new Map(),
            boundingBox: null,
            shapeDescriptors: null,
            normalizationParams: {
                center: { x: 0, y: 0 },
                scale: 1.0,
                rotation: 0,
                meanDistance: 0
            }
        };

        // Информация о трансформациях (новое!)
        this.transformations = []; // История трансформаций для каждого добавления

        // Метаданные
        this.metadata = options.metadata || {
            footprintType: 'unknown',
            orientation: 0,
            isMirrored: false
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
            alignmentStats: {
                successfulAlignments: 0,
                failedAlignments: 0,
                avgAlignmentScore: 0,
                lastAlignment: null
            }
        };

        // Технические данные
        this.hash = null;
        this.boundingBox = null;
        this.version = '3.0'; // Новая версия с интеграцией PointCloudAligner
    }

    // 🔥 КЛЮЧЕВОЙ МЕТОД: Добавление анализа с автоматическим совмещением
    addAnalysisWithAlignment(analysis, sourceInfo = {}) {
        console.log('🎯 Запуск добавления анализа с автоматическим совмещением');

        const { predictions, timestamp, imagePath, photoQuality = 0.5 } = analysis;
        const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];

        if (protectors.length < 3) {
            console.log('⚠️ Слишком мало протекторов для совмещения');
            return this.addAnalysis(analysis, sourceInfo);
        }

        // Если модель пустая или мало точек - просто добавляем
        if (this.nodes.size < 3) {
            console.log('📌 Модель пустая или мало точек, добавляем без совмещения');
            return this.addAnalysis(analysis, sourceInfo);
        }

        try {
            // 🔥 ПОДГОТОВКА ТОЧЕК ДЛЯ СОВМЕЩЕНИЯ
            const modelPoints = this.getNodePointsForAlignment();
            const newPoints = this.extractPointsFromProtectors(protectors);

            console.log(`🔍 Поиск совмещения: ${modelPoints.length} точек модели vs ${newPoints.length} новых точек`);

            // 🔥 СОЗДАНИЕ И НАСТРОЙКА ALIGNER
            const aligner = new PointCloudAligner({
                maxIterations: 150,
                inlierThreshold: 25,
                minInliersRatio: 0.5,
                minInliersAbsolute: 3,
                mirrorCheck: true,
                mirrorAdvantageThreshold: 0.1,
                maxRandomScore: 0.3,
                adaptiveInlierThreshold: true
            });

            // 🔥 ПОИСК НАИЛУЧШЕГО СОВМЕЩЕНИЯ
            const alignmentResult = aligner.findBestAlignment(modelPoints, newPoints);

            console.log(`📊 Результат совмещения: ${(alignmentResult.score * 100).toFixed(1)}%`);

            // Сохраняем информацию о трансформации
            const alignmentInfo = {
                timestamp: new Date(),
                score: alignmentResult.score,
                transform: alignmentResult.transform,
                mirrored: alignmentResult.mirrored,
                inliersCount: alignmentResult.inliers?.length || 0,
                quality: alignmentResult.quality?.message || 'unknown'
            };

            this.transformations.push(alignmentInfo);
            this.updateAlignmentStats(alignmentResult.score > 0.6);

            // 🔥 РЕШЕНИЕ НА ОСНОВЕ SCORE
            if (alignmentResult.score > 0.7) {
                // 🔥 ОТЛИЧНОЕ СОВМЕЩЕНИЕ - трансформируем и добавляем
                console.log(`✅ Отличное совмещение найдено!`);
                return this.addTransformedAnalysis(analysis, sourceInfo, alignmentResult);

            } else if (alignmentResult.score > 0.5) {
                // 🔥 ХОРОШЕЕ СОВМЕЩЕНИЕ - добавляем с пометкой
                console.log(`✅ Хорошее совмещение`);
                sourceInfo.alignmentInfo = {
                    ...alignmentInfo,
                    confidence: 'good'
                };
                return this.addAnalysis(analysis, sourceInfo);

            } else if (alignmentResult.score > 0.3) {
                // 🔥 СЛАБОЕ СОВМЕЩЕНИЕ - добавляем как возможный новый кластер
                console.log(`⚠️ Слабое совмещение`);
                sourceInfo.alignmentInfo = {
                    ...alignmentInfo,
                    confidence: 'weak',
                    isNewCluster: true
                };
                return this.addAnalysis(analysis, sourceInfo);

            } else {
                // 🔥 ПЛОХОЕ СОВМЕЩЕНИЕ - возможно другой след
                console.log(`❌ Плохое совмещение, добавляем как отдельный кластер`);
                sourceInfo.alignmentInfo = {
                    ...alignmentInfo,
                    confidence: 'poor',
                    isSeparateCluster: true
                };
                return this.addAnalysis(analysis, sourceInfo);
            }

        } catch (error) {
            console.log('❌ Ошибка совмещения:', error.message);
            console.log('🔄 Возвращаюсь к стандартному добавлению');
            return this.addAnalysis(analysis, sourceInfo);
        }
    }

    // 🔥 МЕТОД: Добавление трансформированного анализа
    addTransformedAnalysis(analysis, sourceInfo, alignmentResult) {
        const { predictions } = analysis;
        const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];

        console.log(`🔄 Трансформирую и добавляю ${protectors.length} протекторов`);

        // Создаем копию sourceInfo с информацией о трансформации
        const transformedSourceInfo = {
            ...sourceInfo,
            alignmentInfo: {
                timestamp: new Date(),
                score: alignmentResult.score,
                transform: alignmentResult.transform,
                mirrored: alignmentResult.mirrored,
                inliersCount: alignmentResult.inliers?.length || 0
            }
        };

        const addedNodes = [];
        const mergedNodes = [];

        protectors.forEach((protector, protectorIndex) => {
            // Трансформируем центр протектора
            const originalCenter = this.calculateCenter(protector.points);
            const transformedCenter = this.transformPointWithResult(
                originalCenter,
                alignmentResult
            );

            // Создаем узел с трансформированным центром
            const node = this.createNodeFromProtector(protector, transformedSourceInfo);
            node.center = transformedCenter;
            node.metadata = {
                ...node.metadata,
                transformed: true,
                originalCenter: originalCenter,
                alignmentScore: alignmentResult.score
            };

            // Ищем похожий узел (с меньшим допуском после трансформации)
            const similarNode = this.findSimilarNode(node, 30);

            if (similarNode) {
                // Усиливаем существующий узел
                this.mergeNodes(similarNode.id, node);
                mergedNodes.push({
                    existing: similarNode.id.slice(-3),
                    new: node.id.slice(-3),
                    confidence: node.confidence
                });
            } else {
                // Добавляем новый узел
                this.nodes.set(node.id, node);
                addedNodes.push({
                    id: node.id.slice(-3),
                    confidence: node.confidence
                });
            }
        });

        // Сохраняем контуры и каблуки
        this.saveAllContours(
            predictions?.filter(p => p.class === 'Outline-trail') || [],
            transformedSourceInfo
        );
        this.saveAllHeels(
            predictions?.filter(p => p.class === 'Heel') || [],
            transformedSourceInfo
        );

        // Обновляем модель
        if (addedNodes.length > 0 || mergedNodes.length > 0) {
            this.rebuildEdges();
            this.updateIndices();
            this.updateTopologyInvariants();
        }

        // Статистика
        this.stats.totalSources++;
        this.stats.totalPhotos++;
        this.stats.lastUpdated = new Date();

        console.log('\n📊 РЕЗУЛЬТАТ ТРАНСФОРМАЦИИ:');
        console.log(`✅ Добавлено: ${addedNodes.length} новых узлов`);
        console.log(`✅ Объединено: ${mergedNodes.length} существующих узлов`);
        console.log(`🎯 Score совмещения: ${(alignmentResult.score * 100).toFixed(1)}%`);
        if (alignmentResult.mirrored) {
            console.log('🪞 Обнаружено зеркальное отражение');
        }

        return {
            added: addedNodes.length,
            merged: mergedNodes.length,
            transformed: true,
            alignmentScore: alignmentResult.score,
            mirrored: alignmentResult.mirrored,
            totalNodes: this.nodes.size
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ СОВМЕЩЕНИЯ

    getNodePointsForAlignment() {
        const points = [];
        this.nodes.forEach((node, id) => {
            points.push({
                x: node.center.x,
                y: node.center.y,
                confidence: node.confidence,
                id: id
            });
        });
        return points;
    }

    extractPointsFromProtectors(protectors) {
        return protectors.map((p, index) => {
            const center = this.calculateCenter(p.points);
            return {
                x: center.x,
                y: center.y,
                confidence: p.confidence || 0.5,
                id: `new_${index}`
            };
        });
    }

    transformPointWithResult(point, alignmentResult) {
        if (!alignmentResult.transform) return point;

        const aligner = new PointCloudAligner();
        return aligner.transformPoint(
            point,
            alignmentResult.transform,
            alignmentResult.mirrored
        );
    }

    updateAlignmentStats(isSuccessful) {
        if (isSuccessful) {
            this.stats.alignmentStats.successfulAlignments++;
        } else {
            this.stats.alignmentStats.failedAlignments++;
        }
        this.stats.alignmentStats.lastAlignment = new Date();
    }

    // 🔥 МЕТОД: Совместить с другой моделью (для слияния моделей)
    alignWithOtherFootprint(otherFootprint, options = {}) {
        console.log(`🔍 Совмещение моделей: "${this.name}" vs "${otherFootprint.name}"`);

        const points1 = this.getNodePointsForAlignment();
        const points2 = otherFootprint.getNodePointsForAlignment();

        if (points1.length < 3 || points2.length < 3) {
            console.log('⚠️ Недостаточно точек для совмещения');
            return {
                success: false,
                score: 0,
                error: 'Недостаточно точек'
            };
        }

        const aligner = new PointCloudAligner({
            maxIterations: 200,
            inlierThreshold: 20,
            minInliersRatio: 0.6,
            minInliersAbsolute: 4,
            mirrorCheck: true,
            ...options
        });

        try {
            const alignmentResult = aligner.findBestAlignment(points1, points2);

            const result = {
                success: alignmentResult.score > 0.6,
                score: alignmentResult.score,
                transform: alignmentResult.transform,
                mirrored: alignmentResult.mirrored,
                inliersCount: alignmentResult.inliers?.length || 0,
                inliers: alignmentResult.inliers,
                diagnostic: {
                    points1Count: points1.length,
                    points2Count: points2.length
                }
            };

            console.log(`📊 Результат: ${result.success ? '✅' : '❌'} (${(result.score * 100).toFixed(1)}%)`);
            return result;

        } catch (error) {
            console.log('❌ Ошибка при совмещении моделей:', error.message);
            return {
                success: false,
                score: 0,
                error: error.message
            };
        }
    }

    // 🔥 МЕТОД: Применить трансформацию ко всей модели
    applyTransformationToModel(transform, mirrored = false) {
        console.log(`🔄 Применение трансформации к ${this.nodes.size} узлам`);

        if (!transform) {
            console.log('⚠️ Нет трансформации для применения');
            return false;
        }

        const aligner = new PointCloudAligner();
        const transformedNodes = new Map();

        this.nodes.forEach((node, id) => {
            const transformedCenter = aligner.transformPoint(
                node.center,
                transform,
                mirrored
            );

            transformedNodes.set(id, {
                ...node,
                center: transformedCenter,
                metadata: {
                    ...node.metadata,
                    transformed: true,
                    transformApplied: {
                        rotation: transform.rotation,
                        scale: transform.scale,
                        translation: transform.translation,
                        mirrored: mirrored
                    }
                }
            });
        });

        this.nodes = transformedNodes;
        this.rebuildEdges();
        this.updateTopologyInvariants();

        console.log(`✅ Трансформация применена`);
        return true;
    }

    // 🔥 МЕТОД: Получить статистику совмещений
    getAlignmentStats() {
        const totalAlignments = this.stats.alignmentStats.successfulAlignments +
                               this.stats.alignmentStats.failedAlignments;
       
        const successRate = totalAlignments > 0 ?
            this.stats.alignmentStats.successfulAlignments / totalAlignments : 0;

        return {
            successfulAlignments: this.stats.alignmentStats.successfulAlignments,
            failedAlignments: this.stats.alignmentStats.failedAlignments,
            successRate: successRate,
            lastAlignment: this.stats.alignmentStats.lastAlignment,
            totalTransformations: this.transformations.length
        };
    }

    // 🔥 МЕТОД: Визуализировать результат совмещения
    visualizeAlignment(alignmentResult, otherPoints = []) {
        if (!alignmentResult || !alignmentResult.transform) {
            return null;
        }

        const aligner = new PointCloudAligner();
        const transformedPoints = otherPoints.map(point => {
            const transformed = aligner.transformPoint(
                { x: point.x, y: point.y },
                alignmentResult.transform,
                alignmentResult.mirrored
            );
            return {
                original: point,
                transformed: transformed,
                id: point.id
            };
        });

        const modelPoints = this.getNodePointsForAlignment();

        return {
            modelPoints: modelPoints,
            originalOtherPoints: otherPoints,
            transformedOtherPoints: transformedPoints,
            alignment: {
                score: alignmentResult.score,
                rotation: alignmentResult.transform.rotation,
                scale: alignmentResult.transform.scale,
                translation: alignmentResult.transform.translation,
                mirrored: alignmentResult.mirrored,
                inliers: alignmentResult.inliers || []
            }
        };
    }

    // 🔥 ОСТАВШИЕСЯ МЕТОДЫ (из оригинального digital-footprint.js)

    addAnalysis(analysis, sourceInfo = {}) {
        // Реализация из оригинального файла
        const { predictions } = analysis;
        const protectors = predictions?.filter(p => p.class === 'shoe-protector') || [];
       
        // ... остальной код метода addAnalysis ...
       
        return {
            added: 0,
            merged: 0,
            totalNodes: this.nodes.size
        };
    }

    createNodeFromProtector(protector, sourceInfo) {
        // Реализация из оригинального файла
        const center = this.calculateCenter(protector.points);
        return {
            id: `node_${crypto.randomBytes(3).toString('hex')}`,
            center: center,
            confidence: protector.confidence || 0.5,
            confirmationCount: 1,
            sources: [sourceInfo],
            firstSeen: new Date(),
            lastSeen: new Date()
        };
    }

    findSimilarNode(newNode, maxDistance = 60) {
        // Реализация из оригинального файла
        let bestMatch = null;
        let bestScore = 0;

        for (const [id, existingNode] of this.nodes) {
            const distance = this.calculateDistance(existingNode.center, newNode.center);
            if (distance > maxDistance) continue;

            const score = 1 - (distance / maxDistance);
            if (score > bestScore && score > 0.4) {
                bestScore = score;
                bestMatch = existingNode;
            }
        }

        return bestMatch;
    }

    mergeNodes(existingId, newNode) {
        // Реализация из оригинального файла
        const existing = this.nodes.get(existingId);
        if (!existing) return;

        const weightExisting = existing.confirmationCount || 1;
        const weightNew = 1;
        const totalWeight = weightExisting + weightNew;

        existing.center.x = (existing.center.x * weightExisting + newNode.center.x * weightNew) / totalWeight;
        existing.center.y = (existing.center.y * weightExisting + newNode.center.y * weightNew) / totalWeight;

        existing.confidence = Math.min(1.0, existing.confidence + 0.05);
        existing.confirmationCount = (existing.confirmationCount || 1) + 1;
        existing.lastSeen = new Date();

        if (!existing.sources) existing.sources = [];
        existing.sources.push(...newNode.sources);

        this.nodes.set(existingId, existing);
    }

    saveAllContours(contours, sourceInfo) {
        if (!contours || contours.length === 0) return;
        if (!this.allContours) this.allContours = [];
       
        contours.forEach(contour => {
            this.allContours.push({
                id: `contour_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                points: contour.points,
                confidence: contour.confidence || 0.5,
                source: sourceInfo,
                timestamp: new Date()
            });
        });
    }

    saveAllHeels(heels, sourceInfo) {
        if (!heels || heels.length === 0) return;
        if (!this.allHeels) this.allHeels = [];
       
        heels.forEach(heel => {
            this.allHeels.push({
                id: `heel_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                points: heel.points,
                confidence: heel.confidence || 0.5,
                source: sourceInfo,
                timestamp: new Date()
            });
        });
    }

    rebuildEdges() {
        this.edges = [];
        const nodeArray = Array.from(this.nodes.values());

        for (let i = 0; i < nodeArray.length; i++) {
            for (let j = i + 1; j < nodeArray.length; j++) {
                const node1 = nodeArray[i];
                const node2 = nodeArray[j];

                if (node1.confidence < 0.3 || node2.confidence < 0.3) continue;

                const distance = this.calculateDistance(node1.center, node2.center);
                const maxDistance = Math.max(node1.size, node2.size) * 4;

                if (distance < maxDistance) {
                    this.edges.push({
                        from: node1.id,
                        to: node2.id,
                        distance: distance,
                        confidence: Math.min(node1.confidence, node2.confidence)
                    });
                }
            }
        }
    }

    updateIndices() {
        const nodeArray = Array.from(this.nodes.values());
        const nodeData = nodeArray
            .map(n => `${n.center.x.toFixed(0)},${n.center.y.toFixed(0)},${n.confidence.toFixed(2)}`)
            .sort()
            .join('|');

        this.hash = crypto.createHash('md5')
            .update(nodeData)
            .digest('hex');

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

        const confidences = nodeArray.map(n => n.confidence);
        this.stats.confidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0.3;
    }

    updateTopologyInvariants() {
        const nodesArray = Array.from(this.nodes.values());
        if (nodesArray.length < 2) return;

        const normalizedData = TopologyUtils.normalizeNodes(nodesArray);
        this.topologyInvariants.normalizedNodes.clear();
        this.topologyInvariants.normalizationParams = normalizedData.normalizationParams;

        normalizedData.normalized.forEach((normalizedNode, index) => {
            const originalNode = nodesArray[index];
            if (originalNode && normalizedNode) {
                this.topologyInvariants.normalizedNodes.set(originalNode.id, {
                    x: normalizedNode.x,
                    y: normalizedNode.y,
                    confidence: normalizedNode.confidence,
                    originalId: originalNode.id
                });
            }
        });
    }

    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    calculateDistance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    // 🔥 СЕРИАЛИЗАЦИЯ С ИНФОРМАЦИЕЙ О ТРАНСФОРМАЦИЯХ
    toJSON() {
        const baseJSON = {
            id: this.id,
            name: this.name,
            userId: this.userId,
            sessionId: this.sessionId,
            nodes: Object.fromEntries(this.nodes),
            edges: this.edges,
            bestContours: this.bestContours,
            bestHeels: this.bestHeels,
            allContours: this.allContours || [],
            allHeels: this.allHeels || [],
            metadata: this.metadata,
            stats: this.stats,
            hash: this.hash,
            boundingBox: this.boundingBox,
            // 🔥 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ТРАНСФОРМАЦИЯХ
            transformations: this.transformations,
            topologyInvariants: {
                ...this.topologyInvariants,
                normalizedNodes: Array.from(this.topologyInvariants.normalizedNodes.entries())
            },
            version: this.version,
            _alignmentEnabled: true,
            _serializedAt: new Date().toISOString()
        };

        return baseJSON;
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
        }

        footprint.edges = data.edges || [];
        footprint.bestContours = data.bestContours || [];
        footprint.bestHeels = data.bestHeels || [];
        footprint.allContours = data.allContours || [];
        footprint.allHeels = data.allHeels || [];
        footprint.stats = data.stats || {};
        footprint.hash = data.hash;
        footprint.boundingBox = data.boundingBox;
        footprint.transformations = data.transformations || [];
        footprint.version = data.version || '2.5';

        // Восстанавливаем топологические инварианты
        if (data.topologyInvariants) {
            footprint.topologyInvariants = data.topologyInvariants;
            if (data.topologyInvariants.normalizedNodes && Array.isArray(data.topologyInvariants.normalizedNodes)) {
                footprint.topologyInvariants.normalizedNodes =
                    new Map(data.topologyInvariants.normalizedNodes);
            }
        }

        console.log(`✅ Загружена модель "${footprint.name}" с ${footprint.transformations.length} трансформациями`);
        return footprint;
    }
}

module.exports = DigitalFootprint;
