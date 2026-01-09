// modules/footprint/simple-manager.js
// 🔥 ИСПРАВЛЕНИЕ: Правильная обработка разных углов поворота И ИСПРАВЛЕНИЕ ЛОГИЧЕСКОЙ ОШИБКИ

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 🔥 ДОБАВЛЕНО: Импорт SimpleGraph который отсутствовал
const SimpleGraph = require('./simple-graph');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,

            // 🔥 ВАЖНЫЕ НАСТРОЙКИ ДЛЯ ПОДТВЕРЖДЕНИЙ
            usePointTracker: true,
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableIntelligentMerge: options.enableIntelligentMerge !== false,
            enableTopologySuperModel: options.enableTopologySuperModel !== false,

            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            highConfidenceThreshold: options.highConfidenceThreshold || 0.8,
            minPointsForFootprint: options.minPointsForFootprint || 5,

            // Настройки PointTracker
            trackerConfirmationThreshold: 2,
            // 🔥 НОВЫЕ НАСТРОЙКИ ДЛЯ СОПОСТАВЛЕНИЯ
            matchDistanceThreshold: options.matchDistanceThreshold || 80, // Увеличил до 80px
            minMatchPercentage: options.minMatchPercentage || 0.3,
            useRelativeRotation: options.useRelativeRotation !== false, // 🔥 НОВОЕ: Относительный поворот
            ...options
        };

        // Импорт модулей
        const SimpleFootprint = require('./simple-footprint');
        const SimpleMatcher = require('./simple-matcher');
        const MergeVisualizer = require('./merge-visualizer');
        const VectorSuperModel = require('./vector-super-model');
        const TemplateVisualizer = require('./template-visualizer');
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');

        this.rotationProcessor = new RotationInvariance({
            debug: this.config.debug
        });

        this.mirrorDetector = new MirrorDetection({
            debug: this.config.debug
        });

        // Сессии пользователей
        this.userSessions = new Map();
        this.loadedModels = new Map();
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        this.lastMergeVisualizations = new Map();
        this.vectorSuperModels = new Map();
        this.templateVisualizer = new TemplateVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations/templates'),
            debug: this.config.debug
        });

        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulMerges: 0,
            totalPhotosProcessed: 0,
            trackerConfirmations: 0,
            lastActivity: new Date()
        };

        this.ensureDirectories();
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager инициализирован с относительными преобразованиями`);
    }

    // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильное преобразование с разными углами
    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_original', referenceAngle = 0) {
        console.log(`📐 Преобразование координат ${originalPoints.length} точек (${direction})...`);

        if (!transformationInfo) {
            console.log('⚠️ Нет информации о преобразовании');
            return originalPoints;
        }

        console.log(`📊 Информация о трансформации:`);
        console.log(`   • Угол поворота: ${transformationInfo.rotationAngle || 0}°`);
        console.log(`   • Масштаб: ${transformationInfo.scale || 1.0}`);
        console.log(`   • Зеркало: ${transformationInfo.isMirrored ? 'да' : 'нет'}`);
        console.log(`   • Коррекция: ${transformationInfo.corrected ? 'да' : 'нет'}`);
        console.log(`   • Опорный угол: ${referenceAngle}°`); // 🔥 НОВОЕ

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Используем ОТНОСИТЕЛЬНЫЙ угол
        // Если следы имеют разные углы, нужно преобразовать к ОБЩЕЙ системе

        let effectiveAngle = transformationInfo.rotationAngle;

        if (direction === 'to_normalized') {
            // Приведение к общей системе: вычитаем опорный угол
            effectiveAngle = transformationInfo.rotationAngle - referenceAngle;
            console.log(`   • Эффективный угол (относительный): ${effectiveAngle.toFixed(1)}° = ${transformationInfo.rotationAngle.toFixed(1)}° - ${referenceAngle}°`);
        }

        const angleRad = effectiveAngle * (Math.PI / 180);

        const transformedPoints = originalPoints.map(point => {
            let x = point.x;
            let y = point.y;

            if (direction === 'to_original') {
                // Из нормализованных (0°) в оригинальные
                // Поворачиваем назад: +angle
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                const rotatedX = x * cosA - y * sinA;
                const rotatedY = x * sinA + y * cosA;

                x = rotatedX;
                y = rotatedY;

                // Зеркало (если было)
                if (transformationInfo.isMirrored) {
                    x = -x;
                }
            }
            else if (direction === 'to_normalized') {
                // Из оригинальных в нормализованные (0°)
                // Сначала зеркало (если было)
                if (transformationInfo.isMirrored) {
                    x = -x;
                }

                // Поворачиваем вперед: -angle (относительно опорного угла)
                const cosA = Math.cos(-angleRad);
                const sinA = Math.sin(-angleRad);

                const rotatedX = x * cosA - y * sinA;
                const rotatedY = x * sinA + y * cosA;

                x = rotatedX;
                y = rotatedY;
            }

            return {
                ...point,
                x,
                y,
                originalX: point.x,
                originalY: point.y,
                transformed: true,
                direction: direction,
                angle: effectiveAngle,
                referenceAngle: referenceAngle
            };
        });

        console.log(`✅ Преобразовано ${transformedPoints.length} точек (эффективный угол: ${effectiveAngle.toFixed(1)}°, направление: ${direction})`);

        // Отладка
        if (transformedPoints.length > 0 && this.config.debug) {
            console.log(`🔍 Пример преобразования (${direction}):`);
            console.log(`   Оригинал: (${transformedPoints[0].originalX.toFixed(1)}, ${transformedPoints[0].originalY.toFixed(1)})`);
            console.log(`   После: (${transformedPoints[0].x.toFixed(1)}, ${transformedPoints[0].y.toFixed(1)})`);
        }

        return transformedPoints;
    }

    // 🔥 ДОБАВЛЕН: Метод для классификации точек
    classifyPoints(points1, points2, matches) {
        const used1 = new Set(matches.map(m => m.point1.id));
        const used2 = new Set(matches.map(m => m.point2.id));

        // 1. Взаимные совпадения (есть в обоих)
        const mutual = matches;

        // 2. Уникальные для первого следа
        const unique1 = points1.filter(p => !used1.has(p.id));

        // 3. Уникальные для второго следа
        const unique2 = points2.filter(p => !used2.has(p.id));

        return { mutual, unique1, unique2 };
    }

    // 🔥 ИСПРАВЛЕН: Метод для поиска РЕАЛЬНЫХ совпадений (взаимных)
    findRealMatches(points1, points2, threshold = 30) {
        console.log(`🔍 Поиск РЕАЛЬНЫХ (взаимных) совпадений...`);
        console.log(`   • Точки1: ${points1.length}`);
        console.log(`   • Точки2: ${points2.length}`);
        console.log(`   • Порог: ${threshold}px`);

        const matches = [];
        const usedPoints1 = new Set();
        const usedPoints2 = new Set();

        // Шаг 1: Найти взаимные ближайшие соседи
        for (let i = 0; i < points1.length; i++) {
            if (usedPoints1.has(i)) continue;

            let bestMatchIndex = -1;
            let minDistance = threshold;

            // Найти ближайшую точку во втором наборе
            for (let j = 0; j < points2.length; j++) {
                if (usedPoints2.has(j)) continue;

                const distance = this.calculateDistance(points1[i], points2[j]);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatchIndex = j;
                }
            }

            // Проверить взаимность
            if (bestMatchIndex !== -1) {
                // Теперь проверить, что точка2 тоже считает точку1 своей ближайшей
                let isMutual = true;

                for (let k = 0; k < points1.length; k++) {
                    if (k === i || usedPoints1.has(k)) continue;

                    const distance2 = this.calculateDistance(points2[bestMatchIndex], points1[k]);
                    if (distance2 < minDistance) {
                        // Есть точка ближе - это не взаимное совпадение
                        isMutual = false;
                        break;
                    }
                }

                if (isMutual) {
                    matches.push({
                        point1: points1[i],
                        point2: points2[bestMatchIndex],
                        distance: minDistance,
                        type: 'mutual'
                    });
                    usedPoints1.add(i);
                    usedPoints2.add(bestMatchIndex);
                    console.log(`   ✅ Взаимное совпадение: точка1[${i}] ↔ точка2[${bestMatchIndex}] (расстояние: ${minDistance.toFixed(1)}px)`);
                } else {
                    console.log(`   ⚠️ Не взаимное: точка1[${i}] → точка2[${bestMatchIndex}], но есть ближе`);
                }
            }
        }

        console.log(`📊 Найдено ${matches.length} ВЗАИМНЫХ совпадений`);
        return matches;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Интеллектуальное сопоставление с учетом разных углов
    intelligentPointMatchingWithRotation(tracker1, tracker2, transformationInfo1, transformationInfo2) {
        console.log(`🤖 Интеллектуальное сопоставление с разными углами...`);

        const points1 = Array.from(tracker1.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0
        }));

        const points2 = Array.from(tracker2.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0
        }));

        console.log(`📊 Углы поворота:`);
        console.log(`   • След 1: ${transformationInfo1?.rotationAngle || 0}°`);
        console.log(`   • След 2: ${transformationInfo2?.rotationAngle || 0}°`);
        console.log(`   • Разница: ${Math.abs((transformationInfo1?.rotationAngle || 0) - (transformationInfo2?.rotationAngle || 0)).toFixed(1)}°`);

        // 🔥 ВАЖНО: Определяем опорный угол (например, средний)
        const referenceAngle = transformationInfo1?.rotationAngle || 0;
        console.log(`   • Опорный угол: ${referenceAngle}°`);

        // 🔥 Шаг 1: Преобразуем оба следа в общую систему
        let normalizedPoints1 = points1;
        let normalizedPoints2 = points2;

        if (transformationInfo1 && transformationInfo2) {
            console.log(`📐 Преобразую оба следа к общей системе (опорный угол: ${referenceAngle}°)...`);

            // Первый след преобразуем относительно своего собственного угла
            normalizedPoints1 = this.transformCoordinatesBetweenSystems(
                points1,
                transformationInfo1,
                'to_normalized',
                referenceAngle
            );

            // Второй след преобразуем относительно того же опорного угла
            normalizedPoints2 = this.transformCoordinatesBetweenSystems(
                points2,
                transformationInfo2,
                'to_normalized',
                referenceAngle
            );

            console.log(`📊 После преобразования:`);
            console.log(`   • След 1: ${normalizedPoints1.length} точек`);
            console.log(`   • След 2: ${normalizedPoints2.length} точек`);
        }

        // 🔥 Шаг 2: Находим центры масс
        const center1 = this.calculateCenter(normalizedPoints1);
        const center2 = this.calculateCenter(normalizedPoints2);

        console.log(`🎯 Центры масс в общей системе:`);
        console.log(`   • След 1: (${center1.x.toFixed(1)}, ${center1.y.toFixed(1)})`);
        console.log(`   • След 2: (${center2.x.toFixed(1)}, ${center2.y.toFixed(1)})`);

        // 🔥 Шаг 3: Компенсируем смещение центров
        const offsetX = center2.x - center1.x;
        const offsetY = center2.y - center1.y;
        console.log(`📐 Смещение между центрами: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);

        // Сдвигаем второй след к первому
        const alignedPoints2 = normalizedPoints2.map(p => ({
            ...p,
            x: p.x - offsetX,
            y: p.y - offsetY
        }));

        // 🔥 Шаг 4: Ищем РЕАЛЬНЫЕ (взаимные) совпадения
        const distanceThreshold = this.config.matchDistanceThreshold * 1.5;
       
        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем findRealMatches вместо старой логики
        const realMatches = this.findRealMatches(normalizedPoints1, alignedPoints2, distanceThreshold);
       
        // 🔥 Классифицируем точки
        const classification = this.classifyPoints(normalizedPoints1, alignedPoints2, realMatches);

        console.log(`📊 КЛАССИФИКАЦИЯ ТОЧЕК:`);
        console.log(`   • 🔴 Взаимные совпадения: ${classification.mutual.length} (есть в обоих)`);
        console.log(`   • 🔵 Уникальные в следе 1: ${classification.unique1.length} (только в первом)`);
        console.log(`   • 🔵 Уникальные в следе 2: ${classification.unique2.length} (только во втором)`);

        // 🔥 Шаг 5: Если совпадений мало, пробуем ротационное сопоставление
        if (classification.mutual.length < Math.min(points1.length, points2.length) * this.config.minMatchPercentage) {
            console.log(`⚠️ Мало взаимных совпадений (${classification.mutual.length}), пробую ротационное сопоставление...`);

            // Пробуем разные углы поворота для второго следа
            const rotationAngles = [-10, -5, 0, 5, 10]; // Пробуем небольшие корректировки
            let bestRotationMatches = [];
            let bestRotationAngle = 0;

            for (const rotAngle of rotationAngles) {
                console.log(`   Пробую дополнительный поворот: ${rotAngle}°`);

                const rotatedPoints2 = this.rotatePoints(alignedPoints2, rotAngle);
                const rotationMatches = this.findRealMatches(normalizedPoints1, rotatedPoints2, distanceThreshold);

                console.log(`       Взаимных совпадений при повороте ${rotAngle}°: ${rotationMatches.length}`);

                if (rotationMatches.length > bestRotationMatches.length) {
                    bestRotationMatches = rotationMatches;
                    bestRotationAngle = rotAngle;
                }
            }

            if (bestRotationMatches.length > classification.mutual.length) {
                console.log(`   ✅ Лучший дополнительный поворот: ${bestRotationAngle}°, взаимных совпадений: ${bestRotationMatches.length}`);
               
                // Обновляем классификацию с ротационными совпадениями
                const rotatedClassification = this.classifyPoints(normalizedPoints1, alignedPoints2, bestRotationMatches);
               
                // Объединяем с основными совпадениями
                classification.mutual = [...classification.mutual, ...bestRotationMatches];
               
                console.log(`   📊 После ротации: ${classification.mutual.length} взаимных совпадений`);
            }
        }

        console.log(`📊 ИТОГО совпадений: ${classification.mutual.length} из ${points1.length}`);
        console.log(`📈 Процент взаимных совпадений: ${(classification.mutual.length / Math.min(points1.length, points2.length) * 100).toFixed(1)}%`);

        // 🔥 Шаг 6: Возвращаем результат
        const result = classification.mutual.map(match => {
            const originalPoint1 = points1.find(p => p.id === match.point1.id);
            const originalPoint2 = points2.find(p => p.id === match.point2.id);

            return {
                point1: originalPoint1,
                point2: originalPoint2,
                distance: match.distance,
                type: 'mutual', // 🔥 Только взаимные!
                shouldBeRed: true,
                rotationInfo: {
                    angle1: transformationInfo1?.rotationAngle,
                    angle2: transformationInfo2?.rotationAngle,
                    referenceAngle: referenceAngle
                }
            };
        });

        return {
            matches: result,
            classification: classification, // 🔥 ДОБАВЛЕНО: Возвращаем классификацию
            totalPoints1: points1.length,
            totalPoints2: points2.length,
            matchCount: classification.mutual.length,
            matchPercentage: (classification.mutual.length / Math.min(points1.length, points2.length)) * 100,
            transformationInfo1: transformationInfo1,
            transformationInfo2: transformationInfo2,
            referenceAngle: referenceAngle
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Обновление трекеров на основе совпадений
    updateTrackersBasedOnMatches(footprint1, footprint2, pointAnalysis) {
        console.log(`🎯 Обновляю подтверждения на основе ${pointAnalysis.matches.length} ВЗАИМНЫХ совпадений...`);

        // 🔥 Только взаимные совпадения увеличивают confirmedCount
        for (const match of pointAnalysis.matches) {
            if (match.type !== 'mutual') continue; // 🔥 Только взаимные!

            const point1 = footprint1.pointTracker.points.get(match.point1.id);
            if (point1) {
                const oldCount = point1.confirmedCount || 0;
                point1.confirmedCount = Math.min(5, oldCount + 1);
                console.log(`   🔴 Точка ${match.point1.id.slice(0, 8)}: ${oldCount} → ${point1.confirmedCount} (взаимное)`);
            }

            const point2 = footprint2.pointTracker.points.get(match.point2.id);
            if (point2) {
                const oldCount = point2.confirmedCount || 0;
                point2.confirmedCount = Math.min(5, oldCount + 1);
            }
        }

        // 🔥 Уникальные точки остаются с 1 подтверждением (или текущим значением)
        console.log(`📊 Уникальные точки остаются синими (сохраняют текущие подтверждения)`);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Поворот точек
    rotatePoints(points, angleDeg) {
        const angleRad = angleDeg * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        return points.map(point => ({
            ...point,
            x: point.x * cosA - point.y * sinA,
            y: point.x * sinA + point.y * cosA
        }));
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Обновление PointTracker из супер-модели (ОСНОВНОЕ ИСПРАВЛЕНИЕ)
    updatePointTrackerFromSuperModel(userId, footprint, vectorModel, transformationInfo = null) {
        console.log(`🔄 ОБНОВЛЯЮ PointTracker ИЗ СУПЕР-МОДЕЛИ...`);

        if (!footprint || !footprint.pointTracker || !vectorModel || !vectorModel.templateBuilder) {
            console.log('⚠️ Недостаточно данных для обновления');
            return 0;
        }

        const tracker = footprint.pointTracker;
        const templateBuilder = vectorModel.templateBuilder;

        // 🔥 ШАГ 1: Получаем данные шаблона
        const templateData = templateBuilder.getVisualizationData();
        if (!templateData || !templateData.cells) {
            console.log('⚠️ Нет данных шаблона');
            return 0;
        }

        console.log(`📊 Данные шаблона:`);
        console.log(`   • Ячеек: ${templateData.cells.length}`);
        console.log(`   • Подтвержденных: ${templateData.stats?.confirmedCells || 0}`);

        // 🔥 ШАГ 2: Преобразуем координаты шаблона в систему координат PointTracker
        const templatePoints = templateData.cells.map(cell => ({
            id: `template_${cell.id}`,
            x: cell.x,
            y: cell.y,
            confirmations: cell.confirmations || 1,
            confidence: cell.confidence || 0.7,
            isFromTemplate: true
        }));

        console.log(`📊 Преобразовано ${templatePoints.length} точек из шаблона`);

        // 🔥 ШАГ 3: Если есть трансформация - применяем ОБРАТНУЮ
        let transformedTemplatePoints = templatePoints;

        if (transformationInfo) {
            console.log(`📐 Применяю обратную трансформацию к точкам шаблона...`);
            transformedTemplatePoints = this.transformCoordinatesBetweenSystems(
                templatePoints,
                transformationInfo,
                'to_original'
            );
            console.log(`✅ Трансформировано ${transformedTemplatePoints.length} точек`);
        }

        // 🔥 ШАГ 4: Ищем РЕАЛЬНЫЕ (взаимные) совпадения
        let updatedCount = 0;
        const matchThreshold = 80; // 🔥 УВЕЛИЧИВАЕМ ДО 80px!

        console.log(`🔍 Ищу РЕАЛЬНЫЕ совпадения между ${tracker.points.size} точками трекера и ${transformedTemplatePoints.length} точками шаблона...`);

        // Преобразуем точки трекера в массив
        const trackerPoints = Array.from(tracker.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0,
            confidence: p.confidence || 0.5
        }));

        // 🔥 Ищем взаимные совпадения
        const realMatches = this.findRealMatches(trackerPoints, transformedTemplatePoints, matchThreshold);

        console.log(`📊 Найдено ${realMatches.length} взаимных совпадений с шаблоном`);

        // 🔥 ШАГ 5: Обновляем только взаимные совпадения
        for (const match of realMatches) {
            const trackerPoint = tracker.points.get(match.point1.id);
            if (trackerPoint && match.point2.confirmations >= 1) {
                const oldCount = trackerPoint.confirmedCount || 0;
                const templateConfirmations = match.point2.confirmations || 1;
                const newCount = Math.min(5, oldCount + templateConfirmations);

                if (newCount > oldCount) {
                    trackerPoint.confirmedCount = newCount;
                    trackerPoint.confidence = Math.max(trackerPoint.confidence || 0.5, match.point2.confidence || 0.7);

                    // Добавляем информацию о подтверждении от шаблона
                    if (!trackerPoint.templateConfirmations) {
                        trackerPoint.templateConfirmations = [];
                    }

                    trackerPoint.templateConfirmations.push({
                        timestamp: new Date(),
                        templateId: templateData.templateId,
                        confirmations: match.point2.confirmations,
                        distance: match.distance
                    });

                    updatedCount++;

                    if (updatedCount <= 5) {
                        console.log(`   ✅ Точка ${match.point1.id.slice(0, 8)}: ${oldCount} → ${newCount} подтверждений (расстояние: ${match.distance.toFixed(1)}px)`);
                    }
                }
            }
        }

        console.log(`✅ ОБНОВЛЕНО ${updatedCount} точек из ${tracker.points.size} на основе взаимных совпадений с шаблоном`);

        return updatedCount;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Интеллектуальное сопоставление точек (упрощенная версия)
    intelligentPointMatching(tracker1, tracker2, transformationInfo = null) {
        console.log(`🤖 Интеллектуальное сопоставление точек (упрощенная версия)...`);

        const points1 = Array.from(tracker1.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0
        }));

        const points2 = Array.from(tracker2.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0
        }));

        console.log(`📊 До сопоставления:`);
        console.log(`   • След 1: ${points1.length} точек`);
        console.log(`   • След 2: ${points2.length} точек`);

        // 🔥 УПРОЩЕННАЯ ВЕРСИЯ для одинаковых углов
        let normalizedPoints1 = points1;
        let normalizedPoints2 = points2;

        if (transformationInfo) {
            console.log(`📐 Преобразую оба следа в нормализованную систему...`);
            normalizedPoints1 = this.transformCoordinatesBetweenSystems(points1, transformationInfo, 'to_normalized');
            normalizedPoints2 = this.transformCoordinatesBetweenSystems(points2, transformationInfo, 'to_normalized');
        }

        // 🔥 Выравнивание по центрам
        const center1 = this.calculateCenter(normalizedPoints1);
        const center2 = this.calculateCenter(normalizedPoints2);

        const offsetX = center2.x - center1.x;
        const offsetY = center2.y - center1.y;

        const alignedPoints2 = normalizedPoints2.map(p => ({
            ...p,
            x: p.x - offsetX,
            y: p.y - offsetY
        }));

        // 🔥 Ищем РЕАЛЬНЫЕ (взаимные) совпадения
        const realMatches = this.findRealMatches(normalizedPoints1, alignedPoints2, this.config.matchDistanceThreshold);
        const classification = this.classifyPoints(normalizedPoints1, alignedPoints2, realMatches);

        console.log(`📊 РЕЗУЛЬТАТ СОПОСТАВЛЕНИЯ:`);
        console.log(`   • 🔴 Взаимные совпадения: ${classification.mutual.length}`);
        console.log(`   • 🔵 Уникальные в следе 1: ${classification.unique1.length}`);
        console.log(`   • 🔵 Уникальные в следе 2: ${classification.unique2.length}`);

        // 🔥 Возвращаем результат
        const result = classification.mutual.map(match => {
            const originalPoint1 = points1.find(p => p.id === match.point1.id);
            const originalPoint2 = points2.find(p => p.id === match.point2.id);

            return {
                point1: originalPoint1,
                point2: originalPoint2,
                distance: match.distance,
                type: 'mutual', // 🔥 Только взаимные!
                shouldBeRed: true
            };
        });

        return {
            matches: result,
            classification: classification, // 🔥 ДОБАВЛЕНО
            totalPoints1: points1.length,
            totalPoints2: points2.length,
            matchCount: classification.mutual.length,
            matchPercentage: (classification.mutual.length / Math.min(points1.length, points2.length)) * 100,
            transformationApplied: !!transformationInfo
        };
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Создание кластерной визуализации
    async createClusterComparisonVisualization(footprint1, footprint2, comparisonResult, userId, transformationInfo1 = null, transformationInfo2 = null) {
        console.log('🎨 Создаю визуализацию с учетом разных углов поворота...');

        try {
            // 🔥 ИСПОЛЬЗУЕМ УЛУЧШЕННОЕ СОПОСТАВЛЕНИЕ
            let pointAnalysis;

            if (transformationInfo1 && transformationInfo2 &&
                transformationInfo1.rotationAngle !== transformationInfo2.rotationAngle) {
                // 🔥 РАЗНЫЕ УГЛЫ - используем улучшенный метод
                console.log(`🔄 Следы имеют разные углы: ${transformationInfo1.rotationAngle.toFixed(1)}° vs ${transformationInfo2.rotationAngle.toFixed(1)}°`);

                pointAnalysis = this.intelligentPointMatchingWithRotation(
                    footprint1.pointTracker,
                    footprint2.pointTracker,
                    transformationInfo1,
                    transformationInfo2
                );
            } else {
                // 🔥 ОДИНАКОВЫЕ УГЛЫ - используем обычный метод
                const effectiveTransformation = transformationInfo1 || transformationInfo2;
                pointAnalysis = this.intelligentPointMatching(
                    footprint1.pointTracker,
                    footprint2.pointTracker,
                    effectiveTransformation
                );
            }

            console.log(`🎯 РЕЗУЛЬТАТ СОПОСТАВЛЕНИЯ:`);
            console.log(`   • След 1: ${pointAnalysis.totalPoints1} точек`);
            console.log(`   • След 2: ${pointAnalysis.totalPoints2} точек`);
            console.log(`   • 🔴 Взаимные совпадения: ${pointAnalysis.matchCount}`);
            console.log(`   • 📊 Процент взаимных: ${pointAnalysis.matchPercentage.toFixed(1)}%`);

            if (pointAnalysis.classification) {
                console.log(`   • 🔵 Уникальные в следе 1: ${pointAnalysis.classification.unique1.length}`);
                console.log(`   • 🔵 Уникальные в следе 2: ${pointAnalysis.classification.unique2.length}`);
            }

            // 🔥 ОБНОВЛЯЕМ ТОЧКИ (ТОЛЬКО ВЗАИМНЫЕ СОВПАДЕНИЯ)
            this.updateTrackersBasedOnMatches(footprint1, footprint2, pointAnalysis);

            // Получаем статистику
            const stats1 = this.calculateConfirmationStats(footprint1);
            const stats2 = this.calculateConfirmationStats(footprint2);

            console.log(`📊 ФИНАЛЬНАЯ СТАТИСТИКА:`);
            console.log(`   След 1: ${stats1.confirmed2}🔴 ${stats1.confirmed1}🔵 ${stats1.confirmed0}⚪`);
            console.log(`   След 2: ${stats2.confirmed2}🔴 ${stats2.confirmed1}🔵 ${stats2.confirmed0}⚪`);

            // Создаем визуализацию
            let ClusterVisualizer;
            try {
                ClusterVisualizer = require('./visualizations/cluster-visualizer');
            } catch (error) {
                console.log('⚠️ ClusterVisualizer не найден:', error.message);
                return null;
            }

            const visualizer = new ClusterVisualizer({
                outputDir: path.join(this.config.dbPath, 'visualizations/clusters'),
                debug: this.config.debug,
                forceTextMode: false
            });

            // 🔥 ПЕРЕДАЕМ ДАННЫЕ О РАЗНЫХ УГЛАХ И КЛАССИФИКАЦИИ
            const vizResult = await visualizer.visualizeTwoFootprintComparison(
                footprint1,
                footprint2,
                {
                    filename: `cluster_comparison_${userId}_${Date.now()}.png`,
                    mode: 'rotation_invariant',
                    customData: {
                        comparison: comparisonResult,
                        transformationInfo1: transformationInfo1,
                        transformationInfo2: transformationInfo2,
                        pointAnalysis: pointAnalysis,
                        stats: { stats1, stats2 },
                        classification: pointAnalysis.classification, // 🔥 ДОБАВЛЕНО
                        hasDifferentAngles: transformationInfo1 && transformationInfo2 &&
                                          transformationInfo1.rotationAngle !== transformationInfo2.rotationAngle
                    }
                }
            );

            console.log('✅ Визуализация создана с учетом разных углов:', vizResult?.path);
            return vizResult;

        } catch (error) {
            console.log('❌ Ошибка создания визуализации:', error.message);
            return null;
        }
    }

    // 🔥 ДОБАВЛЕН: Метод для диагностики совпадений
    debugPointTrackerMatches(footprint1, footprint2, transformationInfo1, transformationInfo2) {
        console.log(`\n🔍 ДИАГНОСТИКА СОВПАДЕНИЙ:`);
        console.log(`   • PointTracker 1: ${footprint1.pointTracker.points.size} точек`);
        console.log(`   • PointTracker 2: ${footprint2.pointTracker.points.size} точек`);
        console.log(`   • Угол следа 1: ${transformationInfo1?.rotationAngle || 0}°`);
        console.log(`   • Угол следа 2: ${transformationInfo2?.rotationAngle || 0}°`);
        console.log(`   • Разница углов: ${Math.abs((transformationInfo1?.rotationAngle || 0) - (transformationInfo2?.rotationAngle || 0)).toFixed(1)}°`);

        // Логируем первые 3 точки для отладки
        let count = 0;
        console.log(`   • Примеры точек из PointTracker 1:`);
        for (const [id, point] of footprint1.pointTracker.points) {
            if (count >= 3) break;
            console.log(`     ${id.slice(0, 8)}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) - ${point.confirmedCount} подтверждений`);
            count++;
        }

        count = 0;
        console.log(`   • Примеры точек из PointTracker 2:`);
        for (const [id, point] of footprint2.pointTracker.points) {
            if (count >= 3) break;
            console.log(`     ${id.slice(0, 8)}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) - ${point.confirmedCount} подтверждений`);
            count++;
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (без изменений)
    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateConfirmationStats(footprint) {
        if (!footprint || !footprint.pointTracker) {
            return { confirmed2: 0, confirmed1: 0, confirmed0: 0, totalPoints: 0 };
        }

        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

        for (const [id, point] of footprint.pointTracker.points) {
            const confirmations = point.confirmedCount || 0;

            if (confirmations >= 2) {
                confirmed2++;
            } else if (confirmations >= 1) {
                confirmed1++;
            } else {
                confirmed0++;
            }
        }

        const totalPoints = confirmed2 + confirmed1 + confirmed0;

        return {
            confirmed2,
            confirmed1,
            confirmed0,
            totalPoints
        };
    }

    // ... остальные методы без изменений (addPhotoToSession, extractSimilarityFromObject, и т.д.)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО С УЧЕТОМ РАЗНЫХ УГЛОВ ПОВОРОТА`);

        try {
            if (!analysis || !analysis.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < 5) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            console.log(`🔍 Извлечено ${points.length} точек протекторов`);

            // Создаем граф
            const graph = new SimpleGraph(`Временный_${Date.now()}`);
            graph.buildFromPoints(points);

            // Нормализация
            const normalized = this.rotationProcessor.normalizeToCanonical(graph, {
                userId: userId,
                photoInfo: photoInfo,
                autoRotate: true
            });

            console.log(`📐 Автоповорот: ${normalized.rotationAngle.toFixed(1)}° → 0°`);
            console.log(`🪞 Зеркало: ${normalized.isMirrored ? 'да' : 'нет'}`);

            const corrected = this.mirrorDetector.autoCorrectMirroring(
                normalized.graph,
                'right'
            );

            if (corrected.correctionApplied) {
                console.log(`🔄 Автокоррекция применена: ${corrected.correctionType}`);
            }

            // 🔥 СОХРАНЯЕМ ИНФОРМАЦИЮ О ТРАНСФОРМАЦИИ ЭТОГО ФОТО
            const currentTransformationInfo = {
                rotationAngle: normalized.rotationAngle,
                isMirrored: normalized.isMirrored,
                corrected: corrected.correctionApplied,
                scale: 1.0,
                timestamp: new Date(),
                footType: normalized.footType,
                photoId: photoInfo.photoId || `photo_${Date.now()}`
            };

            const finalGraph = corrected.graph;

            // Получаем сессию
            let session = this.userSessions.get(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессия`);
            }

            // Сохраняем трансформацию
            if (!session.metadata.normalizationHistory) {
                session.metadata.normalizationHistory = [];
            }
            session.metadata.normalizationHistory.push(currentTransformationInfo);
            session.metadata.lastTransformation = currentTransformationInfo;

            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                transformationInfo: currentTransformationInfo
            });
            session.lastActivity = new Date();

            const SimpleFootprint = require('./simple-footprint');

            // Если нет текущего отпечатка - создаем
            if (!session.currentFootprint) {
                console.log(`👣 Создаю новый отпечаток (первое фото)`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
                });

                session.currentFootprint.metadata.normalizationInfo = currentTransformationInfo;

                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: currentTransformationInfo
                });

                // Создаем векторную супер-модель
                const VectorSuperModel = require('./vector-super-model');
                const vectorModel = new VectorSuperModel({
                    name: `Супер-модель_${String(userId).slice(0, 6)}`,
                    enablePCA: false,
                    cellSize: 25,
                    debug: this.config.debug
                });

                vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
                    isFirst: true,
                    transformationInfo: currentTransformationInfo
                });
                this.vectorSuperModels.set(userId, vectorModel);

                console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);

                return {
                    success: true,
                    isNewSession: true,
                    similarity: 0,
                    decision: 'new',
                    nodesAdded: addResult.added,
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    sessionId: session.id,
                    rotationInfo: currentTransformationInfo
                };
            }

            // Есть существующий отпечаток - сравниваем
            console.log(`🔍 Сравниваю с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`
            });

            tempFootprint.metadata.normalizationInfo = currentTransformationInfo;

            const tempResult = tempFootprint.addAnalysisHonest(analysis, {
                ...photoInfo,
                normalizedGraph: finalGraph,
                photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
                source: photoInfo.source || 'telegram_bot_temp',
                transformationInfo: currentTransformationInfo
            });

            // 🔥 ДИАГНОСТИКА перед сравнением
            const existingTransformationInfo = session.currentFootprint.metadata.normalizationInfo;
            this.debugPointTrackerMatches(
                session.currentFootprint,
                tempFootprint,
                existingTransformationInfo,
                currentTransformationInfo
            );

            // Сравниваем
            const alignmentResult = await this.matcher.compareGraphs(
                session.currentFootprint.graph,
                tempFootprint.graph,
                {
                    userId: userId,
                    photoId: photoInfo.photoId,
                    transformationInfo1: existingTransformationInfo,
                    transformationInfo2: currentTransformationInfo
                }
            );

            let similarity = 0;
            let decision = 'unknown';

            if (alignmentResult && typeof alignmentResult.similarity === 'number') {
                similarity = alignmentResult.similarity;
                decision = alignmentResult.decision || 'unknown';
                console.log(`📊 Similarity: ${similarity.toFixed(3)}, decision: ${decision}`);
            }

            if (similarity === 0 && alignmentResult) {
                const foundSimilarity = this.extractSimilarityFromObject(alignmentResult);
                if (foundSimilarity) {
                    similarity = foundSimilarity.value;
                    decision = foundSimilarity.decision || 'unknown';
                }
            }

            if (isNaN(similarity) || typeof similarity !== 'number') {
                similarity = 0;
                decision = 'different';
            }

            const finalSimilarity = Math.max(0, Math.min(1, similarity));
            const finalDecision = decision !== 'unknown' ? decision :
                                (finalSimilarity > 0.6 ? 'same' : 'different');

            console.log(`🎯 Финальное: similarity=${finalSimilarity.toFixed(3)}, decision=${finalDecision}`);

            // 🔥 ЛОГИКА: Если следы совпали
            if (finalSimilarity > 0.6 && finalDecision === 'same') {
                console.log(`✅ Следы совпали (${finalSimilarity.toFixed(3)})`);

                // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ С УЧЕТОМ РАЗНЫХ УГЛОВ
                let clusterVizResult = null;
                if (this.config.enableMergeVisualization) {
                    clusterVizResult = await this.createClusterComparisonVisualization(
                        session.currentFootprint,
                        tempFootprint,
                        alignmentResult,
                        userId,
                        existingTransformationInfo,
                        currentTransformationInfo
                    );
                }

                // Работа с векторной моделью
                let vectorModel = this.vectorSuperModels.get(userId);
                let vectorVizPath = null;

                if (!vectorModel) {
                    const VectorSuperModel = require('./vector-super-model');
                    vectorModel = new VectorSuperModel({
                        name: `Супер-модель_${String(userId).slice(0, 6)}`,
                        enablePCA: false,
                        cellSize: 25,
                        debug: this.config.debug
                    });
                    this.vectorSuperModels.set(userId, vectorModel);

                    vectorModel.addGraph(
                        session.currentFootprint.graph,
                        session.currentFootprint.id,
                        {
                            isFirst: true,
                            transformationInfo: existingTransformationInfo
                        }
                    );
                }

                // Добавляем новый граф
                vectorModel.addGraph(
                    finalGraph,
                    tempFootprint.id,
                    {
                        similarity: finalSimilarity,
                        timestamp: new Date(),
                        ...photoInfo,
                        transformationInfo: currentTransformationInfo
                    }
                );

                // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ ИЗ СУПЕР-МОДЕЛИ
                console.log(`🔄 Обновляю подтверждения из супер-модели...`);
                const updatedFromSuperModel = this.updatePointTrackerFromSuperModel(
                    userId,
                    session.currentFootprint,
                    vectorModel,
                    existingTransformationInfo
                );

                console.log(`📊 Обновлено ${updatedFromSuperModel} точек из супер-модели`);

                // Визуализация и отправка в Telegram
                if (this.config.enableMergeVisualization && vectorModel) {
                    vectorVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);

                    if (bot && chatId && vectorVizPath && vectorVizPath.template) {
                        try {
                            if (fs.existsSync(vectorVizPath.template)) {
                                await bot.sendPhoto(chatId, vectorVizPath.template, {
                                    caption: `✅ **Следы совпали!**\n\n` +
                                            `🎯 Схожесть: ${(finalSimilarity * 100).toFixed(1)}%\n` +
                                            `📊 Взаимных совпадений: ${clusterVizResult?.customData?.pointAnalysis?.matchCount || 0}\n` +
                                            `📐 Угол 1: ${existingTransformationInfo?.rotationAngle.toFixed(1)}°\n` +
                                            `📐 Угол 2: ${currentTransformationInfo.rotationAngle.toFixed(1)}°\n` +
                                            `🔄 Разница: ${Math.abs((existingTransformationInfo?.rotationAngle || 0) - currentTransformationInfo.rotationAngle).toFixed(1)}°`
                                });
                                console.log(`✅ Визуализация отправлена в Telegram`);
                            }
                        } catch (sendError) {
                            console.log(`❌ Ошибка отправки: ${sendError.message}`);
                        }
                    }
                }

                // Отправка кластерной визуализации
                if (bot && chatId && clusterVizResult && clusterVizResult.path) {
                    try {
                        if (fs.existsSync(clusterVizResult.path)) {
                            const stats1 = this.calculateConfirmationStats(session.currentFootprint);
                            const stats2 = this.calculateConfirmationStats(tempFootprint);

                            let caption = `🎯 **СРАВНЕНИЕ СЛЕДОВ**\n\n`;
                            caption += `📊 Схожесть: ${(finalSimilarity * 100).toFixed(1)}%\n`;
                            caption += `📐 Углы: ${existingTransformationInfo?.rotationAngle.toFixed(1)}° vs ${currentTransformationInfo.rotationAngle.toFixed(1)}°\n\n`;
                           
                            // 🔥 НОВАЯ ИНФОРМАЦИЯ О КЛАССИФИКАЦИИ
                            if (clusterVizResult.customData?.pointAnalysis?.classification) {
                                const classification = clusterVizResult.customData.pointAnalysis.classification;
                                caption += `📈 **КЛАССИФИКАЦИЯ ТОЧЕК:**\n`;
                                caption += `• 🔴 Взаимные совпадения: ${classification.mutual.length} (есть в обоих)\n`;
                                caption += `• 🔵 Уникальные в следе 1: ${classification.unique1.length} (только в первом)\n`;
                                caption += `• 🔵 Уникальные в следе 2: ${classification.unique2.length} (только во втором)\n\n`;
                            }
                           
                            caption += `📊 **ПОДТВЕРЖДЕНИЯ:**\n`;
                            caption += `• 🔴 Красные (2+): ${stats1.confirmed2} в следе 1, ${stats2.confirmed2} в следе 2\n`;
                            caption += `• 🔵 Синие (1): ${stats1.confirmed1} в следе 1, ${stats2.confirmed1} в следе 2\n\n`;
                            caption += `🎨 **ИНВАРИАНТНОСТЬ К ПОВОРОТУ:**\n`;
                            caption += `• Система учитывает разные углы поворота\n`;
                            caption += `• Только взаимные совпадения становятся красными`;

                            await bot.sendPhoto(chatId, clusterVizResult.path, {
                                caption: caption,
                                parse_mode: 'Markdown'
                            });

                            console.log('✅ Кластерная визуализация отправлена');
                        }
                    } catch (sendError) {
                        console.log('❌ Ошибка отправки кластерной визуализации:', sendError.message);
                    }
                }

                const result = {
                    success: true,
                    similarity: finalSimilarity,
                    decision: finalDecision,
                    nodesAdded: tempResult.added,
                    hasMergeVisualization: true,
                    mergeMethod: 'rotation_invariant',
                    message: `✅ След добавлен! Сходство: ${(finalSimilarity * 100).toFixed(1)}%`,
                    transformationInfo: currentTransformationInfo,
                    angleDifference: Math.abs((existingTransformationInfo?.rotationAngle || 0) - currentTransformationInfo.rotationAngle),
                    pointsUpdated: updatedFromSuperModel,
                    // 🔥 НОВОЕ: Информация о классификации
                    classification: clusterVizResult?.customData?.pointAnalysis?.classification
                };

                console.log(`📊 Результат addPhotoToSession: схожесть=${finalSimilarity.toFixed(3)}, решение=${finalDecision}, обновлено точек=${updatedFromSuperModel}`);

                return result;

            } else {
                // СЛЕДЫ РАЗНЫЕ
                console.log(`🆕 Следы разные (${finalSimilarity.toFixed(3)}) - начинаю новую модель`);

                if (session.currentFootprint.graph.nodes.size >= 10) {
                    this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
                }

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
                });

                session.currentFootprint.metadata.normalizationInfo = currentTransformationInfo;

                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: currentTransformationInfo
                });

                return {
                    success: true,
                    similarity: finalSimilarity,
                    decision: finalDecision,
                    isNewModel: true,
                    nodesAdded: addResult.added,
                    transformationInfo: currentTransformationInfo
                };
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    extractSimilarityFromObject(obj, path = '') {
        if (!obj || typeof obj !== 'object') return null;

        for (const key in obj) {
            if (key === 'similarity' && typeof obj[key] === 'number') {
                const decision = obj.decision ||
                               obj.result?.decision ||
                               obj.details?.decision ||
                               'unknown';

                return {
                    value: obj[key],
                    decision: decision,
                    path: path ? `${path}.${key}` : key
                };
            }

            if (typeof obj[key] === 'object' && obj[key] !== null) {
                const found = this.extractSimilarityFromObject(obj[key], key);
                if (found) return found;
            }
        }

        return null;
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) return null;

            let templateData = vectorModel.getVisualizationData();

            if (!templateData || !templateData.cells || templateData.cells.length === 0) {
                if (vectorModel.templateBuilder) {
                    templateData = vectorModel.templateBuilder.getVisualizationData();
                }
            }

            const result = await this.templateVisualizer.visualizeTemplate(templateData, {
                filename: `template_${userId}_${Date.now()}.png`
            });

            const heatmapResult = await this.templateVisualizer.createHeatmap(templateData, {
                filename: `heatmap_${userId}_${Date.now()}.png`
            });

            let heatmapPath = heatmapResult;
            if (heatmapResult && typeof heatmapResult === 'object' && heatmapResult.path) {
                heatmapPath = heatmapResult.path;
            }

            return {
                template: result.path,
                heatmap: heatmapPath,
                stats: templateData?.stats,
                templateId: templateData?.templateId
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            return null;
        }
    }

    extractPointsFromAnalysis(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        predictions.forEach(pred => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                points.push({
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points
                });
            }
        });

        return points;
    }

    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId,
            userId: String(userId),
            name: name || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            analyses: [],
            comparisons: [],
            confirmedPhotos: 0,
            currentFootprint: null,
            metadata: {
                created: new Date(),
                autoAlignment: this.config.autoAlignment,
                usePointTracker: true,
                normalizationHistory: [],
                lastTransformation: null
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)}... для пользователя ${userId}`);

        return session;
    }

    // ... остальные методы (ensureDirectories, loadExistingModels, getActiveSession, и т.д.)
    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/templates')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    loadExistingModels() {
        const modelsDir = path.join(this.config.dbPath, 'models');

        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'));
        console.log(`📂 Загрузка моделей из ${modelsDir} (${files.length} файлов)`);

        let loadedCount = 0;

        files.slice(0, 100).forEach(file => {
            try {
                const filePath = path.join(modelsDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                const SimpleFootprint = require('./simple-footprint');
                const footprint = SimpleFootprint.fromJSON(data);
                this.loadedModels.set(footprint.id, footprint);
                loadedCount++;

            } catch (error) {
                console.log(`⚠️ Ошибка загрузки модели ${file}:`, error.message);
            }
        });

        this.systemStats.totalModels = loadedCount;
        console.log(`✅ Загружено ${loadedCount} моделей`);
    }

    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    getSystemStats() {
        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            vectorModels: this.vectorSuperModels.size,
            config: {
                autoAlignment: this.config.autoAlignment,
                enableMergeVisualization: this.config.enableMergeVisualization,
                usePointTracker: this.config.usePointTracker,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold
            }
        };
    }

    // ... остальные методы (getMergeVisualizationCount, addMergeVisualization, saveSessionAsModel, и т.д.)
    getMergeVisualizationCount() {
        let total = 0;
        for (const [userId, history] of this.lastMergeVisualizations) {
            total += history.length;
        }
        return total;
    }

    addMergeVisualization(userId, vizInfo) {
        const history = this.lastMergeVisualizations.get(userId) || [];
        history.unshift(vizInfo);

        if (history.length > 10) {
            history.pop();
        }

        this.lastMergeVisualizations.set(userId, history);
        return history.length;
    }

    saveSessionAsModel(userId, modelName = null) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        const footprint = session.currentFootprint;

        if (modelName) {
            footprint.name = modelName;
        }

        const modelPath = path.join(this.config.dbPath, 'models', `${footprint.id}.json`);

        try {
            const modelData = footprint.toJSON();
            modelData.metadata.sessionInfo = {
                sessionId: session.id,
                photosCount: session.photos.length,
                confirmedPhotos: session.confirmedPhotos || 0,
                analysesCount: session.analyses.length,
                normalizationHistory: session.metadata.normalizationHistory || []
            };

            fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));

            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels = this.loadedModels.size;

            console.log(`💾 Модель сохранена: ${footprint.id} (${footprint.graph.nodes.size} узлов)`);

            this.userSessions.delete(userId);

            return {
                success: true,
                modelId: footprint.id,
                modelName: footprint.name,
                modelPath: modelPath,
                modelStats: {
                    nodes: footprint.graph.nodes.size,
                    edges: footprint.graph.edges.size,
                    confidence: footprint.stats.confidence,
                    confirmedNodes: 0
                },
                sessionInfo: {
                    photos: session.photos.length,
                    analyses: session.analyses.length,
                    confirmedPhotos: session.confirmedPhotos || 0
                }
            };

        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SimpleFootprintManager;
