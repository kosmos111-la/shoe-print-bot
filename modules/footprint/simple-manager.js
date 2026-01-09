// modules/footprint/simple-manager.js
// 🔥 ИСПРАВЛЕНИЕ: Интеллектуальное сопоставление точек

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
            matchDistanceThreshold: options.matchDistanceThreshold || 60, // Увеличил до 60px
            minMatchPercentage: options.minMatchPercentage || 0.3,
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

        console.log(`🚀 SimpleFootprintManager инициализирован с интеллектуальным сопоставлением`);
        console.log(`   📁 База данных: ${this.config.dbPath}`);
        console.log(`   🎯 Auto Alignment: ${this.config.autoAlignment ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎨 Визуализация объединения: ${this.config.enableMergeVisualization ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎯 PointTracker: ВКЛ (интеллектуальное сопоставление)`);
        console.log(`   🏗️  VectorSuperModel: ВКЛ`);
        console.log(`   📐 TemplateVisualizer: ВКЛ`);
        console.log(`   🔄 Поворотная инвариантность: ВКЛ`);
        console.log(`   🤖 Интеллектуальное сопоставление: ВКЛ`);
    }

    // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Умное преобразование координат
    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_original') {
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

        // 🔥 ВАЖНО: Супер-модель уже нормализована к 0°
        // Для 'to_original' нужно повернуть НАЗАД на +angle
        // Для 'to_normalized' нужно повернуть ВПЕРЕД на -angle
       
        const angleRad = transformationInfo.rotationAngle * (Math.PI / 180);
       
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
               
                // Поворачиваем вперед: -angle
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
                angle: transformationInfo.rotationAngle
            };
        });

        console.log(`✅ Преобразовано ${transformedPoints.length} точек (угол: ${transformationInfo.rotationAngle.toFixed(1)}°, направление: ${direction})`);
       
        // Отладка
        if (transformedPoints.length > 0 && this.config.debug) {
            console.log(`🔍 Пример преобразования (${direction}):`);
            console.log(`   Оригинал: (${transformedPoints[0].originalX.toFixed(1)}, ${transformedPoints[0].originalY.toFixed(1)})`);
            console.log(`   После: (${transformedPoints[0].x.toFixed(1)}, ${transformedPoints[0].y.toFixed(1)})`);
        }

        return transformedPoints;
    }

    // 🔥 НОВЫЙ МЕТОД: Интеллектуальное сопоставление точек между двумя следами
    intelligentPointMatching(tracker1, tracker2, transformationInfo = null) {
        console.log(`🤖 Интеллектуальное сопоставление точек...`);
       
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
       
        // 🔥 Шаг 1: Преобразуем оба следа в нормализованную систему для сравнения
        let normalizedPoints1 = points1;
        let normalizedPoints2 = points2;
       
        if (transformationInfo) {
            console.log(`📐 Преобразую оба следа в нормализованную систему...`);
            normalizedPoints1 = this.transformCoordinatesBetweenSystems(points1, transformationInfo, 'to_normalized');
            normalizedPoints2 = this.transformCoordinatesBetweenSystems(points2, transformationInfo, 'to_normalized');
        }
       
        // 🔥 Шаг 2: Находим центры масс для выравнивания
        const center1 = this.calculateCenter(normalizedPoints1);
        const center2 = this.calculateCenter(normalizedPoints2);
       
        console.log(`🎯 Центры масс:`);
        console.log(`   • След 1: (${center1.x.toFixed(1)}, ${center1.y.toFixed(1)})`);
        console.log(`   • След 2: (${center2.x.toFixed(1)}, ${center2.y.toFixed(1)})`);
       
        // 🔥 Шаг 3: Ищем совпадения с учетом выравнивания
        const matches = [];
        const usedPoints2 = new Set();
       
        // Сначала ищем точные совпадения (близкие точки)
        for (const point1 of normalizedPoints1) {
            let bestMatch = null;
            let minDistance = this.config.matchDistanceThreshold;
           
            for (const point2 of normalizedPoints2) {
                if (usedPoints2.has(point2.id)) continue;
               
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
                    point1: point1,
                    point2: bestMatch.point,
                    distance: bestMatch.distance,
                    type: 'exact'
                });
                usedPoints2.add(bestMatch.point.id);
            }
        }
       
        console.log(`📊 Найдено ${matches.length} точных совпадений`);
       
        // 🔥 Шаг 4: Если точных совпадений мало, пробуем кластерное сопоставление
        if (matches.length < Math.min(points1.length, points2.length) * this.config.minMatchPercentage) {
            console.log(`⚠️ Мало точных совпадений (${matches.length}), пробую кластерное сопоставление...`);
           
            // Разбиваем на кластеры
            const clusters1 = this.createClusters(normalizedPoints1, 30);
            const clusters2 = this.createClusters(normalizedPoints2, 30);
           
            console.log(`📊 Кластеры:`);
            console.log(`   • След 1: ${clusters1.length} кластеров`);
            console.log(`   • След 2: ${clusters2.length} кластеров`);
           
            // Сопоставляем кластеры
            for (const cluster1 of clusters1) {
                let bestCluster = null;
                let minClusterDistance = 50;
               
                for (const cluster2 of clusters2) {
                    const distance = this.calculateDistance(
                        cluster1.center,
                        cluster2.center
                    );
                   
                    if (distance < minClusterDistance) {
                        minClusterDistance = distance;
                        bestCluster = cluster2;
                    }
                }
               
                if (bestCluster) {
                    // Сопоставляем точки внутри кластеров
                    for (const point1 of cluster1.points) {
                        if (matches.find(m => m.point1.id === point1.id)) continue;
                       
                        let bestPoint = null;
                        let minPointDistance = 40;
                       
                        for (const point2 of bestCluster.points) {
                            if (usedPoints2.has(point2.id)) continue;
                           
                            const dx = point2.x - point1.x;
                            const dy = point2.y - point1.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                           
                            if (distance < minPointDistance) {
                                minPointDistance = distance;
                                bestPoint = point2;
                            }
                        }
                       
                        if (bestPoint) {
                            matches.push({
                                point1: point1,
                                point2: bestPoint,
                                distance: minPointDistance,
                                type: 'cluster'
                            });
                            usedPoints2.add(bestPoint.id);
                        }
                    }
                }
            }
        }
       
        console.log(`📊 Итого совпадений: ${matches.length} из ${points1.length}`);
        console.log(`📈 Процент совпадений: ${(matches.length / points1.length * 100).toFixed(1)}%`);
       
        // 🔥 Шаг 5: Возвращаем результат с оригинальными координатами
        const result = matches.map(match => {
            // Находим оригинальные точки по ID
            const originalPoint1 = points1.find(p => p.id === match.point1.id);
            const originalPoint2 = points2.find(p => p.id === match.point2.id);
           
            return {
                point1: originalPoint1,
                point2: originalPoint2,
                distance: match.distance,
                type: match.type,
                shouldBeRed: true
            };
        });
       
        return {
            matches: result,
            totalPoints1: points1.length,
            totalPoints2: points2.length,
            matchCount: matches.length,
            matchPercentage: (matches.length / Math.min(points1.length, points2.length)) * 100,
            transformationApplied: !!transformationInfo
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ИНТЕЛЛЕКТУАЛЬНОГО СОПОСТАВЛЕНИЯ
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

    createClusters(points, maxDistance) {
        const clusters = [];
        const visited = new Set();
       
        for (const point of points) {
            if (visited.has(point.id)) continue;
           
            const cluster = {
                points: [point],
                center: { x: point.x, y: point.y }
            };
           
            visited.add(point.id);
           
            // Ищем соседние точки
            let changed;
            do {
                changed = false;
                for (const otherPoint of points) {
                    if (visited.has(otherPoint.id)) continue;
                   
                    const distance = this.calculateDistance(
                        { x: otherPoint.x, y: otherPoint.y },
                        cluster.center
                    );
                   
                    if (distance < maxDistance) {
                        cluster.points.push(otherPoint);
                        visited.add(otherPoint.id);
                       
                        // Обновляем центр кластера
                        cluster.center.x = cluster.points.reduce((sum, p) => sum + p.x, 0) / cluster.points.length;
                        cluster.center.y = cluster.points.reduce((sum, p) => sum + p.y, 0) / cluster.points.length;
                       
                        changed = true;
                    }
                }
            } while (changed);
           
            clusters.push(cluster);
        }
       
        return clusters;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Обновить PointTracker на основе интеллектуального сопоставления
    updatePointTrackerFromSuperModel(userId, footprint, vectorModel, transformationInfo = null) {
        console.log(`🔄 Обновляю PointTracker с интеллектуальным сопоставлением...`);

        if (!footprint || !footprint.pointTracker || !vectorModel || !vectorModel.templateBuilder) {
            console.log('⚠️ Недостаточно данных для обновления');
            return 0;
        }

        const tracker = footprint.pointTracker;
        const templateBuilder = vectorModel.templateBuilder;
       
        // Получаем данные шаблона
        const templateInfo = templateBuilder.getVisualizationData();
        if (!templateInfo || !templateInfo.cells) {
            console.log('⚠️ Нет данных шаблона');
            return 0;
        }

        console.log(`📊 Данные для сопоставления:`);
        console.log(`   • PointTracker: ${tracker.points.size} точек`);
        console.log(`   • Шаблон: ${templateInfo.cells.length} ячеек`);

        // 🔥 ИСПОЛЬЗУЕМ ИНТЕЛЛЕКТУАЛЬНОЕ СОПОСТАВЛЕНИЕ
        const pointAnalysis = this.intelligentPointMatching(
            tracker,
            this.createTrackerFromTemplate(templateInfo.cells),
            transformationInfo
        );

        console.log(`📊 Результат сопоставления:`);
        console.log(`   • Совпадений: ${pointAnalysis.matchCount}`);
        console.log(`   • Процент: ${pointAnalysis.matchPercentage.toFixed(1)}%`);

        // Обновляем подтверждения на основе совпадений
        let updatedCount = 0;
       
        for (const match of pointAnalysis.matches) {
            const point = tracker.points.get(match.point1.id);
            if (point) {
                const oldCount = point.confirmedCount || 0;
                const newCount = Math.min(5, oldCount + 1); // +1 подтверждение за совпадение
               
                if (newCount > oldCount) {
                    point.confirmedCount = newCount;
                   
                    // Обновляем рейтинг
                    point.rating = Math.min(1.0, 0.5 + (point.confirmedCount * 0.1));
                   
                    // Добавляем в историю
                    if (!point.history) point.history = [];
                    point.history.push({
                        timestamp: new Date(),
                        source: 'intelligent_matching',
                        confidence: point.rating,
                        action: 'confirmed_from_match',
                        matchDistance: match.distance,
                        matchType: match.type
                    });
                   
                    updatedCount++;
                   
                    if (newCount >= 2) {
                        console.log(`   🔴 Точка ${match.point1.id.slice(0, 8)}: ${oldCount} → ${newCount} подтверждений (расстояние: ${match.distance.toFixed(1)}px)`);
                    }
                }
            }
        }

        console.log(`✅ Обновлено ${updatedCount} точек из ${pointAnalysis.matchCount} совпадений`);
        return updatedCount;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Создать временный трекер из шаблона
    createTrackerFromTemplate(templateCells) {
        const PointTracker = require('./point-tracker');
        const tracker = new PointTracker();
       
        for (const cell of templateCells) {
            tracker.addPoint({
                x: cell.x,
                y: cell.y,
                id: cell.id,
                confirmedCount: cell.confirmations || 0,
                confidence: cell.confidence || 0.7
            });
        }
       
        return tracker;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Создание кластерной визуализации с интеллектуальным сопоставлением
    async createClusterComparisonVisualization(footprint1, footprint2, comparisonResult, userId, transformationInfo = null) {
        console.log('🎨 Создаю визуализацию с интеллектуальным сопоставлением...');

        try {
            // 🔥 ИСПОЛЬЗУЕМ ИНТЕЛЛЕКТУАЛЬНОЕ СОПОСТАВЛЕНИЕ
            const pointAnalysis = this.intelligentPointMatching(
                footprint1.pointTracker,
                footprint2.pointTracker,
                transformationInfo
            );

            console.log(`🎯 РЕЗУЛЬТАТ СОПОСТАВЛЕНИЯ:`);
            console.log(`   • След 1: ${pointAnalysis.totalPoints1} точек`);
            console.log(`   • След 2: ${pointAnalysis.totalPoints2} точек`);
            console.log(`   • Совпадений: ${pointAnalysis.matchCount}`);
            console.log(`   • Процент: ${pointAnalysis.matchPercentage.toFixed(1)}%`);

            // 🔥 ОБНОВЛЯЕМ ТОЧКИ НА ОСНОВЕ РЕАЛЬНЫХ СОВПАДЕНИЙ
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

            // 🔥 ПЕРЕДАЕМ ДАННЫЕ О СОПОСТАВЛЕНИИ
            const vizResult = await visualizer.visualizeTwoFootprintComparison(
                footprint1,
                footprint2,
                {
                    filename: `cluster_comparison_${userId}_${Date.now()}.png`,
                    mode: 'intelligent',
                    customData: {
                        comparison: comparisonResult,
                        transformationInfo: transformationInfo,
                        pointAnalysis: pointAnalysis,
                        stats: { stats1, stats2 }
                    }
                }
            );

            console.log('✅ Визуализация создана с интеллектуальным сопоставлением:', vizResult?.path);
            return vizResult;

        } catch (error) {
            console.log('❌ Ошибка создания визуализации:', error.message);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Обновить трекеры на основе совпадений
    updateTrackersBasedOnMatches(footprint1, footprint2, pointAnalysis) {
        let updated1 = 0;
        let updated2 = 0;

        console.log(`🎯 Обновляю трекеры на основе ${pointAnalysis.matchCount} совпадений...`);

        // Обновляем трекер 1
        for (const match of pointAnalysis.matches) {
            const point1 = footprint1.pointTracker.points.get(match.point1.id);
            if (point1) {
                const oldCount = point1.confirmedCount || 0;
                const newCount = Math.min(5, oldCount + 1);
               
                if (newCount > oldCount) {
                    point1.confirmedCount = newCount;
                    updated1++;
                   
                    if (newCount >= 2 && oldCount < 2) {
                        console.log(`   🔴 Точка 1/${match.point1.id.slice(0, 8)}: ${oldCount} → ${newCount} подтверждений`);
                    }
                }
            }
           
            // Также обновляем трекер 2
            const point2 = footprint2.pointTracker.points.get(match.point2.id);
            if (point2) {
                const oldCount = point2.confirmedCount || 0;
                const newCount = Math.min(5, oldCount + 1);
               
                if (newCount > oldCount) {
                    point2.confirmedCount = newCount;
                    updated2++;
                }
            }
        }

        // 🔥 ВАЖНО: Точки, которые НЕ совпали, остаются с 1 подтверждением (синие)
        // Точки, которые совпали, становятся с 2+ подтверждениями (красные)
       
        console.log(`✅ Обновлено: ${updated1} точек в следе 1, ${updated2} в следе 2`);
       
        // Статистика по цветам
        const stats1 = this.calculateConfirmationStats(footprint1);
        const stats2 = this.calculateConfirmationStats(footprint2);
       
        console.log(`📊 ИТОГО:`);
        console.log(`   • 🔴 Красные (2+): ${stats1.confirmed2} в следе 1, ${stats2.confirmed2} в следе 2`);
        console.log(`   • 🔵 Синие (1): ${stats1.confirmed1} в следе 1, ${stats2.confirmed1} в следе 2`);
        console.log(`   • ⚪ Серые (0): ${stats1.confirmed0} в следе 1, ${stats2.confirmed0} в следе 2`);
    }

    // 🔥 МЕТОД: Рассчитать статистику подтверждений
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

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД addPhotoToSession
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО С ИНТЕЛЛЕКТУАЛЬНЫМ СОПОСТАВЛЕНИЕМ`);

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

            // Сохраняем информацию о трансформации
            const transformationInfo = {
                rotationAngle: normalized.rotationAngle,
                isMirrored: normalized.isMirrored,
                corrected: corrected.correctionApplied,
                scale: 1.0,
                timestamp: new Date(),
                footType: normalized.footType
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

            // Если нет текущего отпечатка - создаем
            if (!session.currentFootprint) {
                console.log(`👣 Создаю новый отпечаток (первое фото)`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
                });

                session.currentFootprint.metadata.normalizationInfo = transformationInfo;

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

            // Сравниваем
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

                // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ С ИНТЕЛЛЕКТУАЛЬНЫМ СОПОСТАВЛЕНИЕМ
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
                            transformationInfo: transformationInfo
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
                        transformationInfo: transformationInfo
                    }
                );

                // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ С ИНТЕЛЛЕКТУАЛЬНЫМ СОПОСТАВЛЕНИЕМ
                this.updatePointTrackerFromSuperModel(
                    userId,
                    session.currentFootprint,
                    vectorModel,
                    transformationInfo
                );

                // Визуализация и отправка в Telegram
                if (this.config.enableMergeVisualization && vectorModel) {
                    vectorVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);

                    if (bot && chatId && vectorVizPath && vectorVizPath.template) {
                        try {
                            if (fs.existsSync(vectorVizPath.template)) {
                                await bot.sendPhoto(chatId, vectorVizPath.template, {
                                    caption: `✅ **Следы совпали!**\n\n` +
                                            `🎯 Схожесть: ${(finalSimilarity * 100).toFixed(1)}%\n` +
                                            `📊 Интеллектуальное сопоставление точек`
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
                            caption += `📊 Схожесть: ${(finalSimilarity * 100).toFixed(1)}%\n\n`;
                            caption += `📈 **ПОДТВЕРЖДЕНИЯ:**\n`;
                            caption += `• 🔴 Красные (2+): ${stats1.confirmed2} в следе 1, ${stats2.confirmed2} в следе 2\n`;
                            caption += `• 🔵 Синие (1): ${stats1.confirmed1} в следе 1, ${stats2.confirmed1} в следе 2\n\n`;
                            caption += `🎨 **ИНТЕЛЛЕКТУАЛЬНОЕ СОПОСТАВЛЕНИЕ:**\n`;
                            caption += `• Точки в обоих фото → 🔴 красные\n`;
                            caption += `• Точки только в одном → 🔵 синие`;

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
                    mergeMethod: 'intelligent_matching',
                    message: `✅ След добавлен! Сходство: ${(finalSimilarity * 100).toFixed(1)}%`,
                    transformationInfo: transformationInfo
                };

                console.log(`📊 Результат addPhotoToSession: схожесть=${finalSimilarity.toFixed(3)}, решение=${finalDecision}, точек добавлено=${tempResult.added}`);

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

                session.currentFootprint.metadata.normalizationInfo = transformationInfo;

                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: transformationInfo
                });

                return {
                    success: true,
                    similarity: finalSimilarity,
                    decision: finalDecision,
                    isNewModel: true,
                    nodesAdded: addResult.added,
                    transformationInfo: transformationInfo
                };
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 МЕТОД: Извлечение similarity из объекта
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

    // 🔥 МЕТОД: Визуализация векторной супер-модели
    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) {
                console.log('⚠️ Нет векторной модели');
                return null;
            }

            let templateData = vectorModel.getVisualizationData();

            if (!templateData || !templateData.cells || templateData.cells.length === 0) {
                console.log('⚠️ ШАБЛОН ПУСТ! Получаем сырые данные...');
                if (vectorModel.templateBuilder) {
                    templateData = vectorModel.templateBuilder.getVisualizationData();
                    console.log(`📊 Прямые данные шаблона: ${templateData?.cells?.length || 0} ячеек`);
                }
            }

            console.log(`📊 Данные шаблона: ${templateData?.cells?.length || 0} ячеек`);

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

            console.log(`✅ Шаблон визуализирован: ${result.path}`);
            console.log(`🔥 Тепловая карта: ${heatmapPath}`);

            return {
                template: result.path,
                heatmap: heatmapPath,
                stats: templateData?.stats,
                templateId: templateData?.templateId
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            console.error(error.stack);
            return null;
        }
    }

    // 🔥 МЕТОД: Извлечение точек из анализа
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

    // 🔥 МЕТОД: Создание сессии
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

    // 🔥 МЕТОД: Обеспечение существования директорий
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

    // 🔥 МЕТОД: Загрузка существующих моделей
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

    // 🔥 МЕТОД: Получение активной сессии
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    // 🔥 МЕТОД: Получение векторной супер-модели
    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    // 🔥 МЕТОД: Получение статистики системы
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

    // 🔥 МЕТОД: Получение количества визуализаций объединения
    getMergeVisualizationCount() {
        let total = 0;
        for (const [userId, history] of this.lastMergeVisualizations) {
            total += history.length;
        }
        return total;
    }

    // 🔥 МЕТОД: Добавление визуализации объединения в историю
    addMergeVisualization(userId, vizInfo) {
        const history = this.lastMergeVisualizations.get(userId) || [];
        history.unshift(vizInfo);

        if (history.length > 10) {
            history.pop();
        }

        this.lastMergeVisualizations.set(userId, history);
        return history.length;
    }

    // 🔥 МЕТОД: Получение последней визуализации объединения
    getLastMergeVisualization(userId) {
        const history = this.lastMergeVisualizations.get(userId);
        return history && history.length > 0 ? history[0] : null;
    }

    // 🔥 МЕТОД: Сохранение сессии как модели
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

    // 🔥 МЕТОД: Удаление векторной супер-модели
    clearVectorSuperModel(userId) {
        console.log(`🗑️ Очищаю векторную супер-модель для пользователя ${userId}...`);

        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            console.log(`⚠️ У пользователя ${userId} нет супер-модели`);
            return { success: false, reason: 'Нет супер-модели' };
        }

        const oldStats = vectorModel.getInfo();

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

    // 🔥 МЕТОД: Очистка всех данных сессии
    clearUserSessionData(userId) {
        console.log(`🧹 Полная очистка данных для пользователя ${userId}...`);

        const results = {
            vectorModel: false,
            session: false,
            currentFootprint: false
        };

        const vectorModel = this.vectorSuperModels.get(userId);
        if (vectorModel) {
            this.vectorSuperModels.delete(userId);
            results.vectorModel = true;
            console.log(`✅ Удалена векторная супер-модель`);
        }

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

    // 🔥 МЕТОД: Получение информации о супер-модели
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

    // 🔥 МЕТОД: Получение моделей пользователя
    getUserModels(userId) {
        return Array.from(this.loadedModels.values())
            .filter(model => model.userId === userId)
            .sort((a, b) => new Date(b.metadata.created) - new Date(a.metadata.created));
    }

    // 🔥 МЕТОД: Получение модели по ID
    getModelById(modelId) {
        return this.loadedModels.get(modelId);
    }

    // 🔥 МЕТОД: Завершение сессии
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

        this.userSessions.delete(userId);

        console.log(`🏁 Сессия завершена: ${session.id.slice(0, 8)}... (${reason})`);

        return result;
    }

    // 🔥 МЕТОД: Сохранение сессии
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

    // 🔥 МЕТОД: Визуализация сравнения
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

    // 🔥 МЕТОД: Визуализация сессии
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

    // 🔥 МЕТОД: Поиск похожих моделей
    findSimilarModels(footprint, userId, options = {}) {
        const userModels = this.getUserModels(userId);
        const maxResults = options.maxResults || 5;
        const minSimilarity = options.minSimilarity || 0.4;

        const similarities = [];

        userModels.forEach(model => {
            if (model.id === footprint.id) return;

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

        similarities.sort((a, b) => b.similarity - a.similarity);

        return {
            success: true,
            similarCount: similarities.length,
            similarModels: similarities.slice(0, maxResults),
            searchedModels: userModels.length
        };
    }

    // 🔥 МЕТОД: Очистка старых сессий
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
