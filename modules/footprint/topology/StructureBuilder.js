// modules/footprint/topology/StructureBuilder.js
// 🔨 СТРОИТЕЛЬ ТОПОЛОГИЧЕСКИХ СТРУКТУР - собирает связные компоненты от затравки

const TopologicalStructure = require('./Structure');

class StructureBuilder {
    /**
     * @param {Object} validator - экземпляр ValidationModule для вычисления transform
     * @param {Object} options - настройки
     */
    constructor(validator, options = {}) {
    this.validator = validator;
    this.debug = options.debug || false;
   
    // Базовые пороги (жёсткий режим)
    this.minConfidence = options.minConfidence || 0.7;
    this.maxScaleDeviation = options.maxScaleDeviation || 0.1;
    this.maxRotationDeviation = options.maxRotationDeviation || 5;
   
    // Дополнительные пороги для мягкого режима
    this.softMinConfidence = options.softMinConfidence || 0.6;
    this.softMaxScaleDeviation = options.softMaxScaleDeviation || 0.15;
    this.softMaxRotationDeviation = options.softMaxRotationDeviation || 10;
    this.maxAllowedBadRays = options.maxAllowedBadRays || 1;
   
    // Режим мягкости (0 = строгий, 1 = средний, 2 = мягкий)
    this.softnessLevel = options.softnessLevel || 0;
       
        this.stats = {
            structuresBuilt: 0,
            trianglesProcessed: 0,
            rejections: {
                lowConfidence: 0,
                scaleMismatch: 0,
                rotationMismatch: 0,
                transformFailed: 0,
                rayMismatch: 0  // 🔥 НОВОЕ
            }
        };
       
        if (this.debug) {
            console.log('🔨 StructureBuilder создан');
            console.log(`   • Мин. уверенность: ${this.minConfidence * 100}%`);
            console.log(`   • Макс. отклонение масштаба: ${this.maxScaleDeviation * 100}%`);
            console.log(`   • Макс. отклонение поворота: ${this.maxRotationDeviation}°`);
        }
    }
/ 🔥 НОВЫЙ МЕТОД: пошаговое увеличение мягкости
increaseSoftness() {
    this.softnessLevel++;
   
    switch(this.softnessLevel) {
        case 1:
            console.log('🔧 Переход на МЯГКИЙ режим (уровень 1):');
            console.log(`   • Уверенность: ${this.minConfidence} → ${this.softMinConfidence}`);
            console.log(`   • Масштаб: ${this.maxScaleDeviation*100}% → ${this.softMaxScaleDeviation*100}%`);
            console.log(`   • Поворот: ${this.maxRotationDeviation}° → ${this.softMaxRotationDeviation}°`);
            console.log(`   • Плохих лучей: 1 (допустимо)`);
           
            this.minConfidence = this.softMinConfidence;
            this.maxScaleDeviation = this.softMaxScaleDeviation;
            this.maxRotationDeviation = this.softMaxRotationDeviation;
            break;
           
        case 2:
            console.log('🔧 Переход на ОЧЕНЬ МЯГКИЙ режим (уровень 2):');
            console.log(`   • Уверенность: ${this.minConfidence} → 0.5`);
            console.log(`   • Масштаб: ${this.maxScaleDeviation*100}% → 20%`);
            console.log(`   • Поворот: ${this.maxRotationDeviation}° → 15°`);
            console.log(`   • Плохих лучей: 2 (допустимо)`);
           
            this.minConfidence = 0.5;
            this.maxScaleDeviation = 0.2;
            this.maxRotationDeviation = 15;
            this.maxAllowedBadRays = 2;
            break;
           
        default:
            console.log('⚠️ Максимальный уровень мягкости достигнут');
    }
   
    return this.softnessLevel;
}

  
    /**
     * Возвращает начальные граничные рёбра для затравки
     * @param {Object} triangle - треугольник-затравка
     * @returns {Array} - очередь рёбер для роста
     */
    getInitialGrowthEdges(triangle) {
        const queue = [];
       
        if (!triangle || !triangle.edges) return queue;
       
        for (let i = 0; i < triangle.edges.length; i++) {
            const edge = triangle.edges[i];
            if (edge && edge.v1 && edge.v2) {
                const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
               
                queue.push({
                    edgeKey,
                    edge,
                    sourceTriangle: triangle
                });
            }
        }
       
        return queue;
    }
   
    /**
     * Возвращает новые граничные рёбра после добавления треугольника
     * @param {Object} triangle - добавленный треугольник
     * @param {TopologicalStructure} structure - текущая структура
     * @param {string} incomingEdgeKey - ребро, через которое пришли
     * @returns {Array} - новые рёбра для роста
     */
    getNewBoundaryEdges(triangle, structure, incomingEdgeKey) {
        const newEdges = [];
       
        if (!triangle || !triangle.edges) return newEdges;
       
        for (let i = 0; i < triangle.edges.length; i++) {
            const edge = triangle.edges[i];
            if (!edge || !edge.v1 || !edge.v2) continue;
           
            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
           
            // Пропускаем ребро, через которое пришли
            if (edgeKey === incomingEdgeKey) continue;
           
            // Проверяем, не стало ли это ребро внутренним
            if (structure && !structure.boundaryEdges.has(edgeKey)) {
                newEdges.push({
                    edgeKey,
                    edge,
                    sourceTriangle: triangle
                });
            }
        }
       
        return newEdges;
    }
   
    /**
     * Ищет треугольники, содержащие заданное ребро
     * @param {string} edgeKey - ключ ребра (id1--id2)
     * @param {Array} allTriangles - все доступные треугольники
     * @param {Set} processed - уже обработанные треугольники
     * @returns {Array} - подходящие треугольники
     */
    findTrianglesByEdge(edgeKey, allTriangles, processed) {
        const [id1, id2] = edgeKey.split('--');
        const candidates = [];
       
        if (!allTriangles || allTriangles.length === 0) return candidates;
       
        for (const triangle of allTriangles) {
            // Пропускаем уже обработанные
            if (processed.has(triangle.id)) continue;
           
            // Проверяем, содержит ли треугольник это ребро
            if (triangle.edges) {
                for (let i = 0; i < triangle.edges.length; i++) {
                    const edge = triangle.edges[i];
                    if (edge && edge.v1 && edge.v2) {
                        const triEdgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
                        if (triEdgeKey === edgeKey) {
                            candidates.push(triangle);
                            break;
                        }
                    }
                }
            }
        }
       
        // Сортируем по уверенности
        return candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }
   
    /**
     * Собирает все якоря из структуры плюс новый треугольник
     * @param {TopologicalStructure} structure - текущая структура
     * @param {Object} newTriangle - новый треугольник
     * @returns {Array} - массив якорей для вычисления transform
     */
    collectAnchors(structure, newTriangle) {
        const anchors = [];
       
        // Добавляем все якоря из структуры
        if (structure && structure.getAnchors) {
            anchors.push(...structure.getAnchors());
        }
       
        // Добавляем якоря из нового треугольника
        if (newTriangle && newTriangle.p1 && newTriangle.pB1) {
            anchors.push({
                pointA: newTriangle.p1.id,
                pointB: newTriangle.pB1.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }
        if (newTriangle && newTriangle.p2 && newTriangle.pB2) {
            anchors.push({
                pointA: newTriangle.p2.id,
                pointB: newTriangle.pB2.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }
        if (newTriangle && newTriangle.p3 && newTriangle.pB3) {
            anchors.push({
                pointA: newTriangle.p3.id,
                pointB: newTriangle.pB3.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }
       
        return anchors;
    }
   
    /**
     * Пытается добавить треугольник в структуру
     * @param {Object} triangle - проверяемый треугольник
     * @param {TopologicalStructure} structure - текущая структура
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     * @param {Map} morphologyMap - морфология первого следа
     * @param {Map} modelMorphology - морфология второго следа
     * @returns {boolean} - успешно ли добавлен
     */
tryAddTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology) {
    if (!triangle) return false;

    // 🔥 ИНИЦИАЛИЗИРУЕМ rejectionDetails, если ещё нет
    if (!this.stats.rejectionDetails) {
        this.stats.rejectionDetails = {};
    }

    // 1. Проверка уверенности
    if ((triangle.confidence || 0) < this.minConfidence) {
        this.stats.rejections.lowConfidence++;
        // 🔥 ДЕТАЛЬНАЯ СТАТИСТИКА
        this.stats.rejectionDetails['low_confidence'] = (this.stats.rejectionDetails['low_confidence'] || 0) + 1;
        if (this.debug) {
            console.log(`      ❌ Низкая уверенность: ${(triangle.confidence*100).toFixed(1)}% < ${this.minConfidence*100}%`);
        }
        return false;
    }

    // 🔥 ОПРЕДЕЛЯЕМ НОВЫЕ ТОЧКИ
    const newPoints = [];
    const existingPoints = [];

    [triangle.p1, triangle.p2, triangle.p3].forEach(p => {
        if (p && p.id) {
            if (structure.pointIds.has(p.id)) {
                existingPoints.push(p);
            } else {
                newPoints.push(p);
            }
        }
    });

    if (newPoints.length > 0 && this.debug) {
        console.log(`      🔍 Новые точки в треугольнике: ${newPoints.map(p => p.id.substring(0,8)).join(', ')}`);
    }

    // 🔥 ОПРЕДЕЛЯЕМ РЕЖИМ ПРОВЕРКИ
    // Если в структуре уже есть точки (не первый треугольник), используем мягкий режим для достройки
    const isExpansion = structure.pointIds.size > 3;
// 🔥 Используем настраиваемый параметр вместо жёсткого 1
const maxAllowedBadRays = isExpansion ? this.maxAllowedBadRays : 0;
   
    if (this.debug && isExpansion) {
        console.log(`      🔧 Режим ДОСТРОЙКИ (допускается ${maxAllowedBadRays} плохой луч)`);
    }

    let badRays = 0;

    // 🔥 ПРОВЕРКА ЛУЧЕЙ
    for (const newPoint of newPoints) {
        const edgesWithNewPoint = triangle.edges.filter(e =>
            e.v1.id === newPoint.id || e.v2.id === newPoint.id
        );

        for (const edge of edgesWithNewPoint) {
            const opposite = [triangle.p1, triangle.p2, triangle.p3].find(p =>
                p.id !== edge.v1.id && p.id !== edge.v2.id
            );
            if (!opposite) continue;

            const externalPoint = edge.externalPoint;
            if (!externalPoint) continue;

            if (structure.transform) {
                const projectedNew = this.validator.applyTransform(newPoint, structure.transform);
                const projectedExternal = this.validator.applyTransform(externalPoint, structure.transform);

                const dx = projectedNew.x - projectedExternal.x;
                const dy = projectedNew.y - projectedExternal.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                const nodeA = graphB?.nodes?.get(newPoint.id);
                const nodeB = graphB?.nodes?.get(externalPoint.id);
                const expectedDist = nodeA && nodeB ?
                    Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2)) : 0;

                const scale = structure.transform.scale;
                const expectedInModel = expectedDist * scale;
                const relativeError = expectedInModel > 0 ? Math.abs(dist - expectedInModel) / expectedInModel : 1;

                if (relativeError > 0.3) {
                    badRays++;
                    // 🔥 ФИКСИРУЕМ НЕУДАЧНЫЙ ЛУЧ
                    if (structure.addFailedRay) {
                        structure.addFailedRay(triangle, edge, externalPoint);
                    }
                    if (this.debug) {
                        console.log(`      ⚠️ Луч из новой точки ${newPoint.id.substring(0,8)} улетает (ошибка ${(relativeError*100).toFixed(1)}%)`);
                    }
                } else if (externalPoint && structure.addSuccessRay) {
                    // 🔥 ФИКСИРУЕМ УСПЕШНЫЙ ЛУЧ
                    structure.addSuccessRay(triangle, edge, externalPoint);
                }
            }
        }
    }

    // Проверяем, проходим ли по количеству плохих лучей
    if (badRays > maxAllowedBadRays) {
    if (this.debug) {
        console.log(`      ❌ Отвергнуто: ${badRays} неудачных лучей (допустимо ${maxAllowedBadRays})`);
    }
    this.stats.rejections.rayMismatch = (this.stats.rejections.rayMismatch || 0) + 1;
    // 🔥 ДЕТАЛЬНАЯ СТАТИСТИКА
    const reason = `too_many_bad_rays_${badRays}`;
    this.stats.rejectionDetails[reason] = (this.stats.rejectionDetails[reason] || 0) + 1;
    return false;
}

    if (this.debug && badRays > 0) {
        console.log(`      ✅ Лучи: ${badRays} неудачных (допустимо)`);
    }

    // 2. Если в структуре уже есть transform, проверяем согласованность
    if (structure && structure.transform) {
        const existingAnchors = structure.getAnchors ? structure.getAnchors() : [];
        const newAnchors = this.collectAnchors(null, triangle);
        const testAnchors = [...existingAnchors, ...newAnchors];

        if (testAnchors.length < 3) {
            this.stats.rejections.transformFailed++;
            return false;
        }

        const testTransform = this.validator.calculateTransform(
            testAnchors,
            graphA,
            graphB
        );

        if (!testTransform) {
            this.stats.rejections.transformFailed++;
            if (this.debug) {
                console.log(`      ❌ Не удалось вычислить transform`);
            }
            return false;
        }

        const scaleDiff = Math.abs(testTransform.scale - structure.transform.scale) / Math.max(structure.transform.scale, 0.001);
        if (scaleDiff > this.maxScaleDeviation) {
    this.stats.rejections.scaleMismatch++;
    // 🔥 ДЕТАЛЬНАЯ СТАТИСТИКА
    this.stats.rejectionDetails['scale_mismatch'] = (this.stats.rejectionDetails['scale_mismatch'] || 0) + 1;
    if (this.debug) {
        console.log(`      ❌ Масштаб: ${testTransform.scale.toFixed(3)} vs ${structure.transform.scale.toFixed(3)} (${(scaleDiff*100).toFixed(1)}%)`);
    }
    return false;
}

        const rotDiff = Math.abs(testTransform.rotation - structure.transform.rotation) * 180 / Math.PI;
        if (rotDiff > this.maxRotationDeviation) {
    this.stats.rejections.rotationMismatch++;
    // 🔥 ДЕТАЛЬНАЯ СТАТИСТИКА
    this.stats.rejectionDetails['rotation_mismatch'] = (this.stats.rejectionDetails['rotation_mismatch'] || 0) + 1;
    if (this.debug) {
        console.log(`      ❌ Поворот: ${(testTransform.rotation * 180 / Math.PI).toFixed(1)}° vs ${(structure.transform.rotation * 180 / Math.PI).toFixed(1)}° (${rotDiff.toFixed(1)}°)`);
    }
    return false;
}

        structure.transform = testTransform;

        if (this.debug) {
            console.log(`      ✅ Согласован: масштаб ${testTransform.scale.toFixed(3)}, поворот ${(testTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
        }
    }

    // Отладка лучей
    if (this.debug && triangle.edges) {
        let hasExternal = false;
        for (const e of triangle.edges) {
            if (e.externalPoint) {
                hasExternal = true;
                console.log(`      🔍 Треугольник ${triangle.id.substring(0,12)} имеет луч из ребра ${e.v1.id.substring(0,8)}-${e.v2.id.substring(0,8)} → ${e.externalPoint.id.substring(0,8)}`);
            }
        }
        if (!hasExternal && this.debug) {
            console.log(`      ⚠️ Треугольник ${triangle.id.substring(0,12)} НЕ ИМЕЕТ лучей (externalPoint отсутствует)`);
        }
    }

    // Добавляем треугольник
    if (structure) {
        structure.addTriangle(triangle);
    }
   
    if (this.debug) {
        if (badRays === 0) {
            console.log(`      ✅ Треугольник добавлен (строгий режим)`);
        } else {
            console.log(`      ✅ Треугольник добавлен (мягкий режим, ${badRays} плохих лучей)`);
        }
    }
   
    return true;
}
   
    /**
     * Строит структуру от заданного треугольника-затравки
     * @param {Object} seedTriangle - начальный треугольник (уже должен быть якорем)
     * @param {Array} allTriangles - все доступные треугольники-кандидаты
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     * @param {Map} morphologyMap - морфология первого следа
     * @param {Map} modelMorphology - морфология второго следа
     * @returns {TopologicalStructure} - построенная структура
     */
    buildFromSeed(seedTriangle, allTriangles, graphA, graphB, morphologyMap, modelMorphology) {
    if (!seedTriangle) {
        if (this.debug) console.log(`⚠️ Нет треугольника-затравки`);
        return null;
    }
   
    // 🔥 ПРОВЕРЯЕМ, ЧТО У ТРЕУГОЛЬНИКА ЕСТЬ ВСЕ ТРИ ТОЧКИ
    if (!seedTriangle.p1 || !seedTriangle.p2 || !seedTriangle.p3) {
        if (this.debug) console.log(`⚠️ Треугольник-затравка не имеет всех трёх точек`);
        return null;
    }
   
if (seedTriangle.p1.id === seedTriangle.p2.id ||
    seedTriangle.p1.id === seedTriangle.p3.id ||
    seedTriangle.p2.id === seedTriangle.p3.id) {
    if (this.debug) {
        console.log(`⚠️ Треугольник-затравка имеет дублирующиеся точки:`);
        console.log(`   p1: ${seedTriangle.p1.id}`);
        console.log(`   p2: ${seedTriangle.p2.id}`);
        console.log(`   p3: ${seedTriangle.p3.id}`);
    }
    return null;
}
       
        if (this.debug) {
            console.log(`\n🔨 Строю структуру от треугольника ${seedTriangle.id?.substring(0,12) || 'unknown'}...`);
        }
       
        // 🔥 ДИАГНОСТИКА: показываем информацию о первом треугольнике
        if (allTriangles && allTriangles.length > 0) {
            const firstTri = allTriangles[0];
            console.log(`\n🔍 ДИАГНОСТИКА ПЕРВОГО ТРЕУГОЛЬНИКА:`);
            console.log(`   ID: ${firstTri.id?.substring(0,20)}`);
            console.log(`   Есть p1: ${!!firstTri.p1}, p2: ${!!firstTri.p2}, p3: ${!!firstTri.p3}`);
            console.log(`   Есть pB1: ${!!firstTri.pB1}, pB2: ${!!firstTri.pB2}, pB3: ${!!firstTri.pB3}`);
            console.log(`   Есть edges: ${!!firstTri.edges}, количество: ${firstTri.edges?.length || 0}`);
            if (firstTri.edges && firstTri.edges.length > 0) {
                console.log(`   Первое ребро: v1=${firstTri.edges[0]?.v1?.id?.substring(0,12)}, v2=${firstTri.edges[0]?.v2?.id?.substring(0,12)}`);
                console.log(`   Есть externalPoint: ${!!firstTri.edges[0]?.externalPoint}`);
            }
            console.log(`   Уверенность: ${firstTri.confidence || 0.5}`);
        }
       
        // Создаём новую структуру
        const structureId = `struct_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const structure = new TopologicalStructure(structureId, seedTriangle);
       
        // Карта всех треугольников по ID для быстрого доступа
        const trianglesMap = new Map();
        if (allTriangles) {
            allTriangles.forEach(t => {
                if (t && t.id) trianglesMap.set(t.id, t);
            });
        }
       
        // Множество обработанных треугольников
        const processed = new Set([seedTriangle.id]);
       
        // Очередь на добавление (граничные рёбра -> ищем треугольники)
        let growthQueue = this.getInitialGrowthEdges(seedTriangle);
       
        let iteration = 0;
        const maxIterations = 100; // защита от бесконечного цикла
       
        while (growthQueue.length > 0 && iteration < maxIterations) {
            iteration++;
           
            if (this.debug && iteration % 10 === 0) {
                console.log(`   Итерация ${iteration}, очередь: ${growthQueue.length}`);
            }
           
            // Берём следующее ребро для роста
            const { edgeKey, edge } = growthQueue.shift();
           
            // Ищем треугольники, использующие это ребро
            const candidates = this.findTrianglesByEdge(edgeKey, allTriangles, processed);
           
            if (candidates.length === 0) {
                continue; // нет кандидатов на этом ребре
            }
           
            if (this.debug && candidates.length > 0) {
                console.log(`   Ребро ${edgeKey} даёт ${candidates.length} кандидатов`);
            }
           
            // Пробуем добавить каждого кандидата
            for (const candidate of candidates) {
                const added = this.tryAddTriangle(
                    candidate,
                    structure,
                    graphA,
                    graphB,
                    morphologyMap,
                    modelMorphology
                );
               
                if (added) {
                    // Успешно добавили - помечаем как обработанный
                    processed.add(candidate.id);
                   
                    // Добавляем новые граничные рёбра в очередь
                    const newEdges = this.getNewBoundaryEdges(candidate, structure, edgeKey);
                    growthQueue.push(...newEdges);
                   
                    if (this.debug) {
                        console.log(`      ✅ Добавлен треугольник ${candidate.id?.substring(0,12)}`);
                    }
                   
                    break; // берём только один треугольник на ребро
                }
            }
        }
       
        // Вычисляем финальный transform структуры
        if (structure && structure.triangleIds.size >= 2 && this.validator) {
            const anchors = structure.getAnchors ? structure.getAnchors() : [];
            if (anchors.length >= 3) {
                const transform = this.validator.calculateTransform(anchors, graphA, graphB);
                if (transform) {
                    structure.transform = transform;
                }
            }
        }
       
        this.stats.structuresBuilt++;
        this.stats.trianglesProcessed += structure.triangleIds.size;
       
        if (this.debug) {
            const stats = structure.getStats ? structure.getStats() : { triangleCount: structure.triangleIds.size, pointCount: structure.pointIds.size, confidence: 0.5 };
            console.log(`\n📊 Структура построена:`);
console.log(`   • Треугольников: ${stats.triangleCount}`);
console.log(`   • Точек: ${stats.pointCount}`);
console.log(`   • Успешных лучей: ${stats.successRayCount || 0}`);
console.log(`   • Неудачных лучей: ${stats.failedRayCount || 0}`);
console.log(`   • Уверенность: ${(stats.confidence * 100).toFixed(1)}%`);
            if (structure.transform) {
                console.log(`   • Масштаб: ${structure.transform.scale.toFixed(3)}`);
                console.log(`   • Поворот: ${(structure.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
            }
        }
       
        return structure;
    }
   
    /**
     * Возвращает статистику построителя
     * @returns {Object} - статистика
     */
    getStats() {
    const stats = {
        ...this.stats,
        rejections: { ...this.stats.rejections }
    };
   
    // Добавляем детальную статистику отказов
    if (this.stats.rejectionDetails) {
        stats.rejectionDetails = { ...this.stats.rejectionDetails };
    }
   
    return stats;
}

printRejectionAnalysis() {
    console.log('\n📊 АНАЛИЗ ОТКАЗОВ ТРЕУГОЛЬНИКОВ:');
    console.log('═'.repeat(50));
   
    const details = this.stats.rejectionDetails || {};
    const totalRejected = Object.values(details).reduce((a, b) => a + b, 0);
   
    console.log(`\n🔴 Всего отвергнуто: ${totalRejected}`);
    console.log('\n📋 ПО ПРИЧИНАМ:');
   
    for (const [reason, count] of Object.entries(details)) {
        const percent = ((count / totalRejected) * 100).toFixed(1);
        console.log(`   • ${reason}: ${count} (${percent}%)`);
    }
   
    console.log('\n📈 ПОДРОБНОСТИ:');
    console.log(`   • Низкая уверенность: ${this.stats.rejections.lowConfidence || 0}`);
    console.log(`   • Несоответствие масштаба: ${this.stats.rejections.scaleMismatch || 0}`);
    console.log(`   • Несоответствие поворота: ${this.stats.rejections.rotationMismatch || 0}`);
    console.log(`   • Проблемы с лучами: ${this.stats.rejections.rayMismatch || 0}`);
    console.log(`   • Ошибка transform: ${this.stats.rejections.transformFailed || 0}`);
}
   
    /**
     * Сбрасывает статистику
     */
resetStats() {
    this.stats = {
        structuresBuilt: 0,
        trianglesProcessed: 0,
        rejections: {
            lowConfidence: 0,
            scaleMismatch: 0,
            rotationMismatch: 0,
            transformFailed: 0,
            rayMismatch: 0
        }
    };
}
}

module.exports = StructureBuilder;
