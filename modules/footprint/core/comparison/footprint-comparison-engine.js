// modules/footprint/core/comparison/footprint-comparison-engine.js
// 🔥 ВЫНЕСЕННАЯ ЛОГИКА СРАВНЕНИЯ СЛЕДОВ

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
        const debugResult = this.manager.transformationDebugger.analyzeTransformation(footprint1, footprint2);

        // 2. ВАЛИДАЦИЯ СИСТЕМ КООРДИНАТ
        const validationResult = this.manager.coordinateValidator.validateCoordinateSystems(footprint1, footprint2);

        // 3. ПОДГОТОВКА ДАННЫХ ДЛЯ СРАВНЕНИЯ
        const points1 = this.getPointsInConsistentSystem(footprint1);
        const points2 = this.getPointsInConsistentSystem(footprint2);

        console.log(`📊 Точки для сравнения: ${points1.length} и ${points2.length}`);

        // 4. ВЫБОР МЕТОДА ВЫРАВНИВАНИЯ
        let alignmentResult;

        if (validationResult.needsCorrection || (debugResult.summary && debugResult.summary.needsCorrection)) {
            console.log(`🔄 Использую улучшенное выравнивание с коррекцией`);
            alignmentResult = await this.manager.improvedAligner.alignWithIntelligentMatching(
                points2, points1,
                footprint2.getTransformation(),
                footprint1.getTransformation()
            );
        } else {
            console.log(`🔄 Использую стандартное выравнивание`);
            alignmentResult = await this.manager.aligner.testAlignment(
                footprint1, footprint2,
                footprint2.getTransformation() || this.createIdentityTransformation(),
                footprint1.getTransformation() || this.createIdentityTransformation()
            );
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
            const fallbackResult = await this.manager.matcher.compareGraphs(footprint1.graph, footprint2.graph);

            return {
                ...fallbackResult,
                alignment: { success: false, error: alignmentResult?.error || 'Unknown error' },
                method: 'graph_based_fallback'
            };
        }
    }

    // 🔥 МЕТОД ДЛЯ СРАВНЕНИЯ С ПРЕОБРАЗОВАНИЕМ КООРДИНАТ
    async compareWithCoordinateConversion(footprint1, footprint2) {
        console.log(`🎯 СРАВНЕНИЕ С ПРЕОБРАЗОВАНИЕМ СИСТЕМ КООРДИНАТ:`);

        // 1. Анализ систем координат через конвертер
        const analysis = this.manager.coordinateConverter.analyzeCoordinateSystems(footprint1, footprint2);

        // 2. Получаем точки
        const points1 = this.getPointsInSystem(footprint1, 'template');
        const points2 = this.getPointsInSystem(footprint2, 'template');

        console.log(`📊 Точки: ${points1.length} и ${points2.length}`);

        // 3. Если системы не совместимы - преобразуем
        if (!analysis.compatible && analysis.steps) {
            console.log(`🔄 Преобразую System2 → System1...`);

            const transformedPoints2 = this.manager.coordinateConverter.convertPoints(
                points2,
                analysis.system2,
                analysis.system1
            );

            // 4. Выравниваем
            const alignedPoints = await this.manager.improvedAligner.alignWithIntelligentMatching(
                transformedPoints2,
                points1
            );

            // 5. Сравниваем
            return this.compareAlignedFootprints(points1, alignedPoints.alignedPoints || alignedPoints);
        } else {
            // Используем обычное сравнение
            return await this.compareWithAlignment(footprint1, footprint2);
        }
    }

    // 🔥 ВАЛИДАЦИЯ И СРАВНЕНИЕ
    async validateAndCompare(footprint1, footprint2) {
        console.log('\n🔍 ВАЛИДАЦИЯ ПЕРЕД СРАВНЕНИЕМ:');

        // 1. Валидация через отдельный модуль
        const validation = this.manager.coordinateValidator.validateCoordinateSystems(footprint1, footprint2);

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
        const alignmentResult = await this.manager.improvedAligner.alignWithIntelligentMatching(
            correctedPoints2, points1,
            footprint2.getTransformation(),
            footprint1.getTransformation()
        );

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

        if (!footprint.pointTracker) return points;

        for (const [id, point] of footprint.pointTracker.points) {
            let x = point.x;
            let y = point.y;

            // Если нужно преобразовать в систему шаблона
            if (targetSystem === 'template' && footprint.getTransformation()) {
                const systemInfo = this.manager.coordinateConverter.extractCoordinateSystem(footprint);
                const templateSystem = this.getTemplateCoordinateSystem();

                const converted = this.manager.coordinateConverter.convertSinglePoint(
                    { x, y },
                    systemInfo,
                    templateSystem
                );
                x = converted.x;
                y = converted.y;
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
        } else {
            console.log(`📊 Точки в согласованной системе: ${points.length} (первые точки undefined)`);
        }
       
        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить нужна ли коррекция ориентации
    needsOrientationCorrection(points1, points2) {
        const bounds1 = this.manager.calculateBounds(points1);
        const bounds2 = this.manager.calculateBounds(points2);

        const ratio1 = bounds1.width / Math.max(1, bounds1.height);
        const ratio2 = bounds2.width / Math.max(1, bounds2.height);

        // Если пропорции сильно отличаются (вертикальный vs горизонтальный)
        const needsCorrection = (ratio1 > 2.0 && ratio2 < 0.5) || (ratio1 < 0.5 && ratio2 > 2.0);

        console.log(`📏 Пропорции: ${ratio1.toFixed(2)} vs ${ratio2.toFixed(2)} -> ${needsCorrection ? 'НУЖНА коррекция' : 'OK'}`);

        return needsCorrection;
    }

    // 🔥 НОВЫЙ МЕТОД: Применить автоматическую коррекцию ориентации
    applyAutomaticOrientationCorrection(points, referencePoints) {
        const center = this.manager.calculateCenter(points);

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
    compareAlignedFootprints(points1, alignedPoints2, footprint1, footprint2) {
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
        const similarity = totalMatches / Math.max(points1.length, alignedPoints2.length);

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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Исправить сравнение с повернутыми следами (исправленный)
    async compareWithFixedAlignment(footprint1, footprint2) {
        console.log(`🎯 УМНОЕ СРАВНЕНИЕ С ПОВЕРНУТЫМИ СЛЕДАМИ`);

        // 1. Дебаг трансформаций
        const debugResult = this.manager.transformationDebugger.analyzeTransformation(footprint1, footprint2);

        // 2. Получить точки в их системах координат
        let points1 = this.getTrackerPointsInFootprintSystem(footprint1.pointTracker, footprint1.getTransformation());
        let points2 = this.getTrackerPointsInFootprintSystem(footprint2.pointTracker, footprint2.getTransformation());

        // 3. Проверить ориентацию
        const needsRotationCorrection = this.checkIfNeeds90DegreeRotation(points1, points2);

        if (needsRotationCorrection) {
            console.log('🔄 Применяю коррекцию поворота 90°...');
            points2 = this.apply90DegreeRotation(points2);
        }

        // 4. Использовать улучшенный алайнер
        const alignmentResult = await this.manager.improvedAligner.alignWithIntelligentMatching(
            points2,
            points1,
            footprint2.getTransformation(),
            footprint1.getTransformation()
        );

        // 5. Сравнить с улучшенной логикой
        return this.compareWithEnhancedLogic(points1, alignmentResult.alignedPoints);
    }

    // 🔥 МЕТОДЫ ДЛЯ РАБОТЫ С ПОВОРОТАМИ
    checkIfNeeds90DegreeRotation(points1, points2) {
        const bounds1 = this.manager.calculateBounds(points1);
        const bounds2 = this.manager.calculateBounds(points2);

        const ratio1 = bounds1.width / Math.max(1, bounds1.height);
        const ratio2 = bounds2.width / Math.max(1, bounds2.height);

        // Если пропорции сильно отличаются (вертикальный vs горизонтальный)
        const needsCorrection = (ratio1 > 2.0 && ratio2 < 0.5) || (ratio1 < 0.5 && ratio2 > 2.0);

        console.log(`📏 Пропорции: ${ratio1.toFixed(2)} vs ${ratio2.toFixed(2)} -> ${needsCorrection ? 'НУЖНА коррекция' : 'OK'}`);

        return needsCorrection;
    }

    apply90DegreeRotation(points) {
        const center = this.manager.calculateCenter(points);

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
        const similarity = totalMatches / Math.max(points1.length, alignedPoints2.length);

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

    // 🔥 НОВЫЙ МЕТОД: Сравнение через инвариантные паттерны
    async compareWithPatterns(footprint1, footprint2) {
        console.log(`\n🎯 СРАВНЕНИЕ С ВЫРАВНИВАНИЕМ: "${footprint1.name}" vs "${footprint2.name}"`);

        // 🔥 ИСПРАВЛЕНИЕ: Используем ПРОСТОЙ поворот для произвольных углов
        const RotationInvariance = require('../rotation-invariance');
        const processor = new RotationInvariance({ debug: true });

        // Получаем сырые точки
        const points1_raw = this.manager.extractPointsFromFootprint(footprint1);
        const points2_raw = this.manager.extractPointsFromFootprint(footprint2);

        // Получаем реальные углы из трансформаций
        const angle1 = footprint1.getTransformation()?.rotationAngle || 0;
        const angle2 = footprint2.getTransformation()?.rotationAngle || 0;

        console.log(`📐 УГЛЫ ПОВОРОТА:`);
        console.log(`   ${footprint1.name}: ${angle1.toFixed(1)}°`);
        console.log(`   ${footprint2.name}: ${angle2.toFixed(1)}°`);

        // 🔥 ПРОСТОЙ ПОВОРОТ: оба следа к 0°
        console.log(`\n🔄 ПОВОРАЧИВАЮ СЛЕДЫ К 0°:`);

        const points1 = processor.transformPointsSimple(points1_raw, angle1, 0);
        const points2 = processor.transformPointsSimple(points2_raw, angle2, 0);

        // 🔥 ЦЕНТРИРОВАНИЕ к (500, 500)
        console.log(`\n🎯 ЦЕНТРИРУЮ К ОБЩЕЙ СИСТЕМЕ (500, 500):`);

        const points1_centered = processor.alignPointsToCommonSystem(points1);
        const points2_centered = processor.alignPointsToCommonSystem(points2);

        console.log(`📊 ТОЧКИ ПОСЛЕ ПРОСТОГО ВЫРАВНИВАНИЯ:`);
        console.log(`   ${footprint1.name}: ${points1_centered.length} точек`);
        console.log(`   ${footprint2.name}: ${points2_centered.length} точек`);

        // 🔥 ПРОВЕРКА ЦЕНТРОВ
        const center1 = processor.calculateCenter(points1_centered);
        const center2 = processor.calculateCenter(points2_centered);
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );

        console.log(`📏 РАССТОЯНИЕ МЕЖДУ ЦЕНТРАМИ: ${centerDistance.toFixed(1)}px`);

        // Продолжение оригинального метода...
        const adaptiveThreshold = Math.max(25, Math.min(50, centerDistance / 2));
        console.log(`🎯 Адаптивный порог: ${adaptiveThreshold.toFixed(1)}px`);

        let matches = 0;
        const matchDetails = [];

        for (const point1 of points1_centered) {
            let bestMatch = null;
            let minDistance = Infinity;

            for (const point2 of points2_centered) {
                const distance = Math.sqrt(
                    Math.pow(point2.x - point1.x, 2) +
                    Math.pow(point2.y - point1.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        point1,
                        point2,
                        distance
                    };
                }
            }

            if (bestMatch && minDistance < adaptiveThreshold) {
                matches++;
                matchDetails.push(bestMatch);
            }
        }

        const similarity = matches / Math.max(points1_centered.length, points2_centered.length);

        console.log(`📈 РЕЗУЛЬТАТ:`);
        console.log(`   Совпало точек: ${matches}/${Math.max(points1_centered.length, points2_centered.length)}`);
        console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}%`);

        // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ
        let updatedCount = 0;
        if (similarity > 0.5) {
            console.log(`🔄 Обновляю подтверждения...`);
            updatedCount = this.manager.updateConfirmationsFromMatches(
                footprint1, footprint2, matchDetails
            );
        }

        // 🔥 РЕШЕНИЕ
        let decision, reason;
        if (similarity > 0.7) {
            decision = 'same';
            reason = `Высокое сходство (${(similarity * 100).toFixed(1)}%) после простого выравнивания`;
        } else if (similarity > 0.4) {
            decision = 'similar';
            reason = `Умеренное сходство (${(similarity * 100).toFixed(1)}%) после простого выравнивания`;
        } else {
            decision = 'different';
            reason = `Низкое сходство (${(similarity * 100).toFixed(1)}%) после простого выравнивания`;
        }

        return {
            similarity,
            decision,
            reason,
            matchesCount: matches,
            totalPoints: Math.max(points1_centered.length, points2_centered.length),
            pointsUpdated: updatedCount,
            alignmentInfo: {
                centerDistance,
                adaptiveThreshold,
                center1,
                center2,
                angle1,
                angle2,
                method: 'simple_rotation_90_fix'
            }
        };
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

        const vectorModel = this.manager.vectorSuperModels.get(userId);
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

        // Здесь можно добавить логику обновления шаблона на основе паттернов
        // Например, увеличить подтверждения для совпавших точек

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
}

module.exports = FootprintComparisonEngine;
