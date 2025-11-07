const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

class VisualizationService {
    constructor() {
        this.colors = {
            assembledModel: 'rgba(0, 255, 0, 0.6)',
            footprintOverlay: 'rgba(255, 165, 0, 0.4)',
            highConvergence: 'rgba(255, 0, 0, 0.7)',
            outline: 'rgba(0, 0, 255, 0.8)',
            pattern: 'rgba(148, 0, 211, 0.8)',
            textBackground: 'rgba(0, 0, 0, 0.7)',
            text: 'rgba(255, 255, 255, 1.0)'
        };
    }

    /**
     * Создает визуализацию собранной модели из нескольких следов
     */
    async createModelVisualization(model, footprints) {
        try {
            console.log('🎨 Создаю визуализацию модели...');

            if (!footprints || footprints.length === 0) {
                throw new Error('Нет следов для визуализации');
            }

            // Загружаем первое изображение для базовых размеров
            const firstImage = await loadImage(footprints[0].imageUrl);
            const canvas = createCanvas(firstImage.width, firstImage.height);
            const ctx = canvas.getContext('2d');

            // Фон - первое изображение с полупрозрачностью
            ctx.globalAlpha = 0.3;
            ctx.drawImage(firstImage, 0, 0);
            ctx.globalAlpha = 1.0;

            // Рисуем все следы поверх
            footprints.forEach((footprint, index) => {
                this.drawFootprint(ctx, footprint, index);
            });

            // Добавляем информацию о модели
            this.drawModelInfo(ctx, model, footprints.length);

            const tempPath = `model_viz_${Date.now()}.png`;
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(tempPath, buffer);

            console.log('✅ Визуализация модели создана');
            return tempPath;

        } catch (error) {
            console.error('❌ Ошибка создания визуализации модели:', error);
            return null;
        }
    }

    /**
     * Детальная визуализация модели
     */
    async createDetailedModelVisualization(model, footprints) {
        try {
            console.log('🔍 Создаю детальную визуализацию модели...');

            if (!footprints || footprints.length === 0) {
                throw new Error('Нет следов для визуализации');
            }

            const firstImage = await loadImage(footprints[0].imageUrl);
            const canvas = createCanvas(firstImage.width * 1.5, firstImage.height * 1.2);
            const ctx = canvas.getContext('2d');

            // Белый фон
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Основное изображение слева
            ctx.globalAlpha = 0.4;
            ctx.drawImage(firstImage, 20, 20, firstImage.width, firstImage.height);
            ctx.globalAlpha = 1.0;

            // Рисуем следы с номерами
            footprints.forEach((footprint, index) => {
                this.drawDetailedFootprint(ctx, footprint, index, 20, 20, firstImage.width, firstImage.height);
            });

            // Панель информации справа
            this.drawDetailedInfoPanel(ctx, model, footprints, firstImage.width + 40, 20, canvas.width - firstImage.width - 60, canvas.height - 40);

            const tempPath = `detailed_model_${Date.now()}.png`;
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(tempPath, buffer);

            console.log('✅ Детальная визуализация создана');
            return tempPath;

        } catch (error) {
            console.error('❌ Ошибка создания детальной визуализации:', error);
            return null;
        }
    }

    /**
     * Рисует детализированный след с номером
     */
    drawDetailedFootprint(ctx, footprint, index, offsetX, offsetY, width, height) {
        const color = this.getColorForIndex(index);

        if (footprint.predictions) {
            footprint.predictions.forEach(pred => {
                if (pred.points && pred.points.length > 2) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = pred.class === 'Outline-trail' ? 4 : 2;
                    ctx.setLineDash(pred.class === 'Outline-trail' ? [8, 4] : []);

                    ctx.beginPath();
                    ctx.moveTo(pred.points[0].x + offsetX, pred.points[0].y + offsetY);

                    for (let i = 1; i < pred.points.length; i++) {
                        ctx.lineTo(pred.points[i].x + offsetX, pred.points[i].y + offsetY);
                    }

                    ctx.closePath();
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });

            // Добавляем номер следа
            const bbox = this.calculateOverallBoundingBox(footprint.predictions);
            ctx.fillStyle = color;
            ctx.font = 'bold 20px Arial';
            ctx.fillText(
                `#${index + 1}`,
                bbox.minX + offsetX,
                bbox.minY + offsetY - 10
            );
        }
    }

    /**
     * Рисует панель с детальной информацией
     */
    drawDetailedInfoPanel(ctx, model, footprints, x, y, width, height) {
        // Фон панели
        ctx.fillStyle = this.colors.textBackground;
        ctx.fillRect(x, y, width, height);

        // Заголовок
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 18px Arial';
        ctx.fillText('🔬 ДЕТАЛЬНЫЙ АНАЛИЗ МОДЕЛИ', x + 10, y + 25);

        // Информация о модели
        ctx.font = '14px Arial';
        let currentY = y + 55;

        const infoLines = [
            `🎯 Полнота: ${model.completeness}%`,
            `✅ Уверенность: ${model.confidence}%`,
            `👣 Следов: ${footprints.length}`,
            `📅 Собрана: ${model.timestamp.toLocaleDateString('ru-RU')}`,
            `🆔 ID: ${model.id}`
        ];

        infoLines.forEach(line => {
            ctx.fillText(line, x + 10, currentY);
            currentY += 25;
        });

        // Разделитель
        currentY += 10;
        ctx.strokeStyle = this.colors.text;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x + 10, currentY);
        ctx.lineTo(x + width - 10, currentY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Информация о следах
        currentY += 30;
        ctx.font = 'bold 14px Arial';
        ctx.fillText('📋 ИСПОЛЬЗОВАННЫЕ СЛЕДЫ:', x + 10, currentY);

        currentY += 25;
        ctx.font = '12px Arial';
       
        footprints.forEach((footprint, index) => {
            const footprintInfo = `#${index + 1}: ${footprint.patternType || 'неизвестно'} (${footprint.features?.detailCount || 0} дет.)`;
           
            if (currentY < y + height - 20) {
                ctx.fillText(footprintInfo, x + 10, currentY);
                currentY += 20;
            }
        });

        // Легенда цветов
        currentY = y + height - 80;
        ctx.font = 'bold 12px Arial';
        ctx.fillText('🎨 ЛЕГЕНДА ЦВЕТОВ:', x + 10, currentY);

        currentY += 20;
        footprints.slice(0, 4).forEach((footprint, index) => {
            const color = this.getColorForIndex(index);
            ctx.fillStyle = color;
            ctx.fillRect(x + 10, currentY - 10, 15, 15);
            ctx.fillStyle = this.colors.text;
            ctx.fillText(`След #${index + 1}`, x + 30, currentY);
            currentY += 20;
        });
    }

    /**
     * Рисует один след на canvas
     */
    drawFootprint(ctx, footprint, index) {
        const color = this.getColorForIndex(index);

        if (footprint.predictions) {
            footprint.predictions.forEach(pred => {
                if (pred.points && pred.points.length > 2) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = pred.class === 'Outline-trail' ? 3 : 2;
                    ctx.setLineDash(pred.class === 'Outline-trail' ? [5, 5] : []);

                    ctx.beginPath();
                    ctx.moveTo(pred.points[0].x, pred.points[0].y);

                    for (let i = 1; i < pred.points.length; i++) {
                        ctx.lineTo(pred.points[i].x, pred.points[i].y);
                    }

                    ctx.closePath();
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });
        }
    }

    /**
     * Возвращает цвет для индекса следа
     */
    getColorForIndex(index) {
        const colors = [
            'rgba(255, 0, 0, 0.7)',      // Красный
            'rgba(0, 255, 0, 0.7)',      // Зеленый
            'rgba(0, 0, 255, 0.7)',      // Синий
            'rgba(255, 255, 0, 0.7)',    // Желтый
            'rgba(255, 0, 255, 0.7)',    // Пурпурный
            'rgba(0, 255, 255, 0.7)',     // Голубой
            'rgba(255, 165, 0, 0.7)',    // Оранжевый
            'rgba(128, 0, 128, 0.7)'     // Фиолетовый
        ];
        return colors[index % colors.length];
    }

    /**
     * Добавляет информацию о модели
     */
    drawModelInfo(ctx, model, footprintsCount) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 300, 100);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🧩 СОБРАННАЯ МОДЕЛЬ', 20, 30);

        ctx.font = '14px Arial';
        ctx.fillText(`Следов: ${footprintsCount}`, 20, 55);
        ctx.fillText(`Полнота: ${model.completeness || 0}%`, 20, 75);
        ctx.fillText(`Уверенность: ${model.confidence || 0}%`, 20, 95);
    }

    /**
     * Вычисляет общий bounding box для предсказаний
     */
    calculateOverallBoundingBox(predictions) {
        if (!predictions || predictions.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                pred.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            }
        });

        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
}

module.exports = VisualizationService;
