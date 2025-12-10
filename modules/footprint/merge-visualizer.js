// modules/footprint/merge-visualizer.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class MergeVisualizer {
    constructor() {
        console.log('🎨 Создан визуализатор объединений');
    }

    // 1. ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ ДВУХ ОТПЕЧАТКОВ
    visualizeMerge(footprint1, footprint2, comparisonResult, outputPath = null) {
        console.log(`🎨 Создаю визуализацию объединения "${footprint1.name}" + "${footprint2.name}"...`);
       
        try {
            // Размеры канваса
            const canvas = createCanvas(1000, 800);
            const ctx = canvas.getContext('2d');
           
            // Очистка фона
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 1000, 800);
           
            // ========== ЗАГОЛОВОК ==========
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('🎭 ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ СЛЕДОВ', 50, 40);
           
            ctx.font = '18px Arial';
            ctx.fillText(`${footprint1.name} + ${footprint2.name}`, 50, 70);
           
            // ========== СТАТИСТИКА ==========
            ctx.font = '16px Arial';
            ctx.fillStyle = '#333333';
           
            const points1 = footprint1.originalPoints || (footprint1.graph ? Array.from(footprint1.graph.nodes.values()).map(n => ({x: n.x, y: n.y})) : []);
            const points2 = footprint2.originalPoints || (footprint2.graph ? Array.from(footprint2.graph.nodes.values()).map(n => ({x: n.x, y: n.y})) : []);
           
            ctx.fillText(`📊 СТАТИСТИКА ОБЪЕДИНЕНИЯ:`, 50, 110);
            ctx.fillText(`📸 ${footprint1.name}: ${points1.length} точек`, 70, 135);
            ctx.fillText(`📸 ${footprint2.name}: ${points2.length} точек`, 70, 160);
            ctx.fillText(`📊 Всего точек после объединения: ${points1.length + points2.length}`, 70, 185);
           
            if (comparisonResult) {
                ctx.fillText(`💎 Схожесть: ${comparisonResult.similarity?.toFixed(3) || 'N/A'}`, 70, 210);
                ctx.fillText(`🤔 Решение: ${comparisonResult.decision || 'N/A'}`, 70, 235);
            }
           
            // ========== ОБЛАСТЬ ВИЗУАЛИЗАЦИИ ==========
            ctx.strokeStyle = '#cccccc';
            ctx.strokeRect(50, 260, 900, 480);
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(51, 261, 898, 478);
           
            // Нормализация координат для отображения
            const allPoints = [...points1, ...points2];
           
            if (allPoints.length === 0) {
                ctx.fillStyle = '#999999';
                ctx.font = '20px Arial';
                ctx.fillText('Нет точек для визуализации', 400, 500);
               
                if (outputPath) {
                    const buffer = canvas.toBuffer('image/png');
                    fs.writeFileSync(outputPath, buffer);
                    console.log(`✅ Визуализация сохранена: ${outputPath}`);
                }
               
                return {
                    canvas,
                    buffer: canvas.toBuffer('image/png'),
                    stats: {
                        points1: points1.length,
                        points2: points2.length,
                        totalPoints: points1.length + points2.length,
                        intersections: 0,
                        similarity: comparisonResult?.similarity,
                        decision: comparisonResult?.decision
                    }
                };
            }
           
            const minX = Math.min(...allPoints.map(p => p.x));
            const maxX = Math.max(...allPoints.map(p => p.x));
            const minY = Math.min(...allPoints.map(p => p.y));
            const maxY = Math.max(...allPoints.map(p => p.y));
           
            const scale = Math.min(800 / Math.max(maxX - minX, 1), 400 / Math.max(maxY - minY, 1)) * 0.8;
            const offsetX = 100 + (400 - (maxX - minX) * scale / 2);
            const offsetY = 300 + (200 - (maxY - minY) * scale / 2);
           
            // ========== ТОЧКИ ИЗ ПЕРВОГО ОТПЕЧАТКА (СИНИЕ) ==========
            ctx.fillStyle = 'rgba(0, 100, 255, 0.7)';
            points1.forEach(point => {
                const x = offsetX + (point.x - minX) * scale;
                const y = offsetY + (point.y - minY) * scale;
               
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
               
                // Контур для лучшей видимости
                ctx.strokeStyle = 'rgba(0, 50, 200, 0.9)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.stroke();
            });
           
            // ========== ТОЧКИ ИЗ ВТОРОГО ОТПЕЧАТКА (КРАСНЫЕ) ==========
            ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
            points2.forEach(point => {
                const x = offsetX + (point.x - minX) * scale;
                const y = offsetY + (point.y - minY) * scale;
               
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
               
                // Контур
                ctx.strokeStyle = 'rgba(200, 0, 0, 0.9)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.stroke();
            });
           
            // ========== ЛЕГЕНДА ==========
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('📋 ЛЕГЕНДА:', 50, 770);
           
            ctx.font = '14px Arial';
            // Синий (первый отпечаток)
            ctx.fillStyle = 'rgba(0, 100, 255, 0.7)';
            ctx.fillRect(150, 755, 20, 20);
            ctx.fillStyle = '#000000';
            ctx.fillText(`${footprint1.name} (${points1.length} точек)`, 180, 770);
           
            // Красный (второй отпечаток)
            ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
            ctx.fillRect(400, 755, 20, 20);
            ctx.fillStyle = '#000000';
            ctx.fillText(`${footprint2.name} (${points2.length} точек)`, 430, 770);
           
            // ========== РАСЧЕТ ПЕРЕСЕЧЕНИЙ ==========
            let intersections = 0;
            if (points1.length > 0 && points2.length > 0) {
                // Простой расчет пересечений (точки в радиусе 10px)
                const threshold = 10;
               
                points1.forEach(p1 => {
                    points2.forEach(p2 => {
                        const dist = Math.sqrt(
                            Math.pow(p1.x - p2.x, 2) +
                            Math.pow(p1.y - p2.y, 2)
                        );
                        if (dist < threshold) {
                            intersections++;
                        }
                    });
                });
               
                // Отображение процента пересечения
                const intersectionPercent = Math.min(points1.length, points2.length) > 0
                    ? Math.round(intersections / Math.min(points1.length, points2.length) * 100)
                    : 0;
                ctx.fillText(`🔗 Пересечений: ${intersections} (~${intersectionPercent}%)`, 600, 770);
            }
           
            // ========== СОХРАНЕНИЕ ==========
            if (outputPath) {
                // Создаем папку если нет
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
               
                const buffer = canvas.toBuffer('image/png');
                fs.writeFileSync(outputPath, buffer);
                console.log(`✅ Визуализация объединения сохранена: ${outputPath}`);
            }
           
            return {
                canvas,
                buffer: canvas.toBuffer('image/png'),
                stats: {
                    points1: points1.length,
                    points2: points2.length,
                    totalPoints: points1.length + points2.length,
                    intersections: intersections,
                    similarity: comparisonResult?.similarity,
                    decision: comparisonResult?.decision
                }
            };
           
        } catch (error) {
            console.log(`❌ Ошибка создания визуализации: ${error.message}`);
            throw error;
        }
    }

    // 2. СОЗДАТЬ ОПИСАНИЕ ДЛЯ TELEGRAM
    createMergeCaption(footprint1, footprint2, stats) {
        const intersectionPercent = Math.min(stats.points1, stats.points2) > 0
            ? Math.round(stats.intersections / Math.min(stats.points1, stats.points2) * 100)
            : 0;
           
        return `<b>🎭 ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1} точек\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2} точек\n` +
               `<b>📊 Всего точек:</b> ${stats.totalPoints}\n` +
               `<b>🔗 Пересечений:</b> ${stats.intersections} (${intersectionPercent}%)\n` +
               `<b>💎 Схожесть:</b> ${stats.similarity?.toFixed(3) || 'N/A'}\n` +
               `<b>🤔 Решение:</b> ${stats.decision || 'N/A'}\n\n` +
               `<i>🔵 Синие точки - ${footprint1.name}\n` +
               `🔴 Красные точки - ${footprint2.name}</i>`;
    }
}

module.exports = MergeVisualizer;
