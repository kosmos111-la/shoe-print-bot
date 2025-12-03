// modules/visualization/model-visualizer.js

class ModelVisualizer {
  constructor() {
    console.log('🎨 ModelVisualizer инициализирован');
    this.contourColors = {
      'Outline-trail': 'rgba(148, 0, 211, 0.5)',
      'shoe-protector': 'rgba(64, 224, 208, 0.4)',
      'Heel': 'rgba(255, 140, 0, 0.6)',
      'Toe': 'rgba(30, 144, 255, 0.6)',
      'Dragged and dragged': 'rgba(255, 255, 0, 0.3)',
      'default': 'rgba(200, 200, 200, 0.3)'
    };
  }

  /**
   * Визуализация модели с АВТОМАСШТАБИРОВАНИЕМ
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
        outputPath = null,
        autoScale = true, // 🆕 АВТОМАСШТАБИРОВАНИЕ
        padding = 50       // 🆕 Отступ от краев
      } = options;

      // 🆕 ВЫЧИСЛЯЕМ ГРАНИЦЫ МОДЕЛИ
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
     
      // Границы по узлам
      if (modelData.nodes && modelData.nodes.length > 0) {
        modelData.nodes.forEach(node => {
          minX = Math.min(minX, node.x);
          maxX = Math.max(maxX, node.x);
          minY = Math.min(minY, node.y);
          maxY = Math.max(maxY, node.y);
        });
      }
     
      // Границы по контурам (если есть)
      if (showContours && modelData.contours && modelData.contours.length > 0) {
        modelData.contours.forEach(contour => {
          if (contour.points && contour.points.length > 0) {
            const xs = contour.points.map(p => p.x);
            const ys = contour.points.map(p => p.y);
            minX = Math.min(minX, Math.min(...xs));
            maxX = Math.max(maxX, Math.max(...xs));
            minY = Math.min(minY, Math.min(...ys));
            maxY = Math.max(maxY, Math.max(...ys));
          }
        });
      }
     
      // 🆕 ЕСЛИ ДАННЫХ НЕТ - ИСПОЛЬЗУЕМ РАЗМЕРЫ ПО УМОЛЧАНИЮ
      if (minX === Infinity) {
        minX = -100; maxX = 100; minY = -100; maxY = 100;
      }
     
      // 🆕 ВЫЧИСЛЯЕМ МАСШТАБ И СМЕЩЕНИЕ
      let scale = 1;
      let offsetX = 0, offsetY = 0;
     
      if (autoScale) {
        const modelWidth = maxX - minX;
        const modelHeight = maxY - minY;
       
        if (modelWidth > 0 && modelHeight > 0) {
          // Масштаб чтобы модель поместилась с отступами
          const scaleX = (width - 2 * padding) / modelWidth;
          const scaleY = (height - 2 * padding) / modelHeight;
          scale = Math.min(scaleX, scaleY, 2.0); // Ограничиваем увеличение
         
          // Центрируем
          offsetX = (width - modelWidth * scale) / 2 - minX * scale;
          offsetY = (height - modelHeight * scale) / 2 - minY * scale;
        }
      }
     
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
     
      console.log(`📐 Масштабирование модели: масштаб=${scale.toFixed(2)}, смещение=(${offsetX.toFixed(0)},${offsetY.toFixed(0)})`);

      // Фон
      this.drawBackground(ctx, width, height);

      // Сетка
      if (showGrid) {
        this.drawGrid(ctx, width, height, scale);
      }

      // Центральные оси
      this.drawAxes(ctx, width, height);

      // 🆕 РИСУЕМ С УЧЕТОМ МАСШТАБА И СМЕЩЕНИЯ
      if (showContours && modelData.contours && modelData.contours.length > 0) {
        this.drawContours(ctx, modelData.contours, width, height, scale, offsetX, offsetY);
      }

      if (showHeelToe && modelData.specialPoints) {
        this.drawSpecialPoints(ctx, modelData.specialPoints, scale, offsetX, offsetY);
      }

      if (modelData.edges && modelData.edges.length > 0) {
        this.drawEdges(ctx, modelData.edges, modelData.nodes, scale, offsetX, offsetY);
      }

      if (modelData.nodes && modelData.nodes.length > 0) {
        this.drawNodes(ctx, modelData.nodes, showLabels, scale, offsetX, offsetY);
      }

      // Легенда
      this.drawLegend(ctx, width, height, modelData, {
        showContours,
        showHeelToe,
        scale: scale // 🆕 передаем масштаб в легенду
      });

      // Сохранение
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
   * 🆕 РИСОВАНИЕ КОНТУРОВ С МАСШТАБИРОВАНИЕМ
   */
  drawContours(ctx, contours, width, height, scale = 1, offsetX = 0, offsetY = 0) {
    contours.forEach(contour => {
      if (!contour.points || contour.points.length < 3) return;
     
      const color = this.contourColors[contour.class] || this.contourColors.default;
     
      // 🆕 НАСТРОЙКИ ДЛЯ РАЗНЫХ ТИПОВ КОНТУРОВ
      let lineWidth = 1;
      let opacity = 0.4;
     
      if (contour.class === 'Outline-trail') {
        lineWidth = 2;
        opacity = 0.6;
      } else if (contour.class === 'shoe-protector') {
        lineWidth = 1;
        opacity = 0.3; // 🆕 делаем протекторы более прозрачными
      } else if (contour.class === 'Heel' || contour.class === 'Toe') {
        lineWidth = 2;
        opacity = 0.7;
      }
     
      ctx.strokeStyle = color.replace('0.5)', `${opacity})`);
      ctx.fillStyle = color.replace('0.3)', '0.1)');
      ctx.lineWidth = lineWidth * scale;
     
      // Пунктир для слабых контуров
      if (contour.confidence < 0.4) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }
     
      // Рисуем контур
      ctx.beginPath();
     
      // 🆕 ПРИМЕНЯЕМ МАСШТАБ И СМЕЩЕНИЕ
      const firstPoint = contour.points[0];
      const x = offsetX + firstPoint.x * scale;
      const y = offsetY + firstPoint.y * scale;
      ctx.moveTo(x, y);
     
      for (let i = 1; i < contour.points.length; i++) {
        const point = contour.points[i];
        const px = offsetX + point.x * scale;
        const py = offsetY + point.y * scale;
        ctx.lineTo(px, py);
      }
     
      ctx.closePath();
     
      // Заливка только для основных контуров
      if (contour.class === 'Outline-trail' && contour.confidence > 0.6) {
        ctx.fill();
      }
     
      ctx.stroke();
      ctx.setLineDash([]);
     
      // 🆕 ПОДПИСИ ТОЛЬКО ДЛЯ КЛЮЧЕВЫХ КОНТУРОВ (чтобы не загромождать)
      if (contour.class === 'Outline-trail' && contour.confidence > 0.5) {
        const centroid = this.calculateCentroid(contour.points);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(10, 10 * scale)}px Arial`; // 🆕 масштабируем шрифт
        ctx.textAlign = 'center';
        ctx.fillText(
          `След`,
          offsetX + centroid.x * scale,
          offsetY + centroid.y * scale - 10 * scale
        );
      }
    });
  }

  /**
   * 🆕 РИСОВАНИЕ УЗЛОВ С МАСШТАБИРОВАНИЕМ
   */
  drawNodes(ctx, nodes, showLabels, scale = 1, offsetX = 0, offsetY = 0) {
    // 🆕 СОРТИРУЕМ ПО УВЕРЕННОСТИ (сначала низкая, потом высокая)
    const sortedNodes = [...nodes].sort((a, b) => a.confidence - b.confidence);
   
    // 🆕 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ОТРИСОВЫВАЕМЫХ УЗЛОВ (если их много)
    const maxNodesToShow = 50;
    const nodesToShow = sortedNodes.length > maxNodesToShow
      ? sortedNodes.slice(sortedNodes.length - maxNodesToShow) // берём самые уверенные
      : sortedNodes;
   
    nodesToShow.forEach(node => {
      const x = offsetX + node.x * scale;
      const y = offsetY + node.y * scale;
     
      // Цвет по уверенности
      const color = this.getNodeColor(node.confidence);
      const radius = Math.max(2, Math.min(5 * scale, 8)); // 🆕 масштабируем радиус
     
      // Только для высокоуверенных узлов - свечение
      if (node.confidence > 0.7) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 5 * scale;
      }
     
      // Внешний круг
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
     
      // Внутренний круг для высокоуверенных
      if (node.confidence > 0.7) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
     
      ctx.shadowBlur = 0;
     
      // 🆕 ПОДПИСИ ТОЛЬКО ДЛЯ ВЫСОКОУВЕРЕННЫХ УЗЛОВ И ТОЛЬКО ЕСЛИ МАЛО УЗЛОВ
      if (showLabels && node.confidence > 0.8 && nodesToShow.length < 20) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(8, 8 * scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `${(node.confidence * 100).toFixed(0)}%`,
          x,
          y - radius - 5 * scale
        );
      }
    });
  }

  /**
   * 🆕 ОБНОВЛЕННАЯ СЕТКА С МАСШТАБОМ
   */
  drawGrid(ctx, width, height, scale = 1) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
   
    // 🆕 РАЗМЕР ЯЧЕЙКИ В ЗАВИСИМОСТИ ОТ МАСШТАБА
    const cellSize = Math.max(25, 50 / scale);
   
    // Вертикальные линии
    for (let x = 0; x < width; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
   
    // Горизонтальные линии
    for (let y = 0; y < height; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  /**
   * 🆕 ОБНОВЛЕННАЯ ЛЕГЕНДА С ИНФОРМАЦИЕЙ О МАСШТАБЕ
   */
  drawLegend(ctx, width, height, modelData, options = {}) {
    const legendX = 20;
    const legendY = 20;
    const legendWidth = 280;
   
    // 🆕 АВТОМАТИЧЕСКИЙ РАЗМЕР ЛЕГЕНДЫ ПРИ МАЛОМ МАСШТАБЕ
    const scaleFactor = options.scale || 1;
    const legendHeight = scaleFactor < 0.5 ? 150 : 210;

    // Фон легенды
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(legendX - 10, legendY - 10, legendWidth, legendHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 10, legendY - 10, legendWidth, legendHeight);

    // Заголовок
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('🕸️ АККУМУЛЯТИВНАЯ МОДЕЛЬ', legendX, legendY + 10);

    // Статистика
    ctx.font = '12px Arial';
    ctx.fillText(`📊 Узлов: ${modelData.nodes?.length || 0}`, legendX, legendY + 35);
    ctx.fillText(`🔗 Связей: ${modelData.edges?.length || 0}`, legendX, legendY + 55);
    ctx.fillText(`🎨 Контуров: ${modelData.contours?.length || 0}`, legendX, legendY + 75);
   
    // 🆕 ИНФОРМАЦИЯ О МАСШТАБЕ
    if (options.scale && options.scale !== 1) {
      ctx.fillText(`📐 Масштаб: ${options.scale.toFixed(2)}x`, legendX, legendY + 95);
    }
   
    ctx.fillText(`📸 Фото: ${modelData.photosProcessed || 0}`, legendX, legendY + 115);
    ctx.fillText(`🎯 Уверенность: ${((modelData.confidence || 0) * 100).toFixed(1)}%`, legendX, legendY + 135);

    // Легенда цветов (упрощенная при маленьком масштабе)
    const startY = scaleFactor < 0.5 ? legendY + 145 : legendY + 155;
    const lineHeight = scaleFactor < 0.5 ? 12 : 15;
   
    const colors = scaleFactor < 0.5
      ? [
          { color: this.getNodeColor(0.9), label: 'Узлы' },
          { color: this.contourColors['Outline-trail'], label: 'Контур' }
        ]
      : [
          { color: this.getNodeColor(0.9), label: 'Узлы (центры протекторов)' },
          { color: this.contourColors['Outline-trail'], label: 'Контур следа' },
          { color: this.contourColors['shoe-protector'], label: 'Протекторы' },
          { color: this.contourColors['Heel'], label: 'Каблук' },
          { color: this.contourColors['Toe'], label: 'Носок' }
        ];

    colors.forEach((item, i) => {
      if (item.label.includes('Контур') || item.label.includes('Протекторы')) {
        // Линия для контуров
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX, startY + i * lineHeight);
        ctx.lineTo(legendX + 15, startY + i * lineHeight);
        ctx.stroke();
      } else if (item.label.includes('Узлы')) {
        // Круг для узлов
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX + 7, startY + i * lineHeight, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.label.includes('Каблук') || item.label.includes('Носок')) {
        // Текст для каблука/носка
        ctx.fillStyle = item.color;
        ctx.font = '14px Arial';
        const icon = item.label.includes('Каблук') ? '👠' : '🦶';
        ctx.fillText(icon, legendX, startY + i * lineHeight + 5);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = scaleFactor < 0.5 ? '9px Arial' : '10px Arial';
      ctx.fillText(item.label, legendX + 20, startY + i * lineHeight + (scaleFactor < 0.5 ? 4 : 5));
    });

    // Timestamp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px Arial';
    const timestamp = modelData.timestamp ?
      new Date(modelData.timestamp).toLocaleString('ru-RU') :
      new Date().toLocaleString('ru-RU');
    ctx.fillText(`Сгенерировано: ${timestamp}`, legendX, legendY + legendHeight - 10);
  }

  // 🔧 ОСТАЛЬНЫЕ МЕТОДЫ С ДОБАВЛЕНИЕМ МАСШТАБИРОВАНИЯ
  drawSpecialPoints(ctx, specialPoints, scale = 1, offsetX = 0, offsetY = 0) {
    // ... аналогично добавляем scale и offset ...
  }

  drawEdges(ctx, edges, nodes, scale = 1, offsetX = 0, offsetY = 0) {
    // ... аналогично добавляем scale и offset ...
  }

  // ... остальные методы без изменений ...
}
