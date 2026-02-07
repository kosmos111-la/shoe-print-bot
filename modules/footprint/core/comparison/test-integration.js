// modules/footprint/core/comparison/test-integration.js
console.log('🧪 ТЕСТ ИНТЕГРАЦИИ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');

const GeometricHashAlgorithm = require('./geometric-hash-algorithm');
const GeometricComparator = require('./geometric-comparator');
const EnhancedPatternMatcher = require('./enhanced-pattern-matcher');

/**
* 🧪 ТЕСТЕР ИНТЕГРАЦИИ
*/
class IntegrationTester {
    constructor() {
        this.results = [];
    }

    /**
     * ЗАПУСТИТЬ ВСЕ ТЕСТЫ
     */
    async runAllTests() {
        console.log('🚀 ЗАПУСК ТЕСТОВ ИНТЕГРАЦИИ\n');
       
        await this.testGeometricAlgorithm();
        await this.testGeometricComparator();
        await this.testWithMockFootprints();
       
        this.printSummary();
    }

    /**
     * ТЕСТ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА
     */
    async testGeometricAlgorithm() {
        console.log('1️⃣ ТЕСТ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА');
        console.log('='.repeat(50));
       
        const algorithm = new GeometricHashAlgorithm({
            debug: true
        });
       
        // Создаем тестовые фигуры
        const figure1 = this.createTestFigure('eight', 12);
        const figure2 = this.createPartialFigure(figure1, [2, 5, 8]);
       
        // Создаем отпечатки
        const fp1 = algorithm.createFootprint(figure1, 'Полная фигура');
        const fp2 = algorithm.createFootprint(figure2, 'Частичная фигура');
       
        // Сравниваем
        const result = algorithm.compareFootprints(fp1, fp2);
       
        console.log('\n📊 РЕЗУЛЬТАТЫ:');
        console.log(`Совпало точек: ${result.stats.matchedPoints}`);
        console.log(`Полная → Частичная: ${result.stats.percent1to2}%`);
        console.log(`Частичная → Полная: ${result.stats.percent2to1}%`);
       
        this.results.push({
            test: 'Geometric Algorithm',
            success: result.stats.matchedPoints === figure2.length,
            matched: result.stats.matchedPoints,
            expected: figure2.length
        });
    }

    /**
     * ТЕСТ ГЕОМЕТРИЧЕСКОГО КОМПАРАТОРА
     */
    async testGeometricComparator() {
        console.log('\n2️⃣ ТЕСТ ГЕОМЕТРИЧЕСКОГО КОМПАРАТОРА');
        console.log('='.repeat(50));
       
        const mockManager = {
            extractPointsFromFootprint: (footprint) => footprint.points || []
        };
       
        const comparator = new GeometricComparator(mockManager, {
            debug: true
        });
       
        // Создаем мок-следы
        const footprint1 = {
            id: 'test_fp1',
            name: 'Полный след',
            points: this.createTestFigure('eight', 12),
            updatedAt: Date.now()
        };
       
        const footprint2 = {
            id: 'test_fp2',
            name: 'Частичный след',
            points: this.createPartialFigure(footprint1.points, [2, 5, 8]),
            updatedAt: Date.now()
        };
       
        // Сравниваем
        const result = await comparator.compareFootprints(footprint1, footprint2);
       
        console.log('\n📊 РЕЗУЛЬТАТЫ:');
        console.log(`Совпало точек: ${result.stats.matchedPoints}`);
        console.log(`Статистика: ${JSON.stringify(result.stats, null, 2)}`);
       
        this.results.push({
            test: 'Geometric Comparator',
            success: result.stats.matchedPoints === footprint2.points.length,
            matched: result.stats.matchedPoints,
            expected: footprint2.points.length
        });
    }

    /**
     * ТЕСТ С МОК-СЛЕДАМИ
     */
    async testWithMockFootprints() {
        console.log('\n3️⃣ ТЕСТ С МОК-СЛЕДАМИ СИСТЕМЫ');
        console.log('='.repeat(50));
       
        // Создаем мок-менеджер
        const mockManager = {
            extractPointsFromFootprint: (footprint) => {
                if (footprint.getPointsForPatternMatching) {
                    return footprint.getPointsForPatternMatching();
                }
                return footprint.points || [];
            }
        };
       
        // Создаем EnhancedPatternMatcher
        const matcher = new EnhancedPatternMatcher(mockManager, {
            debug: true,
            useGeometricAsPrimary: true
        });
       
        // Создаем мок-следы с интерфейсом системы
        const mockFootprint1 = this.createMockFootprint('test_fp1', 'Полный след', 12);
        const mockFootprint2 = this.createMockFootprint('test_fp2', 'Частичный след', 9, [2, 5, 8]);
       
        // Сравниваем
        const result = await matcher.compare(mockFootprint1, mockFootprint2, {
            updateConfirmations: true
        });
       
        console.log('\n📊 РЕЗУЛЬТАТЫ:');
        console.log(`Алгоритм: ${result.metadata.algorithm}`);
        console.log(`Совпало точек: ${result.stats.matchedPoints}`);
        console.log(`Процент подтверждения: ${result.stats.percent1to2}% → ${result.stats.percent2to1}%`);
       
        // Проверяем обновление подтверждений
        const updatedPoints1 = mockFootprint1.points.filter(p => p.confirmedCount > 1).length;
        const updatedPoints2 = mockFootprint2.points.filter(p => p.confirmedCount > 1).length;
       
        console.log(`Обновлено подтверждений: ${updatedPoints1} в следе 1, ${updatedPoints2} в следе 2`);
       
        this.results.push({
            test: 'Enhanced Pattern Matcher',
            success: result.stats.matchedPoints === mockFootprint2.points.length,
            matched: result.stats.matchedPoints,
            expected: mockFootprint2.points.length,
            confirmationsUpdated: updatedPoints1 + updatedPoints2
        });
    }

    // ============================================
    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    /**
     * СОЗДАТЬ ТЕСТОВУЮ ФИГУРУ
     */
    createTestFigure(type, pointCount) {
        const points = [];
        const a = 100;
        const b = type === 'eight' ? 60 : 50;
       
        for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * 2 * Math.PI;
            const x = a * Math.sin(t);
            const y = b * Math.sin(type === 'eight' ? 2 * t : 1.8 * t);
           
            points.push({
                id: `P${i}`,
                originalId: `P${i}`,
                x: x,
                y: y,
                confirmedCount: 1,
                confirmedBy: ['test'],
                lastConfirmed: new Date()
            });
        }
       
        return points;
    }

    /**
     * СОЗДАТЬ ЧАСТИЧНУЮ ФИГУРУ
     */
    createPartialFigure(original, removeIndices) {
        return original.filter((_, idx) => !removeIndices.includes(idx));
    }

    /**
     * СОЗДАТЬ МОК-СЛЕД
     */
    createMockFootprint(id, name, pointCount, removeIndices = []) {
        const points = this.createTestFigure('eight', pointCount);
       
        if (removeIndices.length > 0) {
            // Удаляем указанные точки
            for (let i = points.length - 1; i >= 0; i--) {
                if (removeIndices.includes(i)) {
                    points.splice(i, 1);
                }
            }
        }
       
        // Создаем мок-след с интерфейсом системы
        const mockFootprint = {
            id: id,
            name: name,
            points: points,
            updatedAt: Date.now(),
           
            // Метод для получения точек (как в системе)
            getPointsForPatternMatching: function() {
                return this.points;
            },
           
            // Point tracker (для совместимости)
            pointTracker: {
                points: new Map(points.map(p => [p.id, p]))
            }
        };
       
        return mockFootprint;
    }

    /**
     * ВЫВЕСТИ СВОДКУ
     */
    printSummary() {
        console.log('\n📈 СВОДКА ТЕСТОВ ИНТЕГРАЦИИ');
        console.log('='.repeat(50));
       
        let passed = 0;
        this.results.forEach((result, idx) => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.test}:`);
            console.log(`   Совпало: ${result.matched} (ожидалось: ${result.expected})`);
           
            if (result.confirmationsUpdated !== undefined) {
                console.log(`   Обновлено подтверждений: ${result.confirmationsUpdated}`);
            }
           
            if (result.success) passed++;
        });
       
        console.log(`\n🎯 ИТОГО: ${passed}/${this.results.length} тестов пройдено`);
       
        if (passed === this.results.length) {
            console.log('🏆 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Алгоритм готов к интеграции!');
        } else {
            console.log('⚠️ Некоторые тесты не пройдены. Требуется доработка.');
        }
    }
}

// ============================================
// 🚀 ЗАПУСК ТЕСТОВ
// ============================================

async function runIntegrationTests() {
    try {
        const tester = new IntegrationTester();
        await tester.runAllTests();
       
        console.log('\n💡 ИНСТРУКЦИЯ ПО ИНТЕГРАЦИИ:');
        console.log('='.repeat(50));
        console.log('1. Скопируйте файлы в папку modules/footprint/core/comparison/');
        console.log('2. В TemplateCoordination замените PatternMatcher на EnhancedPatternMatcher:');
        console.log(`
   // БЫЛО:
   const PatternMatcher = require('./pattern-matcher');
   this.patternMatcher = new PatternMatcher(this);
  
   // СТАЛО:
   const EnhancedPatternMatcher = require('./enhanced-pattern-matcher');
   this.patternMatcher = new EnhancedPatternMatcher(this, {
       debug: true,
       useGeometricAsPrimary: true
   });
        `);
        console.log('3. Протестируйте на реальных данных');
        console.log('4. При необходимости настройте параметры алгоритма');
       
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
    }
}

// Запуск тестов если файл выполняется напрямую
if (require.main === module) {
    runIntegrationTests();
}

module.exports = {
    IntegrationTester,
    runIntegrationTests
};
