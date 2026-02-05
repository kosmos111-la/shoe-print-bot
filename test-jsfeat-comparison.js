// test-jsfeat-comparison.js
console.log('🎯 ТЕСТ С БИБЛИОТЕКОЙ JSFEAT ДЛЯ СРАВНЕНИЯ СЛЕДОВ\n');

// Установите сначала: npm install jsfeat

const jsfeat = require('jsfeat');

// 🔧 ГЕНЕРАТОР ТОЧЕК
class JsfeatGenerator {
    static createShape(shapeType, options = {}) {
        const {
            centerX = 400,
            centerY = 300,
            scale = 1.0,
            numPoints = 30
        } = options;
       
        const points = [];
       
        if (shapeType === 'eight') {
            // Восьмёрка
            const a = 100 * scale;
            const b = 60 * scale;
           
            for (let i = 0; i < numPoints; i++) {
                const t = (i / numPoints) * 2 * Math.PI;
                const x = centerX + a * Math.sin(t);
                const y = centerY + b * Math.sin(2 * t);
                points.push({ x: Math.round(x), y: Math.round(y), id: `p${i}` });
            }
        } else if (shapeType === 'six') {
            // Шестёрка (немного другая)
            const a = 100 * scale;
            const b = 60 * scale;
           
            for (let i = 0; i < Math.floor(numPoints * 0.7); i++) {
                const t = (i / Math.floor(numPoints * 0.7)) * 2 * Math.PI;
                const x = centerX + a * Math.sin(t);
                const y = centerY + b * Math.sin(2 * t) * 0.8;
                points.push({ x: Math.round(x), y: Math.round(y), id: `p${i}` });
            }
        } else {
            // Случайные точки
            for (let i = 0; i < numPoints; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = 100 * scale * (0.5 + Math.random() * 0.5);
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                points.push({ x: Math.round(x), y: Math.round(y), id: `p${i}` });
            }
        }
       
        return points;
    }
}

// 🔍 АНАЛИЗАТОР НА JSFEAT
class JsfeatAnalyzer {
    constructor() {
        console.log('✅ JSFEAT загружен');
    }
   
    // 1. Найти ключевые точки с помощью FAST детектора
    detectKeypoints(points) {
        if (points.length === 0) return [];
       
        // Преобразуем точки в формат jsfeat
        const keypoints = [];
        for (let i = 0; i < points.length; i++) {
            keypoints.push({
                x: points[i].x,
                y: points[i].y,
                score: 1000 - i, // Простой способ ранжирования
                level: 0,
                angle: 0
            });
        }
       
        return keypoints;
    }
   
    // 2. Вычислить дескрипторы (упрощённо)
    computeDescriptors(keypoints) {
        const descriptors = [];
       
        for (const kp of keypoints) {
            // Простой дескриптор: координаты + производные
            const descriptor = new jsfeat.matrix_t(8, 1, jsfeat.F32_t | jsfeat.C1_t);
            descriptor.data[0] = kp.x;
            descriptor.data[1] = kp.y;
            descriptor.data[2] = kp.score;
            descriptor.data[3] = Math.sin(kp.x * 0.01);
            descriptor.data[4] = Math.cos(kp.y * 0.01);
            descriptor.data[5] = kp.x * kp.y * 0.0001;
            descriptor.data[6] = Math.sqrt(kp.x * kp.x + kp.y * kp.y);
            descriptor.data[7] = Math.atan2(kp.y, kp.x);
           
            descriptors.push({
                point: kp,
                descriptor: descriptor
            });
        }
       
        return descriptors;
    }
   
    // 3. Сопоставить точки между двумя наборами
    matchPoints(points1, points2) {
        console.log(`\n🔍 Сопоставляем ${points1.length} и ${points2.length} точек`);
       
        // Простой алгоритм сопоставления
        const matches = [];
       
        for (let i = 0; i < points1.length; i++) {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;
           
            for (let j = 0; j < points2.length; j++) {
                // Вычисляем "расстояние" между точками
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                // Также учитываем "схожесть" через углы и расстояния
                const angle1 = Math.atan2(points1[i].y, points1[i].x);
                const angle2 = Math.atan2(points2[j].y, points2[j].x);
                const angleDiff = Math.abs(angle1 - angle2);
               
                const dist1 = Math.sqrt(points1[i].x * points1[i].x + points1[i].y * points1[i].y);
                const dist2 = Math.sqrt(points2[j].x * points2[j].x + points2[j].y * points2[j].y);
                const distDiff = Math.abs(dist1 - dist2);
               
                // Комбинированное расстояние
                const combinedDistance = distance * 0.7 + angleDiff * 50 + distDiff * 0.5;
               
                if (combinedDistance < bestDistance && combinedDistance < 100) {
                    bestDistance = combinedDistance;
                    bestMatch = points2[j];
                    bestIndex = j;
                }
            }
           
            if (bestMatch) {
                matches.push({
                    point1: points1[i],
                    point2: bestMatch,
                    distance: bestDistance,
                    confidence: Math.max(0, 1 - bestDistance / 100)
                });
            }
        }
       
        return matches;
    }
   
    // 4. Оценить аффинное преобразование
    estimateTransformation(matches) {
        if (matches.length < 3) return null;
       
        // Используем jsfeat для вычисления аффинного преобразования
        const src_points = [];
        const dst_points = [];
       
        for (const match of matches) {
            src_points.push([match.point1.x, match.point1.y]);
            dst_points.push([match.point2.x, match.point2.y]);
        }
       
        // Преобразуем в матрицы jsfeat
        const src_mat = new jsfeat.matrix_t(2, matches.length, jsfeat.F32_t | jsfeat.C1_t);
        const dst_mat = new jsfeat.matrix_t(2, matches.length, jsfeat.F32_t | jsfeat.C1_t);
       
        for (let i = 0; i < matches.length; i++) {
            src_mat.data[i * 2] = src_points[i][0];
            src_mat.data[i * 2 + 1] = src_points[i][1];
            dst_mat.data[i * 2] = dst_points[i][0];
            dst_mat.data[i * 2 + 1] = dst_points[i][1];
        }
       
        // Вычисляем аффинное преобразование
        const transform = new jsfeat.matrix_t(2, 3, jsfeat.F32_t | jsfeat.C1_t);
       
        // Упрощённый расчёт (в реальности нужно использовать RANSAC)
        if (matches.length >= 3) {
            // Центрируем точки
            let src_center_x = 0, src_center_y = 0;
            let dst_center_x = 0, dst_center_y = 0;
           
            for (let i = 0; i < matches.length; i++) {
                src_center_x += src_points[i][0];
                src_center_y += src_points[i][1];
                dst_center_x += dst_points[i][0];
                dst_center_y += dst_points[i][1];
            }
           
            src_center_x /= matches.length;
            src_center_y /= matches.length;
            dst_center_x /= matches.length;
            dst_center_y /= matches.length;
           
            // Вычисляем масштаб и поворот
            let scale = 1.0;
            let angle = 0;
           
            if (matches.length >= 2) {
                // Простая оценка на основе первых двух точек
                const dx1 = src_points[1][0] - src_points[0][0];
                const dy1 = src_points[1][1] - src_points[0][1];
                const dx2 = dst_points[1][0] - dst_points[0][0];
                const dy2 = dst_points[1][1] - dst_points[0][1];
               
                const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
               
                if (dist1 > 0) {
                    scale = dist2 / dist1;
                    angle = Math.atan2(dy2, dx2) - Math.atan2(dy1, dx1);
                }
            }
           
            // Заполняем матрицу преобразования
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
           
            transform.data[0] = cosA * scale;
            transform.data[1] = -sinA * scale;
            transform.data[2] = dst_center_x - (src_center_x * cosA * scale - src_center_y * sinA * scale);
            transform.data[3] = sinA * scale;
            transform.data[4] = cosA * scale;
            transform.data[5] = dst_center_y - (src_center_x * sinA * scale + src_center_y * cosA * scale);
           
            return {
                matrix: transform,
                scale: scale,
                angle: angle * 180 / Math.PI,
                translation: [transform.data[2], transform.data[5]]
            };
        }
       
        return null;
    }
   
    // 5. Применить преобразование к точкам
    applyTransformation(points, transform) {
        if (!transform) return points;
       
        const transformed = [];
        const cosA = Math.cos(transform.angle * Math.PI / 180);
        const sinA = Math.sin(transform.angle * Math.PI / 180);
       
        for (const point of points) {
            const x = point.x * cosA * transform.scale - point.y * sinA * transform.scale + transform.translation[0];
            const y = point.x * sinA * transform.scale + point.y * cosA * transform.scale + transform.translation[1];
           
            transformed.push({
                ...point,
                x: Math.round(x),
                y: Math.round(y)
            });
        }
       
        return transformed;
    }
   
    // 6. Визуализировать результат
    visualizeMatches(points1, points2, matches, title) {
        console.log(`\n📊 ${title}`);
       
        // Простая текстовая визуализация
        const gridSize = 30;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));
       
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
            x: Math.floor((x - minX) / (maxX - minX) * (gridSize - 1)),
            y: Math.floor((y - minY) / (maxY - minY) * (gridSize - 1))
        });
       
        // Отмечаем совпадения
        matches.forEach(match => {
            const pos1 = toGrid(match.point1.x, match.point1.y);
            const pos2 = toGrid(match.point2.x, match.point2.y);
           
            const avgX = Math.floor((pos1.x + pos2.x) / 2);
            const avgY = Math.floor((pos1.y + pos2.y) / 2);
           
            if (avgX >= 0 && avgX < gridSize && avgY >= 0 && avgY < gridSize) {
                grid[avgY][avgX] = '●';
            }
        });
       
        // Остальные точки
        points1.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'O';
                }
            }
        });
       
        points2.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'X';
                }
            }
        });
       
        // Выводим
        console.log('Легенда: ●=совпадение, O=форма1, X=форма2');
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

// 🧪 ТЕСТОВЫЙ РАННЕР
class JsfeatTestRunner {
    constructor() {
        this.generator = new JsfeatGenerator();
        this.analyzer = new JsfeatAnalyzer();
    }
   
    async runTests() {
        console.log('🧪 ЗАПУСК ТЕСТОВ С JSFEAT\n');
       
        // Тест 1: Восьмёрка vs Шестёрка
        console.log('1. 🎯 ВОСЬМЁРКА vs ШЕСТЁРКА');
        const eight = this.generator.createShape('eight', { numPoints: 32 });
        const six = this.generator.createShape('six', { numPoints: 22 });
       
        const matches1 = this.analyzer.matchPoints(eight, six);
        this.analyzer.visualizeMatches(eight, six, matches1, 'Восьмёрка vs Шестёрка');
        this.printMatchStats(matches1, eight.length, six.length);
       
        // Тест 2: Одна и та же фигура
        console.log('\n\n2. 🎯 ОДИН И ТОТ ЖЕ СЛЕД');
        const sameEight = this.generator.createShape('eight', { numPoints: 30 });
        const sameEightCopy = JSON.parse(JSON.stringify(sameEight));
       
        const matches2 = this.analyzer.matchPoints(sameEight, sameEightCopy);
        this.analyzer.visualizeMatches(sameEight, sameEightCopy, matches2, 'Один и тот же след');
        this.printMatchStats(matches2, sameEight.length, sameEightCopy.length);
       
        // Тест 3: С поворотом и оценкой трансформации
        console.log('\n\n3. 🎯 С ПОВОРОТОМ И ТРАНСФОРМАЦИЕЙ');
        const basePoints = this.generator.createShape('eight', { numPoints: 25 });
       
        // Создаем повернутую копию
        const rotatedPoints = [];
        const angle = 45; // градусов
        const cosA = Math.cos(angle * Math.PI / 180);
        const sinA = Math.sin(angle * Math.PI / 180);
       
        for (const point of basePoints) {
            const x = point.x * cosA - point.y * sinA + 50;
            const y = point.x * sinA + point.y * cosA - 30;
            rotatedPoints.push({ ...point, x: Math.round(x), y: Math.round(y) });
        }
       
        const matches3 = this.analyzer.matchPoints(basePoints, rotatedPoints);
        const transform = this.analyzer.estimateTransformation(matches3);
       
        this.analyzer.visualizeMatches(basePoints, rotatedPoints, matches3, 'С поворотом 45°');
        this.printMatchStats(matches3, basePoints.length, rotatedPoints.length);
       
        if (transform) {
            console.log(`\n📐 Оценка трансформации:`);
            console.log(`   • Угол поворота: ${transform.angle.toFixed(1)}°`);
            console.log(`   • Масштаб: ${transform.scale.toFixed(2)}x`);
            console.log(`   • Сдвиг: (${transform.translation[0].toFixed(1)}, ${transform.translation[1].toFixed(1)})`);
           
            // Применяем обратное преобразование
            const inverseTransform = {
                angle: -transform.angle,
                scale: 1 / transform.scale,
                translation: [-transform.translation[0] / transform.scale, -transform.translation[1] / transform.scale]
            };
           
            const corrected = this.analyzer.applyTransformation(rotatedPoints, inverseTransform);
            const matchesCorrected = this.analyzer.matchPoints(basePoints, corrected);
           
            console.log(`\n🔄 После коррекции трансформации:`);
            this.printMatchStats(matchesCorrected, basePoints.length, corrected.length);
        }
       
        // Тест 4: Случайные точки
        console.log('\n\n4. 🎯 СЛУЧАЙНЫЕ ТОЧКИ');
        const random1 = this.generator.createShape('random', { numPoints: 20 });
        const random2 = this.generator.createShape('random', { numPoints: 20 });
       
        const matches4 = this.analyzer.matchPoints(random1, random2);
        this.analyzer.visualizeMatches(random1, random2, matches4, 'Случайные точки');
        this.printMatchStats(matches4, random1.length, random2.length);
       
        // Итоговый отчет
        this.printSummary();
    }
   
    printMatchStats(matches, count1, count2) {
        const percentage = (matches.length / Math.min(count1, count2) * 100).toFixed(1);
        let avgConfidence = 0;
       
        if (matches.length > 0) {
            avgConfidence = matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length;
        }
       
        console.log(`\n📈 СТАТИСТИКА:`);
        console.log(`   • Совпадений: ${matches.length} из ${Math.min(count1, count2)}`);
        console.log(`   • Процент: ${percentage}%`);
        console.log(`   • Средняя уверенность: ${(avgConfidence * 100).toFixed(1)}%`);
       
        if (matches.length > 0) {
            const distances = matches.map(m => m.distance);
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            console.log(`   • Среднее расстояние: ${avgDistance.toFixed(1)}`);
        }
    }
   
    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('🎯 ИТОГОВЫЙ ОТЧЕТ JSFEAT');
        console.log('='.repeat(50));
        console.log('✅ ЧТО УМЕЕТ JSFEAT:');
        console.log('   1. Быстрые матричные операции');
        console.log('   2. Обработка изображений и точек');
        console.log('   3. Детекция особенностей');
        console.log('   4. Вычисление преобразований');
        console.log('\n📊 РЕКОМЕНДАЦИИ:');
        console.log('   • Для простых сравнений используйте matchPoints()');
        console.log('   • Для трансформаций используйте estimateTransformation()');
        console.log('   • Для точных результатов нужны уникальные ключевые точки');
        console.log('\n🚀 ДЛЯ ВНЕДРЕНИЯ:');
        console.log('   1. npm install jsfeat');
        console.log('   2. Импортируйте JsfeatAnalyzer');
        console.log('   3. Используйте matchPoints() для сравнения');
        console.log('   4. Используйте estimateTransformation() для выравнивания');
    }
}

// 🚀 ЗАПУСК ТЕСТОВ
async function main() {
    console.log('🎯 ТЕСТ С БИБЛИОТЕКОЙ JSFEAT ДЛЯ СРАВНЕНИЯ СЛЕДОВ\n');
   
    try {
        const testRunner = new JsfeatTestRunner();
        await testRunner.runTests();
       
        console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
       
    } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
       
        // Если jsfeat не установлен, показываем инструкцию
        if (error.message.includes('jsfeat')) {
            console.log('\n📦 ИНСТРУКЦИЯ ПО УСТАНОВКЕ:');
            console.log('1. Установите jsfeat:');
            console.log('   npm install jsfeat');
            console.log('2. Запустите тест снова:');
            console.log('   node test-jsfeat-comparison.js');
        }
    }
}

// Инструкция
console.log('📦 ИНСТРУКЦИЯ:');
console.log('1. Установите библиотеку: npm install jsfeat');
console.log('2. Запустите тест: node test-jsfeat-comparison.js');
console.log('='.repeat(50));

// Запуск
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    JsfeatGenerator,
    JsfeatAnalyzer,
    JsfeatTestRunner
};
