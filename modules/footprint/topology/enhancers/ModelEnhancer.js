// modules/footprint/topology/enhancers/ModelEnhancer.js
// 🚀 УЛУЧШАТЕЛЬ МОДЕЛИ - ПОШАГОВЫЙ РЕФАКТОРИНГ

const GeometryUtils = require('../utils/GeometryUtils');
const GraphUtils = require('../utils/GraphUtils');
const RoleClassifier = require('../utils/RoleClassifier');
const ValidationModule = require('../../validation/ValidationModule');

class ModelEnhancer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.fastMode = options.fastMode || false;
       
        this.positionThreshold = options.positionThreshold || 0.15;
        this.morphologyThreshold = options.morphologyThreshold || 0.85;
        this.softThreshold = options.softThreshold || 20;
       
        this.validator = options.validator || new ValidationModule({
            debug: this.debug,
            positionThreshold: this.positionThreshold,
            morphologyThreshold: this.morphologyThreshold
        });
       
        this.roleClassifier = options.roleClassifier || new RoleClassifier();
       
        this.stats = {
            enhancements: 0,
            magneticPulls: 0,
            mergedPoints: 0,
            validatedPoints: 0
        };
       
        if (this.debug) {
            console.log('🚀 ModelEnhancer (каркас) создан');
        }
    }
   
    // ==================== МЕТОДЫ БУДУТ ДОБАВЛЯТЬСЯ ПОШАГОВО ====================
   
    getStats() {
        return { ...this.stats };
    }
   
    resetStats() {
        this.stats = {
            enhancements: 0,
            magneticPulls: 0,
            mergedPoints: 0,
            validatedPoints: 0
        };
    }
}

module.exports = ModelEnhancer;
```

---

🔧 ШАГ 3: ПЕРЕНЕСТИ _extractTrianglesFromGraph

3.1 ДОБАВИТЬ МЕТОД В ModelEnhancer.js

```javascript
// Добавить в класс ModelEnhancer (после constructor)

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
               
                const edgeAB = [a, b].sort().join('--');
                const edgeBC = [b, c].sort().join('--');
                const edgeCA = [c, a].sort().join('--');
               
                if (edges.has(edgeAB) && edges.has(edgeBC) && edges.has(edgeCA)) {
                    const p1 = graph.nodes.get(a);
                    const p2 = graph.nodes.get(b);
                    const p3 = graph.nodes.get(c);
                   
                    if (p1 && p2 && p3) {
                        const triangleEdges = [
                            { v1: p1, v2: p2, externalPoint: null, neighborTriangles: [] },
                            { v1: p2, v2: p3, externalPoint: null, neighborTriangles: [] },
                            { v1: p3, v2: p1, externalPoint: null, neighborTriangles: [] }
                        ];
                       
                        triangles.push({
                            p1, p2, p3,
                            edges: triangleEdges,
                            id: `tri_${a}_${b}_${c}`,
                            confidence: 0.5
                        });
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
