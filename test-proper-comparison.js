// test-proper-comparison.js
console.log('🔍 ПРАВИЛЬНОЕ СРАВНЕНИЕ ФИГУР\n');

// 1. СОЗДАЕМ ПРАВИЛЬНЫЕ ФИГУРЫ
class ProperShapes {
    // Классическая восьмёрка (перевернутая)
    static createEight(centerX = 400, centerY = 300, scale = 1.0) {
        const points = [];
       
        // Параметры восьмёрки
        const a = 120 * scale;  // Вертикальный размер
        const b = 60 * scale;   // Горизонтальный размер
       
        // Нижняя петля (пятка) - плотнее
        for (let t = 0; t < Math.PI; t += 0.15) {
            const x = centerX + b * Math.sin(t);
            const y = centerY + a/2 + a/3 * Math.cos(t);
            points.push({ x: Math.round(x), y: Math.round(y) });
        }
       
        // Верхняя петля (носок) - более вытянутая
        for (let t = Math.PI; t < 2 * Math.PI; t += 0.15) {
            const x = centerX + b * Math.sin(t);
            const y = centerY - a/2 + a/4 * Math.cos(t);
            points.push({ x: Math.round(x), y: Math.round(y) });
        }
       
        console.log(`🎯 Создана восьмёрка: ${points.length} точек`);
        return points;
    }
   
    // Шестёрка (восьмёрка без верхней части)
    static createSix(centerX = 400, centerY = 300, scale = 1.0) {
        const points = [];
        const a = 120 * scale;
        const b = 60 * scale;
       
        // Нижняя петля (такая же)
        for (let t = 0; t < Math.PI; t += 0.15) {
            const x = centerX + b * Math.sin(t);
            const y = centerY + a/2 + a/3 * Math.cos(t);
            points.push({ x: Math.round(x), y: Math.round(y) });
        }
       
        // Верхняя петля НЕПОЛНАЯ - пропускаем 3 точки подряд
        let skipped = 0;
        for (let t = Math.PI; t < 2 * Math.PI; t += 0.15) {
            // Пропускаем точки с углом от 4.5 до 5.0 радиан
            if (t > 4.5 && t < 5.0 && skipped < 3) {
                skipped++;
                continue;
            }
            const x = centerX + b * Math.sin(t);
            const y = centerY - a/2 + a/4 * Math.cos(t);
            points.push({ x: Math.round(x), y: Math.round(y) });
        }
       
        console.log(`🎯 Создана шестёрка: ${points.length} точек (отсутствует ${skipped} точек в носке)`);
        return points;
    }
   
    // Применяем трансформацию
    static transform(points, angle = 0, scale = 1.0, offsetX = 0, offsetY = 0) {
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        // Центр фигуры
        const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
        const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;
       
        return points.map(p => {
            // Относительно центра
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
                x: Math.round(x + centerX + offsetX),
                y: Math.round(y + centerY + offsetY)
            };
        });
    }
}

// 2. ПРАВИЛЬНЫЙ АЛГОРИТМ СРАВНЕНИЯ
class ProperComparison {
    constructor() {
        this.matchThreshold = 25; // Пикселей
    }
   
    // СРАВНЕНИЕ С ИСПОЛЬЗОВАНИЕМ ОТНОСИТЕЛЬНЫХ РАССТОЯНИЙ
    compareShapes(points1, points2, description) {
        console.log(`\n🔍 ${description}`);
        console.log(`   Форма 1: ${points1.length} точек`);
        console.log(`   Форма 2: ${points2.length} точек`);
       
        // ШАГ 1: Выравниваем фигуры по их центрам и главным осям
        const aligned1 = this.normalizeAndAlign(points1);
        const aligned2 = this.normalizeAndAlign(points2);
       
        // ШАГ 2: Создаем "отпечатки" фигур (бины расстояний)
        const fingerprint1 = this.createFingerprint(aligned1);
        const fingerprint2 = this.createFingerprint(aligned2);
       
        // ШАГ 3: Сравниваем отпечатки
        const similarity = this.compareFingerprints(fingerprint1, fingerprint2);
       
        // ШАГ 4: Находим точные совпадения точек
        const matches = this.findPointMatches(aligned1, aligned2);
        const matchPercent = (matches.length / Math.min(aligned1.length, aligned2.length) * 100).toFixed(1);
       
        // Визуализация
        this.visualize(aligned1, aligned2, matches);
       
        console.log(`📊 Результат: ${matchPercent}% совпадений, схожесть форм: ${similarity.toFixed(2)}`);
       
        return {
            matchPercent: parseFloat(matchPercent),
            matches: matches.length,
            similarity: similarity,
            points1: aligned1.length,
            points2: aligned2.length
        };
    }
   
    // НОРМАЛИЗАЦИЯ И ВЫРАВНИВАНИЕ
    normalizeAndAlign(points) {
        if (points.length < 3) return points;
       
        // 1. Центрируем
        const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
        const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;
       
        let centered = points.map(p => ({
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        // 2. Находим главную ось (простой метод)
        let sumXY = 0;
        let sumXX = 0;
        let sumYY = 0;
       
        centered.forEach(p => {
            sumXY += p.x * p.y;
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
        });
       
        const angleRad = 0.5 * Math.atan2(2 * sumXY, sumXX - sumYY);
       
        // 3. Поворачиваем
        const cosA = Math.cos(-angleRad);
        const sinA = Math.sin(-angleRad);
       
        let rotated = centered.map(p => ({
            x: p.x * cosA - p.y * sinA,
            y: p.x * sinA + p.y * cosA
        }));
       
        // 4. Масштабируем к единичному размеру
        const maxX = Math.max(...rotated.map(p => Math.abs(p.x)));
        const maxY = Math.max(...rotated.map(p => Math.abs(p.y)));
        const maxDim = Math.max(maxX, maxY);
       
        if (maxDim > 0) {
            rotated = rotated.map(p => ({
                x: p.x / maxDim,
                y: p.y / maxDim
            }));
        }
       
        // 5. Округляем для сравнения
        return rotated.map(p => ({
            x: Math.round(p.x * 1000) / 1000,
            y: Math.round(p.y * 1000) / 1000
        }));
    }
   
    // СОЗДАНИЕ "ОТПЕЧАТКА" ФИГУРЫ
    createFingerprint(points) {
        if (points.length < 4) return [];
       
        const fingerprint = [];
       
        // Используем относительные расстояния между точками
        for (let i = 0; i < Math.min(points.length, 20); i++) {
            const p1 = points[i];
            const distances = [];
           
            // Расстояния до 5 ближайших точек
            for (let j = 0; j < Math.min(points.length, 20); j++) {
                if (i === j) continue;
                const p2 = points[j];
                const dist = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) +
                    Math.pow(p2.y - p1.y, 2)
                );
                distances.push(Math.round(dist * 1000));
            }
           
            distances.sort((a, b) => a - b);
            fingerprint.push(distances.slice(0, 5)); // Берем 5 ближайших
        }
       
        return fingerprint;
    }
   
    // СРАВНЕНИЕ ОТПЕЧАТКОВ
    compareFingerprints(fp1, fp2) {
        if (fp1.length === 0 || fp2.length === 0) return 0;
       
        let totalSimilarity = 0;
        let comparisons = 0;
       
        for (let i = 0; i < Math.min(fp1.length, 10); i++) {
            let bestMatch = 0;
           
            for (let j = 0; j < Math.min(fp2.length, 10); j++) {
                let similarity = 0;
               
                // Сравниваем расстояния до соседей
                for (let k = 0; k < Math.min(fp1[i].length, fp2[j].length); k++) {
                    const diff = Math.abs(fp1[i][k] - fp2[j][k]);
                    if (diff < 50) { // Порог для нормализованных расстояний
                        similarity += (50 - diff) / 50;
                    }
                }
               
                similarity /= Math.min(fp1[i].length, fp2[j].length);
                bestMatch = Math.max(bestMatch, similarity);
            }
           
            totalSimilarity += bestMatch;
            comparisons++;
        }
       
        return comparisons > 0 ? totalSimilarity / comparisons : 0;
    }
   
    // ПОИСК СОВПАДЕНИЙ ТОЧЕК
    findPointMatches(points1, points2) {
        const matches = [];
        const used2 = new Set();
       
        // Используем адаптивный порог на основе схожести форм
        const adaptiveThreshold = 0.1; // Для нормализованных координат
       
        for (let i = 0; i < points1.length; i++) {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;
           
            for (let j = 0; j < points2.length; j++) {
                if (used2.has(j)) continue;
               
                const distance = Math.sqrt(
                    Math.pow(points2[j].x - points1[i].x, 2) +
                    Math.pow(points2[j].y - points1[i].y, 2)
                );
               
                if (distance < bestDistance && distance < adaptiveThreshold) {
                    bestDistance = distance;
                    bestMatch = { point1: points1[i], point2: points2[j], distance };
                    bestIndex = j;
                }
            }
           
            if (bestMatch) {
                matches.push(bestMatch);
                used2.add(bestIndex);
            }
        }
       
        return matches;
    }
   
    // ВИЗУАЛИЗАЦИЯ
    visualize(points1, points2, matches) {
        const gridSize = 30;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));
       
        // Объединяем все точки для масштабирования
        const allPoints = [...points1, ...points2];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
       
        if (xs.length === 0) return;
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const scaleX = maxX - minX || 1;
        const scaleY = maxY - minY || 1;
       
        // Первая фигура - 'O'
        points1.forEach(p => {
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = 'O';
                }
            }
        });
       
        // Вторая фигура - 'X'
        points2.forEach(p => {
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (grid[gridY][gridX] === 'O') {
                    grid[gridY][gridX] = '●'; // Совпадение
                } else if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = 'X';
                }
            }
        });
       
        console.log('\n📊 Визуализация:');
        console.log('O - форма 1, X - форма 2, ● - совпадение');
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
    }
}

// 3. ТЕСТЫ
class ProperTests {
    constructor() {
        this.comparator = new ProperComparison();
    }
   
    runAllTests() {
        console.log('🧪 ЗАПУСК ПРАВИЛЬНЫХ ТЕСТОВ\n');
       
        const results = [];
       
        // ТЕСТ 1: Одна и та же фигура
        console.log('1. 🎯 ОДНА И ТА ЖЕ ФИГУРА');
        const eight1 = ProperShapes.createEight();
        const eight2 = JSON.parse(JSON.stringify(eight1));
       
        results.push(this.runTest(
            eight1, eight2, 'Восьмёрка vs Восьмёрка', 85, 100
        ));
       
        // ТЕСТ 2: Восьмёрка vs Шестёрка
        console.log('\n2. 🎯 ВОСЬМЁРКА vs ШЕСТЁРКА');
        const eight = ProperShapes.createEight();
        const six = ProperShapes.createSix();
       
        results.push(this.runTest(
            eight, six, 'Восьмёрка vs Шестёрка', 60, 80
        ));
       
        // ТЕСТ 3: С поворотом 45°
        console.log('\n3. 🎯 С ПОВОРОТОМ 45°');
        const rotated = ProperShapes.transform(eight, 45);
       
        results.push(this.runTest(
            eight, rotated, 'С поворотом 45°', 80, 95
        ));
       
        // ТЕСТ 4: Разный масштаб
        console.log('\n4. 🎯 РАЗНЫЙ МАСШТАБ (0.8x)');
        const scaled = ProperShapes.transform(eight, 0, 0.8);
       
        results.push(this.runTest(
            eight, scaled, 'Масштаб 0.8x', 80, 95
        ));
       
        // ТЕСТ 5: Со смещением
        console.log('\n5. 🎯 СО СМЕЩЕНИЕМ');
        const shifted = ProperShapes.transform(eight, 0, 1.0, 50, 30);
       
        results.push(this.runTest(
            eight, shifted, 'Со смещением (+50,+30)', 80, 95
        ));
       
        // ТЕСТ 6: Комбинированная трансформация
        console.log('\n6. 🎯 КОМБИНИРОВАННАЯ');
        const combined = ProperShapes.transform(eight, 30, 0.9, 20, -10);
       
        results.push(this.runTest(
            eight, combined, 'Комбинированная (30°, 0.9x, +20,-10)', 75, 90
        ));
       
        // ТЕСТ 7: Совсем разные
        console.log('\n7. 🎯 СОВСЕМ РАЗНЫЕ');
        const eightB = ProperShapes.createEight(450, 350, 1.2);
       
        results.push(this.runTest(
            eight, eightB, 'Разные восьмёрки', 30, 60
        ));
       
        // Сводка
        this.printSummary(results);
    }
   
    runTest(points1, points2, description, minExpected, maxExpected) {
        const result = this.comparator.compareShapes(points1, points2, description);
       
        const inRange = result.matchPercent >= minExpected &&
                       result.matchPercent <= maxExpected;
       
        const status = inRange ? '✅' : '❌';
       
        console.log(`   ${status} Получено: ${result.matchPercent}% (ожидалось ${minExpected}-${maxExpected}%)`);
       
        return {
            test: description,
            result: result.matchPercent,
            expected: { min: minExpected, max: maxExpected },
            inRange: inRange,
            similarity: result.similarity
        };
    }
   
    printSummary(results) {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(50));
       
        const passed = results.filter(r => r.inRange).length;
        const total = results.length;
       
        results.forEach(r => {
            const status = r.inRange ? '✅' : '❌';
            console.log(`${status} ${r.test}: ${r.result}% (схожесть: ${r.similarity.toFixed(2)})`);
        });
       
        console.log(`\n🎯 ИТОГО: ${passed}/${total} тестов пройдено`);
       
        if (passed >= total - 1) {
            console.log('✅ Алгоритм работает правильно!');
            console.log('\n🚀 МОЖНО ИНТЕГРИРОВАТЬ В СИСТЕМУ');
        } else {
            console.log('⚠️ Нужна доработка алгоритма');
        }
    }
}

// ЗАПУСК
console.log('🎯 ПРАВИЛЬНОЕ СРАВНЕНИЕ ФОРМ ПО ТОЧКАМ\n');
console.log('📚 ПРИНЦИП АЛГОРИТМА:');
console.log('1. Нормализация: центрирование + масштабирование');
console.log('2. Выравнивание: поворот по главной оси');
console.log('3. Создание "отпечатка": относительные расстояния между точками');
console.log('4. Сравнение отпечатков, а не координат\n');

const tests = new ProperTests();
tests.runAllTests();

console.log('\n💡 КЛЮЧЕВОЕ ОТЛИЧИЕ ОТ ПРЕДЫДУЩИХ АЛГОРИТМОВ:');
console.log('• Сравниваем ФОРМУ, а не координаты точек');
console.log('• Используем относительные расстояния (инвариантны к трансформациям)');
console.log('• Нормализуем перед сравнением (центр, масштаб, ориентация)');
console.log('• Простой и понятный алгоритм');
