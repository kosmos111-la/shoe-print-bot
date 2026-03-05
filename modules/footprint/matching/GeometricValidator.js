// modules/footprint/matching/GeometricValidator.js
// 🔥 ТРИАНГУЛЯЦИОННАЯ ГЕОМЕТРИЧЕСКАЯ ВЕРИФИКАЦИЯ
// С ИСПОЛЬЗОВАНИЕМ НАСТОЯЩЕГО АЛГОРИТМА ДЕЛОНЕ

const GraphBuilder = require('../topology/GraphBuilder');

class GeometricValidator {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Параметры
        this.minVotes = options.minVotes || 2;
        this.voteRatio = options.voteRatio || 0.6;
       
        // Используем готовый GraphBuilder для триангуляции
        this.graphBuilder = new GraphBuilder({ debug: false });
       
        console.log(`📐 GeometricValidator (настоящая триангуляция) создан`);
        console.log(`   • Минимум голосов: ${this.minVotes}`);
        console.log(`   • Пороговая доля: ${this.voteRatio * 100}%`);
    }

    /**
     * 🔥 ОСНОВНОЙ МЕТОД: триангуляционная верификация
     */
    validateAnchors(anchors, pointsA, pointsB) {
        console.log(`\n🔍 ТРИАНГУЛЯЦИОННАЯ ВЕРИФИКАЦИЯ ЯКОРЕЙ`);
        console.log(`========================================`);
        console.log(`📊 Всего кандидатов: ${anchors.length}`);

        if (anchors.length < 3) {
            console.log(`⚠️ Меньше 3 якорей, верификация невозможна`);
            return {
                verified: anchors,
                rejected: [],
                stats: {
                    total: anchors.length,
                    verified: anchors.length,
                    rejected: 0
                }
            };
        }

        // ШАГ 1: Подготовка данных
        const data = [];
        const photoPoints = [];
        const modelPoints = [];
       
        for (const anchor of anchors) {
            const pointA = pointsA.get(anchor.pointA);
            const pointB = pointsB.get(anchor.pointB);
           
            if (!pointA || !pointB) continue;
           
            const idx = data.length;
            data.push({
                id: anchor.pointA,
                modelId: anchor.pointB,
                index: idx,
                x1: pointA.x,
                y1: pointA.y,
                x2: pointB.x,
                y2: pointB.y,
                confidence: anchor.confidence,
                zone: anchor.zone
            });
           
            photoPoints.push({
                id: `p${idx}`,
                x: pointA.x,
                y: pointA.y
            });
           
            modelPoints.push({
                id: `p${idx}`,
                x: pointB.x,
                y: pointB.y
            });
        }

        console.log(`📊 Подготовлено данных: ${data.length}`);

        // ШАГ 2: Строим настоящую триангуляцию Делоне
        console.log(`\n   Построение триангуляции Делоне...`);
       
        const photoGraph = this.graphBuilder.buildGraph(photoPoints, 'photo_anchors');
        const modelGraph = this.graphBuilder.buildGraph(modelPoints, 'model_anchors');
       
        const photoEdges = Array.from(photoGraph.edges);
        const modelEdges = Array.from(modelGraph.edges);
       
        console.log(`   • Рёбер в фото: ${photoEdges.length}`);
        console.log(`   • Рёбер в модели: ${modelEdges.length}`);

        // ШАГ 3: Преобразуем рёбра в индексы
        const photoEdgeIndices = this.edgesToIndices(photoEdges);
        const modelEdgeIndices = this.edgesToIndices(modelEdges);

        // ШАГ 4: Голосование за каждую точку
        const votes = new Array(data.length).fill(0);
       
        for (const [i, j] of photoEdgeIndices) {
            // Проверяем, есть ли такое же ребро в модели
            const found = modelEdgeIndices.some(([ii, jj]) =>
                (ii === i && jj === j) || (ii === j && jj === i)
            );
           
            if (found) {
                votes[i]++;
                votes[j]++;
            }
        }

        // ШАГ 5: Определяем порог
        const maxVotes = Math.max(...votes);
        const threshold = Math.max(this.minVotes, Math.floor(maxVotes * this.voteRatio));
       
        console.log(`\n📊 РЕЗУЛЬТАТЫ ГОЛОСОВАНИЯ:`);
        console.log(`   • Максимум голосов: ${maxVotes}`);
        console.log(`   • Порог: ${threshold}`);
       
        // Статистика распределения
        const voteStats = {};
        for (let i = 0; i <= maxVotes; i++) voteStats[i] = 0;
        for (const v of votes) voteStats[v]++;
       
        console.log(`   • Распределение:`);
        for (let i = maxVotes; i >= 0; i--) {
            if (voteStats[i] > 0) {
                console.log(`      ${i} голосов: ${voteStats[i]} точек`);
            }
        }

        // ШАГ 6: Классификация
        const verified = [];
        const rejected = [];
       
        for (let i = 0; i < data.length; i++) {
            if (votes[i] >= threshold) {
                verified.push({
                    pointA: data[i].id,
                    pointB: data[i].modelId,
                    confidence: 1.0,
                    zone: data[i].zone,
                    votes: votes[i]
                });
            } else {
                rejected.push({
                    pointA: data[i].id,
                    pointB: data[i].modelId,
                    confidence: 0.0,
                    zone: data[i].zone,
                    votes: votes[i]
                });
            }
        }

        console.log(`\n📊 РЕЗУЛЬТАТ ВЕРИФИКАЦИИ:`);
        console.log(`   • Подтверждено: ${verified.length} точек`);
        console.log(`   • Отвергнуто: ${rejected.length} точек`);

        return {
            verified,
            rejected,
            votes,
            threshold,
            stats: {
                total: data.length,
                verified: verified.length,
                rejected: rejected.length,
                maxVotes
            }
        };
    }

    /**
     * 🔥 Преобразование рёбер из формата "p0--p1" в индексы [0,1]
     */
    edgesToIndices(edges) {
        return edges.map(edge => {
            const [a, b] = edge.split('--');
            // Извлекаем数字 из "p0", "p1" и т.д.
            const i = parseInt(a.substring(1));
            const j = parseInt(b.substring(1));
            return [i, j];
        }).filter(([i, j]) => !isNaN(i) && !isNaN(j));
    }
}

module.exports = GeometricValidator;
