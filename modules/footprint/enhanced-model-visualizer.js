// modules/footprint/enhanced-model-visualizer.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

class EnhancedModelVisualizer {
    constructor() {
        console.log('🎨 EnhancedModelVisualizer создан');
        this.tempDir = path.join(process.cwd(), 'temp');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async visualizeModelWithPhoto(footprint, outputPath = null) {
        try {
            console.log(`🔍 Визуализация модели: ${footprint.name}`);
            console.log(`📊 Узлов: ${footprint.nodes.size}`);
            console.log(`🎯 Контуров: ${footprint.bestContours?.length || 0}`);
            console.log(`👠 Каблуков: ${footprint.bestHeels?.length || 0}`);

            if (!footprint || !footprint.nodes || footprint.nodes.size === 0) {
                console.log('❌ Модель пуста');
                return null;
            }

            const canvasWidth = 1000;
            const canvasHeight = 800;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // 1. Темный фон
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. Пробуем загрузить фото для подложки
            const bestPhoto = await this.findBestPhotoForModel(footprint);
            if (bestPhoto && bestPhoto.image) {
                await this.drawPhotoUnderlay(ctx, bestPhoto.image, canvasWidth, canvasHeight);
            } else {
                console.log('⚠️ Нет фото для подложки, рисую сетку');
                this.drawGridBackground(ctx, canvasWidth, canvasHeight);
            }

            // 3. Нормализуем данные
            const normalizedData = await this.normalizeAndAlignData(footprint, canvasWidth, canvasHeight);

            // 4. Рисуем элементы В ПРАВИЛЬНОМ ПОРЯДКЕ
            // Сначала контуры и каблуки (они должны быть ПОД узлами)
            this.drawContoursAndHeelsForControl(ctx, normalizedData.contours, normalizedData.heels);
           
            // Затем связи между узлами
            this.drawEdges(ctx, normalizedData.nodes, footprint.edges);
           
            // И только потом узлы (чтобы они были СВЕРХУ)
            this.drawNodesWithConfirmation(ctx, normalizedData.nodes);
           
            // 5. Панели информации
            this.drawEnhancedInfoPanel(ctx, canvasWidth, canvasHeight, footprint, bestPhoto);
            this.drawMergeDebugInfo(ctx, footprint, canvasWidth, canvasHeight);
            this.drawLegend(ctx, canvasWidth, canvasHeight);

            const finalPath = outputPath || path.join(
                this.tempDir,
                `enhanced_model_${footprint.id.slice(0, 8)}_${Date.now()}.png`
            );

            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(finalPath, buffer);

            console.log(`✅ Улучшенная визуализация сохранена: ${finalPath}`);
            return finalPath;

        } catch (error) {
            console.log('❌ Ошибка визуализации:', error.message);
            return null;
        }
    }

    // ФОН С СЕТКОЙ
    drawGridBackground(ctx, width, height) {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.lineWidth = 1;
       
        // Вертикальные линии
        for (let x = 100; x < width; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
       
        // Горизонтальные линии
        for (let y = 100; y < height; y += 100) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
       
        // Центр
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    // ПОИСК ЛУЧШЕГО ФОТО
    async findBestPhotoForModel(footprint) {
        try {
            console.log('🔍 Ищу фото для визуализации...');
           
            // 1. Проверяем bestPhotoInfo
            if (footprint.bestPhotoInfo && footprint.bestPhotoInfo.path) {
                const photoPath = footprint.bestPhotoInfo.path;
                console.log(`📸 Пробую bestPhotoInfo: ${photoPath}`);
               
                if (fs.existsSync(photoPath)) {
                    const image = await loadImage(photoPath);
                    console.log(`✅ Фото загружено`);
                    return {
                        path: photoPath,
                        image: image,
                        quality: footprint.bestPhotoInfo.quality || 0.5
                    };
                } else {
                    console.log(`⚠️ Файл не существует: ${photoPath}`);
                }
            }
           
            // 2. Ищем среди источников узлов
            let bestLocalPath = null;
           
            footprint.nodes.forEach(node => {
                if (node.sources && Array.isArray(node.sources)) {
                    node.sources.forEach(source => {
                        // Проверяем локальные пути
                        const possiblePaths = [
                            source.localPhotoPath,
                            source.localPath,
                            source.imagePath
                        ].filter(p => p && typeof p === 'string');
                       
                        for (const path of possiblePaths) {
                            // Ищем в папке temp
                            if ((path.includes('temp/') || path.includes('temp\\')) && fs.existsSync(path)) {
                                bestLocalPath = path;
                                return;
                            }
                        }
                    });
                }
            });
           
            if (bestLocalPath) {
                const image = await loadImage(bestLocalPath);
                console.log(`✅ Нашел локальное фото: ${bestLocalPath}`);
                return {
                    path: bestLocalPath,
                    image: image,
                    quality: 0.5
                };
            }
           
            console.log('⚠️ Не найдено доступных фото');
            return null;
           
        } catch (error) {
            console.log('⚠️ Ошибка поиска фото:', error.message);
            return null;
        }
    }

    // ФОТО-ПОДЛОЖКА
    async drawPhotoUnderlay(ctx, image, canvasWidth, canvasHeight) {
        try {
            // Масштабируем чтобы вместить в 80% canvas
            const scale = Math.min(
                canvasWidth * 0.8 / image.width,
                canvasHeight * 0.7 / image.height
            );

            const width = image.width * scale;
            const height = image.height * scale;
            const x = (canvasWidth - width) / 2;
            const y = (canvasHeight - height) / 2 + 50; // Смещаем вниз для панели

            // Темная подложка под фото
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x - 5, y - 5, width + 10, height + 10);

            // Фото с низкой прозрачностью
            ctx.globalAlpha = 0.25;
            ctx.drawImage(image, x, y, width, height);
            ctx.globalAlpha = 1.0;

            // Рамка
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

        } catch (error) {
            console.log('⚠️ Не удалось нарисовать фото:', error.message);
        }
    }

    // НОРМАЛИЗАЦИЯ ДАННЫХ
    async normalizeAndAlignData(footprint, canvasWidth, canvasHeight) {
        console.log('🎯 Нормализую данные для визуализации...');
       
        const nodes = Array.from(footprint.nodes.values());
        const normalizedNodes = new Map();
       
        // Берем контур для контроля (если есть)
        let controlContour = null;
        let controlHeel = null;
       
        if (footprint.bestContours && footprint.bestContours.length > 0) {
            controlContour = footprint.bestContours[0];
            console.log(`🎯 Контрольный контур: ${controlContour.points?.length || 0} точек`);
        }
       
        if (footprint.bestHeels && footprint.bestHeels.length > 0) {
            controlHeel = footprint.bestHeels[0];
        }
       
        // Собираем все точки для bounding box
        const allPoints = [];
       
        // Точки узлов
        nodes.forEach(node => {
            if (node.center) {
                allPoints.push(node.center);
            }
        });
       
        if (allPoints.length === 0) {
            console.log('⚠️ Нет точек для визуализации');
            return { nodes: normalizedNodes, contours: [], heels: [] };
        }
       
        // Находим общий bounding box
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        let minX = Math.min(...xs);
        let maxX = Math.max(...xs);
        let minY = Math.min(...ys);
        let maxY = Math.max(...ys);
       
        // Добавляем отступ
        const padding = Math.max((maxX - minX) * 0.1, (maxY - minY) * 0.1, 50);
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;
       
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
       
        console.log(`📐 Bounding box: ${width.toFixed(0)}x${height.toFixed(0)}`);
       
        // Масштабирование на canvas
        const canvasPadding = 100;
        const availableWidth = canvasWidth - canvasPadding * 2;
        const availableHeight = canvasHeight - canvasPadding * 2 - 100; // Место для панелей
       
        let scale = Math.min(
            availableWidth / width,
            availableHeight / height
        );
       
        // Оставляем место для легенды
        scale = scale * 0.9;
       
        console.log(`📐 Масштаб: ${scale.toFixed(4)}`);
       
        // Смещение для верхней панели
        const topPanelOffset = 120;
       
        // Функция нормализации
        const normalizePoint = (point, offsetY = 0) => {
            const x = canvasPadding + (point.x - minX) * scale;
            const y = canvasPadding + offsetY + (point.y - minY) * scale;
            return { x, y };
        };
       
        // Нормализуем узлы
        console.log('📍 Нормализую узлы...');
        nodes.forEach(node => {
            if (node.center) {
                const normalized = normalizePoint(node.center, topPanelOffset);
               
                normalizedNodes.set(node.id, {
                    ...node,
                    normalizedCenter: normalized,
                    normalizedSize: Math.max(4, node.size * scale * 0.1)
                });
            }
        });
       
        // Нормализуем контур для контроля
        const normalizedContours = [];
        if (controlContour && controlContour.points) {
            console.log('🔵 Нормализую контур...');
            const normalizedPoints = controlContour.points.map(point =>
                normalizePoint(point, topPanelOffset)
            );
           
            normalizedContours.push({
                points: normalizedPoints,
                confidence: controlContour.confidence,
                isControl: true
            });
        }
       
        // Нормализуем каблук для контроля
        const normalizedHeels = [];
        if (controlHeel && controlHeel.points) {
            console.log('👠 Нормализую каблук...');
            const normalizedPoints = controlHeel.points.map(point =>
                normalizePoint(point, topPanelOffset)
            );
           
            normalizedHeels.push({
                points: normalizedPoints,
                confidence: controlHeel.confidence,
                isControl: true
            });
        }
       
        console.log(`✅ Готово: ${normalizedNodes.size} узлов, ${normalizedContours.length} контуров`);
        return {
            nodes: normalizedNodes,
            contours: normalizedContours,
            heels: normalizedHeels
        };
    }

    // КОНТУРЫ И КАБЛУКИ ДЛЯ КОНТРОЛЯ (полупрозрачные, под узлами)
    drawContoursAndHeelsForControl(ctx, contours, heels) {
        console.log('🎨 Рисую контуры для контроля...');
       
        // 1. Контуры следа (синий, очень прозрачный)
        contours.forEach(contour => {
            if (contour.points && contour.points.length > 2 && contour.isControl) {
                // Заливка (очень прозрачная)
                ctx.fillStyle = 'rgba(0, 100, 255, 0.15)';
                ctx.beginPath();
                contour.points.forEach((point, index) => {
                    if (index === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.fill();
               
                // Контур (пунктир)
                ctx.strokeStyle = 'rgba(0, 100, 255, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
       
        // 2. Каблуки (красный, очень прозрачный)
        heels.forEach(heel => {
            if (heel.points && heel.points.length > 2 && heel.isControl) {
                // Заливка
                ctx.fillStyle = 'rgba(255, 50, 50, 0.1)';
                ctx.beginPath();
                heel.points.forEach((point, index) => {
                    if (index === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.fill();
               
                // Контур
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });
    }

    // СВЯЗИ МЕЖДУ УЗЛАМИ
    drawEdges(ctx, normalizedNodes, edges) {
        if (!edges || edges.length === 0) return;
       
        // Сначала тонкие линии для всех связей
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
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
       
        // Затем толстые линии для уверенных связей
        ctx.strokeStyle = 'rgba(50, 150, 255, 0.4)';
        ctx.lineWidth = 2;
       
        edges.forEach(edge => {
            const fromNode = normalizedNodes.get(edge.from);
            const toNode = normalizedNodes.get(edge.to);
           
            if (fromNode && toNode && fromNode.confidence > 0.7 && toNode.confidence > 0.7) {
                ctx.beginPath();
                ctx.moveTo(fromNode.normalizedCenter.x, fromNode.normalizedCenter.y);
                ctx.lineTo(toNode.normalizedCenter.x, toNode.normalizedCenter.y);
                ctx.stroke();
            }
        });
    }

    // УЗЛЫ С УЧЕТОМ ПОДТВЕРЖДЕНИЙ
    drawNodesWithConfirmation(ctx, normalizedNodes) {
        normalizedNodes.forEach((node, nodeId) => {
            if (!node.normalizedCenter) return;
           
            const { x, y } = node.normalizedCenter;
            const confirmationCount = node.confirmationCount || 1;
           
            // РАЗМЕР узла зависит от подтверждений
            const baseSize = 5;
            const confirmationBoost = Math.min(confirmationCount * 1.5, 6);
            const size = baseSize + confirmationBoost;
           
            // ЦВЕТ по уверенности и подтверждениям
            let color;
            if (node.confidence > 0.7) {
                color = confirmationCount > 2 ? '#00cc00' : '#00ff00'; // Темнее при многих подтверждениях
            } else if (node.confidence > 0.4) {
                color = confirmationCount > 2 ? '#ff9900' : '#ffaa00';
            } else {
                color = confirmationCount > 2 ? '#cc0000' : '#ff6666';
            }
           
            // ОСНОВНОЙ КРУГ
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            // ОБВОДКА
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = confirmationCount > 1 ? 2 : 1;
            ctx.stroke();
           
            // БЕЛАЯ ТОЧКА для сильно подтвержденных
            if (confirmationCount >= 3) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
           
            // ЦИФРА с количеством подтверждений
            if (confirmationCount > 1) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(confirmationCount.toString(), x, y);
            }
        });
    }

    // ПАНЕЛЬ ИНФОРМАЦИИ
    drawEnhancedInfoPanel(ctx, width, height, footprint, bestPhoto) {
        const panelHeight = 100;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(20, 20, width - 40, panelHeight);
       
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, width - 40, panelHeight);
       
        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        const title = footprint.name || 'Модель без имени';
        const titleWidth = ctx.measureText(title).width;
        const titleX = Math.max(40, (width - titleWidth) / 2);
        ctx.fillText(title, titleX, 50);
       
        // Основная информация
        ctx.font = '14px Arial';
        ctx.fillText(`👣 Узлов: ${footprint.nodes.size}`, 40, 75);
        ctx.fillText(`🔗 Связей: ${footprint.edges.length}`, 40, 95);
        ctx.fillText(`💎 Уверенность: ${Math.round((footprint.stats.confidence || 0.5) * 100)}%`, 40, 115);
       
        // Правая колонка
        const rightColX = width - 200;
        if (bestPhoto) {
            ctx.fillText(`📸 Фото: ✅`, rightColX, 75);
        }
       
        if (footprint.metadata?.estimatedSize) {
            ctx.fillText(`📏 Размер: ${footprint.metadata.estimatedSize}`, rightColX, 95);
        }
    }

    // СТАТИСТИКА СЛИЯНИЯ
    drawMergeDebugInfo(ctx, footprint, canvasWidth, canvasHeight) {
        const nodes = Array.from(footprint.nodes.values());
       
        // Статистика по подтверждениям
        const confirmations = nodes.map(n => n.confirmationCount || 1);
        const avgConfirmations = confirmations.length > 0 ?
            confirmations.reduce((a, b) => a + b, 0) / confirmations.length : 1;
       
        // Группируем по уверенности
        const highConfidence = nodes.filter(n => n.confidence > 0.7).length;
        const mediumConfidence = nodes.filter(n => n.confidence > 0.4 && n.confidence <= 0.7).length;
        const lowConfidence = nodes.filter(n => n.confidence <= 0.4).length;
       
        // Рисуем панель статистики
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(canvasWidth - 420, canvasHeight - 180, 400, 170);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('📊 СТАТИСТИКА УЗЛОВ', canvasWidth - 410, canvasHeight - 160);
       
        ctx.font = '14px Arial';
        ctx.fillText(`👣 Всего узлов: ${nodes.length}`, canvasWidth - 400, canvasHeight - 140);
        ctx.fillText(`🔗 Среднее подтверждений: ${avgConfirmations.toFixed(1)}`, canvasWidth - 400, canvasHeight - 120);
       
        // Цветная легенда
        ctx.fillText('🎯 УВЕРЕННОСТЬ:', canvasWidth - 400, canvasHeight - 100);
       
        // Высокая
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(canvasWidth - 250, canvasHeight - 105, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${highConfidence} высокая`, canvasWidth - 235, canvasHeight - 100);
       
        // Средняя
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(canvasWidth - 130, canvasHeight - 105, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${mediumConfidence} средняя`, canvasWidth - 115, canvasHeight - 100);
       
        // Низкая
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.arc(canvasWidth - 250, canvasHeight - 85, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${lowConfidence} низкая`, canvasWidth - 235, canvasHeight - 80);
    }

    // ЛЕГЕНДА
    drawLegend(ctx, width, height) {
        const legendX = 20;
        const legendY = height - 200;
        const legendWidth = 200;
        const legendHeight = 150;
       
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🎯 ЛЕГЕНДА', legendX + 10, legendY + 25);
       
        ctx.font = '14px Arial';
       
        // Узлы с подтверждениями
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(legendX + 15, legendY + 50, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Высокая уверенность', legendX + 30, legendY + 55);
       
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(legendX + 15, legendY + 80, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Средняя уверенность', legendX + 30, legendY + 85);
       
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.arc(legendX + 15, legendY + 110, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Низкая уверенность', legendX + 30, legendY + 115);
       
        // Контуры
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(legendX + 10, legendY + 140);
        ctx.lineTo(legendX + 40, legendY + 140);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Контур следа (контроль)', legendX + 50, legendY + 145);
    }
}

module.exports = EnhancedModelVisualizer;
