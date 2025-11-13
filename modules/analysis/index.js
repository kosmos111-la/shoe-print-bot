// modules/analysis/index.js
const { TopographyAnalyzer } = require('./topography-analyzer');
// Будущие модули:
// const { MorphologyAnalyzer } = require('./morphology-analyzer');
// const { StatisticalAnalyzer } = require('./statistical-analyzer');

class AnalysisModule {
    constructor() {
        this.topographyAnalyzer = new TopographyAnalyzer();
        // this.morphologyAnalyzer = new MorphologyAnalyzer();
        // this.statisticalAnalyzer = new StatisticalAnalyzer();
       
        console.log('📊 Модуль анализа инициализирован');
    }

    /**
     * ГЛАВНЫЙ МЕТОД АНАЛИЗА - объединяет все виды анализа
     */
    async performComprehensiveAnalysis(imagePath, predictions, userContext = {}) {
        try {
            console.log('🎯 Запускаю комплексный анализ...');
           
            // 🗺️ 1. Топографический анализ
            const topography = await this.topographyAnalyzer.analyzeFootprintTopography(
                imagePath, predictions, userContext
            );
           
            // 🔷 2. Морфологический анализ (будет добавлен)
            // const morphology = await this.morphologyAnalyzer.analyzeMorphology(...);
           
            // 📈 3. Статистический анализ (будет добавлен) 
            // const statistics = await this.statisticalAnalyzer.analyzeStatistics(...);
           
            const result = {
                topography,
                // morphology,
                // statistics,
                summary: this.generateAnalysisSummary(topography),
                timestamp: new Date().toISOString(),
                analysisId: `analysis_${Date.now()}`
            };
           
            console.log('✅ Комплексный анализ завершен');
            return result;
           
        } catch (error) {
            console.log('❌ Ошибка комплексного анализа:', error);
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
            footprintType: this.classifyFootprintType(topography),
            sizeEstimation: this.estimateSize(topography),
            recommendations: this.generateRecommendations(topography)
        };
    }

    classifyFootprintType(topography) {
        const aspectRatio = topography.geometry.aspectRatio;
        if (aspectRatio > 2.5) return "👟 Спортивная обувь";
        if (aspectRatio > 2.0) return "🥾 Уличная обувь";
        return "👞 Формальная обувь";
    }

    estimateSize(topography) {
        const area = topography.geometry.area;
        // Упрощенная оценка размера по площади
        if (area > 0.3) return "43-45";
        if (area > 0.2) return "40-42";
        return "37-39";
    }

    generateRecommendations(topography) {
        const recommendations = [];
       
        if (topography.orientation.confidence < 0.7) {
            recommendations.push("📷 Сфотографируйте след под прямым углом для точного анализа");
        }
       
        if (topography.geometry.aspectRatio < 1.5) {
            recommendations.push("🔍 Проверьте, полностью ли след попал в кадр");
        }
       
        return recommendations.length > 0 ? recommendations : ["✅ Качество анализа хорошее"];
    }
}

module.exports = { AnalysisModule };
