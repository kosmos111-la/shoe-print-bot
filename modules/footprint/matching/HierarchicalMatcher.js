// modules/footprint/matching/HierarchicalMatcher.js
// 🔥 МНОГОУРОВНЕВЫЙ МАТЧЕР С ИТЕРАТИВНОЙ СТАБИЛИЗАЦИЕЙ
// ИСПРАВЛЕНО: правильная итеративная логика с контрольными точками

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
            {   // УРОВЕНЬ 5: КОНТЕКСТ
                name: 'КОНТЕКСТ',
                features: ['gapPattern'],
                tolerances: ['soft'],
                groupLevel: false,
                weight: 0.10,
                enabled: true
            },
            {   // УРОВЕНЬ 6: ДЕТАЛЬНАЯ ПРОВЕРКА
                name: 'ДЕТАЛЬНАЯ ПРОВЕРКА',
                features: ['radialProfile', 'patternType', 'patternFrequency', 'neighborClusters'],
                tolerances: [0.3, 'strict', 2, 10],
                groupLevel: true,
                weight: 0.25,
                enabled: true
            }
        ];

        this.featureCache = new Map();
       
        // === НОВЫЕ ПОЛЯ ДЛЯ ИТЕРАТИВНОЙ СТАБИЛИЗАЦИИ ===
        this.zones = {
            core: new Map(),      // 100% стабильные
            zone1: new Map(),     // стабилизированные на 1-м проходе
            zone2: new Map(),     // стабилизированные на 2-м проходе
            zone3: new Map(),     // стабилизированные на 3-м проходе
            ambiguous: new Map(), // спорные
            new: new Map()        // новые точки
        };
       
        // Контрольные точки для отслеживания прогресса
        this.checkpoints = {
            beforeCore: 0,
            afterCore: 0,
            afterZone1: 0,
            afterZone2: 0,
            afterZone3: 0,
            final: 0
        };
       
        // Статистика
        this.stats = {
            levels: [],
            earlyExits: 0,
            totalPairs: 0,
            coreSize: 0,
            zone1Size: 0,
            zone2Size: 0,
            zone3Size: 0,
            newSize: 0
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
        this.diagnoseFirstPoint(pointsA, pointsB);

        const candidates = this.initializeCandidates(pointsA, pointsB);
        this.checkpoints.beforeCore = this.countActiveCandidates(candidates);

        // ШАГ 1: Многоуровневая фильтрация
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

        // ШАГ 2: Итеративная стабилизация
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`🔄 ИТЕРАТИВНАЯ СТАБИЛИЗАЦИЯ`);
        console.log(`${'─'.repeat(80)}`);
       
        this.iterativeStabilization(candidates);

        // ШАГ 3: Финальный анализ
        this.checkpoints.final = this.countActiveCandidates(candidates);
        return this.finalAnalysis(candidates, pointsB);
    }

    /**
     * 🔥 ИТЕРАТИВНАЯ СТАБИЛИЗАЦИЯ С КОНТРОЛЬНЫМИ ТОЧКАМИ
     */
    iterativeStabilization(candidates) {
        // Сначала находим ЯДРО (100% совпадения)
        console.log(`\n📌 [КОНТРОЛЬНАЯ ТОЧКА 1] Поиск ЯДРА...`);
        this.findCore(candidates);
        this.checkpoints.afterCore = this.zones.core.size;
        console.log(`   ✅ ЯДРО: ${this.zones.core.size} точек`);
       
        if (this.zones.core.size === 0) {
            console.log(`   ⚠️ Ядро не найдено, стабилизация невозможна`);
            return;
        }

        // 🔥 ФАЗА 1: Стабилизация ЗОНЫ 1 (связанные с ядром)
        console.log(`\n📌 [КОНТРОЛЬНАЯ ТОЧКА 2] Стабилизация ЗОНЫ 1...`);
        let zone1Iterations = 0;
        let zone1NewCount = 0;
       
        do {
            zone1Iterations++;
            zone1NewCount = 0;
           
            const stableRoles = this.getStableRoles();
            const stablePoints = this.getStablePointIds();
           
            const newStable = this.stabilizeZone1(candidates, stableRoles, stablePoints);
           
            if (newStable > 0) {
                console.log(`   • Итерация ${zone1Iterations}: +${newStable} точек в ЗОНУ 1`);
                zone1NewCount = newStable;
            }
           
            // Защита от бесконечного цикла
            if (zone1Iterations > 5) {
                console.log(`   ⚠️ Достигнут лимит итераций для ЗОНЫ 1`);
                break;
            }
           
        } while (zone1NewCount > 0);
       
        this.checkpoints.afterZone1 = this.zones.zone1.size;
        console.log(`\n📊 ИТОГ ЗОНЫ 1: +${this.zones.zone1.size} точек`);

        // 🔥 ФАЗА 2: Стабилизация ЗОНЫ 2 (связанные с ЗОНОЙ 1)
        if (this.zones.zone1.size > 0) {
            console.log(`\n📌 [КОНТРОЛЬНАЯ ТОЧКА 3] Стабилизация ЗОНЫ 2...`);
            let zone2Iterations = 0;
            let zone2NewCount = 0;
           
            do {
                zone2Iterations++;
                zone2NewCount = 0;
               
                const stableRoles = this.getStableRoles();
                const stablePoints = this.getStablePointIds();
               
                const newStable = this.stabilizeZone2(candidates, stableRoles, stablePoints);
               
                if (newStable > 0) {
                    console.log(`   • Итерация ${zone2Iterations}: +${newStable} точек в ЗОНУ 2`);
                    zone2NewCount = newStable;
                }
               
                if (zone2Iterations > 5) {
                    console.log(`   ⚠️ Достигнут лимит итераций для ЗОНЫ 2`);
                    break;
                }
               
            } while (zone2NewCount > 0);
           
            this.checkpoints.afterZone2 = this.zones.zone2.size;
            console.log(`\n📊 ИТОГ ЗОНЫ 2: +${this.zones.zone2.size} точек`);
        }

        // 🔥 ФАЗА 3: Стабилизация ЗОНЫ 3 (связанные с ЗОНОЙ 2)
        if (this.zones.zone2.size > 0) {
            console.log(`\n📌 [КОНТРОЛЬНАЯ ТОЧКА 4] Стабилизация ЗОНЫ 3...`);
            let zone3Iterations = 0;
            let zone3NewCount = 0;
           
            do {
                zone3Iterations++;
                zone3NewCount = 0;
               
                const stableRoles = this.getStableRoles();
                const stablePoints = this.getStablePointIds();
               
                const newStable = this.stabilizeZone3(candidates, stableRoles, stablePoints);
               
                if (newStable > 0) {
                    console.log(`   • Итерация ${zone3Iterations}: +${newStable} точек в ЗОНУ 3`);
                    zone3NewCount = newStable;
                }
               
                if (zone3Iterations > 5) {
                    console.log(`   ⚠️ Достигнут лимит итераций для ЗОНЫ 3`);
                    break;
                }
               
            } while (zone3NewCount > 0);
           
            this.checkpoints.afterZone3 = this.zones.zone3.size;
            console.log(`\n📊 ИТОГ ЗОНЫ 3: +${this.zones.zone3.size} точек`);
        }

        // Финальная статистика
        console.log(`\n📌 [КОНТРОЛЬНАЯ ТОЧКА 5] ИТОГ СТАБИЛИЗАЦИИ:`);
        console.log(`   • ЯДРО: ${this.zones.core.size} точек`);
        console.log(`   • ЗОНА 1: ${this.zones.zone1.size} точек`);
        console.log(`   • ЗОНА 2: ${this.zones.zone2.size} точек`);
        console.log(`   • ЗОНА 3: ${this.zones.zone3.size} точек`);
        console.log(`   • ВСЕГО: ${this.zones.core.size + this.zones.zone1.size + this.zones.zone2.size + this.zones.zone3.size} точек`);
       
        // Обновляем статистику
        this.stats.coreSize = this.zones.core.size;
        this.stats.zone1Size = this.zones.zone1.size;
        this.stats.zone2Size = this.zones.zone2.size;
        this.stats.zone3Size = this.zones.zone3.size;
    }

    /**
     * 🔥 ПОИСК ЯДРА (100% совпадение)
     */
    findCore(candidates) {
        for (const [pointId, data] of candidates) {
            if (data.candidates.length === 0) continue;
           
            for (const candidate of data.candidates) {
                if (this.isExactMatch(data.point, candidate)) {
                    this.zones.core.set(pointId, {
                        pointB: candidate.id,
                        confidence: 1.0,
                        reason: 'EXACT_MATCH',
                        zone: 'CORE',
                        role: data.point.role,
                        degree: data.point.degree,
                        neighborRoles: data.point.neighborRoles
                    });
                   
                    data.status = 'core';
                    data.candidates = [];
                    break;
                }
            }
        }
    }

    /**
     * 🔥 СТАБИЛИЗАЦИЯ ЗОНЫ 1 (строгая - все соседи стабильны)
     */
    stabilizeZone1(candidates, stableRoles, stablePoints) {
        let stabilized = 0;
       
        for (const [pointId, data] of candidates) {
            if (data.status === 'core' || data.status === 'zone1' || data.status === 'zone2' || data.status === 'zone3') continue;
            if (data.candidates.length === 0) continue;
           
            for (const candidate of data.candidates) {
                const analysis = this.analyzeZone1(data.point, candidate, stableRoles, stablePoints);
               
                if (analysis.stable) {
                    this.zones.zone1.set(pointId, {
                        pointB: candidate.id,
                        confidence: 1.0,
                        reason: analysis.reason,
                        zone: 'ZONE1',
                        role: data.point.role,
                        degree: data.point.degree,
                        neighborRoles: data.point.neighborRoles,
                        changes: analysis.changes
                    });
                   
                    data.status = 'zone1';
                    data.candidates = [];
                    stabilized++;
                    break;
                }
            }
        }
       
        return stabilized;
    }

    /**
     * 🔥 АНАЛИЗ ДЛЯ ЗОНЫ 1 (все соседи стабильны)
     */
    analyzeZone1(pointA, pointB, stableRoles, stablePoints) {
        const changes = [];
       
        const degreeDiff = (pointA.degree || 0) - (pointB.degree || 0);
       
        if (degreeDiff < 1) return { stable: false };
       
        const rolesB = pointB.neighborRoles || '';
        const remainingRoles = rolesB.split('');
       
        // В ЗОНЕ 1 все оставшиеся соседи должны быть стабильны
        const allRemainingStable = remainingRoles.every(role =>
            stableRoles.includes(role)
        );
       
        if (!allRemainingStable) {
            return { stable: false };
        }
       
        // Считаем, какие роли потеряны
        const rolesA = pointA.neighborRoles || '';
        const lostRoles = [];
        for (const role of ['H', 'C', 'B', 'R', 'L']) {
            const countA = (rolesA.match(new RegExp(role, 'g')) || []).length;
            const countB = (rolesB.match(new RegExp(role, 'g')) || []).length;
            for (let i = 0; i < countA - countB; i++) {
                lostRoles.push(role);
            }
        }
       
        changes.push({
            type: 'LOST_NEIGHBORS',
            roles: lostRoles,
            degreeDiff,
            remainingStable: true
        });
       
        return {
            stable: true,
            reason: `LOST_${lostRoles.length}_NEIGHBORS_BUT_STABLE`,
            changes
        };
    }

    /**
     * 🔥 СТАБИЛИЗАЦИЯ ЗОНЫ 2 (умеренная - до 1 нестабильного соседа)
     */
    stabilizeZone2(candidates, stableRoles, stablePoints) {
        let stabilized = 0;
       
        for (const [pointId, data] of candidates) {
            if (data.status === 'core' || data.status === 'zone1' || data.status === 'zone2' || data.status === 'zone3') continue;
            if (data.candidates.length === 0) continue;
           
            for (const candidate of data.candidates) {
                const analysis = this.analyzeZone2(data.point, candidate, stableRoles, stablePoints);
               
                if (analysis.stable) {
                    this.zones.zone2.set(pointId, {
                        pointB: candidate.id,
                        confidence: 1.0,
                        reason: analysis.reason,
                        zone: 'ZONE2',
                        role: data.point.role,
                        degree: data.point.degree,
                        neighborRoles: data.point.neighborRoles,
                        changes: analysis.changes
                    });
                   
                    data.status = 'zone2';
                    data.candidates = [];
                    stabilized++;
                    break;
                }
            }
        }
       
        return stabilized;
    }

    /**
     * 🔥 АНАЛИЗ ДЛЯ ЗОНЫ 2 (до 1 нестабильного соседа)
     */
    analyzeZone2(pointA, pointB, stableRoles, stablePoints) {
        const changes = [];
       
        const degreeDiff = (pointA.degree || 0) - (pointB.degree || 0);
       
        if (degreeDiff < 1) return { stable: false };
       
        const rolesB = pointB.neighborRoles || '';
        const remainingRoles = rolesB.split('');
       
        // В ЗОНЕ 2 разрешаем до 1 нестабильного соседа
        const unstableRemaining = remainingRoles.filter(role =>
            !stableRoles.includes(role)
        );
       
        if (unstableRemaining.length > 1) {
            return { stable: false };
        }
       
        // Считаем, какие роли потеряны
        const rolesA = pointA.neighborRoles || '';
        const lostRoles = [];
        for (const role of ['H', 'C', 'B', 'R', 'L']) {
            const countA = (rolesA.match(new RegExp(role, 'g')) || []).length;
            const countB = (rolesB.match(new RegExp(role, 'g')) || []).length;
            for (let i = 0; i < countA - countB; i++) {
                lostRoles.push(role);
            }
        }
       
        changes.push({
            type: 'LOST_NEIGHBORS',
            roles: lostRoles,
            degreeDiff,
            unstableRemaining: unstableRemaining.length
        });
       
        return {
            stable: true,
            reason: `LOST_${lostRoles.length}_NEIGHBORS_${unstableRemaining.length}_UNSTABLE`,
            changes
        };
    }

    /**
     * 🔥 СТАБИЛИЗАЦИЯ ЗОНЫ 3 (мягкая - до 2 нестабильных соседей)
     */
    stabilizeZone3(candidates, stableRoles, stablePoints) {
        let stabilized = 0;
       
        for (const [pointId, data] of candidates) {
            if (data.status === 'core' || data.status === 'zone1' || data.status === 'zone2' || data.status === 'zone3') continue;
            if (data.candidates.length === 0) continue;
           
            for (const candidate of data.candidates) {
                const analysis = this.analyzeZone3(data.point, candidate, stableRoles, stablePoints);
               
                if (analysis.stable) {
                    this.zones.zone3.set(pointId, {
                        pointB: candidate.id,
                        confidence: 1.0,
                        reason: analysis.reason,
                        zone: 'ZONE3',
                        role: data.point.role,
                        degree: data.point.degree,
                        neighborRoles: data.point.neighborRoles,
                        changes: analysis.changes
                    });
                   
                    data.status = 'zone3';
                    data.candidates = [];
                    stabilized++;
                    break;
                }
            }
        }
       
        return stabilized;
    }

    /**
     * 🔥 АНАЛИЗ ДЛЯ ЗОНЫ 3 (до 2 нестабильных соседей)
     */
    analyzeZone3(pointA, pointB, stableRoles, stablePoints) {
        const changes = [];
       
        const degreeDiff = (pointA.degree || 0) - (pointB.degree || 0);
       
        if (degreeDiff < 1) return { stable: false };
       
        const rolesB = pointB.neighborRoles || '';
        const remainingRoles = rolesB.split('');
       
        // В ЗОНЕ 3 разрешаем до 2 нестабильных соседей
        const unstableRemaining = remainingRoles.filter(role =>
            !stableRoles.includes(role)
        );
       
        if (unstableRemaining.length > 2) {
            return { stable: false };
        }
       
        // Считаем, какие роли потеряны
        const rolesA = pointA.neighborRoles || '';
        const lostRoles = [];
        for (const role of ['H', 'C', 'B', 'R', 'L']) {
            const countA = (rolesA.match(new RegExp(role, 'g')) || []).length;
            const countB = (rolesB.match(new RegExp(role, 'g')) || []).length;
            for (let i = 0; i < countA - countB; i++) {
                lostRoles.push(role);
            }
        }
       
        changes.push({
            type: 'LOST_NEIGHBORS',
            roles: lostRoles,
            degreeDiff,
            unstableRemaining: unstableRemaining.length
        });
       
        return {
            stable: true,
            reason: `LOST_${lostRoles.length}_NEIGHBORS_${unstableRemaining.length}_UNSTABLE`,
            changes
        };
    }

    /**
     * 🔥 ТОЧНОЕ СОВПАДЕНИЕ
     */
    isExactMatch(pointA, pointB) {
        const criticalFeatures = ['role', 'degree', 'triangles', 'clusterSize', 'neighborRoles'];
       
        for (const feat of criticalFeatures) {
            if (pointA[feat] !== pointB[feat]) return false;
        }
       
        if (pointA.neighborRoles !== pointB.neighborRoles) return false;
       
        return true;
    }

    /**
     * 🔥 ПОЛУЧИТЬ ВСЕ СТАБИЛЬНЫЕ РОЛИ
     */
    getStableRoles() {
        const roles = new Set();
       
        for (const [_, match] of this.zones.core) {
            if (match.role) roles.add(match.role);
        }
        for (const [_, match] of this.zones.zone1) {
            if (match.role) roles.add(match.role);
        }
        for (const [_, match] of this.zones.zone2) {
            if (match.role) roles.add(match.role);
        }
        for (const [_, match] of this.zones.zone3) {
            if (match.role) roles.add(match.role);
        }
       
        return Array.from(roles);
    }

    /**
     * 🔥 ПОЛУЧИТЬ ID ВСЕХ СТАБИЛЬНЫХ ТОЧЕК
     */
    getStablePointIds() {
        const ids = new Set();
       
        for (const [id, _] of this.zones.core) {
            ids.add(id);
        }
        for (const [id, _] of this.zones.zone1) {
            ids.add(id);
        }
        for (const [id, _] of this.zones.zone2) {
            ids.add(id);
        }
        for (const [id, _] of this.zones.zone3) {
            ids.add(id);
        }
       
        return ids;
    }

    /**
     * 🔥 ПОДСЧЕТ АКТИВНЫХ КАНДИДАТОВ
     */
    countActiveCandidates(candidates) {
        let count = 0;
        for (const [_, data] of candidates) {
            if (data.candidates.length > 0) count++;
        }
        return count;
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
       
        console.log(`\n🔍 patternFrequency:`);
        console.log(`   Точка А: ${firstPointA.patternFrequency} (${typeof firstPointA.patternFrequency})`);
        console.log(`   Точка Б: ${firstPointB.patternFrequency} (${typeof firstPointB.patternFrequency})`);
        console.log(`   Разница: ${Math.abs((firstPointA.patternFrequency || 0) - (firstPointB.patternFrequency || 0))}`);
       
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
     * ПРОВЕРКА ПРИЗНАКА
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
                if (feature === 'degree' || feature === 'triangles' ||
                    feature === 'clusterSize' || feature === 'patternFrequency' ||
                    feature === 'neighborClusters') {
                    return Math.abs(valA - valB) <= tolerance;
                } else {
                    const maxVal = Math.max(Math.abs(valA), Math.abs(valB), 0.001);
                    const minVal = Math.min(Math.abs(valA), Math.abs(valB));
                    if (maxVal < 0.001) return true;
                    return (1 - minVal / maxVal) <= tolerance;
                }
            } else if (Array.isArray(valA) && Array.isArray(valB)) {
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
        if (patternA === '0' && patternB === '0') return true;
        try {
            const objA = typeof patternA === 'string' && patternA !== '0' ? JSON.parse(patternA) : null;
            const objB = typeof patternB === 'string' && patternB !== '0' ? JSON.parse(patternB) : null;
           
            if (objA && objB) {
                return objA.type === objB.type;
            }
        } catch (e) {
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

    /**
     * 🔥 ФИНАЛЬНЫЙ АНАЛИЗ
     */
    finalAnalysis(candidates, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🏁 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ`);
        console.log(`${'='.repeat(100)}`);

        // Собираем ВСЕ стабилизированные точки из зон
        const matches = [];
        const usedB = new Set();
       
        for (const [pointId, match] of this.zones.core) {
            matches.push({
                pointA: pointId,
                pointB: match.pointB,
                confidence: 1.0,
                zone: 'CORE'
            });
            usedB.add(match.pointB);
        }
       
        for (const [pointId, match] of this.zones.zone1) {
            matches.push({
                pointA: pointId,
                pointB: match.pointB,
                confidence: 1.0,
                zone: 'ZONE1',
                changes: match.changes
            });
            usedB.add(match.pointB);
        }
       
        for (const [pointId, match] of this.zones.zone2) {
            matches.push({
                pointA: pointId,
                pointB: match.pointB,
                confidence: 1.0,
                zone: 'ZONE2',
                changes: match.changes
            });
            usedB.add(match.pointB);
        }
       
        for (const [pointId, match] of this.zones.zone3) {
            matches.push({
                pointA: pointId,
                pointB: match.pointB,
                confidence: 1.0,
                zone: 'ZONE3',
                changes: match.changes
            });
            usedB.add(match.pointB);
        }

        // Обрабатываем оставшиеся candidates
        const ambiguous = [];
        const noMatch = [];
       
        const sorted = Array.from(candidates.entries())
            .sort((a, b) => a[1].candidates.length - b[1].candidates.length);

        for (const [pointId, data] of sorted) {
            if (data.status === 'core' || data.status === 'zone1' || data.status === 'zone2' || data.status === 'zone3') continue;
           
            if (data.candidates.length === 0) {
                noMatch.push(pointId);
                continue;
            }
          
            const available = data.candidates.filter(c => !usedB.has(c.id));
          
            if (available.length === 1) {
                matches.push({
                    pointA: pointId,
                    pointB: available[0].id,
                    confidence: this.calculateConfidence(data),
                    zone: 'MATCHED'
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

        // Статистика по зонам
        console.log(`\n📍 СТАТИСТИКА ПО ЗОНАМ:`);
        console.log(`   • 🟣 ЯДРО (100%): ${this.zones.core.size} точек`);
        console.log(`   • 🔵 ЗОНА 1 (все соседи стабильны): ${this.zones.zone1.size} точек`);
        console.log(`   • 🟡 ЗОНА 2 (до 1 нестабильного соседа): ${this.zones.zone2.size} точек`);
        console.log(`   • 🟠 ЗОНА 3 (до 2 нестабильных соседей): ${this.zones.zone3.size} точек`);
        console.log(`   • 🟢 Найдено через допуски: ${matches.length - this.zones.core.size - this.zones.zone1.size - this.zones.zone2.size - this.zones.zone3.size} точек`);

        console.log(`\n✅ ОДНОЗНАЧНЫЕ СООТВЕТСТВИЯ (ЯКОРЯ): ${matches.length}`);
        if (matches.length > 0) {
            matches.slice(0, 5).forEach((m, i) => {
                const zoneInfo = m.zone ? ` [${m.zone}]` : '';
                console.log(`   ${i+1}. ${m.pointA.slice(0,12)}... ↔ ${m.pointB.slice(0,12)}... (уверенность ${(m.confidence*100).toFixed(0)}%)${zoneInfo}`);
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
            zones: {
                core: Array.from(this.zones.core.entries()).map(([id, m]) => ({ id, pointB: m.pointB })),
                zone1: Array.from(this.zones.zone1.entries()).map(([id, m]) => ({ id, pointB: m.pointB, changes: m.changes })),
                zone2: Array.from(this.zones.zone2.entries()).map(([id, m]) => ({ id, pointB: m.pointB, changes: m.changes })),
                zone3: Array.from(this.zones.zone3.entries()).map(([id, m]) => ({ id, pointB: m.pointB, changes: m.changes }))
            },
            stats: {
                totalPairs: matches.length,
                ambiguous: ambiguous.length,
                uniqueA: noMatch.length,
                uniqueB: unmatchedB.length,
                earlyExits: this.stats.earlyExits,
                coreSize: this.zones.core.size,
                zone1Size: this.zones.zone1.size,
                zone2Size: this.zones.zone2.size,
                zone3Size: this.zones.zone3.size
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

    /**
     * 🔥 ПОЛУЧИТЬ ЗОНЫ
     */
    getZones() {
        return {
            core: Array.from(this.zones.core.entries()).map(([id, m]) => ({ pointA: id, pointB: m.pointB })),
            zone1: Array.from(this.zones.zone1.entries()).map(([id, m]) => ({ pointA: id, pointB: m.pointB, changes: m.changes })),
            zone2: Array.from(this.zones.zone2.entries()).map(([id, m]) => ({ pointA: id, pointB: m.pointB, changes: m.changes })),
            zone3: Array.from(this.zones.zone3.entries()).map(([id, m]) => ({ pointA: id, pointB: m.pointB, changes: m.changes }))
        };
    }
}

module.exports = HierarchicalMatcher;
