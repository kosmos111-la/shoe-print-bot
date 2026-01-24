// modules/footprint/core/comparison/template-coordination.js
// 🔥 ВЫНЕСЕННАЯ ЛОГИКА РАБОТЫ С ШАБЛОНАМИ И ПОДТВЕРЖДЕНИЯМИ (ПОЛНАЯ ВЕРСИЯ С ИСПРАВЛЕНИЯМИ)

class TemplateCoordination {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
    }

    // 🔥 НОВЫЙ МЕТОД: Рассчитать реальный процент совпадений
    calculateRealMatchPercentage(matches, totalTrackerPoints) {
        console.log(`\n📊 [FIX-STATS] Расчет реального процента совпадений:`);

        if (!totalTrackerPoints || totalTrackerPoints === 0) {
            console.log('⚠️ [FIX-STATS] Нет точек трекера');
            return 0;
        }

        const REAL_THRESHOLDS = {
            perfect: 15,
            good: 30,
            acceptable: 50
        };

        const realMatches = matches.filter(m =>
            m.distance && m.distance < REAL_THRESHOLDS.acceptable
        );

        const percentage = (realMatches.length / totalTrackerPoints) * 100;

        console.log(`📊 [FIX-STATS] Реальные совпадения:`);
        console.log(`   Всего точек трекера: ${totalTrackerPoints}`);
        console.log(`   Всего совпадений: ${matches.length}`);
        console.log(`   Реальных (расстояние < ${REAL_THRESHOLDS.acceptable}px): ${realMatches.length}`);
        console.log(`   Реальный процент: ${percentage.toFixed(1)}%`);

        return Math.min(percentage, 100);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Обновление подтверждений БЕЗ РЕКУРСИИ
    updateConfirmationsFromTemplate(footprint, vectorModel, transformationInfo = null) {
        console.log(`\n🔄 ОБНОВЛЯЮ ПОДТВЕРЖДЕНИЯ с ПРАВИЛЬНОЙ ТРАНСФОРМАЦИЕЙ...`);

        if (!footprint || !footprint.pointTracker) {
            console.log('⚠️ Нет отпечатка или PointTracker');
            return 0;
        }

        if (!vectorModel || !vectorModel.templateBuilder) {
            console.log('⚠️ Нет шаблона');
            return 0;
        }

        const tracker = footprint.pointTracker;
        const templateBuilder = vectorModel.templateBuilder;

        // 1. ПОЛУЧАЕМ ТРАНСФОРМАЦИЮ ОТПЕЧАТКА
        let footprintTransformation = footprint.getTransformation();

        if (!footprintTransformation || !footprintTransformation.matrix) {
            console.log('⚠️ У отпечатка нет трансформации! Создаю по умолчанию...');
            footprintTransformation = {
                matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
                rotationAngle: 0,
                isMirrored: false,
                center: { x: 0, y: 0 },
                bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
                scale: { x: 1, y: 1 },
                translation: { x: 0, y: 0 },
                type: 'default_identity'
            };
        }

        console.log(`📐 Трансформация отпечатка:`);
        console.log(`   Угол: ${footprintTransformation.rotationAngle?.toFixed(1) || 0}°`);
        console.log(`   Зеркало: ${footprintTransformation.isMirrored ? 'да' : 'нет'}`);

        // 2. 🔥 ИСПРАВЛЕНИЕ: Используем getSimpleData() вместо getVisualizationData()
        const templateSimpleData = templateBuilder.getSimpleData();
        if (!templateSimpleData || !templateSimpleData.cells || templateSimpleData.cells.length === 0) {
            console.log('⚠️ Нет данных ячеек в шаблоне');
            return this.fallbackDirectComparison(tracker, templateBuilder);
        }

        console.log(`📊 Данные шаблона: ${templateSimpleData.cells.length} ячеек`);

        // 3. ПОЛУЧАЕМ ТРАНСФОРМАЦИЮ ШАБЛОНА
        const templateTransformation = templateBuilder.getNormalizationTransform();

        if (!templateTransformation) {
            console.log('⚠️ У шаблона нет трансформации!');
            return this.fallbackDirectComparison(tracker, templateBuilder);
        }

        console.log(`📐 Трансформация шаблона:`);
        console.log(`   Границы: ${templateTransformation.width?.toFixed(1)}x${templateTransformation.height?.toFixed(1)}`);

        // 🔥 ИСПРАВЛЕНИЕ: Преобразовать точки шаблона в систему отпечатка
        const templatePointsInFootprintSystem = this.transformTemplatePointsToFootprintSystem(
            templateSimpleData.cells,
            templateTransformation,
            footprintTransformation
        );

        console.log(`📊 Преобразовано ${templatePointsInFootprintSystem.length} точек шаблона`);

        // 4. ПОЛУЧАЕМ ТОЧКИ ТРЕКЕРА В СИСТЕМЕ ОТПЕЧАТКА
        const trackerPoints = [];
        const trackerPointIds = [];
       
        // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ТОЧЕК ДЛЯ ИЗБЕЖАНИЯ ПЕРЕПОЛНЕНИЯ
        let pointCount = 0;
        for (const [id, point] of tracker.points) {
            if (pointCount++ > 1000) break; // 🔥 ОГРАНИЧЕНИЕ
           
            trackerPoints.push({
                id,
                x: point.x,
                y: point.y,
                confidence: point.rating || 0.5,
                confirmedCount: point.confirmedCount || 1,
                pointData: point
            });
            trackerPointIds.push(id);
        }

        console.log(`📊 Точки трекера: ${trackerPoints.length}`);

        // 5. СРАВНИВАЕМ ТОЧКИ
        const comparisonResult = this.comparePointsInSameCoordinateSystem(
            trackerPoints,
            templatePointsInFootprintSystem,
            footprintTransformation
        );

        // 🔥 ИСПРАВЛЕНИЕ: Верифицировать результат
        console.log(`\n🎯 РЕЗУЛЬТАТ СРАВНЕНИЯ С ШАБЛОНОМ:`);
        console.log(`   • Всего точек трекера: ${comparisonResult.trackerPointsCount}`);
        console.log(`   • Всего точек шаблона: ${comparisonResult.templatePointsCount}`);
        console.log(`   • Найдено совпадений: ${comparisonResult.totalMatches}`);
        console.log(`   • Идеальные (<15px): ${comparisonResult.perfectMatches}`);
        console.log(`   • Хорошие (15-30px): ${comparisonResult.goodMatches}`);
        console.log(`   • Процент совпадений: ${comparisonResult.matchRate.toFixed(1)}%`);

        // 6. ПРИМЕНЯЕМ РЕЗУЛЬТАТЫ
        const updatedCount = this.applyComparisonToTracker(
            tracker,
            comparisonResult.matches
        );

        console.log(`   • Обновлено точек: ${updatedCount}`);

        // 7. ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ В ОТПЕЧАТКЕ
        this.updateFootprintConfirmations(footprint, comparisonResult.matches);

        return updatedCount;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Сравнить точки в одной системе координат
    comparePointsInSameCoordinateSystem(trackerPoints, templatePoints, transformation) {
        console.log(`🔍 Сравниваю ${trackerPoints.length} и ${templatePoints.length} точек...`);

        const matches = [];
        let perfectMatches = 0;
        let goodMatches = 0;

        const PERFECT_THRESHOLD = 15;
        const GOOD_THRESHOLD = 30;
        const MAX_THRESHOLD = 50;

        // 🔥 ОГРАНИЧИВАЕМ ПЕРЕБОР ДЛЯ ИЗБЕЖАНИЯ ПЕРЕПОЛНЕНИЯ
        const maxPointsToCheck = Math.min(trackerPoints.length, 500);
       
        for (let i = 0; i < maxPointsToCheck; i++) {
            const trackerPoint = trackerPoints[i];
            let bestMatch = null;
            let minDistance = Infinity;

            // 🔥 ОГРАНИЧИВАЕМ ПОИСК В ШАБЛОНЕ
            const maxTemplatePointsToCheck = Math.min(templatePoints.length, 200);
            for (let j = 0; j < maxTemplatePointsToCheck; j++) {
                const templatePoint = templatePoints[j];
               
                const dx = templatePoint.x - trackerPoint.x;
                const dy = templatePoint.y - trackerPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        trackerPoint: trackerPoint,
                        templatePoint: templatePoint,
                        distance: distance,
                        quality: this.calculateMatchQuality(distance, templatePoint.confidence)
                    };
                }
            }

            if (bestMatch) {
                // Классифицируем качество совпадения
                if (minDistance < PERFECT_THRESHOLD) {
                    bestMatch.matchType = 'perfect';
                    perfectMatches++;
                } else if (minDistance < GOOD_THRESHOLD) {
                    bestMatch.matchType = 'good';
                    goodMatches++;
                } else if (minDistance < MAX_THRESHOLD) {
                    bestMatch.matchType = 'acceptable';
                } else {
                    bestMatch.matchType = 'poor';
                }

                matches.push(bestMatch);
            }
        }

        // 🔥 РЕАЛЬНЫЙ РАСЧЕТ ПРОЦЕНТА
        const realPercentage = this.calculateRealMatchPercentage(matches, trackerPoints.length);

        return {
            matches: matches,
            perfectMatches: perfectMatches,
            goodMatches: goodMatches,
            totalMatches: matches.length,
            matchRate: realPercentage,
            trackerPointsCount: trackerPoints.length,
            templatePointsCount: templatePoints.length,
            transformationUsed: transformation
        };
    }

    // 🔥 МЕТОД: Рассчитать качество совпадения
    calculateMatchQuality(distance, templateConfidence) {
        const distanceScore = Math.max(0, 1 - distance / 50);
        const confidenceScore = templateConfidence || 0.5;
        return (distanceScore * 0.7 + confidenceScore * 0.3);
    }

    // 🔥 МЕТОД: Применить результаты сравнения к трекеру
    applyComparisonToTracker(tracker, matches) {
        let updatedCount = 0;

        // 🔥 ГРУППИРУЕМ СОВПАДЕНИЯ ПО ТОЧКАМ ТРЕКЕРА
        const matchesByTrackerPoint = new Map();

        matches.forEach(match => {
            const pointId = match.trackerPoint.id;
            if (!matchesByTrackerPoint.has(pointId)) {
                matchesByTrackerPoint.set(pointId, []);
            }
            matchesByTrackerPoint.get(pointId).push(match);
        });

        // 🔥 ОБНОВЛЯЕМ КАЖДУЮ ТОЧКУ ТРЕКЕРА
        for (const [pointId, pointMatches] of matchesByTrackerPoint) {
            const pointData = tracker.points.get(pointId);
            if (!pointData) continue;

            // 🔥 НАХОДИМ ЛУЧШЕЕ СОВПАДЕНИЕ ДЛЯ ЭТОЙ ТОЧКИ
            const bestMatch = pointMatches.reduce((best, current) => {
                if (!best || current.quality > best.quality) {
                    return current;
                }
                return best;
            }, null);

            if (!bestMatch || bestMatch.matchType === 'poor') {
                continue;
            }

            // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ
            const oldConfirmations = pointData.confirmedCount || 1;
            const templateConfirmations = bestMatch.templatePoint.confirmations || 1;
            const newConfirmations = Math.max(oldConfirmations, templateConfirmations);

            if (newConfirmations > oldConfirmations) {
                pointData.confirmedCount = newConfirmations;
                updatedCount++;

                if (updatedCount < 5) {
                    console.log(`   🔄 Точка ${pointId}: ${oldConfirmations} → ${newConfirmations} подтверждений`);
                }
            }
        }

        return updatedCount;
    }

    // 🔥 МЕТОД: Обновить подтверждения в отпечатке
    updateFootprintConfirmations(footprint, matches) {
        if (!footprint || !footprint.graph || matches.length === 0) {
            return;
        }

        let updatedNodes = 0;

        matches.forEach(match => {
            if (!match.trackerPoint || !match.trackerPoint.id) return;

            const nodeId = `n_${match.trackerPoint.id}`;
            const node = footprint.graph.nodes.get(nodeId);

            if (node) {
                const oldConfirmations = node.confirmedCount || 1;
                const templateConfirmations = match.templatePoint.confirmations || 1;
                const newConfirmations = Math.max(oldConfirmations, templateConfirmations);

                if (newConfirmations > oldConfirmations) {
                    node.confirmedCount = newConfirmations;
                    updatedNodes++;
                }
            }
        });

        if (updatedNodes > 0) {
            console.log(`📈 Обновлено ${updatedNodes} узлов в графе отпечатка`);
        }
    }

    // 🔥 ФОЛЛБЭК: Прямое сравнение
    fallbackDirectComparison(tracker, templateBuilder) {
        console.log(`🔄 Использую прямое сравнение (фоллбэк)...`);

        // 🔥 ИСПРАВЛЕНИЕ: Используем getSimpleData()
        const templateSimpleData = templateBuilder.getSimpleData();
        if (!templateSimpleData || !templateSimpleData.cells) {
            return 0;
        }

        const templatePoints = templateSimpleData.cells.map(cell => ({
            x: (cell.nx || 0) * 1000,
            y: (cell.ny || 0) * 1000,
            confirmations: cell.confirmations || 1
        }));

        let updatedCount = 0;
        const threshold = 25;

        // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ТОЧЕК
        let pointCount = 0;
        for (const [trackerId, trackerPoint] of tracker.points) {
            if (pointCount++ > 500) break;
           
            let bestDistance = Infinity;
            let bestConfirmations = 1;

            for (const templatePoint of templatePoints) {
                const dx = templatePoint.x - trackerPoint.x;
                const dy = templatePoint.y - trackerPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < bestDistance && distance < threshold) {
                    bestDistance = distance;
                    bestConfirmations = templatePoint.confirmations;
                }
            }

            if (bestDistance < threshold) {
                const oldCount = trackerPoint.confirmedCount || 1;
                const newCount = Math.max(oldCount, bestConfirmations);

                if (newCount > oldCount) {
                    trackerPoint.confirmedCount = newCount;
                    updatedCount++;
                }
            }
        }

        console.log(`✅ Прямое сравнение: обновлено ${updatedCount} точек`);
        return updatedCount;
    }

    // 🔥 МЕТОД: Прямое обновление подтверждений между следами
    updateConfirmationsDirectly(footprint1, footprint2) {
        console.log(`\n🔄 Прямое обновление подтверждений между двумя следами...`);

        try {
            let points1, points2;

            try {
                points1 = footprint1.getPointsForPatternMatching();
            } catch (error) {
                console.log(`❌ Ошибка получения точек для ${footprint1.name}: ${error.message}`);
                points1 = this.manager.extractPointsFromFootprint(footprint1);
            }

            try {
                points2 = footprint2.getPointsForPatternMatching();
            } catch (error) {
                console.log(`❌ Ошибка получения точек для ${footprint2.name}: ${error.message}`);
                points2 = this.manager.extractPointsFromFootprint(footprint2);
            }

            console.log(`🔍 Сравниваю ${points1.length} и ${points2.length} точек`);

            let updatedCount = 0;
            const threshold = 25;
            const matches = [];

            // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ТОЧЕК ДЛЯ СРАВНЕНИЯ
            const maxPoints = Math.min(500, points1.length);
            for (let i = 0; i < maxPoints; i++) {
                const point1 = points1[i];
                let bestMatch = null;
                let minDistance = Infinity;

                const maxPoints2 = Math.min(200, points2.length);
                for (let j = 0; j < maxPoints2; j++) {
                    const point2 = points2[j];
                    const dx = point2.x - point1.x;
                    const dy = point2.y - point1.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < minDistance && distance < threshold) {
                        minDistance = distance;
                        bestMatch = {
                            point1,
                            point2,
                            distance
                        };
                    }
                }

                if (bestMatch) {
                    matches.push(bestMatch);
                }
            }

            console.log(`📊 Найдено ${matches.length} совпадений (<${threshold}px)`);

            // Обновляем подтверждения
            if (footprint1.pointTracker) {
                for (const match of matches) {
                    const pointId = match.point1.id;
                    if (pointId) {
                        const pointData = footprint1.pointTracker.points.get(pointId);
                        if (pointData) {
                            const oldCount = pointData.confirmedCount || 1;
                            const newCount = Math.max(oldCount, 2);

                            if (newCount > oldCount) {
                                pointData.confirmedCount = newCount;
                                updatedCount++;
                            }
                        }
                    }
                }
            }

            console.log(`✅ Обновлено ${updatedCount} точек`);
            return updatedCount;

        } catch (error) {
            console.log(`❌ Критическая ошибка в updateConfirmationsDirectly: ${error.message}`);
            return 0;
        }
    }

    // 🔥 МЕТОД: Обновить подтверждения из совпадений
    updateConfirmationsFromMatches(footprint1, footprint2, matches) {
        console.log(`\n🔄 Обновляю подтверждения из ${matches.length} совпадений...`);

        let updatedCount = 0;

        // 🔥 ОГРАНИЧИВАЕМ ОБРАБОТКУ СОВПАДЕНИЙ
        const maxMatches = Math.min(matches.length, 1000);
       
        for (let i = 0; i < maxMatches; i++) {
            const match = matches[i];
           
            // Обновляем в первом следе
            if (footprint1.pointTracker && match.point1 && match.point1.id) {
                const pointData = footprint1.pointTracker.points.get(match.point1.id);
                if (pointData) {
                    const oldCount = pointData.confirmedCount || 1;
                    const newCount = Math.max(oldCount, 2);

                    if (newCount > oldCount) {
                        pointData.confirmedCount = newCount;
                        updatedCount++;
                    }
                }
            }

            // Обновляем во втором следе
            if (footprint2.pointTracker && match.point2 && match.point2.id) {
                const pointData = footprint2.pointTracker.points.get(match.point2.id);
                if (pointData) {
                    const oldCount = pointData.confirmedCount || 1;
                    const newCount = Math.max(oldCount, 2);

                    if (newCount > oldCount) {
                        pointData.confirmedCount = newCount;
                        updatedCount++;
                    }
                }
            }
        }

        console.log(`✅ Обновлено ${updatedCount} подтверждений`);
        return updatedCount;
    }

    // 🔥 МЕТОД: Преобразовать точки шаблона в систему отпечатка
    transformTemplatePointsToFootprintSystem(templateCells, templateTransformation, footprintTransformation) {
        const points = [];

        // 🔥 ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ЯЧЕЕК
        const maxCells = Math.min(templateCells.length, 1000);
       
        for (let i = 0; i < maxCells; i++) {
            const cell = templateCells[i];
            const normalizedX = cell.nx || 0;
            const normalizedY = cell.ny || 0;

            const templateX = normalizedX * templateTransformation.width + templateTransformation.minX;
            const templateY = normalizedY * templateTransformation.height + templateTransformation.minY;

            let transformedX = templateX;
            let transformedY = templateY;

            const footprintAngle = footprintTransformation.rotationAngle || 0;

            if (footprintAngle !== 0 && footprintTransformation.center) {
                const centerX = footprintTransformation.center.x || 0;
                const centerY = footprintTransformation.center.y || 0;

                const dx = templateX - centerX;
                const dy = templateY - centerY;

                const angleRad = -footprintAngle * Math.PI / 180;
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                const rotatedX = dx * cosA - dy * sinA;
                const rotatedY = dx * sinA + dy * cosA;

                transformedX = rotatedX + centerX;
                transformedY = rotatedY + centerY;
            }

            points.push({
                x: transformedX,
                y: transformedY,
                nx: normalizedX,
                ny: normalizedY,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id,
                cellIndex: i
            });
        }

        return points;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Проверить накопление деталей (без getVisualizationData)
    debugAccumulation(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel || !vectorModel.templateBuilder) {
            console.log('❌ Нет шаблона для проверки накопления');
            return;
        }

        // 🔥 ИСПРАВЛЕНИЕ: Используем getSimpleData()
        const templateSimpleData = vectorModel.templateBuilder.getSimpleData();

        console.log('\n🔍 ДЕБАГ НАКОПЛЕНИЯ ДЕТАЛЕЙ:');
        console.log(`Шаблон: ${templateSimpleData.name}`);
        console.log(`Всего ячеек: ${templateSimpleData.cellCount}`);
        console.log(`Последнее обновление: ${templateSimpleData.lastUpdated.toLocaleString()}`);

        if (templateSimpleData.cells && templateSimpleData.cells.length > 0) {
            // 🔥 СТАТИСТИКА ПО ПОДТВЕРЖДЕНИЯМ
            const confirmationDistribution = {};
            let totalConfirmations = 0;
           
            templateSimpleData.cells.forEach(cell => {
                const conf = cell.confirmations || 1;
                totalConfirmations += conf;
               
                if (conf >= 5) confirmationDistribution['5+'] = (confirmationDistribution['5+'] || 0) + 1;
                else confirmationDistribution[conf] = (confirmationDistribution[conf] || 0) + 1;
            });

            console.log(`\n📈 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:`);
            Object.entries(confirmationDistribution).sort((a, b) => {
                const aKey = a[0] === '5+' ? 5 : parseInt(a[0]);
                const bKey = b[0] === '5+' ? 5 : parseInt(b[0]);
                return aKey - bKey;
            }).forEach(([confirmations, count]) => {
                const percent = templateSimpleData.cellCount > 0 ?
                    ((count / templateSimpleData.cellCount) * 100).toFixed(1) : '0.0';
                console.log(`   ${confirmations}: ${count} (${percent}%)`);
            });

            const avgConfirmations = templateSimpleData.cellCount > 0 ?
                totalConfirmations / templateSimpleData.cellCount : 0;
            console.log(`\n📊 СРЕДНЕЕ: ${avgConfirmations.toFixed(2)} подтверждений на ячейку`);
        }

        // 🔥 ДИАГНОСТИКА: Проверить трансформации
        console.log(`\n🔧 ТРАНСФОРМАЦИИ ШАБЛОНА:`);
        const templateTransformation = vectorModel.templateBuilder.getNormalizationTransform();
        if (templateTransformation) {
            console.log(`   Ширина: ${templateTransformation.width?.toFixed(1)}`);
            console.log(`   Высота: ${templateTransformation.height?.toFixed(1)}`);
        } else {
            console.log(`   ❌ Нет трансформации шаблона`);
        }
    }

    // 🔥 ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ

    // Метод для получения статистики подтверждений
    getConfirmationStats(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { exists: false, stats: null };
        }

        // 🔥 ИСПРАВЛЕНИЕ: Используем getSimpleData()
        const templateSimpleData = vectorModel.templateBuilder.getSimpleData();
       
        let totalConfirmations = 0;
        if (templateSimpleData.cells && templateSimpleData.cells.length > 0) {
            totalConfirmations = templateSimpleData.cells.reduce((sum, cell) =>
                sum + (cell.confirmations || 0), 0);
        }

        const avgConfirmations = templateSimpleData.cellCount > 0 ?
            totalConfirmations / templateSimpleData.cellCount : 0;

        return {
            exists: true,
            stats: {
                totalCells: templateSimpleData.cellCount || 0,
                confirmedCells: templateSimpleData.cellCount || 0,
                totalConfirmations: totalConfirmations,
                averageConfirmations: avgConfirmations.toFixed(2),
                lastUpdated: templateSimpleData.lastUpdated
            }
        };
    }

    // Метод для очистки шаблона
    clearTemplateForUser(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { success: false, message: 'Шаблон не найден' };
        }

        vectorModel.templateBuilder.reset();
        console.log(`🧹 Шаблон очищен для пользователя ${userId}`);
        return { success: true, message: 'Шаблон очищен' };
    }

    // Метод для проверки целостности шаблона
    validateTemplateIntegrity(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { valid: false, errors: ['Шаблон не найден'] };
        }

        const errors = [];
        const templateSimpleData = vectorModel.templateBuilder.getSimpleData();

        if (!templateSimpleData) {
            errors.push('Нет данных шаблона');
        }

        if (!templateSimpleData.cells || templateSimpleData.cellCount === 0) {
            errors.push('Нет ячеек в шаблоне');
        }

        const transformation = vectorModel.templateBuilder.getNormalizationTransform();
        if (!transformation) {
            errors.push('Нет трансформации шаблона');
        }

        const isValid = errors.length === 0;
        console.log(`🔍 Проверка целостности шаблона ${userId}: ${isValid ? '✅' : '❌'}`);
       
        if (!isValid) {
            console.log(`   Ошибки: ${errors.join(', ')}`);
        }

        return {
            valid: isValid,
            errors: errors,
            stats: {
                cells: templateSimpleData.cellCount || 0,
                transformation: !!transformation
            }
        };
    }

    // Метод для получения визуализации шаблона
    getTemplateVisualizationData(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return null;
        }

        // 🔥 ИСПРАВЛЕНИЕ: Используем getSimpleData() для безопасности
        return vectorModel.templateBuilder.getSimpleData();
    }

    // Метод для обновления шаблона из нескольких отпечатков
    updateTemplateFromMultipleFootprints(userId, footprints) {
        console.log(`\n🔄 Обновление шаблона из ${footprints.length} отпечатков...`);

        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            console.log('❌ Шаблон не найден');
            return { success: false, updated: 0 };
        }

        let totalUpdated = 0;
        const maxFootprints = Math.min(footprints.length, 10); // 🔥 ОГРАНИЧЕНИЕ

        for (let i = 0; i < maxFootprints; i++) {
            const footprint = footprints[i];
            console.log(`   Обработка отпечатка ${i + 1}/${maxFootprints}: ${footprint.name}`);

            try {
                const transformation = footprint.getTransformation();
                if (!transformation) {
                    console.log(`   ⚠️ Нет трансформации, пропускаем`);
                    continue;
                }

                vectorModel.addGraph(footprint.graph, footprint.id, {
                    isBatchUpdate: true,
                    transformationInfo: transformation,
                    index: i
                });

                const updated = this.updateConfirmationsFromTemplate(footprint, vectorModel, transformation);
                totalUpdated += updated;

                console.log(`   ✅ Обновлено: ${updated} точек`);

            } catch (error) {
                console.log(`   ❌ Ошибка обработки: ${error.message}`);
            }
        }

        console.log(`🎯 Итого обновлено: ${totalUpdated} точек из ${maxFootprints} отпечатков`);

        return {
            success: true,
            totalUpdated: totalUpdated,
            footprintsProcessed: maxFootprints
        };
    }
}

module.exports = TemplateCoordination;
