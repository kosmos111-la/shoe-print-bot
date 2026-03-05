// modules/footprint/matching/GeometricValidator.js
// 🔥 ВЕКТОРНАЯ ГЕОМЕТРИЧЕСКАЯ ВЕРИФИКАЦИЯ ЯКОРЕЙ
// (инвариантна к повороту, масштабу и сдвигу)

class GeometricValidator {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Параметры векторной верификации
        this.ratioThreshold = options.ratioThreshold || 0.1; // 10% допуск на отношения
        this.minAnchors = options.minAnchors || 3;
       
        console.log(`📐 GeometricValidator (векторный) создан`);
        console.log(`   • Допуск на отношения: ${this.ratioThreshold * 100}%`);
    }

    /**
     * 🔥 ОСНОВНОЙ МЕТОД: векторная верификация якорей
     * @param {Array} anchors - массив якорей { pointA, pointB, confidence, zone }
     * @param {Map} pointsA - карта точек из фото (id -> {x, y})
     * @param {Map} pointsB - карта точек из модели (id -> {x, y})
     * @returns {Object} результат верификации
     */
    validateAnchors(anchors, pointsA, pointsB) {
        console.log(`\n🔍 ВЕКТОРНАЯ ГЕОМЕТРИЧЕСКАЯ ВЕРИФИКАЦИЯ`);
        console.log(`========================================`);
        console.log(`📊 Всего кандидатов: ${anchors.length}`);

        if (anchors.length < this.minAnchors) {
            console.log(`⚠️ Меньше ${this.minAnchors} якорей, верификация невозможна`);
            return {
                verified: anchors, // возвращаем как есть
                rejected: [],
                stats: {
                    total: anchors.length,
                    verified: anchors.length,
                    rejected: 0
                }
            };
        }

        // ШАГ 1: Подготовка данных
        const data = [];
        for (const anchor of anchors) {
            const pointA = pointsA.get(anchor.pointA);
            const pointB = pointsB.get(anchor.pointB);
           
            if (!pointA || !pointB) continue;
           
            data.push({
                id: anchor.pointA,
                modelId: anchor.pointB,
                x1: pointA.x,
                y1: pointA.y,
                x2: pointB.x,
                y2: pointB.y,
                confidence: anchor.confidence,
                zone: anchor.zone
            });
        }

        console.log(`📊 Подготовлено данных: ${data.length}`);

        // ШАГ 2: Вычисляем матрицу согласованности
        const consistencyMatrix = this.buildConsistencyMatrix(data);
       
        // ШАГ 3: Находим максимальный согласованный кластер
        const cluster = this.findMaxConsistentCluster(consistencyMatrix, data);
       
        console.log(`\n📊 РЕЗУЛЬТАТ ВЕРИФИКАЦИИ:`);
        console.log(`   • Согласовано: ${cluster.length} точек`);
        console.log(`   • Несогласовано: ${data.length - cluster.length} точек`);

        // ШАГ 4: Формируем результат
        const verified = [];
        const rejected = [];
        const clusterSet = new Set(cluster);

        for (let i = 0; i < data.length; i++) {
            if (clusterSet.has(i)) {
                verified.push({
                    pointA: data[i].id,
                    pointB: data[i].modelId,
                    confidence: 1.0,
                    zone: data[i].zone,
                    geometricScore: 1.0
                });
            } else {
                rejected.push({
                    pointA: data[i].id,
                    pointB: data[i].modelId,
                    confidence: 0.0,
                    zone: data[i].zone,
                    geometricScore: 0.0,
                    alternatives: this.findAlternatives(data[i], data)
                });
            }
        }

        return {
            verified,
            rejected,
            stats: {
                total: data.length,
                verified: verified.length,
                rejected: rejected.length,
                consistency: verified.length / data.length
            }
        };
    }

    /**
     * 🔥 Построение матрицы согласованности
     * Проверяем каждую тройку точек на сохранение пропорций
     */
    buildConsistencyMatrix(data) {
        const n = data.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
       
        // Счетчик согласованных троек для каждой пары
        for (let i = 0; i < n; i++) {
            for (let j = i+1; j < n; j++) {
                let consistentCount = 0;
                let totalChecks = 0;
               
                for (let k = 0; k < n; k++) {
                    if (k === i || k === j) continue;
                   
                    if (this.checkTriangleConsistency(data[i], data[j], data[k])) {
                        consistentCount++;
                    }
                    totalChecks++;
                }
               
                // Степень согласованности пары (доля троек, где они согласованы)
                if (totalChecks > 0) {
                    matrix[i][j] = matrix[j][i] = consistentCount / totalChecks;
                }
            }
        }
       
        return matrix;
    }

    /**
     * 🔥 Проверка согласованности тройки точек
     * Сравниваем отношения расстояний в фото и модели
     */
    checkTriangleConsistency(p1, p2, p3) {
        // Расстояния в фото
        const d12a = this.distance(p1.x1, p1.y1, p2.x1, p2.y1);
        const d13a = this.distance(p1.x1, p1.y1, p3.x1, p3.y1);
        const d23a = this.distance(p2.x1, p2.y1, p3.x1, p3.y1);
       
        // Расстояния в модели
        const d12b = this.distance(p1.x2, p1.y2, p2.x2, p2.y2);
        const d13b = this.distance(p1.x2, p1.y2, p3.x2, p3.y2);
        const d23b = this.distance(p2.x2, p2.y2, p3.x2, p3.y2);
       
        // Защита от деления на ноль
        if (d12a < 0.1 || d13a < 0.1 || d23a < 0.1 ||
            d12b < 0.1 || d13b < 0.1 || d23b < 0.1) {
            return false;
        }
       
        // Вычисляем отношения сторон (инвариантны к масштабу)
        const ratiosA = [
            d12a / d13a,
            d12a / d23a,
            d13a / d23a
        ].sort((a, b) => a - b);
       
        const ratiosB = [
            d12b / d13b,
            d12b / d23b,
            d13b / d23b
        ].sort((a, b) => a - b);
       
        // Проверяем все три отношения
        let consistent = true;
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(ratiosA[i] - ratiosB[i]);
            const maxRatio = Math.max(ratiosA[i], ratiosB[i]);
            if (maxRatio > 0 && diff / maxRatio > this.ratioThreshold) {
                consistent = false;
                break;
            }
        }
       
        return consistent;
    }

    /**
     * 🔥 Поиск максимального согласованного кластера
     * Используем жадный алгоритм: начинаем с лучшей пары и добавляем согласованные точки
     */
    findMaxConsistentCluster(matrix, data) {
        const n = data.length;
        if (n === 0) return [];
       
        // Находим пару с максимальной согласованностью
        let bestPair = [0, 1];
        let bestScore = matrix[0][1];
       
        for (let i = 0; i < n; i++) {
            for (let j = i+1; j < n; j++) {
                if (matrix[i][j] > bestScore) {
                    bestScore = matrix[i][j];
                    bestPair = [i, j];
                }
            }
        }
       
        // Если даже лучшая пара плохая, возвращаем пустой кластер
        if (bestScore < 0.3) {
            console.log(`   ⚠️ Слишком низкая согласованность, лучшая пара: ${(bestScore*100).toFixed(1)}%`);
            return [];
        }
       
        // Начинаем кластер с лучшей пары
        const cluster = new Set(bestPair);
       
        // Жадно добавляем точки, которые согласованы с большинством в кластере
        let changed;
        do {
            changed = false;
           
            for (let i = 0; i < n; i++) {
                if (cluster.has(i)) continue;
               
                // Считаем, со сколькими точками в кластере согласована точка i
                let agreements = 0;
                for (const j of cluster) {
                    if (matrix[i][j] > 0.5) { // согласована с j
                        agreements++;
                    }
                }
               
                // Если согласована с большинством в кластере, добавляем
                if (agreements > cluster.size / 2) {
                    cluster.add(i);
                    changed = true;
                }
            }
        } while (changed);
       
        return Array.from(cluster);
    }

    /**
     * 🔥 Поиск альтернативных соответствий для отвергнутой точки
     */
    findAlternatives(point, allPoints) {
        const alternatives = [];
       
        // Ищем другие точки модели, которые могли бы подойти
        for (const other of allPoints) {
            if (other.modelId === point.modelId) continue;
           
            // Проверяем геометрическую согласованность с другими точками
            let consistentCount = 0;
            let checkCount = 0;
           
            for (const ref of allPoints) {
                if (ref.modelId === point.modelId || ref.modelId === other.modelId) continue;
               
                if (this.checkTriangleConsistency(point, other, ref)) {
                    consistentCount++;
                }
                checkCount++;
            }
           
            const score = checkCount > 0 ? consistentCount / checkCount : 0;
           
            if (score > 0.5) {
                alternatives.push({
                    pointB: other.modelId,
                    score: score,
                    reason: 'geometric_alternative'
                });
            }
        }
       
        return alternatives.sort((a, b) => b.score - a.score).slice(0, 3);
    }

    /**
     * 🔥 Евклидово расстояние
     */
    distance(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return Math.sqrt(dx*dx + dy*dy);
    }
}

module.exports = GeometricValidator;
