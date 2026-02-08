// modules/footprint/accumulative-model.js
// 🔥 ПРОСТОЙ КЛАСС - НАКОПЛЕНИЕ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ

class AccumulativeModel {
    constructor(options = {}) {
        this.id = `accum_${Date.now()}`;
        this.geometricPassports = new Map(); // Map<geometricHash, passportData>
        this.footprints = new Map(); // Map<footprintId, Set<geometricHash>>
        this.confirmationStats = {
            totalPassports: 0,
            byConfirmations: { '1': 0, '2': 0, '3+': 0 }
        };
    }

    // 🔥 ДОБАВЛЯЕМ СЛЕД (ВЕКТОРНЫЙ ОТПЕЧАТОК ИЗ vector-algorithm.js)
    addFootprint(footprint, footprintId) {
        console.log(`➕ Добавляю след ${footprintId} с ${footprint.length} точками`);
       
        const passportHashes = new Set();
       
        footprint.forEach(point => {
            const geoHash = point.geometricHash || point.vectorId;
            if (!geoHash) return;
           
            passportHashes.add(geoHash);
           
            // 🔥 НАКОПЛЕНИЕ: добавляем или обновляем геометрический паспорт
            if (this.geometricPassports.has(geoHash)) {
                // Уже есть - увеличиваем подтверждения
                const passport = this.geometricPassports.get(geoHash);
                passport.confirmations = (passport.confirmations || 1) + 1;
                passport.seenInFootprints.add(footprintId);
            } else {
                // Новый геометрический паспорт
                this.geometricPassports.set(geoHash, {
                    geometricHash: geoHash,
                    confirmations: 1,
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    seenInFootprints: new Set([footprintId]),
                    examplePoint: point // Сохраняем пример точки для визуализации
                });
            }
        });
       
        // Сохраняем связь след -> геометрические паспорты
        this.footprints.set(footprintId, passportHashes);
       
        // 🔥 ОБНОВЛЯЕМ СТАТИСТИКУ
        this.updateStats();
       
        console.log(`✅ Добавлено. Уникальных геометрических паспортов: ${this.geometricPassports.size}`);
    }

    updateStats() {
        this.confirmationStats.totalPassports = this.geometricPassports.size;
        this.confirmationStats.byConfirmations = { '1': 0, '2': 0, '3+': 0 };
       
        for (const passport of this.geometricPassports.values()) {
            const confirmations = passport.confirmations || 1;
            if (confirmations >= 3) {
                this.confirmationStats.byConfirmations['3+']++;
            } else if (confirmations >= 2) {
                this.confirmationStats.byConfirmations['2']++;
            } else {
                this.confirmationStats.byConfirmations['1']++;
            }
        }
    }

    // 🔥 ПОЛУЧИТЬ ВСЕ ТОЧКИ ДЛЯ ВИЗУАЛИЗАЦИИ
    getVisualizationData() {
        const points = [];
       
        for (const passport of this.geometricPassports.values()) {
            if (!passport.examplePoint) continue;
           
            const confirmations = passport.confirmations || 1;
           
            // 🔥 ЦВЕТ ПО КОЛИЧЕСТВУ ПОДТВЕРЖДЕНИЙ
            let color, size;
            if (confirmations >= 3) {
                color = '#FF0000'; // 🔴 Красный: 3+ подтверждений
                size = 10;
            } else if (confirmations >= 2) {
                color = '#FF6B00'; // 🟠 Оранжевый: 2 подтверждения
                size = 7;
            } else {
                color = '#2196F3'; // 🔵 Синий: 1 подтверждение
                size = 5;
            }
           
            points.push({
                id: passport.geometricHash,
                x: passport.examplePoint.x || 0,
                y: passport.examplePoint.y || 0,
                color: color,
                size: size,
                confirmations: confirmations,
                confidence: passport.examplePoint.confidence || 0.5,
                geometricHash: passport.geometricHash
            });
        }
       
        return {
            points: points,
            stats: this.confirmationStats,
            totalFootprints: this.footprints.size,
            totalPassports: this.geometricPassports.size
        };
    }
}
