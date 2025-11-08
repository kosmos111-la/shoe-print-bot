const RoboflowClient = require('./roboflow-client');
const PostProcessor = require('./post-processing');

let analysisModule = null;

module.exports = {
    initialize(roboflowConfig) {
        analysisModule = {
            roboflow: new RoboflowClient(roboflowConfig),
            postprocessor: new PostProcessor()
        };
       
        console.log('✅ Модуль анализа инициализирован');
        return analysisModule;
    },
   
    getModule() {
        return analysisModule;
    }
};
