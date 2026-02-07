// modules/footprint/fallback-algorithm.js
// 🔥 ПРОСТОЙ ФАЛЛБЭК АЛГОРИТМ

console.log('🔄 Используется фаллбэк алгоритм');

class FallbackAlgorithm {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('✅ Фаллбэк алгоритм инициализирован');
    }

    createFootprint(points, name = '') {
        console.log(`👣 Фаллбэк: создание отпечатка "${name}" (${points.length} точек)`);
       
        return points.map((point, index) => ({
            ...point,
            geometricHash: `fallback_${index}_${Math.round(point.x)}_${Math.round(point.y)}`,
            triangleHashes: [],
            triangles: []
        }));
    }

    compareFootprints(fp1, fp2, options = {}) {
        console.log('🔍 Фаллбэк: сравнение отпечатков');
       
        // Простое сравнение на основе расстояний
        let matches = [];
        const threshold = options.threshold || 0.6;
       
        if (fp1.length > 0 && fp2.length > 0) {
            // Берем первые несколько точек для сравнения
            const minLength = Math.min(fp1.length, fp2.length, 10);
            for (let i = 0; i < minLength; i++) {
                const p1 = fp1[i];
                const p2 = fp2[i];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const similarity = Math.max(0, 1 - distance / 100);
               
                if (similarity > threshold) {
                    matches.push({
                        point1: p1,
                        point2: p2,
                        similarity: similarity,
                        distance: distance
                    });
                }
            }
        }
       
        const total1 = fp1.length;
        const total2 = fp2.length;
        const matched = matches.length;
       
        const percent1to2 = total1 > 0 ? (matched / total1 * 100).toFixed(1) : '0.0';
        const percent2to1 = total2 > 0 ? (matched / total2 * 100).toFixed(1) : '0.0';
       
        return {
            matches: matches,
            stats: {
                totalPoints1: total1,
                totalPoints2: total2,
                matchedPoints: matched,
                percent1to2: percent1to2,
                percent2to1: percent2to1,
                avgSimilarity: matched > 0 ? (matches.reduce((sum, m) => sum + m.similarity, 0) / matched).toFixed(3) : 0
            },
            metadata: {
                algorithm: 'fallback_simple',
                timestamp: new Date()
            }
        };
    }

    updatePointConfirmations(points1, points2, matches) {
        console.log(`📊 Фаллбэк: обновление ${matches.length} подтверждений`);
        return matches.length;
    }
}

module.exports = FallbackAlgorithm;
