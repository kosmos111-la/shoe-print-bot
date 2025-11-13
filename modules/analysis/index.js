// modules/analysis/index.js
const { TopographyAnalyzer } = require('./topography-analyzer');

class AnalysisModule {
    constructor() {
        this.topographyAnalyzer = new TopographyAnalyzer();
        console.log('📊 Модуль анализа инициализирован');
    }

    /**
     * ГЛАВНЫЙ МЕТОД АНАЛИЗА
     */
    async performComprehensiveAnalysis(imagePath, predictions, userContext = {}) {
        try {
            console.log('🎯 Запускаю анализ...');
           
            // 🗺️ Топографический анализ
            const topography = await this.topographyAnalyzer.analyzeFootprintTopography(
                imagePath, predictions, userContext
            );
           
            const result = {
                topography,
                summary: this.generateAnalysisSummary(topography),
                timestamp: new Date().toISOString(),
                analysisId: `analysis_${Date.now()}`
            };
           
            console.log('✅ Анализ завершен');
            return result;
           
        } catch (error) {
            console.log('❌ Ошибка анализа:', error);
            throw error;
        }
    }

    /**
     * Генерация краткого отчета для пользователя
     */
    generateAnalysisSummary(topography) {
        return {
            orientation: `${topography.orientation.angle.toFixed(1)}°`,
            confidence: `${(topography.orientation.confidence * 100).toFixed(1)}%`,
            footprintType: topography.geometry.footprintType,
            sizeEstimation: topography.geometry.sizeEstimation,
            recommendations: this.generateRecommendations(topography)
        };
    }

    generateRecommendations(topography) {
        const recommendations = [];
       
        if (topography.orientation.confidence < 0.5) {
            recommendations.push("📷 Сфотографируйте след под прямым углом");
        }
       
        if (topography.geometry.aspectRatio < 1.2) {
            recommendations.push("🔍 Убедитесь, что след полностью в кадре");
        }
       
        return recommendations.length > 0 ? recommendations : ["✅ Качество анализа хорошее"];
    }
}

module.exports = { AnalysisModule };
