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

        // 🔥 ЛОГ: координаты ДО перестроения
        const nodesArray = Array.from(model.graph.nodes.values());
        if (nodesArray.length > 0) {
            console.log(`\n📍 ДО ПЕРЕСТРОЕНИЯ — координаты точек (первые 5):`);
            nodesArray.slice(0, 5).forEach((node, i) => {
                console.log(`   ${i+1}. ${node.id.substring(0,16)}: (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) [conf=${node.confirmationCount || 1}]`);
            });
           
            // 🔥 ЛОГ: якорная точка контура
            const contourAnchors = nodesArray.filter(n => n.isContourAnchor);
            if (contourAnchors.length > 0) {
                contourAnchors.forEach(a => {
                    console.log(`   🔷 ЯКОРЬ КОНТУРА: ${a.id.substring(0,16)}: (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) [conf=${a.confirmationCount || 1}]`);
                });
            } else {
                console.log(`   ⚠️ Якорь контура НЕ НАЙДЕН в графе!`);
            }
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

        // 🔥 ПЕРЕСТРАИВАЕМ СТРУКТУРЫ ИЗ НОВОГО ГРАФА
        const allTriangles = this._extractTrianglesFromGraph(model.graph);
       
        if (allTriangles.length > 0) {
            const StructureManager = require('./StructureManager');
            const StructureBuilder = require('./StructureBuilder');
           
            const structureManager = new StructureManager(null, { debug: false });
            const structureBuilder = new StructureBuilder(null, { debug: false });
           
            const structures = [];
            const processed = new Set();
           
            for (const triangle of allTriangles) {
                if (processed.has(triangle.id)) continue;
               
                const structure = structureBuilder.buildFromSeed(
                    triangle,
                    allTriangles,
                    model.graph,
                    model.graph,
                    new Map(),
                    new Map()
                );
               
                if (structure && structure.triangleIds && structure.triangleIds.size > 0) {
                    for (const tid of structure.triangleIds) {
                        processed.add(tid);
                    }
                    structures.push(structure);
                }
            }
           
            model.structures = structures;
           
            // Строим pointToStructure
            model.pointToStructure = new Map();
            for (const structure of structures) {
                const pointIds = structure.pointIds || new Set();
                for (const pointId of pointIds) {
                    model.pointToStructure.set(pointId, structure.id);
                }
            }
        } else {
            model.structures = [];
            model.pointToStructure = new Map();
        }
       
        model.transform = null; // Трансформация сбрасывается

        if (this.debug) {
            const duration = Date.now() - startTime;
            console.log(`\n✅ ГРАФ ПЕРЕСТРОЕН:`);
            console.log(`   • Узлов: ${newExactGraph.nodes.size}`);
            console.log(`   • Рёбер: ${newExactGraph.edges.size}`);
            console.log(`   • Треугольников: ${allTriangles.length}`);
            console.log(`   • Структур: ${model.structures.length}`);
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
                // 🔥 КРИТИЧНО: confirmationCount из узла
                confirmationCount: node.confirmationCount || 1,
                addedFrom: node.addedFrom || 'unknown',
                addedAt: node.addedAt || new Date(),
                originalPhotoId: node.originalPhotoId || nodeId,

                // 🔥 ПОЛНАЯ МОРФОЛОГИЯ (сохраняем как объект)
                morphology: {
                    compactness: morph.compactness ?? node.compactness,
                    eccentricity: morph.eccentricity ?? node.eccentricity,
                    orientation: morph.orientation ?? node.orientation,
                    normalizedArea: morph.normalizedArea ?? node.normalizedArea,
                    radialProfile: morph.radialProfile || node.radialProfile || [0,0,0,0,0,0,0,0],
                    asymmetry: morph.asymmetry ?? node.asymmetry ?? 0,
                    hasContour: morph.hasContour ?? node.hasContour ?? false,
                    rawArea: morph.rawArea,
                    logArea: morph.logArea,
                    contour: morph.contour || null
                },

                // Топология
                degree: node.degree || 0,
                triangles: node.triangles || 0,
                role: node.role,
                clusterId: node.clusterId,
                patternType: node.patternType,
                structureId: node.structureId,
               
                // 🔥 ЯКОРЬ КОНТУРА
                isContourAnchor: node.isContourAnchor || false
            });
        }

        // 🔥 ЛОГ: проверяем, извлёкся ли якорь контура
        const contourPoints = points.filter(p => p.isContourAnchor);
        if (contourPoints.length > 0) {
            console.log(`🔷 extractAllPoints: якорей контура извлечено: ${contourPoints.length}`);
            contourPoints.forEach(p => {
                console.log(`   ${p.id}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) isContourAnchor=${p.isContourAnchor}`);
            });
        } else {
            console.log(`⚠️ extractAllPoints: якорей контура НЕ извлечено!`);
            // Ищем в исходном графе
            const sourceAnchors = Array.from(model.graph.nodes.values()).filter(n => n.isContourAnchor);
            if (sourceAnchors.length > 0) {
                console.log(`   Но в model.graph.nodes якорей контура: ${sourceAnchors.length}`);
            }
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
    // 🔥 ВСЕГДА перестраиваем, если добавилась хотя бы ОДНА новая точка
    if (newPointsCount >= 1) {
        if (this.debug) {
            console.log(`   🔄 shouldRebuild: добавлено ${newPointsCount} новых точек → перестраиваем`);
        }
        return true;
    }
   
    // Дополнительные условия (если новых точек нет, но прошло много фото)
    const photosSinceLastRebuild = (model.metadata?.photoCount || 0) - (model.metadata?.lastRebuildPhotoCount || 0);
    if (photosSinceLastRebuild >= 5) {
        if (this.debug) {
            console.log(`   🔄 shouldRebuild: прошло ${photosSinceLastRebuild} фото с последнего перестроения → перестраиваем`);
        }
        return true;
    }

    return false;
}
  
/**
     * Извлекает все треугольники из графа
     */
    _extractTrianglesFromGraph(graph) {
        const triangles = [];
        const nodeIds = Array.from(graph.nodes.keys());
        const edges = graph.edges;

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                for (let k = j + 1; k < nodeIds.length; k++) {
                    const a = nodeIds[i];
                    const b = nodeIds[j];
                    const c = nodeIds[k];

                    if (edges.has([a, b].sort().join('--')) &&
                        edges.has([b, c].sort().join('--')) &&
                        edges.has([c, a].sort().join('--'))) {

                        const p1 = graph.nodes.get(a);
                        const p2 = graph.nodes.get(b);
                        const p3 = graph.nodes.get(c);

                        if (p1 && p2 && p3) {
                            triangles.push({
                                p1, p2, p3,
                                id: `tri_${a}_${b}_${c}`,
                                edges: [
                                    { v1: p1, v2: p2, neighborTriangles: [], externalPoint: null },
                                    { v1: p2, v2: p3, neighborTriangles: [], externalPoint: null },
                                    { v1: p3, v2: p1, neighborTriangles: [], externalPoint: null }
                                ]
                            });
                        }
                    }
                }
            }
        }

        return triangles;
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
