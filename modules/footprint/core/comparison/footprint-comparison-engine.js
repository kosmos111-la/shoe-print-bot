// modules/footprint/core/comparison/footprint-comparison-engine.js
// 🔥 ВЫНЕСЕННАЯ ЛОГИКА СРАВНЕНИЯ СЛЕДОВ (ИСПРАВЛЕННАЯ)

const path = require('path');

class FootprintComparisonEngine {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;

        // Импорты для зависимостей
        this.RotationInvariance = require('../../rotation-invariance');
        this.SimpleGraph = require('../../simple-graph');
    }

    // 🔥 ОСНОВНОЙ МЕТОД СРАВНЕНИЯ С ИСПОЛЬЗОВАНИЕМ ВЫНЕСЕННЫХ МОДУЛЕЙ
    async compareWithAlignment(footprint1, footprint2) {
        console.log(`🎯 Сравнение с ВЫРАВНИВАНИЕМ: "${footprint1.name}" vs "${footprint2.name}"`);

        // 1. ДЕБАГ ТРАНСФОРМАЦИЙ
        const debugResult = this.manager.transformationDebugger ?
            this.manager.transformationDebugger.analyzeTransformation(footprint1, footprint2) :
            { summary: { needsCorrection: false } };

        // 2. ВАЛИДАЦИЯ СИСТЕМ КООРДИНАТ
        const validationResult = this.manager.coordinateValidator ?
            this.manager.coordinateValidator.validateCoordinateSystems(footprint1, footprint2) :
            { needsCorrection: false, compatible: true };

        // 3. ПОДГОТОВКА ДАННЫХ ДЛЯ СРАВНЕНИЯ
        const points1 = this.getPointsInConsistentSystem(footprint1);
        const points2 = this.getPointsInConsistentSystem(footprint2);

        console.log(`📊 Точки для сравнения: ${points1.length} и ${points2.length}`);

        // 4. ВЫБОР МЕТОДА ВЫРАВНИВАНИЯ
        let alignmentResult;

        if ((validationResult.needsCorrection || (debugResult.summary && debugResult.summary.needsCorrection)) &&
            this.manager.improvedAligner) {
            console.log(`🔄 Использую улучшенное выравнивание с коррекцией`);
            alignmentResult = await this.manager.improvedAligner.alignWithIntelligentMatching(
                points2, points1,
                footprint2.getTransformation ? footprint2.getTransformation() : null,
                footprint1.getTransformation ? footprint1.getTransformation() : null
            );
        } else if (this.manager.aligner) {
            console.log(`🔄 Использую стандартное выравнивание`);
            alignmentResult = await this.manager.aligner.testAlignment(
                footprint1, footprint2,
                (footprint2.getTransformation ? footprint2.getTransformation() : null) || this.createIdentityTransformation(),
                (footprint1.getTransformation ? footprint1.getTransformation() : null) || this.createIdentityTransformation()
            );
        } else {
            // Фоллбэк: прямое сравнение
            console.log(`⚠️ Алайнеры не доступны, использую прямое сравнение`);
            alignmentResult = {
                success: true,
                alignedPoints: points2,
                method: 'direct_fallback'
            };
        }

        // 5. ОБРАБОТКА РЕЗУЛЬТАТА
        if (alignmentResult && alignmentResult.success) {
            const comparison = this.compareFootprintsWithAlignment(
                footprint1, footprint2, alignmentResult.alignedPoints || []
            );

            return {
                ...comparison,
                alignment: alignmentResult,
                validation: validationResult,
                debug: debugResult.summary,
                method: 'enhanced_alignment_with_modules'
            };
        } else {
            console.log(`⚠️ Выравнивание не удалось, использую графический метод`);
            const fallbackResult = await this.compareWithPatterns(footprint1, footprint2);

            return {
                ...fallbackResult,
                alignment: { success: false, error: alignmentResult?.error || 'Unknown error' },
                method: 'pattern_based_fallback'
            };
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Сравнить через паттерны
    async compareWithPatterns(footprint1, footprint2) {
        console.log(`🎯 Сравнение через паттерны: "${footprint1.name}" vs "${footprint2.name}"`);

        try {
            // 🔥 ЗАЩИТА ОТ ПУСТЫХ ДАННЫХ
            if (!footprint1 || !footprint2) {
                console.log('❌ Один из отпечатков не существует');
                return this.createErrorResult('invalid_footprint');
            }

            // Получаем точки для сравнения
            let points1, points2;

            try {
                points1 = this.getPointsForPatternMatching(footprint1);
                points2 = this.getPointsForPatternMatching(footprint2);
            } catch (error) {
                console.log(`⚠️ Ошибка получения точек: ${error.message}`);
                // Фоллбэк: извлекаем точки напрямую
                points1 = this.extractPointsFromFootprint(footprint1);
                points2 = this.extractPointsFromFootprint(footprint2);
            }

            // 🔥 ПРОВЕРКА НА ПУСТЫЕ ДАННЫЕ
            if (!points1 || points1.length === 0 || !points2 || points2.length === 0) {
                console.log('❌ Нет точек для сравнения');
                return this.createErrorResult('no_points', {
                    points1: points1?.length || 0,
                    points2: points2?.length || 0
                });
            }

            console.log(`🔍 Точки для сравнения: ${points1.length} vs ${points2.length}`);

            // Используем SimpleMatcher если доступен, иначе используем простой алгоритм
            let similarity = 0;
            let matchResult = {};

            if (this.manager.matcher && typeof this.manager.matcher.matchPatterns === 'function') {
                matchResult = this.manager.matcher.matchPatterns(points1, points2);
                similarity = matchResult.similarity || 0;
            } else {
                // Простой алгоритм сравнения
                similarity = this.calculateSimpleSimilarity(points1, points2);
                matchResult = { similarity, method: 'simple_direct_comparison' };
            }

            // 🔥 ЗАЩИТА ОТ NaN
            if (isNaN(similarity) || !isFinite(similarity)) {
                console.log('⚠️ Обнаружен NaN в схожести, сбрасываю на 0');
                similarity = 0;
            }

            // Ограничиваем диапазон
            similarity = Math.max(0, Math.min(1, similarity));

            // 🔥 ДЕТАЛЬНАЯ ДИАГНОСТИКА ПРИ ПРОБЛЕМАХ
            if (similarity === 0 && points1.length > 0 && points2.length > 0) {
                console.log('🔍 Детальный анализ нулевой схожести:');
                console.log(`   Точки 1: ${points1.length}, пример: (${points1[0]?.x}, ${points1[0]?.y})`);
                console.log(`   Точки 2: ${points2.length}, пример: (${points2[0]?.x}, ${points2[0]?.y})`);
            }

            // Принимаем решение
            const decision = this.makeDecision(similarity, matchResult);

            console.log(`📊 Реальная схожесть: ${(similarity * 100).toFixed(1)}%`);
            console.log(`🎯 Финальная схожесть для решения: ${(similarity * 100).toFixed(1)}%`);

            return {
                similarity: similarity,
                decision: decision,
                method: 'pattern_based',
                matchResult: matchResult,
                pointsCounts: {
                    footprint1: points1.length,
                    footprint2: points2.length
                },
                valid: true
            };

        } catch (error) {
            console.log(`❌ Критическая ошибка в compareWithPatterns: ${error.message}`);
            return this.createErrorResult('comparison_error', { error: error.message });
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки для сравнения паттернов
    getPointsForPatternMatching(footprint) {
        if (!footprint) return [];

        // Пробуем разные методы получения точек
        if (footprint.getPointsForPatternMatching && typeof footprint.getPointsForPatternMatching === 'function') {
            return footprint.getPointsForPatternMatching();
        } else if (footprint.getPoints && typeof footprint.getPoints === 'function') {
            return footprint.getPoints();
        } else if (footprint.pointTracker && footprint.pointTracker.points) {
            const points = [];
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    x: point.x || 0,
                    y: point.y || 0,
                    id: id,
                    confidence: point.confidence || point.rating || 0.5
                });
            }
            return points;
        } else {
            return this.extractPointsFromFootprint(footprint);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечь точки из отпечатка
    extractPointsFromFootprint(footprint) {
        const points = [];

        if (!footprint) return points;

        // Пытаемся получить точки из различных источников
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    x: point.x || 0,
                    y: point.y || 0,
                    id: id,
                    confidence: point.confidence || point.rating || 0.5
                });
            }
        } else if (footprint.graph && footprint.graph.nodes) {
            const nodes = Array.isArray(footprint.graph.nodes) ?
                footprint.graph.nodes :
                Array.from(footprint.graph.nodes.values());
           
            nodes.forEach(node => {
                points.push({
                    x: node.x || 0,
                    y: node.y || 0,
                    id: node.id || `node_${points.length}`,
                    confidence: node.confidence || 0.5
                });
            });
        }

        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Простое сравнение
    calculateSimpleSimilarity(points1, points2) {
        if (points1.length === 0 || points2.length === 0) return 0;

        const THRESHOLD = 30; // Порог расстояния в пикселях
        let matches = 0;

        // Для каждой точки из первого набора ищем ближайшую во втором
        for (const point1 of points1) {
            let minDistance = Infinity;
           
            for (const point2 of points2) {
                const distance = Math.sqrt(
                    Math.pow(point2.x - point1.x, 2) +
                    Math.pow(point2.y - point1.y, 2)
                );
               
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
           
            if (minDistance < THRESHOLD) {
                matches++;
            }
        }

        // Симметричное сравнение
        const similarity1 = matches / Math.max(points1.length, 1);
       
        // Обратное сравнение (для симметрии)
        matches = 0;
        for (const point2 of points2) {
            let minDistance = Infinity;
           
            for (const point1 of points1) {
                const distance = Math.sqrt(
                    Math.pow(point1.x - point2.x, 2) +
                    Math.pow(point1.y - point2.y, 2)
                );
               
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
           
            if (minDistance < THRESHOLD) {
                matches++;
            }
        }
       
        const similarity2 = matches / Math.max(points2.length, 1);
       
        // Среднее значение
        return (similarity1 + similarity2) / 2;
    }

    createErrorResult(errorType, details = {}) {
        return {
            similarity: 0,
            decision: 'error',
            method: 'error',
            error: errorType,
            details: details,
            valid: false
        };
    }

    makeDecision(similarity, matchResult) {
        // 🔥 ИСПОЛЬЗУЕМ ЕДИНЫЙ ПОРОГ
        const thresholds = this.manager.DECISION_THRESHOLDS || {
            PATTERN_SIMILARITY: 0.6,
            MIN_MATCHES: 10
        };

        if (similarity > thresholds.PATTERN_SIMILARITY) {
            return 'same';
        } else if (similarity > 0.3) {
            return 'similar';
        } else {
            return 'different';
        }
    }

    // 🔥 МЕТОД ДЛЯ СРАВНЕНИЯ С ПРЕОБРАЗОВАНИЕМ КООРДИНАТ
    async compareWithCoordinateConversion(footprint1, footprint2) {
        console.log(`🎯 СРАВНЕНИЕ С ПРЕОБРАЗОВАНИЕМ СИСТЕМ КООРДИНАТ:`);

        // 1. Анализ систем координат через конвертер
        const analysis = this.manager.coordinateConverter ?
            this.manager.coordinateConverter.analyzeCoordinateSystems(footprint1, footprint2) :
            { compatible: true, system1: 'unknown', system2: 'unknown' };

        // 2. Получаем точки
        const points1 = this.getPointsInSystem(footprint1, 'template');
        const points2 = this.getPointsInSystem(footprint2, 'template');

        console.log(`📊 Точки: ${points1.length} и ${points2.length}`);

        // 3. Если системы не совместимы - преобразуем
        if (!analysis.compatible && analysis.steps && this.manager.coordinateConverter) {
            console.log(`🔄 Преобразую System2 → System1...`);

            const transformedPoints2 = this.manager.coordinateConverter.convertPoints(
                points2,
                analysis.system2,
                analysis.system1
            );

            // 4. Выравниваем
            let alignedPoints;
            if (this.manager.improvedAligner) {
                alignedPoints = await this.manager.improvedAligner.alignWithIntelligentMatching(
                    transformedPoints2,
                    points1
                );
            } else {
                alignedPoints = { success: true, alignedPoints: transformedPoints2 };
            }

            // 5. Сравниваем
            return this.compareAlignedFootprints(points1, alignedPoints.alignedPoints || alignedPoints);
        } else {
            // Используем обычное сравнение
            return await this.compareWithPatterns(footprint1, footprint2);
        }
    }

    // 🔥 ВАЛИДАЦИЯ И СРАВНЕНИЕ
    async validateAndCompare(footprint1, footprint2) {
        console.log('\n🔍 ВАЛИДАЦИЯ ПЕРЕД СРАВНЕНИЕМ:');

        // 1. Валидация через отдельный модуль
        const validation = this.manager.coordinateValidator ?
            this.manager.coordinateValidator.validateCoordinateSystems(footprint1, footprint2) :
            { needsCorrection: false, compatible: true };

        // 2. Получаем точки
        const points1 = this.getPointsInConsistentSystem(footprint1);
        const points2 = this.getPointsInConsistentSystem(footprint2);

        console.log(`📊 Точки: ${points1.length} и ${points2.length}`);

        // 3. Проверяем ориентацию
        const needsCorrection = this.needsOrientationCorrection(points1, points2);

        let correctedPoints2 = [...points2];
        if (needsCorrection) {
            console.log('🔄 Применяю коррекцию ориентации...');
            correctedPoints2 = this.applyAutomaticOrientationCorrection(correctedPoints2, points1);
        }

        // 4. Выравнивание
        let alignmentResult;
        if (this.manager.improvedAligner) {
            alignmentResult = await this.manager.improvedAligner.alignWithIntelligentMatching(
                correctedPoints2, points1,
                footprint2.getTransformation ? footprint2.getTransformation() : null,
                footprint1.getTransformation ? footprint1.getTransformation() : null
            );
        } else {
            alignmentResult = { success: true, alignedPoints: correctedPoints2 };
        }

        // 5. Сравнение
        return this.compareAlignedFootprints(
            points1,
            alignmentResult.alignedPoints || correctedPoints2,
            footprint1,
            footprint2
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки в указанной системе
    getPointsInSystem(footprint, targetSystem = 'template') {
        const points = [];

        if (!footprint || !footprint.pointTracker) return points;

        for (const [id, point] of footprint.pointTracker.points) {
            let x = point.x;
            let y = point.y;

            // Если нужно преобразовать в систему шаблона
            if (targetSystem === 'template' && footprint.getTransformation) {
                const transformation = footprint.getTransformation();
                if (transformation) {
                    // Простое преобразование - центрирование
                    const center = this.calculateCenter([{x, y}]);
                    x = x - center.x + 500;
                    y = y - center.y + 500;
                }
            }

            points.push({
                id: id,
                x: x,
                y: y,
                confidence: point.rating || 0.5
            });
        }

        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить систему координат шаблона
    getTemplateCoordinateSystem() {
        // Эта система должна соответствовать системе, в которой создан шаблон
        return {
            type: 'template',
            rotationAngle: 0, // Шаблон всегда в 0°
            isMirrored: false,
            bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 }, // Нормализованные координаты
            description: 'Нормализованная система шаблона (0-1)'
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки в согласованной системе
    getPointsInConsistentSystem(footprint) {
        const points = [];

        if (!footprint || !footprint.pointTracker) return points;

        // 🔥 КЛЮЧЕВОЙ МОМЕНТ: Используем оригинальные координаты
        for (const [id, point] of footprint.pointTracker.points) {
            // Если есть оригинальные координаты - используем их
            if (point.originalCoordinates) {
                points.push({
                    x: point.originalCoordinates.x,
                    y: point.originalCoordinates.y,
                    id: id,
                    confidence: point.rating || 0.5
                });
            } else {
                // Иначе используем текущие
                points.push({
                    x: point.x,
                    y: point.y,
                    id: id,
                    confidence: point.rating || 0.5
                });
            }
        }

        // 🔥 ГОРЯЧИЙ ФИКС ДЛЯ RotationInvariance
        if (points.length > 0 && points[0] && typeof points[0].x === 'number') {
            console.log(`📊 Точки в согласованной системе: ${points.length} (пример: ${points[0].x.toFixed(1)}, ${points[0].y.toFixed(1)})`);
        } else if (points.length > 0) {
            console.log(`📊 Точки в согласованной системе: ${points.length} (первые точки undefined)`);
        }

        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить нужна ли коррекция ориентации
    needsOrientationCorrection(points1, points2) {
        if (points1.length < 3 || points2.length < 3) return false;

        const bounds1 = this.calculateBounds(points1);
        const bounds2 = this.calculateBounds(points2);

        const ratio1 = bounds1.width / Math.max(1, bounds1.height);
        const ratio2 = bounds2.width / Math.max(1, bounds2.height);

        // Если пропорции сильно отличаются (вертикальный vs горизонтальный)
        const needsCorrection = (ratio1 > 2.0 && ratio2 < 0.5) || (ratio1 < 0.5 && ratio2 > 2.0);

        console.log(`📏 Пропорции: ${ratio1.toFixed(2)} vs ${ratio2.toFixed(2)} -> ${needsCorrection ? 'НУЖНА коррекция' : 'OK'}`);

        return needsCorrection;
    }

    // 🔥 НОВЫЙ МЕТОД: Применить автоматическую коррекцию ориентации
    applyAutomaticOrientationCorrection(points, referencePoints) {
        const center = this.calculateCenter(points);

        const rotatedPoints = points.map(point => {
            // Сдвигаем к центру
            let x = point.x - center.x;
            let y = point.y - center.y;

            // Поворачиваем на 90°
            const rotatedX = -y;  // x' = -y
            const rotatedY = x;   // y' = x

            // Возвращаем обратно
            return {
                ...point,
                x: rotatedX + center.x,
                y: rotatedY + center.y,
                rotated90: true
            };
        });

        console.log('✅ Автоматическая коррекция ориентации применена (90°)');
        return rotatedPoints;
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнить выровненные отпечатки
    compareAlignedFootprints(points1, alignedPoints2, footprint1 = null, footprint2 = null) {
        if (!points1 || !alignedPoints2 || points1.length === 0 || alignedPoints2.length === 0) {
            return {
                similarity: 0,
                decision: 'different',
                reason: 'Нет точек для сравнения',
                matches: [],
                perfectMatches: 0,
                goodMatches: 0,
                acceptableMatches: 0,
                totalMatches: 0,
                points1Count: points1 ? points1.length : 0,
                points2Count: alignedPoints2 ? alignedPoints2.length : 0,
                method: 'aligned_comparison'
            };
        }

        let perfectMatches = 0;
        let goodMatches = 0;
        let acceptableMatches = 0;
        const matches = [];

        const PERFECT_THRESHOLD = 15;    // 15px - точное совпадение
        const GOOD_THRESHOLD = 30;       // 30px - хорошее совпадение
        const ACCEPTABLE_THRESHOLD = 50; // 50px - допустимое совпадение

        alignedPoints2.forEach(alignedPoint => {
            let bestMatch = null;
            let minDistance = Infinity;

            for (const point1 of points1) {
                const distance = Math.sqrt(
                    Math.pow(point1.x - alignedPoint.x, 2) +
                    Math.pow(point1.y - alignedPoint.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        point1,
                        alignedPoint,
                        distance,
                        quality: this.calculateMatchQuality(distance, alignedPoint.confidence || 0.5)
                    };
                }
            }

            if (bestMatch) {
                matches.push(bestMatch);

                if (minDistance < PERFECT_THRESHOLD) {
                    perfectMatches++;
                } else if (minDistance < GOOD_THRESHOLD) {
                    goodMatches++;
                } else if (minDistance < ACCEPTABLE_THRESHOLD) {
                    acceptableMatches++;
                }
            }
        });

        const totalMatches = perfectMatches + goodMatches + acceptableMatches;
        const similarity = totalMatches / Math.max(points1.length, alignedPoints2.length, 1);

        let decision, reason;
        if (similarity > 0.7) {
            decision = 'same';
            reason = `Высокое совпадение после выравнивания: ${perfectMatches}/${points1.length} точных, ${goodMatches}/${points1.length} хороших`;
        } else if (similarity > 0.4) {
            decision = 'similar';
            reason = `Умеренное совпадение после выравнивания: ${perfectMatches}/${points1.length} точных, ${goodMatches}/${points1.length} хороших`;
        } else {
            decision = 'different';
            reason = `Низкое совпадение после выравнивания: ${perfectMatches}/${points1.length} точных, ${goodMatches}/${points1.length} хороших`;
        }

        return {
            similarity,
            decision,
            reason,
            matches,
            perfectMatches,
            goodMatches,
            acceptableMatches,
            totalMatches,
            points1Count: points1.length,
            points2Count: alignedPoints2.length,
            method: 'enhanced_alignment_logic'
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Исправить сравнение с повернутыми следами
    async compareWithFixedAlignment(footprint1, footprint2) {
        console.log(`🎯 УМНОЕ СРАВНЕНИЕ С ПОВЕРНУТЫМИ СЛЕДАМИ`);

        // 1. Дебаг трансформаций
        const debugResult = this.manager.transformationDebugger ?
            this.manager.transformationDebugger.analyzeTransformation(footprint1, footprint2) :
            { summary: { needsCorrection: false } };

        // 2. Получить точки в их системах координат
        let points1 = this.getTrackerPointsInFootprintSystem(footprint1.pointTracker,
            footprint1.getTransformation ? footprint1.getTransformation() : null);
        let points2 = this.getTrackerPointsInFootprintSystem(footprint2.pointTracker,
            footprint2.getTransformation ? footprint2.getTransformation() : null);

        // 3. Проверить ориентацию
        const needsRotationCorrection = this.checkIfNeeds90DegreeRotation(points1, points2);

        if (needsRotationCorrection) {
            console.log('🔄 Применяю коррекцию поворота 90°...');
            points2 = this.apply90DegreeRotation(points2);
        }

        // 4. Использовать улучшенный алайнер
        let alignmentResult;
        if (this.manager.improvedAligner) {
            alignmentResult = await this.manager.improvedAligner.alignWithIntelligentMatching(
                points2,
                points1,
                footprint2.getTransformation ? footprint2.getTransformation() : null,
                footprint1.getTransformation ? footprint1.getTransformation() : null
            );
        } else {
            alignmentResult = { success: true, alignedPoints: points2 };
        }

        // 5. Сравнить с улучшенной логикой
        return this.compareWithEnhancedLogic(points1, alignmentResult.alignedPoints || alignmentResult);
    }

    // 🔥 МЕТОДЫ ДЛЯ РАБОТЫ С ПОВОРОТАМИ
    checkIfNeeds90DegreeRotation(points1, points2) {
        if (points1.length < 3 || points2.length < 3) return false;

        const bounds1 = this.calculateBounds(points1);
        const bounds2 = this.calculateBounds(points2);

        const ratio1 = bounds1.width / Math.max(1, bounds1.height);
        const ratio2 = bounds2.width / Math.max(1, bounds2.height);

        // Если пропорции сильно отличаются (вертикальный vs горизонтальный)
        const needsCorrection = (ratio1 > 2.0 && ratio2 < 0.5) || (ratio1 < 0.5 && ratio2 > 2.0);

        console.log(`📏 Пропорции: ${ratio1.toFixed(2)} vs ${ratio2.toFixed(2)} -> ${needsCorrection ? 'НУЖНА коррекция' : 'OK'}`);

        return needsCorrection;
    }

    apply90DegreeRotation(points) {
        const center = this.calculateCenter(points);

        const rotatedPoints = points.map(point => {
            // Сдвигаем к центру
            let x = point.x - center.x;
            let y = point.y - center.y;

            // Поворачиваем на 90°
            const rotatedX = -y;  // x' = -y
            const rotatedY = x;   // y' = x

            // Возвращаем обратно
            return {
                ...point,
                x: rotatedX + center.x,
                y: rotatedY + center.y,
                rotated90: true
            };
        });

        return rotatedPoints;
    }

    compareWithEnhancedLogic(points1, alignedPoints2) {
        return this.compareAlignedFootprints(points1, alignedPoints2);
    }

    // 🔥 ШАГ 3: ВСПОМОГАТЕЛЬНЫЙ МЕТОД - Найти ближайшую точку в массиве
    findNearestPointInArray(point, pointsArray, maxDistance = Infinity) {
        let nearest = null;
        let minDistance = Infinity;

        for (const p of pointsArray) {
            const distance = Math.sqrt(
                Math.pow(p.x - point.x, 2) +
                Math.pow(p.y - point.y, 2)
            );

            if (distance < minDistance && distance <= maxDistance) {
                minDistance = distance;
                nearest = p;
            }
        }

        return nearest;
    }

    // 🔥 НОВЫЙ МЕТОД: Анализ типов паттернов
    analyzePatternTypes(matchingPatterns) {
        const types = {
            triangle: 0,
            line: 0,
            cluster: 0,
            corner: 0,
            other: 0
        };

        if (!matchingPatterns || matchingPatterns.length === 0) {
            return types;
        }

        matchingPatterns.forEach(pattern => {
            const type = pattern.type || 'other';
            if (types[type] !== undefined) {
                types[type]++;
            } else {
                types.other++;
            }
        });

        return types;
    }

    // 🔥 НОВЫЙ МЕТОД: Обновить шаблон из совпавших паттернов
    async updateTemplateFromPatternMatch(footprint1, footprint2, matchingPatterns) {
        const userId = footprint1.userId || footprint2.userId;
        if (!userId) return;

        const vectorModel = this.manager.vectorSuperModels ? this.manager.vectorSuperModels.get(userId) : null;
        if (!vectorModel || !vectorModel.templateBuilder) {
            console.log('⚠️ Нет шаблона для обновления');
            return;
        }

        console.log(`🔄 Обновляю шаблон из ${matchingPatterns.length} совпавших паттернов...`);

        // Для каждого совпавшего паттерна находим соответствующие точки
        const pointMatches = [];

        matchingPatterns.forEach(pattern => {
            if (pattern.pattern1 && pattern.pattern1.originalPoint &&
                pattern.pattern2 && pattern.pattern2.originalPoint) {

                pointMatches.push({
                    point1: pattern.pattern1.originalPoint,
                    point2: pattern.pattern2.originalPoint,
                    confidence: pattern.confidence,
                    patternType: pattern.type
                });
            }
        });

        console.log(`✅ Найдено ${pointMatches.length} совпадений точек для обновления шаблона`);

        return pointMatches.length;
    }

    // 🔥 СЛУЖЕБНЫЕ МЕТОДЫ
    calculateMatchQuality(distance, templateConfidence) {
        const distanceScore = Math.max(0, 1 - distance / 50);
        const confidenceScore = templateConfidence || 0.5;
        return (distanceScore * 0.7 + confidenceScore * 0.3);
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки трекера в системе отпечатка
    getTrackerPointsInFootprintSystem(tracker, footprintTransformation) {
        const points = [];

        if (!tracker || !tracker.points) return points;

        for (const [pointId, pointData] of tracker.points) {
            // Точки трекера УЖЕ в системе отпечатка
            const point = {
                id: pointId,
                x: pointData.x || 0,
                y: pointData.y || 0,
                confidence: pointData.rating || pointData.confidence || 0.5,
                confirmedCount: pointData.confirmedCount || 1,
                pointData: pointData
            };

            points.push(point);
        }

        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Создать единичную трансформацию
    createIdentityTransformation() {
        return {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            rotationAngle: 0,
            isMirrored: false,
            center: { x: 0, y: 0 },
            bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
            scale: { x: 1, y: 1 },
            translation: { x: 0, y: 0 },
            type: 'identity',
            timestamp: new Date()
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Сравнить отпечатки с выравниванием
    compareFootprintsWithAlignment(footprint1, footprint2, alignedPoints) {
        // Реализация сравнения после выравнивания
        return this.compareAlignedFootprints(
            this.getPointsInConsistentSystem(footprint1),
            alignedPoints,
            footprint1,
            footprint2
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Вычислить центр точек
    calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }

        let sumX = 0;
        let sumY = 0;

        for (const point of points) {
            sumX += point.x || 0;
            sumY += point.y || 0;
        }

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Вычислить границы точек
    calculateBounds(points) {
        if (!points || points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const point of points) {
            if (point.x < minX) minX = point.x;
            if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
        }

        return {
            minX: isFinite(minX) ? minX : 0,
            maxX: isFinite(maxX) ? maxX : 0,
            minY: isFinite(minY) ? minY : 0,
            maxY: isFinite(maxY) ? maxY : 0,
            width: isFinite(maxX - minX) ? maxX - minX : 0,
            height: isFinite(maxY - minY) ? maxY - minY : 0
        };
    }
}

module.exports = FootprintComparisonEngine;
