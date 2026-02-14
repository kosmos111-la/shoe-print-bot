// modules/footprint/topology/FeatureExtractor.js
// 🔥 УНИВЕРСАЛЬНЫЙ СБОРЩИК ПРИЗНАКОВ + РАСШИРЕННАЯ ТАБЛИЦА

class FeatureExtractor {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // История всех признаков
        this.featureHistory = [];
       
        // Статистика по признакам
        this.featureStats = {
            // Базовые
            zone: { correct: 0, false: 0, total: 0 },
            role: { correct: 0, false: 0, total: 0 },
            triangleCount: { correct: 0, false: 0, total: 0 },
            degree: { correct: 0, false: 0, total: 0 },
           
            // WL разных глубин
            wlSignature_depth1: { correct: 0, false: 0, total: 0 },
            wlSignature_depth2: { correct: 0, false: 0, total: 0 },
            wlSignature_depth3: { correct: 0, false: 0, total: 0 },
           
            // Углы
            angleMean: { correct: 0, false: 0, total: 0 },
            angleVariance: { correct: 0, false: 0, total: 0 },
            angleRatios: { correct: 0, false: 0, total: 0 },
           
            // Расстояния
            distanceMean: { correct: 0, false: 0, total: 0 },
            distanceRatios: { correct: 0, false: 0, total: 0 },
           
            // Геометрия
            eccentricity: { correct: 0, false: 0, total: 0 },
            density: { correct: 0, false: 0, total: 0 },
            radialness: { correct: 0, false: 0, total: 0 },
           
            // Треугольники
            triangleArea: { correct: 0, false: 0, total: 0 },
            trianglePerimeter: { correct: 0, false: 0, total: 0 }
        };
       
        // Таблица признаков для визуализации
        this.featureTable = [];
       
        // Бакеты для степеней
        this.degreeBuckets = [
            [0, 2],   // B0: листья
            [3, 4],   // B1: низкая
            [5, 6],   // B2: средняя
            [7, 9],   // B3: высокая
            [10, 12], // B4: очень высокая
            [13, 100] // B5: экстремальная
        ];
       
        console.log('🔍 FeatureExtractor создан');
        console.log('   Будет собирать: зона, роль, треугольники, степени, WL, углы, расстояния, геометрию');
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    extractFeatures(node, graph, matchInfo = null) {
        const neighbors = this.findNodeNeighbors(node.id, graph);
       
        // 1. БАЗОВЫЕ ПРИЗНАКИ
        const features = {
            // Координаты (только для визуализации)
            x: node.x,
            y: node.y,
            zone: this.getZone(node.y),
            zoneCode: this.getZoneCode(node.y),
           
            // Топология узла
            degree: neighbors.length,
            degreeBucket: this.getDegreeBucket(neighbors.length),
            triangleCount: this.countTriangles(neighbors, graph),
            role: this.getNodeRole(node, neighbors, graph),
           
            // WL разных глубин
            wlSignature_depth1: this.computeWLSignature(node, neighbors, graph, 1),
            wlSignature_depth2: this.computeWLSignature(node, neighbors, graph, 2),
            wlSignature_depth3: this.computeWLSignature(node, neighbors, graph, 3),
           
            // Углы
            angleMean: this.computeMeanAngle(node, neighbors),
            angleVariance: this.computeAngleVariance(node, neighbors),
            angleRatios: this.computeAngleRatios(node, neighbors),
           
            // Расстояния
            distanceMean: this.computeMeanDistance(node, neighbors),
            distanceRatios: this.computeDistanceRatios(node, neighbors),
           
            // Геометрия
            eccentricity: this.computeEccentricity(node, neighbors),
            density: this.computeDensity(neighbors, graph),
            radialness: this.computeRadialness(node, neighbors),
           
            // Треугольники
            triangleArea: this.computeMeanTriangleArea(node, neighbors, graph),
            trianglePerimeter: this.computeMeanTrianglePerimeter(node, neighbors, graph),
           
            // Мета-информация
            matchInfo: matchInfo,
            nodeId: node.id,
            timestamp: Date.now()
        };
       
        // 2. СОХРАНЯЕМ В ИСТОРИЮ
        this.featureHistory.push({
            timestamp: Date.now(),
            nodeId: node.id,
            features: features,
            graphSize: graph.nodes.size,
            matchInfo: matchInfo
        });
       
        // 3. ЕСЛИ ЕСТЬ ИНФОРМАЦИЯ О СОВПАДЕНИИ, ОБНОВЛЯЕМ СТАТИСТИКУ
        if (matchInfo) {
            this.updateStats(features, matchInfo);
        }
       
        // 4. ДОБАВЛЯЕМ В ТАБЛИЦУ (если есть matchInfo)
        if (matchInfo) {
            this.addToTable(features, matchInfo);
        }
       
        return features;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ПРИЗНАКОВ ====================

    computeMeanAngle(node, neighbors) {
        if (neighbors.length === 0) return 0;
       
        let sumAngle = 0;
        for (const neighbor of neighbors) {
            const angle = Math.atan2(neighbor.y - node.y, neighbor.x - node.x) * 180 / Math.PI;
            sumAngle += angle;
        }
        return sumAngle / neighbors.length;
    }

    computeAngleVariance(node, neighbors) {
        if (neighbors.length < 2) return 0;
       
        const angles = [];
        for (const neighbor of neighbors) {
            const angle = Math.atan2(neighbor.y - node.y, neighbor.x - node.x) * 180 / Math.PI;
            angles.push(angle);
        }
       
        const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
        const variance = angles.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / angles.length;
        return Math.sqrt(variance);
    }

    computeAngleRatios(node, neighbors) {
        if (neighbors.length < 2) return 0;
       
        const angles = [];
        for (const neighbor of neighbors) {
            const angle = Math.atan2(neighbor.y - node.y, neighbor.x - node.x) * 180 / Math.PI;
            angles.push(angle);
        }
        angles.sort((a, b) => a - b);
       
        let sumRatio = 0;
        let count = 0;
        for (let i = 0; i < angles.length - 1; i++) {
            for (let j = i + 1; j < angles.length; j++) {
                if (angles[j] !== 0) {
                    sumRatio += angles[i] / angles[j];
                    count++;
                }
            }
        }
        return count > 0 ? sumRatio / count : 0;
    }

    computeMeanDistance(node, neighbors) {
        if (neighbors.length === 0) return 0;
       
        let sumDist = 0;
        for (const neighbor of neighbors) {
            const dist = Math.sqrt(
                Math.pow(neighbor.x - node.x, 2) +
                Math.pow(neighbor.y - node.y, 2)
            );
            sumDist += dist;
        }
        return sumDist / neighbors.length;
    }

    computeDistanceRatios(node, neighbors) {
        if (neighbors.length < 2) return 0;
       
        const distances = [];
        for (const neighbor of neighbors) {
            const dist = Math.sqrt(
                Math.pow(neighbor.x - node.x, 2) +
                Math.pow(neighbor.y - node.y, 2)
            );
            distances.push(dist);
        }
        distances.sort((a, b) => a - b);
       
        let sumRatio = 0;
        let count = 0;
        for (let i = 0; i < distances.length - 1; i++) {
            for (let j = i + 1; j < distances.length; j++) {
                if (distances[j] !== 0) {
                    sumRatio += distances[i] / distances[j];
                    count++;
                }
            }
        }
        return count > 0 ? sumRatio / count : 0;
    }

    computeEccentricity(node, neighbors) {
        if (neighbors.length < 2) return 1;
       
        const xs = neighbors.map(n => n.x);
        const ys = neighbors.map(n => n.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
       
        return height > 0 ? width / height : 1;
    }

    computeDensity(neighbors, graph) {
        if (neighbors.length < 2) return 0;
       
        const possibleEdges = (neighbors.length * (neighbors.length - 1)) / 2;
        const actualEdges = this.countTriangles(neighbors, graph);
       
        return possibleEdges > 0 ? actualEdges / possibleEdges : 0;
    }

    computeRadialness(node, neighbors) {
        if (neighbors.length < 2) return 1;
       
        const angles = [];
        for (const neighbor of neighbors) {
            const angle = Math.atan2(neighbor.y - node.y, neighbor.x - node.x) * 180 / Math.PI;
            angles.push(angle);
        }
       
        let radialScore = 0;
        for (let i = 0; i < angles.length; i++) {
            for (let j = i + 1; j < angles.length; j++) {
                radialScore += Math.abs(Math.sin((angles[i] - angles[j]) * Math.PI / 180));
            }
        }
       
        const maxPossible = (angles.length * (angles.length - 1)) / 2;
        return maxPossible > 0 ? radialScore / maxPossible : 1;
    }

    computeMeanTriangleArea(node, neighbors, graph) {
        if (neighbors.length < 2) return 0;
       
        let totalArea = 0;
        let triangleCount = 0;
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                if (this.areConnected(neighbors[i], neighbors[j], graph)) {
                    const area = 0.5 * Math.abs(
                        (neighbors[i].x - node.x) * (neighbors[j].y - node.y) -
                        (neighbors[j].x - node.x) * (neighbors[i].y - node.y)
                    );
                    totalArea += area;
                    triangleCount++;
                }
            }
        }
       
        return triangleCount > 0 ? totalArea / triangleCount : 0;
    }

    computeMeanTrianglePerimeter(node, neighbors, graph) {
        if (neighbors.length < 2) return 0;
       
        let totalPerimeter = 0;
        let triangleCount = 0;
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                if (this.areConnected(neighbors[i], neighbors[j], graph)) {
                    const d1 = Math.sqrt(
                        Math.pow(neighbors[i].x - node.x, 2) +
                        Math.pow(neighbors[i].y - node.y, 2)
                    );
                    const d2 = Math.sqrt(
                        Math.pow(neighbors[j].x - node.x, 2) +
                        Math.pow(neighbors[j].y - node.y, 2)
                    );
                    const d3 = Math.sqrt(
                        Math.pow(neighbors[i].x - neighbors[j].x, 2) +
                        Math.pow(neighbors[i].y - neighbors[j].y, 2)
                    );
                    totalPerimeter += d1 + d2 + d3;
                    triangleCount++;
                }
            }
        }
       
        return triangleCount > 0 ? totalPerimeter / triangleCount : 0;
    }

    computeWLSignature(node, neighbors, graph, iterations) {
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

    // ==================== СУЩЕСТВУЮЩИЕ МЕТОДЫ ====================

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

    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `B${i}`;
            }
        }
        return 'B5';
    }

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

    areConnected(a, b, graph) {
        const edgeId = [a.id, b.id].sort().join('--');
        return graph.edges.has(edgeId);
    }

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

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36).padStart(8, '0');
    }

    // ==================== СТАТИСТИКА ====================

    updateStats(features, matchInfo) {
        const isCorrect = matchInfo.isCorrect;
       
        // Базовые признаки
        if (matchInfo.modelZone === features.zone) {
            this.featureStats.zone[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.zone.total++;
       
        if (matchInfo.modelRole === features.role) {
            this.featureStats.role[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.role.total++;
       
        const triangleDiff = Math.abs(matchInfo.modelTriangles - features.triangleCount);
        if (triangleDiff <= 1) {
            this.featureStats.triangleCount[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.triangleCount.total++;
       
        const degreeDiff = Math.abs(matchInfo.modelDegree - features.degree);
        if (degreeDiff <= 1) {
            this.featureStats.degree[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.degree.total++;
       
        // WL разных глубин
        if (matchInfo.modelSignatureDepth1 === features.wlSignature_depth1) {
            this.featureStats.wlSignature_depth1[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.wlSignature_depth1.total++;
       
        if (matchInfo.modelSignatureDepth2 === features.wlSignature_depth2) {
            this.featureStats.wlSignature_depth2[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.wlSignature_depth2.total++;
       
        if (matchInfo.modelSignatureDepth3 === features.wlSignature_depth3) {
            this.featureStats.wlSignature_depth3[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.wlSignature_depth3.total++;
       
        // Углы
        if (matchInfo.modelAngleMean !== undefined) {
            const angleDiff = Math.abs(matchInfo.modelAngleMean - features.angleMean);
            if (angleDiff < 10) {
                this.featureStats.angleMean[isCorrect ? 'correct' : 'false']++;
            }
            this.featureStats.angleMean.total++;
        }
       
        if (matchInfo.modelAngleRatios !== undefined) {
            const ratioDiff = Math.abs(matchInfo.modelAngleRatios - features.angleRatios);
            if (ratioDiff < 0.1) {
                this.featureStats.angleRatios[isCorrect ? 'correct' : 'false']++;
            }
            this.featureStats.angleRatios.total++;
        }
       
        // Расстояния
        if (matchInfo.modelMeanDistance !== undefined) {
            const distDiff = Math.abs(matchInfo.modelMeanDistance - features.distanceMean);
            const relDiff = distDiff / Math.max(matchInfo.modelMeanDistance, features.distanceMean, 1);
            if (relDiff < 0.2) {
                this.featureStats.distanceMean[isCorrect ? 'correct' : 'false']++;
            }
            this.featureStats.distanceMean.total++;
        }
       
        // Геометрия
        if (matchInfo.modelEccentricity !== undefined) {
            const eccDiff = Math.abs(matchInfo.modelEccentricity - features.eccentricity);
            if (eccDiff < 0.3) {
                this.featureStats.eccentricity[isCorrect ? 'correct' : 'false']++;
            }
            this.featureStats.eccentricity.total++;
        }
       
        if (matchInfo.modelDensity !== undefined) {
            const densityDiff = Math.abs(matchInfo.modelDensity - features.density);
            if (densityDiff < 0.2) {
                this.featureStats.density[isCorrect ? 'correct' : 'false']++;
            }
            this.featureStats.density.total++;
        }
       
        // Треугольники
        if (matchInfo.modelMeanTriangleArea !== undefined) {
            const areaDiff = Math.abs(matchInfo.modelMeanTriangleArea - features.triangleArea);
            const relAreaDiff = areaDiff / Math.max(matchInfo.modelMeanTriangleArea, features.triangleArea, 1);
            if (relAreaDiff < 0.3) {
                this.featureStats.triangleArea[isCorrect ? 'correct' : 'false']++;
            }
            this.featureStats.triangleArea.total++;
        }
    }

    // ==================== ДИАГНОСТИЧЕСКАЯ ТАБЛИЦА ====================

    addToTable(features, matchInfo) {
        this.featureTable.push({
            // Координаты
            modelCoords: `(${matchInfo.modelX?.toFixed(1)}, ${matchInfo.modelY?.toFixed(1)})`,
            photoCoords: `(${features.x.toFixed(1)}, ${features.y.toFixed(1)})`,
            distance: matchInfo.distance?.toFixed(1) || '?',
           
            // Базовые признаки
            zone: `${matchInfo.modelZone}→${features.zone}`,
            role: `${matchInfo.modelRole}→${features.role}`,
            triangles: `${matchInfo.modelTriangles}→${features.triangleCount}`,
            degree: `${matchInfo.modelDegree}→${features.degree}`,
           
            // WL
            wl1: `${matchInfo.modelSignatureDepth1?.substring(0, 6)}→${features.wlSignature_depth1.substring(0, 6)}`,
            wl2: `${matchInfo.modelSignatureDepth2?.substring(0, 6)}→${features.wlSignature_depth2.substring(0, 6)}`,
            wl3: `${matchInfo.modelSignatureDepth3?.substring(0, 6)}→${features.wlSignature_depth3.substring(0, 6)}`,
           
            // Углы
            angles: `${matchInfo.modelAngleMean?.toFixed(1)}→${features.angleMean.toFixed(1)}`,
           
            // Расстояния
            distances: `${matchInfo.modelMeanDistance?.toFixed(1)}→${features.distanceMean.toFixed(1)}`,
           
            // Геометрия
            ecc: `${matchInfo.modelEccentricity?.toFixed(2)}→${features.eccentricity.toFixed(2)}`,
           
            // Правильность
            isCorrect: matchInfo.isCorrect ? '✅' : '❌'
        });
    }

    printFeatureTable(limit = 20) {
        console.log('\n📊 ДИАГНОСТИЧЕСКАЯ ТАБЛИЦА ВСЕХ ПРИЗНАКОВ');
        console.log('┌─────┬─────────────┬───────┬───────┬───────┬───────┬───────────┬───────────┬───────────┬───────┬───────┬───────┐');
        console.log('│  #  │   КООРД.    │ ЗОНА  │ РОЛЬ  │ ТРЕУГ │ СТЕП  │ WL1       │ WL2       │ WL3       │ УГЛЫ  │ РАССТ │ ЭКСЦ  │ ПРАВ  │');
        console.log('├─────┼─────────────┼───────┼───────┼───────┼───────┼───────────┼───────────┼───────────┼───────┼───────┼───────┼───────┤');
       
        this.featureTable.slice(0, limit).forEach((row, idx) => {
            console.log(
                `│ ${(idx+1).toString().padEnd(3)} │ ` +
                `${row.modelCoords.padEnd(11)} │ ` +
                `${row.zone.padEnd(5)} │ ` +
                `${row.role.padEnd(5)} │ ` +
                `${row.triangles.padEnd(5)} │ ` +
                `${row.degree.padEnd(5)} │ ` +
                `${row.wl1.padEnd(9)} │ ` +
                `${row.wl2.padEnd(9)} │ ` +
                `${row.wl3.padEnd(9)} │ ` +
                `${row.angles.padEnd(5)} │ ` +
                `${row.distances.padEnd(5)} │ ` +
                `${row.ecc.padEnd(5)} │ ` +
                `${row.isCorrect} │`
            );
        });
       
        console.log('└─────┴─────────────┴───────┴───────┴───────┴───────┴───────────┴───────────┴───────────┴───────┴───────┴───────┴───────┘');
    }

    analyzeFeatureImportance() {
        const analysis = {};
       
        for (const [feature, stats] of Object.entries(this.featureStats)) {
            if (stats.total === 0) continue;
           
            const correctRate = stats.correct / stats.total * 100;
            const falseRate = stats.false / stats.total * 100;
            const usefulness = correctRate - falseRate;
           
            analysis[feature] = {
                correctRate: correctRate.toFixed(1) + '%',
                falseRate: falseRate.toFixed(1) + '%',
                usefulness: usefulness.toFixed(1) + '%',
                total: stats.total
            };
        }
       
        console.log('\n📈 АНАЛИЗ ВАЖНОСТИ ВСЕХ ПРИЗНАКОВ:');
        console.log('┌─────────────────┬───────────┬───────────┬───────────┬───────────┐');
        console.log('│ ПРИЗНАК         │ ПРАВ.     │ ЛОЖН.     │ ПОЛЕЗН.   │ ВСЕГО     │');
        console.log('├─────────────────┼───────────┼───────────┼───────────┼───────────┤');
       
        for (const [feature, stats] of Object.entries(analysis)) {
            console.log(
                `│ ${feature.padEnd(15)} │ ${stats.correctRate.padStart(9)} │ ` +
                `${stats.falseRate.padStart(9)} │ ${stats.usefulness.padStart(9)} │ ` +
                `${stats.total.toString().padStart(9)} │`
            );
        }
       
        console.log('└─────────────────┴───────────┴───────────┴───────────┴───────────┘');
       
        return analysis;
    }

    getStats() {
        return {
            historySize: this.featureHistory.length,
            tableSize: this.featureTable.length,
            featureStats: this.featureStats,
            analysis: this.analyzeFeatureImportance()
        };
    }

    clear() {
        this.featureHistory = [];
        this.featureTable = [];
        Object.keys(this.featureStats).forEach(key => {
            this.featureStats[key] = { correct: 0, false: 0, total: 0 };
        });
        console.log('🧹 FeatureExtractor очищен');
    }
}

module.exports = FeatureExtractor;
