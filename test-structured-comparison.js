// test-structured-comparison.js
console.log('🎯 ТЕСТ С СТРУКТУРНЫМ СРАВНЕНИЕМ СЛЕДОВ\n');

class StructuredComparisonTest {
    constructor() {
        this.debug = true;
        // Веса для разных аспектов сравнения
        this.weights = {
            shape: 0.4,       // Общая форма
            distribution: 0.3, // Распределение точек
            density: 0.2,     // Плотность точек
            orientation: 0.1   // Ориентация
        };
    }

    // Создаем след с разной структурой
    createStructuredPrint(type = 'normal', centerX = 400, centerY = 300) {
        let points = [];
       
        if (type === 'normal') {
            // Нормальный след
            points = this.createNormalPrint(centerX, centerY);
        } else if (type === 'wide') {
            // Широкий след
            points = this.createWidePrint(centerX, centerY);
        } else if (type === 'narrow') {
            // Узкий след
            points = this.createNarrowPrint(centerX, centerY);
        } else if (type === 'long') {
            // Длинный след
            points = this.createLongPrint(centerX, centerY);
        }
       
        console.log(`👣 Создан след типа "${type}": ${points.length} точек`);
        return points;
    }

    createNormalPrint(centerX, centerY) {
        const points = [];
        const length = 250;
        const width = 100;
       
        // Контур
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * width / 2;
            const y = centerY + Math.sin(angle) * length / 2 * (1 - 0.3 * Math.cos(angle));
            points.push({ x: Math.round(x), y: Math.round(y), type: 'contour' });
        }
       
        // Протектор
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * 0.4;
            const x = centerX + Math.cos(angle) * width * radius;
            const y = centerY + Math.sin(angle) * length * radius;
            points.push({ x: Math.round(x), y: Math.round(y), type: 'tread' });
        }
       
        return points;
    }

    createWidePrint(centerX, centerY) {
        const points = [];
        const length = 220;
        const width = 120; // Шире
       
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * width / 2;
            const y = centerY + Math.sin(angle) * length / 2 * (1 - 0.2 * Math.cos(angle));
            points.push({ x: Math.round(x), y: Math.round(y), type: 'contour' });
        }
       
        // Более разреженный протектор
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * 0.5;
            const x = centerX + Math.cos(angle) * width * radius;
            const y = centerY + Math.sin(angle) * length * radius;
            points.push({ x: Math.round(x), y: Math.round(y), type: 'tread' });
        }
       
        return points;
    }

    createNarrowPrint(centerX, centerY) {
        const points = [];
        const length = 260;
        const width = 80; // Уже
       
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * width / 2;
            const y = centerY + Math.sin(angle) * length / 2 * (1 - 0.4 * Math.cos(angle));
            points.push({ x: Math.round(x), y: Math.round(y), type: 'contour' });
        }
       
        // Более плотный протектор
        for (let i = 0; i < 18; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * 0.35;
            const x = centerX + Math.cos(angle) * width * radius;
            const y = centerY + Math.sin(angle) * length * radius;
            points.push({ x: Math.round(x), y: Math.round(y), type: 'tread' });
        }
       
        return points;
    }

    createLongPrint(centerX, centerY) {
        const points = [];
        const length = 300; // Длиннее
        const width = 90;
       
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * width / 2;
            const y = centerY + Math.sin(angle) * length / 2 * (1 - 0.35 * Math.cos(angle));
            points.push({ x: Math.round(x), y: Math.round(y), type: 'contour' });
        }
       
        // Протектор с акцентом на середину
        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = 0.2 + Math.random() * 0.3;
            const x = centerX + Math.cos(angle) * width * radius;
            const y = centerY + Math.sin(angle) * length * radius;
            points.push({ x: Math.round(x), y: Math.round(y), type: 'tread' });
        }
       
        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Структурное сравнение
    compareStructured(points1, points2, description) {
        console.log(`\n🔍 ${description}`);
        console.log(`   Форма 1: ${points1.length} точек, Форма 2: ${points2.length} точек`);

        const results = {
            shape: this.compareShape(points1, points2),
            distribution: this.compareDistribution(points1, points2),
            density: this.compareDensity(points1, points2),
            orientation: this.compareOrientation(points1, points2)
        };

        // Общий результат
        const totalScore =
            results.shape * this.weights.shape +
            results.distribution * this.weights.distribution +
            results.density * this.weights.density +
            results.orientation * this.weights.orientation;

        console.log(`\n📊 РЕЗУЛЬТАТЫ СТРУКТУРНОГО СРАВНЕНИЯ:`);
        console.log(`   • Форма: ${(results.shape * 100).toFixed(1)}%`);
        console.log(`   • Распределение: ${(results.distribution * 100).toFixed(1)}%`);
        console.log(`   • Плотность: ${(results.density * 100).toFixed(1)}%`);
        console.log(`   • Ориентация: ${(results.orientation * 100).toFixed(1)}%`);
        console.log(`   🎯 ИТОГО: ${(totalScore * 100).toFixed(1)}%`);

        return {
            score: totalScore,
            details: results,
            decision: this.getDecision(totalScore)
        };
    }

    // 1. Сравнение формы (отношение сторон, кривизна)
    compareShape(points1, points2) {
        const bbox1 = this.getBoundingBox(points1);
        const bbox2 = this.getBoundingBox(points2);
       
        const aspect1 = bbox1.width / bbox1.height;
        const aspect2 = bbox2.width / bbox2.height;
       
        // Сходство отношения сторон
        const aspectSimilarity = 1 - Math.min(1, Math.abs(aspect1 - aspect2) / Math.max(aspect1, aspect2));
       
        // Сходство размеров (нормализованное)
        const size1 = bbox1.width * bbox1.height;
        const size2 = bbox2.width * bbox2.height;
        const sizeSimilarity = 1 - Math.min(1, Math.abs(size1 - size2) / Math.max(size1, size2));
       
        return (aspectSimilarity * 0.6 + sizeSimilarity * 0.4);
    }

    // 2. Сравнение распределения точек (квадранты)
    compareDistribution(points1, points2) {
        const quadrants1 = this.getQuadrantDistribution(points1);
        const quadrants2 = this.getQuadrantDistribution(points2);
       
        let totalDiff = 0;
        for (let i = 0; i < 4; i++) {
            totalDiff += Math.abs(quadrants1[i] - quadrants2[i]);
        }
       
        return 1 - totalDiff / 2;
    }

    // 3. Сравнение плотности (точек на единицу площади)
    compareDensity(points1, points2) {
        const bbox1 = this.getBoundingBox(points1);
        const bbox2 = this.getBoundingBox(points2);
       
        const area1 = bbox1.width * bbox1.height;
        const area2 = bbox2.width * bbox2.height;
       
        const density1 = points1.length / area1;
        const density2 = points2.length / area2;
       
        return 1 - Math.min(1, Math.abs(density1 - density2) / Math.max(density1, density2));
    }

    // 4. Сравнение ориентации (главной оси)
    compareOrientation(points1, points2) {
        const orientation1 = this.getPrincipalOrientation(points1);
        const orientation2 = this.getPrincipalOrientation(points2);
       
        // Разница ориентации (0-180 градусов)
        let diff = Math.abs(orientation1 - orientation2);
        diff = Math.min(diff, 180 - diff); // Учитываем симметрию
       
        // Преобразуем в схожесть (0-1)
        return 1 - (diff / 90); // 90 градусов = максимальное отличие
    }

    // 🔥 Вспомогательные методы
    getBoundingBox(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    getQuadrantDistribution(points) {
        const bbox = this.getBoundingBox(points);
        const centerX = (bbox.minX + bbox.maxX) / 2;
        const centerY = (bbox.minY + bbox.maxY) / 2;
       
        const quadrants = [0, 0, 0, 0];
       
        points.forEach(p => {
            let quadrant = 0;
            if (p.x >= centerX && p.y < centerY) quadrant = 0;
            else if (p.x >= centerX && p.y >= centerY) quadrant = 1;
            else if (p.x < centerX && p.y < centerY) quadrant = 2;
            else quadrant = 3;
           
            quadrants[quadrant]++;
        });
       
        // Нормализуем
        const total = points.length || 1;
        return quadrants.map(q => q / total);
    }

    getPrincipalOrientation(points) {
        if (points.length < 2) return 0;
       
        const bbox = this.getBoundingBox(points);
        const centerX = (bbox.minX + bbox.maxX) / 2;
        const centerY = (bbox.minY + bbox.maxY) / 2;
       
        // Центрируем точки
        const centered = points.map(p => ({
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        // Вычисляем ковариационную матрицу
        let sumXX = 0, sumYY = 0, sumXY = 0;
        centered.forEach(p => {
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        });
       
        const n = centered.length;
        const angleRad = 0.5 * Math.atan2(2 * sumXY / n, sumXX / n - sumYY / n);
        return angleRad * 180 / Math.PI;
    }

    getDecision(score) {
        if (score >= 0.85) return 'Одна и та же обувь';
        if (score >= 0.70) return 'Похожая обувь';
        if (score >= 0.50) return 'Возможно похожая';
        return 'Разная обувь';
    }

    // 🔥 ТЕСТЫ
    runStructuredTests() {
        console.log('🧪 ЗАПУСК СТРУКТУРНЫХ ТЕСТОВ:\n');

        const tests = [];

        // Тест 1: Одна и та же обувь
        console.log('1. 🎯 СЦЕНАРИЙ 1: ОДНА И ТА ЖЕ ОБУВЬ');
        const samePrint1 = this.createStructuredPrint('normal', 400, 300);
        const samePrint2 = this.createStructuredPrint('normal', 400, 300);
       
        const test1 = this.compareStructured(
            samePrint1,
            samePrint2,
            "Одна и та же обувь (повторный отпечаток)"
        );
        tests.push({ name: 'Одна и та же обувь', result: test1, expected: 0.85 });

        // Тест 2: Похожая обувь (нормальная vs широкая)
        console.log('\n2. 🎯 СЦЕНАРИЙ 2: ПОХОЖАЯ ОБУВЬ');
        const normalPrint = this.createStructuredPrint('normal', 400, 300);
        const widePrint = this.createStructuredPrint('wide', 400, 300);
       
        const test2 = this.compareStructured(
            normalPrint,
            widePrint,
            "Нормальная обувь vs Широкая обувь"
        );
        tests.push({ name: 'Похожая обувь', result: test2, expected: 0.70 });

        // Тест 3: Разная обувь (нормальная vs узкая)
        console.log('\n3. 🎯 СЦЕНАРИЙ 3: РАЗНАЯ ОБУВЬ');
        const narrowPrint = this.createStructuredPrint('narrow', 400, 300);
       
        const test3 = this.compareStructured(
            normalPrint,
            narrowPrint,
            "Нормальная обувь vs Узкая обувь"
        );
        tests.push({ name: 'Разная обувь', result: test3, expected: 0.50 });

        // Тест 4: С поворотом
        console.log('\n4. 🎯 СЦЕНАРИЙ 4: ПОВОРОТ 45°');
        const rotatedPrint = this.rotatePoints(normalPrint, 45);
       
        const test4 = this.compareStructured(
            normalPrint,
            rotatedPrint,
            "Нормальная обувь vs Повернутая на 45°"
        );
        tests.push({ name: 'Поворот 45°', result: test4, expected: 0.85 });

        // Тест 5: Другая обувь (нормальная vs длинная)
        console.log('\n5. 🎯 СЦЕНАРИЙ 5: СОВСЕМ ДРУГАЯ ОБУВЬ');
        const longPrint = this.createStructuredPrint('long', 400, 300);
       
        const test5 = this.compareStructured(
            normalPrint,
            longPrint,
            "Нормальная обувь vs Длинная обувь"
        );
        tests.push({ name: 'Совсем другая обувь', result: test5, expected: 0.40 });

        // Сводный отчет
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));

        let passed = 0;
        tests.forEach((t, index) => {
            const score = t.result.score;
            const expected = t.expected;
            const decision = t.result.decision;
           
            let status = '❌';
            let message = '';
           
            if (score >= expected * 0.9 && score <= expected * 1.1) {
                status = '✅';
                passed++;
                message = 'В пределах ожиданий';
            } else if (score > expected * 1.1) {
                message = 'Слишком высокий результат';
            } else {
                message = 'Слишком низкий результат';
            }
           
            console.log(`${status} ${t.name}: ${(score * 100).toFixed(1)}% (ожидалось ~${(expected * 100).toFixed(0)}%)`);
            console.log(`   Решение: ${decision}`);
            console.log(`   Статус: ${message}`);
            if (index < tests.length - 1) console.log('');
        });

        console.log(`\n🎯 ИТОГО: ${passed}/${tests.length} тестов пройдено правильно`);
       
        if (passed >= 4) {
            console.log('✅ Структурное сравнение работает правильно!');
            console.log('🎯 Теперь можно интегрировать этот алгоритм в систему.');
        } else {
            console.log('⚠️ Нужна дополнительная настройка алгоритма');
        }

        return tests;
    }

    rotatePoints(points, angleDeg) {
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        return points.map(p => {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
           
            return {
                ...p,
                x: centerX + dx * cosA - dy * sinA,
                y: centerY + dx * sinA + dy * cosA
            };
        });
    }
}

// Запуск теста
console.log('🚀 ТЕСТИРОВАНИЕ СТРУКТУРНОГО СРАВНЕНИЯ СЛЕДОВ\n');

const test = new StructuredComparisonTest();
const results = test.runStructuredTests();

console.log('\n🎉 ТЕСТ ЗАВЕРШЕН!');
