// modules/footprint/core/comparison/template-coordination.js
// 🔥 УПРОЩЁННАЯ ВЕРСИЯ (только 2 метода) - РАБОТАЕМ ТОЛЬКО В ВЕКТОРЕ

class TemplateCoordination {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
    }

    // 🔥 МЕТОД 1: Прямое обновление подтверждений между следами (ВЕКТОРНЫЙ)
    updateConfirmationsDirectly(footprint1, footprint2) {
        console.log(`\n🔄 Прямое обновление подтверждений (ВЕКТОРНЫЙ МЕТОД)...`);

        try {
            // 🔥 ИСПОЛЬЗУЕМ ТОЛЬКО ВЕКТОРНЫЕ ДАННЫЕ (без растровых трансформаций)
            if (!footprint1.pointTracker || !footprint1.pointTracker.points) {
                console.log(`❌ Нет pointTracker в ${footprint1.name}`);
                return 0;
            }

            if (!footprint2.pointTracker || !footprint2.pointTracker.points) {
                console.log(`❌ Нет pointTracker в ${footprint2.name}`);
                return 0;
            }

            // 🔥 БЕРЕМ ОРИГИНАЛЬНЫЕ ТОЧКИ БЕЗ ТРАНСФОРМАЦИЙ
            const points1 = this.getOriginalPoints(footprint1.pointTracker);
            const points2 = this.getOriginalPoints(footprint2.pointTracker);

            console.log(`🔍 Сравниваю ${points1.length} и ${points2.length} ВЕКТОРНЫХ точек`);

            let updatedCount = 0;
            const threshold = 25; // Порог в пикселях

            const matches = [];

            // 🔥 ПРОСТОЕ ВЕКТОРНОЕ СРАВНЕНИЕ (без трансформаций)
            for (const point1 of points1) {
                let bestMatch = null;
                let minDistance = Infinity;

                for (const point2 of points2) {
                    // 🔥 ЕВКЛИДОВО РАССТОЯНИЕ В ВЕКТОРНОМ ПРОСТРАНСТВЕ
                    const distance = Math.sqrt(
                        Math.pow(point2.x - point1.x, 2) +
                        Math.pow(point2.y - point1.y, 2)
                    );

                    if (distance < minDistance && distance < threshold) {
                        minDistance = distance;
                        bestMatch = {
                            point1: point1,
                            point2: point2,
                            distance: distance
                        };
                    }
                }

                if (bestMatch) {
                    matches.push(bestMatch);
                }
            }

            console.log(`📊 Найдено ${matches.length} совпадений (<${threshold}px)`);

            // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ ТОЛЬКО ДЛЯ СОВПАВШИХ ТОЧЕК
            for (const match of matches) {
                updatedCount += this.updatePointConfirmation(footprint1, match.point1, match.distance, footprint2.id);
                updatedCount += this.updatePointConfirmation(footprint2, match.point2, match.distance, footprint1.id);
            }

            console.log(`✅ Обновлено ${updatedCount} точек (ВЕКТОРНЫЙ МЕТОД)`);
            return updatedCount;

        } catch (error) {
            console.log(`❌ Ошибка в updateConfirmationsDirectly: ${error.message}`);
            return 0;
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Получить оригинальные точки (без трансформаций)
    getOriginalPoints(tracker) {
        const points = [];
       
        if (!tracker || !tracker.points) return points;

        for (const [id, pointData] of tracker.points) {
            // 🔥 БЕРЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЛИ ТЕКУЩИЕ (без трансформаций)
            const originalCoords = pointData.originalCoordinates || { x: pointData.x, y: pointData.y };
           
            points.push({
                id: id,
                x: originalCoords.x || pointData.x || 0,
                y: originalCoords.y || pointData.y || 0,
                confidence: pointData.rating || pointData.confidence || 0.5,
                confirmedCount: pointData.confirmedCount || 1,
                pointData: pointData
            });
        }

        return points;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Обновить подтверждение точки
    updatePointConfirmation(footprint, point, distance, matchedWithId) {
        if (!footprint.pointTracker) return 0;

        const pointData = footprint.pointTracker.points.get(point.id);
        if (!pointData) return 0;

        const oldCount = pointData.confirmedCount || 1;
       
        // 🔥 КАЧЕСТВО СОВПАДЕНИЯ ОБРАТНО ПРОПОРЦИОНАЛЬНО РАССТОЯНИЮ
        const matchQuality = Math.max(0, 1 - distance / 50);
        const additionalConfirmations = matchQuality > 0.8 ? 2 : 1;
       
        const newCount = Math.max(oldCount, oldCount + additionalConfirmations);

        if (newCount > oldCount) {
            pointData.confirmedCount = newCount;
            pointData.lastConfirmed = new Date();
            pointData.confirmedBy = pointData.confirmedBy || [];
            pointData.confirmedBy.push(`vector_match_with_${matchedWithId}`);
            return 1;
        }

        return 0;
    }

    // 🔥 МЕТОД 2: Дебаг накопления (ВЕКТОРНЫЙ)
    debugAccumulation(userId) {
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (!vectorModel || !vectorModel.templateBuilder) {
            console.log('❌ Нет шаблона для проверки накопления');
            return;
        }

        const templateData = vectorModel.templateBuilder.getVisualizationData();

        console.log('\n🔍 ДЕБАГ НАКОПЛЕНИЯ ДЕТАЛЕЙ (ВЕКТОРНЫЙ):');
        console.log(`Шаблон: ${templateData.name}`);
        console.log(`Всего ячеек: ${templateData.stats.totalCells}`);
        console.log(`Всего подтверждений: ${templateData.stats.totalConfirmations}`);

        // 🔥 ПРОВЕРЯЕМ, ЧТО РАБОТАЕМ С ВЕКТОРНЫМИ ДАННЫМИ
        const cells = templateData.cells || [];
        const vectorCells = cells.filter(cell =>
            typeof cell.x === 'number' && typeof cell.y === 'number' &&
            !isNaN(cell.x) && !isNaN(cell.y)
        );

        console.log(`✅ Векторных ячеек: ${vectorCells.length}/${cells.length}`);

        if (vectorCells.length > 0) {
            // Показываем примеры координат
            console.log('\n📐 Примеры векторных координат:');
            vectorCells.slice(0, 3).forEach((cell, i) => {
                console.log(`   Ячейка ${i + 1}: (${cell.x.toFixed(1)}, ${cell.y.toFixed(1)})`);
            });
        }
    }

    // 🔥 ДОПОЛНИТЕЛЬНЫЙ МЕТОД: Быстрая проверка векторной целостности
    checkVectorIntegrity(footprint) {
        if (!footprint || !footprint.pointTracker) {
            return { valid: false, reason: 'Нет трекера точек' };
        }

        const points = this.getOriginalPoints(footprint.pointTracker);
        const validPoints = points.filter(p =>
            typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );

        const integrity = validPoints.length / Math.max(1, points.length);

        return {
            valid: integrity > 0.9,
            integrity: integrity,
            totalPoints: points.length,
            validPoints: validPoints.length,
            invalidPoints: points.length - validPoints.length
        };
    }
}

module.exports = TemplateCoordination;
