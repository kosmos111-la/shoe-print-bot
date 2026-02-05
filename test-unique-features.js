// test-unique-features.js
console.log('🎯 ТЕСТ С УНИКАЛЬНЫМИ ПРИЗНАКАМИ СЛЕДОВ\n');

// 🔧 СОЗДАНИЕ СЛЕДОВ С УНИКАЛЬНЫМИ ПРИЗНАКАМИ
class UniqueFootprintGenerator {
    // Создаем след с уникальными характеристиками
    static createFootprint(id, options = {}) {
        const {
            centerX = 400,
            centerY = 300,
            size = 'normal', // small, normal, large
            wearLevel = 0.3, // 0-1: износ подошвы
            uniqueFeatures = [] // уникальные дефекты
        } = options;
       
        const points = [];
       
        // Базовые размеры в зависимости от размера обуви
        const sizes = {
            small: { length: 220, width: 80, heelWidth: 65 },
            normal: { length: 250, width: 100, heelWidth: 80 },
            large: { length: 280, width: 110, heelWidth: 90 }
        };
       
        const { length, width, heelWidth } = sizes[size] || sizes.normal;
       
        // 1. КОНТУР СЛЕДА (базовая форма - одинаковая для всех)
        const contourPoints = this.createContour(centerX, centerY, length, width, 24);
        points.push(...contourPoints);
       
        // 2. УНИКАЛЬНЫЙ ПРОТЕКТОР (разный для каждого следа!)
        const treadPoints = this.createUniqueTread(id, centerX, centerY, length, width, heelWidth, wearLevel);
        points.push(...treadPoints);
       
        // 3. УНИКАЛЬНЫЕ ДЕФЕКТЫ (трещины, повреждения)
        const defectPoints = this.createDefects(uniqueFeatures, centerX, centerY, length, width);
        points.push(...defectPoints);
       
        // 4. СЛУЧАЙНЫЕ ОСОБЕННОСТИ
        const randomPoints = this.createRandomFeatures(id, centerX, centerY, length, width, 10);
        points.push(...randomPoints);
       
        return points;
    }
   
    static createContour(centerX, centerY, length, width, numPoints) {
        const points = [];
       
        for (let i = 0; i < numPoints; i++) {
            const t = (i / numPoints) * 2 * Math.PI;
            const x = centerX + Math.cos(t) * width / 2;
            const y = centerY + Math.sin(t) * length / 2 * (1 - 0.2 * Math.cos(2 * t));
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'contour',
                id: `contour_${i}`,
                isUnique: false // Контур не уникален!
            });
        }
       
        return points;
    }
   
    static createUniqueTread(footprintId, centerX, centerY, length, width, heelWidth, wearLevel) {
        const points = [];
       
        // Уникальный seed на основе ID следа
        const seed = this.hashString(footprintId);
        const random = this.seededRandom(seed);
       
        // Количество полос протектора (уникально для каждого следа)
        const numStripes = 4 + Math.floor(random() * 4); // 4-7 полос
       
        for (let stripe = 0; stripe < numStripes; stripe++) {
            const stripeY = centerY - length * 0.3 + (stripe / numStripes) * length * 0.6;
            const stripeWidth = width * (0.5 + random() * 0.3);
           
            // Уникальное количество точек в полосе
            const pointsInStripe = 3 + Math.floor(random() * 5);
           
            for (let i = 0; i < pointsInStripe; i++) {
                // Уникальное распределение
                const x = centerX + (random() - 0.5) * stripeWidth;
                const y = stripeY + (random() - 0.5) * 8;
               
                // Уникальный износ (точки могут отсутствовать)
                if (random() > wearLevel) {
                    points.push({
                        x: Math.round(x),
                        y: Math.round(y),
                        type: 'tread',
                        id: `tread_${footprintId}_${stripe}_${i}`,
                        isUnique: true, // Уникальная точка протектора!
                        stripe: stripe,
                        position: i
                    });
                }
            }
        }
       
        return points;
    }
   
    static createDefects(features, centerX, centerY, length, width) {
        const points = [];
        let defectIndex = 0;
       
        features.forEach(feature => {
            if (feature.type === 'crack') {
                // Трещина - несколько точек вдоль линии
                const crackLength = feature.length || 30;
                const crackAngle = feature.angle || 0;
               
                for (let i = 0; i < 5; i++) {
                    const progress = i / 4;
                    const x = centerX + feature.x + Math.cos(crackAngle) * crackLength * progress;
                    const y = centerY + feature.y + Math.sin(crackAngle) * crackLength * progress;
                   
                    points.push({
                        x: Math.round(x),
                        y: Math.round(y),
                        type: 'defect_crack',
                        id: `crack_${feature.id}_${i}`,
                        isUnique: true,
                        featureId: feature.id
                    });
                }
            }
           
            if (feature.type === 'hole') {
                // Дырка - точки по кругу
                const radius = feature.radius || 10;
               
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * 2 * Math.PI;
                    const x = centerX + feature.x + Math.cos(angle) * radius;
                    const y = centerY + feature.y + Math.sin(angle) * radius;
                   
                    points.push({
                        x: Math.round(x),
                        y: Math.round(y),
                        type: 'defect_hole',
                        id: `hole_${feature.id}_${i}`,
                        isUnique: true,
                        featureId: feature.id
                    });
                }
            }
           
            if (feature.type === 'scratch') {
                // Царапина
                for (let i = 0; i < 3; i++) {
                    const x = centerX + feature.x + (Math.random() - 0.5) * 15;
                    const y = centerY + feature.y + (Math.random() - 0.5) * 15;
                   
                    points.push({
                        x: Math.round(x),
                        y: Math.round(y),
                        type: 'defect_scratch',
                        id: `scratch_${feature.id}_${i}`,
                        isUnique: true,
                        featureId: feature.id
                    });
                }
            }
        });
       
        return points;
    }
   
    static createRandomFeatures(footprintId, centerX, centerY, length, width, count) {
        const points = [];
        const seed = this.hashString(footprintId + "_random");
        const random = this.seededRandom(seed);
       
        for (let i = 0; i < count; i++) {
            // Случайные точки в пределах следа
            const angle = random() * 2 * Math.PI;
            const radius = Math.sqrt(random()) * Math.min(length, width) * 0.4;
           
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'random',
                id: `random_${footprintId}_${i}`,
                isUnique: true, // Уникальные случайные точки
                randomSeed: seed
            });
        }
       
        return points;
    }
   
    // Утилиты для генерации уникальных, но детерминированных данных
    static hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }
   
    static seededRandom(seed) {
        return () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }
}

// 🔍 УМНЫЙ АНАЛИЗАТОР - СРАВНИВАЕТ ТОЛЬКО УНИКАЛЬНЫЕ ПРИЗНАКИ!
class SmartFeatureAnalyzer {
    constructor() {
        console.log('✅ Умный анализатор (сравнивает уникальные признаки)');
    }
   
    // Основной метод - сравниваем ТОЛЬКО уникальные признаки
    compareUniqueFeatures(points1, points2, options = {}) {
        const {
            maxDistance = 20,
            requireUniqueMatch = true
        } = options;
       
        // 1. Отделяем уникальные точки от НЕуникальных
        const unique1 = points1.filter(p => p.isUnique === true);
        const unique2 = points2.filter(p => p.isUnique === true);
       
        const nonUnique1 = points1.filter(p => p.isUnique !== true);
        const nonUnique2 = points2.filter(p => p.isUnique !== true);
       
        console.log(`\n🔍 Сравниваем уникальные признаки:`);
        console.log(`   • Уникальные точки: ${unique1.length} vs ${unique2.length}`);
        console.log(`   • Неуникальные точки: ${nonUnique1.length} vs ${nonUnique2.length}`);
       
        // 2. Сравниваем ТОЛЬКО уникальные точки
        const uniqueMatches = this.findOneToOneMatches(unique1, unique2, maxDistance);
       
        // 3. Считаем статистику ТОЛЬКО по уникальным точкам
        const uniqueMatchPercentage = unique1.length > 0
            ? (uniqueMatches.matches.length / Math.min(unique1.length, unique2.length) * 100).toFixed(1)
            : '0.0';
       
        // 4. Анализируем ТИПЫ совпадений
        const typeAnalysis = this.analyzeMatchTypes(uniqueMatches.matches);
       
        // 5. Принимаем решение на основе уникальных признаков
        const decision = this.makeDecision(
            uniqueMatchPercentage,
            typeAnalysis,
            unique1.length,
            unique2.length
        );
       
        return {
            // Основные результаты
            uniqueMatches: uniqueMatches.matches,
            uniqueUnmatched1: uniqueMatches.unmatched1,
            uniqueUnmatched2: uniqueMatches.unmatched2,
           
            // Статистика
            uniqueMatchCount: uniqueMatches.matches.length,
            uniqueMatchPercentage: parseFloat(uniqueMatchPercentage),
            totalPoints1: points1.length,
            totalPoints2: points2.length,
           
            // Анализ
            typeAnalysis,
            decision,
           
            // Дополнительно (для совместимости)
            allMatches: uniqueMatches.matches,
            allUnmatched1: [...uniqueMatches.unmatched1, ...nonUnique1],
            allUnmatched2: [...uniqueMatches.unmatched2, ...nonUnique2],
            matchCount: uniqueMatches.matches.length,
            matchPercentage: parseFloat(uniqueMatchPercentage)
        };
    }
   
    findOneToOneMatches(points1, points2, maxDistance) {
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Все пары
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
                        point2: points2[j],
                        types: [points1[i].type, points2[j].type]
                    });
                }
            }
        }
       
        // Сортируем
        allPairs.sort((a, b) => a.distance - b.distance);
       
        // Выбираем лучшие
        for (const pair of allPairs) {
            if (!used1.has(pair.i) && !used2.has(pair.j)) {
                matches.push(pair);
                used1.add(pair.i);
                used2.add(pair.j);
               
                if (used1.size >= Math.min(points1.length, points2.length)) {
                    break;
                }
            }
        }
       
        const unmatched1 = points1.filter((_, i) => !used1.has(i));
        const unmatched2 = points2.filter((_, j) => !used2.has(j));
       
        return { matches, unmatched1, unmatched2 };
    }
   
    analyzeMatchTypes(matches) {
        const typeCounts = {};
        const sameTypeMatches = [];
       
        matches.forEach(match => {
            const type1 = match.point1.type;
            const type2 = match.point2.type;
           
            const typeKey = `${type1}-${type2}`;
            typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
           
            if (type1 === type2) {
                sameTypeMatches.push(match);
            }
        });
       
        const totalMatches = matches.length;
        const sameTypePercentage = totalMatches > 0
            ? (sameTypeMatches.length / totalMatches * 100).toFixed(1)
            : '0.0';
       
        return {
            typeCounts,
            sameTypeMatches: sameTypeMatches.length,
            sameTypePercentage: parseFloat(sameTypePercentage),
            totalMatches
        };
    }
   
    makeDecision(uniqueMatchPercentage, typeAnalysis, count1, count2) {
        const MIN_UNIQUE_POINTS = 5;
        const MIN_SAME_TYPE_RATIO = 0.6; // 60% совпадений должны быть одного типа
       
        // Проверка 1: Достаточно ли уникальных точек?
        if (count1 < MIN_UNIQUE_POINTS || count2 < MIN_UNIQUE_POINTS) {
            return {
                verdict: 'INSUFFICIENT_DATA',
                confidence: 0.3,
                message: 'Недостаточно уникальных точек для сравнения'
            };
        }
       
        // Проверка 2: Процент совпадений уникальных точек
        if (uniqueMatchPercentage >= 80) {
            return {
                verdict: 'SAME_SHOE_HIGH',
                confidence: 0.95,
                message: 'Высокое совпадение уникальных признаков - одна и та же обувь'
            };
        }
       
        if (uniqueMatchPercentage >= 60) {
            // Проверка 3: Совпадение типов точек
            const typeRatio = typeAnalysis.sameTypeMatches / typeAnalysis.totalMatches;
           
            if (typeRatio >= MIN_SAME_TYPE_RATIO) {
                return {
                    verdict: 'SAME_SHOE_MEDIUM',
                    confidence: 0.75,
                    message: 'Среднее совпадение с сохранением типов точек - вероятно одна обувь'
                };
            } else {
                return {
                    verdict: 'SIMILAR_SHOE',
                    confidence: 0.6,
                    message: 'Схожие следы, но разные типы повреждений'
                };
            }
        }
       
        if (uniqueMatchPercentage >= 30) {
            return {
                verdict: 'DIFFERENT_SHOE_SIMILAR',
                confidence: 0.4,
                message: 'Разная обувь, но есть некоторые совпадения'
            };
        }
       
        return {
            verdict: 'DIFFERENT_SHOE',
            confidence: 0.9,
            message: 'Совершенно разная обувь'
        };
    }
   
    // Визуализация с цветовой кодировкой
    visualizeSmartComparison(points1, points2, result, title) {
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
       
        const toGrid = (x, y) => ({
            x: Math.floor((x - minX) / (maxX - minX) * (gridWidth - 1)),
            y: Math.floor((y - minY) / (maxY - minY) * (gridHeight - 1))
        });
       
        // Уникальные совпадения - красные ●
        result.uniqueMatches.forEach(match => {
            const pos1 = toGrid(match.point1.x, match.point1.y);
            const pos2 = toGrid(match.point2.x, match.point2.y);
           
            const avgX = Math.floor((pos1.x + pos2.x) / 2);
            const avgY = Math.floor((pos1.y + pos2.y) / 2);
           
            if (avgX >= 0 && avgX < gridWidth && avgY >= 0 && avgY < gridHeight) {
                grid[avgY][avgX] = '●'; // Красные - уникальные совпадения
            }
        });
       
        // Уникальные несовпадения - синие O/X
        result.uniqueUnmatched1.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'O'; // Синие - уникальные несовпавшие
                }
            }
        });
       
        result.uniqueUnmatched2.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'X'; // Синие - уникальные несовпавшие
                }
            }
        });
       
        // Неуникальные точки (контур) - серые .
        points1.filter(p => !p.isUnique).forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = '.'; // Серые - контур (не учитывается)
                }
            }
        });
       
        points2.filter(p => !p.isUnique).forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridWidth && pos.y >= 0 && pos.y < gridHeight) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = '.'; // Серые - контур (не учитывается)
                }
            }
        });
       
        console.log('Легенда: ●=уник.совпадение, O/X=уник.несовпадение, .=контур (не важно)');
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
   
    printSmartStats(result) {
        console.log('\n📈 УМНАЯ СТАТИСТИКА:');
        console.log('='.repeat(50));
       
        console.log(`🎯 РЕШЕНИЕ: ${result.decision.message}`);
        console.log(`📊 УВЕРЕННОСТЬ: ${(result.decision.confidence * 100).toFixed(1)}%`);
        console.log(`\n📊 УНИКАЛЬНЫЕ ПРИЗНАКИ:`);
        console.log(`   • Совпадений уникальных точек: ${result.uniqueMatchCount} (${result.uniqueMatchPercentage}%)`);
        console.log(`   • Всего уникальных точек: ${result.uniqueMatches.length + result.uniqueUnmatched1.length} vs ${result.uniqueMatches.length + result.uniqueUnmatched2.length}`);
       
        if (result.typeAnalysis.totalMatches > 0) {
            console.log(`\n📊 АНАЛИЗ ТИПОВ:`);
            console.log(`   • Совпадений одного типа: ${result.typeAnalysis.sameTypeMatches} (${result.typeAnalysis.sameTypePercentage}%)`);
           
            // Показываем самые частые типы совпадений
            const topTypes = Object.entries(result.typeAnalysis.typeCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
           
            if (topTypes.length > 0) {
                console.log(`   • Топ типы совпадений:`);
                topTypes.forEach(([type, count]) => {
                    console.log(`     - ${type}: ${count} раз`);
                });
            }
        }
       
        console.log(`\n🎨 ИНТЕРПРЕТАЦИЯ ДЛЯ СИСТЕМЫ:`);
        console.log(`   • 🔴 Красные точки: ${result.uniqueMatchCount} (уникальные совпадения)`);
        console.log(`   • 🔵 Синие точки: ${result.uniqueUnmatched1.length + result.uniqueUnmatched2.length} (уникальные несовпадения)`);
        console.log(`   • ⚪ Серые точки: контур (не учитывается в решении)`);
    }
}

// 🧪 РЕАЛИСТИЧНЫЙ ТЕСТЕР
class RealisticTester {
    constructor() {
        this.generator = new UniqueFootprintGenerator();
        this.analyzer = new SmartFeatureAnalyzer();
        this.results = [];
    }
   
    async runRealisticTests() {
        console.log('🧪 ТЕСТИРОВАНИЕ С УНИКАЛЬНЫМИ ПРИЗНАКАМИ\n');
       
        // Создаем следы с РАЗНЫМИ уникальными признаками
        const shoe1 = this.generator.createFootprint('shoe_001', {
            size: 'normal',
            wearLevel: 0.4,
            uniqueFeatures: [
                { id: 'crack1', type: 'crack', x: -30, y: -50, length: 40, angle: 0.3 },
                { id: 'hole1', type: 'hole', x: 20, y: 30, radius: 12 },
                { id: 'scratch1', type: 'scratch', x: -10, y: 0 }
            ]
        });
       
        const shoe2 = this.generator.createFootprint('shoe_002', { // ДРУГОЙ ID!
            size: 'normal',
            wearLevel: 0.2,
            uniqueFeatures: [
                { id: 'crack2', type: 'crack', x: 25, y: -40, length: 35, angle: -0.2 },
                { id: 'hole2', type: 'hole', x: -15, y: 25, radius: 8 }
                // Нет царапины scratch1!
            ]
        });
       
        // Тест 1: РАЗНАЯ ОБУВЬ
        console.log('1. 🎯 РАЗНАЯ ОБУВЬ (shoe_001 vs shoe_002)');
        console.log('   • Разные уникальные дефекты');
        console.log('   • Разный износ');
        console.log('   • Разные случайные точки');
       
        const result1 = this.analyzer.compareUniqueFeatures(shoe1, shoe2, { maxDistance: 15 });
        this.analyzer.visualizeSmartComparison(shoe1, shoe2, result1, 'Разная обувь');
        this.analyzer.printSmartStats(result1);
       
        this.results.push({
            name: 'Разная обувь',
            percentage: result1.uniqueMatchPercentage,
            decision: result1.decision.verdict,
            confidence: result1.decision.confidence
        });
       
        // Тест 2: ОДНА И ТА ЖЕ ОБУВЬ (повторный отпечаток)
        console.log('\n\n2. 🎯 ОДНА И ТА ЖЕ ОБУВЬ (shoe_001 повторно)');
        const shoe1Again = this.generator.createFootprint('shoe_001', { // ТОТ ЖЕ ID!
            size: 'normal',
            wearLevel: 0.4,
            uniqueFeatures: [
                { id: 'crack1', type: 'crack', x: -30, y: -50, length: 40, angle: 0.3 },
                { id: 'hole1', type: 'hole', x: 20, y: 30, radius: 12 },
                { id: 'scratch1', type: 'scratch', x: -10, y: 0 }
            ]
        });
       
        const result2 = this.analyzer.compareUniqueFeatures(shoe1, shoe1Again, { maxDistance: 15 });
        this.analyzer.visualizeSmartComparison(shoe1, shoe1Again, result2, 'Одна и та же обувь');
        this.analyzer.printSmartStats(result2);
       
        this.results.push({
            name: 'Одна обувь',
            percentage: result2.uniqueMatchPercentage,
            decision: result2.decision.verdict,
            confidence: result2.decision.confidence
        });
       
        // Тест 3: ПОХОЖАЯ ОБУВЬ (те же дефекты, но другие случайные точки)
        console.log('\n\n3. 🎯 ПОХОЖАЯ ОБУВЬ (копия дефектов)');
        const similarShoe = JSON.parse(JSON.stringify(shoe1));
        // Меняем ID случайных точек (но дефекты те же)
        similarShoe.forEach((p, i) => {
            if (p.type === 'random') {
                p.id = `random_copied_${i}`;
            }
        });
       
        const result3 = this.analyzer.compareUniqueFeatures(shoe1, similarShoe, { maxDistance: 15 });
        this.analyzer.visualizeSmartComparison(shoe1, similarShoe, result3, 'Похожая обувь');
        this.analyzer.printSmartStats(result3);
       
        this.results.push({
            name: 'Похожая обувь',
            percentage: result3.uniqueMatchPercentage,
            decision: result3.decision.verdict,
            confidence: result3.decision.confidence
        });
       
        // Тест 4: ОБУВЬ С ТРАНСФОРМАЦИЕЙ
        console.log('\n\n4. 🎯 ТРАНСФОРМАЦИЯ (поворот + смещение)');
        const transformedShoe = shoe1.map(p => {
            const angle = 30 * Math.PI / 180;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
           
            const x = (p.x - 400) * cosA - (p.y - 300) * sinA + 400 + 20;
            const y = (p.x - 400) * sinA + (p.y - 300) * cosA + 300 - 15;
           
            return { ...p, x: Math.round(x), y: Math.round(y) };
        });
       
        const result4 = this.analyzer.compareUniqueFeatures(shoe1, transformedShoe, { maxDistance: 25 });
        this.analyzer.visualizeSmartComparison(shoe1, transformedShoe, result4, 'С трансформацией');
        this.analyzer.printSmartStats(result4);
       
        this.results.push({
            name: 'С трансформацией',
            percentage: result4.uniqueMatchPercentage,
            decision: result4.decision.verdict,
            confidence: result4.decision.confidence
        });
       
        // Итоговый отчет
        this.printRealisticSummary();
    }
   
    printRealisticSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 РЕАЛИСТИЧНЫЙ ОТЧЕТ С УНИКАЛЬНЫМИ ПРИЗНАКАМИ');
        console.log('='.repeat(60));
       
        console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТОВ:');
        console.log('─'.repeat(60));
       
        this.results.forEach((result, index) => {
            const status = result.decision.includes('SAME_SHOE') ? '✅' :
                         result.decision.includes('DIFFERENT_SHOE') ? '❌' : '⚠️';
           
            console.log(`${index + 1}. ${status} ${result.name.padEnd(20)} ${result.percentage.toFixed(1)}%`);
            console.log(`   Решение: ${result.decision} (уверенность: ${(result.confidence * 100).toFixed(1)}%)`);
        });
       
        const correctDecisions = this.results.filter(r =>
            (r.name === 'Разная обувь' && r.decision.includes('DIFFERENT')) ||
            (r.name === 'Одна обувь' && r.decision.includes('SAME')) ||
            (r.name === 'Похожая обувь' && r.decision.includes('SIMILAR')) ||
            (r.name === 'С трансформацией' && r.decision.includes('SAME'))
        ).length;
       
        console.log('\n' + '─'.repeat(60));
        console.log(`🎯 ТОЧНОСТЬ РЕШЕНИЙ: ${correctDecisions}/${this.results.length} (${((correctDecisions/this.results.length)*100).toFixed(1)}%)`);
       
        if (correctDecisions >= this.results.length * 0.75) {
            console.log('\n✅ ОТЛИЧНО! Алгоритм правильно различает обувь!');
            console.log('🚀 Этот подход готов для вашей системы!');
        } else {
            console.log('\n⚠️ Нужно доработать логику принятия решений');
        }
       
        console.log('\n💡 КЛЮЧЕВЫЕ ИДЕИ НОВОГО ПОДХОДА:');
        console.log('   1. 🎯 Сравниваем ТОЛЬКО уникальные признаки (дефекты, износ)');
        console.log('   2. 📊 Игнорируем общую форму (контур) - она не уникальна');
        console.log('   3. 🔍 Учитываем ТИПЫ точек (трещина vs дырка vs царапина)');
        console.log('   4. ✅ Принимаем решение на основе множества факторов');
       
        console.log('\n📝 ДЛЯ ВАШЕЙ СИСТЕМЫ:');
        console.log(`
   const analyzer = new SmartFeatureAnalyzer();
   const result = analyzer.compareUniqueFeatures(points1, points2);
  
   // Результат содержит:
   // • decision.verdict - решение (SAME_SHOE_HIGH, DIFFERENT_SHOE и т.д.)
   // • decision.confidence - уверенность (0-1)
   // • uniqueMatches - совпадения уникальных точек (🔴 красные)
   // • uniqueUnmatched - несовпадения уникальных точек (🔵 синие)
  
   // Визуализация:
   // ● - уникальные совпадения (красные)
   // O/X - уникальные несовпадения (синие)
   // . - контур (серые, не учитываются)
        `);
    }
}

// 🚀 ЗАПУСК
async function main() {
    console.log('🎯 ТЕСТ С УНИКАЛЬНЫМИ ПРИЗНАКАМИ СЛЕДОВ ОБУВИ\n');
    console.log('📚 Новый подход: сравниваем дефекты, а не геометрию\n');
   
    try {
        const tester = new RealisticTester();
        await tester.runRealisticTests();
       
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
    UniqueFootprintGenerator,
    SmartFeatureAnalyzer,
    RealisticTester
};
