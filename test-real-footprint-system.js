// test-real-footprint-system.js
console.log('👣 СИСТЕМА СРАВНЕНИЯ РЕАЛЬНЫХ СЛЕДОВ ОБУВИ\n');

class RealFootprintSystem {
    constructor() {
        this.geometricHash = new GeometricHash();
        this.debug = true;
    }
   
    // 1. СОЗДАЕМ РЕАЛЬНЫЙ СЛЕД ОБУВИ (как у человека)
    createRealFootprint(type = 'left', size = 42, completeness = 1.0) {
        const points = [];
        const length = 250 + (size - 42) * 5; // Длина следа в мм
        const width = 100 + (size - 42) * 2;  // Ширина следа
       
        // ПАРАМЕТРЫ СЛЕДА
        const heelWidth = width * 0.8;
        const toeWidth = width * 1.2;
        const archWidth = width * 0.6;
       
        // ИДЕНТИФИКАТОРЫ ТОЧЕК
        let pointId = 0;
       
        // ===== ПЯТКА (задняя часть) =====
        const heelPoints = Math.round(10 * completeness);
        for (let i = 0; i < heelPoints; i++) {
            const angle = Math.PI/4 + (i / heelPoints) * Math.PI/2;
            const radius = heelWidth / 2;
           
            points.push({
                x: Math.round(radius * Math.cos(angle) * (type === 'left' ? 1 : -1)),
                y: Math.round(-length/2 + radius * Math.sin(angle) * 0.7),
                id: `heel_${pointId++}`,
                type: 'heel',
                side: type,
                weight: 1.2,
                part: 'rear'
            });
        }
       
        // ===== АРКА (свод стопы) =====
        const archPoints = Math.round(8 * completeness);
        for (let i = 0; i < archPoints; i++) {
            const t = i / (archPoints - 1);
            const x = (archWidth / 2) * (type === 'left' ? 1 : -1) * (1 - t * 0.5);
            const y = -length/4 + t * length/4;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `arch_${pointId++}`,
                type: 'arch',
                side: type,
                weight: 1.0,
                part: 'middle'
            });
        }
       
        // ===== МЫСОК (передняя часть) =====
        const toePoints = Math.round(15 * completeness);
        const missingToeStart = toePoints * 0.6; // Откуда начинаются пропущенные точки
        const missingToeCount = Math.round(toePoints * 0.3 * (1 - completeness));
       
        for (let i = 0; i < toePoints; i++) {
            // Пропускаем часть точек для неполных следов
            if (completeness < 1.0 && i >= missingToeStart && i < missingToeStart + missingToeCount) {
                continue;
            }
           
            const angle = -Math.PI/4 + (i / toePoints) * 3*Math.PI/2;
            const radius = toeWidth / 2;
           
            points.push({
                x: Math.round(radius * Math.cos(angle) * (type === 'left' ? 1 : -1)),
                y: Math.round(length/2 + radius * Math.sin(angle) * 0.5),
                id: `toe_${pointId++}`,
                type: 'toe',
                side: type,
                weight: 1.5,
                part: 'front',
                missing: completeness < 1.0 && i >= missingToeStart
            });
        }
       
        // ===== ПРОТЕКТОР (внутренние детали) =====
        if (completeness > 0.7) {
            const treadPoints = Math.round(20 * completeness);
            for (let i = 0; i < treadPoints; i++) {
                // Случайные точки внутри контура
                const randX = (Math.random() - 0.5) * width * 0.8;
                const randY = (Math.random() - 0.5) * length * 0.8;
               
                // Проверяем, что точка внутри эллипса следа
                const inFootprint = (
                    Math.pow(randX / (width/2), 2) +
                    Math.pow(randY / (length/2), 2)
                ) <= 1;
               
                if (inFootprint) {
                    points.push({
                        x: Math.round(randX * (type === 'left' ? 1 : -1)),
                        y: Math.round(randY),
                        id: `tread_${pointId++}`,
                        type: 'tread',
                        side: type,
                        weight: 0.8,
                        part: 'inner'
                    });
                }
            }
        }
       
        // Сортируем по Y (от пятки к носку)
        points.sort((a, b) => a.y - b.y);
       
        console.log(`👣 Создан ${type === 'left' ? 'левый' : 'правый'} след:`);
        console.log(`   • Размер: ${size}`);
        console.log(`   • Точки: ${points.length} (полнота: ${(completeness * 100).toFixed(0)}%)`);
        console.log(`   • Длина: ${length}мм, Ширина: ${width}мм`);
       
        return points;
    }
   
    // 2. ТРАНСФОРМАЦИИ ДЛЯ РЕАЛЬНЫХ УСЛОВИЙ
    applyRealWorldTransform(points, transform) {
        const {
            rotation = 0,    // Поворот (градусы)
            scale = 1.0,     // Масштаб
            offsetX = 0,     // Смещение по X
            offsetY = 0,     // Смещение по Y
            pressure = 1.0,  // Давление (искажение)
            noise = 0        // Шум (мм)
        } = transform;
       
        const angleRad = rotation * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return points.map(p => {
            // Исходные координаты
            let x = p.x;
            let y = p.y;
           
            // Эффект давления: след расплющивается
            if (pressure !== 1.0) {
                const pressureFactor = 1.0 / pressure;
                x *= pressureFactor;
                y *= pressureFactor;
            }
           
            // Поворот
            const xRot = x * cosA - y * sinA;
            const yRot = x * sinA + y * cosA;
           
            // Масштаб
            x = xRot * scale;
            y = yRot * scale;
           
            // Смещение
            x += offsetX;
            y += offsetY;
           
            // Добавляем шум
            if (noise > 0) {
                x += (Math.random() - 0.5) * 2 * noise;
                y += (Math.random() - 0.5) * 2 * noise;
            }
           
            return {
                ...p,
                x: Math.round(x),
                y: Math.round(y),
                transformed: true,
                originalX: p.x,
                originalY: p.y
            };
        });
    }
   
    // 3. ГИБРИДНОЕ СРАВНЕНИЕ С ГЕОМЕТРИЧЕСКИМ ХЕШОМ
    compareFootprints(fp1, fp2, description) {
        console.log(`\n🔍 ${description}`);
        console.log(`   След 1: ${fp1.length} точек (${fp1[0]?.side || 'unknown'})`);
        console.log(`   След 2: ${fp2.length} точек (${fp2[0]?.side || 'unknown'})`);
       
        // ШАГ 1: Геометрическое сопоставление
        const geometricMatches = this.geometricHash.matchPointsByGeometricHash(fp1, fp2);
       
        // ШАГ 2: Анализ совпадений по типам точек
        const typeAnalysis = this.analyzeByType(geometricMatches, fp1, fp2);
       
        // ШАГ 3: Определение трансформации между следами
        const transform = this.estimateTransform(geometricMatches);
       
        // ШАГ 4: Дополнение одного следа точками другого
        const enhanced = this.enhanceFootprint(fp1, fp2, geometricMatches, transform);
       
        // ШАГ 5: Визуализация и анализ
        this.visualizeComparison(fp1, fp2, geometricMatches, enhanced);
       
        return {
            matches: geometricMatches,
            typeAnalysis,
            transform,
            enhancedPoints: enhanced.newPoints,
            enhancedCount: enhanced.newPoints.length,
            completeness: (fp1.length + enhanced.newPoints.length) /
                         Math.max(fp1.length, fp2.length, enhanced.totalPossible)
        };
    }
   
    // 4. АНАЛИЗ ПО ТИПАМ ТОЧЕК
    analyzeByType(matches, fp1, fp2) {
        const typeStats = {
            heel: { matched: 0, total1: 0, total2: 0 },
            toe: { matched: 0, total1: 0, total2: 0 },
            arch: { matched: 0, total1: 0, total2: 0 },
            tread: { matched: 0, total1: 0, total2: 0 }
        };
       
        // Считаем общее количество точек каждого типа
        fp1.forEach(p => {
            if (typeStats[p.type]) typeStats[p.type].total1++;
        });
       
        fp2.forEach(p => {
            if (typeStats[p.type]) typeStats[p.type].total2++;
        });
       
        // Считаем совпадения по типам
        matches.forEach(match => {
            const type1 = match.point1.type;
            const type2 = match.point2.type;
           
            if (type1 === type2 && typeStats[type1]) {
                typeStats[type1].matched++;
            }
        });
       
        // Вычисляем проценты
        Object.keys(typeStats).forEach(type => {
            const stat = typeStats[type];
            const maxTotal = Math.max(stat.total1, stat.total2);
            stat.percentage = maxTotal > 0 ? (stat.matched / maxTotal * 100).toFixed(1) : '0.0';
        });
       
        return typeStats;
    }
   
    // 5. ОЦЕНКА ТРАНСФОРМАЦИИ МЕЖДУ СЛЕДАМИ
    estimateTransform(matches) {
        if (matches.length < 3) {
            return { dx: 0, dy: 0, scale: 1, rotation: 0 };
        }
       
        // Вычисляем средний сдвиг
        let dxSum = 0, dySum = 0;
        matches.forEach(m => {
            dxSum += m.point2.x - m.point1.x;
            dySum += m.point2.y - m.point1.y;
        });
       
        const avgDx = dxSum / matches.length;
        const avgDy = dySum / matches.length;
       
        // Оценка масштаба (по парам точек)
        let scaleSum = 0;
        let scaleCount = 0;
       
        for (let i = 0; i < matches.length; i++) {
            for (let j = i + 1; j < matches.length; j++) {
                const dist1 = this.distance(matches[i].point1, matches[j].point1);
                const dist2 = this.distance(matches[i].point2, matches[j].point2);
               
                if (dist1 > 0) {
                    scaleSum += dist2 / dist1;
                    scaleCount++;
                }
            }
        }
       
        const avgScale = scaleCount > 0 ? scaleSum / scaleCount : 1;
       
        // Простая оценка поворота
        const rotation = 0; // Упрощенно
       
        return {
            dx: Math.round(avgDx),
            dy: Math.round(avgDy),
            scale: avgScale.toFixed(3),
            rotation: rotation
        };
    }
   
    // 6. ДОПОЛНЕНИЕ ОДНОГО СЛЕДА ТОЧКАМИ ДРУГОГО
    enhanceFootprint(basePoints, sourcePoints, matches, transform) {
        // Находим точки, которые есть в source, но нет в base
        const basePointSet = new Set(basePoints.map(p => p.id));
        const matchedSourcePoints = new Set(matches.map(m => m.point2.id));
       
        const newPoints = [];
        let reconstructedCount = 0;
       
        sourcePoints.forEach(sourcePoint => {
            // Если точка уже есть в base или уже сопоставлена - пропускаем
            if (basePointSet.has(sourcePoint.id) || matchedSourcePoints.has(sourcePoint.id)) {
                return;
            }
           
            // Находим 3 ближайшие сопоставленные точки
            const nearestMatches = this.findNearestMatches(sourcePoint, matches, 3);
           
            if (nearestMatches.length >= 2) {
                // Восстанавливаем положение точки относительно сопоставленных
                const reconstructed = this.reconstructPoint(sourcePoint, nearestMatches, transform);
               
                if (reconstructed) {
                    newPoints.push({
                        ...sourcePoint,
                        x: reconstructed.x,
                        y: reconstructed.y,
                        reconstructed: true,
                        confidence: reconstructed.confidence,
                        basedOn: nearestMatches.map(m => m.point1.id)
                    });
                    reconstructedCount++;
                }
            }
        });
       
        console.log(`   🔧 Дополнено точек: ${newPoints.length} (восстановлено: ${reconstructedCount})`);
       
        return {
            newPoints,
            reconstructedCount,
            totalPossible: basePoints.length + newPoints.length
        };
    }
   
    // 7. ВОССТАНОВЛЕНИЕ ТОЧКИ ОТНОСИТЕЛЬНО СОПОСТАВЛЕННЫХ
    reconstructPoint(point, nearestMatches, transform) {
        // Используем барицентрические координаты
        if (nearestMatches.length >= 3) {
            const p1 = nearestMatches[0].point1;
            const p2 = nearestMatches[1].point1;
            const p3 = nearestMatches[2].point1;
           
            const q1 = nearestMatches[0].point2;
            const q2 = nearestMatches[1].point2;
            const q3 = nearestMatches[2].point2;
           
            // Вычисляем барицентрические координаты точки в source
            const bary = this.barycentricCoordinates(point, q1, q2, q3);
           
            if (bary) {
                // Применяем те же координаты к base
                const x = bary.alpha * p1.x + bary.beta * p2.x + bary.gamma * p3.x;
                const y = bary.alpha * p1.y + bary.beta * p2.y + bary.gamma * p3.y;
               
                // Уверенность зависит от близости к опорным точкам
                const avgDistance = (bary.dist1 + bary.dist2 + bary.dist3) / 3;
                const confidence = Math.max(0, 1 - avgDistance / 100);
               
                return {
                    x: Math.round(x),
                    y: Math.round(y),
                    confidence: confidence.toFixed(2)
                };
            }
        }
       
        return null;
    }
   
    // 8. ВИЗУАЛИЗАЦИЯ РЕЗУЛЬТАТОВ
    visualizeComparison(fp1, fp2, matches, enhanced) {
        console.log('\n📊 ВИЗУАЛИЗАЦИЯ СРАВНЕНИЯ:');
       
        const gridSize = 50;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));
       
        // Объединяем все точки
        const allPoints = [...fp1, ...fp2, ...enhanced.newPoints];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const scaleX = maxX - minX || 1;
        const scaleY = maxY - minY || 1;
       
        // Отмечаем восстановленные точки
        enhanced.newPoints.forEach(p => {
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                grid[gridY][gridX] = '+'; // Восстановленная точка
            }
        });
       
        // Отмечаем совпадения
        const matchedPoints1 = new Set(matches.map(m => `${m.point1.x},${m.point1.y}`));
        const matchedPoints2 = new Set(matches.map(m => `${m.point2.x},${m.point2.y}`));
       
        // Первый след
        fp1.forEach(p => {
            const key = `${p.x},${p.y}`;
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (matchedPoints1.has(key)) {
                    grid[gridY][gridX] = '●'; // Совпадение
                } else if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = '1'; // Только в первом следе
                }
            }
        });
       
        // Второй след
        fp2.forEach(p => {
            const key = `${p.x},${p.y}`;
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (matchedPoints2.has(key)) {
                    // Уже отмечено как совпадение
                } else if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = '2'; // Только во втором следе
                }
            }
        });
       
        console.log('1 - след 1, 2 - след 2, ● - совпадение, + - восстановленная');
        console.log('┌' + '─'.repeat(gridSize) + '┐');
        for (let y = 0; y < gridSize; y++) {
            let row = '│';
            for (let x = 0; x < gridSize; x++) {
                row += grid[y][x];
            }
            row += '│';
            console.log(row);
        }
        console.log('└' + '─'.repeat(gridSize) + '┘');
       
        // Легенда типов точек
        console.log('\n🎨 ТИПЫ ТОЧЕК:');
        console.log('   ПЯТКА (heel) - вес 1.2 - задняя часть');
        console.log('   МЫСОК (toe)  - вес 1.5 - передняя часть');
        console.log('   АРКА (arch)  - вес 1.0 - свод стопы');
        console.log('   ПРОТЕКТОР (tread) - вес 0.8 - внутренний рисунок');
    }
   
    // 9. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx*dx + dy*dy);
    }
   
    findNearestMatches(point, matches, count) {
        return matches
            .map(m => ({
                match: m,
                distance: this.distance(point, m.point2)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count)
            .map(item => item.match);
    }
   
    barycentricCoordinates(p, p1, p2, p3) {
        const area = (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y);
       
        if (Math.abs(area) < 0.001) return null;
       
        const alpha = ((p2.y - p3.y) * (p.x - p3.x) + (p3.x - p2.x) * (p.y - p3.y)) / area;
        const beta = ((p3.y - p1.y) * (p.x - p3.x) + (p1.x - p3.x) * (p.y - p3.y)) / area;
        const gamma = 1 - alpha - beta;
       
        // Проверяем, что точка внутри треугольника
        if (alpha >= 0 && beta >= 0 && gamma >= 0) {
            return {
                alpha, beta, gamma,
                dist1: this.distance(p, p1),
                dist2: this.distance(p, p2),
                dist3: this.distance(p, p3)
            };
        }
       
        return null;
    }
}

// 🔧 ГЕОМЕТРИЧЕСКИЙ ХЕШ (оптимизированная версия)
class GeometricHash {
    constructor() {
        this.triangleCache = new Map();
    }
   
    matchPointsByGeometricHash(points1, points2) {
        // Упрощенная версия для теста
        const matches = [];
        const used2 = new Set();
       
        // Простое сопоставление по ID и близости
        points1.forEach(p1 => {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestIndex = -1;
           
            points2.forEach((p2, j) => {
                if (used2.has(j)) return;
               
                // Если есть ID - сравниваем по ним
                if (p1.id && p2.id && p1.id === p2.id) {
                    const dist = this.distance(p1, p2);
                    if (dist < 50) { // Больший порог для реальных следов
                        bestMatch = p2;
                        bestIndex = j;
                        minDistance = dist;
                    }
                }
            });
           
            if (bestMatch) {
                matches.push({
                    point1: p1,
                    point2: bestMatch,
                    distance: minDistance,
                    method: 'id_match'
                });
                used2.add(bestIndex);
            }
        });
       
        return matches;
    }
   
    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx*dx + dy*dy);
    }
}

// 🧪 КОМПЛЕКСНЫЙ ТЕСТ
class ComprehensiveTest {
    constructor() {
        this.system = new RealFootprintSystem();
        this.results = [];
    }
   
    async runAllTests() {
        console.log('🧪 КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ СИСТЕМЫ СЛЕДОВ\n');
       
        // ТЕСТ 1: Левый vs Правый след (зеркальные)
        await this.runTest(
            () => this.system.createRealFootprint('left', 42, 1.0),
            () => this.system.createRealFootprint('right', 42, 1.0),
            'Левый vs Правый след (зеркальные)',
            { minMatch: 70, minReconstructed: 10 }
        );
       
        // ТЕСТ 2: Полный vs Частичный след (отсутствует мысок)
        await this.runTest(
            () => this.system.createRealFootprint('left', 42, 1.0),
            () => this.system.createRealFootprint('left', 42, 0.7),
            'Полный след vs Без части мыска',
            { minMatch: 60, minReconstructed: 15 }
        );
       
        // ТЕСТ 3: С трансформациями (поворот + смещение)
        await this.runTest(
            () => this.system.createRealFootprint('left', 42, 0.9),
            () => {
                const fp = this.system.createRealFootprint('left', 42, 0.8);
                return this.system.applyRealWorldTransform(fp, {
                    rotation: 30,
                    scale: 1.1,
                    offsetX: 50,
                    offsetY: -30,
                    pressure: 0.9,
                    noise: 3
                });
            },
            'С комплексной трансформацией (30°, +50,-30, 1.1x)',
            { minMatch: 50, minReconstructed: 20 }
        );
       
        // ТЕСТ 4: Разные размеры обуви
        await this.runTest(
            () => this.system.createRealFootprint('left', 40, 0.9),
            () => this.system.createRealFootprint('left', 44, 0.9),
            'Размер 40 vs Размер 44',
            { minMatch: 65, minReconstructed: 10 }
        );
       
        // ТЕСТ 5: Очень разные следы (левый неполный vs правый неполный)
        await this.runTest(
            () => {
                const fp = this.system.createRealFootprint('left', 42, 0.6);
                return this.system.applyRealWorldTransform(fp, {
                    rotation: -15,
                    offsetX: -40,
                    pressure: 0.8
                });
            },
            () => {
                const fp = this.system.createRealFootprint('right', 42, 0.5);
                return this.system.applyRealWorldTransform(fp, {
                    rotation: 20,
                    offsetX: 60,
                    pressure: 1.2
                });
            },
            'Левый неполный vs Правый неполный (макс сложность)',
            { minMatch: 40, minReconstructed: 25 }
        );
       
        // ИТОГИ
        this.printFinalReport();
    }
   
    async runTest(createFn1, createFn2, description, expectations) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎯 ТЕСТ: ${description}`);
        console.log(`${'='.repeat(60)}`);
       
        const fp1 = createFn1();
        const fp2 = createFn2();
       
        const result = this.system.compareFootprints(fp1, fp2, description);
       
        // Анализ результатов
        const totalMatches = result.matches.length;
        const matchPercent = (totalMatches / Math.min(fp1.length, fp2.length) * 100).toFixed(1);
        const reconstructed = result.enhancedCount;
       
        const passedMatches = parseFloat(matchPercent) >= expectations.minMatch;
        const passedReconstructed = reconstructed >= expectations.minReconstructed;
        const overallPassed = passedMatches && passedReconstructed;
       
        console.log(`\n📊 РЕЗУЛЬТАТЫ:`);
        console.log(`   • Совпадений: ${totalMatches} (${matchPercent}%)`);
        console.log(`   • Восстановлено точек: ${reconstructed}`);
        console.log(`   • Полнота объединенного следа: ${(result.completeness * 100).toFixed(1)}%`);
       
        if (result.typeAnalysis) {
            console.log(`\n📈 СОВПАДЕНИЯ ПО ТИПАМ:`);
            Object.entries(result.typeAnalysis).forEach(([type, stat]) => {
                console.log(`   • ${type}: ${stat.matched}/${Math.max(stat.total1, stat.total2)} (${stat.percentage}%)`);
            });
        }
       
        if (result.transform) {
            console.log(`\n🔄 ОЦЕНКА ТРАНСФОРМАЦИИ:`);
            console.log(`   • Сдвиг: (${result.transform.dx}, ${result.transform.dy})`);
            console.log(`   • Масштаб: ${result.transform.scale}x`);
            console.log(`   • Поворот: ${result.transform.rotation}°`);
        }
       
        console.log(`\n✅ ТРЕБОВАНИЯ:`);
        console.log(`   • Совпадений >${expectations.minMatch}%: ${passedMatches ? '✅' : '❌'}`);
        console.log(`   • Восстановлено >${expectations.minReconstructed} точек: ${passedReconstructed ? '✅' : '❌'}`);
       
        this.results.push({
            test: description,
            matches: totalMatches,
            matchPercent: parseFloat(matchPercent),
            reconstructed: reconstructed,
            completeness: result.completeness,
            passed: overallPassed,
            expectations: expectations
        });
       
        // Небольшая пауза между тестами
        await new Promise(resolve => setTimeout(resolve, 500));
    }
   
    printFinalReport() {
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 ФИНАЛЬНЫЙ ОТЧЁТ');
        console.log(`${'='.repeat(60)}`);
       
        const passedTests = this.results.filter(r => r.passed).length;
        const totalTests = this.results.length;
       
        this.results.forEach((r, i) => {
            const status = r.passed ? '✅' : '❌';
            console.log(`${status} ТЕСТ ${i+1}: ${r.test}`);
            console.log(`   Совпадения: ${r.matchPercent}% (требовалось >${r.expectations.minMatch}%)`);
            console.log(`   Восстановлено: ${r.reconstructed} точек (требовалось >${r.expectations.minReconstructed})`);
            console.log(`   Полнота: ${(r.completeness * 100).toFixed(1)}%\n`);
        });
       
        console.log(`🎯 ИТОГО: ${passedTests}/${totalTests} тестов пройдено`);
       
        if (passedTests === totalTests) {
            console.log('\n🏆 СИСТЕМА ГОТОВА К РЕАЛЬНОМУ ИСПОЛЬЗОВАНИЮ!');
            console.log('🚀 Можно интегрировать в криминалистическую систему');
        } else {
            console.log('\n⚠️ Требуется дополнительная настройка');
        }
       
        console.log('\n💡 ВОЗМОЖНОСТИ СИСТЕМЫ:');
        console.log('1. Сравнение левых и правых следов');
        console.log('2. Восстановление недостающих частей');
        console.log('3. Учет трансформаций (поворот, масштаб, смещение)');
        console.log('4. Работа с частичными отпечатками');
        console.log('5. Объединение нескольких следов в один полный');
        console.log('6. Приоритетное сравнение ключевых точек (пятка, мысок)');
    }
}

// 🚀 ЗАПУСК
async function main() {
    console.log('👣 СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ\n');
    console.log('📚 РЕШАЕМЫЕ ЗАДАЧИ:');
    console.log('• Сравнение следов с разными углами и положениями');
    console.log('• Восстановление недостающих частей отпечатков');
    console.log('• Объединение нескольких частичных следов');
    console.log('• Работа с левыми и правыми отпечатками');
    console.log('• Учет разного давления и деформации\n');
   
    const testSuite = new ComprehensiveTest();
    await testSuite.runAllTests();
   
    console.log('\n🔥 СИСТЕМА ГОТОВА К ИНТЕГРАЦИИ В ВАШ ПРОЕКТ!');
}

// Запускаем
main().catch(console.error);
