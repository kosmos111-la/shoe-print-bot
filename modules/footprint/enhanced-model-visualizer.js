// modules/footprint/enhanced-model-visualizer.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

class EnhancedModelVisualizer {
    constructor() {
        console.log('🎨 EnhancedModelVisualizer создан (УЛУЧШЕННАЯ версия)');
        this.tempDir = path.join(process.cwd(), 'temp');
        this.ensureTempDir();
        this.currentFootprint = null;
        this.currentPhoto = null;
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

            // 2. Пробуем загрузить ЛУЧШЕЕ фото для подложки
            const bestPhoto = await this.findBestPhotoForModel(footprint);
            let transformedModel = null;
            
            if (bestPhoto && bestPhoto.image) {
                this.currentPhoto = bestPhoto;
                console.log(`📸 Использую лучшее фото: ${bestPhoto.path}`);
                
                // СНАЧАЛА рисуем фото, чтобы узнать его позицию!
                const photoInfo = await this.drawPhotoUnderlay(ctx, bestPhoto.image, canvasWidth, canvasHeight);
                
                if (photoInfo) {
                    // ТЕПЕРЬ трансформируем модель с учетом реальной позиции фото
                    transformedModel = await this.transformModelToPhoto(footprint, bestPhoto, photoInfo);
                    
                    console.log('\n=== 🔍 ДИАГНОСТИКА ТРАНСФОРМАЦИИ ===');
                    console.log('📐 Canvas:', canvasWidth, 'x', canvasHeight);
                    console.log('📸 Фото оригинальное:', bestPhoto.image.width, 'x', bestPhoto.image.height);
                    console.log('📍 Позиция фото на canvas:', this.photoPosition);

                    if (transformedModel && transformedModel.transformInfo) {
                        console.log('🔄 Инфо трансформации:');
                        console.log('  - Метод:', transformedModel.transformInfo.method);
                        console.log('  - Масштаб:', transformedModel.transformInfo.scale);
                        console.log('  - Смещение X:', transformedModel.transformInfo.offsetX);
                        console.log('  - Смещение Y:', transformedModel.transformInfo.offsetY);
                        console.log('  - Общих узлов:', transformedModel.transformInfo.commonNodesCount);
                    }

                    console.log('===================================\n');
                    
                    if (transformedModel) {
                        // 4. Рисуем элементы В ПРАВИЛЬНОМ ПОРЯДКЕ
                        // Сначала ВСЕ контуры (они должны быть ПОД узлами)
                        this.drawAllContoursTransformed(ctx, transformedModel.contours, bestPhoto);

                        // Затем УМНЫЕ связи между узлами
                        this.drawSmartEdgesTransformed(ctx, transformedModel.nodes);

                        // И только потом узлы (чтобы они были СВЕРХУ)
                        this.drawNodesTransformed(ctx, transformedModel.nodes);
                    } else {
                        console.log('⚠️ Не удалось трансформировать модель, рисую без фото');
                        this.drawGridBackground(ctx, canvasWidth, canvasHeight);
                        // Рисуем модель без трансформации
                        this.drawModelWithoutPhoto(ctx, footprint, canvasWidth, canvasHeight);
                    }
                } else {
                    console.log('⚠️ Не удалось нарисовать фото подложку');
                    this.drawGridBackground(ctx, canvasWidth, canvasHeight);
                    // Рисуем модель без фото
                    this.drawModelWithoutPhoto(ctx, footprint, canvasWidth, canvasHeight);
                }
            } else {
                console.log('⚠️ Нет фото для подложки');
                this.drawGridBackground(ctx, canvasWidth, canvasHeight);
                // Рисуем модель без фото
                this.drawModelWithoutPhoto(ctx, footprint, canvasWidth, canvasHeight);
            }

            const finalPath = outputPath || path.join(
                this.tempDir,
                `enhanced_model_${footprint.id.slice(0, 8)}_${Date.now()}.png`
            );

            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(finalPath, buffer);

            console.log(`✅ Улучшенная визуализация сохранена: ${finalPath}`);
            
            // 🔍 ФИНАЛЬНАЯ СТАТИСТИКА
            console.log('\n=== 📊 ФИНАЛЬНАЯ СТАТИСТИКА ===');
            console.log('✅ Визуализация создана:', finalPath);

            if (transformedModel) {
                console.log('📊 Модель после трансформации:');
                console.log('  - Узлов:', transformedModel.nodes.size);
                console.log('  - Контуров:', transformedModel.contours.length);
            }

            console.log('===================================\n');
            return finalPath;

        } catch (error) {
            console.log('❌ Ошибка визуализации:', error.message);
            return null;
        }
    }

    // 🔧 КЛЮЧЕВОЙ МЕТОД: ТРАНСФОРМАЦИЯ МОДЕЛИ ПОД ФОТО
    async transformModelToPhoto(footprint, photoInfo, canvasPhotoInfo = null) {
        try {
            console.log('🔄 Трансформирую модель под фото...');
            
            // 1. Получаем анализ с ЭТОГО фото
            const photoAnalysis = this.getAnalysisFromPhoto(footprint, photoInfo.path);
            
            if (!photoAnalysis || !photoAnalysis.predictions) {
                console.log('⚠️ Не найден анализ для этого фото');
                return null;
            }
            
            // 2. Ищем общие узлы (протекторы)
            const commonNodes = this.findCommonNodes(footprint, photoAnalysis);
            
            if (commonNodes.length < 2) {
                console.log(`⚠️ Слишком мало общих узлов: ${commonNodes.length}`);
                return null;
            }

            console.log(`✅ Нашел ${commonNodes.length} общих узлов для трансформации`);
            
            // 3. Вычисляем трансформацию С УЧЕТОМ ПОЗИЦИИ ФОТО НА CANVAS
            const transform = this.calculateTransform(
                commonNodes,
                canvasPhotoInfo?.scale || 0.5,
                canvasPhotoInfo
            );

            if (!transform) {
                console.log('⚠️ Не удалось вычислить трансформацию');
                return null;
            }

            console.log(`📐 Трансформация: масштаб=${transform.scale.toFixed(3)}, смещение=(${transform.offsetX.toFixed(0)}, ${transform.offsetY.toFixed(0)})`);

            // 4. Применяем трансформацию ко всей модели
            const transformedModel = this.applyTransformToModel(footprint, transform);

            // 5. Добавляем информацию о трансформации
            transformedModel.transformInfo = {
                ...transform,
                commonNodesCount: commonNodes.length,
                method: 'nodes',
                confidence: this.calculateTransformConfidence(commonNodes)
            };

            return transformedModel;

        } catch (error) {
            console.log('❌ Ошибка трансформации:', error.message);
            return null;
        }
    }

    // НАХОДИМ ОБЩИЕ УЗЛЫ МЕЖДУ МОДЕЛЬЮ И ФОТО
    findCommonNodes(footprint, photoAnalysis) {
        const commonNodes = [];

        // Протекторы с фото
        const photoProtectors = photoAnalysis.predictions?.filter(p => p.class === 'shoe-protector') || [];

        // Узлы из модели
        const modelNodes = Array.from(footprint.nodes.values());

        // Максимальное расстояние для совпадения (в пикселях оригинального фото)
        const maxDistance = 50;

        modelNodes.forEach(modelNode => {
            // Ищем ближайший протектор на фото
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestProtector = null;

            photoProtectors.forEach(protector => {
                const protectorCenter = this.calculateCenter(protector.points);
                const distance = this.calculateDistance(modelNode.center, protectorCenter);

                if (distance < bestDistance && distance < maxDistance) {
                    bestDistance = distance;
                    bestMatch = modelNode;
                    bestProtector = protector;
                }
            });

            if (bestMatch && bestProtector) {
                const protectorCenter = this.calculateCenter(bestProtector.points);

                commonNodes.push({
                    modelNode: bestMatch,
                    photoPoint: protectorCenter,
                    distance: bestDistance,
                    confidence: (bestMatch.confidence + (bestProtector.confidence || 0.5)) / 2
                });
            }
        });

        // Сортируем по уверенности
        commonNodes.sort((a, b) => b.confidence - a.confidence);

        return commonNodes;
    }

    // ВЫЧИСЛЯЕМ ТРАНСФОРМАЦИЮ
    calculateTransform(commonNodes, photoScale = 1.0, photoPosition = null) {
        console.log('📐 calculateTransform вызван с:');
        console.log('  - photoScale:', photoScale);
        console.log('  - photoPosition:', photoPosition);
        
        if (commonNodes.length < 2) return null;

        // Берем самые уверенные узлы (но не более 10)
        const reliableNodes = commonNodes.slice(0, Math.min(10, commonNodes.length));

        // Вычисляем средний масштаб
        const scales = [];

        for (let i = 0; i < reliableNodes.length; i++) {
            for (let j = i + 1; j < reliableNodes.length; j++) {
                const nodeA = reliableNodes[i];
                const nodeB = reliableNodes[j];

                // Расстояние в модели
                const modelDist = this.calculateDistance(nodeA.modelNode.center, nodeB.modelNode.center);

                // Расстояние на фото
                const photoDist = this.calculateDistance(nodeA.photoPoint, nodeB.photoPoint);

                if (modelDist > 10 && photoDist > 10) { // Избегаем деления на ноль и очень близких точек
                    const scale = photoDist / modelDist;
                    scales.push(scale);
                }
            }
        }

        if (scales.length === 0) return null;

        // Медианный масштаб (устойчивее к выбросам)
        scales.sort((a, b) => a - b);
        const medianScale = scales[Math.floor(scales.length / 2)];

        // Вычисляем смещение
        const offsetsX = [];
        const offsetsY = [];

        reliableNodes.forEach(node => {
            const offsetX = node.photoPoint.x - node.modelNode.center.x * medianScale;
            const offsetY = node.photoPoint.y - node.modelNode.center.y * medianScale;
            offsetsX.push(offsetX);
            offsetsY.push(offsetY);
        });

        const medianOffsetX = offsetsX.sort((a, b) => a - b)[Math.floor(offsetsX.length / 2)];
        const medianOffsetY = offsetsY.sort((a, b) => a - b)[Math.floor(offsetsY.length / 2)];
        
        // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:
        let finalScale = medianScale;
        let finalOffsetX = medianOffsetX;
        let finalOffsetY = medianOffsetY;
        
        // 1. Учитываем масштаб фото на canvas
        if (photoScale && photoScale !== 1.0) {
            finalScale = medianScale * photoScale;
            finalOffsetX = medianOffsetX * photoScale;
            finalOffsetY = medianOffsetY * photoScale;
        }
        
        // 2. Учитываем позицию фото на canvas (САМОЕ ВАЖНОЕ!)
        if (photoPosition && photoPosition.x !== undefined && photoPosition.y !== undefined) {
            finalOffsetX += photoPosition.x;
            finalOffsetY += photoPosition.y;
            console.log(`📍 Учитываю позицию фото: +(${photoPosition.x}, ${photoPosition.y})`);
        }
        
        console.log(`📐 Итоговая трансформация: масштаб=${finalScale.toFixed(3)}, смещение=(${finalOffsetX.toFixed(0)}, ${finalOffsetY.toFixed(0)})`);
        
        return {
            scale: finalScale,
            offsetX: finalOffsetX,
            offsetY: finalOffsetY,
            originalScale: medianScale,
            originalOffsetX: medianOffsetX,
            originalOffsetY: medianOffsetY
        };
    }

    // ПРИМЕНЯЕМ ТРАНСФОРМАЦИЮ К МОДЕЛИ
    applyTransformToModel(footprint, transform) {
        console.log('🔄 applyTransformToModel:');
        console.log('  - Масштаб:', transform.scale);
        console.log('  - Смещение X:', transform.offsetX);
        console.log('  - Смещение Y:', transform.offsetY);
        
        const transformed = {
            nodes: new Map(),
            contours: []
        };

        // Трансформируем узлы
        footprint.nodes.forEach((node, id) => {
            transformed.nodes.set(id, {
                ...node,
                transformedCenter: {
                    x: node.center.x * transform.scale + transform.offsetX,
                    y: node.center.y * transform.scale + transform.offsetY
                },
                transformedSize: node.size * transform.scale * 0.08
            });
        });

        // Трансформируем контуры
        const allContours = this.collectAllContoursFromSources(footprint);
        allContours.forEach(contour => {
            if (contour.points && contour.points.length > 2) {
                transformed.contours.push({
                    ...contour,
                    transformedPoints: contour.points.map(p => ({
                        x: p.x * transform.scale + transform.offsetX,
                        y: p.y * transform.scale + transform.offsetY
                    }))
                });
            }
        });

        return transformed;
    }

    // ПОЛУЧАЕМ АНАЛИЗ ДЛЯ КОНКРЕТНОГО ФОТО
    getAnalysisFromPhoto(footprint, photoPath) {
        if (!photoPath) return null;

        // Ищем в узлах
        for (const [id, node] of footprint.nodes) {
            if (node.sources && Array.isArray(node.sources)) {
                for (const source of node.sources) {
                    const sourcePath = source.localPhotoPath || source.imagePath;
                    if (sourcePath === photoPath && source.geometry) {
                        return {
                            predictions: source.geometry.protectors.map(p => ({
                                class: 'shoe-protector',
                                points: p.points,
                                confidence: p.confidence
                            })),
                            source: source
                        };
                    }
                }
            }
        }

        return null;
    }

    // РИСУЕМ ФОТО-ПОДЛОЖКУ (улучшенная версия)
    async drawPhotoUnderlay(ctx, image, canvasWidth, canvasHeight) {
        console.log('📐 drawPhotoUnderlay вызван с изображением:', image?.width, 'x', image?.height);
        
        try {
            if (!image) return null;
            
            // 🔴 МАСШТАБ 100% - заполняем 90% canvas
            const targetWidth = canvasWidth * 0.9;
            const targetHeight = canvasHeight * 0.8;
            
            const scaleX = targetWidth / image.width;
            const scaleY = targetHeight / image.height;
            const scale = Math.min(scaleX, scaleY);
            
            const width = image.width * scale;
            const height = image.height * scale;
            const x = (canvasWidth - width) / 2;
            const y = (canvasHeight - height) / 2;
            
            // Сохраняем для трансформации
            this.currentPhotoScale = scale;
            this.photoPosition = { x, y, width, height, scale };
            
            // 🔴 ФОТО ЯВНЕЕ - меньше прозрачности
            ctx.globalAlpha = 0.6; // Было 0.3
            ctx.drawImage(image, x, y, width, height);
            ctx.globalAlpha = 1.0;
            
            console.log(`📐 Фото: ${image.width}x${image.height} → ${width.toFixed(0)}x${height.toFixed(0)}, scale=${scale.toFixed(3)}, pos=(${x}, ${y})`);
            
            return { x, y, width, height, scale };

        } catch (error) {
            console.log('⚠️ Не удалось нарисовать фото:', error.message);
            return null;
        }
    }

    // РИСУЕМ ВСЕ КОНТУРЫ (улучшенные)
    drawAllContoursTransformed(ctx, contours, photoInfo) {
        console.log('🎨 Рисую улучшенные контуры...');
        
        if (!contours || contours.length === 0) return;
        
        contours.forEach(contour => {
            if (contour.transformedPoints && contour.transformedPoints.length > 2) {
                // 🔴 ЧЕТКИЕ контуры
                let color, lineWidth;
                
                // Контур с ТЕКУЩЕГО фото - яркий синий
                if (contour.source?.localPhotoPath === photoInfo.path) {
                    color = 'rgba(0, 100, 255, 0.9)'; // Ярче
                    lineWidth = 2.5; // Толще
                }
                // Контур с ДРУГОГО фото - полупрозрачный
                else {
                    color = 'rgba(0, 200, 100, 0.3)'; // Более прозрачный
                    lineWidth = 1.5;
                }
                
                // 🔴 Рисуем контур
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                ctx.beginPath();
                contour.transformedPoints.forEach((point, index) => {
                    if (index === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.stroke();
            }
        });
        
        console.log(`✅ Нарисовано ${contours.length} контуров`);
    }

    // УМНЫЕ СВЯЗИ (улучшенные)
    drawSmartEdgesTransformed(ctx, transformedNodes) {
        const nodes = Array.from(transformedNodes.values());
        if (nodes.length < 2) return;
        
        // 🔴 ПРОСТЫЕ СВЯЗИ как в одиночном фото
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];
                
                // 🔴 ТОЛЬКО уверенные связи
                if (nodeA.confidence < 0.6 || nodeB.confidence < 0.6) continue;
                
                const distance = this.calculateDistance(
                    nodeA.transformedCenter,
                    nodeB.transformedCenter
                );
                
                // 🔴 МАКСИМАЛЬНОЕ РАССТОЯНИЕ как в топоанализе
                const maxDistance = 120;
                
                if (distance < maxDistance) {
                    // 🔴 ЦВЕТ и ТОЛЩИНА как в одиночном фото
                    let color, width;
                    
                    if (nodeA.confidence > 0.8 && nodeB.confidence > 0.8) {
                        color = 'rgba(0, 255, 0, 0.7)';  // Ярко-зеленый
                        width = 3;
                    } else if (nodeA.confidence > 0.6 && nodeB.confidence > 0.6) {
                        color = 'rgba(255, 165, 0, 0.5)'; // Оранжевый
                        width = 2;
                    } else {
                        continue; // 🔴 НЕ рисуем слабые связи
                    }
                    
                    ctx.strokeStyle = color;
                    ctx.lineWidth = width;
                    ctx.lineCap = 'round';
                    
                    ctx.beginPath();
                    ctx.moveTo(nodeA.transformedCenter.x, nodeA.transformedCenter.y);
                    ctx.lineTo(nodeB.transformedCenter.x, nodeB.transformedCenter.y);
                    ctx.stroke();
                }
            }
        }
        
        console.log(`🔗 Нарисованы простые связи как в одиночном фото`);
    }

    // УЗЛЫ (улучшенные)
    drawNodesTransformed(ctx, transformedNodes) {
        transformedNodes.forEach((node, nodeId) => {
            if (!node.transformedCenter) return;
            
            const { x, y } = node.transformedCenter;
            const confirmationCount = node.confirmationCount || 1;
            
            // 🔴 КРУПНЕЕ узлы
            const baseSize = 8; // Было 5
            const confirmationBoost = Math.min(confirmationCount * 2, 8);
            const size = baseSize + confirmationBoost;
            
            // 🔴 ЯРЧЕ цвета
            let color, outlineColor;
            
            if (node.confidence > 0.8) {
                color = confirmationCount > 2 ? '#00FF00' : '#33FF33'; // Ярко-зеленый
                outlineColor = '#006600';
            } else if (node.confidence > 0.6) {
                color = confirmationCount > 2 ? '#FF9900' : '#FFAA33'; // Ярко-оранжевый
                outlineColor = '#994400';
            } else {
                color = confirmationCount > 2 ? '#FF3333' : '#FF6666'; // Ярко-красный
                outlineColor = '#990000';
            }
            
            // 🔴 ОСНОВНОЙ КРУГ (крупнее)
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // 🔴 ОБВОДКА (толще)
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = confirmationCount > 1 ? 3 : 2;
            ctx.stroke();
            
            // 🔴 ЦИФРА только если много подтверждений
            if (confirmationCount >= 3) {
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(confirmationCount.toString(), x, y);
            }
        });
    }

    // МОДЕЛЬ БЕЗ ФОТО (fallback)
    drawModelWithoutPhoto(ctx, footprint, canvasWidth, canvasHeight) {
        console.log('🎨 Рисую модель без фото...');

        // Простая нормализация
        const nodes = Array.from(footprint.nodes.values());
        if (nodes.length === 0) return;

        // Bounding box
        const xs = nodes.map(n => n.center.x);
        const ys = nodes.map(n => n.center.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        // Масштаб
        const scale = Math.min(
            (canvasWidth - 200) / width,
            (canvasHeight - 250) / height
        );

        const offsetX = (canvasWidth - width * scale) / 2;
        const offsetY = (canvasHeight - height * scale) / 2 + 50;

        // Рисуем контуры
        const allContours = this.collectAllContoursFromSources(footprint);
        allContours.forEach(contour => {
            if (contour.points && contour.points.length > 2) {
                ctx.strokeStyle = 'rgba(0, 100, 255, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 3]);

                ctx.beginPath();
                contour.points.forEach((point, index) => {
                    const x = offsetX + (point.x - minX) * scale;
                    const y = offsetY + (point.y - minY) * scale;

                    if (index === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Рисуем узлы
        nodes.forEach(node => {
            const x = offsetX + (node.center.x - minX) * scale;
            const y = offsetY + (node.center.y - minY) * scale;
            const size = Math.max(4, node.size * scale * 0.05);

            let color;
            if (node.confidence > 0.7) {
                color = '#00ff00';
            } else if (node.confidence > 0.4) {
                color = '#ffaa00';
            } else {
                color = '#ff6666';
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Простые связи
        this.drawSimpleEdges(ctx, nodes, offsetX, offsetY, scale, minX, minY);
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    drawGridBackground(ctx, width, height) {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.lineWidth = 1;

        for (let x = 100; x < width; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = 100; y < height; y += 100) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    async findBestPhotoForModel(footprint) {
        try {
            // 1. Проверяем bestPhotoInfo
            if (footprint.bestPhotoInfo && footprint.bestPhotoInfo.path) {
                const photoPath = footprint.bestPhotoInfo.path;

                if (fs.existsSync(photoPath)) {
                    const image = await loadImage(photoPath);
                    return {
                        path: photoPath,
                        image: image,
                        quality: footprint.bestPhotoInfo.quality || 0.5,
                        isBestPhoto: true
                    };
                }
            }

            // 2. Ищем среди источников узлов
            let bestLocalPath = null;
            let bestQuality = 0;

            footprint.nodes.forEach(node => {
                if (node.sources && Array.isArray(node.sources)) {
                    node.sources.forEach(source => {
                        const possiblePaths = [
                            source.localPhotoPath,
                            source.localPath,
                            source.imagePath
                        ].filter(p => p && typeof p === 'string');

                        for (const path of possiblePaths) {
                            if ((path.includes('temp/') || path.includes('temp\\')) && fs.existsSync(path)) {
                                const quality = source.photoQuality || 0.5;
                                if (quality > bestQuality) {
                                    bestQuality = quality;
                                    bestLocalPath = path;
                                }
                            }
                        }
                    });
                }
            });

            if (bestLocalPath) {
                const image = await loadImage(bestLocalPath);
                return {
                    path: bestLocalPath,
                    image: image,
                    quality: bestQuality,
                    isBestPhoto: false
                };
            }

            return null;

        } catch (error) {
            console.log('⚠️ Ошибка поиска фото:', error.message);
            return null;
        }
    }

    collectAllContoursFromSources(footprint) {
        const allContours = [];

        // Из allContours (если есть)
        if (footprint.allContours && footprint.allContours.length > 0) {
            allContours.push(...footprint.allContours);
        }

        // Из bestContours (для обратной совместимости)
        if (footprint.bestContours && footprint.bestContours.length > 0) {
            footprint.bestContours.forEach(contour => {
                allContours.push({
                    ...contour,
                    source: contour.source || { timestamp: new Date() }
                });
            });
        }

        return allContours;
    }

    createClustersTransformed(nodes) {
        const clusters = [];
        const visited = new Set();
        const clusterThreshold = 80;

        for (const node of nodes) {
            if (visited.has(node.id)) continue;

            const cluster = [node];
            visited.add(node.id);

            for (const otherNode of nodes) {
                if (visited.has(otherNode.id)) continue;

                const distance = this.calculateDistance(
                    node.transformedCenter,
                    otherNode.transformedCenter
                );

                if (distance < clusterThreshold) {
                    cluster.push(otherNode);
                    visited.add(otherNode.id);
                }
            }

            clusters.push(cluster);
        }

        clusters.sort((a, b) => b.length - a.length);
        return clusters;
    }

    drawClusterEdgesTransformed(ctx, cluster) {
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
                    nodeA.transformedCenter,
                    nodeB.transformedCenter
                );

                const maxDistance = 150;

                if (distance < maxDistance) {
                    if (bothConfident) {
                        ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
                        ctx.lineWidth = 3;
                    } else if (bothMedium) {
                        ctx.strokeStyle = 'rgba(255, 165, 0, 0.4)';
                        ctx.lineWidth = 2;
                    } else {
                        ctx.strokeStyle = 'rgba(150, 150, 150, 0.1)';
                        ctx.lineWidth = 1;
                    }

                    ctx.beginPath();
                    ctx.moveTo(nodeA.transformedCenter.x, nodeA.transformedCenter.y);
                    ctx.lineTo(nodeB.transformedCenter.x, nodeB.transformedCenter.y);
                    ctx.stroke();
                }
            }
        }
    }

    drawSimpleEdges(ctx, nodes, offsetX, offsetY, scale, minX, minY) {
        // Простые связи для fallback режима
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];

                if (nodeA.confidence < 0.3 || nodeB.confidence < 0.3) continue;

                const x1 = offsetX + (nodeA.center.x - minX) * scale;
                const y1 = offsetY + (nodeA.center.y - minY) * scale;
                const x2 = offsetX + (nodeB.center.x - minX) * scale;
                const y2 = offsetY + (nodeB.center.y - minY) * scale;

                const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

                if (distance < 100) {
                    if (nodeA.confidence > 0.7 && nodeB.confidence > 0.7) {
                        ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
                        ctx.lineWidth = 2;
                    } else {
                        ctx.strokeStyle = 'rgba(150, 150, 150, 0.1)';
                        ctx.lineWidth = 1;
                    }

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            }
        }
    }

    calculateTransformConfidence(commonNodes) {
        if (commonNodes.length === 0) return 0;

        // Средняя уверенность узлов
        const avgConfidence = commonNodes.reduce((sum, n) => sum + n.confidence, 0) / commonNodes.length;

        // Коэффициент на основе количества узлов
        const countFactor = Math.min(commonNodes.length / 5, 1.0);

        return avgConfidence * countFactor;
    }

    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    calculateDistance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    transformUsingContours(footprint, photoAnalysis, photoInfo) {
        console.log('🔄 Пробую трансформацию по контурам...');
        // TODO: Реализовать трансформацию по контурам если нужно
        return null;
    }
}

module.exports = EnhancedModelVisualizer;
