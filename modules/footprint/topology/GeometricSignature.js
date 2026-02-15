// modules/footprint/topology/GeometricSignature.js
// 🎯 ИДЕНТИФИКАЦИЯ ТОЧЕК + ПАТТЕРНОВЫЙ WL

const FeatureExtractor = require('./FeatureExtractor');
const RobustWLSignature = require('./RobustWLSignature');

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // Хранилище сигнатур
        this.signatures = new Map();

        // Кластеры
        this.clusters = new Map();

        // 🔥 Паттерновый WL
        this.wlSigner = new RobustWLSignature({
            debug: this.debug,
            iterations: 2
        });

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

        console.log('🎯 GeometricSignature создана (паттерновый WL + поиск якорей)');
    }

    // ==================== ВЫЧИСЛЕНИЕ ВСЕХ ПРИЗНАКОВ ====================

    extractAllFeatures(node, graph) {
        const neighbors = this.findNodeNeighbors(node.id, graph);

        const features = {
            x: node.x,
            y: node.y,
            zone: this.getZone(node.y),
            zoneCode: this.getZoneCode(node.y),

            degree: neighbors.length,
            degreeBucket: this.getDegreeBucket(neighbors.length),
            triangleCount: this.countTriangles(neighbors, graph),
            role: this.getNodeRole(node, neighbors, graph),

            neighborDegrees: neighbors.map(n => n.degree),
            neighborRoles: neighbors.map(n => this.getNodeRole(n,
                this.findNodeNeighbors(n.id, graph), graph)),
            neighborTriangles: neighbors.map(n => this.countTriangles(
                this.findNodeNeighbors(n.id, graph), graph)),

            neighborCount: neighbors.length,
            avgNeighborDegree: neighbors.length > 0
                ? neighbors.reduce((sum, n) => sum + n.degree, 0) / neighbors.length
                : 0,
            stdNeighborDegree: this.calculateStd(neighbors.map(n => n.degree)),

            roleDistribution: this.calculateRoleDistribution(neighbors, graph),
        };

        // Углы
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
        } else {
            features.angleVariance = 0;
            features.angleMean = 0;
        }

        // Расстояния
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

        // Геометрия окрестности
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

        // 🔥 ПАТТЕРНОВЫЙ WL (вместо старого)
        features.wlSignature = this.wlSigner.computePattern(node, graph);

        return features;
    }

    // ==================== СРАВНЕНИЕ WL (ПАТТЕРНОВОЕ) ====================

    compareFuzzyWL(sig1, sig2) {
        return this.wlSigner.comparePatterns(sig1, sig2);
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

    for (const [photoId, photoNode] of photoNodes) {
        const photoFeatures = this.extractAllFeatures(photoNode, photoNodes);

        for (const [modelId, signature] of this.signatures) {
            const modelNode = modelGraph.nodes.get(modelId);
            if (!modelNode) continue;

            if (signature.zone !== photoFeatures.zone) continue;

            // 🔥 WL СРАВНЕНИЕ ТЕПЕРЬ РАБОТАЕТ!
            const wlScore = this.compareFuzzyWL(
                signature.wlSignature,
                photoFeatures.wlSignature
            );

            // Собираем всех кандидатов с WL > 0.5
       //   console.log(`WL Score: ${wlScore}`); // Добавить отладку
            if (wlScore > 0.7) {
                candidates.push({
                    photoId,
                    modelId,
                    wlScore,
                    photoDist: photoFeatures.meanDistance,
                    modelDist: signature.meanDistance || 0,
                    photoArea: photoFeatures.meanTriangleArea,
                    modelArea: signature.meanTriangleArea || 0,
                    photoNode,
                    modelNode
                });
            }
        }
    }

    // Сортируем кандидатов по убыванию WL Score
    candidates.sort((a, b) => b.wlScore - a.wlScore);

     console.log(`\n📊 ОТЛАДКА ПОИСКА ЯКОРЕЙ:`);
console.log(`   Всего кандидатов: ${candidates.length}`);

if (candidates.length > 0) {
    console.log(`   Примеры кандидатов (первые 5):`);
    candidates.slice(0, 5).forEach((c, i) => {
        console.log(`   ${i+1}. WL: ${c.wlScore.toFixed(3)}, dist: ${c.photoDist?.toFixed(1) || 'NaN'}, area: ${c.photoArea?.toFixed(1) || 'NaN'}`);
    });
} else {
    console.log(`   ❌ НЕТ КАНДИДАТОВ!`);
}      

    // Отбираем якоря (топ-30 или все с WL > 0.7)
    const usedPhotos = new Set();
    const usedModels = new Set();

    for (const candidate of candidates) {
        // Проверяем, не заняты ли уже эти точки
     //   if (usedPhotos.has(candidate.photoId)) continue;
     //   if (usedModels.has(candidate.modelId)) continue;

        // Жесткие фильтры для якорей
        if (candidate.wlScore < 0.5) continue; // Минимальный WL Score

        // Проверка расстояния (среднее расстояние до соседей)
        const distScore = this.compareDistanceMean(
            candidate.photoDist,
            candidate.modelDist
        );
        if (distScore < 0.6) continue; // Чуть снизил порог

        // Проверка площади треугольников
        const areaScore = this.compareTriangleArea(
            candidate.photoArea,
            candidate.modelArea
        );
        if (areaScore < 0.6) continue; // Чуть снизил порог

        // Всё хорошо - добавляем якорь
        anchors.push({
            photoId: candidate.photoId,
            modelId: candidate.modelId,
            confidence: (candidate.wlScore + distScore + areaScore) / 3,
            wlScore: candidate.wlScore,
            distScore,
            areaScore
        });

        usedPhotos.add(candidate.photoId);
        usedModels.add(candidate.modelId);

        // Хватит 30 якорей
        if (anchors.length >= 30) break;
    }

    if (this.debug) {
        console.log(`\n🔍 Найдено якорей: ${anchors.length}`);
        anchors.slice(0, 5).forEach((a, i) => {
            console.log(`   Якорь ${i+1}: ${a.photoId.substring(0,12)}... ↔ ${a.modelId.substring(0,12)}...`);
            console.log(`      WL: ${(a.wlScore*100).toFixed(1)}%, Dist: ${(a.distScore*100).toFixed(1)}%, Area: ${(a.areaScore*100).toFixed(1)}%`);
        });
        if (anchors.length > 5) {
            console.log(`   ... и еще ${anchors.length - 5} якорей`);
        }
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
        // 🔥 ЗАЩИТА: если граф или его рёбра отсутствуют, считаем что связи нет
        if (!graph || !graph.edges) return false;
        const edgeId = [a.id, b.id].sort().join('--');
        return graph.edges.has(edgeId);
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
        // 🔥 ЗАЩИТА: преобразуем рёбра в массив, если они есть
        const edgesArray = Array.from(graph.edges || []);
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
                signature.wlSignature,
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

            const matchInfo = {
                modelX: best.node.x,
                modelY: best.node.y,
                modelZone: best.signature.zone,
                modelRole: best.signature.role,
                modelTriangles: best.signature.triangleCount,
                modelDegree: best.signature.degree,
                modelSignature: best.signature.wlSignature,
                modelMeanDistance: best.signature.meanDistance,
                modelMeanTriangleArea: best.signature.meanTriangleArea,
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
            method: 'pattern_wl',
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
    wlSignature: features.wlSignature,
    role: features.role,
    zone: features.zone,
    zoneCode: features.zoneCode,
    triangleCount: features.triangleCount,
    degree: features.degree,
    degreeBucket: features.degreeBucket,
    meanDistance: features.meanDistance,        // 🔥 ДОБАВИТЬ
    meanTriangleArea: features.meanTriangleArea, // 🔥 ДОБАВИТЬ
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
        const wlStats = this.wlSigner ? this.wlSigner.getStats() : null;

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
            wlSigner: wlStats,
            featureExtractor: extractorStats
        };
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    export() {
        return {
            signatures: Array.from(this.signatures.entries()),
            clusters: Array.from(this.clusters.entries()),
            stats: this.stats,
            wlSigner: {
                cache: Array.from(this.wlSigner.cache.entries()),
                cacheHits: this.wlSigner.cacheHits,
                cacheMisses: this.wlSigner.cacheMisses
            },
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

        if (data.wlSigner && this.wlSigner) {
            this.wlSigner.cache = new Map(data.wlSigner.cache || []);
            this.wlSigner.cacheHits = data.wlSigner.cacheHits || 0;
            this.wlSigner.cacheMisses = data.wlSigner.cacheMisses || 0;
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
