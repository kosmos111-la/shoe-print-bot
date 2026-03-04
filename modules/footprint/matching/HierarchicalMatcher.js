// modules/footprint/matching/HierarchicalMatcher.js
// 🔥 МНОГОУРОВНЕВЫЙ МАТЧЕР С ТИПОЛОГИЕЙ КЛЮЧЕЙ И ЗАМКОВ

class HierarchicalMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
      
        // 🔥 ИЕРАРХИЯ УРОВНЕЙ (от грубого к тонкому)
        this.levels = [
            {   // УРОВЕНЬ 1: ПРОФИЛЬ КЛЮЧА (двухтавр)
                name: 'БАЗОВАЯ ГЕОМЕТРИЯ',
                features: ['compactness', 'eccentricity', 'normalizedArea'],
                tolerances: [0.4, 0.15, 0.75],
                groupLevel: true,
                weight: 0.3,
                enabled: true
            },
            {   // УРОВЕНЬ 2: ТИП/ЦВЕТ КЛЮЧА
                name: 'ТОПОЛОГИЧЕСКАЯ РОЛЬ',
                features: ['role', 'degree', 'triangles'],
                tolerances: ['strict', 2, 1],
                groupLevel: false,
                weight: 0.25,
                enabled: true
            },
            {   // УРОВЕНЬ 3A: РОЛИ СОСЕДЕЙ (кто рядом)
                name: 'РОЛИ СОСЕДЕЙ',
                features: ['neighborRoles'],
                tolerances: ['soft'],
                groupLevel: false,
                weight: 0.07,
                enabled: true
            },
            {   // УРОВЕНЬ 3B: КЛАСТЕР (группа)
                name: 'КЛАСТЕРНАЯ ПРИНАДЛЕЖНОСТЬ',
                features: ['clusterId', 'clusterSize'],
                tolerances: ['soft', 2],
                groupLevel: false,
                weight: 0.07,
                enabled: true
            },
            {   // УРОВЕНЬ 3C: КОНТЕКСТ (окружение)
                name: 'КОНТЕКСТ',
                features: ['neighborClusters', 'gapPattern'],
                tolerances: [1, 0.3],
                groupLevel: true,
                weight: 0.06,
                enabled: true
            },
            {   // УРОВЕНЬ 4: МЕХАНИЗМ ЛИЧИНКИ (финальная примерка)
                name: 'ДЕТАЛЬНАЯ ПРОВЕРКА',
                features: ['radialProfile', 'patternType', 'gapPattern'],
                tolerances: [0.3, 'strict', 0.2],
                groupLevel: true,
                weight: 0.25,
                enabled: true
            }
        ];

        this.featureCache = new Map();
      
        this.stats = {
            levels: [],
            earlyExits: 0,
            totalPairs: 0
        };
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

        const candidates = this.initializeCandidates(pointsA, pointsB);

        for (let levelIdx = 0; levelIdx < this.levels.length; levelIdx++) {
            const level = this.levels[levelIdx];
            if (!level.enabled) continue;

            const result = this.processLevel(level, levelIdx, candidates);
          
            if (this.checkEarlyExit(candidates, levelIdx)) {
                console.log(`\n🎯 РАННИЙ ВЫХОД на уровне ${levelIdx + 1}`);
                console.log(`   Все точки уже имеют уникальные пары!`);
                this.stats.earlyExits++;
                break;
            }
        }

        return this.finalAnalysis(candidates, pointsB);
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
                if (!featureStats[key]) {
                    featureStats[key] = { present: 0 };
                }
                if (value !== undefined && value !== null) {
                    featureStats[key].present++;
                }
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
                status: 'pending',
                featureCache: this.extractFeatures(pointA)
            });
        }
        return candidates;
    }

    extractFeatures(point) {
        const features = {};
        for (const level of this.levels) {
            for (const feature of level.features) {
                if (point[feature] !== undefined) {
                    features[feature] = point[feature];
                }
            }
        }
        return features;
    }

    processLevel(level, levelIdx, candidates) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`🔍 УРОВЕНЬ ${levelIdx + 1}: ${level.name}`);
        console.log(`${'─'.repeat(80)}`);

        const levelStats = { total: 0, passed: 0, rejected: 0 };

        let totalBefore = 0;
        for (const [pointId, data] of candidates) {
            if (data.status === 'rejected') continue;
          
            const before = data.candidates.length;
            totalBefore += before;
          
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
        return levelStats;
    }

    filterByLevel(pointA, candidates, level) {
        if (level.groupLevel) {
            return candidates.filter(pointB => {
                for (let i = 0; i < level.features.length; i++) {
                    const feature = level.features[i];
                    const tolerance = level.tolerances[i];
                    if (!this.checkFeature(pointA, pointB, feature, tolerance)) {
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
     * ПРОВЕРКА ПРИЗНАКА
     */
    checkFeature(pointA, pointB, feature, tolerance) {
        const valA = pointA[feature];
        const valB = pointB[feature];
      
        if (valA === undefined || valB === undefined) {
            return true;
        }
      
        if (tolerance === 'strict') {
            return valA === valB;
        } else if (tolerance === 'soft') {
            if (feature === 'neighborRoles') {
                return this.compareNeighborRolesSoft(valA, valB);
            } else if (feature === 'clusterId') {
                return this.compareClusterIdSoft(valA, valB);
            }
            return true;
        } else if (typeof tolerance === 'number') {
            if (typeof valA === 'number' && typeof valB === 'number') {
                if (feature === 'degree' || feature === 'triangles' || feature === 'clusterSize' || feature === 'neighborClusters') {
                    const diff = Math.abs(valA - valB);
                    return diff <= tolerance;
                } else {
                    const maxVal = Math.max(Math.abs(valA), Math.abs(valB), 0.001);
                    const minVal = Math.min(Math.abs(valA), Math.abs(valB));
                    if (maxVal < 0.001) return true;
                    const ratio = minVal / maxVal;
                    const diff = 1 - ratio;
                    return diff <= tolerance;
                }
            } else if (Array.isArray(valA) && Array.isArray(valB)) {
                return this.compareArrays(valA, valB, tolerance);
            }
        }
      
        return false;
    }

    /**
     * Мягкое сравнение ролей соседей
     */
    compareNeighborRolesSoft(rolesA, rolesB) {
        if (!rolesA || !rolesB) return true;
      
        const setA = new Set(typeof rolesA === 'string' ? rolesA.split('') : rolesA);
        const setB = new Set(typeof rolesB === 'string' ? rolesB.split('') : rolesB);
      
        for (const role of setA) {
            if (!setB.has(role)) return false;
        }
        for (const role of setB) {
            if (!setA.has(role)) return false;
        }
        return true;
    }

    /**
     * Мягкое сравнение ID кластера
     */
    compareClusterIdSoft(idA, idB) {
        if (!idA || !idB) return true;
        // Сравниваем только тип кластера (C1, C2 и т.д.)
        const typeA = idA.replace(/[0-9]/g, ''); // Убираем цифры
        const typeB = idB.replace(/[0-9]/g, '');
        return typeA === typeB;
    }

    compareArrays(arrA, arrB, tolerance) {
        if (arrA.length !== arrB.length) return false;
        let sum = 0;
        for (let i = 0; i < arrA.length; i++) {
            sum += Math.abs(arrA[i] - arrB[i]);
        }
        const avgDiff = sum / arrA.length;
        return avgDiff <= tolerance;
    }

    rolesCompatible(roleA, roleB, degA, degB) {
        if (roleA === roleB) return true;
      
        const transitions = {
            'H': ['H', 'C', 'B'],
            'C': ['C', 'H', 'R'],
            'B': ['B', 'R', 'L'],
            'R': ['R', 'B', 'L'],
            'L': ['L', 'R']
        };
      
        return transitions[roleA]?.includes(roleB) || false;
    }

    checkEarlyExit(candidates, currentLevel) {
        let allUnique = true;
        let totalWithCandidates = 0;
      
        for (const [_, data] of candidates) {
            if (data.candidates.length === 0) continue;
            if (data.candidates.length > 1) {
                allUnique = false;
            }
            totalWithCandidates++;
        }
      
        return allUnique && totalWithCandidates > 0;
    }

    /**
     * 🔥 РАСШИРЕННАЯ СТАТИСТИКА С ТИПОЛОГИЕЙ
     */
    logLevelStats(level, stats, candidates) {
        const passRate = stats.total > 0 ? (stats.passed / stats.total * 100).toFixed(1) : '0.0';
        console.log(`\n📊 СТАТИСТИКА УРОВНЯ:`);
        console.log(`   • Всего рассмотрено: ${stats.total} пар`);
        console.log(`   • Прошло фильтр: ${stats.passed} (${passRate}%)`);
        console.log(`   • Отсеяно: ${stats.rejected} (${stats.total > 0 ? (stats.rejected/stats.total*100).toFixed(1) : '0.0'}%)`);
      
        // 🔥 ТИПОЛОГИЯ КЛЮЧЕЙ И ЗАМКОВ
        this.printTypology(candidates);
      
        const candidatesCounts = Array.from(candidates.values())
            .map(d => d.candidates.length);
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

    /**
     * 🔥 ПЕЧАТЬ ТИПОЛОГИИ КЛЮЧЕЙ И ЗАМКОВ
     */
    printTypology(candidates) {
        // Типы по компактности (форма)
        const keyTypesByForm = { Овальные: 0, Круглые: 0, Вытянутые: 0 };
        const lockTypesByForm = { Овальные: 0, Круглые: 0, Вытянутые: 0 };
        const lockFormSet = new Set();
      
        // Типы по ролям
        const keyRoles = { H:0, C:0, B:0, R:0, L:0 };
        const lockRoles = { H:0, C:0, B:0, R:0, L:0 };
        const lockRoleSet = new Set();
      
        // Типы по кластерам
        const keyClusters = new Map();
        const lockClusters = new Map();

        for (const [pointId, data] of candidates) {
            if (data.candidates.length === 0) {
                // Ключи без кандидатов (новые)
                const form = this.getFormType(data.point);
                keyTypesByForm[form]++;
                keyRoles[data.point.role || 'R']++;
              
                const cluster = data.point.clusterId || 'R0';
                keyClusters.set(cluster, (keyClusters.get(cluster) || 0) + 1);
                continue;
            }
          
            // Ключи с кандидатами
            const form = this.getFormType(data.point);
            keyTypesByForm[form]++;
            keyRoles[data.point.role || 'R']++;
          
            const cluster = data.point.clusterId || 'R0';
            keyClusters.set(cluster, (keyClusters.get(cluster) || 0) + 1);
          
            // Анализируем кандидатов (замки)
            for (const candidate of data.candidates) {
                const lockForm = this.getFormType(candidate);
                lockTypesByForm[lockForm]++;
                lockFormSet.add(lockForm);
              
                const lockRole = candidate.role || 'R';
                lockRoles[lockRole]++;
                lockRoleSet.add(lockRole);
              
                const lockCluster = candidate.clusterId || 'R0';
                lockClusters.set(lockCluster, (lockClusters.get(lockCluster) || 0) + 1);
            }
        }

        // Печатаем типологию
        console.log(`\n   🗝️ ТИПЫ КЛЮЧЕЙ (ПО ФОРМЕ):`);
        Object.entries(keyTypesByForm).forEach(([type, count]) => {
            if (count > 0) console.log(`      • ${type}: ${count} ключей`);
        });

        console.log(`\n   🚪 ТИПЫ ЗАМКОВ (ПО ФОРМЕ):`);
        Object.entries(lockTypesByForm).forEach(([type, count]) => {
            if (count > 0) console.log(`      • ${type}: ${count} замков`);
        });
        if (lockFormSet.size > 0) {
            console.log(`      🎯 Разнообразие форм замков: ${lockFormSet.size} типа`);
        }

        console.log(`\n   🎨 РАСПРЕДЕЛЕНИЕ КЛЮЧЕЙ ПО РОЛЯМ:`);
        Object.entries(keyRoles).forEach(([role, count]) => {
            if (count > 0) console.log(`      • ${role}: ${count} ключей`);
        });

        console.log(`\n   🎨 РАСПРЕДЕЛЕНИЕ ЗАМКОВ ПО РОЛЯМ:`);
        Object.entries(lockRoles).forEach(([role, count]) => {
            if (count > 0) console.log(`      • ${role}: ${count} замков`);
        });
        if (lockRoleSet.size > 0) {
            console.log(`      🎯 Разнообразие ролей замков: ${lockRoleSet.size} типа`);
        }

        console.log(`\n   📦 КЛАСТЕРЫ КЛЮЧЕЙ: ${keyClusters.size} уникальных групп`);
        console.log(`   📦 КЛАСТЕРЫ ЗАМКОВ: ${lockClusters.size} уникальных групп`);
    }

    /**
     * Определение типа по компактности
     */
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

        const unmatchedB = pointsB
            .filter(p => !usedB.has(p.id))
            .map(p => p.id);

        // 🔥 ФИНАЛЬНАЯ ТИПОЛОГИЯ
        console.log(`\n🔍 АНАЛИЗ СООТВЕТСТВИЙ:`);
      
        const matchedRoles = { H:0, C:0, B:0, R:0, L:0 };
        for (const match of matches) {
            const pointA = candidates.get(match.pointA)?.point;
            if (pointA) matchedRoles[pointA.role || 'R']++;
        }

        console.log(`\n   ✅ ЯКОРЯ ПО РОЛЯМ:`);
        Object.entries(matchedRoles).forEach(([role, count]) => {
            if (count > 0) console.log(`      • ${role}: ${count} якорей`);
        });

        console.log(`\n   🔵 НОВЫЕ КЛЮЧИ (ПО РОЛЯМ):`);
        const newRoles = { H:0, C:0, B:0, R:0, L:0 };
        for (const id of noMatch) {
            const point = candidates.get(id)?.point;
            if (point) newRoles[point.role || 'R']++;
        }
        Object.entries(newRoles).forEach(([role, count]) => {
            if (count > 0) console.log(`      • ${role}: ${count} ключей`);
        });

        console.log(`\n   🔵 НОВЫЕ ЗАМКИ (ПО РОЛЯМ):`);
        const newLockRoles = { H:0, C:0, B:0, R:0, L:0 };
        for (const id of unmatchedB) {
            const point = pointsB.find(p => p.id === id);
            if (point) newLockRoles[point.role || 'R']++;
        }
        Object.entries(newLockRoles).forEach(([role, count]) => {
            if (count > 0) console.log(`      • ${role}: ${count} замков`);
        });

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
