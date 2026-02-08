// modules/footprint/accumulator.js
// 🔥 ПРОСТОЙ АККУМУЛЯТОР - ТОЛЬКО ГЕОМЕТРИЧЕСКИЕ ХЕШИ

const fs = require('fs');
const path = require('path');

class GeometricAccumulator {
    constructor(userId, options = {}) {
        this.userId = userId;
        this.id = `accum_${userId}_${Date.now()}`;
       
        // 🔥 ХРАНИМ ТОЛЬКО ГЕОМЕТРИЧЕСКИЕ ХЕШИ
        this.geometricPoints = new Map(); // geometricHash -> {confirmations, firstSeen, etc}
        this.footprintHashes = new Map(); // footprintId -> Set<geometricHash>
       
        // Для визуализации (примерные координаты)
        this.pointExamples = new Map(); // geometricHash -> {x, y, confidence}
       
        this.stats = {
            totalUniquePoints: 0,
            byConfirmations: { '1': 0, '2': 0, '3+': 0 },
            totalFootprints: 0,
            createdAt: new Date()
        };
       
        console.log(`🎯 Создан GeometricAccumulator для пользователя ${userId}`);
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Добавить след через векторный алгоритм
    addFootprintViaVectorAlgorithm(footprintPoints, footprintId, vectorAlgorithm) {
        console.log(`➕ Добавляю след ${footprintId} в аккумулятор...`);
       
        // 1. Создаем векторный отпечаток (уже инвариантный!)
        const vectorFootprint = vectorAlgorithm.createFootprint(footprintPoints, footprintId);
       
        if (!vectorFootprint || !Array.isArray(vectorFootprint)) {
            console.log(`⚠️ Не удалось создать векторный отпечаток`);
            return { newPoints: 0, totalPoints: this.geometricPoints.size };
        }
       
        console.log(`📊 Векторный отпечаток создан: ${vectorFootprint.length} точек`);
       
        const newHashes = new Set();
        let newPointsAdded = 0;
       
        // 2. АККУМУЛЯЦИЯ: добавляем каждый геометрический хеш
        vectorFootprint.forEach(point => {
            const geoHash = point.geometricHash || point.vectorId;
            if (!geoHash) return;
           
            newHashes.add(geoHash);
           
            if (this.geometricPoints.has(geoHash)) {
                // Уже есть - увеличиваем подтверждения
                const data = this.geometricPoints.get(geoHash);
                data.confirmations = (data.confirmations || 1) + 1;
                data.lastSeen = new Date();
                data.seenInFootprints.add(footprintId);
               
                // 🔥 ОБНОВЛЯЕМ ПРИМЕРНЫЕ КООРДИНАТЫ (среднее)
                if (this.pointExamples.has(geoHash) && point.x && point.y) {
                    const example = this.pointExamples.get(geoHash);
                    const weight = 1 / data.confirmations;
                    example.x = example.x * (1 - weight) + point.x * weight;
                    example.y = example.y * (1 - weight) + point.y * weight;
                }
            } else {
                // НОВЫЙ геометрический хеш
                this.geometricPoints.set(geoHash, {
                    geometricHash: geoHash,
                    confirmations: 1,
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    seenInFootprints: new Set([footprintId])
                });
               
                // Сохраняем примерные координаты для визуализации
                if (point.x && point.y) {
                    this.pointExamples.set(geoHash, {
                        x: point.x,
                        y: point.y,
                        confidence: point.confidence || 0.5,
                        sourceFootprint: footprintId
                    });
                } else {
                    // Если нет координат - задаем случайные для визуализации
                    this.pointExamples.set(geoHash, {
                        x: 300 + Math.random() * 400,
                        y: 200 + Math.random() * 300,
                        confidence: point.confidence || 0.5,
                        sourceFootprint: footprintId
                    });
                }
               
                newPointsAdded++;
            }
        });
       
        // Сохраняем связь след -> геометрические хеши
        this.footprintHashes.set(footprintId, newHashes);
       
        // Обновляем статистику
        this.updateStats();
       
        console.log(`✅ Аккумулятор: +${newPointsAdded} новых геометрических точек`);
        console.log(`📊 Всего уникальных точек: ${this.geometricPoints.size}`);
       
        return {
            newPoints: newPointsAdded,
            totalPoints: this.geometricPoints.size,
            stats: this.getStats()
        };
    }
   
    // 🔥 Получить данные для визуализации
    getVisualizationData() {
        const points = [];
       
        for (const [geoHash, pointData] of this.geometricPoints) {
            const example = this.pointExamples.get(geoHash);
            if (!example) continue;
           
            const confirmations = pointData.confirmations || 1;
           
            // 🔥 ЦВЕТ ПО ПОДТВЕРЖДЕНИЯМ
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
                id: geoHash.substring(0, 12),
                geometricHash: geoHash,
                x: example.x || 500,
                y: example.y || 500,
                color: color,
                size: size,
                confirmations: confirmations,
                confidence: example.confidence || 0.5,
                firstSeen: pointData.firstSeen,
                seenIn: Array.from(pointData.seenInFootprints || []),
                isNew: confirmations === 1
            });
        }
       
        return {
            points: points,
            stats: this.stats,
            totalFootprints: this.footprintHashes.size,
            userId: this.userId,
            id: this.id
        };
    }
   
    // 🔥 Простое добавление точек (без векторного алгоритма)
    addPointsDirectly(points, footprintId) {
        console.log(`➕ Добавляю ${points.length} точек напрямую в аккумулятор...`);
       
        const newHashes = new Set();
        let newPointsAdded = 0;
       
        points.forEach((point, index) => {
            // Создаем простой геометрический хеш из координат
            const geoHash = this.generateGeometricHash(point);
           
            newHashes.add(geoHash);
           
            if (this.geometricPoints.has(geoHash)) {
                // Уже есть - увеличиваем подтверждения
                const data = this.geometricPoints.get(geoHash);
                data.confirmations = (data.confirmations || 1) + 1;
                data.lastSeen = new Date();
                if (!data.seenInFootprints) data.seenInFootprints = new Set();
                data.seenInFootprints.add(footprintId);
               
                // Обновляем координаты
                if (this.pointExamples.has(geoHash) && point.x && point.y) {
                    const example = this.pointExamples.get(geoHash);
                    const weight = 1 / data.confirmations;
                    example.x = example.x * (1 - weight) + point.x * weight;
                    example.y = example.y * (1 - weight) + point.y * weight;
                }
            } else {
                // НОВАЯ точка
                this.geometricPoints.set(geoHash, {
                    geometricHash: geoHash,
                    confirmations: 1,
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    seenInFootprints: new Set([footprintId])
                });
               
                // Сохраняем примерные координаты
                this.pointExamples.set(geoHash, {
                    x: point.x || 300 + Math.random() * 400,
                    y: point.y || 200 + Math.random() * 300,
                    confidence: point.confidence || 0.5,
                    sourceFootprint: footprintId
                });
               
                newPointsAdded++;
            }
        });
       
        // Сохраняем связь
        this.footprintHashes.set(footprintId, newHashes);
       
        // Обновляем статистику
        this.updateStats();
       
        console.log(`✅ Добавлено: +${newPointsAdded} новых, всего: ${this.geometricPoints.size}`);
       
        return newPointsAdded;
    }
   
    // 🔥 Генерация геометрического хеша
    generateGeometricHash(point) {
        // Простой хеш из координат и углов
        const gridSize = 10; // 10px сетка
        const gridX = Math.round((point.x || 0) / gridSize);
        const gridY = Math.round((point.y || 0) / gridSize);
       
        // Добавляем информацию об углах, если есть
        const angles = point.angles || [];
        const angleHash = angles.length > 0 ?
            angles.map(a => Math.round(a * 10)).join('_') : '0';
       
        return `geo_${gridX}_${gridY}_${angleHash}`;
    }
   
    updateStats() {
        this.stats.totalUniquePoints = this.geometricPoints.size;
        this.stats.totalFootprints = this.footprintHashes.size;
       
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
   
    getStats() {
        return {
            ...this.stats,
            lastUpdated: new Date()
        };
    }
   
    // 🔥 Сравнение двух следов через аккумулятор
    compareFootprints(footprintId1, footprintId2) {
        const hashes1 = this.footprintHashes.get(footprintId1) || new Set();
        const hashes2 = this.footprintHashes.get(footprintId2) || new Set();
       
        // Находим общие геометрические хеши
        const common = new Set([...hashes1].filter(x => hashes2.has(x)));
       
        const similarity = hashes1.size > 0 ? common.size / Math.max(hashes1.size, hashes2.size) : 0;
       
        return {
            footprint1: { totalPoints: hashes1.size },
            footprint2: { totalPoints: hashes2.size },
            commonPoints: common.size,
            similarity: similarity,
            isSame: similarity > 0.6 // 60% порог
        };
    }
   
    // 🔥 Сравнение с новыми точками
    compareWithNewPoints(newPoints, vectorAlgorithm = null) {
        let newHashes = new Set();
       
        if (vectorAlgorithm) {
            // Используем векторный алгоритм
            const vectorFootprint = vectorAlgorithm.createFootprint(newPoints, 'compare');
            if (vectorFootprint) {
                vectorFootprint.forEach(point => {
                    const geoHash = point.geometricHash || point.vectorId;
                    if (geoHash) newHashes.add(geoHash);
                });
            }
        } else {
            // Простой метод
            newPoints.forEach(point => {
                const geoHash = this.generateGeometricHash(point);
                newHashes.add(geoHash);
            });
        }
       
        // Находим общие хеши
        const existingHashes = new Set(this.geometricPoints.keys());
        const common = new Set([...newHashes].filter(x => existingHashes.has(x)));
       
        const similarity = newHashes.size > 0 ? common.size / newHashes.size : 0;
       
        return {
            newPoints: newHashes.size,
            existingPoints: existingHashes.size,
            commonPoints: common.size,
            similarity: similarity,
            isSame: similarity > 0.6
        };
    }
   
    // 🔥 Сохранение аккумулятора
    save(outputDir) {
        try {
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
           
            const data = {
                id: this.id,
                userId: this.userId,
                geometricPoints: Array.from(this.geometricPoints.entries()),
                footprintHashes: Array.from(this.footprintHashes.entries()),
                pointExamples: Array.from(this.pointExamples.entries()),
                stats: this.stats,
                _version: '1.0-simple-accumulator',
                _savedAt: new Date().toISOString()
            };
           
            const filename = `accumulator_${this.userId}_${Date.now()}.json`;
            const filePath = path.join(outputDir, filename);
           
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
           
            console.log(`💾 Аккумулятор сохранен: ${filePath}`);
            return { success: true, path: filePath };
           
        } catch (error) {
            console.error(`❌ Ошибка сохранения аккумулятора: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
   
    // 🔥 Загрузка аккумулятора
    static load(filePath, userId) {
        try {
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Файл не найден: ${filePath}`);
                return null;
            }
           
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
           
            const accumulator = new GeometricAccumulator(userId || data.userId);
            accumulator.id = data.id || accumulator.id;
           
            // Восстанавливаем геометрические точки
            if (Array.isArray(data.geometricPoints)) {
                data.geometricPoints.forEach(([hash, pointData]) => {
                    accumulator.geometricPoints.set(hash, {
                        ...pointData,
                        seenInFootprints: new Set(pointData.seenInFootprints || [])
                    });
                });
            }
           
            // Восстанавливаем следы
            if (Array.isArray(data.footprintHashes)) {
                data.footprintHashes.forEach(([footprintId, hashes]) => {
                    accumulator.footprintHashes.set(footprintId, new Set(hashes || []));
                });
            }
           
            // Восстанавливаем примеры
            if (Array.isArray(data.pointExamples)) {
                data.pointExamples.forEach(([hash, example]) => {
                    accumulator.pointExamples.set(hash, example);
                });
            }
           
            // Восстанавливаем статистику
            if (data.stats) {
                accumulator.stats = data.stats;
            }
           
            accumulator.updateStats();
           
            console.log(`📂 Загружен аккумулятор: ${accumulator.geometricPoints.size} точек`);
            return accumulator;
           
        } catch (error) {
            console.error(`❌ Ошибка загрузки аккумулятора: ${error.message}`);
            return null;
        }
    }
}

module.exports = GeometricAccumulator;
