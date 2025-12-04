// modules/footprint/enhanced-model-visualizer.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

class EnhancedModelVisualizer {
    constructor() {
        console.log('🎨 EnhancedModelVisualizer создан (УМНАЯ версия)');
        this.tempDir = path.join(process.cwd(), 'temp');
        this.ensureTempDir();
        this.currentFootprint = null;
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async visualizeModelWithPhoto(footprint, outputPath = null) {
        try {
            this.currentFootprint = footprint;
            console.log(`🔍 Визуализация модели: ${footprint.name}`);
            console.log(`📊 Узлов: ${footprint.nodes.size}`);
            console.log(`🎯 Контуров в истории: ${this.collectAllContoursFromSources(footprint).length}`);
            console.log(`👠 Каблуков в истории: ${this.collectAllHeelsFromSources(footprint).length}`);

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
                await this.drawPhotoUnderlay(ctx, bestPhoto.image, canvasWidth, canvasHeight, footprint);
            } else {
                console.log('⚠️ Нет фото для подложки, рисую сетку');
                this.drawGridBackground(ctx, canvasWidth, canvasHeight);
            }

            // 3. Нормализуем данные (ВСЕ точки вместе!)
            const normalizedData = await this.normalizeAndAlignData(footprint, canvasWidth, canvasHeight);

            // 4. Рисуем элементы В ПРАВИЛЬНОМ ПОРЯДКЕ
            // Сначала ВСЕ контуры и каблуки (они должны быть ПОД узлами)
            this.drawAllContoursAndHeels(ctx, footprint);
          
            // Затем УМНЫЕ связи между узлами (только уверенные!)
            this.drawSmartEdges(ctx, normalizedData.nodes, footprint.edges);
          
            // И только потом узлы (чтобы они были СВЕРХУ)
            this.drawNodesWithConfirmation(ctx, normalizedData.nodes);
          
            // 5. Панели информации
            this.drawEnhancedInfoPanel(ctx, canvasWidth, canvasHeight, footprint, bestPhoto);
            this.drawMergeDebugInfo(ctx, footprint, canvasWidth, canvasHeight);
            this.drawLegend(ctx, canvasWidth, canvasHeight);
            this.drawClustersInfo(ctx, normalizedData.nodes, canvasWidth, canvasHeight);

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

    // ФОТО-ПОДЛОЖКА (исправленная - используем bounding box модели)
    async drawPhotoUnderlay(ctx, image, canvasWidth, canvasHeight, footprint) {
        try {
            if (!footprint || !footprint.nodes || footprint.nodes.size === 0) {
                throw new Error('Нет данных для масштабирования');
            }

            // Берем bounding box модели
            const nodes = Array.from(footprint.nodes.values());
            const xs = nodes.map(n => n.center.x);
            const ys = nodes.map(n => n.center.y);
           
            const modelWidth = Math.max(...xs) - Math.min(...xs);
            const modelHeight = Math.max(...ys) - Math.min(...ys);
           
            if (modelWidth <= 0 || modelHeight <= 0) {
                throw new Error('Некорректный bounding box модели');
            }

            // Масштабируем фото чтобы ВМЕСТИТЬ модель
            const scale = Math.min(
                (canvasWidth * 0.7) / modelWidth,
                (canvasHeight * 0.6) / modelHeight
            );

            const width = image.width * scale;
            const height = image.height * scale;
            const x = (canvasWidth - width) / 2;
            const y = (canvasHeight - height) / 2 + 50;

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
            // Рисуем сетку как fallback
            this.drawGridBackground(ctx, canvasWidth, canvasHeight);
        }
    }

    // НОРМАЛИЗАЦИЯ ДАННЫХ (ВСЕ точки вместе!)
    async normalizeAndAlignData(footprint, canvasWidth, canvasHeight) {
        console.log('🎯 Нормализую ВСЕ данные для визуализации...');
      
        const nodes = Array.from(footprint.nodes.values());
        const normalizedNodes = new Map();
      
        // Собираем ВСЕ точки для общего bounding box
        const allPoints = [];
      
        // 1. Точки узлов
        nodes.forEach(node => {
            if (node.center) {
                allPoints.push(node.center);
            }
        });
      
        // 2. Точки из ВСЕХ контуров
        const allContours = this.collectAllContoursFromSources(footprint);
        allContours.forEach(contour => {
            if (contour.points) {
                allPoints.push(...contour.points);
            }
        });
      
        // 3. Точки из ВСЕХ каблуков
        const allHeels = this.collectAllHeelsFromSources(footprint);
        allHeels.forEach(heel => {
            if (heel.points) {
                allPoints.push(...heel.points);
            }
        });
      
        if (allPoints.length === 0) {
            console.log('⚠️ Нет точек для визуализации');
            return { nodes: normalizedNodes, contours: [], heels: [] };
        }
      
        // Находим общий bounding box ВСЕХ точек
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        let minX = Math.min(...xs);
        let maxX = Math.max(...xs);
        let minY = Math.min(...ys);
        let maxY = Math.max(...ys);
      
        // Добавляем отступ
        const padding = Math.max(
            (maxX - minX) * 0.1,
            (maxY - minY) * 0.1,
            50
        );
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;
      
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
      
        console.log(`📐 Общий bounding box: ${width.toFixed(0)}x${height.toFixed(0)} (${allPoints.length} точек)`);
      
        // Масштабирование на canvas
        const canvasPadding = 100;
        const availableWidth = canvasWidth - canvasPadding * 2;
        const availableHeight = canvasHeight - canvasPadding * 2 - 100;
      
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
      
        console.log(`✅ Готово: ${normalizedNodes.size} узлов, ${allContours.length} контуров, ${allHeels.length} каблуков`);
        return {
            nodes: normalizedNodes,
            allContours: allContours,
            allHeels: allHeels
        };
    }

    // СОБИРАЕМ ВСЕ КОНТУРЫ ИЗ ВСЕХ ИСТОЧНИКОВ
    collectAllContoursFromSources(footprint) {
        const allContours = [];
      
        // 1. Из bestContours
        if (footprint.bestContours && footprint.bestContours.length > 0) {
            footprint.bestContours.forEach(contour => {
                allContours.push({
                    ...contour,
                    source: 'bestContours',
                    color: 'rgba(0, 100, 255, 0.4)' // Синий для лучших
                });
            });
        }
      
        // 2. Из источников узлов (ВСЕ фото!)
        let photoIndex = 0;
        const photoColors = [
            'rgba(0, 100, 255, 0.4)',   // Синий
            'rgba(0, 255, 100, 0.4)',   // Зеленый
            'rgba(255, 100, 0, 0.4)',   // Оранжевый
            'rgba(255, 0, 200, 0.4)',   // Розовый
            'rgba(200, 200, 0, 0.4)'    // Желтый
        ];
      
        footprint.nodes.forEach(node => {
            if (node.sources && Array.isArray(node.sources)) {
                node.sources.forEach(source => {
                    if (source.geometry && source.geometry.contours) {
                        source.geometry.contours.forEach(contour => {
                            // Определяем цвет по фото
                            const photoKey = source.localPhotoPath || source.imagePath || 'unknown';
                            let colorIndex = 0;
                          
                            // Если это новое фото - даем новый цвет
                            if (!this.photoColorMap) this.photoColorMap = new Map();
                            if (!this.photoColorMap.has(photoKey)) {
                                colorIndex = this.photoColorMap.size % photoColors.length;
                                this.photoColorMap.set(photoKey, photoColors[colorIndex]);
                            }
                          
                            allContours.push({
                                points: contour.points,
                                confidence: contour.confidence,
                                source: 'node_source',
                                photoKey: photoKey,
                                color: this.photoColorMap.get(photoKey),
                                nodeId: node.id
                            });
                        });
                    }
                });
            }
        });
      
        console.log(`📸 Собрано ${allContours.length} контуров из ${this.photoColorMap ? this.photoColorMap.size : 0} фото`);
        return allContours;
    }

    // СОБИРАЕМ ВСЕ КАБЛУКИ ИЗ ВСЕХ ИСТОЧНИКОВ
    collectAllHeelsFromSources(footprint) {
        const allHeels = [];
      
        // 1. Из bestHeels
        if (footprint.bestHeels && footprint.bestHeels.length > 0) {
            footprint.bestHeels.forEach(heel => {
                allHeels.push({
                    ...heel,
                    source: 'bestHeels',
                    color: 'rgba(255, 50, 50, 0.3)' // Красный для лучших
                });
            });
        }
      
        // 2. Из источников узлов
        footprint.nodes.forEach(node => {
            if (node.sources && Array.isArray(node.sources)) {
                node.sources.forEach(source => {
                    if (source.geometry && source.geometry.heels) {
                        source.geometry.heels.forEach(heel => {
                            allHeels.push({
                                points: heel.points,
                                confidence: heel.confidence,
                                source: 'node_source',
                                nodeId: node.id
                            });
                        });
                    }
                });
            }
        });
      
        return allHeels;
    }

    // РИСУЕМ ВСЕ КОНТУРЫ И КАБЛУКИ (БЕЗ ЗАЛИВКИ!)
    drawAllContoursAndHeels(ctx, footprint) {
        console.log('🎨 Рисую ВСЕ контуры и каблуки...');
      
        // 1. Контуры (ТОЛЬКО КОНТУРЫ, БЕЗ ЗАЛИВКИ!)
        const allContours = this.collectAllContoursFromSources(footprint);
        allContours.forEach(contour => {
            if (contour.points && contour.points.length > 2) {
                // Используем цвет из источника
                const color = contour.color || 'rgba(0, 100, 255, 0.4)';
              
                // Контур (пунктир)
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 3]);
              
                ctx.beginPath();
                contour.points.forEach((point, index) => {
                    if (index === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
      
        // 2. Каблуки (ТОЛЬКО КОНТУРЫ, БЕЗ ЗАЛИВКИ!)
        const allHeels = this.collectAllHeelsFromSources(footprint);
        allHeels.forEach(heel => {
            if (heel.points && heel.points.length > 2) {
                // Контур
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.lineWidth = 1;
              
                ctx.beginPath();
                heel.points.forEach((point, index) => {
                    if (index === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.stroke();
            }
        });
      
        console.log(`✅ Нарисовано: ${allContours.length} контуров, ${allHeels.length} каблуков`);
    }

    // УМНЫЕ СВЯЗИ МЕЖДУ УЗЛАМИ (как в топоанализе!)
    drawSmartEdges(ctx, normalizedNodes, edges) {
        if (!edges || edges.length === 0) return;
      
        // Группируем узлы в кластеры
        const clusters = this.createClusters(normalizedNodes);
        console.log(`🔄 Обнаружено ${clusters.length} кластеров`);
      
        // Рисуем связи ТОЛЬКО внутри кластеров и между ближайшими кластерами
        clusters.forEach(cluster => {
            this.drawClusterEdges(ctx, cluster, normalizedNodes);
        });
      
        // Рисуем связи между ближайшими кластерами
        this.drawInterClusterEdges(ctx, clusters, normalizedNodes);
    }

    // СОЗДАЕМ КЛАСТЕРЫ ИЗ УЗЛОВ
    createClusters(normalizedNodes) {
        const nodes = Array.from(normalizedNodes.values());
        const clusters = [];
        const visited = new Set();
      
        // Максимальное расстояние для кластеризации (в нормализованных координатах)
        const clusterThreshold = 50;
      
        for (const node of nodes) {
            if (visited.has(node.id)) continue;
          
            // Создаем новый кластер
            const cluster = [node];
            visited.add(node.id);
          
            // Ищем соседей
            for (const otherNode of nodes) {
                if (visited.has(otherNode.id)) continue;
              
                const distance = this.calculateDistance(
                    node.normalizedCenter,
                    otherNode.normalizedCenter
                );
              
                if (distance < clusterThreshold) {
                    cluster.push(otherNode);
                    visited.add(otherNode.id);
                }
            }
          
            clusters.push(cluster);
        }
      
        // Сортируем по размеру
        clusters.sort((a, b) => b.length - a.length);
      
        return clusters;
    }

    // РИСУЕМ СВЯЗИ ВНУТРИ КЛАСТЕРА
    drawClusterEdges(ctx, cluster, normalizedNodes) {
        // Рисуем связи только между уверенными узлами
        for (let i = 0; i < cluster.length; i++) {
            for (let j = i + 1; j < cluster.length; j++) {
                const nodeA = cluster[i];
                const nodeB = cluster[j];
              
                // Проверяем уверенность
                const bothConfident = nodeA.confidence > 0.7 && nodeB.confidence > 0.7;
                const bothMedium = nodeA.confidence > 0.4 && nodeB.confidence > 0.4;
              
                // НЕ рисуем если хотя бы один сомнительный
                if (nodeA.confidence < 0.3 || nodeB.confidence < 0.3) {
                    continue;
                }
              
                // Рассчитываем расстояние
                const distance = this.calculateDistance(
                    nodeA.normalizedCenter,
                    nodeB.normalizedCenter
                );
              
                // Максимальное расстояние для связи
                const maxDistance = 150;
              
                if (distance < maxDistance) {
                    // Определяем стиль линии
                    if (bothConfident) {
                        // Уверенная связь - зеленая толстая
                        ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
                        ctx.lineWidth = 3;
                    } else if (bothMedium) {
                        // Средняя уверенность - оранжевая средняя
                        ctx.strokeStyle = 'rgba(255, 165, 0, 0.4)';
                        ctx.lineWidth = 2;
                    } else {
                        // Хотя бы один сомнительный - серая тонкая (или пропускаем)
                        ctx.strokeStyle = 'rgba(150, 150, 150, 0.1)';
                        ctx.lineWidth = 1;
                    }
                  
                    // Рисуем линию
                    ctx.beginPath();
                    ctx.moveTo(nodeA.normalizedCenter.x, nodeA.normalizedCenter.y);
                    ctx.lineTo(nodeB.normalizedCenter.x, nodeB.normalizedCenter.y);
                    ctx.stroke();
                }
            }
        }
    }

    // РИСУЕМ СВЯЗИ МЕЖДУ КЛАСТЕРАМИ (только ближайшие)
    drawInterClusterEdges(ctx, clusters, normalizedNodes) {
        if (clusters.length < 2) return;
      
        // Находим центры кластеров
        const clusterCenters = clusters.map(cluster => {
            const xs = cluster.map(n => n.normalizedCenter.x);
            const ys = cluster.map(n => n.normalizedCenter.y);
            return {
                x: (Math.min(...xs) + Math.max(...xs)) / 2,
                y: (Math.min(...ys) + Math.max(...ys)) / 2,
                size: cluster.length,
                confidence: cluster.reduce((sum, n) => sum + n.confidence, 0) / cluster.length
            };
        });
      
        // Соединяем только ближайшие кластеры
        for (let i = 0; i < clusterCenters.length; i++) {
            for (let j = i + 1; j < clusterCenters.length; j++) {
                const centerA = clusterCenters[i];
                const centerB = clusterCenters[j];
              
                const distance = this.calculateDistance(centerA, centerB);
              
                // Соединяем только если близко и оба кластера уверенные
                if (distance < 300 && centerA.confidence > 0.5 && centerB.confidence > 0.5) {
                    // Пунктирная серая линия между кластерами
                    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([10, 5]);
                  
                    ctx.beginPath();
                    ctx.moveTo(centerA.x, centerA.y);
                    ctx.lineTo(centerB.x, centerB.y);
                    ctx.stroke();
                  
                    ctx.setLineDash([]);
                }
            }
        }
    }

    // УЗЛЫ С УЧЕТОМ ПОДТВЕРЖДЕНИЙ (без изменений)
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
                color = confirmationCount > 2 ? '#00cc00' : '#00ff00';
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

    // ПАНЕЛЬ ИНФОРМАЦИИ (с информацией о кластерах)
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
        ctx.fillText(`📸 Фото: ${footprint.stats.totalPhotos || 0}`, 40, 95);
        ctx.fillText(`💎 Уверенность: ${Math.round((footprint.stats.confidence || 0.5) * 100)}%`, 40, 115);
      
        // Правая колонка
        const rightColX = width - 200;
        if (bestPhoto) {
            ctx.fillText(`📸 Фото: ✅`, rightColX, 75);
        }
      
        const allContours = this.collectAllContoursFromSources(footprint);
        ctx.fillText(`🔵 Контуров: ${allContours.length}`, rightColX, 95);
      
        if (footprint.metadata?.estimatedSize) {
            ctx.fillText(`📏 Размер: ${footprint.metadata.estimatedSize}`, rightColX, 115);
        }
    }

    // ИНФОРМАЦИЯ О КЛАСТЕРАХ
    drawClustersInfo(ctx, normalizedNodes, canvasWidth, canvasHeight) {
        const nodes = Array.from(normalizedNodes.values());
        const clusters = this.createClusters(normalizedNodes);
      
        // Рисуем панель информации о кластерах
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(20, canvasHeight - 250, 300, 230);
      
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🔄 КЛАСТЕРЫ УЗЛОВ', 30, canvasHeight - 230);
      
        ctx.font = '14px Arial';
        ctx.fillText(`Всего кластеров: ${clusters.length}`, 30, canvasHeight - 210);
      
        // Показываем топ-3 кластера
        clusters.slice(0, 3).forEach((cluster, index) => {
            const yPos = canvasHeight - 185 + index * 25;
            const avgConfidence = cluster.reduce((sum, n) => sum + n.confidence, 0) / cluster.length;
          
            // Цвет точки
            ctx.fillStyle = avgConfidence > 0.7 ? '#00ff00' :
                           avgConfidence > 0.4 ? '#ffaa00' : '#ff6666';
            ctx.beginPath();
            ctx.arc(40, yPos - 8, 6, 0, Math.PI * 2);
            ctx.fill();
          
            // Текст
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`Кластер ${index + 1}: ${cluster.length} узлов, ${Math.round(avgConfidence * 100)}%`, 55, yPos);
        });
      
        // Легенда связей
        ctx.fillText('🔗 СВЯЗИ:', 30, canvasHeight - 110);
      
        // Уверенные связи
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(30, canvasHeight - 95);
        ctx.lineTo(80, canvasHeight - 95);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Уверенные (>70%)', 90, canvasHeight - 90);
      
        // Средние связи
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(30, canvasHeight - 70);
        ctx.lineTo(80, canvasHeight - 70);
        ctx.stroke();
        ctx.fillText('Средние (40-70%)', 90, canvasHeight - 65);
      
        // Сомнительные (пунктир)
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(30, canvasHeight - 45);
        ctx.lineTo(80, canvasHeight - 45);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText('Сомнительные (<40%)', 90, canvasHeight - 40);
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
        const legendY = height - 500; // Подняли выше
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
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateDistance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
}

module.exports = EnhancedModelVisualizer;
