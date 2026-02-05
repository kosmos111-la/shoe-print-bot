// test-adaptive-comparison.js
console.log('🎯 АДАПТИВНЫЙ АЛГОРИТМ СРАВНЕНИЯ\n');

// 🔧 ГЕНЕРАТОР ТОЧЕК (остаётся тем же)
class PointGenerator {
    static createEight(centerX = 400, centerY = 300, numPoints = 32) {
        const points = [];
        const a = 100;
        const b = 60;
       
        for (let i = 0; i < numPoints; i++) {
            const t = (i / numPoints) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t);
            points.push({ x: Math.round(x), y: Math.round(y), id: `p${i}` });
        }
       
        return points;
    }
   
    static createSix(centerX = 400, centerY = 300, numPoints = 21) {
        const points = [];
        const a = 100;
        const b = 60;
       
        for (let i = 0; i < numPoints; i++) {
            const t = (i / numPoints) * 2 * Math.PI;
            const x = centerX + a * Math.cos(t);
            const y = centerY + b * Math.sin(3 * t) * 0.6;
            points.push({ x: Math.round(x), y: Math.round(y), id: `p${i}` });
        }
       
        return points;
    }
}

// 🔍 АДАПТИВНЫЙ АНАЛИЗАТОР
class AdaptiveAnalyzer {
    // Адаптивный поиск совпадений
    findAdaptiveMatches(points1, points2) {
        console.log(`\n🔍 Адаптивное сравнение: ${points1.length} vs ${points2.length} точек`);
       
        // 1. Анализируем данные
        const stats = this.analyzePointSets(points1, points2);
       
        // 2. Автоматически подбираем maxDistance
        const maxDistance = this.calculateOptimalDistance(stats);
       
        console.log(`   📏 Автоматический maxDistance: ${maxDistance.toFixed(1)}px`);
       
        // 3. Выполняем сопоставление
        const result = this.findOneToOneMatches(points1, points2, maxDistance);
       
        // 4. Проверяем качество результата
        const quality = this.evaluateMatchQuality(result, stats);
       
        // 5. При необходимости, уточняем
        if (quality.confidence < 0.7) {
            console.log(`   🔧 Низкая уверенность (${(quality.confidence*100).toFixed(0)}%), уточняем...`);
            return this.refineMatches(points1, points2, result, stats);
        }
       
        return {
            ...result,
            quality,
            autoDistance: maxDistance
        };
    }
   
    analyzePointSets(points1, points2) {
        // Анализируем оба набора точек
        const analyzeSet = (points) => {
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
           
            return {
                count: points.length,
                centerX: xs.reduce((a, b) => a + b, 0) / xs.length,
                centerY: ys.reduce((a, b) => a + b, 0) / ys.length,
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys),
                density: points.length / ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) || 1)
            };
        };
       
        const stats1 = analyzeSet(points1);
        const stats2 = analyzeSet(points2);
       
        return {
            set1: stats1,
            set2: stats2,
            countRatio: Math.min(stats1.count, stats2.count) / Math.max(stats1.count, stats2.count),
            sizeRatio: Math.min(stats1.width, stats2.width) / Math.max(stats1.width, stats2.width),
            densityRatio: Math.min(stats1.density, stats2.density) / Math.max(stats1.density, stats2.density),
            centerDistance: Math.sqrt(
                Math.pow(stats1.centerX - stats2.centerX, 2) +
                Math.pow(stats1.centerY - stats2.centerY, 2)
            )
        };
    }
   
    calculateOptimalDistance(stats) {
        // Базовое расстояние на основе размера фигур
        const avgSize = (stats.set1.width + stats.set1.height + stats.set2.width + stats.set2.height) / 4;
       
        let baseDistance = avgSize * 0.1; // 10% от среднего размера
       
        // Корректировки:
        // 1. За разное количество точек - увеличиваем расстояние
        if (stats.countRatio < 0.7) {
            baseDistance *= 1.5;
        }
       
        // 2. За разный размер - увеличиваем
        if (stats.sizeRatio < 0.8) {
            baseDistance *= 1.3;
        }
       
        // 3. За большое расстояние между центрами - увеличиваем
        if (stats.centerDistance > avgSize * 0.5) {
            baseDistance += stats.centerDistance * 0.3;
        }
       
        // Минимальное и максимальное ограничение
        return Math.max(10, Math.min(100, baseDistance));
    }
   
    findOneToOneMatches(points1, points2, maxDistance) {
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Все пары в пределах maxDistance
        const allPairs = [];
       
        for (let i = 0; i < points1.length; i++) {
            for (let j = 0; j < points2.length; j++) {
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance <= maxDistance) {
                    allPairs.push({ i, j, distance });
                }
            }
        }
       
        // Сортируем и выбираем лучшие пары
        allPairs.sort((a, b) => a.distance - b.distance);
       
        for (const pair of allPairs) {
            if (!used1.has(pair.i) && !used2.has(pair.j)) {
                matches.push({
                    point1: points1[pair.i],
                    point2: points2[pair.j],
                    distance: pair.distance
                });
                used1.add(pair.i);
                used2.add(pair.j);
               
                if (used1.size >= Math.min(points1.length, points2.length)) {
                    break;
                }
            }
        }
       
        const unmatched1 = points1.filter((_, i) => !used1.has(i));
        const unmatched2 = points2.filter((_, j) => !used2.has(j));
       
        const matchPercentage = (matches.length / Math.min(points1.length, points2.length) * 100);
       
        return {
            matches,
            unmatched1,
            unmatched2,
            matchCount: matches.length,
            matchPercentage: matchPercentage.toFixed(1),
            usedPoints1: used1.size,
            usedPoints2: used2.size
        };
    }
   
    evaluateMatchQuality(result, stats) {
        const matchRatio = result.matchCount / Math.min(stats.set1.count, stats.set2.count);
       
        // Среднее качество совпадений
        let avgDistance = 0;
        let distanceScore = 1;
       
        if (result.matches.length > 0) {
            avgDistance = result.matches.reduce((sum, m) => sum + m.distance, 0) / result.matches.length;
           
            // Чем меньше среднее расстояние, тем лучше
            const maxExpectedDistance = Math.min(stats.set1.width, stats.set2.width) * 0.2;
            distanceScore = Math.max(0, 1 - avgDistance / maxExpectedDistance);
        }
       
        // Оценка на основе нескольких факторов
        const countScore = stats.countRatio; // Чем ближе количество точек, тем лучше
        const ratioScore = matchRatio; // Процент совпадений
        const distanceQuality = distanceScore; // Качество расстояний
       
        // Общая уверенность
        const confidence = (countScore * 0.3 + ratioScore * 0.4 + distanceQuality * 0.3);
       
        return {
            confidence,
            matchRatio,
            avgDistance,
            distanceScore,
            countScore,
            verdict: confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low'
        };
    }
   
    refineMatches(points1, points2, initialResult, stats) {
        // Попробуем с другим расстоянием
        const alternativeDistance = stats.centerDistance * 0.5;
       
        console.log(`   🔄 Пробуем альтернативное расстояние: ${alternativeDistance.toFixed(1)}px`);
       
        const refinedResult = this.findOneToOneMatches(points1, points2, alternativeDistance);
        const refinedQuality = this.evaluateMatchQuality(refinedResult, stats);
       
        // Выбираем лучший результат
        if (refinedQuality.confidence > initialResult.quality.confidence) {
            console.log(`   ✅ Лучше с альтернативным расстоянием`);
            return {
                ...refinedResult,
                quality: refinedQuality,
                autoDistance: alternativeDistance,
                wasRefined: true
            };
        }
       
        return {
            ...initialResult,
            wasRefined: false
        };
    }
   
    // Нормализация с интеллектуальным выбором
    normalizeIntelligently(points, referencePoints = null) {
        if (points.length < 3) return points;
       
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        let centered = points.map(p => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        // Если есть референсные точки, выравниваем относительно них
        if (referencePoints && referencePoints.length >= 3) {
            const refCenterX = referencePoints.reduce((sum, p) => sum + p.x, 0) / referencePoints.length;
            const refCenterY = referencePoints.reduce((sum, p) => sum + p.y, 0) / referencePoints.length;
           
            // Вычисляем угол между главными осями
            const angle1 = this.calculatePrincipalAngle(centered);
            const refCentered = referencePoints.map(p => ({
                x: p.x - refCenterX,
                y: p.y - refCenterY
            }));
            const angle2 = this.calculatePrincipalAngle(refCentered);
           
            // Поворачиваем к референсному углу
            const angleDiff = angle2 - angle1;
            centered = this.rotatePoints(centered, angleDiff);
        }
       
        // Масштабируем
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
   
    calculatePrincipalAngle(points) {
        let sumXX = 0, sumYY = 0, sumXY = 0;
       
        for (const p of points) {
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        }
       
        const n = points.length;
        return 0.5 * Math.atan2(2 * sumXY / n, sumXX / n - sumYY / n) * 180 / Math.PI;
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
    visualizeResults(points1, points2, result, title) {
        console.log(`\n📊 ${title}`);
       
        const gridWidth = 40;
        const gridHeight = 20;
        const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(' '));
       
        const allPoints = [...points1, ...points2];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const toGrid = (x, y) => ({
            x: Math.floor((x - minX) / (maxX - minX) * (gridWidth - 1)),
            y: Math.floor((y - minY) / (maxY - minY) * (gridHeight - 1))
        });
       
        // Совпадения
        result.matches.forEach(match => {
            const pos1 = toGrid(match.point1.x, match.point1.y);
            const pos2 = toGrid(match.point2.x, match.point2.y);
           
            const avgX = Math.floor((pos1.x + pos2.x) / 2);
            const avgY = Math.floor((pos1.y + pos2.y) / 2);
           
            if (avgX >= 0 && avgX < gridWidth && avgY >= 0 && avgY < gridHeight) {
                grid[avgY][avgX] = '●';
            }
        });
       
        // Несовпавшие
        points1.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'O';
                }
            }
        });
       
        points2.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'X';
                }
            }
        });
       
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
   
    printDetailedStats(result, testName) {
        console.log('\n📈 ПОДРОБНАЯ СТАТИСТИКА:');
        console.log('='.repeat(50));
        console.log(`✅ Совпадений: ${result.matchCount} (${result.matchPercentage}%)`);
        console.log(`📊 Уверенность алгоритма: ${(result.quality.confidence * 100).toFixed(1)}% (${result.quality.verdict})`);
        console.log(`📏 Автоматическое расстояние: ${result.autoDistance.toFixed(1)}px`);
        console.log(`📏 Среднее расстояние совпадений: ${result.quality.avgDistance.toFixed(1)}px`);
        console.log(`🎯 Качество расстояний: ${(result.quality.distanceScore * 100).toFixed(1)}%`);
       
        // Ожидаемые значения
        const expectations = {
            'Разные фигуры': { min: 40, max: 65 },
            'Один след': { min: 95, max: 100 },
            'Поворот': { min: 70, max: 90 },
            'Нормализованный': { min: 80, max: 95 },
            'Масштаб': { min: 60, max: 85 },
            'Шум': { min: 70, max: 90 },
            'Комбинированный': { min: 60, max: 85 }
        };
       
        const expected = expectations[testName];
        if (expected) {
            const percentage = parseFloat(result.matchPercentage);
            const isPassed = percentage >= expected.min && percentage <= expected.max;
           
            console.log(`\n${isPassed ? '✅' : '❌'} ${testName}: ${percentage}% (ожидалось ${expected.min}-${expected.max}%)`);
           
            if (!isPassed) {
                const diff = percentage < expected.min ? 'низкий' : 'высокий';
                console.log(`   🔧 Результат ${diff}, алгоритм выбрал distance=${result.autoDistance.toFixed(1)}px`);
            }
           
            return isPassed;
        }
       
        return null;
    }
}

// 🧪 ИНТЕЛЛЕКТУАЛЬНЫЙ ТЕСТЕР
class IntelligentTester {
    constructor() {
        this.analyzer = new AdaptiveAnalyzer();
        this.results = [];
    }
   
    async runIntelligentTests() {
        console.log('🧪 ИНТЕЛЛЕКТУАЛЬНОЕ ТЕСТИРОВАНИЕ\n');
       
        const tests = [
            {
                name: 'Разные фигуры',
                generate: () => ({
                    points1: PointGenerator.createEight(400, 300, 32),
                    points2: PointGenerator.createSix(400, 300, 21)
                }),
                description: 'Восьмёрка vs Шестёрка (разные формы)'
            },
            {
                name: 'Один след',
                generate: () => {
                    const points = PointGenerator.createEight(400, 300, 32);
                    return { points1: points, points2: JSON.parse(JSON.stringify(points)) };
                },
                description: 'Точная копия одного следа'
            },
            {
                name: 'Поворот',
                generate: () => {
                    const points1 = PointGenerator.createEight(400, 300, 32);
                    // Поворачиваем вручную
                    const points2 = points1.map(p => {
                        const angle = 45 * Math.PI / 180;
                        const cosA = Math.cos(angle);
                        const sinA = Math.sin(angle);
                        const x = (p.x - 400) * cosA - (p.y - 300) * sinA + 400;
                        const y = (p.x - 400) * sinA + (p.y - 300) * cosA + 300;
                        return { ...p, x: Math.round(x), y: Math.round(y) };
                    });
                    return { points1, points2 };
                },
                description: 'Поворот на 45° без нормализации'
            },
            {
                name: 'Нормализованный',
                generate: () => {
                    const points1 = PointGenerator.createEight(400, 300, 32);
                    const points2 = this.analyzer.normalizeIntelligently(points1);
                    const points1Norm = this.analyzer.normalizeIntelligently(points1);
                    return { points1: points1Norm, points2 };
                },
                description: 'С нормализацией и выравниванием'
            },
            {
                name: 'Масштаб',
                generate: () => {
                    const points1 = PointGenerator.createEight(400, 300, 32);
                    const points2 = points1.map(p => ({
                        ...p,
                        x: Math.round((p.x - 400) * 0.7 + 400),
                        y: Math.round((p.y - 300) * 0.7 + 300)
                    }));
                    return { points1, points2 };
                },
                description: 'Масштаб 0.7x'
            },
            {
                name: 'Шум',
                generate: () => {
                    const points1 = PointGenerator.createEight(400, 300, 32);
                    const points2 = points1.map(p => ({
                        ...p,
                        x: p.x + Math.round((Math.random() - 0.5) * 30),
                        y: p.y + Math.round((Math.random() - 0.5) * 30)
                    }));
                    return { points1, points2 };
                },
                description: 'Случайный шум ±15px'
            },
            {
                name: 'Комбинированный',
                generate: () => {
                    const points1 = PointGenerator.createEight(400, 300, 32);
                    // Комбинированная трансформация
                    const points2 = points1.map(p => {
                        // Поворот
                        let x = p.x - 400;
                        let y = p.y - 300;
                        const angle = 30 * Math.PI / 180;
                        const cosA = Math.cos(angle);
                        const sinA = Math.sin(angle);
                        const rotatedX = x * cosA - y * sinA;
                        const rotatedY = x * sinA + y * cosA;
                       
                        // Масштаб
                        x = rotatedX * 1.2;
                        y = rotatedY * 1.2;
                       
                        // Смещение
                        x += 400 + 50;
                        y += 300 - 30;
                       
                        // Шум
                        x += (Math.random() - 0.5) * 20;
                        y += (Math.random() - 0.5) * 20;
                       
                        return { ...p, x: Math.round(x), y: Math.round(y) };
                    });
                    return { points1, points2 };
                },
                description: 'Поворот + масштаб + смещение + шум'
            }
        ];
       
        for (const test of tests) {
            console.log(`\n🎯 ${test.name.toUpperCase()}: ${test.description}`);
           
            try {
                const { points1, points2 } = test.generate();
               
                console.log(`   Точки: ${points1.length} vs ${points2.length}`);
               
                // Запускаем адаптивный анализ
                const result = this.analyzer.findAdaptiveMatches(points1, points2);
               
                // Визуализируем
                this.analyzer.visualizeResults(points1, points2, result, test.name);
               
                // Статистика
                const passed = this.analyzer.printDetailedStats(result, test.name);
               
                this.results.push({
                    name: test.name,
                    passed: passed === true,
                    percentage: parseFloat(result.matchPercentage),
                    confidence: result.quality.confidence,
                    autoDistance: result.autoDistance
                });
               
            } catch (error) {
                console.error(`❌ Ошибка: ${error.message}`);
                this.results.push({
                    name: test.name,
                    passed: false,
                    error: error.message
                });
            }
        }
       
        this.printIntelligentSummary();
    }
   
    printIntelligentSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 ИНТЕЛЛЕКТУАЛЬНЫЙ ОТЧЕТ');
        console.log('='.repeat(60));
       
        const passed = this.results.filter(r => r.passed === true).length;
        const total = this.results.length;
        const avgConfidence = this.results.reduce((sum, r) => sum + (r.confidence || 0), 0) / total;
       
        console.log('\n📊 РЕЗУЛЬТАТЫ С АВТОМАТИЧЕСКОЙ НАСТРОЙКОЙ:');
        console.log('─'.repeat(60));
       
        this.results.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            const confidenceStr = result.confidence ? `${(result.confidence*100).toFixed(0)}%` : 'ERROR';
            const distanceStr = result.autoDistance ? `${result.autoDistance.toFixed(1)}px` : 'N/A';
           
            console.log(`${index + 1}. ${status} ${result.name.padEnd(15)} ${result.percentage || 0}% ` +
                       `[доверие: ${confidenceStr}, расстояние: ${distanceStr}]`);
        });
       
        console.log('\n' + '─'.repeat(60));
        console.log(`🎯 ИТОГО: ${passed}/${total} тестов пройдено (${((passed/total)*100).toFixed(1)}%)`);
        console.log(`📊 Средняя уверенность алгоритма: ${(avgConfidence*100).toFixed(1)}%`);
       
        if (passed >= total * 0.7) {
            console.log('\n✅ АЛГОРИТМ ГОТОВ К ИСПОЛЬЗОВАНИЮ!');
            console.log('🚀 Для вашей системы:');
            console.log('   1. Используйте AdaptiveAnalyzer');
            console.log('   2. Он сам подберет оптимальные параметры');
            console.log('   3. Не нужно вручную настраивать maxDistance');
        } else {
            console.log('\n⚠️ Нужно доработать алгоритм адаптации');
            console.log('🔧 Проверьте логику calculateOptimalDistance()');
        }
       
        console.log('\n💡 КЛЮЧЕВЫЕ ПРЕИМУЩЕСТВА:');
        console.log('   1. 🎯 Автоматическая настройка параметров');
        console.log('   2. 📊 Оценка качества результата');
        console.log('   3. 🔄 Адаптация к разным типам данных');
        console.log('   4. ✅ Интеллектуальная нормализация');
       
        console.log('\n📝 ДЛЯ ВАШЕГО КОДА:');
        console.log(`
   const analyzer = new AdaptiveAnalyzer();
   const result = analyzer.findAdaptiveMatches(points1, points2);
  
   // result содержит:
   // • matches - совпадения точек (для красных точек)
   // • unmatched1/unmatched2 - несовпавшие точки (для синих точек)
   // • quality.confidence - уверенность в результате
   // • autoDistance - автоматически выбранное расстояние
        `);
    }
}

// 🚀 ЗАПУСК
async function main() {
    console.log('🎯 ИНТЕЛЛЕКТУАЛЬНЫЙ АДАПТИВНЫЙ АЛГОРИТМ\n');
    console.log('📚 Автоматически настраивает параметры под данные\n');
   
    try {
        const tester = new IntelligentTester();
        await tester.runIntelligentTests();
       
        console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
       
    } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
    }
}

// Запуск
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    PointGenerator,
    AdaptiveAnalyzer,
    IntelligentTester
};
