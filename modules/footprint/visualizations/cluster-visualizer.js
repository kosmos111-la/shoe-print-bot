// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 УПРОЩЕННАЯ ВИЗУАЛИЗАЦИЯ ДЛЯ АККУМУЛЯЦИОННОЙ МОДЕЛИ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
  constructor(options = {}) {
    this.config = {
      outputDir: options.outputDir || './data/footprints/visualizations/clusters',
      canvasWidth: options.width || 1000,
      canvasHeight: options.height || 800,
     
      // Цвета по подтверждениям
      pointColors: {
        confirmed3: '#FF0000',   // 🔴 Красный: 3+ подтверждений
        confirmed2: '#FF6B00',   // 🟠 Оранжевый: 2 подтверждения
        confirmed1: '#2196F3',   // 🔵 Синий: 1 подтверждение
        background: '#FFFFFF'    // Белый фон
      },
     
      debug: options.debug || false,
      ...options
    };
   
    // Создаем директорию
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
   
    console.log('🎨 Упрощенный ClusterVisualizer создан (аккумуляционная модель)');
  }
 
  // 🔥 ГЛАВНЫЙ МЕТОД: Визуализация аккумуляционного отпечатка
  async visualizeAccumulativeFootprint(footprint, options = {}) {
    console.log('🎨 Визуализация аккумуляционного отпечатка...');
   
    try {
      // Получаем данные для визуализации
      const vizData = footprint.getVisualizationData();
     
      if (!vizData.points || vizData.points.length === 0) {
        console.log('⚠️ Нет точек для визуализации');
        return this.createTextReport(footprint);
      }
     
      console.log(`📊 Визуализирую ${vizData.points.length} точек:`);
      console.log(`   🔴 3+ подтверждений: ${vizData.stats.confirmed3 || 0}`);
      console.log(`   🟠 2 подтверждения: ${vizData.stats.confirmed2 || 0}`);
      console.log(`   🔵 1 подтверждение: ${vizData.stats.confirmed1 || 0}`);
     
      // Проверяем доступность canvas
      let canvas;
      try {
        canvas = require('canvas');
      } catch (error) {
        console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
        return this.createTextReport(footprint, vizData);
      }
     
      // Создаем canvas
      const canvasWidth = options.width || this.config.canvasWidth;
      const canvasHeight = options.height || this.config.canvasHeight;
     
      const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
      const ctx = canvasInstance.getContext('2d');
     
      // 1. ФОН
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
     
      // 2. ЗАГОЛОВОК
      ctx.fillStyle = '#212529';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`👣 АККУМУЛЯЦИОННАЯ МОДЕЛЬ: ${footprint.name}`, canvasWidth / 2, 40);
     
      // 3. СТАТИСТИКА
      ctx.font = '16px Arial';
      ctx.fillStyle = '#495057';
      ctx.textAlign = 'left';
      ctx.fillText('📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:', 50, 80);
     
      ctx.font = '14px Arial';
      ctx.fillStyle = '#343A40';
     
      const stats = vizData.stats;
      const statRows = [
        `Всего уникальных точек: ${stats.totalPoints || 0}`,
        `🔴 3+ подтверждений: ${stats.confirmed3 || 0} (во всех ${vizData.totalPhotos || 0} следах)`,
        `🟠 2 подтверждения: ${stats.confirmed2 || 0} (в 2 из ${vizData.totalPhotos || 0} следов)`,
        `🔵 1 подтверждение: ${stats.confirmed1 || 0} (только в 1 следе)`,
        `🎯 Среднее подтверждений: ${(stats.avgConfirmations || 0).toFixed(2)}`,
        `📸 Всего фото в истории: ${vizData.totalPhotos || 0}`
      ];
     
      statRows.forEach((text, index) => {
        ctx.fillText(text, 70, 110 + index * 25);
      });
     
      // 4. РИСУЕМ ТОЧКИ
      this.drawAccumulativePoints(ctx, vizData.points, canvasWidth, canvasHeight);
     
      // 5. ЛЕГЕНДА
      this.drawSimpleLegend(ctx, canvasWidth, canvasHeight);
     
      // 6. ИНФОРМАЦИЯ О СИСТЕМЕ
      ctx.fillStyle = '#ADB5BD';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`🎯 Геометрическая аккумуляционная модель | ${new Date().toLocaleString('ru-RU')}`,
                   canvasWidth / 2, canvasHeight - 10);
     
      // 7. СОХРАНЯЕМ
      const filename = options.filename || `accumulative_${footprint.id}_${Date.now()}.png`;
      const outputPath = path.join(this.config.outputDir, filename);
     
      return new Promise((resolve, reject) => {
        const out = fs.createWriteStream(outputPath);
        const stream = canvasInstance.createPNGStream();
       
        stream.pipe(out);
       
        out.on('finish', () => {
          console.log(`✅ Аккумуляционная визуализация сохранена: ${outputPath}`);
          resolve({
            path: outputPath,
            stats: vizData.stats,
            pointsCount: vizData.points.length,
            success: true,
            accumulative: true
          });
        });
       
        out.on('error', reject);
      });
     
    } catch (error) {
      console.error('❌ Ошибка визуализации:', error);
      return this.createTextReport(footprint);
    }
  }
 
  // 🔥 РИСОВАНИЕ АККУМУЛЯЦИОННЫХ ТОЧЕК
  drawAccumulativePoints(ctx, points, canvasWidth, canvasHeight) {
    if (points.length === 0) {
      ctx.fillStyle = '#6C757D';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Нет данных для отображения', canvasWidth / 2, canvasHeight / 2);
      return;
    }
   
    // Рассчитываем границы для масштабирования
    const { minX, maxX, minY, maxY } = this.calculateBounds(points);
    const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.6);
   
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight * 0.6;
   
    // Рисуем каждую точку
    points.forEach(point => {
      const x = centerX + (point.x - (minX + maxX) / 2) * scale;
      const y = centerY + (point.y - (minY + maxY) / 2) * scale;
     
      // Определяем цвет по количеству подтверждений
      const color = this.getPointColorByConfirmations(point.confirmations);
      const size = this.calculatePointSize(point.confirmations, point.confidence);
     
      // Рисуем точку
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
     
      // Обводка для видимости
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
     
      // Для точек с 2+ подтверждениями - добавляем цифру
      if (point.confirmations >= 2) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(point.confirmations.toString(), x, y);
      }
     
      // Для точек с 1 подтверждением - полупрозрачность
      if (point.confirmations === 1) {
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    });
  }
 
  // 🔥 ПРОСТАЯ ЛЕГЕНДА
  drawSimpleLegend(ctx, canvasWidth, canvasHeight) {
    const legendY = canvasHeight - 130;
    const startX = canvasWidth * 0.1;
   
    // Фон легенды
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 110);
   
    ctx.strokeStyle = '#DEE2E6';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 110);
   
    // Заголовок
    ctx.fillStyle = '#212529';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('🎯 ЛЕГЕНДА ПОДТВЕРЖДЕНИЙ', startX, legendY);
   
    // Элементы легенды
    const legendItems = [
      { confirmations: 3, color: this.config.pointColors.confirmed3, text: '3+ подтверждений', desc: 'Во всех следах' },
      { confirmations: 2, color: this.config.pointColors.confirmed2, text: '2 подтверждения', desc: 'В 2 из N следов' },
      { confirmations: 1, color: this.config.pointColors.confirmed1, text: '1 подтверждение', desc: 'Только в 1 следе' }
    ];
   
    legendItems.forEach((item, index) => {
      const y = legendY + 20 + index * 35;
     
      // Рисуем пример точки
      const size = this.calculatePointSize(item.confirmations, 0.7);
     
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(startX + 15, y + 8, size, 0, Math.PI * 2);
      ctx.fill();
     
      // Обводка
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
     
      // Цифра для 2+ подтверждений
      if (item.confirmations >= 2) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.confirmations.toString(), startX + 15, y + 8);
      }
     
      // Текст
      ctx.fillStyle = '#495057';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.text, startX + 35, y + 5);
     
      ctx.fillStyle = '#6C757D';
      ctx.font = '12px Arial';
      ctx.fillText(item.desc, startX + 35, y + 20);
    });
  }
 
  // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  getPointColorByConfirmations(confirmations) {
    if (confirmations >= 3) {
      return this.config.pointColors.confirmed3;
    } else if (confirmations >= 2) {
      return this.config.pointColors.confirmed2;
    } else {
      return this.config.pointColors.confirmed1;
    }
  }
 
  calculatePointSize(confirmations, confidence) {
    let baseSize = 4;
   
    if (confirmations >= 3) {
      baseSize = 10;
    } else if (confirmations >= 2) {
      baseSize = 7;
    } else if (confirmations >= 1) {
      baseSize = 5;
    }
   
    return baseSize + (confidence * 4);
  }
 
  calculateBounds(points) {
    if (points.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }
   
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
   
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
   
    return { minX, maxX, minY, maxY };
  }
 
  calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
   
    const scaleX = targetWidth / width;
    const scaleY = targetHeight / height;
   
    return Math.min(scaleX, scaleY, 3);
  }
 
  // 🔥 ТЕКСТОВЫЙ ОТЧЕТ
  createTextReport(footprint, vizData = null) {
    if (!vizData) {
      vizData = footprint.getVisualizationData();
    }
   
    const outputPath = path.join(this.config.outputDir, `report_${footprint.id}_${Date.now()}.txt`);
   
    const report = `
👣 АККУМУЛЯЦИОННЫЙ ОТЧЕТ О ПОДТВЕРЖДЕНИЯХ
═════════════════════════════════════════════

📋 ИНФОРМАЦИЯ О МОДЕЛИ:
• Название: ${footprint.name}
• ID: ${footprint.id?.slice(0, 8) || 'N/A'}
• Время создания: ${new Date().toLocaleString('ru-RU')}
• Всего фото в истории: ${vizData.totalPhotos || 0}

📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ (АККУМУЛЯЦИОННАЯ):
• Всего уникальных точек: ${vizData.stats?.totalPoints || 0}
• 🔴 3+ подтверждений: ${vizData.stats?.confirmed3 || 0} (во всех ${vizData.totalPhotos || 0} следах)
• 🟠 2 подтверждения: ${vizData.stats?.confirmed2 || 0} (в 2 из ${vizData.totalPhotos || 0} следов)
• 🔵 1 подтверждение: ${vizData.stats?.confirmed1 || 0} (только в 1 следе)
• 🎯 Среднее подтверждений: ${(vizData.stats?.avgConfirmations || 0).toFixed(2)}

🎨 ЛЕГЕНДА ЦВЕТОВ (АККУМУЛЯЦИОННАЯ):
• 🔴 Красный: 3+ подтверждений (точка есть во всех следах)
• 🟠 Оранжевый: 2 подтверждения (точка есть в 2 следах)
• 🔵 Синий: 1 подтверждение (точка только в 1 следе)

💡 ГЕОМЕТРИЧЕСКАЯ АККУМУЛЯЦИОННАЯ МОДЕЛЬ:
• Ищет созвездия (геометрические паттерны)
• Накопление точек из всех следов
• Инвариантна к поворотам, масштабу, координатам
• 1 фото = добавление новых точек или подтверждение существующих

═════════════════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
`;
   
    fs.writeFileSync(outputPath, report, 'utf8');
   
    return {
      path: outputPath,
      stats: vizData.stats,
      note: 'Текстовый отчет аккумуляционной модели'
    };
  }
 
  // 🔥 ДЛЯ СОВМЕСТИМОСТИ
  async visualizeSingleFootprintConfirmations(footprint, options = {}) {
    return await this.visualizeAccumulativeFootprint(footprint, options);
  }
}

module.exports = ClusterVisualizer;
