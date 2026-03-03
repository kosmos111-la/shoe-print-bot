// modules/footprint/matching/AdaptiveMatcher.js
// 🎯 4-Й ЭТАП: ПОИСК УНИКАЛЬНЫХ ТОЧЕК С ДОПУСКАМИ (БЕЗ ВЕСОВ)
// 📊 С ДЕТАЛЬНОЙ СТАТИСТИКОЙ ОТСЕВА

class AdaptiveMatcher {
    constructor(options = {}) {
        this.debug = options.debug !== false;
        this.verbose = options.verbose || false;

        // 🔥 ДОПУСКИ вместо весов
        this.tolerances = options.tolerances || {
            compactness: 0.1,        // 10% допуск
            eccentricity: 0.05,       // абсолютный допуск
            normalizedArea: 0.15,      // 15% допуск
            radialProfile: 0.1,        // средняя разница
            degree: 2,                 // максимум разница в степени
            triangles: 1,               // максимум разница в треугольников
            role: 'strict'              // роли должны совпадать строго
        };

        this.stats = {
            totalPointsA: 0,
            totalPointsB: 0,
            uniquePointsA: 0,
            uniquePointsB: 0,
            exactMatches: 0,
            toleranceMatches: 0,
            conflictsResolved: 0
        };

        // Статистика отсева
        this.rejectionStats = {
            total: 0,
            byReason: {},
            byTolerance: {
                compactness: { total: 0, sumDiff: 0, maxDiff: 0 },
                eccentricity: { total: 0, sumDiff: 0, maxDiff: 0 },
                area: { total: 0, sumDiff: 0, maxDiff: 0 },
                radialProfile: { total: 0, sumDiff: 0, maxDiff: 0 },
                degree: { total: 0, sumDiff: 0, maxDiff: 0 },
                triangles: { total: 0, sumDiff: 0, maxDiff: 0 },
                role: { total: 0, sumDiff: 0, maxDiff: 0 }
            },
            samples: []
        };

        console.log('🎯 AdaptiveMatcher (4-й этап - допуски) создан');
    }

    /**
     * ОСНОВНОЙ МЕТОД: найти соответствия между двумя наборами точек
     */
    findMatches(pointsA, pointsB) {
        const startTime = Date.now();

        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 4-Й ЭТАП: ПОИСК ПО ДОПУСКАМ`);
        console.log(`${'='.repeat(80)}`);
        console.log(`📊 Всего точек в следе А: ${pointsA.length}`);
        console.log(`📊 Всего точек в следе Б: ${pointsB.length}`);

        this.stats.totalPointsA = pointsA.length;
        this.stats.totalPointsB = pointsB.length;

        // ШАГ 1: Находим уникальные точки в каждом следе
        console.log(`\n🔎 ШАГ 1: Анализ уникальности точек...`);

        const { unique: uniqueA, stats: statsA } = this.findUniquePoints(pointsA);
        const { unique: uniqueB, stats: statsB } = this.findUniquePoints(pointsB);

        console.log(`\n📊 УНИКАЛЬНЫЕ ТОЧКИ В СЛЕДЕ А:`);
        console.log(`   • Найдено: ${uniqueA.length} из ${pointsA.length}`);
        console.log(`   • Уникальных подписей: ${statsA.uniqueSignatures}`);

        console.log(`\n📊 УНИКАЛЬНЫЕ ТОЧКИ В СЛЕДЕ Б:`);
        console.log(`   • Найдено: ${uniqueB.length} из ${pointsB.length}`);
        console.log(`   • Уникальных подписей: ${statsB.uniqueSignatures}`);

        this.stats.uniquePointsA = uniqueA.length;
        this.stats.uniquePointsB = uniqueB.length;

        // 🔥 Статистика отсева (до сравнения)
        if (this.debug) {
            this.collectRejectionStats(pointsA, pointsB);
            this.printRejectionStats();
        }

        // ШАГ 2: Сопоставляем уникальные точки
        console.log(`\n🔎 ШАГ 2: Сопоставление по допускам...`);

        const matches = this.matchPointsWithTolerances(uniqueA, uniqueB);

        console.log(`\n📊 РЕЗУЛЬТАТЫ СОПОСТАВЛЕНИЯ:`);
        console.log(`   • Точных совпадений: ${this.stats.exactMatches}`);
        console.log(`   • Совпадений в пределах допусков: ${this.stats.toleranceMatches}`);
        console.log(`   • Всего пар: ${matches.length}`);

        // ШАГ 3: Проверка на конфликты
        console.log(`\n🔎 ШАГ 3: Проверка уникальности соответствий...`);

        const validated = this.validateMatches(matches);

        console.log(`   • Конфликтов разрешено: ${this.stats.conflictsResolved}`);
        console.log(`   • Итоговое число пар: ${validated.length}`);

        // ШАГ 4: Детальный анализ найденных пар
        if (validated.length > 0) {
            console.log(`\n📋 ДЕТАЛЬНЫЙ АНАЛИЗ НАЙДЕННЫХ ПАР (первые 5):`);
            console.log(`┌─────┬──────────────────────┬──────────────────────┬───────────┐`);
            console.log(`│  #  │       ТОЧКА А         │       ТОЧКА Б         │ СТАТУС    │`);
            console.log(`├─────┼──────────────────────┼──────────────────────┼───────────┤`);

            validated.slice(0, 5).forEach((match, i) => {
                const status = match.exact ? 'ТОЧНОЕ' : 'ДОПУСК';
                console.log(
                    `│ ${(i+1).toString().padEnd(3)} │ ${match.pointA.substring(0,20).padEnd(20)} │ ` +
                    `${match.pointB.substring(0,20).padEnd(20)} │ ${status.padEnd(9)} │`
                );
            });
            console.log(`└─────┴──────────────────────┴──────────────────────┴───────────┘`);
        }

        console.log(`\n⏱️  Время выполнения: ${Date.now() - startTime}ms`);
        console.log(`${'='.repeat(80)}`);

        return validated;
    }

    /**
     * Находит уникальные точки в наборе
     */
    findUniquePoints(points) {
        const signatureCounts = new Map();
        const pointSignatures = new Map();

        // Создаем детальные подписи для всех точек
        for (const point of points) {
            const signature = this.createDetailedSignature(point);
            pointSignatures.set(point.id, signature);
            signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
        }

        // Собираем статистику по подписям
        const signatureStats = Array.from(signatureCounts.entries())
            .map(([sig, count]) => ({ signature: sig, count }))
            .sort((a, b) => a.count - b.count);

        const uniqueSignatures = signatureStats.filter(s => s.count === 1);
        const uniquePoints = points.filter(p => {
            const sig = pointSignatures.get(p.id);
            return signatureCounts.get(sig) === 1;
        });

        return {
            unique: uniquePoints,
            stats: {
                uniqueSignatures: uniqueSignatures.length
            }
        };
    }

    /**
     * Создает ДЕТАЛЬНУЮ подпись точки (с допусками)
     */
    createDetailedSignature(point) {
        const components = [
            point.role || 'R',
            point.compactness ? point.compactness.toFixed(2) : '0.00',
            point.eccentricity ? point.eccentricity.toFixed(3) : '0.000',
            point.normalizedArea ? point.normalizedArea.toFixed(2) : '1.00',
            point.radialProfile ? point.radialProfile.map(v => v.toFixed(2)).join(',') : '0.00,0.00,0.00,0.00',
            point.neighborRoles || '',
            `D${point.degree || 0}`,
            `T${point.triangles || 0}`
        ];

        return components.join('|');
    }

    /**
     * Сопоставляет точки с использованием допусков
     */
    matchPointsWithTolerances(pointsA, pointsB) {
        const matches = [];
        const usedB = new Set();

        // Сортируем точки A по важности (хабы первыми)
        const sortedA = this.sortByImportance(pointsA);

        for (const pointA of sortedA) {
            let bestMatch = null;
            let bestMatchType = null;

            for (const pointB of pointsB) {
                if (usedB.has(pointB.id)) continue;

                // Проверяем точное совпадение подписи
                if (this.signaturesEqual(pointA, pointB)) {
                    bestMatch = pointB;
                    bestMatchType = 'exact';
                    break;
                }

                // Проверяем совпадение в пределах допусков
                if (this.withinTolerances(pointA, pointB)) {
                    // Если еще нет лучшего или этот лучше по степени
                    if (!bestMatch || pointB.degree > bestMatch.degree) {
                        bestMatch = pointB;
                        bestMatchType = 'tolerance';
                    }
                }
            }

            if (bestMatch) {
                matches.push({
                    pointA: pointA.id,
                    pointB: bestMatch.id,
                    exact: bestMatchType === 'exact',
                    score: bestMatchType === 'exact' ? 1.0 : 0.9
                });
                usedB.add(bestMatch.id);

                if (bestMatchType === 'exact') {
                    this.stats.exactMatches++;
                } else {
                    this.stats.toleranceMatches++;
                }

                if (this.debug) {
                    console.log(`   ${bestMatchType === 'exact' ? '✅ ТОЧНОЕ' : '🟡 ДОПУСК'}: ${pointA.id.slice(0,12)} ↔ ${bestMatch.id.slice(0,12)}`);
                }
            }
        }

        return matches;
    }

    /**
     * Проверяет точное равенство подписей
     */
    signaturesEqual(pointA, pointB) {
        const sigA = this.createDetailedSignature(pointA);
        const sigB = this.createDetailedSignature(pointB);
        return sigA === sigB;
    }

    /**
     * Проверяет, находятся ли точки в пределах допусков
     */
    withinTolerances(pointA, pointB) {
        // 1. Роль должна совпадать строго
        if (pointA.role !== pointB.role) {
            this.logRejection(pointA, pointB, 'role_mismatch', {
                expected: pointA.role,
                actual: pointB.role,
                diff: 1,
                tolerance: 'strict'
            });
            return false;
        }

        // 2. Компактность в пределах допуска
        if (pointA.compactness && pointB.compactness) {
            const ratio = Math.min(pointA.compactness, pointB.compactness) /
                         Math.max(pointA.compactness, pointB.compactness);
            const diff = 1 - ratio;
            if (diff > this.tolerances.compactness) {
                this.logRejection(pointA, pointB, 'compactness', {
                    expected: pointA.compactness,
                    actual: pointB.compactness,
                    diff: diff,
                    tolerance: this.tolerances.compactness
                });
                return false;
            }
        }

        // 3. Эксцентриситет в пределах допуска
        if (pointA.eccentricity && pointB.eccentricity) {
            const diff = Math.abs(pointA.eccentricity - pointB.eccentricity);
            if (diff > this.tolerances.eccentricity) {
                this.logRejection(pointA, pointB, 'eccentricity', {
                    expected: pointA.eccentricity,
                    actual: pointB.eccentricity,
                    diff: diff,
                    tolerance: this.tolerances.eccentricity
                });
                return false;
            }
        }

        // 4. Нормированная площадь в пределах допуска
        if (pointA.normalizedArea && pointB.normalizedArea) {
            const ratio = Math.min(pointA.normalizedArea, pointB.normalizedArea) /
                         Math.max(pointA.normalizedArea, pointB.normalizedArea);
            const diff = 1 - ratio;
            if (diff > this.tolerances.normalizedArea) {
                this.logRejection(pointA, pointB, 'area', {
                    expected: pointA.normalizedArea,
                    actual: pointB.normalizedArea,
                    diff: diff,
                    tolerance: this.tolerances.normalizedArea
                });
                return false;
            }
        }

        // 5. Радиальный профиль
        if (pointA.radialProfile && pointB.radialProfile) {
            const avgDiff = this.averageProfileDiff(pointA.radialProfile, pointB.radialProfile);
            if (avgDiff > this.tolerances.radialProfile) {
                this.logRejection(pointA, pointB, 'radialProfile', {
                    diff: avgDiff,
                    tolerance: this.tolerances.radialProfile
                });
                return false;
            }
        }

        // 6. Степень
        const degreeDiff = Math.abs(pointA.degree - pointB.degree);
        if (degreeDiff > this.tolerances.degree) {
            this.logRejection(pointA, pointB, 'degree', {
                expected: pointA.degree,
                actual: pointB.degree,
                diff: degreeDiff,
                tolerance: this.tolerances.degree
            });
            return false;
        }

        // 7. Треугольники
        const trianglesDiff = Math.abs(pointA.triangles - pointB.triangles);
        if (trianglesDiff > this.tolerances.triangles) {
            this.logRejection(pointA, pointB, 'triangles', {
                expected: pointA.triangles,
                actual: pointB.triangles,
                diff: trianglesDiff,
                tolerance: this.tolerances.triangles
            });
            return false;
        }

        return true;
    }

    /**
     * Собирает статистику по reject-ам для анализа
     */
    collectRejectionStats(pointsA, pointsB) {
        this.rejectionStats = {
            total: 0,
            byReason: {},
            byTolerance: {
                compactness: { total: 0, sumDiff: 0, maxDiff: 0 },
                eccentricity: { total: 0, sumDiff: 0, maxDiff: 0 },
                area: { total: 0, sumDiff: 0, maxDiff: 0 },
                radialProfile: { total: 0, sumDiff: 0, maxDiff: 0 },
                degree: { total: 0, sumDiff: 0, maxDiff: 0 },
                triangles: { total: 0, sumDiff: 0, maxDiff: 0 },
                role: { total: 0, sumDiff: 0, maxDiff: 0 }
            },
            samples: []
        };

        let sampleCount = 0;
        const maxSamples = 200; // Ограничиваем для производительности

        for (const pointA of pointsA.slice(0, 30)) {
            for (const pointB of pointsB.slice(0, 30)) {
                if (sampleCount++ > maxSamples) break;
               
                const rejection = this.analyzeRejection(pointA, pointB);
                if (rejection.rejected) {
                    this.rejectionStats.total++;
                    this.rejectionStats.byReason[rejection.reason] =
                        (this.rejectionStats.byReason[rejection.reason] || 0) + 1;
                   
                    if (rejection.details) {
                        for (const [key, value] of Object.entries(rejection.details)) {
                            if (this.rejectionStats.byTolerance[key]) {
                                this.rejectionStats.byTolerance[key].total++;
                                this.rejectionStats.byTolerance[key].sumDiff += value.diff;
                                this.rejectionStats.byTolerance[key].maxDiff =
                                    Math.max(this.rejectionStats.byTolerance[key].maxDiff, value.diff);
                            }
                        }
                    }
                   
                    if (this.rejectionStats.samples.length < 5) {
                        this.rejectionStats.samples.push({
                            pointA: pointA.id.slice(0,12),
                            pointB: pointB.id.slice(0,12),
                            reason: rejection.reason,
                            details: rejection.details
                        });
                    }
                }
            }
        }
    }

    /**
     * Анализирует причину reject-а для пары точек
     */
    analyzeRejection(pointA, pointB) {
        // Роль
        if (pointA.role !== pointB.role) {
            return {
                rejected: true,
                reason: 'role_mismatch',
                details: { role: { expected: pointA.role, actual: pointB.role, diff: 1 } }
            };
        }

        // Компактность
        if (pointA.compactness && pointB.compactness) {
            const ratio = Math.min(pointA.compactness, pointB.compactness) /
                         Math.max(pointA.compactness, pointB.compactness);
            const diff = 1 - ratio;
            if (diff > this.tolerances.compactness) {
                return {
                    rejected: true,
                    reason: 'compactness',
                    details: {
                        compactness: {
                            expected: pointA.compactness,
                            actual: pointB.compactness,
                            diff: diff,
                            tolerance: this.tolerances.compactness
                        }
                    }
                };
            }
        }

        // Эксцентриситет
        if (pointA.eccentricity && pointB.eccentricity) {
            const diff = Math.abs(pointA.eccentricity - pointB.eccentricity);
            if (diff > this.tolerances.eccentricity) {
                return {
                    rejected: true,
                    reason: 'eccentricity',
                    details: {
                        eccentricity: {
                            expected: pointA.eccentricity,
                            actual: pointB.eccentricity,
                            diff: diff,
                            tolerance: this.tolerances.eccentricity
                        }
                    }
                };
            }
        }

        // Площадь
        if (pointA.normalizedArea && pointB.normalizedArea) {
            const ratio = Math.min(pointA.normalizedArea, pointB.normalizedArea) /
                         Math.max(pointA.normalizedArea, pointB.normalizedArea);
            const diff = 1 - ratio;
            if (diff > this.tolerances.normalizedArea) {
                return {
                    rejected: true,
                    reason: 'area',
                    details: {
                        area: {
                            expected: pointA.normalizedArea,
                            actual: pointB.normalizedArea,
                            diff: diff,
                            tolerance: this.tolerances.normalizedArea
                        }
                    }
                };
            }
        }

        // Радиальный профиль
        if (pointA.radialProfile && pointB.radialProfile) {
            const avgDiff = this.averageProfileDiff(pointA.radialProfile, pointB.radialProfile);
            if (avgDiff > this.tolerances.radialProfile) {
                return {
                    rejected: true,
                    reason: 'radialProfile',
                    details: {
                        radialProfile: {
                            diff: avgDiff,
                            tolerance: this.tolerances.radialProfile
                        }
                    }
                };
            }
        }

        // Степень
        const degreeDiff = Math.abs(pointA.degree - pointB.degree);
        if (degreeDiff > this.tolerances.degree) {
            return {
                rejected: true,
                reason: 'degree',
                details: {
                    degree: {
                        expected: pointA.degree,
                        actual: pointB.degree,
                        diff: degreeDiff,
                        tolerance: this.tolerances.degree
                    }
                }
            };
        }

        // Треугольники
        const trianglesDiff = Math.abs(pointA.triangles - pointB.triangles);
        if (trianglesDiff > this.tolerances.triangles) {
            return {
                rejected: true,
                reason: 'triangles',
                details: {
                    triangles: {
                        expected: pointA.triangles,
                        actual: pointB.triangles,
                        diff: trianglesDiff,
                        tolerance: this.tolerances.triangles
                    }
                }
            };
        }

        return { rejected: false };
    }

    /**
     * Выводит детальную статистику по reject-ам
     */
    printRejectionStats() {
        console.log(`\n📊 ДЕТАЛЬНАЯ СТАТИСТИКА ОТСЕВА:`);
        console.log(`   • Всего reject-ов в выборке: ${this.rejectionStats.total}`);
       
        console.log(`\n📈 РАСПРЕДЕЛЕНИЕ ПО ПРИЧИНАМ:`);
        for (const [reason, count] of Object.entries(this.rejectionStats.byReason)) {
            const percent = (count / this.rejectionStats.total * 100).toFixed(1);
            console.log(`   • ${reason}: ${count} (${percent}%)`);
        }

        console.log(`\n📐 СТАТИСТИКА ПО ДОПУСКАМ:`);
        for (const [key, value] of Object.entries(this.rejectionStats.byTolerance)) {
            if (value.total > 0) {
                const avgDiff = (value.sumDiff / value.total * 100).toFixed(1);
                const maxDiff = (value.maxDiff * 100).toFixed(1);
                console.log(`   • ${key}: среднее отклонение ${avgDiff}%, макс ${maxDiff}% (${value.total} срабатываний)`);
            }
        }

        if (this.rejectionStats.samples.length > 0) {
            console.log(`\n🔍 ПРИМЕРЫ ОТСЕВА:`);
            this.rejectionStats.samples.forEach((sample, i) => {
                console.log(`   ${i+1}. ${sample.pointA} ↔ ${sample.pointB}`);
                console.log(`      Причина: ${sample.reason}`);
                if (sample.details) {
                    for (const [key, val] of Object.entries(sample.details)) {
                        if (val.expected !== undefined) {
                            console.log(`         ${key}: ожидалось ${val.expected.toFixed(3)}, получено ${val.actual.toFixed(3)} (разница ${(val.diff*100).toFixed(1)}%)`);
                        } else {
                            console.log(`         ${key}: разница ${(val.diff*100).toFixed(1)}% (допуск ${(val.tolerance*100).toFixed(1)}%)`);
                        }
                    }
                }
            });
        }
    }

    /**
     * Средняя разница между профилями
     */
    averageProfileDiff(profA, profB) {
        let sum = 0;
        const len = Math.min(profA.length, profB.length);
        for (let i = 0; i < len; i++) {
            sum += Math.abs(profA[i] - profB[i]);
        }
        return sum / len;
    }

    /**
     * Сортировка точек по важности
     */
    sortByImportance(points) {
        return [...points].sort((a, b) => {
            const roleWeight = { 'H': 5, 'C': 4, 'B': 3, 'R': 2, 'L': 1 };
            const weightA = roleWeight[a.role] || 0;
            const weightB = roleWeight[b.role] || 0;

            if (weightA !== weightB) return weightB - weightA;
            return (b.degree || 0) - (a.degree || 0);
        });
    }

    /**
     * Проверка на конфликты
     */
    validateMatches(matches) {
        const validMatches = [];
        const usedA = new Set();
        const usedB = new Set();

        // Сначала точные совпадения, потом по допускам
        const sorted = [...matches].sort((a, b) => {
            if (a.exact && !b.exact) return -1;
            if (!a.exact && b.exact) return 1;
            return 0;
        });

        for (const match of sorted) {
            if (!usedA.has(match.pointA) && !usedB.has(match.pointB)) {
                validMatches.push(match);
                usedA.add(match.pointA);
                usedB.add(match.pointB);
            } else {
                this.stats.conflictsResolved++;
            }
        }

        return validMatches;
    }

    /**
     * Детальное логирование причин отсева
     */
    logRejection(pointA, pointB, reason, details = {}) {
        if (!this.debug) return;

        // Для статистики не выводим каждую пару, только в сводке
        if (this.verbose) {
            console.log(`   ❌ ${pointA.id.slice(0,12)}... ↔ ${pointB.id.slice(0,12)}...`);
            console.log(`      Причина: ${reason}`);
            if (details.expected !== undefined && details.actual !== undefined) {
                console.log(`      Ожидалось: ${typeof details.expected === 'number' ? details.expected.toFixed(3) : details.expected}, получено: ${typeof details.actual === 'number' ? details.actual.toFixed(3) : details.actual}`);
            }
            if (details.diff !== undefined) {
                console.log(`      Разница: ${(details.diff * 100).toFixed(1)}%, допуск: ${(details.tolerance * 100).toFixed(1)}%`);
            }
        }
    }

    /**
     * Получить статистику
     */
    getStats() {
        return { ...this.stats };
    }
}

module.exports = AdaptiveMatcher;
