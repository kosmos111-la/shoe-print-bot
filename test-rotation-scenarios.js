// test-rotation-scenarios.js
// ТЕСТЫ ДЛЯ ПРОВЕРКИ ПОВОРОТНОЙ ИНВАРИАНТНОСТИ ДЛЯ ПРОДАКШЕНА

const RotationInvariance = require('./modules/footprint/rotation-invariance');
const MirrorDetection = require('./modules/footprint/mirror-detection');
const SimpleGraph = require('./modules/footprint/simple-graph');

class RotationScenariosTest {
    constructor() {
        this.rotationProcessor = new RotationInvariance({ debug: true });
        this.mirrorDetector = new MirrorDetection({ debug: true });
       
        this.testResults = {
            passed: 0,
            failed: 0,
            scenarios: []
        };
       
        console.log('🧪 RotationScenariosTest инициализирован');
    }

    // ТЕСТ 1: Автоопределение угла поворота
    async testAutoRotationDetection() {
        console.log('\n🔍 ТЕСТ 1: Автоопределение угла поворота');
       
        const scenarios = [
            { angle: 0, name: 'Без поворота' },
            { angle: 15, name: 'Малый поворот' },
            { angle: 45, name: 'Средний поворот' },
            { angle: 90, name: 'Поворот 90°' },
            { angle: 135, name: 'Поворот 135°' },
            { angle: 180, name: 'Поворот 180°' }
        ];
       
        const originalGraph = this.createTestGraph('Тестовый след', 30);
       
        for (const scenario of scenarios) {
            console.log(`\n📐 Тестируем: ${scenario.name} (${scenario.angle}°)`);
           
            // Создаем повёрнутый граф
            const rotatedGraph = this.rotateTestGraph(originalGraph, scenario.angle);
           
            // Определяем угол
            const points = this.rotationProcessor.extractPointsFromGraph(rotatedGraph);
            const detectedAngle = this.rotationProcessor.detectRotationAngle(points);
           
            // Допустимая погрешность
            const angleError = Math.abs(detectedAngle - scenario.angle);
            const angleErrorNormalized = Math.min(angleError, 360 - angleError);
            const passed = angleErrorNormalized <= 10; // Допуск ±10°
           
            const result = {
                test: 'AutoRotationDetection',
                scenario: scenario.name,
                expectedAngle: scenario.angle,
                detectedAngle: detectedAngle,
                angleError: angleErrorNormalized,
                passed: passed,
                points: points.length
            };
           
            this.recordTestResult(result);
           
            console.log(`   Ожидаемый угол: ${scenario.angle}°`);
            console.log(`   Определённый угол: ${detectedAngle.toFixed(1)}°`);
            console.log(`   Погрешность: ${angleErrorNormalized.toFixed(1)}°`);
            console.log(`   Результат: ${passed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`);
        }
    }

    // ТЕСТ 2: Нормализация к канонической ориентации
    async testCanonicalNormalization() {
        console.log('\n🔍 ТЕСТ 2: Нормализация к канонической ориентации');
       
        const angles = [0, 30, 60, 90, 120, 150, 180];
       
        for (const angle of angles) {
            console.log(`\n🔄 Тестируем нормализацию с угла ${angle}°`);
           
            // Создаем и поворачиваем граф
            const originalGraph = this.createTestGraph(`След_${angle}°`, 25);
            const rotatedGraph = this.rotateTestGraph(originalGraph, angle);
           
            // Нормализуем
            const normalizationResult = this.rotationProcessor.normalizeToCanonical(rotatedGraph, {
                testAngle: angle
            });
           
            // Проверяем, что после нормализации угол близок к 0°
            const normalizedPoints = this.rotationProcessor.extractPointsFromGraph(
                normalizationResult.graph
            );
            const finalAngle = this.rotationProcessor.detectRotationAngle(normalizedPoints);
           
            // Угол должен быть близок к 0° или 180° (зеркальное отражение)
            const angleToCheck = Math.abs(finalAngle) < 90 ? Math.abs(finalAngle) :
                               Math.abs(180 - Math.abs(finalAngle));
            const passed = angleToCheck <= 15; // Допуск ±15°
           
            const result = {
                test: 'CanonicalNormalization',
                scenario: `Нормализация с ${angle}°`,
                originalAngle: angle,
                normalizedAngle: finalAngle,
                angleToCheck: angleToCheck,
                passed: passed,
                isMirrored: normalizationResult.isMirrored,
                graphNodes: normalizedPoints.length
            };
           
            this.recordTestResult(result);
           
            console.log(`   Исходный угол: ${angle}°`);
            console.log(`   После нормализации: ${finalAngle.toFixed(1)}°`);
            console.log(`   Зеркало: ${normalizationResult.isMirrored ? 'да' : 'нет'}`);
            console.log(`   Результат: ${passed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`);
        }
    }

    // ТЕСТ 3: Определение левого/правого следа
    async testFootTypeDetection() {
        console.log('\n🔍 ТЕСТ 3: Определение левого/правого следа');
       
        // Создаем "правый" след (носок вправо)
        const rightFootGraph = this.createAsymmetricGraph('Правый след', 'right');
       
        // Создаем "левый" след (носок влево)
        const leftFootGraph = this.createAsymmetricGraph('Левый след', 'left');
       
        // Зеркалим правый след, чтобы получить левый
        const mirroredRightGraph = this.mirrorDetector.mirrorGraph(rightFootGraph, 'vertical');
       
        const testCases = [
            { graph: rightFootGraph, expectedType: 'right', name: 'Правый след' },
            { graph: leftFootGraph, expectedType: 'left', name: 'Левый след' },
            { graph: mirroredRightGraph, expectedType: 'left', name: 'Зеркальный правый' }
        ];
       
        for (const testCase of testCases) {
            console.log(`\n🦶 Тестируем: ${testCase.name}`);
           
            const detection = this.mirrorDetector.detectFootType(testCase.graph);
           
            const passed = detection.footType === testCase.expectedType &&
                          detection.confidence > 0.5;
           
            const result = {
                test: 'FootTypeDetection',
                scenario: testCase.name,
                expectedType: testCase.expectedType,
                detectedType: detection.footType,
                confidence: detection.confidence,
                passed: passed,
                points: this.rotationProcessor.extractPointsFromGraph(testCase.graph).length
            };
           
            this.recordTestResult(result);
           
            console.log(`   Ожидаемый тип: ${testCase.expectedType}`);
            console.log(`   Определённый тип: ${detection.footType}`);
            console.log(`   Уверенность: ${detection.confidence.toFixed(3)}`);
            console.log(`   Результат: ${passed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`);
        }
    }

    // ТЕСТ 4: Сравнение с поворотной инвариантностью
    async testRotationInvariantComparison() {
        console.log('\n🔍 ТЕСТ 4: Сравнение с поворотной инвариантностью');
       
        const baseGraph = this.createTestGraph('Базовый след', 30);
       
        const scenarios = [
            { angle: 0, mirrored: false, expected: 'same', name: 'Без изменений' },
            { angle: 45, mirrored: false, expected: 'same', name: 'Поворот 45°' },
            { angle: 90, mirrored: false, expected: 'same', name: 'Поворот 90°' },
            { angle: 0, mirrored: true, expected: 'same', name: 'Зеркальное отражение' },
            { angle: 45, mirrored: true, expected: 'same', name: 'Поворот + зеркало' }
        ];
       
        for (const scenario of scenarios) {
            console.log(`\n🔁 Тестируем: ${scenario.name}`);
           
            // Создаем модифицированный граф
            let modifiedGraph = baseGraph;
           
            if (scenario.angle !== 0) {
                modifiedGraph = this.rotateTestGraph(modifiedGraph, scenario.angle);
            }
           
            if (scenario.mirrored) {
                modifiedGraph = this.mirrorDetector.mirrorGraph(modifiedGraph, 'vertical');
            }
           
            // Сравниваем с поворотной инвариантностью
            const comparison = this.rotationProcessor.compareWithAllMethods(
                baseGraph,
                modifiedGraph,
                { scenario: scenario.name }
            );
           
            const passed = comparison.decision === scenario.expected &&
                          comparison.similarity > 0.7;
           
            const result = {
                test: 'RotationInvariantComparison',
                scenario: scenario.name,
                angle: scenario.angle,
                mirrored: scenario.mirrored,
                expectedDecision: scenario.expected,
                actualDecision: comparison.decision,
                similarity: comparison.similarity,
                passed: passed,
                processingTime: comparison.processingTime
            };
           
            this.recordTestResult(result);
           
            console.log(`   Ожидаемое решение: ${scenario.expected}`);
            console.log(`   Полученное решение: ${comparison.decision}`);
            console.log(`   Схожесть: ${comparison.similarity.toFixed(3)}`);
            console.log(`   Время обработки: ${comparison.processingTime}мс`);
            console.log(`   Результат: ${passed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`);
        }
    }

    // ТЕСТ 5: Реальный сценарий - сборка супер-модели из разных ракурсов
    async testMultiAngleSuperModel() {
        console.log('\n🔍 ТЕСТ 5: Сборка супер-модели из разных ракурсов');
       
        const angles = [0, 30, 60, 90, 120, 150, 180];
        const graphs = [];
       
        // Создаем графы под разными углами
        for (const angle of angles) {
            const baseGraph = this.createTestGraph(`След_${angle}°`, 25);
            const rotatedGraph = this.rotateTestGraph(baseGraph, angle);
           
            // Нормализуем каждый граф к канонической ориентации
            const normalized = this.rotationProcessor.normalizeToCanonical(rotatedGraph, {
                originalAngle: angle
            });
           
            graphs.push(normalized.graph);
        }
       
        // Проверяем, что все нормализованные графы схожи
        let allSimilar = true;
        let minSimilarity = 1;
        let comparisons = [];
       
        for (let i = 0; i < graphs.length; i++) {
            for (let j = i + 1; j < graphs.length; j++) {
                const comparison = this.rotationProcessor.compareWithAllMethods(
                    graphs[i],
                    graphs[j],
                    { test: 'multi_angle' }
                );
               
                comparisons.push({
                    graph1: i,
                    graph2: j,
                    similarity: comparison.similarity,
                    decision: comparison.decision
                });
               
                if (comparison.decision !== 'same' || comparison.similarity < 0.7) {
                    allSimilar = false;
                }
               
                minSimilarity = Math.min(minSimilarity, comparison.similarity);
            }
        }
       
        const passed = allSimilar && minSimilarity > 0.65;
       
        const result = {
            test: 'MultiAngleSuperModel',
            scenario: 'Сборка из 7 ракурсов',
            numberOfGraphs: graphs.length,
            allSimilar: allSimilar,
            minSimilarity: minSimilarity,
            passed: passed,
            comparisons: comparisons.length,
            avgSimilarity: comparisons.reduce((sum, c) => sum + c.similarity, 0) / comparisons.length
        };
       
        this.recordTestResult(result);
       
        console.log(`   Количество графов: ${graphs.length}`);
        console.log(`   Все графы схожи: ${allSimilar ? 'да' : 'нет'}`);
        console.log(`   Минимальная схожесть: ${minSimilarity.toFixed(3)}`);
        console.log(`   Средняя схожесть: ${result.avgSimilarity.toFixed(3)}`);
        console.log(`   Результат: ${passed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`);
    }

    // ТЕСТ 6: Производительность
    async testPerformance() {
        console.log('\n🔍 ТЕСТ 6: Производительность обработки');
       
        const sizes = [10, 20, 30, 50, 100];
        const results = [];
       
        for (const size of sizes) {
            console.log(`\n⚡ Тестируем производительность для ${size} точек`);
           
            const graph = this.createTestGraph(`Перф_тест_${size}`, size);
           
            // Тест нормализации
            const startNormalize = Date.now();
            const normalized = this.rotationProcessor.normalizeToCanonical(graph);
            const normalizeTime = Date.now() - startNormalize;
           
            // Тест сравнения
            const rotatedGraph = this.rotateTestGraph(graph, 45);
            const startCompare = Date.now();
            const comparison = this.rotationProcessor.compareWithAllMethods(graph, rotatedGraph);
            const compareTime = Date.now() - startCompare;
           
            results.push({
                size: size,
                normalizeTime: normalizeTime,
                compareTime: compareTime,
                totalTime: normalizeTime + compareTime,
                similarity: comparison.similarity
            });
           
            console.log(`   Нормализация: ${normalizeTime}мс`);
            console.log(`   Сравнение: ${compareTime}мс`);
            console.log(`   Всего: ${normalizeTime + compareTime}мс`);
            console.log(`   Схожесть: ${comparison.similarity.toFixed(3)}`);
        }
       
        // Проверяем, что время обработки растет не слишком быстро
        const timeGrowth = results[results.length-1].totalTime / results[0].totalTime;
        const pointGrowth = sizes[sizes.length-1] / sizes[0];
        const acceptableGrowth = pointGrowth * 2; // Допустимый рост в 2 раза быстрее роста точек
       
        const passed = timeGrowth < acceptableGrowth;
       
        const result = {
            test: 'Performance',
            scenario: 'Рост времени обработки',
            sizes: sizes,
            results: results,
            timeGrowth: timeGrowth,
            pointGrowth: pointGrowth,
            acceptableGrowth: acceptableGrowth,
            passed: passed
        };
       
        this.recordTestResult(result);
       
        console.log(`\n📈 Анализ производительности:`);
        console.log(`   Рост точек: ${pointGrowth.toFixed(1)}x`);
        console.log(`   Рост времени: ${timeGrowth.toFixed(1)}x`);
        console.log(`   Допустимый рост: ${acceptableGrowth.toFixed(1)}x`);
        console.log(`   Результат: ${passed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`);
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    createTestGraph(name, pointCount = 30) {
        const graph = new SimpleGraph(name);
        const points = [];
       
        // Создаем точки в форме следа
        for (let i = 0; i < pointCount; i++) {
            // Форма эллипса с некоторой случайностью
            const angle = (i / pointCount) * Math.PI * 2;
            const radiusX = 150 + Math.random() * 50;
            const radiusY = 80 + Math.random() * 30;
           
            const x = 300 + Math.cos(angle) * radiusX + (Math.random() - 0.5) * 20;
            const y = 300 + Math.sin(angle) * radiusY + (Math.random() - 0.5) * 20;
           
            points.push({
                x: x,
                y: y,
                confidence: 0.7 + Math.random() * 0.3
            });
        }
       
        graph.buildFromPoints(points);
        return graph;
    }
   
    createAsymmetricGraph(name, footType = 'right') {
        const graph = new SimpleGraph(name);
        const points = [];
       
        const pointCount = 25;
        const asymmetry = footType === 'right' ? 1 : -1;
       
        for (let i = 0; i < pointCount; i++) {
            const t = i / pointCount;
           
            // Асимметричная форма для правого/левого следа
            let x, y;
           
            if (t < 0.3) {
                // Пятка - более симметричная
                x = 300 + (Math.random() - 0.5) * 60;
                y = 400 + (Math.random() - 0.5) * 40;
            } else if (t < 0.7) {
                // Центр - умеренная асимметрия
                x = 400 + asymmetry * (20 + Math.random() * 20);
                y = 300 + (Math.random() - 0.5) * 60;
            } else {
                // Носок - сильная асимметрия
                x = 500 + asymmetry * (40 + Math.random() * 30);
                y = 200 + (Math.random() - 0.5) * 40;
            }
           
            points.push({
                x: x + (Math.random() - 0.5) * 15,
                y: y + (Math.random() - 0.5) * 15,
                confidence: 0.8
            });
        }
       
        graph.buildFromPoints(points);
        return graph;
    }
   
    rotateTestGraph(graph, angleDeg) {
        const angleRad = angleDeg * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        const points = this.rotationProcessor.extractPointsFromGraph(graph);
        const center = this.rotationProcessor.calculateCenter(points);
       
        const rotatedGraph = new SimpleGraph(`${graph.name} (повёрнутый на ${angleDeg}°)`);
       
        graph.nodes.forEach((node, nodeId) => {
            let x = node.x - center.x;
            let y = node.y - center.y;
           
            let rotatedX = x * cosA - y * sinA;
            let rotatedY = x * sinA + y * cosA;
           
            rotatedX += center.x;
            rotatedY += center.y;
           
            rotatedGraph.addNode(
                { x: rotatedX, y: rotatedY },
                node.confidence || 0.5
            );
        });
       
        this.mirrorDetector.rebuildEdges(rotatedGraph);
       
        return rotatedGraph;
    }
   
    recordTestResult(result) {
        this.testResults.scenarios.push(result);
       
        if (result.passed) {
            this.testResults.passed++;
        } else {
            this.testResults.failed++;
        }
    }
   
    runAllTests() {
        console.log('🚀 ЗАПУСК ВСЕХ ТЕСТОВ ПОВОРОТНОЙ ИНВАРИАНТНОСТИ\n');
       
        const tests = [
            this.testAutoRotationDetection.bind(this),
            this.testCanonicalNormalization.bind(this),
            this.testFootTypeDetection.bind(this),
            this.testRotationInvariantComparison.bind(this),
            this.testMultiAngleSuperModel.bind(this),
            this.testPerformance.bind(this)
        ];
       
        return new Promise(async (resolve) => {
            for (let i = 0; i < tests.length; i++) {
                try {
                    await tests[i]();
                } catch (error) {
                    console.log(`❌ Ошибка в тесте ${i + 1}:`, error.message);
                    this.testResults.failed++;
                }
            }
           
            this.printSummary();
            resolve(this.testResults);
        });
    }
   
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГОВЫЙ ОТЧЕТ ТЕСТИРОВАНИЯ ПОВОРОТНОЙ ИНВАРИАНТНОСТИ');
        console.log('='.repeat(60));
       
        console.log(`\n✅ ПРОЙДЕНО: ${this.testResults.passed}`);
        console.log(`❌ ПРОВАЛЕНО: ${this.testResults.failed}`);
        console.log(`📈 ОБЩАЯ УСПЕШНОСТЬ: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
       
        console.log('\n📋 РЕЗУЛЬТАТЫ ПО ТЕСТАМ:');
        this.testResults.scenarios.forEach((result, i) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.test}: ${result.scenario} - ${result.passed ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);
        });
       
        console.log('\n🎯 ВЫВОДЫ:');
       
        if (this.testResults.passed >= this.testResults.scenarios.length * 0.8) {
            console.log('✅ Система готова к продакшену! Поворотная инвариантность работает.');
            console.log('🎯 Рекомендации:');
            console.log('   1. Интегрировать RotationInvariance в SimpleManager');
            console.log('   2. Добавить автоопределение ориентации при добавлении фото');
            console.log('   3. Использовать инвариантное сравнение для всех операций');
        } else if (this.testResults.passed >= this.testResults.scenarios.length * 0.6) {
            console.log('⚠️ Система требует доработки. Некоторые тесты провалены.');
            console.log('🎯 Рекомендации:');
            console.log('   1. Проанализировать проваленные тесты');
            console.log('   2. Улучшить алгоритмы определения угла');
            console.log('   3. Добавить больше тестовых сценариев');
        } else {
            console.log('❌ Система не готова. Требуется серьёзная доработка.');
            console.log('🎯 Рекомендации:');
            console.log('   1. Пересмотреть архитектуру инвариантности');
            console.log('   2. Улучшить методы PCA и определения ориентации');
            console.log('   3. Протестировать на реальных данных');
        }
       
        console.log('\n🚀 СЛЕДУЮЩИЕ ШАГИ:');
        console.log('   1. Интеграция с существующей системой');
        console.log('   2. Тестирование на реальных фото с телефона');
        console.log('   3. Оптимизация производительности');
        console.log('   4. Добавление визуализации поворота в боте');
    }
}

// Запуск тестов
if (require.main === module) {
    const testRunner = new RotationScenariosTest();
    testRunner.runAllTests().then(results => {
        console.log('\n🏁 Тестирование завершено');
        process.exit(results.failed === 0 ? 0 : 1);
    }).catch(error => {
        console.error('❌ Ошибка при запуске тестов:', error);
        process.exit(1);
    });
}

module.exports = RotationScenariosTest;
