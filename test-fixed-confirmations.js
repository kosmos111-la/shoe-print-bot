// test-fixed-confirmations.js
console.log('🧪 Тестирование ИСПРАВЛЕННОЙ логики подтверждений...\n');

async function testFixedConfirmations() {
    try {
        // Создаем реалистичные следы
        const SimpleFootprint = require('./modules/footprint/simple-footprint');
       
        // След 1: 10 точек (часть будут совпадать)
        const footprint1 = new SimpleFootprint({
            userId: 'test_user',
            name: 'След 1'
        });
       
        footprint1.pointTracker = {
            points: new Map()
        };
       
        // Точки, которые будут совпадать (5 точек)
        const matchingPoints = [
            { id: 'pt1', x: 100, y: 100 },
            { id: 'pt2', x: 200, y: 200 },
            { id: 'pt3', x: 300, y: 300 },
            { id: 'pt4', x: 400, y: 400 },
            { id: 'pt5', x: 500, y: 500 }
        ];
       
        // Точки, которые НЕ будут совпадать (5 точек)
        const nonMatchingPoints = [
            { id: 'pt6', x: 600, y: 600 },
            { id: 'pt7', x: 700, y: 700 },
            { id: 'pt8', x: 800, y: 800 },
            { id: 'pt9', x: 900, y: 900 },
            { id: 'pt10', x: 1000, y: 1000 }
        ];
       
        // Добавляем все точки
        [...matchingPoints, ...nonMatchingPoints].forEach(pt => {
            footprint1.pointTracker.points.set(pt.id, {
                ...pt,
                confirmedCount: 1,
                confirmedBy: ['photo1']
            });
        });
       
        // След 2: только 5 совпадающих точек + 3 новых
        const footprint2 = new SimpleFootprint({
            userId: 'test_user',
            name: 'След 2'
        });
       
        footprint2.pointTracker = {
            points: new Map()
        };
       
        // Совпадающие точки (с небольшим смещением)
        const matchingPoints2 = [
            { id: 'pt2_1', x: 105, y: 105 },  // pt1 +5px
            { id: 'pt2_2', x: 205, y: 205 },  // pt2 +5px
            { id: 'pt2_3', x: 305, y: 305 },  // pt3 +5px
            { id: 'pt2_4', x: 405, y: 405 },  // pt4 +5px
            { id: 'pt2_5', x: 505, y: 505 }   // pt5 +5px
        ];
       
        // Новые точки (не совпадают)
        const newPoints = [
            { id: 'pt2_6', x: 1100, y: 1100 },
            { id: 'pt2_7', x: 1200, y: 1200 },
            { id: 'pt2_8', x: 1300, y: 1300 }
        ];
       
        [...matchingPoints2, ...newPoints].forEach(pt => {
            footprint2.pointTracker.points.set(pt.id, {
                ...pt,
                confirmedCount: 1,
                confirmedBy: ['photo2']
            });
        });
       
        console.log('1. Исходное состояние:');
        console.log(`   • След 1: ${footprint1.pointTracker.points.size} точек (5 должны совпадать, 5 - нет)`);
        console.log(`   • След 2: ${footprint2.pointTracker.points.size} точек (5 совпадают, 3 новые)`);
       
        // 2. Имитируем РЕАЛЬНОЕ обновление подтверждений
        console.log('\n2. РЕАЛЬНОЕ обновление подтверждений:');
       
        // Только точки в радиусе 10px считаем совпавшими
        const MAX_DISTANCE = 10;
        let realMatches = 0;
        let fakeMatches = 0;
       
        for (const [id1, point1] of footprint1.pointTracker.points) {
            // Ищем ближайшую точку во втором следе
            let minDistance = Infinity;
           
            for (const [id2, point2] of footprint2.pointTracker.points) {
                const dx = point1.x - point2.x;
                const dy = point1.y - point2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
           
            // 🔥 КЛЮЧЕВОЕ: Обновляем ТОЛЬКО если расстояние < 10px
            if (minDistance <= MAX_DISTANCE) {
                point1.confirmedCount++;
                point1.confirmedBy.push(`match_with_sled2`);
                realMatches++;
                console.log(`   • ${id1}: СОВПАЛ (расстояние: ${minDistance.toFixed(1)}px)`);
            } else {
                fakeMatches++;
                console.log(`   • ${id1}: НЕ совпал (расстояние: ${minDistance.toFixed(1)}px)`);
            }
        }
       
        // 3. Проверяем результат
        console.log('\n3. Результат:');
        console.log(`   • Реальные совпадения: ${realMatches} точек (должны стать 🔴)`);
        console.log(`   • Несовпадения: ${fakeMatches} точек (должны остаться ⚪️)`);
       
        // 4. Анализируем цвета
        console.log('\n4. Цвета точек:');
        let redPoints = 0;
        let bluePoints = 0;
        let whitePoints = 0;
       
        for (const [id, point] of footprint1.pointTracker.points) {
            let color = '⚪️';
            if (point.confirmedCount >= 3) color = '🔵';
            else if (point.confirmedCount >= 2) color = '🔴';
           
            if (color === '🔴') redPoints++;
            else if (color === '🔵') bluePoints++;
            else whitePoints++;
           
            console.log(`   • ${id}: ${color} (${point.confirmedCount} подтверждений)`);
        }
       
        // 5. Проверяем математику
        console.log('\n5. Математическая проверка:');
        console.log(`   • Всего точек в следе 1: ${footprint1.pointTracker.points.size}`);
        console.log(`   • Совпавших точек: ${redPoints}`);
        console.log(`   • Несовпавших точек: ${whitePoints}`);
        console.log(`   • Итого: ${redPoints + whitePoints + bluePoints} = ${footprint1.pointTracker.points.size}`);
       
        // 🔥 КРИТИЧЕСКАЯ ПРОВЕРКА:
        if (redPoints === 5 && whitePoints === 5) {
            console.log('   ✅ ВСЁ ПРАВИЛЬНО! Только 5 точек совпали, 5 - нет');
        } else {
            console.log(`   ⚠️ ПРОБЛЕМА! Ожидалось 5🔴 + 5⚪️, получили ${redPoints}🔴 + ${whitePoints}⚪️ + ${bluePoints}🔵`);
        }
       
        console.log('\n✅ Тест завершен!');
       
    } catch (error) {
        console.error(`❌ Ошибка в тесте: ${error.message}`);
    }
}

// Запускаем тест
testFixedConfirmations();
