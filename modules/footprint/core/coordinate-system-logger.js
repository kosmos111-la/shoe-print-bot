// modules/footprint/core/coordinate-system-logger.js
// 📊 ПРОЗРАЧНАЯ ДИАГНОСТИКА СИСТЕМ КООРДИНАТ В ЛОГАХ

class CoordinateSystemLogger {
    constructor(manager) {
        this.manager = manager;
        this.debug = manager?.config?.debug || false;
       
        // Конфигурация логирования
        this.config = {
            enabled: true,
            logLevel: 'detailed', // 'minimal', 'detailed', 'debug'
            includeSamples: 3,    // Сколько примеров точек выводить
            maxPointsToLog: 50,   // Максимум точек для логирования
            colorize: true,       // Цветной вывод в консоль
            logToFile: false,     // Дополнительно логировать в файл
            filePath: './logs/coordinate-systems.log'
        };
       
        // Цвета для консоли
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            gray: '\x1b[90m'
        };
       
        // История для анализа
        this.history = [];
        this.maxHistorySize = 100;
       
        console.log(this.colorize('📊 CoordinateSystemLogger создан: прозрачная диагностика координат', 'cyan'));
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Логировать системы координат
    logCoordinateSystems(title, ...objects) {
        if (!this.config.enabled) return;
       
        console.log(`\n${this.colorize('📐', 'magenta')} ${this.colorize(title, 'bright')}`);
        console.log(this.colorize('═'.repeat(60), 'dim'));
       
        // Логируем каждый объект
        objects.forEach((obj, index) => {
            if (!obj) {
                console.log(this.colorize(`  ${index + 1}. [NULL OBJECT]`, 'red'));
                return;
            }
           
            const logEntry = this.analyzeObject(obj, index);
            this.history.push(logEntry);
           
            this.printObjectAnalysis(logEntry);
        });
       
        // Если есть история, показываем сравнение
        if (objects.length >= 2) {
            this.logComparison(objects);
        }
       
        console.log(this.colorize('═'.repeat(60), 'dim'));
       
        // Дополнительно логируем в файл
        if (this.config.logToFile) {
            this.logToFile(title, objects);
        }
       
        // Ограничиваем размер истории
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }
   
    // 🔥 МЕТОД: Сравнить системы координат
    compareCoordinateSystems(obj1, obj2, options = {}) {
        const {
            title = 'СРАВНЕНИЕ СИСТЕМ КООРДИНАТ',
            detailed = true
        } = options;
       
        console.log(`\n${this.colorize('🔍', 'yellow')} ${this.colorize(title, 'bright')}`);
        console.log(this.colorize('─'.repeat(50), 'dim'));
       
        const analysis1 = this.analyzeObject(obj1, 1);
        const analysis2 = this.analyzeObject(obj2, 2);
       
        // Выводим информацию о каждом объекте
        console.log(this.colorize('ОБЪЕКТ 1:', 'cyan'));
        this.printSummary(analysis1);
       
        console.log(this.colorize('\nОБЪЕКТ 2:', 'cyan'));
        this.printSummary(analysis2);
       
        // Сравниваем
        console.log(this.colorize('\nСРАВНЕНИЕ:', 'yellow'));
        this.compareAnalyses(analysis1, analysis2);
       
        // Если нужна детальная информация
        if (detailed && this.config.logLevel === 'detailed') {
            console.log(this.colorize('\nДЕТАЛЬНОЕ СРАВНЕНИЕ:', 'dim'));
            this.detailedComparison(analysis1, analysis2);
        }
       
        console.log(this.colorize('─'.repeat(50), 'dim'));
       
        return {
            analysis1,
            analysis2,
            differences: this.findDifferences(analysis1, analysis2)
        };
    }
   
    // 🔥 МЕТОД: Сгенерировать диагностический отчет
    generateDiagnosticReport(userId = null) {
        console.log(`\n${this.colorize('📋', 'green')} ${this.colorize('ДИАГНОСТИЧЕСКИЙ ОТЧЕТ СИСТЕМЫ КООРДИНАТ', 'bright')}`);
        console.log(this.colorize('═'.repeat(70), 'dim'));
       
        const report = {
            timestamp: new Date().toISOString(),
            userId: userId,
            systemInfo: this.getSystemInfo(),
            sessions: [],
            models: [],
            templates: [],
            issues: []
        };
       
        // 1. Информация о сессиях
        if (this.manager.userSessions && userId) {
            const session = this.manager.userSessions.get(userId);
            if (session) {
                report.sessions.push(this.analyzeSession(session));
            }
        }
       
        // 2. Информация о моделях
        if (this.manager.loadedModels) {
            report.models = this.analyzeLoadedModels();
        }
       
        // 3. Информация о шаблонах
        if (this.manager.vectorSuperModels && userId) {
            const vectorModel = this.manager.vectorSuperModels.get(userId);
            if (vectorModel) {
                report.templates.push(this.analyzeTemplate(vectorModel.templateBuilder));
            }
        }
       
        // 4. Анализ истории логирования
        report.loggingHistory = this.analyzeHistory();
       
        // 5. Поиск проблем
        report.issues = this.findSystemIssues(report);
       
        // Выводим отчет
        this.printDiagnosticReport(report);
       
        // Сохраняем отчет в файл
        this.saveDiagnosticReport(report);
       
        console.log(this.colorize('═'.repeat(70), 'dim'));
       
        return report;
    }
   
    // 🔥 МЕТОД: Логировать трансформации
    logTransformations(transformations, title = 'ТРАНСФОРМАЦИИ') {
        if (!this.config.enabled || !transformations) return;
       
        console.log(`\n${this.colorize('🔄', 'blue')} ${this.colorize(title, 'bright')}`);
        console.log(this.colorize('─'.repeat(50), 'dim'));
       
        if (Array.isArray(transformations)) {
            transformations.forEach((transform, index) => {
                this.logSingleTransformation(transform, index + 1);
            });
           
            if (transformations.length >= 2) {
                this.compareTransformations(transformations);
            }
        } else if (typeof transformations === 'object') {
            this.logSingleTransformation(transformations, 1);
        }
       
        console.log(this.colorize('─'.repeat(50), 'dim'));
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
   
    analyzeObject(obj, index) {
        const analysis = {
            index: index,
            timestamp: new Date(),
            type: this.getObjectType(obj),
            id: obj?.id || obj?.name || `obj_${index}`,
            hasPoints: false,
            pointCount: 0,
            coordinateSystem: 'unknown',
            bounds: null,
            center: null,
            transformation: null,
            issues: [],
            samples: []
        };
       
        try {
            // Определяем тип объекта
            if (this.isFootprint(obj)) {
                this.analyzeFootprint(obj, analysis);
            } else if (this.isGraph(obj)) {
                this.analyzeGraph(obj, analysis);
            } else if (this.isPointTracker(obj)) {
                this.analyzePointTracker(obj, analysis);
            } else if (this.isTemplateBuilder(obj)) {
                this.analyzeTemplateBuilder(obj, analysis);
            } else if (Array.isArray(obj)) {
                this.analyzePointsArray(obj, analysis);
            } else if (obj && typeof obj === 'object') {
                // Общий анализ объекта
                analysis.type = 'object';
                this.analyzeGenericObject(obj, analysis);
            }
           
            // Определяем систему координат
            analysis.coordinateSystem = this.detectCoordinateSystem(analysis);
           
        } catch (error) {
            analysis.issues.push(`Ошибка анализа: ${error.message}`);
            console.log(this.colorize(`⚠️ Ошибка анализа объекта ${index}: ${error.message}`, 'red'));
        }
       
        return analysis;
    }
   
    analyzeFootprint(footprint, analysis) {
        analysis.type = 'footprint';
       
        // Получаем точки из разных источников
        const pointsFromTracker = this.extractPointsFromPointTracker(footprint.pointTracker);
        const pointsFromGraph = this.extractPointsFromGraph(footprint.graph);
       
        // Используем трекер как основной источник
        analysis.points = pointsFromTracker.length > 0 ? pointsFromTracker : pointsFromGraph;
        analysis.pointCount = analysis.points.length;
        analysis.hasPoints = analysis.pointCount > 0;
       
        // Трансформация
        if (footprint.transformation) {
            analysis.transformation = footprint.transformation;
        } else if (typeof footprint.getTransformation === 'function') {
            try {
                analysis.transformation = footprint.getTransformation();
            } catch (error) {
                analysis.issues.push(`Ошибка getTransformation: ${error.message}`);
            }
        }
       
        // Метаданные
        if (footprint.metadata?.normalizationInfo) {
            analysis.normalizationInfo = footprint.metadata.normalizationInfo;
        }
       
        // Выбираем образцы
        analysis.samples = this.getPointSamples(analysis.points);
       
        // Вычисляем границы и центр
        if (analysis.points.length > 0) {
            analysis.bounds = this.calculateBounds(analysis.points);
            analysis.center = this.calculateCenter(analysis.points);
        }
       
        // Проверяем проблемы
        this.checkFootprintIssues(footprint, analysis);
    }
   
    analyzeGraph(graph, analysis) {
    analysis.type = 'graph';
   
    // 🔥 ИСПРАВЛЕНИЕ: Правильное извлечение точек из графа
    if (graph.nodes && typeof graph.nodes.forEach === 'function') {
        // Это Map
        graph.nodes.forEach((node, nodeId) => {
            analysis.points.push({
                id: nodeId,
                x: node.x || 0,
                y: node.y || 0,
                confidence: node.confidence || 0.5,
                _source: 'graph',
                _graphId: graph.id || 'unknown'
            });
        });
    } else if (Array.isArray(graph.nodes)) {
        // Это массив
        graph.nodes.forEach((node, index) => {
            analysis.points.push({
                id: node.id || `node_${index}`,
                x: node.x || 0,
                y: node.y || 0,
                confidence: node.confidence || 0.5,
                _source: 'graph_array',
                _graphId: graph.id || 'unknown'
            });
        });
    } else if (graph.nodes && typeof graph.nodes === 'object') {
        // Это обычный объект
        Object.entries(graph.nodes).forEach(([nodeId, node]) => {
            analysis.points.push({
                id: nodeId,
                x: node.x || 0,
                y: node.y || 0,
                confidence: node.confidence || 0.5,
                _source: 'graph_object',
                _graphId: graph.id || 'unknown'
            });
        });
    }
   
    analysis.pointCount = analysis.points.length;
    analysis.hasPoints = analysis.pointCount > 0;
   
    // Трансформация из графа
    if (graph.transformation) {
        analysis.transformation = graph.transformation;
    }
   
    // Выбираем образцы
    analysis.samples = this.getPointSamples(analysis.points);
   
    // Вычисляем границы и центр
    if (analysis.points.length > 0) {
        analysis.bounds = this.calculateBounds(analysis.points);
        analysis.center = this.calculateCenter(analysis.points);
    }
}
   
    analyzePointTracker(tracker, analysis) {
        analysis.type = 'pointTracker';
        analysis.points = this.extractPointsFromPointTracker(tracker);
        analysis.pointCount = analysis.points.length;
        analysis.hasPoints = analysis.pointCount > 0;
       
        // Трансформация
        if (tracker.transformation) {
            analysis.transformation = tracker.transformation;
        }
       
        // Статистика подтверждений
        if (analysis.points.length > 0) {
            const confirmations = analysis.points.map(p => p.confirmedCount || 1);
            analysis.confirmationStats = {
                avg: this.calculateAverage(confirmations),
                max: Math.max(...confirmations),
                min: Math.min(...confirmations)
            };
        }
       
        // Выбираем образцы
        analysis.samples = this.getPointSamples(analysis.points);
       
        // Вычисляем границы и центр
        if (analysis.points.length > 0) {
            analysis.bounds = this.calculateBounds(analysis.points);
            analysis.center = this.calculateCenter(analysis.points);
        }
    }
   
    analyzeTemplateBuilder(templateBuilder, analysis) {
        analysis.type = 'templateBuilder';
       
        // Извлекаем точки из ячеек
        const points = [];
        if (templateBuilder.invariantCells) {
            templateBuilder.invariantCells.forEach((cell, cellId) => {
                points.push({
                    id: cellId,
                    x: cell.originalCenter?.x || 0,
                    y: cell.originalCenter?.y || 0,
                    nx: cell.normalizedCenter?.nx,
                    ny: cell.normalizedCenter?.ny,
                    confirmations: cell.confirmations || 1,
                    _source: 'template_cell'
                });
            });
        }
       
        analysis.points = points;
        analysis.pointCount = points.length;
        analysis.hasPoints = points.length > 0;
       
        // Трансформация нормализации
        if (templateBuilder.normalizationTransform) {
            analysis.transformation = templateBuilder.normalizationTransform;
            analysis.coordinateSystem = 'template';
        }
       
        // Выбираем образцы
        analysis.samples = this.getPointSamples(analysis.points);
       
        // Вычисляем границы и центр
        if (analysis.points.length > 0) {
            analysis.bounds = this.calculateBounds(analysis.points);
            analysis.center = this.calculateCenter(analysis.points);
        }
       
        // Статистика шаблона
        if (templateBuilder.getVisualizationData) {
            try {
                const templateData = templateBuilder.getVisualizationData();
                analysis.templateStats = templateData.stats || {};
            } catch (error) {
                analysis.issues.push(`Ошибка получения данных шаблона: ${error.message}`);
            }
        }
    }
   
    analyzePointsArray(pointsArray, analysis) {
        analysis.type = 'pointsArray';
        analysis.points = pointsArray;
        analysis.pointCount = pointsArray.length;
        analysis.hasPoints = pointsArray.length > 0;
       
        // Выбираем образцы
        analysis.samples = this.getPointSamples(analysis.points);
       
        // Вычисляем границы и центр
        if (analysis.points.length > 0) {
            analysis.bounds = this.calculateBounds(analysis.points);
            analysis.center = this.calculateCenter(analysis.points);
        }
       
        // Определяем систему координат по точкам
        analysis.coordinateSystem = this.detectCoordinateSystemFromPoints(pointsArray);
    }
   
    analyzeGenericObject(obj, analysis) {
        // Пытаемся извлечь точки из общего объекта
        analysis.points = [];
       
        // Проверяем различные возможные структуры
        if (obj.points && Array.isArray(obj.points)) {
            analysis.points = obj.points;
        } else if (obj.nodes && typeof obj.nodes === 'object') {
            // Возможно, это граф
            analysis.points = this.extractPointsFromGraph(obj);
        }
       
        analysis.pointCount = analysis.points.length;
        analysis.hasPoints = analysis.pointCount > 0;
       
        // Трансформация
        if (obj.transformation) {
            analysis.transformation = obj.transformation;
        }
       
        // Выбираем образцы
        analysis.samples = this.getPointSamples(analysis.points);
       
        // Вычисляем границы и центр
        if (analysis.points.length > 0) {
            analysis.bounds = this.calculateBounds(analysis.points);
            analysis.center = this.calculateCenter(analysis.points);
        }
    }
   
    // 🔥 МЕТОД: Печать анализа объекта
    printObjectAnalysis(analysis) {
        const statusColor = analysis.issues.length > 0 ? 'red' : 'green';
        const statusIcon = analysis.issues.length > 0 ? '⚠️' : '✅';
       
        console.log(`  ${this.colorize(`${analysis.index}.`, 'dim')} ${this.colorize(analysis.id, 'bright')} ${this.colorize(`[${analysis.type}]`, 'blue')}`);
       
        // Основная информация
        console.log(`     ${this.colorize('Тип:', 'dim')} ${analysis.type}`);
        console.log(`     ${this.colorize('Точки:', 'dim')} ${analysis.pointCount} ${analysis.hasPoints ? this.colorize('✓', 'green') : this.colorize('✗', 'red')}`);
       
        if (analysis.pointCount > 0) {
            console.log(`     ${this.colorize('Система координат:', 'dim')} ${this.colorize(analysis.coordinateSystem, 'cyan')}`);
           
            if (analysis.bounds) {
                console.log(`     ${this.colorize('Границы:', 'dim')} ${analysis.bounds.width.toFixed(1)}x${analysis.bounds.height.toFixed(1)}`);
                console.log(`     ${this.colorize('Центр:', 'dim')} (${analysis.center.x.toFixed(1)}, ${analysis.center.y.toFixed(1)})`);
            }
           
            if (analysis.transformation) {
                const angle = analysis.transformation.rotationAngle || 0;
                console.log(`     ${this.colorize('Трансформация:', 'dim')} ${angle.toFixed(1)}°`);
            }
           
            // Примеры точек
            if (this.config.includeSamples > 0 && analysis.samples.length > 0) {
                console.log(`     ${this.colorize('Примеры точек:', 'dim')}`);
                analysis.samples.forEach((sample, i) => {
                    let pointInfo = `       ${i + 1}. (${sample.x.toFixed(1)}, ${sample.y.toFixed(1)})`;
                    if (sample.confidence !== undefined) {
                        pointInfo += ` conf=${sample.confidence.toFixed(2)}`;
                    }
                    if (sample.confirmedCount !== undefined && sample.confirmedCount > 1) {
                        pointInfo += ` conf×${sample.confirmedCount}`;
                    }
                    console.log(this.colorize(pointInfo, 'gray'));
                });
            }
        }
       
        // Проблемы
        if (analysis.issues.length > 0) {
            console.log(`     ${this.colorize('Проблемы:', 'red')}`);
            analysis.issues.forEach((issue, i) => {
                console.log(`       ${this.colorize('•', 'red')} ${issue}`);
            });
        }
       
        console.log(); // Пустая строка
    }
   
    // 🔥 МЕТОД: Сравнить объекты
    logComparison(objects) {
        if (objects.length < 2) return;
       
        console.log(this.colorize('  🔄 СРАВНЕНИЕ:', 'yellow'));
       
        const analyses = objects.map((obj, i) => this.analyzeObject(obj, i + 1));
       
        // Сравниваем количество точек
        const pointCounts = analyses.map(a => a.pointCount);
        const maxPoints = Math.max(...pointCounts);
        const minPoints = Math.min(...pointCounts);
       
        if (maxPoints !== minPoints) {
            console.log(this.colorize(`    Разное количество точек: ${minPoints} - ${maxPoints}`, 'yellow'));
        }
       
        // Сравниваем системы координат
        const systems = analyses.map(a => a.coordinateSystem);
        const uniqueSystems = [...new Set(systems)];
       
        if (uniqueSystems.length > 1) {
            console.log(this.colorize(`    Разные системы координат: ${uniqueSystems.join(', ')}`, 'yellow'));
        } else {
            console.log(this.colorize(`    Единая система координат: ${uniqueSystems[0]}`, 'green'));
        }
       
        // Сравниваем центры
        const centers = analyses.filter(a => a.center).map(a => a.center);
        if (centers.length >= 2) {
            const centerDistances = [];
            for (let i = 0; i < centers.length; i++) {
                for (let j = i + 1; j < centers.length; j++) {
                    const dist = Math.sqrt(
                        Math.pow(centers[j].x - centers[i].x, 2) +
                        Math.pow(centers[j].y - centers[i].y, 2)
                    );
                    centerDistances.push(dist);
                }
            }
           
            const maxCenterDist = Math.max(...centerDistances);
            if (maxCenterDist > 50) {
                console.log(this.colorize(`    Центры далеко: до ${maxCenterDist.toFixed(1)}px`, 'yellow'));
            }
        }
    }
   
    // 🔥 МЕТОД: Логировать одиночную трансформацию
    logSingleTransformation(transform, index) {
        if (!transform) {
            console.log(this.colorize(`  ${index}. [NO TRANSFORMATION]`, 'red'));
            return;
        }
       
        console.log(`  ${this.colorize(`${index}.`, 'dim')} ${transform.type || 'transformation'}`);
       
        if (transform.rotationAngle !== undefined) {
            console.log(`     ${this.colorize('Угол:', 'dim')} ${transform.rotationAngle.toFixed(1)}°`);
        }
       
        if (transform.center) {
            console.log(`     ${this.colorize('Центр:', 'dim')} (${transform.center.x?.toFixed(1) || 0}, ${transform.center.y?.toFixed(1) || 0})`);
        }
       
        if (transform.scale) {
            console.log(`     ${this.colorize('Масштаб:', 'dim')} (${transform.scale.x?.toFixed(2) || 1}, ${transform.scale.y?.toFixed(2) || 1})`);
        }
       
        if (transform.isMirrored !== undefined) {
            console.log(`     ${this.colorize('Зеркало:', 'dim')} ${transform.isMirrored ? 'да' : 'нет'}`);
        }
       
        if (transform.matrix && Array.isArray(transform.matrix)) {
            const matrixValid = this.isMatrixValid(transform.matrix);
            const status = matrixValid ? this.colorize('валидна', 'green') : this.colorize('невалидна', 'red');
            console.log(`     ${this.colorize('Матрица:', 'dim')} ${status}`);
        }
       
        // Дополнительные поля
        const extraFields = ['timestamp', 'source', 'footType', 'photoId'];
        extraFields.forEach(field => {
            if (transform[field] !== undefined) {
                console.log(`     ${this.colorize(field + ':', 'dim')} ${transform[field]}`);
            }
        });
    }
   
    // 🔥 МЕТОД: Сравнить трансформации
    compareTransformations(transformations) {
        if (transformations.length < 2) return;
       
        console.log(this.colorize('\n  🔄 СРАВНЕНИЕ ТРАНСФОРМАЦИЙ:', 'yellow'));
       
        // Сравниваем углы
        const angles = transformations.map(t => t.rotationAngle || 0);
        const angleDiff = Math.max(...angles) - Math.min(...angles);
       
        if (angleDiff > 5) {
            console.log(this.colorize(`    Разные углы: ${angles.map(a => a.toFixed(1) + '°').join(', ')}`, 'yellow'));
        }
       
        // Сравниваем центры
        const centers = transformations.filter(t => t.center).map(t => t.center);
        if (centers.length >= 2) {
            let maxDist = 0;
            for (let i = 0; i < centers.length; i++) {
                for (let j = i + 1; j < centers.length; j++) {
                    const dist = Math.sqrt(
                        Math.pow(centers[j].x - centers[i].x, 2) +
                        Math.pow(centers[j].y - centers[i].y, 2)
                    );
                    maxDist = Math.max(maxDist, dist);
                }
            }
           
            if (maxDist > 20) {
                console.log(this.colorize(`    Центры различаются: до ${maxDist.toFixed(1)}px`, 'yellow'));
            }
        }
    }
   
    // 🔥 МЕТОД: Распечатать диагностический отчет
    printDiagnosticReport(report) {
        console.log(`${this.colorize('📅 Время отчета:', 'dim')} ${new Date(report.timestamp).toLocaleString('ru-RU')}`);
        console.log(`${this.colorize('👤 Пользователь:', 'dim')} ${report.userId || 'не указан'}`);
       
        console.log(this.colorize('\n📊 СТАТИСТИКА СИСТЕМЫ:', 'cyan'));
        console.log(`  ${this.colorize('•', 'green')} Сессий: ${report.sessions.length}`);
        console.log(`  ${this.colorize('•', 'green')} Моделей: ${report.models.length}`);
        console.log(`  ${this.colorize('•', 'green')} Шаблонов: ${report.templates.length}`);
        console.log(`  ${this.colorize('•', 'green')} Записей в истории: ${report.loggingHistory?.total || 0}`);
       
        if (report.sessions.length > 0) {
            console.log(this.colorize('\n🎯 АКТИВНАЯ СЕССИЯ:', 'cyan'));
            report.sessions.forEach(session => {
                console.log(`  ${this.colorize('•', 'blue')} ID: ${session.id}`);
                console.log(`    Точки: ${session.pointCount}`);
                console.log(`    Фото: ${session.photoCount}`);
                if (session.transformation) {
                    console.log(`    Трансформация: ${session.transformation.rotationAngle?.toFixed(1) || 0}°`);
                }
            });
        }
       
        if (report.models.length > 0) {
            console.log(this.colorize('\n🗂️ ЗАГРУЖЕННЫЕ МОДЕЛИ:', 'cyan'));
            const totalPoints = report.models.reduce((sum, model) => sum + model.pointCount, 0);
            console.log(`  ${this.colorize('•', 'blue')} Всего моделей: ${report.models.length}`);
            console.log(`  ${this.colorize('•', 'blue')} Всего точек: ${totalPoints}`);
        }
       
        if (report.templates.length > 0) {
            console.log(this.colorize('\n🏗️ ШАБЛОНЫ:', 'cyan'));
            report.templates.forEach(template => {
                console.log(`  ${this.colorize('•', 'blue')} ${template.name}`);
                console.log(`    Ячеек: ${template.cellCount}`);
                console.log(`    Подтверждений: ${template.totalConfirmations}`);
                console.log(`    Качество эталона: ${template.referenceQuality?.toFixed(3) || 0}`);
            });
        }
       
        if (report.issues.length > 0) {
            console.log(this.colorize('\n⚠️ ОБНАРУЖЕННЫЕ ПРОБЛЕМЫ:', 'red'));
            report.issues.forEach((issue, index) => {
                console.log(`  ${this.colorize(`${index + 1}.`, 'red')} ${issue.type}: ${issue.description}`);
                if (issue.details) {
                    console.log(`     ${this.colorize('Детали:', 'dim')} ${issue.details}`);
                }
            });
        } else {
            console.log(this.colorize('\n✅ ПРОБЛЕМ НЕ ОБНАРУЖЕНО', 'green'));
        }
       
        // Рекомендации
        console.log(this.colorize('\n💡 РЕКОМЕНДАЦИИ:', 'yellow'));
        if (report.models.length === 0) {
            console.log(`  ${this.colorize('•', 'yellow')} Нет загруженных моделей. Проверьте папку models/`);
        }
        if (report.templates.length === 0 && report.userId) {
            console.log(`  ${this.colorize('•', 'yellow')} Нет шаблона для пользователя. Создайте первый отпечаток.`);
        }
        if (report.issues.some(i => i.type === 'coordinate_mismatch')) {
            console.log(`  ${this.colorize('•', 'yellow')} Обнаружены расхождения координат. Запустите TransformationValidator.`);
        }
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
   
    getObjectType(obj) {
        if (this.isFootprint(obj)) return 'footprint';
        if (this.isGraph(obj)) return 'graph';
        if (this.isPointTracker(obj)) return 'pointTracker';
        if (this.isTemplateBuilder(obj)) return 'templateBuilder';
        if (Array.isArray(obj)) return 'pointsArray';
        if (obj && typeof obj === 'object') return 'object';
        return typeof obj;
    }
   
    isFootprint(obj) {
        return obj && (obj.constructor?.name === 'SimpleFootprint' || obj.graph !== undefined);
    }
   
    isGraph(obj) {
        return obj && (obj.constructor?.name === 'SimpleGraph' || obj.nodes !== undefined);
    }
   
    isPointTracker(obj) {
        return obj && (obj.constructor?.name === 'PointTracker' ||
                      (obj.points !== undefined && typeof obj.points.get === 'function'));
    }
   
    isTemplateBuilder(obj) {
        return obj && (obj.constructor?.name === 'TemplateBuilder' || obj.invariantCells !== undefined);
    }
   
    extractPointsFromPointTracker(tracker) {
        const points = [];
        if (tracker && tracker.points) {
            for (const [id, point] of tracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || 0.5,
                    confirmedCount: point.confirmedCount || 1,
                    _source: 'pointTracker'
                });
            }
        }
        return points;
    }
   
    extractPointsFromGraph(graph) {
        const points = [];
        if (graph && graph.nodes) {
            graph.nodes.forEach((node, nodeId) => {
                points.push({
                    id: nodeId,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5,
                    confirmedCount: node.confirmedCount || 1,
                    _source: 'graph'
                });
            });
        }
        return points;
    }
   
    getPointSamples(points) {
        if (!points || points.length === 0) return [];
       
        const sampleCount = Math.min(this.config.includeSamples, points.length);
        const step = Math.max(1, Math.floor(points.length / sampleCount));
       
        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
            const index = Math.min(i * step, points.length - 1);
            samples.push(points[index]);
        }
       
        return samples;
    }
   
    calculateBounds(points) {
        if (!points || points.length === 0) {
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
        if (!points || points.length === 0) return { x: 0, y: 0 };
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }
   
    calculateAverage(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
   
    detectCoordinateSystem(analysis) {
        if (analysis.type === 'templateBuilder') return 'template';
        if (analysis.type === 'pointTracker') return 'tracker';
        if (analysis.type === 'graph') return 'graph';
       
        // Эвристики для точек
        if (analysis.points && analysis.points.length > 0) {
            return this.detectCoordinateSystemFromPoints(analysis.points);
        }
       
        return 'unknown';
    }
   
    detectCoordinateSystemFromPoints(points) {
        if (!points || points.length === 0) return 'unknown';
       
        const sample = points[0];
       
        // Проверяем метаданные
        if (sample.coordinateSystem) return sample.coordinateSystem;
        if (sample._normalized || sample.nx !== undefined) return 'normalized';
        if (sample._template || sample.cellId !== undefined) return 'template';
        if (sample._tracker || sample.confirmedCount !== undefined) return 'tracker';
       
        // Эвристики по значениям
        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        // Normalized точки обычно вокруг 500,500
        if (Math.abs(avgX - 500) < 100 && Math.abs(avgY - 500) < 100) {
            return 'normalized';
        }
       
        return 'original';
    }
   
    isMatrixValid(matrix) {
        if (!Array.isArray(matrix) || matrix.length !== 9) return false;
       
        // Проверяем на NaN и Infinity
        for (const value of matrix) {
            if (isNaN(value) || !isFinite(value)) return false;
        }
       
        // Проверяем, что матрица не нулевая
        const sum = matrix.reduce((s, v) => s + Math.abs(v), 0);
        if (sum < 0.001) return false;
       
        return true;
    }
   
    checkFootprintIssues(footprint, analysis) {
        // Проверяем расхождения между трекером и графом
        if (footprint.pointTracker && footprint.graph) {
            const trackerPoints = this.extractPointsFromPointTracker(footprint.pointTracker);
            const graphPoints = this.extractPointsFromGraph(footprint.graph);
           
            if (trackerPoints.length !== graphPoints.length) {
                analysis.issues.push(`Разное количество точек: трекер=${trackerPoints.length}, граф=${graphPoints.length}`);
            }
        }
       
        // Проверяем трансформации
        const transformations = [];
        if (footprint.transformation) transformations.push(footprint.transformation);
        if (footprint.metadata?.normalizationInfo) transformations.push(footprint.metadata.normalizationInfo);
       
        if (transformations.length >= 2) {
            // Проверяем согласованность
            const angle1 = transformations[0].rotationAngle || 0;
            const angle2 = transformations[1].rotationAngle || 0;
           
            if (Math.abs(angle1 - angle2) > 5) {
                analysis.issues.push(`Разные углы трансформации: ${angle1.toFixed(1)}° vs ${angle2.toFixed(1)}°`);
            }
        }
    }
   
    colorize(text, color) {
        if (!this.config.colorize || !this.colors[color]) return text;
        return `${this.colors[color]}${text}${this.colors.reset}`;
    }
   
    logToFile(title, objects) {
        try {
            const fs = require('fs');
            const path = require('path');
           
            // Создаем директорию логов
            const logDir = path.dirname(this.config.filePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
           
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                title,
                objects: objects.map(obj => ({
                    type: this.getObjectType(obj),
                    id: obj?.id || obj?.name || 'unknown'
                }))
            };
           
            // Форматируем запись
            const logLine = `${timestamp} - ${title}\n`;
           
            // Добавляем в файл
            fs.appendFileSync(this.config.filePath, logLine, 'utf8');
           
        } catch (error) {
            console.log(this.colorize(`⚠️ Ошибка записи в лог-файл: ${error.message}`, 'red'));
        }
    }
   
    // 🔥 МЕТОДЫ ДЛЯ ДИАГНОСТИЧЕСКОГО ОТЧЕТА
   
    getSystemInfo() {
        return {
            nodeVersion: process.version,
            platform: process.platform,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }
   
    analyzeSession(session) {
        return {
            id: session.id,
            name: session.name,
            pointCount: session.currentFootprint?.graph?.nodes?.size || 0,
            photoCount: session.photos?.length || 0,
            transformation: session.metadata?.lastTransformation,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity
        };
    }
   
    analyzeLoadedModels() {
        const models = [];
       
        if (this.manager.loadedModels) {
            this.manager.loadedModels.forEach((footprint, id) => {
                const points = this.extractPointsFromGraph(footprint.graph);
                models.push({
                    id: id.substring(0, 8),
                    name: footprint.name,
                    pointCount: points.length,
                    confidence: footprint.stats?.confidence || 0,
                    createdAt: footprint.metadata?.created
                });
            });
        }
       
        return models;
    }
   
    analyzeTemplate(templateBuilder) {
        if (!templateBuilder) return null;
       
        const templateData = templateBuilder.getVisualizationData?.();
        const stats = templateData?.stats || {};
       
        return {
            name: templateBuilder.name,
            id: templateBuilder.id.substring(0, 8),
            cellCount: templateData?.cells?.length || 0,
            totalConfirmations: stats.totalConfirmations || 0,
            referenceQuality: templateBuilder.referenceGraphQuality,
            referenceGraphId: templateBuilder.referenceGraphId?.substring(0, 8)
        };
    }
   
    analyzeHistory() {
        return {
            total: this.history.length,
            lastEntry: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
            objectTypes: [...new Set(this.history.map(h => h.type))]
        };
    }
   
    findSystemIssues(report) {
        const issues = [];
       
        // Проверяем расхождения в системах координат
        const allSystems = [
            ...report.sessions.map(s => s.transformation?.type),
            ...report.templates.map(t => 'template'),
            ...report.models.map(m => 'model')
        ].filter(Boolean);
       
        const uniqueSystems = [...new Set(allSystems)];
        if (uniqueSystems.length > 3) {
            issues.push({
                type: 'coordinate_mismatch',
                description: 'Много разных систем координат',
                details: `Найдено ${uniqueSystems.length} различных систем: ${uniqueSystems.join(', ')}`
            });
        }
       
        // Проверяем нулевые точки
        if (report.models.some(m => m.pointCount === 0)) {
            issues.push({
                type: 'empty_model',
                description: 'Есть пустые модели',
                details: `${report.models.filter(m => m.pointCount === 0).length} моделей без точек`
            });
        }
       
        // Проверяем историю логирования
        if (report.loggingHistory.total === 0) {
            issues.push({
                type: 'no_logging',
                description: 'Нет записей в истории логирования',
                details: 'CoordinateSystemLogger не использовался'
            });
        }
       
        return issues;
    }
   
    saveDiagnosticReport(report) {
        try {
            const fs = require('fs');
            const path = require('path');
           
            const reportsDir = path.join(this.manager.config.dbPath, 'diagnostic_reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
           
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `coordinate-diagnostic-${timestamp}.json`;
            const filepath = path.join(reportsDir, filename);
           
            fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
            console.log(this.colorize(`📄 Диагностический отчет сохранен: ${filepath}`, 'green'));
           
        } catch (error) {
            console.log(this.colorize(`⚠️ Не удалось сохранить отчет: ${error.message}`, 'red'));
        }
    }
   
    // 🔥 МЕТОДЫ ДЛЯ СРАВНЕНИЯ
   
    printSummary(analysis) {
        console.log(`  ${this.colorize('Тип:', 'dim')} ${analysis.type}`);
        console.log(`  ${this.colorize('Точки:', 'dim')} ${analysis.pointCount}`);
        console.log(`  ${this.colorize('Система:', 'dim')} ${analysis.coordinateSystem}`);
       
        if (analysis.bounds) {
            console.log(`  ${this.colorize('Размер:', 'dim')} ${analysis.bounds.width.toFixed(1)}x${analysis.bounds.height.toFixed(1)}`);
        }
       
        if (analysis.transformation) {
            console.log(`  ${this.colorize('Угол:', 'dim')} ${analysis.transformation.rotationAngle?.toFixed(1) || 0}°`);
        }
    }
   
    compareAnalyses(analysis1, analysis2) {
        // Сравниваем количество точек
        if (analysis1.pointCount !== analysis2.pointCount) {
            const diff = Math.abs(analysis1.pointCount - analysis2.pointCount);
            console.log(this.colorize(`  Разное количество точек: ${analysis1.pointCount} vs ${analysis2.pointCount} (разница: ${diff})`, 'yellow'));
        } else {
            console.log(this.colorize(`  Одинаковое количество точек: ${analysis1.pointCount}`, 'green'));
        }
       
        // Сравниваем системы координат
        if (analysis1.coordinateSystem !== analysis2.coordinateSystem) {
            console.log(this.colorize(`  Разные системы координат: ${analysis1.coordinateSystem} vs ${analysis2.coordinateSystem}`, 'yellow'));
        } else {
            console.log(this.colorize(`  Одинаковая система координат: ${analysis1.coordinateSystem}`, 'green'));
        }
       
        // Сравниваем центры
        if (analysis1.center && analysis2.center) {
            const dist = Math.sqrt(
                Math.pow(analysis2.center.x - analysis1.center.x, 2) +
                Math.pow(analysis2.center.y - analysis1.center.y, 2)
            );
           
            if (dist > 50) {
                console.log(this.colorize(`  Центры далеко: ${dist.toFixed(1)}px`, 'yellow'));
            } else {
                console.log(this.colorize(`  Центры близко: ${dist.toFixed(1)}px`, 'green'));
            }
        }
    }
   
    detailedComparison(analysis1, analysis2) {
        // Сравниваем границы
        if (analysis1.bounds && analysis2.bounds) {
            const widthDiff = Math.abs(analysis2.bounds.width - analysis1.bounds.width);
            const heightDiff = Math.abs(analysis2.bounds.height - analysis1.bounds.height);
           
            console.log(`  Размеры: ${analysis1.bounds.width.toFixed(1)}x${analysis1.bounds.height.toFixed(1)} vs ${analysis2.bounds.width.toFixed(1)}x${analysis2.bounds.height.toFixed(1)}`);
            console.log(`  Разница: ${widthDiff.toFixed(1)}px по ширине, ${heightDiff.toFixed(1)}px по высоте`);
        }
       
        // Сравниваем трансформации
        if (analysis1.transformation && analysis2.transformation) {
            const angle1 = analysis1.transformation.rotationAngle || 0;
            const angle2 = analysis2.transformation.rotationAngle || 0;
            const angleDiff = Math.abs(angle1 - angle2);
           
            console.log(`  Углы: ${angle1.toFixed(1)}° vs ${angle2.toFixed(1)}° (разница: ${angleDiff.toFixed(1)}°)`);
           
            if (angleDiff > 10) {
                console.log(this.colorize(`    ⚠️ Большая разница в углах!`, 'red'));
            }
        }
       
        // Сравниваем примеры точек
        if (analysis1.samples.length > 0 && analysis2.samples.length > 0) {
            console.log('  Примеры точек:');
            const minSamples = Math.min(analysis1.samples.length, analysis2.samples.length);
           
            for (let i = 0; i < minSamples; i++) {
                const p1 = analysis1.samples[i];
                const p2 = analysis2.samples[i];
                const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
               
                console.log(`    ${i + 1}. (${p1.x.toFixed(1)}, ${p1.y.toFixed(1)}) vs (${p2.x.toFixed(1)}, ${p2.y.toFixed(1)}) = ${dist.toFixed(1)}px`);
            }
        }
    }
   
    findDifferences(analysis1, analysis2) {
        const differences = [];
       
        if (analysis1.pointCount !== analysis2.pointCount) {
            differences.push({
                type: 'point_count',
                value1: analysis1.pointCount,
                value2: analysis2.pointCount,
                diff: Math.abs(analysis1.pointCount - analysis2.pointCount)
            });
        }
       
        if (analysis1.coordinateSystem !== analysis2.coordinateSystem) {
            differences.push({
                type: 'coordinate_system',
                value1: analysis1.coordinateSystem,
                value2: analysis2.coordinateSystem
            });
        }
       
        if (analysis1.center && analysis2.center) {
            const dist = Math.sqrt(
                Math.pow(analysis2.center.x - analysis1.center.x, 2) +
                Math.pow(analysis2.center.y - analysis1.center.y, 2)
            );
           
            if (dist > 10) {
                differences.push({
                    type: 'center_distance',
                    value1: analysis1.center,
                    value2: analysis2.center,
                    distance: dist
                });
            }
        }
       
        return differences;
    }
}

module.exports = CoordinateSystemLogger;
