module.exports = {
    initialize() {
        console.log('✅ Модуль визуализации инициализирован');
        return {
            analysis: { createVisualization: () => {} },
            topology: { createVisualization: () => {} }
        };
    }
};
