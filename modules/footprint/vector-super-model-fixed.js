// modules/footprint/vector-super-model-fixed.js
const TemplateBuilderFixed = require('./template-builder-fixed');

class VectorSuperModelFixed {
    constructor(options = {}) {
        this.id = `vsm_fixed_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблонная супер-модель (исправленная)';
       
        // 🔥 ИСПОЛЬЗУЕМ ИСПРАВЛЕННЫЙ TEMPLATE BUILDER
        this.templateBuilder = new TemplateBuilderFixed({
            name: `Шаблон_${this.name}`,
            cellSize: options.cellSize || 25,
            debug: options.debug || false
        });
       
        // Статистика
        this.stats = {
            totalMerges: 0,
            totalGraphsAdded: 0,
            confidence: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log(`🏗️ Создана исправленная супер-модель "${this.name}"`);
    }
   
    // 🔥 ДОБАВИТЬ ГРАФ
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} в исправленную модель...`);
       
        // 🔥 ИСПОЛЬЗУЕМ ИСПРАВЛЕННЫЙ TEMPLATE BUILDER
        let addedToTemplate = false;
       
        if (this.templateBuilder.referenceGraphId === null) {
            console.log(`🎯 Устанавливаю граф ${graphId} как эталон`);
            addedToTemplate = this.templateBuilder.setReferenceGraph(graph, graphId);
        } else {
            console.log(`📊 Добавляю граф ${graphId} к существующему шаблону`);
            addedToTemplate = this.templateBuilder.addGraph(graph, graphId, metadata);
        }
       
        if (!addedToTemplate) {
            console.log(`⚠️ Граф ${graphId} не добавлен`);
            return false;
        }
       
        // Обновить статистику
        this.stats.totalMerges++;
        this.stats.totalGraphsAdded++;
        this.stats.lastUpdated = new Date();
        this.updateStats();
       
        // Получить информацию
        const templateInfo = this.templateBuilder.getInfo();
       
        console.log(`✅ Граф добавлен. Статистика:`);
        console.log(`   Ячеек: ${templateInfo.templateCells}`);
        console.log(`   Подтвержденных: ${templateInfo.stats.confirmedCells}`);
        console.log(`   Уверенность модели: ${(this.stats.confidence * 100).toFixed(1)}%`);
       
        return true;
    }
   
    // 🔥 ОБНОВИТЬ СТАТИСТИКУ
    updateStats() {
        const templateInfo = this.templateBuilder.getInfo();
       
        if (!templateInfo || templateInfo.templateCells === 0) {
            this.stats.confidence = 0;
            return;
        }
       
        const confirmedRatio = templateInfo.stats.confirmedCells / templateInfo.templateCells;
        const avgConfirmations = templateInfo.stats.avgConfirmations || 0;
       
        // Простая формула уверенности
        const templateQuality = Math.min(1,
            confirmedRatio * 0.7 + // 70% за долю подтвержденных ячеек
            Math.min(0.3, avgConfirmations * 0.15) // 30% за среднее подтверждений
        );
       
        this.stats.confidence = templateQuality;
    }
   
    // 🔥 ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
    getVisualizationData() {
        const templateData = this.templateBuilder.getVisualizationData();
       
        return {
            ...templateData,
            metadata: {
                id: this.id,
                name: this.name,
                merges: this.stats.totalMerges,
                createdAt: this.stats.createdAt,
                confidence: this.stats.confidence,
                visualizationMethod: 'fixed_template'
            }
        };
    }
   
    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ ШАБЛОНА
    getTemplateStats() {
        if (!this.templateBuilder) return null;
       
        const templateInfo = this.templateBuilder.getInfo();
       
        return {
            templateId: this.templateBuilder.id,
            cells: {
                total: templateInfo.templateCells,
                confirmed: templateInfo.stats.confirmedCells,
                highConfidence: templateInfo.stats.highConfidenceCells,
                avgConfirmations: templateInfo.stats.avgConfirmations?.toFixed(2) || '0.00'
            },
            referenceGraphId: this.templateBuilder.referenceGraphId,
            alignmentStats: {
                totalGraphs: templateInfo.stats.totalGraphs
            }
        };
    }
   
    // 🔥 ПОЛУЧИТЬ ИНФОРМАЦИЮ
    getInfo() {
        const templateStats = this.getTemplateStats();
       
        return {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                confidence: Math.round(this.stats.confidence * 1000) / 1000,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU')
            },
            template: templateStats,
            hasTemplate: !!this.templateBuilder.referenceGraphId
        };
    }
   
    // 🔥 СОХРАНИТЬ В JSON
    toJSON() {
        const data = {
            id: this.id,
            name: this.name,
            stats: this.stats,
            _version: '2.0_fixed',
            _savedAt: new Date().toISOString()
        };
       
        if (this.templateBuilder) {
            data.templateBuilder = this.templateBuilder.toJSON();
        }
       
        return data;
    }
   
    // 🔥 ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        const model = new VectorSuperModelFixed({
            name: data.name
        });
       
        model.id = data.id || model.id;
        model.stats = data.stats || model.stats;
       
        // Восстанавливаем TemplateBuilder
        if (data.templateBuilder) {
            try {
                model.templateBuilder = TemplateBuilderFixed.fromJSON(data.templateBuilder);
                console.log(`📂 Восстановлен исправленный TemplateBuilder`);
            } catch (error) {
                console.log(`⚠️ Ошибка восстановления:`, error.message);
                model.templateBuilder = new TemplateBuilderFixed({ name: model.name });
            }
        }
       
        // Восстановить даты
        if (model.stats.createdAt && typeof model.stats.createdAt === 'string') {
            model.stats.createdAt = new Date(model.stats.createdAt);
        }
        if (model.stats.lastUpdated && typeof model.stats.lastUpdated === 'string') {
            model.stats.lastUpdated = new Date(model.stats.lastUpdated);
        }
       
        console.log(`📂 Загружена исправленная супер-модель "${model.name}"`);
       
        return model;
    }
}

module.exports = VectorSuperModelFixed;
