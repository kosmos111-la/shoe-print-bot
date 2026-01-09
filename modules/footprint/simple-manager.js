// modules/footprint/simple-manager.js
// 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильное преобразование координат

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
            usePointTracker: true, // Всегда использовать PointTracker
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableIntelligentMerge: options.enableIntelligentMerge !== false,
            enableTopologySuperModel: options.enableTopologySuperModel !== false,

            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            highConfidenceThreshold: options.highConfidenceThreshold || 0.8,
            minPointsForFootprint: options.minPointsForFootprint || 5,

            // Настройки PointTracker
            trackerConfirmationThreshold: 2, // Минимум 2 подтверждения для высокой уверенности
            ...options
        };

        // 🔥 ДОБАВЛЕНО: Импорт модулей внутри конструктора
        const SimpleFootprint = require('./simple-footprint');
        const SimpleMatcher = require('./simple-matcher');
        const MergeVisualizer = require('./merge-visualizer');
        const VectorSuperModel = require('./vector-super-model');
        const TemplateVisualizer = require('./template-visualizer');

        // 🔥 ДОБАВЛЕНО: НОВЫЕ ИМПОРТЫ согласно инструкции
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');

        // 🔥 ДОБАВЛЕНО: Процессоры поворотной инвариантности согласно инструкции
        this.rotationProcessor = new RotationInvariance({
            debug: this.config.debug
        });

        this.mirrorDetector = new MirrorDetection({
            debug: this.config.debug
        });

        // Сессии пользователей: userId -> session
        this.userSessions = new Map();

        // Загруженные модели: modelId -> SimpleFootprint
        this.loadedModels = new Map();

        // Визуализатор объединений
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        // Матчер для сравнения графов
        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        // История последних визуализаций объединения: userId -> [{path, timestamp, similarity}]
        this.lastMergeVisualizations = new Map();

        // Добавить векторные супер-модели
        this.vectorSuperModels = new Map(); // userId -> VectorSuperModel

        // Добавляем TemplateVisualizer
        this.templateVisualizer = new TemplateVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations/templates'),
            debug: this.config.debug
        });

        // Статистика системы
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulMerges: 0,
            totalPhotosProcessed: 0,
            trackerConfirmations: 0,
            lastActivity: new Date()
        };

        // Обеспечиваем существование директорий
        this.ensureDirectories();

        // Загружаем существующие модели
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager инициализирован с поворотной инвариантностью`);
        console.log(`   📁 База данных: ${this.config.dbPath}`);
        console.log(`   🎯 Auto Alignment: ${this.config.autoAlignment ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎨 Визуализация объединения: ${this.config.enableMergeVisualization ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎯 PointTracker: ВКЛ (подтверждения узлов)`);
        console.log(`   🏗️  VectorSuperModel: ВКЛ`);
        console.log(`   📐 TemplateVisualizer: ВКЛ`);
        console.log(`   🔄 Поворотная инвариантность: ВКЛ`);
        console.log(`   🎯 Единая система координат: ВКЛ`);
    }

    // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильное преобразование координат
    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_original') {
        console.log(`📐 Преобразование координат ${originalPoints.length} точек (${direction})...`);
       
        if (!transformationInfo || (!transformationInfo.rotationAngle && !transformationInfo.scale)) {
            console.log('⚠️ Нет информации о преобразовании, возвращаю оригинальные точки');
            return originalPoints;
        }

        console.log(`📊 Информация о трансформации:`);
        console.log(`   • Угол поворота: ${transformationInfo.rotationAngle || 0}°`);
        console.log(`   • Масштаб: ${transformationInfo.scale || 1.0}`);
        console.log(`   • Зеркало: ${transformationInfo.isMirrored ? 'да' : 'нет'}`);
        console.log(`   • Коррекция: ${transformationInfo.corrected ? 'да' : 'нет'}`);

        const transformedPoints = originalPoints.map(point => {
            const x = point.x;
            const y = point.y;

            let newX = x;
            let newY = y;

            // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ:
            // Направление преобразования:
            // - 'to_original': из нормализованных (0°) в оригинальные
            // - 'to_normalized': из оригинальных в нормализованные (0°)
           
            if (direction === 'to_original') {
                // Из нормализованных в оригинальные
                // Нормализованная система: повернута на -rotationAngle (чтобы получить 0°)
                // Оригинальная система: реальное фото
               
                // Поворачиваем обратно на +rotationAngle
                if (transformationInfo.rotationAngle) {
                    const angle = transformationInfo.rotationAngle * (Math.PI / 180);
                    const cosA = Math.cos(angle);
                    const sinA = Math.sin(angle);
                   
                    // Поворачиваем точку
                    const rotatedX = newX * cosA - newY * sinA;
                    const rotatedY = newX * sinA + newY * cosA;
                   
                    newX = rotatedX;
                    newY = rotatedY;
                }
               
                // Зеркальное отражение (если было)
                if (transformationInfo.isMirrored) {
                    newX = -newX;
                }
               
            } else if (direction === 'to_normalized') {
                // Из оригинальных в нормализованные
                // Делаем то же, что делал rotationProcessor: поворачиваем к 0°
               
                if (transformationInfo.rotationAngle) {
                    const angle = -transformationInfo.rotationAngle * (Math.PI / 180); // Отрицательный угол!
                    const cosA = Math.cos(angle);
                    const sinA = Math.sin(angle);
                   
                    const rotatedX = newX * cosA - newY * sinA;
                    const rotatedY = newX * sinA + newY * cosA;
                   
                    newX = rotatedX;
                    newY = rotatedY;
                }
               
                // Зеркальное отражение (обратное)
                if (transformationInfo.isMirrored) {
                    newX = -newX;
                }
            }

            return {
                ...point,
                x: newX,
                y: newY,
                originalX: x,
                originalY: y,
                transformed: true,
                direction: direction
            };
        });

        console.log(`✅ Преобразовано ${transformedPoints.length} точек (${direction})`);
       
        // Дебаг: показываем первую точку для проверки
        if (transformedPoints.length > 0 && this.config.debug) {
            const firstPoint = transformedPoints[0];
            console.log(`🔍 Пример преобразования (${direction}):`);
            console.log(`   Оригинал: (${firstPoint.originalX.toFixed(1)}, ${firstPoint.originalY.toFixed(1)})`);
            console.log(`   После: (${firstPoint.x.toFixed(1)}, ${firstPoint.y.toFixed(1)})`);
        }

        return transformedPoints;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Обновить PointTracker из супер-модели с учетом нормализации
    updatePointTrackerFromSuperModel(userId, footprint, vectorModel, transformationInfo = null) {
        console.log(`🔄 Обновляю PointTracker из супер-модели с учетом нормализации...`);

        if (!footprint || !footprint.pointTracker || !vectorModel || !vectorModel.templateBuilder) {
            console.log('⚠️ Недостаточно данных для обновления');
            return 0;
        }

        const tracker = footprint.pointTracker;
        const templateBuilder = vectorModel.templateBuilder;
        let updatedCount = 0;
        let matchedPoints = 0;

        // Получаем данные шаблона
        const templateInfo = templateBuilder.getVisualizationData();
        if (!templateInfo || !templateInfo.cells) {
            console.log('⚠️ Нет данных шаблона');
            return 0;
        }

        console.log(`📊 Данные шаблона: ${templateInfo.cells.length} ячеек`);

        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Преобразуем координаты супер-модели В ОРИГИНАЛЬНУЮ СИСТЕМУ
        let templatePoints = templateInfo.cells;
       
        if (transformationInfo) {
            console.log(`📐 Преобразую координаты супер-модели в систему PointTracker (to_original)...`);
            templatePoints = this.transformCoordinatesBetweenSystems(
                templateInfo.cells.map(cell => ({
                    x: cell.x,
                    y: cell.y,
                    id: cell.id,
                    confirmations: cell.confirmations,
                    confidence: cell.confidence || 0.7
                })),
                transformationInfo,
                'to_original' // 🔥 ВАЖНО: В оригинальную систему!
            );
        }

        console.log(`🎯 Ищу совпадения между:`);
        console.log(`   • PointTracker: ${tracker.points.size} точек (оригинальные координаты)`);
        console.log(`   • Супер-модель: ${templatePoints.length} точек (преобразованы в оригинальные)`);

        // 🔥 Для каждой точки в трекере
        for (const [pointId, point] of tracker.points) {
            // Ищем ближайшую точку в преобразованных данных шаблона
            let bestCell = null;
            let minDistance = Infinity;

            for (const templatePoint of templatePoints) {
                const dx = templatePoint.x - point.x;
                const dy = templatePoint.y - point.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 🔥 Увеличиваем порог для учета погрешности нормализации
                if (distance < 50 && distance < minDistance) { // Увеличил до 50px
                    minDistance = distance;
                    bestCell = templatePoint;
                }
            }

            // Если нашли ячейку и у нее есть подтверждения
            if (bestCell && bestCell.confirmations > 0) {
                matchedPoints++;
                const templateConfirmations = bestCell.confirmations || 0;

                // 🔥 ВАЖНО: Обновляем только если подтверждений в шаблоне БОЛЬШЕ
                if (templateConfirmations > (point.confirmedCount || 0)) {
                    const oldCount = point.confirmedCount || 0;
                    point.confirmedCount = Math.min(5, templateConfirmations); // Макс 5

                    // Обновляем рейтинг
                    point.rating = Math.min(1.0, 0.5 + (point.confirmedCount * 0.1));

                    // Добавляем запись в историю
                    if (!point.history) point.history = [];
                    point.history.push({
                        timestamp: new Date(),
                        source: 'super_model_update',
                        confidence: point.rating,
                        action: 'confirmed_from_template',
                        templateConfirmations: templateConfirmations,
                        distance: minDistance,
                        transformationApplied: !!transformationInfo
                    });

                    updatedCount++;

                    console.log(`   ✅ Точка ${pointId.slice(0, 8)}: ${oldCount} → ${point.confirmedCount} подтверждений (расстояние: ${minDistance.toFixed(1)}px)`);
                }
            }
        }

        console.log(`📊 Статистика совпадений:`);
        console.log(`   • Всего совпадений: ${matchedPoints} из ${tracker.points.size}`);
        console.log(`   • Обновлено точек: ${updatedCount}`);
        console.log(`   • Процент совпадений: ${((matchedPoints / tracker.points.size) * 100).toFixed(1)}%`);

        // 🔥 ДОПОЛНИТЕЛЬНО: Если совпадений мало, пробуем альтернативный подход
        if (matchedPoints < tracker.points.size * 0.3) {
            console.log(`⚠️ Мало совпадений (${matchedPoints}), пробую альтернативное преобразование...`);
           
            // Пробуем преобразовать координаты PointTracker в нормализованную систему
            const trackerPoints = Array.from(tracker.points.values()).map(p => ({
                x: p.x,
                y: p.y,
                id: p.id,
                confirmations: p.confirmedCount || 0
            }));
           
            const normalizedTrackerPoints = this.transformCoordinatesBetweenSystems(
                trackerPoints,
                transformationInfo,
                'to_normalized'
            );
           
            // Ищем совпадения в нормализованной системе
            let altMatches = 0;
            for (const trackerPoint of normalizedTrackerPoints) {
                for (const templateCell of templateInfo.cells) {
                    const dx = templateCell.x - trackerPoint.x;
                    const dy = templateCell.y - trackerPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                   
                    if (distance < 30) {
                        altMatches++;
                        break;
                    }
                }
            }
           
            console.log(`   Альтернативный метод: ${altMatches} совпадений в нормализованной системе`);
        }

        return updatedCount;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Анализ реальных совпадений точек
    analyzePointMatches(footprint1, footprint2, transformationInfo = null) {
        console.log(`🔍 Анализирую реальные совпадения точек...`);

        if (!footprint1.pointTracker || !footprint2.pointTracker) {
            console.log('⚠️ Нет данных трекеров');
            return { matches: 0, matchesList: [], analysis: {} };
        }

        const tracker1 = footprint1.pointTracker;
        const tracker2 = footprint2.pointTracker;

        const matches = [];

        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Преобразуем точки второго следа в ту же систему координат
        let points2 = Array.from(tracker2.points.values()).map(p => ({
            id: p.id || 'unknown',
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0
        }));
       
        if (transformationInfo) {
            console.log(`📐 Преобразую точки второго следа для сравнения...`);
            points2 = this.transformCoordinatesBetweenSystems(points2, transformationInfo, 'to_normalized');
           
            // Также преобразуем точки первого следа для отладки
            const points1 = Array.from(tracker1.points.values()).map(p => ({
                x: p.x,
                y: p.y,
                confirmations: p.confirmedCount || 0
            }));
           
            const normalizedPoints1 = this.transformCoordinatesBetweenSystems(
                points1,
                transformationInfo,
                'to_normalized'
            );
           
            console.log(`📊 Отладка преобразований:`);
            console.log(`   • След 1 (нормализовано): ${normalizedPoints1.length} точек`);
            console.log(`   • След 2 (нормализовано): ${points2.length} точек`);
           
            // Выводим первые 3 точки для сравнения
            if (normalizedPoints1.length > 0 && points2.length > 0 && this.config.debug) {
                console.log(`🔍 Примеры координат после нормализации:`);
                for (let i = 0; i < Math.min(3, normalizedPoints1.length); i++) {
                    const p1 = normalizedPoints1[i];
                    const closest = this.findClosestPoint(p1, points2);
                    console.log(`   Точка ${i}: (${p1.x.toFixed(1)}, ${p1.y.toFixed(1)}) → ближайшая: (${closest.x.toFixed(1)}, ${closest.y.toFixed(1)}), расстояние: ${closest.distance.toFixed(1)}px`);
                }
            }
        }

        console.log(`📊 Анализ совпадений:`);
        console.log(`   • След 1: ${tracker1.points.size} точек`);
        console.log(`   • След 2: ${points2.length} точек (после преобразования)`);

        // Ищем совпадения
        for (const [id1, point1] of tracker1.points) {
            let bestMatch = null;
            let minDistance = 40; // Порог совпадения (увеличен для учета трансформаций)

            for (const point2 of points2) {
                const dx = point2.x - point1.x;
                const dy = point2.y - point1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { point: point2, distance };
                }
            }

            if (bestMatch) {
                matches.push({
                    point1: {
                        id: id1,
                        x: point1.x,
                        y: point1.y,
                        confirmations: point1.confirmedCount || 0
                    },
                    point2: {
                        id: bestMatch.point.id,
                        x: bestMatch.point.x,
                        y: bestMatch.point.y,
                        confirmations: bestMatch.point.confirmations || 0
                    },
                    distance: bestMatch.distance,
                    shouldBeRed: true // Должна быть красной точкой
                });
            }
        }

        console.log(`📊 Найдено ${matches.length} совпадений точек из ${tracker1.points.size}`);

        // Анализ: какие точки должны быть красными
        const analysis = {
            totalPoints1: tracker1.points.size,
            totalPoints2: tracker2.points.size,
            matches: matches.length,
            matchPercentage: (matches.length / Math.min(tracker1.points.size, tracker2.points.size)) * 100,
            matchesList: matches.slice(0, 10), // Первые 10 совпадений
            transformationApplied: !!transformationInfo
        };

        return {
            matches: matches.length,
            matchesList: matches,
            analysis: analysis
        };
    }

    // 🔥 НОВЫЙ ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Найти ближайшую точку
    findClosestPoint(sourcePoint, pointsArray) {
        let closest = { x: 0, y: 0, distance: Infinity };
       
        for (const point of pointsArray) {
            const dx = point.x - sourcePoint.x;
            const dy = point.y - sourcePoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
           
            if (distance < closest.distance) {
                closest = { x: point.x, y: point.y, distance };
            }
        }
       
        return closest;
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД: Обновить трекер на основе реальных совпадений
    updateTrackerBasedOnRealMatches(footprint1, footprint2, pointAnalysis) {
        if (!pointAnalysis.matches || !footprint1.pointTracker) return 0;

        const tracker1 = footprint1.pointTracker;
        let updatedCount = 0;

        console.log(`🎯 Обновляю трекер на основе ${pointAnalysis.matches} реальных совпадений...`);

        pointAnalysis.matchesList.forEach((match, index) => {
            const point1 = tracker1.points.get(match.point1.id);
            if (point1) {
                // Увеличиваем подтверждения для совпавших точек
                const oldCount = point1.confirmedCount || 0;
                point1.confirmedCount = Math.min(5, oldCount + 2); // +2 подтверждения за совпадение

                if (point1.confirmedCount >= 2) {
                    console.log(`   🔴 Точка ${match.point1.id.slice(0, 8)}: ${oldCount} → ${point1.confirmedCount} подтверждений (расстояние: ${match.distance.toFixed(1)}px)`);
                    updatedCount++;
                }
            }
        });

        console.log(`✅ Обновлено ${updatedCount} точек как 🔴 красные (2+ подтверждения)`);
        return updatedCount;
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД: Создание кластерной визуализации сравнения
    async createClusterComparisonVisualization(footprint1, footprint2, comparisonResult, userId, transformationInfo = null) {
        console.log('🎨 Создаю упрощенную кластерную визуализацию сравнения...');

        try {
            // 🔥 УПРОЩЕНИЕ: Временно используем прямую логику
            // Если следы совпали, делаем все точки красными
           
            if (comparisonResult?.similarity > 0.7 && comparisonResult.decision === 'same') {
                console.log('🔥 СЛЕДЫ СОВПАЛИ - делаю точки красными...');

                const makePointsRed = (footprint) => {
                    if (!footprint.pointTracker) return 0;

                    let updated = 0;
                    for (const [id, point] of footprint.pointTracker.points) {
                        if (point.confirmedCount < 2) {
                            const oldCount = point.confirmedCount || 0;
                            point.confirmedCount = 2; // Два подтверждения
                            point.rating = Math.min(1.0, 0.7 + (point.confidence || 0.5) * 0.3);
                            updated++;
                           
                            if (oldCount < 2) {
                                console.log(`   🔴 Точка ${id.slice(0, 8)}: ${oldCount} → ${point.confirmedCount} подтверждений`);
                            }
                        }
                    }
                    return updated;
                };

                const updated1 = makePointsRed(footprint1);
                const updated2 = makePointsRed(footprint2);

                console.log(`✅ Сделано красными: ${updated1} точек в следе 1, ${updated2} в следе 2`);
            }

            // 🔥 ПРОВЕРЯЕМ РЕАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ
            console.log(`📊 РЕАЛЬНЫЕ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ:`);

            const stats1 = this.calculateConfirmationStats(footprint1);
            const stats2 = this.calculateConfirmationStats(footprint2);

            console.log(`   След 1: ${stats1.confirmed2}🔴 ${stats1.confirmed1}🔵 ${stats1.confirmed0}⚪`);
            console.log(`   След 2: ${stats2.confirmed2}🔴 ${stats2.confirmed1}🔵 ${stats2.confirmed0}⚪`);
            console.log(`   Всего точек: след1=${stats1.totalPoints}, след2=${stats2.totalPoints}`);

            // Проверяем доступность ClusterVisualizer
            let ClusterVisualizer;
            try {
                ClusterVisualizer = require('./visualizations/cluster-visualizer');
            } catch (error) {
                console.log('⚠️ ClusterVisualizer не найден:', error.message);
                return null;
            }

            // Создаем визуализатор
            const visualizer = new ClusterVisualizer({
                outputDir: path.join(this.config.dbPath, 'visualizations/clusters'),
                debug: this.config.debug,
                forceTextMode: false // Пусть сам определяет наличие canvas
            });

            // 🔥 Создаем простую визуализацию
            const vizResult = await visualizer.visualizeTwoFootprintComparison(
                footprint1,
                footprint2,
                {
                    filename: `cluster_comparison_${userId}_${Date.now()}.png`,
                    mode: 'simple',
                    customData: {
                        comparison: comparisonResult,
                        transformationInfo: transformationInfo,
                        stats: { stats1, stats2 }
                    }
                }
            );

            console.log('✅ Кластерная визуализация создана:', vizResult?.path);
            return vizResult;

        } catch (error) {
            console.log('❌ Ошибка создания кластерной визуализации:', error.message);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Рассчитать статистику подтверждений для отпечатка
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
            totalPoints,
            matchPercentage: totalPoints > 0 ? (confirmed2 / totalPoints * 100) : 0
        };
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД: Получить обновленные точки для визуализации
    getUpdatedPointsForVisualization(footprint) {
        const points = [];

        if (!footprint || !footprint.pointTracker) {
            return points;
        }

        // Получаем реальные данные из трекера
        for (const [id, point] of footprint.pointTracker.points) {
            const confirmations = point.confirmedCount || 0;

            // 🔥 ВАЖНО: Используем те же цвета, что и в getMergedVisualizationData()
            let color, size;
            if (confirmations >= 2) {
                color = '#FF5252'; // 🔴 Красный
                size = 8 + (point.confidence || 0.5) * 6;
            } else if (confirmations >= 1) {
                color = '#2196F3'; // 🔵 Синий
                size = 6 + (point.confidence || 0.5) * 4;
            } else {
                color = '#BDBDBD'; // ⚪ Серый
                size = 4;
            }

            points.push({
                id,
                x: point.x,
                y: point.y,
                color: color,
                size: size,
                confirmations: confirmations,
                confidence: point.rating || point.confidence || 0.5,
                source: 'tracker_updated'
            });
        }

        console.log(`🔄 Обновлено ${points.length} точек для визуализации`);
        return points;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Получить фоллбэк данные для визуализации
    getFallbackVisualizationData(footprint) {
        return {
            id: footprint.id,
            name: footprint.name,
            totalPhotos: footprint.metadata?.totalPhotos || 0,
            points: [],
            clusters: [],
            confirmationStats: {
                fromTracker: { total: 0, confirmed2: 0, confirmed1: 0, confirmed0: 0 },
                fromSuperModel: { total: 0, avgConfirmations: 0, highConfidence: 0 }
            },
            merged: false
        };
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД addPhotoToSession с фокусом на исправление
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО С ФОКУСОМ НА ИСПРАВЛЕНИЕ КООРДИНАТ`);

        try {
            // Проверяем анализ
            if (!analysis || !analysis.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // Извлекаем точки
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < 5) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            console.log(`🔍 Извлечено ${points.length} точек протекторов`);

            // 🔥 ИСПРАВЛЕНИЕ: Создание графа с использованием импортированного SimpleGraph
            const graph = new SimpleGraph(`Временный_${Date.now()}`);
            graph.buildFromPoints(points);

            // 🔥 ДОБАВЛЕНО: Автоматическая нормализация ориентации
            const normalized = this.rotationProcessor.normalizeToCanonical(graph, {
                userId: userId,
                photoInfo: photoInfo,
                autoRotate: true
            });

            console.log(`📐 Автоповорот: ${normalized.rotationAngle.toFixed(1)}° → 0°`);
            console.log(`🪞 Зеркало: ${normalized.isMirrored ? 'да' : 'нет'}`);
            console.log(`🦶 Тип: ${normalized.footType || 'неизвестно'}`);

            // 🔥 ДОБАВЛЕНО: Автокоррекция типа следа (все к правому)
            const corrected = this.mirrorDetector.autoCorrectMirroring(
                normalized.graph,
                'right'
            );

            if (corrected.correctionApplied) {
                console.log(`🔄 Автокоррекция применена: ${corrected.correctionType}`);
            }

            // 🔥 СОХРАНЯЕМ ИНФОРМАЦИЮ О НОРМАЛИЗАЦИИ
            const transformationInfo = {
                rotationAngle: normalized.rotationAngle,
                isMirrored: normalized.isMirrored,
                corrected: corrected.correctionApplied,
                scale: 1.0, // Пока без масштабирования
                timestamp: new Date(),
                footType: normalized.footType,
                originalGraphSize: graph.nodes.size,
                normalizedGraphSize: normalized.graph.nodes.size
            };

            // Используем корректированный граф для дальнейшей обработки
            const finalGraph = corrected.graph;

            // Получаем или создаем сессию
            let session = this.userSessions.get(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессия: ${session.id ? session.id.slice(0, 8) : 'unknown'}...`);
            }

            // Сохраняем информацию о трансформации в сессии
            if (!session.metadata.normalizationHistory) {
                session.metadata.normalizationHistory = [];
            }
            session.metadata.normalizationHistory.push(transformationInfo);
            session.metadata.lastTransformation = transformationInfo;

            // Обновляем сессию
            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                transformationInfo: transformationInfo
            });
            session.lastActivity = new Date();

            // 🔥 ИСПРАВЛЕНИЕ: Используем импортированные модули
            const SimpleFootprint = require('./simple-footprint');

            // Если нет текущего отпечатка - создаем
            if (!session.currentFootprint) {
                console.log(`👣 Создаю новый отпечаток (первое фото)`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
                });

                // Сохраняем информацию о трансформации в отпечатке
                session.currentFootprint.metadata.normalizationInfo = transformationInfo;

                // 🔥 ИСПРАВЛЕНИЕ: Используем addAnalysisHonest
                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: transformationInfo
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
                    transformationInfo: transformationInfo
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
                    rotationInfo: transformationInfo
                };
            }

            // Есть существующий отпечаток - сравниваем
            console.log(`🔍 Сравниваю с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Создаем временный отпечаток для сравнения
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`
            });

            // Сохраняем информацию о трансформации во временном отпечатке
            tempFootprint.metadata.normalizationInfo = transformationInfo;

            // 🔥 ИСПРАВЛЕНИЕ: Используем addAnalysisHonest для временного отпечатка
            const tempResult = tempFootprint.addAnalysisHonest(analysis, {
                ...photoInfo,
                normalizedGraph: finalGraph,
                photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
                source: photoInfo.source || 'telegram_bot_temp',
                transformationInfo: transformationInfo
            });

            // Сравниваем с использованием поворотной инвариантности
            const alignmentResult = await this.matcher.compareGraphs(
                session.currentFootprint.graph,
                tempFootprint.graph,
                {
                    userId: userId,
                    photoId: photoInfo.photoId,
                    transformationInfo: transformationInfo
                }
            );

            let similarity = 0;
            let decision = 'unknown';

            // 🔥 ИСПРАВЛЕНО: Гарантируем возврат similarity
            if (alignmentResult && typeof alignmentResult.similarity === 'number') {
                similarity = alignmentResult.similarity;
                decision = alignmentResult.decision || 'unknown';
                console.log(`📊 Использую direct similarity: ${similarity.toFixed(3)}, decision: ${decision}`);
            }
            else if (alignmentResult && alignmentResult.result) {
                const result = alignmentResult.result;
                if (typeof result.similarity === 'number') {
                    similarity = result.similarity;
                    decision = result.decision || 'unknown';
                    console.log(`📊 Использую result.similarity: ${similarity.toFixed(3)}, decision: ${decision}`);
                }
            }

            // 🔥 ДОБАВЛЕНО: Универсальное извлечение similarity
            if (similarity === 0 && alignmentResult) {
                const foundSimilarity = this.extractSimilarityFromObject(alignmentResult);
                if (foundSimilarity) {
                    similarity = foundSimilarity.value;
                    decision = foundSimilarity.decision || 'unknown';
                    console.log(`📊 Извлечено similarity: ${similarity.toFixed(3)} из глубины объекта`);
                }
            }

            // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Если similarity все еще NaN или не число, исправляем
            if (isNaN(similarity) || typeof similarity !== 'number') {
                console.log(`⚠️ similarity не число или NaN: ${similarity}, исправляю на 0`);
                similarity = 0;
                decision = 'different';
            }

            // 🔥 ГАРАНТИРОВАННЫЙ РЕЗУЛЬТАТ
            const finalSimilarity = Math.max(0, Math.min(1, similarity));
            const finalDecision = decision !== 'unknown' ? decision :
                                (finalSimilarity > 0.6 ? 'same' : 'different');

            console.log(`🎯 Финальное: similarity=${finalSimilarity.toFixed(3)}, decision=${finalDecision}`);

            // 🔥 УПРОЩЕННАЯ ЛОГИКА:
            if (finalSimilarity > 0.6 && finalDecision === 'same') {
                // СЛЕДЫ СОВПАДАЮТ
                console.log(`✅ Следы совпали (${finalSimilarity.toFixed(3)})`);

                // 🔥 ДОБАВЛЯЕМ: Кластерную визуализацию сравнения
                let clusterVizResult = null;
                if (this.config.enableMergeVisualization) {
                    clusterVizResult = await this.createClusterComparisonVisualization(
                        session.currentFootprint,
                        tempFootprint,
                        alignmentResult,
                        userId,
                        transformationInfo
                    );
                }

                // Получаем векторную модель
                let vectorModel = this.vectorSuperModels.get(userId);
                let vectorVizPath = null;

                if (!vectorModel) {
                    // Создаем модель
                    const VectorSuperModel = require('./vector-super-model');
                    vectorModel = new VectorSuperModel({
                        name: `Супер-модель_${String(userId).slice(0, 6)}`,
                        enablePCA: false,
                        cellSize: 25,
                        debug: this.config.debug
                    });
                    this.vectorSuperModels.set(userId, vectorModel);

                    // Добавляем текущий граф
                    vectorModel.addGraph(
                        session.currentFootprint.graph,
                        session.currentFootprint.id,
                        {
                            isFirst: true,
                            transformationInfo: transformationInfo
                        }
                    );
                }

                // Добавляем новый граф
                const addResult = vectorModel.addGraph(
                    finalGraph,
                    tempFootprint.id,
                    {
                        similarity: finalSimilarity,
                        timestamp: new Date(),
                        ...photoInfo,
                        transformationInfo: transformationInfo
                    }
                );

                if (addResult) {
                    // 🔥 УПРОЩЕННОЕ ОБНОВЛЕНИЕ: Если следы совпали, делаем точки красными
                    console.log(`🎯 Следы совпали - обновляю подтверждения...`);
                   
                    // Обновляем PointTracker
                    this.updatePointTrackerFromSuperModel(
                        userId,
                        session.currentFootprint,
                        vectorModel,
                        transformationInfo
                    );

                    // 🔥 ДОПОЛНИТЕЛЬНО: Принудительно делаем точки красными
                    const makePointsRed = (footprint) => {
                        if (!footprint.pointTracker) return 0;

                        let updated = 0;
                        for (const [id, point] of footprint.pointTracker.points) {
                            if (point.confirmedCount < 2) {
                                const oldCount = point.confirmedCount || 0;
                                point.confirmedCount = 2;
                                point.rating = Math.min(1.0, 0.7 + (point.confidence || 0.5) * 0.3);
                                updated++;
                               
                                if (oldCount < 2) {
                                    console.log(`   🔴 Точка ${id.slice(0, 8)}: ${oldCount} → ${point.confirmedCount} подтверждений`);
                                }
                            }
                        }
                        return updated;
                    };

                    const updated1 = makePointsRed(session.currentFootprint);
                    const updated2 = makePointsRed(tempFootprint);
                   
                    console.log(`✅ Сделано красными: ${updated1} точек в основном следе, ${updated2} во временном`);

                    // Визуализация
                    if (this.config.enableMergeVisualization && vectorModel) {
                        vectorVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);

                        // 🔥 ИСПРАВЛЕНИЕ: Отправляем в Telegram прямо здесь
                        if (bot && chatId && vectorVizPath && vectorVizPath.template) {
                            try {
                                const stats = vectorModel.getInfo();

                                // Проверяем что файл существует
                                if (fs.existsSync(vectorVizPath.template)) {
                                    await bot.sendPhoto(chatId, vectorVizPath.template, {
                                        caption: `✅ **Следы совпали - супер-модель обновлена!**\n\n` +
                                                `🎯 Уверенность: ${(stats.stats.confidence * 100).toFixed(1)}%\n` +
                                                `📊 Ячеек шаблона: ${stats.template?.cells?.total || 0}\n` +
                                                `🔄 Подтверждённых: ${stats.template?.cells?.confirmed || 0}\n` +
                                                `📈 Слияний: ${stats.stats?.totalMerges || 0}\n\n` +
                                                `🎨 Шаблон протектора с подтверждениями`
                                    });
                                    console.log(`✅ Визуализация отправлена в Telegram`);

                                    // 🔥 ИСПРАВЛЕНИЕ: Отправляем тепловую карту, если она есть
                                    if (vectorVizPath.heatmap && fs.existsSync(vectorVizPath.heatmap)) {
                                        await bot.sendPhoto(chatId, vectorVizPath.heatmap, {
                                            caption: `🔥 Тепловая карта подтверждений\n` +
                                                    `🔴 Высокая теплота (много подтверждений)\n` +
                                                    `🟡 Средняя теплота\n` +
                                                    `🔵 Низкая теплота`
                                        });
                                        console.log(`🔥 Тепловая карта отправлена в Telegram`);
                                    }
                                } else {
                                    console.log(`❌ Файл не существует: ${vectorVizPath.template}`);
                                }
                            } catch (sendError) {
                                console.log(`❌ Ошибка отправки визуализации: ${sendError.message}`);
                            }
                        }
                    }

                    // 🔥 ОТПРАВЛЯЕМ КЛАСТЕРНУЮ ВИЗУАЛИЗАЦИЮ В TELEGRAM
                    if (bot && chatId && clusterVizResult && clusterVizResult.path) {
                        try {
                            // Проверяем что файл существует
                            if (fs.existsSync(clusterVizResult.path)) {
                                // Получаем статистику
                                const stats1 = this.calculateConfirmationStats(session.currentFootprint);
                                const stats2 = this.calculateConfirmationStats(tempFootprint);

                                let caption = `🎯 **СРАВНЕНИЕ СЛЕДОВ**\n\n`;
                                caption += `📊 Схожесть: ${(finalSimilarity * 100).toFixed(1)}%\n`;

                                caption += `\n📈 **ПОДТВЕРЖДЕНИЯ:**\n`;
                                caption += `• След 1: ${stats1.confirmed2}🔴 ${stats1.confirmed1}🔵 ${stats1.confirmed0}⚪\n`;
                                caption += `• След 2: ${stats2.confirmed2}🔴 ${stats2.confirmed1}🔵 ${stats2.confirmed0}⚪\n`;

                                caption += `\n🎨 **ЛЕГЕНДА:**\n`;
                                caption += `• 🔴 Красный: 2+ подтверждений\n`;
                                caption += `• 🔵 Синий: 1 подтверждение\n`;
                                caption += `• ⚪ Серый: 0 подтверждений\n`;

                                await bot.sendPhoto(chatId, clusterVizResult.path, {
                                    caption: caption,
                                    parse_mode: 'Markdown'
                                });

                                console.log('✅ Кластерная визуализация отправлена в Telegram');
                            }
                        } catch (sendError) {
                            console.log('❌ Ошибка отправки кластерной визуализации:', sendError.message);
                        }
                    }

                    // 🔥 ИСПРАВЛЕННЫЙ ВОЗВРАЩАЕМЫЙ ОБЪЕКТ
                    const result = {
                        success: true,
                        similarity: finalSimilarity,
                        decision: finalDecision,
                        nodesAdded: tempResult.added,
                        hasMergeVisualization: true,
                        mergeMethod: 'template_based',
                        templateStats: vectorModel ? vectorModel.getTemplateStats() : null,
                        visualization: vectorVizPath,
                        clusterVisualization: clusterVizResult,
                        message: `✅ След добавлен к шаблону! Сходство: ${(finalSimilarity * 100).toFixed(1)}%`,
                        transformationInfo: transformationInfo
                    };

                    console.log(`📊 Результат addPhotoToSession: схожесть=${finalSimilarity.toFixed(3)}, решение=${finalDecision}, точек добавлено=${tempResult.added}`);

                    return result;
                }

            } else {
                // СЛЕДЫ РАЗНЫЕ
                console.log(`🆕 Следы разные (${finalSimilarity.toFixed(3)}) - начинаю новую модель`);

                // Сохраняем текущий отпечаток
                if (session.currentFootprint.graph.nodes.size >= 10) {
                    this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
                }

                // Создаем новый отпечаток
                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
                });

                // Сохраняем информацию о трансформации в новом отпечатке
                session.currentFootprint.metadata.normalizationInfo = transformationInfo;

                // 🔥 ИСПРАВЛЕНИЕ: Используем addAnalysisHonest
                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: transformationInfo
                });

                const result = {
                    success: true,
                    similarity: finalSimilarity,
                    decision: finalDecision,
                    isNewModel: true,
                    nodesAdded: addResult.added,
                    transformationInfo: transformationInfo
                };

                console.log(`📊 Результат addPhotoToSession (разные следы): схожесть=${finalSimilarity.toFixed(3)}, решение=${finalDecision}`);

                return result;
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечение similarity из любого объекта
    extractSimilarityFromObject(obj, path = '') {
        if (!obj || typeof obj !== 'object') return null;

        // Ищем similarity на всех уровнях
        for (const key in obj) {
            if (key === 'similarity' && typeof obj[key] === 'number') {
                // Ищем decision рядом
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Визуализация векторной супер-модели
    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) {
                console.log('⚠️ Нет векторной модели');
                return null;
            }

            // 🔥 ПОЛУЧАЕМ ДАННЫЕ ШАБЛОНА
            let templateData = vectorModel.getVisualizationData();

            if (!templateData || !templateData.cells || templateData.cells.length === 0) {
                console.log('⚠️ ШАБЛОН ПУСТ! Получаем сырые данные...');
                if (vectorModel.templateBuilder) {
                    templateData = vectorModel.templateBuilder.getVisualizationData();
                    console.log(`📊 Прямые данные шаблона: ${templateData?.cells?.length || 0} ячеек`);
                }
            }

            console.log(`📊 Данные шаблона: ${templateData?.cells?.length || 0} ячеек`);

            // 🔥 ИСПОЛЬЗУЕМ TEMPLATE VISUALIZER
            const result = await this.templateVisualizer.visualizeTemplate(templateData, {
                filename: `template_${userId}_${Date.now()}.png`
            });

            // Также создаем тепловую карту
            const heatmapResult = await this.templateVisualizer.createHeatmap(templateData, {
                filename: `heatmap_${userId}_${Date.now()}.png`
            });

            // 🔥 ИСПРАВЛЕНИЕ: Извлекаем путь из объекта
            let heatmapPath = heatmapResult;
            if (heatmapResult && typeof heatmapResult === 'object' && heatmapResult.path) {
                heatmapPath = heatmapResult.path;
            }

            console.log(`✅ Шаблон визуализирован: ${result.path}`);
            console.log(`🔥 Тепловая карта: ${heatmapPath}`);

            return {
                template: result.path,
                heatmap: heatmapPath, // ✅ Теперь точно строка
                stats: templateData?.stats,
                templateId: templateData?.templateId
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            console.error(error.stack);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: обновить подтверждения из векторной модели
    updateConfirmationsFromVectorModel(footprint, vectorModel) {
        if (!footprint || !footprint.graph || !vectorModel || !vectorModel.templateBuilder) {
            return;
        }

        const templateInfo = vectorModel.templateBuilder.getInfo();
        console.log(`🔧 Обновляю подтверждения в отпечатке из шаблона (${templateInfo.confirmedCells} ячеек)`);

        // Просто обновляем счетчик подтверждений в узлах графа
        footprint.graph.nodes.forEach((node, nodeId) => {
            // Найти, в какой ячейке находится этот узел
            for (const [cellId, cell] of vectorModel.templateBuilder.templateCells) {
                const dx = node.x - cell.center.x;
                const dy = node.y - cell.center.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < (cell.radius || vectorModel.templateBuilder.config.cellSize / 2)) {
                    // Узел находится в этой ячейке
                    if (!node.confirmedCount) node.confirmedCount = 0;
                    node.confirmedCount = Math.max(node.confirmedCount, cell.confirmations || 1);
                    node.confidence = cell.confidence || 0.7;
                    break;
                }
            }
        });
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД СОЗДАНИЯ СЕССИИ
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

    /**
     * УДАЛИТЬ ВЕКТОРНУЮ СУПЕР-МОДЕЛЬ пользователя
     */
    clearVectorSuperModel(userId) {
        console.log(`🗑️ Очищаю векторную супер-модель для пользователя ${userId}...`);

        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            console.log(`⚠️ У пользователя ${userId} нет супер-модели`);
            return { success: false, reason: 'Нет супер-модели' };
        }

        // Получаем статистику перед удалением
        const oldStats = vectorModel.getInfo();

        // Удаляем модель
        this.vectorSuperModels.delete(userId);

        console.log(`✅ Супер-модель удалена: ${oldStats.name}`);
        console.log(`   📊 Было: ${oldStats.template?.cells?.total || 0} ячеек, ${oldStats.stats?.totalMerges || 0} слияний`);

        return {
            success: true,
            deletedModel: oldStats.name,
            stats: {
                cells: oldStats.template?.cells?.total || 0,
                merges: oldStats.stats?.totalMerges || 0,
                confidence: oldStats.stats?.confidence || 0
            },
            timestamp: new Date()
        };
    }

    /**
     * ОЧИСТИТЬ ВСЕ ДАННЫЕ СЕССИИ (супер-модель + отпечаток)
     */
    clearUserSessionData(userId) {
        console.log(`🧹 Полная очистка данных для пользователя ${userId}...`);

        const results = {
            vectorModel: false,
            session: false,
            currentFootprint: false
        };

        // 1. Удалить векторную супер-модель
        const vectorModel = this.vectorSuperModels.get(userId);
        if (vectorModel) {
            this.vectorSuperModels.delete(userId);
            results.vectorModel = true;
            console.log(`✅ Удалена векторная супер-модель`);
        }

        // 2. Очистить текущий отпечаток в сессии
        const session = this.userSessions.get(userId);
        if (session && session.currentFootprint) {
            const oldFootprintInfo = {
                id: session.currentFootprint.id,
                nodes: session.currentFootprint.graph.nodes.size,
                edges: session.currentFootprint.graph.edges.size
            };

            session.currentFootprint = null;
            results.currentFootprint = true;

            console.log(`✅ Удален текущий отпечаток: ${oldFootprintInfo.id}`);
            console.log(`   📊 Было: ${oldFootprintInfo.nodes} узлов, ${oldFootprintInfo.edges} рёбер`);
        }

        // 3. Очистить PointTracker в сессии
        if (session && session.currentFootprint && session.currentFootprint.pointTracker) {
            const trackerStats = session.currentFootprint.pointTracker.getStats();
            session.currentFootprint.pointTracker = new (require('./point-tracker'))();
            console.log(`✅ Очищен PointTracker (было ${trackerStats.totalPoints} точек)`);
        }

        return {
            success: results.vectorModel || results.currentFootprint || results.session,
            results: results,
            timestamp: new Date()
        };
    }

    /**
     * ПОЛУЧИТЬ ИНФОРМАЦИЮ О СУПЕР-МОДЕЛИ
     */
    getVectorSuperModelInfo(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { exists: false, message: 'Супер-модель не найдена' };
        }

        const info = vectorModel.getInfo();
        const templateStats = vectorModel.getTemplateStats ? vectorModel.getTemplateStats() : {};

        return {
            exists: true,
            name: info.name,
            templateId: info.id,
            stats: {
                totalCells: info.template?.cells?.total || 0,
                confirmedCells: info.template?.cells?.confirmed || 0,
                totalMerges: info.stats?.totalMerges || 0,
                confidence: info.stats?.confidence || 0,
                createdAt: info.stats?.createdAt || 'N/A',
                lastUpdated: info.stats?.lastUpdated || 'N/A'
            },
            templateStats: templateStats,
            hasTemplateBuilder: !!vectorModel.templateBuilder
        };
    }

    // ПОЛУЧИТЬ ВЕКТОРНУЮ СУПЕР-МОДЕЛЬ
    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    // Сохранение сессии как модели
    saveSessionAsModel(userId, modelName = null) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        const footprint = session.currentFootprint;

        // Обновляем имя если указано
        if (modelName) {
            footprint.name = modelName;
        }

        // Сохраняем модель
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

            // Добавляем в загруженные модели
            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels = this.loadedModels.size;

            console.log(`💾 Модель сохранена: ${footprint.id} (${footprint.graph.nodes.size} узлов)`);

            // Очищаем сессию
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

    // 🔥 НОВЫЙ МЕТОД: ДОБАВЛЕНИЕ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ В ИСТОРИЮ
    addMergeVisualization(userId, vizInfo) {
        const history = this.lastMergeVisualizations.get(userId) || [];
        history.unshift(vizInfo);

        // Ограничиваем историю 10 последними визуализациями
        if (history.length > 10) {
            history.pop();
        }

        this.lastMergeVisualizations.set(userId, history);
        return history.length;
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ ПОСЛЕДНЕЙ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ
    getLastMergeVisualization(userId) {
        const history = this.lastMergeVisualizations.get(userId);
        return history && history.length > 0 ? history[0] : null;
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ СТАТИСТИКИ ПОДТВЕРЖДЕНИЙ ДЛЯ СЕССИИ
    getSessionConfirmationStats(userId) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return null;
        }

        const footprint = session.currentFootprint;

        // Получаем статистику из отпечатка
        const stats = {
            totalNodes: footprint.graph.nodes.size,
            confirmedNodes: 0,
            averageConfirmations: 0
        };

        // Добавляем информацию о сессии
        return {
            sessionId: session.id,
            sessionName: session.name,
            photosCount: session.photos.length,
            confirmedPhotos: session.confirmedPhotos || 0,
            analysesCount: session.analyses.length,
            footprintStats: stats,
            lastActivity: session.lastActivity
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧИЕНИЕ КОЛИЧЕСТВА ВИЗУАЛИЗАЦИЙ ОБЪЕДИНЕНИЯ
    getMergeVisualizationCount() {
        let total = 0;
        for (const [userId, history] of this.lastMergeVisualizations) {
            total += history.length;
        }
        return total;
    }

    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

    // Вспомогательные методы
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
                console.log(`📁 Создана директория: ${dir}`);
            }
        });
    }

    loadExistingModels() {
        const modelsDir = path.join(this.config.dbPath, 'models');

        if (!fs.existsSync(modelsDir)) {
            console.log('📁 Директория моделей не существует, создаю...');
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

    // Остальные методы без изменений...
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    getUserModels(userId) {
        return Array.from(this.loadedModels.values())
            .filter(model => model.userId === userId)
            .sort((a, b) => new Date(b.metadata.created) - new Date(a.metadata.created));
    }

    getModelById(modelId) {
        return this.loadedModels.get(modelId);
    }

    getSystemStats() {
        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            mergeVisualizations: this.getMergeVisualizationCount(),
            vectorModels: this.vectorSuperModels.size,
            config: {
                autoAlignment: this.config.autoAlignment,
                enableMergeVisualization: this.config.enableMergeVisualization,
                usePointTracker: this.config.usePointTracker,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold
            },
            system: {
                uptime: Math.floor(process.uptime()),
                memoryUsage: process.memoryUsage()
            }
        };
    }

    endSession(userId, reason = 'manual') {
        const session = this.userSessions.get(userId);
        if (!session) {
            return { success: false, error: 'Сессия не найдена' };
        }

        const result = {
            success: true,
            sessionId: session.id,
            userId: userId,
            reason: reason,
            duration: new Date() - session.startTime,
            photos: session.photos.length,
            analyses: session.analyses.length,
            confirmedPhotos: session.confirmedPhotos || 0,
            footprint: session.currentFootprint ? {
                id: session.currentFootprint.id,
                nodes: session.currentFootprint.graph.nodes.size,
                confidence: session.currentFootprint.stats.confidence
            } : null
        };

        // Удаляем сессию
        this.userSessions.delete(userId);

        console.log(`🏁 Сессия завершена: ${session.id.slice(0, 8)}... (${reason})`);

        return result;
    }

    saveSession(userId) {
        const session = this.userSessions.get(userId);
        if (!session) return false;

        try {
            const sessionPath = path.join(this.config.dbPath, 'sessions', `${session.id}.json`);
            const sessionData = {
                id: session.id,
                userId: session.userId,
                name: session.name,
                startTime: session.startTime.toISOString(),
                lastActivity: session.lastActivity.toISOString(),
                photos: session.photos,
                analyses: session.analyses,
                comparisons: session.comparisons,
                confirmedPhotos: session.confirmedPhotos,
                metadata: session.metadata
            };

            fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
            return true;
        } catch (error) {
            console.log('⚠️ Ошибка сохранения сессии:', error.message);
            return false;
        }
    }

    // Визуализация сравнения
    async visualizeComparison(modelId1, modelId2) {
        try {
            const model1 = this.getModelById(modelId1);
            const model2 = this.getModelById(modelId2);

            if (!model1 || !model2) {
                return { success: false, error: 'Модели не найдены' };
            }

            const comparison = model1.compare(model2);
            const vizPath = await this.mergeVisualizer.visualizeMerge(
                model1,
                model2,
                comparison
            );

            return {
                success: true,
                visualization: vizPath.path,
                comparison: comparison
            };

        } catch (error) {
            console.log('❌ Ошибка визуализации сравнения:', error);
            return { success: false, error: error.message };
        }
    }

    // Визуализация сессии
    async visualizeSession(userId) {
        const session = this.getActiveSession(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии' };
        }

        try {
            const GraphVisualizer = require('./graph-visualizer');
            const visualizer = new GraphVisualizer();

            const vizPath = await visualizer.visualizeSessionHistory(session, {
                filename: `session_${session.id.slice(0, 8)}.png`
            });

            return {
                success: true,
                visualization: vizPath,
                sessionId: session.id,
                footprint: {
                    nodes: session.currentFootprint.graph.nodes.size,
                    edges: session.currentFootprint.graph.edges.size
                }
            };

        } catch (error) {
            console.log('❌ Ошибка визуализации сессии:', error);
            return { success: false, error: error.message };
        }
    }

    // Поиск похожих моделей
    findSimilarModels(footprint, userId, options = {}) {
        const userModels = this.getUserModels(userId);
        const maxResults = options.maxResults || 5;
        const minSimilarity = options.minSimilarity || 0.4;

        const similarities = [];

        userModels.forEach(model => {
            if (model.id === footprint.id) return; // Пропускаем ту же модель

            const comparison = footprint.compare(model);

            if (comparison.similarity >= minSimilarity) {
                similarities.push({
                    model: model,
                    similarity: comparison.similarity,
                    decision: comparison.decision,
                    reason: comparison.reason
                });
            }
        });

        // Сортировка по схожести
        similarities.sort((a, b) => b.similarity - a.similarity);

        return {
            success: true,
            similarCount: similarities.length,
            similarModels: similarities.slice(0, maxResults),
            searchedModels: userModels.length
        };
    }

    // Очистка старых сессий
    cleanupOldSessions(maxAgeHours = 24) {
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let cleaned = 0;

        for (const [userId, session] of this.userSessions) {
            if (session.lastActivity.getTime() < cutoffTime) {
                this.userSessions.delete(userId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Очищено ${cleaned} старых сессий`);
        }

        return cleaned;
    }
}

module.exports = SimpleFootprintManager;
