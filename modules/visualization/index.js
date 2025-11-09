const AnalysisVisualization = require('./analysis-viz');
const TopologyVisualization = require('./topology-viz');
const MaskStyleVisualization = require('./mask-viz');

class VisualizationModule {
    constructor() {
        console.log('🎨 Инициализация модуля визуализации...');
       
        // ВСЕ НАСТРОЙКИ ВНУТРИ МОДУЛЯ - НИКАКИХ ВНЕШНИХ ЗАВИСИМОСТЕЙ
        this.defaultStyle = 'original';
        this.userPreferences = new Map(); // userId -> style
       
        // ИНИЦИАЛИЗАЦИЯ СТИЛЕЙ С ЗАЩИТОЙ ОТ ОШИБОК
        this.styles = this.initializeStyles();
       
        console.log('✅ Модуль визуализации готов. Стили:', Object.keys(this.styles));
    }

    initializeStyles() {
        const styles = {};
       
        try {
            styles['original'] = {
                analysis: new AnalysisVisualization(),
                topology: new TopologyVisualization()
            };
            console.log('✅ Оригинальный стиль загружен');
        } catch (error) {
            console.log('❌ Ошибка загрузки оригинального стиля:', error.message);
            styles['original'] = this.createFallbackVisualization();
        }
       
        try {
            styles['mask'] = {
                analysis: new MaskStyleVisualization(),
                topology: new MaskStyleVisualization()
            };
            console.log('✅ Стиль маски загружен');
        } catch (error) {
            console.log('❌ Ошибка загрузки стиля маски:', error.message);
            // Если mask не загрузился, используем оригинальный как fallback
            styles['mask'] = styles['original'] || this.createFallbackVisualization();
        }
       
        return styles;
    }

    createFallbackVisualization() {
        // АВАРИЙНЫЙ FALLBACK ЕСЛИ ВСЕ СЛОМАЛОСЬ
        console.log('⚠️ Создаю аварийный fallback модуль');
        return {
            analysis: {
                createVisualization: async () => {
                    console.log('🆘 Используется fallback визуализация');
                    return null;
                }
            },
            topology: {
                createVisualization: async () => {
                    console.log('🆘 Используется fallback топология');
                    return null;
                }
            }
        };
    }

    initialize() {
        // Уже проинициализировано в конструкторе
        return this;
    }

    // 🔒 ЗАЩИЩЕННЫЕ МЕТОДЫ С ПРОВЕРКАМИ
    getUserStyle(userId) {
        if (!userId) return this.defaultStyle;
        return this.userPreferences.get(String(userId)) || this.defaultStyle;
    }

    setUserStyle(userId, style) {
        try {
            if (!userId || !style) {
                console.log('❌ setUserStyle: неверные параметры');
                return false;
            }
           
            if (!this.styles[style]) {
                console.log(`❌ setUserStyle: стиль "${style}" не существует`);
                return false;
            }
           
            this.userPreferences.set(String(userId), style);
            console.log(`✅ Пользователь ${userId} установил стиль: ${style}`);
            return true;
           
        } catch (error) {
            console.log('❌ Ошибка в setUserStyle:', error.message);
            return false;
        }
    }

    getVisualization(userId, type = 'analysis') {
        try {
            const style = this.getUserStyle(userId);
           
            if (!this.styles[style]) {
                console.log(`⚠️ Стиль ${style} не найден, использую default`);
                return this.styles[this.defaultStyle][type] || this.styles[this.defaultStyle].analysis;
            }
           
            const vizModule = this.styles[style][type];
            if (!vizModule) {
                console.log(`⚠️ Модуль ${type} для стиля ${style} не найден, использую analysis`);
                return this.styles[style].analysis;
            }
           
            return vizModule;
           
        } catch (error) {
            console.log('❌ Ошибка в getVisualization:', error.message);
            return this.styles[this.defaultStyle].analysis;
        }
    }

    getAvailableStyles() {
        try {
            return [
                {
                    id: 'original',
                    name: '🎨 Оригинальный стиль',
                    description: 'Цветная визуализация с разными цветами для классов'
                },
                {
                    id: 'mask',
                    name: '🖤 Стиль маски',
                    description: 'Черные линии на полупрозрачном фоне'
                }
            ];
        } catch (error) {
            console.log('❌ Ошибка в getAvailableStyles:', error.message);
            return [{ id: 'original', name: 'Оригинальный', description: 'Основной стиль' }];
        }
    }
}

// 🚀 СРАЗУ СОЗДАЕМ ЭКЗЕМПЛЯР - НИКАКОЙ ЛАЗИ ДИНАМИЧЕСКОЙ
module.exports = new VisualizationModule();
