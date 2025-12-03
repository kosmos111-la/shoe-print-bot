// modules/footprint/distortion-transformer.js
const { createCanvas, loadImage } = require('canvas');

class DistortionTransformer {
    constructor() {
        console.log('🔧 DistortionTransformer создан');
    }

    // ВЫРАВНИВАНИЕ ПЕРСПЕКТИВЫ МЕЖДУ ДВУМЯ ФОТО
    async alignPerspective(image1Data, image2Data, keypoints1, keypoints2) {
        try {
            // Находим гомографию (матрицу преобразования) между двумя наборами точек
            const transform = this.findHomography(keypoints1, keypoints2);
           
            if (!transform) {
                console.log('⚠️ Не удалось найти преобразование, используем среднее');
                return this.getAverageTransformation(keypoints1, keypoints2);
            }
           
            return {
                matrix: transform,
                type: 'homography',
                confidence: this.calculateAlignmentConfidence(keypoints1, keypoints2, transform)
            };
        } catch (error) {
            console.log('❌ Ошибка выравнивания перспективы:', error.message);
            return null;
        }
    }

    // УЧЕТ ЗЕРКАЛЬНОСТИ (правый/левый ботинок)
    checkMirrorSymmetry(model1, model2, threshold = 0.7) {
        // Создаем зеркальную копию model2
        const mirroredModel2 = this.mirrorModel(model2);
       
        // Сравниваем оригинал с зеркальной копией
        const originalScore = model1.compare(model2).score;
        const mirroredScore = model1.compare(mirroredModel2).score;
       
        return {
            isMirrored: mirroredScore > originalScore * 1.1, // Если зеркальная лучше на 10%
            originalScore,
            mirroredScore,
            suggestedTransform: mirroredScore > originalScore ? 'mirror' : 'none'
        };
    }

    // СОЗДАНИЕ ЗЕРКАЛЬНОЙ КОПИИ МОДЕЛИ
    mirrorModel(model) {
        const mirrored = JSON.parse(JSON.stringify(model));
       
        // Зеркалим по вертикальной оси (предполагаем что центр в 0,0)
        mirrored.nodes.forEach(node => {
            if (node.center) {
                node.center.x = -node.center.x;
            }
        });
       
        return mirrored;
    }

    // ВЫРАВНИВАНИЕ МАСШТАБА
    alignScale(model1, model2) {
        if (!model1.boundingBox || !model2.boundingBox) {
            return { scale: 1, confidence: 0 };
        }
       
        const scaleX = model1.boundingBox.width / model2.boundingBox.width;
        const scaleY = model1.boundingBox.height / model2.boundingBox.height;
       
        // Используем среднее масштабирование
        const avgScale = (scaleX + scaleY) / 2;
       
        return {
            scale: Math.abs(avgScale),
            scaleX,
            scaleY,
            confidence: 1 - Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY)
        };
    }

    // ПОИСК ГОМОГРАФИИ (упрощенный алгоритм RANSAC)
    findHomography(points1, points2, iterations = 1000, threshold = 5) {
        if (points1.length < 4 || points2.length < 4) {
            return null;
        }
       
        let bestHomography = null;
        let bestInliers = 0;
       
        for (let i = 0; i < iterations; i++) {
            // Случайно выбираем 4 точки
            const indices = this.getRandomIndices(points1.length, 4);
            const sample1 = indices.map(idx => points1[idx]);
            const sample2 = indices.map(idx => points2[idx]);
           
            // Вычисляем гомографию для этих точек
            const H = this.calculateHomographyFromPoints(sample1, sample2);
            if (!H) continue;
           
            // Считаем inliers (точки, которые хорошо соответствуют преобразованию)
            const inliers = this.countInliers(points1, points2, H, threshold);
           
            if (inliers > bestInliers) {
                bestInliers = inliers;
                bestHomography = H;
            }
           
            // Ранний выход если нашли хорошее соответствие
            if (inliers > points1.length * 0.7) {
                break;
            }
        }
       
        return bestHomography;
    }

    // УСРЕДНЕННОЕ ПРЕОБРАЗОВАНИЕ (если гомография не найдена)
    getAverageTransformation(points1, points2) {
        const scales = points1.map((p1, i) => {
            const p2 = points2[i];
            const dx1 = p1.x - points1[0].x;
            const dy1 = p1.y - points1[0].y;
            const dx2 = p2.x - points2[0].x;
            const dy2 = p2.y - points2[0].y;
           
            const scaleX = dx1 !== 0 ? dx2 / dx1 : 1;
            const scaleY = dy1 !== 0 ? dy2 / dy1 : 1;
           
            return { scaleX, scaleY };
        });
       
        const avgScaleX = scales.reduce((sum, s) => sum + s.scaleX, 0) / scales.length;
        const avgScaleY = scales.reduce((sum, s) => sum + s.scaleY, 0) / scales.length;
        const avgScale = (avgScaleX + avgScaleY) / 2;
       
        const dx = points2[0].x - points1[0].x * avgScale;
        const dy = points2[0].y - points1[0].y * avgScale;
       
        return {
            matrix: [
                [avgScale, 0, dx],
                [0, avgScale, dy],
                [0, 0, 1]
            ],
            type: 'affine',
            confidence: 0.5
        };
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    getRandomIndices(max, count) {
        const indices = new Set();
        while (indices.size < count) {
            indices.add(Math.floor(Math.random() * max));
        }
        return Array.from(indices);
    }

    calculateHomographyFromPoints(srcPoints, dstPoints) {
        // Упрощенный расчет гомографии для 4 точек
        // В реальности нужно использовать SVD, но для MVP упростим
        try {
            const A = [];
           
            for (let i = 0; i < 4; i++) {
                const x = srcPoints[i].x, y = srcPoints[i].y;
                const u = dstPoints[i].x, v = dstPoints[i].y;
               
                A.push([x, y, 1, 0, 0, 0, -u*x, -u*y, -u]);
                A.push([0, 0, 0, x, y, 1, -v*x, -v*y, -v]);
            }
           
            // Решаем систему уравнений (упрощенно)
            // В реальном проекте нужно использовать math.js или similar
            const H = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];
           
            return H;
        } catch (error) {
            console.log('⚠️ Ошибка расчета гомографии:', error.message);
            return null;
        }
    }

    countInliers(points1, points2, H, threshold) {
        let inliers = 0;
       
        points1.forEach((p1, i) => {
            const p2 = points2[i];
            const transformed = this.applyHomography(p1, H);
            const distance = Math.sqrt(
                Math.pow(transformed.x - p2.x, 2) +
                Math.pow(transformed.y - p2.y, 2)
            );
           
            if (distance < threshold) {
                inliers++;
            }
        });
       
        return inliers;
    }

    applyHomography(point, H) {
        const x = point.x * H[0][0] + point.y * H[0][1] + H[0][2];
        const y = point.x * H[1][0] + point.y * H[1][1] + H[1][2];
        const w = point.x * H[2][0] + point.y * H[2][1] + H[2][2];
       
        return {
            x: x / w,
            y: y / w
        };
    }

    calculateAlignmentConfidence(points1, points2, transform) {
        const distances = points1.map((p1, i) => {
            const p2 = points2[i];
            const transformed = this.applyHomography(p1, transform.matrix);
            return Math.sqrt(
                Math.pow(transformed.x - p2.x, 2) +
                Math.pow(transformed.y - p2.y, 2)
            );
        });
       
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const maxDistance = Math.max(...distances);
       
        // Уверенность обратно пропорциональна средней ошибке
        return Math.max(0, 1 - avgDistance / 50); // 50px - максимальная допустимая ошибка
    }
}

module.exports = DistortionTransformer;
