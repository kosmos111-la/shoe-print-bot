// modules/footprint/core/comparison/template-coordination.js
// 🔥 ВЫНЕСЕННАЯ ЛОГИКА РАБОТЫ С ШАБЛОНАМИ И ПОДТВЕРЖДЕНИЯМИ

class TemplateCoordination {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Обновление подтверждений с правильной трансформацией
    updateConfirmationsFromTemplate(footprint, vectorModel, transformationInfo = null) {
        console.log(`🔄 ОБНОВЛЯЮ ПОДТВЕРЖДЕНИЯ с ПРАВИЛЬНОЙ ТРАНСФОРМАЦИЕЙ...`);

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
        console.log(`   Центр: (${footprintTransformation.center?.x?.toFixed(1)}, ${footprintTransformation.center?.y?.toFixed(1)})`);

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
        console.log(`   Границы: ${templateTransformation.width?.toFixed(1)}x${templateTransformation.height?.toFixed(1)}`);
        console.log(`   Смещение: (${templateTransformation.minX?.toFixed(1)}, ${templateTransformation.minY?.toFixed(1)})`);

        // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: ПРОСТОЕ ПРЕОБРАЗОВАНИЕ КООРДИНАТ
        const templatePointsInFootprintSystem = [];

        // Для каждой ячейки шаблона
        templateData.cells.forEach((cell, index) => {
            // Координаты в нормализованной системе шаблона (0-1)
            const normalizedX = cell.nx || 0;
            const normalizedY = cell.ny || 0;

            // 1. Преобразуем нормализованные координаты в реальные координаты шаблона
            const templateX = normalizedX * templateTransformation.width + templateTransformation.minX;
            const templateY = normalizedY * templateTransformation.height + templateTransformation.minY;

            // 🔥 ПРОСТОЕ РЕШЕНИЕ: Предполагаем, что шаблон уже в нормализованной системе (угол 0°)
            // И точка шаблона уже в правильной системе координат

            // 2. Если отпечаток имеет трансформацию (поворот), применяем ее к точке
            let transformedX = templateX;
            let transformedY = templateY;

            const footprintAngle = footprintTransformation.rotationAngle || 0;

            if (footprintAngle !== 0 && footprintTransformation.center) {
                // Применяем поворот отпечатка к точке шаблона
                const centerX = footprintTransformation.center.x || 0;
                const centerY = footprintTransformation.center.y || 0;

                // Переносим в систему координат с центром в центре отпечатка
                const dx = templateX - centerX;
                const dy = templateY - centerY;

                // Поворачиваем
                const angleRad = -footprintAngle * Math.PI / 180; // Отрицательный, потому что мы компенсируем поворот
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                const rotatedX = dx * cosA - dy * sinA;
                const rotatedY = dx * sinA + dy * cosA;

                // Возвращаем в исходную систему координат
                transformedX = rotatedX + centerX;
                transformedY = rotatedY + centerY;

                // Дебаг для первых точек
                if (index < 3) {
                    console.log(`   Ячейка ${cell.id?.slice(0, 8)}:`);
                    console.log(`     В шаблоне: (${templateX.toFixed(1)}, ${templateY.toFixed(1)})`);
                    console.log(`     После поворота ${footprintAngle.toFixed(1)}°: (${transformedX.toFixed(1)}, ${transformedY.toFixed(1)})`);
                }
            }

            templatePointsInFootprintSystem.push({
                x: transformedX,
                y: transformedY,
                nx: normalizedX,
                ny: normalizedY,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id,
                isNew: cell.isNew || false,
                status: cell.status || 'unknown',
                originalTemplatePoint: { x: templateX, y: templateY },
                originalCell: cell,
                cellIndex: index
            });
        });

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

        // 5. ДЕБАГ: Показываем примеры координат
        if (trackerPoints.length > 0 && templatePointsInFootprintSystem.length > 0) {
            console.log(`\n🔍 ПРИМЕРЫ КООРДИНАТ (первые 3):`);

            for (let i = 0; i < Math.min(3, trackerPoints.length); i++) {
                const trackerPoint = trackerPoints[i];
                console.log(`   Точка трекера ${i+1}: (${trackerPoint.x.toFixed(1)}, ${trackerPoint.y.toFixed(1)})`);

                // Ищем ближайшую точку шаблона
                let nearestTemplate = null;
                let minDistance = Infinity;

                for (const templatePoint of templatePointsInFootprintSystem) {
                    const distance = Math.sqrt(
                        Math.pow(templatePoint.x - trackerPoint.x, 2) +
                        Math.pow(templatePoint.y - trackerPoint.y, 2)
                    );

                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestTemplate = templatePoint;
                    }
                }

                if (nearestTemplate) {
                    console.log(`   Ближайшая точка шаблона: (${nearestTemplate.x.toFixed(1)}, ${nearestTemplate.y.toFixed(1)})`);
                    console.log(`   Расстояние: ${minDistance.toFixed(1)}px`);
                }
            }
        }

        // 6. СРАВНИВАЕМ ТОЧКИ
        const comparisonResult = this.comparePointsInSameCoordinateSystem(
            trackerPoints,
            templatePointsInFootprintSystem,
            footprintTransformation
        );

        // 7. ПРИМЕНЯЕМ РЕЗУЛЬТАТЫ
        const updatedCount = this.applyComparisonToTracker(
            tracker,
            comparisonResult.matches
        );

        // 8. ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ В ОТПЕЧАТКЕ
        this.updateFootprintConfirmations(footprint, comparisonResult.matches);

        console.log(`\n🎯 РЕЗУЛЬТАТ СРАВНЕНИЯ С ШАБЛОНОМ:`);
        console.log(`   • Всего точек трекера: ${trackerPoints.length}`);
        console.log(`   • Всего точек шаблона: ${templatePointsInFootprintSystem.length}`);
        console.log(`   • Найдено совпадений: ${comparisonResult.matches.length}`);
        console.log(`   • Идеальные (<15px): ${comparisonResult.perfectMatches}`);
        console.log(`   • Хорошие (15-30px): ${comparisonResult.goodMatches}`);
        console.log(`   • Обновлено точек: ${updatedCount}`);
        console.log(`   • Процент совпадений: ${comparisonResult.matchRate.toFixed(1)}%`);

        return updatedCount;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Сравнить точки в одной системе координат
    comparePointsInSameCoordinateSystem(trackerPoints, templatePoints, transformation) {
        console.log(`🔍 Сравниваю ${trackerPoints.length} и ${templatePoints.length} точек...`);

        const matches = [];
        let perfectMatches = 0;
        let goodMatches = 0;

        const PERFECT_THRESHOLD = 15;    // 15px - точное совпадение
        const GOOD_THRESHOLD = 30;       // 30px - хорошее совпадение
        const MAX_THRESHOLD = 50;        // 50px - максимальное

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

        // РАСЧЕТ СТАТИСТИКИ
        const totalMatches = matches.length;
        const matchRate = trackerPoints.length > 0 ? (totalMatches / trackerPoints.length * 100) : 0;

        return {
            matches: matches,
            perfectMatches: perfectMatches,
            goodMatches: goodMatches,
            totalMatches: totalMatches,
            matchRate: matchRate,
            trackerPointsCount: trackerPoints.length,
            templatePointsCount: templatePoints.length,
            transformationUsed: transformation
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Рассчитать качество совпадения
    calculateMatchQuality(distance, templateConfidence) {
        const distanceScore = Math.max(0, 1 - distance / 50);
        const confidenceScore = templateConfidence || 0.5;
        return (distanceScore * 0.7 + confidenceScore * 0.3);
    }

    // 🔥 НОВЫЙ МЕТОД: Применить результаты сравнения к трекеру
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
            }
        }

        return updatedCount;
    }

    // 🔥 НОВЫЙ МЕТОД: Обновить подтверждения в отпечатке
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

    // 🔥 НОВЫЙ МЕТОД: Прямое обновление подтверждений между следами
    updateConfirmationsDirectly(footprint1, footprint2) {
        console.log(`🔄 Прямое обновление подтверждений между двумя следами...`);

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

    // 🔥 НОВЫЙ МЕТОД: Обновить подтверждения из совпадений
    updateConfirmationsFromMatches(footprint1, footprint2, matches) {
        console.log(`🔄 Обновляю подтверждения из ${matches.length} совпадений...`);

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

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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

    // 🔥 ДЕБАГ МЕТОД: Проверить накопление деталей
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
            console.log(`   ${status}: ${count} (${percent}%)`);
        });

        // 🔥 НОВЫЕ ТОЧКИ
        const newCells = cells.filter(c => c.isNew);
        console.log(`\n🆕 НОВЫЕ ТОЧКИ: ${newCells.length}`);
        newCells.slice(0, 3).forEach((cell, i) => {
            console.log(`   ${i + 1}. ${cell.id.slice(0, 12)}: ${cell.confirmations} подтверждений`);
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
            console.log(`   ${confirmations}: ${count} (${percent}%)`);
        });

        // 🔥 ИСТОЧНИКИ (графы)
        const sources = new Set();
        cells.forEach(cell => {
            (cell.sources || []).forEach(source => sources.add(source));
        });

        console.log(`\n📁 ИСТОЧНИКИ: ${sources.size} различных графов`);

        // 🔥 КАЧЕСТВО ЭТАЛОНА
        console.log(`\n🎯 ЭТАЛОН: ${templateData.referenceGraphId?.slice(0, 8) || 'нет'}`);
        console.log(`   Качество: ${templateData.referenceGraphQuality?.toFixed(3) || 0}`);
        console.log(`   Лучший граф: ${templateData.dynamicInfo?.bestGraphId?.slice(0, 8) || 'нет'}`);
        console.log(`   Качество лучшего: ${templateData.dynamicInfo?.bestGraphQuality?.toFixed(3) || 0}`);
    }
}

module.exports = TemplateCoordination;
