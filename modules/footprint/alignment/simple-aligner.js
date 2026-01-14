// modules/footprint/alignment/simple-aligner.js
// 🔥 ПРОСТОЕ ВЫРАВНИВАНИЕ СЛЕДОВ К ОДНОЙ СИСТЕМЕ КООРДИНАТ

const fs = require('fs');
const path = require('path');

class SimpleAligner {
    constructor(options = {}) {
        this.config = {
            debug: options.debug || true,
            visualizationDir: options.visualizationDir || './data/alignments',
            maxAlignmentError: options.maxAlignmentError || 50, // px
            minMatchesForAlignment: options.minMatchesForAlignment || 3,
            ...options
        };

        // Создаем директорию для визуализаций
        if (!fs.existsSync(this.config.visualizationDir)) {
            fs.mkdirSync(this.config.visualizationDir, { recursive: true });
        }

        console.log('🎯 SimpleAligner создан (базовое выравнивание)');
    }

    // 🔥 ОСНОВНОЙ МЕТОД: Выровнять второй след относительно первого
    alignToReference(sourcePoints, referencePoints, sourceTransformation = null, referenceTransformation = null) {
        console.log(`🎯 Выравниваю ${sourcePoints.length} точек к ${referencePoints.length} точкам эталона`);

        // 1. Если есть трансформации - показываем их
        if (sourceTransformation) {
            console.log(`📐 Трансформация исходного следа:`);
            console.log(`   Поворот: ${sourceTransformation.rotationAngle?.toFixed(1)}°`);
            console.log(`   Центр: (${sourceTransformation.center?.x?.toFixed(1)}, ${sourceTransformation.center?.y?.toFixed(1)})`);
        }

        if (referenceTransformation) {
            console.log(`📐 Трансформация эталона:`);
            console.log(`   Поворот: ${referenceTransformation.rotationAngle?.toFixed(1)}°`);
            console.log(`   Центр: (${referenceTransformation.center?.x?.toFixed(1)}, ${referenceTransformation.center?.y?.toFixed(1)})`);
        }

        // 2. 🔥 ПРОСТОЙ ПОДХОД: Центрирование + масштабирование
        const alignedPoints = this.simpleCenterAndScale(sourcePoints, referencePoints);

        // 3. Дебаг: показываем разницу до/после
        this.debugAlignment(sourcePoints, alignedPoints, referencePoints);

        // 4. Визуализируем выравнивание
        this.visualizeAlignment(sourcePoints, alignedPoints, referencePoints);

        return alignedPoints;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Центрирование с сохранением пропорций
    simpleCenterAndScale(sourcePoints, referencePoints, sourceTransformation = null) {
        console.log('🔄 Интеллектуальное центрирование и масштабирование...');

        // 1. Проверяем, нужно ли корректировать ориентацию
        const needsOrientationCorrection = this.checkOrientationMismatch(sourcePoints, referencePoints);

        if (needsOrientationCorrection) {
            console.log('🔄 Обнаружено несоответствие ориентации, применяю коррекцию...');
            sourcePoints = this.correctOrientation(sourcePoints, referencePoints);
        }

        // 2. Вычисляем масштаб на основе МЕДИАНЫ расстояний
        const scale = this.calculateRobustScale(sourcePoints, referencePoints);
        console.log(`📐 Умный масштаб: ${scale.toFixed(3)}`);

        // 3. Вычисляем сдвиг с помощью RANSAC
        const translation = this.findBestTranslation(sourcePoints, referencePoints, scale);
        console.log(`📐 Оптимальный сдвиг: (${translation.x.toFixed(1)}, ${translation.y.toFixed(1)})`);

        // 4. Применяем трансформацию
        const alignedPoints = sourcePoints.map(point => {
            // Масштабируем
            let x = point.x * scale;
            let y = point.y * scale;

            // Сдвигаем
            x += translation.x;
            y += translation.y;

            return {
                ...point,
                x: x,
                y: y,
                aligned: true,
                originalX: point.x,
                originalY: point.y,
                scaleApplied: scale,
                translationApplied: translation
            };
        });

        // 5. Валидация
        const alignmentError = this.calculateAlignmentError(alignedPoints, referencePoints);
        console.log(`🎯 Ошибка выравнивания: ${alignmentError.toFixed(1)}px`);

        if (alignmentError > 50) {
            console.log('⚠️ Высокая ошибка выравнивания, пытаюсь найти лучшую трансформацию...');
            return this.fallbackAlignment(sourcePoints, referencePoints);
        }

        console.log(`✅ Преобразовано ${alignedPoints.length} точек`);
        return alignedPoints;
    }

    // 🔥 НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    checkOrientationMismatch(sourcePoints, referencePoints) {
        const sourceBounds = this.calculateBounds(sourcePoints);
        const referenceBounds = this.calculateBounds(referencePoints);

        const sourceRatio = sourceBounds.width / Math.max(1, sourceBounds.height);
        const referenceRatio = referenceBounds.width / Math.max(1, referenceBounds.height);

        const ratioDiff = Math.abs(sourceRatio - referenceRatio);
       
        // Если соотношение сторон сильно отличается (вертикальное vs горизонтальное)
        const needsCorrection = (sourceRatio > 2.0 && referenceRatio < 0.5) ||
                               (sourceRatio < 0.5 && referenceRatio > 2.0) ||
                               ratioDiff > 2.0;

        console.log(`📏 Пропорции: источник ${sourceRatio.toFixed(2)} vs эталон ${referenceRatio.toFixed(2)} -> ${needsCorrection ? 'НУЖНА коррекция' : 'OK'}`);

        return needsCorrection;
    }

    correctOrientation(sourcePoints, referencePoints) {
        console.log('🔄 Коррекция ориентации (поворот на 90°)...');
       
        const center = this.calculateCenter(sourcePoints);
       
        // Поворачиваем точки на 90° вокруг центра
        const rotatedPoints = sourcePoints.map(point => {
            // Сдвигаем к центру
            let x = point.x - center.x;
            let y = point.y - center.y;
           
            // Поворачиваем на 90°
            const rotatedX = -y;  // x' = -y
            const rotatedY = x;   // y' = x
           
            // Возвращаем обратно
            return {
                ...point,
                x: rotatedX + center.x,
                y: rotatedY + center.y,
                orientationCorrected: true
            };
        });
       
        return rotatedPoints;
    }

    calculateRobustScale(sourcePoints, referencePoints) {
        if (sourcePoints.length < 3 || referencePoints.length < 3) {
            console.log('⚠️ Мало точек для точного масштабирования, использую простой метод');
            return this.calculateSimpleScale(sourcePoints, referencePoints);
        }

        // Используем медиану расстояний для устойчивости к выбросам
        const sourceDistances = this.calculatePairwiseDistances(sourcePoints);
        const referenceDistances = this.calculatePairwiseDistances(referencePoints);

        if (sourceDistances.length === 0 || referenceDistances.length === 0) {
            return 1.0;
        }

        const medianSource = this.median(sourceDistances);
        const medianReference = this.median(referenceDistances);

        const scale = medianReference / Math.max(1, medianSource);
       
        // Ограничиваем масштаб разумными пределами
        return Math.max(0.1, Math.min(10.0, scale));
    }

    calculatePairwiseDistances(points) {
        const distances = [];
       
        for (let i = 0; i < Math.min(points.length, 20); i++) {
            for (let j = i + 1; j < Math.min(points.length, 20); j++) {
                const distance = Math.sqrt(
                    Math.pow(points[j].x - points[i].x, 2) +
                    Math.pow(points[j].y - points[i].y, 2)
                );
                if (distance > 0) {
                    distances.push(distance);
                }
            }
        }
       
        return distances;
    }

    median(values) {
        if (values.length === 0) return 0;
       
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
       
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }
       
        return sorted[middle];
    }

    calculateSimpleScale(sourcePoints, referencePoints) {
        const sourceBounds = this.calculateBounds(sourcePoints);
        const referenceBounds = this.calculateBounds(referencePoints);

        const scaleX = referenceBounds.width / Math.max(1, sourceBounds.width);
        const scaleY = referenceBounds.height / Math.max(1, sourceBounds.height);
       
        // Используем среднее геометрическое для сохранения пропорций
        const scale = Math.sqrt(scaleX * scaleY);
       
        console.log(`📐 Простой масштаб: ${scale.toFixed(3)} (X: ${scaleX.toFixed(3)}, Y: ${scaleY.toFixed(3)})`);
       
        return scale;
    }

    findBestTranslation(sourcePoints, referencePoints, scale) {
        if (sourcePoints.length === 0 || referencePoints.length === 0) {
            return { x: 0, y: 0 };
        }

        // Простой RANSAC для поиска наилучшего сдвига
        const bestTranslation = { x: 0, y: 0 };
        let bestScore = -Infinity;

        // Пробуем несколько возможных сдвигов
        const numIterations = Math.min(50, sourcePoints.length * referencePoints.length);
       
        for (let iter = 0; iter < numIterations; iter++) {
            // Выбираем случайные точки для оценки
            const sourceIdx = Math.floor(Math.random() * sourcePoints.length);
            const referenceIdx = Math.floor(Math.random() * referencePoints.length);
           
            const sourcePoint = sourcePoints[sourceIdx];
            const referencePoint = referencePoints[referenceIdx];
           
            // Вычисляем потенциальный сдвиг
            const tx = referencePoint.x - (sourcePoint.x * scale);
            const ty = referencePoint.y - (sourcePoint.y * scale);
           
            // Оцениваем качество этого сдвига
            let score = 0;
            let count = 0;
           
            for (let i = 0; i < Math.min(10, sourcePoints.length); i++) {
                const sp = sourcePoints[i];
                const targetX = sp.x * scale + tx;
                const targetY = sp.y * scale + ty;
               
                // Ищем ближайшую точку эталона
                let minDist = Infinity;
                for (let j = 0; j < Math.min(10, referencePoints.length); j++) {
                    const rp = referencePoints[j];
                    const dist = Math.sqrt(
                        Math.pow(rp.x - targetX, 2) +
                        Math.pow(rp.y - targetY, 2)
                    );
                    minDist = Math.min(minDist, dist);
                }
               
                score += Math.max(0, 100 - minDist);
                count++;
            }
           
            if (count > 0) {
                score /= count;
               
                if (score > bestScore) {
                    bestScore = score;
                    bestTranslation.x = tx;
                    bestTranslation.y = ty;
                }
            }
        }

        return bestTranslation;
    }

    calculateAlignmentError(alignedPoints, referencePoints) {
        if (alignedPoints.length === 0 || referencePoints.length === 0) {
            return 1000; // Большая ошибка если нет точек
        }

        let totalError = 0;
        let count = 0;

        for (const alignedPoint of alignedPoints) {
            let minDist = Infinity;
           
            for (const referencePoint of referencePoints) {
                const dist = Math.sqrt(
                    Math.pow(referencePoint.x - alignedPoint.x, 2) +
                    Math.pow(referencePoint.y - alignedPoint.y, 2)
                );
                minDist = Math.min(minDist, dist);
            }
           
            if (minDist < Infinity) {
                totalError += minDist;
                count++;
            }
        }

        return count > 0 ? totalError / count : 1000;
    }

    fallbackAlignment(sourcePoints, referencePoints) {
        console.log('🔄 Использую фоллбэк-выравнивание...');
       
        // Простой фоллбэк: центрирование без масштабирования
        const sourceCenter = this.calculateCenter(sourcePoints);
        const referenceCenter = this.calculateCenter(referencePoints);
       
        const translation = {
            x: referenceCenter.x - sourceCenter.x,
            y: referenceCenter.y - sourceCenter.y
        };
       
        const alignedPoints = sourcePoints.map(point => ({
            ...point,
            x: point.x + translation.x,
            y: point.y + translation.y,
            aligned: true,
            translationApplied: translation,
            fallback: true
        }));
       
        return alignedPoints;
    }

    // 🔥 ДЕБАГ ВЫРАВНИВАНИЯ
    debugAlignment(originalPoints, alignedPoints, referencePoints) {
        console.log('\n🔍 ДЕБАГ ВЫРАВНИВАНИЯ:');

        // Показываем первые 3 точки
        for (let i = 0; i < Math.min(3, originalPoints.length); i++) {
            const orig = originalPoints[i];
            const aligned = alignedPoints[i];
            const nearestRef = this.findNearestPoint(aligned, referencePoints);

            console.log(`   Точка ${i + 1}:`);
            console.log(`     Было: (${orig.x.toFixed(1)}, ${orig.y.toFixed(1)})`);
            console.log(`     Стало: (${aligned.x.toFixed(1)}, ${aligned.y.toFixed(1)})`);

            if (nearestRef) {
                const distance = Math.sqrt(
                    Math.pow(aligned.x - nearestRef.x, 2) +
                    Math.pow(aligned.y - nearestRef.y, 2)
                );
                console.log(`     Ближайшая точка эталона: (${nearestRef.x.toFixed(1)}, ${nearestRef.y.toFixed(1)})`);
                console.log(`     Расстояние: ${distance.toFixed(1)}px`);
            }
        }

        // Статистика расстояний
        const distances = [];
        alignedPoints.forEach(aligned => {
            const nearest = this.findNearestPoint(aligned, referencePoints);
            if (nearest) {
                const distance = Math.sqrt(
                    Math.pow(aligned.x - nearest.x, 2) +
                    Math.pow(aligned.y - nearest.y, 2)
                );
                distances.push(distance);
            }
        });

        if (distances.length > 0) {
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            const maxDistance = Math.max(...distances);
            const minDistance = Math.min(...distances);

            console.log(`\n📊 СТАТИСТИКА РАССТОЯНИЙ:`);
            console.log(`   Среднее: ${avgDistance.toFixed(1)}px`);
            console.log(`   Максимальное: ${maxDistance.toFixed(1)}px`);
            console.log(`   Минимальное: ${minDistance.toFixed(1)}px`);
            console.log(`   <25px: ${distances.filter(d => d < 25).length} точек`);
            console.log(`   <50px: ${distances.filter(d => d < 50).length} точек`);
        }
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ ВЫРАВНИВАНИЯ (простая текстовая)
    visualizeAlignment(originalPoints, alignedPoints, referencePoints) {
        try {
            const canvas = require('canvas');
            this.createCanvasVisualization(originalPoints, alignedPoints, referencePoints);
        } catch (error) {
            console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
            this.createTextAlignmentReport(originalPoints, alignedPoints, referencePoints);
        }
    }

    // 🔥 СОЗДАНИЕ CANVIS ВИЗУАЛИЗАЦИИ
    createCanvasVisualization(originalPoints, alignedPoints, referencePoints) {
        const canvas = require('canvas');
        const width = 1200;
        const height = 800;

        const canvasInstance = canvas.createCanvas(width, height);
        const ctx = canvasInstance.getContext('2d');

        // 1. Фон
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // 2. Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎯 ВЫРАВНИВАНИЕ СЛЕДОВ', width / 2, 40);

        // 3. Легенда
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';

        // Точки эталона (красные)
        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(100, 70, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#212529';
        ctx.fillText('Эталон (красные)', 120, 75);

        // Исходные точки (синие)
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(100, 100, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#212529';
        ctx.fillText('Исходные (синие)', 120, 105);

        // Выровненные точки (зеленые)
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(100, 130, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#212529';
        ctx.fillText('Выровненные (зеленые)', 120, 135);

        // 4. Масштабирование точек
        const allPoints = [...referencePoints, ...originalPoints, ...alignedPoints];
        const bounds = this.calculateBounds(allPoints);

        const scaleX = (width * 0.8) / Math.max(1, bounds.width);
        const scaleY = (height * 0.6) / Math.max(1, bounds.height);
        const scale = Math.min(scaleX, scaleY, 5);

        const centerX = width / 2;
        const centerY = height * 0.6;

        // 5. Рисуем точки эталона (красные)
        referencePoints.forEach(point => {
            const x = centerX + (point.x - bounds.centerX) * scale;
            const y = centerY + (point.y - bounds.centerY) * scale;

            ctx.fillStyle = '#FF5252';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        });

        // 6. Рисуем исходные точки (синие)
        originalPoints.forEach(point => {
            const x = centerX + (point.x - bounds.centerX) * scale;
            const y = centerY + (point.y - bounds.centerY) * scale;

            ctx.fillStyle = '#2196F3';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // 7. Рисуем выровненные точки (зеленые)
        alignedPoints.forEach(point => {
            const x = centerX + (point.x - bounds.centerX) * scale;
            const y = centerY + (point.y - bounds.centerY) * scale;

            ctx.fillStyle = '#4CAF50';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Линия от исходной к выровненной (для первых 10 точек)
            const origIndex = alignedPoints.indexOf(point);
            if (origIndex < 10 && origIndex < originalPoints.length) {
                const origPoint = originalPoints[origIndex];
                const origX = centerX + (origPoint.x - bounds.centerX) * scale;
                const origY = centerY + (origPoint.y - bounds.centerY) * scale;

                ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(origX, origY);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        });

        // 8. Сохраняем изображение
        const timestamp = Date.now();
        const filename = `alignment_${timestamp}.png`;
        const filepath = path.join(this.config.visualizationDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filepath);
            const stream = canvasInstance.createPNGStream();

            stream.pipe(out);

            out.on('finish', () => {
                console.log(`✅ Визуализация выравнивания сохранена: ${filepath}`);
                resolve(filepath);
            });

            out.on('error', reject);
        });
    }

    // 🔥 ТЕКСТОВЫЙ ОТЧЕТ ВЫРАВНИВАНИЯ
    createTextAlignmentReport(originalPoints, alignedPoints, referencePoints) {
        const timestamp = Date.now();
        const filename = `alignment_report_${timestamp}.txt`;
        const filepath = path.join(this.config.visualizationDir, filename);

        let report = '🎯 ОТЧЕТ О ВЫРАВНИВАНИИ СЛЕДОВ\n';
        report += '═'.repeat(50) + '\n\n';

        // Информация о точках
        report += `📊 ИНФОРМАЦИЯ О ТОЧКАХ:\n`;
        report += `├─ Эталонных точек: ${referencePoints.length}\n`;
        report += `├─ Исходных точек: ${originalPoints.length}\n`;
        report += `└─ Выровненных точек: ${alignedPoints.length}\n\n`;

        // Центры масс
        const refCenter = this.calculateCenter(referencePoints);
        const origCenter = this.calculateCenter(originalPoints);
        const alignedCenter = this.calculateCenter(alignedPoints);

        report += `📐 ЦЕНТРЫ МАСС:\n`;
        report += `├─ Эталон: (${refCenter.x.toFixed(1)}, ${refCenter.y.toFixed(1)})\n`;
        report += `├─ Исходный: (${origCenter.x.toFixed(1)}, ${origCenter.y.toFixed(1)})\n`;
        report += `└─ Выровненный: (${alignedCenter.x.toFixed(1)}, ${alignedCenter.y.toFixed(1)})\n\n`;

        // Размеры
        const refBounds = this.calculateBounds(referencePoints);
        const origBounds = this.calculateBounds(originalPoints);
        const alignedBounds = this.calculateBounds(alignedPoints);

        report += `📏 РАЗМЕРЫ (bounding boxes):\n`;
        report += `├─ Эталон: ${refBounds.width.toFixed(1)}x${refBounds.height.toFixed(1)}\n`;
        report += `├─ Исходный: ${origBounds.width.toFixed(1)}x${origBounds.height.toFixed(1)}\n`;
        report += `└─ Выровненный: ${alignedBounds.width.toFixed(1)}x${alignedBounds.height.toFixed(1)}\n\n`;

        // Статистика расстояний
        const distances = [];
        alignedPoints.forEach(aligned => {
            const nearest = this.findNearestPoint(aligned, referencePoints);
            if (nearest) {
                const distance = Math.sqrt(
                    Math.pow(aligned.x - nearest.x, 2) +
                    Math.pow(aligned.y - nearest.y, 2)
                );
                distances.push(distance);
            }
        });

        if (distances.length > 0) {
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            const maxDistance = Math.max(...distances);
            const minDistance = Math.min(...distances);

            report += `📊 СТАТИСТИКА РАССТОЯНИЙ ДО ЭТАЛОНА:\n`;
            report += `├─ Среднее: ${avgDistance.toFixed(1)}px\n`;
            report += `├─ Максимальное: ${maxDistance.toFixed(1)}px\n`;
            report += `├─ Минимальное: ${minDistance.toFixed(1)}px\n`;
            report += `├─ <10px: ${distances.filter(d => d < 10).length} точек\n`;
            report += `├─ <25px: ${distances.filter(d => d < 25).length} точек\n`;
            report += `└─ <50px: ${distances.filter(d => d < 50).length} точек\n\n`;
        }

        // Примеры точек (первые 5)
        report += `🔍 ПРИМЕРЫ ТОЧЕК (первые 5):\n`;
        for (let i = 0; i < Math.min(5, originalPoints.length); i++) {
            const orig = originalPoints[i];
            const aligned = alignedPoints[i];
            const nearestRef = this.findNearestPoint(aligned, referencePoints);

            report += `\nТочка ${i + 1}:\n`;
            report += `  Исходная: (${orig.x.toFixed(1)}, ${orig.y.toFixed(1)})\n`;
            report += `  Выровненная: (${aligned.x.toFixed(1)}, ${aligned.y.toFixed(1)})\n`;

            if (nearestRef) {
                const distance = Math.sqrt(
                    Math.pow(aligned.x - nearestRef.x, 2) +
                    Math.pow(aligned.y - nearestRef.y, 2)
                );
                report += `  Ближайшая в эталоне: (${nearestRef.x.toFixed(1)}, ${nearestRef.y.toFixed(1)})\n`;
                report += `  Расстояние: ${distance.toFixed(1)}px\n`;
            }
        }

        report += '\n═'.repeat(50) + '\n';
        report += `Отчет создан: ${new Date().toLocaleString('ru-RU')}\n`;

        fs.writeFileSync(filepath, report, 'utf8');
        console.log(`📋 Текстовый отчет сохранен: ${filepath}`);

        return filepath;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    calculateBounds(points) {
        if (!points || points.length === 0) {
            return {
                minX: 0, maxX: 0, minY: 0, maxY: 0,
                width: 0, height: 0, centerX: 0, centerY: 0
            };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }

    findNearestPoint(point, points) {
        if (!points || points.length === 0) return null;

        let nearest = null;
        let minDistance = Infinity;

        for (const p of points) {
            const distance = Math.sqrt(
                Math.pow(p.x - point.x, 2) +
                Math.pow(p.y - point.y, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearest = p;
            }
        }

        return nearest;
    }

    // 🔥 ТЕСТОВЫЙ МЕТОД: Протестировать выравнивание
    async testAlignment(footprint1, footprint2) {
        console.log('\n🧪 ТЕСТ ВЫРАВНИВАНИЯ СЛЕДОВ:');
        console.log(`След 1: "${footprint1.name}" (${footprint1.graph.nodes.size} узлов)`);
        console.log(`След 2: "${footprint2.name}" (${footprint2.graph.nodes.size} узлов)`);

        // Получаем точки
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);

        // Получаем трансформации
        const trans1 = footprint1.getTransformation ? footprint1.getTransformation() : null;
        const trans2 = footprint2.getTransformation ? footprint2.getTransformation() : null;

        // Выравниваем второй след к первому
        const alignedPoints2 = this.alignToReference(points2, points1, trans2, trans1);

        // Сравниваем
        const comparison = this.compareAlignedPoints(points1, alignedPoints2);

        console.log(`\n📊 РЕЗУЛЬТАТ ТЕСТА:`);
        console.log(`   Совпадений <25px: ${comparison.goodMatches}`);
        console.log(`   Совпадений <50px: ${comparison.acceptableMatches}`);
        console.log(`   Среднее расстояние: ${comparison.avgDistance.toFixed(1)}px`);
        console.log(`   Качество выравнивания: ${comparison.quality.toFixed(3)}`);

        return {
            success: comparison.quality > 0.5,
            quality: comparison.quality,
            alignedPoints: alignedPoints2,
            comparison: comparison
        };
    }

    extractPointsFromFootprint(footprint) {
        const points = [];

        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || 0.5,
                    confirmedCount: point.confirmedCount || 1
                });
            }
        }

        return points;
    }

    compareAlignedPoints(referencePoints, alignedPoints) {
        let goodMatches = 0;
        let acceptableMatches = 0;
        let totalDistance = 0;
        let comparedCount = 0;

        alignedPoints.forEach(aligned => {
            const nearest = this.findNearestPoint(aligned, referencePoints);
            if (nearest) {
                const distance = Math.sqrt(
                    Math.pow(aligned.x - nearest.x, 2) +
                    Math.pow(aligned.y - nearest.y, 2)
                );

                totalDistance += distance;
                comparedCount++;

                if (distance < 25) goodMatches++;
                if (distance < 50) acceptableMatches++;
            }
        });

        const avgDistance = comparedCount > 0 ? totalDistance / comparedCount : 1000;

        // Качество выравнивания (0-1)
        const quality = Math.max(0, Math.min(1,
            (goodMatches / Math.max(1, alignedPoints.length)) * 0.7 +
            (1 - Math.min(1, avgDistance / 100)) * 0.3
        ));

        return {
            goodMatches,
            acceptableMatches,
            avgDistance,
            quality,
            comparedCount
        };
    }
}

module.exports = SimpleAligner;
