// test-fixed-comparison-algorithm.js
console.log('🎯 ИСПРАВЛЕННЫЙ АЛГОРИТМ СРАВНЕНИЯ ФИГУР\n');

class FixedComparisonAlgorithm {
    constructor() {
        this.debug = true;
    }
   
    // 1. Нормализация координат (центрирование и масштабирование)
    normalizePoints(points) {
        if (points.length === 0) return points;
       
        // Находим центр
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        // Центрируем
        const centered = points.map(p => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        // Находим максимальное расстояние от центра (для масштабирования)
        const maxDistance = Math.max(
            ...centered.map(p => Math.sqrt(p.x * p.x + p.y * p.y))
        );
       
        if (maxDistance === 0) return centered;
       
        // Масштабируем к единичному кругу
        const scale = 1.0 / maxDistance;
        const normalized = centered.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale
        }));
       
        return normalized;
    }
   
    // 2. Нахождение главной оси (PCA - Principal Component Analysis)
    findPrincipalAxis(points) {
        if (points.length < 2) return 0;
       
        // Вычисляем ковариационную матрицу
        let sumXX = 0, sumYY = 0, sumXY = 0;
       
        for (const p of points) {
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        }
       
        const n = points.length;
        const covXX = sumXX / n;
        const covYY = sumYY / n;
        const covXY = sumXY / n;
       
        // Вычисляем угол главной оси
        const angleRad = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
        const angleDeg = angleRad * 180 / Math.PI;
       
        return angleDeg;
    }
   
    // 3. Выравнивание по главной оси
    alignToPrincipalAxis(points, targetAngle = 0) {
        const currentAngle = this.findPrincipalAxis(points);
        const rotationAngle = targetAngle - currentAngle;
       
        return this.rotatePoints(points, rotationAngle);
    }
   
    // 4. Поворот точек
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
   
    // 5. Поиск взаимно-однозначных соответствий (Венгерский алгоритм)
    findOneToOneMatches(points1, points2, maxDistance = 0.3) {
        // Если точек сильно разное количество, берем минимум
        const maxMatches = Math.min(points1.length, points2.length);
       
        // Матрица расстояний
        const distances = [];
        for (let i = 0; i < points1.length; i++) {
            distances[i] = [];
            for (let j = 0; j < points2.length; j++) {
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                distances[i][j] = Math.sqrt(dx * dx + dy * dy);
            }
        }
       
        // Жадный алгоритм для поиска наилучших соответствий
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Создаем список всех возможных пар
        const allPairs = [];
        for (let i = 0; i < points1.length; i++) {
            for (let j = 0; j < points2.length; j++) {
                allPairs.push({
                    i, j,
                    distance: distances[i][j]
                });
            }
        }
       
        // Сортируем по расстоянию
        allPairs.sort((a, b) => a.distance - b.distance);
       
        // Выбираем наилучшие непересекающиеся пары
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
   
    // 6. Основной метод сравнения
    compareShapes(points1, points2, description = "") {
        console.log(`\n🔍 ${description}`);
        console.log(`   Исходно: ${points1.length} vs ${points2.length} точек`);
       
        // Шаг 1: Нормализация
        const norm1 = this.normalizePoints(points1);
        const norm2 = this.normalizePoints(points2);
       
        // Шаг 2: Выравнивание по главной оси
        const aligned1 = this.alignToPrincipalAxis(norm1, 0);
        const aligned2 = this.alignToPrincipalAxis(norm2, 0);
       
        // Шаг 3: Поиск соответствий
        const matches = this.findOneToOneMatches(aligned1, aligned2);
       
        // Статистика
        const stats = {
            totalPoints1: points1.length,
            totalPoints2: points2.length,
            matches: matches.length,
            matchPercentage: ((matches.length / Math.min(points1.length, points2.length)) * 100).toFixed(1),
            avgDistance: matches.length > 0
                ? (matches.reduce((sum, m) => sum + m.distance, 0) / matches.length).toFixed(3)
                : 0
        };
       
        console.log(`   После нормализации и выравнивания:`);
        console.log(`   • Найдено совпадений: ${stats.matches}`);
        console.log(`   • Процент совпадений: ${stats.matchPercentage}%`);
        console.log(`   • Среднее расстояние: ${stats.avgDistance}`);
       
        return { matches, stats };
    }
   
    // 7. Тест с трансформациями
    testWithTransformations() {
        // Генератор фигур
        const ShapeGenerator = {
            createFigureEight: (centerX = 400, centerY = 300, scale = 1.0) => {
                const points = [];
                const a = 100 * scale;
                const b = 60 * scale;
               
                for (let t = 0; t < 2 * Math.PI; t += 0.2) {
                    points.push({
                        x: centerX + a * Math.sin(t),
                        y: centerY + b * Math.sin(2 * t),
                        id: `p_${t.toFixed(2)}`
                    });
                }
                return points;
            },
           
            createFigureSix: (centerX = 400, centerY = 300, scale = 1.0) => {
                const points = [];
                const a = 100 * scale;
                const b = 60 * scale;
               
                for (let t = 0; t < 2 * Math.PI; t += 0.3) {
                    points.push({
                        x: centerX + a * Math.sin(t),
                        y: centerY + b * Math.sin(2 * t),
                        id: `p_${t.toFixed(2)}`
                    });
                }
                return points;
            },
           
            transformPoints: (points, angleDeg = 0, scale = 1.0, offsetX = 0, offsetY = 0) => {
                const angleRad = angleDeg * Math.PI / 180;
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);
               
                return points.map(p => {
                    let x = p.x * cosA - p.y * sinA;
                    let y = p.x * sinA + p.y * cosA;
                   
                    x = x * scale + offsetX;
                    y = y * scale + offsetY;
                   
                    return {
                        ...p,
                        x: Math.round(x),
                        y: Math.round(y)
                    };
                });
            }
        };
       
        // Создаем фигуры
        const baseEight = ShapeGenerator.createFigureEight();
        const baseSix = ShapeGenerator.createFigureSix();
       
        console.log('🎯 БАЗОВЫЕ ФИГУРЫ:');
        console.log(`   • Восьмёрка: ${baseEight.length} точек`);
        console.log(`   • Шестёрка: ${baseSix.length} точек`);
       
        // Тестовые трансформации
        const tests = [
            { name: "Без трансформации", angle: 0, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Поворот 18°", angle: 18, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Поворот 43°", angle: 43, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Поворот 93°", angle: 93, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Поворот 120°", angle: 120, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Масштаб 0.8x", angle: 0, scale: 0.8, offsetX: 0, offsetY: 0 },
            { name: "Масштаб 1.2x", angle: 0, scale: 1.2, offsetX: 0, offsetY: 0 },
            { name: "Смещение +50,+30", angle: 0, scale: 1.0, offsetX: 50, offsetY: 30 },
            { name: "Комбинированная", angle: 45, scale: 0.9, offsetX: 20, offsetY: 10 }
        ];
       
        const results = [];
       
        for (const test of tests) {
            const transformedSix = ShapeGenerator.transformPoints(
                baseSix, test.angle, test.scale, test.offsetX, test.offsetY
            );
           
            const result = this.compareShapes(
                baseEight,
                transformedSix,
                `ТЕСТ: ${test.name} (угол: ${test.angle}°, масштаб: ${test.scale}x, смещение: ${test.offsetX},${test.offsetY})`
            );
           
            results.push({
                test: test.name,
                stats: result.stats,
                expectedMin: 70,
                expectedMax: 85,
                passed: result.stats.matchPercentage >= 70 && result.stats.matchPercentage <= 85
            });
        }
       
        // Сводный отчет
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        let passedCount = 0;
        results.forEach(r => {
            const status = r.passed ? '✅' : '❌';
            console.log(`${status} ${r.test}: ${r.stats.matchPercentage}% совпадений`);
            if (r.passed) passedCount++;
        });
       
        console.log(`\n🎯 ИТОГО: ${passedCount}/${results.length} тестов пройдено`);
       
        if (passedCount === results.length) {
            console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Алгоритм работает корректно.');
        } else {
            console.log(`⚠️ Есть проблемы с обработкой трансформаций`);
        }
       
        return results;
    }
}

// Запуск теста
console.log('🚀 ЗАПУСК ИСПРАВЛЕННОГО АЛГОРИТМА...\n');

const algorithm = new FixedComparisonAlgorithm();
algorithm.testWithTransformations();

// Дополнительный тест для проверки математики
console.log('\n🧮 ПРОВЕРКА МАТЕМАТИКИ:');
console.log('='.repeat(60));

const testPoints1 = [{x:0,y:0},{x:10,y:0},{x:0,y:10}];
const testPoints2 = [{x:5,y:5},{x:15,y:5},{x:5,y:15}];

console.log('Тест 1: Идентичные фигуры со смещением');
const test1 = algorithm.compareShapes(testPoints1, testPoints2, "Смещенные треугольники");

console.log('\nТест 2: Одна и та же фигура');
const test2 = algorithm.compareShapes(testPoints1, testPoints1, "Идентичные треугольники");

console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
