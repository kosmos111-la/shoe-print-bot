// modules/footprint/topology/enhancers/ModelEnhancer.js
// 🚀 УЛУЧШЕНИЕ МОДЕЛИ НОВЫМ ФОТО - ВЫНЕСЕННАЯ ЛОГИКА

const GeometryUtils = require('../utils/GeometryUtils');
const GraphUtils = require('../utils/GraphUtils');
const RoleClassifier = require('../utils/RoleClassifier');
const ValidationModule = require('../../validation/ValidationModule');
const AffineRefiner = require('../AffineRefiner');

class ModelEnhancer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.fastMode = options.fastMode || false;
       
        // Пороги
        this.positionThreshold = options.positionThreshold || 0.15;
        this.morphologyThreshold = options.morphologyThreshold || 0.85;
        this.geometryThreshold = options.geometryThreshold || 0.3;
        this.softThreshold = options.softThreshold || 20;
       
        // Компоненты
        this.validator = options.validator || new ValidationModule({
            debug: this.debug,
            positionThreshold: this.positionThreshold,
            morphologyThreshold: this.morphologyThreshold
        });
       
        this.roleClassifier = options.roleClassifier || new RoleClassifier();
        this.affineRefiner = options.affineRefiner || new AffineRefiner({ debug: this.debug });
       
        // Статистика
        this.stats = {
            enhancements: 0,
            magneticPulls: 0,
            geometricExpansions: 0,
            mergedPoints: 0,
            validatedPoints: 0
        };
       
        console.log('🚀 ModelEnhancer создан');
    }
   
    // ==================== ПРИВАТНЫЕ МЕТОДЫ (БУДУТ ДОБАВЛЯТЬСЯ ПО ШАГАМ) ====================

/**
     * Извлекает все треугольники из графа
     */
    extractTrianglesFromGraph(graph) {
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
                            triangles.push({ p1, p2, p3, id: `tri_${a}_${b}_${c}` });
                        }
                    }
                }
            }
        }
       
        if (this.debug) {
            console.log(`   📐 Извлечено треугольников: ${triangles.length}`);
        }
       
        return triangles;
    }  

/**
     * Сливает дублирующиеся точки в графе
     */
    mergeDuplicatePoints(graph, threshold = 5) {
        const points = Array.from(graph.nodes.values());
        const merged = new Set();
        let mergedCount = 0;
        let edgesToUpdate = new Map();
       
        for (let i = 0; i < points.length; i++) {
            if (merged.has(points[i].id)) continue;
           
            for (let j = i + 1; j < points.length; j++) {
                if (merged.has(points[j].id)) continue;
               
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
               
                if (dist < threshold) {
                    const avgX = (points[i].x + points[j].x) / 2;
                    const avgY = (points[i].y + points[j].y) / 2;
                    points[i].x = avgX;
                    points[i].y = avgY;
                    points[i].confirmationCount = (points[i].confirmationCount || 1) + (points[j].confirmationCount || 1);
                   
                    edgesToUpdate.set(points[j].id, points[i].id);
                    graph.nodes.delete(points[j].id);
                    merged.add(points[j].id);
                    mergedCount++;
                }
            }
        }
       
        if (edgesToUpdate.size > 0) {
            const newEdges = new Set();
            for (const edge of graph.edges) {
                let [a, b] = edge.split('--');
                if (edgesToUpdate.has(a)) a = edgesToUpdate.get(a);
                if (edgesToUpdate.has(b)) b = edgesToUpdate.get(b);
                if (a !== b) {
                    newEdges.add([a, b].sort().join('--'));
                }
            }
            graph.edges = newEdges;
           
            for (const node of graph.nodes.values()) node.degree = 0;
            for (const edge of graph.edges) {
                const [a, b] = edge.split('--');
                if (graph.nodes.has(a)) graph.nodes.get(a).degree++;
                if (graph.nodes.has(b)) graph.nodes.get(b).degree++;
            }
        }
       
        return mergedCount;
    }

  
}
module.exports = ModelEnhancer;
