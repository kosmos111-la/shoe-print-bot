// modules/footprint/simple-manager.js
// 🔥 КОРНЕВОЕ ИСПРАВЛЕНИЕ ТРАНСФОРМАЦИЙ КООРДИНАТ

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 🔥 Импорт SimpleGraph
const SimpleGraph = require('./simple-graph');

// 🔥 ШАГ 3: ДОБАВЛЯЕМ ИМПОРТ SIMPLE ALIGNER
const SimpleAligner = require('./alignment/simple-aligner');

// 🔥 ДОБАВЛЯЕМ ИМПОРТ КОНВЕРТЕРА СИСТЕМ КООРДИНАТ
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,

            // 🔥 РЕАЛЬНЫЕ НАСТРОЙКИ
            usePointTracker: true,
            enableVectorSuperModel: true,
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableTemplateVisualization: options.enableTemplateVisualization !== false,

            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            minPointsForFootprint: options.minPointsForFootprint || 5,

            // Настройки для шаблона
            templateMatchThreshold: 80,
            minTemplateConfirmations: 1,

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

        // 🔥 ШАГ 3: ДОБАВЛЯЕМ SIMPLE ALIGNER В КОНСТРУКТОР
        this.aligner = new SimpleAligner({
            debug: this.config.debug,
            visualizationDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });

        // 🔥 ДОБАВЛЯЕМ КОНВЕРТЕР СИСТЕМ КООРДИНАТ
        this.coordinateConverter = new CoordinateSystemConverter({
            debug: this.config.debug
        });

        // Сессии пользователей
        this.userSessions = new Map();
        this.loadedModels = new Map();
        this.vectorSuperModels = new Map();

        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        this.templateVisualizer = new TemplateVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations/templates'),
            debug: this.config.debug
        });

        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalPhotosProcessed: 0,
            totalTemplateConfirmations: 0,
            lastActivity: new Date()
        };

        this.ensureDirectories();
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager с ИСПРАВЛЕННЫМИ ТРАНСФОРМАЦИЯМИ И ВАЛИДАЦИЕЙ`);
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение с преобразованием систем координат
    async compareWithCoordinateConversion(footprint1, footprint2) {
        console.log(`🎯 СРАВНЕНИЕ С ПРЕОБРАЗОВАНИЕМ СИСТЕМ КООРДИНАТ:`);

        // 1. Анализируем системы координат
        const analysis = this.coordinateConverter.analyzeCoordinateSystems(footprint1, footprint2);

        // 2. Получаем точки в правильной системе
        const points1 = this.getPointsInSystem(footprint1, 'template');
        const points2 = this.getPointsInSystem(footprint2, 'template');

        console.log(`📊 Точки для сравнения:`);
        console.log(`   След 1: ${points1.length} точек`);
        console.log(`   След 2: ${points2.length} точек`);

        // 3. Если системы не совместимы - преобразуем
        if (!analysis.compatible && analysis.steps) {
            console.log(`🔄 Преобразую точки System2 → System1...`);
            const transformedPoints2 = this.coordinateConverter.convertPoints(
                points2,
                analysis.system2,
                analysis.system1
            );

            // 4. Выравниваем преобразованные точки
            const aligner = new SimpleAligner({ debug: true });
            const alignedPoints = await aligner.alignWithIntelligentMatching(
                transformedPoints2,
                points1
            );

            // 5. Сравниваем
            return this.compareAlignedFootprints(points1, alignedPoints);
        } else {
            // Системы совместимы, используем обычное выравнивание
            return await this.compareWithAlignment(footprint1, footprint2);
        }
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
                const systemInfo = this.extractCoordinateSystem(footprint);
                const templateSystem = this.getTemplateCoordinateSystem();

                const converted = this.coordinateConverter.convertSinglePoint(
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

    // 🔥 НОВЫЙ МЕТОД: Извлечь информацию о системе координат отпечатка
    extractCoordinateSystem(footprint) {
        const transformation = footprint.getTransformation();

        // Получаем точки для анализа границ
        const points = [];
        if (footprint.pointTracker) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({ x: point.x, y: point.y });
            }
        }

        const bounds = this.calculateBounds(points);

        return {
            type: transformation ? 'transformed' : 'raw',
            rotationAngle: transformation?.rotationAngle || 0,
            isMirrored: transformation?.isMirrored || false,
            matrix: transformation?.matrix,
            center: transformation?.center,
            bounds: bounds,
            pointCount: points.length,
            footprintName: footprint.name
        };
    }

    // 🔥 ВАЛИДАЦИЯ ПЕРЕД СРАВНЕНИЕМ (СУЩЕСТВУЮЩИЙ МЕТОД)
    async validateAndCompare(footprint1, footprint2) {
        console.log('\n🔍 ВАЛИДАЦИЯ ПЕРЕД СРАВНЕНИЕМ:');

        // 1. Проверить системы координат
        const CoordinateValidator = require('./alignment/coordinate-validator');
        const validator = new CoordinateValidator({ debug: true });
        validator.validateCoordinateSystems(footprint1, footprint2);

        // 2. Получить точки в правильной системе
        const points1 = this.getPointsInConsistentSystem(footprint1);
        const points2 = this.getPointsInConsistentSystem(footprint2);

        console.log(`📊 Точки для сравнения:`);
        console.log(`   След 1: ${points1.length} точек`);
        console.log(`   След 2: ${points2.length} точек`);

        // 3. Проверить, нужна ли коррекция ориентации
        let needsCorrection = this.needsOrientationCorrection(points1, points2);

        let correctedPoints2 = [...points2];
        if (needsCorrection) {
            console.log('🔄 Применяю автоматическую коррекцию ориентации...');
            correctedPoints2 = this.applyAutomaticOrientationCorrection(correctedPoints2, points1);
        }

        // 4. Выполнить выравнивание
        const aligner = new SimpleAligner({ debug: true });
        const alignedPoints = await aligner.alignWithIntelligentMatching(
            correctedPoints2, points1,
            footprint2.getTransformation(),
            footprint1.getTransformation()
        );

        // 5. Сравнить
        return this.compareAlignedFootprints(points1, alignedPoints, footprint1, footprint2);
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

        console.log(`📊 Точки в согласованной системе: ${points.length} (пример: ${points[0]?.x?.toFixed(1)}, ${points[0]?.y?.toFixed(1)})`);
        return points;
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить нужна ли коррекция ориентации
    needsOrientationCorrection(points1, points2) {
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
        const TransformationDebugger = require('./alignment/transformation-debugger');
        const debuggerTool = new TransformationDebugger({ debug: true });
        debuggerTool.analyzeTransformation(footprint1, footprint2);

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
        const ImprovedAligner = require('./alignment/improved-aligner');
        const aligner = new ImprovedAligner({ debug: true });

        const alignmentResult = await aligner.alignWithIntelligentMatching(
            points2,
            points1,
            footprint2.getTransformation(),
            footprint1.getTransformation()
        );

        // 5. Сравнить с улучшенной логикой
        return this.compareWithEnhancedLogic(points1, alignmentResult.alignedPoints);
    }

    // 🔥 СУЩЕСТВУЮЩИЕ МЕТОДЫ (без изменений)
    checkIfNeeds90DegreeRotation(points1, points2) {
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

    // 🔥 ШАГ 3: НОВЫЙ МЕТОД - Использовать алайнер для сравнения
    async compareWithAlignment(footprint1, footprint2) {
    console.log(`🎯 Сравнение с ВЫРАВНИВАНИЕМ: "${footprint1.name}" vs "${footprint2.name}"`);
   
    // 🔥 ШАГ 1: ГЛУБОКИЙ ДЕБАГ ТРАНСФОРМАЦИЙ
    console.log(`\n🔍🔍🔍 ГЛУБОКИЙ АНАЛИЗ ТРАНСФОРМАЦИЙ:`);
   
    const trans1_raw = footprint1.transformation;
    const trans1_get = footprint1.getTransformation();
    const trans2_raw = footprint2.transformation;
    const trans2_get = footprint2.getTransformation();
   
    console.log(`📌 СЛЕД 1 "${footprint1.name}":`);
    console.log(`   • this.transformation: ${trans1_raw?.rotationAngle || 'нет'}°`);
    console.log(`   • getTransformation(): ${trans1_get?.rotationAngle || 'нет'}°`);
    console.log(`   • Сравнение: ${trans1_raw?.rotationAngle === trans1_get?.rotationAngle ? 'одинаково ✅' : 'РАЗНЫЕ! ❌'}`);
   
    console.log(`\n📌 СЛЕД 2 "${footprint2.name}":`);
    console.log(`   • this.transformation: ${trans2_raw?.rotationAngle || 'нет'}°`);
    console.log(`   • getTransformation(): ${trans2_get?.rotationAngle || 'нет'}°`);
    console.log(`   • Сравнение: ${trans2_raw?.rotationAngle === trans2_get?.rotationAngle ? 'одинаково ✅' : 'РАЗНЫЕ! ❌'}`);
   
    // 🔥 ШАГ 2: ИСПОЛЬЗУЕМ РЕАЛЬНЫЕ УГЛЫ, НЕ НОРМАЛИЗУЕМ ИХ!
    let transformation1 = trans1_get;
    let transformation2 = trans2_get;
   
    console.log(`\n📐 ИСПОЛЬЗУЮ РЕАЛЬНЫЕ ТРАНСФОРМАЦИИ (БЕЗ нормализации к 0°!):`);
    console.log(`   ${footprint1.name}: ${transformation1?.rotationAngle || 0}°`);
    console.log(`   ${footprint2.name}: ${transformation2?.rotationAngle || 0}°`);
   
    // 🔥 ШАГ 3: ЕСЛИ ОБА УГЛА 0°, ПРОВЕРЯЕМ НУЖНА ЛИ КОРРЕКЦИЯ
    if ((transformation1?.rotationAngle || 0) === 0 && (transformation2?.rotationAngle || 0) === 0) {
        console.log(`\n⚠️ ВНИМАНИЕ: Оба угла 0°, проверяю правильно ли это...`);
       
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);
       
        if (points1.length >= 3 && points2.length >= 3) {
            const bounds1 = this.calculateBounds(points1);
            const bounds2 = this.calculateBounds(points2);
           
            const ratio1 = bounds1.width / Math.max(1, bounds1.height);
            const ratio2 = bounds2.width / Math.max(1, bounds2.height);
           
            console.log(`   Пропорции следов:`);
            console.log(`     ${footprint1.name}: ${bounds1.width.toFixed(1)}x${bounds1.height.toFixed(1)} (ratio: ${ratio1.toFixed(2)})`);
            console.log(`     ${footprint2.name}: ${bounds2.width.toFixed(1)}x${bounds2.height.toFixed(1)} (ratio: ${ratio2.toFixed(2)})`);
           
            // 🔥 АВТОКОРРЕКЦИЯ: если один след вертикальный, другой горизонтальный
            const VERTICAL_THRESHOLD = 0.5;
            const HORIZONTAL_THRESHOLD = 2.0;
           
            const isVertical1 = ratio1 < VERTICAL_THRESHOLD;
            const isHorizontal1 = ratio1 > HORIZONTAL_THRESHOLD;
            const isVertical2 = ratio2 < VERTICAL_THRESHOLD;
            const isHorizontal2 = ratio2 > HORIZONTAL_THRESHOLD;
           
            if ((isVertical1 && isHorizontal2) || (isHorizontal1 && isVertical2)) {
                console.log(`\n🚨 ОБНАРУЖЕНО: Следы повернуты на 90° друг относительно друга!`);
                console.log(`   Но их трансформации показывают 0° - это ошибка!`);
               
                // 🔥 АВТОКОРРЕКЦИЯ: Устанавливаем правильные углы
                const correctedAngle = 90;
                console.log(`   🔧 Применяю авто-коррекцию: устанавливаю угол ${correctedAngle}°`);
               
                // Корректируем один из следов
                if (isVertical1 && isHorizontal2) {
                    // След 2 должен быть повернут на 90°
                    transformation2 = {
                        ...transformation2,
                        rotationAngle: correctedAngle,
                        autoCorrected: true,
                        originalRatio: ratio2,
                        correctionType: 'vertical_to_horizontal'
                    };
                    console.log(`   ✅ ${footprint2.name} скорректирован до ${correctedAngle}°`);
                } else {
                    // След 1 должен быть повернут на 90°
                    transformation1 = {
                        ...transformation1,
                        rotationAngle: correctedAngle,
                        autoCorrected: true,
                        originalRatio: ratio1,
                        correctionType: 'horizontal_to_vertical'
                    };
                    console.log(`   ✅ ${footprint1.name} скорректирован до ${correctedAngle}°`);
                }
            }
        }
    }
   
    // 🔥 ШАГ 4: ВЫВОД ИНФОРМАЦИИ ДЛЯ ВЫРАВНИВАНИЯ
    console.log(`\n🎯 ИНФОРМАЦИЯ ДЛЯ ВЫРАВНИВАНИЯ:`);
    console.log(`   ${footprint1.name}: ${transformation1?.rotationAngle || 0}° (${transformation1?.autoCorrected ? 'авто-скорректировано' : 'оригинальный'})`);
    console.log(`   ${footprint2.name}: ${transformation2?.rotationAngle || 0}° (${transformation2?.autoCorrected ? 'авто-скорректировано' : 'оригинальный'})`);
   
    // 🔥 ШАГ 5: ВЫРАВНИВАНИЕ С РЕАЛЬНЫМИ УГЛАМИ
    try {
        // 🔥 ВАЖНО: Передаем РЕАЛЬНЫЕ трансформации, а не нормализованные к 0°!
        const alignmentResult = await this.aligner.testAlignment(
            footprint1,
            footprint2,
            transformation2 || this.createIdentityTransformation(),
            transformation1 || this.createIdentityTransformation()
        );
       
        if (alignmentResult.success) {
            console.log(`✅ Выравнивание успешно! Качество: ${alignmentResult.quality?.toFixed(3)}`);
           
            // Сравниваем выровненные точки
            const comparison = this.compareFootprintsWithAlignment(
                footprint1,
                footprint2,
                alignmentResult.alignedPoints || []
            );
           
            return {
                ...comparison,
                alignment: alignmentResult,
                method: 'alignment_based_with_real_angles',
                transformations: {
                    footprint1: {
                        angle: transformation1?.rotationAngle || 0,
                        autoCorrected: transformation1?.autoCorrected || false
                    },
                    footprint2: {
                        angle: transformation2?.rotationAngle || 0,
                        autoCorrected: transformation2?.autoCorrected || false
                    }
                },
                debug: {
                    originalAngles: {
                        footprint1: trans1_get?.rotationAngle || 0,
                        footprint2: trans2_get?.rotationAngle || 0
                    },
                    usedAngles: {
                        footprint1: transformation1?.rotationAngle || 0,
                        footprint2: transformation2?.rotationAngle || 0
                    }
                }
            };
        } else {
            console.log(`⚠️ Выравнивание не удалось, использую стандартный метод`);
            const fallbackResult = await this.matcher.compareGraphs(footprint1.graph, footprint2.graph);
           
            return {
                ...fallbackResult,
                alignment: { success: false, error: alignmentResult.error },
                method: 'graph_based_fallback'
            };
        }
       
    } catch (error) {
        console.log(`❌ Ошибка выравнивания:`, error.message);
       
        // Фоллбэк на сравнение графов
        try {
            const fallbackResult = await this.matcher.compareGraphs(footprint1.graph, footprint2.graph);
            return {
                ...fallbackResult,
                alignment: { success: false, error: error.message },
                method: 'graph_based_error_fallback'
            };
        } catch (fallbackError) {
            return {
                similarity: 0,
                decision: 'different',
                reason: `Ошибка сравнения: ${error.message}`,
                alignment: { success: false, error: error.message },
                method: 'error'
            };
        }
    }
}

    // 🔥 ШАГ 3: НОВЫЙ МЕТОД - Сравнить с учетом выравнивания
    compareFootprintsWithAlignment(footprint1, footprint2, alignedPoints2) {
        // Получаем точки первого следа
        const points1 = [];
        for (const [id, point] of footprint1.pointTracker.points) {
            points1.push({
                id,
                x: point.x,
                y: point.y,
                confirmedCount: point.confirmedCount || 1
            });
        }

        // Сравниваем выровненные точки
        let matches = 0;
        const matchThreshold = 25; // 25px

        alignedPoints2.forEach(point2 => {
            const nearest = this.findNearestPointInArray(point2, points1, matchThreshold);
            if (nearest) {
                matches++;
            }
        });

        const similarity = matches / Math.max(points1.length, alignedPoints2.length);

        let decision, reason;
        if (similarity > 0.7) {
            decision = 'same';
            reason = `Высокая схожесть после выравнивания (${similarity.toFixed(3)})`;
        } else if (similarity > 0.4) {
            decision = 'similar';
            reason = `Умеренная схожесть после выравнивания (${similarity.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть после выравнивания (${similarity.toFixed(3)})`;
        }

        return {
            similarity,
            decision,
            reason,
            matches,
            totalPoints1: points1.length,
            totalPoints2: alignedPoints2.length,
            matchRate: (matches / Math.min(points1.length, alignedPoints2.length)).toFixed(3)
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
    // 🔥 КОРОТКИЙ ВЫВОД вместо спама
    console.log(`\n🎯 СРАВНЕНИЕ: "${footprint1.name}" vs "${footprint2.name}"`);

    const trans1 = footprint1.getTransformation();
    const trans2 = footprint2.getTransformation();

    console.log(`   ${footprint1.name}: ${trans1?.rotationAngle || 0}°`);
    console.log(`   ${footprint2.name}: ${trans2?.rotationAngle || 0}°`);

    const angleDiff = Math.abs((trans1?.rotationAngle || 0) - (trans2?.rotationAngle || 0));
    console.log(`   Разница углов: ${angleDiff}°`);

    if (angleDiff > 45 && angleDiff < 135) {
        console.log(`   ⚠️ Следы повернуты на ~90°`);
    }

    try {
        // 🔥 ВАЖНО: Получаем точки в НОРМАЛИЗОВАННОЙ системе для сравнения
        const points1 = footprint1.getPointsInNormalizedSystem();
        const points2 = footprint2.getPointsInNormalizedSystem();

        console.log(`📊 Точки для сравнения:`);
        console.log(`   ${footprint1.name}: ${points1.length} точек в нормализованной системе`);
        console.log(`   ${footprint2.name}: ${points2.length} точек в нормализованной системе`);

        // 🔥 СРАВНЕНИЕ ТОЧЕК В ОДНОЙ СИСТЕМЕ КООРДИНАТ
        let matches = 0;
        const threshold = 25; // 25px в нормализованной системе

        for (const point1 of points1) {
            for (const point2 of points2) {
                const distance = Math.sqrt(
                    Math.pow(point2.x - point1.x, 2) +
                    Math.pow(point2.y - point1.y, 2)
                );

                if (distance < threshold) {
                    matches++;
                    break; // Каждая точка может совпасть только с одной
                }
            }
        }

        const similarity = matches / Math.max(points1.length, points2.length);

        console.log(`📈 РЕЗУЛЬТАТ СРАВНЕНИЯ ТОЧЕК:`);
        console.log(`   Совпало точек: ${matches}/${Math.max(points1.length, points2.length)}`);
        console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}%`);

        // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ СРАЗУ
        const updatedCount = this.updateConfirmationsDirectly(footprint1, footprint2);

        let decision, reason;
        if (similarity > 0.7) {
            decision = 'same';
            reason = `Высокое сходство точек (${(similarity * 100).toFixed(1)}%)`;
        } else if (similarity > 0.4) {
            decision = 'similar';
            reason = `Умеренное сходство точек (${(similarity * 100).toFixed(1)}%)`;
        } else {
            decision = 'different';
            reason = `Низкое сходство точек (${(similarity * 100).toFixed(1)}%)`;
        }

        return {
            similarity,
            decision,
            reason,
            matchesCount: matches,
            totalPoints: Math.max(points1.length, points2.length),
            pointsUpdated: updatedCount,
            method: 'normalized_point_comparison'
        };

    } catch (error) {
        console.log(`❌ Ошибка паттернового сравнения:`, error.message);
        console.error(error.stack);

        // Фоллбэк на выравнивание
        console.log('🔄 Использую выравнивание как фоллбэк...');
        return await this.compareWithAlignment(footprint1, footprint2);
    }
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

        const vectorModel = this.vectorSuperModels.get(userId);
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

    // 🔥 ДЕБАГ МЕТОД: Проверить накопление деталей
    debugAccumulation(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel || !vectorModel.templateBuilder) {
            console.log('❌ Нет шаблона для проверки накопления');
            return;
        }

        const templateData = vectorModel.templateBuilder.getVisualizationData();

        console.log('\n🔍 ДЕБАГ НАКОПЛЕНИЯ ДЕТАЛЕЙ:');
        console.log(`Шаблон: ${templateData.name}`);
        console.log(`Всего ячеек: ${templateData.stats.totalCells}`);
        console.log(`Всего подтверждений: ${templateData.stats.totalConfirmations}`);

        // 🔥 СТАТИСТИКА ПО ТИПАМ ТОЧЕК
        const cells = templateData.cells || [];
        const byStatus = {};

        cells.forEach(cell => {
            const status = cell.status || 'unknown';
            byStatus[status] = (byStatus[status] || 0) + 1;
        });

        console.log('\n📊 РАСПРЕДЕЛЕНИЕ ПО СТАТУСАМ:');
        Object.entries(byStatus).forEach(([status, count]) => {
            const percent = ((count / cells.length) * 100).toFixed(1);
            console.log(`   ${status}: ${count} (${percent}%)`);
        });

        // 🔥 НОВЫЕ ТОЧКИ
        const newCells = cells.filter(c => c.isNew);
        console.log(`\n🆕 НОВЫЕ ТОЧКИ: ${newCells.length}`);
        newCells.slice(0, 3).forEach((cell, i) => {
            console.log(`   ${i + 1}. ${cell.id.slice(0, 12)}: ${cell.confirmations} подтверждений`);
        });

        // 🔥 КАЧЕСТВО ПОДТВЕРЖДЕНИЙ
        const confirmationDistribution = {};
        cells.forEach(cell => {
            const conf = cell.confirmations || 1;
            if (conf >= 5) confirmationDistribution['5+'] = (confirmationDistribution['5+'] || 0) + 1;
            else confirmationDistribution[conf] = (confirmationDistribution[conf] || 0) + 1;
        });

        console.log('\n📈 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:');
        Object.entries(confirmationDistribution).sort((a, b) => {
            const aKey = a[0] === '5+' ? 5 : parseInt(a[0]);
            const bKey = b[0] === '5+' ? 5 : parseInt(b[0]);
            return aKey - bKey;
        }).forEach(([confirmations, count]) => {
            const percent = ((count / cells.length) * 100).toFixed(1);
            console.log(`   ${confirmations}: ${count} (${percent}%)`);
        });

        // 🔥 ИСТОЧНИКИ (графы)
        const sources = new Set();
        cells.forEach(cell => {
            (cell.sources || []).forEach(source => sources.add(source));
        });

        console.log(`\n📁 ИСТОЧНИКИ: ${sources.size} различных графов`);

        // 🔥 КАЧЕСТВО ЭТАЛОНА
        console.log(`\n🎯 ЭТАЛОН: ${templateData.referenceGraphId?.slice(0, 8) || 'нет'}`);
        console.log(`   Качество: ${templateData.referenceGraphQuality?.toFixed(3) || 0}`);
        console.log(`   Лучший граф: ${templateData.dynamicInfo?.bestGraphId?.slice(0, 8) || 'нет'}`);
        console.log(`   Качество лучшего: ${templateData.dynamicInfo?.bestGraphQuality?.toFixed(3) || 0}`);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Обновление подтверждений с правильной трансформацией
    updateConfirmationsFromTemplate(footprint, vectorModel, transformationInfo = null) {
        console.log(`🔄 ОБНОВЛЯЮ ПОДТВЕРЖДЕНИЯ с ПРАВИЛЬНОЙ ТРАНСФОРМАЦИЕЙ...`);

        if (!footprint || !footprint.pointTracker) {
            console.log('⚠️ Нет отпечатка или PointTracker');
            return 0;
        }

        if (!vectorModel || !vectorModel.templateBuilder) {
            console.log('⚠️ Нет шаблона');
            return 0;
        }

        const tracker = footprint.pointTracker;
        const templateBuilder = vectorModel.templateBuilder;

        // 1. ПОЛУЧАЕМ ТРАНСФОРМАЦИЮ ОТПЕЧАТКА
        let footprintTransformation = footprint.getTransformation();

        if (!footprintTransformation || !footprintTransformation.matrix) {
            console.log('⚠️ У отпечатка нет трансформации! Создаю по умолчанию...');
            footprintTransformation = {
                matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
                rotationAngle: 0,
                isMirrored: false,
                center: { x: 0, y: 0 },
                bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
                scale: { x: 1, y: 1 },
                translation: { x: 0, y: 0 },
                type: 'default_identity'
            };
        }

        console.log(`📐 Трансформация отпечатка:`);
        console.log(`   Угол: ${footprintTransformation.rotationAngle?.toFixed(1) || 0}°`);
        console.log(`   Зеркало: ${footprintTransformation.isMirrored ? 'да' : 'нет'}`);
        console.log(`   Центр: (${footprintTransformation.center?.x?.toFixed(1)}, ${footprintTransformation.center?.y?.toFixed(1)})`);

        // 2. ПОЛУЧАЕМ ДАННЫЕ ШАБЛОНА
        const templateData = templateBuilder.getVisualizationData();
        if (!templateData || !templateData.cells || templateData.cells.length === 0) {
            console.log('⚠️ Нет данных ячеек в шаблоне');
            return 0;
        }

        console.log(`📊 Данные шаблона: ${templateData.cells.length} ячеек`);

        // 3. ПОЛУЧАЕМ ТРАНСФОРМАЦИЮ ШАБЛОНА
        const templateTransformation = templateBuilder.getNormalizationTransform();

        if (!templateTransformation) {
            console.log('⚠️ У шаблона нет трансформации!');
            return this.fallbackDirectComparison(tracker, templateBuilder);
        }

        console.log(`📐 Трансформация шаблона:`);
        console.log(`   Границы: ${templateTransformation.width?.toFixed(1)}x${templateTransformation.height?.toFixed(1)}`);
        console.log(`   Смещение: (${templateTransformation.minX?.toFixed(1)}, ${templateTransformation.minY?.toFixed(1)})`);

        // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: ПРОСТОЕ ПРЕОБРАЗОВАНИЕ КООРДИНАТ
        const templatePointsInFootprintSystem = [];

        // Для каждой ячейки шаблона
        templateData.cells.forEach((cell, index) => {
            // Координаты в нормализованной системе шаблона (0-1)
            const normalizedX = cell.nx || 0;
            const normalizedY = cell.ny || 0;

            // 1. Преобразуем нормализованные координаты в реальные координаты шаблона
            const templateX = normalizedX * templateTransformation.width + templateTransformation.minX;
            const templateY = normalizedY * templateTransformation.height + templateTransformation.minY;

            // 🔥 ПРОСТОЕ РЕШЕНИЕ: Предполагаем, что шаблон уже в нормализованной системе (угол 0°)
            // И точка шаблона уже в правильной системе координат

            // 2. Если отпечаток имеет трансформацию (поворот), применяем ее к точке
            let transformedX = templateX;
            let transformedY = templateY;

            const footprintAngle = footprintTransformation.rotationAngle || 0;

            if (footprintAngle !== 0 && footprintTransformation.center) {
                // Применяем поворот отпечатка к точке шаблона
                const centerX = footprintTransformation.center.x || 0;
                const centerY = footprintTransformation.center.y || 0;

                // Переносим в систему координат с центром в центре отпечатка
                const dx = templateX - centerX;
                const dy = templateY - centerY;

                // Поворачиваем
                const angleRad = -footprintAngle * Math.PI / 180; // Отрицательный, потому что мы компенсируем поворот
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                const rotatedX = dx * cosA - dy * sinA;
                const rotatedY = dx * sinA + dy * cosA;

                // Возвращаем в исходную систему координат
                transformedX = rotatedX + centerX;
                transformedY = rotatedY + centerY;

                // Дебаг для первых точек
                if (index < 3) {
                    console.log(`   Ячейка ${cell.id?.slice(0, 8)}:`);
                    console.log(`     В шаблоне: (${templateX.toFixed(1)}, ${templateY.toFixed(1)})`);
                    console.log(`     После поворота ${footprintAngle.toFixed(1)}°: (${transformedX.toFixed(1)}, ${transformedY.toFixed(1)})`);
                }
            }

            templatePointsInFootprintSystem.push({
                x: transformedX,
                y: transformedY,
                nx: normalizedX,
                ny: normalizedY,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id,
                isNew: cell.isNew || false,
                status: cell.status || 'unknown',
                originalTemplatePoint: { x: templateX, y: templateY },
                originalCell: cell,
                cellIndex: index
            });
        });

        console.log(`📊 Преобразовано ${templatePointsInFootprintSystem.length} точек шаблона`);

        // 4. ПОЛУЧАЕМ ТОЧКИ ТРЕКЕРА В СИСТЕМЕ ОТПЕЧАТКА
        const trackerPoints = [];
        for (const [id, point] of tracker.points) {
            trackerPoints.push({
                id,
                x: point.x,
                y: point.y,
                confidence: point.rating || 0.5,
                confirmedCount: point.confirmedCount || 1,
                pointData: point
            });
        }

        console.log(`📊 Точки трекера: ${trackerPoints.length}`);

        // 5. ДЕБАГ: Показываем примеры координат
        if (trackerPoints.length > 0 && templatePointsInFootprintSystem.length > 0) {
            console.log(`\n🔍 ПРИМЕРЫ КООРДИНАТ (первые 3):`);

            for (let i = 0; i < Math.min(3, trackerPoints.length); i++) {
                const trackerPoint = trackerPoints[i];
                console.log(`   Точка трекера ${i+1}: (${trackerPoint.x.toFixed(1)}, ${trackerPoint.y.toFixed(1)})`);

                // Ищем ближайшую точку шаблона
                let nearestTemplate = null;
                let minDistance = Infinity;

                for (const templatePoint of templatePointsInFootprintSystem) {
                    const distance = Math.sqrt(
                        Math.pow(templatePoint.x - trackerPoint.x, 2) +
                        Math.pow(templatePoint.y - trackerPoint.y, 2)
                    );

                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestTemplate = templatePoint;
                    }
                }

                if (nearestTemplate) {
                    console.log(`   Ближайшая точка шаблона: (${nearestTemplate.x.toFixed(1)}, ${nearestTemplate.y.toFixed(1)})`);
                    console.log(`   Расстояние: ${minDistance.toFixed(1)}px`);
                }
            }
        }

        // 6. СРАВНИВАЕМ ТОЧКИ
        const comparisonResult = this.comparePointsInSameCoordinateSystem(
            trackerPoints,
            templatePointsInFootprintSystem,
            footprintTransformation
        );

        // 7. ПРИМЕНЯЕМ РЕЗУЛЬТАТЫ
        const updatedCount = this.applyComparisonToTracker(
            tracker,
            comparisonResult.matches
        );

        // 8. ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ В ОТПЕЧАТКЕ
        this.updateFootprintConfirmations(footprint, comparisonResult.matches);

        console.log(`\n🎯 РЕЗУЛЬТАТ СРАВНЕНИЯ С ШАБЛОНОМ:`);
        console.log(`   • Всего точек трекера: ${trackerPoints.length}`);
        console.log(`   • Всего точек шаблона: ${templatePointsInFootprintSystem.length}`);
        console.log(`   • Найдено совпадений: ${comparisonResult.matches.length}`);
        console.log(`   • Идеальные (<15px): ${comparisonResult.perfectMatches}`);
        console.log(`   • Хорошие (15-30px): ${comparisonResult.goodMatches}`);
        console.log(`   • Обновлено точек: ${updatedCount}`);
        console.log(`   • Процент совпадений: ${comparisonResult.matchRate.toFixed(1)}%`);

        return updatedCount;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Сравнить точки в одной системе координат
    comparePointsInSameCoordinateSystem(trackerPoints, templatePoints, transformation) {
        console.log(`🔍 Сравниваю ${trackerPoints.length} и ${templatePoints.length} точек...`);

        const matches = [];
        let perfectMatches = 0;
        let goodMatches = 0;

        const PERFECT_THRESHOLD = 15;    // 15px - точное совпадение
        const GOOD_THRESHOLD = 30;       // 30px - хорошее совпадение
        const MAX_THRESHOLD = 50;        // 50px - максимальное

        // ДЛЯ КАЖДОЙ ТОЧКИ ТРЕКЕРА ИЩЕМ БЛИЖАЙШУЮ ТОЧКУ ШАБЛОНА
        trackerPoints.forEach(trackerPoint => {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestTemplatePoint = null;

            for (const templatePoint of templatePoints) {
                const distance = Math.sqrt(
                    Math.pow(templatePoint.x - trackerPoint.x, 2) +
                    Math.pow(templatePoint.y - trackerPoint.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        trackerPoint: trackerPoint,
                        templatePoint: templatePoint,
                        distance: distance,
                        quality: this.calculateMatchQuality(distance, templatePoint.confidence)
                    };
                    bestTemplatePoint = templatePoint;
                }
            }

            if (bestMatch) {
                // Классифицируем качество совпадения
                if (minDistance < PERFECT_THRESHOLD) {
                    bestMatch.matchType = 'perfect';
                    perfectMatches++;
                } else if (minDistance < GOOD_THRESHOLD) {
                    bestMatch.matchType = 'good';
                    goodMatches++;
                } else if (minDistance < MAX_THRESHOLD) {
                    bestMatch.matchType = 'acceptable';
                } else {
                    bestMatch.matchType = 'poor';
                }

                matches.push(bestMatch);
            }
        });

        // РАСЧЕТ СТАТИСТИКИ
        const totalMatches = matches.length;
        const matchRate = trackerPoints.length > 0 ? (totalMatches / trackerPoints.length * 100) : 0;

        return {
            matches: matches,
            perfectMatches: perfectMatches,
            goodMatches: goodMatches,
            totalMatches: totalMatches,
            matchRate: matchRate,
            trackerPointsCount: trackerPoints.length,
            templatePointsCount: templatePoints.length,
            transformationUsed: transformation
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Рассчитать качество совпадения
    calculateMatchQuality(distance, templateConfidence) {
        const distanceScore = Math.max(0, 1 - distance / 50);
        const confidenceScore = templateConfidence || 0.5;
        return (distanceScore * 0.7 + confidenceScore * 0.3);
    }

    // 🔥 НОВЫЙ МЕТОД: Применить результаты сравнения к трекеру
    applyComparisonToTracker(tracker, matches) {
        let updatedCount = 0;

        // 🔥 ГРУППИРУЕМ СОВПАДЕНИЯ ПО ТОЧКАМ ТРЕКЕРА
        const matchesByTrackerPoint = new Map();

        matches.forEach(match => {
            const pointId = match.trackerPoint.id;
            if (!matchesByTrackerPoint.has(pointId)) {
                matchesByTrackerPoint.set(pointId, []);
            }
            matchesByTrackerPoint.get(pointId).push(match);
        });

        // 🔥 ОБНОВЛЯЕМ КАЖДУЮ ТОЧКУ ТРЕКЕРА
        for (const [pointId, pointMatches] of matchesByTrackerPoint) {
            const pointData = tracker.points.get(pointId);
            if (!pointData) continue;

            // 🔥 НАХОДИМ ЛУЧШЕЕ СОВПАДЕНИЕ ДЛЯ ЭТОЙ ТОЧКИ
            const bestMatch = pointMatches.reduce((best, current) => {
                if (!best || current.quality > best.quality) {
                    return current;
                }
                return best;
            }, null);

            if (!bestMatch || bestMatch.matchType === 'poor') {
                continue;
            }

            // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ
            const oldConfirmations = pointData.confirmedCount || 1;
            const templateConfirmations = bestMatch.templatePoint.confirmations || 1;

            // 🔥 ВАЖНОЕ ПРАВИЛО: точка получает МАКСИМУМ из своего и шаблона
            const newConfirmations = Math.max(oldConfirmations, templateConfirmations);

            if (newConfirmations > oldConfirmations) {
                pointData.confirmedCount = newConfirmations;
                updatedCount++;
            }
        }

        return updatedCount;
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

    // 🔥 НОВЫЙ МЕТОД: Дебаг сравнения координат
    debugCoordinateComparison(trackerPoints, templatePoints, transformation) {
        if (trackerPoints.length === 0 || templatePoints.length === 0) {
            return;
        }

        console.log(`\n🔍 ДЕБАГ КООРДИНАТ:`);
        console.log(`Система отпечатка:`);
        console.log(`  Поворот: ${transformation.rotationAngle?.toFixed(1)}°`);
        console.log(`  Центр: (${transformation.center?.x?.toFixed(1)}, ${transformation.center?.y?.toFixed(1)})`);

        // Показываем примеры точек
        console.log(`\nПримеры точек трекера (первые 3):`);
        trackerPoints.slice(0, 3).forEach((point, i) => {
            console.log(`  ${i + 1}. ${point.id?.slice(0, 8)}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        });

        console.log(`\nПримеры точек шаблона (первые 3):`);
        templatePoints.slice(0, 3).forEach((point, i) => {
            console.log(`  ${i + 1}. ${point.cellId?.slice(0, 8) || 'cell'}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
            console.log(`     подтверждений: ${point.confirmations}, статус: ${point.status}`);
        });

        // 🔥 ВЫЧИСЛЯЕМ РАСПРЕДЕЛЕНИЕ КООРДИНАТ
        const trackerBounds = this.calculateBounds(trackerPoints);
        const templateBounds = this.calculateBounds(templatePoints);

        console.log(`\n📏 ГРАНИЦЫ ТОЧЕК:`);
        console.log(`  Трекер: ${trackerBounds.width.toFixed(1)}x${trackerBounds.height.toFixed(1)}`);
        console.log(`  Шаблон: ${templateBounds.width.toFixed(1)}x${templateBounds.height.toFixed(1)}`);
        console.log(`  Отношение: ${(trackerBounds.width / templateBounds.width).toFixed(2)}x`);

        // 🔥 ПРОВЕРЯЕМ МАСШТАБ
        const scaleDiff = Math.abs(trackerBounds.width - templateBounds.width) / Math.max(trackerBounds.width, templateBounds.width);
        if (scaleDiff > 0.3) {
            console.log(`⚠️ ЗНАЧИТЕЛЬНАЯ РАЗНИЦА В МАСШТАБЕ: ${scaleDiff.toFixed(2)}`);
            console.log(`   Может потребоваться масштабирование!`);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Обновить подтверждения в отпечатке
    updateFootprintConfirmations(footprint, matches) {
        if (!footprint || !footprint.graph || matches.length === 0) {
            return;
        }

        // Обновляем узлы графа на основе совпадений
        let updatedNodes = 0;

        matches.forEach(match => {
            if (!match.trackerPoint || !match.trackerPoint.id) return;

            const nodeId = `n_${match.trackerPoint.id}`;
            const node = footprint.graph.nodes.get(nodeId);

            if (node) {
                const oldConfirmations = node.confirmedCount || 1;
                const templateConfirmations = match.templatePoint.confirmations || 1;
                const newConfirmations = Math.max(oldConfirmations, templateConfirmations);

                if (newConfirmations > oldConfirmations) {
                    node.confirmedCount = newConfirmations;
                    updatedNodes++;
                }
            }
        });

        if (updatedNodes > 0) {
            console.log(`📈 Обновлено ${updatedNodes} узлов в графе отпечатка`);
        }
    }

    // 🔥 ФОЛЛБЭК: Прямое сравнение (старый метод, если нет трансформаций)
    fallbackDirectComparison(tracker, templateBuilder) {
        console.log(`🔄 Использую прямое сравнение (фоллбэк)...`);

        const templateData = templateBuilder.getVisualizationData();
        if (!templateData || !templateData.cells) {
            return 0;
        }

        // Прямое сравнение без трансформаций (старая логика)
        const templatePoints = templateData.cells.map(cell => ({
            x: cell.x || 0,
            y: cell.y || 0,
            confirmations: cell.confirmations || 1
        }));

        let updatedCount = 0;
        const threshold = 25;

        for (const [trackerId, trackerPoint] of tracker.points) {
            let bestDistance = Infinity;
            let bestConfirmations = 1;

            for (const templatePoint of templatePoints) {
                const distance = Math.sqrt(
                    Math.pow(templatePoint.x - trackerPoint.x, 2) +
                    Math.pow(templatePoint.y - trackerPoint.y, 2)
                );

                if (distance < bestDistance && distance < threshold) {
                    bestDistance = distance;
                    bestConfirmations = templatePoint.confirmations;
                }
            }

            if (bestDistance < threshold) {
                const oldCount = trackerPoint.confirmedCount || 1;
                const newCount = Math.max(oldCount, bestConfirmations);

                if (newCount > oldCount) {
                    trackerPoint.confirmedCount = newCount;
                    updatedCount++;
                }
            }
        }

        console.log(`✅ Прямое сравнение: обновлено ${updatedCount} точек`);
        return updatedCount;
    }

    // 🔥 ТЕСТ МЕТОД: Протестировать сравнение координат
    testCoordinateComparison(userId) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            console.log('❌ Нет активной сессии');
            return;
        }

        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            console.log('❌ Нет супер-модели');
            return;
        }

        console.log('\n🧪 ТЕСТ СРАВНЕНИЯ КООРДИНАТ:');

        // 1. Получаем отпечаток
        const footprint = session.currentFootprint;
        const tracker = footprint.pointTracker;

        console.log(`Отпечаток: ${footprint.name}`);
        console.log(`Точек в трекере: ${tracker.points.size}`);

        // 2. Получаем трансформацию
        const transformation = footprint.getTransformation();
        console.log(`Трансформация отпечатка:`);
        console.log(`  Поворот: ${transformation.rotationAngle?.toFixed(1)}°`);
        console.log(`  Зеркало: ${transformation.isMirrored}`);
        console.log(`  Центр: (${transformation.center?.x?.toFixed(1)}, ${transformation.center?.y?.toFixed(1)})`);

        // 3. Получаем точки шаблона
        const templateData = vectorModel.templateBuilder.getVisualizationData();
        console.log(`Точек в шаблоне: ${templateData.cells?.length || 0}`);

        // 4. Тестируем преобразование
        console.log('\n🔧 ТЕСТ ПРЕОБРАЗОВАНИЯ:');

        if (templateData.cells && templateData.cells.length > 0) {
            const testCell = templateData.cells[0];
            console.log(`Тестовая ячейка шаблона:`);
            console.log(`  Нормализованные: (${testCell.nx?.toFixed(4)}, ${testCell.ny?.toFixed(4)})`);
            console.log(`  Реальные: (${testCell.x?.toFixed(1)}, ${testCell.y?.toFixed(1)})`);

            // Преобразуем в систему отпечатка
            const templateTransformation = vectorModel.templateBuilder.getNormalizationTransform();
            const transformedPoints = this.transformTemplatePointsToFootprintSystem(
                [testCell],
                templateTransformation,
                transformation
            );

            if (transformedPoints && transformedPoints[0]) {
                const transformed = transformedPoints[0];
                console.log(`  В системе отпечатка: (${transformed.x?.toFixed(1)}, ${transformed.y?.toFixed(1)})`);
            }
        }

        // 5. Тестируем сравнение
        console.log('\n🔍 ТЕСТ СРАВНЕНИЯ:');
        const updatedCount = this.updateConfirmationsFromTemplate(footprint, vectorModel, transformation);

        console.log(`\n✅ ТЕСТ ЗАВЕРШЕН: обновлено ${updatedCount} точек`);

        // 6. Статистика трекера после обновления
        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;
        for (const [, point] of tracker.points) {
            const confirmations = point.confirmedCount || 1;
            if (confirmations >= 2) confirmed2++;
            else if (confirmations >= 1) confirmed1++;
            else confirmed0++;
        }

        console.log(`\n📊 РЕЗУЛЬТАТ В ТРЕКЕРЕ:`);
        console.log(`  🔴 2+ подтверждений: ${confirmed2}`);
        console.log(`  🔵 1 подтверждение: ${confirmed1}`);
        console.log(`  ⚪ 0 подтверждений: ${confirmed0}`);
        console.log(`  Всего: ${tracker.points.size}`);
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию с ВИЗУАЛИЗАЦИЯМИ
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО с сохранением трансформации и накоплением`);

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

            // 🔥 СОХРАНЯЕМ ТРАНСФОРМАЦИЮ
            const transformationInfo = {
                ...normalized.transformation,
                rotationAngle: normalized.rotationAngle,
                isMirrored: normalized.isMirrored,
                corrected: false,
                timestamp: new Date(),
                footType: normalized.footType,
                photoId: photoInfo.photoId || `photo_${Date.now()}`
            };

            const corrected = this.mirrorDetector.autoCorrectMirroring(
                normalized.graph,
                'right'
            );

            if (corrected.correctionApplied) {
                console.log(`🔄 Автокоррекция применена: ${corrected.correctionType}`);
                transformationInfo.corrected = true;
                transformationInfo.correctionType = corrected.correctionType;
            }

            const finalGraph = corrected.graph;

            // 🔥 ПЕРЕДАЕМ ТРАНСФОРМАЦИЮ В ГРАФ
            finalGraph.transformation = transformationInfo;

            // Получаем или создаем сессию
            let session = this.userSessions.get(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессия`);
            }

            // Сохраняем трансформацию
            if (!session.metadata.normalizationHistory) {
                session.metadata.normalizationHistory = [];
            }
            session.metadata.normalizationHistory.push(transformationInfo);
            session.metadata.lastTransformation = transformationInfo;

            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                transformationInfo: transformationInfo
            });
            session.lastActivity = new Date();

            const SimpleFootprint = require('./simple-footprint');

            // 🔥 ПЕРВОЕ ФОТО: создаем отпечаток и шаблон
            if (!session.currentFootprint) {
    console.log(`👣 Первое фото: создаю отпечаток и шаблон`);

    // При создании отпечатка передаем трансформацию
    session.currentFootprint = new SimpleFootprint({
        userId: userId,
        name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
        // 🔥 ВАЖНО: передаем трансформацию при создании!
        transformation: transformationInfo // УЖЕ СОДЕРЖИТ rotationAngle: 90°
    });

    session.currentFootprint.metadata.normalizationInfo = transformationInfo;
   
    // Добавляем анализ
    const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
        ...photoInfo,
        normalizedGraph: finalGraph,
        photoId: photoInfo.photoId || `photo_${Date.now()}`,
        source: photoInfo.source || 'telegram_bot',
        transformationInfo: transformationInfo
    });

                // 🔥 СОЗДАЕМ СУПЕР-МОДЕЛЬ (ШАБЛОН)
                const VectorSuperModel = require('./vector-super-model');
                const vectorModel = new VectorSuperModel({
                    name: `Шаблон_${String(userId).slice(0, 6)}`,
                    enablePCA: false,
                    cellSize: 25,
                    debug: this.config.debug
                });

                // Добавляем первый граф как эталон
                vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
                    isFirst: true,
                    transformationInfo: transformationInfo
                });

                this.vectorSuperModels.set(userId, vectorModel);

                console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);
                console.log(`✅ Создан шаблон с ${vectorModel.templateBuilder.getVisualizationData()?.cells?.length || 0} ячейками`);

                // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ ДЛЯ ПЕРВОГО ФОТО
                let firstPhotoViz = null;
                if (bot && chatId && this.config.enableMergeVisualization) {
                    console.log(`🎨 Создаю визуализацию для первого фото...`);
                    firstPhotoViz = await this.visualizeSingleFootprintConfirmations(
                        session.currentFootprint,
                        userId,
                        transformationInfo
                    );

                    if (firstPhotoViz && firstPhotoViz.path) {
                        try {
                            let caption = `👣 **ПЕРВЫЙ СЛЕД СОЗДАН**\n\n`;
                            caption += `📊 Извлечено: ${addResult.added} точек\n`;
                            caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                            caption += `🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n`;
                            caption += `✅ Создан шаблон для накопления деталей`;

                            await bot.sendPhoto(chatId, firstPhotoViz.path, {
                                caption: caption,
                                parse_mode: 'Markdown'
                            });
                            console.log('✅ Визуализация первого следа отправлена');
                        } catch (sendError) {
                            console.log('❌ Ошибка отправки первого фото:', sendError.message);
                        }
                    }
                }

                return {
                    success: true,
                    isNewSession: true,
                    similarity: 0,
                    decision: 'new',
                    nodesAdded: addResult.added,
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    sessionId: session.id,
                    hasTemplate: true,
                    hasVisualization: !!firstPhotoViz
                };
            }

            // 🔥 ВТОРОЕ И ПОСЛЕДУЮЩИЕ ФОТО
            console.log(`🔍 Проверяю совпадение с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Получаем трансформацию существующего отпечатка
            const existingTransformationInfo = session.currentFootprint.metadata.normalizationInfo ||
                                             session.currentFootprint.getTransformation();

            // Создаем временный отпечаток для сравнения
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`
            });

            tempFootprint.metadata.normalizationInfo = transformationInfo;

            const tempResult = tempFootprint.addAnalysisHonest(analysis, {
                ...photoInfo,
                normalizedGraph: finalGraph,
                photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
                source: photoInfo.source || 'telegram_bot_temp',
                transformationInfo: transformationInfo
            });

            // 🔥 ИСПОЛЬЗУЕМ ПАТТЕРНОВОЕ СРАВНЕНИЕ
            console.log(`🎯 Сравнение с паттернами следов...`);
            const comparisonResult = await this.compareWithPatterns(
                session.currentFootprint,
                tempFootprint
            );

            const similarity = comparisonResult?.similarity || 0;
            const decision = similarity > 0.6 ? 'same' : 'different';

            console.log(`🎯 Сходство (с паттернами): ${similarity.toFixed(3)}, решение: ${decision}`);

            // 🔥 СЛЕДЫ СОВПАЛИ - обновляем шаблон с накоплением
            if (decision === 'same') {
                console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);

                // Получаем или создаем шаблон
                let vectorModel = this.vectorSuperModels.get(userId);

                if (!vectorModel) {
                    const VectorSuperModel = require('./vector-super-model');
                    vectorModel = new VectorSuperModel({
                        name: `Шаблон_${String(userId).slice(0, 6)}`,
                        enablePCA: false,
                        cellSize: 25,
                        debug: this.config.debug
                    });
                    this.vectorSuperModels.set(userId, vectorModel);

                    // Добавляем существующий граф
                    vectorModel.addGraph(
                        session.currentFootprint.graph,
                        session.currentFootprint.id,
                        {
                            isFirst: true,
                            transformationInfo: existingTransformationInfo
                        }
                    );
                }

                // 🔥 ДОБАВЛЯЕМ НОВЫЙ ГРАФ В ШАБЛОН С НАКОПЛЕНИЕМ
                console.log(`🔄 Добавляю новый граф в шаблон с накоплением деталей...`);
                const addedWithAccumulation = vectorModel.addGraph(
                    finalGraph,
                    tempFootprint.id,
                    {
                        similarity: similarity,
                        timestamp: new Date(),
                        ...photoInfo,
                        transformationInfo: transformationInfo
                    }
                );

                if (!addedWithAccumulation) {
                    console.log(`❌ Не удалось добавить граф в шаблон`);
                }

                // 🔥 ПРЯМОЕ ОБНОВЛЕНИЕ ПОДТВЕРЖДЕНИЙ МЕЖДУ СЛЕДАМИ
                console.log(`🔄 Прямое обновление подтверждений между следами...`);
                const directUpdates = this.updateConfirmationsDirectly(session.currentFootprint, tempFootprint);
                console.log(`✅ Прямо обновлено: ${directUpdates} точек`);

                // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ ИЗ ШАБЛОНА
                console.log(`🔄 Обновляю подтверждения из шаблона...`);
                const updatedFromTemplate = this.updateConfirmationsFromTemplate(
                    session.currentFootprint,
                    vectorModel,
                    existingTransformationInfo
                );

                // 🔥 ВИЗУАЛИЗАЦИЯ ПОДТВЕРЖДЕНИЙ
                let clusterVizResult = null;
                if (this.config.enableMergeVisualization) {
                    console.log(`🎨 Создаю визуализацию подтверждений...`);

                    clusterVizResult = await this.visualizeSingleFootprintConfirmations(
                        session.currentFootprint,
                        userId,
                        {
                            currentTransformation: transformationInfo,
                            previousTransformation: existingTransformationInfo,
                            comparisonResult: comparisonResult
                        }
                    );

                    // 🔥 ВАЖНО: Проверяем результат визуализации
                    if (clusterVizResult && clusterVizResult.path) {
                        console.log(`✅ Визуализация создана: ${clusterVizResult.path}`);
                    } else {
                        console.log(`⚠️ Визуализация не создана или путь отсутствует`);
                    }
                }

                // 🔥 ВИЗУАЛИЗАЦИЯ ВЫРАВНИВАНИЯ (если есть результат от алайнера)
                let alignmentVizPath = null;
                if (comparisonResult.alignment && comparisonResult.alignment.visualization) {
                    alignmentVizPath = comparisonResult.alignment.visualization;
                    console.log(`🎨 Визуализация выравнивания: ${alignmentVizPath}`);
                }

                // 🔥 ВИЗУАЛИЗАЦИЯ ШАБЛОНА
                let templateVizResult = null;
                if (this.config.enableTemplateVisualization && vectorModel) {
                    templateVizResult = await this.visualizeVectorSuperModel(userId, vectorModel);
                }

                // 🔥 РЕАЛЬНАЯ СТАТИСТИКА
                const stats = this.calculateConfirmationStats(session.currentFootprint);
                console.log(`📊 РЕАЛЬНАЯ СТАТИСТИКА ПОСЛЕ ${session.photos.length} ФОТО:`);
                console.log(`   • Всего точек: ${stats.totalPoints}`);
                console.log(`   • 🔴 Красные (2+): ${stats.confirmed2}`);
                console.log(`   • 🔵 Синие (1): ${stats.confirmed1}`);
                console.log(`   • ⚪️ Серые (0): ${stats.confirmed0}`);

                // 🔥 ОТПРАВКА В TELEGRAM
                let telegramSent = false;
                if (bot && chatId) {
                    // Отправляем визуализацию подтверждений
                    if (clusterVizResult && clusterVizResult.path && fs.existsSync(clusterVizResult.path)) {
                        try {
                            // Простой текст без Markdown для избежания ошибок
                            let caption = `🎯 РЕАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ\n\n`;
                            caption += `📊 Сходство: ${(similarity * 100).toFixed(1)}%\n`;
                            caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                            caption += `🔄 Метод сравнения: ${comparisonResult.method || 'pattern_based'}\n`;

                            if (comparisonResult.alignment && comparisonResult.alignment.quality) {
                                caption += `🎯 Качество выравнивания: ${(comparisonResult.alignment.quality * 100).toFixed(1)}%\n`;
                            }

                            caption += `\n📈 СТАТИСТИКА (после ${session.photos.length} фото):\n`;
                            caption += `• Всего точек: ${stats.totalPoints}\n`;
                            caption += `• 🔴 2+ подтверждений: ${stats.confirmed2}\n`;
                            caption += `• 🔵 1 подтверждение: ${stats.confirmed1}\n`;
                            caption += `• ⚪️ 0 подтверждений: ${stats.confirmed0}\n\n`;
                            caption += `🔄 Обновлено из шаблона: ${updatedFromTemplate} точек\n`;
                            caption += `🎯 Прямо обновлено: ${directUpdates} точек`;

                            console.log(`📤 Отправляю визуализацию в Telegram...`);
                            console.log(`📷 Путь к изображению: ${clusterVizResult.path}`);
                            console.log(`📝 Размер файла: ${fs.statSync(clusterVizResult.path).size} байт`);

                            await bot.sendPhoto(chatId, clusterVizResult.path, {
                                caption: caption,
                                parse_mode: null  // Простой текст без Markdown
                            });
                            console.log('✅ Визуализация подтверждений отправлена');
                            telegramSent = true;

                            // 🔥 Дополнительно отправляем визуализацию выравнивания если есть
                            if (alignmentVizPath && fs.existsSync(alignmentVizPath)) {
                                console.log(`📤 Отправляю визуализацию выравнивания в Telegram...`);
                                await bot.sendPhoto(chatId, alignmentVizPath, {
                                    caption: `🔄 Визуализация выравнивания\n${comparisonResult.reason || ''}`,
                                    parse_mode: null
                                });
                                console.log('✅ Визуализация выравнивания отправлена');
                            }

                            // 🔥 Отправляем визуализацию шаблона если есть
                            if (templateVizResult && templateVizResult.template && fs.existsSync(templateVizResult.template)) {
                                console.log(`📤 Отправляю визуализацию шаблона в Telegram...`);
                                await bot.sendPhoto(chatId, templateVizResult.template, {
                                    caption: `📊 Шаблон после ${session.photos.length} фото\n• Ячеек: ${templateVizResult.stats?.cells || 0}\n• Подтверждений: ${templateVizResult.stats?.totalConfirmations || 0}`,
                                    parse_mode: null
                                });
                                console.log('✅ Визуализация шаблона отправлена');
                            }

                        } catch (sendError) {
                            console.log('❌ Ошибка отправки в Telegram:', sendError.message);
                            console.log('📋 Детали ошибки:', sendError.stack);
                        }
                    } else {
                        console.log('⚠️ Нет визуализации для отправки в Telegram');
                        if (clusterVizResult) {
                            console.log('🔍 clusterVizResult:', clusterVizResult);
                            if (clusterVizResult.path) {
                                console.log('🔍 Файл существует?', fs.existsSync(clusterVizResult.path));
                            }
                        }
                    }
                }

                return {
                    success: true,
                    similarity: similarity,
                    decision: decision,
                    nodesAdded: tempResult.added,
                    message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
                    hasVisualization: !!(clusterVizResult || templateVizResult || alignmentVizPath),
                    telegramSent: telegramSent,
                    pointsUpdated: updatedFromTemplate + directUpdates,
                    realStats: stats,
                    totalPhotos: session.photos.length,
                    accumulationInfo: addedWithAccumulation,
                    alignmentResult: comparisonResult.alignment
                };

            } else {
                // 🔥 СЛЕДЫ РАЗНЫЕ
                console.log(`🆕 Следы разные (${similarity.toFixed(3)}) - новая модель`);

                if (session.currentFootprint.graph.nodes.size >= 10) {
                    this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
                }

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
                });

                session.currentFootprint.metadata.normalizationInfo = transformationInfo;

                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: transformationInfo
                });

                // 🔥 Создаем новый шаблон
                const VectorSuperModel = require('./vector-super-model');
                const vectorModel = new VectorSuperModel({
                    name: `Шаблон_${String(userId).slice(0, 6)}_new`,
                    enablePCA: false,
                    cellSize: 25,
                    debug: this.config.debug
                });

                vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
                    isFirst: true,
                    transformationInfo: transformationInfo
                });

                this.vectorSuperModels.set(userId, vectorModel);

                // 🔥 Визуализация для нового следа
                let newFootprintViz = null;
                if (bot && chatId && this.config.enableMergeVisualization) {
                    console.log(`🎨 Создаю визуализацию для нового следа...`);
                    newFootprintViz = await this.visualizeSingleFootprintConfirmations(
                        session.currentFootprint,
                        userId,
                        transformationInfo
                    );

                    if (newFootprintViz && newFootprintViz.path && fs.existsSync(newFootprintViz.path)) {
                        try {
                            let caption = `🆕 СОЗДАН НОВЫЙ СЛЕД\n\n`;
                            caption += `📊 Сходство с предыдущим: ${(similarity * 100).toFixed(1)}%\n`;
                            caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                            caption += `📈 Добавлено точек: ${addResult.added}\n\n`;
                            caption += `⚠️ След признан другим (низкое сходство)`;

                            await bot.sendPhoto(chatId, newFootprintViz.path, {
                                caption: caption,
                                parse_mode: null
                            });
                            console.log('✅ Визуализация нового следа отправлена');
                        } catch (sendError) {
                            console.log('❌ Ошибка отправки нового следа:', sendError.message);
                        }
                    }
                }

                return {
                    success: true,
                    similarity: similarity,
                    decision: decision,
                    isNewModel: true,
                    nodesAdded: addResult.added,
                    hasTemplate: true,
                    hasVisualization: !!newFootprintViz
                };
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Прямое обновление подтверждений между следами
    updateConfirmationsDirectly(footprint1, footprint2) {
    console.log(`🔄 Прямое обновление подтверждений между двумя следами...`);

    // 🔥 ИСПРАВЛЕНИЕ: Используем нормализованные точки
    const points1 = footprint1.getPointsInNormalizedSystem();
    const points2 = footprint2.getPointsInNormalizedSystem();

    console.log(`🔍 Сравниваю ${points1.length} и ${points2.length} точек в НОРМАЛИЗОВАННОЙ системе`);

    let updatedCount = 0;
    const threshold = 25; // 25px в нормализованной системе

    // 🔥 ИСПРАВЛЕНИЕ: Находим все совпадения
    const matches = [];

    for (const point1 of points1) {
        let bestMatch = null;
        let minDistance = Infinity;

        for (const point2 of points2) {
            const distance = Math.sqrt(
                Math.pow(point2.x - point1.x, 2) +
                Math.pow(point2.y - point1.y, 2)
            );

            if (distance < minDistance && distance < threshold) {
                minDistance = distance;
                bestMatch = {
                    point1,
                    point2,
                    distance
                };
            }
        }

        if (bestMatch) {
            matches.push(bestMatch);
        }
    }

    console.log(`📊 Найдено ${matches.length} совпадений (<${threshold}px)`);

    // 🔥 ВАЖНО: Обновляем подтверждения в ОРИГИНАЛЬНОМ PointTracker
    // Используем ID точек для нахождения их в оригинальном трекере
    if (footprint1.pointTracker) {
        for (const match of matches) {
            const pointId = match.point1.id;
            const pointData = footprint1.pointTracker.points.get(pointId);

            if (pointData) {
                const oldCount = pointData.confirmedCount || 1;
                const newCount = Math.max(oldCount, 2); // 2 фото = 2 подтверждения

                if (newCount > oldCount) {
                    pointData.confirmedCount = newCount;
                    updatedCount++;
                }
            }
        }
    }

    console.log(`✅ Обновлено ${updatedCount} точек в оригинальном трекере`);

    // 🔥 ДИАГНОСТИКА
    const totalPoints = Math.max(points1.length, points2.length);
    const matchRate = matches.length / totalPoints;

    console.log(`📈 ЭФФЕКТИВНОСТЬ СРАВНЕНИЯ:`);
    console.log(`   Всего точек: ${totalPoints}`);
    console.log(`   Совпадений: ${matches.length}`);
    console.log(`   Процент совпадений: ${(matchRate * 100).toFixed(1)}%`);
    console.log(`   Обновлено в трекере: ${updatedCount}`);

    return updatedCount;
}

    // 🔥 МЕТОД ДЛЯ ПРЕОБРАЗОВАНИЯ ТОЧЕК ШАБЛОНА
    transformTemplatePointsToFootprintSystem(templateCells, templateTransformation, footprintTransformation) {
        const points = [];

        templateCells.forEach((cell, index) => {
            const normalizedX = cell.nx || 0;
            const normalizedY = cell.ny || 0;

            const templateX = normalizedX * templateTransformation.width + templateTransformation.minX;
            const templateY = normalizedY * templateTransformation.height + templateTransformation.minY;

            let transformedX = templateX;
            let transformedY = templateY;

            const footprintAngle = footprintTransformation.rotationAngle || 0;

            if (footprintAngle !== 0 && footprintTransformation.center) {
                const centerX = footprintTransformation.center.x || 0;
                const centerY = footprintTransformation.center.y || 0;

                const dx = templateX - centerX;
                const dy = templateY - centerY;

                const angleRad = -footprintAngle * Math.PI / 180;
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                const rotatedX = dx * cosA - dy * sinA;
                const rotatedY = dx * sinA + dy * cosA;

                transformedX = rotatedX + centerX;
                transformedY = rotatedY + centerY;
            }

            points.push({
                x: transformedX,
                y: transformedY,
                nx: normalizedX,
                ny: normalizedY,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id,
                isNew: cell.isNew || false,
                status: cell.status || 'unknown',
                originalCell: cell,
                cellIndex: index
            });
        });

        return points;
    }

    // 🔥 ВАЖНЫЙ МЕТОД: Визуализация подтверждений ОДНОГО следа
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        console.log(`🎨 Визуализация подтверждений для "${footprint.name}"...`);

        try {
            const ClusterVisualizer = require('./visualizations/cluster-visualizer');
            const visualizer = new ClusterVisualizer({
                outputDir: path.join(this.config.dbPath, 'visualizations/clusters'),
                debug: this.config.debug
            });

            const vizResult = await visualizer.visualizeSingleFootprintConfirmations(
                footprint,
                {
                    filename: `real_confirmations_${userId}_${Date.now()}.png`,
                    transformationInfo: transformationInfo
                }
            );

            if (vizResult && vizResult.path) {
                console.log(`✅ Визуализация создана: ${vizResult.path}`);

                // Проверяем существование файла
                if (fs.existsSync(vizResult.path)) {
                    const stats = fs.statSync(vizResult.path);
                    console.log(`📊 Размер файла: ${stats.size} байт`);
                } else {
                    console.log(`⚠️ Файл не найден: ${vizResult.path}`);
                }
            } else {
                console.log(`⚠️ Визуализация не создана или результат пустой`);
            }

            return vizResult;

        } catch (error) {
            console.log('❌ Ошибка визуализации:', error.message);
            console.error(error.stack);
            return null;
        }
    }

    // 🔥 ВОССТАНОВЛЕННЫЕ МЕТОДЫ ДЛЯ КОМАНД
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    getVectorSuperModelInfo(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);

        if (!vectorModel) {
            return {
                exists: false,
                message: 'Шаблон не найден'
            };
        }

        const templateData = vectorModel.templateBuilder.getVisualizationData();
        const stats = templateData?.stats || {};

        return {
            exists: true,
            userId: userId,
            templateName: vectorModel.name,
            cellsCount: templateData?.cells?.length || 0,
            totalConfirmations: stats.totalConfirmations || 0,
            averageConfirmations: stats.averageConfirmations?.toFixed(2) || '0.00',
            confirmedCells: stats.confirmedCells || 0,
            lastUpdated: vectorModel.lastUpdated || new Date()
        };
    }

    clearVectorSuperModel(userId) {
        if (this.vectorSuperModels.has(userId)) {
            this.vectorSuperModels.delete(userId);

            // Также очищаем сессию
            if (this.userSessions.has(userId)) {
                this.userSessions.delete(userId);
            }

            console.log(`🧹 Очищен шаблон и сессия для пользователя ${userId}`);

            return {
                success: true,
                message: 'Шаблон и сессия очищены'
            };
        }

        return {
            success: false,
            message: 'Шаблон не найден'
        };
    }

    getTemplateVisualization(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);

        if (!vectorModel) {
            return null;
        }

        return this.visualizeVectorSuperModel(userId, vectorModel);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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

    calculateConfirmationStats(footprint) {
        if (!footprint || !footprint.pointTracker) {
            return { confirmed2: 0, confirmed1: 0, confirmed0: 0, totalPoints: 0 };
        }

        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

        for (const [id, point] of footprint.pointTracker.points) {
            const confirmations = point.confirmedCount || 1; // 🔥 Минимум 1 подтверждение!

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

    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) return null;

            let templateData = vectorModel.templateBuilder.getVisualizationData();

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

    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId,
            userId: String(userId),
            name: name || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            currentFootprint: null,
            metadata: {
                created: new Date(),
                normalizationHistory: [],
                lastTransformation: null
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)} для пользователя ${userId}`);

        return session;
    }

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/templates'),
            path.join(this.config.dbPath, 'visualizations/alignments'),
            path.join(this.config.dbPath, 'visualizations/clusters')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Создана директория: ${dir}`);
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
                    edges: footprint.graph.edges.size
                }
            };

        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }

    getSystemStats() {
        const templateStats = [];

        for (const [userId, vectorModel] of this.vectorSuperModels) {
            const templateData = vectorModel.templateBuilder?.getVisualizationData();
            const stats = templateData?.stats || {};

            templateStats.push({
                userId,
                cells: templateData?.cells?.length || 0,
                totalConfirmations: stats.totalConfirmations || 0,
                averageConfirmations: stats.averageConfirmations?.toFixed(2) || '0.00'
            });
        }

        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            vectorModels: this.vectorSuperModels.size,
            templateStats: templateStats
        };
    }

    // 🔥 Дополнительные методы для совместимости
    getMergeVisualizationCount() {
        let total = 0;
        // Простая реализация
        return total;
    }

    addMergeVisualization(userId, vizInfo) {
        // Простая реализация
        return 1;
    }

    // 🔥 Вспомогательные методы для совместимости
    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_normalized', referenceTransformation = null) {
        if (!transformationInfo) {
            console.log('⚠️ Нет информации о трансформации');
            return originalPoints;
        }

        console.log(`📐 Преобразование координат ${originalPoints.length} точек (${direction})...`);

        const RotationInvariance = require('./rotation-invariance');
        const processor = new RotationInvariance();

        if (direction === 'to_normalized') {
            // Из системы фото в нормализованную систему
            const targetTransformation = processor.createIdentityTransformation();
            return processor.transformPointsBetweenSystems(
                originalPoints,
                transformationInfo,
                targetTransformation
            );
        } else if (direction === 'to_original') {
            // Из нормализованной системы в систему фото
            if (!referenceTransformation) {
                console.log('⚠️ Нет эталонной трансформации для обратного преобразования');
                return originalPoints;
            }

            return processor.transformPointsBetweenSystems(
                originalPoints,
                processor.createIdentityTransformation(),
                referenceTransformation
            );
        } else if (direction === 'between_footprints' && referenceTransformation) {
            // Из системы одного отпечатка в систему другого
            return processor.transformPointsBetweenSystems(
                originalPoints,
                transformationInfo,
                referenceTransformation
            );
        }

        return originalPoints;
    }

    prepareTemplatePointsForComparison(templateCells, templateBuilder, targetTransformation) {
        const points = [];

        // Получаем трансформацию шаблона (из templateBuilder)
        const templateTransformation = templateBuilder.getNormalizationTransform();

        const RotationInvariance = require('./rotation-invariance');
        const processor = new RotationInvariance();

        templateCells.forEach((cell, index) => {
            // Создаем точку из ячейки шаблона
            const templatePoint = {
                x: cell.x || 0,
                y: cell.y || 0,
                nx: cell.nx || 0,
                ny: cell.ny || 0,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id
            };

            // 🔥 ПРЕОБРАЗУЕМ В СИСТЕМУ ЦЕЛЕВОГО ОТПЕЧАТКА
            const transformedPoint = processor.transformPointsBetweenSystems(
                [templatePoint],
                templateTransformation,
                targetTransformation
            )[0];

            if (transformedPoint) {
                points.push({
                    ...transformedPoint,
                    originalTemplatePoint: templatePoint,
                    cellIndex: index
                });
            }
        });

        return points;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ГЕОМЕТРИИ
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    calculateCenter(points) {
        if (points.length === 0) {
            return { x: 0, y: 0 };
        }

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }
   // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Извлечь точки из отпечатка
extractPointsFromFootprint(footprint) {
    const points = [];
   
    if (footprint.pointTracker && footprint.pointTracker.points) {
        for (const [id, point] of footprint.pointTracker.points) {
            points.push({
                id,
                x: point.x,
                y: point.y,
                confidence: point.rating || 0.5
            });
        }
    }
   
    console.log(`   📊 Извлечено ${points.length} точек из ${footprint.name}`);
    return points;
}
   
    // 🔥 НОВЫЙ МЕТОД: Рассчитать соотношение сторон
    calculateAspectRatio(points) {
        const bounds = this.calculateBounds(points);
        return bounds.width / Math.max(1, bounds.height);
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Рассчитать границы
calculateBounds(points) {
    if (points.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }
   
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
   
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
   
    return {
        minX, maxX, minY, maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}
   
    // 🔥 НОВЫЙ МЕТОД: Расчет центра
    calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }
       
        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }
} // <- ЭТО ЗАКРЫВАЮЩАЯ ФИГУРНАЯ СКОБКА КЛАССА SimpleFootprintManager

module.exports = SimpleFootprintManager;
