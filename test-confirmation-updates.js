// test-confirmation-updates.js
console.log('🧪 Тестирование обновления подтверждений точек...\n');

const fs = require('fs');
const path = require('path');

async function testConfirmationUpdates() {
    try {
        // Создаем тестовые отпечатки
        const SimpleFootprint = require('./modules/footprint/simple-footprint');
       
        // Первый отпечаток
        const footprint1 = new SimpleFootprint({
            userId: 'test_user',
            name: 'Тест отпечаток 1'
        });
       
        // Добавляем тестовые точки
        footprint1.pointTracker = {
            points: new Map([
                ['pt1', { x: 100, y: 100, confirmedCount: 1, confirmedBy: ['photo1'] }],
                ['pt2', { x: 200, y: 200, confirmedCount: 1, confirmedBy: ['photo1'] }],
                ['pt3', { x: 300, y: 300, confirmedCount: 1, confirmedBy: ['photo1'] }]
            ])
        };
       
        // Второй отпечаток (похожий)
        const footprint2 = new SimpleFootprint({
            userId: 'test_user',
            name: 'Тест отпечаток 2'
        });
       
        footprint2.pointTracker = {
            points: new Map([
                ['pt1_match', { x: 110, y: 110, confirmedCount: 1, confirmedBy: ['photo2'] }],
                ['pt2_match', { x: 210, y: 210, confirmedCount: 1, confirmedBy: ['photo2'] }],
                ['pt3_match', { x: 310, y: 310, confirmedCount: 1, confirmedBy: ['photo2'] }]
            ])
        };
       
        console.log('1. Исходное состояние:');
        console.log(`   • Отпечаток 1: ${footprint1.pointTracker.points.size} точек`);
        console.log(`   • Отпечаток 2: ${footprint2.pointTracker.points.size} точек`);
       
        // Проверяем подтверждения
        let stats = {
            footprint1: { confirmed1: 0, confirmed2: 0 },
            footprint2: { confirmed1: 0, confirmed2: 0 }
        };
       
        for (const [, point] of footprint1.pointTracker.points) {
            if (point.confirmedCount >= 2) stats.footprint1.confirmed2++;
            else stats.footprint1.confirmed1++;
        }
       
        console.log(`   • Отпечаток 1: ${stats.footprint1.confirmed2} с 2+ подтверждениями, ${stats.footprint1.confirmed1} с 1 подтверждением`);
       
        // 2. Имитируем совпадение
        console.log('\n2. Имитация совпадения (90%+ схожести):');
       
        // Обновляем подтверждения вручную
        let updates = 0;
        for (const [, point] of footprint1.pointTracker.points) {
            point.confirmedCount = (point.confirmedCount || 1) + 1;
            point.confirmedBy = point.confirmedBy || [];
            point.confirmedBy.push(`match_${Date.now()}`);
            point.lastConfirmed = new Date();
            updates++;
        }
       
        console.log(`   • Обновлено ${updates} точек`);
       
        // 3. Проверяем результат
        console.log('\n3. Результат обновления:');
        stats.footprint1 = { confirmed1: 0, confirmed2: 0, confirmed3: 0 };
       
        for (const [, point] of footprint1.pointTracker.points) {
            if (point.confirmedCount >= 3) stats.footprint1.confirmed3++;
            else if (point.confirmedCount >= 2) stats.footprint1.confirmed2++;
            else stats.footprint1.confirmed1++;
        }
       
        console.log(`   • 3+ подтверждений: ${stats.footprint1.confirmed3} (должны быть 🔵)`);
        console.log(`   • 2 подтверждения: ${stats.footprint1.confirmed2} (должны быть 🔴)`);
        console.log(`   • 1 подтверждение: ${stats.footprint1.confirmed1} (должны быть ⚪️)`);
       
        // 4. Проверяем что точки имеют правильные цвета
        console.log('\n4. Цвета точек:');
        for (const [pointId, point] of footprint1.pointTracker.points) {
            let color = '⚪️';
            if (point.confirmedCount >= 3) color = '🔵';
            else if (point.confirmedCount >= 2) color = '🔴';
           
            console.log(`   • ${pointId}: ${color} (${point.confirmedCount} подтверждений)`);
        }
       
        // 5. Тестируем метод calculateConfirmationStats
        console.log('\n5. Тестирование метода calculateConfirmationStats:');
       
        const SimpleFootprintManager = require('./modules/footprint/simple-manager');
        const manager = new SimpleFootprintManager({
            debug: false,
            enableMergeVisualization: false // Отключаем визуализацию чтобы избежать ошибок с canvas
        });
       
        if (manager.calculateConfirmationStats) {
            const calculatedStats = manager.calculateConfirmationStats(footprint1);
            console.log(`   • Результат:`, calculatedStats);
           
            // Проверяем правильность расчета
            if (calculatedStats.confirmed3 === 3) {
                console.log('   ✅ Все точки имеют 3+ подтверждений - правильно!');
            } else {
                console.log(`   ⚠️ Ожидалось 3 точек с 3+ подтверждениями, но получили ${calculatedStats.confirmed3}`);
            }
        }
       
        console.log('\n✅ Тест завершен!');
       
    } catch (error) {
        console.error(`❌ Ошибка в тесте: ${error.message}`);
        console.error(error.stack);
    }
}

// Запускаем тест
testConfirmationUpdates();
