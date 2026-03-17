// modules/visualization/mask-viz.js
// 🎨 УЛУЧШЕННАЯ MASK ВИЗУАЛИЗАЦИЯ С ПОДДЕРЖКОЙ ПАР

const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

class MaskStyleVisualization {
    constructor() {
        this.styleName = 'mask';
        this.modelVersion = 'Roboflow v13 + топология';
        console.log('✅ Enhanced MaskStyleVisualization с поддержкой пар создан');
    }

    async createVisualization(imageUrl, predictions, userData = {}, outputPath = null) {
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

                // 3. Рисуем предсказания и связи с учетом пар
                await this.drawPredictionsWithPairs(ctx, predictions, userData);

                // 4. Добавляем информационный штамп
                this.drawInfoStamp(ctx, canvas.width, canvas.height, predictions, userData);

                // Сохраняем результат
                const finalOutputPath = outputPath || path.join(this.ensureTempDir(), `enhanced_mask_${Date.now()}.png`);
                const bufferOut = canvas.toBuffer('image/png');
                fs.writeFileSync(finalOutputPath, bufferOut);

                console.log('✅ Улучшенная mask визуализация создана:', finalOutputPath);
                return finalOutputPath;

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

    /**
     * 🔥 НОВЫЙ МЕТОД: отрисовка с учетом пар из топологической системы
     */
    async drawPredictionsWithPairs(ctx, predictions, userData) {
        try {
            // Создаем карту пар, если они есть в userData
            const pairs = userData.pairs || new Map(); // photoId -> { modelId, pairNumber, status }
            const matchedPoints = new Set(pairs.keys()); // ID точек, у которых есть пара

            console.log(`   📍 Найдено ${matchedPoints.size} сопоставленных точек`);

            const validPredictions = predictions.filter(pred =>
                pred && pred.points && Array.isArray(pred.points) && pred.points.length >= 3
            );

            if (validPredictions.length === 0) {
                console.log('⚠️ Нет валидных predictions для отрисовки');
                return;
            }

            // Разделяем предсказания на категории
            const outlines = validPredictions.filter(p => p.class === 'Outline-trail');
            const protectors = validPredictions.filter(p => p.class === 'shoe-protector');
            const morphology = validPredictions.filter(p => p.class === 'Morphology');
            const others = validPredictions.filter(p =>
                p.class !== 'Outline-trail' &&
                p.class !== 'shoe-protector' &&
                p.class !== 'Morphology'
            );

            // Сначала рисуем контуры (фон)
            outlines.forEach(pred => this.drawOutline(ctx, pred));

            // Рисуем морфологию
            morphology.forEach(pred => this.drawMorphology(ctx, pred));

            // Рисуем остальные классы
            others.forEach(pred => this.drawDefault(ctx, pred));

            // 🔥 КЛЮЧЕВОЕ: рисуем протекторы с учетом пар
            await this.drawProtectorsWithPairs(ctx, protectors, pairs);

            // Рисуем связи между протекторами (для наглядности)
            this.drawConnections(ctx, protectors);

        } catch (error) {
            console.log('❌ Ошибка в drawPredictionsWithPairs:', error.message);
        }
    }

    /**
     * 🔥 НОВЫЙ МЕТОД: отрисовка протекторов с номерами пар
     */
    async drawProtectorsWithPairs(ctx, protectors, pairs) {
        if (protectors.length === 0) return;

        // Сначала вычисляем центры для всех протекторов
        for (const pred of protectors) {
            pred.center = this.calculateCenter(pred.points);
           
            // Генерируем ID для точки (если его нет)
            if (!pred.id) {
                pred.id = `pt_${Date.now()}_${Math.random()}`;
            }
        }

        // Рисуем сами протекторы (полупрозрачные)
        for (const pred of protectors) {
            this.drawProtectorShape(ctx, pred);
        }

        // 🔥 Рисуем номера пар
        for (const pred of protectors) {
            const pair = pairs.get(pred.id);
           
            if (pair) {
                // ✅ Это сопоставленная точка - фиолетовый круг с номером
                this.drawPairedPoint(ctx, pred.center, pair.pairNumber);
            } else {
                // ❌ Неподтверждённая точка - маленькая чёрная
                this.drawUnpairedPoint(ctx, pred.center);
            }
        }
    }

    /**
     * Рисует форму протектора (полупрозрачный чёрный)
     */
    drawProtectorShape(ctx, prediction) {
        const points = prediction.points;

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Очень светлая заливка

        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    /**
     * Рисует сопоставленную точку: фиолетовый круг с номером
     */
    drawPairedPoint(ctx, center, pairNumber) {
        // Фиолетовый круг
        ctx.fillStyle = '#AA00FF'; // Фиолетовый
        ctx.strokeStyle = '#FFFFFF'; // Белая обводка для контраста
        ctx.lineWidth = 2;
       
        ctx.beginPath();
        ctx.arc(center.x, center.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Белый номер
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pairNumber.toString(), center.x, center.y);
    }

    /**
     * Рисует неподтверждённую точку: маленькая чёрная
     */
    drawUnpairedPoint(ctx, center) {
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(center.x, center.y, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    /**
     * Рисует контур следа
     */
    drawOutline(ctx, prediction) {
        const points = prediction.points;
       
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

    /**
     * Рисует морфологию
     */
    drawMorphology(ctx, prediction) {
        const points = prediction.points;
       
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([]);

        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    /**
     * Рисует остальные классы
     */
    drawDefault(ctx, prediction) {
        const points = prediction.points;
       
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([]);

        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    /**
     * Рисует связи между протекторами (для наглядности)
     */
    drawConnections(ctx, protectors) {
        if (protectors.length < 2) return;

        // Тонкие чёрные линии
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.setLineDash([]);

        for (let i = 0; i < protectors.length; i++) {
            for (let j = i + 1; j < protectors.length; j++) {
                const p1 = protectors[i].center;
                const p2 = protectors[j].center;

                if (!p1 || !p2) continue;

                const distance = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) +
                    Math.pow(p2.y - p1.y, 2)
                );

                // Рисуем только близкие связи
                if (distance < 150) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        }
    }

    /**
     * Рисует информационный штамп
     */
    drawInfoStamp(ctx, width, height, predictions, userData) {
        try {
            const stats = this.calculateStats(predictions);
            const confidenceStats = this.calculateConfidenceStats(predictions);
            const currentDate = new Date().toLocaleDateString('ru-RU');
           
            // Данные о парах
            const pairs = userData.pairs || new Map();
            const pairedCount = pairs.size;
            const totalProtectors = stats.protectors;

            // Штамп слева вверху
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, 280, 90);

            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px Arial';
            ctx.fillText('🔍 АНАЛИЗ СЛЕДА', 20, 28);

            ctx.font = '11px Arial';
            ctx.fillText(`• Протекторов: ${totalProtectors}`, 20, 45);
            ctx.fillText(`• Контуров: ${stats.outlines}`, 20, 60);
            ctx.fillText(`• Сред. уверенность: ${confidenceStats.avgConfidence}%`, 20, 75);
           
            // 🔥 НОВОЕ: информация о парах
            if (pairedCount > 0) {
                ctx.fillStyle = '#AA00FF'; // Фиолетовый для пар
                ctx.font = 'bold 11px Arial';
                ctx.fillText(`• 🟣 Совпало: ${pairedCount}/${totalProtectors}`, 20, 92);
            }

            // Информация в правом нижнем углу
            ctx.font = '9px Arial';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillText(`${currentDate} | ${this.modelVersion}`, width - 200, height - 15);

        } catch (error) {
            console.log('❌ Ошибка в drawInfoStamp:', error.message);
        }
    }

    /**
     * Вычисляет статистику по классам
     */
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

    /**
     * Вычисляет статистику уверенности
     */
    calculateConfidenceStats(predictions) {
        let totalConfidence = 0;
        let validPredictions = 0;

        predictions.forEach(pred => {
            if (pred.confidence) {
                totalConfidence += pred.confidence;
                validPredictions++;
            }
        });

        const avgConfidence = validPredictions > 0
            ? Math.round((totalConfidence / validPredictions) * 100)
            : 0;

        return {
            avgConfidence: avgConfidence
        };
    }

    /**
     * Вычисляет центр полигона
     */
    calculateCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    /**
     * Создаёт временную директорию
     */
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
