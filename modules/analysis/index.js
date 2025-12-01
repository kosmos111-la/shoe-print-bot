// modules/analysis/index.js - ДОБАВЛЯЕМ МОРФОЛОГИЮ И ТОПОЛОГИЮ

const { TopographyAnalyzer } = require('./topography-analyzer');

class AnalysisModule {
    constructor() {
        this.topographyAnalyzer = new TopographyAnalyzer();
        console.log('📊 Модуль анализа инициализирован (только топография)');
    }

    async performComprehensiveAnalysis(imagePath, predictions, userContext = {}) {
        try {
            console.log('🎯 Запускаю ТОПОГРАФИЧЕСКИЙ анализ...');
           
            // ТОЛЬКО ТОПОГРАФИЯ (пока)
            const topography = await this.topographyAnalyzer.analyzeFootprintTopography(
                imagePath, predictions, userContext
            );
           
            // 🆕 ДОБАВЛЯЕМ ПРОСТУЮ МОРФОЛОГИЮ И ТОПОЛОГИЮ
            const morphology = this.analyzeMorphology(predictions);
            const topology = this.analyzeTopology(predictions);
           
            const result = {
                topography,
                morphology, // 🆕 НОВОЕ
                topology,   // 🆕 НОВОЕ
                summary: this.generateAnalysisSummary(topography, morphology, topology),
                timestamp: new Date().toISOString()
            };
           
            return result;
           
        } catch (error) {
            console.log('❌ Ошибка анализа:', error);
            throw error;
        }
    }

    // 🆕 МОРФОЛОГИЧЕСКИЙ АНАЛИЗ (форма и структура)
    analyzeMorphology(predictions) {
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
       
        return {
            outlineShape: this.analyzeOutlineShape(outlines),
            protectorPattern: this.analyzeProtectorPattern(protectors),
            symmetry: this.analyzeSymmetry(predictions),
            complexity: this.calculateComplexity(predictions)
        };
    }

    // 🆕 ТОПОЛОГИЧЕСКИЙ АНАЛИЗ (пространственные связи)
    analyzeTopology(predictions) {
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
       
        return {
            spatialDistribution: this.analyzeSpatialDistribution(protectors),
            clusterAnalysis: this.performClusterAnalysis(protectors),
            connectivity: this.analyzeConnectivity(protectors),
            patternRegularity: this.analyzePatternRegularity(protectors)
        };
    }

    // 📊 ОБНОВЛЕННЫЙ СВОДНЫЙ ОТЧЕТ
    generateAnalysisSummary(topography, morphology, topology) {
        return {
            orientation: `${topography.orientation.angle.toFixed(1)}°`,
            confidence: `${(topography.orientation.confidence * 100).toFixed(1)}%`,
            footprintType: topography.geometry.footprintType,
            sizeEstimation: topography.geometry.sizeEstimation,
            morphology: this.getMorphologyDescription(morphology),
            topology: this.getTopologyDescription(topology),
            recommendations: this.generateRecommendations(topography, morphology, topology)
        };
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (заглушки для реализации)
    analyzeOutlineShape(outlines) {
        if (outlines.length === 0) return { shape: "неопределен", complexity: 0 };
        return { shape: "овальная", complexity: 0.7 };
    }

    analyzeProtectorPattern(protectors) {
        return {
            type: protectors.length > 10 ? "плотный" : "редкий",
            density: protectors.length,
            arrangement: "случайный"
        };
    }

    analyzeSymmetry(predictions) {
        return { score: 0.65, confidence: 0.6 };
    }

    calculateComplexity(predictions) {
        return predictions.length > 15 ? "высокая" : "средняя";
    }

    analyzeSpatialDistribution(protectors) {
        return { type: "кластерный", density: "неравномерная" };
    }

    performClusterAnalysis(protectors) {
        return { clusters: protectors.length > 10 ? 3 : 1, separation: "умеренная" };
    }

    analyzeConnectivity(protectors) {
        return { connectivity: "слабая", paths: 2 };
    }

    analyzePatternRegularity(protectors) {
        return { regularity: 0.5, periodicity: "низкая" };
    }

    getMorphologyDescription(morphology) {
        return `${morphology.outlineShape.shape} форма, ${morphology.protectorPattern.type} протектор`;
    }

    getTopologyDescription(topology) {
        return `${topology.spatialDistribution.type} распределение, ${topology.clusterAnalysis.clusters} кластера`;
    }

    generateRecommendations(topography, morphology, topology) {
        const recs = [];
       
        if (topography.orientation.confidence < 0.5) {
            recs.push("📷 Сфотографируйте след под прямым углом");
        }
       
        if (morphology.complexity === "низкая") {
            recs.push("🔍 Убедитесь, что все детали протектора видны");
        }
       
        return recs.length > 0 ? recs : ["✅ Качество анализа хорошее"];
    }
}

module.exports = { AnalysisModule };
