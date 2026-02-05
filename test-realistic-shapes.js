// test-realistic-shapes.js
console.log('🎯 ТЕСТ С РЕАЛИСТИЧНЫМИ ФОРМАМИ СЛЕДОВ\n');

class RealisticShapeTest {
    constructor() {
        this.debug = true;
    }
   
    // 1. Создаем реальную форму следа (овал с протектором)
    createRealShoePrint(centerX = 400, centerY = 300, scale = 1.0, isDetailed = true) {
        const points = [];
       
        // Параметры следа
        const length = 250 * scale;    // Длина следа
        const width = 100 * scale;     // Ширина следа
        const heelWidth = 80 * scale;  // Ширина пятки
       
        // Основной овал (контур)
        const pointCount = isDetailed ? 24 : 12;
        for (let i = 0; i < pointCount; i++) {
            const angle = (i / pointCount) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * width / 2;
            const y = centerY + Math.sin(angle) * length / 2 * (1 - 0.3 * Math.cos(angle));
            points.push({ x: Math.round(x), y: Math.round(y), type: 'contour' });
        }
       
        // Протектор (внутренние точки)
        if (isDetailed) {
            // Пятка
            for (let i = 0; i < (isDetailed ? 8 : 4); i++) {
                const angle = Math.PI + (i / 8) * Math.PI;
                const x = centerX + Math.cos(angle) * heelWidth / 3;
                const y = centerY - length / 3 + Math.sin(angle) * heelWidth / 4;
                points.push({ x: Math.round(x), y: Math.round(y), type: 'tread_heel' });
            }
           
            // Середина
            for (let i = 0; i < (isDetailed ? 6 : 3); i++) {
                const x = centerX + (Math.random() - 0.5) * width / 3;
                const y = centerY + (Math.random() - 0.5) * length / 4;
                points.push({ x: Math.round(x), y: Math.round(y), type: 'tread_mid' });
            }
           
            // Носок
            for (let i = 0; i < (isDetailed ? 10 : 5); i++) {
                const angle = (i / 10) * Math.PI;
                const x = centerX + Math.cos(angle) * width / 2.5;
                const y = centerY + length / 3 + Math.sin(angle) * width / 3;
                points.push({ x: Math.round(x), y: Math.round(y), type: 'tread_toe' });
            }
        }
       
        console.log(`👣 Создан ${isDetailed ? 'детализированный' : 'упрощенный'} след: ${points.length} точек`);
        return points;
    }
   
    // 2. Алгоритм сравнения с порогами
    compareWithThresholds(points1, points2, description) {
        console.log(`\n🔍 ${description}`);
        console.log(`   Форма 1: ${points1.length} точек, Форма 2: ${points2.length} точек`);
       
        // Нормализация
        const norm1 = this.normalizePoints(points1);
        const norm2 = this.normalizePoints(points2);
       
        // Выравнивание
        const aligned1 = this.alignToPrincipalAxis(norm1);
        const aligned2 = this.alignToPrincipalAxis(norm2);
       
        // Поиск совпадений с разными порогами
        const thresholds = [0.1, 0.15, 0.2, 0.25, 0.3];
        const results = [];
       
        for (const threshold of thresholds) {
            const matches = this.findOneToOneMatches(aligned1, aligned2, threshold);
            const percentage = (matches.length / Math.min(points1.length, points2.length) * 100).toFixed(1);
           
            results.push({
                threshold,
                matches: matches.length,
                percentage,
                avgDistance: matches.length > 0
                    ? (matches.reduce((sum, m) => sum + m.distance, 0) / matches.length).toFixed(3)
                    : 0
            });
        }
       
        // Вывод результатов
        console.log(`   Результаты с разными порогами расстояния:`);
        results.forEach(r => {
            console.log(`   • Порог ${r.threshold}: ${r.matches} совпадений (${r.percentage}%), среднее расстояние: ${r.avgDistance}`);
        });
       
        // Выбираем оптимальный результат
        const optimal = results.find(r => r.percentage >= 60 && r.percentage <= 90) || results[2];
        console.log(`   🎯 Оптимальный результат: порог ${optimal.threshold}, ${optimal.percentage}% совпадений`);
       
        return optimal;
    }
   
    // 3. Вспомогательные методы (те же что в предыдущем алгоритме)
    normalizePoints(points) {
        if (points.length === 0) return points;
       
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        const centered = points.map(p => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        const maxDistance = Math.max(
            ...centered.map(p => Math.sqrt(p.x * p.x + p.y * p.y))
        );
       
        if (maxDistance === 0) return centered;
       
        const scale = 1.0 / maxDistance;
        return centered.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale
        }));
    }
   
    findPrincipalAxis(points) {
        if (points.length < 2) return 0;
       
        let sumXX = 0, sumYY = 0, sumXY = 0;
        for (const p of points) {
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        }
       
        const n = points.length;
        const angleRad = 0.5 * Math.atan2(2 * sumXY / n, sumXX / n - sumYY / n);
        return angleRad * 180 / Math.PI;
    }
   
    alignToPrincipalAxis(points) {
        const currentAngle = this.findPrincipalAxis(points);
        return this.rotatePoints(points, -currentAngle);
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
   
    findOneToOneMatches(points1, points2, maxDistance = 0.2) {
        const maxMatches = Math.min(points1.length, points2.length);
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Все пары
        const allPairs = [];
        for (let i = 0; i < points1.length; i++) {
            for (let j = 0; j < points2.length; j++) {
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                allPairs.push({
                    i, j,
                    distance: Math.sqrt(dx * dx + dy * dy)
                });
            }
        }
       
        // Сортируем и выбираем
        allPairs.sort((a, b) => a.distance - b.distance);
       
        for (const pair of allPairs) {
            if (used1.has(pair.i) || used2.has(pair.j)) continue;
            if (pair.distance > maxDistance) continue;
           
            matches.push({
                point1: points1[pair.i],
                point2: points2[pair.j],
                distance: pair.distance
            });
           
            used1.add(pair.i);
            used2.add(pair.j);
           
            if (matches.length >= maxMatches) break;
        }
       
        return matches;
    }
   
    // 4. Тест с различными сценариями
    runRealisticTests() {
        console.log('🧪 ЗАПУСК РЕАЛИСТИЧНЫХ ТЕСТОВ:\n');
       
        // Сценарий 1: Один и тот же след (должно быть 85-95% совпадений)
        console.log('1. 🎯 СЦЕНАРИЙ 1: ОДИН И ТОТ ЖЕ СЛЕД');
        const samePrint = this.createRealShoePrint(400, 300, 1.0, true);
        const samePrintCopy = JSON.parse(JSON.stringify(samePrint)); // Копия
       
        const test1 = this.compareWithThresholds(
            samePrint,
            samePrintCopy,
            "Сравнение следа с его копией"
        );
       
        // Сценарий 2: Детализированный vs упрощенный (должно быть 60-80%)
        console.log('\n2. 🎯 СЦЕНАРИЙ 2: ДЕТАЛИЗИРОВАННЫЙ vs УПРОЩЕННЫЙ');
        const detailedPrint = this.createRealShoePrint(400, 300, 1.0, true);
        const simplePrint = this.createRealShoePrint(400, 300, 1.0, false);
       
        const test2 = this.compareWithThresholds(
            detailedPrint,
            simplePrint,
            "Детализированный след vs упрощенный"
        );
       
        // Сценарий 3: С поворотом 45°
        console.log('\n3. 🎯 СЦЕНАРИЙ 3: С ПОВОРОТОМ 45°');
        const rotatedPrint = this.rotatePoints(
            this.createRealShoePrint(400, 300, 1.0, true),
            45
        );
       
        const test3 = this.compareWithThresholds(
            detailedPrint,
            rotatedPrint,
            "Оригинальный след vs повернутый на 45°"
        );
       
        // Сценарий 4: С другим масштабом
        console.log('\n4. 🎯 СЦЕНАРИЙ 4: РАЗНЫЙ МАСШТАБ');
        const scaledPrint = this.createRealShoePrint(400, 300, 0.8, true);
       
        const test4 = this.compareWithThresholds(
            detailedPrint,
            scaledPrint,
            "Масштаб 1.0x vs 0.8x"
        );
       
        // Сценарий 5: Разные следы (должно быть 30-50%)
        console.log('\n5. 🎯 СЦЕНАРИЙ 5: РАЗНЫЕ СЛЕДЫ');
        const print1 = this.createRealShoePrint(400, 300, 1.0, true);
        const print2 = this.createRealShoePrint(450, 320, 0.9, true); // Другой след
       
        const test5 = this.compareWithThresholds(
            print1,
            print2,
            "Два разных следа"
        );
       
        // Сводный отчет
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        const tests = [
            { name: 'Один и тот же след', result: test1, expected: { min: 85, max: 95 } },
            { name: 'Детализированный vs упрощенный', result: test2, expected: { min: 60, max: 80 } },
            { name: 'С поворотом 45°', result: test3, expected: { min: 80, max: 90 } },
            { name: 'Разный масштаб (0.8x)', result: test4, expected: { min: 80, max: 90 } },
            { name: 'Разные следы', result: test5, expected: { min: 30, max: 50 } }
        ];
       
        let passed = 0;
        tests.forEach(t => {
            const percentage = parseFloat(t.result.percentage);
            const isInRange = percentage >= t.expected.min && percentage <= t.expected.max;
            const status = isInRange ? '✅' : '❌';
           
            if (isInRange) passed++;
           
            console.log(`${status} ${t.name}: ${percentage}% (ожидалось ${t.expected.min}-${t.expected.max}%)`);
        });
       
        console.log(`\n🎯 ИТОГО: ${passed}/${tests.length} сценариев дали ожидаемый результат`);
       
        if (passed >= 4) {
            console.log('✅ Алгоритм работает реалистично!');
        } else {
            console.log('⚠️ Нужна корректировка алгоритма');
        }
       
        return tests;
    }
   
    // 5. Визуализация для отладки
    visualizeShape(points, title) {
        console.log(`\n📊 ${title}:`);
       
        // Находим границы
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Создаем простую сетку 20x10
        const gridWidth = 40;
        const gridHeight = 20;
        const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(' '));
       
        // Заполняем сетку
        points.forEach(p => {
            const gridX = Math.floor((p.x - minX) / (maxX - minX) * (gridWidth - 1));
            const gridY = Math.floor((p.y - minY) / (maxY - minY) * (gridHeight - 1));
           
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                grid[gridY][gridX] = '●';
            }
        });
       
        // Выводим
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
       
        // Статистика по типам точек
        const typeCount = {};
        points.forEach(p => {
            const type = p.type || 'unknown';
            typeCount[type] = (typeCount[type] || 0) + 1;
        });
       
        console.log('Типы точек:');
        Object.entries(typeCount).forEach(([type, count]) => {
            console.log(`  • ${type}: ${count}`);
        });
    }
}

// Запуск теста
console.log('🚀 ТЕСТИРОВАНИЕ РЕАЛИСТИЧНЫХ ФОРМ СЛЕДОВ\n');

const test = new RealisticShapeTest();

// Показать пример формы
const examplePrint = test.createRealShoePrint(400, 300, 1.0, true);
test.visualizeShape(examplePrint, 'Пример детализированного следа');

// Запуск всех тестов
const results = test.runRealisticTests();

console.log('\n🎉 ТЕСТ ЗАВЕРШЕН!');
