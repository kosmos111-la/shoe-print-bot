const AnalysisVisualization = require('./analysis-viz');
const TopologyVisualization = require('./topology-viz');
const MaskStyleVisualization = require('./mask-viz');
const config = require('../config');

class VisualizationModule {
    constructor() {
        this.styles = {
            'original': {
                analysis: new AnalysisVisualization(),
                topology: new TopologyVisualization()
            },
            'mask': {
                analysis: new MaskStyleVisualization(),
                topology: new MaskStyleVisualization()
            }
        };
       
        // Храним предпочтения пользователей в памяти
        this.userPreferences = new Map();
        this.defaultStyle = config.VISUALIZATION.DEFAULT_STYLE || 'original';
    }

    initialize() {
        console.log('🎨 Модуль визуализации инициализирован');
        console.log('📊 Доступные стили:', Object.keys(this.styles));
        return this;
    }

    // Получить стиль пользователя
    getUserStyle(userId) {
        return this.userPreferences.get(userId) || this.defaultStyle;
    }

    // Установить стиль пользователя
    setUserStyle(userId, style) {
        if (this.styles[style]) {
            this.userPreferences.set(userId, style);
            console.log(`🎨 Пользователь ${userId} установил стиль: ${style}`);
            return true;
        }
        return false;
    }

    // Получить модуль визуализации для пользователя
    getVisualization(userId, type = 'analysis') {
        const style = this.getUserStyle(userId);
        const vizModule = this.styles[style][type];
       
        if (!vizModule) {
            console.log(`❌ Нет модуля ${type} для стиля ${style}, использую оригинальный`);
            return this.styles.original[type];
        }
       
        return vizModule;
    }

    // Список доступных стилей
    getAvailableStyles() {
        return [
            {
                id: 'original',
                name: '🎨 Оригинальный стиль',
                description: 'Цветная визуализация с разными цветами для классов'
            },
            {
                id: 'mask',
                name: '🖤 Стиль маски',
                description: 'Черные линии на полупрозрачном фоне: толстый пунктир для контура, тонкие линии для морфологии'
            }
        ];
    }
}

module.exports = new VisualizationModule();
