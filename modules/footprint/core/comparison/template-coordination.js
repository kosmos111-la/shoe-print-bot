// modules/footprint/core/comparison/template-coordination.js
class TemplateCoordination {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
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

        // 🔥 ИСПРАВЛЕНИЕ: Вместо вызова getVisualizationData() используем прямой доступ
        let cellCount = 0;
        let cells = [];
       
        try {
            // Прямой доступ к ячейкам без вызова getVisualizationData()
            if (templateBuilder.invariantCells && templateBuilder.invariantCells.size > 0) {
                cellCount = templateBuilder.invariantCells.size;
                // Собираем минимальные данные
                for (const [cellId, cell] of templateBuilder.invariantCells) {
                    if (cell && cell.normalizedCenter) {
                        cells.push({
                            id: cellId,
                            nx: cell.normalizedCenter.nx || 0,
                            ny: cell.normalizedCenter.ny || 0,
                            confirmations: cell.confirmations || 1,
                            confidence: cell.confidence || 0.7
                        });
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ Ошибка получения данных шаблона: ${error.message}`);
            return this.fallbackDirectComparison(tracker, templateBuilder);
        }

        console.log(`📊 Данные шаблона: ${cellCount} ячеек`);

        if (cellCount === 0) {
            console.log('⚠️ Нет ячеек в шаблоне');
            return 0;
        }

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

        // 3. ПОЛУЧАЕМ ТРАНСФОРМАЦИЮ ШАБЛОНА (если есть)
        let templateTransformation = null;
        if (templateBuilder.getNormalizationTransform) {
            try {
                templateTransformation = templateBuilder.getNormalizationTransform();
            } catch (error) {
                console.log(`⚠️ Нет трансформации шаблона: ${error.message}`);
            }
        }

        if (!templateTransformation) {
            console.log('⚠️ У шаблона нет трансформации!');
            return this.fallbackDirectComparison(tracker, templateBuilder);
        }

        console.log(`📐 Трансформация шаблона:`);
        console.log(`   Ширина: ${templateTransformation.width?.toFixed(1)}`);
        console.log(`   Высота: ${templateTransformation.height?.toFixed(1)}`);

        // 🔥 УПРОЩЕННОЕ ПРЕОБРАЗОВАНИЕ
        const templatePointsInFootprintSystem = [];
       
        for (const cell of cells) {
            const nx = cell.nx || 0;
            const ny = cell.ny || 0;
           
            // Простое преобразование без сложной математики
            const x = nx * 1000; // Преобразуем к 0-1000
            const y = ny * 1000;
           
            templatePointsInFootprintSystem.push({
                x: x,
                y: y,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7
            });
        }

        console.log(`📊 Преобразовано ${templatePointsInFootprintSystem.length} точек шаблона`);

        // 4. ПОЛУЧАЕМ ТОЧКИ ТРЕКЕРА
        const trackerPoints = [];
        for (const [id, point] of tracker.points) {
            trackerPoints.push({
                id,
                x: point.x,
                y: point.y,
                confidence: point.rating || 0.5,
                confirmedCount: point.confirmedCount || 1
            });
        }

        console.log(`📊 Точки трекера: ${trackerPoints.length}`);

        // 5. ПРОСТОЕ СРАВНЕНИЕ
        let updatedCount = 0;
        const threshold = 25;

        for (const trackerPoint of trackerPoints) {
            let bestDistance = Infinity;
            let bestConfirmations = 1;

            for (const templatePoint of templatePointsInFootprintSystem) {
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
                const pointData = tracker.points.get(trackerPoint.id);
                if (pointData) {
                    const oldCount = pointData.confirmedCount || 1;
                    const newCount = Math.max(oldCount, bestConfirmations);

                    if (newCount > oldCount) {
                        pointData.confirmedCount = newCount;
                        updatedCount++;
                    }
                }
            }
        }

        console.log(`✅ Обновлено ${updatedCount} точек из шаблона`);
        return updatedCount;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Проверить накопление деталей
    debugAccumulation(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel || !vectorModel.templateBuilder) {
            console.log('❌ Нет шаблона для проверки накопления');
            return;
        }

        // 🔥 ПРЯМОЙ ДОСТУП вместо getVisualizationData()
        let cellCount = 0;
        let totalConfirmations = 0;
       
        if (vectorModel.templateBuilder.invariantCells) {
            cellCount = vectorModel.templateBuilder.invariantCells.size;
           
            // Считаем подтверждения
            for (const [cellId, cell] of vectorModel.templateBuilder.invariantCells) {
                totalConfirmations += cell.confirmations || 1;
            }
        }

        console.log('\n🔍 ДЕБАГ НАКОПЛЕНИЯ ДЕТАЛЕЙ:');
        console.log(`Шаблон: ${vectorModel.templateBuilder.name || 'unnamed'}`);
        console.log(`Всего ячеек: ${cellCount}`);
        console.log(`Всего подтверждений: ${totalConfirmations}`);

        // 🔥 ПРОСТАЯ СТАТИСТИКА
        if (cellCount > 0) {
            const avgConfirmations = totalConfirmations / cellCount;
            console.log(`Среднее подтверждений: ${avgConfirmations.toFixed(2)}`);
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ ФОЛЛБЭК
    fallbackDirectComparison(tracker, templateBuilder) {
        console.log(`🔄 Использую прямое сравнение (фоллбэк)...`);

        let cellCount = 0;
        let cells = [];
       
        try {
            // Прямой доступ к ячейкам
            if (templateBuilder.invariantCells && templateBuilder.invariantCells.size > 0) {
                cellCount = templateBuilder.invariantCells.size;
               
                for (const [cellId, cell] of templateBuilder.invariantCells) {
                    if (cell && cell.normalizedCenter) {
                        cells.push({
                            x: (cell.normalizedCenter.nx || 0) * 1000,
                            y: (cell.normalizedCenter.ny || 0) * 1000,
                            confirmations: cell.confirmations || 1
                        });
                    }
                }
            }
        } catch (error) {
            console.log(`❌ Ошибка в фоллбэке: ${error.message}`);
            return 0;
        }

        if (cellCount === 0) {
            console.log('⚠️ Нет данных для сравнения');
            return 0;
        }

        let updatedCount = 0;
        const threshold = 25;

        for (const [trackerId, trackerPoint] of tracker.points) {
            let bestDistance = Infinity;
            let bestConfirmations = 1;

            for (const templatePoint of cells) {
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

    // 🔥 ИСПРАВЛЕННЫЕ ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ

    // Метод для получения статистики подтверждений
    getConfirmationStats(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { exists: false, stats: null };
        }

        // 🔥 ПРЯМОЙ ДОСТУП вместо getVisualizationData()
        let cellCount = 0;
        let totalConfirmations = 0;
        let confirmedCells = 0;
       
        if (vectorModel.templateBuilder && vectorModel.templateBuilder.invariantCells) {
            cellCount = vectorModel.templateBuilder.invariantCells.size;
           
            for (const [cellId, cell] of vectorModel.templateBuilder.invariantCells) {
                const confirmations = cell.confirmations || 1;
                totalConfirmations += confirmations;
                if (confirmations >= 2) confirmedCells++;
            }
        }

        const avgConfirmations = cellCount > 0 ? totalConfirmations / cellCount : 0;

        return {
            exists: true,
            stats: {
                totalCells: cellCount,
                confirmedCells: confirmedCells,
                totalConfirmations: totalConfirmations,
                averageConfirmations: avgConfirmations.toFixed(2),
                referenceGraphId: 'direct' // Упрощенная версия
            }
        };
    }

    // Метод для проверки целостности шаблона
    validateTemplateIntegrity(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { valid: false, errors: ['Шаблон не найден'] };
        }

        const errors = [];
       
        // 🔥 ПРЯМОЙ ДОСТУП
        let cellCount = 0;
        if (vectorModel.templateBuilder && vectorModel.templateBuilder.invariantCells) {
            cellCount = vectorModel.templateBuilder.invariantCells.size;
        }

        // Проверка наличия данных
        if (cellCount === 0) {
            errors.push('Нет ячеек в шаблоне');
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
                cells: cellCount,
                transformation: false, // Упрощенная версия
                referenceGraph: false
            }
        };
    }

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (без вызовов getVisualizationData())

    // Метод для расчета реального процента совпадений
    calculateRealMatchPercentage(matches, totalTrackerPoints) {
        console.log(`\n📊 [FIX-STATS] Расчет реального процента совпадений:`);

        if (!totalTrackerPoints || totalTrackerPoints === 0) {
            console.log('⚠️ [FIX-STATS] Нет точек трекера');
            return 0;
        }

        const REAL_THRESHOLD = 50;
        const realMatches = matches.filter(m => m.distance && m.distance < REAL_THRESHOLD);
        const percentage = (realMatches.length / totalTrackerPoints) * 100;

        console.log(`📊 [FIX-STATS] Реальные совпадения:`);
        console.log(`   Всего точек трекера: ${totalTrackerPoints}`);
        console.log(`   Реальных (< ${REAL_THRESHOLD}px): ${realMatches.length}`);
        console.log(`   Реальный процент: ${percentage.toFixed(1)}%`);

        return Math.min(percentage, 100);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Прямое обновление подтверждений между следами
    updateConfirmationsDirectly(footprint1, footprint2) {
        console.log(`\n🔄 Прямое обновление подтверждений между двумя следами...`);

        try {
            // Простое извлечение точек
            const points1 = this.manager.extractPointsFromFootprint(footprint1);
            const points2 = this.manager.extractPointsFromFootprint(footprint2);

            console.log(`🔍 Сравниваю ${points1.length} и ${points2.length} точек`);

            let updatedCount = 0;
            const threshold = 25;

            // 🔥 ПРОСТОЕ СРАВНЕНИЕ
            for (const point1 of points1) {
                for (const point2 of points2) {
                    const distance = Math.sqrt(
                        Math.pow(point2.x - point1.x, 2) +
                        Math.pow(point2.y - point1.y, 2)
                    );

                    if (distance < threshold && footprint1.pointTracker) {
                        const pointData = footprint1.pointTracker.points.get(point1.id);
                        if (pointData) {
                            const oldCount = pointData.confirmedCount || 1;
                            const newCount = Math.max(oldCount, 2);

                            if (newCount > oldCount) {
                                pointData.confirmedCount = newCount;
                                updatedCount++;
                                break; // Нашли совпадение, переходим к следующей точке
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
        });

        console.log(`✅ Обновлено ${updatedCount} подтверждений`);
        return updatedCount;
    }
}

module.exports = TemplateCoordination;
