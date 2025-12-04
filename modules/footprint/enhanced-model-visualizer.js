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

            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            if (bestPhoto && bestPhoto.image) {
                await this.drawPhotoUnderlay(ctx, bestPhoto.image, canvasWidth, canvasHeight);
            }

            const normalizedData = await this.normalizeAndAlignData(footprint, canvasWidth, canvasHeight);
           
            this.drawContoursAndHeels(ctx, normalizedData.contours, normalizedData.heels);
            this.drawEdges(ctx, normalizedData.nodes, footprint.edges);
            this.drawNodes(ctx, normalizedData.nodes);
            this.drawEnhancedInfoPanel(ctx, canvasWidth, canvasHeight, footprint, bestPhoto);
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
            console.log('❌ Ошибка улучшенной визуализации:', error.message);
            return null;
        }
    }

    async findBestPhotoForModel(footprint) {
        try {
            const photoSources = [];
           
            footprint.nodes.forEach(node => {
                if (node.sources && Array.isArray(node.sources)) {
                    node.sources.forEach(source => {
                        if (source.photoPath || source.localPath) {
                            photoSources.push({
                                path: source.photoPath || source.localPath,
                                confidence: node.confidence,
                                nodeCount: 1
                            });
                        }
                    });
                }
            });

            if (photoSources.length === 0) {
                return null;
            }

            const photoStats = {};
            photoSources.forEach(photo => {
                if (!photoStats[photo.path]) {
                    photoStats[photo.path] = {
                        path: photo.path,
                        totalConfidence: 0,
                        nodeCount: 0,
                        uniqueNodes: new Set()
                    };
                }
                photoStats[photo.path].totalConfidence += photo.confidence;
                photoStats[photo.path].nodeCount += photo.nodeCount;
            });

            let bestPhoto = null;
            let bestScore = -1;

            Object.values(photoStats).forEach(stats => {
                const score = stats.totalConfidence * Math.log(stats.nodeCount + 1);
                if (score > bestScore) {
                    bestScore = score;
                    bestPhoto = stats;
                }
            });

            if (!bestPhoto || !fs.existsSync(bestPhoto.path)) {
                return null;
            }

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
            const scale = Math.min(
                canvasWidth * 0.8 / image.width,
                canvasHeight * 0.7 / image.height
            );
           
            const width = image.width * scale;
            const height = image.height * scale;
            const x = (canvasWidth - width) / 2;
            const y = (canvasHeight - height) / 2;
           
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(x - 10, y - 10, width + 20, height + 20);
           
            ctx.globalAlpha = 0.15;
            ctx.drawImage(image, x, y, width, height);
            ctx.globalAlpha = 1.0;
           
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
           
        } catch (error) {
            console.log('⚠️ Не удалось нарисовать фото-подложку:', error.message);
        }
    }

    async normalizeAndAlignData(footprint, canvasWidth, canvasHeight) {
        const nodes = Array.from(footprint.nodes.values());
        const normalizedNodes = new Map();
        const contours = [];
        const heels = [];
       
        nodes.forEach(node => {
            if (node.sources && node.sources.length > 0) {
                node.sources.forEach(source => {
                    if (source.contour) contours.push(source.contour);
                    if (source.heel) heels.push(source.heel);
                });
            }
        });
       
        if (footprint.boundingBox && footprint.boundingBox.width > 0) {
            const { minX, maxX, minY, maxY, width, height } = footprint.boundingBox;
            const padding = 100;
            const scale = Math.min(
                (canvasWidth - padding * 2) / Math.max(1, width),
                (canvasHeight - padding * 2) / Math.max(1, height)
            );
           
            nodes.forEach(node => {
                if (node.center && node.center.x != null && node.center.y != null) {
                    const x = padding + (node.center.x - minX) * scale;
                    const y = padding + (node.center.y - minY) * scale;
                   
                    if (x >= 0 && x <= canvasWidth && y >= 0 && y <= canvasHeight) {
                        normalizedNodes.set(node.id, {
                            ...node,
                            normalizedCenter: { x, y },
                            normalizedSize: Math.max(2, (node.size || 5) * scale * 0.08)
                        });
                    }
                }
            });
        }
       
        return { nodes: normalizedNodes, contours, heels };
    }

    drawContoursAndHeels(ctx, contours, heels) {
        contours.forEach(contour => {
            if (contour.points && contour.points.length > 2) {
                ctx.strokeStyle = 'rgba(0, 100, 255, 0.3)';
                ctx.lineWidth = 2;
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
       
        heels.forEach(heel => {
            if (heel.points && heel.points.length > 2) {
                ctx.fillStyle = 'rgba(255, 50, 50, 0.2)';
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                ctx.lineWidth = 1;
               
                ctx.beginPath();
                heel.points.forEach((point, index) => {
                    if (index === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        });
    }

    drawEdges(ctx, normalizedNodes, edges) {
        if (!edges || edges.length === 0) return;
       
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
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
           
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
           
            if (node.confidence > 0.8) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    drawEnhancedInfoPanel(ctx, width, height, footprint, bestPhoto) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(20, 20, width - 40, 160);
       
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, width - 40, 160);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`👣 ЦИФРОВОЙ ОТПЕЧАТОК: ${footprint.name || 'Без имени'}`, 40, 55);
       
        ctx.font = '16px Arial';
        ctx.fillText(`🆔 ID: ${footprint.id.slice(0, 12)}...`, 40, 85);
        ctx.fillText(`📊 Узлов протектора: ${footprint.nodes.size}`, 40, 110);
        ctx.fillText(`🔗 Топологических связей: ${footprint.edges.length}`, 40, 135);
        ctx.fillText(`💎 Общая уверенность: ${Math.round((footprint.stats.confidence || 0.5) * 100)}%`, 40, 160);
       
        if (bestPhoto) {
            ctx.fillText(`📸 Лучшее фото: ${bestPhoto.nodeCount} узлов, ${Math.round(bestPhoto.totalConfidence * 100)}% уверенность`, 40, 185);
        }
       
        if (footprint.metadata) {
            let metaY = 210;
            if (footprint.metadata.estimatedSize) {
                ctx.fillText(`📏 Примерный размер: ${footprint.metadata.estimatedSize}`, width - 300, 85);
                metaY += 25;
            }
            if (footprint.metadata.footprintType && footprint.metadata.footprintType !== 'unknown') {
                ctx.fillText(`👟 Тип: ${footprint.metadata.footprintType}`, width - 300, 110);
                metaY += 25;
            }
            if (footprint.metadata.orientation) {
                ctx.fillText(`🧭 Ориентация: ${footprint.metadata.orientation}°`, width - 300, 135);
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
       
        ctx.strokeStyle = 'rgba(50, 150, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(legendX + 10, legendY + 135);
        ctx.lineTo(legendX + 40, legendY + 135);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Связи протектора', legendX + 50, legendY + 140);
       
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.3)';
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
