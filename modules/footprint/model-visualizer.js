// modules/footprint/model-visualizer.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class ModelVisualizer {
    constructor() {
        console.log('🎨 ModelVisualizer создан');
    }

    // ВИЗУАЛИЗАЦИЯ ОДНОЙ МОДЕЛИ
    async visualizeModel(footprint, outputPath = null) {
        try {
            if (!footprint || !footprint.nodes || footprint.nodes.size === 0) {
                console.log('❌ Модель пуста для визуализации');
                return null;
            }

            console.log(`🎨 Визуализирую модель: ${footprint.nodes.size} узлов`);

            // Создаем canvas подходящего размера
            const canvasWidth = 800;
            const canvasHeight = 600;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // 1. ФОН
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. НОРМАЛИЗУЕМ координаты модели в границы canvas
            const normalizedNodes = this.normalizeNodes(footprint, canvasWidth, canvasHeight);

            // 3. РИСУЕМ СВЯЗИ (первыми, чтобы были под узлами)
            this.drawEdges(ctx, normalizedNodes, footprint.edges);

            // 4. РИСУЕМ УЗЛЫ
            this.drawNodes(ctx, normalizedNodes);

            // 5. РИСУЕМ ИНФОРМАЦИЮ
            this.drawInfo(ctx, canvasWidth, canvasHeight, footprint);

            // Сохраняем
            const finalPath = outputPath || path.join(
                path.dirname(__dirname),
                '../../temp',
                `model_${footprint.id.slice(0, 8)}.png`
            );

            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(finalPath, buffer);

            console.log(`✅ Визуализация модели сохранена: ${finalPath}`);
            return finalPath;

        } catch (error) {
            console.log('❌ Ошибка визуализации модели:', error.message);
            return null;
        }
    }

    // НОРМАЛИЗАЦИЯ УЗЛОВ В ГРАНИЦЫ CANVAS
    normalizeNodes(footprint, canvasWidth, canvasHeight) {
        const nodes = Array.from(footprint.nodes.values());
        const normalized = new Map();

        if (!footprint.boundingBox) {
            // Если нет boundingBox, вычисляем
            const xs = nodes.map(n => n.center.x);
            const ys = nodes.map(n => n.center.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const width = maxX - minX;
            const height = maxY - minY;

            footprint.boundingBox = { minX, maxX, minY, maxY, width, height };
        }

        const { minX, maxX, minY, maxY, width, height } = footprint.boundingBox;
       
        // Добавляем отступы
        const padding = 50;
        const scale = Math.min(
            (canvasWidth - padding * 2) / width,
            (canvasHeight - padding * 2) / height
        );

        nodes.forEach(node => {
            // Масштабируем и центрируем
            const x = padding + (node.center.x - minX) * scale;
            const y = padding + (node.center.y - minY) * scale;
           
            normalized.set(node.id, {
                ...node,
                normalizedCenter: { x, y },
                normalizedSize: node.size * scale * 0.1 // Немного уменьшаем для визуализации
            });
        });

        return normalized;
    }

    // РИСОВАНИЕ СВЯЗЕЙ
    drawEdges(ctx, normalizedNodes, edges) {
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.3)';
        ctx.lineWidth = 1;

        edges.forEach(edge => {
            const fromNode = normalizedNodes.get(edge.from);
            const toNode = normalizedNodes.get(edge.to);

            if (fromNode && toNode && fromNode.normalizedCenter && toNode.normalizedCenter) {
                ctx.beginPath();
                ctx.moveTo(fromNode.normalizedCenter.x, fromNode.normalizedCenter.y);
                ctx.lineTo(toNode.normalizedCenter.x, toNode.normalizedCenter.y);
                ctx.stroke();
            }
        });
    }

    // РИСОВАНИЕ УЗЛОВ
    drawNodes(ctx, normalizedNodes) {
        normalizedNodes.forEach((node, nodeId) => {
            if (!node.normalizedCenter) return;

            const { x, y } = node.normalizedCenter;
            const size = Math.max(3, node.normalizedSize || 5);
           
            // Цвет по уверенности
            let color;
            if (node.confidence > 0.8) {
                color = '#00cc00'; // Высокая уверенность - зеленый
            } else if (node.confidence > 0.5) {
                color = '#ff9900'; // Средняя - оранжевый
            } else {
                color = '#ff3333'; // Низкая - красный
            }

            // Узел
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Маленькая точка в центре для высокоуверенных
            if (node.confidence > 0.8) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    // РИСОВАНИЕ ИНФОРМАЦИИ
    drawInfo(ctx, width, height, footprint) {
        // Полупрозрачная панель
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 300, 120);

        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`👣 МОДЕЛЬ: ${footprint.name}`, 20, 35);

        ctx.font = '14px Arial';
        ctx.fillText(`🆔 ${footprint.id.slice(0, 8)}...`, 20, 60);
        ctx.fillText(`📊 Узлов: ${footprint.nodes.size}`, 20, 85);
        ctx.fillText(`🔗 Связей: ${footprint.edges.length}`, 20, 110);
        ctx.fillText(`💎 Уверенность: ${Math.round(footprint.stats.confidence * 100)}%`, 20, 135);

        // Легенда в правом нижнем углу
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(width - 160, height - 80, 150, 70);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('🎯 ЛЕГЕНДА:', width - 150, height - 60);
        ctx.fillStyle = '#00cc00';
        ctx.fillRect(width - 150, height - 45, 10, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('- Высокая уверенность', width - 135, height - 40);
        ctx.fillStyle = '#ff9900';
        ctx.fillRect(width - 150, height - 25, 10, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('- Средняя уверенность', width - 135, height - 20);
    }

    // ВИЗУАЛИЗАЦИЯ СРАВНЕНИЯ ДВУХ МОДЕЛЕЙ
    async visualizeComparison(model1, model2, comparisonResult, outputPath = null) {
        try {
            const canvasWidth = 1200;
            const canvasHeight = 600;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // 1. ФОН
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. ЛЕВАЯ ЧАСТЬ - МОДЕЛЬ 1
            ctx.fillStyle = 'rgba(0, 100, 255, 0.1)';
            ctx.fillRect(0, 0, canvasWidth / 2, canvasHeight);

            // 3. ПРАВАЯ ЧАСТЬ - МОДЕЛЬ 2
            ctx.fillStyle = 'rgba(255, 100, 0, 0.1)';
            ctx.fillRect(canvasWidth / 2, 0, canvasWidth / 2, canvasHeight);

            // 4. РИСУЕМ ОБЕ МОДЕЛИ
            await this.drawModelComparison(ctx, model1, model2, comparisonResult, canvasWidth, canvasHeight);

            // 5. ИНФОРМАЦИЯ О СРАВНЕНИИ
            this.drawComparisonInfo(ctx, canvasWidth, canvasHeight, comparisonResult);

            const finalPath = outputPath || path.join(
                path.dirname(__dirname),
                '../../temp',
                `compare_${model1.id.slice(0, 8)}_${model2.id.slice(0, 8)}.png`
            );

            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(finalPath, buffer);

            console.log(`✅ Визуализация сравнения сохранена: ${finalPath}`);
            return finalPath;

        } catch (error) {
            console.log('❌ Ошибка визуализации сравнения:', error.message);
            return null;
        }
    }

    drawModelComparison(ctx, model1, model2, comparison, width, height) {
        // Здесь можно реализовать сравнение двух моделей
        // Пока просто рисуем информацию
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`СРАВНЕНИЕ МОДЕЛЕЙ`, width / 2 - 100, 40);
        ctx.fillText(`Совпадение: ${Math.round(comparison.score * 100)}%`, width / 2 - 80, 70);
    }

    drawComparisonInfo(ctx, width, height, comparison) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(20, height - 120, width - 40, 100);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
       
        if (comparison.matches) {
            ctx.fillText(`✅ Совпадающих узлов: ${comparison.matched || 0}`, 30, height - 95);
            ctx.fillText(`📊 Общее количество узлов: ${comparison.total || 0}`, 30, height - 70);
            ctx.fillText(`🎯 Процент совпадения: ${Math.round(comparison.score * 100)}%`, 30, height - 45);
           
            // Интерпретация
            let interpretation = '';
            if (comparison.score > 0.8) interpretation = '🔴 ВЫСОКАЯ вероятность что это одна обувь';
            else if (comparison.score > 0.6) interpretation = '🟡 СРЕДНЯЯ вероятность, нужны дополнительные данные';
            else interpretation = '🟢 НИЗКАЯ вероятность, разные протекторы';
           
            ctx.fillText(interpretation, 30, height - 20);
        }
    }
}

module.exports = ModelVisualizer;
