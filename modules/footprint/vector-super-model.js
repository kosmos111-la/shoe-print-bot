// modules/footprint/vector-super-model.js
const VectorTemplateBuilder = require('./vector-template-builder');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class VectorSuperModel {
    constructor(options = {}) {
        this.id = options.id || `super_model_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || 'Супер-модель отпечатка';
        this.createdAt = new Date();
        this.lastUpdated = new Date();
        this.userId = options.userId || null;
       
        // Основной строитель шаблонов
        this.templateBuilder = options.templateBuilder || new VectorTemplateBuilder();
       
        // Статистика
        this.stats = {
            totalGraphsProcessed: 0,
            totalGraphsAdded: 0,
            totalMerges: 0,
            totalRejections: 0,
            avgSimilarity: 0,
            templateSize: 0,
            lastGraphAdded: null,
            validationPasses: 0,
            validationFails: 0,
            // 🔥 ДОБАВЛЕНО: Статистика для единой системы координат
            unifiedSystemStats: {
                comparisons: 0,
                matches: 0,
                avgDistance: 0,
                successRate: 0
            }
        };
       
        // История
        this.history = [];
        this.validationResults = [];
        this.rejectionReasons = [];
       
        // Настройки
        this.settings = {
            minSimilarityForMerge: options.minSimilarityForMerge || 0.6,
            maxCells: options.maxCells || 1000,
            minConfirmationsForCell: options.minConfirmationsForCell || 2,
            enableAutoValidation: options.enableAutoValidation !== false,
            debugMode: options.debugMode || false,
            enableClustering: options.enableClustering !== false,
            clusterThreshold: options.clusterThreshold || 30,
            saveInterval: options.saveInterval || 10, // сохранять каждые N операций
            autoSave: options.autoSave !== false,
            // 🔥 ДОБАВЛЕНО: Настройки для единой системы координат
            unifiedSystemThreshold: options.unifiedSystemThreshold || 50, // px
            minMatchPercentage: options.minMatchPercentage || 60, // %
            enableUnifiedSystem: options.enableUnifiedSystem !== false,
            requireUnifiedSystem: options.requireUnifiedSystem || false
        };
       
        // Операционный счетчик
        this.operationCounter = 0;
       
        console.log(`🎯 Создана VectorSuperModel "${this.name}" (ID: ${this.id})`);
    }
   
    // 🔥 НОВЫЙ МЕТОД: Сравнить точки в единой системе координат
    comparePointsInUnifiedSystem(newPoints, templatePoints) {
        console.log(`🎯 [UNIFIED-COMPARE] Сравниваю точки в ЕДИНОЙ системе координат`);
        console.log(`   Новых точек: ${newPoints.length}`);
        console.log(`   Точек в шаблоне: ${templatePoints.length}`);

        if (newPoints.length === 0 || templatePoints.length === 0) {
            console.log('⚠️ Нет точек для сравнения');
            return { matches: 0, percentage: 0, avgDistance: 0 };
        }

        // 🔥 ВАЖНО: Проверяем системы координат
        const sampleNew = newPoints[0];
        const sampleTemplate = templatePoints[0];

        console.log(`📊 Пример координат ДО сравнения:`);
        console.log(`   Новая точка: (${sampleNew.x?.toFixed(1)}, ${sampleNew.y?.toFixed(1)})`);
        console.log(`   Точка шаблона: (${sampleTemplate.x?.toFixed(1)}, ${sampleTemplate.y?.toFixed(1)})`);

        let matchedCount = 0;
        let totalDistance = 0;
        const MATCH_THRESHOLD = this.settings.unifiedSystemThreshold;
        const matchedPairs = [];

        // Для каждой новой точки ищем ближайшую в шаблоне
        newPoints.forEach((newPoint, i) => {
            let minDistance = Infinity;
            let closestTemplatePoint = null;

            templatePoints.forEach(templatePoint => {
                // 🔥 СРАВНИВАЕМ В ОДНОЙ СИСТЕМЕ КООРДИНАТ
                const distance = Math.sqrt(
                    Math.pow(newPoint.x - templatePoint.x, 2) +
                    Math.pow(newPoint.y - templatePoint.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    closestTemplatePoint = templatePoint;
                }
            });

            if (minDistance < MATCH_THRESHOLD) {
                matchedCount++;
                totalDistance += minDistance;
                matchedPairs.push({
                    newPoint,
                    templatePoint: closestTemplatePoint,
                    distance: minDistance
                });

                // Дебаг для первых совпадений
                if (matchedCount <= 3 && this.settings.debugMode) {
                    console.log(`   Совпадение ${matchedCount}: расстояние=${minDistance.toFixed(1)}px`);
                }
            }
        });

        const matchPercentage = (matchedCount / newPoints.length) * 100;
        const avgDistance = matchedCount > 0 ? totalDistance / matchedCount : 0;

        // Обновляем статистику
        this.stats.unifiedSystemStats.comparisons++;
        this.stats.unifiedSystemStats.matches += matchedCount;
        const oldAvg = this.stats.unifiedSystemStats.avgDistance;
        const oldComparisons = this.stats.unifiedSystemStats.comparisons - 1;
       
        this.stats.unifiedSystemStats.avgDistance =
            (oldAvg * oldComparisons + avgDistance) / this.stats.unifiedSystemStats.comparisons;
           
        this.stats.unifiedSystemStats.successRate =
            (this.stats.unifiedSystemStats.matches / (this.stats.unifiedSystemStats.comparisons * Math.max(newPoints.length, 1))) * 100;

        console.log(`📊 РЕЗУЛЬТАТ сравнения в ЕДИНОЙ системе:`);
        console.log(`   Совпадений: ${matchedCount}/${newPoints.length}`);
        console.log(`   Процент: ${matchPercentage.toFixed(1)}%`);
        console.log(`   Среднее расстояние: ${avgDistance.toFixed(1)}px`);
        console.log(`   Порог: <${MATCH_THRESHOLD}px`);

        return {
            matches: matchedCount,
            percentage: matchPercentage,
            avgDistance: avgDistance,
            threshold: MATCH_THRESHOLD,
            totalPoints: newPoints.length,
            matchedPairs: matchedPairs,
            timestamp: new Date()
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки шаблона для сравнения
    getTemplatePointsForComparison() {
        const points = [];

        if (!this.templateBuilder || !this.templateBuilder.invariantCells) {
            return points;
        }

        // Преобразуем ячейки шаблона в точки для сравнения
        for (const [cellId, cell] of this.templateBuilder.invariantCells) {
            // 🔥 ВАЖНО: Преобразуем nx/ny обратно в px для сравнения
            // Предполагаем, что шаблон в диапазоне 200-800
            const targetMin = 200;
            const targetMax = 800;

            const x = targetMin + cell.normalizedCenter.nx * (targetMax - targetMin);
            const y = targetMin + cell.normalizedCenter.ny * (targetMax - targetMin);

            points.push({
                id: cellId,
                x: x,
                y: y,
                nx: cell.normalizedCenter.nx,
                ny: cell.normalizedCenter.ny,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.5,
                source: 'template',
                _fromTemplate: true,
                _cellInfo: {
                    confirmations: cell.confirmations,
                    confidence: cell.confidence,
                    lastUpdated: cell.lastUpdated,
                    totalGraphs: cell.totalGraphs || 1
                }
            });
        }

        if (this.settings.debugMode) {
            console.log(`📊 Получено ${points.length} точек шаблона для сравнения`);
            if (points.length > 0) {
                console.log(`   Диапазон X: ${Math.min(...points.map(p => p.x)).toFixed(1)}-${Math.max(...points.map(p => p.x)).toFixed(1)}`);
                console.log(`   Диапазон Y: ${Math.min(...points.map(p => p.y)).toFixed(1)}-${Math.max(...points.map(p => p.y)).toFixed(1)}`);
            }
        }

        return points;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Добавить граф с проверкой в единой системе
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId}...`);
        this.operationCounter++;

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Если высокая уверенность - принудительное добавление
        if (metadata.similarity && metadata.similarity > 0.9) {
            console.log(`🎯 ВЫСОКАЯ УВЕРЕННОСТЬ ${metadata.similarity.toFixed(3)} - принудительное добавление`);
            return this.addGraphWithForcedConfidence(graph, graphId, metadata);
        }

        // 🔥 ПОЛУЧАЕМ ТОЧКИ В ЕДИНОЙ СИСТЕМЕ КООРДИНАТ
        let newPoints = [];
        if (metadata.sourceFootprint && metadata.sourceFootprint.getPointsForTemplateMatching) {
            newPoints = metadata.sourceFootprint.getPointsForTemplateMatching();
            console.log(`📊 Получено ${newPoints.length} точек в единой системе`);
           
            // Дебаг информации о точках
            if (newPoints.length > 0 && this.settings.debugMode) {
                console.log(`🔍 Диагностика точек из отпечатка:`);
                console.log(`   Диапазон X: ${Math.min(...newPoints.map(p => p.x)).toFixed(1)}-${Math.max(...newPoints.map(p => p.x)).toFixed(1)}`);
                console.log(`   Диапазон Y: ${Math.min(...newPoints.map(p => p.y)).toFixed(1)}-${Math.max(...newPoints.map(p => p.y)).toFixed(1)}`);
                console.log(`   Имеют nx/ny: ${newPoints.filter(p => p.nx && p.ny).length}/${newPoints.length}`);
            }
        } else {
            newPoints = this.templateBuilder.extractPointsFromGraph(graph);
            console.log(`📊 Извлечено ${newPoints.length} точек из графа`);
        }

        if (newPoints.length < 3) {
            console.log(`⚠️ Недостаточно точек: ${newPoints.length}`);
            this.stats.totalRejections++;
            this.rejectionReasons.push({
                graphId,
                reason: 'Недостаточно точек',
                count: newPoints.length,
                timestamp: new Date()
            });
            return false;
        }

        // 🔥 СРАВНИВАЕМ С ШАБЛОНОМ В ЕДИНОЙ СИСТЕМЕ
        const templatePoints = this.getTemplatePointsForComparison();

        if (templatePoints.length === 0) {
            // Первый граф - устанавливаем как эталон
            console.log(`🎯 Первый граф, устанавливаю как эталон`);
            const result = this.templateBuilder.setReferenceGraph(graph, graphId, metadata);
           
            if (result) {
                this.stats.totalGraphsAdded++;
                this.stats.lastGraphAdded = {
                    graphId,
                    timestamp: new Date(),
                    pointsCount: newPoints.length,
                    isReference: true
                };
               
                this.updateStats();
               
                // Записываем в историю
                this.history.push({
                    timestamp: new Date(),
                    graphId,
                    action: 'set_reference',
                    pointsCount: newPoints.length,
                    metadata,
                    unifiedSystem: { isFirst: true }
                });
               
                // Авто-сохранение
                if (this.settings.autoSave && this.operationCounter % this.settings.saveInterval === 0) {
                    this.autoSave();
                }
            }
           
            return result;
        }

        const comparison = this.comparePointsInUnifiedSystem(newPoints, templatePoints);

        // 🔥 ИСПРАВЛЕННЫЙ ПОРОГ: 60% для "same"
        const MIN_MATCH_PERCENTAGE = this.settings.minMatchPercentage;

        console.log(`🎯 Решение о добавлении:`);
        console.log(`   Совпадений: ${comparison.percentage.toFixed(1)}%`);
        console.log(`   Среднее расстояние: ${comparison.avgDistance.toFixed(1)}px`);
        console.log(`   Требуется: >${MIN_MATCH_PERCENTAGE}%`);

        if (comparison.percentage >= MIN_MATCH_PERCENTAGE) {
            console.log(`✅ Достаточно совпадений, добавляю к шаблону`);

            // Добавляем к шаблону
            const added = this.templateBuilder.addGraph(graph, graphId, {
                ...metadata,
                unifiedSystemComparison: comparison
            });

            if (added) {
                this.stats.totalGraphsAdded++;
                this.stats.totalMerges++;
                this.stats.lastGraphAdded = {
                    graphId,
                    timestamp: new Date(),
                    pointsCount: newPoints.length,
                    matchPercentage: comparison.percentage,
                    avgDistance: comparison.avgDistance
                };
               
                this.updateStats();

                // Записываем в историю
                this.history.push({
                    timestamp: new Date(),
                    graphId,
                    action: 'add',
                    comparison: comparison,
                    pointsCount: newPoints.length,
                    metadata,
                    unifiedSystem: {
                        matchPercentage: comparison.percentage,
                        avgDistance: comparison.avgDistance
                    }
                });

                console.log(`📈 Шаблон обновлен: ${this.templateBuilder.invariantCells.size} ячеек`);
               
                // Авто-сохранение
                if (this.settings.autoSave && this.operationCounter % this.settings.saveInterval === 0) {
                    this.autoSave();
                }
               
                return true;
            }
        } else {
            console.log(`⚠️ Недостаточно совпадений: ${comparison.percentage.toFixed(1)}% < ${MIN_MATCH_PERCENTAGE}%`);
            this.stats.totalRejections++;
           
            this.rejectionReasons.push({
                graphId,
                reason: 'Недостаточно совпадений в единой системе',
                matchPercentage: comparison.percentage,
                required: MIN_MATCH_PERCENTAGE,
                timestamp: new Date()
            });

            // 🔥 ЕСЛИ SIMPLE-MATCHER УВЕРЕН - ПРЕДЛАГАЕМ ПРИНУДИТЕЛЬНОЕ ДОБАВЛЕНИЕ
            if (metadata.similarity && metadata.similarity > 0.7) {
                console.log(`💡 РЕКОМЕНДАЦИЯ: simple-matcher уверен на ${(metadata.similarity * 100).toFixed(1)}%`);
                console.log(`   Используйте addGraphWithForcedConfidence`);
            }

            // Записываем отказ в историю
            this.history.push({
                timestamp: new Date(),
                graphId,
                action: 'reject',
                reason: `Недостаточно совпадений: ${comparison.percentage.toFixed(1)}% < ${MIN_MATCH_PERCENTAGE}%`,
                comparison: comparison,
                metadata,
                unifiedSystem: {
                    matchPercentage: comparison.percentage,
                    avgDistance: comparison.avgDistance
                }
            });
        }

        return false;
    }

    // 🔥 ДОПОЛНИТЕЛЬНЫЙ МЕТОД: Проверить совместимость в единой системе
    checkCompatibilityInUnifiedSystem(footprint, options = {}) {
        console.log(`🔍 Проверяю совместимость в единой системе...`);
       
        if (!footprint || !footprint.getPointsForTemplateMatching) {
            console.log('⚠️ Отпечаток не поддерживает единую систему координат');
            return { compatible: false, error: 'Unsupported footprint' };
        }
       
        // Получаем точки из отпечатка
        const newPoints = footprint.getPointsForTemplateMatching();
       
        if (newPoints.length < 3) {
            console.log(`⚠️ Недостаточно точек: ${newPoints.length}`);
            return { compatible: false, error: 'Not enough points' };
        }
       
        // Получаем точки шаблона
        const templatePoints = this.getTemplatePointsForComparison();
       
        if (templatePoints.length === 0) {
            console.log('✅ Нет шаблона - первый отпечаток всегда совместим');
            return {
                compatible: true,
                isFirst: true,
                message: 'Первый отпечаток, будет установлен как эталон'
            };
        }
       
        // Сравниваем
        const comparison = this.comparePointsInUnifiedSystem(newPoints, templatePoints);
       
        const isCompatible = comparison.percentage >= this.settings.minMatchPercentage;
       
        return {
            compatible: isCompatible,
            comparison: comparison,
            requiredPercentage: this.settings.minMatchPercentage,
            message: isCompatible ?
                `Совместим (${comparison.percentage.toFixed(1)}% ≥ ${this.settings.minMatchPercentage}%)` :
                `Не совместим (${comparison.percentage.toFixed(1)}% < ${this.settings.minMatchPercentage}%)`,
            recommendation: isCompatible ?
                'Можно добавить к шаблону' :
                'Рекомендуется использовать принудительное добавление'
        };
    }

    // 🔥 СУЩЕСТВУЮЩИЕ МЕТОДЫ (ВОССТАНАВЛИВАЕМ ВСЕ)
   
    addGraphWithForcedConfidence(graph, graphId, metadata = {}) {
        console.log(`🎯 ПРИНУДИТЕЛЬНОЕ ДОБАВЛЕНИЕ графа ${graphId}...`);
        this.operationCounter++;
       
        const added = this.templateBuilder.addGraph(graph, graphId, {
            ...metadata,
            forced: true,
            forcedReason: metadata.similarity ?
                `Высокая уверенность simple-matcher: ${metadata.similarity.toFixed(3)}` :
                'Принудительное добавление'
        });
       
        if (added) {
            this.stats.totalGraphsAdded++;
            this.stats.lastGraphAdded = {
                graphId,
                timestamp: new Date(),
                pointsCount: this.templateBuilder.extractPointsFromGraph(graph).length,
                forced: true,
                forcedReason: metadata.forcedReason
            };
           
            this.updateStats();
           
            const historyEntry = {
                timestamp: new Date(),
                graphId,
                action: 'forced_add',
                reason: metadata.forcedReason || 'Принудительное добавление',
                metadata
            };
           
            this.history.push(historyEntry);
           
            console.log(`✅ Граф принудительно добавлен к шаблону`);
           
            // Авто-сохранение
            if (this.settings.autoSave && this.operationCounter % this.settings.saveInterval === 0) {
                this.autoSave();
            }
           
            return true;
        }
       
        return false;
    }
   
    compareWithTemplate(graph, graphId, metadata = {}) {
        console.log(`🔍 Сравниваю граф ${graphId} с шаблоном...`);
        this.operationCounter++;
       
        if (!this.templateBuilder) {
            console.log('⚠️ Нет шаблона для сравнения');
            return { similarity: 0, decision: 'no_template', error: 'No template available' };
        }
       
        // Используем метод шаблона для сравнения
        const comparison = this.templateBuilder.compareGraphWithTemplate(graph, {
            ...metadata,
            debug: this.settings.debugMode
        });
       
        // Обновляем статистику
        this.stats.totalGraphsProcessed++;
        this.stats.avgSimilarity = (this.stats.avgSimilarity * (this.stats.totalGraphsProcessed - 1) +
                                   comparison.similarity) / this.stats.totalGraphsProcessed;
       
        // Записываем в историю
        const historyEntry = {
            timestamp: new Date(),
            graphId,
            comparison: comparison,
            action: 'compare',
            metadata
        };
       
        this.history.push(historyEntry);
       
        // Авто-сохранение
        if (this.settings.autoSave && this.operationCounter % this.settings.saveInterval === 0) {
            this.autoSave();
        }
       
        return comparison;
    }
   
    validateTemplate(force = false) {
        console.log(`✅ Валидация шаблона...`);
       
        if (!this.templateBuilder) {
            return {
                valid: false,
                errors: ['Нет строителя шаблона'],
                warnings: [],
                timestamp: new Date()
            };
        }
       
        const validation = this.templateBuilder.validate(force);
       
        // Добавляем проверку единой системы координат
        if (this.settings.enableUnifiedSystem) {
            const templatePoints = this.getTemplatePointsForComparison();
            if (templatePoints.length > 0) {
                // Проверяем, что точки в правильном диапазоне
                const outOfRange = templatePoints.filter(p => p.x < 150 || p.x > 850 || p.y < 150 || p.y > 850);
                if (outOfRange.length > 0) {
                    validation.warnings.push(`⚠️ ${outOfRange.length} точек шаблона вне диапазона 200-800`);
                } else {
                    validation.warnings.push(`✅ Все точки шаблона в диапазоне 200-800`);
                }
               
                // Проверяем статистику единой системы
                if (this.stats.unifiedSystemStats.comparisons > 0) {
                    validation.stats = {
                        ...validation.stats,
                        unifiedSystem: this.stats.unifiedSystemStats
                    };
                }
            }
        }
       
        // Обновляем статистику валидации
        if (validation.valid) {
            this.stats.validationPasses++;
        } else {
            this.stats.validationFails++;
        }
       
        // Сохраняем результат валидации
        this.validationResults.push({
            timestamp: new Date(),
            ...validation
        });
       
        return validation;
    }
   
    getTemplateInfo(detailed = false) {
        if (!this.templateBuilder) {
            return { error: 'No template builder' };
        }
       
        const info = this.templateBuilder.getInfo(detailed);
       
        // Добавляем информацию о единой системе координат
        info.unifiedSystem = {
            enabled: this.settings.enableUnifiedSystem,
            threshold: this.settings.unifiedSystemThreshold,
            minMatchPercentage: this.settings.minMatchPercentage,
            requireUnifiedSystem: this.settings.requireUnifiedSystem,
            stats: this.stats.unifiedSystemStats
        };
       
        // Добавляем общую статистику
        info.stats = {
            totalGraphsProcessed: this.stats.totalGraphsProcessed,
            totalGraphsAdded: this.stats.totalGraphsAdded,
            totalMerges: this.stats.totalMerges,
            totalRejections: this.stats.totalRejections,
            avgSimilarity: this.stats.avgSimilarity,
            validationPasses: this.stats.validationPasses,
            validationFails: this.stats.validationFails
        };
       
        return info;
    }
   
    updateStats() {
        if (this.templateBuilder) {
            this.stats.templateSize = this.templateBuilder.invariantCells.size;
        }
       
        this.stats.lastUpdated = new Date();
       
        if (this.settings.debugMode) {
            console.log(`📊 Статистика супер-модели:`);
            console.log(`   Обработано графов: ${this.stats.totalGraphsProcessed}`);
            console.log(`   Добавлено к шаблону: ${this.stats.totalGraphsAdded}`);
            console.log(`   Слияний: ${this.stats.totalMerges}`);
            console.log(`   Отклонений: ${this.stats.totalRejections}`);
            console.log(`   Средняя схожесть: ${this.stats.avgSimilarity.toFixed(3)}`);
            console.log(`   Размер шаблона: ${this.stats.templateSize} ячеек`);
            console.log(`   Валидаций пройдено: ${this.stats.validationPasses}`);
            console.log(`   Валидаций не пройдено: ${this.stats.validationFails}`);
           
            // Статистика единой системы
            if (this.settings.enableUnifiedSystem) {
                console.log(`📊 Статистика ЕДИНОЙ системы координат:`);
                console.log(`   Сравнений: ${this.stats.unifiedSystemStats.comparisons}`);
                console.log(`   Совпадений: ${this.stats.unifiedSystemStats.matches}`);
                console.log(`   Среднее расстояние: ${this.stats.unifiedSystemStats.avgDistance.toFixed(1)}px`);
                console.log(`   Успешность: ${this.stats.unifiedSystemStats.successRate.toFixed(1)}%`);
            }
        }
    }
   
    visualize(detailed = false) {
        console.log(`\n🎯 VECTOR SUPER MODEL "${this.name}":`);
        console.log(`═`.repeat(70));
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Создана: ${this.createdAt.toLocaleString('ru-RU')}`);
        console.log(`├─ Последнее обновление: ${this.lastUpdated.toLocaleString('ru-RU')}`);
        console.log(`├─ Графов обработано: ${this.stats.totalGraphsProcessed}`);
        console.log(`├─ Добавлено к шаблону: ${this.stats.totalGraphsAdded}`);
        console.log(`├─ Слияний: ${this.stats.totalMerges}`);
        console.log(`├─ Отклонений: ${this.stats.totalRejections}`);
        console.log(`├─ Размер шаблона: ${this.stats.templateSize} ячеек`);
       
        if (this.settings.enableUnifiedSystem) {
            console.log(`├─ 🎯 ЕДИНАЯ СИСТЕМА КООРДИНАТ:`);
            console.log(`│  ├─ Включена: ДА`);
            console.log(`│  ├─ Обязательна: ${this.settings.requireUnifiedSystem ? 'ДА' : 'НЕТ'}`);
            console.log(`│  ├─ Порог совпадения: ${this.settings.unifiedSystemThreshold}px`);
            console.log(`│  ├─ Минимальный процент: ${this.settings.minMatchPercentage}%`);
            console.log(`│  ├─ Сравнений: ${this.stats.unifiedSystemStats.comparisons}`);
            console.log(`│  ├─ Совпадений: ${this.stats.unifiedSystemStats.matches}`);
            console.log(`│  └─ Успешность: ${this.stats.unifiedSystemStats.successRate.toFixed(1)}%`);
        }
       
        if (this.templateBuilder) {
            const templateInfo = this.templateBuilder.getInfo(detailed);
            console.log(`├─ 🏗️  ШАБЛОН:`);
            console.log(`│  ├─ Ячеек: ${templateInfo.cellsCount}`);
            console.log(`│  ├─ Высокая уверенность: ${templateInfo.highConfidenceCells}`);
            console.log(`│  ├─ Средняя уверенность: ${templateInfo.avgConfidence.toFixed(3)}`);
            console.log(`│  ├─ Подтверждений в среднем: ${templateInfo.avgConfirmations?.toFixed(1) || 'N/A'}`);
            console.log(`│  └─ Последнее обновление: ${templateInfo.lastUpdated ? new Date(templateInfo.lastUpdated).toLocaleString('ru-RU') : 'никогда'}`);
           
            if (detailed && templateInfo.cellsByConfidence) {
                console.log(`│  📊 Распределение по уверенности:`);
                for (const [range, count] of Object.entries(templateInfo.cellsByConfidence)) {
                    console.log(`│     ${range}: ${count} ячеек`);
                }
            }
        }
       
        console.log(`├─ 📊 Средняя схожесть: ${this.stats.avgSimilarity.toFixed(3)}`);
        console.log(`├─ ✅ Валидаций пройдено: ${this.stats.validationPasses}`);
        console.log(`└─ ❌ Валидаций не пройдено: ${this.stats.validationFails}`);
       
        if (detailed) {
            console.log(`\n⚙️  НАСТРОЙКИ:`);
            console.log(`   Минимальная схожесть для слияния: ${this.settings.minSimilarityForMerge}`);
            console.log(`   Максимальное количество ячеек: ${this.settings.maxCells}`);
            console.log(`   Минимальное подтверждений для ячейки: ${this.settings.minConfirmationsForCell}`);
            console.log(`   Авто-валидация: ${this.settings.enableAutoValidation ? 'ВКЛ' : 'ВЫКЛ'}`);
            console.log(`   Режим отладки: ${this.settings.debugMode ? 'ВКЛ' : 'ВЫКЛ'}`);
            console.log(`   Авто-сохранение: ${this.settings.autoSave ? `каждые ${this.settings.saveInterval} операций` : 'ВЫКЛ'}`);
           
            if (this.settings.enableUnifiedSystem) {
                console.log(`   🎯 Единая система координат: ВКЛ`);
                console.log(`      Порог: ${this.settings.unifiedSystemThreshold}px`);
                console.log(`      Мин. процент: ${this.settings.minMatchPercentage}%`);
                console.log(`      Обязательна: ${this.settings.requireUnifiedSystem ? 'ДА' : 'НЕТ'}`);
            }
           
            // Показываем последние 5 операций
            if (this.history.length > 0) {
                console.log(`\n📋 ПОСЛЕДНИЕ ОПЕРАЦИИ (последние 5):`);
                const recentHistory = this.history.slice(-5).reverse();
                recentHistory.forEach((entry, index) => {
                    const time = new Date(entry.timestamp).toLocaleTimeString('ru-RU');
                    console.log(`   ${index + 1}. ${time} - ${entry.graphId}: ${entry.action}${entry.reason ? ` (${entry.reason})` : ''}`);
                });
            }
        }
    }
   
    saveToFile(filepath = null) {
        try {
            const defaultPath = `./data/super_models/${this.id}.json`;
            const savePath = filepath || defaultPath;
           
            // Создаем директорию если нет
            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
           
            const data = this.toJSON();
            fs.writeFileSync(savePath, JSON.stringify(data, null, 2));
           
            console.log(`💾 Супер-модель сохранена: ${savePath}`);
            return { success: true, path: savePath };
        } catch (error) {
            console.log(`❌ Ошибка сохранения супер-модели:`, error.message);
            return { success: false, error: error.message };
        }
    }
   
    autoSave() {
        if (this.settings.autoSave) {
            console.log(`💾 Авто-сохранение супер-модели...`);
            return this.saveToFile();
        }
        return { success: false, reason: 'autoSave disabled' };
    }
   
    static loadFromFile(filepath) {
        try {
            if (!fs.existsSync(filepath)) {
                console.log(`⚠️ Файл не найден: ${filepath}`);
                return null;
            }
           
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            const model = VectorSuperModel.fromJSON(data);
           
            console.log(`📂 Супер-модель загружена из: ${filepath}`);
            return model;
        } catch (error) {
            console.log(`❌ Ошибка загрузки супер-модели:`, error.message);
            return null;
        }
    }
   
    toJSON() {
        const data = {
            id: this.id,
            name: this.name,
            userId: this.userId,
            createdAt: this.createdAt.toISOString(),
            lastUpdated: new Date().toISOString(),
            stats: this.stats,
            settings: this.settings,
            history: this.history,
            validationResults: this.validationResults,
            rejectionReasons: this.rejectionReasons,
            operationCounter: this.operationCounter,
            _version: '2.1-with-unified-system',
            _savedAt: new Date().toISOString()
        };
       
        if (this.templateBuilder) {
            data.templateBuilder = this.templateBuilder.toJSON();
        }
       
        return data;
    }
   
    static fromJSON(data) {
        console.log(`📂 Загружаю VectorSuperModel "${data.name}"...`);
       
        const model = new VectorSuperModel({
            id: data.id,
            name: data.name,
            userId: data.userId,
            minSimilarityForMerge: data.settings?.minSimilarityForMerge,
            maxCells: data.settings?.maxCells,
            minConfirmationsForCell: data.settings?.minConfirmationsForCell,
            enableAutoValidation: data.settings?.enableAutoValidation,
            debugMode: data.settings?.debugMode,
            enableClustering: data.settings?.enableClustering,
            clusterThreshold: data.settings?.clusterThreshold,
            saveInterval: data.settings?.saveInterval,
            autoSave: data.settings?.autoSave,
            // 🔥 НАСТРОЙКИ ЕДИНОЙ СИСТЕМЫ
            unifiedSystemThreshold: data.settings?.unifiedSystemThreshold,
            minMatchPercentage: data.settings?.minMatchPercentage,
            enableUnifiedSystem: data.settings?.enableUnifiedSystem,
            requireUnifiedSystem: data.settings?.requireUnifiedSystem
        });
       
        // Восстанавливаем даты
        model.createdAt = new Date(data.createdAt);
        model.lastUpdated = new Date(data.lastUpdated);
       
        // Восстанавливаем статистику
        if (data.stats) {
            model.stats = { ...model.stats, ...data.stats };
        }
       
        // Восстанавливаем историю, валидацию и причины отказов
        if (Array.isArray(data.history)) {
            model.history = data.history.map(entry => ({
                ...entry,
                timestamp: new Date(entry.timestamp)
            }));
        }
       
        if (Array.isArray(data.validationResults)) {
            model.validationResults = data.validationResults.map(result => ({
                ...result,
                timestamp: new Date(result.timestamp)
            }));
        }
       
        if (Array.isArray(data.rejectionReasons)) {
            model.rejectionReasons = data.rejectionReasons.map(reason => ({
                ...reason,
                timestamp: new Date(reason.timestamp)
            }));
        }
       
        // Восстанавливаем счетчик операций
        model.operationCounter = data.operationCounter || 0;
       
        // Восстанавливаем строитель шаблона
        if (data.templateBuilder && VectorTemplateBuilder) {
            try {
                model.templateBuilder = VectorTemplateBuilder.fromJSON(data.templateBuilder);
                console.log('   🎯 Загружен строитель шаблона');
            } catch (error) {
                console.log('⚠️ Ошибка загрузки строителя шаблона:', error.message);
                model.templateBuilder = new VectorTemplateBuilder();
            }
        }
       
        console.log(`✅ Загружена VectorSuperModel "${model.name}" с ` +
                   `${model.stats.templateSize} ячейками в шаблоне`);
       
        if (model.settings.enableUnifiedSystem) {
            console.log(`   🎯 Единая система координат: ВКЛЮЧЕНА`);
            console.log(`      Порог: ${model.settings.unifiedSystemThreshold}px`);
            console.log(`      Мин. процент: ${model.settings.minMatchPercentage}%`);
        }
       
        return model;
    }
   
    // 🔥 ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ОТЛАДКИ
   
    debugUnifiedSystem() {
        console.log(`\n🔍 ДЕБАГ ЕДИНОЙ СИСТЕМЫ КООРДИНАТ:`);
        console.log(`═`.repeat(50));
       
        const templatePoints = this.getTemplatePointsForComparison();
        console.log(`📊 Точки шаблона: ${templatePoints.length}`);
       
        if (templatePoints.length > 0) {
            console.log(`   Диапазон координат:`);
            console.log(`   X: ${Math.min(...templatePoints.map(p => p.x)).toFixed(1)} - ${Math.max(...templatePoints.map(p => p.x)).toFixed(1)}`);
            console.log(`   Y: ${Math.min(...templatePoints.map(p => p.y)).toFixed(1)} - ${Math.max(...templatePoints.map(p => p.y)).toFixed(1)}`);
           
            // Проверяем что в диапазоне 200-800
            const inRange = templatePoints.filter(p => p.x >= 200 && p.x <= 800 && p.y >= 200 && p.y <= 800);
            console.log(`   В диапазоне 200-800: ${inRange.length}/${templatePoints.length}`);
           
            if (inRange.length < templatePoints.length) {
                const outOfRange = templatePoints.filter(p => p.x < 200 || p.x > 800 || p.y < 200 || p.y > 800);
                console.log(`   ⚠️ Точки вне диапазона:`);
                outOfRange.slice(0, 3).forEach(p => {
                    console.log(`      (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
                });
                if (outOfRange.length > 3) {
                    console.log(`      ... и еще ${outOfRange.length - 3} точек`);
                }
            }
        }
       
        console.log(`\n📊 Статистика единой системы:`);
        console.log(`   Сравнений: ${this.stats.unifiedSystemStats.comparisons}`);
        console.log(`   Совпадений: ${this.stats.unifiedSystemStats.matches}`);
        console.log(`   Среднее расстояние: ${this.stats.unifiedSystemStats.avgDistance.toFixed(1)}px`);
        console.log(`   Успешность: ${this.stats.unifiedSystemStats.successRate.toFixed(1)}%`);
       
        console.log(`\n⚙️ Настройки:`);
        console.log(`   Порог совпадения: ${this.settings.unifiedSystemThreshold}px`);
        console.log(`   Минимальный процент: ${this.settings.minMatchPercentage}%`);
        console.log(`   Включена: ${this.settings.enableUnifiedSystem ? 'ДА' : 'НЕТ'}`);
        console.log(`   Обязательна: ${this.settings.requireUnifiedSystem ? 'ДА' : 'НЕТ'}`);
    }
   
    resetUnifiedSystemStats() {
        console.log(`🔄 Сброс статистики единой системы...`);
        this.stats.unifiedSystemStats = {
            comparisons: 0,
            matches: 0,
            avgDistance: 0,
            successRate: 0
        };
        console.log(`✅ Статистика сброшена`);
    }
}

module.exports = VectorSuperModel;
