// test-simple-comparison-fixed.js
console.log('🎯 ПРОСТОЙ И ПРАВИЛЬНЫЙ ТЕСТ СРАВНЕНИЯ\n');

// 🔧 ПРОСТОЙ ГЕНЕРАТОР ТОЧЕК
class SimplePointGenerator {
    // Создаем восьмёрку
    static createEight(centerX = 400, centerY = 300, numPoints = 32) {
        const points = [];
        const a = 100;  // Большая полуось
        const b = 60;   // Малая полуось
       
        for (let i = 0; i < numPoints; i++) {
            const t = (i / numPoints) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t);
            points.push({ x: Math.round(x), y: Math.round(y), id: `eight_${i}` });
        }
       
        return points;
    }
   
    // Создаем шестёрку (меньше точек, другая форма)
    static createSix(centerX = 400, centerY = 300, numPoints = 21) {
        const points = [];
        const a = 100;
        const b = 60;
       
        // Шестёрка - другая форма!
        for (let i = 0; i < numPoints; i++) {
            const t = (i / numPoints) * 2 * Math.PI;
            // ДРУГАЯ ФОРМУЛА - делаем её другой!
            const x = centerX + a * Math.cos(t);  // Используем cos вместо sin
            const y = centerY + b * Math.sin(3 * t) * 0.6; // Другой множитель
            points.push({ x: Math.round(x), y: Math.round(y), id: `six_${i}` });
        }
       
        return points;
    }
   
    // Применяем трансформации
    static transformPoints(points, options = {}) {
        const {
            angle = 0,
            scale = 1.0,
            offsetX = 0,
            offsetY = 0,
            noise = 0
        } = options;
       
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        // Находим центр
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        return points.map(p => {
            // Относительно центра
            let x = p.x - centerX;
            let y = p.y - centerY;
           
            // Поворот
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;
           
            // Масштаб
            x = rotatedX * scale;
            y = rotatedY * scale;
           
            // Возвращаем + смещение
            x += centerX + offsetX;
            y += centerY + offsetY;
           
            // Шум
            if (noise > 0) {
                x += (Math.random() - 0.5) * 2 * noise;
                y += (Math.random() - 0.5) * 2 * noise;
            }
           
            return {
                ...p,
                x: Math.round(x),
                y: Math.round(y),
                originalId: p.id,
                id: `${p.id}_transformed`
            };
        });
    }
}

// 🔍 ПРАВИЛЬНЫЙ АНАЛИЗАТОР - ОДИН К ОДНОМУ!
class CorrectAnalyzer {
    // Основной метод сравнения - ТОЧНО ОДИН К ОДНОМУ
    findOneToOneMatches(points1, points2, maxDistance = 25) {
        console.log(`\n🔍 Ищем совпадения 1:1 (макс. расстояние: ${maxDistance}px)`);
        console.log(`   Всего точек: ${points1.length} vs ${points2.length}`);
       
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Создаем все возможные пары
        const allPairs = [];
       
        for (let i = 0; i < points1.length; i++) {
            for (let j = 0; j < points2.length; j++) {
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance <= maxDistance) {
                    allPairs.push({
                        i, j, distance,
                        point1: points1[i],
                        point2: points2[j]
                    });
                }
            }
        }
       
        // Сортируем пары по расстоянию (от ближайших к дальним)
        allPairs.sort((a, b) => a.distance - b.distance);
       
        // Выбираем лучшие пары - КАЖДАЯ ТОЧКА ТОЛЬКО ОДИН РАЗ!
        for (const pair of allPairs) {
            if (!used1.has(pair.i) && !used2.has(pair.j)) {
                matches.push({
                    point1: pair.point1,
                    point2: pair.point2,
                    distance: pair.distance
                });
                used1.add(pair.i);
                used2.add(pair.j);
               
                // Останавливаемся, когда все точки одного из наборов использованы
                if (used1.size >= Math.min(points1.length, points2.length)) {
                    break;
                }
            }
        }
       
        // Несовпавшие точки
        const unmatched1 = points1.filter((_, i) => !used1.has(i));
        const unmatched2 = points2.filter((_, j) => !used2.has(j));
       
        return {
            matches,
            unmatched1,
            unmatched2,
            matchCount: matches.length,
            matchPercentage: (matches.length / Math.min(points1.length, points2.length) * 100).toFixed(1),
            usedPoints1: used1.size,
            usedPoints2: used2.size
        };
    }
   
    // Нормализация с выравниванием
    normalizeAndAlign(points) {
        if (points.length < 3) return points;
       
        // 1. Центрируем
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        let centered = points.map(p => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        // 2. Выравниваем по главной оси (PCA упрощенно)
        if (centered.length >= 3) {
            const angle = this.calculateRotationAngle(centered);
            centered = this.rotatePoints(centered, -angle);
        }
       
        // 3. Масштабируем
        const maxDist = Math.max(...centered.map(p => Math.sqrt(p.x * p.x + p.y * p.y)));
        if (maxDist > 0) {
            const scale = 100 / maxDist;
            centered = centered.map(p => ({
                ...p,
                x: p.x * scale,
                y: p.y * scale
            }));
        }
       
        return centered;
    }
   
    calculateRotationAngle(points) {
        // Упрощенный PCA - находим угол главной оси
        let sumXX = 0, sumYY = 0, sumXY = 0;
       
        for (const p of points) {
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        }
       
        const n = points.length;
        const angle = 0.5 * Math.atan2(2 * sumXY / n, sumXX / n - sumYY / n);
        return angle * 180 / Math.PI; // в градусах
    }
   
    rotatePoints(points, angleDeg) {
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return points.map(p => ({
            ...p,
            x: p.x * cosA - p.y * sinA,
            y: p.x * sinA + p.y * cosA
        }));
    }
   
    // Визуализация
    visualizeComparison(points1, points2, matches, title) {
        console.log(`\n📊 ${title}`);
       
        const gridWidth = 40;
        const gridHeight = 20;
        const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(' '));
       
        // Находим границы
        const allPoints = [...points1, ...points2];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Функция преобразования
        const toGrid = (x, y) => ({
            x: Math.floor((x - minX) / (maxX - minX) * (gridWidth - 1)),
            y: Math.floor((y - minY) / (maxY - minY) * (gridHeight - 1))
        });
       
        // Отмечаем совпадения
        matches.forEach(match => {
            const pos1 = toGrid(match.point1.x, match.point1.y);
            const pos2 = toGrid(match.point2.x, match.point2.y);
           
            // Средняя позиция
            const avgX = Math.floor((pos1.x + pos2.x) / 2);
            const avgY = Math.floor((pos1.y + pos2.y) / 2);
           
            if (avgX >= 0 && avgX < gridWidth && avgY >= 0 && avgY < gridHeight) {
                grid[avgY][avgX] = '●';
            }
        });
       
        // Отмечаем несовпавшие точки первого набора
        points1.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'O';
                }
            }
        });
       
        // Отмечаем несовпавшие точки второго набора
        points2.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'X';
                }
            }
        });
       
        // Выводим
        console.log('Легенда: ●=совпадение, O=набор1, X=набор2');
        console.log('┌' + '─'.repeat(gridWidth) + '┐');
        for (let y = 0; y < gridHeight; y++) {
            let row = '│';
            for (let x = 0; x < gridWidth; x++) {
                row += grid[y][x];
            }
            row += '│';
            console.log(row);
        }
        console.log('└' + '─'.repeat(gridWidth) + '┘');
    }
   
    // Статистика
    printStats(result, testName) {
        console.log('\n📈 СТАТИСТИКА:');
        console.log('='.repeat(40));
        console.log(`✅ Совпадений: ${result.matchCount} точек (1:1)`);
        console.log(`📊 Процент совпадений: ${result.matchPercentage}%`);
        console.log(`📊 Использовано точек из набора 1: ${result.usedPoints1}/${result.unmatched1.length + result.usedPoints1}`);
        console.log(`📊 Использовано точек из набора 2: ${result.usedPoints2}/${result.unmatched2.length + result.usedPoints2}`);
        console.log(`❌ Не совпало в первом наборе: ${result.unmatched1.length} точек`);
        console.log(`❌ Не совпало во втором наборе: ${result.unmatched2.length} точек`);
       
        if (result.matches.length > 0) {
            const distances = result.matches.map(m => m.distance);
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            const minDistance = Math.min(...distances);
            const maxDistance = Math.max(...distances);
           
            console.log(`📏 Среднее расстояние: ${avgDistance.toFixed(1)}px`);
            console.log(`📏 Минимальное расстояние: ${minDistance.toFixed(1)}px`);
            console.log(`📏 Максимальное расстояние: ${maxDistance.toFixed(1)}px`);
           
            // Примеры
            console.log('\n🎯 Примеры совпадений:');
            for (let i = 0; i < Math.min(3, result.matches.length); i++) {
                const match = result.matches[i];
                console.log(`   ${i+1}. Точка ${match.point1.id} ↔ ${match.point2.id}`);
                console.log(`      (${match.point1.x},${match.point1.y}) ↔ (${match.point2.x},${match.point2.y})`);
                console.log(`      Расстояние: ${match.distance.toFixed(1)}px`);
            }
        }
       
        // Ожидаемые значения для разных тестов
        const expectations = {
            'Восьмёрка vs Шестёрка': { min: 40, max: 65 },
            'Один и тот же след': { min: 95, max: 100 },
            'С поворотом': { min: 70, max: 90 },
            'С нормализацией': { min: 80, max: 95 },
            'Разный масштаб': { min: 60, max: 85 },
            'С шумом': { min: 70, max: 90 },
            'Комбинированная трансформация': { min: 60, max: 85 }
        };
       
        const expected = expectations[testName];
        if (expected) {
            const percentage = parseFloat(result.matchPercentage);
            const isPassed = percentage >= expected.min && percentage <= expected.max;
           
            console.log(`\n${isPassed ? '✅' : '❌'} ${testName}: ${percentage}% (ожидалось ${expected.min}-${expected.max}%)`);
           
            if (!isPassed) {
                if (percentage < expected.min) {
                    console.log(`   🔧 Совет: Увеличьте maxDistance`);
                } else {
                    console.log(`   🔧 Совет: Уменьшите maxDistance для большей строгости`);
                }
            }
           
            return isPassed;
        }
       
        return null;
    }
}

// 🧪 ТЕСТОВЫЙ РАННЕР
class CorrectTestRunner {
    constructor() {
        this.analyzer = new CorrectAnalyzer();
        this.results = [];
    }
   
    async runTests() {
        console.log('🧪 ЗАПУСК ПРАВИЛЬНЫХ ТЕСТОВ 1:1\n');
       
        // Тест 1: РАЗНЫЕ ФИГУРЫ
        console.log('1. 🎯 РАЗНЫЕ ФИГУРЫ (восьмёрка vs шестёрка)');
        const eight = SimplePointGenerator.createEight(400, 300, 32);
        const six = SimplePointGenerator.createSix(400, 300, 21);
       
        let result = this.analyzer.findOneToOneMatches(eight, six, 30);
        this.analyzer.visualizeComparison(eight, six, result.matches, 'Восьмёрка vs Шестёрка (1:1)');
        const passed1 = this.analyzer.printStats(result, 'Восьмёрка vs Шестёрка');
        this.results.push({ name: 'Разные фигуры', passed: passed1, percentage: result.matchPercentage });
       
        // Тест 2: ОДИН И ТОТ ЖЕ СЛЕД
        console.log('\n\n2. 🎯 ОДИН И ТОТ ЖЕ СЛЕД');
        const sameEight = SimplePointGenerator.createEight(400, 300, 32);
        const sameEightCopy = JSON.parse(JSON.stringify(sameEight));
       
        result = this.analyzer.findOneToOneMatches(sameEight, sameEightCopy, 5);
        this.analyzer.visualizeComparison(sameEight, sameEightCopy, result.matches, 'Один и тот же след (1:1)');
        const passed2 = this.analyzer.printStats(result, 'Один и тот же след');
        this.results.push({ name: 'Один след', passed: passed2, percentage: result.matchPercentage });
       
        // Тест 3: С ПОВОРОТОМ (без нормализации)
        console.log('\n\n3. 🎯 С ПОВОРОТОМ 45° (без нормализации)');
        const rotatedEight = SimplePointGenerator.transformPoints(eight, { angle: 45 });
       
        result = this.analyzer.findOneToOneMatches(eight, rotatedEight, 40);
        this.analyzer.visualizeComparison(eight, rotatedEight, result.matches, 'С поворотом 45° (1:1)');
        const passed3 = this.analyzer.printStats(result, 'С поворотом');
        this.results.push({ name: 'Поворот 45°', passed: passed3, percentage: result.matchPercentage });
       
        // Тест 4: С ПОВОРОТОМ (с нормализацией)
        console.log('\n\n4. 🎯 С ПОВОРОТОМ 45° (С НОРМАЛИЗАЦИЕЙ)');
        const normalizedEight = this.analyzer.normalizeAndAlign(eight);
        const normalizedRotated = this.analyzer.normalizeAndAlign(rotatedEight);
       
        result = this.analyzer.findOneToOneMatches(normalizedEight, normalizedRotated, 15);
        this.analyzer.visualizeComparison(normalizedEight, normalizedRotated, result.matches, 'С нормализацией (1:1)');
        const passed4 = this.analyzer.printStats(result, 'С нормализацией');
        this.results.push({ name: 'С нормализацией', passed: passed4, percentage: result.matchPercentage });
       
        // Тест 5: РАЗНЫЙ МАСШТАБ
        console.log('\n\n5. 🎯 РАЗНЫЙ МАСШТАБ (0.7x)');
        const scaledEight = SimplePointGenerator.transformPoints(eight, { scale: 0.7 });
       
        result = this.analyzer.findOneToOneMatches(eight, scaledEight, 35);
        this.analyzer.visualizeComparison(eight, scaledEight, result.matches, 'Разный масштаб (1:1)');
        const passed5 = this.analyzer.printStats(result, 'Разный масштаб');
        this.results.push({ name: 'Разный масштаб', passed: passed5, percentage: result.matchPercentage });
       
        // Тест 6: С ШУМОМ
        console.log('\n\n6. 🎯 С ШУМОМ (±15px)');
        const noisyEight = SimplePointGenerator.transformPoints(eight, { noise: 15 });
       
        result = this.analyzer.findOneToOneMatches(eight, noisyEight, 25);
        this.analyzer.visualizeComparison(eight, noisyEight, result.matches, 'С шумом (1:1)');
        const passed6 = this.analyzer.printStats(result, 'С шумом');
        this.results.push({ name: 'С шумом', passed: passed6, percentage: result.matchPercentage });
       
        // Тест 7: КОМБИНИРОВАННАЯ ТРАНСФОРМАЦИЯ
        console.log('\n\n7. 🎯 КОМБИНИРОВАННАЯ ТРАНСФОРМАЦИЯ');
        const transformedEight = SimplePointGenerator.transformPoints(eight, {
            angle: 30,
            scale: 1.2,
            offsetX: 50,
            offsetY: -30,
            noise: 10
        });
       
        result = this.analyzer.findOneToOneMatches(eight, transformedEight, 40);
        this.analyzer.visualizeComparison(eight, transformedEight, result.matches, 'Комбинированная (1:1)');
        const passed7 = this.analyzer.printStats(result, 'Комбинированная трансформация');
        this.results.push({ name: 'Комбинированная', passed: passed7, percentage: result.matchPercentage });
       
        // Итоговый отчет
        this.printSummary();
    }
   
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 ИТОГОВЫЙ ОТЧЕТ - ПРАВИЛЬНЫЙ АЛГОРИТМ 1:1');
        console.log('='.repeat(60));
       
        const passed = this.results.filter(r => r.passed === true).length;
        const total = this.results.length;
       
        console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТОВ:');
        console.log('─'.repeat(60));
       
        this.results.forEach((result, index) => {
            const status = result.passed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН';
            console.log(`${index + 1}. ${result.name.padEnd(25)} ${result.percentage}% ${status}`);
        });
       
        console.log('\n' + '─'.repeat(60));
        console.log(`🎯 ИТОГО: ${passed}/${total} тестов пройдено (${((passed/total)*100).toFixed(1)}%)`);
       
        if (passed >= total * 0.8) {
            console.log('\n✅ ОТЛИЧНО! Алгоритм работает корректно.');
            console.log('🚀 Алгоритм готов к внедрению в систему!');
        } else {
            console.log('\n⚠️ Требуется настройка параметров.');
            console.log('🔧 Рекомендуемые настройки:');
            console.log('   • Для разных фигур: maxDistance = 25-35px');
            console.log('   • Для одинаковых следов: maxDistance = 5-10px');
            console.log('   • Всегда используйте нормализацию для поворотов');
        }
       
        console.log('\n💡 КЛЮЧЕВЫЕ ПРИНЦИПЫ:');
        console.log('   1. ✅ Сопоставление 1:1 - каждая точка только один раз');
        console.log('   2. ✅ Сортируем по расстоянию - ближайшие точки в первую очередь');
        console.log('   3. ✅ Нормализация для обработки поворотов и масштаба');
        console.log('   4. ✅ Подбирайте maxDistance под ваши данные');
       
        console.log('\n📝 ДЛЯ ВАШЕЙ СИСТЕМЫ:');
        console.log('   Используйте этот алгоритм для обновления подтверждений точек:');
        console.log('   • Красные точки (2+ подтверждений) = совпавшие точки');
        console.log('   • Синие точки (1 подтверждение) = несовпавшие точки');
    }
}

// 🚀 ЗАПУСК ТЕСТОВ
async function main() {
    console.log('🎯 ПРАВИЛЬНЫЙ ТЕСТ СРАВНЕНИЯ СЛЕДОВ 1:1\n');
    console.log('📚 Решает проблему "слишком лояльного" алгоритма\n');
   
    try {
        const testRunner = new CorrectTestRunner();
        await testRunner.runTests();
       
        console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
       
    } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
        console.error(error.stack);
    }
}

// Запуск
if (require.main === module) {
    main().catch(console.error);
}

// Экспорт для системы
module.exports = {
    SimplePointGenerator,
    CorrectAnalyzer,
    CorrectTestRunner
};
