// modules/footprint/topology/GraphRebuilder.js
// 🔄 ПЕРЕСТРОЕНИЕ ГРАФА МОДЕЛИ ПОСЛЕ ДОБАВЛЕНИЯ НОВЫХ ТОЧЕК

const GraphBuilder = require('./GraphBuilder');
const KNNGraphBuilder = require('./KNNGraphBuilder');
const TopologicalFingerprint = require('./TopologicalFingerprint');
const GraphHasher = require('./utils/GraphHasher');
const MorphologyEncoder = require('./MorphologyEncoder');

class GraphRebuilder {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        this.graphBuilder = new GraphBuilder({ debug: false });
        this.knnBuilder = new KNNGraphBuilder({
            debug: false,
            k: options.k || 8
        });
        this.fingerprinter = new TopologicalFingerprint({
            debug: false,
            iterations: options.wlIterations || 3
        });
        this.graphHasher = new GraphHasher({ debug: this.debug });
        this.morphologyEncoder = new MorphologyEncoder({ debug: false });

        if (this.debug) {
            console.log('🔄 GraphRebuilder создан');
        }
    }

    /**
     * Полностью перестраивает граф модели из всех точек
     * @param {Object} model - текущая модель
     * @param {Object} options - дополнительные опции
     * @returns {Object} - обновлённая модель
     */
    rebuildModel(model, options = {}) {
        const startTime = Date.now();

        if (this.debug) {
            console.log(`\n🔄 ПЕРЕСТРОЕНИЕ ГРАФА МОДЕЛИ ${model.id?.substring(0, 12)}...`);
        }

        // 1. Извлекаем все точки из модели
        const allPoints = this.extractAllPoints(model);

        if (this.debug) {
            console.log(`   📊 Извлечено ${allPoints.length} точек для перестроения`);
           
            // Статистика по подтверждениям
            const confirmStats = { 1: 0, 2: 0, 3: 0, '4+': 0 };
            allPoints.forEach(p => {
                const c = p.confirmationCount || 1;
                if (c >= 4) confirmStats['4+']++;
                else confirmStats[c]++;
            });
            console.log(`   📊 Подтверждения: 1×${confirmStats[1]}, 2×${confirmStats[2]}, 3×${confirmStats[3]}, 4+×${confirmStats['4+']}`);
        }

        // 2. Строим новый граф Делоне
        const newExactGraph = this.graphBuilder.buildGraph(allPoints, `model_${model.id}_rebuilt`);

        // 3. Строим новый KNN-граф
        const newKNNGraph = this.knnBuilder.buildGraph(allPoints, `model_${model.id}_knn_rebuilt`);

        // 4. Вычисляем новые WL-подписи
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(newKNNGraph);

        // 5. Обновляем морфологию (если нужно)
        // Морфология уже сохранена в точках, просто переносим
        const morphologyMap = new Map();
        allPoints.forEach(p => {
            if (p.morphology) {
                morphologyMap.set(p.id, p.morphology);
            }
        });

        // 6. Вычисляем новый хэш графа
        const graphHash = this.graphHasher.computeGraphHash(newExactGraph);

        // 7. Обновляем модель
        model.graph = newExactGraph;
        model.knnGraph = newKNNGraph;
        model.knnFingerprints = newFingerprints;
        model.morphologyMap = morphologyMap;
        model.graphHash = graphHash;
        model.metadata.lastRebuilt = new Date();
        model.metadata.rebuildCount = (model.metadata.rebuildCount || 0) + 1;

        // 8. Очищаем структуры (они больше не актуальны)
        model.structures = [];
        model.pointToStructure = new Map();
        model.transform = null; // Трансформация тоже сбрасывается

        if (this.debug) {
            const duration = Date.now() - startTime;
            console.log(`\n✅ ГРАФ ПЕРЕСТРОЕН:`);
            console.log(`   • Узлов: ${newExactGraph.nodes.size}`);
            console.log(`   • Рёбер: ${newExactGraph.edges.size}`);
            console.log(`   • Треугольников: ${newExactGraph.triangles || newExactGraph.triangleList?.length || 0}`);
            console.log(`   • Хэш: ${graphHash}`);
            console.log(`   • Время: ${duration}ms`);
        }

        return model;
    }

    /**
     * Извлекает все точки из модели в плоский массив
     */
    extractAllPoints(model) {
        const points = [];
       
        if (!model.graph || !model.graph.nodes) {
            return points;
        }

        for (const [nodeId, node] of model.graph.nodes) {
            const morph = model.morphologyMap?.get(nodeId) || {};

            points.push({
                id: nodeId,
                x: node.x,
                y: node.y,
                confidence: node.confidence || 0.5,
                confirmationCount: node.confirmationCount || 1,
                addedFrom: node.addedFrom || 'unknown',
                addedAt: node.addedAt,
                originalPhotoId: node.originalPhotoId,

                // Морфология
                morphology: {
                    compactness: morph.compactness || node.compactness,
                    eccentricity: morph.eccentricity || node.eccentricity,
                    orientation: morph.orientation || node.orientation,
                    normalizedArea: morph.normalizedArea || node.normalizedArea,
                    radialProfile: morph.radialProfile || node.radialProfile,
                    asymmetry: morph.asymmetry || node.asymmetry,
                    hasContour: morph.hasContour || node.hasContour
                },

                // Топология
                degree: node.degree || 0,
                triangles: node.triangles || 0,
                role: node.role,
                clusterId: node.clusterId,
                patternType: node.patternType
            });
        }

        return points;
    }

    /**
     * Восстанавливает граф из сохранённых точек (при загрузке модели)
     */
    restoreGraphFromPoints(points, options = {}) {
        if (!points || points.length === 0) {
            return null;
        }

        if (this.debug) {
            console.log(`\n🔄 ВОССТАНОВЛЕНИЕ ГРАФА ИЗ ${points.length} ТОЧЕК...`);
        }

        // Строим графы
        const exactGraph = this.graphBuilder.buildGraph(points, 'restored_model');
        const knnGraph = this.knnBuilder.buildGraph(points, 'restored_knn');
        const fingerprints = this.fingerprinter.computeGraphFingerprints(knnGraph);
        const graphHash = this.graphHasher.computeGraphHash(exactGraph);

        // Восстанавливаем морфологию
        const morphologyMap = new Map();
        points.forEach(p => {
            if (p.morphology) {
                morphologyMap.set(p.id, p.morphology);
            }
        });

        return {
            graph: exactGraph,
            knnGraph: knnGraph,
            knnFingerprints: fingerprints,
            morphologyMap: morphologyMap,
            graphHash: graphHash
        };
    }

    /**
     * Проверяет, нужно ли перестраивать граф
     */
    shouldRebuild(model, newPointsCount) {
        // Перестраиваем, если:
        // 1. Добавлено больше 5 новых точек
        if (newPointsCount >= 5) return true;
       
        // 2. Общее количество точек изменилось более чем на 10%
        const totalPoints = model.graph?.nodes?.size || 0;
        if (totalPoints > 0 && newPointsCount / totalPoints > 0.1) return true;
       
        // 3. Прошло больше 3 фото с последнего перестроения
        const photosSinceRebuild = (model.metadata?.photoCount || 0) - (model.metadata?.lastRebuildPhotoCount || 0);
        if (photosSinceRebuild >= 3) return true;

        return false;
    }

    /**
     * Получить статистику перестроений
     */
    getStats() {
        return {
            graphBuilder: {
                // Можно добавить статистику
            }
        };
    }
}

module.exports = GraphRebuilder;
