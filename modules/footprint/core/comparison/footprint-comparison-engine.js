// modules/footprint/core/comparison/footprint-comparison-engine.js
// 🔥 ОБНОВЛЕННАЯ ВЕРСИЯ С ИСПОЛЬЗОВАНИЕМ CoordinateManager

class FootprintComparisonEngine {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
       
        // 🔥 ИСПОЛЬЗУЕМ МОДУЛИ ИЗ МЕНЕДЖЕРА
        this.coordinateManager = manager.coordinateManager;
        this.transformationValidator = manager.transformationValidator;
        this.coordinateSystemLogger = manager.coordinateSystemLogger;
       
        // Импорт зависимостей
        const SimpleMatcher = require('../simple-matcher');
        const ImprovedAligner = require('../alignment/improved-aligner');
        const CoordinateSystemConverter = require('../alignment/coordinate-system-converter');
       
        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });
       
        this.improvedAligner = new ImprovedAligner({
            debug: this.config.debug,
            visualizationDir: this.manager.config.dbPath + '/visualizations/alignments'
        });
       
        this.coordinateConverter = new CoordinateSystemConverter({
            debug: this.config.debug
        });
       
        console.log('🔍 FootprintComparisonEngine создан с интеграцией CoordinateManager');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Сравнение с выравниванием (ОБНОВЛЕННЫЙ)
    async compareWithAlignment(footprint1, footprint2, options = {}) {
        console.log(`\n🎯 СРАВНЕНИЕ С ВЫРАВНИВАНИЕМ: "${footprint1.name}" vs "${footprint2.name}"`);
       
        const startTime = Date.now();
       
        try {
            // 🔥 1. ДИАГНОСТИКА СИСТЕМ КООРДИНАТ (если включено)
            if (this.config.enableCoordinateDiagnostics) {
                this.coordinateSystemLogger.logCoordinateSystems(
                    'Сравнение с выравниванием - начальная диагностика',
                    footprint1,
                    footprint2
                );
            }
           
            // 🔥 2. ПРОВЕРКА ТРАНСФОРМАЦИЙ
            const transformationCheck = this.checkTransformations(footprint1, footprint2);
            if (!transformationCheck.consistent && this.config.debug) {
                console.log('⚠️ Трансформации не согласованы перед выравниванием');
                console.log(`   Различия: ${transformationCheck.differences?.join(', ') || 'неизвестно'}`);
            }
           
            // 🔥 3. ПОЛУЧЕНИЕ ТОЧЕК В ЕДИНОЙ СИСТЕМЕ КООРДИНАТ
            console.log('🗺️ Получаю точки в единой системе координат...');
           
            // Используем CoordinateManager вместо старых методов
            const points1 = this.coordinateManager.getCoordinates(footprint1, {
                coordinateSystem: 'canonical',
                debug: this.config.debug,
                forceRecalculate: true
            });
           
            const points2 = this.coordinateManager.getCoordinates(footprint2, {
                coordinateSystem: 'canonical',
                debug: this.config.debug,
                forceRecalculate: true
            });
           
            if (!points1.valid || !points2.valid) {
                console.log('❌ Не удалось получить точки в единой системе координат');
                return {
                    success: false,
                    error: 'Не удалось преобразовать точки',
                    points1Valid: points1.valid,
                    points2Valid: points2.valid
                };
            }
           
            console.log(`📊 Точки получены: ${points1.count} и ${points2.count} в системе ${points1.coordinateSystem}`);
           
            // 🔥 4. ВЫРАВНИВАНИЕ ТОЧЕК
            console.log('🔄 Выравниваю точки...');
            const alignmentResult = await this.improvedAligner.alignPoints(
                points1.points,
                points2.points,
                {
                    method: 'rigid',
                    maxIterations: 100,
                    tolerance: 1.0,
                    visualization: this.config.enableMergeVisualization,
                    visualizationOptions: {
                        title: `Выравнивание: ${footprint1.name} vs ${footprint2.name}`,
                        saveToFile: true
                    }
                }
            );
           
            if (!alignmentResult.success) {
                console.log('❌ Ошибка выравнивания:', alignmentResult.error);
                return {
                    success: false,
                    error: 'Ошибка выравнивания',
                    alignmentError: alignmentResult.error
                };
            }
           
            // 🔥 5. СРАВНЕНИЕ ВЫРОВНЕННЫХ ТОЧЕК
            console.log('🔍 Сравниваю выровненные точки...');
            const comparisonResult = this.compareAlignedPoints(
                alignmentResult.alignedPoints1,
                alignmentResult.alignedPoints2,
                {
                    maxDistance: 50,
                    minMatches: 5,
                    debug: this.config.debug
                }
            );
           
            // 🔥 6. АНАЛИЗ РЕЗУЛЬТАТОВ
            const analysis = this.analyzeComparisonResults(
                comparisonResult,
                alignmentResult,
                transformationCheck
            );
           
            // 🔥 7. ФОРМИРОВАНИЕ ИТОГОВОГО РЕЗУЛЬТАТА
            const executionTime = Date.now() - startTime;
           
            const result = {
                success: true,
                similarity: analysis.finalSimilarity,
                decision: analysis.decision,
                reason: analysis.reason,
                method: 'alignment_based',
                executionTime: executionTime,
                stats: {
                    points1: points1.count,
                    points2: points2.count,
                    matches: comparisonResult.matches.length,
                    matchRate: comparisonResult.matchRate,
                    alignmentError: alignmentResult.error,
                    transformationConsistent: transformationCheck.consistent
                },
                details: {
                    alignment: alignmentResult,
                    comparison: comparisonResult,
                    transformationCheck: transformationCheck,
                    coordinateSystems: {
                        footprint1: points1.coordinateSystem,
                        footprint2: points2.coordinateSystem,
                        usedForComparison: points1.coordinateSystem
                    }
                }
            };
           
            // 🔥 8. ДИАГНОСТИЧЕСКОЕ ЛОГИРОВАНИЕ
            if (this.config.enableCoordinateDiagnostics) {
                this.logComparisonDiagnostics(result, footprint1, footprint2);
            }
           
            console.log(`✅ Сравнение завершено за ${executionTime}ms`);
            console.log(`   Сходство: ${result.similarity.toFixed(3)}`);
            console.log(`   Решение: ${result.decision}`);
            console.log(`   Метод: ${result.method}`);
           
            return result;
           
        } catch (error) {
            console.log('❌ Критическая ошибка в compareWithAlignment:', error.message);
            console.error(error.stack);
           
            return {
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime
            };
        }
    }
   
    // 🔥 МЕТОД: Сравнение с преобразованием систем координат (ОБНОВЛЕННЫЙ)
    async compareWithCoordinateConversion(footprint1, footprint2, options = {}) {
        console.log(`\n🧭 СРАВНЕНИЕ С ПРЕОБРАЗОВАНИЕМ СИСТЕМ КООРДИНАТ: "${footprint1.name}" vs "${footprint2.name}"`);
       
        const startTime = Date.now();
       
        try {
            // 🔥 1. ДИАГНОСТИКА
            if (this.config.enableCoordinateDiagnostics) {
                this.coordinateSystemLogger.logCoordinateSystems(
                    'Сравнение с преобразованием координат',
                    footprint1,
                    footprint2
                );
            }
           
            // 🔥 2. ПОЛУЧАЕМ ТРАНСФОРМАЦИИ
            const trans1 = footprint1.getTransformation ? footprint1.getTransformation() : footprint1.transformation;
            const trans2 = footprint2.getTransformation ? footprint2.getTransformation() : footprint2.transformation;
           
            console.log(`📐 Трансформации:`);
            console.log(`   ${footprint1.name}: ${trans1?.rotationAngle?.toFixed(1) || 0}°`);
            console.log(`   ${footprint2.name}: ${trans2?.rotationAngle?.toFixed(1) || 0}°`);
           
            // 🔥 3. ПРЕОБРАЗУЕМ К ЕДИНОЙ СИСТЕМЕ (оригинальной системе первого отпечатка)
            console.log('🔄 Преобразую к единой системе координат...');
           
            // Получаем точки второго отпечатка в системе первого
            const points1 = this.coordinateManager.getCoordinates(footprint1, {
                coordinateSystem: 'original',
                debug: this.config.debug
            });
           
            const points2 = this.coordinateManager.getCoordinates(footprint2, {
                coordinateSystem: 'original',
                debug: this.config.debug
            });
           
            // Преобразуем точки второго отпечатка в систему первого
            const transformedPoints2 = this.coordinateManager.transformToSystem(
                points2.points,
                points2.coordinateSystem,
                points1.coordinateSystem,
                trans2
            );
           
            console.log(`📊 Точки после преобразования:`);
            console.log(`   ${footprint1.name}: ${points1.count} точек в ${points1.coordinateSystem}`);
            console.log(`   ${footprint2.name}: ${transformedPoints2.length} точек преобразовано в ${points1.coordinateSystem}`);
           
            // 🔥 4. СРАВНИВАЕМ В ОДНОЙ СИСТЕМЕ
            const comparisonResult = this.coordinateManager.comparePoints(
                points1.points,
                transformedPoints2,
                {
                    maxDistance: this.manager.DECISION_THRESHOLDS.MAX_DISTANCE || 50,
                    debug: this.config.debug
                }
            );
           
            if (!comparisonResult.success) {
                return {
                    success: false,
                    error: 'Ошибка сравнения точек',
                    comparisonError: comparisonResult.error
                };
            }
           
            // 🔥 5. АНАЛИЗ РЕЗУЛЬТАТОВ
            const matchRate = comparisonResult.matchRate;
            const transformationDiff = trans1 && trans2 ?
                Math.abs(trans1.rotationAngle - trans2.rotationAngle) : 0;
           
            let similarity = matchRate;
            let decision = 'different';
            let reason = '';
           
            // Учитываем разницу в трансформациях
            if (transformationDiff > 30) {
                similarity *= 0.7; // Штраф за большую разницу в углах
                reason = `Большая разница в углах: ${transformationDiff.toFixed(1)}°`;
            }
           
            // Принимаем решение
            if (similarity > this.manager.DECISION_THRESHOLDS.PATTERN_SIMILARITY) {
                decision = 'same';
                reason = `Высокое сходство (${similarity.toFixed(3)}) после преобразования координат`;
            } else if (similarity > 0.3) {
                decision = 'similar';
                reason = `Умеренное сходство (${similarity.toFixed(3)})`;
            } else {
                decision = 'different';
                reason = `Низкое сходство (${similarity.toFixed(3)})`;
            }
           
            // 🔥 6. ФОРМИРУЕМ РЕЗУЛЬТАТ
            const executionTime = Date.now() - startTime;
           
            const result = {
                success: true,
                similarity: similarity,
                decision: decision,
                reason: reason,
                method: 'coordinate_conversion',
                executionTime: executionTime,
                stats: {
                    points1: points1.count,
                    points2: points2.count,
                    matches: comparisonResult.matchCount,
                    matchRate: matchRate,
                    transformationDiff: transformationDiff,
                    coordinateSystem: points1.coordinateSystem
                },
                details: {
                    comparison: comparisonResult,
                    transformations: {
                        footprint1: trans1,
                        footprint2: trans2,
                        diff: transformationDiff
                    }
                }
            };
           
            console.log(`✅ Сравнение завершено за ${executionTime}ms`);
            console.log(`   Сходство: ${similarity.toFixed(3)}`);
            console.log(`   Решение: ${decision}`);
            console.log(`   Причина: ${reason}`);
           
            return result;
           
        } catch (error) {
            console.log('❌ Ошибка в compareWithCoordinateConversion:', error.message);
           
            return {
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime
            };
        }
    }
   
    // 🔥 МЕТОД: Проверка и сравнение (ОБНОВЛЕННЫЙ)
    async validateAndCompare(footprint1, footprint2, options = {}) {
        console.log(`\n✅ ПРОВЕРКА И СРАВНЕНИЕ: "${footprint1.name}" vs "${footprint2.name}"`);
       
        const startTime = Date.now();
       
        try {
            // 🔥 1. ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
            const validation = this.validateFootprintsForComparison(footprint1, footprint2);
            if (!validation.valid) {
                return {
                    success: false,
                    error: 'Невалидные отпечатки для сравнения',
                    validation: validation
                };
            }
           
            // 🔥 2. ДИАГНОСТИКА СИСТЕМ КООРДИНАТ
            if (this.config.enableCoordinateDiagnostics) {
                this.coordinateSystemLogger.logCoordinateSystems(
                    'Проверка и сравнение - диагностика',
                    footprint1,
                    footprint2
                );
            }
           
            // 🔥 3. ПРОВЕРКА ТРАНСФОРМАЦИЙ
            const transformationCheck = this.checkTransformations(footprint1, footprint2);
           
            // 🔥 4. ВЫБОР МЕТОДА СРАВНЕНИЯ НА ОСНОВЕ ДАННЫХ
            const comparisonMethod = this.selectComparisonMethod(footprint1, footprint2, transformationCheck);
           
            console.log(`🎯 Выбран метод сравнения: ${comparisonMethod}`);
           
            // 🔥 5. ВЫПОЛНЕНИЕ СРАВНЕНИЯ
            let comparisonResult;
           
            switch (comparisonMethod) {
                case 'alignment':
                    comparisonResult = await this.compareWithAlignment(footprint1, footprint2, options);
                    break;
                   
                case 'coordinate_conversion':
                    comparisonResult = await this.compareWithCoordinateConversion(footprint1, footprint2, options);
                    break;
                   
                case 'pattern':
                default:
                    comparisonResult = await this.compareWithPatterns(footprint1, footprint2, options);
                    break;
            }
           
            // 🔥 6. ДОБАВЛЯЕМ МЕТАДАННЫЕ О ВАЛИДАЦИИ
            if (comparisonResult.success) {
                comparisonResult.validation = validation;
                comparisonResult.transformationCheck = transformationCheck;
                comparisonResult.selectedMethod = comparisonMethod;
                comparisonResult.alternativeMethods = this.getAlternativeMethods(footprint1, footprint2);
            }
           
            // 🔥 7. ЛОГИРОВАНИЕ РЕЗУЛЬТАТА
            if (this.config.debug) {
                console.log(`📊 РЕЗУЛЬТАТ ПРОВЕРКИ И СРАВНЕНИЯ:`);
                console.log(`   Метод: ${comparisonMethod}`);
                console.log(`   Валидация: ${validation.valid ? '✅' : '❌'}`);
                console.log(`   Трансформации: ${transformationCheck.consistent ? '✅' : '❌'}`);
                if (comparisonResult.success) {
                    console.log(`   Сходство: ${comparisonResult.similarity?.toFixed(3) || 'N/A'}`);
                    console.log(`   Решение: ${comparisonResult.decision || 'N/A'}`);
                }
            }
           
            const executionTime = Date.now() - startTime;
            comparisonResult.executionTime = executionTime;
           
            return comparisonResult;
           
        } catch (error) {
            console.log('❌ Ошибка в validateAndCompare:', error.message);
           
            return {
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime
            };
        }
    }
   
    // 🔥 МЕТОД: Сравнение с паттернами (ОБНОВЛЕННЫЙ)
    async compareWithPatterns(footprint1, footprint2, options = {}) {
        console.log(`\n🎨 СРАВНЕНИЕ ПО ПАТТЕРНАМ: "${footprint1.name}" vs "${footprint2.name}"`);
       
        const startTime = Date.now();
       
        try {
            // 🔥 1. ДИАГНОСТИКА
            if (this.config.enableCoordinateDiagnostics) {
                this.coordinateSystemLogger.logCoordinateSystems(
                    'Сравнение по паттернам',
                    footprint1,
                    footprint2
                );
            }
           
            // 🔥 2. ПОЛУЧАЕМ ИНВАРИАНТНЫЕ ПРИЗНАКИ ЧЕРЕЗ CoordinateManager
            console.log('🔍 Извлекаю инвариантные признаки...');
           
            // Получаем точки в нормализованной системе
            const normalizedPoints1 = this.coordinateManager.getCoordinates(footprint1, {
                coordinateSystem: 'normalized',
                debug: this.config.debug
            });
           
            const normalizedPoints2 = this.coordinateManager.getCoordinates(footprint2, {
                coordinateSystem: 'normalized',
                debug: this.config.debug
            });
           
            if (!normalizedPoints1.valid || !normalizedPoints2.valid) {
                console.log('❌ Не удалось получить нормализованные точки');
               
                // Фоллбэк: используем оригинальные точки
                console.log('🔄 Использую фоллбэк: оригинальные точки');
                return await this.compareWithCoordinateConversion(footprint1, footprint2, options);
            }
           
            console.log(`📊 Нормализованные точки: ${normalizedPoints1.count} и ${normalizedPoints2.count}`);
           
            // 🔥 3. ИЗВЛЕКАЕМ ПАТТЕРНЫ ИЗ ТОЧЕК
            const patterns1 = this.extractPatternsFromPoints(normalizedPoints1.points);
            const patterns2 = this.extractPatternsFromPoints(normalizedPoints2.points);
           
            console.log(`🎯 Извлечено паттернов: ${patterns1.length} и ${patterns2.length}`);
           
            // 🔥 4. СРАВНИВАЕМ ПАТТЕРНЫ
            const patternComparison = this.comparePatterns(patterns1, patterns2);
           
            // 🔥 5. СРАВНИВАЕМ ТОЧКИ ДЛЯ ПОДТВЕРЖДЕНИЯ
            const pointComparison = this.coordinateManager.comparePoints(
                normalizedPoints1.points,
                normalizedPoints2.points,
                {
                    maxDistance: 50,
                    debug: this.config.debug
                }
            );
           
            // 🔥 6. КОМБИНИРУЕМ РЕЗУЛЬТАТЫ
            const combinedResult = this.combinePatternAndPointResults(
                patternComparison,
                pointComparison
            );
           
            // 🔥 7. ПРИНИМАЕМ РЕШЕНИЕ
            const similarity = combinedResult.similarity;
            let decision, reason;
           
            if (similarity > this.manager.DECISION_THRESHOLDS.PATTERN_SIMILARITY) {
                decision = 'same';
                reason = `Высокое сходство паттернов (${similarity.toFixed(3)})`;
            } else if (similarity > 0.4) {
                decision = 'similar';
                reason = `Умеренное сходство паттернов (${similarity.toFixed(3)})`;
            } else {
                decision = 'different';
                reason = `Низкое сходство паттернов (${similarity.toFixed(3)})`;
            }
           
            // 🔥 8. ФОРМИРУЕМ РЕЗУЛЬТАТ
            const executionTime = Date.now() - startTime;
           
            const result = {
                success: true,
                similarity: similarity,
                decision: decision,
                reason: reason,
                method: 'pattern_based',
                executionTime: executionTime,
                stats: {
                    patterns1: patterns1.length,
                    patterns2: patterns2.length,
                    patternSimilarity: patternComparison.similarity,
                    pointMatches: pointComparison.matchCount,
                    pointMatchRate: pointComparison.matchRate,
                    normalizedPoints: normalizedPoints1.count
                },
                details: {
                    patternComparison: patternComparison,
                    pointComparison: pointComparison,
                    combinedResult: combinedResult,
                    coordinateSystem: normalizedPoints1.coordinateSystem
                }
            };
           
            console.log(`✅ Сравнение по паттернам завершено за ${executionTime}ms`);
            console.log(`   Сходство паттернов: ${patternComparison.similarity.toFixed(3)}`);
            console.log(`   Совпадений точек: ${pointComparison.matchCount}/${pointComparison.points1Count}`);
            console.log(`   Общее сходство: ${similarity.toFixed(3)}`);
            console.log(`   Решение: ${decision}`);
           
            return result;
           
        } catch (error) {
            console.log('❌ Ошибка в compareWithPatterns:', error.message);
           
            // Фоллбэк на более простой метод
            console.log('🔄 Использую фоллбэк: сравнение с преобразованием координат');
            return await this.compareWithCoordinateConversion(footprint1, footprint2, options);
        }
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
   
    // Проверка трансформаций
    checkTransformations(footprint1, footprint2) {
        try {
            const trans1 = footprint1.getTransformation ? footprint1.getTransformation() : footprint1.transformation;
            const trans2 = footprint2.getTransformation ? footprint2.getTransformation() : footprint2.transformation;
           
            if (!trans1 || !trans2) {
                return {
                    consistent: false,
                    error: 'Отсутствуют трансформации',
                    trans1: !!trans1,
                    trans2: !!trans2
                };
            }
           
            // Используем TransformationValidator для сравнения
            return this.transformationValidator.compareTransformations(trans1, trans2);
           
        } catch (error) {
            return {
                consistent: false,
                error: `Ошибка проверки трансформаций: ${error.message}`
            };
        }
    }
   
    // Сравнение выровненных точек
    compareAlignedPoints(points1, points2, options = {}) {
        const {
            maxDistance = 50,
            minMatches = 5,
            debug = false
        } = options;
       
        const matches = [];
        const matchedIndices2 = new Set();
       
        points1.forEach((point1, index1) => {
            let bestMatch = null;
            let minDistance = Infinity;
           
            points2.forEach((point2, index2) => {
                if (matchedIndices2.has(index2)) return;
               
                const distance = Math.sqrt(
                    Math.pow(point2.x - point1.x, 2) +
                    Math.pow(point2.y - point1.y, 2)
                );
               
                if (distance < minDistance && distance < maxDistance) {
                    minDistance = distance;
                    bestMatch = {
                        point1: { ...point1, index: index1 },
                        point2: { ...point2, index: index2 },
                        distance: distance
                    };
                }
            });
           
            if (bestMatch) {
                matches.push(bestMatch);
                matchedIndices2.add(bestMatch.point2.index);
            }
        });
       
        const matchRate = points1.length > 0 ? matches.length / points1.length : 0;
       
        return {
            success: true,
            matches: matches,
            matchCount: matches.length,
            matchRate: matchRate,
            points1Count: points1.length,
            points2Count: points2.length,
            thresholds: {
                maxDistance: maxDistance,
                minMatches: minMatches
            }
        };
    }
   
    // Анализ результатов сравнения
    analyzeComparisonResults(comparisonResult, alignmentResult, transformationCheck) {
        const analysis = {
            pointMatchRate: comparisonResult.matchRate,
            alignmentError: alignmentResult.error,
            transformationsConsistent: transformationCheck.consistent,
            finalSimilarity: 0,
            decision: 'unknown',
            reason: ''
        };
       
        // Базовое сходство на основе совпадений точек
        let similarity = comparisonResult.matchRate;
       
        // Корректируем на основе ошибки выравнивания
        if (alignmentResult.error < 10) {
            similarity *= 1.2; // Бонус за точное выравнивание
        } else if (alignmentResult.error > 50) {
            similarity *= 0.7; // Штраф за плохое выравнивание
        }
       
        // Корректируем на основе согласованности трансформаций
        if (!transformationCheck.consistent) {
            similarity *= 0.8; // Штраф за не согласованные трансформации
        }
       
        // Ограничиваем диапазон
        similarity = Math.max(0, Math.min(1, similarity));
       
        // Принимаем решение
        if (similarity > this.manager.DECISION_THRESHOLDS.PATTERN_SIMILARITY) {
            analysis.decision = 'same';
            analysis.reason = 'Высокое сходство после выравнивания';
        } else if (similarity > 0.4) {
            analysis.decision = 'similar';
            analysis.reason = 'Умеренное сходство';
        } else {
            analysis.decision = 'different';
            analysis.reason = 'Низкое сходство';
        }
       
        analysis.finalSimilarity = similarity;
       
        return analysis;
    }
   
    // Логирование диагностики сравнения
    logComparisonDiagnostics(result, footprint1, footprint2) {
        console.log('\n🔍 ДИАГНОСТИКА СРАВНЕНИЯ:');
        console.log(`   Метод: ${result.method}`);
        console.log(`   Время выполнения: ${result.executionTime}ms`);
        console.log(`   Системы координат: ${result.details?.coordinateSystems?.usedForComparison || 'unknown'}`);
        console.log(`   Трансформации согласованы: ${result.stats?.transformationConsistent ? '✅' : '❌'}`);
        console.log(`   Совпадений: ${result.stats?.matches || 0}/${result.stats?.points1 || 0}`);
        console.log(`   Процент совпадений: ${(result.stats?.matchRate * 100 || 0).toFixed(1)}%`);
        console.log(`   Ошибка выравнивания: ${result.stats?.alignmentError?.toFixed(2) || 'N/A'}`);
    }
   
    // Валидация отпечатков для сравнения
    validateFootprintsForComparison(footprint1, footprint2) {
        const issues = [];
       
        // Проверяем наличие графов
        if (!footprint1.graph || footprint1.graph.nodes.size === 0) {
            issues.push(`Отпечаток "${footprint1.name}" не имеет графа`);
        }
       
        if (!footprint2.graph || footprint2.graph.nodes.size === 0) {
            issues.push(`Отпечаток "${footprint2.name}" не имеет графа`);
        }
       
        // Проверяем минимальное количество точек
        const minPoints = this.config.minPointsForFootprint || 5;
        const points1 = footprint1.graph?.nodes?.size || 0;
        const points2 = footprint2.graph?.nodes?.size || 0;
       
        if (points1 < minPoints) {
            issues.push(`Отпечаток "${footprint1.name}" имеет слишком мало точек: ${points1}`);
        }
       
        if (points2 < minPoints) {
            issues.push(`Отпечаток "${footprint2.name}" имеет слишком мало точек: ${points2}`);
        }
       
        return {
            valid: issues.length === 0,
            issues: issues,
            stats: {
                footprint1: { points: points1, hasGraph: !!footprint1.graph },
                footprint2: { points: points2, hasGraph: !!footprint2.graph }
            }
        };
    }
   
    // Выбор метода сравнения
    selectComparisonMethod(footprint1, footprint2, transformationCheck) {
        const points1 = footprint1.graph?.nodes?.size || 0;
        const points2 = footprint2.graph?.nodes?.size || 0;
       
        // Если трансформации не согласованы, используем выравнивание
        if (!transformationCheck.consistent) {
            console.log('🔄 Трансформации не согласованы, использую метод выравнивания');
            return 'alignment';
        }
       
        // Если много точек, используем сравнение по паттернам
        if (points1 > 15 && points2 > 15) {
            return 'pattern';
        }
       
        // Если есть трансформации, используем преобразование координат
        const hasTransformations = footprint1.transformation && footprint2.transformation;
        if (hasTransformations) {
            return 'coordinate_conversion';
        }
       
        // По умолчанию используем паттерны
        return 'pattern';
    }
   
    // Получение альтернативных методов
    getAlternativeMethods(footprint1, footprint2) {
        const methods = ['alignment', 'coordinate_conversion', 'pattern'];
        const availableMethods = [];
       
        // Проверяем доступность каждого метода
        methods.forEach(method => {
            let available = true;
            let reason = '';
           
            switch (method) {
                case 'alignment':
                    // Выравнивание всегда доступно
                    available = true;
                    reason = 'Всегда доступно';
                    break;
                   
                case 'coordinate_conversion':
                    // Нужны трансформации
                    available = !!(footprint1.transformation && footprint2.transformation);
                    reason = available ? 'Есть трансформации' : 'Нет трансформаций';
                    break;
                   
                case 'pattern':
                    // Нужны точки
                    available = (footprint1.graph?.nodes?.size || 0) > 3 &&
                               (footprint2.graph?.nodes?.size || 0) > 3;
                    reason = available ? 'Достаточно точек' : 'Недостаточно точек';
                    break;
            }
           
            if (available) {
                availableMethods.push({
                    method: method,
                    reason: reason
                });
            }
        });
       
        return availableMethods;
    }
   
    // Извлечение паттернов из точек
    extractPatternsFromPoints(points) {
        if (!points || points.length < 3) {
            return [];
        }
       
        const patterns = [];
       
        // Простой алгоритм извлечения паттернов
        // Каждая точка с её ближайшими соседями образует паттерн
        points.forEach((point, index) => {
            if (index >= 20) return; // Ограничиваем для производительности
           
            // Находим ближайших соседей
            const neighbors = [];
           
            points.forEach((otherPoint, otherIndex) => {
                if (index === otherIndex) return;
               
                const distance = Math.sqrt(
                    Math.pow(otherPoint.x - point.x, 2) +
                    Math.pow(otherPoint.y - point.y, 2)
                );
               
                const angle = Math.atan2(otherPoint.y - point.y, otherPoint.x - point.x);
               
                neighbors.push({
                    point: otherPoint,
                    distance: distance,
                    angle: angle,
                    index: otherIndex
                });
            });
           
            // Сортируем по расстоянию и берем 3 ближайших
            neighbors.sort((a, b) => a.distance - b.distance);
            const closestNeighbors = neighbors.slice(0, 3);
           
            if (closestNeighbors.length >= 2) {
                // Создаем паттерн
                const pattern = {
                    centerPoint: point,
                    neighbors: closestNeighbors,
                    distances: closestNeighbors.map(n => n.distance),
                    angles: closestNeighbors.map(n => n.angle),
                    signature: this.calculatePatternSignature(closestNeighbors)
                };
               
                patterns.push(pattern);
            }
        });
       
        return patterns;
    }
   
    // Расчет сигнатуры паттерна
    calculatePatternSignature(neighbors) {
        if (!neighbors || neighbors.length === 0) return '';
       
        // Создаем простую сигнатуру на основе расстояний и углов
        const distances = neighbors.map(n => n.distance);
        const angles = neighbors.map(n => n.angle);
       
        // Нормализуем расстояния
        const maxDistance = Math.max(...distances);
        const normalizedDistances = distances.map(d => d / maxDistance);
       
        // Сортируем углы
        const sortedAngles = [...angles].sort((a, b) => a - b);
       
        // Создаем сигнатуру
        const distanceSignature = normalizedDistances.map(d => d.toFixed(2)).join('-');
        const angleSignature = sortedAngles.map(a => (a * 180 / Math.PI).toFixed(0)).join('-');
       
        return `${distanceSignature}_${angleSignature}`;
    }
   
    // Сравнение паттернов
    comparePatterns(patterns1, patterns2) {
        if (patterns1.length === 0 || patterns2.length === 0) {
            return {
                similarity: 0,
                matches: [],
                details: {
                    patterns1: 0,
                    patterns2: 0,
                    reason: 'Нет паттернов для сравнения'
                }
            };
        }
       
        const matches = [];
        const matchedIndices2 = new Set();
       
        // Простое сравнение по сигнатурам
        patterns1.forEach((pattern1, index1) => {
            let bestMatch = null;
            let bestSimilarity = 0;
           
            patterns2.forEach((pattern2, index2) => {
                if (matchedIndices2.has(index2)) return;
               
                // Сравниваем сигнатуры
                const similarity = this.comparePatternSignatures(
                    pattern1.signature,
                    pattern2.signature
                );
               
                if (similarity > bestSimilarity && similarity > 0.7) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        pattern1: pattern1,
                        pattern2: pattern2,
                        similarity: similarity,
                        index1: index1,
                        index2: index2
                    };
                }
            });
           
            if (bestMatch) {
                matches.push(bestMatch);
                matchedIndices2.add(bestMatch.index2);
            }
        });
       
        // Рассчитываем общее сходство
        const similarity = patterns1.length > 0 ?
            matches.length / patterns1.length : 0;
       
        return {
            similarity: similarity,
            matches: matches,
            matchCount: matches.length,
            details: {
                patterns1: patterns1.length,
                patterns2: patterns2.length,
                signatureMatches: matches.length
            }
        };
    }
   
    // Сравнение сигнатур паттернов
    comparePatternSignatures(sig1, sig2) {
        if (!sig1 || !sig2) return 0;
       
        // Простое сравнение строк
        if (sig1 === sig2) return 1.0;
       
        // Более сложное сравнение (можно улучшить)
        const parts1 = sig1.split('_');
        const parts2 = sig2.split('_');
       
        if (parts1.length !== 2 || parts2.length !== 2) return 0;
       
        const distances1 = parts1[0].split('-').map(parseFloat);
        const distances2 = parts2[0].split('-').map(parseFloat);
       
        const angles1 = parts1[1].split('-').map(parseFloat);
        const angles2 = parts2[1].split('-').map(parseFloat);
       
        // Сравниваем расстояния
        let distanceSimilarity = 0;
        if (distances1.length === distances2.length) {
            let totalDiff = 0;
            for (let i = 0; i < distances1.length; i++) {
                totalDiff += Math.abs(distances1[i] - distances2[i]);
            }
            distanceSimilarity = 1 - Math.min(1, totalDiff);
        }
       
        // Сравниваем углы (с учетом цикличности)
        let angleSimilarity = 0;
        if (angles1.length === angles2.length) {
            let totalDiff = 0;
            for (let i = 0; i < angles1.length; i++) {
                const diff = Math.abs(angles1[i] - angles2[i]);
                const cyclicDiff = Math.min(diff, 360 - diff);
                totalDiff += cyclicDiff / 360;
            }
            angleSimilarity = 1 - (totalDiff / angles1.length);
        }
       
        // Комбинируем
        return (distanceSimilarity * 0.6 + angleSimilarity * 0.4);
    }
   
    // Комбинирование результатов паттернов и точек
    combinePatternAndPointResults(patternResult, pointResult) {
        const patternWeight = 0.6;
        const pointWeight = 0.4;
       
        const patternSimilarity = patternResult.similarity || 0;
        const pointSimilarity = pointResult.matchRate || 0;
       
        const combinedSimilarity =
            patternSimilarity * patternWeight +
            pointSimilarity * pointWeight;
       
        return {
            similarity: combinedSimilarity,
            patternSimilarity: patternSimilarity,
            pointSimilarity: pointSimilarity,
            weights: {
                pattern: patternWeight,
                point: pointWeight
            },
            details: {
                patternMatches: patternResult.matchCount,
                pointMatches: pointResult.matchCount
            }
        };
    }
   
    // 🔥 НОВЫЕ МЕТОДЫ ДЛЯ ДИАГНОСТИКИ
   
    // Диагностика сравнения двух отпечатков
    async diagnoseComparison(footprint1, footprint2) {
        console.log('\n🔍 ПОЛНАЯ ДИАГНОСТИКА СРАВНЕНИЯ ДВУХ ОТПЕЧАТКОВ');
       
        const diagnosis = {
            timestamp: new Date(),
            footprint1: { id: footprint1.id, name: footprint1.name },
            footprint2: { id: footprint2.id, name: footprint2.name },
            steps: [],
            results: {}
        };
       
        try {
            // 1. Базовая информация
            diagnosis.steps.push({
                step: 'basic_info',
                success: true,
                details: {
                    points1: footprint1.graph?.nodes?.size || 0,
                    points2: footprint2.graph?.nodes?.size || 0,
                    confidence1: footprint1.stats?.confidence || 0,
                    confidence2: footprint2.stats?.confidence || 0
                }
            });
           
            // 2. Системы координат
            console.log('\n📊 АНАЛИЗ СИСТЕМ КООРДИНАТ:');
            const coordinateAnalysis = this.coordinateSystemLogger.compareCoordinateSystems(
                footprint1,
                footprint2,
                { title: 'Диагностика сравнения', detailed: true }
            );
           
            diagnosis.steps.push({
                step: 'coordinate_analysis',
                success: true,
                details: coordinateAnalysis
            });
           
            // 3. Трансформации
            console.log('\n🔄 АНАЛИЗ ТРАНСФОРМАЦИЙ:');
            const transformationCheck = this.checkTransformations(footprint1, footprint2);
           
            diagnosis.steps.push({
                step: 'transformation_check',
                success: transformationCheck.consistent,
                details: transformationCheck
            });
           
            // 4. Сравнение всеми методами
            console.log('\n🎯 СРАВНЕНИЕ ВСЕМИ ДОСТУПНЫМИ МЕТОДАМИ:');
           
            const methods = ['alignment', 'coordinate_conversion', 'pattern'];
            const comparisonResults = {};
           
            for (const method of methods) {
                try {
                    console.log(`\n  Тестирую метод: ${method}`);
                   
                    let result;
                    switch (method) {
                        case 'alignment':
                            result = await this.compareWithAlignment(footprint1, footprint2);
                            break;
                        case 'coordinate_conversion':
                            result = await this.compareWithCoordinateConversion(footprint1, footprint2);
                            break;
                        case 'pattern':
                            result = await this.compareWithPatterns(footprint1, footprint2);
                            break;
                    }
                   
                    comparisonResults[method] = result;
                   
                    diagnosis.steps.push({
                        step: `comparison_${method}`,
                        success: result.success || false,
                        details: {
                            similarity: result.similarity,
                            decision: result.decision,
                            executionTime: result.executionTime
                        }
                    });
                   
                } catch (error) {
                    console.log(`  ❌ Ошибка метода ${method}: ${error.message}`);
                    diagnosis.steps.push({
                        step: `comparison_${method}`,
                        success: false,
                        error: error.message
                    });
                }
            }
           
            diagnosis.results = comparisonResults;
           
            // 5. Анализ результатов
            console.log('\n📈 АНАЛИЗ РЕЗУЛЬТАТОВ:');
            const finalAnalysis = this.analyzeDiagnosticResults(comparisonResults);
            diagnosis.finalAnalysis = finalAnalysis;
           
            // 6. Рекомендации
            console.log('\n💡 РЕКОМЕНДАЦИИ:');
            const recommendations = this.generateDiagnosticRecommendations(diagnosis);
            diagnosis.recommendations = recommendations;
           
            recommendations.forEach((rec, index) => {
                console.log(`  ${index + 1}. ${rec}`);
            });
           
            diagnosis.success = true;
           
            console.log('\n✅ ДИАГНОСТИКА ЗАВЕРШЕНА');
           
        } catch (error) {
            console.log(`❌ Ошибка диагностики: ${error.message}`);
            diagnosis.success = false;
            diagnosis.error = error.message;
        }
       
        return diagnosis;
    }
   
    // Анализ диагностических результатов
    analyzeDiagnosticResults(comparisonResults) {
        const analysis = {
            methods: {},
            consensus: {
                decision: 'unknown',
                confidence: 0,
                agreement: 0
            },
            conflicts: []
        };
       
        const decisions = [];
        const similarities = [];
       
        // Собираем результаты всех методов
        Object.entries(comparisonResults).forEach(([method, result]) => {
            if (result.success) {
                analysis.methods[method] = {
                    similarity: result.similarity,
                    decision: result.decision,
                    confidence: this.calculateMethodConfidence(result)
                };
               
                decisions.push(result.decision);
                similarities.push(result.similarity);
            }
        });
       
        // Определяем консенсус
        if (decisions.length > 0) {
            // Наиболее частое решение
            const decisionCounts = {};
            decisions.forEach(decision => {
                decisionCounts[decision] = (decisionCounts[decision] || 0) + 1;
            });
           
            let maxCount = 0;
            let consensusDecision = 'unknown';
           
            Object.entries(decisionCounts).forEach(([decision, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    consensusDecision = decision;
                }
            });
           
            analysis.consensus.decision = consensusDecision;
            analysis.consensus.agreement = maxCount / decisions.length;
           
            // Средняя уверенность
            const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
            analysis.consensus.confidence = avgSimilarity;
           
            // Поиск конфликтов
            Object.entries(analysis.methods).forEach(([method1, result1]) => {
                Object.entries(analysis.methods).forEach(([method2, result2]) => {
                    if (method1 !== method2 && result1.decision !== result2.decision) {
                        analysis.conflicts.push({
                            methods: [method1, method2],
                            decisions: [result1.decision, result2.decision],
                            similarityDiff: Math.abs(result1.similarity - result2.similarity)
                        });
                    }
                });
            });
        }
       
        return analysis;
    }
   
    // Расчет уверенности метода
    calculateMethodConfidence(result) {
        let confidence = result.similarity || 0;
       
        // Корректируем на основе статистики
        if (result.stats) {
            if (result.stats.matchRate > 0.7) confidence *= 1.1;
            if (result.stats.transformationConsistent) confidence *= 1.05;
            if (result.stats.alignmentError < 20) confidence *= 1.05;
        }
       
        return Math.min(1, confidence);
    }
   
    // Генерация рекомендаций
    generateDiagnosticRecommendations(diagnosis) {
        const recommendations = [];
       
        // Проверяем трансформации
        const transformationStep = diagnosis.steps.find(s => s.step === 'transformation_check');
        if (transformationStep && !transformationStep.success) {
            recommendations.push('Трансформации не согласованы. Используйте метод выравнивания.');
        }
       
        // Проверяем конфликты в результатах
        if (diagnosis.finalAnalysis?.conflicts?.length > 0) {
            recommendations.push('Обнаружены конфликты между методами сравнения. Проверьте системы координат.');
        }
       
        // Проверяем количество точек
        const basicInfo = diagnosis.steps.find(s => s.step === 'basic_info');
        if (basicInfo) {
            const points1 = basicInfo.details.points1;
            const points2 = basicInfo.details.points2;
           
            if (points1 < 10 || points2 < 10) {
                recommendations.push(`Мало точек для сравнения: ${points1} и ${points2}. Добавьте больше фото.`);
            }
        }
       
        // Проверяем согласованность решений
        if (diagnosis.finalAnalysis?.consensus?.agreement < 0.7) {
            recommendations.push('Нет согласия между методами сравнения. Требуется ручная проверка.');
        }
       
        // Если нет рекомендаций, добавляем стандартную
        if (recommendations.length === 0) {
            recommendations.push('Система работает корректно. Используйте любой метод сравнения.');
        }
       
        return recommendations;
    }
}

module.exports = FootprintComparisonEngine;
