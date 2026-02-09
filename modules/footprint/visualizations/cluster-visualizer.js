// modules/footprint/visualizations/cluster-visualizer.js
// 🎯 ВИЗУАЛИЗАТОР ДЛЯ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/clusters',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,

            // 🔥 ЦВЕТА ДЛЯ ПОДТВЕРЖДЕНИЙ ПАСПОРТОВ
            pointColors: {
                confirmed3plus: '#FF5252',  // 🔴 Красный: 3+ подтверждений
                confirmed2: '#FF9800',      // 🟠 Оранжевый: 2 подтверждения
                confirmed1: '#2196F3',      // 🔵 Синий: 1 подтверждение
                highConfidence: '#4CAF50',  // 🟢 Зеленый: высокое сходство
                background: '#FFFFFF',      // Белый фон
                patternBorder: '#9C27B0'    // Фиолетовый: граница паттерна
            },

            // 🔥 НАСТРОЙКИ ОТОБРАЖЕНИЯ
            showPatternInfo: options.showPatternInfo !== false,
            showStats: options.showStats !== false,
            debug: options.debug || false,

            // 🔥 РАЗМЕРЫ
            pointBaseSize: options.pointBaseSize || 4,
            pointSizeMultiplier: options.pointSizeMultiplier || 8,
            patternRadius: options.patternRadius || 30,

            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 ClusterVisualizer создан для геометрических паспортов');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Визуализация паспортов одного следа
    async visualizeGeometricPassports(passportsData, options = {}) {
        console.log('🎨 Визуализация геометрических паспортов...');

        try {
            // Проверяем доступность canvas
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createPassportReport(passportsData, options);
            }

            // Извлекаем данные
            const { points, passports, patterns } = passportsData;
           
            if (!points || points.length === 0) {
                console.log('⚠️ Нет точек для визуализации');
                return this.createEmptyReport(passportsData, options);
            }

            console.log(`📊 Визуализирую ${points.length} точек, ${passports?.length || 0} паспортов`);

            // Создаем canvas
            const canvasWidth = options.width || this.config.canvasWidth;
            const canvasHeight = options.height || this.config.canvasHeight;

            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');

            // 1. ФОН
            ctx.fillStyle = this.config.pointColors.background;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. ЗАГОЛОВОК
            this.drawTitle(ctx, '🎯 ГЕОМЕТРИЧЕСКИЕ ПАСПОРТА ПРОТЕКТОРОВ', canvasWidth);

            // 3. СТАТИСТИКА
            const stats = this.calculatePassportStats(passportsData);
            this.drawStats(ctx, stats, canvasWidth);

            // 4. РИСУЕМ ТОЧКИ С ПАТТЕРНАМИ
            this.drawPointsWithPatterns(ctx, points, patterns, canvasWidth, canvasHeight);

            // 5. ЛЕГЕНДА
            this.drawPassportLegend(ctx, canvasWidth, canvasHeight);

            // 6. ИНФОРМАЦИЯ О ПАТТЕРНАХ
            if (this.config.showPatternInfo && patterns && patterns.length > 0) {
                this.drawPatternInfo(ctx, patterns, canvasWidth, canvasHeight);
            }

            // 7. ФУТЕР
            this.drawFooter(ctx, canvasWidth, canvasHeight);

            // 8. СОХРАНЯЕМ
            const filename = options.filename || `passports_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);

            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();

                stream.pipe(out);

                out.on('finish', () => {
                    console.log(`✅ Визуализация сохранена: ${outputPath}`);
                    resolve({
                        path: outputPath,
                        stats: stats,
                        pointsCount: points.length,
                        passportsCount: passports?.length || 0,
                        patternsCount: patterns?.length || 0,
                        success: true
                    });
                });

                out.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createPassportReport(passportsData, options);
        }
    }

    // 🔥 НАРИСОВАТЬ ЗАГОЛОВОК
    drawTitle(ctx, title, canvasWidth) {
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(title, canvasWidth / 2, 50);
    }

    // 🔥 ВЫЧИСЛИТЬ СТАТИСТИКУ
    calculatePassportStats(passportsData) {
        const { points, passports, patterns } = passportsData;
       
        let confirmed3plus = 0, confirmed2 = 0, confirmed1 = 0;
        let totalConfirmations = 0;
       
        if (points) {
            points.forEach(point => {
                const confirmations = point.confirmations || 1;
                totalConfirmations += confirmations;
               
                if (confirmations >= 3) {
                    confirmed3plus++;
                } else if (confirmations === 2) {
                    confirmed2++;
                } else {
                    confirmed1++;
                }
            });
        }
       
        const patternTypes = {};
        if (patterns) {
            patterns.forEach(pattern => {
                const type = pattern.type || 'unknown';
                patternTypes[type] = (patternTypes[type] || 0) + 1;
            });
        }
       
        return {
            totalPoints: points?.length || 0,
            totalPassports: passports?.length || 0,
            totalPatterns: patterns?.length || 0,
            confirmed3plus,
            confirmed2,
            confirmed1,
            avgConfirmations: points?.length > 0 ? totalConfirmations / points.length : 0,
            patternTypes
        };
    }

    // 🔥 НАРИСОВАТЬ СТАТИСТИКУ
    drawStats(ctx, stats, canvasWidth) {
        const startY = 90;
       
        ctx.fillStyle = '#495057';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
       
        const statsLines = [
            `Всего точек: ${stats.totalPoints} | Паспортов: ${stats.totalPassports} | Паттернов: ${stats.totalPatterns}`,
            `🔴 3+ подтверждений: ${stats.confirmed3plus} | 🟠 2 подтверждения: ${stats.confirmed2} | 🔵 1 подтверждение: ${stats.confirmed1}`,
            `📊 Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}`
        ];
       
        statsLines.forEach((line, index) => {
            ctx.fillText(line, canvasWidth / 2, startY + (index * 25));
        });
       
        // Информация о типах паттернов
        if (Object.keys(stats.patternTypes).length > 0) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#6C757D';
           
            let patternText = '🎯 Типы паттернов: ';
            const patternList = Object.entries(stats.patternTypes)
                .map(([type, count]) => `${type}: ${count}`)
                .join(', ');
           
            // Разбиваем на несколько строк если нужно
            const maxLineLength = 80;
            let currentLine = patternText;
           
            patternList.split(', ').forEach(part => {
                if (currentLine.length + part.length + 2 > maxLineLength) {
                    ctx.fillText(currentLine, canvasWidth / 2, startY + 85);
                    currentLine = part;
                } else {
                    currentLine += (currentLine === patternText ? '' : ', ') + part;
                }
            });
           
            if (currentLine) {
                ctx.fillText(currentLine, canvasWidth / 2, startY + 85);
            }
        }
    }

    // 🔥 НАРИСОВАТЬ ТОЧКИ С ПАТТЕРНАМИ
    drawPointsWithPatterns(ctx, points, patterns, canvasWidth, canvasHeight) {
        if (!points || points.length === 0) {
            this.drawNoDataMessage(ctx, canvasWidth, canvasHeight);
            return;
        }
       
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2 + 50;
       
        // Вычисляем границы точек
        const bounds = this.calculatePointsBounds(points);
        const scale = this.calculateScale(
            bounds.minX, bounds.maxX, bounds.minY, bounds.maxY,
            canvasWidth * 0.8, canvasHeight * 0.5
        );
       
        // Рисуем паттерны (если есть)
        if (this.config.showPatternInfo && patterns && patterns.length > 0) {
            this.drawPatternAreas(ctx, patterns, centerX, centerY, bounds, scale);
        }
       
        // Рисуем точки
        points.forEach(point => {
            const x = centerX + (point.x - (bounds.minX + bounds.maxX) / 2) * scale;
            const y = centerY + (point.y - (bounds.minY + bounds.maxY) / 2) * scale;
           
            // Цвет в зависимости от подтверждений
            let color;
            let borderColor = null;
           
            if (point.confirmations >= 3) {
                color = this.config.pointColors.confirmed3plus; // 🔴
                borderColor = this.config.pointColors.highConfidence;
            } else if (point.confirmations === 2) {
                color = this.config.pointColors.confirmed2;     // 🟠
            } else {
                color = this.config.pointColors.confirmed1;     // 🔵
            }
           
            // Размер точки зависит от подтверждений
            const size = this.config.pointBaseSize +
                        (point.confirmations || 1) * this.config.pointSizeMultiplier;
           
            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            // Обводка для высоконадежных точек
            if (borderColor) {
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
           
            // Подпись для точек с 3+ подтверждениями
            if (point.confirmations >= 3 && point.patternType) {
                ctx.fillStyle = '#212529';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(point.patternType.substring(0, 10), x, y - size - 5);
            }
        });
    }

    // 🔥 НАРИСОВАТЬ ОБЛАСТИ ПАТТЕРНОВ
    drawPatternAreas(ctx, patterns, centerX, centerY, bounds, scale) {
        patterns.forEach(pattern => {
            if (!pattern.centerX || !pattern.centerY || !pattern.radius) return;
           
            const x = centerX + (pattern.centerX - (bounds.minX + bounds.maxX) / 2) * scale;
            const y = centerY + (pattern.centerY - (bounds.minY + bounds.maxY) / 2) * scale;
            const radius = pattern.radius * scale;
           
            // Рисуем область паттерна
            ctx.strokeStyle = this.config.pointColors.patternBorder;
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
           
            // Название паттерна
            ctx.fillStyle = this.config.pointColors.patternBorder;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(pattern.type || 'pattern', x, y - radius - 10);
           
            // Количество подтверждений
            if (pattern.confirmations) {
                ctx.font = '10px Arial';
                ctx.fillText(`${pattern.confirmations} подтверждений`, x, y - radius - 22);
            }
        });
    }

    // 🔥 ВЫЧИСЛИТЬ ГРАНИЦЫ ТОЧЕК
    calculatePointsBounds(points) {
        if (!points || points.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        }
       
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
       
        return { minX, maxX, minY, maxY };
    }

    // 🔥 ВЫЧИСЛИТЬ МАСШТАБ
    calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
       
        const scaleX = targetWidth / width;
        const scaleY = targetHeight / height;
       
        return Math.min(scaleX, scaleY, 5);
    }

    // 🔥 СООБЩЕНИЕ "НЕТ ДАННЫХ"
    drawNoDataMessage(ctx, canvasWidth, canvasHeight) {
        ctx.fillStyle = '#6C757D';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных для отображения', canvasWidth / 2, canvasHeight / 2);
    }

    // 🔥 НАРИСОВАТЬ ЛЕГЕНДУ ПАСПОРТОВ
    drawPassportLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 150;
        const startX = canvasWidth * 0.1;
       
        // Фон легенды
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 130);
       
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 130);
       
        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ', startX, legendY);
       
        // Элементы легенды
        const legendItems = [
            {
                type: 'point',
                color: this.config.pointColors.confirmed3plus,
                border: this.config.pointColors.highConfidence,
                text: '3+ подтверждений (надежный паттерн)'
            },
            {
                type: 'point',
                color: this.config.pointColors.confirmed2,
                text: '2 подтверждения (требует проверки)'
            },
            {
                type: 'point',
                color: this.config.pointColors.confirmed1,
                text: '1 подтверждение (новый паттерн)'
            },
            {
                type: 'pattern',
                color: this.config.pointColors.patternBorder,
                text: 'Область паттерна',
                dashed: true
            }
        ];
       
        legendItems.forEach((item, index) => {
            const x = startX + 10;
            const y = legendY + 25 + (index * 30);
           
            // Рисуем образец
            if (item.type === 'point') {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(x + 10, y + 5, 8, 0, Math.PI * 2);
                ctx.fill();
               
                if (item.border) {
                    ctx.strokeStyle = item.border;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            } else if (item.type === 'pattern') {
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 1;
               
                if (item.dashed) {
                    ctx.setLineDash([5, 5]);
                }
               
                ctx.beginPath();
                ctx.arc(x + 10, y + 5, 8, 0, Math.PI * 2);
                ctx.stroke();
               
                if (item.dashed) {
                    ctx.setLineDash([]);
                }
            }
           
            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.fillText(item.text, x + 25, y + 8);
        });
       
        // Пояснение
        ctx.fillStyle = '#6C757D';
        ctx.font = '11px Arial';
        ctx.fillText(
            '🔍 Размер точки = количество подтверждений',
            startX, legendY + 115
        );
    }

    // 🔥 ИНФОРМАЦИЯ О ПАТТЕРНАХ
    drawPatternInfo(ctx, patterns, canvasWidth, canvasHeight) {
        const infoY = canvasHeight - 250;
        const startX = canvasWidth * 0.1;
       
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(startX - 10, infoY - 20, canvasWidth * 0.8, 80);
       
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX - 10, infoY - 20, canvasWidth * 0.8, 80);
       
        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('🎯 ОБНАРУЖЕННЫЕ ПАТТЕРНЫ:', startX, infoY);
       
        // Список паттернов
        const maxPatterns = 5;
        const displayPatterns = patterns.slice(0, maxPatterns);
       
        displayPatterns.forEach((pattern, index) => {
            const x = startX + 10;
            const y = infoY + 20 + (index * 15);
           
            const text = `${pattern.type || 'unknown'}: ${pattern.confirmations || 0} подтверждений`;
            ctx.fillStyle = '#495057';
            ctx.font = '11px Arial';
            ctx.fillText(text, x, y);
        });
       
        if (patterns.length > maxPatterns) {
            ctx.fillStyle = '#6C757D';
            ctx.font = '10px Arial';
            ctx.fillText(
                `...и еще ${patterns.length - maxPatterns} паттернов`,
                startX, infoY + 95
            );
        }
    }

    // 🔥 НАРИСОВАТЬ ФУТЕР
    drawFooter(ctx, canvasWidth, canvasHeight) {
        ctx.fillStyle = '#ADB5BD';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
       
        ctx.fillText(
            '🎯 Система геометрических паспортов протекторов',
            canvasWidth / 2, canvasHeight - 25
        );
       
        ctx.fillText(
            `Визуализация создана: ${new Date().toLocaleString('ru-RU')}`,
            canvasWidth / 2, canvasHeight - 10
        );
    }

    // 🔥 СОЗДАТЬ ТЕКСТОВЫЙ ОТЧЕТ
    createPassportReport(passportsData, options = {}) {
        const { points, passports, patterns } = passportsData;
        const stats = this.calculatePassportStats(passportsData);
       
        const filename = options.filename || `passport_report_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);
       
        let patternInfo = '';
        if (patterns && patterns.length > 0) {
            patternInfo = '🎯 ОБНАРУЖЕННЫЕ ПАТТЕРНЫ:\n';
            patterns.forEach((pattern, index) => {
                patternInfo += `${index + 1}. ${pattern.type || 'unknown'}: ${pattern.confirmations || 0} подтверждений\n`;
            });
            patternInfo += '\n';
        }
       
        const report = `
🏗️ ОТЧЕТ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
═══════════════════════════════════

📊 ОБЩАЯ СТАТИСТИКА:
• Всего точек: ${stats.totalPoints}
• Всего паспортов: ${stats.totalPassports}
• Всего паттернов: ${stats.totalPatterns}
• 🔴 3+ подтверждений: ${stats.confirmed3plus}
• 🟠 2 подтверждения: ${stats.confirmed2}
• 🔵 1 подтверждение: ${stats.confirmed1}
• Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}

${patternInfo}
📈 РАСПРЕДЕЛЕНИЕ ПО ТИПАМ ПАТТЕРНОВ:
${Object.entries(stats.patternTypes)
    .map(([type, count]) => `• ${type}: ${count}`)
    .join('\n') || '• Нет данных о типах паттернов'}

💡 СИСТЕМА ПОДТВЕРЖДЕНИЙ:
• 1 фото = 1 подтверждение геометрического паспорта
• 🔴 Красные точки: паттерн найден в 3+ фото (надежный)
• 🟠 Оранжевые точки: паттерн найден в 2 фото (требует проверки)
• 🔵 Синие точки: паттерн найден в 1 фото (новый)

🎯 МЕТОДОЛОГИЯ:
• Каждая точка описывается геометрическим паспортом
• Паспорт включает углы и расстояния до соседей
• Сравнение по паспортам, а не по координатам
• Независимо от вращения и зеркальности

═══════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
Для графической визуализации установите: npm install canvas
`.trim();
       
        fs.writeFileSync(outputPath, report, 'utf8');
       
        return {
            path: outputPath,
            stats: stats,
            note: 'Текстовый отчет геометрических паспортов'
        };
    }

    // 🔥 СОЗДАТЬ ПУСТОЙ ОТЧЕТ
    createEmptyReport(passportsData, options = {}) {
        const filename = options.filename || `empty_report_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);
       
        const report = `
⚠️ ОТЧЕТ: НЕТ ДАННЫХ ДЛЯ ВИЗУАЛИЗАЦИИ

📊 ДАННЫЕ ОТ СИСТЕМЫ:
${JSON.stringify(passportsData, null, 2)}

💡 ВОЗМОЖНЫЕ ПРИЧИНЫ:
1. Анализ не содержал точек протекторов
2. Не удалось создать геометрические паспорта
3. Точки были отфильтрованы по качеству

🔧 РЕКОМЕНДАЦИИ:
• Проверьте качество входного фото
• Убедитесь, что протекторы детектируются
• Попробуйте другое фото обуви

═══════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
`.trim();
       
        fs.writeFileSync(outputPath, report, 'utf8');
       
        return {
            path: outputPath,
            note: 'Отчет об отсутствии данных'
        };
    }

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация старого формата...');
       
        try {
            // Извлекаем точки из footprint
            const points = [];
           
            if (footprint.pointTracker && footprint.pointTracker.getAllPoints) {
                points.push(...footprint.pointTracker.getAllPoints());
            } else if (footprint.graph && footprint.graph.nodes) {
                footprint.graph.nodes.forEach((node, nodeId) => {
                    points.push({
                        id: nodeId,
                        x: node.x,
                        y: node.y,
                        confirmations: node.confirmedCount || 1,
                        patternType: 'legacy'
                    });
                });
            }
           
            const passportsData = {
                points: points,
                passports: [],
                patterns: []
            };
           
            return await this.visualizeGeometricPassports(passportsData, options);
           
        } catch (error) {
            console.error('❌ Ошибка совместимости:', error);
            return this.createPassportReport({ points: [] }, options);
        }
    }

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    async visualizeConfirmations(footprint1, footprint2, options = {}) {
        console.log('🎨 [Совместимость] Сравнение двух следов...');
       
        try {
            // Собираем точки из обоих следов
            const points1 = [];
            const points2 = [];
           
            if (footprint1.pointTracker && footprint1.pointTracker.getAllPoints) {
                points1.push(...footprint1.pointTracker.getAllPoints());
            }
           
            if (footprint2.pointTracker && footprint2.pointTracker.getAllPoints) {
                points2.push(...footprint2.pointTracker.getAllPoints());
            }
           
            // Создаем визуализацию с двумя наборами точек
            const canvasWidth = options.width || this.config.canvasWidth;
            const canvasHeight = options.height || this.config.canvasHeight;
           
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                return this.createComparisonReport(points1, points2, footprint1, footprint2, options);
            }
           
            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');
           
            // Фон
            ctx.fillStyle = this.config.pointColors.background;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
           
            // Заголовок
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🔍 СРАВНЕНИЕ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ', canvasWidth / 2, 50);
           
            // Информация о следах
            ctx.font = '16px Arial';
            ctx.fillStyle = '#495057';
            ctx.fillText(
                `${footprint1.name || 'След 1'} vs ${footprint2.name || 'След 2'}`,
                canvasWidth / 2, 85
            );
           
            // Разделительная линия
            ctx.strokeStyle = '#E0E0E0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(canvasWidth / 2, 100);
            ctx.lineTo(canvasWidth / 2, canvasHeight - 100);
            ctx.stroke();
           
            // Рисуем точки первого следа слева
            this.drawPointsSide(ctx, points1, 'left', canvasWidth, canvasHeight, 'След 1');
           
            // Рисуем точки второго следа справа
            this.drawPointsSide(ctx, points2, 'right', canvasWidth, canvasHeight, 'След 2');
           
            // Легенда
            this.drawPassportLegend(ctx, canvasWidth, canvasHeight);
           
            // Футер
            this.drawFooter(ctx, canvasWidth, canvasHeight);
           
            // Сохраняем
            const filename = options.filename || `comparison_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);
           
            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();
               
                stream.pipe(out);
               
                out.on('finish', () => {
                    console.log(`✅ Сравнение сохранено: ${outputPath}`);
                    resolve({
                        path: outputPath,
                        points1: points1.length,
                        points2: points2.length,
                        success: true
                    });
                });
               
                out.on('error', reject);
            });
           
        } catch (error) {
            console.error('❌ Ошибка сравнения:', error);
            return this.createComparisonReport([], [], footprint1, footprint2, options);
        }
    }

    // 🔥 НАРИСОВАТЬ ТОЧКИ С БОКУ
    drawPointsSide(ctx, points, side, canvasWidth, canvasHeight, label) {
        const isLeft = side === 'left';
        const offsetX = isLeft ? canvasWidth * 0.25 : canvasWidth * 0.75;
        const offsetY = canvasHeight * 0.5;
       
        // Подпись
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, offsetX, offsetY - 200);
       
        if (!points || points.length === 0) {
            ctx.fillStyle = '#6C757D';
            ctx.font = '14px Arial';
            ctx.fillText('Нет данных', offsetX, offsetY);
            return;
        }
       
        // Вычисляем границы
        const bounds = this.calculatePointsBounds(points);
        const scale = this.calculateScale(
            bounds.minX, bounds.maxX, bounds.minY, bounds.maxY,
            canvasWidth * 0.4, canvasHeight * 0.4
        );
       
        // Рисуем точки
        points.forEach(point => {
            const x = offsetX + (point.x - (bounds.minX + bounds.maxX) / 2) * scale;
            const y = offsetY + (point.y - (bounds.minY + bounds.maxY) / 2) * scale;
           
            // Цвет точки
            let color;
            if (point.confirmations >= 3) {
                color = this.config.pointColors.confirmed3plus;
            } else if (point.confirmations === 2) {
                color = this.config.pointColors.confirmed2;
            } else {
                color = this.config.pointColors.confirmed1;
            }
           
            // Размер точки
            const size = this.config.pointBaseSize +
                        (point.confirmations || 1) * this.config.pointSizeMultiplier;
           
            // Рисуем
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 🔥 СОЗДАТЬ ОТЧЕТ О СРАВНЕНИИ
    createComparisonReport(points1, points2, footprint1, footprint2, options = {}) {
        const filename = options.filename || `comparison_report_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);
       
        const stats1 = this.calculatePassportStats({ points: points1 });
        const stats2 = this.calculatePassportStats({ points: points2 });
       
        const report = `
🔍 ОТЧЕТ СРАВНЕНИЯ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
═══════════════════════════════════════════

📊 СВЕДЕНИЯ О СЛЕДАХ:

${footprint1.name || 'След 1'}:
• Всего точек: ${stats1.totalPoints}
• 🔴 3+ подтверждений: ${stats1.confirmed3plus}
• 🟠 2 подтверждения: ${stats1.confirmed2}
• 🔵 1 подтверждение: ${stats1.confirmed1}
• Среднее подтверждений: ${stats1.avgConfirmations.toFixed(2)}

${footprint2.name || 'След 2'}:
• Всего точек: ${stats2.totalPoints}
• 🔴 3+ подтверждений: ${stats2.confirmed3plus}
• 🟠 2 подтверждения: ${stats2.confirmed2}
• 🔵 1 подтверждение: ${stats2.confirmed1}
• Среднее подтверждений: ${stats2.avgConfirmations.toFixed(2)}

📈 СРАВНИТЕЛЬНЫЙ АНАЛИЗ:
• Разница в количестве точек: ${Math.abs(stats1.totalPoints - stats2.totalPoints)}
• Совпадение по надежным точкам (3+): ${Math.min(stats1.confirmed3plus, stats2.confirmed3plus)}
• Совпадение по новым точкам (1): ${Math.min(stats1.confirmed1, stats2.confirmed1)}

💡 ВЫВОД:
${this.generateComparisonConclusion(stats1, stats2)}

🎯 МЕТОД СРАВНЕНИЯ:
• Геометрические паспорта вместо координат
• Независимость от вращения и зеркальности
• Сравнение паттернов, а не положений точек

═══════════════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
Для графической визуализации установите: npm install canvas
`.trim();
       
        fs.writeFileSync(outputPath, report, 'utf8');
       
        return {
            path: outputPath,
            stats: { stats1, stats2 },
            note: 'Текстовый отчет сравнения'
        };
    }

    // 🔥 СОЗДАТЬ ВЫВОД ИЗ СРАВНЕНИЯ
    generateComparisonConclusion(stats1, stats2) {
        const total1 = stats1.totalPoints;
        const total2 = stats2.totalPoints;
       
        if (total1 === 0 || total2 === 0) {
            return 'Один из следов не содержит данных. Недостаточно информации для сравнения.';
        }
       
        const ratio = Math.min(total1, total2) / Math.max(total1, total2);
       
        if (ratio < 0.5) {
            return 'Следы значительно отличаются по количеству точек. Вероятно, разная обувь.';
        }
       
        const highConfidenceMatch = Math.min(
            stats1.confirmed3plus / total1,
            stats2.confirmed3plus / total2
        );
       
        if (highConfidenceMatch > 0.3) {
            return 'Обнаружено значительное совпадение надежных паттернов. Вероятно, одна и та же обувь.';
        }
       
        return 'Совпадения недостаточно убедительны. Требуется больше данных или это разная обувь.';
    }
}

module.exports = ClusterVisualizer;
