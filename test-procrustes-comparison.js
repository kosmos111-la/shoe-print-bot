// test-procrustes-comparison.js
const { Matrix } = require('ml-matrix');
const procrustes = require('ml-procrustes');

console.log('🎯 ТЕСТ С PROCRUSTES АНАЛИЗОМ ДЛЯ СРАВНЕНИЯ ФОРМ\n');

class ProcrustesShapeTest {
    constructor() {
        this.debug = true;
    }

    // 1. Создаем матрицы из точек для Procrustes
    pointsToMatrix(points) {
        const n = points.length;
        const matrix = new Matrix(n, 2);
       
        for (let i = 0; i < n; i++) {
            matrix.set(i, 0, points[i].x);
            matrix.set(i, 1, points[i].y);
        }
       
        return matrix;
    }

    matrixToPoints(matrix) {
        const points = [];
        for (let i = 0; i < matrix.rows; i++) {
            points.push({
                x: matrix.get(i, 0),
                y: matrix.get(i, 1),
                id: `p${i}`
            });
        }
        return points;
    }

    // 2. Procrustes сравнение с возвратом трансформации
    procrustesCompare(referencePoints, targetPoints) {
        console.log(`\n🔍 Procrustes сравнение: ${referencePoints.length} vs ${targetPoints.length} точек`);
       
        // Конвертируем в матрицы
        const X = this.pointsToMatrix(referencePoints);
        const Y = this.pointsToMatrix(targetPoints);
       
        try {
            // Выполняем Procrustes анализ
            const result = procrustes(X, Y, { scale: true });
           
            // Применяем трансформацию
            const Ytransformed = result.Yt;
           
            // Вычисляем расстояния между точками
            const distances = [];
            let totalDistance = 0;
           
            for (let i = 0; i < Math.min(X.rows, Ytransformed.rows); i++) {
                const dx = X.get(i, 0) - Ytransformed.get(i, 0);
                const dy = X.get(i, 1) - Ytransformed.get(i, 1);
                const distance = Math.sqrt(dx * dx + dy * dy);
                distances.push(distance);
                totalDistance += distance;
            }
           
            const avgDistance = distances.length > 0 ? totalDistance / distances.length : 0;
            const maxDistance = Math.max(...distances);
            const minDistance = Math.min(...distances);
           
            // Находим совпадения
            const threshold = 0.05; // Порог после нормализации
            const matches = distances.filter(d => d <= threshold);
           
            const stats = {
                referencePoints: X.rows,
                targetPoints: Y.rows,
                avgDistance: avgDistance.toFixed(4),
                maxDistance: maxDistance.toFixed(4),
                minDistance: minDistance.toFixed(4),
                matches: matches.length,
                matchPercentage: ((matches.length / Math.min(X.rows, Y.rows)) * 100).toFixed(1),
                rotation: result.R ? Math.atan2(result.R.get(1, 0), result.R.get(0, 0)) * 180 / Math.PI : 0,
                scale: result.s || 1.0,
                translation: result.t ? [result.t.get(0, 0), result.t.get(1, 0)] : [0, 0]
            };
           
            console.log(`📊 Результаты Procrustes:`);
            console.log(`   • Среднее расстояние: ${stats.avgDistance}`);
            console.log(`   • Совпадений (<${threshold}): ${stats.matches} (${stats.matchPercentage}%)`);
            console.log(`   • Поворот: ${stats.rotation.toFixed(1)}°`);
            console.log(`   • Масштаб: ${stats.scale.toFixed(3)}x`);
            console.log(`   • Смещение: [${stats.translation[0].toFixed(2)}, ${stats.translation[1].toFixed(2)}]`);
           
            return {
                stats,
                distances,
                transformedPoints: this.matrixToPoints(Ytransformed),
                transformation: {
                    rotation: stats.rotation,
                    scale: stats.scale,
                    translation: stats.translation
                }
            };
           
        } catch (error) {
            console.log(`❌ Ошибка Procrustes: ${error.message}`);
            return null;
        }
    }

    // 3. Создаем реалистичные фигуры для теста
    createTestShape(shapeType = 'shoe', centerX = 0, centerY = 0, scale = 1.0, noise = 0) {
        const points = [];
       
        switch(shapeType) {
            case 'shoe':
                // Форма ботинка
                for (let t = 0; t < Math.PI * 2; t += 0.2) {
                    const x = centerX + Math.cos(t) * 0.5 * scale + (Math.random() - 0.5) * noise;
                    const y = centerY + Math.sin(t) * 0.8 * scale * (1 - 0.3 * Math.cos(t)) + (Math.random() - 0.5) * noise;
                    points.push({ x, y, id: `shoe_${t.toFixed(2)}` });
                }
                break;
               
            case 'ellipse':
                // Эллипс
                for (let t = 0; t < Math.PI * 2; t += 0.15) {
                    const x = centerX + Math.cos(t) * 0.6 * scale + (Math.random() - 0.5) * noise;
                    const y = centerY + Math.sin(t) * 0.9 * scale + (Math.random() - 0.5) * noise;
                    points.push({ x, y, id: `ellipse_${t.toFixed(2)}` });
                }
                break;
               
            case 'triangle':
                // Треугольник
                for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2;
                    const x = centerX + Math.cos(angle) * 0.8 * scale + (Math.random() - 0.5) * noise;
                    const y = centerY + Math.sin(angle) * 0.8 * scale + (Math.random() - 0.5) * noise;
                    points.push({ x, y, id: `triangle_${i}` });
                }
                // Добавляем точки на сторонах
                for (let i = 0; i < 9; i++) {
                    const t = i / 9;
                    const x = centerX + (Math.cos(Math.PI * 2 * t) * 0.5 + 0.3) * scale + (Math.random() - 0.5) * noise;
                    const y = centerY + (Math.sin(Math.PI * 2 * t) * 0.5) * scale + (Math.random() - 0.5) * noise;
                    points.push({ x, y, id: `triangle_side_${i}` });
                }
                break;
        }
       
        console.log(`🎯 Создана фигура "${shapeType}": ${points.length} точек`);
        return points;
    }

    // 4. Применяем трансформацию к точкам
    transformPoints(points, rotationDeg = 0, scale = 1.0, tx = 0, ty = 0) {
        const rotationRad = rotationDeg * Math.PI / 180;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);
       
        return points.map(p => ({
            ...p,
            x: (p.x * cos - p.y * sin) * scale + tx,
            y: (p.x * sin + p.y * cos) * scale + ty,
            id: `${p.id}_t${rotationDeg}_s${scale}`
        }));
    }

    // 5. Визуализация сравнения
    visualizeComparison(originalPoints, transformedPoints, matches, title) {
        console.log(`\n📊 ${title}`);
        console.log('─'.repeat(50));
       
        // Находим общие границы
        const allPoints = [...originalPoints, ...transformedPoints];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Создаем сетку
        const width = 60;
        const height = 20;
        const grid = Array(height).fill().map(() => Array(width).fill(' '));
       
        // Функция для размещения точки
        const placePoint = (x, y, char) => {
            const gridX = Math.floor((x - minX) / (maxX - minX) * (width - 1));
            const gridY = Math.floor((y - minY) / (maxY - minY) * (height - 1));
           
            if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
                if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = char;
                } else if (grid[gridY][gridX] !== char) {
                    grid[gridY][gridX] = '●'; // Совпадение
                }
            }
        };
       
        // Размещаем точки оригинала (O)
        originalPoints.forEach(p => {
            placePoint(p.x, p.y, 'O');
        });
       
        // Размещаем трансформированные точки (X)
        transformedPoints.forEach(p => {
            placePoint(p.x, p.y, 'X');
        });
       
        // Выводим сетку
        console.log('┌' + '─'.repeat(width) + '┐');
        for (let y = 0; y < height; y++) {
            let row = '│';
            for (let x = 0; x < width; x++) {
                row += grid[y][x];
            }
            row += '│';
            console.log(row);
        }
        console.log('└' + '─'.repeat(width) + '┘');
       
        console.log('Легенда: O=оригинал, X=трансформированная, ●=совпадение');
       
        if (matches) {
            console.log(`🎯 Совпадений: ${matches.matches} из ${Math.min(originalPoints.length, transformedPoints.length)} (${matches.matchPercentage}%)`);
        }
    }

    // 6. Запуск комплексного теста
    runComprehensiveTest() {
        console.log('🧪 КОМПЛЕКСНЫЙ ТЕСТ PROCRUSTES АНАЛИЗА\n');
       
        // Создаем эталонную форму (ботинок)
        const referenceShape = this.createTestShape('shoe', 0, 0, 1.0, 0.02);
       
        const tests = [
            {
                name: 'Идентичные формы',
                description: 'Тот же ботинок, без трансформаций',
                targetShape: this.createTestShape('shoe', 0, 0, 1.0, 0.02),
                expectedMatch: 90
            },
            {
                name: 'Поворот 45°',
                description: 'Тот же ботинок, повернутый на 45°',
                targetShape: this.transformPoints(referenceShape, 45, 1.0, 0, 0),
                expectedMatch: 85
            },
            {
                name: 'Масштаб 0.7x',
                description: 'Тот же ботинок, уменьшенный до 70%',
                targetShape: this.transformPoints(referenceShape, 0, 0.7, 0, 0),
                expectedMatch: 80
            },
            {
                name: 'Смещение +0.3,+0.2',
                description: 'Тот же ботинок, смещенный',
                targetShape: this.transformPoints(referenceShape, 0, 1.0, 0.3, 0.2),
                expectedMatch: 85
            },
            {
                name: 'Комбинированная трансформация',
                description: 'Поворот 30° + масштаб 1.2x + смещение',
                targetShape: this.transformPoints(referenceShape, 30, 1.2, 0.2, -0.1),
                expectedMatch: 80
            },
            {
                name: 'Разная форма (эллипс)',
                description: 'Сравнение ботинка с эллипсом',
                targetShape: this.createTestShape('ellipse', 0, 0, 1.0, 0.02),
                expectedMatch: 40
            },
            {
                name: 'Совсем другая форма (треугольник)',
                description: 'Сравнение ботинка с треугольником',
                targetShape: this.createTestShape('triangle', 0, 0, 1.0, 0.02),
                expectedMatch: 20
            },
            {
                name: 'Разное количество точек',
                description: 'Ботинок vs упрощенный ботинок (меньше точек)',
                targetShape: this.createTestShape('shoe', 0, 0, 1.0, 0.05).filter((_, i) => i % 2 === 0),
                expectedMatch: 70
            }
        ];
       
        const results = [];
       
        tests.forEach((test, index) => {
            console.log(`\n${index + 1}. 🎯 ${test.name}`);
            console.log(`   ${test.description}`);
           
            // Выполняем Procrustes сравнение
            const procrustesResult = this.procrustesCompare(referenceShape, test.targetShape);
           
            if (procrustesResult) {
                // Визуализируем
                this.visualizeComparison(
                    referenceShape,
                    procrustesResult.transformedPoints,
                    procrustesResult.stats,
                    `После Procrustes выравнивания`
                );
               
                // Анализируем результат
                const matchPercent = parseFloat(procrustesResult.stats.matchPercentage);
                const difference = Math.abs(matchPercent - test.expectedMatch);
                const isGood = difference <= 20; // Допуск 20%
               
                results.push({
                    name: test.name,
                    matchPercent,
                    expected: test.expectedMatch,
                    difference,
                    isGood,
                    stats: procrustesResult.stats
                });
               
                console.log(`\n✅ ОЦЕНКА:`);
                console.log(`   • Получено: ${matchPercent}% совпадений`);
                console.log(`   • Ожидалось: ~${test.expectedMatch}%`);
                console.log(`   • Разница: ${difference.toFixed(1)}%`);
                console.log(`   • Результат: ${isGood ? '✅ Приемлемо' : '❌ Недостаточно точно'}`);
            }
        });
       
        // Сводный отчет
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(70));
       
        let goodCount = 0;
        results.forEach(r => {
            const status = r.isGood ? '✅' : '❌';
            if (r.isGood) goodCount++;
           
            console.log(`${status} ${r.name}: ${r.matchPercent}% (ожидалось ~${r.expected}%)`);
            console.log(`   • Поворот: ${r.stats.rotation.toFixed(1)}°, Масштаб: ${r.stats.scale.toFixed(3)}x`);
            console.log(`   • Среднее расстояние: ${r.stats.avgDistance}`);
        });
       
        console.log(`\n🎯 ИТОГО: ${goodCount}/${results.length} тестов дали ожидаемый результат`);
       
        if (goodCount >= 6) {
            console.log('✅ Procrustes анализ работает хорошо!');
        } else if (goodCount >= 4) {
            console.log('⚠️ Procrustes анализ нуждается в настройке');
        } else {
            console.log('❌ Procrustes анализ не справляется с задачей');
        }
       
        return results;
    }

    // 7. Интеграция с существующей системой
    createIntegrationTest() {
        console.log('\n🔧 ТЕСТ ИНТЕГРАЦИИ С СИСТЕМОЙ СРАВНЕНИЯ СЛЕДОВ');
       
        // Имитируем реальные данные следов
        const realTraces = [
            {
                name: 'След A (правый ботинок)',
                points: this.createTestShape('shoe', 0, 0, 1.0, 0.03),
                expectedMatches: {
                    'След A': 95,    // С собой
                    'След B': 85,    // Похожий
                    'След C': 40,    // Другой
                    'След D': 25     // Совсем другой
                }
            },
            {
                name: 'След B (тот же ботинок, другая поза)',
                points: this.transformPoints(
                    this.createTestShape('shoe', 0, 0, 1.0, 0.03),
                    15, 0.9, 0.1, -0.1
                ),
                expectedMatches: {
                    'След A': 85,
                    'След B': 95,
                    'След C': 35,
                    'След D': 20
                }
            },
            {
                name: 'След C (другой ботинок)',
                points: this.createTestShape('ellipse', 0, 0, 0.9, 0.03),
                expectedMatches: {
                    'След A': 40,
                    'След B': 35,
                    'След C': 95,
                    'След D': 30
                }
            },
            {
                name: 'След D (треугольная форма)',
                points: this.createTestShape('triangle', 0, 0, 1.2, 0.03),
                expectedMatches: {
                    'След A': 25,
                    'След B': 20,
                    'След C': 30,
                    'След D': 95
                }
            }
        ];
       
        // Матрица сравнений
        console.log('\n📊 МАТРИЦА СРАВНЕНИЙ СЛЕДОВ:');
        console.log('='.repeat(70));
       
        const comparisonMatrix = [];
       
        for (let i = 0; i < realTraces.length; i++) {
            const row = [];
            for (let j = 0; j < realTraces.length; j++) {
                const result = this.procrustesCompare(
                    realTraces[i].points,
                    realTraces[j].points
                );
               
                if (result) {
                    const matchPercent = parseFloat(result.stats.matchPercentage);
                    const expected = realTraces[i].expectedMatches[realTraces[j].name] || 0;
                    const difference = Math.abs(matchPercent - expected);
                   
                    row.push({
                        percent: matchPercent,
                        expected,
                        difference,
                        isCorrect: difference <= 25
                    });
                   
                    // Выводим результат
                    const status = difference <= 25 ? '✅' : '❌';
                    console.log(`${status} ${realTraces[i].name} vs ${realTraces[j].name}: ${matchPercent}% (ожидалось ~${expected}%)`);
                }
            }
            comparisonMatrix.push(row);
        }
       
        // Анализ матрицы
        console.log('\n🎯 АНАЛИЗ МАТРИЦЫ:');
       
        let correctComparisons = 0;
        let totalComparisons = 0;
       
        for (let i = 0; i < comparisonMatrix.length; i++) {
            for (let j = 0; j < comparisonMatrix[i].length; j++) {
                totalComparisons++;
                if (comparisonMatrix[i][j].isCorrect) {
                    correctComparisons++;
                }
            }
        }
       
        const accuracy = (correctComparisons / totalComparisons * 100).toFixed(1);
        console.log(`• Правильных сравнений: ${correctComparisons}/${totalComparisons}`);
        console.log(`• Точность системы: ${accuracy}%`);
       
        if (parseFloat(accuracy) >= 75) {
            console.log('✅ Система готова к интеграции!');
        } else {
            console.log('⚠️ Требуется дополнительная настройка алгоритма');
        }
       
        return comparisonMatrix;
    }
}

// 🚀 Запуск тестов
async function runProcrustesTests() {
    try {
        console.log('🚀 ЗАПУСК PROCRUSTES ТЕСТИРОВАНИЯ\n');
       
        const tester = new ProcrustesShapeTest();
       
        // 1. Комплексный тест
        console.log('1. 🔄 КОМПЛЕКСНЫЙ ТЕСТ ТРАНСФОРМАЦИЙ');
        const comprehensiveResults = await tester.runComprehensiveTest();
       
        // 2. Тест интеграции
        console.log('\n2. 🔧 ТЕСТ ИНТЕГРАЦИИ С СИСТЕМОЙ');
        const integrationResults = await tester.createIntegrationTest();
       
        // 3. Рекомендации
        console.log('\n3. 📋 РЕКОМЕНДАЦИИ ПО ИНТЕГРАЦИИ:');
       
        if (comprehensiveResults.filter(r => r.isGood).length >= 6) {
            console.log('✅ Procrustes анализ можно использовать для:');
            console.log('   • Нормализации форм перед сравнением');
            console.log('   • Компенсации поворотов и масштабов');
            console.log('   • Улучшения точности сравнения следов');
           
            console.log('\n🔧 ШАГИ ИНТЕГРАЦИИ:');
            console.log('1. Добавить pre-processing шаг с Procrustes');
            console.log('2. Использовать поворот/масштаб из результата для коррекции');
            console.log('3. Применять пороговые значения на основе avgDistance');
            console.log('4. Визуализировать выровненные формы для отладки');
        } else {
            console.log('⚠️ Procrustes нуждается в доработке перед интеграцией');
            console.log('   • Настроить параметры нормализации');
            console.log('   • Добавить фильтрацию выбросов');
            console.log('   • Комбинировать с другими методами');
        }
       
        console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
       
    } catch (error) {
        console.error(`❌ Ошибка при выполнении теста: ${error.message}`);
        console.error(error.stack);
    }
}

// Запускаем
runProcrustesTests();
