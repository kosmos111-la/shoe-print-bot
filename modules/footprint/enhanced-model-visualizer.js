// modules/footprint/enhanced-model-visualizer.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// ✅ Импортируем DistortionTransformer
const DistortionTransformer = require('./distortion-transformer');

class EnhancedModelVisualizer {
    constructor() {
        console.log('🎨 EnhancedModelVisualizer создан');
        this.tempDir = path.join(process.cwd(), 'temp');
        this.transformer = new DistortionTransformer();
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async visualizeModelWithPhoto(footprint, outputPath = null) {
        try {
            console.log(`🔍 DEBUG EnhancedModelVisualizer для модели: ${footprint.name}`);
            console.log(`📊 Узлов: ${footprint.nodes.size}`);
            console.log(`🎯 Контуров: ${footprint.bestContours?.length || 0}`);
            console.log(`👠 Каблуков: ${footprint.bestHeels?.length || 0}`);
            console.log(`📸 Лучшее фото: ${footprint.bestPhotoInfo?.path || 'нет'}`);

            // Вывод координат первых 3 узлов для отладки
            const firstNodes = Array.from(footprint.nodes.values()).slice(0, 3);
            firstNodes.forEach((node, i) => {
                console.log(`📍 Узел ${i}: x=${node.center?.x}, y=${node.center?.y}, confidence=${node.confidence}`);
            });

            // Вывод координат контуров для отладки
            if (footprint.bestContours && footprint.bestContours.length > 0) {
                const contour = footprint.bestContours[0];
                if (contour.points && contour.points.length > 0) {
                    console.log(`🔵 Контур точка: x=${contour.points[0].x}, y=${contour.points[0].y}`);
                }
            }

            // Вывод bounding box
            if (footprint.boundingBox) {
                console.log(`📦 BoundingBox: minX=${footprint.boundingBox.minX}, maxX=${footprint.boundingBox.maxX},
                    minY=${footprint.boundingBox.minY}, maxY=${footprint.boundingBox.maxY},
                    width=${footprint.boundingBox.width}, height=${footprint.boundingBox.height}`);
            }

            if (!footprint || !footprint.nodes || footprint.nodes.size === 0) {
                console.log('❌ Модель пуста для визуализации');
                return null;
            }

            console.log(`🎨 Визуализирую модель с фото-подложкой: ${footprint.nodes.size} узлов`);

            const bestPhoto = await this.findBestPhotoForModel(footprint);

            const canvasWidth = 1000;
            const canvasHeight = 800;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // Если нет фото - рисуем фон с сеткой
            if (!bestPhoto || !bestPhoto.image) {
                console.log('⚠️ Нет фото для подложки, рисую фон с сеткой');
                this.drawGridBackground(ctx, canvasWidth, canvasHeight);
            } else {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                await this.drawPhotoUnderlay(ctx, bestPhoto.image, canvasWidth, canvasHeight);
            }

            const normalizedData = await this.normalizeAndAlignData(footprint, canvasWidth, canvasHeight);

            // Рисуем элементы
            this.drawContoursAndHeels(ctx, normalizedData.contours, normalizedData.heels);
            this.drawEdges(ctx, normalizedData.nodes, footprint.edges);
            this.drawNodes(ctx, normalizedData.nodes);
            this.drawEnhancedInfoPanel(ctx, canvasWidth, canvasHeight, footprint, bestPhoto);
            this.drawLegend(ctx, canvasWidth, canvasHeight);
           
            // Отладочная информация
            this.drawDebugInfo(ctx, canvasWidth, canvasHeight, normalizedData, bestPhoto);

            const finalPath = outputPath || path.join(
                this.tempDir,
                `enhanced_model_${footprint.id.slice(0, 8)}_${Date.now()}.png`
            );

            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(finalPath, buffer);

            console.log(`✅ Улучшенная визуализация сохранена: ${finalPath}`);
            return finalPath;

        } catch (error) {
            console.log('❌ Ошибка улучшенной визуализации:', error.message);
            return null;
        }
    }

    drawGridBackground(ctx, width, height) {
        // Темный фон
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
       
        // Сетка
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
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
       
        // Подписи осей
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Arial';
        ctx.fillText('← X →', width / 2 - 15, 20);
        ctx.fillText('↑ Y ↓', 20, height / 2 + 4);
    }

    drawDebugInfo(ctx, width, height, normalizedData, bestPhoto) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, height - 80, 400, 70);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(`📐 Canvas: ${width}x${height}`, 20, height - 65);
        ctx.fillText(`📍 Узлы: ${normalizedData.nodes.size}`, 20, height - 45);
        ctx.fillText(`🔵 Контуры: ${normalizedData.contours.length}`, 150, height - 65);
        ctx.fillText(`👠 Каблуки: ${normalizedData.heels.length}`, 150, height - 45);
        ctx.fillText(`📸 Фото: ${bestPhoto ? '✅' : '❌'}`, 280, height - 55);
       
        // Границы canvas
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, width, height);
    }

    async findBestPhotoForModel(footprint) {
        try {
            console.log('🔍 Поиск лучшего фото для модели...');
           
            // Пробуем разные источники фото
            const photoSources = [];

            // 1. Из bestPhotoInfo
            if (footprint.bestPhotoInfo && footprint.bestPhotoInfo.path) {
                console.log(`📸 Найден bestPhotoInfo: ${footprint.bestPhotoInfo.path}`);
                photoSources.push({
                    path: footprint.bestPhotoInfo.path,
                    confidence: footprint.bestPhotoInfo.avgConfidence || 0.7,
                    nodeCount: footprint.bestPhotoInfo.nodeCount || 0,
                    source: 'bestPhotoInfo'
                });
            }

            // 2. Из sources узлов
            footprint.nodes.forEach(node => {
                if (node.sources && Array.isArray(node.sources)) {
                    node.sources.forEach(source => {
                        // Пробуем все возможные пути
                        const possiblePaths = [
                            source.photoPath,
                            source.localPath,
                            source.path,
                            source.imagePath,
                            source.filePath,
                            source.photo?.path
                        ];
                       
                        for (const photoPath of possiblePaths) {
                            if (photoPath && typeof photoPath === 'string') {
                                // Проверяем существование файла
                                if (fs.existsSync(photoPath)) {
                                    photoSources.push({
                                        path: photoPath,
                                        confidence: node.confidence,
                                        nodeCount: 1,
                                        source: 'node_source',
                                        nodeId: node.id
                                    });
                                    break;
                                } else {
                                    console.log(`⚠️ Фото не найдено по пути: ${photoPath}`);
                                }
                            }
                        }
                    });
                }
            });

            console.log(`📊 Найдено источников фото: ${photoSources.length}`);

            if (photoSources.length === 0) {
                console.log('⚠️ Не найдено доступных фото для модели');
                return null;
            }

            // Группируем по пути
            const photoStats = {};
            photoSources.forEach(photo => {
                if (!photoStats[photo.path]) {
                    photoStats[photo.path] = {
                        path: photo.path,
                        totalConfidence: 0,
                        nodeCount: 0,
                        uniqueNodes: new Set(),
                        sources: []
                    };
                }
                photoStats[photo.path].totalConfidence += photo.confidence;
                photoStats[photo.path].nodeCount += 1;
                if (photo.nodeId) {
                    photoStats[photo.path].uniqueNodes.add(photo.nodeId);
                }
                photoStats[photo.path].sources.push(photo.source);
            });

            let bestPhoto = null;
            let bestScore = -1;

            Object.values(photoStats).forEach(stats => {
                // Оценка: уверенность * логарифм уникальных узлов
                const uniqueNodeCount = stats.uniqueNodes.size;
                const score = stats.totalConfidence * Math.log(uniqueNodeCount + 2);
               
                console.log(`📊 Оценка фото ${stats.path}:`);
                console.log(`  - Уникальных узлов: ${uniqueNodeCount}`);
                console.log(`  - Total confidence: ${stats.totalConfidence}`);
                console.log(`  - Score: ${score.toFixed(2)}`);
                console.log(`  - Sources: ${stats.sources.join(', ')}`);
               
                if (score > bestScore && fs.existsSync(stats.path)) {
                    bestScore = score;
                    bestPhoto = stats;
                }
            });

            if (!bestPhoto) {
                console.log('⚠️ Не удалось выбрать лучшее фото');
                return null;
            }

            console.log(`✅ Лучшее фото выбрано: ${bestPhoto.path}`);
            console.log(`   Уникальных узлов: ${bestPhoto.uniqueNodes.size}`);
            console.log(`   Общая уверенность: ${bestPhoto.totalConfidence}`);

            // Загружаем изображение
            const image = await loadImage(bestPhoto.path);

            return {
                ...bestPhoto,
                image,
                score: bestScore
            };

        } catch (error) {
            console.log('⚠️ Не удалось найти лучшее фото:', error.message);
            return null;
        }
    }

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
            const y = (canvasHeight - height) / 2;

            // Белая подложка под фото
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(x - 10, y - 10, width + 20, height + 20);

            // Фото с низкой прозрачностью
            ctx.globalAlpha = 0.15;
            ctx.drawImage(image, x, y, width, height);
            ctx.globalAlpha = 1.0;

            // Рамка вокруг фото
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            console.log(`📸 Фото нарисовано: ${x.toFixed(1)},${y.toFixed(1)} ${width.toFixed(1)}x${height.toFixed(1)}`);

        } catch (error) {
            console.log('⚠️ Не удалось нарисовать фото-подложку:', error.message);
        }
    }

    async normalizeAndAlignData(footprint, canvasWidth, canvasHeight) {
        const nodes = Array.from(footprint.nodes.values());
        const normalizedNodes = new Map();
        const contours = [];
        const heels = [];

        console.log('🔍 ДЕТАЛЬНАЯ ОТЛАДКА КООРДИНАТ:');

        // Используем контуры из модели
        if (footprint.bestContours && footprint.bestContours.length > 0) {
            contours.push(...footprint.bestContours.map(c => ({
                points: c.points,
                confidence: c.confidence,
                qualityScore: c.qualityScore,
                originalPoints: c.points // Сохраняем оригинальные точки
            })));
        }

        if (footprint.bestHeels && footprint.bestHeels.length > 0) {
            heels.push(...footprint.bestHeels.map(h => ({
                points: h.points,
                confidence: h.confidence,
                qualityScore: h.qualityScore,
                originalPoints: h.points
            })));
        }

        console.log(`🎯 В normalizedAndAlignData: ${contours.length} контуров, ${heels.length} каблуков`);
       
        // Проверяем координаты контуров (они могут быть в абсолютных координатах от Roboflow)
        if (contours.length > 0 && contours[0].points && contours[0].points.length > 0) {
            const contourPoint = contours[0].points[0];
            console.log(`🔵 Контур точка: x=${contourPoint.x}, y=${contourPoint.y}`);
            console.log(`🔵 Тип координат: ${contourPoint.x > 1000 ? 'АБСОЛЮТНЫЕ (от Roboflow)' : 'НОРМАЛИЗОВАННЫЕ'}`);
        }

        // Проверяем координаты узлов
        if (nodes.length > 0 && nodes[0].center) {
            const nodeCenter = nodes[0].center;
            console.log(`📍 Узел точка: x=${nodeCenter.x}, y=${nodeCenter.y}`);
        }

        // ВАЖНО: Объединяем ВСЕ точки (узлы + контуры + каблуки) для расчета общего bounding box
        const allPoints = [];
       
        // Точки узлов
        nodes.forEach(node => {
            if (node.center) {
                allPoints.push({ x: node.center.x, y: node.center.y });
            }
        });
       
        // Точки контуров - преобразуем абсолютные координаты если нужно
        contours.forEach(contour => {
            if (contour.points && contour.points.length > 0) {
                // Если координаты контура в абсолютных (от Roboflow), преобразуем их
                const firstPoint = contour.points[0];
                let pointsToUse = contour.points;
               
                if (firstPoint.x > 1000 || firstPoint.y > 1000) {
                    console.log(`🔄 Конвертирую абсолютные координаты контура к нормализованным`);
                    pointsToUse = contour.points.map(p => ({
                        x: p.x / 10,  // Делим на 10 для нормализации
                        y: p.y / 10
                    }));
                }
               
                allPoints.push(...pointsToUse);
            }
        });
       
        // Точки каблуков - аналогично
        heels.forEach(heel => {
            if (heel.points && heel.points.length > 0) {
                const firstPoint = heel.points[0];
                let pointsToUse = heel.points;
               
                if (firstPoint.x > 1000 || firstPoint.y > 1000) {
                    pointsToUse = heel.points.map(p => ({
                        x: p.x / 10,
                        y: p.y / 10
                    }));
                }
               
                allPoints.push(...pointsToUse);
            }
        });

        if (allPoints.length === 0) {
            console.log('⚠️ Нет точек для нормализации');
            return { nodes: normalizedNodes, contours, heels };
        }

        // Находим общие границы ВСЕХ точек
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        console.log(`📐 Общие границы: x=[${minX.toFixed(1)}-${maxX.toFixed(1)}], y=[${minY.toFixed(1)}-${maxY.toFixed(1)}]`);
        console.log(`📏 Размеры: width=${width.toFixed(1)}, height=${height.toFixed(1)}`);

        // УВЕЛИЧИВАЕМ padding для центрирования
        const padding = Math.min(canvasWidth * 0.1, canvasHeight * 0.1); // 10% от canvas
       
        // Убедимся что данные поместятся с padding
        const availableWidth = canvasWidth - padding * 2;
        const availableHeight = canvasHeight - padding * 2;
       
        let scale = Math.min(
            availableWidth / Math.max(1, width),
            availableHeight / Math.max(1, height)
        );
       
        // Уменьшаем масштаб чтобы оставить место для панели
        scale = scale * 0.8;

        console.log(`📐 Масштабирование: scale=${scale.toFixed(4)}, padding=${padding}`);
        console.log(`🎯 Canvas: ${canvasWidth}x${canvasHeight}, доступно для данных: ${availableWidth.toFixed(0)}x${availableHeight.toFixed(0)}`);

        // ФИКС: Смещаем данные вниз для верхней панели
        const verticalOffset = 120; // Высота панели + отступ
       
        // Нормализуем узлы
        nodes.forEach(node => {
            if (node.center && node.center.x != null && node.center.y != null) {
                const x = padding + (node.center.x - minX) * scale;
                const y = verticalOffset + padding + (node.center.y - minY) * scale;

                console.log(`📍 Узел: ${node.center.x.toFixed(1)},${node.center.y.toFixed(1)} -> ${x.toFixed(1)},${y.toFixed(1)}`);

                if (x >= 0 && x <= canvasWidth && y >= 0 && y <= canvasHeight) {
                    normalizedNodes.set(node.id, {
                        ...node,
                        normalizedCenter: { x, y },
                        normalizedSize: Math.max(3, (node.size || 5) * scale * 0.1)
                    });
                } else {
                    console.log(`⚠️ Узел вне canvas: ${x.toFixed(1)},${y.toFixed(1)}`);
                }
            }
        });

        // Нормализуем контуры с тем же преобразованием
        const normalizedContours = contours.map(contour => {
            if (contour.points && contour.points.length > 0) {
                const normalizedPoints = contour.points.map(point => {
                    // Преобразуем абсолютные координаты если нужно
                    let x = point.x, y = point.y;
                    if (x > 1000 || y > 1000) {
                        x = x / 10;
                        y = y / 10;
                    }
                    return {
                        x: padding + (x - minX) * scale,
                        y: verticalOffset + padding + (y - minY) * scale
                    };
                });
               
                // Проверяем границы
                if (normalizedPoints.length > 0) {
                    const contourXs = normalizedPoints.map(p => p.x);
                    const contourYs = normalizedPoints.map(p => p.y);
                    const contourMinX = Math.min(...contourXs);
                    const contourMaxX = Math.max(...contourXs);
                    const contourMinY = Math.min(...contourYs);
                    const contourMaxY = Math.max(...contourYs);
                   
                    console.log(`🔵 Контур после нормализации: x=[${contourMinX.toFixed(1)}-${contourMaxX.toFixed(1)}], y=[${contourMinY.toFixed(1)}-${contourMaxY.toFixed(1)}]`);
                }
               
                return {
                    ...contour,
                    points: normalizedPoints
                };
            }
            return contour;
        });

        // Нормализуем каблуки с тем же преобразованием
        const normalizedHeels = heels.map(heel => {
            if (heel.points && heel.points.length > 0) {
                const normalizedPoints = heel.points.map(point => {
                    let x = point.x, y = point.y;
                    if (x > 1000 || y > 1000) {
                        x = x / 10;
                        y = y / 10;
                    }
                    return {
                        x: padding + (x - minX) * scale,
                        y: verticalOffset + padding + (y - minY) * scale
                    };
                });
               
                return {
                    ...heel,
                    points: normalizedPoints
                };
            }
            return heel;
        });

        console.log(`✅ Нормализация завершена: ${normalizedNodes.size} узлов, ${normalizedContours.length} контуров, ${normalizedHeels.length} каблуков`);
       
        return {
            nodes: normalizedNodes,
            contours: normalizedContours,
            heels: normalizedHeels
        };
    }

    drawContoursAndHeels(ctx, contours, heels) {
        console.log(`🎨 Рисую контуры: ${contours.length}, каблуков: ${heels.length}`);
       
        // Сначала рисуем заливку контуров
        contours.forEach((contour, index) => {
            console.log(`🔵 Контур ${index}: ${contour.points?.length || 0} точек`);
           
            if (contour.points && contour.points.length > 2) {
                // Проверяем координаты
                const firstPoint = contour.points[0];
                console.log(`📍 Первая точка контура: x=${firstPoint?.x?.toFixed(1) || 'N/A'}, y=${firstPoint?.y?.toFixed(1) || 'N/A'}`);
               
                // Полупрозрачная заливка контура
                ctx.fillStyle = 'rgba(0, 100, 255, 0.1)';
                ctx.beginPath();
                contour.points.forEach((point, pointIndex) => {
                    if (pointIndex === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                });
                ctx.closePath();
                ctx.fill();
               
                // Контур пунктиром
                ctx.strokeStyle = 'rgba(0, 100, 255, 0.5)';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 3]);

                ctx.beginPath();
                contour.points.forEach((point, pointIndex) => {
                    if (pointIndex === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                });
                ctx.closePath();
                ctx.stroke();

                ctx.setLineDash([]);
               
                // Рисуем точки контура для отладки (опционально)
                if (contour.points.length < 20) { // Только для не слишком больших контуров
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                    contour.points.forEach(point => {
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }
            } else {
                console.log(`⚠️ Контур ${index} не имеет достаточно точек: ${contour.points?.length || 0}`);
            }
        });

        // Рисуем каблуки
        heels.forEach((heel, index) => {
            console.log(`🔴 Каблук ${index}: ${heel.points?.length || 0} точек`);
           
            if (heel.points && heel.points.length > 2) {
                // Заливка каблука
                ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.lineWidth = 2;

                ctx.beginPath();
                heel.points.forEach((point, pointIndex) => {
                    if (pointIndex === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
               
                // Рисуем точки каблука (опционально)
                if (heel.points.length < 20) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
                    heel.points.forEach(point => {
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }
            } else {
                console.log(`⚠️ Каблук ${index} не имеет достаточно точек: ${heel.points?.length || 0}`);
            }
        });
    }

    drawEdges(ctx, normalizedNodes, edges) {
        if (!edges || edges.length === 0) return;

        // Сначала рисуем все связи тонкими
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.15)';
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

        // Затем рисуем уверенные связи толстыми
        ctx.strokeStyle = 'rgba(50, 150, 255, 0.6)';
        ctx.lineWidth = 3;

        edges.forEach(edge => {
            const fromNode = normalizedNodes.get(edge.from);
            const toNode = normalizedNodes.get(edge.to);

            if (fromNode && toNode &&
                fromNode.confidence > 0.8 && toNode.confidence > 0.8 &&
                fromNode.normalizedCenter && toNode.normalizedCenter) {

                ctx.beginPath();
                ctx.moveTo(fromNode.normalizedCenter.x, fromNode.normalizedCenter.y);
                ctx.lineTo(toNode.normalizedCenter.x, toNode.normalizedCenter.y);
                ctx.stroke();
            }
        });
    }

    drawNodes(ctx, normalizedNodes) {
        normalizedNodes.forEach((node, nodeId) => {
            if (!node.normalizedCenter) return;

            const { x, y } = node.normalizedCenter;
            const size = Math.max(3, node.normalizedSize || 5);

            let gradient;
            if (node.confidence > 0.8) {
                gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
                gradient.addColorStop(0, '#00ff00');
                gradient.addColorStop(1, '#009900');
            } else if (node.confidence > 0.5) {
                gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
                gradient.addColorStop(0, '#ffaa00');
                gradient.addColorStop(1, '#cc8800');
            } else {
                gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
                gradient.addColorStop(0, '#ff6666');
                gradient.addColorStop(1, '#cc4444');
            }

            // Узел с градиентом
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка узла
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Белая точка в центре для высокоуверенных узлов
            if (node.confidence > 0.8) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            // ID узла (опционально, для отладки)
            if (node.confidence > 0.9) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(nodeId.slice(-3), x, y + size + 10);
            }
        });
    }

    drawEnhancedInfoPanel(ctx, width, height, footprint, bestPhoto) {
        // Уменьшенная панель информации
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
       
        if (footprint.metadata) {
            if (footprint.metadata.estimatedSize) {
                ctx.fillText(`📏 Размер: ${footprint.metadata.estimatedSize}`, rightColX, 95);
            }
            if (footprint.metadata.footprintType && footprint.metadata.footprintType !== 'unknown') {
                ctx.fillText(`👟 Тип: ${footprint.metadata.footprintType}`, rightColX, 115);
            }
        }
    }

    drawLegend(ctx, width, height) {
        const legendX = width - 220;
        const legendY = height - 200;
        const legendWidth = 200;
        const legendHeight = 180;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🎯 ЛЕГЕНДА', legendX + 10, legendY + 25);

        ctx.font = '14px Arial';

        // Высокая уверенность
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(legendX + 15, legendY + 50, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Высокая уверенность', legendX + 30, legendY + 55);

        // Средняя уверенность
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(legendX + 15, legendY + 80, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Средняя уверенность', legendX + 30, legendY + 85);

        // Низкая уверенность
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.arc(legendX + 15, legendY + 110, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Низкая уверенность', legendX + 30, legendY + 115);

        // Связи
        ctx.strokeStyle = 'rgba(50, 150, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(legendX + 10, legendY + 135);
        ctx.lineTo(legendX + 40, legendY + 135);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Связи протектора', legendX + 50, legendY + 140);

        // Контуры
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(legendX + 10, legendY + 160);
        ctx.lineTo(legendX + 40, legendY + 160);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Контуры следа', legendX + 50, legendY + 165);
    }

    drawComparisonRecommendations(ctx, width, height, comparison, mirrorAnalysis) {
        const recX = 800;
        const recY = 770;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(recX, recY - 100, width - 850, 120);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('💡 РЕКОМЕНДАЦИИ:', recX + 20, recY - 70);

        ctx.font = '14px Arial';
        const score = comparison.score || 0;

        if (score > 0.85) {
            ctx.fillStyle = '#00cc00';
            ctx.fillText('🔴 ВЫСОКАЯ ВЕРОЯТНОСТЬ - это одна и та же обувь', recX + 40, recY - 45);
            ctx.fillText('Рекомендуется объединить модели', recX + 40, recY - 20);
        } else if (score > 0.7) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillText('🟡 СРЕДНЯЯ ВЕРОЯТНОСТЬ - похожие протекторы', recX + 40, recY - 45);
            ctx.fillText('Нужны дополнительные фото для уверенности', recX + 40, recY - 20);
        } else if (score > 0.5) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillText('🟡 НИЗКАЯ ВЕРОЯТНОСТЬ - возможно один тип', recX + 40, recY - 45);
            ctx.fillText('Разные модели, но возможно один производитель', recX + 40, recY - 20);
        } else {
            ctx.fillStyle = '#ff4444';
            ctx.fillText('🟢 ОЧЕНЬ НИЗКАЯ ВЕРОЯТНОСТЬ - разные протекторы', recX + 40, recY - 45);
            ctx.fillText('Совпадения случайны', recX + 40, recY - 20);
        }

        if (mirrorAnalysis && mirrorAnalysis.isMirrored) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillText('🪞 Учтите зеркальность при сравнении!', recX + 40, recY + 5);
        }
    }
}

module.exports = EnhancedModelVisualizer;
