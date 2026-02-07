// modules/footprint/core/visualization/visualization-manager.js
// 🔥 ИСПРАВЛЕННЫЙ МЕНЕДЖЕР ВИЗУАЛИЗАЦИЙ - С УЧЕТОМ СОВПАДЕНИЙ

const path = require('path');
const fs = require('fs');

class VisualizationManager {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Визуализация подтверждений с учетом совпадений
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        console.log(`🎨 Визуализация подтверждений для "${footprint.name}"...`);

        try {
            const ClusterVisualizer = require('../../visualizations/cluster-visualizer');
            const visualizer = new ClusterVisualizer({
                outputDir: path.join(this.config.dbPath, 'visualizations/clusters'),
                debug: this.config.debug
            });

            // 🔥 ПОЛУЧАЕМ ИНФОРМАЦИЮ О СОВПАДЕНИЯХ ИЗ МЕНЕДЖЕРА
            const vectorModel = this.manager.getVectorSuperModel(userId);
            let matchInfo = null;
           
            if (vectorModel && vectorModel.templateBuilder) {
                // Получаем статистику совпадений из шаблона
                const templateInfo = vectorModel.templateBuilder.getInfo();
                matchInfo = {
                    totalConfirmations: templateInfo.stats?.totalConfirmations || 0,
                    confirmedCells: templateInfo.stats?.confirmedCells || 0,
                    averageConfirmations: templateInfo.stats?.averageConfirmations || 0,
                    totalGraphs: templateInfo.stats?.totalGraphs || 0
                };
               
                console.log(`📊 Данные о совпадениях из шаблона:`, matchInfo);
            }

            // 🔥 ПЕРЕДАЕМ ИНФОРМАЦИЮ О СОВПАДЕНИЯХ
            const vizResult = await visualizer.visualizeSingleFootprintConfirmations(
                footprint,
                {
                    filename: `real_confirmations_${userId}_${Date.now()}.png`,
                    transformationInfo: transformationInfo,
                    matchInfo: matchInfo // 🔥 ПЕРЕДАЕМ ДАННЫЕ О СОВПАДЕНИЯХ
                }
            );

            if (vizResult && vizResult.path) {
                console.log(`✅ Визуализация создана: ${vizResult.path}`);

                if (fs.existsSync(vizResult.path)) {
                    const stats = fs.statSync(vizResult.path);
                    console.log(`📊 Размер файла: ${stats.size} байт`);
                } else {
                    console.log(`⚠️ Файл не найден: ${vizResult.path}`);
                }
            } else {
                console.log(`⚠️ Визуализация не создана или результат пустой`);
            }

            return vizResult;

        } catch (error) {
            console.log('❌ Ошибка визуализации:', error.message);
            console.error(error.stack);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Визуализация сравнения двух следов
    async visualizeFootprintComparison(footprint1, footprint2, userId, comparisonResult) {
        console.log(`🎨 Визуализация сравнения "${footprint1.name}" vs "${footprint2.name}"...`);

        try {
            const ClusterVisualizer = require('../../visualizations/cluster-visualizer');
            const visualizer = new ClusterVisualizer({
                outputDir: path.join(this.config.dbPath, 'visualizations/comparisons'),
                debug: this.config.debug
            });

            const vizResult = await visualizer.visualizeComparison(
                footprint1,
                footprint2,
                {
                    filename: `comparison_${footprint1.id}_${footprint2.id}_${Date.now()}.png`,
                    comparisonResult: comparisonResult,
                    showMatches: true
                }
            );

            return vizResult;

        } catch (error) {
            console.log('❌ Ошибка визуализации сравнения:', error.message);
            return null;
        }
    }

    // 🔥 ИСПРАВЛЕННАЯ ВИЗУАЛИЗАЦИЯ ШАБЛОНА
    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) return null;

            let templateData = vectorModel.templateBuilder.getVisualizationData();

            if (!templateData || !templateData.cells || templateData.cells.length === 0) {
                if (vectorModel.templateBuilder) {
                    templateData = vectorModel.templateBuilder.getVisualizationData();
                }
            }

            const TemplateVisualizer = require('../../template-visualizer');
            const templateVisualizer = new TemplateVisualizer({
                outputDir: path.join(this.config.dbPath, 'visualizations/templates'),
                debug: this.config.debug
            });

            const result = await templateVisualizer.visualizeTemplate(templateData, {
                filename: `template_${userId}_${Date.now()}.png`
            });

            const heatmapResult = await templateVisualizer.createHeatmap(templateData, {
                filename: `heatmap_${userId}_${Date.now()}.png`
            });

            let heatmapPath = heatmapResult;
            if (heatmapResult && typeof heatmapResult === 'object' && heatmapResult.path) {
                heatmapPath = heatmapResult.path;
            }

            return {
                template: result.path,
                heatmap: heatmapPath,
                stats: templateData?.stats,
                templateId: templateData?.templateId
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            return null;
        }
    }

    // 🔥 ДЕБАГ ВИЗУАЛИЗАЦИЙ
    debugVisualizations(userId) {
        const session = this.manager.userSessions.get(userId);
        if (!session) {
            console.log('❌ Нет сессии для дебага визуализаций');
            return;
        }

        console.log('\n🔍 ДЕБАГ ВИЗУАЛИЗАЦИЙ:');
        console.log(`Сессия: ${session.id.slice(0, 8)}`);
        console.log(`Фото в сессии: ${session.photos.length}`);

        // Проверяем директории визуализаций
        const vizDirs = [
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/clusters'),
            path.join(this.config.dbPath, 'visualizations/templates'),
            path.join(this.config.dbPath, 'visualizations/comparisons'),
            path.join(this.config.dbPath, 'visualizations/alignments')
        ];

        vizDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
                console.log(`📁 ${dir}: ${files.length} файлов`);
            } else {
                console.log(`❌ Директория не существует: ${dir}`);
            }
        });
    }
}

module.exports = VisualizationManager;
