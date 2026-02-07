// modules/footprint/core/comparison/template-coordination.js
// 🔥 УПРОЩЁННАЯ ВЕРСИЯ (только 2 метода)

class TemplateCoordination {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
    }

    // 🔥 МЕТОД 1: Прямое обновление подтверждений между следами
    updateConfirmationsDirectly(footprint1, footprint2) {
        console.log(`\n🔄 Прямое обновление подтверждений между двумя следами...`);

        try {
            if (!footprint1.pointTracker || !footprint1.pointTracker.points) {
                console.log(`❌ Нет pointTracker в ${footprint1.name}`);
                return 0;
            }

            if (!footprint2.pointTracker || !footprint2.pointTracker.points) {
                console.log(`❌ Нет pointTracker в ${footprint2.name}`);
                return 0;
            }

            const points1 = Array.from(footprint1.pointTracker.points.values());
            const points2 = Array.from(footprint2.pointTracker.points.values());

            console.log(`🔍 Сравниваю ${points1.length} и ${points2.length} точек из трекеров`);

            let updatedCount = 0;
            const threshold = 25;

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

            for (const match of matches) {
                const pointId1 = match.point1.id || `pt_${match.point1.x}_${match.point1.y}`;
                const pointData1 = footprint1.pointTracker.points.get(pointId1);
               
                if (pointData1) {
                    const oldCount1 = pointData1.confirmedCount || 1;
                    const newCount1 = Math.max(oldCount1, 2);

                    if (newCount1 > oldCount1) {
                        pointData1.confirmedCount = newCount1;
                        pointData1.lastConfirmed = new Date();
                        pointData1.confirmedBy = pointData1.confirmedBy || [];
                        pointData1.confirmedBy.push(`match_with_${footprint2.id}`);
                        updatedCount++;
                    }
                }

                const pointId2 = match.point2.id || `pt_${match.point2.x}_${match.point2.y}`;
                const pointData2 = footprint2.pointTracker.points.get(pointId2);
               
                if (pointData2) {
                    const oldCount2 = pointData2.confirmedCount || 1;
                    const newCount2 = Math.max(oldCount2, 2);

                    if (newCount2 > oldCount2) {
                        pointData2.confirmedCount = newCount2;
                        pointData2.lastConfirmed = new Date();
                        pointData2.confirmedBy = pointData2.confirmedBy || [];
                        pointData2.confirmedBy.push(`match_with_${footprint1.id}`);
                        updatedCount++;
                    }
                }
            }

            console.log(`✅ Обновлено ${updatedCount} точек (только совпавшие!)`);
            return updatedCount;

        } catch (error) {
            console.log(`❌ Ошибка в updateConfirmationsDirectly: ${error.message}`);
            return 0;
        }
    }

    // 🔥 МЕТОД 2: Дебаг накопления
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
    }
}

module.exports = TemplateCoordination;
