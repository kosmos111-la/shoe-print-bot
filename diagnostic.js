// diagnostic.js - Исправленные пути
const fs = require('fs');
const path = require('path');

class SystemDiagnostic {
    constructor() {
        this.checks = [];
        this.results = [];
        this.basePath = path.join(__dirname, 'modules/footprint');
    }
   
    addCheck(name, checkFn) {
        this.checks.push({ name, check: checkFn });
    }
   
    async run() {
        console.log('🔍 ДИАГНОСТИКА СИСТЕМЫ СРАВНЕНИЯ СЛЕДОВ\n');
       
        for (const check of this.checks) {
            try {
                console.log(`\n🧪 Проверка: ${check.name}`);
                const result = await check.check();
                this.results.push({
                    name: check.name,
                    success: result.success,
                    message: result.message,
                    details: result.details
                });
               
                console.log(`   ${result.success ? '✅ УСПЕХ' : '❌ ОШИБКА'}: ${result.message}`);
                if (result.details) {
                    console.log(`   Детали: ${result.details}`);
                }
            } catch (error) {
                console.log(`   ❌ ИСКЛЮЧЕНИЕ: ${error.message}`);
                this.results.push({
                    name: check.name,
                    success: false,
                    message: `Исключение: ${error.message}`
                });
            }
        }
       
        this.printSummary();
    }
   
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 СВОДКА ДИАГНОСТИКИ:');
       
        const passed = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
       
        console.log(`✅ Успешно: ${passed} из ${this.checks.length}`);
        console.log(`❌ Ошибок: ${failed} из ${this.checks.length}`);
       
        if (failed > 0) {
            console.log('\n⚠️ ПРОБЛЕМЫ:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.name}: ${r.message}`));
        }
       
        console.log('\n' + '='.repeat(60));
    }
}

// Запускаем диагностику
async function runDiagnostics() {
    const diagnostic = new SystemDiagnostic();
   
    // 1. Проверка модулей
    // 1. Проверка модулей - ИСПРАВЛЕННЫЕ ПУТИ
    diagnostic.addCheck('Загрузка модулей', () => {
        const modules = [
            'simple-footprint',
            'core/comparison/footprint-comparison-engine',
            'core/comparison/template-coordination',
            'vector-super-model',
            'rotation-invariance'
        ];
       
        const loaded = [];
        const failed = [];
       
        modules.forEach(modulePath => {
            try {
                const fullPath = path.join(__dirname, 'modules/footprint', modulePath);
                require(fullPath);
                loaded.push(modulePath.split('/').pop()); // берем только имя файла
            } catch (e) {
                failed.push(`${modulePath}: ${e.message.split('\n')[0]}`);
            }
        });
       
        return {
            success: failed.length === 0,
            message: `Загружено ${loaded.length}/${modules.length} модулей`,
            details: failed.length > 0 ? failed.join(', ') : 'Все модули загружены'
        };
    });
   
    // 2. Проверка метода нормализации
    diagnostic.addCheck('Нормализация координат', () => {
        const SimpleFootprint = require('./modules/footprint/simple-footprint');
        const footprint = new SimpleFootprint({ name: 'Диагностический след' });
       
        // Добавляем тестовые точки
        footprint.pointTracker.processNewPoints([
            { x: 100, y: 100, confidence: 0.8 },
            { x: 200, y: 200, confidence: 0.7 }
        ], { photoId: 'diagnostic' });
       
        footprint.transformation = {
            rotationAngle: 45,
            center: { x: 150, y: 150 },
            type: 'diagnostic'
        };
       
        const normalized = footprint.getPointsInNormalizedSystem();
       
        if (normalized.length !== 2) {
            return {
                success: false,
                message: `Ожидалось 2 точки, получено ${normalized.length}`
            };
        }
       
        // Проверяем, что точки не стали (0, 0)
        const hasZeroPoints = normalized.some(p => p.x === 0 && p.y === 0);
       
        return {
            success: !hasZeroPoints,
            message: `Нормализовано ${normalized.length} точек`,
            details: hasZeroPoints ? 'Есть точки (0, 0)' : 'Координаты корректны'
        };
    });
   
    // 3. Проверка сравнения
    diagnostic.addCheck('Сравнение следов', async () => {
        const SimpleFootprint = require('./modules/footprint/simple-footprint');
       
        const fp1 = new SimpleFootprint({ name: 'След A' });
        const fp2 = new SimpleFootprint({ name: 'След B' });
       
        // Одинаковые точки (немного смещенные)
        fp1.pointTracker.processNewPoints([
            { x: 100, y: 100, confidence: 0.8 },
            { x: 150, y: 150, confidence: 0.7 },
            { x: 200, y: 200, confidence: 0.9 }
        ], { photoId: 'test1' });
       
        fp2.pointTracker.processNewPoints([
            { x: 105, y: 105, confidence: 0.8 },
            { x: 155, y: 155, confidence: 0.7 },
            { x: 205, y: 205, confidence: 0.9 }
        ], { photoId: 'test2' });
       
        const result = fp1.compare(fp2);
       
        if (result.error) {
            return {
                success: false,
                message: `Ошибка сравнения: ${result.error}`
            };
        }
       
        const hasSimilarity = typeof result.similarity === 'number';
        const hasDecision = ['same', 'similar', 'different'].includes(result.decision);
       
        return {
            success: hasSimilarity && hasDecision,
            message: `Сходство: ${result.similarity?.toFixed(3)}, решение: ${result.decision}`,
            details: !hasSimilarity ? 'Нет значения сходства' :
                     !hasDecision ? 'Некорректное решение' : 'Сравнение работает'
        };
    });
   
    // 4. Проверка статистики
    diagnostic.addCheck('Статистика совпадений', () => {
        const SimpleFootprint = require('./modules/footprint/simple-footprint');
        const footprint = new SimpleFootprint({ name: 'Статистический след' });
       
        // Добавляем точки с разными подтверждениями
        const tracker = footprint.pointTracker;
       
        // Точка с 1 подтверждением
        tracker.processNewPoints([{ x: 100, y: 100, confidence: 0.8 }], { photoId: 'photo1' });
       
        // Точка с 2 подтверждениями
        tracker.processNewPoints([{ x: 200, y: 200, confidence: 0.9 }], { photoId: 'photo2' });
        tracker.processNewPoints([{ x: 200, y: 200, confidence: 0.9 }], { photoId: 'photo3' });
       
        const stats = tracker.getStats();
       
        const hasTotalPoints = stats.totalPoints > 0;
        const hasAvgConfirmations = typeof stats.avgConfirmations === 'number';
       
        return {
            success: hasTotalPoints && hasAvgConfirmations,
            message: `Всего точек: ${stats.totalPoints}, среднее подтверждений: ${stats.avgConfirmations?.toFixed(2)}`,
            details: !hasTotalPoints ? 'Нет статистики точек' :
                     !hasAvgConfirmations ? 'Нет среднего подтверждений' : 'Статистика корректна'
        };
    });
   
    await diagnostic.run();
}

// Запуск
runDiagnostics().catch(console.error);
