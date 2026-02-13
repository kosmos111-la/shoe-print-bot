// modules/footprint/topology/GeometricSignature.js
// 🎯 ДВУХУРОВНЕВАЯ ТОПОЛОГИЧЕСКАЯ ИДЕНТИФИКАЦИЯ + ОПОРНЫЕ ТОЧКИ

const SubgraphIsomorphism = require('./SubgraphIsomorphism');

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище сигнатур: modelNodeId -> { degree, triangleCount, roles, neighbors }
        this.signatures = new Map();
       
        // Кластеры: modelNodeId -> [childNodeIds]
        this.clusters = new Map();
       
        // 🔥 ОПОРНЫЕ ТОЧКИ (надежно идентифицированные)
        this.anchorPoints = new Map(); // modelNodeId -> { nodeId, confidence, verificationCount }
       
        // Индекс по ролям для быстрого поиска
        this.roleIndex = {
            'LEAF': new Map(),   // листья (степень 1)
            'BRIDGE': new Map(), // мосты (степень 2, соседи не связаны)
            'HUB': new Map(),    // хабы (степень >= 6)
            'CLIQUE': new Map(), // клики (все соседи связаны)
            'REGULAR': new Map() // обычные узлы
        };
       
        // 🔥 Subgraph Isomorphism для точной идентификации
        this.subgraphChecker = new SubgraphIsomorphism({
            debug: this.debug,
            maxDepth: 2
        });
       
        // Статистика
        this.stats = {
            totalIdentified: 0,
            totalCandidates: 0,
            totalRejected: 0,
            totalClusters: 0,
            totalClusterMembers: 0,
            totalAnchors: 0,
            verifiedByAnchors: 0
        };
       
        console.log('🎯 GeometricSignature создана (с опорными точками)');
        console.log('   ✅ Уровень 1: Индекс по ролям (быстрый поиск)');
        console.log('   ✅ Уровень 2: Subgraph Isomorphism');
        console.log('   🔥 Уровень 3: Верификация опорными точками');
    }

    // ==================== ОСНОВНАЯ ИДЕНТИФИКАЦИЯ ====================

    identify(node, neighbors, currentGraph, modelGraph) {
        if (!modelGraph) return null;
       
        if (this.debug) {
            console.log(`\n   🔍 Идентификация точки ${node.id.substring(0, 20)}...`);
        }
       
        // ШАГ 1: Быстрый поиск по ролям
        const roles = this.determineRoles(node, neighbors, currentGraph);
        let candidates = this.findCandidatesByRole(roles);
       
        if (this.debug) {
            console.log(`      Кандидатов по ролям: ${candidates.length}`);
        }
       
        if (candidates.length === 0) return null;
       
        // ШАГ 2: Оцениваем каждого кандидата
        const evaluatedCandidates = [];
       
        for (const candidate of candidates) {
            const candidateNode = modelGraph.nodes.get(candidate.nodeId);
            if (!candidateNode) continue;
           
            // Топологическая оценка (Subgraph Isomorphism)
            const topologyScore = this.evaluateTopology(
                node, neighbors, currentGraph,
                candidateNode, modelGraph
            );
           
            // Оценка по опорным точкам (если есть)
            const anchorScore = this.evaluateAnchors(
                node, currentGraph,
                candidateNode, modelGraph
            );
           
            // Комбинированная оценка
            const finalScore = this.combineScores(topologyScore, anchorScore);
           
            if (finalScore > 0) {
                evaluatedCandidates.push({
                    nodeId: candidate.nodeId,
                    topologyScore,
                    anchorScore,
                    finalScore,
                    node: candidateNode
                });
            }
        }
       
        // ШАГ 3: Выбираем лучшего
        if (evaluatedCandidates.length === 0) {
            this.stats.totalRejected++;
            return null;
        }
       
        evaluatedCandidates.sort((a, b) => b.finalScore - a.finalScore);
        const best = evaluatedCandidates[0];
       
        // ШАГ 4: Проверяем, достаточно ли хорош лучший кандидат
        if (best.finalScore < 0.6) {
            this.stats.totalRejected++;
            return null;
        }
       
        if (this.debug) {
            console.log(`   ✅ Лучший кандидат:`);
            console.log(`      Топология: ${(best.topologyScore * 100).toFixed(1)}%`);
            console.log(`      Опорные: ${(best.anchorScore * 100).toFixed(1)}%`);
            console.log(`      Финальный: ${(best.finalScore * 100).toFixed(1)}%`);
        }
       
        // ШАГ 5: Если кандидат очень хороший, делаем его опорной точкой
        if (best.finalScore > 0.9) {
            this.addAnchorPoint(best.nodeId, node.id, best.finalScore);
        }
       
        this.stats.totalIdentified++;
        if (best.anchorScore > 0) {
            this.stats.verifiedByAnchors++;
        }
       
        return {
            nodeId: best.nodeId,
            confidence: best.finalScore,
            method: best.anchorScore > 0 ? 'verified_by_anchors' : 'topology_only',
            degree: best.node.degree,
            roles: this.determineRoles(best.node,
                this.findNodeNeighbors(best.node.id, modelGraph), modelGraph)
        };
    }

    // ==================== ПОИСК КАНДИДАТОВ ПО РОЛЯМ ====================

    findCandidatesByRole(roles) {
        let candidates = [];
       
        if (roles.isLeaf) candidates = Array.from(this.roleIndex.LEAF.values());
        else if (roles.isBridge) candidates = Array.from(this.roleIndex.BRIDGE.values());
        else if (roles.isHub) candidates = Array.from(this.roleIndex.HUB.values());
        else if (roles.isClique) candidates = Array.from(this.roleIndex.CLIQUE.values());
        else candidates = Array.from(this.roleIndex.REGULAR.values());
       
        return candidates;
    }

    // ==================== ТОПОЛОГИЧЕСКАЯ ОЦЕНКА ====================

    evaluateTopology(node, neighbors, currentGraph, candidateNode, modelGraph) {
        // Пробуем depth=2
        if (this.subgraphChecker.checkWithDepth(node, currentGraph, candidateNode, modelGraph, 2)) {
            return 1.0;
        }
       
        // Пробуем depth=1
        if (this.subgraphChecker.checkWithDepth(node, currentGraph, candidateNode, modelGraph, 1)) {
            return 0.9;
        }
       
        // Если не прошло, считаем частичное совпадение
        const currentNeighbors = neighbors.length;
        const modelNeighbors = this.findNodeNeighbors(candidateNode.id, modelGraph).length;
       
        const degreeSim = Math.min(currentNeighbors, modelNeighbors) /
                          Math.max(currentNeighbors, modelNeighbors, 1);
       
        return degreeSim * 0.5; // Частичная оценка
    }

    // ==================== ОЦЕНКА ПО ОПОРНЫМ ТОЧКАМ ====================

    evaluateAnchors(node, currentGraph, candidateNode, modelGraph) {
        if (this.anchorPoints.size < 2) {
            return 0; // Недостаточно опорных точек
        }
       
        let totalScore = 0;
        let validAnchors = 0;
       
        for (const [modelAnchorId, anchorInfo] of this.anchorPoints) {
            const modelAnchor = modelGraph.nodes.get(modelAnchorId);
            const currentAnchor = currentGraph.nodes.get(anchorInfo.nodeId);
           
            if (!modelAnchor || !currentAnchor) continue;
           
            // Проверяем связь в модели
            const connectedInModel = this.areConnected(
                candidateNode,
                modelAnchor,
                modelGraph
            );
           
            // Проверяем связь в текущем графе
            const connectedInCurrent = this.areConnected(
                node,
                currentAnchor,
                currentGraph
            );
           
            // Сравниваем связи
            if (connectedInModel && connectedInCurrent) {
                totalScore += 1.0; // Связаны в обоих графах - отлично
            } else if (!connectedInModel && !connectedInCurrent) {
                totalScore += 0.7; // Не связаны в обоих - тоже хорошо
            } else {
                totalScore += 0.2; // Расхождение - плохо
            }
           
            validAnchors++;
        }
       
        return validAnchors > 0 ? totalScore / validAnchors : 0;
    }

    // ==================== КОМБИНИРОВАНИЕ ОЦЕНОК ====================

    combineScores(topologyScore, anchorScore) {
        // Если нет опорных точек, используем только топологию
        if (this.anchorPoints.size < 2) {
            return topologyScore;
        }
       
        // Если топология очень хорошая, доверяем ей
        if (topologyScore > 0.9) {
            return topologyScore;
        }
       
        // Иначе комбинируем
        return topologyScore * 0.4 + anchorScore * 0.6;
    }

    // ==================== УПРАВЛЕНИЕ ОПОРНЫМИ ТОЧКАМИ ====================

    addAnchorPoint(modelNodeId, currentNodeId, confidence) {
        if (!this.anchorPoints.has(modelNodeId)) {
            this.anchorPoints.set(modelNodeId, {
                nodeId: currentNodeId,
                confidence,
                verificationCount: 1,
                addedAt: Date.now()
            });
            this.stats.totalAnchors++;
           
            if (this.debug) {
                console.log(`   🔥 Новая опорная точка: ${modelNodeId.substring(0, 20)}...`);
            }
        } else {
            // Увеличиваем счетчик подтверждений
            const anchor = this.anchorPoints.get(modelNodeId);
            anchor.verificationCount++;
            anchor.confidence = Math.min(1.0, anchor.confidence + 0.1);
        }
    }

    getAnchorPoints() {
        return Array.from(this.anchorPoints.entries()).map(([id, info]) => ({
            modelId: id,
            nodeId: info.nodeId,
            confidence: info.confidence
        }));
    }

    // ==================== ЗАПОМИНАНИЕ ТОЧКИ ====================

    remember(nodeId, node, neighbors, graph) {
        const roles = this.determineRoles(node, neighbors, graph);
        const degree = neighbors.length;
        const triangleCount = this.countTriangles(neighbors, graph);
       
        const signature = {
            nodeId,
            degree,
            triangleCount,
            roles,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            confidence: 1.0,
            timesSeen: 1
        };

        this.signatures.set(nodeId, signature);
       
        // Индексируем по ролям
        if (roles.isLeaf) this.roleIndex.LEAF.set(nodeId, signature);
        if (roles.isBridge) this.roleIndex.BRIDGE.set(nodeId, signature);
        if (roles.isHub) this.roleIndex.HUB.set(nodeId, signature);
        if (roles.isClique) this.roleIndex.CLIQUE.set(nodeId, signature);
        if (!roles.isLeaf && !roles.isBridge && !roles.isHub && !roles.isClique) {
            this.roleIndex.REGULAR.set(nodeId, signature);
        }

        if (this.debug) {
            console.log(`   🎯 Запомнена точка ${nodeId.substring(0, 20)}...`);
            console.log(`      Степень: ${degree}, треугольников: ${triangleCount}`);
        }

        return true;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    countTriangles(neighbors, graph) {
        let count = 0;
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                if (this.areConnected(neighbors[i], neighbors[j], graph)) {
                    count++;
                }
            }
        }
        return count;
    }

    areConnected(nodeA, nodeB, graph) {
        const edgeId = [nodeA.id, nodeB.id].sort().join('--');
        return graph.edges.has(edgeId);
    }

    determineRoles(node, neighbors, graph) {
        const degree = neighbors.length;
       
        const roles = {
            isLeaf: degree === 1,
            isBridge: false,
            isHub: degree >= 6,
            isClique: false
        };

        if (degree === 2) {
            const [a, b] = neighbors;
            roles.isBridge = !this.areConnected(a, b, graph);
        }

        if (degree >= 3) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length && allConnected; i++) {
                for (let j = i + 1; j < neighbors.length && allConnected; j++) {
                    if (!this.areConnected(neighbors[i], neighbors[j], graph)) {
                        allConnected = false;
                    }
                }
            }
            roles.isClique = allConnected;
        }

        return roles;
    }

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        for (const edge of graph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId) {
                const node = graph.nodes.get(nodeB);
                if (node) neighbors.push(node);
            }
            if (nodeB === nodeId) {
                const node = graph.nodes.get(nodeA);
                if (node) neighbors.push(node);
            }
        }
        return neighbors;
    }

    registerCluster(headNodeId, childNodeId) {
        if (!this.clusters.has(headNodeId)) {
            this.clusters.set(headNodeId, []);
            this.stats.totalClusters++;
        }
       
        const members = this.clusters.get(headNodeId);
        if (!members.includes(childNodeId)) {
            members.push(childNodeId);
            this.stats.totalClusterMembers++;
        }
       
        return members.length;
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        const subgraphStats = this.subgraphChecker ? this.subgraphChecker.getStats() : null;
       
        return {
            totalSignatures: this.signatures.size,
            totalClusters: this.clusters.size,
            totalClusterMembers: this.stats.totalClusterMembers,
            totalIdentified: this.stats.totalIdentified,
            totalRejected: this.stats.totalRejected,
            totalAnchors: this.stats.totalAnchors,
            verifiedByAnchors: this.stats.verifiedByAnchors,
            roleStats: {
                LEAF: this.roleIndex.LEAF.size,
                BRIDGE: this.roleIndex.BRIDGE.size,
                HUB: this.roleIndex.HUB.size,
                CLIQUE: this.roleIndex.CLIQUE.size,
                REGULAR: this.roleIndex.REGULAR.size
            },
            subgraphIsomorphism: subgraphStats
        };
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    export() {
        return {
            signatures: Array.from(this.signatures.entries()),
            clusters: Array.from(this.clusters.entries()),
            anchorPoints: Array.from(this.anchorPoints.entries()),
            roleIndex: {
                LEAF: Array.from(this.roleIndex.LEAF.keys()),
                BRIDGE: Array.from(this.roleIndex.BRIDGE.keys()),
                HUB: Array.from(this.roleIndex.HUB.keys()),
                CLIQUE: Array.from(this.roleIndex.CLIQUE.keys()),
                REGULAR: Array.from(this.roleIndex.REGULAR.keys())
            },
            stats: this.stats
        };
    }

    import(data) {
        if (data.signatures) {
            this.signatures = new Map(data.signatures);
            // Перестраиваем индексы
            for (const [nodeId, sig] of this.signatures) {
                if (sig.roles.isLeaf) this.roleIndex.LEAF.set(nodeId, sig);
                if (sig.roles.isBridge) this.roleIndex.BRIDGE.set(nodeId, sig);
                if (sig.roles.isHub) this.roleIndex.HUB.set(nodeId, sig);
                if (sig.roles.isClique) this.roleIndex.CLIQUE.set(nodeId, sig);
                if (!sig.roles.isLeaf && !sig.roles.isBridge && !sig.roles.isHub && !sig.roles.isClique) {
                    this.roleIndex.REGULAR.set(nodeId, sig);
                }
            }
        }
       
        if (data.clusters) {
            this.clusters = new Map(data.clusters);
        }
       
        if (data.anchorPoints) {
            this.anchorPoints = new Map(data.anchorPoints);
            this.stats.totalAnchors = this.anchorPoints.size;
        }
       
        if (data.stats) {
            this.stats = data.stats;
        }
       
        console.log(`📥 Импортировано ${this.signatures.size} сигнатур, ${this.clusters.size} кластеров`);
        console.log(`   Опорных точек: ${this.anchorPoints.size}`);
    }
}

module.exports = GeometricSignature;
