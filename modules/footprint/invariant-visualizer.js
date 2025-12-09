// modules/footprint/invariant-visualizer.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class InvariantVisualizer {
    constructor() {
        this.outputDir = './temp/invariants';
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
   
    async visualizeComparison(graph1, graph2, comparisonResult, outputPath = null) {
        const canvas = createCanvas(1000, 700);
        const ctx = canvas.getContext('2d');
       
        // Тёмный фон
        ctx.fillStyle = '#0c2461';
        ctx.fillRect(0, 0, 1000, 700);
       
        // ЗАГОЛОВОК
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('🔍 ПОЧЕМУ СИСТЕМА СЧИТАЕТ, ЧТО ЭТО ОДИН СЛЕД', 50, 40);
       
        // 1. ЛЕВАЯ ЧАСТЬ: ГРАФ 1
        ctx.fillStyle = '#ff4757';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('ГРАФ 1 (вертикальный)', 50, 80);
        this.drawGraph(ctx, graph1, 100, 120, '#ff4757');
       
        // 2. ПРАВАЯ ЧАСТЬ: ГРАФ 2 
        ctx.fillStyle = '#2ed573';
        ctx.fillText('ГРАФ 2 (горизонтальный)', 550, 80);
        this.drawGraph(ctx, graph2, 600, 120, '#2ed573');
       
        // 3. ЦЕНТР: ИНВАРИАНТЫ (ЧТО СРАВНИВАЕТСЯ)
        ctx.fillStyle = '#ffdd59';
        ctx.fillText('📊 ЧТО СРАВНИВАЕТ СИСТЕМА:', 350, 350);
       
        // Список инвариантов
        const invariants = [
            '1. Количество узлов (протекторов)',
            '2. Количество рёбер (связей)',
            '3. Средняя степень узлов',
            '4. Коэффициент кластеризации',
            '5. Диаметр графа',
            '6. Плотность графа',
            '7. Распределение степеней',
            '8. Форма облака точек'
        ];
       
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        invariants.forEach((text, i) => {
            ctx.fillText(text, 350, 380 + i * 25);
        });
       
        // 4. РЕЗУЛЬТАТ СРАВНЕНИЯ
        if (comparisonResult) {
            ctx.fillStyle = '#70a1ff';
            ctx.font = 'bold 22px Arial';
            ctx.fillText(`🎯 РЕЗУЛЬТАТ: similarity = ${(comparisonResult.similarity * 100).toFixed(1)}%`, 350, 600);
           
            ctx.fillStyle = comparisonResult.decision === 'same' ? '#2ed573' :
                          comparisonResult.decision === 'similar' ? '#ff9f43' : '#ff4757';
            ctx.fillText(`РЕШЕНИЕ: ${comparisonResult.decision.toUpperCase()}`, 350, 630);
           
            if (comparisonResult.comparisons) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '14px Arial';
                ctx.fillText('📈 Детали сравнения:', 350, 660);
               
                comparisonResult.comparisons.forEach((comp, i) => {
                    ctx.fillText(`${comp.name}: ${comp.score.toFixed(2)}`, 370, 680 + i * 20);
                });
            }
        }
       
        // Сохраняем
        const finalPath = outputPath || path.join(this.outputDir, `invariants_${Date.now()}.png`);
        await this.saveCanvas(canvas, finalPath);
       
        return finalPath;
    }
   
    drawGraph(ctx, graph, offsetX, offsetY, color) {
        if (!graph.nodes || graph.nodes.size === 0) return;
       
        // Простая сетка для демонстрации
        const size = 150;
        const nodeSize = 4;
       
        // Отрисовываем "типовую" структуру следа
        ctx.strokeStyle = color + '80';
        ctx.lineWidth = 1;
       
        // Основной контур (псевдо-след)
        ctx.beginPath();
        ctx.ellipse(offsetX + size/2, offsetY + size/2, size*0.4, size*0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
       
        // Точки протекторов (случайные, но в форме следа)
        const nodeCount = Math.min(graph.nodes.size || 20, 30);
       
        for (let i = 0; i < nodeCount; i++) {
            const angle = Math.PI * 2 * i / nodeCount;
            const radiusX = size * 0.35;
            const radiusY = size * 0.2;
            const variation = 0.3;
           
            const x = offsetX + size/2 +
                     radiusX * Math.cos(angle) * (0.7 + Math.random() * variation);
            const y = offsetY + size/2 +
                     radiusY * Math.sin(angle) * (0.7 + Math.random() * variation);
           
            // Точка
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
            ctx.fill();
           
            // Связи с соседями (если есть)
            if (i < nodeCount - 1) {
                const nextAngle = Math.PI * 2 * (i + 1) / nodeCount;
                const nextX = offsetX + size/2 +
                            radiusX * Math.cos(nextAngle) * (0.7 + Math.random() * variation);
                const nextY = offsetY + size/2 +
                            radiusY * Math.sin(nextAngle) * (0.7 + Math.random() * variation);
               
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(nextX, nextY);
                ctx.stroke();
            }
        }
       
        // Подпись с количеством узлов
        ctx.fillStyle = color;
        ctx.font = '14px Arial';
        ctx.fillText(`Узлов: ${graph.nodes.size || '?'}`, offsetX, offsetY + size + 20);
        ctx.fillText(`Рёбер: ${graph.edges.size || '?'}`, offsetX, offsetY + size + 40);
    }
   
    async saveCanvas(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            out.on('finish', () => resolve(filePath));
            out.on('error', reject);
        });
    }
}

module.exports = InvariantVisualizer;
