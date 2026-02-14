// modules/footprint/topology/GeometricSignature.js
// 🎯 ИДЕНТИФИКАЦИЯ ТОЧЕК + ПОИСК ЯКОРЕЙ (ПОЛНАЯ ВЕРСИЯ)

const FeatureExtractor = require('./FeatureExtractor');

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище сигнатур
        this.signatures = new Map();
       
        // Кластеры
        this.clusters = new Map();
       
        // 🔥 Диагностика
        this.featureExtractor = new FeatureExtractor({
            debug: this.debug
        });
       
        // Бакеты для степеней
        this.degreeBuckets = [
            [0, 2],   // B0: листья
            [3, 4],   // B1: низкая
            [5, 6],   // B2: средняя
            [7, 9],   // B3: высокая
            [10, 12], // B4: очень высокая
            [13, 100] // B5: экстремальная
        ];
       
        // Статистика
        this.stats = {
            totalIdentified: 0,
            totalRejected: 0,
            totalClusters: 0,
            totalClusterMembers: 0
        };
       
        console.log('🎯 GeometricSignature создана (WL-идентификация + поиск якорей)');
    }

    // ==================== ВЫЧИСЛЕНИЕ ВСЕХ ПРИЗНАКОВ ====================

    extractAllFeatures(node, graph) {
        const neighbors = this.findNodeNeighbors(node.id, graph);
       
        // 1. КООРДИНАТЫ
        const features = {
            x: node.x,
            y: node.y,
            zone: this.getZone(node.y),
            zoneCode: this.getZoneCode(node.y),
           
            // Базовые топологические
            degree: neighbors.length,
            degreeBucket: this.getDegreeBucket(neighbors.length),
            triangleCount: this.countTriangles(neighbors, graph),
            role: this.getNodeRole(node, neighbors, graph),
           
            // Соседи (сырые данные)
            neighborDegrees: neighbors.map(n => n.degree),
            neighborRoles: neighbors.map(n => this.getNodeRole(n,
                this.findNodeNeighbors(n.id, graph), graph)),
            neighborTriangles: neighbors.map(n => this.countTriangles(
                this.findNodeNeighbors(n.id, graph), graph)),
           
            // Статистика соседей
            neighborCount: neighbors.length,
            avgNeighborDegree: neighbors.length > 0
                ? neighbors.reduce((sum, n) => sum + n.degree, 0) / neighbors.length
                : 0,
            stdNeighborDegree: this.calculateStd(neighbors.map(n => n.degree)),
           
            // Роли соседей (распределение)
            roleDistribution: this.calculateRoleDistribution(neighbors, graph),
        };
       
        // 2. УГЛЫ
        const angles = [];
        for (const neighbor of neighbors) {
            const angle = Math.atan2(neighbor.y - node.y, neighbor.x - node.x) * 180 / Math.PI;
            angles.push(angle);
        }
        features.neighborAngles = angles;
        features.sortedAngles = [...angles].sort((a, b) => a - b);
       
        if (angles.length > 1) {
            const meanAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
            const variance = angles.reduce((a, b) => a + Math.pow(b - meanAngle, 2), 0) / angles.length;
            features.angleVariance = variance;
            features.angleMean = meanAngle;
            features.angleMin = Math.min(...angles);
            features.angleMax = Math.max(...angles);
        } else {
            features.angleVariance = 0;
            features.angleMean = 0;
            features.angleMin = 0;
            features.angleMax = 0;
        }
       
        // Отношения углов
        if (angles.length >= 2) {
            const ratios = [];
            for (let i = 0; i < angles.length - 1; i++) {
                for (let j = i + 1; j < angles.length; j++) {
                    if (angles[j] !== 0) {
                        ratios.push(angles[i] / angles[j]);
                    }
                }
            }
            features.angleRatios = ratios;
            features.meanAngleRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        } else {
            features.angleRatios = [];
            features.meanAngleRatio = 0;
        }
       
        // 3. РАССТОЯНИЯ
        const distances = [];
        for (const neighbor of neighbors) {
            const dist = Math.sqrt(
                Math.pow(neighbor.x - node.x, 2) +
                Math.pow(neighbor.y - node.y, 2)
            );
            distances.push(dist);
        }
        features.neighborDistances = distances;
       
        const maxDist = Math.max(...distances, 1);
        features.normalizedDistances = distances.map(d => d / maxDist);
       
        if (distances.length > 0) {
            features.meanDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            features.minDistance = Math.min(...distances);
            features.maxDistance = Math.max(...distances);
            const mean = features.meanDistance;
            const variance = distances.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / distances.length;
            features.distanceStd = Math.sqrt(variance);
        } else {
            features.meanDistance = 0;
            features.minDistance = 0;
            features.maxDistance = 0;
            features.distanceStd = 0;
        }
       
        // Отношения расстояний
        if (distances.length >= 2) {
            const distRatios = [];
            for (let i = 0; i < distances.length - 1; i++) {
                for (let j = i + 1; j < distances.length; j++) {
                    if (distances[j] !== 0) {
                        distRatios.push(distances[i] / distances[j]);
                    }
                }
            }
            features.distanceRatios = distRatios;
            features.meanDistanceRatio = distRatios.reduce((a, b) => a + b, 0) / distRatios.length;
        } else {
            features.distanceRatios = [];
            features.meanDistanceRatio = 0;
        }
       
        // 4. ГЕОМЕТРИЯ ОКРЕСТНОСТИ
        if (neighbors.length > 0) {
            const xs = neighbors.map(n => n.x);
            const ys = neighbors.map(n => n.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
           
            features.boundingBox = {
                width: maxX - minX,
                height: maxY - minY
            };
            features.eccentricity = (maxY - minY) > 0 ? (maxX - minX) / (maxY - minY) : 1;
            features.area = (maxX - minX) * (maxY - minY);
        } else {
            features.boundingBox = { width: 0, height: 0 };
            features.eccentricity = 1;
            features.area = 0;
        }
       
        // Плотность
        const possibleEdges = (neighbors.length * (neighbors.length - 1)) / 2;
        features.density = possibleEdges > 0 ? features.triangleCount / possibleEdges : 0;
       
        // Радиальность
        if (angles.length > 1) {
            let radialScore = 0;
            for (let i = 0; i < angles.length; i++) {
                for (let j = i + 1; j < angles.length; j++) {
                    radialScore += Math.abs(Math.sin((angles[i] - angles[j]) * Math.PI / 180));
                }
            }
            const maxPossible = (angles.length * (angles.length - 1)) / 2;
            features.radialness = maxPossible > 0 ? radialScore / maxPossible : 1;
        } else {
            features.radialness = 1;
        }
       
        // 5. ТРЕУГОЛЬНИКИ
        features.triangles = [];
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                if (this.areConnected(neighbors[i], neighbors[j], graph)) {
                    const angle1 = this.calculateAngle(
                        node, neighbors[i], neighbors[j]
                    );
                    const angle2 = this.calculateAngle(
                        neighbors[i], node, neighbors[j]
                    );
                    const angle3 = this.calculateAngle(
                        neighbors[j], node, neighbors[i]
                    );
                   
                    const side1 = Math.sqrt(
                        Math.pow(neighbors[i].x - node.x, 2) +
                        Math.pow(neighbors[i].y - node.y, 2)
                    );
                    const side2 = Math.sqrt(
                        Math.pow(neighbors[j].x - node.x, 2) +
                        Math.pow(neighbors[j].y - node.y, 2)
                    );
                    const side3 = Math.sqrt(
                        Math.pow(neighbors[i].x - neighbors[j].x, 2) +
                        Math.pow(neighbors[i].y - neighbors[j].y, 2)
                    );
                   
                    features.triangles.push({
                        angles: [angle1, angle2, angle3].sort((a, b) => a - b),
                        sides: [side1, side2, side3].sort((a, b) => a - b),
                        perimeter: side1 + side2 + side3,
                        area: 0.5 * Math.abs(
                            (neighbors[i].x - node.x) * (neighbors[j].y - node.y) -
                            (neighbors[j].x - node.x) * (neighbors[i].y - node.y)
                        )
                    });
                }
            }
        }
       
        if (features.triangles.length > 0) {
            features.meanTriangleArea = features.triangles.reduce((sum, t) => sum + t.area, 0) / features.triangles.length;
            features.meanTrianglePerimeter = features.triangles.reduce((sum, t) => sum + t.perimeter, 0) / features.triangles.length;
            features.triangleAreas = features.triangles.map(t => t.area).sort((a, b) => a - b);
            features.trianglePerimeters = features.triangles.map(t => t.perimeter).sort((a, b) => a - b);
        } else {
            features.meanTriangleArea = 0;
            features.meanTrianglePerimeter = 0;
            features.triangleAreas = [];
            features.trianglePerimeters = [];
        }
       
        // 6. WL-подписи разной глубины
        features.wlSignature_depth1 = this.computeWLSignature(node, neighbors, graph, 1);
        features.wlSignature_depth2 = this.computeWLSignature(node, neighbors, graph, 2);
        features.wlSignature_depth3 = this.computeWLSignature(node, neighbors, graph, 3);
       
        // Компактная WL для быстрого сравнения
        features.wlSignature = features.wlSignature_depth2;
       
        return features;
    }

    // ==================== WL-ПОДПИСЬ ====================

    computeWLSignature(node, neighbors, graph, iterations = 2) {
        let signature = `${this.getNodeRole(node, neighbors, graph)}|${this.getZoneCode(node.y)}|T${this.countTriangles(neighbors, graph)}|D${Math.min(neighbors.length, 10)}`;
       
        for (let iter = 0; iter < iterations; iter++) {
            const neighborSigs = [];
           
            for (const neighbor of neighbors) {
                const neighborNeighbors = this.findNodeNeighbors(neighbor.id, graph);
                const neighborSig = `${this.getNodeRole(neighbor, neighborNeighbors, graph)}|T${this.countTriangles(neighborNeighbors, graph)}|D${Math.min(neighborNeighbors.length, 10)}`;
                neighborSigs.push(neighborSig);
            }
           
            neighborSigs.sort();
            signature = this.hashString(signature + '|' + neighborSigs.join('|'));
        }
       
        return signature;
    }

    // ==================== СРАВНЕНИЕ WL (НЕЧЕТКОЕ) ====================

    compareFuzzyWL(sig1, sig2) {
        if (sig1 === sig2) return 1.0;
       
        const parts1 = sig1.split('|');
        const parts2 = sig2.split('|');
       
        let matches = 0;
        const total = Math.min(parts1.length, parts2.length);
       
        for (let i = 0; i < total; i++) {
            if (parts1[i] === parts2[i]) matches++;
        }
       
        return matches / total;
    }

    compareDistanceMean(d1, d2) {
        if (d1 === 0 || d2 === 0) return 0;
        const ratio = Math.min(d1, d2) / Math.max(d1, d2);
        return ratio;
    }

    compareTriangleArea(a1, a2) {
        if (a1 === 0 || a2 === 0) return 0;
        const ratio = Math.min(a1, a2) / Math.max(a1, a2);
        return ratio;
    }

    // ==================== ПОИСК ЯКОРЕЙ ====================

    findAnchorPoints(photoNodes, modelGraph) {
        const anchors = [];
        const candidates = [];
       
        // Собираем кандидатов для всех точек фото
        for (const [photoId, photoNode] of photoNodes) {
            const photoFeatures = this.extractAllFeatures(photoNode, photoNodes);
           
            for (const [modelId, signature] of this.signatures) {
                const modelNode = modelGraph.nodes.get(modelId);
                if (!modelNode) continue;
               
                // Быстрая фильтрация по зоне
                if (signature.zone !== photoFeatures.zone) continue;
               
                // Нечеткое сравнение WL
                const wlScore = this.compareFuzzyWL(
                    signature.signature,
                    photoFeatures.wlSignature
                );
               
                if (wlScore > 0.7) {
                    candidates.push({
                        photoId,
                        modelId,
                        photoWL: signature.signature,
                        modelWL: photoFeatures.wlSignature,
                        photoDist: photoFeatures.meanDistance,
                        modelDist: signature.allFeatures?.meanDistance || 0,
                        photoArea: photoFeatures.meanTriangleArea,
                        modelArea: signature.allFeatures?.meanTriangleArea || 0,
                        wlScore
                    });
                }
            }
        }
       
        // Фильтруем кандидатов в якоря
        for (const candidate of candidates) {
            if (candidate.wlScore < 0.8) continue;
           
            const distScore = this.compareDistanceMean(
                candidate.photoDist,
                candidate.modelDist
            );
            if (distScore < 0.7) continue;
           
            const areaScore = this.compareTriangleArea(
                candidate.photoArea,
                candidate.modelArea
            );
            if (areaScore < 0.7) continue;
           
            anchors.push({
                photoId: candidate.photoId,
                modelId: candidate.modelId,
                confidence: (candidate.wlScore + distScore + areaScore) / 3
            });
        }
       
        if (this.debug) {
            console.log(`\n🔍 Найдено якорей: ${anchors.length}`);
            anchors.slice(0, 5).forEach((a, i) => {
                console.log(`   Якорь ${i+1}: ${a.photoId.substring(0,12)}... ↔ ${a.modelId.substring(0,12)}... (conf: ${a.confidence.toFixed(2)})`);
            });
        }
       
        return anchors;
    }

    // ==================== ОПРЕДЕЛЕНИЕ РОЛИ ====================

    getNodeRole(node, neighbors, graph) {
        const degree = neighbors.length;
       
        if (degree === 1) return 'L';
        if (degree >= 6) return 'H';
       
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!this.areConnected(a, b, graph)) {
                return 'B';
            }
        }
       
        if (degree >= 3) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (!this.areConnected(neighbors[i], neighbors[j], graph)) {
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

    // ==================== ПОДСЧЕТ ТРЕУГОЛЬНИКОВ ====================

    countTriangles(neighbors, graph) {
        let count = 0;
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                if (this.areConnected(neighbors[i], neighbors[j], graph)) {
                    count++;
                }
            }
        }
        return count;
    }

    // ==================== ПРОВЕРКА СВЯЗИ ====================

    areConnected(a, b, graph) {
        const edgeId = [a.id, b.id].sort().join('--');
        return graph.edges.has(edgeId);
    }

    // ==================== ВЫЧИСЛЕНИЕ УГЛА ====================

    calculateAngle(center, a, b) {
        const dx1 = a.x - center.x;
        const dy1 = a.y - center.y;
        const dx2 = b.x - center.x;
        const dy2 = b.y - center.y;
       
        const dot = dx1 * dx2 + dy1 * dy2;
        const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
       
        if (mag1 === 0 || mag2 === 0) return 0;
       
        const cos = dot / (mag1 * mag2);
        const clampedCos = Math.max(-1, Math.min(1, cos));
       
        return Math.acos(clampedCos) * 180 / Math.PI;
    }

    // ==================== ОПРЕДЕЛЕНИЕ ЗОНЫ ====================

    getZone(y) {
        if (y > 350) return 'ПЯТКА';
        if (y < 200) return 'НОСОК';
        return 'ЦЕНТР';
    }

    getZoneCode(y) {
        if (y > 350) return 'K';
        if (y < 200) return 'N';
        return 'C';
    }

    // ==================== БАКЕТ СТЕПЕНИ ====================

    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `B${i}`;
            }
        }
        return 'B5';
    }

    // ==================== ПОИСК СОСЕДЕЙ ====================

    findNodeNeighbors(nodeId, graph) {
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

    // ==================== СТАНДАРТНОЕ ОТКЛОНЕНИЕ ====================

    calculateStd(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    // ==================== РАСПРЕДЕЛЕНИЕ РОЛЕЙ ====================

    calculateRoleDistribution(neighbors, graph) {
        const distribution = {};
        for (const neighbor of neighbors) {
            const neighborNeighbors = this.findNodeNeighbors(neighbor.id, graph);
            const role = this.getNodeRole(neighbor, neighborNeighbors, graph);
            distribution[role] = (distribution[role] || 0) + 1;
        }
        return distribution;
    }

    // ==================== ХЕШ-ФУНКЦИЯ ====================

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36).padStart(8, '0');
    }

    // ==================== ОСНОВНАЯ ИДЕНТИФИКАЦИЯ ====================

    identify(node, neighbors, currentGraph, modelGraph) {
        if (!modelGraph) return null;
       
        const currentFeatures = this.extractAllFeatures(node, currentGraph);
       
        if (this.debug) {
            console.log(`\n   🔍 Идентификация точки ${node.id.substring(0, 20)}...`);
        }
       
        const candidates = [];
       
        for (const [candidateId, signature] of this.signatures) {
            const candidateNode = modelGraph.nodes.get(candidateId);
            if (!candidateNode) continue;
           
            if (signature.zone !== currentFeatures.zone) continue;
           
            const wlScore = this.compareFuzzyWL(
                signature.signature,
                currentFeatures.wlSignature
            );
           
            if (wlScore > 0.7) {
                candidates.push({
                    nodeId: candidateId,
                    wlScore,
                    node: candidateNode,
                    signature
                });
            }
        }
       
        if (candidates.length === 0) {
            this.stats.totalRejected++;
            return null;
        }
       
        candidates.sort((a, b) => b.wlScore - a.wlScore);
        const best = candidates[0];
       
        if (this.featureExtractor) {
            const distance = Math.sqrt(
                Math.pow(node.x - best.node.x, 2) +
                Math.pow(node.y - best.node.y, 2)
            );
           
            const isCorrect = distance < 50 && currentFeatures.zone === best.signature.zone;
           
            const modelFeatures = best.signature.allFeatures || {};
           
            const matchInfo = {
                modelX: best.node.x,
                modelY: best.node.y,
                modelZone: best.signature.zone,
                modelRole: best.signature.role,
                modelTriangles: best.signature.triangleCount,
                modelDegree: best.signature.degree,
                modelSignature: best.signature.signature,
                modelSignatureDepth1: best.signature.wlSignature_depth1,
                modelSignatureDepth2: best.signature.wlSignature_depth2,
                modelSignatureDepth3: best.signature.wlSignature_depth3,
                modelAngleMean: modelFeatures.angleMean,
                modelMeanDistance: modelFeatures.meanDistance,
                modelEccentricity: modelFeatures.eccentricity,
                modelDensity: modelFeatures.density,
                modelMeanTriangleArea: modelFeatures.meanTriangleArea,
                features: currentFeatures,
                distance: distance,
                isCorrect: isCorrect
            };
           
            this.featureExtractor.extractFeatures(node, currentGraph, matchInfo);
        }
       
        const sig = this.signatures.get(best.nodeId);
        if (sig) {
            sig.lastSeen = Date.now();
            sig.timesSeen = (sig.timesSeen || 0) + 1;
        }
       
        this.stats.totalIdentified++;
       
        return {
            nodeId: best.nodeId,
            confidence: best.wlScore,
            method: 'fuzzy_wl',
            degree: best.node.degree,
            role: currentFeatures.role,
            zone: currentFeatures.zone
        };
    }

    // ==================== ЗАПОМИНАНИЕ ТОЧКИ ====================

    remember(nodeId, node, neighbors, graph) {
        const features = this.extractAllFeatures(node, graph);
       
        const signature = {
            nodeId,
            signature: features.wlSignature,
            wlSignature_depth1: features.wlSignature_depth1,
            wlSignature_depth2: features.wlSignature_depth2,
            wlSignature_depth3: features.wlSignature_depth3,
            role: features.role,
            zone: features.zone,
            zoneCode: features.zoneCode,
            triangleCount: features.triangleCount,
            degree: features.degree,
            degreeBucket: features.degreeBucket,
            allFeatures: features,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            timesSeen: 1
        };

        this.signatures.set(nodeId, signature);
       
        if (this.debug) {
            console.log(`   🎯 Запомнена точка ${nodeId.substring(0, 20)}...`);
        }

        return true;
    }

    // ==================== КЛАСТЕРЫ ====================

    registerCluster(headNodeId, childNodeId) {
        if (!this.clusters.has(headNodeId)) {
            this.clusters.set(headNodeId, []);
            this.stats.totalClusters++;
        }
       
        const members = this.clusters.get(headNodeId);
        if (!members.includes(childNodeId)) {
            members.push(childNodeId);
            this.stats.totalClusterMembers++;
        }
       
        return members.length;
    }

    // ==================== ДИАГНОСТИКА ====================

    printDiagnostics() {
        if (this.featureExtractor) {
            this.featureExtractor.printFeatureTable();
            this.featureExtractor.analyzeFeatureImportance();
        }
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        const extractorStats = this.featureExtractor ? this.featureExtractor.getStats() : null;
       
        const roleStats = {};
        const zoneStats = {};
       
        for (const sig of this.signatures.values()) {
            roleStats[sig.role] = (roleStats[sig.role] || 0) + 1;
            zoneStats[sig.zone] = (zoneStats[sig.zone] || 0) + 1;
        }
       
        return {
            totalSignatures: this.signatures.size,
            totalClusters: this.clusters.size,
            totalClusterMembers: this.stats.totalClusterMembers,
            totalIdentified: this.stats.totalIdentified,
            totalRejected: this.stats.totalRejected,
            roleStats,
            zoneStats,
            featureExtractor: extractorStats
        };
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    export() {
        return {
            signatures: Array.from(this.signatures.entries()),
            clusters: Array.from(this.clusters.entries()),
            stats: this.stats,
            featureExtractor: this.featureExtractor ? {
                history: this.featureExtractor.featureHistory,
                table: this.featureExtractor.featureTable,
                stats: this.featureExtractor.featureStats
            } : null
        };
    }

    import(data) {
        if (data.signatures) {
            this.signatures = new Map(data.signatures);
        }
       
        if (data.clusters) {
            this.clusters = new Map(data.clusters);
        }
       
        if (data.stats) {
            this.stats = data.stats;
        }
       
        if (data.featureExtractor && this.featureExtractor) {
            this.featureExtractor.featureHistory = data.featureExtractor.history || [];
            this.featureExtractor.featureTable = data.featureExtractor.table || [];
            this.featureExtractor.featureStats = data.featureExtractor.stats;
        }
       
        console.log(`📥 Импортировано ${this.signatures.size} сигнатур, ${this.clusters.size} кластеров`);
    }
}

module.exports = GeometricSignature;
