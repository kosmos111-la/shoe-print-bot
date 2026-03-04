// modules/footprint/matching/HierarchicalMatcher.js
// 🔥 МНОГОУРОВНЕВЫЙ МАТЧЕР - neighborClusters на последнем уровне

class HierarchicalMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
      
        // 🔥 ИЕРАРХИЯ УРОВНЕЙ
        this.levels = [
            {   // УРОВЕНЬ 1: ПРОФИЛЬ КЛЮЧА (двухтавр)
                name: 'БАЗОВАЯ ГЕОМЕТРИЯ',
                features: ['compactness', 'eccentricity', 'normalizedArea'],
                tolerances: [0.4, 0.15, 0.75],
                groupLevel: true,
                weight: 0.25,
                enabled: true
            },
            {   // УРОВЕНЬ 2: ТИП/ЦВЕТ КЛЮЧА
                name: 'ТОПОЛОГИЧЕСКАЯ РОЛЬ',
                features: ['role', 'degree', 'triangles'],
                tolerances: ['strict', 2, 1],
                groupLevel: false,
                weight: 0.20,
                enabled: true
            },
            {   // УРОВЕНЬ 3: РОЛИ СОСЕДЕЙ (кто рядом)
                name: 'РОЛИ СОСЕДЕЙ',
                features: ['neighborRoles'],
                tolerances: ['soft'],
                groupLevel: false,
                weight: 0.10,
                enabled: true
            },
            {   // УРОВЕНЬ 4: РАЗМЕР ГРУППЫ
                name: 'РАЗМЕР ГРУППЫ',
                features: ['clusterSize'],
                tolerances: [3],
                groupLevel: false,
                weight: 0.10,
                enabled: true
            },
            {   // УРОВЕНЬ 5: КОНТЕКСТ (только gapPattern)
                name: 'КОНТЕКСТ',
                features: ['gapPattern'],
                tolerances: ['soft'],
                groupLevel: false,
                weight: 0.10,
                enabled: true
            },
            {   // УРОВЕНЬ 6: ДЕТАЛЬНАЯ ПРОВЕРКА (с neighborClusters)
                name: 'ДЕТАЛЬНАЯ ПРОВЕРКА',
                features: ['radialProfile', 'patternType', 'patternFrequency', 'neighborClusters'],
                tolerances: [0.3, 'strict', 2, 2],
                groupLevel: true,
                weight: 0.25,
                enabled: true
            }
        ];

        this.featureCache = new Map();
        this.stats = { levels: [], earlyExits: 0, totalPairs: 0 };
    }

    /**
     * ОСНОВНОЙ МЕТОД
     */
    findMatches(pointsA, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔑 МНОГОУРОВНЕВЫЙ ПОДБОР КЛЮЧЕЙ`);
        console.log(`${'='.repeat(100)}`);
        console.log(`📊 Всего ключей (точек) в А: ${pointsA.length}`);
        console.log(`📊 Всего замков (точек) в Б: ${pointsB.length}`);
      
        this.validateFeatures(pointsA, pointsB);
        this.diagnoseFirstPoint(pointsA, pointsB);

        const candidates = this.initializeCandidates(pointsA, pointsB);

        for (let levelIdx = 0; levelIdx < this.levels.length; levelIdx++) {
            const level = this.levels[levelIdx];
            if (!level.enabled) continue;

            console.log(`\n${'─'.repeat(80)}`);
            console.log(`🔍 УРОВЕНЬ ${levelIdx + 1}: ${level.name}`);
            console.log(`${'─'.repeat(80)}`);

            const levelStats = { total: 0, passed: 0, rejected: 0 };

            for (const [pointId, data] of candidates) {
                if (data.status === 'rejected') continue;
              
                const before = data.candidates.length;
                const filtered = this.filterByLevel(data.point, data.candidates, level);

                data.candidates = filtered;
                data.levels.push({
                    level: levelIdx,
                    before,
                    after: filtered.length,
                    rejected: before - filtered.length
                });

                levelStats.total += before;
                levelStats.passed += filtered.length;
                levelStats.rejected += (before - filtered.length);
            }

            this.logLevelStats(level, levelStats, candidates);
            this.printHierarchicalTree(candidates, levelIdx);
          
            if (this.checkEarlyExit(candidates, levelIdx)) {
                console.log(`\n🎯 РАННИЙ ВЫХОД на уровне ${levelIdx + 1}`);
                this.stats.earlyExits++;
                break;
            }
        }

        return this.finalAnalysis(candidates, pointsB);
    }

    /**
     * 🔥 ДИАГНОСТИКА ПРИЗНАКОВ ПЕРВОЙ ТОЧКИ
     */
    diagnoseFirstPoint(pointsA, pointsB) {
        if (pointsA.length === 0 || pointsB.length === 0) return;
       
        const firstPointA = pointsA[0];
        const firstPointB = pointsB[0];
       
        console.log(`\n🔬 ДИАГНОСТИКА ПРИЗНАКОВ (ПЕРВАЯ ТОЧКА):`);
        console.log(`┌───────────────────┬─────────────────────┬─────────────────────┐`);
        console.log(`│ Признак           │ Точка А             │ Точка Б             │`);
        console.log(`├───────────────────┼─────────────────────┼─────────────────────┤`);
       
        const features = [
            'id', 'role', 'degree', 'triangles',
            'compactness', 'eccentricity', 'normalizedArea',
            'radialProfile', 'neighborRoles', 'clusterId',
            'clusterSize', 'patternType', 'patternFrequency',
            'gapPattern', 'neighborClusters'
        ];
       
        for (const feat of features) {
            const valA = firstPointA[feat];
            const valB = firstPointB[feat];
           
            let strA = valA !== undefined ? String(valA) : 'undefined';
            let strB = valB !== undefined ? String(valB) : 'undefined';
           
            if (strA.length > 20) strA = strA.substring(0, 17) + '...';
            if (strB.length > 20) strB = strB.substring(0, 17) + '...';
           
            console.log(
                `│ ${feat.padEnd(17)} │ ${strA.padEnd(19)} │ ${strB.padEnd(19)} │`
            );
        }
       
        console.log(`└───────────────────┴─────────────────────┴─────────────────────┘`);
       
        if (Array.isArray(firstPointA.radialProfile) && Array.isArray(firstPointB.radialProfile)) {
            const sortedA = this.getRotationInvariantProfile(firstPointA.radialProfile);
            const sortedB = this.getRotationInvariantProfile(firstPointB.radialProfile);
           
            console.log(`\n🔍 radialProfile ПОСЛЕ СОРТИРОВКИ:`);
            console.log(`   Точка А: [${sortedA.map(v => v.toFixed(2)).join(', ')}]`);
            console.log(`   Точка Б: [${sortedB.map(v => v.toFixed(2)).join(', ')}]`);
           
            let sum = 0;
            for (let i = 0; i < sortedA.length; i++) {
                sum += Math.abs(sortedA[i] - sortedB[i]);
            }
            const similarity = 1 - (sum / sortedA.length);
            console.log(`   🔥 Сходство после сортировки: ${(similarity * 100).toFixed(1)}%`);
        }
       
        // Диагностика patternFrequency
        console.log(`\n🔍 patternFrequency:`);
        console.log(`   Точка А: ${firstPointA.patternFrequency} (${typeof firstPointA.patternFrequency})`);
        console.log(`   Точка Б: ${firstPointB.patternFrequency} (${typeof firstPointB.patternFrequency})`);
        console.log(`   Разница: ${Math.abs((firstPointA.patternFrequency || 0) - (firstPointB.patternFrequency || 0))}`);
       
        // Диагностика neighborClusters
        console.log(`\n🔍 neighborClusters:`);
        console.log(`   Точка А: ${firstPointA.neighborClusters} (${typeof firstPointA.neighborClusters})`);
        console.log(`   Точка Б: ${firstPointB.neighborClusters} (${typeof firstPointB.neighborClusters})`);
        console.log(`   Разница: ${Math.abs((firstPointA.neighborClusters || 0) - (firstPointB.neighborClusters || 0))}`);
    }

    /**
     * 🔥 ИНВАРИАНТНЫЙ К ПОВОРОТУ RADIAL PROFILE
     */
    getRotationInvariantProfile(profile) {
        if (!Array.isArray(profile)) return [];
        const mainDirs = profile.slice(0, 4).sort((a, b) => a - b);
        const diagDirs = profile.slice(4, 8).sort((a, b) => a - b);
        return [...mainDirs, ...diagDirs];
    }

    /**
     * ПРОВЕРКА НАЛИЧИЯ ПРИЗНАКОВ
     */
    validateFeatures(pointsA, pointsB) {
        console.log(`\n🔍 ПРОВЕРКА НАЛИЧИЯ ПРИЗНАКОВ:`);
        const allPoints = [...pointsA, ...pointsB];
        const featureStats = {};

        for (const point of allPoints) {
            for (const [key, value] of Object.entries(point)) {
                if (!featureStats[key]) featureStats[key] = { present: 0 };
                if (value !== undefined && value !== null) featureStats[key].present++;
            }
        }

        console.log(`   📊 ДОСТУПНЫЕ ПРИЗНАКИ:`);
        Object.entries(featureStats)
            .sort((a, b) => b[1].present - a[1].present)
            .forEach(([feature, stats]) => {
                const percent = (stats.present / allPoints.length * 100).toFixed(1);
                console.log(`   • ${feature}: ${stats.present}/${allPoints.length} (${percent}%)`);
            });
    }

    initializeCandidates(pointsA, pointsB) {
        const candidates = new Map();
        for (const pointA of pointsA) {
            candidates.set(pointA.id, {
                point: pointA,
                candidates: [...pointsB],
                levels: [],
                status: 'pending'
            });
        }
        return candidates;
    }

    filterByLevel(pointA, candidates, level) {
        if (level.groupLevel) {
            return candidates.filter(pointB => {
                for (let i = 0; i < level.features.length; i++) {
                    if (!this.checkFeature(pointA, pointB, level.features[i], level.tolerances[i])) {
                        return false;
                    }
                }
                return true;
            });
        } else {
            let filtered = candidates;
            for (let i = 0; i < level.features.length; i++) {
                const feature = level.features[i];
                const tolerance = level.tolerances[i];
                filtered = filtered.filter(pointB =>
                    this.checkFeature(pointA, pointB, feature, tolerance)
                );
            }
            return filtered;
        }
    }

    /**
     * 🔥 ПРОВЕРКА ПРИЗНАКА
     */
    checkFeature(pointA, pointB, feature, tolerance) {
        const valA = pointA[feature];
        const valB = pointB[feature];
      
        if (valA === undefined || valB === undefined) return true;
      
        if (tolerance === 'strict') return valA === valB;
      
        if (tolerance === 'soft') {
            if (feature === 'neighborRoles') return this.compareNeighborRolesSoft(valA, valB);
            if (feature === 'gapPattern') return this.compareGapPatternSoft(valA, valB);
            return true;
        }
      
        if (typeof tolerance === 'number') {
            if (typeof valA === 'number' && typeof valB === 'number') {
                // Абсолютная разница для дискретных признаков
                if (feature === 'degree' || feature === 'triangles' ||
                    feature === 'clusterSize' || feature === 'patternFrequency' ||
                    feature === 'neighborClusters') {
                    return Math.abs(valA - valB) <= tolerance;
                }
                // Относительная разница для непрерывных
                else {
                    const maxVal = Math.max(Math.abs(valA), Math.abs(valB), 0.001);
                    const minVal = Math.min(Math.abs(valA), Math.abs(valB));
                    if (maxVal < 0.001) return true;
                    return (1 - minVal / maxVal) <= tolerance;
                }
            } else if (Array.isArray(valA) && Array.isArray(valB)) {
                // Инвариантный radialProfile
                if (feature === 'radialProfile') {
                    const sortedA = this.getRotationInvariantProfile(valA);
                    const sortedB = this.getRotationInvariantProfile(valB);
                   
                    if (sortedA.length !== sortedB.length) return false;
                    let sum = 0;
                    for (let i = 0; i < sortedA.length; i++) {
                        sum += Math.abs(sortedA[i] - sortedB[i]);
                    }
                    return (sum / sortedA.length) <= tolerance;
                } else {
                    if (valA.length !== valB.length) return false;
                    let sum = 0;
                    for (let i = 0; i < valA.length; i++) {
                        sum += Math.abs(valA[i] - valB[i]);
                    }
                    return (sum / valA.length) <= tolerance;
                }
            }
        }
      
        return false;
    }

    compareNeighborRolesSoft(rolesA, rolesB) {
        if (!rolesA || !rolesB) return true;
        const setA = new Set(typeof rolesA === 'string' ? rolesA.split('') : rolesA);
        const setB = new Set(typeof rolesB === 'string' ? rolesB.split('') : rolesB);
        for (const role of setA) if (!setB.has(role)) return false;
        for (const role of setB) if (!setA.has(role)) return false;
        return true;
    }

    compareGapPatternSoft(patternA, patternB) {
        if (!patternA || !patternB) return true;
        // Если оба "0" - ок
        if (patternA === '0' && patternB === '0') return true;
        // Если оба объекта (строки JSON) - сравниваем наличие ключей
        try {
            const objA = typeof patternA === 'string' && patternA !== '0' ? JSON.parse(patternA) : null;
            const objB = typeof patternB === 'string' && patternB !== '0' ? JSON.parse(patternB) : null;
           
            if (objA && objB) {
                // Проверяем, что типы совпадают
                return objA.type === objB.type;
            }
        } catch (e) {
            // Если не парсится - считаем разными
            return false;
        }
        return false;
    }

    checkEarlyExit(candidates, currentLevel) {
        let allUnique = true;
        let totalWithCandidates = 0;
        for (const [_, data] of candidates) {
            if (data.candidates.length === 0) continue;
            if (data.candidates.length > 1) allUnique = false;
            totalWithCandidates++;
        }
        return allUnique && totalWithCandidates > 0;
    }

    logLevelStats(level, stats, candidates) {
        const passRate = stats.total > 0 ? (stats.passed / stats.total * 100).toFixed(1) : '0.0';
        console.log(`\n📊 СТАТИСТИКА УРОВНЯ:`);
        console.log(`   • Всего рассмотрено: ${stats.total} пар`);
        console.log(`   • Прошло фильтр: ${stats.passed} (${passRate}%)`);
        console.log(`   • Отсеяно: ${stats.rejected} (${stats.total > 0 ? (stats.rejected/stats.total*100).toFixed(1) : '0.0'}%)`);
      
        const candidatesCounts = Array.from(candidates.values()).map(d => d.candidates.length);
        const avgCandidates = candidatesCounts.length > 0
            ? (candidatesCounts.reduce((a, b) => a + b, 0) / candidatesCounts.length).toFixed(2)
            : '0.00';
        const zeroCandidates = candidatesCounts.filter(c => c === 0).length;
        const multiCandidates = candidatesCounts.filter(c => c > 1).length;
      
        console.log(`\n   📈 ТЕКУЩЕЕ СОСТОЯНИЕ:`);
        console.log(`      • Среднее число кандидатов: ${avgCandidates}`);
        console.log(`      • Точек без кандидатов: ${zeroCandidates} (НОВЫЕ КЛЮЧИ 🔵)`);
        console.log(`      • Точек с >1 кандидатом: ${multiCandidates} (СПОРНЫЕ ⚠️)`);
    }

    printHierarchicalTree(candidates, upToLevel) {
        console.log(`\n🌳 ИЕРАРХИЧЕСКОЕ ДЕРЕВО ДО УРОВНЯ ${upToLevel + 1}:`);
       
        const tree = this.buildHierarchicalTree(candidates, upToLevel);
       
        if (tree.count > 0) {
            this.printNode(tree, 0, upToLevel);
        } else {
            console.log(`└── (нет ключей с кандидатами)`);
        }
    }

    buildHierarchicalTree(candidates, upToLevel) {
        const root = { name: 'Все ключи', count: 0, children: [] };
        const groups = new Map();
       
        for (const [pointId, data] of candidates) {
            if (data.candidates.length === 0) continue;
           
            const point = data.point;
            root.count++;
           
            const form = this.getFormType(point);
            if (!groups.has(form)) {
                groups.set(form, { name: form, count: 0, children: new Map() });
            }
            const formGroup = groups.get(form);
            formGroup.count++;
           
            if (upToLevel >= 1) {
                const role = point.role || 'R';
                if (!formGroup.children.has(role)) {
                    formGroup.children.set(role, { name: `Роль ${role}`, count: 0, children: new Map() });
                }
                const roleGroup = formGroup.children.get(role);
                roleGroup.count++;
               
                if (upToLevel >= 2) {
                    const neighborRoles = point.neighborRoles || 'unknown';
                    const neighborKey = typeof neighborRoles === 'string' ? neighborRoles : JSON.stringify(neighborRoles);
                    if (!roleGroup.children.has(neighborKey)) {
                        roleGroup.children.set(neighborKey, { name: `neighborRoles: ${neighborKey}`, count: 0, children: new Map() });
                    }
                    const neighborGroup = roleGroup.children.get(neighborKey);
                    neighborGroup.count++;
                   
                    if (upToLevel >= 3) {
                        const clusterSize = point.clusterSize || 0;
                        const sizeKey = `size:${clusterSize}`;
                        if (!neighborGroup.children.has(sizeKey)) {
                            neighborGroup.children.set(sizeKey, { name: `clusterSize: ${clusterSize}`, count: 0, children: new Map() });
                        }
                        const sizeGroup = neighborGroup.children.get(sizeKey);
                        sizeGroup.count++;
                       
                        if (upToLevel >= 4) {
                            const gapPattern = point.gapPattern || '0';
                            const gapKey = `gap:${gapPattern.substring(0, 10)}`;
                            if (!sizeGroup.children.has(gapKey)) {
                                sizeGroup.children.set(gapKey, { name: `gapPattern: ${gapPattern.substring(0, 10)}...`, count: 0, children: new Map() });
                            }
                            const gapGroup = sizeGroup.children.get(gapKey);
                            gapGroup.count++;
                        }
                    }
                }
            }
        }
       
        for (const [form, formGroup] of groups) {
            const formNode = { name: formGroup.name, count: formGroup.count, children: [] };
           
            for (const [role, roleGroup] of formGroup.children) {
                const roleNode = { name: roleGroup.name, count: roleGroup.count, children: [] };
               
                for (const [neighbor, neighborGroup] of roleGroup.children) {
                    const neighborNode = { name: neighborGroup.name, count: neighborGroup.count, children: [] };
                   
                    for (const [size, sizeGroup] of neighborGroup.children) {
                        const sizeNode = { name: sizeGroup.name, count: sizeGroup.count, children: [] };
                       
                        for (const [gap, gapGroup] of sizeGroup.children) {
                            sizeNode.children.push({
                                name: gapGroup.name,
                                count: gapGroup.count,
                                children: []
                            });
                        }
                       
                        neighborNode.children.push(sizeNode);
                    }
                   
                    roleNode.children.push(neighborNode);
                }
               
                formNode.children.push(roleNode);
            }
           
            root.children.push(formNode);
        }
       
        return root;
    }

    printNode(node, depth, maxDepth) {
        if (depth > maxDepth + 1) return;
       
        const indent = '  '.repeat(depth);
        const prefix = depth === 0 ? '└── ' : '├── ';
       
        console.log(`${indent}${prefix}${node.name} (${node.count})`);
       
        for (const child of node.children) {
            this.printNode(child, depth + 1, maxDepth);
        }
    }

    getFormType(point) {
        const c = point.compactness || 0;
        if (c < 15) return 'Овальные';
        if (c < 25) return 'Круглые';
        return 'Вытянутые';
    }

    finalAnalysis(candidates, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🏁 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ`);
        console.log(`${'='.repeat(100)}`);

        const matches = [];
        const ambiguous = [];
        const noMatch = [];
        const usedB = new Set();

        const sorted = Array.from(candidates.entries())
            .sort((a, b) => a[1].candidates.length - b[1].candidates.length);

        for (const [pointId, data] of sorted) {
            if (data.candidates.length === 0) {
                noMatch.push(pointId);
                continue;
            }
          
            const available = data.candidates.filter(c => !usedB.has(c.id));
          
            if (available.length === 1) {
                matches.push({
                    pointA: pointId,
                    pointB: available[0].id,
                    confidence: this.calculateConfidence(data)
                });
                usedB.add(available[0].id);
            } else if (available.length > 1) {
                ambiguous.push({
                    pointA: pointId,
                    candidates: available.map(c => c.id),
                    count: available.length
                });
            }
        }

        const unmatchedB = pointsB.filter(p => !usedB.has(p.id)).map(p => p.id);

        console.log(`\n✅ ОДНОЗНАЧНЫЕ СООТВЕТСТВИЯ (ЯКОРЯ): ${matches.length}`);
        if (matches.length > 0) {
            matches.slice(0, 5).forEach((m, i) => {
                console.log(`   ${i+1}. ${m.pointA.slice(0,12)}... ↔ ${m.pointB.slice(0,12)}... (уверенность ${(m.confidence*100).toFixed(0)}%)`);
            });
        }

        console.log(`\n⚠️ СПОРНЫЕ (требуют проверки): ${ambiguous.length}`);
        ambiguous.slice(0, 3).forEach((a, i) => {
            console.log(`   ${i+1}. ${a.pointA.slice(0,12)}... → ${a.count} кандидатов`);
        });

        console.log(`\n🔵 НОВЫЕ В ПЕРВОМ СЛЕДЕ: ${noMatch.length}`);
        console.log(`🔵 НОВЫЕ ВО ВТОРОМ СЛЕДЕ: ${unmatchedB.length}`);

        console.log(`\n📊 ИТОГОВАЯ СТАТИСТИКА:`);
        console.log(`   • ✅ Якорей: ${matches.length}`);
        console.log(`   • ⚠️ Спорных: ${ambiguous.length}`);
        console.log(`   • 🔵 Новых в первом: ${noMatch.length}`);
        console.log(`   • 🔵 Новых во втором: ${unmatchedB.length}`);
        console.log(`   • 🎯 Ранних выходов: ${this.stats.earlyExits}`);

        return {
            matches,
            ambiguous,
            noMatchA: noMatch,
            noMatchB: unmatchedB,
            stats: {
                totalPairs: matches.length,
                ambiguous: ambiguous.length,
                uniqueA: noMatch.length,
                uniqueB: unmatchedB.length,
                earlyExits: this.stats.earlyExits
            }
        };
    }

    calculateConfidence(data) {
        let score = 0;
        let totalWeight = 0;
      
        for (let i = 0; i < data.levels.length; i++) {
            const level = data.levels[i];
            const levelConfig = this.levels[i];
            if (!levelConfig?.enabled) continue;
          
            const rejectionRate = level.rejected / level.before;
            score += rejectionRate * levelConfig.weight;
            totalWeight += levelConfig.weight;
        }
      
        return totalWeight > 0 ? score / totalWeight : 0.5;
    }
}

module.exports = HierarchicalMatcher;
