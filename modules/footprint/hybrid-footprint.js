// modules/footprint/hybrid-footprint.js
// ГИБРИДНЫЙ ОТПЕЧАТОК: битовые маски + моменты + графы + матрица расстояний + векторная схема + трекер точек

const BitmaskFootprint = require('./bitmask-footprint');
const MomentFootprint = require('./moment-footprint');
const SimpleGraph = require('./simple-graph');
const DistanceMatrix = require('./distance-matrix');
const VectorGraph = require('./vector-graph');
const PointTracker = require('./point-tracker');

class HybridFootprint {
    constructor(options = {}) {
        // Идентификаторы
        this.id = options.id || `hybrid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || `Гибридный отпечаток`;
        this.userId = options.userId || null;

        // Различные представления отпечатка
        this.bitmask = new BitmaskFootprint(options.bitmaskData);
        this.moments = new MomentFootprint(options.momentData);
        this.graph = options.graph || new SimpleGraph(this.name);

        // Новые представления (добавлены)
        this.distanceMatrix = new DistanceMatrix(options.distanceMatrixData);
        this.vectorGraph = new VectorGraph(options.vectorGraphData);
        this.pointTracker = new PointTracker(options.pointTrackerData);

        // Оригинальные точки (для пересчёта)
        this.originalPoints = options.originalPoints || [];

        // Метаданные
        this.metadata = {
            created: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            transformations: [], // История трансформаций при объединении
            ...(options.metadata || {})
        };

        // Статистика
        this.stats = {
            confidence: options.confidence || 0.5,
            bitmaskConfidence: 0,
            momentConfidence: 0,
            graphConfidence: 0,
            matrixConfidence: 0,
            vectorConfidence: 0,
            trackerConfidence: 0,
            qualityScore: 0
        };

        console.log(`🎭 Создан гибридный отпечаток "${this.name}"`);
    }

    // ДОБАВЛЕНО: Метод calculateConfidence
    calculateConfidence() {
        return this.stats.confidence || 0.5;
    }

    // ДОБАВЛЕНО: Метод getConfidence для совместимости
    getConfidence() {
        return this.stats.confidence || 0.5;
    }

    // 1. СОЗДАТЬ ВСЕ ПРЕДСТАВЛЕНИЯ ИЗ ТОЧЕК
    createFromPoints(points, sourceInfo = {}) {
        console.log(`🎯 Создаю гибридный отпечаток из ${points.length} точек...`);

        if (!points || points.length < 3) {
            console.log('⚠️ Слишком мало точек');
            return false;
        }

        this.originalPoints = points;

        // 1. БИТОВАЯ МАСКА (самое быстрое)
        this.bitmask.createFromPoints(points);

        // 2. ГЕОМЕТРИЧЕСКИЕ МОМЕНТЫ (быстрое)
        this.moments.calculateFromPoints(points);

        // 3. ГРАФ (медленное, но точное)
        const graphInvariants = this.graph.buildFromPoints(points);

        // 4. МАТРИЦА РАССТОЯНИЙ
        this.distanceMatrix.createFromPoints(points);

        // 5. ВЕКТОРНАЯ СХЕМА
        this.vectorGraph.createFromPoints(points);

        // 6. ТРЕКЕР ТОЧЕК
        this.pointTracker.processNewPoints(points, sourceInfo);

        // Обновить метаданные
        this.metadata.totalPhotos++;
        this.metadata.lastUpdated = new Date();

        // Рассчитать уверенности
        this.updateConfidence();

        console.log(`✅ Гибридный отпечаток создан:`);
        console.log(`   🎭 Битовая маска: ${this.bitmask.bitmask.toString(16).slice(0, 8)}...`);
        console.log(`   📐 Моменты: ${this.moments.get7Moments().length} инвариантов`);
        console.log(`   🕸️ Граф: ${this.graph.nodes.size} узлов, ${this.graph.edges.size} рёбер`);
        console.log(`   📊 Матрица: ${this.getMatrixSizeString()}`);
        console.log(`   🧭 Векторы: ${this.getVectorCount()} векторов`);
        console.log(`   📍 Трекер: ${this.pointTracker.getStats().totalPoints} точек`);

        return true;
    }

    // 2. ОБНОВИТЬ УВЕРЕННОСТИ
    updateConfidence() {
        // Уверенность на основе битовой маски (сколько заполнено)
        const bitmaskOnes = BitmaskFootprint.countBits(this.bitmask.bitmask);
        this.stats.bitmaskConfidence = bitmaskOnes / 64;

        // Уверенность на основе моментов (сложность формы)
        const moments = this.moments.get7Moments();
        const momentSum = moments.reduce((sum, m) => sum + Math.abs(m), 0);
        this.stats.momentConfidence = Math.min(1, momentSum * 10);

        // Уверенность на основе графа
        const nodeCount = this.graph.nodes.size;
        const edgeCount = this.graph.edges.size;
        const graphConfidence = Math.min(1,
            (nodeCount / 30) * 0.4 + // Хотя бы 30 узлов
            (edgeCount / Math.max(1, nodeCount * 2)) * 0.3 + // Связность
            this.graph.getBasicInvariants().clusteringCoefficient * 0.3
        );
        this.stats.graphConfidence = graphConfidence;

        // Уверенность на основе матрицы расстояний
        this.stats.matrixConfidence = this.distanceMatrix.confidence || 0.8;

        // Уверенность на основе векторной схемы
        this.stats.vectorConfidence = this.vectorGraph.confidence || 0.8;

        // Уверенность на основе трекера точек
        const trackerStats = this.pointTracker.getStats();
        this.stats.trackerConfidence = trackerStats.confidence || 0.8;

        // Общая уверенность (взвешенная)
        this.stats.confidence = (
            this.stats.bitmaskConfidence * 0.1 +
            this.stats.momentConfidence * 0.15 +
            this.stats.graphConfidence * 0.2 +
            this.stats.matrixConfidence * 0.2 +
            this.stats.vectorConfidence * 0.2 +
            this.stats.trackerConfidence * 0.15
        );

        // Качество (уверенность × количество фото)
        this.stats.qualityScore = this.stats.confidence *
            Math.min(1, this.metadata.totalPhotos / 3);
    }

    // 3. КАСКАДНОЕ СРАВНЕНИЕ С ДРУГИМ ОТПЕЧАТКОМ (ОБНОВЛЁННАЯ ВЕРСИЯ)
    compare(otherFootprint) {
        console.log(`🔍 Каскадное сравнение с "${otherFootprint.name}"...`);

        const steps = [];
        const startTime = Date.now();

        // ПРОВЕРКА КАЧЕСТВА ДАННЫХ
        if (this.originalPoints.length < 15 || otherFootprint.originalPoints.length < 15) {
            return {
                similarity: 0,
                decision: 'different',
                reason: 'Слишком мало точек для сравнения',
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // 🔴 ШАГ 0: ПРОВЕРКА РАЗМЕРОВ (ОСЛАБЛЕННАЯ ВЕРСИЯ)
        const sizeRatio = Math.min(this.originalPoints.length, otherFootprint.originalPoints.length) /
                         Math.max(this.originalPoints.length, otherFootprint.originalPoints.length);

        // Для совсем разных размеров - быстрый отсев
        if (sizeRatio < 0.4) { // Было 0.7 - ТЕПЕРЬ ТОЛЬКО СОВСЕМ РАЗНЫЕ РАЗМЕРЫ
            console.log(`🚫 Отсев по размеру (ratio: ${sizeRatio.toFixed(2)})`);
            return {
                similarity: sizeRatio,
                decision: 'different',
                reason: `Слишком разное количество точек: ${this.originalPoints.length} vs ${otherFootprint.originalPoints.length}`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // Для умеренно разных размеров - предупреждение, но продолжаем сравнение
        if (sizeRatio < 0.7) {
            console.log(`⚠️ Разные размеры точек (ratio: ${sizeRatio.toFixed(2)}), продолжаю сравнение...`);
        }

        // ШАГ 1: БЫСТРАЯ ПРОВЕРКА - БИТОВАЯ МАСКА
        const bitmaskResult = this.bitmask.compare(otherFootprint.bitmask);
        steps.push({
            step: 'bitmask',
            time: Date.now() - startTime,
            result: bitmaskResult,
            details: {
                distance: bitmaskResult.distance,
                similarity: bitmaskResult.similarity
            }
        });

        // 🔴 БОЛЕЕ ЖЁСТКИЙ ПОРОГ ДЛЯ БИТОВОЙ МАСКИ
        if (bitmaskResult.distance > 15) { // Было 25
            console.log(`🚫 Быстрый отсев по битовой маске (расстояние: ${bitmaskResult.distance})`);
            return {
                similarity: bitmaskResult.similarity,
                decision: 'different',
                reason: `Битовые маски сильно различаются (${bitmaskResult.distance}/64)`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // ШАГ 2: ПРОВЕРКА МОМЕНТОВ
        const momentResult = this.moments.compare(otherFootprint.moments);
        steps.push({
            step: 'moments',
            time: Date.now() - startTime,
            result: momentResult,
            details: {
                distance: momentResult.distance,
                similarity: momentResult.similarity
            }
        });

        // 🔴 БОЛЕЕ ЖЁСТКИЙ ПОРОГ ДЛЯ МОМЕНТОВ
        if (momentResult.distance > 0.3) { // Было 0.5
            console.log(`🚫 Отсев по моментам (расстояние: ${momentResult.distance.toFixed(4)})`);
            return {
                similarity: momentResult.similarity,
                decision: 'different',
                reason: `Геометрические моменты различаются`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // ШАГ 3: МАТРИЦА РАССТОЯНИЙ
        const matrixResult = this.distanceMatrix.compare(otherFootprint.distanceMatrix);
        steps.push({
            step: 'distance_matrix',
            time: Date.now() - startTime,
            result: matrixResult,
            details: {
                similarity: matrixResult.similarity,
                isMirrored: matrixResult.isMirrored
            }
        });

        // 🔴 МАТРИЦА - САМЫЙ ВАЖНЫЙ КРИТЕРИЙ
        if (matrixResult.similarity < 0.6) { // Было 0.5
            console.log(`🚫 Отсев по матрице расстояний (similarity: ${matrixResult.similarity.toFixed(3)})`);
            return {
                similarity: matrixResult.similarity,
                decision: 'different',
                reason: `Матрицы расстояний различаются`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // ШАГ 4: ВЕКТОРНАЯ СХЕМА (только если матрицы похожи)
        const vectorResult = this.vectorGraph.compare(otherFootprint.vectorGraph);
        steps.push({
            step: 'vector_graph',
            time: Date.now() - startTime,
            result: vectorResult,
            details: {
                similarity: vectorResult.similarity,
                totalMatches: vectorResult.totalMatches
            }
        });

        // 🔴 ВЕКТОРЫ ДОЛЖНЫ ИМЕТЬ МИНИМАЛЬНОЕ КОЛИЧЕСТВО СОВПАДЕНИЙ
        if (vectorResult.similarity < 0.7 || vectorResult.totalMatches < 5) { // Было 0.6
            console.log(`🚫 Отсев по векторной схеме (similarity: ${vectorResult.similarity.toFixed(3)}, matches: ${vectorResult.totalMatches})`);
            return {
                similarity: vectorResult.similarity,
                decision: 'different',
                reason: `Векторные схемы различаются`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // ШАГ 5: ГРАФ - только для финального подтверждения
        let graphResult = { similarity: 0 };
        if (vectorResult.similarity > 0.8) { // Было 0.7
            graphResult = this.compareGraphsSimple(otherFootprint.graph);
            steps.push({
                step: 'graph',
                time: Date.now() - startTime,
                result: graphResult,
                details: {
                    similarity: graphResult.similarity
                }
            });
        }

        // 🔴 НОВАЯ ФОРМУЛА ВЕСОВ - больше веса матрице и векторам
        const weights = {
            bitmask: 0.10,   // 10% - быстро, но неточно
            moments: 0.15,   // 15% - форма
            matrix: 0.40,    // 40% - САМЫЙ ВАЖНЫЙ! структура
            vector: 0.30,    // 30% - локальные связи
            graph: 0.05      // 5% - только подтверждение
        };

        // БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ЗНАЧЕНИЙ (ИСПРАВЛЕНИЕ criticalPass ОШИБКИ)
        const bitmaskSimilarity = bitmaskResult?.similarity || 0;
        const momentSimilarity = momentResult?.similarity || 0;
        const matrixSimilarity = matrixResult?.similarity || 0;
        const vectorSimilarity = vectorResult?.similarity || 0;
        const graphSimilarity = graphResult?.similarity || 0;

        const totalSimilarity = (
            bitmaskSimilarity * weights.bitmask +
            momentSimilarity * weights.moments +
            matrixSimilarity * weights.matrix +
            vectorSimilarity * weights.vector +
            graphSimilarity * weights.graph
        );

        // 🔴 КОМБИНИРОВАННЫЕ КРИТЕРИИ ДЛЯ РЕШЕНИЯ
        let decision, reason;

        // Критически важны матрица и векторы (ИСПРАВЛЕНО: определяем ДО использования)
        const criticalPass = matrixSimilarity > 0.7 && vectorSimilarity > 0.75;

        // 🔴 СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ ПОХОЖИХ ФОРМ РАЗНОГО РАЗМЕРА
        const isSimilarShapeDifferentSize =
            momentSimilarity > 0.9 && // Очень похожие моменты (форма)
            matrixSimilarity > 0.7 && // Похожие матрицы (структура)
            sizeRatio < 0.7 && sizeRatio > 0.4; // Разные, но не экстремальные размеры

        if (isSimilarShapeDifferentSize && totalSimilarity > 0.7) {
            decision = 'similar';
            reason = `Похожие формы разного размера (${totalSimilarity.toFixed(3)})`;
        }
        else if (criticalPass && totalSimilarity > 0.85) {
            decision = 'same';
            reason = `Очень высокая схожесть структуры (${totalSimilarity.toFixed(3)})`;
        } else if (totalSimilarity > 0.75 && matrixSimilarity > 0.6) {
            decision = 'similar';
            reason = `Похожая структура (${totalSimilarity.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Разные структуры (${totalSimilarity.toFixed(3)})`;
        }

        console.log(`📊 Каскадное сравнение завершено: ${totalSimilarity.toFixed(3)} (${decision})`);
        console.log(`   🎭 Матрица: ${matrixSimilarity.toFixed(3)}, Векторы: ${vectorSimilarity.toFixed(3)}`);
        console.log(`   📏 Соотношение размеров: ${sizeRatio.toFixed(2)}`);

        return {
            similarity: totalSimilarity,
            decision,
            reason,
            steps,
            criticalPass,
            isSimilarShapeDifferentSize,
            details: {
                bitmask: bitmaskResult,
                moments: momentResult,
                matrix: matrixResult,
                vector: vectorResult,
                graph: graphResult,
                weights,
                sizeRatio
            },
            timeMs: Date.now() - startTime
        };
    }

    // 4. ПРОСТОЕ СРАВНЕНИЕ ГРАФОВ (если нет matcher)
    compareGraphsSimple(otherGraph) {
        const invariants1 = this.graph.getBasicInvariants();
        const invariants2 = otherGraph.getBasicInvariants();

        const comparisons = [
            { name: 'nodeCount', score: Math.min(invariants1.nodeCount, invariants2.nodeCount) / Math.max(invariants1.nodeCount, invariants2.nodeCount) },
            { name: 'edgeCount', score: Math.min(invariants1.edgeCount, invariants2.edgeCount) / Math.max(invariants1.edgeCount, invariants2.edgeCount) },
            { name: 'avgDegree', score: 1 - Math.min(1, Math.abs(invariants1.avgDegree - invariants2.avgDegree) / 3) },
            { name: 'clustering', score: 1 - Math.min(1, Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient) / 0.3) }
        ];

        const similarity = comparisons.reduce((sum, c) => sum + c.score, 0) / comparisons.length;

        return {
            similarity,
            comparisons,
            invariants1,
            invariants2
        };
    }

    // 5. БЫСТРЫЙ ОТСЕВ
    quickReject(stage, result, steps, startTime) {
        return {
            similarity: result.similarity || 0,
            decision: 'different',
            reason: `Быстрый отсев на этапе ${stage}`,
            steps,
            fastReject: true,
            timeMs: Date.now() - startTime
        };
    }

    // 6. ОБЪЕДИНЕНИЕ С ДРУГИМ ОТПЕЧАТКОМ
    merge(otherFootprint, transformation = null) {
        console.log(`🔄 Объединяю с "${otherFootprint.name}"...`);

        // Проверить, можно ли объединять
        const comparison = this.compare(otherFootprint);

        if (comparison.decision !== 'same' && comparison.similarity < 0.6) {
            console.log(`❌ Не могу объединить: ${comparison.reason}`);
            return {
                success: false,
                reason: comparison.reason,
                similarity: comparison.similarity
            };
        }

        // Объединить битовые маски
        this.bitmask.bitmask = BitmaskFootprint.mergeMasks(
            this.bitmask.bitmask,
            otherFootprint.bitmask.bitmask
        );

        // Объединить точки графа (простое объединение)
        const previousNodeCount = this.graph.nodes.size;

        // Добавить точки из другого отпечатка
        if (otherFootprint.originalPoints && otherFootprint.originalPoints.length > 0) {
            const combinedPoints = [
                ...this.originalPoints,
                ...otherFootprint.originalPoints
            ];

            // Перестроить граф из всех точек
            this.graph.buildFromPoints(combinedPoints);
            this.originalPoints = combinedPoints;
        }

        // Обновить метаданные
        this.metadata.totalPhotos += otherFootprint.metadata.totalPhotos;
        this.metadata.lastUpdated = new Date();

        if (transformation) {
            this.metadata.transformations.push({
                timestamp: new Date(),
                with: otherFootprint.id,
                transformation: transformation
            });
        }

        // Пересчитать моменты из объединённых точек
        this.moments.calculateFromPoints(this.originalPoints);

        // Пересчитать матрицу расстояний
        this.distanceMatrix.createFromPoints(this.originalPoints);

        // Пересчитать векторную схему
        this.vectorGraph.createFromPoints(this.originalPoints);

        // Добавить точки в трекер
        if (otherFootprint.originalPoints) {
            this.pointTracker.processNewPoints(otherFootprint.originalPoints, {
                source: 'merge',
                fromFootprint: otherFootprint.id,
                transformation: transformation
            });
        }

        // Обновить статистику
        this.updateConfidence();

        const addedNodes = this.graph.nodes.size - previousNodeCount;

        console.log(`✅ Объединено успешно!`);
        console.log(`   📊 +${addedNodes} узлов, всего ${this.graph.nodes.size}`);
        console.log(`   📸 Всего фото: ${this.metadata.totalPhotos}`);
        console.log(`   💎 Уверенность: ${Math.round(this.stats.confidence * 100)}%`);

        return {
            success: true,
            addedNodes,
            totalNodes: this.graph.nodes.size,
            totalPhotos: this.metadata.totalPhotos,
            similarity: comparison.similarity,
            confidence: this.stats.confidence
        };
    }

    // 7. ОБЪЕДИНЕНИЕ С ПРЕОБРАЗОВАНИЕМ (новый улучшенный метод)
    mergeWithTransformation(otherFootprint) {
        console.log(`🔄 Объединяю с преобразованием "${otherFootprint.name}"...`);

        // 1. Сравнить векторные схемы для нахождения трансформации
        const vectorComparison = this.vectorGraph.compare(otherFootprint.vectorGraph);

        if (vectorComparison.similarity < 0.6) {
            console.log(`❌ Векторные схемы слишком разные: ${vectorComparison.similarity.toFixed(3)}`);
            return {
                success: false,
                reason: `Векторные схемы слишком разные: ${vectorComparison.similarity.toFixed(3)}`
            };
        }

        // 2. Применить трансформацию к точкам другого отпечатка
        const transformedPoints = otherFootprint.originalPoints; // Пока без трансформации

        // 3. Обработать точки через трекер
        const trackerResult = this.pointTracker.processNewPoints(
            transformedPoints,
            {
                source: 'merge',
                fromFootprint: otherFootprint.id,
                transformation: vectorComparison.transformation || {}
            }
        );

        // 4. Пересчитать все представления из ВСЕХ точек (не только высокодостоверных)
        const allPoints = this.pointTracker.getAllPoints();

        if (allPoints.length < 10) {
            console.log('❌ Недостаточно точек после объединения:', allPoints.length);
            return {
                success: false,
                reason: `Недостаточно точек после объединения: ${allPoints.length}`
            };
        }

        // Обновить все представления
        this.originalPoints = allPoints;
        this.bitmask.createFromPoints(allPoints);
        this.moments.calculateFromPoints(allPoints);
        this.distanceMatrix.createFromPoints(allPoints);
        this.vectorGraph.createFromPoints(allPoints);

        // Обновить граф
        const graphPoints = allPoints.map(pt => ({
            x: pt.x,
            y: pt.y,
            confidence: pt.rating || pt.confidence || 0.5
        }));
        this.graph.buildFromPoints(graphPoints);

        // Обновить метаданные
        this.metadata.totalPhotos += otherFootprint.metadata.totalPhotos;
        this.metadata.lastUpdated = new Date();
        this.metadata.transformations.push({
            timestamp: new Date(),
            with: otherFootprint.id,
            transformation: vectorComparison.transformation || {},
            pointsAdded: trackerResult.added || 0,
            pointsUpdated: trackerResult.updated || 0
        });

        // Обновить статистику
        this.updateConfidence();

        console.log(`✅ Объединено с преобразованием успешно!`);
        console.log(`   📍 Добавлено точек: ${trackerResult.added || 0}`);
        console.log(`   📊 Всего точек: ${allPoints.length}`);
        console.log(`   💎 Новая уверенность: ${Math.round(this.stats.confidence * 100)}%`);

        return {
            success: true,
            transformation: vectorComparison.transformation || {},
            trackerResult,
            totalPoints: allPoints.length,
            addedPoints: trackerResult.added || 0,
            confidence: this.stats.confidence
        };
    }

    // 8. БЫСТРЫЙ ПОИСК ПО БИТОВОЙ МАСКЕ (для базы данных)
    static fastSearch(queryBitmask, database, maxDistance = 20) {
        const startTime = Date.now();
        const results = [];

        database.forEach((item, index) => {
            if (item.bitmask && item.bitmask.bitmask) {
                const distance = BitmaskFootprint.hammingDistance(
                    queryBitmask,
                    item.bitmask.bitmask
                );

                if (distance <= maxDistance) {
                    results.push({
                        item,
                        index,
                        bitmaskDistance: distance,
                        bitmaskSimilarity: 1 - (distance / 64)
                    });
                }
            }
        });

        // Сортировать по расстоянию
        results.sort((a, b) => a.bitmaskDistance - b.bitmaskDistance);

        console.log(`🔍 Быстрый поиск: ${results.length} кандидатов за ${Date.now() - startTime}мс`);

        return results;
    }

    // 9. ПОЛУЧИТЬ ИНФОРМАЦИЮ
    getInfo() {
        const trackerStats = this.pointTracker.getStats();

        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            stats: {
                ...this.stats,
                qualityScore: Math.round(this.stats.qualityScore * 100)
            },
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toLocaleString('ru-RU'),
                lastUpdated: this.metadata.lastUpdated.toLocaleString('ru-RU')
            },
            representations: {
                bitmask: `0x${this.bitmask.bitmask.toString(16).slice(0, 8)}...`,
                moments: this.moments.get7Moments().length,
                graphNodes: this.graph.nodes.size,
                graphEdges: this.graph.edges.size,
                matrixSize: this.getMatrixSizeString(),
                vectorCount: this.getVectorCount(),
                trackerPoints: trackerStats.totalPoints,
                trackerConfidence: trackerStats.confidence
            }
        };
    }

    // 10. ВИЗУАЛИЗИРОВАТЬ ВСЕ ПРЕДСТАВЛЕНИЯ
    visualize() {
        console.log(`\n🎭 ГИБРИДНЫЙ ОТПЕЧАТОК "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
        console.log(`├─ Качество: ${Math.round(this.stats.qualityScore * 100)}%`);
        console.log(`├─ Фото: ${this.metadata.totalPhotos}`);
        console.log(`└─ Создан: ${this.metadata.created.toLocaleString('ru-RU')}`);

        console.log(`\n🎭 ПРЕДСТАВЛЕНИЯ:`);
        console.log(`├─ Битовая маска:`);
        this.bitmask.visualize();

        console.log(`\n├─ Геометрические моменты:`);
        this.moments.visualize();

        console.log(`\n├─ Матрица расстояний:`);
        this.distanceMatrix.visualize(8);

        console.log(`\n├─ Векторная схема:`);
        this.vectorGraph.visualize();

        console.log(`\n├─ Трекер точек:`);
        this.pointTracker.visualize();

        console.log(`\n└─ Граф:`);
        this.graph.visualize();
    }

    // 11. СОХРАНИТЬ В JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            bitmask: this.bitmask.toJSON(),
            moments: this.moments.toJSON(),
            graph: this.graph.toJSON(),
            distanceMatrix: this.distanceMatrix.toJSON(),
            vectorGraph: this.vectorGraph.toJSON(),
            pointTracker: this.pointTracker.toJSON(),
            originalPoints: this.originalPoints,
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toISOString(),
                lastUpdated: this.metadata.lastUpdated.toISOString()
            },
            stats: this.stats,
            _version: '2.0', // Обновлена версия
            _savedAt: new Date().toISOString()
        };
    }

    // 12. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        console.log(`📂 Загружаю гибридный отпечаток "${data.name}"...`);

        const footprint = new HybridFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            bitmaskData: data.bitmask,
            momentData: data.moments,
            graph: SimpleGraph.fromJSON(data.graph),
            distanceMatrixData: data.distanceMatrix,
            vectorGraphData: data.vectorGraph,
            pointTrackerData: data.pointTracker,
            originalPoints: data.originalPoints || [],
            metadata: data.metadata,
            confidence: data.stats?.confidence
        });

        if (data.stats) {
            footprint.stats = { ...footprint.stats, ...data.stats };
        }

        console.log(`✅ Загружен гибридный отпечаток "${footprint.name}" версии ${data._version || '1.0'}`);

        return footprint;
    }

    // 13. ТЕСТ: СОЗДАТЬ И СРАВНИТЬ ДВА ОТПЕЧАТКА
    static testComparison() {
        console.log('\n🧪 ТЕСТ ГИБРИДНОЙ СИСТЕМЫ:');

        // Создать два похожих отпечатка
        const points1 = [];
        const points2 = [];

        for (let i = 0; i < 30; i++) {
            points1.push({
                x: 100 + Math.random() * 200,
                y: 100 + Math.random() * 100,
                confidence: 0.8
            });

            // points2 - немного смещённая версия points1
            points2.push({
                x: points1[i].x + Math.random() * 20 - 10,
                y: points1[i].y + Math.random() * 20 - 10,
                confidence: 0.8
            });
        }

        const footprint1 = new HybridFootprint({ name: 'Тест 1' });
        const footprint2 = new HybridFootprint({ name: 'Тест 2' });

        footprint1.createFromPoints(points1);
        footprint2.createFromPoints(points2);

        console.log('\n🔍 СРАВНЕНИЕ:');
        const result = footprint1.compare(footprint2);

        console.log(`📊 Similarity: ${result.similarity.toFixed(3)}`);
        console.log(`🤔 Decision: ${result.decision}`);
        console.log(`💡 Reason: ${result.reason}`);
        console.log(`⏱️ Time: ${result.timeMs}ms`);

        if (result.steps) {
            console.log('\n📈 ШАГИ КАСКАДА:');
            result.steps.forEach((step, i) => {
                console.log(`${i+1}. ${step.step}: ${step.result?.similarity?.toFixed(3) || 'N/A'} (${step.time}ms)`);
            });
        }

        // Тест объединения с трансформацией
        console.log('\n🔄 ТЕСТ ОБЪЕДИНЕНИЯ С ТРАНСФОРМАЦИЕЙ:');
        const mergeResult = footprint1.mergeWithTransformation(footprint2);
        console.log(`✅ Успех: ${mergeResult.success}`);
        if (mergeResult.success) {
            console.log(`   📍 Высокодостоверных точек: ${mergeResult.highConfidencePoints}`);
            console.log(`   💎 Уверенность: ${Math.round(mergeResult.confidence * 100)}%`);
        }

        return result;
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ для исправления ошибок

    // Получить количество векторов (безопасно)
    getVectorCount() {
        try {
            // Попробовать метод getVectorCount, если он существует
            if (this.vectorGraph && typeof this.vectorGraph.getVectorCount === 'function') {
                return this.vectorGraph.getVectorCount();
            }
            // Если метод отсутствует, попробовать получить данные из starVectors
            if (this.vectorGraph && this.vectorGraph.starVectors && Array.isArray(this.vectorGraph.starVectors)) {
                return this.vectorGraph.starVectors.reduce((sum, sv) =>
                    sum + (sv.vectors ? sv.vectors.length : 0), 0);
            }
            return 0;
        } catch (error) {
            console.log('⚠️ Ошибка при получении количества векторов:', error.message);
            return 0;
        }
    }

    // Получить размер матрицы (безопасно)
    getMatrixSizeString() {
        try {
            if (this.distanceMatrix && typeof this.distanceMatrix.getSizeString === 'function') {
                return this.distanceMatrix.getSizeString();
            }
            if (this.distanceMatrix && this.distanceMatrix.matrix && Array.isArray(this.distanceMatrix.matrix)) {
                const rows = this.distanceMatrix.matrix.length;
                const cols = rows > 0 && this.distanceMatrix.matrix[0] ? this.distanceMatrix.matrix[0].length : 0;
                return `${rows}x${cols}`;
            }
            return '0x0';
        } catch (error) {
            console.log('⚠️ Ошибка при получении размера матрицы:', error.message);
            return '0x0';
        }
    }
}

module.exports = HybridFootprint;
