// modules/footprint/matching/HierarchicalMatcher.js
// 🔥 МНОГОУРОВНЕВЫЙ МАТЧЕР С РАННИМ ВЫХОДОМ И ПОЛНЫМ ЛОГИРОВАНИЕМ

class HierarchicalMatcher {
    constructor(options = {}) {
        this.debug = options.debug !== false;
       
        // 🔥 РАСШИРЯЕМАЯ СТРУКТУРА УРОВНЕЙ
        this.levels = [
            {   // УРОВЕНЬ 1: Супер-надежные (групповые)
                name: 'БАЗОВАЯ ГЕОМЕТРИЯ',
                features: ['compactness', 'eccentricity', 'normalizedArea'],
                tolerances: [0.4, 0.15, 0.75],
                groupLevel: true,
                weight: 0.3,
                enabled: true
            },
            {   // УРОВЕНЬ 2: Топологические (по одному)
                name: 'ТОПОЛОГИЯ',
                features: ['role', 'degree', 'triangles'],
                tolerances: ['strict', 2, 1],
                groupLevel: false,
                weight: 0.25,
                enabled: true
            },
            {   // УРОВЕНЬ 3: Контекстные
                name: 'ОКРУЖЕНИЕ',
                features: ['neighborRoles', 'clusterId', 'clusterSize'],
                tolerances: ['strict', 'strict', 'strict'],
                groupLevel: false,
                weight: 0.2,
                enabled: true
            },
            {   // УРОВЕНЬ 4: Точные (проверка)
                name: 'ДЕТАЛЬНАЯ ПРОВЕРКА',
                features: ['radialProfile', 'patternType', 'gapPattern'],
                tolerances: [0.3, 'strict', 0.2],
                groupLevel: true,
                weight: 0.25,
                enabled: true
            }
        ];

        // 🔥 КЕШ ДЛЯ БЫСТРОГО ДОСТУПА
        this.featureCache = new Map();
       
        // Статистика
        this.stats = {
            levels: [],
            earlyExits: 0,
            totalPairs: 0
        };
    }

    /**
     * 🔧 ДОБАВИТЬ НОВЫЙ УРОВЕНЬ СОРТИРОВКИ
     */
    addLevel(levelConfig) {
        this.levels.push({
            name: levelConfig.name || `УРОВЕНЬ ${this.levels.length + 1}`,
            features: levelConfig.features,
            tolerances: levelConfig.tolerances,
            groupLevel: levelConfig.groupLevel || false,
            weight: levelConfig.weight || 0.1,
            enabled: true
        });
        console.log(`✅ Добавлен уровень: ${levelConfig.name}`);
    }

    /**
     * 🔧 ОТКЛЮЧИТЬ УРОВЕНЬ
     */
    disableLevel(levelName) {
        const level = this.levels.find(l => l.name === levelName);
        if (level) {
            level.enabled = false;
            console.log(`⏸️ Уровень отключен: ${levelName}`);
        }
    }

    /**
     * 🔧 ВКЛЮЧИТЬ УРОВЕНЬ
     */
    enableLevel(levelName) {
        const level = this.levels.find(l => l.name === levelName);
        if (level) {
            level.enabled = true;
            console.log(`▶️ Уровень включен: ${levelName}`);
        }
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
       
        // 🔥 ПРОВЕРКА НАЛИЧИЯ ПРИЗНАКОВ
        this.validateFeatures(pointsA, pointsB);

        // Инициализация кандидатов
        const candidates = this.initializeCandidates(pointsA, pointsB);

        // Проходим по уровням
        for (let levelIdx = 0; levelIdx < this.levels.length; levelIdx++) {
            const level = this.levels[levelIdx];
            if (!level.enabled) continue;

            const result = this.processLevel(level, levelIdx, candidates);
           
            // 🔥 РАННИЙ ВЫХОД - если все точки уже однозначны
            if (this.checkEarlyExit(candidates, levelIdx)) {
                console.log(`\n🎯 РАННИЙ ВЫХОД на уровне ${levelIdx + 1}`);
                console.log(`   Все точки уже имеют уникальные пары!`);
                this.stats.earlyExits++;
                break;
            }
        }

        // Финальный анализ
        return this.finalAnalysis(candidates, pointsB);
    }

    /**
     * 🔍 ПРОВЕРКА НАЛИЧИЯ ПРИЗНАКОВ
     */
    validateFeatures(pointsA, pointsB) {
        console.log(`\n🔍 ПРОВЕРКА НАЛИЧИЯ ПРИЗНАКОВ:`);
       
        const allPoints = [...pointsA, ...pointsB];
        const featureStats = {};

        for (const point of allPoints) {
            for (const [key, value] of Object.entries(point)) {
                if (!featureStats[key]) {
                    featureStats[key] = { present: 0, examples: new Set() };
                }
                if (value !== undefined && value !== null) {
                    featureStats[key].present++;
                    if (featureStats[key].examples.size < 3) {
                        const example = typeof value === 'number' ? value.toFixed(2) :
                                       Array.isArray(value) ? `[${value.length}]` : value;
                        featureStats[key].examples.add(example);
                    }
                }
            }
        }

        console.log(`   📊 ДОСТУПНЫЕ ПРИЗНАКИ:`);
        Object.entries(featureStats)
            .sort((a, b) => b[1].present - a[1].present)
            .forEach(([feature, stats]) => {
                const percent = (stats.present / allPoints.length * 100).toFixed(1);
                const examples = Array.from(stats.examples).join(', ');
                console.log(`   • ${feature}: ${stats.present}/${allPoints.length} (${percent}%)`);
                if (stats.examples.size > 0) {
                    console.log(`     примеры: ${examples}`);
                }
            });
    }

    /**
     * Инициализация кандидатов
     */
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

    /**
     * Извлечение всех признаков точки
     */
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

    /**
     * Обработка одного уровня
     */
    processLevel(level, levelIdx, candidates) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`🔍 УРОВЕНЬ ${levelIdx + 1}: ${level.name}`);
        console.log(`${'─'.repeat(80)}`);
        console.log(`   Признаки: ${level.features.join(', ')}`);
        console.log(`   Допуски: ${level.tolerances.map(t =>
            typeof t === 'number' ? `${t*100}%` : t).join(', ')}`);

        const levelStats = {
            total: 0,
            passed: 0,
            rejected: 0,
            groups: new Map()
        };

        let totalBefore = 0;
        for (const [pointId, data] of candidates) {
            if (data.status === 'rejected') continue;
           
            const before = data.candidates.length;
            totalBefore += before;
           
            const filtered = this.filterByLevel(
                data.point,
                data.candidates,
                level,
                levelStats
            );

            data.candidates = filtered;
            data.levels.push({
                level: levelIdx,
                before,
                after: filtered.length,
                rejected: before - filtered.length,
                groupKey: level.groupLevel ? this.getGroupKey(data.point, level) : null
            });

            levelStats.total += before;
            levelStats.passed += filtered.length;
            levelStats.rejected += (before - filtered.length);
        }

        this.logLevelStats(level, levelStats, candidates, totalBefore);
        return levelStats;
    }

    /**
     * Фильтр по уровню
     */
    filterByLevel(pointA, candidates, level, levelStats) {
        if (level.groupLevel) {
            // Групповая фильтрация
            const groupKey = this.getGroupKey(pointA, level);
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
            // Последовательная фильтрация
            let filtered = candidates;
            for (let i = 0; i < level.features.length; i++) {
                const feature = level.features[i];
                const tolerance = level.tolerances[i];
               
                const before = filtered.length;
                filtered = filtered.filter(pointB =>
                    this.checkFeature(pointA, pointB, feature, tolerance)
                );
               
                if (this.debug && before !== filtered.length) {
                    console.log(`      • ${feature}: отсеяно ${before - filtered.length} кандидатов`);
                   
                    // Логируем примеры отсева
                    if (before - filtered.length > 0 && filtered.length > 0) {
                        const example = filtered[0];
                        console.log(`        пример прошедшего: ${pointA[feature]} ↔ ${example[feature]}`);
                    }
                }
            }
            return filtered;
        }
    }

    /**
     * Проверка отдельного признака
     */
    checkFeature(pointA, pointB, feature, tolerance) {
        const valA = pointA[feature];
        const valB = pointB[feature];
       
        if (valA === undefined || valB === undefined) {
            if (this.debug) {
                console.log(`        ⚠️ Признак ${feature} отсутствует у одной из точек`);
            }
            return true;
        }
       
        if (tolerance === 'strict') {
            return valA === valB;
        } else if (typeof tolerance === 'number') {
            if (typeof valA === 'number' && typeof valB === 'number') {
                const ratio = Math.min(valA, valB) / Math.max(valA, valB);
                const passed = 1 - ratio <= tolerance;
                if (!passed && this.debug) {
                    console.log(`        ❌ ${feature}: ${valA.toFixed(2)} vs ${valB.toFixed(2)} (ratio ${(1-ratio)*100}% > ${tolerance*100}%)`);
                }
                return passed;
            } else if (Array.isArray(valA) && Array.isArray(valB)) {
                return this.compareArrays(valA, valB, tolerance);
            }
        } else if (feature === 'role' && tolerance === 'soft') {
            return this.rolesCompatible(valA, valB, pointA.degree, pointB.degree);
        }
       
        return false;
    }

    /**
     * Сравнение массивов с допуском
     */
    compareArrays(arrA, arrB, tolerance) {
        if (arrA.length !== arrB.length) return false;
        let sum = 0;
        for (let i = 0; i < arrA.length; i++) {
            sum += Math.abs(arrA[i] - arrB[i]);
        }
        const avgDiff = sum / arrA.length;
        const passed = avgDiff <= tolerance;
        if (!passed && this.debug) {
            console.log(`        ❌ radialProfile: средняя разница ${(avgDiff*100).toFixed(1)}% > ${tolerance*100}%`);
        }
        return passed;
    }

    /**
     * Проверка совместимости ролей
     */
    rolesCompatible(roleA, roleB, degA, degB) {
        if (roleA === roleB) return true;
       
        const transitions = {
            'H': ['H', 'C', 'B'],
            'C': ['C', 'H', 'R'],
            'B': ['B', 'R', 'L'],
            'R': ['R', 'B', 'L'],
            'L': ['L', 'R']
        };
       
        const compatible = transitions[roleA]?.includes(roleB) || false;
        if (!compatible && this.debug) {
            console.log(`        ❌ role: ${roleA} → ${roleB} недопустимо`);
        }
        return compatible;
    }

    /**
     * Групповой ключ для статистики
     */
    getGroupKey(point, level) {
        const parts = [];
        for (const feature of level.features) {
            const val = point[feature];
            if (typeof val === 'number') {
                parts.push(Math.round(val * 10));
            } else if (typeof val === 'string') {
                parts.push(val);
            } else if (Array.isArray(val)) {
                parts.push(val.map(v => Math.round(v)).join(''));
            }
        }
        return parts.join('_');
    }

    /**
     * Проверка на ранний выход
     */
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
       
        if (this.debug) {
            console.log(`\n   🔍 ПРОВЕРКА РАННЕГО ВЫХОДА:`);
            console.log(`      • Точек с кандидатами: ${totalWithCandidates}`);
            console.log(`      • Все уникальны: ${allUnique ? '✅' : '❌'}`);
        }
       
        return allUnique && totalWithCandidates > 0;
    }

    /**
     * Логирование статистики уровня
     */
    logLevelStats(level, stats, candidates, totalBefore) {
        const passRate = (stats.passed / stats.total * 100).toFixed(1);
        console.log(`\n📊 СТАТИСТИКА УРОВНЯ:`);
        console.log(`   • Всего рассмотрено: ${stats.total} пар`);
        console.log(`   • Прошло фильтр: ${stats.passed} (${passRate}%)`);
        console.log(`   • Отсеяно: ${stats.rejected} (${(stats.rejected/stats.total*100).toFixed(1)}%)`);
       
        // Распределение по группам
        if (stats.groups.size > 0) {
            console.log(`\n   📋 РАСПРЕДЕЛЕНИЕ ПО ГРУППАМ:`);
            const groups = Array.from(stats.groups.values())
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);
           
            groups.forEach(group => {
                const passRate = (group.passed / group.total * 100).toFixed(1);
                console.log(`      • Группа ${group.key}: ${group.total} точек, прошло ${passRate}%`);
            });
        }
       
        // Текущее состояние кандидатов
        const candidatesCounts = Array.from(candidates.values())
            .map(d => d.candidates.length);
        const avgCandidates = candidatesCounts.reduce((a, b) => a + b, 0) / candidatesCounts.length;
        const zeroCandidates = candidatesCounts.filter(c => c === 0).length;
        const multiCandidates = candidatesCounts.filter(c => c > 1).length;
       
        console.log(`\n   📈 ТЕКУЩЕЕ СОСТОЯНИЕ:`);
        console.log(`      • Среднее число кандидатов: ${avgCandidates.toFixed(2)}`);
        console.log(`      • Точек без кандидатов: ${zeroCandidates}`);
        console.log(`      • Точек с >1 кандидатом: ${multiCandidates}`);
        console.log(`      • Всего активных кандидатов: ${candidatesCounts.reduce((a, b) => a + b, 0)}`);
    }

    /**
     * Финальный анализ
     */
    finalAnalysis(candidates, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🏁 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ`);
        console.log(`${'='.repeat(100)}`);

        const matches = [];
        const ambiguous = [];
        const noMatch = [];
        const usedB = new Set();

        // Сортируем по числу кандидатов (сначала однозначные)
        const sorted = Array.from(candidates.entries())
            .sort((a, b) => a[1].candidates.length - b[1].candidates.length);

        for (const [pointId, data] of sorted) {
            if (data.candidates.length === 0) {
                noMatch.push({
                    pointId,
                    history: data.levels
                });
                continue;
            }
           
            // Отбираем свободные кандидаты
            const available = data.candidates.filter(c => !usedB.has(c.id));
           
            if (available.length === 1) {
                const confidence = this.calculateConfidence(data);
                matches.push({
                    pointA: pointId,
                    pointB: available[0].id,
                    confidence: confidence,
                    history: data.levels
                });
                usedB.add(available[0].id);
            } else if (available.length > 1) {
                ambiguous.push({
                    pointA: pointId,
                    candidates: available.map(c => ({
                        id: c.id,
                        features: this.extractFeatures(c)
                    })),
                    count: available.length,
                    history: data.levels
                });
            }
        }

        // Точки Б без пары
        const unmatchedB = pointsB
            .filter(p => !usedB.has(p.id))
            .map(p => ({
                id: p.id,
                features: this.extractFeatures(p)
            }));

        // Детальный лог результатов
        this.logFinalResults(matches, ambiguous, noMatch, unmatchedB);

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

    /**
     * Логирование финальных результатов
     */
    logFinalResults(matches, ambiguous, noMatch, unmatchedB) {
        console.log(`\n✅ ОДНОЗНАЧНЫЕ СООТВЕТСТВИЯ: ${matches.length}`);
        if (matches.length > 0) {
            console.log(`   🔥 ПРИМЕРЫ (первые 5):`);
            matches.slice(0, 5).forEach((m, i) => {
                const lastLevel = m.history[m.history.length - 1];
                const rejectionRate = lastLevel ?
                    ((lastLevel.rejected / lastLevel.before) * 100).toFixed(1) : 0;
                console.log(`   ${i+1}. ${m.pointA.slice(0,12)}... ↔ ${m.pointB.slice(0,12)}...`);
                console.log(`      уверенность: ${(m.confidence*100).toFixed(1)}%, отсеяно на последнем уровне: ${rejectionRate}%`);
            });
        }

        console.log(`\n⚠️ НЕОДНОЗНАЧНЫЕ (требуют проверки): ${ambiguous.length}`);
        ambiguous.slice(0, 3).forEach((a, i) => {
            console.log(`   ${i+1}. ${a.pointA.slice(0,12)}... → ${a.count} кандидатов:`);
            a.candidates.slice(0, 3).forEach(c => {
                console.log(`      • ${c.id.slice(0,12)}... роль: ${c.features.role}, степень: ${c.features.degree}`);
            });
        });

        console.log(`\n🔵 ТОЧКИ БЕЗ ПАРЫ В ПЕРВОМ: ${noMatch.length}`);
        if (noMatch.length > 0) {
            const reasons = {
                noCandidates: 0,
                rejected: 0
            };
            noMatch.forEach(n => {
                if (n.history.length === 0) reasons.noCandidates++;
                else reasons.rejected++;
            });
            console.log(`   • Не было кандидатов с первого уровня: ${reasons.noCandidates}`);
            console.log(`   • Отсеяны на уровнях: ${reasons.rejected}`);
        }

        console.log(`\n🔵 НОВЫЕ ТОЧКИ ВО ВТОРОМ: ${unmatchedB.length}`);
        if (unmatchedB.length > 0) {
            console.log(`   Примеры:`);
            unmatchedB.slice(0, 3).forEach(b => {
                console.log(`   • ${b.id.slice(0,12)}... роль: ${b.features.role}, степень: ${b.features.degree}`);
            });
        }

        console.log(`\n📊 ИТОГОВАЯ СТАТИСТИКА:`);
        console.log(`   • Успешных пар: ${matches.length}`);
        console.log(`   • Спорных: ${ambiguous.length}`);
        console.log(`   • Новых в первом: ${noMatch.length}`);
        console.log(`   • Новых во втором: ${unmatchedB.length}`);
        console.log(`   • Ранних выходов: ${this.stats.earlyExits}`);
    }

    /**
     * Вычисление уверенности
     */
    calculateConfidence(data) {
        let score = 0;
        let totalWeight = 0;
       
        for (let i = 0; i < data.levels.length; i++) {
            const level = data.levels[i];
            const levelConfig = this.levels[i];
            if (!levelConfig?.enabled) continue;
           
            // Чем больше кандидатов отсеяно на уровне, тем выше уверенность
            const rejectionRate = level.rejected / level.before;
            score += rejectionRate * levelConfig.weight;
            totalWeight += levelConfig.weight;
        }
       
        return totalWeight > 0 ? score / totalWeight : 0.5;
    }
}

module.exports = HierarchicalMatcher;
