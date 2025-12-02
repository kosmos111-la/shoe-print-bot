// test-full-system.js
const { EnhancedSessionManager } = require('./modules/session/enhanced-manager.js');
const { ModelVisualizer } = require('./modules/visualization/model-visualizer.js');

async function testFullSystem() {
  console.log('🧪 ТЕСТ ПОЛНОЙ СИСТЕМЫ АККУМУЛЯТИВНОГО АНАЛИЗА\n');
 
  // 1. Создаём менеджер
  const manager = new EnhancedSessionManager();
  const visualizer = new ModelVisualizer();
 
  // 2. Создаём сессию
  const session = manager.createEnhancedSession('test_user_123');
  console.log('✅ Сессия создана:', session.sessionId);
 
  // 3. Симулируем добавление 4 фото
  const mockPhotos = [
    { id: 'photo1', predictions: generateMockData(15) },
    { id: 'photo2', predictions: generateMockData(12, 0.3) }, // немного смещённые
    { id: 'photo3', predictions: generateMockData(10, 0.6) }, // ещё больше смещение
    { id: 'photo4', predictions: generateMockData(8, 0.8) }   // сильно смещённые
  ];
 
  for (let i = 0; i < mockPhotos.length; i++) {
    console.log(`\n📸 Обрабатываю фото ${i + 1}...`);
   
    const result = await manager.addPhotoToModel(
      session.sessionId,
      { fileId: mockPhotos[i].id },
      mockPhotos[i].predictions
    );
   
    console.log(`   Узлов: ${result.stats.totalNodes}`);
    console.log(`   Уверенность: ${(result.stats.modelConfidence * 100).toFixed(1)}%`);
  }
 
  // 4. Получаем статус
  const status = manager.getModelStatus(session.sessionId);
  console.log('\n📊 ФИНАЛЬНЫЙ СТАТУС МОДЕЛИ:');
  console.log('   Всего узлов:', status.totalNodes);
  console.log('   Высокоуверенных:', status.highConfidenceNodes);
  console.log('   Уверенность модели:', (status.modelConfidence * 100).toFixed(1) + '%');
  console.log('   Уровень:', status.confidenceLevel);
 
  // 5. Тестируем сравнение
  console.log('\n🔍 ТЕСТ СРАВНЕНИЯ:');
 
  // Фрагмент от того же следа
  const sameFootprintFragment = generateMockData(5, 0.2);
  const sameResult = manager.checkFragment(session.sessionId, sameFootprintFragment);
  console.log('   Тот же след:', sameResult.match ? '✅ СОВПАДАЕТ' : '❌ НЕ СОВПАДАЕТ');
  console.log('   Уверенность:', (sameResult.confidence * 100).toFixed(1) + '%');
 
  // Фрагмент от другого следа
  const differentFragment = generateVeryDifferentData(5);
  const diffResult = manager.checkFragment(session.sessionId, differentFragment);
  console.log('   Другой след:', diffResult.match ? '✅ СОВПАДАЕТ' : '❌ НЕ СОВПАДАЕТ');
  console.log('   Уверенность:', (diffResult.confidence * 100).toFixed(1) + '%');
 
  // 6. Визуализация
  console.log('\n🎨 ГЕНЕРИРУЮ ВИЗУАЛИЗАЦИЮ...');
  const model = manager.exportModel(session.sessionId, 'simple');
  await visualizer.visualizeModel(model, null, 'test_model_viz.png');
  console.log('✅ Визуализация сохранена: test_model_viz.png');
 
  // 7. Экспорт
  const jsonExport = manager.exportModel(session.sessionId, 'json');
  require('fs').writeFileSync('test_model_export.json', JSON.stringify(jsonExport, null, 2));
  console.log('✅ Модель экспортирована: test_model_export.json');
 
  console.log('\n🎯 ТЕСТ ЗАВЕРШЁН УСПЕШНО!');
}

// Вспомогательные функции для теста
function generateMockData(count, offset = 0) {
  const predictions = [];
 
  for (let i = 0; i < count; i++) {
    predictions.push({
      class: Math.random() > 0.3 ? 'shoe-protector' : 'Outline-trail',
      confidence: 0.5 + Math.random() * 0.5,
      points: [
        { x: 100 + i * 40 + Math.random() * 20 + offset * 50, y: 100 + Math.random() * 100 },
        { x: 120 + i * 40 + Math.random() * 20 + offset * 50, y: 100 + Math.random() * 100 },
        { x: 120 + i * 40 + Math.random() * 20 + offset * 50, y: 120 + Math.random() * 100 },
        { x: 100 + i * 40 + Math.random() * 20 + offset * 50, y: 120 + Math.random() * 100 }
      ]
    });
  }
 
  return predictions;
}

function generateVeryDifferentData(count) {
  const predictions = [];
 
  for (let i = 0; i < count; i++) {
    predictions.push({
      class: 'shoe-protector',
      confidence: 0.6 + Math.random() * 0.4,
      points: [
        { x: 400 + Math.random() * 200, y: 400 + Math.random() * 200 },
        { x: 420 + Math.random() * 200, y: 400 + Math.random() * 200 },
        { x: 420 + Math.random() * 200, y: 420 + Math.random() * 200 },
        { x: 400 + Math.random() * 200, y: 420 + Math.random() * 200 }
      ]
    });
  }
 
  return predictions;
}

// Запускаем тест
testFullSystem().catch(console.error);
