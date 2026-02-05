// test-eight-shape-comparison.js
const fs = require('fs');
const path = require('path');

console.log('🎯 ТЕСТ СРАВНЕНИЯ ФИГУР "ВОСЬМЁРКА" vs "ШЕСТЁРКА"\n');

// 🔧 Вспомогательные функции для создания фигур
class ShapeGenerator {
    // Создаём изогнутую восьмёрку (полный след)
    static createFigureEight(centerX = 400, centerY = 300, scale = 1.0) {
        const points = [];
       
        // Параметры восьмёрки
        const a = 100 * scale;  // Большая полуось
        const b = 60 * scale;   // Малая полуось
       
        // Генерируем точки восьмёрки (параметрическое уравнение)
        for (let t = 0; t < 2 * Math.PI; t += 0.2) {
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t);
            points.push({ x: Math.round(x), y: Math.round(y), id: `p_${t.toFixed(2)}` });
        }
       
        console.log(`🎯 Создана восьмёрка: ${points.length} точек`);
        return points;
    }
   
    // Создаём шестёрку (восьмёрка без части точек - имитация менее детального следа)
    static createFigureSix(centerX = 400, centerY = 300, scale = 1.0) {
        const points = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        // Генерируем те же точки, но пропускаем часть (имитируем меньше деталей)
        for (let t = 0; t < 2 * Math.PI; t += 0.3) { // Больше шаг = меньше точек
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t);
            points.push({ x: Math.round(x), y: Math.round(y), id: `p_${t.toFixed(2)}` });
        }
       
        console.log(`🎯 Создана шестёрка: ${points.length} точек (меньше деталей)`);
        return points;
    }
   
    // Применяем трансформацию к точкам
    static transformPoints(points, angleDeg = 0, scale = 1.0, offsetX = 0, offsetY = 0) {
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return points.map(point => {
            // Поворот
            let x = point.x * cosA - point.y * sinA;
            let y = point.x * sinA + point.y * cosA;
           
            // Масштабирование
            x *= scale;
            y *= scale;
           
            // Смещение
            x += offsetX;
            y += offsetY;
           
            return {
                ...point,
                x: Math.round(x),
                y: Math.round(y),
                originalId: point.id,
                id: `${point.id}_t${angleDeg}_s${scale}`
            };
        });
    }
   
    // Создаём SimpleFootprint из точек
    static createFootprint(points, name) {
        const SimpleFootprint = require('./modules/footprint/simple-footprint');
        const footprint = new SimpleFootprint({
            userId: 'test_user',
            name: name
        });
       
        // Имитируем pointTracker
        footprint.pointTracker = {
            points: new Map()
        };
       
        // Добавляем точки
        points.forEach((point, index) => {
            const pointId = `pt_${name}_${index}`;
            footprint.pointTracker.points.set(pointId, {
                id: pointId,
                x: point.x,
                y: point.y,
                confirmedCount: 1,
                confirmedBy: [`${name}_initial`],
                lastConfirmed: new Date()
            });
        });
       
        // Метод для получения точек
        footprint.getPointsForPatternMatching = function() {
            return Array.from(this.pointTracker.points.values());
        };
       
        return footprint;
    }
}

// 🔍 Класс для анализа результатов
class ResultAnalyzer {
    constructor() {
        this.testResults = [];
    }
   
    // Анализируем совпадения между двумя наборами точек
    analyzeMatches(points1, points2, threshold = 25) {
        const matches = [];
        const matchedPoints1 = new Set();
        const matchedPoints2 = new Set();
       
        // Находим совпадения
        for (const p1 of points1) {
            let bestMatch = null;
            let minDistance = Infinity;
           
            for (const p2 of points2) {
                const distance = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) +
                    Math.pow(p2.y - p1.y, 2)
                );
               
                if (distance < minDistance && distance < threshold) {
                    minDistance = distance;
                    bestMatch = { p1, p2, distance };
                }
            }
           
            if (bestMatch) {
                matches.push(bestMatch);
                matchedPoints1.add(p1.id);
                matchedPoints2.add(bestMatch.p2.id);
            }
        }
       
        // Статистика
        const stats = {
            totalPoints1: points1.length,
            totalPoints2: points2.length,
            matches: matches.length,
            matchedPoints1: matchedPoints1.size,
            matchedPoints2: matchedPoints2.size,
            unmatchedPoints1: points1.length - matchedPoints1.size,
            unmatchedPoints2: points2.length - matchedPoints2.size,
            matchPercentage: ((matches.length / Math.min(points1.length, points2.length)) * 100).toFixed(1)
        };
       
        return { matches, stats };
    }
   
    // Визуализация результатов в консоли
    visualizeComparison(points1, points2, matches, title) {
        console.log(`\n📊 ${title}`);
        console.log('='.repeat(50));
       
        // Создаём простую текстовую визуализацию
        const gridSize = 20;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));
       
        // Нормализуем координаты для сетки 20x20
        const allPoints = [...points1, ...points2];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Функция для преобразования координат в индексы сетки
        const toGrid = (x, y) => {
            const gridX = Math.floor((x - minX) / (maxX - minX) * (gridSize - 1));
            const gridY = Math.floor((y - minY) / (maxY - minY) * (gridSize - 1));
            return {
                x: Math.max(0, Math.min(gridSize - 1, gridX)),
                y: Math.max(0, Math.min(gridSize - 1, gridY))
            };
        };
       
        // Отмечаем точки восьмёрки (O)
        points1.forEach(point => {
            const pos = toGrid(point.x, point.y);
            grid[pos.y][pos.x] = 'O';
        });
       
        // Отмечаем точки шестёрки (X)
        points2.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (grid[pos.y][pos.x] === 'O') {
                grid[pos.y][pos.x] = '●'; // Совпадение
            } else {
                grid[pos.y][pos.x] = 'X';
            }
        });
       
        // Выводим сетку
        console.log('Легенда: O=восьмёрка, X=шестёрка, ●=совпадение');
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
       
        // Статистика по цветам точек
        let redPoints = 0;  // 2+ подтверждений (совпавшие)
        let bluePoints = 0; // 1 подтверждение (несовпавшие в восьмёрке)
       
        // Анализируем какие точки должны быть красными/синими
        const matchedIds = new Set(matches.map(m => m.p1.id));
       
        for (const point of points1) {
            if (matchedIds.has(point.id)) {
                redPoints++;
            } else {
                bluePoints++;
            }
        }
       
        console.log(`\n🎨 Цвета точек для ВОСЬМЁРКИ:`);
        console.log(`   🔴 Красные (2+ подтверждений): ${redPoints} точек`);
        console.log(`   🔵 Синие (1 подтверждение): ${bluePoints} точек`);
        console.log(`   📊 Соотношение: ${((redPoints / points1.length) * 100).toFixed(1)}% красных`);
       
        return { redPoints, bluePoints };
    }
   
    // Запуск теста с различными трансформациями
    runTransformationTests() {
        const tests = [
            { name: "Без трансформации", angle: 0, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Поворот 18°", angle: 18, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Поворот 43°", angle: 43, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Поворот 93°", angle: 93, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Поворот 120°", angle: 120, scale: 1.0, offsetX: 0, offsetY: 0 },
            { name: "Масштаб 0.8x", angle: 0, scale: 0.8, offsetX: 0, offsetY: 0 },
            { name: "Масштаб 1.2x", angle: 0, scale: 1.2, offsetX: 0, offsetY: 0 },
            { name: "Смещение +50,+30", angle: 0, scale: 1.0, offsetX: 50, offsetY: 30 },
            { name: "Комбинированная: 45° + 0.9x + +20,+10", angle: 45, scale: 0.9, offsetX: 20, offsetY: 10 }
        ];
       
        const results = [];
       
        // Базовая восьмёрка
        const baseEight = ShapeGenerator.createFigureEight();
       
        // Базовая шестёрка
        const baseSix = ShapeGenerator.createFigureSix();
       
        console.log('\n🧪 ЗАПУСК ТЕСТОВ С ТРАНСФОРМАЦИЯМИ:');
        console.log('='.repeat(60));
       
        for (const test of tests) {
            console.log(`\n🎯 ТЕСТ: ${test.name}`);
            console.log(`   Угол: ${test.angle}°, Масштаб: ${test.scale}x, Смещение: (${test.offsetX}, ${test.offsetY})`);
           
            // Применяем трансформацию к шестёрке
            const transformedSix = ShapeGenerator.transformPoints(
                baseSix,
                test.angle,
                test.scale,
                test.offsetX,
                test.offsetY
            );
           
            // Анализируем совпадения
            const analysis = this.analyzeMatches(baseEight, transformedSix);
           
            // Визуализируем
            const colors = this.visualizeComparison(
                baseEight,
                transformedSix,
                analysis.matches,
                `Сравнение: восьмёрка vs шестёрка (${test.name})`
            );
           
            // Сохраняем результаты
            results.push({
                test: test.name,
                stats: analysis.stats,
                colors,
                expected: {
                    // Ожидаем ~70-80% совпадений для похожих фигур
                    minMatchPercentage: 70,
                    maxMatchPercentage: 85,
                    // Восьмёрка должна иметь больше точек чем шестёрка
                    eightPointsShouldBeMore: baseEight.length > transformedSix.length
                }
            });
           
            // Проверяем ожидания
            const matchPercent = parseFloat(analysis.stats.matchPercentage);
            console.log(`\n✅ ПРОВЕРКА:`);
            console.log(`   • Процент совпадений: ${matchPercent}%`);
            console.log(`   • Ожидалось: 70-85%`);
           
            if (matchPercent >= 70 && matchPercent <= 85) {
                console.log(`   • ✅ В пределах ожиданий`);
            } else {
                console.log(`   • ⚠️ Вне ожиданий (возможно проблема с трансформацией)`);
            }
           
            console.log(`   • Восьмёрка имеет больше точек: ${baseEight.length > transformedSix.length ? '✅ Да' : '❌ Нет'}`);
        }
       
        return results;
    }
   
    // Сводный отчёт
    generateSummaryReport(results) {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ ПО ВСЕМ ТЕСТАМ:');
        console.log('='.repeat(60));
       
        let passedTests = 0;
        let totalTests = results.length;
       
        results.forEach((result, index) => {
            const matchPercent = parseFloat(result.stats.matchPercentage);
            const expectedMin = result.expected.minMatchPercentage;
            const expectedMax = result.expected.maxMatchPercentage;
           
            const isInRange = matchPercent >= expectedMin && matchPercent <= expectedMax;
            const hasMorePoints = result.expected.eightPointsShouldBeMore;
           
            if (isInRange && hasMorePoints) {
                passedTests++;
                console.log(`✅ ${result.test}: ${matchPercent}% совпадений (ожидалось ${expectedMin}-${expectedMax}%)`);
            } else {
                console.log(`❌ ${result.test}: ${matchPercent}% совпадений (ожидалось ${expectedMin}-${expectedMax}%)`);
                if (!isInRange) console.log(`   ⚠️ Процент совпадений вне ожидаемого диапазона`);
                if (!hasMorePoints) console.log(`   ⚠️ Восьмёрка должна иметь больше точек`);
            }
           
            console.log(`   🔴 Красных точек: ${result.colors.redPoints}, 🔵 Синих: ${result.colors.bluePoints}`);
        });
       
        console.log(`\n🎯 ИТОГО: ${passedTests}/${totalTests} тестов пройдено успешно`);
       
        if (passedTests === totalTests) {
            console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Система корректно определяет совпадения при трансформациях.');
        } else {
            console.log(`⚠️ ЕСТЬ ПРОБЛЕМЫ: ${totalTests - passedTests} тестов не прошли проверку`);
        }
    }
}

// 🚀 Запуск тестов
async function runAllTests() {
    try {
        console.log('🎯 ЗАПУСК КОМПЛЕКСНОГО ТЕСТИРОВАНИЯ СИСТЕМЫ СРАВНЕНИЯ\n');
       
        const analyzer = new ResultAnalyzer();
       
        // 1. Базовый тест без трансформаций
        console.log('\n1. 🔍 БАЗОВЫЙ ТЕСТ (без трансформаций):');
       
        const baseEight = ShapeGenerator.createFigureEight();
        const baseSix = ShapeGenerator.createFigureSix();
       
        const baseAnalysis = analyzer.analyzeMatches(baseEight, baseSix);
        const baseColors = analyzer.visualizeComparison(
            baseEight,
            baseSix,
            baseAnalysis.matches,
            'Базовое сравнение: восьмёрка vs шестёрка'
        );
       
        console.log(`\n📊 БАЗОВАЯ СТАТИСТИКА:`);
        console.log(`   • Всего точек в восьмёрке: ${baseEight.length}`);
        console.log(`   • Всего точек в шестёрке: ${baseSix.length}`);
        console.log(`   • Найдено совпадений: ${baseAnalysis.stats.matches}`);
        console.log(`   • Процент совпадений: ${baseAnalysis.stats.matchPercentage}%`);
        console.log(`   • 🔴 Красных точек (совпавшие): ${baseColors.redPoints}`);
        console.log(`   • 🔵 Синих точек (несовпавшие в восьмёрке): ${baseColors.bluePoints}`);
       
        // 2. Тесты с трансформациями
        console.log('\n2. 🔄 ТЕСТЫ С ТРАНСФОРМАЦИЯМИ:');
       
        const transformationResults = analyzer.runTransformationTests();
       
        // 3. Сводный отчёт
        analyzer.generateSummaryReport([
            { test: 'Базовый тест', stats: baseAnalysis.stats, colors: baseColors, expected: { minMatchPercentage: 70, maxMatchPercentage: 85, eightPointsShouldBeMore: true } },
            ...transformationResults
        ]);
       
        // 4. Проверка логики обновления подтверждений
        console.log('\n3. 🔧 ПРОВЕРКА ЛОГИКИ ОБНОВЛЕНИЯ ПОДТВЕРЖДЕНИЙ:');
       
        // Создаём тестовые отпечатки
        const footprintEight = ShapeGenerator.createFootprint(baseEight, 'Восьмёрка');
        const footprintSix = ShapeGenerator.createFootprint(baseSix, 'Шестёрка');
       
        // Проверяем методы обновления
        const TemplateCoordination = require('./modules/footprint/core/comparison/template-coordination');
       
        // Создаем мок manager для TemplateCoordination
        const mockManager = {
            extractPointsFromFootprint: (footprint) => {
                return Array.from(footprint.pointTracker.points.values());
            }
        };
       
        const coordinator = new TemplateCoordination(mockManager);
       
        // Тестируем updateConfirmationsDirectly
        console.log('\n🔍 Тестируем updateConfirmationsDirectly:');
        const directUpdates = coordinator.updateConfirmationsDirectly(footprintEight, footprintSix);
        console.log(`   • Обновлено точек напрямую: ${directUpdates}`);
       
        // Проверяем статистику подтверждений
        let confirmed2 = 0;
        let confirmed1 = 0;
       
        for (const [, point] of footprintEight.pointTracker.points) {
            if (point.confirmedCount >= 2) {
                confirmed2++;
            } else {
                confirmed1++;
            }
        }
       
        console.log(`\n📊 РЕЗУЛЬТАТ ОБНОВЛЕНИЯ ПОДТВЕРЖДЕНИЙ:`);
        console.log(`   • 🔴 Точки с 2+ подтверждениями: ${confirmed2}`);
        console.log(`   • 🔵 Точки с 1 подтверждением: ${confirmed1}`);
        console.log(`   • Ожидалось: ~${baseAnalysis.stats.matches} красных, ~${baseEight.length - baseAnalysis.stats.matches} синих`);
       
        // Проверяем соответствие
        const expectedRed = baseAnalysis.stats.matches;
        const tolerance = 5; // Допустимая погрешность
       
        if (Math.abs(confirmed2 - expectedRed) <= tolerance) {
            console.log(`✅ Логика обновления подтверждений работает правильно!`);
        } else {
            console.log(`❌ Проблема: получено ${confirmed2} красных точек, ожидалось ~${expectedRed}`);
            console.log(`   Разница: ${Math.abs(confirmed2 - expectedRed)} точек`);
        }
       
        console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
       
    } catch (error) {
        console.error(`❌ Ошибка при выполнении теста: ${error.message}`);
        console.error(error.stack);
    }
}

// Запускаем все тесты
runAllTests();
