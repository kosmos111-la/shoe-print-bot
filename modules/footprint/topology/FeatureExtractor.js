// modules/footprint/topology/FeatureExtractor.js
// 🔥 УНИВЕРСАЛЬНЫЙ СБОРЩИК ПРИЗНАКОВ + СПЕКТР УГЛОВ

class FeatureExtractor {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // История всех признаков
        this.featureHistory = [];
       
        // Статистика по признакам
        this.featureStats = {
            zone: { correct: 0, false: 0, total: 0 },
            role: { correct: 0, false: 0, total: 0 },
            triangleCount: { correct: 0, false: 0, total: 0 },
            degree: { correct: 0, false: 0, total: 0 },
            neighborDegrees: { correct: 0, false: 0, total: 0 },
            neighborRoles: { correct: 0, false: 0, total: 0 },
            wlSignature: { correct: 0, false: 0, total: 0 },
            // 🔥 Новые признаки на основе углов
            angleSpectrum: { correct: 0, false: 0, total: 0 },
            angleRatios: { correct: 0, false: 0, total: 0 },
            triangleAngles: { correct: 0, false: 0, total: 0 }
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
        console.log('   Будет собирать: зона, роль, треугольники, степени, соседи, УГЛЫ');
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
           
            // Статистика соседей
            neighborCount: neighbors.length,
            neighborDegrees: neighbors.map(n => n.degree).sort((a, b) => b - a),
            neighborDegreeBuckets: neighbors.map(n => this.getDegreeBucket(n.degree)).sort(),
            neighborRoles: neighbors.map(n => this.getNodeRole(n,
                this.findNodeNeighbors(n.id, graph), graph)).sort(),
            neighborTriangles: neighbors.map(n => this.countTriangles(
                this.findNodeNeighbors(n.id, graph), graph)).sort((a, b) => b - a),
           
            // Относительные признаки
            avgNeighborDegree: neighbors.length > 0
                ? neighbors.reduce((sum, n) => sum + n.degree, 0) / neighbors.length
                : 0,
            stdNeighborDegree: this.calculateStd(neighbors.map(n => n.degree)),
           
            // Роли соседей (статистика)
            roleDistribution: this.calculateRoleDistribution(neighbors, graph),
           
            // WL-подпись
            wlSignature: this.computeWLSignature(node, neighbors, graph),
           
            // 🔥 НОВОЕ: Спектр углов
            angleSpectrum: this.computeAngleSpectrum(node, neighbors, graph),
            angleRatios: this.computeAngleRatios(node, neighbors, graph),
            triangleAngles: this.computeTriangleAngles(node, neighbors, graph),
           
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

    // ==================== НОВЫЕ МЕТОДЫ ДЛЯ УГЛОВ ====================

    computeAngleSpectrum(node, neighbors, graph) {
        if (neighbors.length < 2) return [];
       
        // Вычисляем все углы между соседями
        const angles = [];
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const angle = this.calculateAngle(
                    node, neighbors[i], neighbors[j]
                );
                angles.push(angle);
            }
        }
       
        // Сортируем для инвариантности
        angles.sort((a, b) => a - b);
       
        return {
            raw: angles,
            mean: angles.reduce((a, b) => a + b, 0) / angles.length,
            median: angles[Math.floor(angles.length / 2)],
            min: angles[0],
            max: angles[angles.length - 1],
            count: angles.length
        };
    }

    computeAngleRatios(node, neighbors, graph) {
        if (neighbors.length < 3) return [];
       
        // Вычисляем отношения углов (инвариант к перспективе)
        const angles = [];
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const angle = this.calculateAngle(
                    node, neighbors[i], neighbors[j]
                );
                angles.push(angle);
            }
        }
        angles.sort((a, b) => a - b);
       
        const ratios = [];
        for (let i = 0; i < angles.length - 1; i++) {
            ratios.push(angles[i] / angles[i + 1]);
        }
       
        return {
            raw: ratios,
            mean: ratios.reduce((a, b) => a + b, 0) / ratios.length,
            min: Math.min(...ratios),
            max: Math.max(...ratios)
        };
    }

    computeTriangleAngles(node, neighbors, graph) {
        if (neighbors.length < 2) return [];
       
        const triangleAngles = [];
       
        // Для каждого треугольника в окрестности
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                // Проверяем, связаны ли соседи между собой
                if (this.areConnected(neighbors[i], neighbors[j], graph)) {
                    // Это треугольник node - neighbors[i] - neighbors[j]
                    const angle1 = this.calculateAngle(
                        node, neighbors[i], neighbors[j]
                    );
                    const angle2 = this.calculateAngle(
                        neighbors[i], node, neighbors[j]
                    );
                    const angle3 = this.calculateAngle(
                        neighbors[j], node, neighbors[i]
                    );
                   
                    // Сортируем углы внутри треугольника
                    const triAngles = [angle1, angle2, angle3].sort((a, b) => a - b);
                    triangleAngles.push(triAngles);
                }
            }
        }
       
        // Сортируем треугольники по их углам
        triangleAngles.sort((a, b) => {
            for (let i = 0; i < 3; i++) {
                if (a[i] !== b[i]) return a[i] - b[i];
            }
            return 0;
        });
       
        return triangleAngles;
    }

    calculateAngle(center, a, b) {
        // Вектора от центра к точкам
        const dx1 = a.x - center.x;
        const dy1 = a.y - center.y;
        const dx2 = b.x - center.x;
        const dy2 = b.y - center.y;
       
        // Угол между векторами
        const dot = dx1 * dx2 + dy1 * dy2;
        const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
       
        if (mag1 === 0 || mag2 === 0) return 0;
       
        const cos = dot / (mag1 * mag2);
        // Защита от погрешностей вычислений
        const clampedCos = Math.max(-1, Math.min(1, cos));
       
        // Возвращаем угол в градусах
        return Math.acos(clampedCos) * 180 / Math.PI;
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

    calculateStd(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    calculateRoleDistribution(neighbors, graph) {
        const distribution = {};
        for (const neighbor of neighbors) {
            const neighborNeighbors = this.findNodeNeighbors(neighbor.id, graph);
            const role = this.getNodeRole(neighbor, neighborNeighbors, graph);
            distribution[role] = (distribution[role] || 0) + 1;
        }
        return distribution;
    }

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
       
        // Зона
        if (matchInfo.modelZone === features.zone) {
            this.featureStats.zone[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.zone.total++;
       
        // Роль
        if (matchInfo.modelRole === features.role) {
            this.featureStats.role[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.role.total++;
       
        // Треугольники
        const triangleDiff = Math.abs(matchInfo.modelTriangles - features.triangleCount);
        if (triangleDiff <= 1) {
            this.featureStats.triangleCount[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.triangleCount.total++;
       
        // Степень
        const degreeDiff = Math.abs(matchInfo.modelDegree - features.degree);
        if (degreeDiff <= 1) {
            this.featureStats.degree[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.degree.total++;
       
        // WL-подпись
        if (matchInfo.modelSignature === features.wlSignature) {
            this.featureStats.wlSignature[isCorrect ? 'correct' : 'false']++;
        }
        this.featureStats.wlSignature.total++;
       
        // 🔥 НОВОЕ: Углы
        if (features.angleSpectrum && matchInfo.modelAngleSpectrum) {
            const angleDiff = Math.abs(features.angleSpectrum.mean - matchInfo.modelAngleSpectrum.mean);
            if (angleDiff < 10) { // Допускаем разницу в 10 градусов
                this.featureStats.angleSpectrum[isCorrect ? 'correct' : 'false']++;
            }
            this.featureStats.angleSpectrum.total++;
        }
       
        if (features.angleRatios && matchInfo.modelAngleRatios) {
            const ratioDiff = Math.abs(features.angleRatios.mean - matchInfo.modelAngleRatios.mean);
            if (ratioDiff < 0.1) { // Допускаем разницу 10%
                this.featureStats.angleRatios[isCorrect ? 'correct' : 'false']++;
            }
            this.featureStats.angleRatios.total++;
        }
    }

    // ==================== ДИАГНОСТИЧЕСКАЯ ТАБЛИЦА ====================

    addToTable(features, matchInfo) {
        this.featureTable.push({
            // Координаты (для визуального контроля)
            modelCoords: `(${matchInfo.modelX?.toFixed(1)}, ${matchInfo.modelY?.toFixed(1)})`,
            photoCoords: `(${features.x.toFixed(1)}, ${features.y.toFixed(1)})`,
            distance: matchInfo.distance?.toFixed(1) || '?',
           
            // Зона
            modelZone: matchInfo.modelZone,
            photoZone: features.zone,
            zoneMatch: matchInfo.modelZone === features.zone ? '✅' : '❌',
           
            // Роль
            modelRole: matchInfo.modelRole,
            photoRole: features.role,
            roleMatch: matchInfo.modelRole === features.role ? '✅' : '❌',
           
            // Треугольники
            modelTriangles: matchInfo.modelTriangles,
            photoTriangles: features.triangleCount,
            triangleDiff: Math.abs(matchInfo.modelTriangles - features.triangleCount),
           
            // Степень
            modelDegree: matchInfo.modelDegree,
            photoDegree: features.degree,
            degreeDiff: Math.abs(matchInfo.modelDegree - features.degree),
           
            // WL-подпись
            modelSignature: matchInfo.modelSignature?.substring(0, 8),
            photoSignature: features.wlSignature.substring(0, 8),
            signatureMatch: matchInfo.modelSignature === features.wlSignature ? '✅' : '❌',
           
            // 🔥 НОВОЕ: Углы
            modelAngleMean: matchInfo.modelAngleSpectrum?.mean?.toFixed(1) || '?',
            photoAngleMean: features.angleSpectrum?.mean?.toFixed(1) || '?',
            angleDiff: features.angleSpectrum && matchInfo.modelAngleSpectrum
                ? Math.abs(features.angleSpectrum.mean - matchInfo.modelAngleSpectrum.mean).toFixed(1)
                : '?',
           
            // Правильность совпадения
            isCorrect: matchInfo.isCorrect ? '✅' : '❌'
        });
    }

    printFeatureTable(limit = 20) {
        console.log('\n📊 ДИАГНОСТИЧЕСКАЯ ТАБЛИЦА ПРИЗНАКОВ');
        console.log('┌─────┬─────────────┬─────────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐');
        console.log('│  #  │   КООРД.    │    ЗОНА     │  РОЛЬ   │ ТРЕУГ.  │ СТЕПЕНЬ │   WL    │ УГЛЫ(ср)│ РАССТ.  │ ПРАВ.   │');
        console.log('├─────┼─────────────┼─────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤');
       
        this.featureTable.slice(0, limit).forEach((row, idx) => {
            console.log(
                `│ ${(idx+1).toString().padEnd(3)} │ ` +
                `${row.modelCoords.padEnd(11)} │ ` +
                `${row.modelZone.padEnd(4)}→${row.photoZone.padEnd(4)} ${row.zoneMatch} │ ` +
                `${row.modelRole.padEnd(2)}→${row.photoRole.padEnd(2)} ${row.roleMatch} │ ` +
                `${row.modelTriangles.toString().padEnd(2)}→${row.photoTriangles.toString().padEnd(2)} │ ` +
                `${row.modelDegree.toString().padEnd(2)}→${row.photoDegree.toString().padEnd(2)} │ ` +
                `${row.modelSignature || '?'}→${row.photoSignature} │ ` +
                `${row.modelAngleMean}→${row.photoAngleMean} │ ` +
                `${row.distance.padStart(4)}px │ ` +
                `${row.isCorrect} │`
            );
        });
       
        console.log('└─────┴─────────────┴─────────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘');
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
       
        console.log('\n📈 АНАЛИЗ ВАЖНОСТИ ПРИЗНАКОВ:');
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
