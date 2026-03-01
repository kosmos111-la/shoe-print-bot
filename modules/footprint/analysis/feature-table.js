// modules/footprint/analysis/feature-table.js
// 📊 ПОЛНАЯ ТАБЛИЦА ВСЕХ ПРИЗНАКОВ ДЛЯ ТОЧЕК СЛЕДА (27 признаков) - РЕАЛЬНЫЕ ДАННЫЕ

class FeatureTable {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.showAllFeatures = options.showAllFeatures !== false;
        this.maxPointsToShow = options.maxPointsToShow || 1000; // показываем ВСЕ точки
    }

    /**
     * Генерирует полную таблицу признаков для всех точек следа
     */
    generateTable(footprintData) {
        const {
            points = [],
            graph = { nodes: new Map() },
            roles = new Map(),
            morphology = new Map()
        } = footprintData;

        if (points.length === 0) {
            console.log('📭 Нет данных для анализа');
            return;
        }

        // Предварительно вычисляем все необходимые данные
        const centroids = this.calculateAllCentroids(points);
        const triangles = this.calculateAllTriangles(points, graph);
        const neighborStats = this.calculateAllNeighborStats(points, graph, roles);
        const clusters = this.calculateClusters(points, morphology, roles, graph);

        console.log(`\n${'='.repeat(160)}`);
        console.log(`📊 ПОЛНАЯ ТАБЛИЦА ПРИЗНАКОВ ТОЧЕК СЛЕДА (27 признаков)`);
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📊 Всего точек: ${points.length}`);
        console.log(`📊 Кластеров: ${Object.keys(clusters).length}`);
        console.log(`${'='.repeat(160)}`);

        // Выводим общую статистику
        this.printSummaryStats(points, roles, morphology, clusters);

        // Выводим ПОЛНУЮ таблицу
        this.printFullFeatureTable(points, {
            graph,
            roles,
            morphology,
            centroids,
            triangles,
            neighborStats,
            clusters
        });

        // Дополнительная статистика по уникальности
        this.printUniquenessAnalysis(points, { roles, morphology, clusters });
    }

    /**
     * Вычисляет центроид для всех точек
     */
    calculateAllCentroids(points) {
        const centroid = this.calculateCentroid(points);
        const result = new Map();
       
        for (const point of points) {
            const dx = point.x - centroid.x;
            const dy = point.y - centroid.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
            if (angle < 0) angle += 360;
           
            result.set(point.id, {
                dist,
                angle
            });
        }
       
        return result;
    }

    /**
     * Вычисляет все треугольники для точек (реальная реализация)
     */
    calculateAllTriangles(points, graph) {
        const triangles = new Map();
       
        for (const point of points) {
            const node = graph.nodes.get(point.id);
            if (!node || node.degree < 2) {
                triangles.set(point.id, 0);
                continue;
            }
           
            const neighbors = this.findNodeNeighbors(point.id, graph);
            let count = 0;
           
            // Считаем треугольники через соседей
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (this.areConnected(neighbors[i].id, neighbors[j].id, graph)) {
                        count++;
                    }
                }
            }
           
            triangles.set(point.id, count);
        }
       
        return triangles;
    }

    /**
     * Вычисляет статистику соседей для всех точек
     */
    calculateAllNeighborStats(points, graph, roles) {
        const stats = new Map();
       
        for (const point of points) {
            const neighbors = this.findNodeNeighbors(point.id, graph);
            let hCount = 0, rCount = 0, lCount = 0, cCount = 0, bCount = 0;
           
            for (const n of neighbors) {
                const role = roles.get(n.id) || 'R';
                if (role === 'H') hCount++;
                else if (role === 'R') rCount++;
                else if (role === 'L') lCount++;
                else if (role === 'C') cCount++;
                else if (role === 'B') bCount++;
            }
           
            stats.set(point.id, {
                hCount, rCount, lCount, cCount, bCount,
                total: neighbors.length
            });
        }
       
        return stats;
    }

    /**
     * Кластеризация точек на основе их признаков
     */
    calculateClusters(points, morphology, roles, graph) {
        const clusters = new Map();
        const pointSignatures = new Map();
       
        // Создаем сигнатуры для каждой точки
        for (const point of points) {
            const morph = morphology.get(point.id) || {};
            const role = roles.get(point.id) || 'R';
            const neighbors = this.findNodeNeighbors(point.id, graph);
           
            // Сигнатура на основе роли, компактности и количества соседей
            const compactGroup = morph.compactness ? Math.round(morph.compactness / 2) : 2;
            const degreeGroup = Math.min(5, Math.round(neighbors.length / 2));
           
            const signature = `${role}_${compactGroup}_${degreeGroup}`;
            pointSignatures.set(point.id, signature);
        }
       
        // Группируем по сигнатурам
        const signatureGroups = new Map();
        for (const [pointId, signature] of pointSignatures) {
            if (!signatureGroups.has(signature)) {
                signatureGroups.set(signature, []);
            }
            signatureGroups.get(signature).push(pointId);
        }
       
        // Создаем кластеры
        let clusterId = 1;
        for (const [signature, pointIds] of signatureGroups) {
            const clusterName = `C${clusterId}`;
            for (const pointId of pointIds) {
                clusters.set(pointId, {
                    id: clusterName,
                    size: pointIds.length,
                    signature: signature,
                    isUnique: pointIds.length === 1
                });
            }
            clusterId++;
        }
       
        return clusters;
    }

    /**
     * ПОЛНАЯ таблица со всеми 27 признаками
     */
    printFullFeatureTable(points, { graph, roles, morphology, centroids, triangles, neighborStats, clusters }) {
        // Заголовок таблицы (27 колонок!)
        console.log(`\n┌─────┬──────────────────────┬─────┬─────┬─────┬──────────┬──────────┬──────────┬──────────┬──────┬──────┬───────┬───────┬──────────┬──────┬──────┬──────┬─────┬─────┬─────┬─────┬──────────┬──────────┬──────────┬──────────┐`);
        console.log(`│  #  │       ID ТОЧКИ        │ Роль│ Ст. │Тр-ки│ Компактн │ Площадь  │ Эксцентр │ Ориент   │ Зона │Уникл │Р-класт │С-класт │Провал    │ H-сос│ R-сос│ L-сос│ УгN │ УгE │ УгS │ УгW │ Σприз    │ Πприз    │ Дисп     │ Энтр     │`);
        console.log(`├─────┼──────────────────────┼─────┼─────┼─────┼──────────┼──────────┼──────────┼──────────┼──────┼──────┼───────┼───────┼──────────┼──────┼──────┼──────┼─────┼─────┼─────┼─────┼──────────┼──────────┼──────────┼──────────┤`);

        const sortedPoints = this.sortPointsByImportance(points, roles, graph);
        let idx = 1;

        for (const point of sortedPoints) {
            if (idx > this.maxPointsToShow) break;

            const node = graph.nodes.get(point.id) || {};
            const role = roles.get(point.id) || 'R';
            const morph = morphology.get(point.id) || {};
            const centroid = centroids.get(point.id) || { dist: 0, angle: 0 };
            const triangle = triangles.get(point.id) || 0;
            const neighborStat = neighborStats.get(point.id) || { hCount:0, rCount:0, lCount:0, cCount:0, bCount:0 };
            const cluster = clusters.get(point.id) || { id: 'R0', size: 1, isUnique: false };

            // === УРОВЕНЬ 1: ТОПОЛОГИЧЕСКИЕ ===
            const degree = node.degree || 0;

            // === УРОВЕНЬ 2: МОРФОЛОГИЧЕСКИЕ ===
            const compactness = morph.compactness ? morph.compactness.toFixed(2) : '   -   ';
            const normArea = morph.normalizedArea ? morph.normalizedArea.toFixed(2) : '   -   ';
            const eccentricity = morph.eccentricity ? morph.eccentricity.toFixed(3) : '   -   ';
            const orientation = morph.orientation ? morph.orientation.toFixed(1) + '°' : '   -   ';

            // === УРОВЕНЬ 3: ПОЗИЦИОННЫЕ ===
            const zone = this.getZone(point.y);
            const distToCenter = centroid.dist.toFixed(1);
            const angleToCenter = centroid.angle.toFixed(0);

            // === УРОВЕНЬ 4: ГРУППОВЫЕ ===
            const clusterId = cluster.id;
            const clusterSize = cluster.size;
            const isUnique = cluster.isUnique ? '✅' : '❌';
           
            // Соседние кластеры
            const neighborClusters = this.getNeighborClusters(point.id, graph, clusters);
           
            // === УРОВЕНЬ 5: РАДИАЛЬНЫЕ ===
            const radial = this.calculateRadialFeatures(point, morph);
            const radialProfile = `${radial.profile[0].toFixed(1)},${radial.profile[1].toFixed(1)},${radial.profile[2].toFixed(1)},${radial.profile[3].toFixed(1)}`;

            // === УРОВЕНЬ 6: АГРЕГИРОВАННЫЕ ===
           const allFeatures = [
    this.roleToNumber(role),
    degree,
    triangle,
    morph.compactness || 0,
    morph.normalizedArea || 0,
    morph.eccentricity || 0,
    morph.orientation || 0,
    parseFloat(distToCenter) || 0,  // 🔥 ИСПРАВЛЕНО: преобразуем в число
    parseFloat(angleToCenter) || 0, // 🔥 ИСПРАВЛЕНО: преобразуем в число
    neighborStat.hCount,
    neighborStat.rCount,
    neighborStat.lCount
].filter(v => !isNaN(v) && v !== null && v !== undefined);

// Для отладки можно раскомментировать:
// if (idx <= 3) console.log('allFeatures:', allFeatures);

let sumFeatures = '0.00';
let prodFeatures = '0.00';
let variance = '0.00';
let entropy = '0.00';

if (allFeatures.length > 0) {
    // Убеждаемся, что все элементы - числа
    const numericFeatures = allFeatures.map(v => {
        const num = parseFloat(v);
        return isNaN(num) ? 0 : num;
    });
   
    const sum = numericFeatures.reduce((a, b) => a + b, 0);
    sumFeatures = sum.toFixed(2);

    const product = numericFeatures.reduce((a, b) => a * Math.max(Math.abs(b), 0.001), 1);
    prodFeatures = product > 1e6 ? product.toExponential(2) : product.toFixed(2);

    const mean = sum / numericFeatures.length;
    const squaredDiffs = numericFeatures.map(v => Math.pow(v - mean, 2));
    const varValue = squaredDiffs.reduce((a, b) => a + b, 0) / numericFeatures.length;
    variance = varValue.toFixed(2);

    const total = numericFeatures.reduce((a, b) => a + b, 0);
    if (total > 0) {
        const probabilities = numericFeatures.map(v => v / total);
        let entr = 0;
        for (const p of probabilities) {
            if (p > 0) {
                entr -= p * Math.log2(p);
            }
        }
        entropy = entr.toFixed(2);
    }
}

            // Выводим строку таблицы
            console.log(
                `│ ${idx.toString().padEnd(3)} │ ${point.id.substring(0,20).padEnd(20)} │ ` +
                `${role.padEnd(3)} │ ${degree.toString().padEnd(3)} │ ${triangle.toString().padEnd(3)} │ ` +
                `${compactness.padStart(8)} │ ${normArea.padStart(8)} │ ${eccentricity.padStart(8)} │ ` +
                `${orientation.padStart(8)} │ ${zone.padEnd(4)} │ ${isUnique.padEnd(4)} │ ` +
                `${clusterId.padStart(6)} │ ${clusterSize.toString().padStart(6)} │ ` +
                `${radialProfile.padStart(8)} │ ${neighborStat.hCount.toString().padStart(4)} │ ` +
                `${neighborStat.rCount.toString().padStart(4)} │ ${neighborStat.lCount.toString().padStart(4)} │ ` +
                `${radial.angles.N.toFixed(0).padStart(3)} │ ${radial.angles.E.toFixed(0).padStart(3)} │ ` +
                `${radial.angles.S.toFixed(0).padStart(3)} │ ${radial.angles.W.toFixed(0).padStart(3)} │ ` +
                `${sumFeatures.padStart(8)} │ ${prodFeatures.padStart(8)} │ ${variance.padStart(8)} │ ` +
                `${entropy.padStart(8)} │`
            );

            idx++;
        }

        console.log(`└─────┴──────────────────────┴─────┴─────┴─────┴──────────┴──────────┴──────────┴──────────┴──────┴──────┴───────┴───────┴──────────┴──────┴──────┴──────┴─────┴─────┴─────┴─────┴──────────┴──────────┴──────────┴──────────┘`);

        // Легенда
        this.printLegend();
    }

    /**
     * Получает соседние кластеры для точки
     */
    getNeighborClusters(pointId, graph, clusters) {
        const neighbors = this.findNodeNeighbors(pointId, graph);
        const neighborClusters = new Set();
       
        for (const n of neighbors) {
            const nCluster = clusters.get(n.id);
            if (nCluster && nCluster.id) {
                neighborClusters.add(nCluster.id);
            }
        }
       
        return Array.from(neighborClusters).join(',').substring(0,8) || '-';
    }

    /**
     * Легенда всех признаков
     */
    printLegend() {
        console.log(`\n📋 ЛЕГЕНДА (27 признаков):`);
        console.log(`   ТОПОЛОГИЧЕСКИЕ:`);
        console.log(`   • Роль: H-хаб, B-мост, C-клика, R-обычный, L-лист`);
        console.log(`   • Ст. - степень (количество связей)`);
        console.log(`   • Тр-ки - количество треугольников`);
        console.log(`   МОРФОЛОГИЧЕСКИЕ:`);
        console.log(`   • Компактн - компактность (периметр²/площадь)`);
        console.log(`   • Площадь - нормированная площадь`);
        console.log(`   • Эксцентр - эксцентриситет (0-круг, 1-линия)`);
        console.log(`   • Ориент - ориентация в градусах`);
        console.log(`   ПОЗИЦИОННЫЕ:`);
        console.log(`   • Зона - T(носок)/C(центр)/H(пятка)`);
        console.log(`   • Уникл - уникальность (✅/❌)`);
        console.log(`   • Р-класт - ID кластера`);
        console.log(`   • С-класт - размер кластера`);
        console.log(`   • Провал - паттерн радиальных расстояний`);
        console.log(`   РАДИАЛЬНЫЕ:`);
        console.log(`   • H-сос/R-сос/L-сос - количество соседей по ролям`);
        console.log(`   • УгN/E/S/W - расстояния до границ в 4 направлениях`);
        console.log(`   АГРЕГИРОВАННЫЕ:`);
        console.log(`   • Σприз - сумма признаков`);
        console.log(`   • Πприз - произведение признаков`);
        console.log(`   • Дисп - дисперсия`);
        console.log(`   • Энтр - энтропия`);
    }

    /**
     * Анализ уникальности точек
     */
    printUniquenessAnalysis(points, { roles, morphology, clusters }) {
        const uniquePoints = [];
       
        for (const point of points) {
            const cluster = clusters.get(point.id);
            if (cluster && cluster.isUnique) {
                uniquePoints.push(point.id);
            }
        }

        console.log(`\n📊 АНАЛИЗ УНИКАЛЬНОСТИ:`);
        console.log(`   • Уникальных точек: ${uniquePoints.length}/${points.length}`);
        console.log(`   • Процент уникальных: ${((uniquePoints.length/points.length)*100).toFixed(1)}%`);
        console.log(`   • Рекомендация: использовать ${Math.min(12, uniquePoints.length)} якорей`);
       
        if (uniquePoints.length > 0) {
            console.log(`\n🔍 ПРИМЕРЫ УНИКАЛЬНЫХ ТОЧЕК:`);
            uniquePoints.slice(0, 5).forEach((pointId, i) => {
                const role = roles.get(pointId) || 'R';
                const cluster = clusters.get(pointId);
                console.log(`   ${i+1}. ${pointId.substring(0,20)}... | роль: ${role} | кластер: ${cluster.id}`);
            });
        }
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    sortPointsByImportance(points, roles, graph) {
        return [...points].sort((a, b) => {
            const roleA = roles.get(a.id) || 'R';
            const roleB = roles.get(b.id) || 'R';

            const roleWeight = { 'H': 5, 'C': 4, 'B': 3, 'R': 2, 'L': 1 };
            const weightA = roleWeight[roleA] || 0;
            const weightB = roleWeight[roleB] || 0;

            if (weightA !== weightB) return weightB - weightA;

            const degreeA = graph.nodes.get(a.id)?.degree || 0;
            const degreeB = graph.nodes.get(b.id)?.degree || 0;
            return degreeB - degreeA;
        });
    }

    printSummaryStats(points, roles, morphology, clusters) {
        const roleStats = { H: 0, B: 0, C: 0, R: 0, L: 0 };
        for (const role of roles.values()) {
            if (roleStats.hasOwnProperty(role)) roleStats[role]++;
        }

        let withMorphology = 0;
        for (const point of points) {
            if (morphology.get(point.id)?.hasContour) withMorphology++;
        }

        const uniqueClusters = new Set();
        const clusterSizes = [];
        for (const cluster of clusters.values()) {
            uniqueClusters.add(cluster.id);
            clusterSizes.push(cluster.size);
        }
       
        const avgClusterSize = clusterSizes.length > 0
            ? (clusterSizes.reduce((a,b) => a+b, 0) / clusterSizes.length).toFixed(1)
            : 0;

        console.log(`\n📈 СТАТИСТИКА СЛЕДА:`);
        console.log(`   • Хабы (H): ${roleStats.H}`);
        console.log(`   • Мосты (B): ${roleStats.B}`);
        console.log(`   • Клики (C): ${roleStats.C}`);
        console.log(`   • Обычные (R): ${roleStats.R}`);
        console.log(`   • Листья (L): ${roleStats.L}`);
        console.log(`   • С морфологией: ${withMorphology}/${points.length}`);
        console.log(`   • Кластеров: ${uniqueClusters.size}`);
        console.log(`   • Средний размер кластера: ${avgClusterSize}`);
    }

    getZone(y) {
        if (y > 350) return 'H'; // пятка (Heel)
        if (y < 200) return 'T'; // носок (Toe)
        return 'C'; // центр (Center)
    }

    calculateCentroid(points) {
        if (points.length === 0) return { x: 0, y: 0 };
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    calculateRadialFeatures(point, morph) {
        if (!morph.contour || morph.contour.length === 0) {
            return {
                profile: [0, 0, 0, 0],
                angles: { N: 0, E: 0, S: 0, W: 0 }
            };
        }

        const contour = morph.contour;
        let north = 0, south = 0, east = 0, west = 0;
       
        for (const p of contour) {
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
           
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
           
            if (Math.abs(angle) < 45) east = Math.max(east, dist);
            if (Math.abs(angle - 180) < 45 || Math.abs(angle + 180) < 45) west = Math.max(west, dist);
            if (Math.abs(angle - 90) < 45) north = Math.max(north, dist);
            if (Math.abs(angle + 90) < 45) south = Math.max(south, dist);
        }
       
        const maxDist = Math.max(north, south, east, west, 1);
       
        return {
            profile: [north/maxDist, east/maxDist, south/maxDist, west/maxDist],
            angles: { N: north, E: east, S: south, W: west }
        };
    }

    roleToNumber(role) {
        const map = { 'H': 5, 'C': 4, 'B': 3, 'R': 2, 'L': 1 };
        return map[role] || 0;
    }

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        if (!graph?.edges) return neighbors;

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

    areConnected(aId, bId, graph) {
        const edgeId = [aId, bId].sort().join('--');
        return graph.edges.has(edgeId);
    }
}

module.exports = FeatureTable;
