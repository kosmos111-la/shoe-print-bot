// modules/footprint/topology/CenterMatcher.js
// 🔥 ПОИСК НАДЁЖНЫХ ТОЧЕК С ЖЁСТКОЙ ФИЛЬТРАЦИЕЙ

class CenterMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minLocalSimilarity = options.minLocalSimilarity || 0.5;
        this.minMorphologySimilarity = options.minMorphologySimilarity || 0.6;
        this.minConsistentPairs = options.minConsistentPairs || 1;
       
        // 🔥 ПОРОГИ ДЛЯ НАДЁЖНЫХ ТОЧЕК
        this.reliableMorphThreshold = 0.95;      // морфология 95%+
        this.reliableLocalThreshold = 0.85;       // локальное сходство 85%+
        this.maxDistance = 30;                     // макс. расстояние 30px
        this.minDistanceRatio = 0.85;               // мин. соотношение расстояний 85%
       
        this.localGroupSignature = options.localGroupSignature;
        this.morphologyEncoder = options.morphologyEncoder;
       
        this.centerMatches = new Map();
        this.consistencyGraph = new Map();
        this.depthUsage = new Map();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
       
        console.log('🎯 CenterMatcher с ЖЁСТКИМ отбором надёжных точек создан');
        console.log(`   🔥 Морфология ≥ ${this.reliableMorphThreshold * 100}%`);
        console.log(`   🔥 Локальное сходство ≥ ${this.reliableLocalThreshold * 100}%`);
        console.log(`   🔥 Макс. расстояние: ${this.maxDistance}px`);
        console.log(`   🔥 Мин. соотношение расстояний: ${this.minDistanceRatio * 100}%`);
    }

    findCenterMatches(photoGraph, modelGraph, photoMorphology, modelMorphology) {
        console.log(`\n🔍 Ищу НАДЁЖНЫЕ точки по всему следу...`);

        const candidates = [];
        const photoNodes = Array.from(photoGraph.nodes.entries());
        const modelNodes = Array.from(modelGraph.nodes.entries());

        // Обнуляем статистику
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
        this.depthUsage.clear();

        // 🔥 ЭТАП 1: СБОР КАНДИДАТОВ
        for (const [photoId, photoNode] of photoNodes) {
            const photoZone = this.getZone(photoNode.y);
           
            const depthResult = this.localGroupSignature.findOptimalDepth(
                photoId,
                photoGraph,
                modelGraph,
                modelGraph.nodes,
                photoMorphology
            );

            const depth = depthResult.optimalDepth;
            this.depthUsage.set(depth, (this.depthUsage.get(depth) || 0) + 1);
            this.zoneStats[photoZone]++;

            for (const candidate of depthResult.candidates) {
                const modelNode = modelGraph.nodes.get(candidate.modelId);
                if (!modelNode) continue;

                const modelZone = this.getZone(modelNode.y);
               
                const morphScore = this.compareMorphology(
                    photoId, candidate.modelId,
                    photoMorphology, modelMorphology
                );

                // 🔥 РАССТОЯНИЕ МЕЖДУ ТОЧКАМИ
                const dx = photoNode.x - modelNode.x;
                const dy = photoNode.y - modelNode.y;
                const distance = Math.sqrt(dx*dx + dy*dy);

                candidates.push({
                    photoId,
                    modelId: candidate.modelId,
                    photoNode,
                    modelNode,
                    photoZone,
                    modelZone,
                    localScore: candidate.similarity,
                    morphScore,
                    distance,
                    depth: candidate.depth
                });
            }
        }

        console.log(`\n📊 ЭТАП 1: Найдено ${candidates.length} кандидатов`);

        // 🔥 ЭТАП 2: ЖЁСТКАЯ ФИЛЬТРАЦИЯ ПО ИНДИВИДУАЛЬНЫМ КРИТЕРИЯМ
        const filteredCandidates = candidates.filter(c => {
            // 1. Морфология должна быть почти идеальной
            if (c.morphScore < this.reliableMorphThreshold) {
                if (this.debug && c.morphScore > 0.8) {
                    console.log(`   ❌ Отсев по морфологии: ${(c.morphScore*100).toFixed(0)}% < ${this.reliableMorphThreshold*100}%`);
                }
                return false;
            }
           
            // 2. Локальное сходство высокое
            if (c.localScore < this.reliableLocalThreshold) {
                if (this.debug && c.localScore > 0.8) {
                    console.log(`   ❌ Отсев по локальному сходству: ${(c.localScore*100).toFixed(0)}% < ${this.reliableLocalThreshold*100}%`);
                }
                return false;
            }
           
            // 3. ЗОНЫ ДОЛЖНЫ СОВПАДАТЬ
            if (c.photoZone !== c.modelZone) {
                if (this.debug) {
                    console.log(`   ❌ Отсев по зоне: ${c.photoZone} ≠ ${c.modelZone}`);
                }
                return false;
            }
           
            // 4. Расстояние между точками должно быть малым
            if (c.distance > this.maxDistance) {
                if (this.debug) {
                    console.log(`   ❌ Отсев по расстоянию: ${c.distance.toFixed(0)}px > ${this.maxDistance}px`);
                }
                return false;
            }
           
            return true;
        });

        console.log(`\n📊 ЭТАП 2: После фильтрации осталось ${filteredCandidates.length} кандидатов`);

        // 🔥 ЭТАП 3: ПРОВЕРКА СОГЛАСОВАННОСТИ ГРУППЫ
        const consistentPairs = [];
       
        for (let i = 0; i < filteredCandidates.length; i++) {
            for (let j = i + 1; j < filteredCandidates.length; j++) {
                if (this.areConsistent(filteredCandidates[i], filteredCandidates[j])) {
                    consistentPairs.push([i, j]);
                }
            }
        }

        // 🔥 ЭТАП 4: ПОИСК МАКСИМАЛЬНОЙ СОГЛАСОВАННОЙ ГРУППЫ
        const groups = new Map(); // index -> group
       
        for (const [i, j] of consistentPairs) {
            if (!groups.has(i)) groups.set(i, new Set([i]));
            if (!groups.has(j)) groups.set(j, new Set([j]));
           
            const groupI = groups.get(i);
            const groupJ = groups.get(j);
           
            if (groupI !== groupJ) {
                // Объединяем группы
                const merged = new Set([...groupI, ...groupJ]);
                for (const idx of merged) {
                    groups.set(idx, merged);
                }
            }
        }

        // Находим самую большую группу
        let maxGroup = new Set();
        for (const group of groups.values()) {
            if (group.size > maxGroup.size) maxGroup = group;
        }

        // Если нет согласованных групп, берём одиночные точки с максимальной уверенностью
        if (maxGroup.size === 0 && filteredCandidates.length > 0) {
            filteredCandidates.sort((a, b) => b.morphScore - a.morphScore);
            maxGroup.add(0); // берём лучшую точку
            console.log(`\n⚠️ Согласованных групп нет, беру лучшую точку`);
        }

        console.log(`\n📊 ЭТАП 3: Найдена согласованная группа из ${maxGroup.size} точек`);

        // 🔥 ЭТАП 5: ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
        const result = new Map();
        let count = 0;
       
        for (const idx of maxGroup) {
            const c = filteredCandidates[idx];
            result.set(c.photoId, {
                modelId: c.modelId,
                confidence: (c.morphScore + c.localScore) / 2,
                distance: c.distance,
                zone: c.photoZone
            });
            count++;
           
            if (this.debug && count <= 10) {
                console.log(`   ✅ Надёжная точка ${count}: ${c.photoZone} | расстояние: ${c.distance.toFixed(0)}px | морф:${(c.morphScore*100).toFixed(0)}% лок:${(c.localScore*100).toFixed(0)}%`);
            }
        }

        console.log(`\n🎯 ИТОГО: Найдено ${result.size} НАДЁЖНЫХ точек`);

        return result;
    }

    // ==================== ПРОВЕРКА СОГЛАСОВАННОСТИ ====================

    areConsistent(a, b) {
        // Расстояние между точками в фото
        const dxPhoto = a.photoNode.x - b.photoNode.x;
        const dyPhoto = a.photoNode.y - b.photoNode.y;
        const distPhoto = Math.sqrt(dxPhoto*dxPhoto + dyPhoto*dyPhoto);
       
        // Расстояние между точками в модели
        const dxModel = a.modelNode.x - b.modelNode.x;
        const dyModel = a.modelNode.y - b.modelNode.y;
        const distModel = Math.sqrt(dxModel*dxModel + dyModel*dyModel);
       
        if (distPhoto === 0 || distModel === 0) return true;
       
        const ratio = Math.min(distPhoto, distModel) / Math.max(distPhoto, distModel);
        const consistent = ratio >= this.minDistanceRatio;
       
        if (this.debug && !consistent && ratio > 0.7) {
            console.log(`   ❌ Несогласованы: расстояние в фото ${distPhoto.toFixed(0)}px, в модели ${distModel.toFixed(0)}px, ratio ${(ratio*100).toFixed(0)}%`);
        }
       
        return consistent;
    }

    compareMorphology(photoId, modelId, photoMorph, modelMorph) {
        const pm = photoMorph?.get(photoId);
        const mm = modelMorph?.get(modelId);
       
        if (!pm || !mm || !pm.hasContour || !mm.hasContour) return 0.5;
       
        return this.morphologyEncoder.compare(pm, mm);
    }

    // ==================== ОПРЕДЕЛЕНИЕ ЗОНЫ ====================

    getZone(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            minLocalSimilarity: this.minLocalSimilarity,
            minMorphologySimilarity: this.minMorphologySimilarity,
            minConsistentPairs: this.minConsistentPairs,
            reliableMorphThreshold: this.reliableMorphThreshold,
            reliableLocalThreshold: this.reliableLocalThreshold,
            maxDistance: this.maxDistance,
            minDistanceRatio: this.minDistanceRatio,
            depthUsage: Object.fromEntries(this.depthUsage),
            zoneStats: this.zoneStats
        };
    }

    clear() {
        this.centerMatches.clear();
        this.consistencyGraph.clear();
        this.depthUsage.clear();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
    }
}

module.exports = CenterMatcher;
