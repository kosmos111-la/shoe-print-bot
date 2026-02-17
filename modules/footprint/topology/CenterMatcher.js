// modules/footprint/topology/CenterMatcher.js
// 🔥 ИЕРАРХИЧЕСКИЙ ПОИСК НАДЁЖНЫХ ТОЧЕК (H → B/C → R → L) + K-PLET + LCS

class CenterMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.minLocalSimilarity = options.minLocalSimilarity || 0.5;
        this.minMorphologySimilarity = options.minMorphologySimilarity || 0.6;
        this.minConsistentPairs = options.minConsistentPairs || 3;
       
        // 🔥 ПАРАМЕТРЫ K-PLET
        this.k = options.k || 8;
        this.quadrants = 4;
       
        // 🔥 МЯГКИЕ ПОРОГИ
        this.distThr = options.distThr || 12;
        this.angleThr = options.angleThr || 20;
        this.thetaThr = options.thetaThr || 30;
       
        // 🔥 ВЕСА ДЛЯ LCS
        this.trueWeight = 16;
        this.falseWeight = -16;
        this.distCoeff = 2;
        this.angleCoeff = 4;
        this.thetaCoeff = 6;
       
        // 🔥 ПОРОГИ ДЛЯ РОЛЕЙ
        this.hubThreshold = 6;      // H: степень ≥ 6
        this.bridgeThreshold = 2;    // B: степень = 2, соседи не связаны
        this.cliqueThreshold = 3;     // C: степень ≥ 3, все соседи связаны
        this.highDegreeThreshold = 4; // для обычных узлов с высокой степенью
       
        this.localGroupSignature = options.localGroupSignature;
        this.morphologyEncoder = options.morphologyEncoder;
       
        this.centerMatches = new Map();
        this.depthUsage = new Map();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
       
        console.log('🎯 CenterMatcher (ИЕРАРХИЧЕСКИЙ + K-plet + LCS) создан');
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    findCenterMatches(photoGraph, modelGraph, photoMorphology, modelMorphology) {
        console.log(`\n🔍 Иерархический поиск якорей (H → B/C → R → L)...`);

        // 1. СТРОИМ K-PLET ДЛЯ ВСЕХ ТОЧЕК
        const photoKPlets = this.buildAllKPlets(photoGraph, photoMorphology);
        const modelKPlets = this.buildAllKPlets(modelGraph, modelMorphology);
       
        console.log(`\n📊 Построено K-plet: ${photoKPlets.size} для фото, ${modelKPlets.size} для модели`);

        // 2. ОПРЕДЕЛЯЕМ РОЛИ ДЛЯ ВСЕХ ТОЧЕК
        const photoRoles = this.determineAllRoles(photoGraph);
        const modelRoles = this.determineAllRoles(modelGraph);
       
        console.log(`\n📊 Распределение ролей в фото:`);
        this.printRoleStats(photoRoles);
        console.log(`\n📊 Распределение ролей в модели:`);
        this.printRoleStats(modelRoles);

        // 3. ИЕРАРХИЧЕСКИЙ ПОИСК
        const searchDim = 15;
       
        // УРОВЕНЬ 1: ХАБЫ (H)
        let result = this.searchByRole('H', photoGraph, modelGraph, photoKPlets, modelKPlets, photoRoles, modelRoles, searchDim);
        if (result.size >= this.minConsistentPairs) {
            console.log(`\n✅ Найдено ${result.size} якорей на УРОВНЕ 1 (ХАБЫ)`);
            return result;
        }
       
        // УРОВЕНЬ 2: МОСТЫ (B) и КЛИКИ (C)
        result = this.searchByRole(['B', 'C'], photoGraph, modelGraph, photoKPlets, modelKPlets, photoRoles, modelRoles, searchDim);
        if (result.size >= this.minConsistentPairs) {
            console.log(`\n✅ Найдено ${result.size} якорей на УРОВНЕ 2 (МОСТЫ/КЛИКИ)`);
            return result;
        }
       
        // УРОВЕНЬ 3: ОБЫЧНЫЕ УЗЛЫ С ВЫСОКОЙ СТЕПЕНЬЮ
        result = this.searchByRole('R', photoGraph, modelGraph, photoKPlets, modelKPlets, photoRoles, modelRoles, searchDim, true);
        if (result.size >= this.minConsistentPairs) {
            console.log(`\n✅ Найдено ${result.size} якорей на УРОВНЕ 3 (ОБЫЧНЫЕ С ВЫСОКОЙ СТЕПЕНЬЮ)`);
            return result;
        }
       
        // УРОВЕНЬ 4: ВСЕ ОСТАЛЬНЫЕ
        result = this.searchByRole(null, photoGraph, modelGraph, photoKPlets, modelKPlets, photoRoles, modelRoles, searchDim);
        console.log(`\n⚠️ Найдено только ${result.size} якорей на УРОВНЕ 4 (ВСЕ)`);
       
        return result;
    }

    // ==================== ИЕРАРХИЧЕСКИЙ ПОИСК ПО РОЛЯМ ====================

    searchByRole(roles, photoGraph, modelGraph, photoKPlets, modelKPlets, photoRoles, modelRoles, searchDim, highDegreeOnly = false) {
        // Собираем ID точек с нужными ролями
        let photoIds = [];
        let modelIds = [];
       
        const rolesArray = Array.isArray(roles) ? roles : [roles];
       
        for (const [id, role] of photoRoles) {
            if (roles === null || rolesArray.includes(role)) {
                if (highDegreeOnly) {
                    const node = photoGraph.nodes.get(id);
                    if (node && node.degree >= this.highDegreeThreshold) {
                        photoIds.push(id);
                    }
                } else {
                    photoIds.push(id);
                }
            }
        }
       
        for (const [id, role] of modelRoles) {
            if (roles === null || rolesArray.includes(role)) {
                if (highDegreeOnly) {
                    const node = modelGraph.nodes.get(id);
                    if (node && node.degree >= this.highDegreeThreshold) {
                        modelIds.push(id);
                    }
                } else {
                    modelIds.push(id);
                }
            }
        }
       
        // Ограничиваем размер поиска
        photoIds = photoIds.slice(0, searchDim);
        modelIds = modelIds.slice(0, searchDim);
       
        console.log(`\n🔍 Поиск по ролям ${roles}: ${photoIds.length} кандидатов в фото, ${modelIds.length} в модели`);
       
        let bestScore = 0;
        let bestPairs = [];
       
        for (const photoId of photoIds) {
            for (const modelId of modelIds) {
                const result = this.matchWithDFS(
                    photoId, modelId,
                    photoGraph, modelGraph,
                    photoKPlets, modelKPlets
                );
               
                if (result.score > bestScore) {
                    bestScore = result.score;
                    bestPairs = result.pairs;
                }
            }
        }
       
        // Формируем результат
        const result = new Map();
        let pairNumber = 1;
       
        for (const pair of bestPairs) {
            if (pair.photoId && pair.modelId) {
                result.set(pair.photoId, {
                    modelId: pair.modelId,
                    confidence: pair.score / this.trueWeight,
                    pairNumber: pairNumber++
                });
            }
        }
       
        return result;
    }

    // ==================== ОПРЕДЕЛЕНИЕ РОЛЕЙ ====================

    determineAllRoles(graph) {
        const roles = new Map();
       
        for (const [nodeId, node] of graph.nodes) {
            roles.set(nodeId, this.getNodeRole(nodeId, graph));
        }
       
        return roles;
    }

    getNodeRole(nodeId, graph) {
        const neighbors = this.findNodeNeighbors(nodeId, graph);
        const degree = neighbors.length;
       
        // ХАБ (H)
        if (degree >= this.hubThreshold) return 'H';
       
        // МОСТ (B)
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!this.areConnected(a.id, b.id, graph)) {
                return 'B';
            }
        }
       
        // КЛИКА (C)
        if (degree >= this.cliqueThreshold) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (!this.areConnected(neighbors[i].id, neighbors[j].id, graph)) {
                        allConnected = false;
                        break;
                    }
                }
                if (!allConnected) break;
            }
            if (allConnected) return 'C';
        }
       
        // ЛИСТ (L)
        if (degree === 1) return 'L';
       
        // ОБЫЧНЫЙ (R)
        return 'R';
    }

    // ==================== ПОСТРОЕНИЕ K-PLET ====================

    buildAllKPlets(graph, morphologyMap) {
        const kplets = new Map();
       
        for (const [nodeId, node] of graph.nodes) {
            kplets.set(nodeId, this.buildKPlet(nodeId, graph, morphologyMap));
        }
       
        return kplets;
    }

    buildKPlet(centerId, graph, morphologyMap) {
        const centerNode = graph.nodes.get(centerId);
        if (!centerNode) return [];
       
        const neighbors = this.findAllNeighbors(centerId, graph, 2);
        const quadrants = [[], [], [], []];
       
        for (const neighbor of neighbors) {
            if (neighbor.id === centerId) continue;
           
            const dx = neighbor.x - centerNode.x;
            const dy = neighbor.y - centerNode.y;
           
            const dist = Math.sqrt(dx*dx + dy*dy);
           
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
            if (angle < 0) angle += 360;
           
            const quadrant = Math.floor(angle / 90) % 4;
           
            const neighborRole = this.getNodeRole(neighbor.id, graph);
            const theta = this.roleToAngle(neighborRole);
           
            quadrants[quadrant].push({
                id: neighbor.id,
                dist: Math.round(dist),
                angle: Math.round(angle),
                theta: theta,
                node: neighbor
            });
        }
       
        for (let q = 0; q < 4; q++) {
            quadrants[q].sort((a, b) => a.dist - b.dist);
        }
       
        const kplet = [];
        let total = 0;
       
        while (total < this.k) {
            let added = 0;
            for (let q = 0; q < 4; q++) {
                if (quadrants[q].length > 0) {
                    kplet.push(quadrants[q].shift());
                    total++;
                    added++;
                    if (total >= this.k) break;
                }
            }
            if (added === 0) break;
        }
       
        return kplet;
    }

    findAllNeighbors(centerId, graph, depth) {
        const neighbors = [];
        const visited = new Set([centerId]);
        const queue = [{ id: centerId, dist: 0 }];
       
        while (queue.length > 0) {
            const { id, dist } = queue.shift();
           
            if (dist > 0) {
                const node = graph.nodes.get(id);
                if (node) neighbors.push(node);
            }
           
            if (dist >= depth) continue;
           
            const nodeNeighbors = this.findNodeNeighbors(id, graph);
            for (const neighbor of nodeNeighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({ id: neighbor.id, dist: dist + 1 });
                }
            }
        }
       
        return neighbors;
    }

    // ==================== LCS СРАВНЕНИЕ ====================

    compareKPlets(kplet1, kplet2, color1, color2) {
        const m = kplet1.length;
        const n = kplet2.length;
       
        const cost = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
        const dir = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
       
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const ray1 = kplet1[i-1];
                const ray2 = kplet2[j-1];
               
                let leftUpCost;
               
                if (!ray1 || !ray2) {
                    leftUpCost = cost[i-1][j-1] + this.falseWeight;
                } else if (color1[ray1.id] !== 0 || color2[ray2.id] !== 0) {
                    leftUpCost = cost[i-1][j-1] + this.falseWeight;
                } else {
                    const distDiff = Math.abs(ray1.dist - ray2.dist);
                    const angleDiff = this.angleDiff(ray1.angle, ray2.angle);
                    const thetaDiff = this.angleDiff(ray1.theta, ray2.theta);
                   
                    if (distDiff <= this.distThr &&
                        angleDiff <= this.angleThr &&
                        thetaDiff <= this.thetaThr) {
                       
                        const weight = this.trueWeight -
                                      distDiff / this.distCoeff -
                                      angleDiff / this.angleCoeff -
                                      thetaDiff / this.thetaCoeff;
                       
                        leftUpCost = cost[i-1][j-1] + Math.max(0, weight);
                    } else {
                        leftUpCost = cost[i-1][j-1] + this.falseWeight;
                    }
                }
               
                const upCost = cost[i-1][j];
                const leftCost = cost[i][j-1];
               
                if (leftUpCost > upCost && leftUpCost > leftCost) {
                    cost[i][j] = leftUpCost;
                    dir[i][j] = 1;
                } else if (upCost > leftCost) {
                    cost[i][j] = upCost;
                    dir[i][j] = 2;
                } else {
                    cost[i][j] = leftCost;
                    dir[i][j] = 3;
                }
            }
        }
       
        const pairs = [];
        let i = m, j = n;
       
        while (i > 0 && j > 0) {
            if (dir[i][j] === 1) {
                const ray1 = kplet1[i-1];
                const ray2 = kplet2[j-1];
               
                if (ray1 && ray2 && color1[ray1.id] === 0 && color2[ray2.id] === 0) {
                    pairs.push({
                        photoId: ray1.id,
                        modelId: ray2.id,
                        score: cost[i][j] - cost[i-1][j-1]
                    });
                }
               
                i--; j--;
            } else if (dir[i][j] === 2) {
                i--;
            } else {
                j--;
            }
        }
       
        return {
            score: cost[m][n],
            pairs: pairs
        };
    }

    // ==================== DFS ОБХОД ====================

    matchWithDFS(startPhotoId, startModelId, photoGraph, modelGraph, photoKPlets, modelKPlets) {
        const photoColor = {};
        const modelColor = {};
       
        for (const id of photoGraph.nodes.keys()) photoColor[id] = 0;
        for (const id of modelGraph.nodes.keys()) modelColor[id] = 0;
       
        const stack = [];
        let totalScore = 1;
        const pairs = [];
       
        photoColor[startPhotoId] = 1;
        modelColor[startModelId] = 1;
        stack.push({ photoId: startPhotoId, modelId: startModelId });
        pairs.push({
            photoId: startPhotoId,
            modelId: startModelId,
            score: this.trueWeight
        });
       
        while (stack.length > 0) {
            const { photoId, modelId } = stack.pop();
           
            const photoKplet = photoKPlets.get(photoId) || [];
            const modelKplet = modelKPlets.get(modelId) || [];
           
            const result = this.compareKPlets(photoKplet, modelKplet, photoColor, modelColor);
           
            for (const pair of result.pairs) {
                if (photoColor[pair.photoId] === 0 && modelColor[pair.modelId] === 0) {
                    photoColor[pair.photoId] = 1;
                    modelColor[pair.modelId] = 1;
                    stack.push({ photoId: pair.photoId, modelId: pair.modelId });
                    pairs.push(pair);
                    totalScore++;
                }
            }
           
            photoColor[photoId] = 2;
            modelColor[modelId] = 2;
        }
       
        return {
            score: totalScore,
            pairs: pairs
        };
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

    roleToAngle(role) {
        const map = { 'L': 0, 'R': 45, 'C': 90, 'H': 135, 'B': 180 };
        return map[role] || 0;
    }

    angleDiff(a1, a2) {
        let diff = Math.abs(a1 - a2);
        if (diff > 180) diff = 360 - diff;
        return diff;
    }

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        if (!graph?.edges) return neighbors;
       
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) {
                const node = graph.nodes.get(b);
                if (node) neighbors.push(node);
            }
            if (b === nodeId) {
                const node = graph.nodes.get(a);
                if (node) neighbors.push(node);
            }
        }
        return neighbors;
    }

    areConnected(aId, bId, graph) {
        const edgeId = [aId, bId].sort().join('--');
        return graph.edges.has(edgeId);
    }

    printRoleStats(roles) {
        const stats = { H: 0, B: 0, C: 0, R: 0, L: 0 };
        for (const role of roles.values()) {
            stats[role]++;
        }
        console.log(`   Хабы (H): ${stats.H}`);
        console.log(`   Мосты (B): ${stats.B}`);
        console.log(`   Клики (C): ${stats.C}`);
        console.log(`   Обычные (R): ${stats.R}`);
        console.log(`   Листья (L): ${stats.L}`);
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            minConsistentPairs: this.minConsistentPairs,
            k: this.k,
            distThr: this.distThr,
            angleThr: this.angleThr,
            thetaThr: this.thetaThr,
            hubThreshold: this.hubThreshold,
            bridgeThreshold: this.bridgeThreshold,
            cliqueThreshold: this.cliqueThreshold
        };
    }

    clear() {
        this.centerMatches.clear();
        this.depthUsage.clear();
        this.zoneStats = { center: 0, toe: 0, heel: 0 };
    }
}

module.exports = CenterMatcher;
