// modules/visualization/mask-viz.js
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

class MaskStyleVisualization {
    constructor() {
        this.styleName = 'mask';
        this.modelVersion = 'Roboflow v13';
        console.log('✅ MaskStyleVisualization создан');
    }

    async createVisualization(imageUrl, predictions, userData = {}) {
        try {
            console.log('🎨 Создаем улучшенную MASK визуализацию...');
           
            if (!imageUrl) {
                console.log('❌ Нет imageUrl');
                return null;
            }

            if (!predictions || !Array.isArray(predictions)) {
                console.log('❌ Неверные predictions');
                return null;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
           
            try {
                const response = await fetch(imageUrl, { signal: controller.signal });
                clearTimeout(timeout);
               
                if (!response.ok) {
                    console.log(`❌ HTTP ошибка: ${response.status}`);
                    return null;
                }
               
                const buffer = await response.arrayBuffer();
                const image = await loadImage(Buffer.from(buffer));
               
                // Создаем canvas с небольшим отступом для текста
                const canvas = createCanvas(image.width, image.height);
                const ctx = canvas.getContext('2d');
               
                // 1. Рисуем оригинальное изображение (более насыщенное)
                ctx.globalAlpha = 0.4;
                ctx.drawImage(image, 0, 0);
                ctx.globalAlpha = 1.0;
               
                // 2. Темная маска (менее прозрачная для лучшего контраста)
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
               
                // 3. Рисуем предсказания и связи
                this.drawPredictionsWithConnections(ctx, predictions);
               
                // 4. Добавляем информационную панель
                this.drawInfoPanel(ctx, canvas.width, canvas.height, predictions);
               
                // Сохраняем результат
                const tempDir = this.ensureTempDir();
                const outputPath = path.join(tempDir, `enhanced_mask_${Date.now()}.png`);
               
                const bufferOut = canvas.toBuffer('image/png');
                fs.writeFileSync(outputPath, bufferOut);
               
                console.log('✅ Улучшенная mask визуализация создана:', outputPath);
                return outputPath;
               
            } catch (fetchError) {
                clearTimeout(timeout);
                if (fetchError.name === 'AbortError') {
                    console.log('❌ Таймаут загрузки изображения');
                } else {
                    throw fetchError;
                }
            }
           
            return null;
           
        } catch (error) {
            console.log('❌ Ошибка в createVisualization:', error.message);
            return null;
        }
    }

    drawPredictionsWithConnections(ctx, predictions) {
        try {
            const validPredictions = predictions.filter(pred =>
                pred && pred.points && Array.isArray(pred.points) && pred.points.length >= 3
            );
           
            if (validPredictions.length === 0) {
                console.log('⚠️ Нет валидных predictions для отрисовки');
                return;
            }

            // Сначала рисуем все полигоны
            validPredictions.forEach(prediction => {
                this.drawSinglePrediction(ctx, prediction);
            });

            // Затем рисуем связи между центрами близких точек
            this.drawConnections(ctx, validPredictions);
           
        } catch (error) {
            console.log('❌ Ошибка в drawPredictionsWithConnections:', error.message);
        }
    }

    drawSinglePrediction(ctx, prediction) {
        try {
            const points = prediction.points;
            const className = prediction.class || 'unknown';
           
            ctx.strokeStyle = '#000000';
            ctx.fillStyle = '#000000';
            ctx.lineCap = 'round';
           
            switch(className) {
                case 'Outline-trail':
                    this.drawOutline(ctx, points);
                    break;
                case 'shoe-protector':
                    this.drawProtector(ctx, points, prediction);
                    break;
                case 'Morphology':
                    this.drawMorphology(ctx, points);
                    break;
                default:
                    this.drawDefault(ctx, points);
            }
        } catch (error) {
            console.log('❌ Ошибка отрисовки prediction:', error.message);
        }
    }

    drawOutline(ctx, points) {
        // Толстый пунктир для контура следа
        ctx.setLineDash([20, 10]);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
       
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawProtector(ctx, points, prediction) {
        // Черные полигоны для деталей протектора
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Легкая заливка
       
        // Рисуем полигон
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
       
        // Центральная точка (черная)
        const center = this.calculateCenter(points);
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(center.x, center.y, 4, 0, 2 * Math.PI);
        ctx.fill();
       
        // Сохраняем центр для связей
        prediction.center = center;
    }

    drawMorphology(ctx, points) {
        // Тонкие линии для морфологии
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#000000';
       
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    drawDefault(ctx, points) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000000';
       
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    drawConnections(ctx, predictions) {
        try {
            const protectors = predictions.filter(p => p.class === 'shoe-protector' && p.center);
           
            if (protectors.length < 2) return;
           
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
           
            // Рисуем связи между близкими центрами
            for (let i = 0; i < protectors.length; i++) {
                for (let j = i + 1; j < protectors.length; j++) {
                    const center1 = protectors[i].center;
                    const center2 = protectors[j].center;
                   
                    const distance = Math.sqrt(
                        Math.pow(center2.x - center1.x, 2) +
                        Math.pow(center2.y - center1.y, 2)
                    );
                   
                    // Соединяем только близкие точки (расстояние меньше 150px)
                    if (distance < 150) {
                        ctx.beginPath();
                        ctx.moveTo(center1.x, center1.y);
                        ctx.lineTo(center2.x, center2.y);
                        ctx.stroke();
                    }
                }
            }
           
            ctx.setLineDash([]);
           
        } catch (error) {
            console.log('❌ Ошибка в drawConnections:', error.message);
        }
    }

    drawInfoPanel(ctx, width, height, predictions) {
        try {
            const stats = this.calculateStats(predictions);
            const currentDate = new Date().toLocaleDateString('ru-RU');
           
            // Фон для информационной панели
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(10, 10, 250, 80);
           
            // Рамка
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(10, 10, 250, 80);
           
            // Текст статистики
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px Arial';
            ctx.fillText('📊 АНАЛИЗ СЛЕДА', 20, 30);
           
            ctx.font = '12px Arial';
            ctx.fillText(`• Деталей: ${stats.protectors}`, 20, 50);
            ctx.fillText(`• Контуров: ${stats.outlines}`, 20, 65);
            ctx.fillText(`• Морфология: ${stats.morphology}`, 20, 80);
           
            // Информация в правом нижнем углу
            ctx.font = '10px Arial';
            ctx.fillText(`${currentDate} | ${this.modelVersion}`, width - 200, height - 20);
           
        } catch (error) {
            console.log('❌ Ошибка в drawInfoPanel:', error.message);
        }
    }

    calculateStats(predictions) {
        const stats = {
            protectors: 0,
            outlines: 0,
            morphology: 0
        };
       
        predictions.forEach(pred => {
            switch(pred.class) {
                case 'shoe-protector':
                    stats.protectors++;
                    break;
                case 'Outline-trail':
                    stats.outlines++;
                    break;
                case 'Morphology':
                    stats.morphology++;
                    break;
            }
        });
       
        return stats;
    }

    calculateCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    ensureTempDir() {
        const tempDir = path.join(__dirname, '../../temp');
        try {
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            return tempDir;
        } catch (error) {
            console.log('❌ Ошибка создания temp dir:', error.message);
            return __dirname;
        }
    }
}

module.exports = MaskStyleVisualization;
