// test-full-integration.js
   const SimpleFootprintManager = require('./modules/footprint/simple-manager');
  
   console.log('=== ТЕСТ ПОЛНОЙ ИНТЕГРАЦИИ ===\n');
  
   try {
       const manager = new SimpleFootprintManager({
           debug: true,
           alignmentMethod: 'procrustes'
       });
  
       console.log('✅ SimpleFootprintManager создан');
      
       // Тест новых методов
       console.log('\n🔍 Тест новых методов:');
      
       const testPoints = [
           { x: 100, y: 100 },
           { x: 200, y: 100 },
           { x: 150, y: 200 }
       ];
      
       const reference = [
           { x: 120, y: 110 },
           { x: 220, y: 110 },
           { x: 170, y: 210 }
       ];
      
       // Тест новой системы выравнивания
       const aligned = manager.alignPoints(testPoints, reference);
       console.log(`✅ Выровнено: ${aligned.length} точек`);
      
       const validation = manager.validateAlignment(aligned, reference, 20);
       console.log(`✅ Валидация: ${validation.valid ? 'OK' : 'FAIL'}`);
      
       console.log('\n=== ТЕСТ УСПЕШНО ЗАВЕРШЁН ===');
      
   } catch (error) {
       console.log(`❌ Ошибка: ${error.message}`);
       console.error(error.stack);
   }
