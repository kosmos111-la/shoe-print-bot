// test-forensic-comparison.js
console.log('🔍 ФОРЕНЗИК-АЛГОРИТМ СРАВНЕНИЯ СЛЕДОВ\n');

// 🔧 РЕАЛИСТИЧНЫЕ ФИГУРЫ
class RealisticShapes {
    // Классическая восьмёрка (след обуви)
    static createEightShape(centerX = 400, centerY = 300, scale = 1.0) {
        const points = [];
        const length = 250 * scale;  // Длина следа
        const width = 100 * scale;   // Ширина следа
       
        // ПЯТКА (малая петля) - более плотные точки
        const heelRadius = 40 * scale;
        for (let angle = Math.PI/4; angle < 3*Math.PI/4; angle += 0.2) {
            const x = centerX + Math.cos(angle) * heelRadius;
            const y = centerY - length/3 + Math.sin(angle) * heelRadius/2;
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'heel',
                weight: 1.2  // Ключевая зона
            });
        }
       
        // ПЕРЕХОД (узкая часть)
        const transitionCount = 4;
        for (let i = 0; i < transitionCount; i++) {
            const t = i / (transitionCount - 1);
            const x = centerX;
            const y = centerY - length/6 + (t - 0.5) * 20 * scale;
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'transition',
                weight: 1.0
            });
        }
       
        // НОСОК (большая петля) - изогнутая форма
        const toeRadius = 60 * scale;
        for (let angle = -Math.PI/4; angle < Math.PI/4; angle += 0.15) {
            const x = centerX + Math.cos(angle) * toeRadius;
            const y = centerY + length/3 + Math.sin(angle) * toeRadius * 1.5;
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'toe',
                weight: 1.5  // Самые важные точки
            });
        }
       
        // КРАЙНИЕ ТОЧКИ (контур)
        const contourPoints = [
            // Левая сторона
            { x: centerX - width/2, y: centerY - length/2.5 },
            { x: centerX - width/2.5, y: centerY },
            { x: centerX - width/2, y: centerY + length/2.5 },
            // Правая сторона
            { x: centerX + width/2, y: centerY - length/2.5 },
            { x: centerX + width/2.5, y: centerY },
            { x: centerX + width/2, y: centerY + length/2.5 }
        ];
       
        contourPoints.forEach(p => {
            points.push({
                x: Math.round(p.x * scale + centerX * (1 - scale)),
                y: Math.round(p.y * scale + centerY * (1 - scale)),
                type: 'contour',
                weight: 0.8
            });
        });
       
        console.log(`👣 Создана восьмёрка: ${points.length} точек`);
        return points;
    }
   
    // Шестёрка (восьмёрка без части носа)
    static createSixShape(centerX = 400, centerY = 300, scale = 1.0) {
        const points = [];
        const length = 250 * scale;
        const width = 100 * scale;
       
        // ПЯТКА (такая же)
        const heelRadius = 40 * scale;
        for (let angle = Math.PI/4; angle < 3*Math.PI/4; angle += 0.2) {
            const x = centerX + Math.cos(angle) * heelRadius;
            const y = centerY - length/3 + Math.sin(angle) * heelRadius/2;
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'heel',
                weight: 1.2
            });
        }
       
        // ПЕРЕХОД (такой же)
        const transitionCount = 4;
        for (let i = 0; i < transitionCount; i++) {
            const t = i / (transitionCount - 1);
            const x = centerX;
            const y = centerY - length/6 + (t - 0.5) * 20 * scale;
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'transition',
                weight: 1.0
            });
        }
       
        // НОСОК (НЕПОЛНЫЙ - отсутствует верхняя часть!)
        const toeRadius = 60 * scale;
        // ТОЛЬКО нижняя половина круга
        for (let angle = -Math.PI/4; angle < 0; angle += 0.15) {
            const x = centerX + Math.cos(angle) * toeRadius;
            const y = centerY + length/3 + Math.sin(angle) * toeRadius * 1.5;
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'toe_partial',
                weight: 1.0  // Меньший вес, так как неполная
            });
        }
       
        // КРАЙНИЕ ТОЧКИ (контур, тоже неполный)
        const contourPoints = [
            // Левая сторона
            { x: centerX - width/2, y: centerY - length/2.5 },
            { x: centerX - width/2.5, y: centerY },
            // Нет правой верхней точки!
            { x: centerX + width/2, y: centerY - length/2.5 },
            { x: centerX + width/2.5, y: centerY }
        ];
       
        contourPoints.forEach(p => {
            points.push({
                x: Math.round(p.x * scale + centerX * (1 - scale)),
                y: Math.round(p.y * scale + centerY * (1 - scale)),
                type: 'contour_partial',
                weight: 0.8
            });
        });
       
        console.log(`👣 Создана шестёрка: ${points.length} точек (без полного носка)`);
        return points;
    }
   
    // Трансформации
    static transformPoints(points, angle = 0, scale = 1.0, offsetX = 0, offsetY = 0) {
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        // Центр для поворота
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
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
           
            // Возврат + смещение
            return {
                ...p,
                x: Math.round(x + centerX + offsetX),
                y: Math.round(y + centerY + offsetY)
            };
        });
    }
}

// 🔍 ФОРЕНЗИК-АЛГОРИТМ СРАВНЕНИЯ
class ForensicComparison {
    constructor() {
        this.keyPointThreshold = 15; // Пикселей для ключевых точек
        this.contourThreshold = 25;  // Пикселей для контурных точек
    }
   
    // 1. НАХОЖДЕНИЕ КЛЮЧЕВЫХ ТОЧЕК
    findKeyPoints(points) {
        const keyPoints = [];
       
        // Типы точек с разными весами
        const typeWeights = {
            'heel': 1.2,
            'toe': 1.5,
            'toe_partial': 1.0,
            'transition': 1.0,
            'contour': 0.8,
            'contour_partial': 0.8
        };
       
        // Сортируем по весу
        points.forEach(p => {
            const weight = typeWeights[p.type] || 1.0;
            keyPoints.push({
                ...p,
                weight: weight
            });
        });
       
        return keyPoints.sort((a, b) => b.weight - a.weight);
    }
   
    // 2. ВЫРАВНИВАНИЕ ПО ГЛАВНОЙ ОСИ
    alignByPrincipalAxis(points) {
        if (points.length < 3) return points;
       
        // Вычисляем ковариационную матрицу
        let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
       
        points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        });
       
        const n = points.length;
        const meanX = sumX / n;
        const meanY = sumY / n;
       
        const covXX = sumXX / n - meanX * meanX;
        const covYY = sumYY / n - meanY * meanY;
        const covXY = sumXY / n - meanX * meanY;
       
        // Угол главной оси
        const angleRad = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
        const angleDeg = -angleRad * 180 / Math.PI;
       
        // Поворачиваем точки
        return this.rotatePoints(points, angleDeg, meanX, meanY);
    }
   
    rotatePoints(points, angleDeg, centerX, centerY) {
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return points.map(p => {
            const x = p.x - centerX;
            const y = p.y - centerY;
           
            return {
                ...p,
                x: Math.round(x * cosA - y * sinA + centerX),
                y: Math.round(x * sinA + y * cosA + centerY)
            };
        });
    }
   
    // 3. СРАВНЕНИЕ С ИСПОЛЬЗОВАНИЕМ ГРУПП ТОЧЕК
    compareByPointGroups(points1, points2) {
        // Группируем точки по типам
        const groups1 = this.groupPointsByType(points1);
        const groups2 = this.groupPointsByType(points2);
       
        let totalMatches = 0;
        let totalWeight = 0;
       
        // Сравниваем каждую группу
        Object.keys(groups1).forEach(type => {
            if (groups2[type]) {
                const groupMatches = this.comparePointGroup(
                    groups1[type],
                    groups2[type],
                    type
                );
                totalMatches += groupMatches.matches;
                totalWeight += groupMatches.weight;
            }
        });
       
        // Общий процент совпадения
        const maxPossible = Math.min(points1.length, points2.length);
        const percentage = maxPossible > 0 ? (totalMatches / maxPossible) * 100 : 0;
       
        return {
            matches: totalMatches,
            percentage: percentage.toFixed(1),
            weightedScore: totalWeight
        };
    }
   
    groupPointsByType(points) {
        const groups = {};
       
        points.forEach(p => {
            if (!groups[p.type]) {
                groups[p.type] = [];
            }
            groups[p.type].push(p);
        });
       
        return groups;
    }
   
    comparePointGroup(group1, group2, type) {
        const threshold = type.includes('contour') ?
            this.contourThreshold : this.keyPointThreshold;
       
        const used2 = new Set();
        let matches = 0;
        let weight = 0;
       
        // Для каждой точки в group1 ищем ближайшую в group2
        group1.forEach(p1 => {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;
           
            group2.forEach((p2, j) => {
                if (used2.has(j)) return;
               
                const distance = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) +
                    Math.pow(p2.y - p1.y, 2)
                );
               
                if (distance < bestDistance && distance < threshold) {
                    bestDistance = distance;
                    bestMatch = p2;
                    bestIndex = j;
                }
            });
           
            if (bestMatch) {
                matches++;
                weight += p1.weight || 1.0;
                used2.add(bestIndex);
            }
        });
       
        return { matches, weight };
    }
   
    // 4. ПОИСК УНИКАЛЬНЫХ ОТЛИЧИЙ
    findUniqueDifferences(points1, points2) {
        const differences = {
            missingIn2: [],
            extraIn2: [],
            positionalDifferences: []
        };
       
        // Находим точки, которые есть в 1, но нет в 2
        points1.forEach(p1 => {
            let found = false;
           
            for (const p2 of points2) {
                const distance = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) +
                    Math.pow(p2.y - p1.y, 2)
                );
               
                if (distance < this.keyPointThreshold) {
                    found = true;
                   
                    // Если есть, но далеко - запоминаем разницу позиции
                    if (distance > 5) {
                        differences.positionalDifferences.push({
                            point1: p1,
                            point2: p2,
                            distance: distance
                        });
                    }
                    break;
                }
            }
           
            if (!found && p1.type.includes('toe')) {
                differences.missingIn2.push(p1);
            }
        });
       
        // Находим точки, которые есть в 2, но нет в 1
        points2.forEach(p2 => {
            let found = false;
           
            for (const p1 of points1) {
                const distance = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) +
                    Math.pow(p2.y - p1.y, 2)
                );
               
                if (distance < this.keyPointThreshold) {
                    found = true;
                    break;
                }
            }
           
            if (!found && p2.type.includes('toe')) {
                differences.extraIn2.push(p2);
            }
        });
       
        return differences;
    }
   
    // 5. ОСНОВНОЙ МЕТОД СРАВНЕНИЯ
    compareFootprints(points1, points2, description) {
        console.log(`\n🔍 ${description}`);
        console.log(`   Форма 1: ${points1.length} точек`);
        console.log(`   Форма 2: ${points2.length} точек`);
       
        // Выделяем ключевые точки
        const keyPoints1 = this.findKeyPoints(points1);
        const keyPoints2 = this.findKeyPoints(points2);
       
        console.log(`   • Ключевых точек: ${keyPoints1.length} vs ${keyPoints2.length}`);
       
        // Выравниваем по главной оси
        const aligned1 = this.alignByPrincipalAxis(keyPoints1);
        const aligned2 = this.alignByPrincipalAxis(keyPoints2);
       
        // Сравниваем по группам
        const comparison = this.compareByPointGroups(aligned1, aligned2);
       
        // Находим уникальные отличия
        const differences = this.findUniqueDifferences(aligned1, aligned2);
       
        // Анализируем результат
        const analysis = this.analyzeResult(comparison, differences, description);
       
        // Визуализация
        this.visualizeComparison(aligned1, aligned2, comparison);
       
        return {
            ...comparison,
            differences,
            analysis
        };
    }
   
    analyzeResult(comparison, differences, description) {
        const percentage = parseFloat(comparison.percentage);
        let conclusion = '';
       
        if (description.includes('та же')) {
            // Одна и та же обувь: должно быть >85%
            if (percentage > 85 && differences.missingIn2.length === 0) {
                conclusion = '✅ ОДНА И ТА ЖЕ ОБУВЬ';
            } else if (percentage > 70) {
                conclusion = '⚠️ ВОЗМОЖНО ОДНА И ТА ЖЕ';
            } else {
                conclusion = '❌ РАЗНАЯ ОБУВЬ';
            }
        }
        else if (description.includes('восьмёрка vs шестёрка')) {
            // Восьмёрка vs шестёрка: 60-80%
            const missingToePoints = differences.missingIn2.filter(p =>
                p.type.includes('toe')
            ).length;
           
            if (percentage >= 60 && percentage <= 80 && missingToePoints > 2) {
                conclusion = '✅ РАЗНАЯ ОБУВЬ (восьмёрка vs шестёрка)';
            } else if (percentage > 80) {
                conclusion = '⚠️ СЛИШКОМ ПОХОЖИ (возможно одна обувь)';
            } else {
                conclusion = '❌ НЕПОНЯТНО';
            }
        }
        else if (description.includes('Поворот')) {
            // С поворотом: должно быть >80%
            if (percentage > 80) {
                conclusion = '✅ ОДНА ОБУВЬ (с поворотом)';
            } else {
                conclusion = '❌ ПРОБЛЕМА С ВЫРАВНИВАНИЕМ';
            }
        }
        else {
            // Общий случай
            if (percentage > 85) conclusion = '✅ ОДНА И ТА ЖЕ';
            else if (percentage > 60) conclusion = '⚠️ ПОХОЖАЯ';
            else conclusion = '❌ РАЗНАЯ';
        }
       
        return { conclusion, missingToePoints: differences.missingIn2.length };
    }
   
    visualizeComparison(points1, points2, comparison) {
        // Простая визуализация
        const gridSize = 40;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));
       
        const allPoints = [...points1, ...points2];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
       
        if (xs.length === 0 || ys.length === 0) return;
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Отмечаем совпадения (символами в зависимости от типа)
        points1.forEach(p1 => {
            const gridX = Math.floor((p1.x - minX) / (maxX - minX) * (gridSize - 1));
            const gridY = Math.floor((p1.y - minY) / (maxY - minY) * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (p1.type.includes('toe')) grid[gridY][gridX] = 'T';
                else if (p1.type.includes('heel')) grid[gridY][gridX] = 'H';
                else if (p1.type.includes('contour')) grid[gridY][gridX] = 'C';
                else grid[gridY][gridX] = '.';
            }
        });
       
        // Вторая форма поверх (заменяем на X если совпадает)
        points2.forEach(p2 => {
            const gridX = Math.floor((p2.x - minX) / (maxX - minX) * (gridSize - 1));
            const gridY = Math.floor((p2.y - minY) / (maxY - minY) * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                const existing = grid[gridY][gridX];
                if (existing !== ' ') {
                    grid[gridY][gridX] = 'X'; // Совпадение
                } else {
                    grid[gridY][gridX] = 'x'; // Уникальная точка формы 2
                }
            }
        });
       
        console.log('\n📊 ВИЗУАЛИЗАЦИЯ:');
        console.log('T=носок, H=пятка, C=контур, .=прочее, X=совпадение, x=уникальная точка');
        console.log('┌' + '─'.repeat(gridSize) + '┐');
        for (let y = 0; y < gridSize; y++) {
            process.stdout.write('│');
            for (let x = 0; x < gridSize; x++) {
                process.stdout.write(grid[y][x]);
            }
            console.log('│');
        }
        console.log('└' + '─'.repeat(gridSize) + '┘');
    }
}

// 🧪 ТЕСТЫ
class ForensicTests {
    constructor() {
        this.comparator = new ForensicComparison();
    }
   
    runAllTests() {
        console.log('🧪 ЗАПУСК ФОРЕНЗИК-ТЕСТОВ\n');
       
        const results = [];
       
        // ТЕСТ 1: Одна и та же обувь
        console.log('1. 🎯 СЦЕНАРИЙ 1: ОДНА И ТА ЖЕ ОБУВЬ');
        const sameShoe = RealisticShapes.createEightShape();
        const sameShoeCopy = JSON.parse(JSON.stringify(sameShoe));
       
        results.push(this.runTest(
            sameShoe,
            sameShoeCopy,
            'Одна и та же обувь (повторный отпечаток)',
            { min: 85, max: 100 }
        ));
       
        // ТЕСТ 2: Восьмёрка vs Шестёрка
        console.log('\n2. 🎯 СЦЕНАРИЙ 2: ВОСЬМЁРКА vs ШЕСТЁРКА');
        const eight = RealisticShapes.createEightShape();
        const six = RealisticShapes.createSixShape();
       
        results.push(this.runTest(
            eight,
            six,
            'Восьмёрка vs Шестёрка',
            { min: 60, max: 80 }
        ));
       
        // ТЕСТ 3: С поворотом 45°
        console.log('\n3. 🎯 СЦЕНАРИЙ 3: С ПОВОРОТОМ 45°');
        const rotated = RealisticShapes.transformPoints(eight, 45);
       
        results.push(this.runTest(
            eight,
            rotated,
            'Восьмёрка vs Повернутая на 45°',
            { min: 80, max: 95 }
        ));
       
        // ТЕСТ 4: Разный масштаб
        console.log('\n4. 🎯 СЦЕНАРИЙ 4: РАЗНЫЙ МАСШТАБ (0.8x)');
        const scaled = RealisticShapes.transformPoints(eight, 0, 0.8);
       
        results.push(this.runTest(
            eight,
            scaled,
            'Разный масштаб (0.8x)',
            { min: 80, max: 95 }
        ));
       
        // ТЕСТ 5: Смещение
        console.log('\n5. 🎯 СЦЕНАРИЙ 5: СО СМЕЩЕНИЕМ');
        const shifted = RealisticShapes.transformPoints(eight, 0, 1.0, 30, -20);
       
        results.push(this.runTest(
            eight,
            shifted,
            'Со смещением (+30, -20)',
            { min: 80, max: 95 }
        ));
       
        // ТЕСТ 6: Комбинированная трансформация
        console.log('\n6. 🎯 СЦЕНАРИЙ 6: КОМБИНИРОВАННАЯ');
        const combined = RealisticShapes.transformPoints(eight, 30, 0.9, 20, 10);
       
        results.push(this.runTest(
            eight,
            combined,
            'Комбинированная (30°, 0.9x, +20,+10)',
            { min: 75, max: 90 }
        ));
       
        // ТЕСТ 7: Совсем другая форма
        console.log('\n7. 🎯 СЦЕНАРИЙ 7: СОВСЕМ ДРУГАЯ ФОРМА');
        const differentShoe = RealisticShapes.createSixShape(450, 350, 1.2);
       
        results.push(this.runTest(
            eight,
            differentShoe,
            'Восьмёрка vs Совсем другая',
            { min: 30, max: 50 }
        ));
       
        // Сводный отчёт
        this.generateSummary(results);
       
        return results;
    }
   
    runTest(points1, points2, description, expected) {
        const result = this.comparator.compareFootprints(points1, points2, description);
       
        const percentage = parseFloat(result.percentage);
        const isInRange = percentage >= expected.min && percentage <= expected.max;
       
        console.log(`\n📊 РЕЗУЛЬТАТ: ${percentage}% совпадений`);
        console.log(`   ${result.analysis.conclusion}`);
        console.log(`   Отсутствует точек в носке: ${result.analysis.missingToePoints}`);
       
        if (description.includes('шестёрка') && result.analysis.missingToePoints > 2) {
            console.log(`   ✅ Обнаружено отсутствие части носка (шестёрка)`);
        }
       
        return {
            test: description,
            percentage,
            expected,
            inRange: isInRange,
            conclusion: result.analysis.conclusion,
            missingToePoints: result.analysis.missingToePoints
        };
    }
   
    generateSummary(results) {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        let passed = 0;
        results.forEach(r => {
            const status = r.inRange ? '✅' : '❌';
            console.log(`${status} ${r.test}: ${r.percentage}% (ожидалось ${r.expected.min}-${r.expected.max}%)`);
            console.log(`   Вывод: ${r.conclusion}, отсутствует точек носка: ${r.missingToePoints}`);
           
            if (r.inRange) passed++;
        });
       
        console.log(`\n🎯 ИТОГО: ${passed}/${results.length} тестов пройдено`);
       
        if (passed >= results.length - 1) {
            console.log('✅ Алгоритм готов к внедрению!');
        } else {
            console.log('⚠️ Требуется доработка');
        }
    }
}

// 🚀 ЗАПУСК
console.log('🚀 ФОРЕНЗИК-АНАЛИЗ СЛЕДОВ ОБУВИ\n');
console.log('📚 Принципы:');
console.log('• Выделение ключевых точек (носок, пятка)');
console.log('• Групповое сравнение по типам точек');
console.log('• Выравнивание по главной оси');
console.log('• Поиск уникальных отличий\n');

const tests = new ForensicTests();
const results = tests.runAllTests();

console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!\n');

// Рекомендации
console.log('💡 РЕКОМЕНДАЦИИ ДЛЯ СИСТЕМЫ:');
console.log('1. Используйте типы точек (носок, пятка, контур)');
console.log('2. Присваивайте веса точкам (носок > пятка > контур)');
console.log('3. Сначала выравнивайте следы по главной оси');
console.log('4. Ищите отсутствующие/лишние точки в ключевых зонах');
console.log('5. Учитывайте не только процент совпадений, но и паттерны различий');
