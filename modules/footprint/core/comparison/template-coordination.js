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
       
        // 🔥 ИСПОЛЬЗОВАТЬ РЕАЛЬНЫЕ ПОРОГИ ИЗ ЛОГОВ
        const REAL_THRESHOLDS = {
            perfect: 15,    // "Идеальные (<15px)"
            good: 30,       // "Хорошие (15-30px)" 
            acceptable: 50  // Из лога виден порог ~50px
        };
       
        const realMatches = matches.filter(m =>
            m.distance && m.distance < REAL_THRESHOLDS.acceptable
        );
       
        const percentage = (realMatches.length / totalTrackerPoints) * 100;
       
        console.log(`📊 [FIX-STATS] Реальные совпадения:`);
        console.log(`   Всего точек трекера: ${totalTrackerPoints}`);
        console.log(`   Всего совпадений: ${matches.length}`);
        console.log(`   Реальных (расстояние < ${REAL_THRESHOLDS.acceptable}px): ${realMatches.length}`);
        console.log(`   Реальный процент: ${percentage.toFixed(1)}%`);
       
        // 🔥 ДИАГНОСТИКА: Если процент 100%, проверить детали
        if (percentage > 95 && realMatches.length < totalTrackerPoints) {
            console.log(`⚠️ [FIX-STATS-WARN] Подозрительный результат: ${percentage.toFixed(1)}% при ${realMatches.length}/${totalTrackerPoints} реальных совпадений`);
           
            // Показать расстояния
            matches.slice(0, 5).forEach((match, i) => {
                console.log(`   Совпадение ${i+1}: расстояние=${match.distance?.toFixed(1)}px, ` +
                          `type=${match.matchType}, valid=${match.distance < REAL_THRESHOLDS.acceptable}`);
            });
        }
       
        return Math.min(percentage, 100); // Ограничить 100%
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Обновление подтверждений с правильной трансформацией
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
        console.log(`   Угол: ${footprintTransformation.rotationAngle?.toFixed(1) || 0}°`);
        console.log(`   Зеркало: ${footprintTransformation.isMirrored ? 'да' : 'нет'}`);
        console.log(`   Центр: (${footprintTransformation.center?.x?.toFixed(1)}, ${footprintTransformation.center?.y?.toFixed(1)})`);

        // 2. ПОЛУЧАЕМ ДАННЫЕ ШАБЛОНА
        const templateData = templateBuilder.getVisualizationData();
        if (!templateData || !templateData.cells || templateData.cells.length === 0) {
            console.log('⚠️ Нет данных ячеек в шаблоне');
            return 0;
        }

        console.log(`📊 Данные шаблона: ${templateData.cells.length} ячеек`);

        // 3. ПОЛУЧАЕМ ТРАНСФОРМАЦИЮ ШАБЛОНА
        const templateTransformation = templateBuilder.getNormalizationTransform();

        if (!templateTransformation) {
            console.log('⚠️ У шаблона нет трансформации!');
            return this.fallbackDirectComparison(tracker, templateBuilder);
        }

        console.log(`📐 Трансформация шаблона:`);
        console.log(`   Границы: ${templateTransformation.width?.toFixed(1)}x${templateTransformation.height?.toFixed(1)}`);
        console.log(`   Смещение: (${templateTransformation.minX?.toFixed(1)}, ${templateTransformation.minY?.toFixed(1)})`);

        // 🔥 ИСПРАВЛЕНИЕ: Преобразовать точки шаблона в систему отпечатка
        const templatePointsInFootprintSystem = this.transformTemplatePointsToFootprintSystem(
            templateData.cells,
            templateTransformation,
            footprintTransformation
        );

        console.log(`📊 Преобразовано ${templatePointsInFootprintSystem.length} точек шаблона`);

        // 4. ПОЛУЧАЕМ ТОЧКИ ТРЕКЕРА В СИСТЕМЕ ОТПЕЧАТКА
        const trackerPoints = [];
        for (const [id, point] of tracker.points) {
            trackerPoints.push({
                id,
                x: point.x,
                y: point.y,
                confidence: point.rating || 0.5,
                confirmedCount: point.confirmedCount || 1,
                pointData: point
            });
        }

        console.log(`📊 Точки трекера: ${trackerPoints.length}`);

        // 🔥 ВАЛИДАЦИЯ: Проверить координаты
        if (trackerPoints.length > 0 && templatePointsInFootprintSystem.length > 0) {
            const trackerSample = trackerPoints[0];
            const templateSample = templatePointsInFootprintSystem[0];
           
            console.log(`🔍 [DIAG-COORD-CHECK] Пример координат:`);
            console.log(`   Точка трекера: (${trackerSample.x.toFixed(1)}, ${trackerSample.y.toFixed(1)})`);
            console.log(`   Точка шаблона: (${templateSample.x.toFixed(1)}, ${templateSample.y.toFixed(1)})`);
           
            // Проверить на нулевые координаты
            const zeroTracker = trackerPoints.filter(p => Math.abs(p.x) < 0.1 && Math.abs(p.y) < 0.1).length;
            const zeroTemplate = templatePointsInFootprintSystem.filter(p => Math.abs(p.x) < 0.1 && Math.abs(p.y) < 0.1).length;
           
            if (zeroTracker > 0) console.log(`⚠️ [DIAG-COORD] ${zeroTracker} точек трекера имеют координаты ~(0,0)`);
            if (zeroTemplate > 0) console.log(`⚠️ [DIAG-COORD] ${zeroTemplate} точек шаблона имеют координаты ~(0,0)`);
        }

        // 5. СРАВНИВАЕМ ТОЧКИ
        const comparisonResult = this.comparePointsInSameCoordinateSystem(
            trackerPoints,
            templatePointsInFootprintSystem,
            footprintTransformation
        );

        // 🔥 ИСПРАВЛЕНИЕ: Верифицировать результат
        console.log(`\n🎯 РЕЗУЛЬТАТ СРАВНЕНИЯ С ШАБЛОНОМ:`);
        console.log(`   • Всего точек трекера: ${comparisonResult.trackerPointsCount}`);
        console.log(`   • Всего точек шаблона: ${comparisonResult.templatePointsCount}`);
        console.log(`   • Найдено совпадений: ${comparisonResult.totalMatches}`);
        console.log(`   • Идеальные (<15px): ${comparisonResult.perfectMatches}`);
        console.log(`   • Хорошие (15-30px): ${comparisonResult.goodMatches}`);
        console.log(`   • Процент совпадений: ${comparisonResult.matchRate.toFixed(1)}%`);

        // 🔥 ПРОВЕРКА: Если процент 100%, но реальных совпадений мало
        if (comparisonResult.matchRate > 90 && comparisonResult.perfectMatches < 3) {
            console.log(`⚠️ [FIX-STATS-WARN] Подозрительный результат: ${comparisonResult.matchRate.toFixed(1)}% совпадений, но только ${comparisonResult.perfectMatches} идеальных (<15px)`);
        }

        // 6. ПРИМЕНЯЕМ РЕЗУЛЬТАТЫ
        const updatedCount = this.applyComparisonToTracker(
            tracker,
            comparisonResult.matches
        );

        console.log(`   • Обновлено точек: ${updatedCount}`);

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

        const PERFECT_THRESHOLD = 15;    // 15px - точное совпадение
        const GOOD_THRESHOLD = 30;       // 30px - хорошее совпадение
        const MAX_THRESHOLD = 50;        // 50px - максимальное

        // ДЛЯ КАЖДОЙ ТОЧКИ ТРЕКЕРА ИЩЕМ БЛИЖАЙШУЮ ТОЧКУ ШАБЛОНА
        trackerPoints.forEach(trackerPoint => {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestTemplatePoint = null;

            for (const templatePoint of templatePoints) {
                const distance = Math.sqrt(
                    Math.pow(templatePoint.x - trackerPoint.x, 2) +
                    Math.pow(templatePoint.y - trackerPoint.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        trackerPoint: trackerPoint,
                        templatePoint: templatePoint,
                        distance: distance,
                        quality: this.calculateMatchQuality(distance, templatePoint.confidence)
                    };
                    bestTemplatePoint = templatePoint;
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
        });

        // 🔥 ДИАГНОСТИКА: Записать первые совпадения
        console.log(`🔍 [DIAG-STATS] Расчет процента совпадений:`);
        console.log(`   Всего точек трекера: ${trackerPoints.length}`);
        console.log(`   Найдено совпадений: ${matches.length}`);

        // 🔥 ПРОВЕРИТЬ КАЖДОЕ "СОВПАДЕНИЕ":
        matches.slice(0, 5).forEach((match, i) => {
            console.log(`   Совпадение ${i+1}: расстояние=${match.distance?.toFixed(1)}px, ` +
                      `valid=${match.distance < 50}, type=${match.matchType}`);
        });

        // 🔥 ИСПРАВЛЕНИЕ: Использовать реальный расчет процента
        const realPercentage = this.calculateRealMatchPercentage(matches, trackerPoints.length);

        return {
            matches: matches,
            perfectMatches: perfectMatches,
            goodMatches: goodMatches,
            totalMatches: matches.length,
            matchRate: realPercentage, // 🔥 ИСПОЛЬЗОВАТЬ РЕАЛЬНЫЙ ПРОЦЕНТ
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

            // 🔥 ВАЖНОЕ ПРАВИЛО: точка получает МАКСИМУМ из своего и шаблона
            const newConfirmations = Math.max(oldConfirmations, templateConfirmations);

            if (newConfirmations > oldConfirmations) {
                pointData.confirmedCount = newConfirmations;
                updatedCount++;
               
                // 🔥 ДИАГНОСТИКА: Записать обновление
                if (updatedCount < 5) {
                    console.log(`   🔄 Точка ${pointId}: ${oldConfirmations} → ${newConfirmations} подтверждений`);
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

        // Обновляем узлы графа на основе совпадений
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

    // 🔥 ФОЛЛБЭК: Прямое сравнение (старый метод, если нет трансформаций)
    fallbackDirectComparison(tracker, templateBuilder) {
        console.log(`🔄 Использую прямое сравнение (фоллбэк)...`);

        const templateData = templateBuilder.getVisualizationData();
        if (!templateData || !templateData.cells) {
            return 0;
        }

        // Прямое сравнение без трансформаций (старая логика)
        const templatePoints = templateData.cells.map(cell => ({
            x: cell.x || 0,
            y: cell.y || 0,
            confirmations: cell.confirmations || 1
        }));

        let updatedCount = 0;
        const threshold = 25;

        for (const [trackerId, trackerPoint] of tracker.points) {
            let bestDistance = Infinity;
            let bestConfirmations = 1;

            for (const templatePoint of templatePoints) {
                const distance = Math.sqrt(
                    Math.pow(templatePoint.x - trackerPoint.x, 2) +
                    Math.pow(templatePoint.y - trackerPoint.y, 2)
                );

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
            // 🔥 ИСПРАВЛЕНИЕ: Защита от ошибок при получении точек
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

            // 🔥 ПРОСТОЕ СРАВНЕНИЕ без сложных преобразований
            const matches = [];

            for (const point1 of points1) {
                let bestMatch = null;
                let minDistance = Infinity;

                for (const point2 of points2) {
                    const distance = Math.sqrt(
                        Math.pow(point2.x - point1.x, 2) +
                        Math.pow(point2.y - point1.y, 2)
                    );

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

        // Для каждого совпадения обновляем подтверждения в обоих следах
        matches.forEach(match => {
            // Обновляем в первом следе
            if (footprint1.pointTracker && match.point1 && match.point1.id) {
                const pointData = footprint1.pointTracker.points.get(match.point1.id);
                if (pointData) {
                    const oldCount = pointData.confirmedCount || 1;
                    const newCount = Math.max(oldCount, 2); // Минимум 2 подтверждения

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
        });

        console.log(`✅ Обновлено ${updatedCount} подтверждений`);
        return updatedCount;
    }

    // 🔥 МЕТОД: Преобразовать точки шаблона в систему отпечатка
    transformTemplatePointsToFootprintSystem(templateCells, templateTransformation, footprintTransformation) {
        const points = [];

        templateCells.forEach((cell, index) => {
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
                isNew: cell.isNew || false,
                status: cell.status || 'unknown',
                originalCell: cell,
                cellIndex: index
            });
        });

        return points;
    }

    // 🔥 МЕТОД: Проверить накопление деталей
    debugAccumulation(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel || !vectorModel.templateBuilder) {
            console.log('❌ Нет шаблона для проверки накопления');
            return;
        }

        const templateData = vectorModel.templateBuilder.getVisualizationData();

        console.log('\n🔍 ДЕБАГ НАКОПЛЕНИЯ ДЕТАЛЕЙ:');
        console.log(`Шаблон: ${templateData.name}`);
        console.log(`Всего ячеек: ${templateData.stats.totalCells}`);
        console.log(`Всего подтверждений: ${templateData.stats.totalConfirmations}`);

        // 🔥 СТАТИСТИКА ПО ТИПАМ ТОЧЕК
        const cells = templateData.cells || [];
        const byStatus = {};

        cells.forEach(cell => {
            const status = cell.status || 'unknown';
            byStatus[status] = (byStatus[status] || 0) + 1;
        });

        console.log('\n📊 РАСПРЕДЕЛЕНИЕ ПО СТАТУСАМ:');
        Object.entries(byStatus).forEach(([status, count]) => {
            const percent = ((count / cells.length) * 100).toFixed(1);
            console.log(`   ${status}: ${count} (${percent}%)`);
        });

        // 🔥 НОВЫЕ ТОЧКИ
        const newCells = cells.filter(c => c.isNew);
        console.log(`\n🆕 НОВЫЕ ТОЧКИ: ${newCells.length}`);
        newCells.slice(0, 3).forEach((cell, i) => {
            console.log(`   ${i + 1}. ${cell.id.slice(0, 12)}: ${cell.confirmations} подтверждений`);
        });

        // 🔥 КАЧЕСТВО ПОДТВЕРЖДЕНИЙ
        const confirmationDistribution = {};
        cells.forEach(cell => {
            const conf = cell.confirmations || 1;
            if (conf >= 5) confirmationDistribution['5+'] = (confirmationDistribution['5+'] || 0) + 1;
            else confirmationDistribution[conf] = (confirmationDistribution[conf] || 0) + 1;
        });

        console.log('\n📈 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:');
        Object.entries(confirmationDistribution).sort((a, b) => {
            const aKey = a[0] === '5+' ? 5 : parseInt(a[0]);
            const bKey = b[0] === '5+' ? 5 : parseInt(b[0]);
            return aKey - bKey;
        }).forEach(([confirmations, count]) => {
            const percent = ((count / cells.length) * 100).toFixed(1);
            console.log(`   ${confirmations}: ${count} (${percent}%)`);
        });

        // 🔥 ИСТОЧНИКИ (графы)
        const sources = new Set();
        cells.forEach(cell => {
            (cell.sources || []).forEach(source => sources.add(source));
        });

        console.log(`\n📁 ИСТОЧНИКИ: ${sources.size} различных графов`);

        // 🔥 КАЧЕСТВО ЭТАЛОНА
        console.log(`\n🎯 ЭТАЛОН: ${templateData.referenceGraphId?.slice(0, 8) || 'нет'}`);
        console.log(`   Качество: ${templateData.referenceGraphQuality?.toFixed(3) || 0}`);
        console.log(`   Лучший граф: ${templateData.dynamicInfo?.bestGraphId?.slice(0, 8) || 'нет'}`);
        console.log(`   Качество лучшего: ${templateData.dynamicInfo?.bestGraphQuality?.toFixed(3) || 0}`);
       
        // 🔥 ДИАГНОСТИКА: Проверить трансформации
        console.log(`\n🔧 ТРАНСФОРМАЦИИ ШАБЛОНА:`);
        const templateTransformation = vectorModel.templateBuilder.getNormalizationTransform();
        if (templateTransformation) {
            console.log(`   Ширина: ${templateTransformation.width?.toFixed(1)}`);
            console.log(`   Высота: ${templateTransformation.height?.toFixed(1)}`);
            console.log(`   Смещение: (${templateTransformation.minX?.toFixed(1)}, ${templateTransformation.minY?.toFixed(1)})`);
        } else {
            console.log(`   ❌ Нет трансформации шаблона`);
        }
    }

    // 🔥 ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ (оригинальные, без изменений)
   
    // Метод для получения статистики подтверждений
    getConfirmationStats(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { exists: false, stats: null };
        }
       
        const templateData = vectorModel.templateBuilder.getVisualizationData();
        const stats = templateData?.stats || {};
       
        return {
            exists: true,
            stats: {
                totalCells: stats.totalCells || 0,
                confirmedCells: stats.confirmedCells || 0,
                totalConfirmations: stats.totalConfirmations || 0,
                averageConfirmations: stats.averageConfirmations?.toFixed(2) || '0.00',
                referenceGraphId: templateData.referenceGraphId?.slice(0, 8) || 'none'
            }
        };
    }
   
    // Метод для очистки шаблона
    clearTemplateForUser(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { success: false, message: 'Шаблон не найден' };
        }
       
        // Сбрасываем шаблон
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
        const templateData = vectorModel.templateBuilder.getVisualizationData();
       
        // Проверка наличия данных
        if (!templateData) {
            errors.push('Нет данных шаблона');
        }
       
        if (!templateData.cells || templateData.cells.length === 0) {
            errors.push('Нет ячеек в шаблоне');
        }
       
        // Проверка трансформации
        const transformation = vectorModel.templateBuilder.getNormalizationTransform();
        if (!transformation) {
            errors.push('Нет трансформации шаблона');
        } else {
            if (!transformation.width || transformation.width < 1) {
                errors.push(`Неверная ширина шаблона: ${transformation.width}`);
            }
            if (!transformation.height || transformation.height < 1) {
                errors.push(`Неверная высота шаблона: ${transformation.height}`);
            }
        }
       
        // Проверка эталонного графа
        if (!templateData.referenceGraphId) {
            errors.push('Нет эталонного графа');
        }
       
        const isValid = errors.length === 0;
       
        console.log(`🔍 Проверка целостности шаблона ${userId}: ${isValid ? '✅' : '❌'}`);
        if (!isValid) {
            console.log(`   Ошибки: ${errors.join(', ')}`);
        }
       
        return {
            valid: isValid,
            errors: errors,
            stats: {
                cells: templateData.cells?.length || 0,
                transformation: !!transformation,
                referenceGraph: !!templateData.referenceGraphId
            }
        };
    }
   
    // Метод для получения визуализации шаблона
    getTemplateVisualizationData(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return null;
        }
       
        return vectorModel.templateBuilder.getVisualizationData();
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
       
        footprints.forEach((footprint, index) => {
            console.log(`   Обработка отпечатка ${index + 1}/${footprints.length}: ${footprint.name}`);
           
            try {
                // Получаем трансформацию отпечатка
                const transformation = footprint.getTransformation();
                if (!transformation) {
                    console.log(`   ⚠️ Нет трансформации, пропускаем`);
                    return;
                }
               
                // Добавляем граф в шаблон
                vectorModel.addGraph(footprint.graph, footprint.id, {
                    isBatchUpdate: true,
                    transformationInfo: transformation,
                    index: index
                });
               
                // Обновляем подтверждения
                const updated = this.updateConfirmationsFromTemplate(footprint, vectorModel, transformation);
                totalUpdated += updated;
               
                console.log(`   ✅ Обновлено: ${updated} точек`);
               
            } catch (error) {
                console.log(`   ❌ Ошибка обработки: ${error.message}`);
            }
        });
       
        console.log(`🎯 Итого обновлено: ${totalUpdated} точек из ${footprints.length} отпечатков`);
       
        return {
            success: true,
            totalUpdated: totalUpdated,
            footprintsProcessed: footprints.length
        };
    }
}

module.exports = TemplateCoordination;
