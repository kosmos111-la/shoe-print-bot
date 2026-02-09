// modules/footprint/accumulator.js
// 🔥 АККУМУЛЯТОР - СБОРНИК ГЕОМЕТРИЧЕСКИХ ХЕШЕЙ

const fs = require('fs');
const path = require('path');

class GeometricAccumulator {
    constructor(userId, options = {}) {
        this.userId = userId;
        this.id = `accum_${userId}_${Date.now()}`;
        this.name = `Аккумулятор геометрических точек ${userId}`;
       
        // 🔥 ХРАНИМ ТОЛЬКО ГЕОМЕТРИЧЕСКИЕ ХЕШИ
        this.geometricPoints = new Map(); // geometricHash -> {confirmations, firstSeen, etc}
        this.footprintHashes = new Map(); // footprintId -> Set<geometricHash>
       
        // Для визуализации (примерные координаты)
        this.pointExamples = new Map(); // geometricHash -> {x, y, confidence}
       
        this.stats = {
            totalUniquePoints: 0,
            byConfirmations: { '1': 0, '2': 0, '3+': 0 },
            totalFootprints: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log(`🎯 Создан GeometricAccumulator для пользователя ${userId}`);
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Добавить след с геометрическими хешами
    addFootprintWithGeometricHashes(points, footprintId) {
        console.log(`➕ Добавляю след ${footprintId} в аккумулятор...`);
       
        const newHashes = new Set();
        let newPointsAdded = 0;
        let existingPointsConfirmed = 0;
       
        points.forEach(point => {
            const geoHash = point.geometricHash || point.vectorId || point.id;
            if (!geoHash) {
                console.log(`⚠️ Точка без геометрического хеша:`, point);
                return;
            }
           
            newHashes.add(geoHash);
           
            if (this.geometricPoints.has(geoHash)) {
                // Уже есть - увеличиваем подтверждения
                const data = this.geometricPoints.get(geoHash);
                data.confirmations = (data.confirmations || 1) + 1;
                data.lastSeen = new Date();
               
                // 🔥 ИСПРАВЛЕНИЕ: Проверяем, что seenInFootprints это Set
                if (!data.seenInFootprints || !(data.seenInFootprints instanceof Set)) {
                    data.seenInFootprints = new Set();
                }
                data.seenInFootprints.add(footprintId);
               
                existingPointsConfirmed++;
               
                // 🔥 ОБНОВЛЯЕМ ПРИМЕРНЫЕ КООРДИНАТЫ (среднее)
                if (this.pointExamples.has(geoHash) && point.x !== undefined && point.y !== undefined) {
                    const example = this.pointExamples.get(geoHash);
                    const weight = 1 / data.confirmations;
                    example.x = example.x * (1 - weight) + point.x * weight;
                    example.y = example.y * (1 - weight) + point.y * weight;
                    example.confidence = Math.max(example.confidence || 0.5, point.confidence || 0.5);
                    example.lastUpdated = new Date();
                }
            } else {
                // 🔥 НОВЫЙ геометрический хеш
                this.geometricPoints.set(geoHash, {
                    geometricHash: geoHash,
                    confirmations: 1,
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    seenInFootprints: new Set([footprintId]) // 🔥 ГАРАНТИРУЕМ ЧТО ЭТО Set
                });
               
                // Сохраняем примерные координаты для визуализации
                if (point.x !== undefined && point.y !== undefined) {
                    this.pointExamples.set(geoHash, {
                        x: point.x,
                        y: point.y,
                        confidence: point.confidence || 0.5,
                        sourceFootprint: footprintId,
                        lastUpdated: new Date()
                    });
                }
               
                newPointsAdded++;
            }
        });
       
        // Сохраняем связь след -> геометрические хеши
        this.footprintHashes.set(footprintId, newHashes);
       
        // Обновляем статистику
        this.updateStats();
       
        console.log(`✅ Аккумулятор: +${newPointsAdded} новых, ${existingPointsConfirmed} подтверждено`);
        console.log(`📊 Всего уникальных точек: ${this.geometricPoints.size}`);
       
        return {
            newPoints: newPointsAdded,
            existingPoints: existingPointsConfirmed,
            totalPoints: this.geometricPoints.size,
            stats: this.getStats()
        };
    }
   
    // 🔥 Получить данные для визуализации
    getVisualizationData() {
        const points = [];
       
        for (const [geoHash, pointData] of this.geometricPoints) {
            const example = this.pointExamples.get(geoHash);
           
            const confirmations = pointData.confirmations || 1;
           
            // 🔥 ЦВЕТ ПО ПОДТВЕРЖДЕНИЯМ
            let color, size, label;
            if (confirmations >= 3) {
                color = '#FF0000'; // 🔴 Красный: 3+ подтверждений
                size = 10;
                label = 'high';
            } else if (confirmations >= 2) {
                color = '#FF6B00'; // 🟠 Оранжевый: 2 подтверждения
                size = 7;
                label = 'medium';
            } else {
                color = '#2196F3'; // 🔵 Синий: 1 подтверждение
                size = 5;
                label = 'low';
            }
           
            points.push({
                id: geoHash.substring(0, 12),
                geometricHash: geoHash,
                x: example?.x || Math.random() * 700 + 100,
                y: example?.y || Math.random() * 500 + 100,
                color: color,
                size: size,
                confirmations: confirmations,
                confidence: example?.confidence || 0.5,
                firstSeen: pointData.firstSeen,
                lastSeen: pointData.lastSeen,
                label: label,
                seenIn: Array.from(pointData.seenInFootprints || []),
                isNew: confirmations === 1
            });
        }
       
        return {
            id: this.id,
            userId: this.userId,
            name: this.name,
            points: points,
            stats: this.stats,
            totalFootprints: this.footprintHashes.size,
            visualizationType: 'geometric_accumulator'
        };
    }
   
    // 🔥 Получить статистику
    getStats() {
        return {
            ...this.stats,
            lastUpdated: new Date()
        };
    }
   
    updateStats() {
        this.stats.totalUniquePoints = this.geometricPoints.size;
        this.stats.totalFootprints = this.footprintHashes.size;
        this.stats.lastUpdated = new Date();
       
        // Сбрасываем счетчики
        this.stats.byConfirmations = { '1': 0, '2': 0, '3+': 0 };
       
        for (const pointData of this.geometricPoints.values()) {
            const confirmations = pointData.confirmations || 1;
            if (confirmations >= 3) {
                this.stats.byConfirmations['3+']++;
            } else if (confirmations >= 2) {
                this.stats.byConfirmations['2']++;
            } else {
                this.stats.byConfirmations['1']++;
            }
        }
    }
   
    // 🔥 Сравнение двух следов через аккумулятор
    compareFootprints(footprintId1, footprintId2) {
        const hashes1 = this.footprintHashes.get(footprintId1) || new Set();
        const hashes2 = this.footprintHashes.get(footprintId2) || new Set();
       
        // Находим общие геометрические хеши
        const common = new Set([...hashes1].filter(x => hashes2.has(x)));
       
        const totalPossible = Math.max(hashes1.size, hashes2.size);
        const similarity = totalPossible > 0 ? common.size / totalPossible : 0;
       
        return {
            footprint1: { totalPoints: hashes1.size },
            footprint2: { totalPoints: hashes2.size },
            commonPoints: common.size,
            similarity: similarity,
            isSame: similarity > 0.6, // 60% порог
            decision: similarity > 0.6 ? 'same' : 'different'
        };
    }
   
    // 🔥 Получить информацию об аккумуляторе
    getInfo() {
        return {
            id: this.id,
            userId: this.userId,
            name: this.name,
            stats: this.stats,
            footprintsCount: this.footprintHashes.size,
            createdAt: this.stats.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }
   
    // 🔥 Сохранение аккумулятора
    saveToFile(filePath) {
        try {
            const data = {
                id: this.id,
                userId: this.userId,
                name: this.name,
                geometricPoints: Array.from(this.geometricPoints.entries()),
                footprintHashes: Array.from(this.footprintHashes.entries()),
                pointExamples: Array.from(this.pointExamples.entries()),
                stats: this.stats,
                _version: '1.1-geometric-accumulator-fixed',
                _savedAt: new Date().toISOString()
            };
           
            // 🔥 ИСПРАВЛЕНИЕ: Правильно сериализуем Set в Array
            data.geometricPoints = data.geometricPoints.map(([hash, pointData]) => {
                const serializedPointData = { ...pointData };
               
                // Преобразуем Set в Array
                if (serializedPointData.seenInFootprints && serializedPointData.seenInFootprints instanceof Set) {
                    serializedPointData.seenInFootprints = Array.from(serializedPointData.seenInFootprints);
                }
               
                return [hash, serializedPointData];
            });
           
            // Преобразуем Set в Array для footprintHashes
            data.footprintHashes = data.footprintHashes.map(([id, hashSet]) => {
                return [id, Array.from(hashSet)];
            });
           
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`💾 Аккумулятор сохранен: ${filePath}`);
            return { success: true, filePath };
           
        } catch (error) {
            console.error(`❌ Ошибка сохранения аккумулятора: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
   
    // 🔥 Загрузка аккумулятора из файла (ИСПРАВЛЕННЫЙ)
    static loadFromFile(filePath, userId) {
        try {
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Файл не найден: ${filePath}`);
                return null;
            }
           
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const accumulator = new GeometricAccumulator(userId || data.userId);
           
            accumulator.id = data.id || accumulator.id;
            accumulator.name = data.name || accumulator.name;
           
            // 🔥 ВОССТАНАВЛИВАЕМ ГЕОМЕТРИЧЕСКИЕ ТОЧКИ (ИСПРАВЛЕНО)
            if (Array.isArray(data.geometricPoints)) {
                data.geometricPoints.forEach(([hash, pointData]) => {
                    // 🔥 ИСПРАВЛЕНИЕ: Гарантируем что seenInFootprints это Set
                    if (pointData.seenInFootprints) {
                        if (Array.isArray(pointData.seenInFootprints)) {
                            pointData.seenInFootprints = new Set(pointData.seenInFootprints);
                        } else if (!(pointData.seenInFootprints instanceof Set)) {
                            pointData.seenInFootprints = new Set();
                        }
                    } else {
                        pointData.seenInFootprints = new Set();
                    }
                   
                    accumulator.geometricPoints.set(hash, pointData);
                });
            }
           
            // 🔥 ВОССТАНАВЛИВАЕМ СВЯЗИ СЛЕДОВ (ИСПРАВЛЕНО)
            if (Array.isArray(data.footprintHashes)) {
                data.footprintHashes.forEach(([id, hashArray]) => {
                    accumulator.footprintHashes.set(id, new Set(hashArray || []));
                });
            } else {
                // Если старый формат данных
                for (const [key, value] of Object.entries(data.footprintHashes || {})) {
                    if (Array.isArray(value)) {
                        accumulator.footprintHashes.set(key, new Set(value));
                    }
                }
            }
           
            // Восстанавливаем примеры точек
            if (Array.isArray(data.pointExamples)) {
                data.pointExamples.forEach(([hash, example]) => {
                    accumulator.pointExamples.set(hash, example);
                });
            }
           
            // Восстанавливаем статистику
            if (data.stats) {
                accumulator.stats = data.stats;
                // Восстанавливаем даты
                if (typeof accumulator.stats.createdAt === 'string') {
                    accumulator.stats.createdAt = new Date(accumulator.stats.createdAt);
                }
                if (typeof accumulator.stats.lastUpdated === 'string') {
                    accumulator.stats.lastUpdated = new Date(accumulator.stats.lastUpdated);
                }
            }
           
            // Обновляем статистику
            accumulator.updateStats();
           
            console.log(`📂 Загружен аккумулятор: ${accumulator.geometricPoints.size} точек`);
            return accumulator;
           
        } catch (error) {
            console.error(`❌ Ошибка загрузки аккумулятора: ${error.message}`);
            console.error('Stack trace:', error.stack);
            return null;
        }
    }
   
    // 🔥 МЕТОД: Получить все геометрические хеши
    getAllGeometricHashes() {
        return Array.from(this.geometricPoints.keys());
    }
   
    // 🔥 МЕТОД: Получить точки с определенным количеством подтверждений
    getPointsByConfirmation(minConfirmations = 2) {
        const result = [];
       
        for (const [geoHash, pointData] of this.geometricPoints) {
            if (pointData.confirmations >= minConfirmations) {
                const example = this.pointExamples.get(geoHash);
                if (example) {
                    result.push({
                        geometricHash: geoHash,
                        x: example.x,
                        y: example.y,
                        confirmations: pointData.confirmations,
                        confidence: example.confidence
                    });
                }
            }
        }
       
        return result;
    }
   
    // 🔥 МЕТОД: Очистка старых данных
    cleanupOldData(maxAgeDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
       
        let removedCount = 0;
       
        for (const [geoHash, pointData] of this.geometricPoints) {
            if (pointData.lastSeen < cutoffDate && pointData.confirmations === 1) {
                // Удаляем точки с 1 подтверждением старше maxAgeDays
                this.geometricPoints.delete(geoHash);
                this.pointExamples.delete(geoHash);
                removedCount++;
            }
        }
       
        if (removedCount > 0) {
            console.log(`🧹 Очищено ${removedCount} старых точек`);
            this.updateStats();
        }
       
        return removedCount;
    }
}

module.exports = GeometricAccumulator;
