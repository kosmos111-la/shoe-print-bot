// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ УПРОЩЁННЫЙ АККУМУЛЯТОР - с таблицей сопоставления точек

const GraphBuilder = require('./GraphBuilder');
const LocalGroupSignature = require('./LocalGroupSignature');
const MorphologyEncoder = require('./MorphologyEncoder');
const CenterMatcher = require('./CenterMatcher');
const RelativePositioning = require('./RelativePositioning');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;

        // Компоненты
        this.graphBuilder = new GraphBuilder({ debug: this.debug });
        this.localGroupSignature = new LocalGroupSignature({
            debug: this.debug,
            depth: options.localDepth || 3,
            useMorphology: true
        });
        this.morphologyEncoder = new MorphologyEncoder({ debug: this.debug });

        this.centerMatcher = new CenterMatcher({
            debug: this.debug,
            localGroupSignature: this.localGroupSignature,
            morphologyEncoder: this.morphologyEncoder,
            minLocalSimilarity: options.minLocalSimilarity || 0.5,
            minMorphologySimilarity: options.minMorphologySimilarity || 0.6,
            minConsistentPairs: options.minConsistentPairs || 2
        });

        this.relativePositioning = new RelativePositioning({
            debug: this.debug,
            localGroupSignature: this.localGroupSignature,
            minPathSimilarity: options.minPathSimilarity || 0.5,
            maxPathLengthDiff: options.maxPathLengthDiff || 3,
            confidenceThreshold: options.confidenceThreshold || 0.7
        });

        // Хранилище моделей
        this.models = new Map();
        this.currentModelId = null;

        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalCenterMatches: 0,
            totalRelativeMatches: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗️ УПРОЩЁННЫЙ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   🔷 Локальные группы (глубина ${options.localDepth || 3})`);
        console.log(`   🔷 Морфология фигур`);
        console.log(`   🎯 Поиск центра (мин. ${options.minConsistentPairs || 2} точек)`);
        console.log(`   🧩 Относительная привязка (порог ${options.confidenceThreshold || 0.7})`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

        const modelId = options.modelId || this.currentModelId;
        const contours = options.contours || [];

        // 1. Строим граф
        const graph = this.graphBuilder.buildDelaunayGraph(points, options.source || 'photo');

        // 2. Кодируем морфологию
        const morphologyMap = this.morphologyEncoder.encode(points, contours);

        if (!modelId || !this.models.has(modelId)) {
            return this.createNewModel(graph, morphologyMap, points, options);
        }

        const existingModel = this.models.get(modelId);
        console.log(`🔍 Сравниваю с моделью "${modelId}"`);

        // 3. Ищем соответствия ПО ВСЕМУ СЛЕДУ
        const anchorMatches = this.centerMatcher.findCenterMatches(
            graph,
            existingModel.graph,
            morphologyMap,
            existingModel.morphologyMap
        );

        if (anchorMatches.size < this.centerMatcher.minConsistentPairs) {
            console.log(`⚠️ Недостаточно согласованных точек (${anchorMatches.size} < ${this.centerMatcher.minConsistentPairs})`);
            console.log(`🆕 Создаю новую модель`);
            return this.createNewModel(graph, morphologyMap, points, {
                ...options,
                comparedWith: modelId,
                reason: 'insufficient_matches'
            });
        }

        console.log(`✅ Найдено ${anchorMatches.size} согласованных точек!`);

        // 4. Достраиваем остальные точки относительно найденных соответствий
        const allMatches = this.relativePositioning.positionPoints(
            graph,
            existingModel.graph,
            anchorMatches,
            morphologyMap,
            existingModel.morphologyMap
        );

        // 🔥 ТАБЛИЦА СОПОСТАВЛЕНИЯ ТОЧЕК
        this.printMatchesTable(allMatches, graph, existingModel.graph);

        // 5. Обновляем модель
        const updatedModel = await this.enhanceModel(
            modelId,
            graph,
            morphologyMap,
            allMatches,
            anchorMatches,
            options
        );

        return {
            status: 'enhanced',
            modelId: modelId,
            anchorMatches: anchorMatches.size,
            totalMatches: allMatches.size,
            newNodesAdded: updatedModel.newNodesAdded,
            message: `Модель улучшена (найдено ${anchorMatches.size} якорей, сопоставлено ${allMatches.size} точек, добавлено ${updatedModel.newNodesAdded} новых)`
        };
    }

    // ==================== ТАБЛИЦА СОПОСТАВЛЕНИЯ ====================

    printMatchesTable(allMatches, photoGraph, modelGraph) {
        console.log(`\n📋 ТАБЛИЦА СОПОСТАВЛЕНИЯ ТОЧЕК (первые 30):`);
        console.log(`┌─────┬──────────────────────┬──────────────────────┬───────────┬───────────┬─────────────────────┬─────────────────────┐`);
        console.log(`│  #  │   ТОЧКА В ФОТО 2      │   ТОЧКА В МОДЕЛИ      │ УВЕРЕН.   │ СТАТУС    │   КООРД. ФОТО 2     │   КООРД. МОДЕЛИ     │`);
        console.log(`├─────┼──────────────────────┼──────────────────────┼───────────┼───────────┼─────────────────────┼─────────────────────┤`);

        let matchCount = 0;
        const highConfidence = [];
        const lowConfidence = [];

        for (const [photoId, match] of allMatches) {
            if (matchCount >= 30) break;
           
            const photoNode = photoGraph.nodes.get(photoId);
            const modelNode = modelGraph.nodes.get(match.modelId);
           
            if (!photoNode || !modelNode) continue;
           
            const confidence = match.confidence || 0;
            const status = confidence >= 0.7 ? '✅' : '⚠️';
           
            if (confidence >= 0.7) {
                highConfidence.push({ photoId, modelId: match.modelId, confidence });
            } else {
                lowConfidence.push({ photoId, modelId: match.modelId, confidence });
            }
           
            matchCount++;
           
            console.log(
                `│ ${matchCount.toString().padEnd(3)} │ ${photoId.substring(0, 20).padEnd(20)} │ ` +
                `${match.modelId.substring(0, 20).padEnd(20)} │ ` +
                `${(confidence*100).toFixed(0).padStart(5)}%   │ ` +
                `${status.padEnd(7)}   │ ` +
                `(${photoNode.x.toFixed(1).padStart(6)}, ${photoNode.y.toFixed(1).padStart(6)}) │ ` +
                `(${modelNode.x.toFixed(1).padStart(6)}, ${modelNode.y.toFixed(1).padStart(6)}) │`
            );
        }

        console.log(`└─────┴──────────────────────┴──────────────────────┴───────────┴───────────┴─────────────────────┴─────────────────────┘`);
       
        console.log(`\n📊 СТАТИСТИКА СОПОСТАВЛЕНИЙ:`);
        console.log(`   ✅ Высокая уверенность (≥70%): ${highConfidence.length} точек`);
        console.log(`   ⚠️ Низкая уверенность (<70%): ${lowConfidence.length} точек`);
        console.log(`   📈 Всего сопоставлено: ${allMatches.size} точек`);

        // Отдельно покажем точки с низкой уверенностью (кандидаты на новые)
        if (lowConfidence.length > 0) {
            console.log(`\n📋 КАНДИДАТЫ В НОВЫЕ ТОЧКИ (низкая уверенность):`);
            lowConfidence.slice(0, 10).forEach((c, i) => {
                console.log(`   ${i+1}. ${c.photoId.substring(0, 20)}... → ${c.modelId.substring(0, 20)}... (${(c.confidence*100).toFixed(0)}%)`);
            });
        }
    }

    // ==================== СОЗДАНИЕ НОВОЙ МОДЕЛИ ====================

    createNewModel(graph, morphologyMap, originalPoints, options = {}) {
        const modelId = `topo_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // Добавляем морфологию к узлам графа
        let morphologyCount = 0;
        for (const [nodeId, node] of graph.nodes) {
            const morph = morphologyMap.get(nodeId);
            if (morph) {
                node.morphology = morph;
                node.hasContour = morph.hasContour || false;
                morphologyCount++;
            }
            node.confirmationCount = 1;
            node.addedFrom = 'original';
        }

        console.log(`✅ Добавлена морфология к ${morphologyCount} узлам`);

        const model = {
            id: modelId,
            graph: graph,
            morphologyMap: morphologyMap,
            originalPoints: originalPoints,
            metadata: {
                name: options.name || `Модель_${new Date().toLocaleTimeString('ru-RU')}`,
                createdAt: new Date(),
                pointsCount: originalPoints.length,
                nodesCount: graph.nodes.size,
                edgesCount: graph.edges.size,
                source: options.source || 'unknown'
            },
            history: [{
                action: 'created',
                timestamp: new Date(),
                points: originalPoints.length,
                nodes: graph.nodes.size
            }]
        };

        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();

        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Точек с морфологией: ${morphologyCount}`);

        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            morphologyCount: morphologyCount,
            message: `Создана новая топологическая модель`
        };
    }

    // ==================== УЛУЧШЕНИЕ МОДЕЛИ ====================

    async enhanceModel(modelId, newGraph, newMorphology, allMatches, anchorMatches, options) {
        const model = this.models.get(modelId);
       
        // Считаем статистику
        let confirmedExisting = 0;
        let newNodesAdded = 0;
        let missingFromModel = 0;
       
        // Множества для отслеживания
        const matchedPhotoIds = new Set();     // какие точки из фото 2 нашли пару
        const matchedModelIds = new Set();     // какие точки из модели нашли пару
       
        // 1. Сначала обрабатываем найденные соответствия
        for (const [photoId, match] of allMatches) {
            const modelNode = model.graph.nodes.get(match.modelId);
            if (modelNode) {
                // Точка есть в модели - увеличиваем подтверждение
                modelNode.confirmationCount = (modelNode.confirmationCount || 1) + 1;
                modelNode.lastConfirmed = new Date();
                confirmedExisting++;
               
                matchedPhotoIds.add(photoId);
                matchedModelIds.add(match.modelId);
            }
        }
       
        // 2. Добавляем НОВЫЕ точки (есть в фото 2, нет в модели)
        for (const [photoId, photoNode] of newGraph.nodes) {
            if (matchedPhotoIds.has(photoId)) continue; // уже сопоставлена
           
            // Это новая точка
            const newNodeId = `node_${Date.now()}_${newNodesAdded}`;
            model.graph.nodes.set(newNodeId, {
                id: newNodeId,
                x: photoNode.x,
                y: photoNode.y,
                degree: photoNode.degree,
                morphology: newMorphology.get(photoId),
                confirmationCount: 1, // первое появление
                addedFrom: 'new_point',
                addedAt: new Date(),
                originalPhotoId: photoId // для отслеживания
            });
            newNodesAdded++;
           
            matchedPhotoIds.add(photoId);
        }
       
        // 3. Отмечаем ИСЧЕЗНУВШИЕ точки (есть в модели, нет в фото 2)
        for (const [modelId, modelNode] of model.graph.nodes) {
            if (matchedModelIds.has(modelId)) continue; // была в новом фото
           
            // Точка не подтвердилась в этом фото
            missingFromModel++;
            modelNode.confirmationCount = modelNode.confirmationCount || 1;
        }
       
        // 4. Обновляем рёбра
        this.updateEdges(model.graph, newGraph, allMatches);
       
        // 5. Обновляем статистику модели
        model.metadata.nodesCount = model.graph.nodes.size;
        model.metadata.lastEnhanced = new Date();
       
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            anchorMatches: anchorMatches.size,
            totalMatches: allMatches.size,
            confirmedExisting,
            newNodes: newNodesAdded,
            missingFromModel,
            totalNodes: model.graph.nodes.size
        });
       
        this.stats.totalEnhancements++;
        this.stats.totalCenterMatches += anchorMatches.size;
        this.stats.totalRelativeMatches += allMatches.size - anchorMatches.size;
        this.stats.lastUpdated = new Date();
       
        console.log(`\n📊 ИТОГ УЛУЧШЕНИЯ:`);
        console.log(`   Якорей: ${anchorMatches.size} точек`);
        console.log(`   Всего сопоставлено: ${allMatches.size} точек`);
        console.log(`   Подтверждено существующих: ${confirmedExisting} точек`);
        console.log(`   🔥 НОВЫХ добавлено: ${newNodesAdded} точек`);
        console.log(`   ⚰️ Исчезнувших (неподтверждённых): ${missingFromModel} точек`);
        console.log(`   Теперь в модели: ${model.graph.nodes.size} точек`);
       
        return {
            confirmedExisting,
            newNodesAdded,
            missingFromModel,
            anchorMatches: anchorMatches.size,
            totalMatches: allMatches.size
        };
    }

    // ==================== ОБНОВЛЕНИЕ РЁБЕР ====================

    updateEdges(modelGraph, newGraph, matches) {
        // Создаём обратное отображение modelId -> photoId
        const modelToPhoto = new Map();
        for (const [photoId, match] of matches) {
            modelToPhoto.set(match.modelId, photoId);
        }

        // Добавляем новые рёбра
        for (const edge of newGraph.edges) {
            const [photoA, photoB] = edge.split('--');

            const modelA = matches.get(photoA)?.modelId;
            const modelB = matches.get(photoB)?.modelId;

            if (modelA && modelB && modelGraph.nodes.has(modelA) && modelGraph.nodes.has(modelB)) {
                const modelEdge = [modelA, modelB].sort().join('--');
                modelGraph.edges.add(modelEdge);
            }
        }

        // Пересчитываем степени
        for (const node of modelGraph.nodes.values()) {
            node.degree = 0;
        }

        for (const edge of modelGraph.edges) {
            const [a, b] = edge.split('--');
            if (modelGraph.nodes.has(a)) modelGraph.nodes.get(a).degree++;
            if (modelGraph.nodes.has(b)) modelGraph.nodes.get(b).degree++;
        }
    }

    // ==================== ИНФОРМАЦИЯ О МОДЕЛИ ====================

    getModelInfo(modelId = null) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return { error: 'Model not found' };

        const model = this.models.get(targetId);
        const graph = model.graph;

        // Статистика по подтверждениям
        const confirmations = { 1: 0, 2: 0, 3: 0, '4+': 0 };
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmations['4+']++;
            else confirmations[count] = (confirmations[count] || 0) + 1;
        }

        // Статистика по морфологии
        let withMorphology = 0;
        for (const node of graph.nodes.values()) {
            if (node.morphology && node.hasContour) withMorphology++;
        }

        return {
            id: model.id,
            name: model.metadata.name,
            stats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                withMorphology,
                confirmed1: confirmations[1] || 0,
                confirmed2: confirmations[2] || 0,
                confirmed3: confirmations[3] || 0,
                confirmed4plus: confirmations['4+'] || 0,
                centerMatches: this.stats.totalCenterMatches,
                relativeMatches: this.stats.totalRelativeMatches
            },
            metadata: model.metadata,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            system: this.stats,
            models: {
                total: this.models.size,
                list: Array.from(this.models.keys()).map(id => ({
                    id,
                    name: this.models.get(id).metadata.name,
                    nodes: this.models.get(id).graph.nodes.size,
                    withMorphology: Array.from(this.models.get(id).graph.nodes.values())
                        .filter(n => n.hasContour).length
                }))
            },
            localGroupSignature: this.localGroupSignature.getStats(),
            centerMatcher: this.centerMatcher.getStats(),
            relativePositioning: this.relativePositioning.getStats()
        };
    }

    // ==================== ОЧИСТКА ====================

    clear() {
        this.models.clear();
        this.currentModelId = null;
        this.localGroupSignature.clearCache();
        this.morphologyEncoder.clearCache();
        this.centerMatcher.clear();
        this.relativePositioning.clear();

        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalCenterMatches: 0,
            totalRelativeMatches: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log('🧹 TopologicalAccumulator очищен');
    }
}

module.exports = TopologicalAccumulator;
