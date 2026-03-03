// modules/footprint/analysis/ClusterAnalyzer.js
// 📊 АНАЛИЗ КЛАСТЕРОВ И ГРУППИРОВКА ПОХОЖИХ ТОЧЕК

class ClusterAnalyzer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.similarityThreshold = options.similarityThreshold || 0.8;
        console.log('📊 ClusterAnalyzer создан');
    }

    /**
     * Основной метод: кластеризация всех точек
     */
    analyze(points, features, graph) {
        console.log(`📊 Кластеризую ${points.length} точек...`);

        const signatures = this.createSignatures(points, features);
        const clusters = this.groupBySignature(signatures);
        const enhancedFeatures = this.enhanceFeatures(features, clusters);
        const clusterRelations = this.analyzeClusterRelations(clusters, points, graph);

        console.log(`   • Создано кластеров: ${Object.keys(clusters).length}`);
        console.log(`   • Средний размер кластера: ${this.calculateAvgClusterSize(clusters)}`);

        return {
            clusters,
            enhancedFeatures,
            relations: clusterRelations
        };
    }

    createSignatures(points, features) {
        const signatures = [];
        for (const point of points) {
            const f = features.get(point.id) || {};
            const role = f.role || 'R';
            const degree = Math.round((f.degree || 0) / 2);
            const compactness = f.morphology?.compactness || 4;
            const compactGroup = Math.round(compactness / 2);
            const eccentricity = f.morphology?.eccentricity || 0.5;
            const eccGroup = Math.round(eccentricity * 5);
            const signature = `${role}_${degree}_${compactGroup}_${eccGroup}`;
            signatures.push({ pointId: point.id, signature, features: f });
        }
        return signatures;
    }

    groupBySignature(signatures) {
        const groups = {};
        for (const s of signatures) {
            if (!groups[s.signature]) groups[s.signature] = [];
            groups[s.signature].push(s.pointId);
        }

        const clusters = {};
        let clusterId = 1;
        for (const [signature, pointIds] of Object.entries(groups)) {
            clusters[`C${clusterId}`] = {
                id: `C${clusterId}`,
                signature: signature,
                pointIds: pointIds,
                size: pointIds.length,
                isUnique: pointIds.length === 1
            };
            clusterId++;
        }
        return clusters;
    }

    enhanceFeatures(features, clusters) {
        const pointToCluster = new Map();
        for (const [clusterId, cluster] of Object.entries(clusters)) {
            for (const pointId of cluster.pointIds) {
                pointToCluster.set(pointId, {
                    id: clusterId,
                    size: cluster.size,
                    isUnique: cluster.isUnique
                });
            }
        }

        const enhanced = new Map(features);
        for (const [pointId, feature] of enhanced) {
            const cluster = pointToCluster.get(pointId);
            if (cluster) {
                feature.clusterId = cluster.id;
                feature.clusterSize = cluster.size;
                feature.isUnique = cluster.isUnique;
            } else {
                feature.clusterId = 'R0';
                feature.clusterSize = 1;
                feature.isUnique = false;
            }
        }
        return enhanced;
    }

    analyzeClusterRelations(clusters, points, graph) {
        if (!graph) return new Map();
        const relations = new Map();

        for (const [clusterId, cluster] of Object.entries(clusters)) {
            const neighborClusters = new Set();
            for (const pointId of cluster.pointIds) {
                const neighbors = this.findNodeNeighbors(pointId, graph);
                for (const neighbor of neighbors) {
                    for (const [otherId, otherCluster] of Object.entries(clusters)) {
                        if (otherCluster.pointIds.includes(neighbor.id) && otherId !== clusterId) {
                            neighborClusters.add(otherId);
                            break;
                        }
                    }
                }
            }
            relations.set(clusterId, {
                neighbors: Array.from(neighborClusters),
                neighborCount: neighborClusters.size
            });
        }
        return relations;
    }

    findUniquePoints(clusters) {
        const uniquePoints = [];
        for (const [clusterId, cluster] of Object.entries(clusters)) {
            if (cluster.size === 1) {
                uniquePoints.push({
                    pointId: cluster.pointIds[0],
                    clusterId: clusterId,
                    signature: cluster.signature
                });
            }
        }
        return uniquePoints;
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

    calculateAvgClusterSize(clusters) {
        const sizes = Object.values(clusters).map(c => c.size);
        if (sizes.length === 0) return 0;
        const sum = sizes.reduce((a, b) => a + b, 0);
        return (sum / sizes.length).toFixed(1);
    }

    getClusterStats(clusters) {
        const stats = {
            totalClusters: Object.keys(clusters).length,
            uniqueClusters: 0,
            largeClusters: 0,
            distribution: {}
        };
        for (const cluster of Object.values(clusters)) {
            if (cluster.size === 1) stats.uniqueClusters++;
            if (cluster.size > 5) stats.largeClusters++;
            const sizeGroup = cluster.size <= 3 ? 'small' : (cluster.size <= 8 ? 'medium' : 'large');
            stats.distribution[sizeGroup] = (stats.distribution[sizeGroup] || 0) + 1;
        }
        return stats;
    }
}

module.exports = ClusterAnalyzer;
