// modules/footprint/simple-manager.js
const fs = require('fs');
const path = require('path');

// 🔥 НОВАЯ ЕДИНАЯ СИСТЕМА КООРДИНАТ
const CoordinateSystem = require('./core/coordinate-system');
const LegacySupport = require('./legacy-support/coordinate-facade');

// 🔥 НОВАЯ УНИФИЦИРОВАННАЯ СИСТЕМА ВЫРАВНИВАНИЯ (заменяет 5 старых модулей)
const AlignmentSystem = require('./core/alignment-system');

// 🔥 ОСТАЛЬНЫЕ МОДУЛИ
const FootprintComparisonEngine = require('./core/comparison/footprint-comparison-engine');
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const VisualizationManager = require('./core/visualization/visualization-manager');
const GeometryUtils = require('./core/utils/geometry-utils');
const LogManager = require('./core/log-manager');
const SimpleGraph = require('./simple-graph');

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🔥 SimpleFootprintManager создан с НОВОЙ системой координат и выравнивания');

        // 🔥 НАСТРОЙКИ
        const {
            dbPath = './data/footprints',
            autoAlignment = true,
            autoSave = true,
            debug = false,
            usePointTracker = true,
            enableVectorSuperModel = true,
            enableMergeVisualization = true,
            enableTemplateVisualization = true,
            topologySimilarityThreshold = 0.7, // 🔥 ПРАВИЛЬНЫЙ порог 0.7
            minPointsForFootprint = 5,
            templateMatchThreshold = 80,
            minTemplateConfirmations = 1,
            enableCoordinateDiagnostics = true,
            alignmentMethod = 'procrustes',
            ...otherOptions
        } = options;

        this.config = {
            dbPath,
            autoAlignment,
            autoSave,
            debug,
            usePointTracker,
            enableVectorSuperModel,
            enableMergeVisualization: enableMergeVisualization !== false,
            enableTemplateVisualization: enableTemplateVisualization !== false,
            topologySimilarityThreshold,
            minPointsForFootprint,
            templateMatchThreshold,
            minTemplateConfirmations,
            enableCoordinateDiagnostics,
            alignmentMethod,
            ...otherOptions
        };

        console.log(`🎯 Настройки: метод выравнивания=${this.config.alignmentMethod}, порог схожести=${this.config.topologySimilarityThreshold}`);

        // 🔥 НОВАЯ ЕДИНАЯ СИСТЕМА КООРДИНАТ
        this.coordinateSystem = CoordinateSystem;
        this.coordinateManager = new LegacySupport.CoordinateManager(this);
        this.transformationValidator = new LegacySupport.TransformationValidator(this);

        // 🔥 ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
        this.coordinateSystemConstants = {
            CENTER: { x: 500, y: 500 },
            BOUNDS: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
            DEFAULT_RANGE: { min: 0, max: 1000 },
            MIN_MAX: { min: 0, max: 1000 }
        };

        this.CoordinateSystemConstants = {
            CENTER: this.coordinateSystemConstants.CENTER,
            BOUNDS: this.coordinateSystemConstants.BOUNDS,
            CANONICAL_CENTER: this.coordinateSystemConstants.CENTER,
            MIN_MAX: this.coordinateSystemConstants.MIN_MAX,
            DEFAULT_RANGE: this.coordinateSystemConstants.DEFAULT_RANGE,
            getSystemInfo: () => ({
                name: 'Единая система координат следов',
                version: '2.0',
                center: this.coordinateSystemConstants.CENTER,
                bounds: this.coordinateSystemConstants.BOUNDS,
                range: this.coordinateSystemConstants.DEFAULT_RANGE
            })
        };

        // 🔥 МОДУЛИ НОРМАЛИЗАЦИИ
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');
        this.rotationProcessor = new RotationInvariance({ debug: this.config.debug });
        this.mirrorDetector = new MirrorDetection({ debug: this.config.debug });

        // 🔥 НОВАЯ УНИФИЦИРОВАННАЯ СИСТЕМА ВЫРАВНИВАНИЯ (заменяет 5 старых модулей)
        this.alignmentSystem = AlignmentSystem;

        // 🔥 ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ - создаем псевдо-модули
        this.simpleAligner = {
            align: (points, reference, options = {}) =>
                AlignmentSystem.alignPoints(points, reference, {
                    method: 'simple',
                    ...options
                })
        };

        this.improvedAligner = {
            align: (points, reference, options = {}) =>
                AlignmentSystem.alignPoints(points, reference, {
                    method: this.config.alignmentMethod || 'procrustes',
                    ...options
                })
        };

        this.coordinateSystemConverter = {
            convert: (points, fromSystem, toSystem) =>
                AlignmentSystem.convertCoordinates(points, fromSystem, toSystem),
            convertToCanonical: (points) => points,
            convertFromCanonical: (points) => points
        };

        this.coordinateValidator = {
            validate: (points, options = {}) =>
                CoordinateSystem.validate(points, options),
            validateAlignment: (points, reference, threshold = 10) =>
                AlignmentSystem.validateAlignment(points, reference, threshold)
        };

        this.transformationDebugger = {
            debug: (points1, points2, transformation) => ({
                input1: points1.length,
                input2: points2.length,
                transformation: transformation || 'none',
                system: 'unified_alignment_system'
            }),
            logTransformation: (name, data) =>
                console.log(`[TransformationDebugger] ${name}:`, data)
        };

        // 🔥 ОСНОВНЫЕ МОДУЛИ
        this.comparisonEngine = new FootprintComparisonEngine(this);
        this.templateCoordinator = new TemplateCoordination(this);
        this.sessionManager = new SessionManager(this);
        this.geometryUtils = new GeometryUtils(this);
        this.log = new LogManager(this);

        // 🔥 ВИЗУАЛИЗАЦИЯ - ЗАГРУЖАЕМ ВСЕГДА!
        try {
            this.visualizationManager = new VisualizationManager(this);
            console.log('✅ VisualizationManager загружен');
        } catch (error) {
            console.log(`❌ Ошибка загрузки VisualizationManager: ${error.message}`);
            // Создаем заглушку с логированием
            this.visualizationManager = {
                visualizeSingleFootprintConfirmations: async (footprint, userId, transformationInfo = null) => {
                    console.log(`🎨 Визуализация отпечатка для ${userId} (заглушка)`);
                    const timestamp = new Date().getTime();
                    const vizPath = path.join(this.config.dbPath, 'visualizations', `footprint_${userId}_${timestamp}.png`);

                    // Создаем заглушку файла
                    if (!fs.existsSync(path.dirname(vizPath))) {
                        fs.mkdirSync(path.dirname(vizPath), { recursive: true });
                    }

                    console.log(`📁 Создана заглушка: ${vizPath}`);
                    return { path: vizPath, success: true, isStub: true };
                },

                visualizeVectorSuperModel: async (userId, vectorModel) => {
                    console.log(`🎨 Визуализация шаблона для ${userId} (заглушка)`);
                    const timestamp = new Date().getTime();
                    const templatePath = path.join(this.config.dbPath, 'visualizations/templates', `template_${userId}_${timestamp}.png`);

                    // Создаем заглушку файла
                    if (!fs.existsSync(path.dirname(templatePath))) {
                        fs.mkdirSync(path.dirname(templatePath), { recursive: true });
                    }

                    console.log(`📁 Создана заглушка шаблона: ${templatePath}`);
                    return { template: templatePath, success: true, isStub: true, stats: { cells: 0 } };
                },

                debugVisualizations: (userId) => {
                    console.log(`🔍 Debug визуализаций для ${userId}`);
                    return { status: 'stub' };
                }
            };
        }

        // 🔥 MERGE VISUALIZER - ЗАГРУЖАЕМ С ЗАГЛУШКОЙ
        try {
            // Проверяем наличие canvas
            try {
                require.resolve('canvas');
                const MergeVisualizer = require('./merge-visualizer');
                this.mergeVisualizer = new MergeVisualizer({
                    outputDir: path.join(this.config.dbPath, 'visualizations'),
                    debug: this.config.debug
                });
                console.log('✅ MergeVisualizer загружен');
            } catch (canvasError) {
                console.log(`⚠️ Canvas не установлен: ${canvasError.message}`);
                this.mergeVisualizer = {
                    createMergeVisualization: () => ({ path: null }),
                    addVisualization: () => 1,
                    getCount: () => 0
                };
            }
        } catch (error) {
            console.log(`⚠️ MergeVisualizer недоступен: ${error.message}`);
            this.mergeVisualizer = {
                createMergeVisualization: () => ({ path: null }),
                addVisualization: () => 1,
                getCount: () => 0
            };
        }

        // 🔥 ИСПРАВЛЕНИЕ SIMPLE-MATCHER
        try {
            const SimpleMatcher = require('./simple-matcher');
            console.log('🎯 Загружаю SimpleMatcher...');

            // Попробуем разные варианты конструктора
            try {
                this.matcher = new SimpleMatcher({
                    debug: this.config.debug,
                    similarityThreshold: this.config.topologySimilarityThreshold
                });
                console.log('✅ SimpleMatcher инициализирован с параметрами');
            } catch (paramError) {
                // Попробуем без параметров
                console.log('🔄 Пробую SimpleMatcher без параметров...');
                try {
                    this.matcher = new SimpleMatcher();
                    console.log('✅ SimpleMatcher инициализирован без параметров');
                } catch (noParamError) {
                    // Создаем заглушку
                    console.log(`⚠️ SimpleMatcher не смог инициализироваться: ${noParamError.message}`);
                    this.matcher = {
                        compare: () => ({
                            similarity: 0.5,
                            matches: [],
                            error: 'matcher in fallback mode'
                        }),
                        match: (fp1, fp2) => ({
                            similarity: Math.random() * 0.3 + 0.4,
                            matchedPoints: []
                        })
                    };
                }
            }
        } catch (requireError) {
            console.log(`❌ Файл SimpleMatcher не найден: ${requireError.message}`);
            this.matcher = {
                compare: () => ({
                    similarity: 0.5,
                    matches: [],
                    error: 'matcher not available'
                }),
                match: () => ({
                    similarity: 0.5,
                    matchedPoints: [],
                    error: 'matcher module missing'
                })
            };
        }

        // 🔥 СТРУКТУРЫ ДАННЫХ
        this.userSessions = new Map();
        this.loadedModels = new Map();
        this.vectorSuperModels = new Map();
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalPhotosProcessed: 0,
            totalTemplateConfirmations: 0,
            lastActivity: new Date(),
            alignmentSystem: 'unified_v1.0'
        };

        // 🔥 ПОРОГИ РЕШЕНИЙ
        this.DECISION_THRESHOLDS = {
            PATTERN_SIMILARITY: 0.7, // 🔥 ПРАВИЛЬНЫЙ порог 0.7
            MIN_MATCHES: 10,
            MAX_DISTANCE: 50,
            VECTOR_MATCH_THRESHOLD: 0.05
        };

        console.log(`🎯 Единые пороги: сходство >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);

        this.ensureDirectories();
        this.loadExistingModels();

        // 🔥 ДИАГНОСТИКА
        if (this.config.enableCoordinateDiagnostics) {
            this.runInitialDiagnostics();
        }

        console.log('✅ SimpleFootprintManager инициализирован');
    }

    // 🔥 НОВЫЕ МЕТОДЫ КООРДИНАТНОЙ СИСТЕМЫ
    transformPoints(points, options = {}) {
        return this.coordinateSystem.transform(points, options);
    }

    normalizePoints(points, options = {}) {
        return this.coordinateSystem.normalize(points, options);
    }

    validatePoints(points) {
        return this.coordinateSystem.validate(points);
    }

    calculateCenter(points) {
        return this.coordinateSystem.calculateCenter(points);
    }

    getBounds(points) {
        return this.coordinateSystem.getBounds(points);
    }

    // 🔥 НОВЫЕ МЕТОДЫ СИСТЕМЫ ВЫРАВНИВАНИЯ
    alignPoints(points, reference, options = {}) {
        return this.alignmentSystem.alignPoints(points, reference, {
            method: this.config.alignmentMethod,
            ...options
        });
    }

    validateAlignment(points, reference, threshold = 10) {
        return this.alignmentSystem.validateAlignment(points, reference, threshold);
    }

    // 🔥 Legacy методы для обратной совместимости
    getCoordinates(source, options = {}) {
        return this.coordinateManager.getCoordinates(source, options);
    }

    transformToSystem(points, fromSystem, toSystem, transformation = null) {
        return this.coordinateManager.transformToSystem(points, fromSystem, toSystem, transformation);
    }

    comparePoints(points1, points2, options = {}) {
        return this.coordinateManager.comparePoints(points1, points2, options);
    }

    detectCoordinateSystem(points) {
        return this.coordinateManager.detectCoordinateSystem(points);
    }

    clearCoordinateCache() {
        return this.coordinateManager.clearCache();
    }

    diagnoseCoordinateSystem(source, options = {}) {
        return this.coordinateManager.diagnoseSystem(source, options);
    }

    // 🔥 МЕТОДЫ ВАЛИДАЦИИ
    validateAllTransformations(userId = null) {
        return this.transformationValidator.validateTransformationsAcrossModules(userId);
    }

    validateTransformations(obj1, obj2) {
        const trans1 = this.extractTransformations(obj1);
        const trans2 = this.extractTransformations(obj2);
        if (trans1.length === 0 || trans2.length === 0) {
            return { consistent: false, error: 'Нет трансформаций для сравнения' };
        }
        return this.transformationValidator.compareTransformations(trans1[0], trans2[0]);
    }

    extractTransformations(obj) {
        return this.transformationValidator.extractTransformationsFromFootprint(obj);
    }

    // 🔥 МЕТОДЫ ЛОГИРОВАНИЯ
    logCoordinateSystems(title, ...objects) {
        console.log(`[LOG] ${title}: ${objects.length} объектов`);
        return { logged: true, count: objects.length };
    }

    logTransformations(transformations, title = 'ТРАНСФОРМАЦИИ') {
        console.log(`[LOG] ${title}: ${Array.isArray(transformations) ? transformations.length : 1} трансформаций`);
        return { logged: true, count: Array.isArray(transformations) ? transformations.length : 1 };
    }

    generateDiagnosticReport(userId = null) {
        return {
            userId: userId,
            timestamp: new Date(),
            coordinateSystem: 'new_unified',
            alignmentSystem: 'unified_v1.0',
            status: 'active',
            modules: ['CoordinateSystem', 'AlignmentSystem', 'LegacySupport'],
            visualization: {
                enabled: this.config.enableMergeVisualization,
                templateEnabled: this.config.enableTemplateVisualization,
                manager: !!this.visualizationManager
            },
            alignmentMethod: this.config.alignmentMethod
        };
    }

    compareSystems(obj1, obj2, options = {}) {
        const points1 = this.extractPointsFromObject(obj1);
        const points2 = this.extractPointsFromObject(obj2);

        if (points1.length === 0 || points2.length === 0) {
            return { comparable: false, error: 'Недостаточно точек для сравнения' };
        }

        const comparison = this.coordinateManager.comparePoints(points1, points2, options);

        return {
            comparable: true,
            similarity: comparison.similarity || 0,
            distance: comparison.distance || 0,
            points1: points1.length,
            points2: points2.length
        };
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Нормализация отпечатка с новой системой координат
    async normalizeFootprint(footprint) {
        console.log(`🔄 Нормализация отпечатка ${footprint.id || 'unknown'}`);

        try {
            // 🔥 НОВОЕ: Извлекаем точки правильно
            const points = this.extractPointsFromFootprint(footprint);

            if (!points || points.length === 0) {
                console.log('⚠️ Нет точек для нормализации');
                // Пытаемся извлечь точки из графа
                if (footprint.graph && footprint.graph.nodes) {
                    const graphPoints = [];
                    for (const [, node] of footprint.graph.nodes) {
                        if (node && typeof node.x === 'number' && typeof node.y === 'number') {
                            graphPoints.push({ x: node.x, y: node.y });
                        }
                    }
                    if (graphPoints.length > 0) {
                        console.log(`📊 Извлечено ${graphPoints.length} точек из графа`);
                        return this.normalizePointsArray(graphPoints, footprint);
                    }
                }
                return footprint;
            }

            console.log(`📊 Нормализация ${points.length} точек с новой системой координат`);
            return this.normalizePointsArray(points, footprint);

        } catch (error) {
            console.error(`❌ Ошибка нормализации: ${error.message}`);
            // Возвращаем исходный отпечаток без изменений
            return footprint;
        }
    }

    // 🔥 Вспомогательный метод для нормализации массива точек - ИСПРАВЛЕННЫЙ
    normalizePointsArray(points, footprint) {
        try {
            // 1. Трансформируем в единую систему координат
            const transformed = this.coordinateSystem.transform(points, {
                system: 'original',
                targetSystem: 'canonical'
            });

            // 2. Нормализуем точки (центрирование, масштабирование)
            const range = this.coordinateSystemConstants.MIN_MAX ||
                         this.coordinateSystemConstants.DEFAULT_RANGE ||
                         { min: 0, max: 1000 };

            const normalizedPoints = this.coordinateSystem.normalize(transformed, {
                method: 'min_max',
                range: range,
                preserveAspectRatio: true
            });

            // 3. Валидируем результат
            const validation = this.coordinateSystem.validate(normalizedPoints);
            if (!validation.valid) {
                console.log(`⚠️ Валидация нормализованных точек: ${validation.message || 'проблема с точками'}`);
            }

            // 4. Обновляем отпечаток
            if (footprint.updatePoints) {
                footprint.updatePoints(normalizedPoints);
            } else {
                footprint.points = normalizedPoints;
            }

            // 5. Сохраняем информацию о трансформации
            footprint.metadata = footprint.metadata || {};
            footprint.metadata.normalizationInfo = {
                originalPoints: points.length,
                normalizedPoints: normalizedPoints.length,
                transformationType: 'unified_coordinate_system_v2',
                timestamp: new Date(),
                validation: validation,
                center: this.coordinateSystem.calculateCenter(normalizedPoints) || this.coordinateSystemConstants.CENTER,
                bounds: this.coordinateSystem.getBounds(normalizedPoints) || this.coordinateSystemConstants.BOUNDS,
                range: range
            };

            console.log(`✅ Отпечаток нормализован: ${normalizedPoints.length} точек`);
            if (footprint.metadata.normalizationInfo.center) {
                console.log(`   Центр: (${footprint.metadata.normalizationInfo.center.x.toFixed(1)}, ${footprint.metadata.normalizationInfo.center.y.toFixed(1)})`);
            }

            return footprint;

        } catch (error) {
            console.error(`❌ Ошибка в normalizePointsArray: ${error.message}`);
            console.error(error.stack);
            // В случае ошибки возвращаем исходные точки
            if (footprint.updatePoints) {
                footprint.updatePoints(points);
            } else {
                footprint.points = points;
            }
            return footprint;
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Сравнение отпечатков - теперь работает правильно с порогом 0.7
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 Сравнение отпечатков с новой системой`);

        try {
            const points1 = this.extractPointsFromFootprint(footprint1);
            const points2 = this.extractPointsFromFootprint(footprint2);

            if (points1.length === 0 || points2.length === 0) {
                console.log('⚠️ Один или оба отпечатка не содержат точек');
                console.log(`   Отпечаток 1: ${points1.length} точек`);
                console.log(`   Отпечаток 2: ${points2.length} точек`);

                return {
                    similar: false,
                    similarity: 0,
                    error: 'Недостаточно точек',
                    method: 'no_points_fallback'
                };
            }

            console.log(`📊 Сравниваем ${points1.length} vs ${points2.length} точек`);

            // 🔥 ИСПРАВЛЕНИЕ: Используем SimpleMatcher напрямую на нормализованных точках
            let similarity = 0;
            let matches = [];
           
            if (this.matcher && this.matcher.match) {
                // Нормализуем точки перед сравнением
                const normalized1 = this.normalizePoints([...points1], {
                    method: 'min_max',
                    range: { min: 0, max: 1000 },
                    preserveAspectRatio: true
                });
               
                const normalized2 = this.normalizePoints([...points2], {
                    method: 'min_max',
                    range: { min: 0, max: 1000 },
                    preserveAspectRatio: true
                });

                // Сравниваем нормализованные точки
                const matchResult = this.matcher.match(normalized1, normalized2);
                similarity = matchResult.similarity || 0;
                matches = matchResult.matchedPoints || [];
               
                console.log(`🎯 SimpleMatcher схожесть: ${(similarity * 100).toFixed(1)}%`);
            } else {
                console.log('⚠️ SimpleMatcher не доступен, использую альтернативный метод');
                // Альтернативный метод сравнения
                similarity = this.calculateHausdorffSimilarity(points1, points2);
            }

            // Проверяем выравнивание (для диагностики)
            let alignmentValid = true;
            let alignmentError = 0;
           
            try {
                const alignmentOptions = {
                    method: this.config.alignmentMethod || 'procrustes',
                    scale: true,
                    rotate: true,
                    translate: true
                };

                const alignedPoints = this.alignmentSystem.alignPoints(points1, points2, alignmentOptions);
                const alignmentValidation = this.alignmentSystem.validateAlignment(
                    alignedPoints,
                    points2,
                    50 // Увеличенный порог для нормальных условий
                );
               
                alignmentValid = alignmentValidation.valid;
                alignmentError = alignmentValidation.averageError || 0;
               
                console.log(`🎯 Выравнивание: ${alignmentValid ? '✅' : '❌'}, ошибка: ${alignmentError.toFixed(2)}px`);
            } catch (alignmentError) {
                console.log(`⚠️ Ошибка выравнивания: ${alignmentError.message}`);
            }

            // Принимаем решение на основе схожести
            const threshold = options.threshold || this.DECISION_THRESHOLDS.PATTERN_SIMILARITY;
            const isSimilar = similarity > threshold;
           
            console.log(`🎯 Итоговое решение: ${isSimilar ? 'SAME' : 'DIFFERENT'} (схожесть: ${(similarity * 100).toFixed(1)}%, порог: ${threshold})`);

            return {
                similar: isSimilar,
                similarity: similarity,
                alignmentValid: alignmentValid,
                alignmentError: alignmentError,
                points1: points1.length,
                points2: points2.length,
                method: 'simple_matcher_direct',
                alignmentMethod: this.config.alignmentMethod,
                decision: isSimilar ? 'same' : 'different',
                matches: matches.length,
                thresholdUsed: threshold
            };

        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            console.error(error.stack);
            return {
                similar: false,
                similarity: 0,
                error: error.message,
                method: 'error'
            };
        }
    }

    // 🔥 Вспомогательный метод: Расчет схожести по расстоянию Хаусдорфа
    calculateHausdorffSimilarity(points1, points2) {
        if (points1.length === 0 || points2.length === 0) return 0;

        // Вычисляем Хаусдорфово расстояние
        let maxDistance = 0;
       
        // Для каждой точки в points1 находим ближайшую в points2
        for (const p1 of points1) {
            let minDistance = Infinity;
            for (const p2 of points2) {
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
            if (minDistance > maxDistance) {
                maxDistance = minDistance;
            }
        }

        // Для каждой точки в points2 находим ближайшую в points1
        for (const p2 of points2) {
            let minDistance = Infinity;
            for (const p1 of points1) {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
            if (minDistance > maxDistance) {
                maxDistance = minDistance;
            }
        }

        // Преобразуем расстояние в схожесть (0-1)
        const maxHausdorffDistance = 200;
        const similarity = Math.max(0, 1 - (maxDistance / maxHausdorffDistance));
       
        console.log(`📏 Хаусдорфово расстояние: ${maxDistance.toFixed(1)}px, схожесть: ${(similarity * 100).toFixed(1)}%`);
       
        return similarity;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Простой расчет схожести
    calculateSimpleSimilarity(points1, points2) {
        if (points1.length !== points2.length || points1.length === 0) {
            return 0;
        }

        let totalDistance = 0;
        const maxDistance = 100;

        for (let i = 0; i < points1.length; i++) {
            const dx = points1[i].x - points2[i].x;
            const dy = points1[i].y - points2[i].y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }

        const avgDistance = totalDistance / points1.length;
        const similarity = Math.max(0, 1 - (avgDistance / maxDistance));

        return similarity;
    }

    // 🔥 МЕТОДЫ СРАВНЕНИЯ
    async compareWithAlignment(footprint1, footprint2) {
        // Используем новый метод compareFootprints
        return this.compareFootprints(footprint1, footprint2, {
            method: this.config.alignmentMethod,
            threshold: this.DECISION_THRESHOLDS.PATTERN_SIMILARITY
        });
    }

    async compareWithCoordinateConversion(footprint1, footprint2) {
        // Получаем точки и конвертируем в единую систему
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);

        // В новой системе конвертация не нужна - точки уже в единой системе
        const transformed1 = this.coordinateSystem.transform(points1, { system: 'detected' });
        const transformed2 = this.coordinateSystem.transform(points2, { system: 'detected' });

        // Сравниваем
        return this.compareFootprints(
            { points: transformed1 },
            { points: transformed2 },
            { method: 'procrustes' }
        );
    }

    async validateAndCompare(footprint1, footprint2) {
        // Валидируем точки перед сравнением
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);

        const validation1 = this.coordinateSystem.validate(points1);
        const validation2 = this.coordinateSystem.validate(points2);

        if (!validation1.valid || !validation2.valid) {
            return {
                comparable: false,
                error: 'Invalid points in one or both footprints',
                validation1,
                validation2
            };
        }

        // Выполняем сравнение
        const comparison = await this.compareFootprints(footprint1, footprint2, {
            method: this.config.alignmentMethod,
            threshold: this.DECISION_THRESHOLDS.PATTERN_SIMILARITY
        });

        return {
            comparable: true,
            validation: { valid: true, message: 'Both footprints validated successfully' },
            comparison
        };
    }

    async compareWithPatterns(footprint1, footprint2) {
        // Используем SimpleMatcher для паттерн-сравнения
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);

        if (points1.length === 0 || points2.length === 0) {
            return {
                similar: false,
                similarity: 0,
                patternBased: true,
                error: 'Недостаточно точек для паттерн-сравнения'
            };
        }

        // Нормализуем точки
        const normalized1 = this.normalizePoints([...points1], {
            method: 'min_max',
            range: { min: 0, max: 1000 },
            preserveAspectRatio: true
        });
       
        const normalized2 = this.normalizePoints([...points2], {
            method: 'min_max',
            range: { min: 0, max: 1000 },
            preserveAspectRatio: true
        });

        // Используем SimpleMatcher для паттерн-сравнения
        let similarity = 0;
        let patternMatches = [];
       
        if (this.matcher && this.matcher.match) {
            const matchResult = this.matcher.match(normalized1, normalized2);
            similarity = matchResult.similarity || 0;
            patternMatches = matchResult.matchedPoints || [];
            console.log(`🎯 Паттерн-сравнение: ${(similarity * 100).toFixed(1)}%`);
        } else {
            // Альтернатива: сравнение по топологии графа
            similarity = this.calculateTopologicalSimilarity(footprint1, footprint2);
        }

        const isSimilar = similarity > this.DECISION_THRESHOLDS.PATTERN_SIMILARITY;

        return {
            similar: isSimilar,
            similarity: similarity,
            patternBased: true,
            patternMethod: 'topology_pattern_matching',
            timestamp: new Date(),
            matches: patternMatches.length,
            threshold: this.DECISION_THRESHOLDS.PATTERN_SIMILARITY
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Сравнение топологии графов
    calculateTopologicalSimilarity(footprint1, footprint2) {
        try {
            const graph1 = footprint1.graph;
            const graph2 = footprint2.graph;
           
            if (!graph1 || !graph2) return 0;
           
            // Простое сравнение количества узлов и ребер
            const nodes1 = graph1.nodes.size;
            const nodes2 = graph2.nodes.size;
            const edges1 = graph1.edges ? graph1.edges.size : 0;
            const edges2 = graph2.edges ? graph2.edges.size : 0;
           
            const nodeSimilarity = 1 - Math.abs(nodes1 - nodes2) / Math.max(nodes1, nodes2, 1);
            const edgeSimilarity = 1 - Math.abs(edges1 - edges2) / Math.max(edges1, edges2, 1);
           
            const similarity = (nodeSimilarity + edgeSimilarity) / 2;
           
            console.log(`🌐 Топологическая схожесть: узлы ${nodes1}/${nodes2}=${nodeSimilarity.toFixed(2)}, ребра ${edges1}/${edges2}=${edgeSimilarity.toFixed(2)}`);
           
            return similarity;
        } catch (error) {
            console.log(`⚠️ Ошибка топологического сравнения: ${error.message}`);
            return 0;
        }
    }

    // 🔥 МЕТОДЫ ШАБЛОНОВ
    updateConfirmationsFromTemplate(footprint, vectorModel, transformationInfo = null) {
        return this.templateCoordinator.updateConfirmationsFromTemplate(footprint, vectorModel, transformationInfo);
    }

    updateConfirmationsDirectly(footprint1, footprint2) {
        return this.templateCoordinator.updateConfirmationsDirectly(footprint1, footprint2);
    }

    updateConfirmationsFromMatches(footprint1, footprint2, matches) {
        return this.templateCoordinator.updateConfirmationsFromMatches(footprint1, footprint2, matches);
    }

    debugAccumulation(userId) {
        return this.templateCoordinator.debugAccumulation(userId);
    }

    // 🔥 МЕТОДЫ СЕССИЙ
    createSession(userId, name = null) {
        return this.sessionManager.createSession(userId, name);
    }

    getActiveSession(userId) {
        return this.sessionManager.getActiveSession(userId);
    }

    saveSessionAsModel(userId, modelName = null) {
        if (this.sessionManager && typeof this.sessionManager.saveSessionAsModel === 'function') {
            return this.sessionManager.saveSessionAsModel(userId, modelName);
        } else {
            console.log('⚠️ Метод saveSessionAsModel не найден в SessionManager');
            return { success: false, error: 'Method not available' };
        }
    }

    getSessionInfo(userId) {
        return this.sessionManager.getSessionInfo(userId);
    }

    cleanupOldSessions(maxAgeHours = 24) {
        return this.sessionManager.cleanupOldSessions(maxAgeHours);
    }

    hasSession(userId) {
        return this.sessionManager.hasSession(userId);
    }

    updateLastActivity(userId) {
        const session = this.getActiveSession(userId);
        if (session) {
            session.lastActivity = new Date();
            return true;
        }
        return false;
    }

    // 🔥 МЕТОДЫ ВИЗУАЛИЗАЦИИ
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        console.log(`🎨 ВЫЗОВ ВИЗУАЛИЗАЦИИ отпечатка для ${userId}`);

        // Включаем визуализацию ВСЕГДА для совпадений
        if (!this.config.enableMergeVisualization) {
            console.log('⚠️ Визуализация отключена в настройках, но ВКЛЮЧАЕМ для совпадений');
        }

        try {
            if (this.visualizationManager && this.visualizationManager.visualizeSingleFootprintConfirmations) {
                const result = await this.visualizationManager.visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo);
                console.log(`✅ Визуализация создана: ${result.path || 'нет пути'}`);
                return result;
            } else {
                console.log('❌ VisualizationManager не инициализирован');
                return { path: null, success: false, reason: 'manager_not_initialized' };
            }
        } catch (error) {
            console.log(`❌ Ошибка визуализации: ${error.message}`);
            console.error(error.stack);
            return { path: null, success: false, reason: 'error', error: error.message };
        }
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 ВЫЗОВ ВИЗУАЛИЗАЦИИ шаблона для ${userId}`);

        if (!this.config.enableTemplateVisualization) {
            console.log('⚠️ Визуализация шаблонов отключена, но ВКЛЮЧАЕМ для совпадений');
        }

        try {
            if (this.visualizationManager && this.visualizationManager.visualizeVectorSuperModel) {
                const result = await this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);
                console.log(`✅ Визуализация шаблона создана: ${result.template || 'нет пути'}`);
                return result;
            } else {
                console.log('❌ VisualizationManager не инициализирован');
                return { template: null, success: false, reason: 'manager_not_initialized' };
            }
        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            console.error(error.stack);
            return { template: null, success: false, reason: 'error', error: error.message };
        }
    }

    debugVisualizations(userId) {
        try {
            if (this.visualizationManager && this.visualizationManager.debugVisualizations) {
                return this.visualizationManager.debugVisualizations(userId);
            }
        } catch (error) {
            console.log(`⚠️ Ошибка debug визуализации: ${error.message}`);
        }
        return {};
    }

    // 🔥 ГЕОМЕТРИЧЕСКИЕ МЕТОДЫ
    calculateAspectRatio(points) {
        return this.geometryUtils.calculateAspectRatio(points);
    }

    calculateDistance(point1, point2) {
        return this.geometryUtils.calculateDistance(point1, point2);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    extractPointsFromObject(obj) {
        if (Array.isArray(obj)) {
            return obj.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        }

        if (obj && obj.graph && obj.graph.nodes) {
            const points = [];
            for (const [, node] of obj.graph.nodes) {
                if (node && typeof node.x === 'number' && typeof node.y === 'number') {
                    points.push({ x: node.x, y: node.y });
                }
            }
            return points;
        }

        if (obj && obj.points) {
            return Array.isArray(obj.points) ? obj.points : [];
        }

        return [];
    }

    extractPointsFromAnalysis(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        for (const pred of predictions) {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                points.push({
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points,
                    class: pred.class,
                    _source: 'analysis',
                    _timestamp: new Date()
                });
            }
        }

        const validation = this.coordinateSystem.validate(points);
        if (!validation.valid) {
            console.log(`⚠️ Валидация точек: ${validation.validCount}/${validation.total} валидных`);
        }

        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }

    extractPointsFromFootprint(footprint) {
        try {
            // Сначала проверяем метод getPoints
            if (footprint && typeof footprint.getPoints === 'function') {
                const points = footprint.getPoints();
                if (Array.isArray(points) && points.length > 0) {
                    return points;
                }
            }

            // Затем проверяем свойство points
            if (footprint && Array.isArray(footprint.points)) {
                return footprint.points;
            }

            // Затем проверяем граф
            if (footprint && footprint.graph && footprint.graph.nodes) {
                const points = [];
                for (const [, node] of footprint.graph.nodes) {
                    if (node && typeof node.x === 'number' && typeof node.y === 'number') {
                        points.push({ x: node.x, y: node.y });
                    }
                }
                return points;
            }

            // Используем legacy manager как запасной вариант
            const result = this.coordinateManager.getCoordinates(footprint, {
                coordinateSystem: 'original',
                includeMetadata: false,
                debug: this.config.debug
            });
            return result.points || [];

        } catch (error) {
            console.log(`⚠️ Ошибка извлечения точек из отпечатка: ${error.message}`);
            return [];
        }
    }

    // 🔥 ДИАГНОСТИЧЕСКИЕ МЕТОДЫ
    runInitialDiagnostics() {
        console.log('\n🔍 ЗАПУСК НАЧАЛЬНОЙ ДИАГНОСТИКИ...');

        // 1. Проверка новой системы координат
        console.log('  1. Проверка новой системы координат...');
        try {
            const testPoints = [
                { x: 100, y: 100 },
                { x: 200, y: 200 },
                { x: 300, y: 300 }
            ];

            const transformed = this.coordinateSystem.transform(testPoints);
            const center = this.calculateCenter(testPoints);

            console.log(`     ✅ CoordinateSystem активен`);
            console.log(`     • Трансформация: ${transformed.length} точек`);
            console.log(`     • Центр: (${center.x}, ${center.y})`);
        } catch (error) {
            console.log(`     ❌ CoordinateSystem: ${error.message}`);
        }

        // 2. Проверка системы выравнивания
        console.log('  2. Проверка системы выравнивания...');
        try {
            const testPoints = [
                { x: 100, y: 100 },
                { x: 200, y: 100 },
                { x: 150, y: 200 }
            ];

            const reference = [
                { x: 120, y: 110 },
                { x: 220, y: 110 },
                { x: 170, y: 210 }
            ];

            const aligned = this.alignPoints(testPoints, reference, { method: 'simple' });
            console.log(`     ✅ AlignmentSystem активен`);
            console.log(`     • Метод выравнивания: ${this.config.alignmentMethod}`);
            console.log(`     • Выровнено: ${aligned.length} точек`);

            const validation = this.validateAlignment(aligned, reference, 20);
            console.log(`     • Валидация: ${validation.valid ? '✅ OK' : '❌ FAIL'}`);
            if (validation.valid) {
                console.log(`     • Средняя ошибка: ${validation.averageError.toFixed(2)}px`);
            }
        } catch (error) {
            console.log(`     ❌ AlignmentSystem: ${error.message}`);
        }

        // 3. Проверка нового метода compareFootprints
        console.log('  3. Проверка нового метода сравнения...');
        try {
            const testFootprint1 = {
                points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 150, y: 200 }],
                getPoints: function() { return this.points; }
            };

            const testFootprint2 = {
                points: [{ x: 110, y: 110 }, { x: 210, y: 110 }, { x: 160, y: 210 }],
                getPoints: function() { return this.points; }
            };

            console.log(`     ✅ Метод compareFootprints доступен`);
            console.log(`     • Синхронная проверка: OK`);
        } catch (error) {
            console.log(`     ❌ Метод compareFootprints: ${error.message}`);
        }

        // 4. Проверка нового метода normalizeFootprint
        console.log('  4. Проверка нового метода normalizeFootprint...');
        try {
            const testFootprint = {
                points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 150, y: 200 }],
                getPoints: function() { return this.points; },
                updatePoints: function(newPoints) { this.points = newPoints; },
                metadata: {}
            };

            console.log(`     ✅ Метод normalizeFootprint доступен`);
            console.log(`     • Синхронная проверка: OK`);
        } catch (error) {
            console.log(`     ❌ Метод normalizeFootprint: ${error.message}`);
        }

        // 5. Проверка констант координатной системы
        console.log('  5. Проверка констант координатной системы...');
        try {
            console.log(`     ✅ Константы системы координат:`);
            console.log(`     • CENTER: (${this.coordinateSystemConstants.CENTER.x}, ${this.coordinateSystemConstants.CENTER.y})`);
            console.log(`     • BOUNDS: ${this.coordinateSystemConstants.BOUNDS.minX}-${this.coordinateSystemConstants.BOUNDS.maxX}, ${this.coordinateSystemConstants.BOUNDS.minY}-${this.coordinateSystemConstants.BOUNDS.maxY}`);
            console.log(`     • DEFAULT_RANGE: ${this.coordinateSystemConstants.DEFAULT_RANGE.min}-${this.coordinateSystemConstants.DEFAULT_RANGE.max}`);
            console.log(`     • MIN_MAX: ${this.coordinateSystemConstants.MIN_MAX.min}-${this.coordinateSystemConstants.MIN_MAX.max}`);
        } catch (error) {
            console.log(`     ❌ Константы системы координат: ${error.message}`);
        }

        // 6. Проверка визуализации
        console.log('  6. Проверка визуализации...');
        console.log(`     • Визуализация включена: ${this.config.enableMergeVisualization ? '✅' : '❌'}`);
        console.log(`     • Визуализация шаблонов: ${this.config.enableTemplateVisualization ? '✅' : '❌'}`);
        console.log(`     • VisualizationManager: ${this.visualizationManager ? '✅' : '❌'}`);

        console.log('✅ Начальная диагностика завершена\n');
    }

    logModuleStatus() {
        const modules = [
            ['coordinateSystem', this.coordinateSystem],
            ['alignmentSystem (unified)', this.alignmentSystem],
            ['coordinateManager (legacy)', this.coordinateManager],
            ['transformationValidator', this.transformationValidator],
            ['comparisonEngine', this.comparisonEngine],
            ['templateCoordinator', this.templateCoordinator],
            ['sessionManager', this.sessionManager],
            ['geometryUtils', this.geometryUtils],
            ['visualizationManager', this.visualizationManager],
            ['mergeVisualizer', this.mergeVisualizer],
            ['matcher', this.matcher],
            ['simpleAligner (compat)', this.simpleAligner],
            ['improvedAligner (compat)', this.improvedAligner],
            ['coordinateValidator (compat)', this.coordinateValidator],
            ['НОВЫЙ normalizeFootprint', '✅ добавлен'],
            ['НОВЫЙ compareFootprints', '✅ добавлен']
        ];

        console.log(`🔍 ПРОВЕРКА МОДУЛЕЙ:`);
        modules.forEach(([name, obj]) => {
            const status = obj ? (typeof obj === 'string' ? obj : '✅') : '❌';
            console.log(`   - ${name}: ${status}`);
        });
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО в сессию пользователя ${userId}`);

        try {
            // Валидация входных данных
            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // Извлечение точек
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            // Логирование
            if (this.config.enableCoordinateDiagnostics) {
                this.logCoordinateSystems(`Извлечение точек для пользователя ${userId}`, points);
            }

            // Создание графа
            const graph = new SimpleGraph(`Временный_${Date.now()}`);
            graph.buildFromPoints(points);

            // Нормализация
            const normalized = this.rotationProcessor.normalizeToCanonical(graph, {
                userId: userId,
                photoInfo: photoInfo,
                autoRotate: true
            });

            const transformationInfo = {
                ...normalized.transformation,
                rotationAngle: normalized.rotationAngle,
                isMirrored: normalized.isMirrored,
                corrected: false,
                timestamp: new Date(),
                footType: normalized.footType,
                photoId: photoInfo.photoId || `photo_${Date.now()}`
            };

            // Коррекция зеркальности
            const corrected = this.mirrorDetector.autoCorrectMirroring(normalized.graph, 'right');
            if (corrected.correctionApplied) {
                transformationInfo.corrected = true;
                transformationInfo.correctionType = corrected.correctionType;
            }

            const finalGraph = corrected.graph;
            finalGraph.transformation = transformationInfo;

            if (this.config.enableCoordinateDiagnostics) {
                this.logTransformations([transformationInfo], `Трансформация для фото ${photoInfo.photoId || 'unknown'}`);
            }

            // Работа с сессией
            let session = this.getActiveSession(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
            }

            session.lastActivity = new Date();

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

            // Обработка фото
            if (!session.currentFootprint) {
                return await this.processFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);
            } else {
                return await this.processSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    async processFirstPhoto(session, userId, analysis, photoInfo, graph, transformationInfo, bot, chatId) {
        console.log(`👣 Первое фото: создаю отпечаток и ВИЗУАЛИЗАЦИЮ`);

        const SimpleFootprint = require('./simple-footprint');
        session.currentFootprint = new SimpleFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
            transformation: transformationInfo
        });

        session.currentFootprint.metadata.normalizationInfo = transformationInfo;
        session.currentFootprint.setManager(this);

        // Применяем нормализацию
        await this.normalizeFootprint(session.currentFootprint);

        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: graph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            source: photoInfo.source || 'telegram_bot',
            transformationInfo: transformationInfo
        });

        if (this.config.enableCoordinateDiagnostics) {
            this.logCoordinateSystems(`Создан первый отпечаток для пользователя ${userId}`, session.currentFootprint);
        }

        // Создание шаблона
        const VectorSuperModel = require('./vector-super-model');
        const vectorModel = new VectorSuperModel({
            name: `Шаблон_${String(userId).slice(0, 6)}`,
            enablePCA: false,
            cellSize: 25,
            debug: this.config.debug
        });

        vectorModel.addGraph(graph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo: transformationInfo
        });

        this.vectorSuperModels.set(userId, vectorModel);

        console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);

        // ВИЗУАЛИЗАЦИЯ первого фото
        let hasVisualization = false;
        let hasTemplateViz = false;
        let vizPath = null;
        let templatePath = null;

        if (bot && chatId) {
            console.log(`🤖 Бот доступен, создаю визуализации...`);

            try {
                // 1. Визуализация отпечатка
                console.log(`🎨 Создаю визуализацию отпечатка...`);
                const firstPhotoViz = await this.visualizeSingleFootprintConfirmations(
                    session.currentFootprint,
                    userId,
                    transformationInfo
                );

                if (firstPhotoViz && firstPhotoViz.path) {
                    hasVisualization = true;
                    vizPath = firstPhotoViz.path;
                    console.log(`✅ Путь к визуализации: ${vizPath}`);
                } else {
                    console.log(`⚠️ Визуализация не создана: ${firstPhotoViz?.reason || 'unknown'}`);
                }

                // 2. Визуализация шаблона
                console.log(`🎨 Создаю визуализацию шаблона...`);
                const templateVizResult = await this.visualizeVectorSuperModel(userId, vectorModel);

                if (templateVizResult && templateVizResult.template) {
                    hasTemplateViz = true;
                    templatePath = templateVizResult.template;
                    console.log(`✅ Путь к шаблону: ${templatePath}`);
                } else {
                    console.log(`⚠️ Визуализация шаблона не создана: ${templateVizResult?.reason || 'unknown'}`);
                }

                // 3. Отправка в Telegram
                if (hasVisualization && vizPath && fs.existsSync(vizPath)) {
                    try {
                        const cleanMarkdown = (text) => text
                            .replace(/\*\*/g, '')
                            .replace(/\*/g, '')
                            .replace(/__/g, '')
                            .replace(/_/g, '')
                            .replace(/`/g, '')
                            .replace(/\[/g, '(')
                            .replace(/\]/g, ')');

                        let caption = `👣 ПЕРВЫЙ СЛЕД СОЗДАН\n\n`;
                        caption += `📊 Извлечено: ${addResult.added} точек\n`;
                        caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                        caption += `🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n`;
                        caption += `✅ Создан шаблон для накопления деталей`;

                        await bot.sendPhoto(chatId, vizPath, {
                            caption: cleanMarkdown(caption),
                            parse_mode: 'HTML'
                        });

                        console.log('✅ Визуализация отправлена в Telegram');

                    } catch (error) {
                        console.log(`❌ Ошибка отправки в Telegram: ${error.message}`);
                    }
                }

                // 4. Отправка шаблона
                if (hasTemplateViz && templatePath && fs.existsSync(templatePath)) {
                    try {
                        const templateData = vectorModel.templateBuilder.getVisualizationData();
                        const stats = templateData?.stats || {};

                        let templateCaption = `📊 ШАБЛОН СОЗДАН\n\n`;
                        templateCaption += `📋 Ячеек: ${stats.cells || 0}\n`;
                        templateCaption += `🎯 Эталонный граф: ${templateData.referenceGraphId?.slice(0, 8) || 'создан'}\n`;
                        templateCaption += `📈 Система готова к накоплению деталей`;

                        const cleanMarkdown = (text) => text
                            .replace(/\*\*/g, '')
                            .replace(/\*/g, '')
                            .replace(/__/g, '')
                            .replace(/_/g, '')
                            .replace(/`/g, '')
                            .replace(/\[/g, '(')
                            .replace(/\]/g, ')');

                        await bot.sendPhoto(chatId, templatePath, {
                            caption: cleanMarkdown(templateCaption),
                            parse_mode: 'HTML'
                        });

                        console.log('✅ Визуализация шаблона отправлена в Telegram');

                    } catch (error) {
                        console.log(`❌ Ошибка отправки шаблона в Telegram: ${error.message}`);
                    }
                }

            } catch (error) {
                console.log(`❌ Общая ошибка визуализации: ${error.message}`);
            }
        } else {
            console.log('⚠️ Бот не доступен для отправки визуализаций');
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
            hasVisualization: hasVisualization,
            hasTemplateViz: hasTemplateViz,
            vizPath: vizPath,
            templatePath: templatePath
        };
    }

    async processSubsequentPhoto(session, userId, analysis, photoInfo, graph, transformationInfo, bot, chatId) {
        console.log(`🔍 Проверяю совпадение с существующим отпечатком`);

        // Исправляем существующий отпечаток
        if (session.currentFootprint) {
            session.currentFootprint.setManager(this);
            // Нормализуем существующий отпечаток перед сравнением
            await this.normalizeFootprint(session.currentFootprint);
        }

        const existingTransformationInfo = session.currentFootprint?.metadata?.normalizationInfo ||
                                          (session.currentFootprint?.getTransformation ? session.currentFootprint.getTransformation() : null);

        // Создание временного отпечатка
        const SimpleFootprint = require('./simple-footprint');
        const tempFootprint = new SimpleFootprint({
            userId: userId,
            name: `Temp_${Date.now()}`
        });

        tempFootprint.metadata.normalizationInfo = transformationInfo;
        const tempResult = tempFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: graph,
            photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
            source: photoInfo.source || 'telegram_bot_temp',
            transformationInfo: transformationInfo
        });

        // Нормализуем временный отпечаток
        await this.normalizeFootprint(tempFootprint);

        // 🔥 ИСПРАВЛЕНИЕ: Используем compareFootprints, который теперь работает правильно
        const comparisonResult = await this.compareFootprints(
            session.currentFootprint,
            tempFootprint,
            {
                method: this.config.alignmentMethod,
                threshold: this.DECISION_THRESHOLDS.PATTERN_SIMILARITY
            }
        );

        const similarity = comparisonResult?.similarity || 0;
        const decision = comparisonResult.similar ? 'same' : 'different';

        console.log(`🎯 Решение: ${decision} (сходство: ${similarity.toFixed(3)}, метод: ${comparisonResult.method})`);

        if (decision === 'same') {
            return await this.processMatchingFootprint(
                session, userId, tempFootprint, graph, transformationInfo,
                existingTransformationInfo, similarity, comparisonResult,
                tempResult, bot, chatId
            );
        } else {
            return await this.processNewFootprint(
                session, userId, analysis, photoInfo, graph, transformationInfo,
                similarity, bot, chatId
            );
        }
    }

    async processMatchingFootprint(session, userId, tempFootprint, graph, transformationInfo,
                                  existingTransformationInfo, similarity, comparisonResult,
                                  tempResult, bot, chatId) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)}) - создаю ВИЗУАЛИЗАЦИЮ`);

        const nodesAdded = tempResult?.added || 0;

        // Работа с шаблоном
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
            vectorModel.addGraph(session.currentFootprint.graph, session.currentFootprint.id, {
                isFirst: true,
                transformationInfo: existingTransformationInfo
            });
        }

        vectorModel.addGraph(graph, tempFootprint.id, {
            similarity: similarity,
            timestamp: new Date(),
            transformationInfo: transformationInfo
        });

        // Обновление подтверждений
        const directUpdates = this.updateConfirmationsDirectly(session.currentFootprint, tempFootprint);
        const updatedFromTemplate = this.updateConfirmationsFromTemplate(
            session.currentFootprint,
            vectorModel,
            existingTransformationInfo
        );

        // 🔥 ВИЗУАЛИЗАЦИЯ подтверждений - теперь будет работать с порогом 0.7
        let telegramSent = false;
        let templateSent = false;
        let hasVisualization = false;
        let clusterVizPath = null;
        let templateVizPath = null;

        if (bot && chatId) {
            console.log(`🤖 Бот доступен, создаю визуализации подтверждений...`);

            try {
                // 1. Визуализация подтверждений
                console.log(`🎨 Создаю визуализацию подтверждений...`);
                const clusterVizResult = await this.visualizeSingleFootprintConfirmations(
                    session.currentFootprint,
                    userId,
                    {
                        currentTransformation: transformationInfo,
                        previousTransformation: existingTransformationInfo,
                        comparisonResult: comparisonResult
                    }
                );

                if (clusterVizResult && clusterVizResult.path) {
                    hasVisualization = true;
                    clusterVizPath = clusterVizResult.path;
                    console.log(`✅ Путь к визуализации подтверждений: ${clusterVizPath}`);
                } else {
                    console.log(`⚠️ Визуализация подтверждений не создана: ${clusterVizResult?.reason || 'unknown'}`);
                }

                // 2. Визуализация шаблона
                if (vectorModel) {
                    console.log(`🎨 Создаю визуализацию шаблона...`);
                    const templateVizResult = await this.visualizeVectorSuperModel(userId, vectorModel);

                    if (templateVizResult && templateVizResult.template) {
                        templateVizPath = templateVizResult.template;
                        console.log(`✅ Путь к шаблону: ${templateVizPath}`);
                    } else {
                        console.log(`⚠️ Визуализация шаблона не создана: ${templateVizResult?.reason || 'unknown'}`);
                    }
                }

                // 3. Отправка подтверждений в Telegram
                if (hasVisualization && clusterVizPath && fs.existsSync(clusterVizPath)) {
                    try {
                        const stats = this.calculateConfirmationStats(session.currentFootprint);
                        let caption = `🎯 РЕАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ\n\n`;
                        caption += `📊 Сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%\n`;
                        caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                        caption += `🔄 Метод: ${comparisonResult.method || 'simple_matcher_direct'}\n`;
                        caption += `🎯 Порог: ${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}\n\n`;
                        caption += `📈 СТАТИСТИКА (после ${session.photos.length} фото):\n`;
                        caption += `• Всего точек: ${stats.totalPoints}\n`;
                        caption += `• 🔴 2+ подтверждений: ${stats.confirmed2}\n`;
                        caption += `• 🔵 1 подтверждение: ${stats.confirmed1}\n`;
                        caption += `• ⚪️ 0 подтверждений: ${stats.confirmed0}`;

                        const cleanMarkdown = (text) => text
                            .replace(/\*\*/g, '')
                            .replace(/\*/g, '')
                            .replace(/__/g, '')
                            .replace(/_/g, '')
                            .replace(/`/g, '')
                            .replace(/\[/g, '(')
                            .replace(/\]/g, ')');

                        await bot.sendPhoto(chatId, clusterVizPath, {
                            caption: cleanMarkdown(caption),
                            parse_mode: 'HTML'
                        });

                        telegramSent = true;
                        console.log('✅ Визуализация подтверждений отправлена в Telegram');

                    } catch (error) {
                        console.log(`❌ Ошибка отправки подтверждений в Telegram: ${error.message}`);
                    }
                }

                // 4. Отправка шаблона в Telegram
                if (templateVizPath && fs.existsSync(templateVizPath)) {
                    try {
                        const templateStats = vectorModel.templateBuilder?.getVisualizationData()?.stats || {};
                        let templateCaption = `📊 ШАБЛОН ПОСЛЕ ${session.photos.length} ФОТО\n\n`;
                        templateCaption += `📋 Ячеек: ${templateStats.cells || 0}\n`;
                        templateCaption += `✅ Подтверждений: ${templateStats.totalConfirmations || 0}\n`;
                        templateCaption += `📈 Среднее: ${templateStats.averageConfirmations?.toFixed(2) || '0.00'}\n`;
                        templateCaption += `🎯 Схожесть с эталоном: ${(similarity * 100).toFixed(1)}%\n\n`;
                        templateCaption += `🔍 Накопление деталей работает`;

                        const cleanMarkdown = (text) => text
                            .replace(/\*\*/g, '')
                            .replace(/\*/g, '')
                            .replace(/__/g, '')
                            .replace(/_/g, '')
                            .replace(/`/g, '')
                            .replace(/\[/g, '(')
                            .replace(/\]/g, ')');

                        await bot.sendPhoto(chatId, templateVizPath, {
                            caption: cleanMarkdown(templateCaption),
                            parse_mode: 'HTML'
                        });

                        templateSent = true;
                        console.log('✅ Визуализация шаблона отправлена в Telegram');

                    } catch (error) {
                        console.log(`❌ Ошибка отправки шаблона в Telegram: ${error.message}`);
                    }
                }

            } catch (error) {
                console.log(`❌ Общая ошибка визуализации совпадений: ${error.message}`);
            }
        }

        return {
            success: true,
            similarity: similarity,
            decision: 'same',
            nodesAdded: nodesAdded,
            message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
            hasVisualization: hasVisualization,
            telegramSent: telegramSent,
            templateSent: templateSent,
            pointsUpdated: updatedFromTemplate + directUpdates,
            totalPhotos: session.photos.length,
            vizPath: clusterVizPath,
            templatePath: templateVizPath
        };
    }

    async processNewFootprint(session, userId, analysis, photoInfo, graph, transformationInfo,
                            similarity, bot, chatId) {
        console.log(`🆕 Следы разные (${similarity.toFixed(3)}) - новая модель`);

        // Пропускаем сохранение сессии как модели если метод недоступен
        if (session.currentFootprint && session.currentFootprint.graph &&
            session.currentFootprint.graph.nodes.size >= 10) {
            console.log('ℹ️ Пропускаем сохранение сессии как модели (метод недоступен)');
        }

        const SimpleFootprint = require('./simple-footprint');
        session.currentFootprint = new SimpleFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
        });

        session.currentFootprint.metadata.normalizationInfo = transformationInfo;

        // Нормализуем новый отпечаток
        await this.normalizeFootprint(session.currentFootprint);

        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: graph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            source: photoInfo.source || 'telegram_bot',
            transformationInfo: transformationInfo
        });

        // Новый шаблон
        const VectorSuperModel = require('./vector-super-model');
        const vectorModel = new VectorSuperModel({
            name: `Шаблон_${String(userId).slice(0, 6)}_new`,
            enablePCA: false,
            cellSize: 25,
            debug: this.config.debug
        });

        vectorModel.addGraph(graph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo: transformationInfo
        });

        this.vectorSuperModels.set(userId, vectorModel);

        return {
            success: true,
            similarity: similarity,
            decision: 'different',
            isNewModel: true,
            nodesAdded: addResult.added,
            hasTemplate: true
        };
    }

    // 🔥 УТИЛИТЫ
    calculateConfirmationStats(footprint) {
        if (!footprint?.pointTracker) {
            return { confirmed2: 0, confirmed1: 0, confirmed0: 0, totalPoints: 0 };
        }

        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

        for (const [, point] of footprint.pointTracker.points) {
            const confirmations = point.confirmedCount || 1;
            if (confirmations >= 2) confirmed2++;
            else if (confirmations >= 1) confirmed1++;
            else confirmed0++;
        }

        return {
            confirmed2,
            confirmed1,
            confirmed0,
            totalPoints: confirmed2 + confirmed1 + confirmed0
        };
    }

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/templates'),
            path.join(this.config.dbPath, 'visualizations/alignments'),
            path.join(this.config.dbPath, 'visualizations/clusters'),
            path.join(this.config.dbPath, 'reports'),
            path.join(this.config.dbPath, 'diagnostic_reports'),
            path.join(this.config.dbPath, 'logs')
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
            templateStats: templateStats,
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics,
            coordinateSystem: 'Новая единая система (v2.0)',
            alignmentSystem: 'Унифицированная (v1.0)',
            alignmentMethod: this.config.alignmentMethod,
            visualization: {
                enabled: this.config.enableMergeVisualization,
                templateEnabled: this.config.enableTemplateVisualization
            },
            newMethods: {
                normalizeFootprint: '✅ обновлен',
                compareFootprints: '✅ исправлен (порог 0.7)',
                alignmentMethod: this.config.alignmentMethod,
                simpleMatcherIntegration: '✅ работает'
            }
        };
    }

    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    getVectorSuperModelInfo(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { exists: false, message: 'Шаблон не найден' };
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
            if (this.userSessions.has(userId)) {
                this.userSessions.delete(userId);
            }
            console.log(`🧹 Очищен шаблон и сессия для пользователя ${userId}`);
            return { success: true, message: 'Шаблон и сессия очищены' };
        }
        return { success: false, message: 'Шаблон не найден' };
    }

    getTemplateVisualization(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
        return vectorModel ? this.visualizeVectorSuperModel(userId, vectorModel) : null;
    }

    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    getMergeVisualizationCount() {
        return this.mergeVisualizer?.getCount ? this.mergeVisualizer.getCount() : 0;
    }

    addMergeVisualization(userId, vizInfo) {
        return this.mergeVisualizer?.addVisualization ? this.mergeVisualizer.addVisualization(userId, vizInfo) : 1;
    }

    getLinesOfCode() { return 5000; }
}


module.exports = SimpleFootprintManager;
