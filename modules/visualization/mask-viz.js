const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

class MaskStyleVisualization {
    constructor() {
        this.styleName = 'mask';
        this.modelVersion = 'Roboflow v13';
        console.log('✅ Enhanced MaskStyleVisualization создан');
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
               
                const canvas = createCanvas(image.width, image.height);
                const ctx = canvas.getContext('2d');
               
                // 1. Оригинальное изображение
                ctx.globalAlpha = 0.4;
                ctx.drawImage(image, 0, 0);
                ctx.globalAlpha = 1.0;
               
                // 2. Темная маска
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
               
                // 3. Рисуем предсказания и связи
                this.drawPredictionsWithConnections(ctx, predictions);
               
                // 4. Добавляем информационный штамп
                this.drawInfoStamp(ctx, canvas.width, canvas.height, predictions);
               
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

            // Затем рисуем заметные связи между центрами
            this.drawEnhancedConnections(ctx, validPredictions);
           
        } catch (error) {
            console.log('❌ Ошибка в drawPredictionsWithConnections:', error.message);
        }
    }

    drawSinglePrediction(ctx, prediction) {
        try {
            const points = prediction.points;
            const className = prediction.class || 'unknown';
            const confidence = prediction.confidence || 0;
           
            // Сохраняем уверенность для использования в связях
            prediction.confidence = confidence;
           
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
        ctx.lineWidth = 6;
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
        const confidence = prediction.confidence || 0;
       
        // ОБВОДКА В 1 ПИКСЕЛЬ - ВСЕГДА ЧЕРНАЯ
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
       
        // Рисуем полигон с легкой заливкой
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
       
        // Центральная точка - ЧЕРНАЯ С КРАСНОЙ ОБВОДКОЙ для высокой уверенности
        const center = this.calculateCenter(points);
       
        if (confidence > 0.8) {
            // ВЫСОКАЯ УВЕРЕННОСТЬ - красная обводка
            ctx.fillStyle = '#000000';
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        } else {
            // ОБЫЧНАЯ ТОЧКА - просто черная
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
       
        // Сохраняем центр для связей
        prediction.center = center;
    }

    drawMorphology(ctx, points) {
        // Тонкие сплошные линии для морфологии
        ctx.lineWidth = 1;
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
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000000';
       
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    drawEnhancedConnections(ctx, predictions) {
        try {
            const protectors = predictions.filter(p => p.class === 'shoe-protector' && p.center);
           
            if (protectors.length < 2) return;
           
            // Сначала рисуем все линии ЧЕРНЫМИ
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#000000';
            ctx.setLineDash([]);
           
            for (let i = 0; i < protectors.length; i++) {
                for (let j = i + 1; j < protectors.length; j++) {
                    const center1 = protectors[i].center;
                    const center2 = protectors[j].center;
                   
                    const distance = Math.sqrt(
                        Math.pow(center2.x - center1.x, 2) +
                        Math.pow(center2.y - center1.y, 2)
                    );
                   
                    if (distance < 150) {
                        ctx.beginPath();
                        ctx.moveTo(center1.x, center1.y);
                        ctx.lineTo(center2.x, center2.y);
                        ctx.stroke();
                    }
                }
            }
           
            // Затем поверх рисуем КРАСНЫЕ ПОДСВЕТКИ для высокоуверенных связей
            ctx.lineWidth = 3; // Толще для подсветки
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'; // Полупрозрачный красный
           
            for (let i = 0; i < protectors.length; i++) {
                for (let j = i + 1; j < protectors.length; j++) {
                    const center1 = protectors[i].center;
                    const center2 = protectors[j].center;
                    const minConfidence = Math.min(protectors[i].confidence || 0, protectors[j].confidence || 0);
                   
                    const distance = Math.sqrt(
                        Math.pow(center2.x - center1.x, 2) +
                        Math.pow(center2.y - center1.y, 2)
                    );
                   
                    // Подсвечиваем только высокоуверенные связи
                    if (distance < 150 && minConfidence > 0.8) {
                        ctx.beginPath();
                        ctx.moveTo(center1.x, center1.y);
                        ctx.lineTo(center2.x, center2.y);
                        ctx.stroke();
                    }
                }
            }
           
        } catch (error) {
            console.log('❌ Ошибка в drawConnections:', error.message);
        }
    }

    drawInfoStamp(ctx, width, height, predictions) {
        try {
            const stats = this.calculateStats(predictions);
            const confidenceStats = this.calculateConfidenceStats(predictions);
            const currentDate = new Date().toLocaleDateString('ru-RU');
           
            // ПРОЗРАЧНЫЙ ШТАМП - только рамка и текст
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, 250, 70);
           
            // Текст статистики (прямо на изображении)
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px Arial';
            ctx.fillText('🔍 АНАЛИЗ СЛЕДА', 20, 28);
           
            ctx.font = '11px Arial';
            ctx.fillText(`• Деталей: ${stats.protectors}`, 20, 45);
            ctx.fillText(`• Контуров: ${stats.outlines}`, 20, 60);
            ctx.fillText(`• Уверенность: ${confidenceStats.avgConfidence}%`, 20, 75);
           
            // Информация в правом нижнем углу
            ctx.font = '9px Arial';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillText(`${currentDate} | ${this.modelVersion}`, width - 180, height - 15);
           
        } catch (error) {
            console.log('❌ Ошибка в drawInfoStamp:', error.message);
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

    calculateConfidenceStats(predictions) {
        let totalConfidence = 0;
        let highConfidenceCount = 0;
        let validPredictions = 0;
       
        predictions.forEach(pred => {
            if (pred.confidence) {
                totalConfidence += pred.confidence;
                validPredictions++;
                if (pred.confidence > 0.8) {
                    highConfidenceCount++;
                }
            }
        });
       
        const avgConfidence = validPredictions > 0
            ? Math.round((totalConfidence / validPredictions) * 100)
            : 0;
           
        return {
            avgConfidence: avgConfidence,
            highConfidence: highConfidenceCount
        };
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
