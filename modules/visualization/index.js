const AnalysisVisualizer = require('./analysis-viz');
const TopologyVisualizer = require('./topology-viz');

let visualizationModule = null;

module.exports = {
    initialize() {
        visualizationModule = {
            analysis: new AnalysisVisualizer(),
            topology: new TopologyVisualizer()
        };
       
        console.log('✅ Модуль визуализации инициализирован');
        return visualizationModule;
    },
   
    getModule() {
        return visualizationModule;
    }
};
