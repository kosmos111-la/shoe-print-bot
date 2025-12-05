// modules/footprint/enhanced-model-visualizer.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

class EnhancedModelVisualizer {
    constructor() {
        console.log('🎨 EnhancedModelVisualizer создан (ТРАНСФОРМАЦИОННАЯ версия)');
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
                
                // 🔴 СНАЧАЛА рисуем фото, чтобы узнать его позицию!
                const photoInfo = await this.drawPhotoUnderlay(ctx, bestPhoto.image, canvasWidth, canvasHeight);
                
                if (photoInfo) {
                    // 🔴 ТЕПЕРЬ трансформируем модель с учетом реальной позиции фото
                    transformedModel = await this.transformModelToPhoto(footprint, bestPhoto, photoInfo);
                    
                    console.log('\n=== 🔍 ДИАГНОСТИКА ТРАНСФОРМАЦИИ ===');
                    console.log('📐 Canvas:', canvasWidth, 'x', canvasHeight);

                    if (bestPhoto && bestPhoto.image) {
                        console.log('📸 Фото оригинальное:', bestPhoto.image.width, 'x', bestPhoto.image.height);
                    }

                    if (this.photoPosition) {
                        console.log('📍 Позиция фото на canvas:', this.photoPosition);
                    }

                    if (transformedModel && transformedModel.transformInfo) {
                        console.log('🔄 Инфо трансформации:');
                        console.log('  - Метод:', transformedModel.transformInfo.method);
                        console.log('  - Масштаб:', transformedModel.transformInfo.scale);
                        console.log('  - Смещение X:', transformedModel.transformInfo.offsetX);
                        console.log('  - Смещение Y:', transformedModel.transformInfo.offsetY);
                        console.log('  - Общих узлов:', transformedModel.transformInfo.commonNodesCount);

                        // Первый узел
                        const nodes = Array.from(transformedModel.nodes.values());
                        if (nodes.length > 0) {
                            const firstNode = nodes[0];
                            console.log('🎯 Первый узел после трансформации:');
                            console.log('  - Было:', firstNode.center);
                            console.log('  - Стало:', firstNode.transformedCenter);
                        }

                        // Первый контур
                        if (transformedModel.contours && transformedModel.contours.length > 0) {
                            const firstContour = transformedModel.contours[0];
                            if (firstContour.transformedPoints && firstContour.transformedPoints.length > 0) {
                                console.log('🔵 Первая точка контура после трансформации:', firstContour.transformedPoints[0]);
                            }
                        }
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

                        // 5. Панели информации
                        this.drawEnhancedInfoPanel(ctx, canvasWidth, canvasHeight, footprint, bestPhoto, transformedModel);
                        this.drawTransformInfo(ctx, transformedModel.transformInfo, canvasWidth, canvasHeight);
                        this.drawLegend(ctx, canvasWidth, canvasHeight);
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
            
            // 🔍 ОТЛАДОЧНЫЕ МАРКЕРЫ (всегда рисуем поверх всего)
            this.drawDebugMarkers(ctx, canvasWidth, canvasHeight);

            const finalPath = outputPath || path.join(
                this.tempDir,
                `enhanced_model_${footprint.id.slice(0, 8)}_${Date.now()}.png`
            );

            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(finalPath, buffer);

            console.log(`✅ Улучшенная визуализация сохранена: ${finalPath}`);
            
            // 🔍 ФИНАЛЬНАЯ ДИАГНОСТИКА
            console.log('\n=== 📊 ФИНАЛЬНАЯ СТАТИСТИКА ===');
            console.log('✅ Визуализация создана:', finalPath);

            // Проверяем что нарисовано
            if (transformedModel) {
                console.log('📊 Модель после трансформации:');
                console.log('  - Узлов:', transformedModel.nodes.size);
                console.log('  - Контуров:', transformedModel.contours.length);

                const nodes = Array.from(transformedModel.nodes.values());
                if (nodes.length > 0) {
                    const xs = nodes.map(n => n.transformedCenter?.x).filter(x => x !== undefined);
                    const ys = nodes.map(n => n.transformedCenter?.y).filter(y => y !== undefined);

                    if (xs.length > 0 && ys.length > 0) {
                        console.log('  - X диапазон:', Math.min(...xs).toFixed(0), '-', Math.max(...xs).toFixed(0));
                        console.log('  - Y диапазон:', Math.min(...ys).toFixed(0), '-', Math.max(...ys).toFixed(0));
                        console.log('  - Центр:', {
                            x: (Math.min(...xs) + Math.max(...xs)) / 2,
                            y: (Math.min(...ys) + Math.max(...ys)) / 2
                        });
                    }
                }
            }

            if (this.photoPosition) {
                console.log('📍 Фото на canvas:');
                console.log('  - X:', this.photoPosition.x, 'Y:', this.photoPosition.y);
                console.log('  - Ширина:', this.photoPosition.width, 'Высота:', this.photoPosition.height);
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
                // Пробуем использовать контуры
                return this.transformUsingContours(footprint, photoAnalysis, photoInfo);
            }

            console.log(`✅ Нашел ${commonNodes.length} общих узлов для трансформации`);
            console.log('🔄 Входные данные для calculateTransform:');
            console.log('  - commonNodes:', commonNodes.length);
            console.log('  - canvasPhotoInfo:', canvasPhotoInfo);

            if (commonNodes.length > 0) {
                console.log('  - Пример узла:');
                console.log('    • Модель:', commonNodes[0].modelNode.center);
                console.log('    • Фото:', commonNodes[0].photoPoint);
                console.log('    • Расстояние:', commonNodes[0].distance);
            }
            
            // 🔴 3. Вычисляем трансформацию С УЧЕТОМ ПОЗИЦИИ ФОТО НА CANVAS
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
        
        // 🔴 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:
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
            originalOffsetY: medianOffsetY,
            photoAdjustment: {
                scale: photoScale,
                position: photoPosition
            }
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

    // РИСУЕМ ФОТО-ПОДЛОЖКУ (простая версия)
    async drawPhotoUnderlay(ctx, image, canvasWidth, canvasHeight) {
        console.log('📐 drawPhotoUnderlay вызван с изображением:', image?.width, 'x', image?.height);
        
        try {
            if (!image) return null;

            // Вычисляем масштаб чтобы фото вписать в 70% canvas
            const targetWidth = canvasWidth * 0.7;
            const targetHeight = canvasHeight * 0.6;

            const scaleX = targetWidth / image.width;
            const scaleY = targetHeight / image.height;
            const scale = Math.min(scaleX, scaleY);

            const width = image.width * scale;
            const height = image.height * scale;
            const x = (canvasWidth - width) / 2;
            const y = (canvasHeight - height) / 2 + 50;

            // Сохраняем для трансформации
            this.currentPhotoScale = scale;
            this.photoPosition = { x, y, width, height, scale };

            // Темная подложка
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x - 5, y - 5, width + 10, height + 10);

            // Фото
            ctx.globalAlpha = 0.3;
            ctx.drawImage(image, x, y, width, height);
            ctx.globalAlpha = 1.0;

            // Рамка
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            console.log(`📐 Фото: ${image.width}x${image.height} → ${width.toFixed(0)}x${height.toFixed(0)}, scale=${scale.toFixed(3)}, pos=(${x}, ${y})`);
            
            // 🔴 ВОЗВРАЩАЕМ данные о позиции
            return { x, y, width, height, scale };

        } catch (error) {
            console.log('⚠️ Не удалось нарисовать фото:', error.message);
            return null;
        }
    }

    // РИСУЕМ ВСЕ КОНТУРЫ (ТРАНСФОРМИРОВАННЫЕ)
    drawAllContoursTransformed(ctx, contours, photoInfo) {
        console.log('🎨 Рисую трансформированные контуры...');

        if (!contours || contours.length === 0) return;

        contours.forEach(contour => {
            if (contour.transformedPoints && contour.transformedPoints.length > 2) {
                // Определяем цвет
                let color, lineWidth, lineDash;

                // Контур с ТЕКУЩЕГО фото - яркий синий
                if (contour.source?.localPhotoPath === photoInfo.path) {
                    color = 'rgba(0, 150, 255, 0.8)';
                    lineWidth = 2;
                    lineDash = [];
                }
                // Контур с ДРУГОГО фото - прозрачный зеленый
                else {
                    color = 'rgba(0, 255, 100, 0.3)';
                    lineWidth = 1.5;
                    lineDash = [5, 3];
                }

                // Рисуем контур
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                if (lineDash) ctx.setLineDash(lineDash);

                ctx.beginPath();
                contour.transformedPoints.forEach((point, index) => {
                    if (index === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.stroke();

                if (lineDash) ctx.setLineDash([]);
            }
        });

        console.log(`✅ Нарисовано ${contours.length} контуров`);
    }

    // УМНЫЕ СВЯЗИ (ТРАНСФОРМИРОВАННЫЕ)
    drawSmartEdgesTransformed(ctx, transformedNodes) {
        const nodes = Array.from(transformedNodes.values());
        if (nodes.length < 2) return;

        // Группируем узлы в кластеры
        const clusters = this.createClustersTransformed(nodes);

        // Рисуем связи ТОЛЬКО между уверенными узлами в кластерах
        clusters.forEach(cluster => {
            this.drawClusterEdgesTransformed(ctx, cluster);
        });
    }

    // УЗЛЫ (ТРАНСФОРМИРОВАННЫЕ)
    drawNodesTransformed(ctx, transformedNodes) {
        transformedNodes.forEach((node, nodeId) => {
            if (!node.transformedCenter) return;

            const { x, y } = node.transformedCenter;
            const confirmationCount = node.confirmationCount || 1;
            const size = node.transformedSize || 5;

            // ЦВЕТ по уверенности
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

    // ИНФОРМАЦИЯ О ТРАНСФОРМАЦИИ
    drawTransformInfo(ctx, transformInfo, canvasWidth, canvasHeight) {
        if (!transformInfo) return;

        const panelX = 20;
        const panelY = canvasHeight - 180;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(panelX, panelY, 350, 160);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🔄 ИНФОРМАЦИЯ О ТРАНСФОРМАЦИИ', panelX + 10, panelY + 25);

        ctx.font = '14px Arial';
        ctx.fillText(`Метод: ${transformInfo.method === 'nodes' ? 'По узлам протектора' : 'По контурам'}`, panelX + 10, panelY + 50);
        ctx.fillText(`Общих точек: ${transformInfo.commonNodesCount || 0}`, panelX + 10, panelY + 75);
        ctx.fillText(`Масштаб: ${transformInfo.scale?.toFixed(3) || '1.000'}`, panelX + 10, panelY + 100);

        if (transformInfo.offsetX !== undefined) {
            ctx.fillText(`Смещение X: ${transformInfo.offsetX.toFixed(0)}px`, panelX + 10, panelY + 125);
        }

        if (transformInfo.offsetY !== undefined) {
            ctx.fillText(`Смещение Y: ${transformInfo.offsetY.toFixed(0)}px`, panelX + 10, panelY + 150);
        }

        // Индикатор качества трансформации
        if (transformInfo.confidence !== undefined) {
            const confidencePercent = Math.round(transformInfo.confidence * 100);
            let confidenceColor = '#ff6666';
            let confidenceText = 'Низкая';

            if (confidencePercent > 70) {
                confidenceColor = '#00ff00';
                confidenceText = 'Высокая';
            } else if (confidencePercent > 40) {
                confidenceColor = '#ffaa00';
                confidenceText = 'Средняя';
            }

            ctx.fillStyle = confidenceColor;
            ctx.beginPath();
            ctx.arc(panelX + 330, panelY + 140, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${confidenceText} (${confidencePercent}%)`, panelX + 10, panelY + 175);
        }
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (оставлены без изменений)
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

    drawEnhancedInfoPanel(ctx, width, height, footprint, bestPhoto, transformedModel) {
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
        ctx.fillText(title, 40, 50);

        // Основная информация
        ctx.font = '14px Arial';
        ctx.fillText(`👣 Узлов: ${footprint.nodes.size}`, 40, 75);
        ctx.fillText(`📸 Фото: ${footprint.stats.totalPhotos || 0}`, 40, 95);
        ctx.fillText(`💎 Уверенность: ${Math.round((footprint.stats.confidence || 0.5) * 100)}%`, 40, 115);

        // Информация о трансформации
        if (transformedModel?.transformInfo) {
            const rightColX = width - 200;
            ctx.fillText(`🔄 Трансформация: ${transformedModel.transformInfo.method === 'nodes' ? 'По узлам' : 'По контурам'}`, rightColX, 75);
            ctx.fillText(`📏 Точек: ${transformedModel.transformInfo.commonNodesCount || 0}`, rightColX, 95);

            if (transformedModel.transformInfo.confidence) {
                const confidencePercent = Math.round(transformedModel.transformInfo.confidence * 100);
                ctx.fillText(`🎯 Качество: ${confidencePercent}%`, rightColX, 115);
            }
        }
    }

    drawLegend(ctx, width, height) {
        const legendX = 20;
        const legendY = height - 500;
        const legendWidth = 200;
        const legendHeight = 150;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🎯 ЛЕГЕНДА', legendX + 10, legendY + 25);

        ctx.font = '14px Arial';

        // Узлы
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

    // 🔍 МЕТОД ДЛЯ ОТЛАДКИ РАСПОЛОЖЕНИЯ
    drawDebugMarkers(ctx, canvasWidth, canvasHeight) {
        console.log('🎯 Рисую отладочные маркеры...');

        // 1. Центр canvas (КРАСНЫЙ)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(canvasWidth / 2, canvasHeight / 2, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ЦЕНТР CANVAS', canvasWidth / 2, canvasHeight / 2 - 25);
        ctx.fillText(`(${canvasWidth / 2}, ${canvasHeight / 2})`, canvasWidth / 2, canvasHeight / 2 + 20);

        // 2. Углы canvas (ОРАНЖЕВЫЕ)
        ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
        const corners = [
            [50, 50], [canvasWidth - 50, 50],
            [50, canvasHeight - 50], [canvasWidth - 50, canvasHeight - 50]
        ];

        corners.forEach(([x, y], i) => {
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Угол ${i + 1}`, x, y - 20);
            ctx.fillText(`(${x}, ${y})`, x, y + 15);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
        });

        // 3. Позиция фото если есть (ЗЕЛЕНЫЕ)
        if (this.photoPosition) {
            const { x, y, width, height } = this.photoPosition;

            ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';

            // Углы фото
            const photoCorners = [
                [x, y], [x + width, y],
                [x, y + height], [x + width, y + height]
            ];

            photoCorners.forEach(([cornerX, cornerY], i) => {
                ctx.beginPath();
                ctx.arc(cornerX, cornerY, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = '11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`Фото ${i + 1}`, cornerX, cornerY - 15);
                ctx.fillText(`(${cornerX.toFixed(0)}, ${cornerY.toFixed(0)})`, cornerX, cornerY + 12);
                ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
            });

            // Центр фото (ЖЕЛТЫЙ)
            ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(x + width / 2, y + height / 2, 12, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('ЦЕНТР ФОТО', x + width / 2, y + height / 2 - 25);
            ctx.fillText(`(${(x + width / 2).toFixed(0)}, ${(y + height / 2).toFixed(0)})`,
                        x + width / 2, y + height / 2 + 20);
        }
    }
}

module.exports = EnhancedModelVisualizer;
