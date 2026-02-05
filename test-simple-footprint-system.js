// test-simple-footprint-system.js
console.log('👣 ПРОСТАЯ СИСТЕМА СРАВНЕНИЯ СЛЕДОВ\n');

class SimpleFootprintSystem {
    constructor() {
        this.gridSize = 60;
        this.footprintWidth = 100;
        this.footprintHeight = 250;
    }
   
    // 1. СОЗДАЕМ ЧЕТКИЙ СЛЕД ОБУВИ
    createClearFootprint(type = 'left', size = 42, completeness = 1.0) {
        const points = [];
        const width = this.footprintWidth;
        const height = this.footprintHeight;
       
        // СМЕЩАЕМ КООРДИНАТЫ В ПРАВИЛЬНОЕ МЕСТО
        const offsetX = this.gridSize * 0.3;
        const offsetY = this.gridSize * 0.5;
       
        let pointId = 0;
       
        // ===== ПЯТКА (задняя часть) =====
        // Полукруг с центром внизу
        const heelPoints = 8;
        for (let i = 0; i < heelPoints; i++) {
            const angle = Math.PI + (i / (heelPoints - 1)) * Math.PI; // 180-360 градусов
            const x = offsetX + Math.cos(angle) * width * 0.4;
            const y = offsetY - height/2 + Math.sin(angle) * width * 0.2;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `heel_${pointId++}`,
                type: 'heel',
                side: type,
                weight: 1.2
            });
        }
       
        // ===== БОКОВЫЕ СТОРОНЫ =====
        // Левая сторона
        const sidePoints = 6;
        for (let i = 0; i < sidePoints; i++) {
            const t = i / (sidePoints - 1);
            const x = offsetX - width/2;
            const y = offsetY - height/2 + t * height;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `left_${pointId++}`,
                type: 'side',
                side: type,
                weight: 1.0
            });
        }
       
        // Правая сторона
        for (let i = 0; i < sidePoints; i++) {
            const t = i / (sidePoints - 1);
            const x = offsetX + width/2;
            const y = offsetY - height/2 + t * height;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `right_${pointId++}`,
                type: 'side',
                side: type,
                weight: 1.0
            });
        }
       
        // ===== МЫСОК (передняя часть) =====
        // Полукруг с центром вверху
        const toePoints = Math.round(10 * completeness);
        const missingStart = Math.floor(toePoints * 0.6);
        const missingCount = Math.round(toePoints * 0.3 * (1 - completeness));
       
        for (let i = 0; i < toePoints; i++) {
            // Пропускаем часть для неполных следов
            if (completeness < 1.0 && i >= missingStart && i < missingStart + missingCount) {
                continue;
            }
           
            const angle = (i / (toePoints - 1)) * Math.PI; // 0-180 градусов
            const x = offsetX + Math.cos(angle) * width * 0.6;
            const y = offsetY + height/2 - Math.sin(angle) * width * 0.3;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `toe_${pointId++}`,
                type: 'toe',
                side: type,
                weight: 1.5,
                missing: completeness < 1.0 && i >= missingStart
            });
        }
       
        // ===== ВНУТРЕННИЕ ТОЧКИ (протектор) =====
        if (completeness > 0.7) {
            const innerPoints = 15;
            for (let i = 0; i < innerPoints; i++) {
                // Точки внутри овала
                const angle = Math.random() * 2 * Math.PI;
                const radiusX = width * 0.4 * Math.random();
                const radiusY = height * 0.4 * Math.random();
               
                const x = offsetX + radiusX * Math.cos(angle);
                const y = offsetY + radiusY * Math.sin(angle);
               
                // Проверяем, что точка внутри следа
                const normalizedX = (x - offsetX) / (width/2);
                const normalizedY = (y - offsetY) / (height/2);
               
                if (Math.pow(normalizedX, 2) + Math.pow(normalizedY, 2) <= 1) {
                    points.push({
                        x: Math.round(x),
                        y: Math.round(y),
                        id: `inner_${pointId++}`,
                        type: 'inner',
                        side: type,
                        weight: 0.8
                    });
                }
            }
        }
       
        // Для правого следа - зеркально отражаем
        if (type === 'right') {
            points.forEach(p => {
                p.x = this.gridSize - p.x; // Зеркальное отражение
            });
        }
       
        console.log(`👣 Создан ${type === 'left' ? 'левый' : 'правый'} след:`);
        console.log(`   • Точек: ${points.length} (полнота: ${(completeness * 100).toFixed(0)}%)`);
       
        return points;
    }
   
    // 2. ТРАНСФОРМАЦИЯ СЛЕДА
    transformFootprint(points, transform) {
        const {
            rotation = 0,    // градусы
            scale = 1.0,
            offsetX = 0,
            offsetY = 0
        } = transform;
       
        const angleRad = rotation * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        // Центр для поворота
        const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
        const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;
       
        return points.map(p => {
            // Относительные координаты
            let x = p.x - centerX;
            let y = p.y - centerY;
           
            // Поворот
            const xRot = x * cosA - y * sinA;
            const yRot = x * sinA + y * cosA;
           
            // Масштаб
            x = xRot * scale;
            y = yRot * scale;
           
            // Обратно + смещение
            return {
                ...p,
                x: Math.round(x + centerX + offsetX),
                y: Math.round(y + centerY + offsetY)
            };
        });
    }
   
    // 3. ПРОСТОЕ СРАВНЕНИЕ ПО БЛИЖАЙШИМ ТОЧКАМ
    compareFootprintsSimple(points1, points2, threshold = 20) {
        const matches = [];
        const used2 = new Set();
       
        points1.forEach(p1 => {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestIndex = -1;
           
            points2.forEach((p2, j) => {
                if (used2.has(j)) return;
               
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
               
                if (distance < minDistance && distance < threshold) {
                    minDistance = distance;
                    bestMatch = p2;
                    bestIndex = j;
                }
            });
           
            if (bestMatch) {
                matches.push({
                    point1: p1,
                    point2: bestMatch,
                    distance: minDistance
                });
                used2.add(bestIndex);
            }
        });
       
        return matches;
    }
   
    // 4. ВОССТАНОВЛЕНИЕ НЕДОСТАЮЩИХ ТОЧЕК
    reconstructMissingPoints(basePoints, sourcePoints, matches) {
        const baseSet = new Set(basePoints.map(p => p.id));
        const matchedSource = new Set(matches.map(m => m.point2.id));
       
        const newPoints = [];
       
        // Для каждой точки из source, которой нет в base
        sourcePoints.forEach(source => {
            if (!baseSet.has(source.id) && !matchedSource.has(source.id)) {
                // Находим 3 ближайшие сопоставленные точки
                const nearest = this.findNearestPoints(source, matches, 3);
               
                if (nearest.length >= 2) {
                    // Восстанавливаем относительное положение
                    const reconstructed = this.interpolatePoint(source, nearest);
                   
                    if (reconstructed) {
                        newPoints.push({
                            ...source,
                            x: reconstructed.x,
                            y: reconstructed.y,
                            reconstructed: true,
                            basedOn: nearest.map(n => n.point1.id)
                        });
                    }
                }
            }
        });
       
        return newPoints;
    }
   
    findNearestPoints(point, matches, count) {
        return matches
            .map(m => ({
                match: m,
                distance: Math.sqrt(
                    Math.pow(m.point2.x - point.x, 2) +
                    Math.pow(m.point2.y - point.y, 2)
                )
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count)
            .map(item => item.match);
    }
   
    interpolatePoint(point, nearestMatches) {
        if (nearestMatches.length >= 2) {
            // Простая интерполяция: среднее положение
            let sumX = 0;
            let sumY = 0;
            let count = 0;
           
            nearestMatches.forEach(match => {
                const basePoint = match.point1;
                const sourcePoint = match.point2;
               
                // Сдвиг между этой парой
                const dx = sourcePoint.x - basePoint.x;
                const dy = sourcePoint.y - basePoint.y;
               
                // Применяем тот же сдвиг к нашей точке
                sumX += point.x - dx;
                sumY += point.y - dy;
                count++;
            });
           
            if (count > 0) {
                return {
                    x: Math.round(sumX / count),
                    y: Math.round(sumY / count)
                };
            }
        }
       
        return null;
    }
   
    // 5. ВИЗУАЛИЗАЦИЯ С ПОНЯТНОЙ ФОРМОЙ
    visualizeFootprints(points1, points2, matches, reconstructed = []) {
        console.log('\n📊 ВИЗУАЛИЗАЦИЯ СЛЕДОВ:');
       
        const grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(' '));
       
        // Сначала отрисовываем форму следа (контур)
        this.drawFootprintOutline(grid, points1, '1');
        this.drawFootprintOutline(grid, points2, '2');
       
        // Затем точки
        points1.forEach(p => {
            if (p.x >= 0 && p.x < this.gridSize && p.y >= 0 && p.y < this.gridSize) {
                grid[p.y][p.x] = this.getPointSymbol(p, '1');
            }
        });
       
        points2.forEach(p => {
            if (p.x >= 0 && p.x < this.gridSize && p.y >= 0 && p.y < this.gridSize) {
                const current = grid[p.y][p.x];
                if (current === ' ' || current === '·') {
                    grid[p.y][p.x] = this.getPointSymbol(p, '2');
                } else if (current.includes('1') && !current.includes('●')) {
                    grid[p.y][p.x] = '●'; // Совпадение
                }
            }
        });
       
        // Восстановленные точки
        reconstructed.forEach(p => {
            if (p.x >= 0 && p.x < this.gridSize && p.y >= 0 && p.y < this.gridSize) {
                if (grid[p.y][p.x] === ' ') {
                    grid[p.y][p.x] = '+';
                }
            }
        });
       
        // Выводим сетку
        console.log('Легенда: 1 - след 1, 2 - след 2, ● - совпадение, + - восстановленная');
        console.log('┌' + '─'.repeat(this.gridSize) + '┐');
        for (let y = 0; y < this.gridSize; y++) {
            let row = '│';
            for (let x = 0; x < this.gridSize; x++) {
                row += grid[y][x];
            }
            row += '│';
            console.log(row);
        }
        console.log('└' + '─'.repeat(this.gridSize) + '┘');
    }
   
    drawFootprintOutline(grid, points, marker) {
        if (points.length === 0) return;
       
        // Находим крайние точки
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Рисуем прямоугольник вокруг следа
        for (let x = minX; x <= maxX; x++) {
            if (x >= 0 && x < this.gridSize) {
                if (minY >= 0 && minY < this.gridSize && grid[minY][x] === ' ') {
                    grid[minY][x] = '·';
                }
                if (maxY >= 0 && maxY < this.gridSize && grid[maxY][x] === ' ') {
                    grid[maxY][x] = '·';
                }
            }
        }
       
        for (let y = minY; y <= maxY; y++) {
            if (y >= 0 && y < this.gridSize) {
                if (minX >= 0 && minX < this.gridSize && grid[y][minX] === ' ') {
                    grid[y][minX] = '·';
                }
                if (maxX >= 0 && maxX < this.gridSize && grid[y][maxX] === ' ') {
                    grid[y][maxX] = '·';
                }
            }
        }
    }
   
    getPointSymbol(point, defaultSymbol) {
        switch (point.type) {
            case 'heel': return 'H';
            case 'toe': return 'T';
            case 'side': return 'S';
            case 'inner': return 'I';
            default: return defaultSymbol;
        }
    }
   
    // 6. АНАЛИЗ РЕЗУЛЬТАТОВ
    analyzeResults(points1, points2, matches, reconstructed) {
        const matchPercent = (matches.length / Math.min(points1.length, points2.length) * 100).toFixed(1);
        const totalPoints = points1.length + reconstructed.length;
       
        // Анализ по типам
        const typeStats = {};
        matches.forEach(match => {
            const type = match.point1.type;
            if (!typeStats[type]) typeStats[type] = { matched: 0, total1: 0, total2: 0 };
            typeStats[type].matched++;
        });
       
        points1.forEach(p => {
            if (!typeStats[p.type]) typeStats[p.type] = { matched: 0, total1: 0, total2: 0 };
            typeStats[p.type].total1++;
        });
       
        points2.forEach(p => {
            if (!typeStats[p.type]) typeStats[p.type] = { matched: 0, total1: 0, total2: 0 };
            typeStats[p.type].total2++;
        });
       
        return {
            matchPercent: parseFloat(matchPercent),
            matches: matches.length,
            reconstructed: reconstructed.length,
            totalPoints: totalPoints,
            typeStats: typeStats
        };
    }
}

// 🧪 ТЕСТЫ
class SimpleTests {
    constructor() {
        this.system = new SimpleFootprintSystem();
        this.results = [];
    }
   
    async runTests() {
        console.log('🧪 ТЕСТИРОВАНИЕ ПРОСТОЙ СИСТЕМЫ\n');
       
        // ТЕСТ 1: Два одинаковых следа
        await this.runTest(
            'Два одинаковых левых следа',
            () => this.system.createClearFootprint('left', 42, 1.0),
            () => this.system.createClearFootprint('left', 42, 1.0),
            { minMatch: 80, minReconstructed: 0 }
        );
       
        // ТЕСТ 2: Полный vs Частичный (без мыска)
        await this.runTest(
            'Полный vs Без мыска',
            () => this.system.createClearFootprint('left', 42, 1.0),
            () => this.system.createClearFootprint('left', 42, 0.7),
            { minMatch: 60, minReconstructed: 5 }
        );
       
        // ТЕСТ 3: С поворотом
        await this.runTest(
            'С поворотом 30°',
            () => this.system.createClearFootprint('left', 42, 0.9),
            () => {
                const fp = this.system.createClearFootprint('left', 42, 0.9);
                return this.system.transformFootprint(fp, { rotation: 30, offsetX: 10, offsetY: -5 });
            },
            { minMatch: 50, minReconstructed: 8 }
        );
       
        // ТЕСТ 4: Левый vs Правый
        await this.runTest(
            'Левый vs Правый',
            () => this.system.createClearFootprint('left', 42, 0.8),
            () => this.system.createClearFootprint('right', 42, 0.8),
            { minMatch: 40, minReconstructed: 10 }
        );
       
        // ТЕСТ 5: Комплексный (трансформация + частичный)
        await this.runTest(
            'Комплексный тест',
            () => {
                const fp = this.system.createClearFootprint('left', 42, 0.7);
                return this.system.transformFootprint(fp, { rotation: -15, scale: 0.9 });
            },
            () => {
                const fp = this.system.createClearFootprint('left', 42, 0.6);
                return this.system.transformFootprint(fp, { rotation: 10, offsetX: 15, offsetY: 10 });
            },
            { minMatch: 30, minReconstructed: 15 }
        );
       
        this.printResults();
    }
   
    async runTest(name, createFn1, createFn2, expectations) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🎯 ТЕСТ: ${name}`);
        console.log(`${'='.repeat(50)}`);
       
        const fp1 = createFn1();
        const fp2 = createFn2();
       
        console.log(`   След 1: ${fp1.length} точек`);
        console.log(`   След 2: ${fp2.length} точек`);
       
        // Сравниваем
        const matches = this.system.compareFootprintsSimple(fp1, fp2, 25);
       
        // Восстанавливаем
        const reconstructed = this.system.reconstructMissingPoints(fp1, fp2, matches);
       
        // Анализируем
        const analysis = this.system.analyzeResults(fp1, fp2, matches, reconstructed);
       
        // Визуализируем
        this.system.visualizeFootprints(fp1, fp2, matches, reconstructed);
       
        console.log(`\n📊 РЕЗУЛЬТАТЫ:`);
        console.log(`   • Совпадений: ${analysis.matches} (${analysis.matchPercent}%)`);
        console.log(`   • Восстановлено: ${reconstructed.length} точек`);
        console.log(`   • Всего точек в объединенном следе: ${analysis.totalPoints}`);
       
        if (Object.keys(analysis.typeStats).length > 0) {
            console.log(`\n📈 ПО ТИПАМ ТОЧЕК:`);
            Object.entries(analysis.typeStats).forEach(([type, stats]) => {
                const maxTotal = Math.max(stats.total1, stats.total2);
                const percent = maxTotal > 0 ? (stats.matched / maxTotal * 100).toFixed(1) : '0.0';
                console.log(`   • ${type}: ${stats.matched}/${maxTotal} (${percent}%)`);
            });
        }
       
        // Проверяем ожидания
        const passedMatch = analysis.matchPercent >= expectations.minMatch;
        const passedReconstructed = reconstructed.length >= expectations.minReconstructed;
        const overallPassed = passedMatch && passedReconstructed;
       
        console.log(`\n✅ ОЖИДАНИЯ:`);
        console.log(`   • Совпадений >${expectations.minMatch}%: ${passedMatch ? '✅' : '❌'}`);
        console.log(`   • Восстановлено >${expectations.minReconstructed}: ${passedReconstructed ? '✅' : '❌'}`);
       
        this.results.push({
            name,
            matchPercent: analysis.matchPercent,
            reconstructed: reconstructed.length,
            totalPoints: analysis.totalPoints,
            passed: overallPassed
        });
       
        await new Promise(resolve => setTimeout(resolve, 300));
    }
   
    printResults() {
        console.log(`\n${'='.repeat(50)}`);
        console.log('📊 ИТОГИ ТЕСТИРОВАНИЯ');
        console.log(`${'='.repeat(50)}`);
       
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
       
        this.results.forEach((r, i) => {
            const status = r.passed ? '✅' : '❌';
            console.log(`${status} ТЕСТ ${i+1}: ${r.name}`);
            console.log(`   Совпадения: ${r.matchPercent}%`);
            console.log(`   Восстановлено: ${r.reconstructed} точек`);
            console.log(`   Всего точек: ${r.totalPoints}\n`);
        });
       
        console.log(`🎯 ИТОГО: ${passed}/${total} тестов пройдено`);
       
        if (passed === total) {
            console.log('\n🏆 СИСТЕМА РАБОТАЕТ КОРРЕКТНО!');
        } else {
            console.log('\n⚠️ Требуется настройка параметров');
        }
    }
}

// 🚀 ЗАПУСК
async function main() {
    console.log('👣 ПРОСТАЯ СИСТЕМА СРАВНЕНИЯ СЛЕДОВ ОБУВИ\n');
    console.log('📚 ОСОБЕННОСТИ:');
    console.log('• Четкая визуализация формы следа');
    console.log('• Простое сравнение по расстоянию');
    console.log('• Восстановление недостающих точек');
    console.log('• Работа с трансформациями\n');
   
    const tests = new SimpleTests();
    await tests.runTests();
   
    console.log('\n💡 ПРАКТИЧЕСКИЕ РЕКОМЕНДАЦИИ:');
    console.log('1. Используйте адаптивные пороги (20-30px)');
    console.log('2. Разные типы точек сравнивайте по-разному');
    console.log('3. Сначала находите ключевые точки (пятка, мысок)');
    console.log('4. Для восстановления используйте ближайшие совпадения');
    console.log('5. Тестируйте на реальных данных\n');
   
    console.log('🔥 СИСТЕМА ГОТОВА ДЛЯ ИНТЕГРАЦИИ!');
}

main().catch(console.error);
