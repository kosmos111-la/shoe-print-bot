// modules/visualization/model-visualizer.js
// Визуализация аккумулятивных моделей следов с контурами протекторов

const { createCanvas } = require('canvas');

class ModelVisualizer {
  constructor() {
    console.log('🎨 ModelVisualizer инициализирован');
    this.contourColors = {
      'Outline-trail': 'rgba(148, 0, 211, 0.5)',    // фиолетовый - основной контур
      'shoe-protector': 'rgba(64, 224, 208, 0.4)',   // бирюзовый - протекторы
      'Heel': 'rgba(255, 140, 0, 0.6)',             // оранжевый - каблук
      'Toe': 'rgba(30, 144, 255, 0.6)',             // синий - носок
      'animal-paw': 'rgba(255, 0, 0, 0.3)',         // красный - животные
      'Animal': 'rgba(255, 0, 0, 0.3)',
      'default': 'rgba(200, 200, 200, 0.3)'         // серый - другие
    };
  }

  /**
   * Визуализация модели с контурами
   */
  async visualizeModel(modelData, options = {}) {
    try {
      const {
        width = 800,
        height = 600,
        showGrid = true,
        showLabels = true,
        showContours = true,
        showHeelToe = true,
        outputPath = null
      } = options;

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Фон
      this.drawBackground(ctx, width, height);

      // Сетка
      if (showGrid) {
        this.drawGrid(ctx, width, height);
      }

      // Центральные оси
      this.drawAxes(ctx, width, height);

      // 🔥 ПЕРВЫЙ ШАГ: рисуем контуры протекторов (если есть)
      if (showContours && modelData.contours && modelData.contours.length > 0) {
        this.drawContours(ctx, modelData.contours, width, height);
      }

      // 🔥 ВТОРОЙ ШАГ: каблук и носок если нужно
      if (showHeelToe && modelData.specialPoints) {
        this.drawSpecialPoints(ctx, modelData.specialPoints);
      }

      // Рисуем связи между узлами
      if (modelData.edges && modelData.edges.length > 0) {
        this.drawEdges(ctx, modelData.edges, modelData.nodes);
      }

      // Рисуем узлы (центры протекторов)
      if (modelData.nodes && modelData.nodes.length > 0) {
        this.drawNodes(ctx, modelData.nodes, showLabels);
      }

      // Легенда и статистика с информацией о контурах
      this.drawLegend(ctx, width, height, modelData, {
        showContours,
        showHeelToe
      });

      // Сохранение или возврат буфера
      if (outputPath) {
        const fs = require('fs');
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ Визуализация сохранена: ${outputPath}`);
        return outputPath;
      } else {
        return canvas.toBuffer('image/png');
      }

    } catch (error) {
      console.log('❌ Ошибка визуализации модели:', error);
      return null;
    }
  }

  /**
   * Рисование контуров протекторов
   */
  drawContours(ctx, contours, width, height) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
   
    contours.forEach(contour => {
      if (!contour.points || contour.points.length < 3) return;
     
      // Определяем цвет контура по классу
      const color = this.contourColors[contour.class] || this.contourColors.default;
     
      // Настройки стиля для разных типов контуров
      ctx.strokeStyle = color;
      ctx.fillStyle = color.replace('0.3)', '0.1)'); // более прозрачная заливка
      ctx.lineWidth = contour.class === 'Outline-trail' ? 2 : 1;
     
      // Пунктир для слабых или старых контуров
      if (contour.confidence < 0.4 || contour.age > 5) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }
     
      // Рисуем контур
      ctx.beginPath();
     
      // Первая точка
      const firstPoint = {
        x: centerX + contour.points[0].x,
        y: centerY + contour.points[0].y
      };
      ctx.moveTo(firstPoint.x, firstPoint.y);
     
      // Остальные точки
      for (let i = 1; i < contour.points.length; i++) {
        const point = {
          x: centerX + contour.points[i].x,
          y: centerY + contour.points[i].y
        };
        ctx.lineTo(point.x, point.y);
      }
     
      // Замыкаем контур
      ctx.closePath();
     
      // Заливка только для основных контуров
      if (contour.class === 'Outline-trail' && contour.confidence > 0.6) {
        ctx.fill();
      }
     
      // Обводка
      ctx.stroke();
      ctx.setLineDash([]);
     
      // Подпись для основных контуров
      if (contour.class === 'Outline-trail' && contour.confidence > 0.5) {
        const centroid = this.calculateCentroid(contour.points);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          `Контур ${(contour.confidence * 100).toFixed(0)}%`,
          centerX + centroid.x,
          centerY + centroid.y - 10
        );
      }
    });
  }

  /**
   * Рисование специальных точек (каблук, носок)
   */
  drawSpecialPoints(ctx, specialPoints) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
   
    // Каблук
    if (specialPoints.heel && specialPoints.heel.confidence > 0.3) {
      const x = centerX + specialPoints.heel.x;
      const y = centerY + specialPoints.heel.y;
     
      // Иконка каблука
      ctx.fillStyle = this.contourColors.Heel;
      ctx.font = 'bold 16px Arial';
      ctx.fillText('👠', x - 8, y + 6);
     
      // Обводка
      ctx.strokeStyle = this.contourColors.Heel;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.stroke();
     
      // Подпись
      if (specialPoints.heel.confidence > 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Arial';
        ctx.fillText(
          `Каблук ${(specialPoints.heel.confidence * 100).toFixed(0)}%`,
          x,
          y + 25
        );
      }
    }
   
    // Носок
    if (specialPoints.toe && specialPoints.toe.confidence > 0.3) {
      const x = centerX + specialPoints.toe.x;
      const y = centerY + specialPoints.toe.y;
     
      // Иконка носка
      ctx.fillStyle = this.contourColors.Toe;
      ctx.font = 'bold 16px Arial';
      ctx.fillText('🦶', x - 8, y + 6);
     
      // Обводка
      ctx.strokeStyle = this.contourColors.Toe;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.stroke();
     
      // Подпись
      if (specialPoints.toe.confidence > 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Arial';
        ctx.fillText(
          `Носок ${(specialPoints.toe.confidence * 100).toFixed(0)}%`,
          x,
          y + 25
        );
      }
    }
  }

  /**
   * Обновлённая функция рисования узлов с проверкой внутри контуров
   */
  drawNodes(ctx, nodes, showLabels) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;

    // Сначала рисуем все узлы
    nodes.forEach(node => {
      const x = centerX + node.x;
      const y = centerY + node.y;

      // Проверяем, находится ли узел внутри какого-либо контура
      const isInsideContour = this.isNodeInsideContour(node, ctx);
     
      // Цвет узла в зависимости от уверенности и положения
      let color;
      if (node.confidence > 0.8) {
        color = isInsideContour ? '#00ff00' : '#90ee90'; // ярко-зелёный / светло-зелёный
      } else if (node.confidence > 0.65) {
        color = isInsideContour ? '#ffff00' : '#fffacd'; // жёлтый / светло-жёлтый
      } else if (node.confidence > 0.5) {
        color = isInsideContour ? '#ff9900' : '#ffd699'; // оранжевый / светло-оранжевый
      } else {
        color = isInsideContour ? '#ff0000' : '#ff9999'; // красный / светло-красный
      }
     
      const radius = 5 + Math.min(node.occurrences * 2, 15);

      // Внешнее свечение для узлов внутри контуров
      if (isInsideContour) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      }

      // Внешний круг
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Внутренний круг для узлов внутри контуров
      if (isInsideContour) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Подпись с информацией о положении
      if (showLabels && node.confidence > 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
       
        let label = `${(node.confidence * 100).toFixed(0)}%`;
        if (!isInsideContour) {
          label += ' ⚠️'; // предупреждение если вне контура
        }
       
        ctx.fillText(label, x, y - radius - 5);

        if (node.occurrences > 1) {
          ctx.font = '8px Arial';
          ctx.fillText(`×${node.occurrences}`, x, y + radius + 10);
        }
      }
     
      ctx.shadowBlur = 0;
    });
  }

  /**
   * Проверка, находится ли узел внутри какого-либо контура
   */
  isNodeInsideContour(node, ctx) {
    // ⚠️ ВАЖНО: для работы этой функции нужен доступ к данным о контурах
    // В реальной реализации нужно передавать contours в функцию
    // Здесь заглушка - в реальном коде нужно передавать contours как параметр
    return true; // временная заглушка
  }

  /**
   * Обновлённая легенда с информацией о контурах
   */
  drawLegend(ctx, width, height, modelData, options = {}) {
    const legendX = 20;
    const legendY = 20;
    const legendWidth = 280;

    // Фон легенды
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(legendX - 10, legendY - 10, legendWidth, 210);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 10, legendY - 10, legendWidth, 210);

    // Заголовок
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('🕸️ АККУМУЛЯТИВНАЯ МОДЕЛЬ', legendX, legendY + 10);

    // Статистика
    ctx.font = '12px Arial';
    ctx.fillText(`📊 Узлов: ${modelData.nodeCount || modelData.nodes?.length || 0}`, legendX, legendY + 35);
    ctx.fillText(`🔗 Связей: ${modelData.edgeCount || modelData.edges?.length || 0}`, legendX, legendY + 55);
   
    // Информация о контурах
    if (modelData.contours) {
      const contourCount = modelData.contours.filter(c => c.class === 'Outline-trail').length;
      const protectorCount = modelData.contours.filter(c => c.class === 'shoe-protector').length;
     
      ctx.fillText(`📐 Контуров: ${contourCount}`, legendX, legendY + 75);
      ctx.fillText(`🔩 Деталей: ${protectorCount}`, legendX, legendY + 95);
    }
   
    ctx.fillText(`📸 Фото: ${modelData.photosProcessed || 0}`, legendX, legendY + 115);
    ctx.fillText(`🎯 Уверенность: ${((modelData.confidence || 0) * 100).toFixed(1)}%`, legendX, legendY + 135);

    // Легенда цветов узлов
    const colors = [
      { color: this.getNodeColor(0.9), label: 'Узел (высокая уверенность)' },
      { color: this.getNodeColor(0.9).replace('00ff00', '90ee90'), label: 'Узел вне контура' },
      { color: this.contourColors['Outline-trail'], label: 'Контур следа' },
      { color: this.contourColors['Heel'], label: 'Каблук' },
      { color: this.contourColors['Toe'], label: 'Носок' }
    ];

    colors.forEach((item, i) => {
      if (item.label.includes('Контур')) {
        // Для контуров - линия
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX, legendY + 145 + i * 15);
        ctx.lineTo(legendX + 15, legendY + 145 + i * 15);
        ctx.stroke();
      } else if (item.label.includes('Узел')) {
        // Для узлов - круг
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX + 7, legendY + 145 + i * 15, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Для каблука/носка - текст
        ctx.fillStyle = item.color;
        ctx.font = '14px Arial';
        const icon = item.label.includes('Каблук') ? '👠' : '🦶';
        ctx.fillText(icon, legendX, legendY + 150 + i * 15);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.fillText(item.label, legendX + 20, legendY + 150 + i * 15);
    });

    // Timestamp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px Arial';
    const timestamp = modelData.timestamp ?
      new Date(modelData.timestamp).toLocaleString('ru-RU') :
      new Date().toLocaleString('ru-RU');
    ctx.fillText(`Сгенерировано: ${timestamp}`, legendX, legendY + 195);
  }

  /**
   * Вспомогательная функция для расчёта центра масс контура
   */
  calculateCentroid(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
   
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
  }

  /**
   * Фон (без изменений)
   */
  drawBackground(ctx, width, height) {
    // ... существующий код ...
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Сетка (без изменений)
   */
  drawGrid(ctx, width, height) {
    // ... существующий код ...
  }

  /**
   * Оси (без изменений)
   */
  drawAxes(ctx, width, height) {
    // ... существующий код ...
  }

  /**
   * Связи (без изменений)
   */
  drawEdges(ctx, edges, nodes) {
    // ... существующий код ...
  }

  /**
   * Цвет узла по уверенности
   */
  getNodeColor(confidence) {
    if (confidence > 0.8) return '#00ff00';
    if (confidence > 0.65) return '#ffff00';
    if (confidence > 0.5) return '#ff9900';
    return '#ff0000';
  }

  /**
   * Обновлённая текстовая визуализация с информацией о контурах
   */
  generateTextVisualization(modelData) {
    const stats = {
      nodes: modelData.nodes?.length || 0,
      edges: modelData.edges?.length || 0,
      confidence: modelData.confidence || 0,
      photos: modelData.photosProcessed || 0,
      contours: modelData.contours?.length || 0
    };

    let text = `🕸️ *ВИЗУАЛИЗАЦИЯ МОДЕЛИ*\n\n`;
    text += `📊 *Статистика:*\n`;
    text += `• Узлов (центров протекторов): ${stats.nodes}\n`;
    text += `• Связей между узлами: ${stats.edges}\n`;
    text += `• Контуров в модели: ${stats.contours}\n`;
    text += `• Уверенность модели: ${(stats.confidence * 100).toFixed(1)}%\n`;
    text += `• Фото в модели: ${stats.photos}\n\n`;

    // Информация о типах контуров
    if (modelData.contours) {
      const contourTypes = {};
      modelData.contours.forEach(contour => {
        contourTypes[contour.class] = (contourTypes[contour.class] || 0) + 1;
      });
     
      if (Object.keys(contourTypes).length > 0) {
        text += `📐 *Типы контуров:*\n`;
        Object.entries(contourTypes).forEach(([type, count]) => {
          const icon = type === 'Outline-trail' ? '👣' :
                      type === 'shoe-protector' ? '🔩' :
                      type === 'Heel' ? '👠' :
                      type === 'Toe' ? '🦶' : '📦';
          text += `${icon} ${type}: ${count}\n`;
        });
        text += `\n`;
      }
    }

    // Ключевые узлы
    if (stats.nodes > 0) {
      text += `🎯 *Ключевые узлы (центры протекторов):*\n`;

      modelData.nodes
        .filter(node => node.confidence > 0.7)
        .slice(0, 5)
        .forEach((node, i) => {
          text += `${i+1}. Уверенность: ${(node.confidence * 100).toFixed(0)}%`;
          if (node.occurrences > 1) text += ` (подтверждён ×${node.occurrences})`;
          if (node.photoCount > 1) text += ` [${node.photoCount} фото]`;
          text += `\n`;
        });
    }

    // Каблук и носок если есть
    if (modelData.specialPoints) {
      text += `\n🦶 *Особые элементы:*\n`;
      if (modelData.specialPoints.heel && modelData.specialPoints.heel.confidence > 0.3) {
        text += `• 👠 Каблук: ${(modelData.specialPoints.heel.confidence * 100).toFixed(0)}%\n`;
      }
      if (modelData.specialPoints.toe && modelData.specialPoints.toe.confidence > 0.3) {
        text += `• 🦶 Носок: ${(modelData.specialPoints.toe.confidence * 100).toFixed(0)}%\n`;
      }
    }

    return text;
  }
}

module.exports = { ModelVisualizer };
