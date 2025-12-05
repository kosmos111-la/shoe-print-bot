// trust-visualizer.js - ВИЗУАЛИЗАЦИЯ ДЛЯ ПРОВЕРКИ
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

class TrustVisualizer {
    constructor() {
        this.tempDir = path.join(process.cwd(), 'temp');
        this.ensureTempDir();
    }

    async createTrustworthyComparison(model1, model2, comparisonResult, photo1Path, photo2Path) {
        try {
            const canvasWidth = 1600;
            const canvasHeight = 900;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // 1. ТЕМНЫЙ ФОН
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. РЕАЛЬНЫЕ ФОТО (если есть)
            if (photo1Path && fs.existsSync(photo1Path)) {
                await this.drawPhotoWithOrientation(ctx, photo1Path, 50, 50, 350, 350,
                    model1.topologyInvariants?.normalizationParams?.rotation, 'ФОТО 1');
            }

            if (photo2Path && fs.existsSync(photo2Path)) {
                await this.drawPhotoWithOrientation(ctx, photo2Path, 1200, 50, 350, 350,
                    model2.topologyInvariants?.normalizationParams?.rotation, 'ФОТО 2');
            }

            // 3. СРАВНЕНИЕ В ЦЕНТРЕ
            this.drawComparisonCenter(ctx, canvasWidth, canvasHeight, model1, model2, comparisonResult);

            // 4. ПОДРОБНАЯ ИНФОРМАЦИЯ
            this.drawDetailedInfo(ctx, model1, model2, comparisonResult);

            const outputPath = path.join(this.tempDir, `trust_compare_${Date.now()}.png`);
            fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
           
            return outputPath;

        } catch (error) {
            console.log('❌ Ошибка trust визуализации:', error);
            return null;
        }
    }

    async drawPhotoWithOrientation(ctx, photoPath, x, y, width, height, pcaRotation, label) {
        try {
            const image = await loadImage(photoPath);
           
            // Рисуем фото
            ctx.globalAlpha = 0.7;
            ctx.drawImage(image, x, y, width, height);
            ctx.globalAlpha = 1.0;

            // Рамка
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            // Информация
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(label, x + 10, y + 20);
           
            if (pcaRotation !== undefined) {
                const degrees = (pcaRotation * 180 / Math.PI).toFixed(1);
                ctx.fillText(`PCA: ${degrees}°`, x + 10, y + 40);
               
                // СТРЕЛКА ОРИЕНТАЦИИ
                this.drawOrientationArrow(ctx, x + width/2, y + height/2,
                    width/2 - 20, pcaRotation, '#ff0000');
            }
        } catch (error) {
            console.log('⚠️ Не удалось загрузить фото:', photoPath);
        }
    }

    drawOrientationArrow(ctx, centerX, centerY, length, angle, color) {
        const endX = centerX + length * Math.cos(angle);
        const endY = centerY + length * Math.sin(angle);
       
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
       
        // Стрелка
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(endX, endY, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawComparisonCenter(ctx, width, height, model1, model2, comparison) {
        const centerX = width / 2;
        const centerY = height / 2 + 100;
       
        // НОРМАЛИЗОВАННЫЕ УЗЛЫ моделей
        const nodes1 = Array.from(model1.topologyInvariants?.normalizedNodes?.values() || []);
        const nodes2 = Array.from(model2.topologyInvariants?.normalizedNodes?.values() || []);
       
        // МАСШТАБ для canvas
        const scale = 200;
       
        // РИСУЕМ УЗЛЫ МОДЕЛИ 1 (синие)
        nodes1.forEach((node, i) => {
            const x = centerX + node.x * scale;
            const y = centerY + node.y * scale;
           
            ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
           
            // Номер узла
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.fillText(i.toString(), x - 3, y - 8);
        });
       
        // РИСУЕМ УЗЛЫ МОДЕЛИ 2 (красные) - С ПОВОРОТОМ!
        const rotationAngle = comparison.details?.rotationAngleDegrees || 0;
        const rad = rotationAngle * Math.PI / 180;
       
        nodes2.forEach((node, i) => {
            // Поворачиваем!
            const rotatedX = node.x * Math.cos(rad) - node.y * Math.sin(rad);
            const rotatedY = node.x * Math.sin(rad) + node.y * Math.cos(rad);
           
            const x = centerX + rotatedX * scale;
            const y = centerY + rotatedY * scale;
           
            ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
           
            // Номер узла
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.fillText(i.toString(), x - 3, y + 15);
        });
       
        // ЛЕГЕНДА
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(centerX - 100, centerY - 200, 200, 50);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🔵 Модель 1 (синие)', centerX, centerY - 180);
        ctx.fillText('🔴 Модель 2 (красные) - с поворотом', centerX, centerY - 160);
        ctx.textAlign = 'left';
    }

    drawDetailedInfo(ctx, model1, model2, comparison) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(50, 600, 1500, 250);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
       
        const yStart = 630;
        let y = yStart;
       
        // МОДЕЛЬ 1
        ctx.fillText('📐 МОДЕЛЬ 1:', 70, y);
        y += 25;
        ctx.font = '14px Arial';
        const rot1 = model1.topologyInvariants?.normalizationParams?.rotation || 0;
        ctx.fillText(`• PCA поворот: ${(rot1 * 180 / Math.PI).toFixed(1)}°`, 90, y);
        y += 20;
        ctx.fillText(`• Узлов: ${model1.nodes.size}`, 90, y);
        y += 20;
       
        // МОДЕЛЬ 2
        y += 10;
        ctx.font = '16px Arial';
        ctx.fillText('📐 МОДЕЛЬ 2:', 70, y);
        y += 25;
        ctx.font = '14px Arial';
        const rot2 = model2.topologyInvariants?.normalizationParams?.rotation || 0;
        ctx.fillText(`• PCA поворот: ${(rot2 * 180 / Math.PI).toFixed(1)}°`, 90, y);
        y += 20;
        ctx.fillText(`• Узлов: ${model2.nodes.size}`, 90, y);
        y += 20;
       
        // СРАВНЕНИЕ
        y += 10;
        ctx.font = '16px Arial';
        ctx.fillText('🔍 СРАВНЕНИЕ:', 70, y);
        y += 25;
        ctx.font = '14px Arial';
        ctx.fillText(`• Примененный поворот: ${comparison.details?.rotationAngleDegrees?.toFixed(1) || 0}°`, 90, y);
        y += 20;
        ctx.fillText(`• Разница PCA: ${Math.abs((rot1 - rot2) * 180 / Math.PI).toFixed(1)}°`, 90, y);
        y += 20;
        ctx.fillText(`• Совпадение: ${Math.round(comparison.score * 100)}%`, 90, y);
        y += 20;
        ctx.fillText(`• Сопоставлено узлов: ${comparison.matched}/${comparison.total}`, 90, y);
       
        // ПРАВАЯ КОЛОНКА - ПРОБЛЕМЫ
        ctx.fillText('⚠️ ПРОБЛЕМЫ:', 800, yStart);
        y = yStart + 25;
        ctx.font = '14px Arial';
       
        const expectedDiff = 90; // Ожидаемая разница вертикаль/горизонталь
        const actualDiff = Math.abs((rot1 - rot2) * 180 / Math.PI);
       
        if (Math.abs(actualDiff - expectedDiff) > 20) {
            ctx.fillStyle = '#ff6666';
            ctx.fillText(`❌ Разница поворотов: ${actualDiff.toFixed(1)}° (ожидалось ~90°)`, 820, y);
            y += 20;
            ctx.fillText(`• PCA определил модель 2 как диагональную, не горизонтальную!`, 820, y);
            y += 20;
        }
       
        if (comparison.score < 0.7) {
            ctx.fillText(`⚠️ Низкое совпадение (<70%)`, 820, y);
            y += 20;
        }
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
}

module.exports = TrustVisualizer;
