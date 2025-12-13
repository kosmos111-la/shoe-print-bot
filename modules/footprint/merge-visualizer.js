// modules/footprint/merge-visualizer.js
// МИНИМАЛЬНЫЙ РАБОЧИЙ ВИЗУАЛИЗАТОР - ТОЛЬКО БАЗОВАЯ ФУНКЦИОНАЛЬНОСТЬ

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class MergeVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './temp/merge_visualizations',
            width: options.width || 1200,
            height: options.height || 900,
            backgroundColor: options.backgroundColor || '#ffffff',
            debug: options.debug || false,
            ...options
        };
      
        // Создать директорию для визуализаций
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
      
        console.log(`🎨 MergeVisualizer создан: ${this.config.width}x${this.config.height}`);
    }

    // 1. ОСНОВНОЙ МЕТОД - ПРОСТАЯ ВИЗУАЛИЗАЦИЯ
    async visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options = {}) {
        console.log('🎨 Запускаю простую визуализацию...');
       
        const timestamp = Date.now();
        const outputPath = options.outputPath ||
                          path.join(this.config.outputDir, `topology_merge_${timestamp}.png`);
      
        try {
            // Минимальная проверка
            if (!footprint1 || !footprint2) {
                throw new Error('Нет данных отпечатков');
            }
          
            // Создаем канвас
            const canvas = createCanvas(this.config.width, this.config.height);
            const ctx = canvas.getContext('2d');
          
            // ФОН
            ctx.fillStyle = this.config.backgroundColor;
            ctx.fillRect(0, 0, this.config.width, this.config.height);
          
            // ЗАГОЛОВОК
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 32px Arial';
            ctx.fillText('🏗️ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ', 50, 50);
          
            // СХОЖЕСТЬ
            const similarity = comparisonResult?.similarity || 0;
            ctx.font = '24px Arial';
            ctx.fillStyle = similarity > 0.7 ? '#00aa00' : '#ff0000';
            ctx.fillText(`Схожесть: ${(similarity * 100).toFixed(1)}%`, 50, 100);
          
            // ПРОСТАЯ СТАТИСТИКА
            ctx.fillStyle = '#000000';
            ctx.font = '18px Arial';
          
            let y = 200;
            const lineHeight = 30;
          
            // Получаем размеры графов безопасно
            const nodes1 = this.getNodeCount(footprint1);
            const nodes2 = this.getNodeCount(footprint2);
          
            ctx.fillText(`📊 След 1: ${nodes1} узлов`, 50, y);
            y += lineHeight;
            ctx.fillText(`📊 След 2: ${nodes2} узлов`, 50, y);
            y += lineHeight;
          
            // Информация о слиянии
            if (comparisonResult?.decision) {
                ctx.fillText(`✅ Решение: ${comparisonResult.decision}`, 50, y);
                y += lineHeight;
            }
          
            if (comparisonResult?.reason) {
                ctx.fillText(`💡 ${comparisonResult.reason}`, 50, y);
                y += lineHeight;
            }
          
            // Простая диаграмма (круги для наглядности)
            this.drawSimpleDiagram(ctx, nodes1, nodes2, similarity);
          
            // Информация о времени
            ctx.font = '14px Arial';
            ctx.fillStyle = '#666666';
            ctx.fillText(`🕒 ${new Date().toLocaleString('ru-RU')}`, 50, this.config.height - 50);
          
            // Сохраняем
            await this.saveCanvas(canvas, outputPath);
          
            console.log(`✅ Визуализация создана: ${outputPath}`);
          
            return {
                success: true,
                path: outputPath,
                stats: {
                    similarity: similarity,
                    nodes1: nodes1,
                    nodes2: nodes2
                }
            };
          
        } catch (error) {
            console.log(`❌ Ошибка визуализации: ${error.message}`);
            // Создаем самую простую картинку
            return await this.createErrorVisualization(error.message, outputPath);
        }
    }

    // 2. ПРОСТАЯ ДИАГРАММА
    drawSimpleDiagram(ctx, nodes1, nodes2, similarity) {
        const centerX = this.config.width - 300;
        const centerY = 400;
      
        // Круг для первого следа
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(nodes1.toString(), centerX, centerY);
      
        // Круг для второго следа
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX + 200, centerY, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(nodes2.toString(), centerX + 200, centerY);
      
        // Линия схожести
        ctx.strokeStyle = similarity > 0.7 ? '#00aa00' : '#f39c12';
        ctx.lineWidth = Math.max(2, similarity * 5);
        ctx.beginPath();
        ctx.moveTo(centerX + 80, centerY);
        ctx.lineTo(centerX + 120, centerY);
        ctx.stroke();
      
        // Текст схожести
        ctx.fillStyle = '#000000';
        ctx.font = '20px Arial';
        ctx.fillText(`${(similarity * 100).toFixed(0)}%`, centerX + 100, centerY - 50);
    }

    // 3. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    // Безопасное получение количества узлов
    getNodeCount(footprint) {
        try {
            if (footprint?.graph?.nodes?.size !== undefined) {
                return footprint.graph.nodes.size;
            }
            if (footprint?.nodes?.size !== undefined) {
                return footprint.nodes.size;
            }
            if (Array.isArray(footprint?.nodes)) {
                return footprint.nodes.length;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    // Визуализация ошибки
    async createErrorVisualization(errorMessage, outputPath) {
        const canvas = createCanvas(this.config.width, this.config.height);
        const ctx = canvas.getContext('2d');
      
        // Фон
        ctx.fillStyle = '#ffebee';
        ctx.fillRect(0, 0, this.config.width, this.config.height);
      
        // Заголовок ошибки
        ctx.fillStyle = '#d32f2f';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('⚠️ ОШИБКА ВИЗУАЛИЗАЦИИ', 50, 50);
      
        // Сообщение об ошибке
        ctx.fillStyle = '#000000';
        ctx.font = '16px Arial';
      
        // Разбиваем сообщение на строки
        const lines = this.wrapText(errorMessage, 60);
        let y = 150;
      
        lines.forEach(line => {
            ctx.fillText(line, 50, y);
            y += 25;
        });
      
        // Инструкция
        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial';
        ctx.fillText('ℹ️ Система продолжает работу, но визуализация не создана', 50, y + 50);
      
        // Сохраняем
        await this.saveCanvas(canvas, outputPath);
      
        return {
            success: false,
            path: outputPath,
            error: errorMessage
        };
    }

    // Перенос текста
    wrapText(text, maxLength) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
      
        words.forEach(word => {
            if ((currentLine + ' ' + word).length <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });
      
        if (currentLine) {
            lines.push(currentLine);
        }
      
        return lines;
    }

    // Методы для совместимости со старым кодом
    async visualizeClassicMerge(footprint1, footprint2, comparisonResult, options) {
        return await this.visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options);
    }

    async visualizeIntelligentMerge(footprint1, footprint2, comparisonResult, options) {
        return await this.visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options);
    }

    async visualizeGeometricMerge(footprint1, footprint2, comparisonResult, options) {
        return await this.visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options);
    }

    // Создание подписи
    createTopologyMergeCaption(footprint1, footprint2, stats) {
        return `<b>🏗️ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ</b>\n\n` +
               `<b>📸 ${footprint1?.name || 'След 1'}:</b> ${stats.points1 || 0} узлов\n` +
               `<b>📸 ${footprint2?.name || 'След 2'}:</b> ${stats.points2 || 0} узлов\n` +
               `<b>🎯 Схожесть:</b> ${((stats.similarity || 0) * 100).toFixed(1)}%\n` +
               `<b>🤔 Решение:</b> ${stats.decision || 'unknown'}\n\n` +
               `<i>🟦 След 1 | 🔴 След 2 | 🟢 Схожесть</i>`;
    }

    // Сохранение канваса
    async saveCanvas(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
          
            out.on('finish', () => {
                console.log(`💾 Файл сохранен: ${filePath}`);
                resolve(filePath);
            });
          
            out.on('error', (error) => {
                console.log(`❌ Ошибка сохранения: ${error.message}`);
                reject(error);
            });
        });
    }

    // Очистка старых файлов
    cleanupOldFiles(maxAgeHours = 24) {
        try {
            const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
            let deleted = 0;
          
            if (fs.existsSync(this.config.outputDir)) {
                const files = fs.readdirSync(this.config.outputDir);
              
                files.forEach(file => {
                    if (file.endsWith('.png')) {
                        const filePath = path.join(this.config.outputDir, file);
                        const stats = fs.statSync(filePath);
                      
                        if (stats.mtimeMs < cutoffTime) {
                            fs.unlinkSync(filePath);
                            deleted++;
                        }
                    }
                });
              
                if (deleted > 0) {
                    console.log(`🗑️ Удалено ${deleted} старых файлов`);
                }
            }
          
            return { success: true, deleted: deleted };
        } catch (error) {
            console.log(`⚠️ Ошибка очистки: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = MergeVisualizer;
