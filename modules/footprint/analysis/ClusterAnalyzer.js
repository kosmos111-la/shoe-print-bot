// modules/footprint/analysis/ClusterAnalyzer.js
// 📊 АНАЛИЗ КЛАСТЕРОВ - ИСПРАВЛЕННЫЙ ФОРМАТ CLUSTERID

class ClusterAnalyzer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.similarityThreshold = options.similarityThreshold || 0.85;
        console.log('📊 ClusterAnalyzer (полная версия) создан');
    }

    /**
     * Основной метод: кластеризация всех точек
     */
    analyze(points, features, graph) {
        console.log(`📊 Кластеризую ${points.length} точек по 14 признакам...`);
        this.diagnoseFeatures(points, features);
     
        const signatures = this.createSignatures(points, features);
        const clusters = this.groupBySignature(signatures);
        const enhancedFeatures = this.enhanceFeatures(features, clusters);
        const clusterRelations = this.analyzeClusterRelations(clusters, points, graph);
        const stats = this.getClusterStats(clusters);

        console.log(`   • Создано кластеров: ${Object.keys(clusters).length}`);
        console.log(`   • Средний размер кластера: ${stats.avgSize}`);
        console.log(`   • Уникальных кластеров: ${stats.uniqueClusters}`);

        return {
            clusters,
            enhancedFeatures,
            relations: clusterRelations,
            stats
        };
    }

    /**
     * Создает сигнатуру точки
     */
    createSignatures(points, features) {
        const signatures = [];

        for (const point of points) {
            const f = features.get(point.id) || {};
            const morph = point.morphology || f.morphology || {};
          
            const components = [
                f.role || 'R',
                Math.round((morph.compactness || 4) / 2),
                Math.round((morph.eccentricity || 0.5) * 5),
                Math.round((morph.normalizedArea || 1) * 2),
                this.hashProfile(morph.radialProfile || [0,0,0,0]),
                f.neighborRoles ? f.neighborRoles.length : 0,
                Math.round((f.degree || 0) / 2),
                Math.round((f.triangles || 0) / 2),
                f.patternType || 'R',
                Math.round((f.patternFrequency || 1) / 2)
            ];
          
            const signature = components.join('_');

            signatures.push({
                pointId: point.id,
                signature: signature,
                features: f,
                components
            });
        }

        return signatures;
    }

    hashProfile(profile) {
        if (!profile || profile.length === 0) return '0';
        return profile.map(v => Math.floor(v * 5)).join('');
    }

    /**
     * 🔥 ИСПРАВЛЕНО: группировка с правильными ID кластеров
     */
    groupBySignature(signatures) {
        const groups = {};

        for (const s of signatures) {
            if (!groups[s.signature]) {
                groups[s.signature] = [];
            }
            groups[s.signature].push({
                pointId: s.pointId,
                components: s.components
            });
        }

        const clusters = {};
        let clusterId = 1;

        for (const [signature, members] of Object.entries(groups)) {
            const pointIds = members.map(m => m.pointId);
            // 🔥 ВАЖНО: clusterId всегда с префиксом 'C'
            const clusterKey = `C${clusterId}`;
            clusters[clusterKey] = {
                id: clusterKey,
                signature: signature,
                pointIds: pointIds,
                size: pointIds.length,
                isUnique: pointIds.length === 1,
                representative: members[0].components
            };
            clusterId++;
        }

        return clusters;
    }

    /**
     * 🔥 ИСПРАВЛЕНО: добавление clusterId в features
     */
    enhanceFeatures(features, clusters) {
        const pointToCluster = new Map();
       
        for (const [clusterId, cluster] of Object.entries(clusters)) {
            for (const pointId of cluster.pointIds) {
                pointToCluster.set(pointId, {
                    id: clusterId,           // Уже с префиксом 'C'
                    size: cluster.size,
                    isUnique: cluster.isUnique,
                    signature: cluster.signature
                });
            }
        }

        const enhanced = new Map();
       
        // Копируем существующие features
        for (const [pointId, feature] of features) {
            enhanced.set(pointId, { ...feature });
        }
       
        for (const [pointId, feature] of enhanced) {
            const cluster = pointToCluster.get(pointId);
            if (cluster) {
                feature.clusterId = cluster.id;        // 'C1', 'C2', ...
                feature.clusterSize = cluster.size;
                feature.isUnique = cluster.isUnique;
                feature.clusterSignature = cluster.signature;
            } else {
                // 🔥 ИСПРАВЛЕНО: для некластеризованных 'R0'
                feature.clusterId = 'R0';
                feature.clusterSize = 1;
                feature.isUnique = false;
                feature.clusterSignature = 'unknown';
            }
        }

        return enhanced;
    }

    /**
     * Анализирует соседние кластеры
     */
    analyzeClusterRelations(clusters, points, graph) {
        if (!graph) return new Map();
      
        const relations = new Map();
        const pointToCluster = new Map();
      
        for (const [clusterId, cluster] of Object.entries(clusters)) {
            for (const pointId of cluster.pointIds) {
                pointToCluster.set(pointId, clusterId);
            }
        }

        for (const [clusterId, cluster] of Object.entries(clusters)) {
            const neighborClusters = new Set();
            const neighborPoints = new Set();

            for (const pointId of cluster.pointIds) {
                const neighbors = this.findNodeNeighbors(pointId, graph);
                for (const neighbor of neighbors) {
                    const neighborCluster = pointToCluster.get(neighbor.id);
                    if (neighborCluster && neighborCluster !== clusterId) {
                        neighborClusters.add(neighborCluster);
                        neighborPoints.add(neighbor.id);
                    }
                }
            }

            relations.set(clusterId, {
                neighbors: Array.from(neighborClusters),
                neighborCount: neighborClusters.size,
                neighborPoints: neighborPoints.size
            });
        }

        return relations;
    }

    /**
     * Находит уникальные точки
     */
    findUniquePoints(clusters) {
        const uniquePoints = [];

        for (const [clusterId, cluster] of Object.entries(clusters)) {
            if (cluster.size === 1) {
                uniquePoints.push({
                    pointId: cluster.pointIds[0],
                    clusterId: clusterId,
                    signature: cluster.signature,
                    representative: cluster.representative
                });
            }
        }

        return uniquePoints;
    }

    /**
     * Поиск соседей в графе
     */
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

    /**
     * Статистика кластеров
     */
    getClusterStats(clusters) {
        const sizes = Object.values(clusters).map(c => c.size);
        const totalClusters = Object.keys(clusters).length;
      
        const stats = {
            totalClusters,
            uniqueClusters: 0,
            smallClusters: 0,
            mediumClusters: 0,
            largeClusters: 0,
            avgSize: 0,
            maxSize: 0,
            minSize: Infinity,
            distribution: {},
            sizeGroups: {}
        };

        if (sizes.length > 0) {
            stats.avgSize = (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1);
            stats.maxSize = Math.max(...sizes);
            stats.minSize = Math.min(...sizes);
        }

        for (const cluster of Object.values(clusters)) {
            if (cluster.size === 1) stats.uniqueClusters++;
          
            if (cluster.size <= 2) stats.smallClusters++;
            else if (cluster.size <= 5) stats.mediumClusters++;
            else stats.largeClusters++;
          
            const sizeGroup = cluster.size <= 2 ? 'tiny' :
                             (cluster.size <= 4 ? 'small' :
                             (cluster.size <= 8 ? 'medium' : 'large'));
            stats.sizeGroups[sizeGroup] = (stats.sizeGroups[sizeGroup] || 0) + 1;
          
            stats.distribution[cluster.size] = (stats.distribution[cluster.size] || 0) + 1;
        }

        return stats;
    }

    /**
     * Сравнение кластеров двух следов
     */
    compareClusters(clusters1, clusters2) {
        const comparison = {
            matching: [],
            missing: [],
            extra: [],
            transformed: []
        };

        const signatures1 = new Map();
        const signatures2 = new Map();

        for (const [id, cluster] of Object.entries(clusters1)) {
            if (!signatures1.has(cluster.signature)) {
                signatures1.set(cluster.signature, []);
            }
            signatures1.get(cluster.signature).push(id);
        }

        for (const [id, cluster] of Object.entries(clusters2)) {
            if (!signatures2.has(cluster.signature)) {
                signatures2.set(cluster.signature, []);
            }
            signatures2.get(cluster.signature).push(id);
        }

        for (const [sig, ids1] of signatures1) {
            if (signatures2.has(sig)) {
                const ids2 = signatures2.get(sig);
                const count = Math.min(ids1.length, ids2.length);
              
                comparison.matching.push({
                    signature: sig,
                    count: count,
                    size: clusters1[ids1[0]].size
                });

                if (ids1.length > ids2.length) {
                    comparison.missing.push({
                        signature: sig,
                        count: ids1.length - ids2.length,
                        size: clusters1[ids1[0]].size
                    });
                }
            } else {
                const similar = this.findSimilarClusters(sig, clusters1[ids1[0]], clusters2);
                if (similar) {
                    comparison.transformed.push({
                        from: sig,
                        to: similar.signature,
                        count: ids1.length
                    });
                } else {
                    comparison.missing.push({
                        signature: sig,
                        count: ids1.length,
                        size: clusters1[ids1[0]].size
                    });
                }
            }
        }

        for (const [sig, ids2] of signatures2) {
            if (!signatures1.has(sig) && !comparison.transformed.some(t => t.to === sig)) {
                comparison.extra.push({
                    signature: sig,
                    count: ids2.length,
                    size: clusters2[ids2[0]].size
                });
            }
        }

        return comparison;
    }

    /**
     * Поиск похожих кластеров
     */
    findSimilarClusters(signature, cluster, clusters2) {
        const components = cluster.representative;
      
        for (const [id, other] of Object.entries(clusters2)) {
            const otherComponents = other.representative;
            if (!otherComponents) continue;
          
            let matches = 0;
            for (let i = 0; i < Math.min(components.length, otherComponents.length); i++) {
                if (components[i] === otherComponents[i]) matches++;
            }
          
            const similarity = matches / Math.max(components.length, otherComponents.length);
            if (similarity > 0.7) {
                return other;
            }
        }
      
        return null;
    }

    /**
     * Диагностика распределения признаков
     */
    diagnoseFeatures(points, features) {
        console.log(`\n🔬 ДИАГНОСТИКА ПРИЗНАКОВ:`);
      
        const stats = {
            role: {},
            degree: [],
            compactness: [],
            eccentricity: [],
            area: [],
            radialProfile: [],
            neighborRoles: new Set(),
            triangles: []
        };
      
        for (const point of points) {
            const f = features.get(point.id) || {};
            const morph = f.morphology || {};
          
            stats.role[f.role || 'R'] = (stats.role[f.role || 'R'] || 0) + 1;
          
            if (f.degree) stats.degree.push(f.degree);
            if (morph.compactness) stats.compactness.push(morph.compactness);
            if (morph.eccentricity) stats.eccentricity.push(morph.eccentricity);
            if (morph.normalizedArea) stats.area.push(morph.normalizedArea);
            if (f.triangles) stats.triangles.push(f.triangles);
          
            if (f.neighborRoles) stats.neighborRoles.add(f.neighborRoles);
          
            if (morph.radialProfile) {
                stats.radialProfile.push(morph.radialProfile.join(','));
            }
        }
      
        console.log(`\n📊 РАСПРЕДЕЛЕНИЕ РОЛЕЙ:`);
        Object.entries(stats.role).forEach(([role, count]) => {
            console.log(`   • ${role}: ${count} точек (${(count/points.length*100).toFixed(1)}%)`);
        });
      
        console.log(`\n📈 ЧИСЛОВЫЕ ПРИЗНАКИ:`);
        this.printNumberStats('Степень', stats.degree);
        this.printNumberStats('Компактность', stats.compactness);
        this.printNumberStats('Эксцентриситет', stats.eccentricity);
        this.printNumberStats('Площадь', stats.area);
        this.printNumberStats('Треугольники', stats.triangles);
      
        console.log(`\n🔤 РОЛИ СОСЕДЕЙ: ${stats.neighborRoles.size} уникальных паттернов`);
        if (stats.neighborRoles.size < 10) {
            console.log(`   Примеры: ${Array.from(stats.neighborRoles).slice(0,5).join(', ')}`);
        }
      
        console.log(`\n📐 РАДИАЛЬНЫЙ ПРОФИЛЬ: ${stats.radialProfile.length} точек`);
        const uniqueProfiles = new Set(stats.radialProfile);
        console.log(`   • Уникальных профилей: ${uniqueProfiles.size}`);
        console.log(`   • Повторов: ${stats.radialProfile.length - uniqueProfiles.size}`);
    }

    printNumberStats(name, values) {
        if (values.length === 0) return;
      
        const unique = new Set(values);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a,b) => a+b, 0) / values.length;
      
        console.log(`   • ${name}: диапазон ${min.toFixed(2)}-${max.toFixed(2)}, среднее ${avg.toFixed(2)}`);
        console.log(`     уникальных значений: ${unique.size}/${values.length} (${(unique.size/values.length*100).toFixed(1)}%)`);
    }
}

module.exports = ClusterAnalyzer;
