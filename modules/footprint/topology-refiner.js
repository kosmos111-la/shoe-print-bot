// modules/footprint/topology-refiner.js
// ТОПОЛОГИЧЕСКОЕ УТОЧНЕНИЕ ЧЕРЕЗ ГРАФОВЫЕ ОГРАНИЧЕНИЯ (ПРУЖИННАЯ СЕТЬ)

class TopologyRefiner {
    constructor(options = {}) {
        this.config = {
            springConstant: options.springConstant || 0.15,     // Жёсткость пружин
            repulsionConstant: options.repulsionConstant || 100, // Отталкивание
            damping: options.damping || 0.85,                   // Демпфирование
            iterations: options.iterations || 150,              // Итераций
            minEnergy: options.minEnergy || 0.001,              // Минимальная энергия
            preserveAngles: options.preserveAngles !== false,   // Сохранять углы
            preserveDistances: options.preserveDistances !== false, // Сохранять расстояния
            debug: options.debug || false,
            ...options
        };
       
        this.originalDistances = new Map(); // Сохраняем оригинальные расстояния
        this.originalAngles = new Map();    // Сохраняем оригинальные углы
        this.energyHistory = [];
       
        console.log('🔧 Создан TopologyRefiner: пружинная коррекция топологии');
    }

    // 1. ОСНОВНОЙ МЕТОД: УТОЧНИТЬ ТОПОЛОГИЮ ЧЕРЕЗ ТРАНСФОРМАЦИЮ
    refineWithTransformation(points, graph, transformation = null) {
        console.log('🏗️ Уточняю топологию через графовые ограничения...');
       
        // Сохранить оригинальные отношения
        this.captureOriginalRelations(points, graph);
       
        // Применить трансформацию если есть
        let currentPoints = transformation ?
            this.applyTransformation(points, transformation) :
            [...points];
       
        // Оптимизировать через force-directed layout
        const optimizedPoints = this.springLayoutOptimization(currentPoints, graph);
       
        // Проверить улучшение
        const improvement = this.calculateImprovement(points, optimizedPoints, graph);
       
        console.log(`✅ Топологическое уточнение завершено`);
        console.log(`   📊 Энергия системы: ${this.energyHistory[this.energyHistory.length - 1]?.toFixed(6) || 0}`);
        console.log(`   🎯 Улучшение согласованности: ${(improvement.consistency * 100).toFixed(1)}%`);
        console.log(`   🔗 Сохранено связей: ${improvement.edgesPreserved}%`);
       
        return {
            points: optimizedPoints,
            improvement: improvement,
            energyHistory: this.energyHistory,
            transformation: transformation
        };
    }

    // 2. ЗАПОМНИТЬ ОРИГИНАЛЬНЫЕ ОТНОШЕНИЯ
    captureOriginalRelations(points, graph) {
        this.originalDistances.clear();
        this.originalAngles.clear();
       
        const nodes = Array.from(graph.nodes.values());
        const nodeIds = Array.from(graph.nodes.keys());
       
        // Запомнить расстояния между всеми связанными точками
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx !== -1 && toIdx !== -1) {
                const dx = points[toIdx].x - points[fromIdx].x;
                const dy = points[toIdx].y - points[fromIdx].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                this.originalDistances.set(`${fromIdx}-${toIdx}`, distance);
                this.originalDistances.set(`${toIdx}-${fromIdx}`, distance);
            }
        }
       
        // Запомнить углы для каждой точки
        if (this.config.preserveAngles) {
            nodes.forEach((node, nodeIdx) => {
                const neighbors = this.getNodeNeighbors(node.id, graph);
                if (neighbors.length >= 2) {
                    const neighborIndices = neighbors.map(nid =>
                        this.findNodeIndex(nid, nodeIds));
                   
                    const angles = [];
                    for (let i = 0; i < neighborIndices.length - 1; i++) {
                        for (let j = i + 1; j < neighborIndices.length; j++) {
                            const angle = this.calculateAngleBetweenVectors(
                                points[nodeIdx], points[neighborIndices[i]],
                                points[nodeIdx], points[neighborIndices[j]]
                            );
                            angles.push(angle);
                        }
                    }
                   
                    if (angles.length > 0) {
                        this.originalAngles.set(nodeIdx, angles);
                    }
                }
            });
        }
       
        console.log(`📊 Запомнено ${this.originalDistances.size / 2} расстояний, ${this.originalAngles.size} угловых отношений`);
    }

    // 3. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
    applyTransformation(points, transformation) {
        if (!transformation || transformation.type === 'insufficient_points') {
            return points;
        }
       
        return points.map(p => {
            let x = p.x;
            let y = p.y;
           
            if (transformation.translation) {
                x += transformation.translation.dx || 0;
                y += transformation.translation.dy || 0;
            }
           
            if (transformation.rotation && transformation.rotation !== 0) {
                const rad = transformation.rotation * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const newX = x * cos - y * sin;
                const newY = x * sin + y * cos;
                x = newX;
                y = newY;
            }
           
            if (transformation.scale && transformation.scale !== 1) {
                x *= transformation.scale;
                y *= transformation.scale;
            }
           
            return { ...p, x, y };
        });
    }

    // 4. ОПТИМИЗАЦИЯ ПРУЖИННОЙ РАСКЛАДКОЙ
    springLayoutOptimization(points, graph) {
        console.log('🌀 Запускаю force-directed оптимизацию...');
       
        const nodeIds = Array.from(graph.keys());
        let currentPoints = [...points];
        this.energyHistory = [];
       
        for (let iteration = 0; iteration < this.config.iterations; iteration++) {
            // Рассчитать силы для всех точек
            const forces = this.calculateForces(currentPoints, graph, nodeIds);
           
            // Применить силы с демпфированием
            currentPoints = this.applyForces(currentPoints, forces, iteration);
           
            // Рассчитать энергию системы
            const energy = this.calculateSystemEnergy(currentPoints, graph, nodeIds);
            this.energyHistory.push(energy);
           
            // Проверить сходимость
            if (this.checkConvergence(iteration)) {
                console.log(`   ⚡ Сходимость достигнута на итерации ${iteration + 1}`);
                break;
            }
           
            if (this.config.debug && iteration % 30 === 0) {
                console.log(`   Итерация ${iteration + 1}: энергия = ${energy.toFixed(6)}`);
            }
        }
       
        return currentPoints;
    }

    // 5. РАСЧЁТ СИЛ (ПРУЖИНЫ + ОТТАЛКИВАНИЕ)
    calculateForces(points, graph, nodeIds) {
        const forces = new Array(points.length).fill().map(() => ({ x: 0, y: 0 }));
       
        // 1. СИЛЫ ПРУЖИН (рёбра графа)
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx === -1 || toIdx === -1) continue;
           
            const springForce = this.calculateSpringForce(
                points[fromIdx], points[toIdx], fromIdx, toIdx
            );
           
            // Применить силы (3-й закон Ньютона)
            forces[fromIdx].x += springForce.x;
            forces[fromIdx].y += springForce.y;
            forces[toIdx].x -= springForce.x;
            forces[toIdx].y -= springForce.y;
        }
       
        // 2. СИЛЫ ОТТАЛКИВАНИЯ (все узлы друг от друга)
        if (this.config.repulsionConstant > 0) {
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    const repulsionForce = this.calculateRepulsionForce(
                        points[i], points[j]
                    );
                   
                    forces[i].x += repulsionForce.x;
                    forces[i].y += repulsionForce.y;
                    forces[j].x -= repulsionForce.x;
                    forces[j].y -= repulsionForce.y;
                }
            }
        }
       
        // 3. СИЛЫ СОХРАНЕНИЯ УГЛОВ
        if (this.config.preserveAngles) {
            for (const [nodeIdx, originalAngles] of this.originalAngles) {
                const angleForce = this.calculateAnglePreservationForce(
                    points, nodeIdx, originalAngles, graph, nodeIds
                );
               
                if (angleForce) {
                    forces[nodeIdx].x += angleForce.x;
                    forces[nodeIdx].y += angleForce.y;
                }
            }
        }
       
        return forces;
    }

    // 6. РАСЧЁТ СИЛЫ ПРУЖИНЫ
    calculateSpringForce(pointA, pointB, idxA, idxB) {
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
       
        if (distance === 0) return { x: 0, y: 0 };
       
        // Идеальная длина = оригинальное расстояние
        const originalDistance = this.originalDistances.get(`${idxA}-${idxB}`) ||
                                this.originalDistances.get(`${idxB}-${idxA}`) ||
                                distance;
       
        // Закон Гука: F = -k * (x - L)
        const displacement = distance - originalDistance;
        const forceMagnitude = this.config.springConstant * displacement;
       
        return {
            x: forceMagnitude * dx / distance,
            y: forceMagnitude * dy / distance
        };
    }

    // 7. РАСЧЁТ СИЛЫ ОТТАЛКИВАНИЯ
    calculateRepulsionForce(pointA, pointB) {
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
       
        if (distance === 0) return { x: 0, y: 0 };
       
        // Закон Кулона: F = k / r²
        const forceMagnitude = this.config.repulsionConstant / (distance * distance);
       
        return {
            x: forceMagnitude * dx / distance,
            y: forceMagnitude * dy / distance
        };
    }

    // 8. СИЛА СОХРАНЕНИЯ УГЛОВ
    calculateAnglePreservationForce(points, nodeIdx, originalAngles, graph, nodeIds) {
        const nodeId = nodeIds[nodeIdx];
        const neighbors = this.getNodeNeighbors(nodeId, graph);
        const neighborIndices = neighbors.map(nid => this.findNodeIndex(nid, nodeIds));
       
        if (neighborIndices.length < 2) return null;
       
        let totalForceX = 0;
        let totalForceY = 0;
        let angleCount = 0;
       
        // Для каждой пары соседей
        for (let i = 0; i < neighborIndices.length - 1; i++) {
            for (let j = i + 1; j < neighborIndices.length; j++) {
                const currentAngle = this.calculateAngleBetweenVectors(
                    points[nodeIdx], points[neighborIndices[i]],
                    points[nodeIdx], points[neighborIndices[j]]
                );
               
                const originalAngle = originalAngles[angleCount] || currentAngle;
                const angleDiff = currentAngle - originalAngle;
               
                // Сила пропорциональна разнице углов
                const forceMagnitude = angleDiff * this.config.springConstant * 0.5;
               
                // Направление: поворачиваем оба вектора
                const force1 = this.rotateVector(
                    points[nodeIdx], points[neighborIndices[i]],
                    forceMagnitude * 0.5
                );
                const force2 = this.rotateVector(
                    points[nodeIdx], points[neighborIndices[j]],
                    -forceMagnitude * 0.5
                );
               
                totalForceX += force1.x + force2.x;
                totalForceY += force1.y + force2.y;
                angleCount++;
            }
        }
       
        return angleCount > 0 ? {
            x: totalForceX / angleCount,
            y: totalForceY / angleCount
        } : null;
    }

    // 9. ПРИМЕНЕНИЕ СИЛ
    applyForces(points, forces, iteration) {
        const damping = this.config.damping * (1 - iteration / this.config.iterations * 0.5);
       
        return points.map((point, idx) => {
            // Ограничить максимальное перемещение
            const maxMove = 5.0 * damping;
            const forceX = Math.max(-maxMove, Math.min(maxMove, forces[idx].x));
            const forceY = Math.max(-maxMove, Math.min(maxMove, forces[idx].y));
           
            return {
                ...point,
                x: point.x + forceX * damping,
                y: point.y + forceY * damping
            };
        });
    }

    // 10. РАСЧЁТ ЭНЕРГИИ СИСТЕМЫ
    calculateSystemEnergy(points, graph, nodeIds) {
        let totalEnergy = 0;
       
        // Энергия пружин
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx === -1 || toIdx === -1) continue;
           
            const dx = points[toIdx].x - points[fromIdx].x;
            const dy = points[toIdx].y - points[fromIdx].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
           
            const originalDistance = this.originalDistances.get(`${fromIdx}-${toIdx}`) || distance;
            const displacement = distance - originalDistance;
           
            // Потенциальная энергия пружины: E = ½kx²
            totalEnergy += 0.5 * this.config.springConstant * displacement * displacement;
        }
       
        return totalEnergy;
    }

    // 11. ПРОВЕРКА СХОДИМОСТИ
    checkConvergence(iteration) {
        if (iteration < 10) return false;
       
        const recentEnergies = this.energyHistory.slice(-10);
        const avgEnergy = recentEnergies.reduce((a, b) => a + b, 0) / recentEnergies.length;
        const variance = recentEnergies.reduce((v, e) => v + Math.pow(e - avgEnergy, 2), 0) / recentEnergies.length;
       
        return variance < this.config.minEnergy;
    }

    // 12. РАСЧЁТ УЛУЧШЕНИЯ
    calculateImprovement(originalPoints, refinedPoints, graph) {
        const nodeIds = Array.from(graph.nodes.keys());
       
        let totalDistanceError = 0;
        let totalAngleError = 0;
        let preservedEdges = 0;
        let totalEdges = 0;
       
        // Проверить сохранение расстояний
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx === -1 || toIdx === -1) continue;
           
            totalEdges++;
           
            const origDist = this.distance(originalPoints[fromIdx], originalPoints[toIdx]);
            const refinedDist = this.distance(refinedPoints[fromIdx], refinedPoints[toIdx]);
           
            const error = Math.abs(refinedDist - origDist) / Math.max(origDist, 1);
            totalDistanceError += error;
           
            if (error < 0.1) { // Сохранено в пределах 10%
                preservedEdges++;
            }
        }
       
        // Проверить сохранение углов
        if (this.config.preserveAngles) {
            let angleCount = 0;
           
            for (const [nodeIdx, originalAngles] of this.originalAngles) {
                const nodeId = nodeIds[nodeIdx];
                const neighbors = this.getNodeNeighbors(nodeId, graph);
                const neighborIndices = neighbors.map(nid => this.findNodeIndex(nid, nodeIds));
               
                if (neighborIndices.length >= 2) {
                    let angleIdx = 0;
                    for (let i = 0; i < neighborIndices.length - 1; i++) {
                        for (let j = i + 1; j < neighborIndices.length; j++) {
                            const currentAngle = this.calculateAngleBetweenVectors(
                                refinedPoints[nodeIdx], refinedPoints[neighborIndices[i]],
                                refinedPoints[nodeIdx], refinedPoints[neighborIndices[j]]
                            );
                           
                            const angleDiff = Math.abs(currentAngle - (originalAngles[angleIdx] || currentAngle));
                            totalAngleError += angleDiff;
                            angleIdx++;
                            angleCount++;
                        }
                    }
                }
            }
           
            totalAngleError = angleCount > 0 ? totalAngleError / angleCount : 0;
        }
       
        const avgDistanceError = totalEdges > 0 ? totalDistanceError / totalEdges : 0;
        const consistency = Math.max(0, 1 - avgDistanceError - totalAngleError / Math.PI);
       
        return {
            consistency: consistency,
            edgesPreserved: totalEdges > 0 ? (preservedEdges / totalEdges * 100) : 100,
            avgDistanceError: avgDistanceError,
            avgAngleError: totalAngleError,
            energyDecrease: this.energyHistory.length > 1 ?
                (this.energyHistory[0] - this.energyHistory[this.energyHistory.length - 1]) / this.energyHistory[0] : 0
        };
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    findNodeIndex(nodeId, nodeIds) {
        return nodeIds.indexOf(nodeId);
    }

    getNodeNeighbors(nodeId, graph) {
        const neighbors = new Set();
       
        for (const [edgeId, edge] of graph.edges) {
            if (edge.from === nodeId) neighbors.add(edge.to);
            if (edge.to === nodeId) neighbors.add(edge.from);
        }
       
        return Array.from(neighbors);
    }

    distance(pointA, pointB) {
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateAngleBetweenVectors(center, pointA, center, pointB) {
        const vec1 = { x: pointA.x - center.x, y: pointA.y - center.y };
        const vec2 = { x: pointB.x - center.x, y: pointB.y - center.y };
       
        const dot = vec1.x * vec2.x + vec1.y * vec2.y;
        const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
        const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
       
        if (mag1 === 0 || mag2 === 0) return 0;
       
        return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
    }

    rotateVector(center, point, angle) {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
       
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
       
        return {
            x: dx * cos - dy * sin,
            y: dx * sin + dy * cos
        };
    }

    // 13. ВИЗУАЛИЗАЦИЯ СИЛ
    visualizeForces(points, graph, forces, outputPath = null) {
        const { createCanvas } = require('canvas');
        const fs = require('fs');
        const path = require('path');
       
        const canvas = createCanvas(800, 600);
        const ctx = canvas.getContext('2d');
       
        // Фон
        ctx.fillStyle = '#0d1b2a';
        ctx.fillRect(0, 0, 800, 600);
       
        // Найти границы точек
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const scaleX = 700 / (maxX - minX || 1);
        const scaleY = 500 / (maxY - minY || 1);
        const scale = Math.min(scaleX, scaleY);
       
        const offsetX = 50 - minX * scale;
        const offsetY = 50 - minY * scale;
       
        // Нарисовать рёбра
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
       
        const nodeIds = Array.from(graph.nodes.keys());
       
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx === -1 || toIdx === -1) continue;
           
            const x1 = offsetX + points[fromIdx].x * scale;
            const y1 = offsetY + points[fromIdx].y * scale;
            const x2 = offsetX + points[toIdx].x * scale;
            const y2 = offsetY + points[toIdx].y * scale;
           
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
       
        // Нарисовать силы
        for (let i = 0; i < points.length; i++) {
            const x = offsetX + points[i].x * scale;
            const y = offsetY + points[i].y * scale;
           
            // Точка
            ctx.fillStyle = '#4FC3F7';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
           
            // Вектор силы
            const force = forces[i];
            const forceMag = Math.sqrt(force.x * force.x + force.y * force.y);
           
            if (forceMag > 0.01) {
                const arrowLength = Math.min(30, forceMag * 20);
                const angle = Math.atan2(force.y, force.x);
               
                // Цвет в зависимости от величины силы
                const intensity = Math.min(1, forceMag * 5);
                const red = Math.floor(255 * intensity);
                const green = Math.floor(255 * (1 - intensity));
                ctx.strokeStyle = `rgb(${red}, ${green}, 100)`;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
               
                // Стрелка
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(
                    x + Math.cos(angle) * arrowLength,
                    y + Math.sin(angle) * arrowLength
                );
                ctx.stroke();
               
                // Наконечник стрелки
                ctx.beginPath();
                ctx.moveTo(
                    x + Math.cos(angle) * arrowLength,
                    y + Math.sin(angle) * arrowLength
                );
                ctx.lineTo(
                    x + Math.cos(angle + 2.5) * (arrowLength - 5),
                    y + Math.sin(angle + 2.5) * (arrowLength - 5)
                );
                ctx.lineTo(
                    x + Math.cos(angle - 2.5) * (arrowLength - 5),
                    y + Math.sin(angle - 2.5) * (arrowLength - 5)
                );
                ctx.closePath();
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fill();
            }
        }
       
        // Заголовок
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('ПРУЖИННЫЕ СИЛЫ ТОПОЛОГИЧЕСКОЙ КОРРЕКЦИИ', 50, 30);
       
        // Легенда
        ctx.fillStyle = '#cccccc';
        ctx.font = '14px Arial';
        ctx.fillText('🔵 Точки | 🔴 Силы коррекции | ⚪ Оригинальные связи', 50, 570);
       
        // Сохранение
        if (outputPath) {
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
           
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(outputPath, buffer);
            console.log(`🎨 Визуализация сил сохранена: ${outputPath}`);
        }
       
        return canvas;
    }
}

module.exports = TopologyRefiner;
