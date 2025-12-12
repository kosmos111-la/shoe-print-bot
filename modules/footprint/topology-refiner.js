// modules/footprint/topology-refiner.js
// НАСТОЯЩИЙ ПРУЖИННЫЙ КОРРЕКТОР ТОПОЛОГИИ - УТОЧНЕНИЕ ЧЕРЕЗ ГРАФОВЫЕ ОГРАНИЧЕНИЯ

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class TopologyRefiner {
    constructor(options = {}) {
        this.config = {
            springConstant: options.springConstant || 0.15,     // Жёсткость пружин (k)
            repulsionConstant: options.repulsionConstant || 80, // Отталкивание не связанных точек
            damping: options.damping || 0.85,                   // Демпфирование (0.85 = 15% потерь)
            maxIterations: options.maxIterations || 120,        // Максимум итераций
            minEnergy: options.minEnergy || 0.001,              // Минимальная энергия для остановки
            convergenceWindow: options.convergenceWindow || 10, // Окно для проверки сходимости
            preserveAngles: options.preserveAngles !== false,   // Сохранять углы между рёбрами
            preserveDistances: options.preserveDistances !== false, // Сохранять отношения расстояний
            enableRepulsion: options.enableRepulsion !== false, // Включить отталкивание
            debug: options.debug || false,
            visualizeForces: options.visualizeForces || false,
            ...options
        };
       
        // Храним оригинальные топологические отношения
        this.originalEdgeLengths = new Map();  // Идеальные длины рёбер
        this.originalAngles = new Map();       // Оригинальные углы между рёбрами
        this.nodeConnections = new Map();      // Связи каждого узла
       
        this.energyHistory = [];
        this.iterationStats = [];
       
        console.log('🏗️ Создан TopologyRefiner: пружинная коррекция топологии');
        console.log(`   ⚙️ Параметры: k=${this.config.springConstant}, демпфирование=${this.config.damping}`);
    }

    // 1. ОСНОВНОЙ МЕТОД: УТОЧНИТЬ ТОПОЛОГИЮ С УЧЁТОМ ГРАФОВЫХ СВЯЗЕЙ
    refineWithTransformation(points, transformation, graph, options = {}) {
        console.log('🏗️ Запускаю топологическое уточнение через графовые связи...');
       
        if (!graph || graph.nodes.size < 3) {
            console.log('⚠️ Слишком мало узлов для топологической коррекции');
            return {
                points: points,
                improvement: { consistency: 0, edgesPreserved: 0 },
                stats: { iterations: 0, energy: 0 },
                success: false
            };
        }
       
        // 1.1 ЗАПОМНИТЬ ОРИГИНАЛЬНЫЕ ОТНОШЕНИЯ ИЗ ГРАФА
        this.captureOriginalTopology(points, graph);
       
        // 1.2 ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ К ТОЧКАМ
        let currentPoints = this.applyTransformationToPoints(points, transformation);
       
        // 1.3 ОПТИМИЗИРОВАТЬ ЧЕРЕЗ ПРУЖИННУЮ СЕТЬ
        const optimizationResult = this.springLayoutOptimization(currentPoints, graph);
       
        // 1.4 РАССЧИТАТЬ УЛУЧШЕНИЕ
        const improvement = this.calculateTopologicalImprovement(
            points,
            optimizationResult.points,
            graph
        );
       
        // 1.5 СОЗДАТЬ ВИЗУАЛИЗАЦИЮ СИЛ (если нужно)
        let visualizationPath = null;
        if (this.config.visualizeForces && optimizationResult.forces) {
            visualizationPath = this.visualizeSpringForces(
                optimizationResult.points,
                graph,
                optimizationResult.forces,
                options.outputPath
            );
        }
       
        console.log('✅ Топологическое уточнение завершено!');
        console.log(`   📊 Итераций: ${optimizationResult.stats.iterations}`);
        console.log(`   ⚡ Конечная энергия: ${optimizationResult.stats.finalEnergy.toFixed(6)}`);
        console.log(`   🎯 Согласованность: ${(improvement.consistency * 100).toFixed(1)}%`);
        console.log(`   🔗 Сохранено связей: ${improvement.edgesPreserved}%`);
        console.log(`   📈 Улучшение топологии: ${improvement.topologyImprovement.toFixed(1)}%`);
       
        return {
            points: optimizationResult.points,
            improvement: improvement,
            stats: optimizationResult.stats,
            energyHistory: this.energyHistory,
            iterationStats: this.iterationStats,
            visualization: visualizationPath,
            originalTopology: {
                edgeLengths: Array.from(this.originalEdgeLengths.entries()),
                angles: Array.from(this.originalAngles.entries()),
                connections: Array.from(this.nodeConnections.entries())
            },
            success: true
        };
    }

    // 2. ЗАПОМНИТЬ ОРИГИНАЛЬНУЮ ТОПОЛОГИЮ ИЗ ГРАФА
    captureOriginalTopology(points, graph) {
        console.log('📊 Запоминаю оригинальную топологию из графа...');
       
        this.originalEdgeLengths.clear();
        this.originalAngles.clear();
        this.nodeConnections.clear();
       
        const nodeList = Array.from(graph.nodes.values());
        const nodeIds = Array.from(graph.nodes.keys());
       
        // 2.1 ЗАПОМНИТЬ ДЛИНЫ ВСЕХ РЁБЕР
        let edgeCount = 0;
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx !== -1 && toIdx !== -1) {
                const dx = points[toIdx].x - points[fromIdx].x;
                const dy = points[toIdx].y - points[fromIdx].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                const edgeKey = `${fromIdx}-${toIdx}`;
                this.originalEdgeLengths.set(edgeKey, distance);
                this.originalEdgeLengths.set(`${toIdx}-${fromIdx}`, distance);
                edgeCount++;
               
                // Запомнить связи узлов
                if (!this.nodeConnections.has(fromIdx)) {
                    this.nodeConnections.set(fromIdx, new Set());
                }
                if (!this.nodeConnections.has(toIdx)) {
                    this.nodeConnections.set(toIdx, new Set());
                }
                this.nodeConnections.get(fromIdx).add(toIdx);
                this.nodeConnections.get(toIdx).add(fromIdx);
            }
        }
       
        // 2.2 ЗАПОМНИТЬ УГЛЫ МЕЖДУ РЁБРАМИ (если включено)
        if (this.config.preserveAngles) {
            let angleCount = 0;
           
            for (const [nodeIdx, neighbors] of this.nodeConnections) {
                const neighborArray = Array.from(neighbors);
               
                if (neighborArray.length >= 2) {
                    const angles = [];
                   
                    // Для каждой пары соседей вычислить угол
                    for (let i = 0; i < neighborArray.length - 1; i++) {
                        for (let j = i + 1; j < neighborArray.length; j++) {
                            const angle = this.calculateAngle(
                                points[nodeIdx],
                                points[neighborArray[i]],
                                points[nodeIdx],
                                points[neighborArray[j]]
                            );
                            angles.push(angle);
                            angleCount++;
                        }
                    }
                   
                    if (angles.length > 0) {
                        this.originalAngles.set(nodeIdx, {
                            angles: angles,
                            neighborCount: neighborArray.length
                        });
                    }
                }
            }
           
            console.log(`   📐 Запомнено ${angleCount} угловых отношений`);
        }
       
        console.log(`   🔗 Запомнено ${edgeCount} рёбер, ${this.nodeConnections.size} узлов со связями`);
    }

    // 3. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ К ТОЧКАМ
    applyTransformationToPoints(points, transformation) {
        if (!transformation || transformation.type === 'insufficient_points') {
            return points.map(p => ({ ...p }));
        }
       
        return points.map(p => {
            let x = p.x;
            let y = p.y;
           
            // 3.1 ПРИМЕНИТЬ МАСШТАБ (если есть)
            if (transformation.scale && transformation.scale !== 1) {
                x *= transformation.scale;
                y *= transformation.scale;
            }
           
            // 3.2 ПРИМЕНИТЬ ПОВОРОТ (если есть)
            if (transformation.rotation && transformation.rotation !== 0) {
                const rad = transformation.rotation * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const newX = x * cos - y * sin;
                const newY = x * sin + y * cos;
                x = newX;
                y = newY;
            }
           
            // 3.3 ПРИМЕНИТЬ СМЕЩЕНИЕ (если есть)
            if (transformation.translation) {
                x += transformation.translation.dx || 0;
                y += transformation.translation.dy || 0;
            }
           
            return {
                ...p,
                x,
                y,
                transformed: true,
                originalX: p.x,
                originalY: p.y
            };
        });
    }

    // 4. ОПТИМИЗАЦИЯ ПРУЖИННОЙ РАСКЛАДКОЙ (СЕРДЦЕ СИСТЕМЫ)
    springLayoutOptimization(points, graph) {
        console.log('🌀 Запускаю force-directed оптимизацию (пружинная сеть)...');
       
        const nodeIds = Array.from(graph.nodes.keys());
        let currentPoints = points.map(p => ({ ...p }));
        this.energyHistory = [];
        this.iterationStats = [];
       
        // Массивы для хранения сил на каждой итерации (для визуализации)
        const allForces = [];
       
        for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
            // 4.1 РАССЧИТАТЬ СИЛЫ ДЛЯ ВСЕХ ТОЧЕК
            const forces = this.calculateAllForces(currentPoints, graph, nodeIds, iteration);
            allForces.push(forces);
           
            // 4.2 ПРИМЕНИТЬ СИЛЫ С ДЕМПФИРОВАНИЕМ
            currentPoints = this.applyForcesWithDamping(currentPoints, forces, iteration);
           
            // 4.3 РАССЧИТАТЬ ЭНЕРГИЮ СИСТЕМЫ
            const systemEnergy = this.calculateSystemEnergy(currentPoints, graph, nodeIds);
            this.energyHistory.push(systemEnergy);
           
            // 4.4 СОХРАНИТЬ СТАТИСТИКУ ИТЕРАЦИИ
            const iterationStat = {
                iteration: iteration + 1,
                energy: systemEnergy,
                maxForce: this.calculateMaxForce(forces),
                avgDisplacement: this.calculateAverageDisplacement(points, currentPoints)
            };
            this.iterationStats.push(iterationStat);
           
            // 4.5 ПРОВЕРИТЬ СХОДИМОСТЬ
            if (this.checkConvergence(iteration, systemEnergy)) {
                console.log(`   ⚡ Сходимость достигнута на итерации ${iteration + 1}`);
                break;
            }
           
            // 4.6 ВЫВОД ОТЛАДОЧНОЙ ИНФОРМАЦИИ
            if (this.config.debug && (iteration % 20 === 0 || iteration < 5)) {
                console.log(`   Итерация ${iteration + 1}: энергия = ${systemEnergy.toFixed(6)}, ` +
                          `макс.сила = ${iterationStat.maxForce.toFixed(3)}`);
            }
        }
       
        return {
            points: currentPoints,
            forces: allForces,
            stats: {
                iterations: Math.min(this.config.maxIterations, this.energyHistory.length),
                finalEnergy: this.energyHistory[this.energyHistory.length - 1] || 0,
                energyReduction: this.energyHistory.length > 1 ?
                    (this.energyHistory[0] - this.energyHistory[this.energyHistory.length - 1]) / this.energyHistory[0] : 0,
                converged: this.energyHistory.length < this.config.maxIterations
            }
        };
    }

    // 5. РАСЧЁТ ВСЕХ СИЛ (ПРУЖИНЫ + ОТТАЛКИВАНИЕ + УГЛЫ)
    calculateAllForces(points, graph, nodeIds, iteration) {
        const forces = new Array(points.length).fill().map(() => ({ x: 0, y: 0 }));
       
        // 5.1 СИЛЫ ПРУЖИН (ОСНОВНЫЕ - СОХРАНЕНИЕ СВЯЗЕЙ)
        this.applySpringForces(points, forces, graph, nodeIds);
       
        // 5.2 СИЛЫ ОТТАЛКИВАНИЯ (ДЛЯ ПРЕДОТВРАЩЕНИЯ СКЛЕИВАНИЯ)
        if (this.config.enableRepulsion) {
            this.applyRepulsionForces(points, forces, iteration);
        }
       
        // 5.3 СИЛЫ СОХРАНЕНИЯ УГЛОВ (ДОПОЛНИТЕЛЬНАЯ СТАБИЛИЗАЦИЯ)
        if (this.config.preserveAngles) {
            this.applyAnglePreservationForces(points, forces);
        }
       
        return forces;
    }

    // 5.1 СИЛЫ ПРУЖИН (ЗАКОН ГУКА)
    applySpringForces(points, forces, graph, nodeIds) {
        for (const [edgeKey, idealLength] of this.originalEdgeLengths) {
            const [fromIdxStr, toIdxStr] = edgeKey.split('-');
            const fromIdx = parseInt(fromIdxStr);
            const toIdx = parseInt(toIdxStr);
           
            // Проверить, что индексы валидны и это прямое (не обратное) ребро
            if (fromIdx < toIdx && fromIdx >= 0 && toIdx < points.length) {
                const pointA = points[fromIdx];
                const pointB = points[toIdx];
               
                // Вектор от A к B
                const dx = pointB.x - pointA.x;
                const dy = pointB.y - pointA.y;
                const currentLength = Math.sqrt(dx * dx + dy * dy);
               
                if (currentLength === 0) continue;
               
                // ЗАКОН ГУКА: F = -k * (x - L)
                // x - текущая длина, L - идеальная длина
                const displacement = currentLength - idealLength;
                const forceMagnitude = this.config.springConstant * displacement;
               
                // Направление силы (нормализованный вектор)
                const forceX = forceMagnitude * dx / currentLength;
                const forceY = forceMagnitude * dy / currentLength;
               
                // Применить силы (3-й закон Ньютона)
                forces[fromIdx].x += forceX;
                forces[fromIdx].y += forceY;
                forces[toIdx].x -= forceX;
                forces[toIdx].y -= forceY;
            }
        }
    }

    // 5.2 СИЛЫ ОТТАЛКИВАНИЯ (ЗАКОН КУЛОНА)
    applyRepulsionForces(points, forces, iteration) {
        // Постепенно уменьшать отталкивание с итерациями
        const repulsionStrength = this.config.repulsionConstant *
                                 Math.max(0.1, 1 - iteration / this.config.maxIterations * 0.8);
       
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                // Пропустить, если точки связаны (ими уже занимаются пружины)
                if (this.areNodesConnected(i, j)) continue;
               
                const dx = points[j].x - points[i].x;
                const dy = points[j].y - points[i].y;
                const distanceSq = dx * dx + dy * dy;
               
                if (distanceSq === 0) continue;
               
                const distance = Math.sqrt(distanceSq);
               
                // ЗАКОН КУЛОНА: F = k / r²
                // Но для стабильности: F = k / (r² + ε)
                const minDistance = 5.0; // Минимальное расстояние
                const effectiveDistance = Math.max(distance, minDistance);
                const forceMagnitude = repulsionStrength / (effectiveDistance * effectiveDistance);
               
                // Направление силы (отталкивание)
                const forceX = forceMagnitude * dx / effectiveDistance;
                const forceY = forceMagnitude * dy / effectiveDistance;
               
                forces[i].x -= forceX; // Отталкивание от j
                forces[i].y -= forceY;
                forces[j].x += forceX; // Отталкивание от i
                forces[j].y += forceY;
            }
        }
    }

    // 5.3 СИЛЫ СОХРАНЕНИЯ УГЛОВ
    applyAnglePreservationForces(points, forces) {
        for (const [nodeIdx, angleData] of this.originalAngles) {
            const neighbors = Array.from(this.nodeConnections.get(nodeIdx) || []);
           
            if (neighbors.length < 2 || nodeIdx >= points.length) continue;
           
            const centerPoint = points[nodeIdx];
            const originalAngles = angleData.angles;
           
            let angleIndex = 0;
            let totalAngleForceX = 0;
            let totalAngleForceY = 0;
            let angleForceCount = 0;
           
            // Для каждой пары соседей
            for (let i = 0; i < neighbors.length - 1; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    const neighborIdx1 = neighbors[i];
                    const neighborIdx2 = neighbors[j];
                   
                    if (neighborIdx1 >= points.length || neighborIdx2 >= points.length) continue;
                   
                    // Текущий угол между векторами к соседям
                    const currentAngle = this.calculateAngle(
                        centerPoint,
                        points[neighborIdx1],
                        centerPoint,
                        points[neighborIdx2]
                    );
                   
                    const originalAngle = originalAngles[angleIndex] || currentAngle;
                    const angleDiff = currentAngle - originalAngle;
                   
                    // Сила пропорциональна разнице углов
                    if (Math.abs(angleDiff) > 0.01) { // Только если есть заметная разница
                        const angleForce = this.calculateAngleCorrectionForce(
                            centerPoint,
                            points[neighborIdx1],
                            points[neighborIdx2],
                            angleDiff
                        );
                       
                        totalAngleForceX += angleForce.x;
                        totalAngleForceY += angleForce.y;
                        angleForceCount++;
                    }
                   
                    angleIndex++;
                }
            }
           
            // Применить усреднённую силу угловой коррекции
            if (angleForceCount > 0) {
                const angleWeight = 0.3 * this.config.springConstant; // Меньший вес, чем у пружин
                forces[nodeIdx].x += totalAngleForceX / angleForceCount * angleWeight;
                forces[nodeIdx].y += totalAngleForceY / angleForceCount * angleWeight;
            }
        }
    }

    // 6. ПРИМЕНЕНИЕ СИЛ С ДЕМПФИРОВАНИЕМ
    applyForcesWithDamping(points, forces, iteration) {
        // Постепенно уменьшаем демпфирование для точной настройки
        const currentDamping = this.config.damping *
                              (1 - iteration / this.config.maxIterations * 0.3);
       
        return points.map((point, idx) => {
            const force = forces[idx];
            const forceMagnitude = Math.sqrt(force.x * force.x + force.y * force.y);
           
            // Ограничить максимальное перемещение за шаг
            const maxMove = 10.0 * currentDamping;
            const limitedForceX = Math.max(-maxMove, Math.min(maxMove, force.x));
            const limitedForceY = Math.max(-maxMove, Math.min(maxMove, force.y));
           
            // Применить силу с демпфированием
            return {
                ...point,
                x: point.x + limitedForceX * currentDamping,
                y: point.y + limitedForceY * currentDamping,
                forceX: limitedForceX,
                forceY: limitedForceY,
                forceMagnitude: forceMagnitude
            };
        });
    }

    // 7. РАСЧЁТ ЭНЕРГИИ СИСТЕМЫ
    calculateSystemEnergy(points, graph, nodeIds) {
        let totalEnergy = 0;
       
        // 7.1 ЭНЕРГИЯ ПРУЖИН (ПОТЕНЦИАЛЬНАЯ)
        for (const [edgeKey, idealLength] of this.originalEdgeLengths) {
            const [fromIdxStr, toIdxStr] = edgeKey.split('-');
            const fromIdx = parseInt(fromIdxStr);
            const toIdx = parseInt(toIdxStr);
           
            if (fromIdx < toIdx && fromIdx >= 0 && toIdx < points.length) {
                const dx = points[toIdx].x - points[fromIdx].x;
                const dy = points[toIdx].y - points[fromIdx].y;
                const currentLength = Math.sqrt(dx * dx + dy * dy);
                const displacement = currentLength - idealLength;
               
                // E_spring = ½kx²
                totalEnergy += 0.5 * this.config.springConstant * displacement * displacement;
            }
        }
       
        // 7.2 ЭНЕРГИЯ ОТТАЛКИВАНИЯ
        if (this.config.enableRepulsion) {
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    if (this.areNodesConnected(i, j)) continue;
                   
                    const dx = points[j].x - points[i].x;
                    const dy = points[j].y - points[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = 10.0;
                   
                    if (distance < minDistance) {
                        // E_repulsion = k / r
                        totalEnergy += this.config.repulsionConstant / Math.max(1, distance);
                    }
                }
            }
        }
       
        return totalEnergy;
    }

    // 8. ПРОВЕРКА СХОДИМОСТИ
    checkConvergence(iteration, currentEnergy) {
        if (iteration < 10) return false; // Минимум 10 итераций
       
        // Проверить по энергии
        if (currentEnergy < this.config.minEnergy) {
            return true;
        }
       
        // Проверить стабильность в окне
        if (this.energyHistory.length >= this.config.convergenceWindow) {
            const recentEnergies = this.energyHistory.slice(-this.config.convergenceWindow);
            const avgEnergy = recentEnergies.reduce((a, b) => a + b, 0) / recentEnergies.length;
            const variance = recentEnergies.reduce((v, e) => v + Math.pow(e - avgEnergy, 2), 0) / recentEnergies.length;
           
            if (variance < this.config.minEnergy * 10) {
                return true;
            }
        }
       
        return false;
    }

    // 9. РАСЧЁТ УЛУЧШЕНИЯ ТОПОЛОГИИ
    calculateTopologicalImprovement(originalPoints, refinedPoints, graph) {
        const nodeIds = Array.from(graph.nodes.keys());
       
        let totalDistanceError = 0;
        let totalAngleError = 0;
        let preservedEdges = 0;
        let totalEdges = 0;
       
        // 9.1 ПРОВЕРКА СОХРАНЕНИЯ ДЛИН РЁБЕР
        for (const [edgeKey, idealLength] of this.originalEdgeLengths) {
            const [fromIdxStr, toIdxStr] = edgeKey.split('-');
            const fromIdx = parseInt(fromIdxStr);
            const toIdx = parseInt(toIdxStr);
           
            if (fromIdx < toIdx && fromIdx >= 0 && toIdx < originalPoints.length) {
                totalEdges++;
               
                // Оригинальное расстояние (до трансформации)
                const origDx = originalPoints[toIdx].x - originalPoints[fromIdx].x;
                const origDy = originalPoints[toIdx].y - originalPoints[fromIdx].y;
                const origDist = Math.sqrt(origDx * origDx + origDy * origDy);
               
                // Уточнённое расстояние (после коррекции)
                const refinedDx = refinedPoints[toIdx].x - refinedPoints[fromIdx].x;
                const refinedDy = refinedPoints[toIdx].y - refinedPoints[fromIdx].y;
                const refinedDist = Math.sqrt(refinedDx * refinedDx + refinedDy * refinedDy);
               
                // Относительная ошибка
                const error = Math.abs(refinedDist - idealLength) / Math.max(idealLength, 1);
                totalDistanceError += error;
               
                if (error < 0.15) { // Сохранено в пределах 15%
                    preservedEdges++;
                }
            }
        }
       
        // 9.2 ПРОВЕРКА СОХРАНЕНИЯ УГЛОВ
        if (this.config.preserveAngles) {
            let angleCount = 0;
           
            for (const [nodeIdx, angleData] of this.originalAngles) {
                const originalAngles = angleData.angles;
                const neighbors = Array.from(this.nodeConnections.get(nodeIdx) || []);
               
                if (neighbors.length >= 2 && nodeIdx < originalPoints.length) {
                    let angleIndex = 0;
                   
                    for (let i = 0; i < neighbors.length - 1; i++) {
                        for (let j = i + 1; j < neighbors.length; j++) {
                            const neighborIdx1 = neighbors[i];
                            const neighborIdx2 = neighbors[j];
                           
                            if (neighborIdx1 >= originalPoints.length || neighborIdx2 >= originalPoints.length) continue;
                           
                            // Угол после коррекции
                            const refinedAngle = this.calculateAngle(
                                refinedPoints[nodeIdx],
                                refinedPoints[neighborIdx1],
                                refinedPoints[nodeIdx],
                                refinedPoints[neighborIdx2]
                            );
                           
                            const angleDiff = Math.abs(refinedAngle - (originalAngles[angleIndex] || refinedAngle));
                            totalAngleError += angleDiff;
                            angleCount++;
                            angleIndex++;
                        }
                    }
                }
            }
           
            totalAngleError = angleCount > 0 ? totalAngleError / angleCount : 0;
        }
       
        // 9.3 РАСЧЁТ КОМБИНИРОВАННЫХ МЕТРИК
        const avgDistanceError = totalEdges > 0 ? totalDistanceError / totalEdges : 0;
        const consistency = Math.max(0, 1 - avgDistanceError - totalAngleError / Math.PI);
       
        return {
            consistency: consistency,
            edgesPreserved: totalEdges > 0 ? (preservedEdges / totalEdges * 100) : 100,
            avgDistanceError: avgDistanceError,
            avgAngleError: totalAngleError,
            topologyImprovement: consistency * 100,
            totalEdges: totalEdges,
            preservedEdges: preservedEdges
        };
    }

    // 10. ВИЗУАЛИЗАЦИЯ ПРУЖИННЫХ СИЛ
    visualizeSpringForces(points, graph, forcesArray, baseOutputPath = null) {
        try {
            const timestamp = Date.now();
            const outputPath = baseOutputPath ||
                path.join('./temp/topology_refinement', `spring_forces_${timestamp}.png`);
           
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
           
            const canvas = createCanvas(1200, 800);
            const ctx = canvas.getContext('2d');
           
            // Фон
            ctx.fillStyle = '#0d1b2a';
            ctx.fillRect(0, 0, 1200, 800);
           
            // Найти границы точек
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
           
            const padding = 50;
            const scaleX = (1200 - 2 * padding) / (maxX - minX || 1);
            const scaleY = (800 - 2 * padding) / (maxY - minY || 1);
            const scale = Math.min(scaleX, scaleY) * 0.9;
           
            const offsetX = padding - minX * scale;
            const offsetY = padding - minY * scale;
           
            // Функция преобразования координат
            const transform = (x, y) => ({
                x: offsetX + x * scale,
                y: offsetY + y * scale
            });
           
            // Нарисовать рёбра графа (пружины)
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.3)';
            ctx.lineWidth = 1.5;
           
            const nodeIds = Array.from(graph.nodes.keys());
            for (const [edgeKey, idealLength] of this.originalEdgeLengths) {
                const [fromIdxStr, toIdxStr] = edgeKey.split('-');
                const fromIdx = parseInt(fromIdxStr);
                const toIdx = parseInt(toIdxStr);
               
                if (fromIdx < toIdx && fromIdx >= 0 && toIdx < points.length) {
                    const pos1 = transform(points[fromIdx].x, points[fromIdx].y);
                    const pos2 = transform(points[toIdx].x, points[toIdx].y);
                   
                    // Цвет пружины в зависимости от натяжения
                    const currentDx = points[toIdx].x - points[fromIdx].x;
                    const currentDy = points[toIdx].y - points[fromIdx].y;
                    const currentLength = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
                    const stretchRatio = currentLength / Math.max(idealLength, 1);
                   
                    if (stretchRatio > 1.3) {
                        ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)'; // Растянута (красный)
                    } else if (stretchRatio < 0.7) {
                        ctx.strokeStyle = 'rgba(255, 200, 100, 0.4)'; // Сжата (жёлтый)
                    } else {
                        ctx.strokeStyle = 'rgba(100, 255, 100, 0.3)'; // Норма (зелёный)
                    }
                   
                    ctx.beginPath();
                    ctx.moveTo(pos1.x, pos1.y);
                    ctx.lineTo(pos2.x, pos2.y);
                    ctx.stroke();
                }
            }
           
            // Нарисовать точки (узлы)
            points.forEach((point, idx) => {
                const pos = transform(point.x, point.y);
               
                // Цвет точки в зависимости от величины силы
                const forceMagnitude = point.forceMagnitude || 0;
                const intensity = Math.min(1, forceMagnitude * 2);
               
                const r = Math.floor(100 + 155 * intensity);
                const g = Math.floor(200 - 150 * intensity);
                const b = Math.floor(255 - 100 * intensity);
               
                // Внешний круг (сила)
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
                ctx.fill();
               
                // Внутренний круг (узел)
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                ctx.fill();
               
                // Стрелка силы (если есть)
                if (point.forceX !== undefined && point.forceY !== undefined &&
                    (Math.abs(point.forceX) > 0.1 || Math.abs(point.forceY) > 0.1)) {
                   
                    const arrowLength = Math.min(30, forceMagnitude * 15);
                    const angle = Math.atan2(point.forceY, point.forceX);
                   
                    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                   
                    // Линия силы
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                    ctx.lineTo(
                        pos.x + Math.cos(angle) * arrowLength,
                        pos.y + Math.sin(angle) * arrowLength
                    );
                    ctx.stroke();
                   
                    // Наконечник стрелки
                    ctx.beginPath();
                    ctx.moveTo(
                        pos.x + Math.cos(angle) * arrowLength,
                        pos.y + Math.sin(angle) * arrowLength
                    );
                    ctx.lineTo(
                        pos.x + Math.cos(angle + 2.4) * (arrowLength - 6),
                        pos.y + Math.sin(angle + 2.4) * (arrowLength - 6)
                    );
                    ctx.lineTo(
                        pos.x + Math.cos(angle - 2.4) * (arrowLength - 6),
                        pos.y + Math.sin(angle - 2.4) * (arrowLength - 6)
                    );
                    ctx.closePath();
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.fill();
                }
            });
           
            // Заголовок и легенда
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('🏗️ ПРУЖИННАЯ КОРРЕКЦИЯ ТОПОЛОГИИ', 50, 40);
           
            ctx.font = '16px Arial';
            ctx.fillStyle = '#cccccc';
            ctx.fillText('🔵 Узлы с силами коррекции | 🔴 Растянутые пружины | 🟡 Сжатые пружины | 🟢 Нормальные пружины', 50, 770);
           
            // Информация о состоянии
            const lastForces = forcesArray[forcesArray.length - 1] || [];
            const avgForce = lastForces.length > 0 ?
                lastForces.reduce((sum, f) => sum + Math.sqrt(f.x*f.x + f.y*f.y), 0) / lastForces.length : 0;
           
            ctx.fillText(`⚡ Средняя сила: ${avgForce.toFixed(3)} | 📊 Энергия системы: ${this.energyHistory[this.energyHistory.length-1]?.toFixed(4) || 0}`, 50, 730);
           
            // Сохранить изображение
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(outputPath, buffer);
           
            console.log(`🎨 Визуализация пружинных сил сохранена: ${outputPath}`);
            return outputPath;
           
        } catch (error) {
            console.log('⚠️ Ошибка визуализации пружинных сил:', error.message);
            return null;
        }
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    findNodeIndex(nodeId, nodeIds) {
        return nodeIds.indexOf(nodeId);
    }

    areNodesConnected(idx1, idx2) {
        const connections1 = this.nodeConnections.get(idx1);
        return connections1 ? connections1.has(idx2) : false;
    }

    calculateAngle(center, pointA, center2, pointB) {
        const vec1 = { x: pointA.x - center.x, y: pointA.y - center.y };
        const vec2 = { x: pointB.x - center2.x, y: pointB.y - center2.y };
       
        const dot = vec1.x * vec2.x + vec1.y * vec2.y;
        const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
        const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
       
        if (mag1 === 0 || mag2 === 0) return 0;
       
        return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
    }

    calculateAngleCorrectionForce(center, pointA, pointB, angleDiff) {
        // Векторы к соседям
        const vecA = { x: pointA.x - center.x, y: pointA.y - center.y };
        const vecB = { x: pointB.x - center.x, y: pointB.y - center.y };
       
        // Нормализовать векторы
        const magA = Math.sqrt(vecA.x * vecA.x + vecA.y * vecA.y);
        const magB = Math.sqrt(vecB.x * vecB.x + vecB.y * vecB.y);
       
        if (magA === 0 || magB === 0) return { x: 0, y: 0 };
       
        const normA = { x: vecA.x / magA, y: vecA.y / magA };
        const normB = { x: vecB.x / magB, y: vecB.y / magB };
       
        // Сила коррекции угла - небольшая перпендикулярная компонента
        const correctionStrength = 0.1 * Math.sin(angleDiff);
       
        // Перпендикуляр к среднему направлению
        const avgVec = {
            x: (normA.x + normB.x) / 2,
            y: (normA.y + normB.y) / 2
        };
       
        const perpVec = {
            x: -avgVec.y,
            y: avgVec.x
        };
       
        return {
            x: perpVec.x * correctionStrength,
            y: perpVec.y * correctionStrength
        };
    }

    calculateMaxForce(forces) {
        let maxForce = 0;
        for (const force of forces) {
            const magnitude = Math.sqrt(force.x * force.x + force.y * force.y);
            if (magnitude > maxForce) {
                maxForce = magnitude;
            }
        }
        return maxForce;
    }

    calculateAverageDisplacement(points1, points2) {
        if (points1.length !== points2.length || points1.length === 0) return 0;
       
        let totalDisplacement = 0;
        for (let i = 0; i < points1.length; i++) {
            const dx = points2[i].x - points1[i].x;
            const dy = points2[i].y - points1[i].y;
            totalDisplacement += Math.sqrt(dx * dx + dy * dy);
        }
       
        return totalDisplacement / points1.length;
    }

    // 11. МЕТОД ДЛЯ БЫСТРОЙ КОРРЕКЦИИ (УПРОЩЁННЫЙ)
    quickRefine(points, graph, iterations = 50) {
        const tempConfig = { ...this.config, maxIterations: iterations };
        const tempRefiner = new TopologyRefiner(tempConfig);
       
        return tempRefiner.refineWithTransformation(
            points,
            { type: 'none' }, // Без трансформации
            graph
        );
    }

    // 12. ПОКАЗАТЬ СТАТИСТИКУ ОПТИМИЗАЦИИ
    showOptimizationStats() {
        if (this.iterationStats.length === 0) {
            console.log('📊 Статистика оптимизации недоступна');
            return;
        }
       
        const first = this.iterationStats[0];
        const last = this.iterationStats[this.iterationStats.length - 1];
       
        console.log('\n📊 СТАТИСТИКА ТОПОЛОГИЧЕСКОЙ ОПТИМИЗАЦИИ:');
        console.log('├─ Итераций выполнено:', this.iterationStats.length);
        console.log('├─ Начальная энергия:', first.energy.toFixed(6));
        console.log('├─ Конечная энергия:', last.energy.toFixed(6));
        console.log('├─ Снижение энергии:', ((first.energy - last.energy) / first.energy * 100).toFixed(1) + '%');
        console.log('├─ Макс. сила (начало):', first.maxForce.toFixed(3));
        console.log('├─ Макс. сила (конец):', last.maxForce.toFixed(3));
        console.log('└─ Среднее смещение:', last.avgDisplacement.toFixed(3));
       
        // График сходимости (текстовый)
        if (this.config.debug && this.energyHistory.length > 5) {
            console.log('\n📈 ГРАФИК СХОДИМОСТИ (энергия):');
            const maxEnergy = Math.max(...this.energyHistory);
            const steps = Math.min(10, this.energyHistory.length);
           
            for (let i = 0; i < steps; i++) {
                const idx = Math.floor(i * this.energyHistory.length / steps);
                const energy = this.energyHistory[idx];
                const barLength = Math.max(1, Math.floor(energy / maxEnergy * 40));
                const bar = '█'.repeat(barLength);
                console.log(`  ${(idx + 1).toString().padStart(3)} |${bar}| ${energy.toFixed(4)}`);
            }
        }
    }
}

module.exports = TopologyRefiner;
