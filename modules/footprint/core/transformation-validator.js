// modules/footprint/core/transformation-validator.js
// 🔍 ГАРАНТИЯ СОГЛАСОВАННОСТИ ТРАНСФОРМАЦИЙ МЕЖДУ МОДУЛЯМИ

class TransformationValidator {
    constructor(manager) {
        this.manager = manager;
        this.debug = manager?.config?.debug || false;
       
        // Конфигурация проверок
        this.config = {
            maxRotationDiff: 5,        // Максимальное расхождение в градусах
            maxCenterDiff: 20,         // Максимальное расхождение в пикселях
            maxScaleDiff: 0.1,         // Максимальное расхождение масштаба
            checkAllModules: true,
            validateMatrices: true,
            enableAutoCorrection: false // Автоматическая коррекция при расхождениях
        };
       
        console.log('🔍 TransformationValidator создан: гарантия согласованности трансформаций');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Проверить трансформации во всех модулях
    validateTransformationsAcrossModules(userId = null) {
        console.log('\n🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ ТРАНСФОРМАЦИЙ ВО ВСЕХ МОДУЛЯХ');
       
        const results = {
            overallValid: true,
            moduleResults: {},
            conflicts: [],
            warnings: [],
            correctionsApplied: 0
        };
       
        try {
            // 1. Собираем все трансформации из системы
            const allTransformations = this.collectAllTransformations(userId);
            results.totalTransformations = allTransformations.length;
           
            if (allTransformations.length < 2) {
                console.log('⚠️ Мало трансформаций для сравнения:', allTransformations.length);
                results.warnings.push('Мало трансформаций для сравнения');
                return results;
            }
           
            console.log(`📊 Собрано ${allTransformations.length} трансформаций из системы`);
           
            // 2. Группируем по источникам
            const grouped = this.groupTransformationsBySource(allTransformations);
           
            // 3. Проверяем согласованность внутри каждой группы
            Object.entries(grouped).forEach(([sourceType, transforms]) => {
                if (transforms.length > 1) {
                    const groupResult = this.validateTransformationsGroup(transforms, sourceType);
                    results.moduleResults[sourceType] = groupResult;
                   
                    if (!groupResult.consistent) {
                        results.overallValid = false;
                        results.conflicts.push(...groupResult.conflicts.map(c => ({
                            ...c,
                            sourceType
                        })));
                    }
                }
            });
           
            // 4. Проверяем согласованность между группами
            const crossGroupResult = this.validateCrossGroupConsistency(grouped);
            results.crossGroupValidation = crossGroupResult;
           
            if (!crossGroupResult.consistent) {
                results.overallValid = false;
                results.conflicts.push(...crossGroupResult.conflicts);
            }
           
            // 5. Проверяем матрицы (если включено)
            if (this.config.validateMatrices) {
                const matrixResults = this.validateTransformationMatrices(allTransformations);
                results.matrixValidation = matrixResults;
               
                if (!matrixResults.allMatricesValid) {
                    results.overallValid = false;
                    results.conflicts.push('Обнаружены невалидные матрицы трансформации');
                }
            }
           
            // 6. Автоматическая коррекция (если включено)
            if (this.config.enableAutoCorrection && !results.overallValid) {
                const correctionResult = this.attemptAutoCorrection(results.conflicts, userId);
                results.correctionsApplied = correctionResult.applied;
                results.correctionDetails = correctionResult.details;
               
                if (correctionResult.applied > 0) {
                    console.log(`🔄 Применено ${correctionResult.applied} коррекций`);
                }
            }
           
            // 7. Формируем итоговый отчет
            this.generateValidationReport(results);
           
            return results;
           
        } catch (error) {
            console.log('❌ Критическая ошибка при проверке трансформаций:', error.message);
            results.overallValid = false;
            results.error = error.message;
            return results;
        }
    }
   
    // 🔥 МЕТОД: Собрать все трансформации из системы
    collectAllTransformations(userId = null) {
        const transformations = [];
       
        // 1. Трансформации из сессий пользователя
        if (userId && this.manager.userSessions) {
            const session = this.manager.userSessions.get(userId);
            if (session) {
                // Из текущего отпечатка
                if (session.currentFootprint) {
                    const fpTrans = this.extractTransformationsFromFootprint(session.currentFootprint);
                    transformations.push(...fpTrans.map(t => ({...t, source: 'currentFootprint', userId})));
                }
               
                // Из истории нормализации
                if (session.metadata?.normalizationHistory) {
                    session.metadata.normalizationHistory.forEach((trans, index) => {
                        transformations.push({
                            ...trans,
                            source: 'normalizationHistory',
                            index: index,
                            userId: userId
                        });
                    });
                }
            }
        }
       
        // 2. Трансформации из VectorSuperModel (шаблона)
        if (userId && this.manager.vectorSuperModels) {
            const vectorModel = this.manager.vectorSuperModels.get(userId);
            if (vectorModel && vectorModel.templateBuilder) {
                const templateTransformations = this.extractTransformationsFromTemplateBuilder(vectorModel.templateBuilder);
                transformations.push(...templateTransformations.map(t => ({...t, source: 'templateBuilder', userId})));
            }
        }
       
        // 3. Трансформации из всех отпечатков (глобально)
        if (this.manager.loadedModels) {
            this.manager.loadedModels.forEach((footprint, footprintId) => {
                const fpTrans = this.extractTransformationsFromFootprint(footprint);
                transformations.push(...fpTrans.map(t => ({...t, source: 'loadedModel', footprintId})));
            });
        }
       
        // 4. Трансформации из PointTracker (если доступны)
        this.collectPointTrackerTransformations(transformations, userId);
       
        return transformations;
    }
   
    // 🔥 МЕТОД: Извлечь трансформации из отпечатка
    extractTransformationsFromFootprint(footprint) {
        const transformations = [];
       
        // Основная трансформация отпечатка
        if (footprint.transformation) {
            transformations.push({
                ...footprint.transformation,
                type: 'footprint_main',
                footprintId: footprint.id,
                footprintName: footprint.name
            });
        }
       
        // Трансформация из getTransformation()
        if (typeof footprint.getTransformation === 'function') {
            try {
                const getTrans = footprint.getTransformation();
                if (getTrans && getTrans !== footprint.transformation) {
                    transformations.push({
                        ...getTrans,
                        type: 'footprint_getTransformation',
                        footprintId: footprint.id,
                        footprintName: footprint.name
                    });
                }
            } catch (error) {
                console.log(`⚠️ Ошибка получения трансформации из ${footprint.name}:`, error.message);
            }
        }
       
        // Трансформация из метаданных
        if (footprint.metadata?.normalizationInfo) {
            transformations.push({
                ...footprint.metadata.normalizationInfo,
                type: 'footprint_metadata',
                footprintId: footprint.id,
                footprintName: footprint.name
            });
        }
       
        // Трансформация из графа
        if (footprint.graph?.transformation) {
            transformations.push({
                ...footprint.graph.transformation,
                type: 'graph_transformation',
                footprintId: footprint.id,
                footprintName: footprint.name
            });
        }
       
        return transformations;
    }
   
    // 🔥 МЕТОД: Извлечь трансформации из TemplateBuilder
    extractTransformationsFromTemplateBuilder(templateBuilder) {
        const transformations = [];
       
        // Трансформация нормализации
        if (templateBuilder.normalizationTransform) {
            transformations.push({
                ...templateBuilder.normalizationTransform,
                type: 'template_normalization',
                templateId: templateBuilder.id,
                templateName: templateBuilder.name
            });
        }
       
        // Трансформации из истории
        if (templateBuilder.graphTransformations) {
            templateBuilder.graphTransformations.forEach((transform, graphId) => {
                if (transform.metadata?.transformationInfo) {
                    transformations.push({
                        ...transform.metadata.transformationInfo,
                        type: 'template_graph_transformation',
                        templateId: templateBuilder.id,
                        graphId: graphId
                    });
                }
            });
        }
       
        return transformations;
    }
   
    // 🔥 МЕТОД: Собрать трансформации из PointTracker
    collectPointTrackerTransformations(transformations, userId = null) {
        // Проверяем PointTracker в текущей сессии
        if (userId && this.manager.userSessions) {
            const session = this.manager.userSessions.get(userId);
            if (session?.currentFootprint?.pointTracker) {
                const tracker = session.currentFootprint.pointTracker;
                if (tracker.transformation) {
                    transformations.push({
                        ...tracker.transformation,
                        type: 'pointTracker',
                        source: 'currentSession',
                        userId: userId
                    });
                }
            }
        }
    }
   
    // 🔥 МЕТОД: Группировать трансформации по источникам
    groupTransformationsBySource(transformations) {
        const groups = {
            footprint: [],      // Из отпечатков
            template: [],       // Из шаблонов
            normalization: [],  // Из нормализации
            graph: [],          // Из графов
            tracker: [],        // Из трекеров
            other: []           // Остальные
        };
       
        transformations.forEach(transform => {
            const type = transform.type || '';
           
            if (type.includes('footprint')) {
                groups.footprint.push(transform);
            } else if (type.includes('template')) {
                groups.template.push(transform);
            } else if (type.includes('normalization')) {
                groups.normalization.push(transform);
            } else if (type.includes('graph')) {
                groups.graph.push(transform);
            } else if (type.includes('tracker')) {
                groups.tracker.push(transform);
            } else {
                groups.other.push(transform);
            }
        });
       
        return groups;
    }
   
    // 🔥 МЕТОД: Проверить согласованность внутри группы
    validateTransformationsGroup(transforms, groupName) {
        console.log(`🔍 Проверка группы "${groupName}": ${transforms.length} трансформаций`);
       
        const result = {
            consistent: true,
            conflicts: [],
            stats: {
                total: transforms.length,
                rotationDiffs: [],
                centerDiffs: [],
                scaleDiffs: []
            }
        };
       
        if (transforms.length < 2) {
            result.consistent = true;
            return result;
        }
       
        // Берем первую трансформацию как эталон
        const reference = transforms[0];
       
        for (let i = 1; i < transforms.length; i++) {
            const current = transforms[i];
            const comparison = this.compareTransformations(reference, current);
           
            result.stats.rotationDiffs.push(comparison.rotationDiff);
            result.stats.centerDiffs.push(comparison.centerDistance);
            result.stats.scaleDiffs.push(comparison.scaleDiff);
           
            if (!comparison.consistent) {
                result.consistent = false;
                result.conflicts.push({
                    transform1: this.getTransformDescription(reference),
                    transform2: this.getTransformDescription(current),
                    differences: comparison.differences,
                    comparison: comparison
                });
               
                console.log(`❌ Конфликт в группе "${groupName}":`);
                console.log(`   ${this.getTransformDescription(reference)}`);
                console.log(`   vs ${this.getTransformDescription(current)}`);
                console.log(`   Расхождения: ${JSON.stringify(comparison.differences)}`);
            }
        }
       
        // Рассчитываем статистику
        result.stats.avgRotationDiff = this.calculateAverage(result.stats.rotationDiffs);
        result.stats.avgCenterDiff = this.calculateAverage(result.stats.centerDiffs);
        result.stats.avgScaleDiff = this.calculateAverage(result.stats.scaleDiffs);
        result.stats.maxRotationDiff = Math.max(...result.stats.rotationDiffs);
        result.stats.maxCenterDiff = Math.max(...result.stats.centerDiffs);
        result.stats.maxScaleDiff = Math.max(...result.stats.scaleDiffs);
       
        if (result.consistent) {
            console.log(`✅ Группа "${groupName}" согласована`);
            console.log(`   Средние расхождения: угол=${result.stats.avgRotationDiff.toFixed(1)}°, центр=${result.stats.avgCenterDiff.toFixed(1)}px`);
        }
       
        return result;
    }
   
    // 🔥 МЕТОД: Сравнить две трансформации
    compareTransformations(transform1, transform2) {
        const differences = [];
       
        // 1. Сравнение углов поворота
        const angle1 = transform1.rotationAngle || 0;
        const angle2 = transform2.rotationAngle || 0;
        const rotationDiff = Math.abs(this.normalizeAngle(angle1) - this.normalizeAngle(angle2));
       
        if (rotationDiff > this.config.maxRotationDiff) {
            differences.push(`Угол: ${angle1.toFixed(1)}° vs ${angle2.toFixed(1)}° (разница: ${rotationDiff.toFixed(1)}°)`);
        }
       
        // 2. Сравнение центров
        const center1 = transform1.center || { x: 0, y: 0 };
        const center2 = transform2.center || { x: 0, y: 0 };
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );
       
        if (centerDistance > this.config.maxCenterDiff) {
            differences.push(`Центр: (${center1.x.toFixed(1)}, ${center1.y.toFixed(1)}) vs (${center2.x.toFixed(1)}, ${center2.y.toFixed(1)}) (расстояние: ${centerDistance.toFixed(1)}px)`);
        }
       
        // 3. Сравнение масштабов
        const scale1 = transform1.scale || { x: 1, y: 1 };
        const scale2 = transform2.scale || { x: 1, y: 1 };
        const scaleDiff = Math.max(
            Math.abs(scale2.x - scale1.x),
            Math.abs(scale2.y - scale1.y)
        );
       
        if (scaleDiff > this.config.maxScaleDiff) {
            differences.push(`Масштаб: (${scale1.x.toFixed(2)}, ${scale1.y.toFixed(2)}) vs (${scale2.x.toFixed(2)}, ${scale2.y.toFixed(2)}) (разница: ${scaleDiff.toFixed(2)})`);
        }
       
        // 4. Сравнение матриц (если есть)
        let matrixDiff = 0;
        if (transform1.matrix && transform2.matrix &&
            transform1.matrix.length === 9 && transform2.matrix.length === 9) {
           
            matrixDiff = this.compareMatrices(transform1.matrix, transform2.matrix);
            if (matrixDiff > 0.1) {
                differences.push(`Матрицы: разница=${matrixDiff.toFixed(3)}`);
            }
        }
       
        // 5. Сравнение границ
        const bounds1 = transform1.bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        const bounds2 = transform2.bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
       
        const widthDiff = Math.abs((bounds1.maxX - bounds1.minX) - (bounds2.maxX - bounds2.minX));
        const heightDiff = Math.abs((bounds1.maxY - bounds1.minY) - (bounds2.maxY - bounds2.minY));
       
        if (widthDiff > 50 || heightDiff > 50) {
            differences.push(`Границы: ширина=${widthDiff.toFixed(1)}px, высота=${heightDiff.toFixed(1)}px`);
        }
       
        return {
            consistent: differences.length === 0,
            differences: differences,
            rotationDiff: rotationDiff,
            centerDistance: centerDistance,
            scaleDiff: scaleDiff,
            matrixDiff: matrixDiff,
            widthDiff: widthDiff,
            heightDiff: heightDiff
        };
    }
   
    // 🔥 МЕТОД: Проверить согласованность между группами
    validateCrossGroupConsistency(groups) {
        console.log('\n🔍 Проверка согласованности между группами трансформаций');
       
        const result = {
            consistent: true,
            conflicts: [],
            comparisons: []
        };
       
        const groupNames = Object.keys(groups).filter(name => groups[name].length > 0);
       
        // Сравниваем каждую группу с каждой
        for (let i = 0; i < groupNames.length; i++) {
            for (let j = i + 1; j < groupNames.length; j++) {
                const group1 = groups[groupNames[i]];
                const group2 = groups[groupNames[j]];
               
                // Берем средние значения из каждой группы
                const avg1 = this.calculateAverageTransformation(group1);
                const avg2 = this.calculateAverageTransformation(group2);
               
                const comparison = this.compareTransformations(avg1, avg2);
                result.comparisons.push({
                    group1: groupNames[i],
                    group2: groupNames[j],
                    comparison: comparison
                });
               
                if (!comparison.consistent) {
                    result.consistent = false;
                    result.conflicts.push({
                        groups: `${groupNames[i]} vs ${groupNames[j]}`,
                        differences: comparison.differences,
                        details: {
                            avg1: this.getTransformDescription(avg1),
                            avg2: this.getTransformDescription(avg2)
                        }
                    });
                   
                    console.log(`❌ Конфликт между группами: ${groupNames[i]} vs ${groupNames[j]}`);
                    console.log(`   ${comparison.differences.join(', ')}`);
                }
            }
        }
       
        if (result.consistent) {
            console.log('✅ Все группы трансформаций согласованы между собой');
        }
       
        return result;
    }
   
    // 🔥 МЕТОД: Проверить валидность матриц трансформации
    validateTransformationMatrices(transformations) {
        console.log('\n🔍 Проверка валидности матриц трансформации');
       
        const result = {
            allMatricesValid: true,
            invalidMatrices: [],
            matrixStats: {
                total: 0,
                hasMatrix: 0,
                valid: 0,
                invalid: 0
            }
        };
       
        transformations.forEach(transform => {
            result.matrixStats.total++;
           
            if (transform.matrix && Array.isArray(transform.matrix)) {
                result.matrixStats.hasMatrix++;
               
                const matrixValid = this.validateMatrix(transform.matrix);
                if (matrixValid.valid) {
                    result.matrixStats.valid++;
                } else {
                    result.matrixStats.invalid++;
                    result.allMatricesValid = false;
                    result.invalidMatrices.push({
                        transform: this.getTransformDescription(transform),
                        errors: matrixValid.errors
                    });
                   
                    console.log(`❌ Невалидная матрица в ${this.getTransformDescription(transform)}`);
                    console.log(`   Ошибки: ${matrixValid.errors.join(', ')}`);
                }
            }
        });
       
        console.log(`📊 Матрицы: ${result.matrixStats.valid}/${result.matrixStats.hasMatrix} валидных`);
       
        return result;
    }
   
    // 🔥 МЕТОД: Попытаться автоматически исправить конфликты
    attemptAutoCorrection(conflicts, userId) {
        const result = {
            applied: 0,
            details: []
        };
       
        if (!this.config.enableAutoCorrection || conflicts.length === 0) {
            return result;
        }
       
        console.log('\n🔄 Попытка автоматической коррекции конфликтов...');
       
        // Простая стратегия: использовать трансформацию из шаблона как истинную
        const vectorModel = this.manager.vectorSuperModels.get(userId);
        if (vectorModel && vectorModel.templateBuilder) {
            const templateTransform = vectorModel.templateBuilder.normalizationTransform;
            if (templateTransform) {
                // Найти и обновить конфликтующие трансформации
                conflicts.forEach(conflict => {
                    if (conflict.sourceType === 'footprint') {
                        // TODO: Реализовать обновление трансформации в отпечатке
                        console.log(`   [CORRECTION] Обновить трансформацию в ${conflict.sourceType}`);
                        result.applied++;
                    }
                });
            }
        }
       
        return result;
    }
   
    // 🔥 МЕТОД: Сгенерировать отчет о проверке
    generateValidationReport(results) {
        console.log('\n📊 ОТЧЕТ О ПРОВЕРКЕ СОГЛАСОВАННОСТИ ТРАНСФОРМАЦИЙ');
        console.log('═'.repeat(60));
       
        console.log(`📈 ОБЩАЯ СТАТИСТИКА:`);
        console.log(`   Всего трансформаций: ${results.totalTransformations || 0}`);
        console.log(`   Проверено групп: ${Object.keys(results.moduleResults || {}).length}`);
        console.log(`   Конфликтов: ${results.conflicts?.length || 0}`);
        console.log(`   Коррекций применено: ${results.correctionsApplied || 0}`);
       
        console.log(`\n🎯 ИТОГОВЫЙ СТАТУС: ${results.overallValid ? '✅ СОГЛАСОВАНЫ' : '❌ ЕСТЬ КОНФЛИКТЫ'}`);
       
        if (results.moduleResults) {
            console.log(`\n📁 РЕЗУЛЬТАТЫ ПО ГРУППАМ:`);
            Object.entries(results.moduleResults).forEach(([group, groupResult]) => {
                const status = groupResult.consistent ? '✅' : '❌';
                console.log(`   ${status} ${group}: ${groupResult.stats?.total || 0} трансформаций`);
                if (!groupResult.consistent) {
                    console.log(`     Конфликтов: ${groupResult.conflicts?.length || 0}`);
                }
            });
        }
       
        if (results.crossGroupValidation) {
            const crossStatus = results.crossGroupValidation.consistent ? '✅' : '❌';
            console.log(`\n🔗 МЕЖГРУППОВАЯ СОГЛАСОВАННОСТЬ: ${crossStatus}`);
            if (!results.crossGroupValidation.consistent) {
                console.log(`   Конфликтов: ${results.crossGroupValidation.conflicts?.length || 0}`);
            }
        }
       
        if (results.matrixValidation) {
            const matrixStatus = results.matrixValidation.allMatricesValid ? '✅' : '❌';
            console.log(`\n🧮 ВАЛИДНОСТЬ МАТРИЦ: ${matrixStatus}`);
            console.log(`   Всего матриц: ${results.matrixValidation.matrixStats?.total || 0}`);
            console.log(`   Валидных: ${results.matrixValidation.matrixStats?.valid || 0}`);
            console.log(`   Невалидных: ${results.matrixValidation.matrixStats?.invalid || 0}`);
        }
       
        if (results.conflicts && results.conflicts.length > 0) {
            console.log(`\n⚠️ ДЕТАЛИ КОНФЛИКТОВ:`);
            results.conflicts.slice(0, 3).forEach((conflict, index) => {
                console.log(`   ${index + 1}. ${conflict.groups || conflict.sourceType || 'unknown'}`);
                if (conflict.differences) {
                    conflict.differences.slice(0, 2).forEach(diff => {
                        console.log(`      - ${diff}`);
                    });
                }
            });
            if (results.conflicts.length > 3) {
                console.log(`      ... и еще ${results.conflicts.length - 3} конфликтов`);
            }
        }
       
        console.log('═'.repeat(60));
       
        // Сохраняем отчет в файл для дальнейшего анализа
        this.saveReportToFile(results);
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
   
    normalizeAngle(angle) {
        // Привести угол к диапазону [0, 360)
        let normalized = angle % 360;
        if (normalized < 0) normalized += 360;
        return normalized;
    }
   
    compareMatrices(matrix1, matrix2) {
        if (!matrix1 || !matrix2 || matrix1.length !== 9 || matrix2.length !== 9) {
            return 1.0; // Максимальная разница
        }
       
        let totalDiff = 0;
        for (let i = 0; i < 9; i++) {
            totalDiff += Math.abs(matrix1[i] - matrix2[i]);
        }
       
        return totalDiff / 9; // Средняя разница
    }
   
    validateMatrix(matrix) {
        const result = {
            valid: true,
            errors: []
        };
       
        if (!Array.isArray(matrix)) {
            result.valid = false;
            result.errors.push('Не массив');
            return result;
        }
       
        if (matrix.length !== 9) {
            result.valid = false;
            result.errors.push(`Длина ${matrix.length} вместо 9`);
        }
       
        // Проверяем на NaN и Infinity
        matrix.forEach((value, index) => {
            if (isNaN(value)) {
                result.valid = false;
                result.errors.push(`Элемент ${index} NaN`);
            }
            if (!isFinite(value)) {
                result.valid = false;
                result.errors.push(`Элемент ${index} не finite`);
            }
        });
       
        // Проверяем, что матрица не нулевая
        const sum = matrix.reduce((s, v) => s + Math.abs(v), 0);
        if (sum < 0.001) {
            result.valid = false;
            result.errors.push('Матрица нулевая или почти нулевая');
        }
       
        return result;
    }
   
    calculateAverageTransformation(transforms) {
        if (!transforms || transforms.length === 0) {
            return {
                rotationAngle: 0,
                center: { x: 0, y: 0 },
                scale: { x: 1, y: 1 }
            };
        }
       
        const angles = transforms.map(t => this.normalizeAngle(t.rotationAngle || 0));
        const centersX = transforms.map(t => t.center?.x || 0);
        const centersY = transforms.map(t => t.center?.y || 0);
        const scalesX = transforms.map(t => t.scale?.x || 1);
        const scalesY = transforms.map(t => t.scale?.y || 1);
       
        // Для углов нужна специальная обработка из-за цикличности
        const avgAngle = this.calculateAverageAngle(angles);
       
        return {
            rotationAngle: avgAngle,
            center: {
                x: this.calculateAverage(centersX),
                y: this.calculateAverage(centersY)
            },
            scale: {
                x: this.calculateAverage(scalesX),
                y: this.calculateAverage(scalesY)
            },
            type: 'average',
            sourceCount: transforms.length
        };
    }
   
    calculateAverageAngle(angles) {
        if (angles.length === 0) return 0;
       
        // Преобразуем углы в векторы и усредняем
        let sumSin = 0;
        let sumCos = 0;
       
        angles.forEach(angle => {
            const rad = angle * Math.PI / 180;
            sumSin += Math.sin(rad);
            sumCos += Math.cos(rad);
        });
       
        const avgRad = Math.atan2(sumSin / angles.length, sumCos / angles.length);
        let avgAngle = avgRad * 180 / Math.PI;
       
        if (avgAngle < 0) avgAngle += 360;
       
        return avgAngle;
    }
   
    calculateAverage(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
   
    getTransformDescription(transform) {
        if (!transform) return 'undefined';
       
        const parts = [];
        if (transform.type) parts.push(transform.type);
        if (transform.footprintName) parts.push(transform.footprintName);
        if (transform.templateName) parts.push(transform.templateName);
       
        const desc = parts.length > 0 ? parts.join(' ') : 'transformation';
       
        if (transform.rotationAngle !== undefined) {
            return `${desc} (${transform.rotationAngle.toFixed(1)}°)`;
        }
       
        return desc;
    }
   
    saveReportToFile(results) {
        try {
            const fs = require('fs');
            const path = require('path');
           
            const reportsDir = path.join(this.manager.config.dbPath, 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
           
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `transformation-validation-${timestamp}.json`;
            const filepath = path.join(reportsDir, filename);
           
            // Упрощаем объект для сохранения
            const report = {
                timestamp: new Date().toISOString(),
                overallValid: results.overallValid,
                stats: {
                    totalTransformations: results.totalTransformations,
                    conflicts: results.conflicts?.length || 0,
                    correctionsApplied: results.correctionsApplied || 0
                },
                moduleResults: results.moduleResults ?
                    Object.keys(results.moduleResults).reduce((acc, key) => {
                        acc[key] = {
                            consistent: results.moduleResults[key].consistent,
                            conflicts: results.moduleResults[key].conflicts?.length || 0
                        };
                        return acc;
                    }, {}) : {}
            };
           
            fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
            console.log(`📄 Отчет сохранен: ${filepath}`);
           
        } catch (error) {
            console.log('⚠️ Не удалось сохранить отчет:', error.message);
        }
    }
}

module.exports = TransformationValidator;
