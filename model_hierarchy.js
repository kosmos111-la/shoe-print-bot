// =============================================================================
// 🏔️ ПЕРЕВЕРНУТАЯ ПИРАМИДА - ИЕРАРХИЧЕСКАЯ СИСТЕМА УТОЧНЕНИЯ
// =============================================================================

const { FootprintAssembler } = require('./bot'); // Или правильный путь

class ModelHierarchy {
    constructor(trailSession) {
        this.session = trailSession;
        
        // Используем глобальный экземпляр из bot.js
        try {
            this.assembler = global.footprintAssembler || require('../bot').footprintAssembler;
        } catch (error) {
            console.log('❌ Не удалось получить assembler, создаем новый');
            this.assembler = new (require('./footprint_assembler').FootprintAssembler)();
        }
        this.levels = {
            rawFootprints: [],      // Уровень 1: сырые следы
            candidateGroups: [],    // Уровень 2: группы-кандидаты 
            activeModels: [],       // Уровень 3: активные модели
            finalModels: []         // Уровень 6: финальные модели
        };
        this.orphanFootprints = []; // Не распределенные следы
        this.stats = {
            modelsMerged: 0,
            orphansAdopted: 0,
            conflictsResolved: 0
        };
    }
   
    /**
     * Основной процесс иерархической обработки
     */
    async processHierarchy() {
        console.log("🏔️ Запуск перевернутой пирамиды...");
       
        try {
            // УРОВЕНЬ 1: Сырые данные
            this.levels.rawFootprints = [...this.session.footprints];
            console.log(`📥 Уровень 1: ${this.levels.rawFootprints.length} сырых следов`);
           
            // УРОВЕНЬ 2: Первичная группировка
            await this.primaryGrouping();
           
            // УРОВЕНЬ 3: Сборка моделей-кандидатов
            await this.buildCandidateModels();
           
            // УРОВЕНЬ 4: Конкуренция и объединение моделей
            await this.modelCompetition();
           
            // УРОВЕНЬ 5: Добор остатков
            await this.orphanAdoption();
           
            // УРОВЕНЬ 6: Финальная оптимизация
            await this.finalOptimization();
           
            console.log(`🎯 Пирамида завершена: ${this.levels.finalModels.length} финальных моделей`);
            return this.levels.finalModels;
           
        } catch (error) {
            console.error('❌ Ошибка в пирамиде:', error);
            return [];
        }
    }

    /**
     * Уровень 2: Первичная группировка следов
     */
    async primaryGrouping() {
        console.log("🔍 Уровень 2: Первичная группировка...");
       
        this.levels.candidateGroups = [];
        const usedFootprints = new Set();
       
        // Проходим по всем следам и создаем группы-кандидаты
        this.levels.rawFootprints.forEach(footprint => {
            if (usedFootprints.has(footprint.id)) return;
           
            const group = [footprint];
            usedFootprints.add(footprint.id);
           
            // Ищем похожие следы для этой группы
            this.levels.rawFootprints.forEach(otherFootprint => {
                if (usedFootprints.has(otherFootprint.id)) return;
                if (footprint.id === otherFootprint.id) return;
               
                const similarity = this.calculateFootprintsSimilarity(footprint, otherFootprint);
                if (similarity > 0.6) {
                    group.push(otherFootprint);
                    usedFootprints.add(otherFootprint.id);
                }
            });
           
            if (group.length > 0) {
                this.levels.candidateGroups.push(group);
            }
        });
       
        // Не распределенные следы становятся "сиротами"
        this.orphanFootprints = this.levels.rawFootprints.filter(
            f => !usedFootprints.has(f.id)
        );
       
        console.log(`📊 Уровень 2: ${this.levels.candidateGroups.length} групп, ${this.orphanFootprints.length} сирот`);
    }

    /**
     * Уровень 3: Сборка моделей-кандидатов из групп
     */
    async buildCandidateModels() {
        console.log("🧩 Уровень 3: Сборка моделей-кандидатов...");
       
        this.levels.activeModels = [];
       
        for (let group of this.levels.candidateGroups) {
            if (group.length < 2) continue; // Пропускаем одиночные группы
           
            try {
                const imageWidth = 800, imageHeight = 600; // Можно получить из первого следа
                const result = this.assembler.assembleFullModel(group, imageWidth, imageHeight);
               
                if (result.success) {
                    const model = {
                        id: `model_${this.levels.activeModels.length + 1}`,
                        footprints: result.usedPrints,
                        completeness: result.completeness,
                        confidence: result.confidence,
                        features: this.aggregateModelFeatures(result.usedPrints),
                        assembledAt: new Date()
                    };
                   
                    this.levels.activeModels.push(model);
                    console.log(`✅ Собрана модель ${model.id}: ${result.completeness}% полноты`);
                }
            } catch (error) {
                console.log(`❌ Ошибка сборки модели для группы:`, error.message);
            }
        }
       
        console.log(`📊 Уровень 3: ${this.levels.activeModels.length} активных моделей`);
    }

    /**
     * Уровень 4: Конкуренция и объединение моделей
     */
    async modelCompetition() {
        console.log("⚔️ Уровень 4: Конкуренция моделей...");
       
        let models = [...this.levels.activeModels];
        let changed = true;
        let iteration = 0;
       
        while (changed && iteration < 10) { // Защита от бесконечного цикла
            changed = false;
            iteration++;
           
            for (let i = 0; i < models.length; i++) {
                for (let j = i + 1; j < models.length; j++) {
                    const similarity = await this.compareModels(models[i], models[j]);
                   
                    if (similarity > 0.8) {
                        // 🎯 ВЫСОКАЯ СХОЖЕСТЬ - ОБЪЕДИНЯЕМ!
                        console.log(`🔗 Объединяем модели ${i} и ${j} (${similarity}%)`);
                        models[i] = this.mergeModels(models[i], models[j]);
                        models.splice(j, 1);
                        this.stats.modelsMerged++;
                        changed = true;
                        break;
                    }
                }
                if (changed) break;
            }
        }
       
        this.levels.activeModels = models;
        console.log(`📊 Уровень 4: Объединено в ${models.length} моделей`);
    }

    /**
     * Уровень 5: Добор "сиротских" следов
     */
    async orphanAdoption() {
        console.log("🏠 Уровень 5: Добор сиротских следов...");
       
        const adopted = [];
       
        for (let orphan of this.orphanFootprints) {
            let bestModelIndex = -1;
            let bestScore = 0.6; // Минимальный порог
           
            for (let i = 0; i < this.levels.activeModels.length; i++) {
                const score = await this.footprintToModelSimilarity(orphan, this.levels.activeModels[i]);
                if (score > bestScore) {
                    bestScore = score;
                    bestModelIndex = i;
                }
            }
           
            if (bestModelIndex !== -1) {
                // ✅ След нашел свою модель!
                this.levels.activeModels[bestModelIndex].footprints.push(orphan);
                adopted.push(orphan);
                this.stats.orphansAdopted++;
                console.log(`✅ След добавлен в модель (схожесть: ${bestScore}%)`);
            }
        }
       
        // Убираем усыновленные следы
        this.orphanFootprints = this.orphanFootprints.filter(f => !adopted.includes(f));
        console.log(`📊 Уровень 5: Усыновлено ${adopted.length} следов`);
    }

    /**
     * Уровень 6: Финальная оптимизация
     */
    async finalOptimization() {
        console.log("🎯 Уровень 6: Финальная оптимизация...");
       
        // Пересобираем модели с учетом новых следов
        for (let model of this.levels.activeModels) {
            if (model.footprints.length >= 2) {
                try {
                    const imageWidth = 800, imageHeight = 600;
                    const result = this.assembler.assembleFullModel(model.footprints, imageWidth, imageHeight);
                   
                    if (result.success) {
                        model.completeness = result.completeness;
                        model.confidence = result.confidence;
                        model.features = this.aggregateModelFeatures(result.usedPrints);
                    }
                } catch (error) {
                    console.log(`❌ Ошибка пересборки модели:`, error.message);
                }
            }
        }
       
        this.levels.finalModels = this.levels.activeModels;
        console.log(`📊 Уровень 6: ${this.levels.finalModels.length} финальных моделей`);
    }

    // =============================================================================
    // 🛠️ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // =============================================================================

    /**
     * Сравнение двух следов
     */
    calculateFootprintsSimilarity(footprintA, footprintB) {
        try {
            const imageWidth = 800, imageHeight = 600;
            return this.assembler.advancedCompatibilityAnalysis(
                [footprintA],
                footprintB,
                imageWidth,
                imageHeight
            ) ? 0.8 : 0.2;
        } catch (error) {
            console.log('❌ Ошибка сравнения следов:', error.message);
            return 0;
        }
    }

    /**
     * Сравнение двух моделей
     */
    async compareModels(modelA, modelB) {
        // Упрощенное сравнение через средние features
        const featuresA = modelA.features;
        const featuresB = modelB.features;
       
        if (!featuresA || !featuresB) return 0;
       
        const detailSimilarity = 1 - Math.abs(featuresA.detailCount - featuresB.detailCount) /
            Math.max(featuresA.detailCount, featuresB.detailCount);
       
        const densitySimilarity = 1 - Math.abs(featuresA.density - featuresB.density) /
            Math.max(featuresA.density, featuresB.density);
           
        return (detailSimilarity + densitySimilarity) / 2;
    }

    /**
     * Объединение двух моделей
     */
    mergeModels(modelA, modelB) {
        const mergedFootprints = [...modelA.footprints, ...modelB.footprints];
        const uniqueFootprints = mergedFootprints.filter((footprint, index, self) =>
            index === self.findIndex(f => f.id === footprint.id)
        );
       
        return {
            id: `merged_${modelA.id}_${modelB.id}`,
            footprints: uniqueFootprints,
            completeness: Math.max(modelA.completeness, modelB.completeness),
            confidence: (modelA.confidence + modelB.confidence) / 2,
            features: this.aggregateModelFeatures(uniqueFootprints),
            assembledAt: new Date(),
            sourceModels: [modelA.id, modelB.id]
        };
    }

    /**
     * Сравнение следа с моделью
     */
    async footprintToModelSimilarity(footprint, model) {
        // Сравниваем след с каждым следом в модели и берем среднее
        let totalSimilarity = 0;
        let comparisonCount = 0;
       
        for (let modelFootprint of model.footprints) {
            const similarity = this.calculateFootprintsSimilarity(footprint, modelFootprint);
            totalSimilarity += similarity;
            comparisonCount++;
        }
       
        return comparisonCount > 0 ? totalSimilarity / comparisonCount : 0;
    }

    /**
     * Агрегация features модели из следов
     */
    aggregateModelFeatures(footprints) {
        const totalDetails = footprints.reduce((sum, f) => sum + (f.features?.detailCount || 0), 0);
        const totalDensity = footprints.reduce((sum, f) => sum + (f.features?.density || 0), 0);
       
        return {
            detailCount: totalDetails,
            density: footprints.length > 0 ? totalDensity / footprints.length : 0,
            footprintCount: footprints.length
        };
    }

    /**
     * Получить статистику пирамиды
     */
    getStats() {
        return {
            ...this.stats,
            levels: {
                raw: this.levels.rawFootprints.length,
                candidates: this.levels.candidateGroups.length,
                active: this.levels.activeModels.length,
                final: this.levels.finalModels.length,
                orphans: this.orphanFootprints.length
            }
        };
    }
}

module.exports = { ModelHierarchy };
