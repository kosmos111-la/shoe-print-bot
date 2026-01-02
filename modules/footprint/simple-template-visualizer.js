// modules/footprint/simple-template-visualizer.js
// УПРОЩЕННЫЙ ВИЗУАЛИЗАТОР БЕЗ CANVAS (для тестирования)

const fs = require('fs');
const path = require('path');

class SimpleTemplateVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/visualizations/templates',
            debug: options.debug || false,
            ...options
        };
       
        // Создаем директорию если не существует
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        console.log(`🎨 SimpleTemplateVisualizer инициализирован (без canvas)`);
    }
   
    // 🔥 УПРОЩЕННЫЙ МЕТОД: СОЗДАТЬ ТЕКСТОВЫЙ ОТЧЕТ
    async visualizeTemplate(templateData, options = {}) {
        console.log(`🎨 Создаю текстовый отчет шаблона "${templateData.name}"...`);
       
        const startTime = Date.now();
       
        // Создаем текстовый отчет
        let report = this.createTextReport(templateData);
       
        // Сохраняем в файл
        const outputPath = await this.saveTextReport(report, templateData, options);
       
        const timeMs = Date.now() - startTime;
        console.log(`✅ Текстовый отчет создан: ${outputPath} (${timeMs}мс)`);
       
        return {
            path: outputPath,
            templateId: templateData.templateId,
            report: report,
            timeMs: timeMs
        };
    }
   
    // 🔥 СОЗДАНИЕ ТЕКСТОВОГО ОТЧЕТА
    createTextReport(templateData) {
        let report = '';
       
        // Заголовок
        report += '='.repeat(80) + '\n';
        report += `ШАБЛОН ПРОТЕКТОРА: ${templateData.name}\n`;
        report += '='.repeat(80) + '\n\n';
       
        // Основная информация
        report += `📊 ОСНОВНАЯ ИНФОРМАЦИЯ:\n`;
        report += `├─ ID шаблона: ${templateData.templateId || 'N/A'}\n`;
        report += `├─ Эталонный граф: ${templateData.referenceGraphId || 'не установлен'}\n`;
        report += `├─ Метод визуализации: ${templateData.metadata?.visualizationMethod || 'N/A'}\n`;
        report += `└─ Дата создания: ${templateData.metadata?.createdAt || new Date().toLocaleString('ru-RU')}\n\n`;
       
        // Статистика
        if (templateData.stats) {
            report += `📈 СТАТИСТИКА ШАБЛОНА:\n`;
            report += `├─ Всего ячеек: ${templateData.stats.cellCount || 0}\n`;
            report += `├─ Подтвержденных ячеек: ${templateData.stats.confirmedCells || 0}\n`;
            report += `├─ Высоконадёжных ячеек (3+): ${templateData.stats.highConfidenceCells || 0}\n`;
            report += `├─ Среднее подтверждений: ${templateData.stats.avgConfirmations?.toFixed(2) || '0.00'}\n`;
            report += `├─ Уверенность модели: ${templateData.stats.confidence ? (templateData.stats.confidence * 100).toFixed(1) + '%' : 'N/A'}\n`;
            report += `└─ Графов в шаблоне: ${templateData.transformationsCount || 0}\n\n`;
        }
       
        // Распределение по подтверждениям
        if (templateData.cells && Array.isArray(templateData.cells)) {
            const distribution = this.calculateConfirmationDistribution(templateData.cells);
           
            report += `📊 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:\n`;
            report += `├─ 5+ подтверждений: ${distribution['5+']} ячеек\n`;
            report += `├─ 4 подтверждения: ${distribution['4']} ячеек\n`;
            report += `├─ 3 подтверждения: ${distribution['3']} ячеек\n`;
            report += `├─ 2 подтверждения: ${distribution['2']} ячеек\n`;
            report += `├─ 1 подтверждение: ${distribution['1']} ячеек\n`;
            report += `└─ 0 подтверждений: ${distribution['0']} ячеек\n\n`;
        }
       
        // Зоны протектора
        if (templateData.stats?.zones) {
            report += `👣 ЗОНЫ ПРОТЕКТОРА:\n`;
            const zones = templateData.stats.zones;
           
            if (zones.heel) {
                report += `├─ ПЯТКА:\n`;
                report += `│  ├─ Ячеек: ${zones.heel.cells || 0}\n`;
                report += `│  ├─ Подтверждений: ${zones.heel.confirmations || 0}\n`;
                report += `│  ├─ Сред. подтв.: ${zones.heel.avgConfirmations?.toFixed(2) || '0.00'}\n`;
                report += `│  └─ Уверенность: ${(zones.heel.confidence * 100 || 0).toFixed(1)}%\n`;
            }
           
            if (zones.midfoot) {
                report += `├─ ЦЕНТР:\n`;
                report += `│  ├─ Ячеек: ${zones.midfoot.cells || 0}\n`;
                report += `│  ├─ Подтверждений: ${zones.midfoot.confirmations || 0}\n`;
                report += `│  ├─ Сред. подтв.: ${zones.midfoot.avgConfirmations?.toFixed(2) || '0.00'}\n`;
                report += `│  └─ Уверенность: ${(zones.midfoot.confidence * 100 || 0).toFixed(1)}%\n`;
            }
           
            if (zones.forefoot) {
                report += `└─ НОСОК:\n`;
                report += `   ├─ Ячеек: ${zones.forefoot.cells || 0}\n`;
                report += `   ├─ Подтверждений: ${zones.forefoot.confirmations || 0}\n`;
                report += `   ├─ Сред. подтв.: ${zones.forefoot.avgConfirmations?.toFixed(2) || '0.00'}\n`;
                report += `   └─ Уверенность: ${(zones.forefoot.confidence * 100 || 0).toFixed(1)}%\n`;
            }
            report += '\n';
        }
       
        // Топ 10 ячеек с наибольшими подтверждениями
        if (templateData.cells && Array.isArray(templateData.cells) && templateData.cells.length > 0) {
            report += `🏆 ТОП-10 ЯЧЕЕК ПО ПОДТВЕРЖДЕНИЯМ:\n`;
           
            const sortedCells = [...templateData.cells]
                .sort((a, b) => b.confirmations - a.confirmations)
                .slice(0, 10);
           
            sortedCells.forEach((cell, index) => {
                const x = cell.x.toFixed(1);
                const y = cell.y.toFixed(1);
                const radius = cell.radius?.toFixed(1) || 'N/A';
               
                report += `${index + 1}. Ячейка ${cell.id?.slice(0, 8) || 'unknown'}: `;
                report += `(${x}, ${y}), r=${radius}, `;
                report += `${cell.confirmations} подтв., `;
                report += `доверие: ${(cell.confidence * 100).toFixed(1)}%\n`;
            });
            report += '\n';
        }
       
        // Простая ASCII визуализация
        if (templateData.cells && templateData.cells.length > 0) {
            report += `🎨 ASCII ВИЗУАЛИЗАЦИЯ РАСПРЕДЕЛЕНИЯ:\n\n`;
            report += this.createAsciiVisualization(templateData.cells);
            report += '\n\n';
        }
       
        // Легенда
        report += `📖 ЛЕГЕНДА:\n`;
        report += `● - ячейка с подтверждениями\n`;
        report += `○ - ячейка без подтверждений\n`;
        report += `Цифра - количество подтверждений\n`;
        report += `(X,Y) - координаты ячейки\n\n`;
       
        report += '='.repeat(80) + '\n';
        report += `Отчет сгенерирован: ${new Date().toLocaleString('ru-RU')}\n`;
        report += '='.repeat(80);
       
        return report;
    }
   
    // 🔥 РАСЧЕТ РАСПРЕДЕЛЕНИЯ ПОДТВЕРЖДЕНИЙ
    calculateConfirmationDistribution(cells) {
        const distribution = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
       
        cells.forEach(cell => {
            const confirmations = cell.confirmations || 0;
           
            if (confirmations >= 5) {
                distribution['5+']++;
            } else if (confirmations === 4) {
                distribution['4']++;
            } else if (confirmations === 3) {
                distribution['3']++;
            } else if (confirmations === 2) {
                distribution['2']++;
            } else if (confirmations === 1) {
                distribution['1']++;
            } else {
                distribution['0']++;
            }
        });
       
        return distribution;
    }
   
    // 🔥 СОЗДАНИЕ ASCII ВИЗУАЛИЗАЦИИ
    createAsciiVisualization(cells) {
        if (cells.length === 0) return '(нет данных)';
       
        // Находим границы
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        cells.forEach(cell => {
            minX = Math.min(minX, cell.x);
            maxX = Math.max(maxX, cell.x);
            minY = Math.min(minY, cell.y);
            maxY = Math.max(maxY, cell.y);
        });
       
        // Создаем сетку 20x10 для ASCII
        const gridWidth = 40;
        const gridHeight = 20;
        const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(' '));
       
        // Масштабируем и заполняем сетку
        const scaleX = gridWidth / Math.max(1, maxX - minX);
        const scaleY = gridHeight / Math.max(1, maxY - minY);
        const scale = Math.min(scaleX, scaleY) * 0.8;
       
        cells.forEach(cell => {
            const gridX = Math.floor(((cell.x - minX) * scale));
            const gridY = Math.floor(((cell.y - minY) * scale));
           
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                if (cell.confirmations > 0) {
                    if (cell.confirmations >= 3) {
                        grid[gridY][gridX] = '●'; // Много подтверждений
                    } else {
                        grid[gridY][gridX] = '○'; // Мало подтверждений
                    }
                } else {
                    grid[gridY][gridX] = '.'; // Нет подтверждений
                }
            }
        });
       
        // Преобразуем сетку в строку
        let asciiArt = '';
        for (let y = 0; y < gridHeight; y++) {
            asciiArt += grid[y].join('') + '\n';
        }
       
        // Добавляем оси
        asciiArt += '-'.repeat(gridWidth) + '> X\n';
        asciiArt += 'Y\n↓';
       
        return asciiArt;
    }
   
    // 🔥 СОХРАНЕНИЕ ТЕКСТОВОГО ОТЧЕТА
    async saveTextReport(report, templateData, options) {
        const filename = options.filename ||
                        `template_report_${templateData.templateId || 'unknown'}_${Date.now()}.txt`;
       
        const outputPath = path.join(this.config.outputDir, filename);
       
        return new Promise((resolve, reject) => {
            fs.writeFile(outputPath, report, 'utf8', (error) => {
                if (error) {
                    console.log(`❌ Ошибка сохранения отчета: ${error.message}`);
                    reject(error);
                } else {
                    const fileSize = Buffer.byteLength(report, 'utf8');
                    console.log(`💾 Текстовый отчет сохранен: ${outputPath} (${(fileSize / 1024).toFixed(1)} KB)`);
                    resolve(outputPath);
                }
            });
        });
    }
   
    // 🔥 СОЗДАНИЕ JSON ФАЙЛА С ДАННЫМИ ШАБЛОНА
    async saveTemplateData(templateData, options = {}) {
        console.log(`💾 Сохраняю данные шаблона в JSON...`);
       
        const filename = options.filename ||
                        `template_data_${templateData.templateId || 'unknown'}_${Date.now()}.json`;
       
        const outputPath = path.join(this.config.outputDir, filename);
       
        const dataToSave = {
            ...templateData,
            savedAt: new Date().toISOString(),
            version: '1.0'
        };
       
        return new Promise((resolve, reject) => {
            const jsonData = JSON.stringify(dataToSave, null, 2);
           
            fs.writeFile(outputPath, jsonData, 'utf8', (error) => {
                if (error) {
                    console.log(`❌ Ошибка сохранения JSON: ${error.message}`);
                    reject(error);
                } else {
                    const fileSize = Buffer.byteLength(jsonData, 'utf8');
                    console.log(`💾 Данные шаблона сохранены: ${outputPath} (${(fileSize / 1024).toFixed(1)} KB)`);
                    resolve(outputPath);
                }
            });
        });
    }
}

module.exports = SimpleTemplateVisualizer;
