// modules/footprint/analysis/feature-table.js
// 📊 ТАБЛИЦА ВСЕХ ПРИЗНАКОВ ДЛЯ ТОЧЕК СЛЕДА

class FeatureTable {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.showAllFeatures = options.showAllFeatures || false;
        this.maxPointsToShow = options.maxPointsToShow || 30; // ограничим вывод
    }

    /**
     * Генерирует таблицу признаков для всех точек следа
     */
    generateTable(footprintData) {
        const {
            points = [],
            graph = { nodes: new Map() },
            roles = new Map(),
            morphology = new Map()
        } = footprintData;

        if (points.length === 0) {
            console.log('📭 Нет данных для анализа');
            return;
        }

        console.log(`\n${'='.repeat(120)}`);
        console.log(`📊 ТАБЛИЦА ПРИЗНАКОВ ТОЧЕК СЛЕДА`);
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📊 Всего точек: ${points.length}`);
        console.log(`${'='.repeat(120)}`);

        // Сортируем точки по важности (сначала хабы, потом по степени)
        const sortedPoints = this.sortPointsByImportance(points, roles, graph);

        // Выводим общую статистику
        this.printSummaryStats(points, roles, morphology);

        // Выводим таблицу
        this.printFeatureTable(sortedPoints.slice(0, this.maxPointsToShow), {
            graph,
            roles,
            morphology
        });

        if (points.length > this.maxPointsToShow) {
            console.log(`\n... и еще ${points.length - this.maxPointsToShow} точек`);
        }
    }

    /**
     * Сортировка точек по важности (сначала уникальные, потом хабы, потом по степени)
     */
    sortPointsByImportance(points, roles, graph) {
        return points.sort((a, b) => {
            const roleA = roles.get(a.id) || 'R';
            const roleB = roles.get(b.id) || 'R';
           
            // Сначала хабы
            if (roleA === 'H' && roleB !== 'H') return -1;
            if (roleA !== 'H' && roleB === 'H') return 1;
           
            // Потом клики
            if (roleA === 'C' && roleB !== 'C') return -1;
            if (roleA !== 'C' && roleB === 'C') return 1;
           
            // Потом мосты
            if (roleA === 'B' && roleB !== 'B') return -1;
            if (roleA !== 'B' && roleB === 'B') return 1;
           
            // По степени (убывание)
            const degreeA = graph.nodes.get(a.id)?.degree || 0;
            const degreeB = graph.nodes.get(b.id)?.degree || 0;
            return degreeB - degreeA;
        });
    }

    /**
     * Общая статистика по следу
     */
    printSummaryStats(points, roles, morphology) {
        const roleStats = { H: 0, B: 0, C: 0, R: 0, L: 0 };
        for (const role of roles.values()) {
            roleStats[role] = (roleStats[role] || 0) + 1;
        }

        let withMorphology = 0;
        for (const point of points) {
            if (morphology.get(point.id)?.hasContour) withMorphology++;
        }

        console.log(`\n📈 СТАТИСТИКА СЛЕДА:`);
        console.log(`   • Хабы (H): ${roleStats.H}`);
        console.log(`   • Мосты (B): ${roleStats.B}`);
        console.log(`   • Клики (C): ${roleStats.C}`);
        console.log(`   • Обычные (R): ${roleStats.R}`);
        console.log(`   • Листья (L): ${roleStats.L}`);
        console.log(`   • С морфологией: ${withMorphology}/${points.length}`);
        console.log();
    }

    /**
     * Основная таблица признаков
     */
    printFeatureTable(points, { graph, roles, morphology }) {
        // Заголовок таблицы
        console.log(`┌─────┬──────────────────────┬─────┬─────┬─────┬──────────┬──────────┬──────────┬──────────┐`);
        console.log(`│  #  │         ТОЧКА         │ Роль│ Ст. │ Тр-ки│ Компактн │ Площадь  │ Соседи   │ Уник.    │`);
        console.log(`├─────┼──────────────────────┼─────┼─────┼─────┼──────────┼──────────┼──────────┼──────────┤`);

        let idx = 1;
        for (const point of points) {
            const node = graph.nodes.get(point.id) || {};
            const role = roles.get(point.id) || 'R';
            const morph = morphology.get(point.id) || {};
           
            // Собираем признаки
            const degree = node.degree || 0;
            const triangles = this.countTrianglesForPoint(point.id, graph);
            const compactness = morph.compactness ? morph.compactness.toFixed(2) : '  -   ';
            const area = morph.normalizedArea ? morph.normalizedArea.toFixed(2) : '  -   ';
            const neighborRoles = this.getNeighborRoles(point.id, graph, roles);
           
            // Оцениваем уникальность (упрощенно)
            const uniqueness = this.estimateUniqueness(point, {
                degree,
                role,
                compactness: morph.compactness,
                neighborRoles
            });

            console.log(
                `│ ${idx.toString().padEnd(3)} │ ${point.id.substring(0,20).padEnd(20)} │ ` +
                `${role.padEnd(3)} │ ${degree.toString().padEnd(3)} │ ${triangles.toString().padEnd(3)} │ ` +
                `${compactness.padStart(8)} │ ${area.padStart(8)} │ ${neighborRoles.padStart(8)} │ ` +
                `${uniqueness.padStart(8)} │`
            );

            idx++;
            if (idx > this.maxPointsToShow) break;
        }

        console.log(`└─────┴──────────────────────┴─────┴─────┴─────┴──────────┴──────────┴──────────┴──────────┘`);
       
        // Легенда
        console.log(`\n📋 ЛЕГЕНДА:`);
        console.log(`   • Роль: H-хаб, B-мост, C-клика, R-обычный, L-лист`);
        console.log(`   • Ст. - степень (количество связей)`);
        console.log(`   • Тр-ки - количество треугольников`);
        console.log(`   • Компактн - компактность (периметр²/площадь)`);
        console.log(`   • Площадь - нормированная площадь`);
        console.log(`   • Соседи - паттерн ролей соседей (H-хаб,R-обычный,L-лист)`);
        console.log(`   • Уник. - оценка уникальности (НИЗКАЯ/СРЕДНЯЯ/ВЫСОКАЯ)`);
    }

    /**
     * Подсчет треугольников для точки
     */
    countTrianglesForPoint(pointId, graph) {
        // Упрощенная реализация
        const node = graph.nodes.get(pointId);
        if (!node || node.degree < 2) return 0;

        // Здесь должен быть реальный подсчет
        return Math.floor(Math.random() * 5); // Заглушка
    }

    /**
     * Получение ролей соседей
     */
    getNeighborRoles(pointId, graph, roles) {
        const neighbors = this.findNodeNeighbors(pointId, graph);
        const roleList = neighbors
            .map(n => roles.get(n.id))
            .filter(r => r)
            .sort()
            .join('');
       
        // Обрезаем до 8 символов
        return roleList.length > 8 ? roleList.substring(0,8) + '…' : roleList.padEnd(8);
    }

    /**
     * Поиск соседей узла
     */
    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        if (!graph?.edges) return neighbors;

        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) {
                const node = graph.nodes.get(b);
                if (node) neighbors.push(node);
            }
            if (b === nodeId) {
                const node = graph.nodes.get(a);
                if (node) neighbors.push(node);
            }
        }
        return neighbors;
    }

    /**
     * Оценка уникальности точки
     */
    estimateUniqueness(point, features) {
        let score = 0;
       
        // Хабы более уникальны
        if (features.role === 'H') score += 30;
        if (features.role === 'C') score += 20;
        if (features.role === 'B') score += 15;
       
        // Высокая степень
        if (features.degree > 10) score += 20;
        else if (features.degree > 5) score += 10;
       
        // Необычная компактность
        if (features.compactness) {
            if (features.compactness < 10) score += 10;
            if (features.compactness > 20) score += 10;
        }
       
        // Уникальный паттерн соседей
        if (features.neighborRoles && features.neighborRoles.length > 5) score += 20;
       
        if (score >= 50) return 'ВЫСОКАЯ';
        if (score >= 25) return 'СРЕДНЯЯ';
        return 'НИЗКАЯ';
    }

    /**
     * Детальная таблица для конкретной точки
     */
    printPointDetails(pointId, footprintData) {
        const { graph, roles, morphology } = footprintData;
       
        const point = graph.nodes.get(pointId);
        if (!point) {
            console.log(`❌ Точка ${pointId} не найдена`);
            return;
        }

        const role = roles.get(pointId) || 'R';
        const morph = morphology.get(pointId) || {};
        const neighbors = this.findNodeNeighbors(pointId, graph);

        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 ДЕТАЛИ ТОЧКИ: ${pointId}`);
        console.log(`${'='.repeat(80)}`);
       
        console.log(`📌 Координаты: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        console.log(`🎭 Роль: ${role}`);
        console.log(`🔗 Степень: ${point.degree || 0}`);
        console.log(`📐 Треугольников: ${this.countTrianglesForPoint(pointId, graph)}`);
       
        if (morph.compactness) {
            console.log(`\n📐 МОРФОЛОГИЯ:`);
            console.log(`   • Компактность: ${morph.compactness.toFixed(2)}`);
            console.log(`   • Норм. площадь: ${morph.normalizedArea?.toFixed(2) || 'нет'}`);
        }
       
        console.log(`\n👥 СОСЕДИ (${neighbors.length}):`);
        neighbors.slice(0, 10).forEach((n, i) => {
            const nRole = roles.get(n.id) || 'R';
            console.log(`   ${i+1}. ${n.id.substring(0,20)}... | роль: ${nRole} | (${n.x.toFixed(1)}, ${n.y.toFixed(1)})`);
        });
       
        if (neighbors.length > 10) {
            console.log(`   ... и еще ${neighbors.length - 10}`);
        }
    }
}

module.exports = FeatureTable;
