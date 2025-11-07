// =============================================================================
// 🧩 УМНАЯ СБОРКА МОДЕЛЕЙ ИЗ ЧАСТИЧНЫХ ОТПЕЧАТКОВ
// =============================================================================

class FootprintAssembler {
    constructor() {
        this.partialPrints = new Map();
        this.assembledModels = new Map();
        console.log('✅ FootprintAssembler инициализирован');
    }

    /**
     * Классифицирует фрагменты протектора по типу узора и определяет левый/правый
     */
    classifyFootprintPattern(predictions, imageWidth, imageHeight) {
        if (!predictions || predictions.length === 0) return 'unknown_fragment';
      
        const features = this.extractFeatures(predictions);
        const bbox = this.calculateOverallBoundingBox(predictions);
      
        console.log(`🎨 Анализ узора протектора: ${features.detailCount} деталей, ${features.largeDetails} крупных`);

        // 🔍 АНАЛИЗ СИММЕТРИИ ДЛЯ ОПРЕДЕЛЕНИЯ ЛЕВЫЙ/ПРАВЫЙ
        const symmetryAnalysis = this.analyzeFootprintSymmetry(predictions, bbox);
        const footSide = symmetryAnalysis.side;
        const symmetryScore = symmetryAnalysis.score;

        // 🎯 КЛАССИФИКАЦИЯ ПО ХАРАКТЕРИСТИКАМ УЗОРА
        let patternComplexity = 'unknown';
      
        if (features.detailCount > 20) {
            patternComplexity = 'high_density';
        } else if (features.detailCount > 10) {
            patternComplexity = 'medium_density';
        } else if (features.detailCount > 5) {
            patternComplexity = 'low_density';
        } else {
            patternComplexity = 'sparse';
        }

        // 🔧 УЧЕТ КРУПНЫХ ЭЛЕМЕНТОВ
        if (features.largeDetails > 5) {
            patternComplexity = 'large_elements_' + patternComplexity;
        }

        // 📏 УЧЕТ РАЗМЕРА ФРАГМЕНТА
        const coverage = (bbox.width * bbox.height) / (imageWidth * imageHeight);
        let sizeCategory = 'medium';
        if (coverage > 0.3) sizeCategory = 'large';
        if (coverage < 0.1) sizeCategory = 'small';

        const result = `${footSide}_${sizeCategory}_${patternComplexity}`;
        console.log(`📋 Классификация: ${result} (симметрия: ${symmetryScore.toFixed(2)})`);
      
        return result;
    }

    /**
     * Анализирует симметрию для определения левый/правый след
     */
    analyzeFootprintSymmetry(predictions, bbox) {
        if (!predictions || predictions.length < 3) {
            return { side: 'unknown', score: 0.5 };
        }

        try {
            const centerX = bbox.minX + bbox.width / 2;
            let leftDensity = 0, rightDensity = 0;

            predictions.forEach(pred => {
                if (pred.points && pred.points.length > 0) {
                    const predBbox = this.calculateBoundingBox(pred.points);
                    const predCenterX = predBbox.minX + predBbox.width / 2;
                    const area = predBbox.width * predBbox.height;
                  
                    if (predCenterX < centerX) {
                        leftDensity += area;
                    } else {
                        rightDensity += area;
                    }
                }
            });

            const totalDensity = leftDensity + rightDensity;
            if (totalDensity === 0) return { side: 'unknown', score: 0.5 };

            const rightRatio = rightDensity / totalDensity;
          
            // 📊 ОПРЕДЕЛЯЕМ СТОРОНУ
            let side = 'unknown';
            if (rightRatio > 0.6) side = 'right';
            else if (rightRatio < 0.4) side = 'left';
            else side = 'center';

            return { side, score: rightRatio };

        } catch (error) {
            console.log('❌ Ошибка анализа симметрии:', error.message);
            return { side: 'unknown', score: 0.5 };
        }
    }

    /**
     * Вычисляет общий bounding box для всех предсказаний
     */
    calculateOverallBoundingBox(predictions) {
        if (!predictions || predictions.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
      
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
      
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                pred.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            }
        });
      
        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Вспомогательная функция для bounding box
     */
    calculateBoundingBox(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    /**
     * Улучшенное сравнение с учетом перекрытий и приоритетом мелких деталей
     */
    advancedPatternComparison(predictionsA, predictionsB) {
        if (!predictionsA || !predictionsB) return 0;
      
        console.log(`🔍 Улучшенное сравнение: ${predictionsA.length} vs ${predictionsB.length} деталей`);

        let totalScore = 0;
        let validComparisons = 0;

        // 🔄 СРАВНИВАЕМ В ОБЕ СТОРОНЫ ДЛЯ ТОЧНОСТИ
        const scoreAB = this.compareDetailsWithPriority(predictionsA, predictionsB);
        const scoreBA = this.compareDetailsWithPriority(predictionsB, predictionsA);
      
        // 📊 УСРЕДНЯЕМ РЕЗУЛЬТАТЫ
        const finalScore = (scoreAB + scoreBA) / 2;
        console.log(`🎯 Итоговый score: ${finalScore.toFixed(3)}`);
      
        return finalScore;
    }

    /**
     * Сравнивает детали с приоритетом точных мелких деталей
     */
    compareDetailsWithPriority(sourcePredictions, targetPredictions) {
        if (!sourcePredictions || !targetPredictions) return 0;
      
        let totalScore = 0;
        let comparisonCount = 0;

        sourcePredictions.forEach(sourcePred => {
            if (!sourcePred.points || sourcePred.points.length < 3) return;
          
            const sourceBbox = this.calculateBoundingBox(sourcePred.points);
            const sourceArea = sourceBbox.width * sourceBbox.height;
          
            let bestMatchScore = 0;
            let bestMatchSizeRatio = 1;

            // 🔍 ИЩЕМ ЛУЧШЕЕ СОВПАДЕНИЕ С УЧЕТОМ РАЗМЕРА
            targetPredictions.forEach(targetPred => {
                if (!targetPred.points || targetPred.points.length < 3) return;
              
                const targetBbox = this.calculateBoundingBox(targetPred.points);
                const targetArea = targetBbox.width * targetBbox.height;
              
                const overlapScore = this.calculateSmartOverlap(sourceBbox, targetBbox, sourcePred, targetPred);
                const sizeRatio = Math.min(sourceArea, targetArea) / Math.max(sourceArea, targetArea);
              
                // 🎯 ПРИОРИТЕТ ТОЧНЫМ СОВПАДЕНИЯМ МЕЛКИХ ДЕТАЛЕЙ
                if (overlapScore > bestMatchScore ||
                    (overlapScore > 0.3 && sizeRatio < bestMatchSizeRatio)) {
                    bestMatchScore = overlapScore;
                    bestMatchSizeRatio = sizeRatio;
                }
            });

            // 💎 ВЕСОВОЙ КОЭФФИЦИЕНТ: мелкие детали важнее
            let weight = 1.0;
            if (sourceArea < 500) weight = 1.5;    // Мелкие детали
            if (sourceArea < 200) weight = 2.0;    // Очень мелкие детали
            if (sourceArea > 2000) weight = 0.7;   // Крупные детали

            totalScore += bestMatchScore * weight;
            comparisonCount += weight;
        });

        return comparisonCount > 0 ? totalScore / comparisonCount : 0;
    }

    /**
     * Умный расчет перекрытия с учетом особенностей следов
     */
    calculateSmartOverlap(bboxA, bboxB, predA, predB) {
        // 📏 ВЫЧИСЛЯЕМ БАЗОВОЕ ПЕРЕКРЫТИЕ
        const overlapX = Math.max(0, Math.min(bboxA.maxX, bboxB.maxX) - Math.max(bboxA.minX, bboxB.minX));
        const overlapY = Math.max(0, Math.min(bboxA.maxY, bboxB.maxY) - Math.max(bboxA.minY, bboxB.minY));
        const overlapArea = overlapX * overlapY;
      
        const areaA = bboxA.width * bboxA.height;
        const areaB = bboxB.width * bboxB.height;
      
        if (overlapArea === 0) return 0;

        // 🎯 ОСНОВНОЙ SCORE ПЕРЕКРЫТИЯ
        const overlapToA = overlapArea / areaA;
        const overlapToB = overlapArea / areaB;
        let baseScore = Math.min(overlapToA, overlapToB);

        // 🔥 КРИТИЧЕСКИ ВАЖНЫЕ СЛУЧАИ:

        // 1. МЕЛКАЯ ДЕТАЛЬ ВНУТРИ КРУПНОЙ - ВЫСОКАЯ ТОЧНОСТЬ
        if (areaB < areaA * 0.1 && overlapToB > 0.9 && predA.class === predB.class) {
            console.log(`💎 Обнаружена точная мелкая деталь внутри крупной!`);
            return 0.95;
        }

        // 2. ВМЯТИНА/ОТСУТСТВИЕ МАТЕРИАЛА - учитываем контур
        if (this.isNegativeImpression(predA) || this.isNegativeImpression(predB)) {
            baseScore *= 0.8; // Снижаем вес для вмятин
        }

        // 3. СХОЖИЙ ТИП ДЕТАЛИ - бонус
        if (predA.class === predB.class) {
            baseScore += 0.15;
        }

        // 4. ТОЧНЫЕ МЕЛКИЕ ДЕТАЛИ - максимальный приоритет
        if (areaA < 1000 && areaB < 1000 && baseScore > 0.6) {
            baseScore += 0.25;
        }

        return Math.min(baseScore, 1.0);
    }

    /**
     * Определяет, является ли деталь вмятиной/отсутствующим материалом
     */
    isNegativeImpression(prediction) {
        // 🔍 ПРИЗНАКИ ВМЯТИНЫ/ОТСУТСТВИЯ МАТЕРИАЛА:
        // - Большой полигон
        // - Правильные геометрические границы
        // - Мало внутренних деталей
        if (!prediction.points) return false;
      
        const bbox = this.calculateBoundingBox(prediction.points);
        const area = bbox.width * bbox.height;
      
        // Большая площадь + правильная форма = возможная вмятина
        return area > 5000 && prediction.points.length <= 8;
    }

    /**
     * Компоновка полной модели из частичных отпечатков
     */
    assembleFullModel(partialPrints, imageWidth, imageHeight) {
        if (partialPrints.length < 2) {
            return { success: false, error: 'Недостаточно отпечатков для сборки' };
        }
      
        // Классифицируем все отпечатки
        const classifiedPrints = partialPrints.map(print => ({
            ...print,
            partType: this.classifyFootprintPattern(print.predictions, imageWidth, imageHeight),
            bbox: this.calculateOverallBoundingBox(print.predictions)
        }));
      
        // Группируем по совместимости
        const compatibleGroups = this.groupCompatiblePrints(classifiedPrints);
      
        if (compatibleGroups.length === 0) {
            return { success: false, error: 'Не найдено совместимых отпечатков' };
        }
      
        // Выбираем лучшую группу
        const bestGroup = this.selectBestGroup(compatibleGroups);
      
        // Собираем модель
        const assembledModel = this.mergeFootprints(bestGroup);
      
        return {
            success: true,
            model: assembledModel,
            usedPrints: bestGroup,
            completeness: this.calculateCompleteness(bestGroup),
            confidence: this.calculateConfidence(bestGroup)
        };
    }

    /**
     * Группирует совместимые отпечатки
     */
    groupCompatiblePrints(classifiedPrints) {
        const groups = [];
      
        classifiedPrints.forEach(print => {
            let assigned = false;
          
            for (let group of groups) {
                if (this.arePrintsCompatible(group, print)) {
                    group.push(print);
                    assigned = true;
                    break;
                }
            }
          
            if (!assigned) {
                groups.push([print]);
            }
        });
      
        return groups.filter(group => group.length >= 2);
    }

    /**
     * Улучшенная проверка совместимости с комбинированным анализом
     */
    arePrintsCompatible(group, newPrint) {
        console.log(`🎯 Улучшенная проверка совместимости...`);
      
        // 🔧 БЫСТРАЯ ПРОВЕРКА: если группа пустая, используем простую логику
        if (group.length === 0) {
            return this.simpleCompatibilityCheck(newPrint);
        }
      
        // 🎯 КОМБИНИРОВАННЫЙ АНАЛИЗ ДЛЯ НЕПУСТОЙ ГРУППЫ
        try {
            // Получаем размеры изображения из первого отпечатка в группе
            const firstFootprint = group[0];
            let imageWidth = 800, imageHeight = 600;
          
            // Пытаемся получить реальные размеры (если есть в данных)
            if (firstFootprint.features?.imageSize) {
                imageWidth = firstFootprint.features.imageSize.width;
                imageHeight = firstFootprint.features.imageSize.height;
            }
          
            return this.advancedCompatibilityAnalysis(group, newPrint, imageWidth, imageHeight);
          
        } catch (error) {
            console.log('❌ Ошибка комбинированного анализа, используем резервный метод:', error.message);
            // 🔧 РЕЗЕРВНЫЙ МЕТОД при ошибках
            return this.fallbackCompatibilityCheck(group, newPrint);
        }
    }

    /**
     * Простая проверка совместимости для первого отпечатка
     */
    simpleCompatibilityCheck(newPrint) {
        // Для первого отпечатка используем базовые критерии
        const features = newPrint.features;
        return features.detailCount >= 3; // Минимум 3 детали
    }

    /**
     * Резервный метод проверки совместимости
     */
    fallbackCompatibilityCheck(group, newPrint) {
        console.log(`🔄 Использую резервный метод проверки...`);
      
        // Простая проверка по features
        const featureScores = group.map(existing =>
            this.calculateSimilarity(existing.features, newPrint.features)
        );
        const avgFeatureScore = featureScores.reduce((a, b) => a + b, 0) / featureScores.length;
      
        return avgFeatureScore > 0.4;
    }

    /**
     * Выбирает лучшую группу для сборки
     */
    selectBestGroup(groups) {
        return groups.reduce((best, current) => {
            const bestScore = this.calculateGroupScore(best);
            const currentScore = this.calculateGroupScore(current);
            return currentScore > bestScore ? current : best;
        });
    }

    /**
     * Вычисляет score группы
     */
    calculateGroupScore(group) {
        const typeDiversity = new Set(group.map(p => p.partType)).size;
        const avgConfidence = group.reduce((sum, p) => sum + (p.features?.detailCount || 0), 0) / group.length;
        return typeDiversity * avgConfidence;
    }

    /**
     * Объединяет отпечатки в одну модель
     */
    mergeFootprints(prints) {
        const mergedPredictions = [];
        const mergedFeatures = {
            detailCount: 0,
            hasOutline: false,
            largeDetails: 0,
            density: 0,
            spatialSpread: 0
        };
      
        prints.forEach(print => {
            if (print.predictions) {
                mergedPredictions.push(...print.predictions);
            }
            if (print.features) {
                mergedFeatures.detailCount += print.features.detailCount || 0;
                mergedFeatures.hasOutline = mergedFeatures.hasOutline || print.features.hasOutline;
                mergedFeatures.largeDetails += print.features.largeDetails || 0;
            }
        });
      
        return {
            predictions: mergedPredictions,
            features: mergedFeatures,
            sourcePrints: prints.map(p => p.id),
            timestamp: new Date()
        };
    }

    /**
     * Вычисляет полноту модели
     */
    calculateCompleteness(prints) {
        const uniqueTypes = new Set(prints.map(p => p.partType));
        const maxPossibleTypes = 4; // full, heel, toe, center
        return (uniqueTypes.size / maxPossibleTypes) * 100;
    }

    /**
     * Вычисляет уверенность в модели
     */
    calculateConfidence(prints) {
        const similarities = [];
      
        for (let i = 0; i < prints.length; i++) {
            for (let j = i + 1; j < prints.length; j++) {
                similarities.push(this.calculateSimilarity(prints[i].features, prints[j].features));
            }
        }
      
        const avgSimilarity = similarities.length > 0 ?
            similarities.reduce((a, b) => a + b) / similarities.length : 0;
          
        return Math.min(avgSimilarity * 100, 100);
    }

    /**
     * Вычисляет схожесть features
     */
    calculateSimilarity(featuresA, featuresB) {
        if (!featuresA || !featuresB) return 0;
      
        const countA = featuresA.detailCount || 0;
        const countB = featuresB.detailCount || 0;
      
        if (countA === 0 || countB === 0) return 0;
      
        const countRatio = Math.min(countA, countB) / Math.max(countA, countB);
        const outlineMatch = featuresA.hasOutline === featuresB.hasOutline ? 0.3 : 0;
      
        return countRatio * 0.7 + outlineMatch;
    }

    /**
     * Нормализует геометрию отпечатка (поворот, масштаб, смещение)
     */
    normalizeFootprintGeometry(predictions, imageWidth, imageHeight) {
        if (!predictions || predictions.length === 0) return predictions;
      
        try {
            // 1. НАХОДИМ КОНТУР ДЛЯ ОПРЕДЕЛЕНИЯ ОРИЕНТАЦИИ
            const outline = predictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            );
          
            if (!outline || !outline.points) return predictions;
          
            // 2. ВЫЧИСЛЯЕМ УГОЛ ПОВОРОТА
            const angle = this.calculateOrientationAngle(outline.points);
          
            // 3. ВЫЧИСЛЯЕМ ЦЕНТР МАСС
            const bbox = this.calculateOverallBoundingBox(predictions);
            const center = {
                x: bbox.minX + bbox.width / 2,
                y: bbox.minY + bbox.height / 2
            };
          
            // 4. ЕСЛИ УГОЛ БОЛЬШОЙ - ПОВОРАЧИВАЕМ
            if (Math.abs(angle) > 10) {
                console.log(`🔄 Нормализую ориентацию: поворот на ${angle.toFixed(1)}°`);
                return this.rotatePredictions(predictions, center, -angle);
            }
          
            return predictions;
          
        } catch (error) {
            console.log('⚠️ Ошибка геометрической нормализации:', error.message);
            return predictions;
        }
    }

    /**
     * Поворачивает все предсказания вокруг центра
     */
    rotatePredictions(predictions, center, angleDegrees) {
        const rad = angleDegrees * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
      
        return predictions.map(pred => {
            if (!pred.points) return pred;
          
            return {
                ...pred,
                points: pred.points.map(point => {
                    // ПЕРЕНОСИМ В ЦЕНТР КООРДИНАТ
                    const dx = point.x - center.x;
                    const dy = point.y - center.y;
                  
                    // ПОВОРАЧИВАЕМ
                    const newX = dx * cos - dy * sin;
                    const newY = dx * sin + dy * cos;
                  
                    // ВОЗВРАЩАЕМ НА МЕСТО
                    return {
                        x: newX + center.x,
                        y: newY + center.y
                    };
                })
            };
        });
    }

    /**
     * Вычисляет угол ориентации контура
     */
    calculateOrientationAngle(points) {
        if (!points || points.length < 3) return 0;
      
        try {
            // ВЫЧИСЛЯЕМ ЦЕНТР МАСС
            const center = points.reduce((acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
            }, { x: 0, y: 0 });
          
            center.x /= points.length;
            center.y /= points.length;
          
            // МЕТОД ГЛАВНЫХ КОМПОНЕНТ
            let xx = 0, yy = 0, xy = 0;
          
            points.forEach(point => {
                const dx = point.x - center.x;
                const dy = point.y - center.y;
                xx += dx * dx;
                yy += dy * dy;
                xy += dx * dy;
            });
          
            const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
            return angle * (180 / Math.PI);
          
        } catch (error) {
            return 0;
        }
    }

    /**
     * Вычисляет геометрическое сходство отпечатков
     */
    calculateGeometricSimilarity(group, newPrint) {
        let totalScore = 0;
        let count = 0;
      
        group.forEach(existing => {
            // СРАВНИВАЕМ РАЗМЕРЫ И ФОРМУ
            const bboxA = this.calculateOverallBoundingBox(existing.predictions);
            const bboxB = this.calculateOverallBoundingBox(newPrint.predictions);
          
            // СРАВНЕНИЕ СООТНОШЕНИЯ СТОРОН
            const aspectRatioA = bboxA.width / bboxA.height;
            const aspectRatioB = bboxB.width / bboxB.height;
            const aspectScore = 1 - Math.abs(aspectRatioA - aspectRatioB) / Math.max(aspectRatioA, aspectRatioB);
          
            // СРАВНЕНИЕ ПЛОЩАДЕЙ (логарифмическое для устойчивости к масштабу)
            const areaA = bboxA.width * bboxA.height;
            const areaB = bboxB.width * bboxB.height;
            const areaScore = 1 - Math.abs(Math.log(areaA) - Math.log(areaB)) / 5; // нормализация
          
            totalScore += (aspectScore + areaScore) / 2;
            count++;
        });
      
        return count > 0 ? totalScore / count : 0;
    }

    /**
     * Комбинированный анализ совместимости с учетом метрик модели
     */
    advancedCompatibilityAnalysis(group, newPrint, imageWidth, imageHeight) {
        console.log(`🎯 Комбинированный анализ совместимости...`);
      
        const analysisResults = {
            // 🧩 ТОПОЛОГИЧЕСКИЙ УРОВЕНЬ (структура)
            topological: this.analyzeTopologicalCompatibility(group, newPrint, imageWidth, imageHeight),
          
            // 🔍 ДЕТАЛЬНЫЙ УРОВЕНЬ (элементы)
            detailed: this.analyzeDetailedCompatibility(group, newPrint),
          
            // 🧭 ОРИЕНТАЦИОННЫЙ УРОВЕНЬ (левый/правый, повороты)
            orientation: this.analyzeOrientationCompatibility(group, newPrint)
        };
      
        // 📊 АДАПТИВНОЕ ВЗВЕШИВАНИЕ С УЧЕТОМ RECALL МОДЕЛИ
        const weights = this.calculateAdaptiveWeights(group, newPrint);
      
        const finalScore = (
            analysisResults.topological * weights.topological +
            analysisResults.detailed * weights.detailed +
            analysisResults.orientation * weights.orientation
        );
      
        console.log(`🎯 Комбинированный результат:`, {
            topological: analysisResults.topological.toFixed(3),
            detailed: analysisResults.detailed.toFixed(3),
            orientation: analysisResults.orientation.toFixed(3),
            weights: weights,
            final: finalScore.toFixed(3)
        });
      
        return finalScore > 0.4; // 👈 ПОНИЖЕННЫЙ ПОРОГ ИЗ-ЗА RECALL
    }

    /**
     * Анализ топологической совместимости
     */
    analyzeTopologicalCompatibility(group, newPrint, imageWidth, imageHeight) {
        console.log(`🧩 Топологический анализ совместимости...`);
      
        let totalCompatibility = 0;
        let analysisCount = 0;
      
        group.forEach(existing => {
            const topologyA = this.extractTopologicalFeatures(existing.predictions, imageWidth, imageHeight);
            const topologyB = this.extractTopologicalFeatures(newPrint.predictions, imageWidth, imageHeight);
          
            const topologyScore = this.compareTopologicalFeatures(topologyA, topologyB);
            totalCompatibility += topologyScore;
            analysisCount++;
        });
      
        return analysisCount > 0 ? totalCompatibility / analysisCount : 0;
    }

    /**
     * Извлекает топологические признаки
     */
    extractTopologicalFeatures(predictions, imageWidth, imageHeight) {
        return {
            quadrantDensity: this.calculateQuadrantDensity(predictions, imageWidth, imageHeight),
            aspectRatio: this.calculateAspectRatio(predictions),
            centerOfMass: this.calculateCenterOfMass(predictions),
            boundaryPoints: this.extractBoundaryPoints(predictions)
        };
    }

    /**
     * Распределение деталей по квадрантам
     */
    calculateQuadrantDensity(predictions, imageWidth, imageHeight) {
        const quadrants = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
        const centerX = imageWidth / 2;
        const centerY = imageHeight / 2;
      
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                const bbox = this.calculateBoundingBox(pred.points);
                const center = {
                    x: bbox.minX + bbox.width / 2,
                    y: bbox.minY + bbox.height / 2
                };
              
                if (center.x < centerX && center.y < centerY) quadrants.topLeft++;
                else if (center.x >= centerX && center.y < centerY) quadrants.topRight++;
                else if (center.x < centerX && center.y >= centerY) quadrants.bottomLeft++;
                else quadrants.bottomRight++;
            }
        });
      
        return quadrants;
    }

    /**
     * Соотношение сторон bounding box
     */
    calculateAspectRatio(predictions) {
        const bbox = this.calculateOverallBoundingBox(predictions);
        return bbox.width / bbox.height;
    }

    /**
     * Центр масс деталей
     */
    calculateCenterOfMass(predictions) {
        let totalX = 0, totalY = 0, count = 0;
      
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                const bbox = this.calculateBoundingBox(pred.points);
                totalX += bbox.minX + bbox.width / 2;
                totalY += bbox.minY + bbox.height / 2;
                count++;
            }
        });
      
        return count > 0 ? { x: totalX / count, y: totalY / count } : { x: 0, y: 0 };
    }

    /**
     * Граничные точки фрагмента
     */
    extractBoundaryPoints(predictions) {
        const points = [];
        const bbox = this.calculateOverallBoundingBox(predictions);
      
        // Простые граничные точки
        points.push({ x: bbox.minX, y: bbox.minY }); // левый верхний
        points.push({ x: bbox.maxX, y: bbox.minY }); // правый верхний
        points.push({ x: bbox.minX, y: bbox.maxY }); // левый нижний
        points.push({ x: bbox.maxX, y: bbox.maxY }); // правый нижний
        points.push({ x: bbox.minX + bbox.width / 2, y: bbox.minY }); // верхний центр
        points.push({ x: bbox.minX + bbox.width / 2, y: bbox.maxY }); // нижний центр
      
        return points;
    }

    /**
     * Сравнение топологических признаков
     */
    compareTopologicalFeatures(topologyA, topologyB) {
        let totalScore = 0;
        let comparisonCount = 0;
      
        // 1. Сравнение распределения по квадрантам
        const quadrantScore = this.compareQuadrantDistribution(topologyA.quadrantDensity, topologyB.quadrantDensity);
        totalScore += quadrantScore;
        comparisonCount++;
      
        // 2. Сравнение пропорций
        const aspectScore = 1 - Math.abs(topologyA.aspectRatio - topologyB.aspectRatio) / Math.max(topologyA.aspectRatio, topologyB.aspectRatio);
        totalScore += aspectScore;
        comparisonCount++;
      
        // 3. Сравнение центров масс
        const centerDistance = Math.sqrt(
            Math.pow(topologyA.centerOfMass.x - topologyB.centerOfMass.x, 2) +
            Math.pow(topologyA.centerOfMass.y - topologyB.centerOfMass.y, 2)
        );
        const centerScore = Math.max(0, 1 - centerDistance / 100); // Нормализуем
        totalScore += centerScore;
        comparisonCount++;
      
        return totalScore / comparisonCount;
    }

    /**
     * Сравнение распределения по квадрантам
     */
    compareQuadrantDistribution(quadrantsA, quadrantsB) {
        const totalA = quadrantsA.topLeft + quadrantsA.topRight + quadrantsA.bottomLeft + quadrantsA.bottomRight;
        const totalB = quadrantsB.topLeft + quadrantsB.topRight + quadrantsB.bottomLeft + quadrantsB.bottomRight;
      
        if (totalA === 0 || totalB === 0) return 0.5;
      
        const ratiosA = {
            topLeft: quadrantsA.topLeft / totalA,
            topRight: quadrantsA.topRight / totalA,
            bottomLeft: quadrantsA.bottomLeft / totalA,
            bottomRight: quadrantsA.bottomRight / totalA
        };
      
        const ratiosB = {
            topLeft: quadrantsB.topLeft / totalB,
            topRight: quadrantsB.topRight / totalB,
            bottomLeft: quadrantsB.bottomLeft / totalB,
            bottomRight: quadrantsB.bottomRight / totalB
        };
      
        const difference = (
            Math.abs(ratiosA.topLeft - ratiosB.topLeft) +
            Math.abs(ratiosA.topRight - ratiosB.topRight) +
            Math.abs(ratiosA.bottomLeft - ratiosB.bottomLeft) +
            Math.abs(ratiosA.bottomRight - ratiosB.bottomRight)
        );
      
        return Math.max(0, 1 - difference);
    }

    /**
     * Анализ детальной совместимости с компенсацией recall
     */
    analyzeDetailedCompatibility(group, newPrint) {
        let totalScore = 0;
        let comparisonCount = 0;
      
        group.forEach(existing => {
            // 🔧 КОМПЕНСАЦИЯ ЗА НИЗКИЙ RECALL - увеличиваем вес найденных деталей
            const baseScore = this.advancedPatternComparison(existing.predictions, newPrint.predictions);
            const compensatedScore = Math.min(baseScore * 1.5, 1.0); // +50% вес
          
            totalScore += compensatedScore;
            comparisonCount++;
        });
      
        return comparisonCount > 0 ? totalScore / comparisonCount : 0;
    }

    /**
     * Анализ ориентационной совместимости
     */
    analyzeOrientationCompatibility(group, newPrint) {
        console.log(`🧭 Анализ ориентационной совместимости...`);
      
        const groupOrientations = group.map(footprint => ({
            side: footprint.patternType?.split('_')[0] || 'unknown',
            angle: footprint.orientation?.angle || 0
        }));
      
        const newOrientation = {
            side: newPrint.patternType?.split('_')[0] || 'unknown',
            angle: newPrint.orientation?.angle || 0
        };
      
        // 🔧 ГИБКАЯ ПРОВЕРКА СТОРОН
        const sideCompatibility = this.assessSideCompatibility(groupOrientations, newOrientation);
      
        // 🔧 ПРОВЕРКА УГЛОВ ПОВОРОТА
        const angleCompatibility = this.assessAngleCompatibility(groupOrientations, newOrientation);
      
        const orientationScore = (sideCompatibility + angleCompatibility) / 2;
      
        console.log(`🧭 Ориентационная совместимость: ${orientationScore.toFixed(3)}`);
      
        return orientationScore;
    }

    /**
     * Гибкая проверка совместимости сторон
     */
    assessSideCompatibility(groupOrientations, newOrientation) {
        const groupSides = groupOrientations.map(o => o.side);
        const newSide = newOrientation.side;
      
        // 1. Одинаковые стороны - отлично
        if (groupSides.includes(newSide)) return 1.0;
      
        // 2. Unknown/center - нейтрально
        if (newSide === 'unknown' || newSide === 'center') return 0.7;
        if (groupSides.includes('unknown') || groupSides.includes('center')) return 0.7;
      
        // 3. Разные стороны - возможна сборка полного следа
        if ((groupSides.includes('left') && newSide === 'right') ||
            (groupSides.includes('right') && newSide === 'left')) {
            return 0.6;
        }
      
        return 0.3;
    }

    /**
     * Проверка совместимости углов поворота
     */
    assessAngleCompatibility(groupOrientations, newOrientation) {
        if (groupOrientations.length === 0) return 0.7;
      
        let totalAngleScore = 0;
      
        groupOrientations.forEach(groupOrientation => {
            const angleDiff = Math.abs(groupOrientation.angle - newOrientation.angle);
            const normalizedDiff = Math.min(angleDiff / 45, 1.0); // Нормализуем к 45 градусам
            totalAngleScore += 1 - normalizedDiff;
        });
      
        return totalAngleScore / groupOrientations.length;
    }

    /**
     * Адаптивное взвешивание с учетом recall модели
     */
    calculateAdaptiveWeights(group, newPrint) {
        const detailQuality = this.assessDetailQuality(group, newPrint);
      
        // 🎯 УЧИТЫВАЕМ RECALL 40% - найденные детали неполные
        const effectiveDetailQuality = detailQuality * 0.4;
      
        let weights = {
            topological: 0.6,  // 🔥 ОСНОВНОЙ ВЕС ТОПОЛОГИИ
            detailed: 0.3,     // 🔥 ВТОРОСТЕПЕННЫЕ ДЕТАЛИ
            orientation: 0.1
        };
      
        // Только для ОЧЕНЬ четких следов увеличиваем вес деталей
        if (effectiveDetailQuality > 0.6) {
            weights.topological = 0.3;
            weights.detailed = 0.6;
            weights.orientation = 0.1;
        }
      
        console.log(`⚖️ Адаптивные веса (качество: ${effectiveDetailQuality.toFixed(3)}):`, weights);
        return weights;
    }

    /**
     * Оценка качества детализации следов
     */
    assessDetailQuality(group, newPrint) {
        let totalQuality = 0;
        let count = 0;
      
        group.forEach(footprint => {
            const quality = this.calculateFootprintQuality(footprint);
            totalQuality += quality;
            count++;
        });
      
        totalQuality += this.calculateFootprintQuality(newPrint);
        count++;
      
        return totalQuality / count;
    }

    /**
     * Оценка качества одного отпечатка
     */
    calculateFootprintQuality(footprint) {
        const features = footprint.features;
      
        let qualityScore = 0;
      
        // 1. Количество деталей
        const detailScore = Math.min(features.detailCount / 30, 1.0);
      
        // 2. Разнообразие размеров
        const sizeDiversity = this.calculateSizeDiversity(footprint.predictions);
      
        // 3. Наличие контура
        const outlineBonus = features.hasOutline ? 0.2 : 0;
      
        qualityScore = (detailScore * 0.5) + (sizeDiversity * 0.3) + outlineBonus;
      
        return Math.min(qualityScore, 1.0);
    }

    /**
     * Расчет разнообразия размеров деталей
     */
    calculateSizeDiversity(predictions) {
        if (predictions.length < 2) return 0.3;
      
        const areas = predictions
            .filter(pred => pred.points && pred.points.length > 0)
            .map(pred => {
                const bbox = this.calculateBoundingBox(pred.points);
                return bbox.width * bbox.height;
            })
            .filter(area => area > 0);
      
        if (areas.length < 2) return 0.3;
      
        const minArea = Math.min(...areas);
        const maxArea = Math.max(...areas);
      
        return minArea > 0 ? Math.min(maxArea / minArea, 10) / 10 : 0.3;
    }

    /**
     * Извлекает features из предсказаний
     */
    extractFeatures(predictions) {
        console.log(`📊 Извлекаем улучшенные features из ${predictions.length} предсказаний`);
      
        const features = {
            detailCount: predictions.length,
            hasOutline: false,
            largeDetails: 0,
            density: 1,  // гарантируем значение по умолчанию
            spatialSpread: 0
        };

        // ЗАЩИТА ОТ ПУСТЫХ ДАННЫХ
        if (!predictions || predictions.length === 0) {
            return features;
        }

        let totalArea = 0;
        const centers = [];

        predictions.forEach(pred => {
            if (pred.class && pred.class.includes('Outline')) {
                features.hasOutline = true;
            }

            // Считаем площадь и центры для анализа распределения
            if (pred.points && pred.points.length > 3) {
                const bbox = this.calculateBoundingBox(pred.points);
                const area = bbox.width * bbox.height;
                totalArea += area;
              
                if (area > 1000) {
                    features.largeDetails++;
                }

                // Сохраняем центры для анализа распределения
                centers.push({
                    x: bbox.x + bbox.width / 2,
                    y: bbox.y + bbox.height / 2
                });
            }
        });

        // Рассчитываем плотность деталей (защита от деления на ноль)
        if (centers.length > 0 && totalArea > 0) {
            features.density = centers.length / (totalArea / 1000); // деталей на 1000px²
        }

        console.log('📊 Улучшенные features:', features);
        return features;
    }
}

module.exports = { FootprintAssembler };
