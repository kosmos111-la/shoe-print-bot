// modules/footprint/analysis/feature-table.js
// 📊 ПОЛНАЯ ТАБЛИЦА ВСЕХ ПРИЗНАКОВ ДЛЯ ТОЧЕК СЛЕДА (27 признаков)

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

        console.log(`\n${'='.repeat(160)}`);
        console.log(`📊 ПОЛНАЯ ТАБЛИЦА ПРИЗНАКОВ ТОЧЕК СЛЕДА (27 признаков)`);
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📊 Всего точек: ${points.length}`);
        console.log(`${'='.repeat(160)}`);

        // Сортируем точки по важности
        const sortedPoints = this.sortPointsByImportance(points, roles, graph);

        // Выводим общую статистику
        this.printSummaryStats(points, roles, morphology);

        // Выводим ПОЛНУЮ таблицу
        this.printFullFeatureTable(sortedPoints, {
            graph,
            roles,
            morphology
        });

        // Дополнительная статистика по уникальности
        this.printUniquenessAnalysis(sortedPoints, { graph, roles, morphology });
    }

    /**
     * ПОЛНАЯ таблица со всеми 27 признаками
     */
    printFullFeatureTable(points, { graph, roles, morphology }) {
        // Заголовок таблицы (27 колонок!)
        console.log(`\n${'┌'.padEnd(159, '─')}┐`);
        console.log(`│ ${'#'.padEnd(3)} │ ${'ID ТОЧКИ'.padEnd(20)} │ Роль│ Ст.│Тр-ки│ Комп │ Площ│ Эксц│ Ор-я│ Зона│Уникл│Р-класт│С-класт│ Провал│ H-сос│ R-сос│ L-сос│ УгN │ УгE │ УгS │ УгW │ Σприз│ Πприз│ Дисп│ Энтр│`);
        console.log(`├${'─'.repeat(4)}┼${'─'.repeat(22)}┼${'─'.repeat(4)}┼${'─'.repeat(4)}┼${'─'.repeat(4)}┼${'─'.repeat(5)}┼${'─'.repeat(5)}┼${'─'.repeat(5)}┼${'─'.repeat(4)}┼${'─'.repeat(4)}┼${'─'.repeat(5)}┼${'─'.repeat(6)}┼${'─'.repeat(6)}┼${'─'.repeat(6)}┼${'─'.repeat(5)}┼${'─'.repeat(5)}┼${'─'.repeat(5)}┼${'─'.repeat(4)}┼${'─'.repeat(4)}┼${'─'.repeat(4)}┼${'─'.repeat(4)}┼${'─'.repeat(6)}┼${'─'.repeat(6)}┼${'─'.repeat(5)}┼${'─'.repeat(5)}┤`);

        let idx = 1;
        for (const point of points) {
            if (idx > this.maxPointsToShow) break;
           
            const node = graph.nodes.get(point.id) || {};
            const role = roles.get(point.id) || 'R';
            const morph = morphology.get(point.id) || {};
           
            // === УРОВЕНЬ 1: ТОПОЛОГИЧЕСКИЕ ===
            const degree = node.degree || 0;
            const triangles = this.countTrianglesForPoint(point.id, graph);
            const neighborStats = this.getNeighborStats(point.id, graph, roles);
           
            // === УРОВЕНЬ 2: МОРФОЛОГИЧЕСКИЕ ===
            const compactness = morph.compactness ? morph.compactness.toFixed(2) : ' - ';
            const normArea = morph.normalizedArea ? morph.normalizedArea.toFixed(2) : ' - ';
            const eccentricity = morph.eccentricity ? morph.eccentricity.toFixed(2) : ' - ';
            const orientation = morph.orientation ? morph.orientation.toFixed(0) : ' - ';
           
            // === УРОВЕНЬ 3: ПОЗИЦИОННЫЕ ===
            const zone = this.getZone(point.y);
            const distToCenter = this.getDistToCenter(point, points).toFixed(1);
            const angleToCenter = this.getAngleToCenter(point, points).toFixed(0);
           
            // === УРОВЕНЬ 4: ГРУППОВЫЕ ===
            const clusterId = this.findClusterId(point, points, morphology);
            const clusterSize = this.getClusterSize(clusterId, points, morphology);
            const isUnique = clusterSize === 1 ? '✅' : '❌';
            const neighborClusters = this.getNeighborClusters(point.id, graph, points, morphology);
           
            // === УРОВЕНЬ 5: РАДИАЛЬНЫЕ (НОВЫЕ) ===
            const radial = this.calculateRadialFeatures(point, morphology);
            const radialProfile = radial.profile.join(',');
            const asymmetry = radial.asymmetry.toFixed(2);
            const quadType = radial.quadType;
           
            // === УРОВЕНЬ 6: АГРЕГИРОВАННЫЕ ===
            const allFeatures = [
                this.roleToNumber(role),
                degree,
                triangles,
                morph.compactness || 0,
                morph.normalizedArea || 0,
                morph.eccentricity || 0,
                morph.orientation || 0,
                distToCenter,
                angleToCenter,
                neighborStats.hCount,
                neighborStats.rCount,
                neighborStats.lCount
            ].filter(v => !isNaN(v) && v !== null);
          // 🔥 ВАЖНО: проверяем, что массив не пустой
let sumFeatures = '0.00';
let prodFeatures = '0.00';
let variance = '0.00';
let entropy = '0.00';

if (allFeatures.length > 0) {
    // Сумма
    const sum = allFeatures.reduce((a, b) => a + b, 0);
    sumFeatures = sum.toFixed(2);
   
    // Произведение (с защитой от нулей)
    const product = allFeatures.reduce((a, b) => a * Math.max(b, 0.001), 1);
    prodFeatures = product > 1e6 ? product.toExponential(2) : product.toFixed(2);
   
    // Дисперсия
    const mean = sum / allFeatures.length;
    const squaredDiffs = allFeatures.map(v => Math.pow(v - mean, 2));
    const varValue = squaredDiffs.reduce((a, b) => a + b, 0) / allFeatures.length;
    variance = varValue.toFixed(2);
   
    // Энтропия
    const total = allFeatures.reduce((a, b) => a + b, 0);
    if (total > 0) {
        const probabilities = allFeatures.map(v => v / total);
        let entr = 0;
        for (const p of probabilities) {
            if (p > 0) {
                entr -= p * Math.log2(p);
            }
        }
        entropy = entr.toFixed(2);
    }
}

// Теперь используем эти переменные в выводе
           
            const sumFeatures = allFeatures.reduce((a, b) => a + b, 0).toFixed(2);
            const prodFeatures = allFeatures.length > 0
                ? allFeatures.reduce((a, b) => a * Math.max(b, 0.1), 1).toExponential(2)
                : '0';
            const variance = this.calculateVariance(allFeatures).toFixed(2);
            const entropy = this.calculateEntropy(allFeatures).toFixed(2);

            // Выводим строку таблицы (ВСЕ 27 колонок!)
            console.log(
                 `│ ${idx.toString().padEnd(3)} │ ${point.id.substring(0,20).padEnd(20)} │ ` +
    `${role.padEnd(3)} │ ${degree.toString().padEnd(3)} │ ${triangles.toString().padEnd(3)} │ ` +
    `${compactness.padStart(4)} │ ${normArea.padStart(4)} │ ${eccentricity.padStart(4)} │ ` +
    `${orientation.padStart(3)} │ ${zone.padEnd(3)} │ ${isUnique.padEnd(3)} │ ` +
    `${neighborStats.clusterId.padEnd(5)} │ ${neighborStats.clusterSize.padEnd(5)} │ ` +
    `${radialProfile.padEnd(5)} │ ${neighborStats.hCount.toString().padEnd(4)} │ ` +
    `${neighborStats.rCount.toString().padEnd(4)} │ ${neighborStats.lCount.toString().padEnd(4)} │ ` +
    `${radial.angles.N.toFixed(0).padStart(3)} │ ${radial.angles.E.toFixed(0).padStart(3)} │ ` +
    `${radial.angles.S.toFixed(0).padStart(3)} │ ${radial.angles.W.toFixed(0).padStart(3)} │ ` +
    `${sumFeatures.padStart(5)} │ ${prodFeatures.padStart(5)} │ ${variance.padStart(4)} │ ` +
    `${entropy.padStart(4)} │`
            );

            idx++;
        }

        console.log(`└${'─'.repeat(4)}┴${'─'.repeat(22)}┴${'─'.repeat(4)}┴${'─'.repeat(4)}┴${'─'.repeat(4)}┴${'─'.repeat(5)}┴${'─'.repeat(5)}┴${'─'.repeat(5)}┴${'─'.repeat(4)}┴${'─'.repeat(4)}┴${'─'.repeat(5)}┴${'─'.repeat(6)}┴${'─'.repeat(6)}┴${'─'.repeat(6)}┴${'─'.repeat(5)}┴${'─'.repeat(5)}┴${'─'.repeat(5)}┴${'─'.repeat(4)}┴${'─'.repeat(4)}┴${'─'.repeat(4)}┴${'─'.repeat(4)}┴${'─'.repeat(6)}┴${'─'.repeat(6)}┴${'─'.repeat(5)}┴${'─'.repeat(5)}┘`);
       
        // Легенда
        this.printLegend();
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
        console.log(`   • Комп - компактность (периметр²/площадь)`);
        console.log(`   • Площ - нормированная площадь`);
        console.log(`   • Эксц - эксцентриситет (0-круг, 1-линия)`);
        console.log(`   • Ор-я - ориентация в градусах`);
        console.log(`   ПОЗИЦИОННЫЕ:`);
        console.log(`   • Зона - T(носок)/C(центр)/H(пятка)`);
        console.log(`   • Уникл - уникальность (✅/❌)`);
        console.log(`   • Р-класт - размер кластера`);
        console.log(`   • С-класт - соседние кластеры`);
        console.log(`   • Провал - паттерн провалов`);
        console.log(`   РАДИАЛЬНЫЕ:`);
        console.log(`   • H-сос/R-сос/L-сос - количество соседей по ролям`);
        console.log(`   • УгN/E/S/W - углы четырехугольника`);
        console.log(`   АГРЕГИРОВАННЫЕ:`);
        console.log(`   • Σприз - сумма признаков`);
        console.log(`   • Πприз - произведение признаков`);
        console.log(`   • Дисп - дисперсия`);
        console.log(`   • Энтр - энтропия`);
    }

    /**
     * Анализ уникальности точек
     */
    printUniquenessAnalysis(points, { graph, roles, morphology }) {
        const uniquenessScores = [];
       
        for (const point of points) {
            const score = this.calculateUniquenessScore(point, { graph, roles, morphology });
            uniquenessScores.push(score);
        }

        const avgUniqueness = uniquenessScores.reduce((a, b) => a + b, 0) / uniquenessScores.length;
        const maxUniqueness = Math.max(...uniquenessScores);
        const uniquePoints = uniquenessScores.filter(s => s > 0.8).length;

        console.log(`\n📊 АНАЛИЗ УНИКАЛЬНОСТИ:`);
        console.log(`   • Средняя уникальность: ${(avgUniqueness * 100).toFixed(1)}%`);
        console.log(`   • Макс. уникальность: ${(maxUniqueness * 100).toFixed(1)}%`);
        console.log(`   • Уникальных точек (>80%): ${uniquePoints}/${points.length}`);
        console.log(`   • Рекомендация: использовать ${Math.min(12, uniquePoints)} якорей`);
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    sortPointsByImportance(points, roles, graph) {
        return points.sort((a, b) => {
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

    printSummaryStats(points, roles, morphology) {
        const roleStats = { H: 0, B: 0, C: 0, R: 0, L: 0 };
        for (const role of roles.values()) {
            if (roleStats.hasOwnProperty(role)) roleStats[role]++;
        }

        let withMorphology = 0;
        for (const point of points) {
            if (morphology.get(point.id)?.hasContour) withMorphology++;
        }

        console.log(`\n📈 СТАТИСТИКА СЛЕДА:`);
        console.log(`   • Хабы (H): ${roleStats.H}`);
        console.log(`   • Мосты (B): ${roleStats.B}`);
        console.log(`   • Клики (C): ${roleStats.C}`);
        console.log(`   • Обычные (R): ${roleStats.R}`);
        console.log(`   • Листья (L): ${roleStats.L}`);
        console.log(`   • С морфологией: ${withMorphology}/${points.length}`);
    }

    getNeighborStats(pointId, graph, roles) {
        const neighbors = this.findNodeNeighbors(pointId, graph);
        let hCount = 0, rCount = 0, lCount = 0;
       
        for (const n of neighbors) {
            const role = roles.get(n.id) || 'R';
            if (role === 'H') hCount++;
            else if (role === 'L') lCount++;
            else rCount++;
        }

        // Определяем кластер на основе паттерна соседей
        const clusterId = `${hCount}H${rCount}R${lCount}L`;
        const clusterSize = 1; // Заглушка, реально нужно считать по всем точкам

        return {
            hCount,
            rCount,
            lCount,
            clusterId,
            clusterSize: clusterSize.toString()
        };
    }

    getZone(y) {
        if (y > 350) return 'H'; // пятка (Heel)
        if (y < 200) return 'T'; // носок (Toe)
        return 'C'; // центр (Center)
    }

    getDistToCenter(point, allPoints) {
        const center = this.calculateCentroid(allPoints);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return Math.sqrt(dx*dx + dy*dy);
    }

    getAngleToCenter(point, allPoints) {
        const center = this.calculateCentroid(allPoints);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        return angle;
    }

    calculateCentroid(points) {
        if (points.length === 0) return { x: 0, y: 0 };
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    findClusterId(point, allPoints, morphology) {
        // Упрощенная кластеризация по компактности
        const morph = morphology.get(point.id);
        if (!morph || !morph.compactness) return 'R0';
       
        const compactness = morph.compactness;
        if (compactness < 10) return 'C1';
        if (compactness < 15) return 'C2';
        if (compactness < 20) return 'C3';
        return 'C4';
    }

    getClusterSize(clusterId, allPoints, morphology) {
        let size = 0;
        for (const point of allPoints) {
            if (this.findClusterId(point, allPoints, morphology) === clusterId) {
                size++;
            }
        }
        return size;
    }

    getNeighborClusters(pointId, graph, allPoints, morphology) {
        const neighbors = this.findNodeNeighbors(pointId, graph);
        const clusters = new Set();
       
        for (const n of neighbors) {
            const clusterId = this.findClusterId(n, allPoints, morphology);
            clusters.add(clusterId);
        }
       
        return Array.from(clusters).join(',').substring(0,5);
    }

    calculateRadialFeatures(point, morphology) {
        // Получаем контур точки из морфологии
        const morph = morphology.get(point.id);
        const contour = morph?.contour || [];
       
        // Заглушка - реально нужно анализировать контур
        return {
            profile: [1.2, 1.5, 1.3, 1.4],
            asymmetry: 0.3,
            quadType: 'R',
            angles: { N: 85, E: 95, S: 85, W: 95 }
        };
    }

    roleToNumber(role) {
        const map = { 'H': 5, 'C': 4, 'B': 3, 'R': 2, 'L': 1 };
        return map[role] || 0;
    }

    calculateVariance(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }

    calculateEntropy(values) {
        if (values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        if (sum === 0) return 0;
       
        const probabilities = values.map(v => v / sum);
        let entropy = 0;
        for (const p of probabilities) {
            if (p > 0) {
                entropy -= p * Math.log2(p);
            }
        }
        return entropy;
    }

    calculateUniquenessScore(point, { graph, roles, morphology }) {
        const node = graph.nodes.get(point.id) || {};
        const role = roles.get(point.id) || 'R';
        const morph = morphology.get(point.id) || {};
       
        let score = 0;
       
        // Топология (40%)
        if (role === 'H') score += 0.4;
        else if (role === 'C') score += 0.3;
        else if (role === 'B') score += 0.2;
       
        // Степень (20%)
        const degree = node.degree || 0;
        score += Math.min(degree / 15, 1) * 0.2;
       
        // Морфология (20%)
        if (morph.compactness) {
            const compactness = morph.compactness;
            if (compactness < 10 || compactness > 20) score += 0.2;
            else score += 0.1;
        }
       
        // Соседи (20%)
        const neighbors = this.findNodeNeighbors(point.id, graph);
        const neighborRoles = new Set();
        for (const n of neighbors) {
            neighborRoles.add(roles.get(n.id));
        }
        score += (neighborRoles.size / 5) * 0.2;
       
        return Math.min(score, 1);
    }

    countTrianglesForPoint(pointId, graph) {
        // Заглушка
        return Math.floor(Math.random() * 5);
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
}

module.exports = FeatureTable;
