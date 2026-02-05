// test-simple-comparison.js
console.log('🎯 ПРОСТОЙ ТЕСТ СРАВНЕНИЯ СЛЕДОВ\n');

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
   
    // Создаем шестёрку (меньше точек, немного другая форма)
    static createSix(centerX = 400, centerY = 300, numPoints = 21) {
        const points = [];
        const a = 100;
        const b = 60;
       
        for (let i = 0; i < numPoints; i++) {
            const t = (i / numPoints) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t) * 0.8; // Чуть другая форма
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

// 🔍 ПРОСТОЙ АНАЛИЗАТОР
class SimpleAnalyzer {
    // Основной метод сравнения - ИЩЕМ ТОЧНЫЕ СОВПАДЕНИЯ
    findMatches(points1, points2, maxDistance = 25) {
        console.log(`\n🔍 Ищем совпадения (макс. расстояние: ${maxDistance}px)`);
        console.log(`   Всего точек: ${points1.length} vs ${points2.length}`);
       
        const matches = [];
        const unmatched1 = [...points1];
        const unmatched2 = [...points2];
       
        // Для каждой точки в первом наборе ищем ближайшую во втором
        for (let i = 0; i < points1.length; i++) {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestIndex = -1;
           
            for (let j = 0; j < points2.length; j++) {
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance && distance < maxDistance) {
                    minDistance = distance;
                    bestMatch = points2[j];
                    bestIndex = j;
                }
            }
           
            if (bestMatch) {
                matches.push({
                    point1: points1[i],
                    point2: bestMatch,
                    distance: minDistance,
                    index1: i,
                    index2: bestIndex
                });
               
                // Убираем из списка несовпавших
                unmatched1[i] = null;
                unmatched2[bestIndex] = null;
            }
        }
       
        // Фильтруем null значения
        const finalUnmatched1 = unmatched1.filter(p => p !== null);
        const finalUnmatched2 = unmatched2.filter(p => p !== null);
       
        return {
            matches,
            unmatched1: finalUnmatched1,
            unmatched2: finalUnmatched2,
            matchCount: matches.length,
            matchPercentage: (matches.length / Math.min(points1.length, points2.length) * 100).toFixed(1)
        };
    }
   
    // Выравнивание перед сравнением (простое центрирование и масштабирование)
    normalizePoints(points) {
        if (points.length < 2) return points;
       
        // Центрируем
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        const centered = points.map(p => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        // Масштабируем к стандартному размеру
        const maxDistance = Math.max(
            ...centered.map(p => Math.sqrt(p.x * p.x + p.y * p.y))
        );
       
        if (maxDistance === 0) return centered;
       
        const scale = 100 / maxDistance; // Приводим к радиусу 100px
       
        return centered.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale
        }));
    }
   
    // Визуализация в консоли
    visualizeComparison(points1, points2, matches, title) {
        console.log(`\n📊 ${title}`);
       
        // Создаем простую сетку 40x20
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
       
        // Функция преобразования координат
        const toGrid = (x, y) => ({
            x: Math.floor((x - minX) / (maxX - minX) * (gridWidth - 1)),
            y: Math.floor((y - minY) / (maxY - minY) * (gridHeight - 1))
        });
       
        // Отмечаем совпадения красным ●
        matches.forEach(match => {
            const pos1 = toGrid(match.point1.x, match.point1.y);
            const pos2 = toGrid(match.point2.x, match.point2.y);
           
            // Средняя позиция для отображения совпадения
            const avgX = Math.floor((pos1.x + pos2.x) / 2);
            const avgY = Math.floor((pos1.y + pos2.y) / 2);
           
            if (avgX >= 0 && avgX < gridWidth && avgY >= 0 && avgY < gridHeight) {
                grid[avgY][avgX] = '●';
            }
        });
       
        // Отмечаем точки первого набора синим O
        points1.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'O';
                }
            }
        });
       
        // Отмечаем точки второго набора зелёным X
        points2.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'X';
                }
            }
        });
       
        // Выводим сетку
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
    printStats(result) {
        console.log('\n📈 СТАТИСТИКА:');
        console.log('='.repeat(40));
        console.log(`✅ Совпадений: ${result.matchCount} точек`);
        console.log(`📊 Процент совпадений: ${result.matchPercentage}%`);
        console.log(`❌ Не совпало в первом наборе: ${result.unmatched1.length} точек`);
        console.log(`❌ Не совпало во втором наборе: ${result.unmatched2.length} точек`);
       
        if (result.matches.length > 0) {
            const avgDistance = result.matches.reduce((sum, m) => sum + m.distance, 0) / result.matches.length;
            const minDistance = Math.min(...result.matches.map(m => m.distance));
            const maxDistance = Math.max(...result.matches.map(m => m.distance));
           
            console.log(`📏 Среднее расстояние: ${avgDistance.toFixed(1)}px`);
            console.log(`📏 Минимальное расстояние: ${minDistance.toFixed(1)}px`);
            console.log(`📏 Максимальное расстояние: ${maxDistance.toFixed(1)}px`);
           
            // Примеры совпадений
            console.log('\n🎯 Примеры совпадений:');
            for (let i = 0; i < Math.min(3, result.matches.length); i++) {
                const match = result.matches[i];
                console.log(`   ${i+1}. Точки: (${match.point1.x},${match.point1.y}) ↔ (${match.point2.x},${match.point2.y})`);
                console.log(`      Расстояние: ${match.distance.toFixed(1)}px`);
            }
        }
    }
}

// 🧪 ТЕСТОВЫЙ РАННЕР
class SimpleTestRunner {
    constructor() {
        this.analyzer = new SimpleAnalyzer();
    }
   
    async runTests() {
        console.log('🧪 ЗАПУСК ПРОСТЫХ ТЕСТОВ\n');
       
        // Тест 1: Восьмёрка vs Шестёрка (без трансформаций)
        console.log('1. 🎯 ТЕСТ: ВОСЬМЁРКА vs ШЕСТЁРКА');
        const eight = SimplePointGenerator.createEight(400, 300, 32);
        const six = SimplePointGenerator.createSix(400, 300, 21);
       
        let result = this.analyzer.findMatches(eight, six, 30);
        this.analyzer.visualizeComparison(eight, six, result.matches, 'Восьмёрка vs Шестёрка');
        this.analyzer.printStats(result);
       
        this.evaluateTest("Восьмёрка vs Шестёрка", result.matchPercentage, 60, 80);
       
        // Тест 2: Один и тот же след
        console.log('\n\n2. 🎯 ТЕСТ: ОДИН И ТОТ ЖЕ СЛЕД');
        const sameEight = SimplePointGenerator.createEight(400, 300, 32);
        const sameEightCopy = JSON.parse(JSON.stringify(sameEight));
       
        result = this.analyzer.findMatches(sameEight, sameEightCopy, 5);
        this.analyzer.visualizeComparison(sameEight, sameEightCopy, result.matches, 'Один и тот же след');
        this.analyzer.printStats(result);
       
        this.evaluateTest("Один и тот же след", result.matchPercentage, 95, 100);
       
        // Тест 3: С поворотом
        console.log('\n\n3. 🎯 ТЕСТ: С ПОВОРОТОМ 45°');
        const rotatedEight = SimplePointGenerator.transformPoints(eight, { angle: 45 });
       
        result = this.analyzer.findMatches(eight, rotatedEight, 30);
        this.analyzer.visualizeComparison(eight, rotatedEight, result.matches, 'Восьмёрка vs Повёрнутая восьмёрка');
        this.analyzer.printStats(result);
       
        this.evaluateTest("С поворотом 45°", result.matchPercentage, 70, 90);
       
        // Тест 4: С нормализацией
        console.log('\n\n4. 🎯 ТЕСТ: С НОРМАЛИЗАЦИЕЙ');
        const normalizedEight = this.analyzer.normalizePoints(eight);
        const normalizedRotated = this.analyzer.normalizePoints(rotatedEight);
       
        result = this.analyzer.findMatches(normalizedEight, normalizedRotated, 15);
        this.analyzer.visualizeComparison(normalizedEight, normalizedRotated, result.matches, 'Нормализованные следы');
        this.analyzer.printStats(result);
       
        this.evaluateTest("С нормализацией", result.matchPercentage, 80, 95);
       
        // Тест 5: Разные масштабы
        console.log('\n\n5. 🎯 ТЕСТ: РАЗНЫЙ МАСШТАБ');
        const scaledEight = SimplePointGenerator.transformPoints(eight, { scale: 0.7 });
       
        result = this.analyzer.findMatches(eight, scaledEight, 40);
        this.analyzer.visualizeComparison(eight, scaledEight, result.matches, 'Разный масштаб (1.0x vs 0.7x)');
        this.analyzer.printStats(result);
       
        this.evaluateTest("Разный масштаб", result.matchPercentage, 60, 85);
       
        // Тест 6: С шумом
        console.log('\n\n6. 🎯 ТЕСТ: С ШУМОМ');
        const noisyEight = SimplePointGenerator.transformPoints(eight, { noise: 15 });
       
        result = this.analyzer.findMatches(eight, noisyEight, 25);
        this.analyzer.visualizeComparison(eight, noisyEight, result.matches, 'С шумом ±15px');
        this.analyzer.printStats(result);
       
        this.evaluateTest("С шумом", result.matchPercentage, 70, 90);
       
        // Тест 7: Комбинированная трансформация
        console.log('\n\n7. 🎯 ТЕСТ: КОМБИНИРОВАННАЯ ТРАНСФОРМАЦИЯ');
        const transformedEight = SimplePointGenerator.transformPoints(eight, {
            angle: 30,
            scale: 1.2,
            offsetX: 50,
            offsetY: -30,
            noise: 10
        });
       
        result = this.analyzer.findMatches(eight, transformedEight, 35);
        this.analyzer.visualizeComparison(eight, transformedEight, result.matches, 'Комбинированная трансформация');
        this.analyzer.printStats(result);
       
        this.evaluateTest("Комбинированная трансформация", result.matchPercentage, 60, 85);
       
        // Итоговый отчет
        this.printSummary();
    }
   
    evaluateTest(name, percentage, minExpected, maxExpected) {
        const percentNum = parseFloat(percentage);
        const isPassed = percentNum >= minExpected && percentNum <= maxExpected;
       
        console.log(`\n${isPassed ? '✅' : '❌'} ${name}: ${percentage}% ` +
                   `(ожидалось ${minExpected}-${maxExpected}%)`);
       
        if (!isPassed) {
            if (percentNum < minExpected) {
                console.log(`   🔧 Совет: Увеличьте maxDistance или используйте нормализацию`);
            } else {
                console.log(`   🔧 Совет: Уменьшите maxDistance для большей строгости`);
            }
        }
       
        return isPassed;
    }
   
    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('🎯 ИТОГОВЫЙ ОТЧЕТ');
        console.log('='.repeat(50));
        console.log('📚 ЧТО МЫ ПРОВЕРИЛИ:');
        console.log('   1. Сравнение разных фигур (восьмёрка vs шестёрка)');
        console.log('   2. Сравнение одинаковых фигур');
        console.log('   3. Устойчивость к поворотам');
        console.log('   4. Эффективность нормализации');
        console.log('   5. Устойчивость к масштабированию');
        console.log('   6. Устойчивость к шуму');
        console.log('   7. Комбинированные трансформации');
        console.log('\n💡 КЛЮЧЕВЫЕ ВЫВОДЫ:');
        console.log('   • Нормализация улучшает результаты при поворотах');
        console.log('   • MaxDistance нужно подбирать под ваши данные');
        console.log('   • Разные фигуры должны показывать ~60-80% совпадений');
        console.log('   • Одинаковые фигуры должны показывать ~95-100%');
        console.log('\n🚀 ДЛЯ ВНЕДРЕНИЯ В СИСТЕМУ:');
        console.log('   1. Используйте метод findMatches() для сравнения');
        console.log('   2. Подберите оптимальный maxDistance (25-35px)');
        console.log('   3. Используйте normalizePoints() для устойчивости к трансформациям');
        console.log('   4. Визуализируйте результаты для отладки');
    }
}

// 🚀 ЗАПУСК ТЕСТОВ
async function main() {
    console.log('🎯 ПРОСТОЙ ТЕСТ СРАВНЕНИЯ СЛЕДОВ\n');
    console.log('📚 Цель: Понять, как работает базовое сравнение точек\n');
   
    try {
        const testRunner = new SimpleTestRunner();
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

// Экспорт для использования в системе
module.exports = {
    SimplePointGenerator,
    SimpleAnalyzer,
    SimpleTestRunner
};
