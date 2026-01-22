// modules/footprint/rotation-invariance.js
// АВТООПРЕДЕЛЕНИЕ УГЛА ПОВОРОТА И НОРМАЛИЗАЦИЯ ПРОТЕКТОРА (ВЕРСИЯ С ИСПРАВЛЕНИЯМИ)

class RotationInvariance {
    constructor(options = {}) {
        this.config = {
            canonicalOrientation: 'horizontal',
            rotationStep: 15,
            maxRotationAngle: 180,
            enableAutoRotation: true,
            debug: options.debug || false, // 🔥 ПО УМОЛЧАНИЮ false (убираем шум)
            verbose: options.verbose || false,
            ...options
        };

        if (this.config.debug) {
            console.log('🎯 RotationInvariance инициализирован (режим отладки ВКЛЮЧЕН)');
        }
    }

    // 🔥 ДОБАВЛЕН МЕТОД: safeToFixed()
    safeToFixed(value, decimals = 1) {
        if (value === undefined || value === null || isNaN(value)) {
            return '0.0';
        }
        const num = Number(value);
        if (isNaN(num)) {
            return '0.0';
        }
        return num.toFixed(decimals);
    }

    // 🔥 НОВЫЙ МЕТОД: Нормализация с сохранением относительных пропорций
    normalizeWithRelativePreservation(graph, metadata = {}) {
        if (this.config.debug) {
            console.log(`\n🔄 НОРМАЛИЗАЦИЯ С СОХРАНЕНИЕМ ПРОПОРЦИЙ:`);
        }

        const points = this.extractPointsFromGraph(graph);

        // 1. Определяем текущий угол
        const rotationAngle = this.detectRotationAngle(points);

        // 2. Находим bounding box ДО поворота
        const originalBounds = this.calculateBounds(points);
        const originalCenter = this.calculateCenter(points);
        const originalRatio = originalBounds.width / Math.max(1, originalBounds.height);

        if (this.config.debug) {
            console.log(`📐 Оригинальные пропорции: ${originalBounds.width.toFixed(1)}x${originalBounds.height.toFixed(1)} (ratio: ${originalRatio.toFixed(2)})`);
        }

        // 3. Нормализуем как обычно
        const normalized = this.normalizeToCanonical(graph, metadata);

        // 4. Находим bounding box ПОСЛЕ поворота
        const normalizedPoints = this.extractPointsFromGraph(normalized.graph);
        const normalizedBounds = this.calculateBounds(normalizedPoints);
        const normalizedRatio = normalizedBounds.width / Math.max(1, normalizedBounds.height);

        if (this.config.debug) {
            console.log(`📐 Нормализованные пропорции: ${normalizedBounds.width.toFixed(1)}x${normalizedBounds.height.toFixed(1)} (ratio: ${normalizedRatio.toFixed(2)})`);
        }

        // 5. Если пропорции сильно изменились - ПОВОРАЧИВАЕМ НА 90°
        const ratioChange = Math.abs(originalRatio - normalizedRatio);
        const shouldRotate90 = ratioChange > 1.5 && Math.abs(rotationAngle - 90) < 45;

        if (shouldRotate90) {
            console.log(`🔄 Обнаружен поворот на ~90°, применяю дополнительную коррекцию`);

            // Поворачиваем на 90°
            const rotatedGraph = this.rotateGraph(normalized.graph, 90, false);

            // Обновляем трансформацию
            rotatedGraph.transformation = {
                ...normalized.transformation,
                rotationAngle: rotationAngle - 90,
                additionalRotation: 90,
                preservedOriginalRatio: originalRatio
            };

            return {
                ...normalized,
                graph: rotatedGraph,
                rotationAngle: rotationAngle - 90,
                correctionApplied: '90_degree_rotation'
            };
        }

        return {
            ...normalized,
            preservedOriginalRatio: originalRatio
        };
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: Нормализация с сохранением трансформации И ЗАЩИТОЙ ОТ НУЛЕВОЙ МАТРИЦЫ
    normalizeToCanonical(graph, metadata = {}) {
        if (this.config.debug) {
            console.log(`\n🔄 ========== НАЧАЛО НОРМАЛИЗАЦИИ ==========`);
            console.log(`🔄 Граф: "${graph.name || 'без имени'}"`);
            console.log(`🔄 Количество узлов: ${graph.nodes ? graph.nodes.size : 0}`);
        }

        // Извлечь точки из графа
        const points = this.extractPointsFromGraph(graph);

        if (points.length < 3) {
            console.log('⚠️ Недостаточно точек для определения ориентации');
            return {
                graph,
                rotationAngle: 0,
                isMirrored: false,
                transformation: this.createIdentityTransformation(),
                originalGraph: graph
            };
        }

        // 🔥 ОТЛАДКА: Выводим первые 3 точки до нормализации
        if (this.config.verbose && points.length > 0) {
            console.log(`🔍 ТОЧКИ ДО НОРМАЛИЗАЦИИ (первые 3 из ${points.length}):`);
            points.slice(0, 3).forEach((p, i) => {
                console.log(`   Точка ${i}: (${this.safeToFixed(p.x)}, ${this.safeToFixed(p.y)})`);
            });
        }

        // 1. Определить текущий угол поворота
        const rotationAngleResult = this.detectRotationAngle(points);
        const rotationAngle = rotationAngleResult.angle || rotationAngleResult;
        
        if (this.config.debug) {
            console.log(`📐 ОПРЕДЕЛЁН УГОЛ ПОВОРОТА: ${this.safeToFixed(rotationAngle)}°`);
        }

        // 2. Определить зеркальность
        const mirrorInfo = this.detectMirroring(points);
        if (this.config.debug) {
            console.log(`🪞 ЗЕРКАЛЬНОСТЬ: ${mirrorInfo.isMirrored ? 'ЗЕРКАЛЬНЫЙ' : 'ОРИГИНАЛ'}`);
        }

        // 3. Рассчитать масштаб и центр
        const bounds = this.calculateBounds(points);
        const center = this.calculateCenter(points);
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);

        if (this.config.debug) {
            console.log(`📊 ПАРАМЕТРЫ ДО НОРМАЛИЗАЦИИ:`);
            console.log(`   Центр: (${this.safeToFixed(center.x)}, ${this.safeToFixed(center.y)})`);
            console.log(`   Границы: X[${this.safeToFixed(bounds.minX)}-${this.safeToFixed(bounds.maxX)}], Y[${this.safeToFixed(bounds.minY)}-${this.safeToFixed(bounds.maxY)}]`);
            console.log(`   Размеры: ${this.safeToFixed(width)}x${this.safeToFixed(height)}`);
        }

        // 4. 🔥 СОЗДАЕМ ТРАНСФОРМАЦИЮ С ЗАЩИТОЙ ОТ НУЛЕВОЙ МАТРИЦЫ
        const transformation = this.createTransformation(
            rotationAngle,
            mirrorInfo.isMirrored,
            center,
            bounds,
            width,
            height
        );

        // 🔥 ПРОВЕРКА МАТРИЦЫ НА ПРОБЛЕМЫ
        if (!this.validateMatrix(transformation.matrix)) {
            console.log(`⚠️ Проблема с матрицей трансформации, использую единичную`);
            transformation = this.createIdentityTransformation();
            transformation.rotationAngle = rotationAngle; // Сохраняем угол для информации
        }

        if (this.config.debug) {
            console.log(`🔧 СОЗДАНА ТРАНСФОРМАЦИЯ:`);
            console.log(`   Матрица: [${transformation.matrix.map(v => v.toFixed(4)).join(', ')}]`);
            console.log(`   Угол в трансформации: ${this.safeToFixed(transformation.rotationAngle)}°`);
        }

        // 5. Повернуть граф к канонической ориентации
        if (this.config.debug) {
            console.log(`🔄 ВЫПОЛНЯЮ ПОВОРОТ НА ${this.safeToFixed(-rotationAngle)}°...`);
        }
        
        const normalizedGraph = this.rotateGraphWithTransformation(
            graph,
            transformation,
            mirrorInfo.isMirrored
        );

        // 6. Перестроить связи после поворота
        this.rebuildEdges(normalizedGraph);

        // 7. 🔥 СОХРАНЯЕМ ТРАНСФОРМАЦИЮ В ГРАФЕ
        normalizedGraph.transformation = transformation;
        normalizedGraph.originalGraphId = graph.id;
        normalizedGraph.originalBounds = bounds;
        normalizedGraph.originalCenter = center;

        // 8. Сохранить метаданные поворота
        normalizedGraph.rotationMetadata = {
            originalAngle: rotationAngle,
            normalizedAngle: 0,
            isMirrored: mirrorInfo.isMirrored,
            footType: mirrorInfo.footType,
            transformation: transformation,
            normalizationDate: new Date(),
            ...metadata
        };

        // 🔥 ОТЛАДКА: Выводим точки после нормализации
        const normalizedPoints = this.extractPointsFromGraph(normalizedGraph);
        if (this.config.verbose && normalizedPoints.length > 0) {
            console.log(`🔍 ТОЧКИ ПОСЛЕ НОРМАЛИЗАЦИИ (первые 3 из ${normalizedPoints.length}):`);
            normalizedPoints.slice(0, 3).forEach((p, i) => {
                console.log(`   Точка ${i}: (${this.safeToFixed(p.x)}, ${this.safeToFixed(p.y)})`);

                // Сравниваем с исходными точками
                if (i < points.length) {
                    const dx = p.x - points[i].x;
                    const dy = p.y - points[i].y;
                    console.log(`        ΔX: ${this.safeToFixed(dx)}, ΔY: ${this.safeToFixed(dy)}`);
                }
            });
        }

        // Проверяем угол после нормализации
        const angleAfterNormalization = this.detectRotationAngle(normalizedPoints);
        if (this.config.debug) {
            console.log(`📐 УГОЛ ПОСЛЕ НОРМАЛИЗАЦИИ: ${this.safeToFixed(angleAfterNormalization)}°`);
        }

        // 🔥 ШАГ 8: ЦЕНТРИРОВАНИЕ К СТАНДАРТНОЙ СИСТЕМЕ КООРДИНАТ
        if (this.config.debug) {
            console.log(`🎯 ЦЕНТРИРУЮ СЛЕД К СТАНДАРТНОЙ СИСТЕМЕ...`);
        }

        // Определяем целевой центр
        const TARGET_CENTER = { x: 500, y: 500 };

        // Получаем текущий центр после поворота
        const rotatedPoints = this.extractPointsFromGraph(normalizedGraph);
        const currentCenter = this.calculateCenter(rotatedPoints);

        // Вычисляем смещение
        const offsetX = TARGET_CENTER.x - currentCenter.x;
        const offsetY = TARGET_CENTER.y - currentCenter.y;

        // Применяем смещение ко всем узлам
        normalizedGraph.nodes.forEach((node, nodeId) => {
            node.x += offsetX;
            node.y += offsetY;
        });

        // Обновляем трансформацию
        transformation.center = TARGET_CENTER;
        transformation.offsetApplied = { x: offsetX, y: offsetY };
        transformation.originalCenter = currentCenter;

        if (this.config.debug) {
            console.log(`✅ ========== НОРМАЛИЗАЦИЯ ЗАВЕРШЕНА ==========`);
            console.log(`   Поворот: ${this.safeToFixed(rotationAngle)}° → ${this.safeToFixed(angleAfterNormalization)}°`);
            console.log(`   Зеркало: ${mirrorInfo.isMirrored ? 'ДА' : 'НЕТ'}`);
            console.log(`   Центр сохранен: (${this.safeToFixed(center.x)}, ${this.safeToFixed(center.y)})`);
        }

        return {
            graph: normalizedGraph,
            rotationAngle: rotationAngle,
            isMirrored: mirrorInfo.isMirrored,
            footType: mirrorInfo.footType,
            transformation: transformation,
            metadata: normalizedGraph.rotationMetadata,
            originalGraph: graph
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Создание трансформации С ЗАЩИТОЙ ОТ НУЛЕВОЙ МАТРИЦЫ
    createTransformation(rotationAngle, isMirrored, center, bounds, width, height) {
        if (this.config.debug) {
            console.log(`\n🔧 СОЗДАНИЕ ТРАНСФОРМАЦИИ:`);
            console.log(`   Входной угол: ${this.safeToFixed(rotationAngle)}°`);
            console.log(`   Зеркало: ${isMirrored}`);
            console.log(`   Центр: (${this.safeToFixed(center.x)}, ${this.safeToFixed(center.y)})`);
        }

        // 🔥 ЗАЩИТА ОТ НУЛЕВОГО УГЛА И НУЛЕВЫХ СИНУСОВ/КОСИНУСОВ
        const safeAngle = Math.abs(rotationAngle) < 0.1 ? 0 : rotationAngle;
        
        if (safeAngle === 0 && !isMirrored) {
            if (this.config.debug) {
                console.log(`🔧 Угол = 0° и нет зеркала, возвращаю единичную матрицу`);
            }
            return this.createIdentityTransformation();
        }

        const angleRad = safeAngle * (Math.PI / 180);
        const cosA = Math.cos(-angleRad); // Отрицательный угол для нормализации
        const sinA = Math.sin(-angleRad);

        // 🔥 ЗАЩИТА ОТ НУЛЕВЫХ ИЛИ ОЧЕНЬ МАЛЫХ ЗНАЧЕНИЙ
        const safeCosA = Math.abs(cosA) < 0.001 ? 1.0 : cosA;
        const safeSinA = Math.abs(sinA) < 0.001 ? 0.0 : sinA;

        if (this.config.debug) {
            console.log(`   cos(-${this.safeToFixed(safeAngle)}°): ${safeCosA.toFixed(4)}`);
            console.log(`   sin(-${this.safeToFixed(safeAngle)}°): ${safeSinA.toFixed(4)}`);
        }

        // Аффинная матрица преобразования
        const matrix = [
            safeCosA, -safeSinA, 0,
            safeSinA, safeCosA,  0,
            0,        0,         1
        ];

        // 🔥 ПРОВЕРКА МАТРИЦЫ НА NaN ИЛИ INFINITY
        if (matrix.some(v => !isFinite(v) || isNaN(v))) {
            console.log(`⚠️ Матрица содержит NaN или Infinity, возвращаю единичную`);
            return this.createIdentityTransformation();
        }

        // 🔥 ПРОВЕРКА НА НУЛЕВУЮ МАТРИЦУ
        if (matrix.every(v => Math.abs(v) < 0.0001)) {
            console.log(`⚠️ Матрица почти нулевая! Возвращаю единичную`);
            return this.createIdentityTransformation();
        }

        // Если зеркально - добавляем отражение по X
        if (isMirrored) {
            if (this.config.debug) {
                console.log(`   Применяю зеркальное отражение по X`);
            }
            matrix[0] = -matrix[0];  // Меняем знак у cosA
            matrix[1] = -matrix[1];  // Меняем знак у -sinA
        }

        // Сдвиг для центрирования
        const tx = -center.x * matrix[0] - center.y * matrix[1] + center.x;
        const ty = -center.x * matrix[3] - center.y * matrix[4] + center.y;

        matrix[2] = tx;
        matrix[5] = ty;

        if (this.config.debug) {
            console.log(`   Смещение: tx=${this.safeToFixed(tx, 2)}, ty=${this.safeToFixed(ty, 2)}`);
            console.log(`   Итоговая матрица: [${matrix.map(v => v.toFixed(4)).join(', ')}]`);
        }

        return {
            matrix: matrix,                     // 3x3 аффинная матрица
            rotationAngle: safeAngle,
            isMirrored: isMirrored,
            center: { x: center.x, y: center.y },
            bounds: bounds,
            scale: { x: 1.0, y: 1.0 },         // Пока без масштаба, можно добавить позже
            translation: { x: tx, y: ty },
            type: 'rigid_with_possible_mirror',
            timestamp: new Date(),
            
            // 🔥 ДОБАВЛЯЕМ ИНФОРМАЦИЮ ДЛЯ ДИАГНОСТИКИ
            diagnostics: {
                originalAngle: rotationAngle,
                safeAngle: safeAngle,
                cosA: cosA,
                sinA: sinA,
                safeCosA: safeCosA,
                safeSinA: safeSinA,
                matrixValidated: true
            }
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ВАЛИДАЦИЯ МАТРИЦЫ
    validateMatrix(matrix) {
        if (!matrix || matrix.length !== 9) {
            console.log(`❌ Неправильный размер матрицы: ${matrix?.length || 0}`);
            return false;
        }

        // Проверить на NaN или Infinity
        if (matrix.some(v => !isFinite(v) || isNaN(v))) {
            console.log(`⚠️ Матрица содержит NaN/Infinity`);
            return false;
        }

        // Проверить определитель (должен быть около 1 для поворотов)
        const det = matrix[0] * matrix[4] - matrix[1] * matrix[3];
        
        if (Math.abs(det) < 0.001) {
            console.log(`⚠️ Матрица почти вырождена (определитель: ${det.toFixed(6)})`);
            return false;
        }

        // Проверить, что матрица не нулевая
        const allZeros = matrix.every(v => Math.abs(v) < 0.0001);
        if (allZeros) {
            console.log(`⚠️ Матрица состоит из нулей`);
            return false;
        }

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Поворот графа с трансформацией С ОТЛАДКОЙ
    rotateGraphWithTransformation(graph, transformation, mirror = false) {
        if (this.config.debug) {
            console.log(`\n🔄 ВРАЩЕНИЕ ГРАФА С ТРАНСФОРМАЦИЕЙ:`);
        }

        const SimpleGraph = require('./simple-graph');
        const rotatedGraph = new SimpleGraph(`${graph.name} (нормализованный)`);

        const matrix = transformation.matrix;
        const center = transformation.center;

        if (this.config.debug) {
            console.log(`   Центр вращения: (${this.safeToFixed(center.x)}, ${this.safeToFixed(center.y)})`);
            console.log(`   Количество узлов: ${graph.nodes.size}`);
        }

        // Собираем статистику
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        // 🔥 ПРОВЕРЯЕМ МАТРИЦУ ПЕРЕД ПРИМЕНЕНИЕМ
        if (!this.validateMatrix(matrix)) {
            console.log(`⚠️ Матрица невалидна, возвращаю исходный граф`);
            return graph;
        }

        // Поворачиваем и добавляем узлы
        graph.nodes.forEach((node, nodeId) => {
            // Исходные координаты
            const origX = node.x;
            const origY = node.y;

            // Сдвигаем к центру, применяем матрицу, возвращаем
            const relX = origX - center.x;
            const relY = origY - center.y;

            const transformedX = relX * matrix[0] + relY * matrix[1] + center.x + matrix[2];
            const transformedY = relX * matrix[3] + relY * matrix[4] + center.y + matrix[5];

            // 🔥 ПРОВЕРКА НА NaN
            if (isNaN(transformedX) || isNaN(transformedY)) {
                console.log(`⚠️ Точка ${nodeId} стала NaN после трансформации!`);
                console.log(`   Исходные: (${origX}, ${origY})`);
                console.log(`   Матрица: [${matrix.map(v => v.toFixed(3)).join(', ')}]`);
                
                // Используем исходные координаты
                rotatedGraph.addNode(
                    { x: origX, y: origY },
                    node.confidence || 0.5
                );
                
                minX = Math.min(minX, origX);
                maxX = Math.max(maxX, origX);
                minY = Math.min(minY, origY);
                maxY = Math.max(maxY, origY);
                return;
            }

            // Собираем статистику
            minX = Math.min(minX, transformedX);
            maxX = Math.max(maxX, transformedX);
            minY = Math.min(minY, transformedY);
            maxY = Math.max(maxY, transformedY);

            // Добавляем узел
            rotatedGraph.addNode(
                { x: transformedX, y: transformedY },
                node.confidence || 0.5
            );

            // Отладочный вывод для первых 3 точек
            if (this.config.verbose && rotatedGraph.nodes.size <= 3) {
                console.log(`   Узел ${rotatedGraph.nodes.size}:`);
                console.log(`       Было: (${this.safeToFixed(origX)}, ${this.safeToFixed(origY)})`);
                console.log(`       Стало: (${this.safeToFixed(transformedX)}, ${this.safeToFixed(transformedY)})`);
                console.log(`       Δ: (${this.safeToFixed(transformedX - origX)}, ${this.safeToFixed(transformedY - origY)})`);
            }
        });

        if (this.config.debug) {
            console.log(`   Границы после вращения: X[${this.safeToFixed(minX)}-${this.safeToFixed(maxX)}], Y[${this.safeToFixed(minY)}-${this.safeToFixed(maxY)}]`);
        }

        // Копируем метаданные
        rotatedGraph.originalGraphId = graph.id;
        rotatedGraph.originalName = graph.name;

        return rotatedGraph;
    }

    // 🔥 НОВЫЙ МЕТОД: Обратное преобразование С ОТЛАДКОЙ
    applyInverseTransformation(point, transformation) {
        if (!transformation || !transformation.matrix) {
            return point;
        }

        const matrix = transformation.matrix;
        const center = transformation.center || { x: 0, y: 0 };

        // 🔥 ПРОВЕРЯЕМ МАТРИЦУ
        if (!this.validateMatrix(matrix)) {
            console.log(`⚠️ Матрица невалидна для обратного преобразования`);
            return point;
        }

        // 🔥 ИСПРАВЛЕНИЕ 1: Правильное вычисление обратной матрицы
        // Для аффинной матрицы [a, b, tx, c, d, ty, 0, 0, 1]
        const a = matrix[0], b = matrix[1], tx = matrix[2];
        const c = matrix[3], d = matrix[4], ty = matrix[5];

        const det = a * d - b * c;

        if (Math.abs(det) < 1e-10) {
            console.log('⚠️ Матрица вырождена для обратного преобразования');
            return point;
        }

        // 🔥 ИСПРАВЛЕНИЕ 2: Правильная формула обратной аффинной матрицы
        const invDet = 1 / det;
        const invA = d * invDet;
        const invB = -b * invDet;
        const invC = -c * invDet;
        const invD = a * invDet;

        // 🔥 ИСПРАВЛЕНИЕ 3: Учитываем трансляцию
        const invTx = -(invA * tx + invC * ty);
        const invTy = -(invB * tx + invD * ty);

        // Применяем обратное преобразование
        const x = point.x - center.x;
        const y = point.y - center.y;

        const originalX = invA * x + invC * y + invTx + center.x;
        const originalY = invB * x + invD * y + invTy + center.y;

        return {
            x: originalX,
            y: originalY,
            transformed: true
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Прямое преобразование С ДИАГНОСТИКОЙ
    applyTransformation(point, transformation) {
        if (!point || !transformation || !transformation.matrix) {
            console.warn(`⚠️ [FIX] Invalid transformation input`);
            return { x: point?.x || 0, y: point?.y || 0 };
        }
       
        const matrix = transformation.matrix;
       
        // 🔥 ПРОВЕРЯЕМ МАТРИЦУ
        if (!this.validateMatrix(matrix)) {
            console.warn(`⚠️ [FIX] Matrix validation failed`);
            return { x: point.x, y: point.y };
        }
       
        const center = transformation.center || { x: 0, y: 0 };

        // 🔥 ИСПРАВЛЕНИЕ: Простая и понятная формула
        const a = matrix[0], b = matrix[1], tx = matrix[2];
        const c = matrix[3], d = matrix[4], ty = matrix[5];

        const x = point.x - center.x;
        const y = point.y - center.y;

        const transformedX = a * x + c * y + tx + center.x;
        const transformedY = b * x + d * y + ty + center.y;

        // 🔥 ПРОВЕРКА РЕЗУЛЬТАТА
        if (isNaN(transformedX) || isNaN(transformedY)) {
            console.warn(`⚠️ [FIX] Transformed coordinates are NaN`);
            console.warn(`   Input: (${point.x}, ${point.y})`);
            console.warn(`   Matrix: [${matrix.map(v => v.toFixed(3)).join(', ')}]`);
            return { x: point.x, y: point.y };
        }

        // 🔥 ДИАГНОСТИКА: Записать результат
        if (this.config.debug && Math.abs(point.x) > 0.1 && Math.abs(transformedX) < 0.1) {
            console.log(`🔍 [DIAG-TRANSFORM] Точка превратилась в ~0:`);
            console.log(`   Было: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
            console.log(`   Стало: (${transformedX.toFixed(1)}, ${transformedY.toFixed(1)})`);
            console.log(`   Матрица: [${matrix.map(v => v.toFixed(3)).join(', ')}]`);
        }

        return {
            x: transformedX,
            y: transformedY,
            transformed: true
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Создание единичной трансформации
    createIdentityTransformation() {
        if (this.config.debug) {
            console.log(`🔧 СОЗДАНИЕ ЕДИНИЧНОЙ ТРАНСФОРМАЦИИ`);
        }

        return {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            rotationAngle: 0,
            isMirrored: false,
            center: { x: 0, y: 0 },
            bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
            scale: { x: 1.0, y: 1.0 },
            translation: { x: 0, y: 0 },
            type: 'identity',
            timestamp: new Date(),
            isIdentity: true
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ метод: Расчет границ С ЗАЩИТОЙ
    calculateBounds(points) {
        if (!points || points.length === 0) {
            console.log('⚠️ [FIX] Нет точек для расчета границ');
            return { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        let validPoints = 0;

        points.forEach(p => {
            if (!p || p.x === undefined || p.y === undefined || isNaN(p.x) || isNaN(p.y)) {
                console.warn(`⚠️ [FIX] Точка без координат:`, p);
                return;
            }
           
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
            validPoints++;
        });

        if (validPoints === 0) {
            console.log('⚠️ [FIX] Нет валидных точек для расчета границ');
            return { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 };
        }

        if (minX === Infinity || minY === Infinity) {
            console.log('⚠️ [FIX] Не удалось рассчитать границы');
            return { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 };
        }

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        if (this.config.verbose && validPoints > 0) {
            console.log(`📏 РАСЧЕТ ГРАНИЦ (${validPoints} валидных точек):`);
            console.log(`   X: ${this.safeToFixed(minX)} → ${this.safeToFixed(maxX)} (ширина: ${this.safeToFixed(width)})`);
            console.log(`   Y: ${this.safeToFixed(minY)} → ${this.safeToFixed(maxY)} (высота: ${this.safeToFixed(height)})`);
        }

        return { minX, maxX, minY, maxY, width, height };
    }

    // Метод: Определение угла поворота с помощью PCA С ЗАЩИТОЙ
    detectRotationAngle(points) {
        if (!points || points.length < 3) {
            console.log(`⚠️ Мало точек для PCA: ${points?.length || 0}`);
            return 0;
        }

        // 🔥 ФИЛЬТРУЕМ НЕВАЛИДНЫЕ ТОЧКИ
        const validPoints = points.filter(p => 
            p && 
            p.x !== undefined && p.y !== undefined && 
            !isNaN(p.x) && !isNaN(p.y)
        );

        if (validPoints.length < 3) {
            console.log(`⚠️ После фильтрации мало валидных точек для PCA: ${validPoints.length}`);
            return 0;
        }

        if (this.config.debug) {
            console.log(`\n📐 ОПРЕДЕЛЕНИЕ УГЛА ПОВОРОТА (PCA):`);
            console.log(`   Количество точек: ${validPoints.length} (из ${points.length})`);
        }

        // 1. Вычисляем границы
        const bounds = this.calculateBounds(validPoints);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const aspectRatio = width / Math.max(1, height);

        if (this.config.debug) {
            console.log(`   Размеры: ${this.safeToFixed(width)}x${this.safeToFixed(height)}`);
            console.log(`   Соотношение сторон: ${this.safeToFixed(aspectRatio, 2)}`);
        }

        // 2. Вычисляем центр масс
        const center = this.calculateCenter(validPoints);
        if (this.config.debug) {
            console.log(`   Центр масс: (${this.safeToFixed(center.x)}, ${this.safeToFixed(center.y)})`);
        }

        // 3. Центрируем точки
        const centeredPoints = validPoints.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y
        }));

        // 4. Строим ковариационную матрицу
        const covMatrix = this.calculateCovarianceMatrix(centeredPoints);
        
        if (this.config.debug) {
            console.log(`   Ковариационная матрица:`);
            console.log(`       [${this.safeToFixed(covMatrix[0][0])}, ${this.safeToFixed(covMatrix[0][1])}]`);
            console.log(`       [${this.safeToFixed(covMatrix[1][0])}, ${this.safeToFixed(covMatrix[1][1])}]`);
        }

        // 5. Находим собственные векторы (PCA)
        const eigenvectors = this.calculateEigenvectors(covMatrix);
        
        if (this.config.debug) {
            console.log(`   Собственные векторы:`);
            console.log(`       Главный: [${this.safeToFixed(eigenvectors[0][0], 3)}, ${this.safeToFixed(eigenvectors[0][1], 3)}]`);
            console.log(`       Второй:  [${this.safeToFixed(eigenvectors[1][0], 3)}, ${this.safeToFixed(eigenvectors[1][1], 3)}]`);
        }

        // 6. Главная ось = собственный вектор с максимальным собственным значением
        const mainAxis = eigenvectors[0];

        // 7. Вычисляем угол относительно горизонтали
        let angleRad = Math.atan2(mainAxis[1], mainAxis[0]);
        let angleDeg = angleRad * (180 / Math.PI);

        if (this.config.debug) {
            console.log(`   Угол в радианах: ${angleRad.toFixed(3)}`);
            console.log(`   Угол в градусах: ${this.safeToFixed(angleDeg)}°`);
        }

        // 8. Нормализуем угол к [-90°, 90°]
        if (angleDeg > 90) {
            if (this.config.debug) {
                console.log(`   Нормализация: ${this.safeToFixed(angleDeg)}° → ${this.safeToFixed(angleDeg - 180)}°`);
            }
            angleDeg -= 180;
        }
        if (angleDeg < -90) {
            if (this.config.debug) {
                console.log(`   Нормализация: ${this.safeToFixed(angleDeg)}° → ${this.safeToFixed(angleDeg + 180)}°`);
            }
            angleDeg += 180;
        }

        // 🔥 ИСПРАВЛЕНИЕ 1: Интеллектуальная коррекция для сравнения
        const VERTICAL_THRESHOLD = 0.7;   // ratio < 0.7 = вертикальный
        const HORIZONTAL_THRESHOLD = 1.5; // ratio > 1.5 = горизонтальный

        if (aspectRatio < VERTICAL_THRESHOLD) {
            // След вертикальный
            if (this.config.debug) {
                console.log(`   📏 След ВЕРТИКАЛЬНЫЙ (ratio: ${this.safeToFixed(aspectRatio, 2)} < ${VERTICAL_THRESHOLD})`);
            }

            if (Math.abs(angleDeg) < 30) {
                // PCA показывает ~0°, но след вертикальный → корректируем на 90°
                if (this.config.debug) {
                    console.log(`   🔧 PCA показывает ${this.safeToFixed(angleDeg)}°, но след вертикальный → корректирую к 90°`);
                }
                angleDeg += 90;
            }
        } else if (aspectRatio > HORIZONTAL_THRESHOLD) {
            // След горизонтальный
            if (this.config.debug) {
                console.log(`   📏 След ГОРИЗОНТАЛЬНЫЙ (ratio: ${this.safeToFixed(aspectRatio, 2)} > ${HORIZONTAL_THRESHOLD})`);
            }

            if (Math.abs(angleDeg) > 60) {
                // PCA показывает ~90°, но след горизонтальный → корректируем к 0°
                if (this.config.debug) {
                    console.log(`   🔧 PCA показывает ${this.safeToFixed(angleDeg)}°, но след горизонтальный → корректирую к 0°`);
                }
                angleDeg = Math.abs(angleDeg) > 90 ? angleDeg - 90 : angleDeg;
            }
        } else {
            // След средней пропорции - используем реальный угол PCA
            if (this.config.debug) {
                console.log(`   📏 След СРЕДНИХ пропорций (ratio: ${this.safeToFixed(aspectRatio, 2)}) → использую реальный PCA угол`);
            }
            // Никакой коррекции - оставляем как есть (45°, 30°, 60° и т.д.)
        }

        // Финальная нормализация
        if (angleDeg > 90) angleDeg -= 180;
        if (angleDeg < -90) angleDeg += 180;

        // 🔥 ИСПРАВЛЕНИЕ 2: Гарантируем, что возвращаем ЧИСЛО
        const finalAngle = Number(angleDeg.toFixed(1));

        if (this.config.debug) {
            console.log(`📐 ИТОГОВЫЙ УГОЛ: ${this.safeToFixed(finalAngle)}°`);
        }

        return finalAngle; // ✅ Всегда число, не объект
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Расчет центра точек
    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        // 🔥 ФИЛЬТРУЕМ НЕВАЛИДНЫЕ ТОЧКИ
        const validPoints = points.filter(p => 
            p && 
            p.x !== undefined && p.y !== undefined && 
            !isNaN(p.x) && !isNaN(p.y)
        );

        if (validPoints.length === 0) {
            return { x: 0, y: 0 };
        }

        const sumX = validPoints.reduce((sum, p) => sum + p.x, 0);
        const sumY = validPoints.reduce((sum, p) => sum + p.y, 0);

        const center = {
            x: sumX / validPoints.length,
            y: sumY / validPoints.length
        };

        // 🔥 ПРОВЕРКА РЕЗУЛЬТАТА
        if (isNaN(center.x) || isNaN(center.y)) {
            console.log(`⚠️ Центр точек стал NaN!`);
            return { x: 0, y: 0 };
        }

        return center;
    }

    // 🔥 КОВАРИАЦИОННАЯ МАТРИЦА С ЗАЩИТОЙ
    calculateCovarianceMatrix(points) {
        if (!points || points.length === 0) {
            return [[0, 0], [0, 0]];
        }

        let xx = 0, xy = 0, yy = 0;
        let validCount = 0;

        points.forEach(p => {
            if (isNaN(p.x) || isNaN(p.y) || !isFinite(p.x) || !isFinite(p.y)) {
                return;
            }
            xx += p.x * p.x;
            xy += p.x * p.y;
            yy += p.y * p.y;
            validCount++;
        });

        if (validCount === 0) {
            return [[1, 0], [0, 1]]; // Единичная матрица по умолчанию
        }

        return [
            [xx / validCount, xy / validCount],
            [xy / validCount, yy / validCount]
        ];
    }

    // Метод: Определение зеркальности С ОТЛАДКОЙ
    detectMirroring(points) {
        const validPoints = points.filter(p => p && !isNaN(p.x) && !isNaN(p.y));
        
        if (validPoints.length < 10) {
            console.log(`⚠️ Мало точек для определения зеркальности: ${validPoints.length}`);
            return { isMirrored: false, footType: 'unknown', confidence: 0 };
        }

        if (this.config.debug) {
            console.log(`\n🪞 ОПРЕДЕЛЕНИЕ ЗЕРКАЛЬНОСТИ:`);
            console.log(`   Количество точек: ${validPoints.length}`);
        }

        const center = this.calculateCenter(validPoints);
        if (this.config.debug) {
            console.log(`   Центр: (${this.safeToFixed(center.x)}, ${this.safeToFixed(center.y)})`);
        }

        // Разделяем точки на левую и правую половины
        const leftPoints = validPoints.filter(p => p.x < center.x);
        const rightPoints = validPoints.filter(p => p.x >= center.x);

        if (this.config.debug) {
            console.log(`   Точки слева: ${leftPoints.length}`);
            console.log(`   Точки справа: ${rightPoints.length}`);
        }

        const leftDensity = leftPoints.length / validPoints.length;
        const rightDensity = rightPoints.length / validPoints.length;

        const asymmetry = leftDensity - rightDensity;
        const threshold = 0.1;

        if (this.config.debug) {
            console.log(`   Плотность слева: ${leftDensity.toFixed(3)}`);
            console.log(`   Плотность справа: ${rightDensity.toFixed(3)}`);
            console.log(`   Асимметрия: ${asymmetry.toFixed(3)}`);
            console.log(`   Порог: ${threshold}`);
        }

        let isMirrored = false;
        let footType = 'unknown';
        let confidence = Math.min(1, Math.abs(asymmetry) / 0.3);

        if (Math.abs(asymmetry) > threshold) {
            if (asymmetry > 0) {
                footType = 'right';
                isMirrored = false;
                if (this.config.debug) {
                    console.log(`   Определение: ПРАВАЯ НОГА (оригинал)`);
                }
            } else {
                footType = 'left';
                isMirrored = true;
                if (this.config.debug) {
                    console.log(`   Определение: ЛЕВАЯ НОГА (зеркальная)`);
                }
            }
        } else {
            if (this.config.debug) {
                console.log(`   Определение: НЕИЗВЕСТНО (асимметрия ниже порога)`);
            }
        }

        if (this.config.debug) {
            console.log(`   Уверенность: ${confidence.toFixed(2)}`);
            console.log(`   Зеркальность: ${isMirrored ? 'ДА' : 'НЕТ'}`);
        }

        return { isMirrored, footType, confidence, asymmetry };
    }

    // 🔥 НОВЫЙ МЕТОД: Тестовый поворот точки
    testRotation(point, angle) {
        console.log(`\n🧪 ТЕСТ ПОВОРОТА ТОЧКИ:`);
        console.log(`   Точка: (${this.safeToFixed(point.x)}, ${this.safeToFixed(point.y)})`);
        console.log(`   Угол: ${angle}°`);

        const angleRad = angle * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const rotatedX = point.x * cosA - point.y * sinA;
        const rotatedY = point.x * sinA + point.y * cosA;

        console.log(`   Результат: (${this.safeToFixed(rotatedX)}, ${this.safeToFixed(rotatedY)})`);
        console.log(`   Смещение: ΔX=${this.safeToFixed(rotatedX - point.x)}, ΔY=${this.safeToFixed(rotatedY - point.y)}`);

        return { x: rotatedX, y: rotatedY };
    }

    // Метод: Поворот графа на заданный угол (старая версия для совместимости)
    rotateGraph(graph, angleDeg, mirror = false) {
        if (this.config.debug) {
            console.log(`\n🔄 ПОВОРОТ ГРАФА (старая версия):`);
            console.log(`   Угол: ${angleDeg}°`);
            console.log(`   Зеркало: ${mirror ? 'ДА' : 'НЕТ'}`);
        }

        const angleRad = angleDeg * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const points = this.extractPointsFromGraph(graph);
        const center = this.calculateCenter(points);
        
        if (this.config.debug) {
            console.log(`   Центр вращения: (${this.safeToFixed(center.x)}, ${this.safeToFixed(center.y)})`);
        }

        // Создаем копию графа
        const SimpleGraph = require('./simple-graph');
        const rotatedGraph = new SimpleGraph(`${graph.name} (повёрнутый)`);

        // Поворачиваем и добавляем узлы
        graph.nodes.forEach((node, nodeId) => {
            // Сдвигаем к центру
            let x = node.x - center.x;
            let y = node.y - center.y;

            // Поворачиваем
            let rotatedX = x * cosA - y * sinA;
            let rotatedY = x * sinA + y * cosA;

            // Зеркалим если нужно
            if (mirror) {
                rotatedX = -rotatedX;
            }

            // Возвращаем на место
            rotatedX += center.x;
            rotatedY += center.y;

            // 🔥 ПРОВЕРКА НА NaN
            if (isNaN(rotatedX) || isNaN(rotatedY)) {
                console.log(`⚠️ Узел ${nodeId} стал NaN после поворота, использую исходные координаты`);
                rotatedX = node.x;
                rotatedY = node.y;
            }

            // Добавляем узел
            rotatedGraph.addNode(
                { x: rotatedX, y: rotatedY },
                node.confidence || 0.5
            );
        });

        // Копируем метаданные
        rotatedGraph.originalGraphId = graph.id;
        rotatedGraph.originalName = graph.name;

        if (this.config.debug) {
            console.log(`   Повёрнуто узлов: ${rotatedGraph.nodes.size}`);
        }

        return rotatedGraph;
    }

    // Метод: Перестроение рёбер после поворота
    rebuildEdges(graph) {
        const nodes = Array.from(graph.nodes.values());

        // Очищаем существующие рёбра
        graph.edges.clear();

        // Для каждого узла находим 3 ближайших соседа
        nodes.forEach((node1, i) => {
            const distances = [];

            nodes.forEach((node2, j) => {
                if (i !== j) {
                    const dist = Math.sqrt(
                        Math.pow(node2.x - node1.x, 2) +
                        Math.pow(node2.y - node1.y, 2)
                    );
                    distances.push({ index: j, distance: dist, node: node2 });
                }
            });

            // Сортируем по расстоянию и берём ближайших
            distances.sort((a, b) => a.distance - b.distance);
            const nearest = distances.slice(0, 3);

            // Добавляем рёбра
            nearest.forEach(neighbor => {
                const nodeId1 = Array.from(graph.nodes.keys())[i];
                const nodeId2 = Array.from(graph.nodes.keys())[neighbor.index];
                graph.addEdge(nodeId1, nodeId2);
            });
        });

        if (this.config.debug) {
            console.log(`🔗 Перестроено ${graph.edges.size} рёбер после поворота`);
        }
    }

    // 🔥 ПРОСТЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    
    extractPointsFromGraph(graph) {
        const points = [];

        if (!graph || !graph.nodes) return points;

        graph.nodes.forEach((node, nodeId) => {
            points.push({
                id: nodeId,
                x: node.x || 0,
                y: node.y || 0,
                confidence: node.confidence || 0.5
            });
        });

        return points;
    }

    calculateEigenvectors(matrix) {
        // Простой расчет для 2x2 матрицы
        const a = matrix[0][0];
        const b = matrix[0][1];
        const c = matrix[1][0];
        const d = matrix[1][1];

        // Характеристическое уравнение: λ² - (a+d)λ + (ad - bc) = 0
        const trace = a + d;
        const det = a * d - b * c;

        // Защита от NaN
        if (isNaN(trace) || isNaN(det)) {
            return [[1, 0], [0, 1]];
        }

        // Собственные значения
        const discriminant = trace * trace - 4 * det;
        if (discriminant < 0) {
            return [[1, 0], [0, 1]];
        }

        const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
        const lambda2 = (trace - Math.sqrt(discriminant)) / 2;

        // Собственные векторы (нормализованные)
        let eigenvector1, eigenvector2;

        if (Math.abs(b) > 1e-10) {
            eigenvector1 = [lambda1 - d, c];
            eigenvector2 = [lambda2 - d, c];
        } else if (Math.abs(c) > 1e-10) {
            eigenvector1 = [b, lambda1 - a];
            eigenvector2 = [b, lambda2 - a];
        } else {
            // Диагональная матрица
            eigenvector1 = [1, 0];
            eigenvector2 = [0, 1];
        }

        // Нормализуем
        const norm1 = Math.sqrt(eigenvector1[0]*eigenvector1[0] + eigenvector1[1]*eigenvector1[1]);
        const norm2 = Math.sqrt(eigenvector2[0]*eigenvector2[0] + eigenvector2[1]*eigenvector2[1]);

        if (norm1 > 0) {
            eigenvector1[0] /= norm1;
            eigenvector1[1] /= norm1;
        }
        if (norm2 > 0) {
            eigenvector2[0] /= norm2;
            eigenvector2[1] /= norm2;
        }

        // Возвращаем отсортированные по собственным значениям
        if (lambda1 >= lambda2) {
            return [eigenvector1, eigenvector2];
        } else {
            return [eigenvector2, eigenvector1];
        }
    }

    // 🔥 ПРОСТОЕ ПРЕОБРАЗОВАНИЕ ДЛЯ ПРОИЗВОЛЬНЫХ УГЛОВ
    transformPointsSimple(points, fromAngle, toAngle) {
        if (this.config.debug) {
            console.log(`\n🔄 ПРОСТОЕ ПРЕОБРАЗОВАНИЕ: ${this.safeToFixed(fromAngle)}° → ${this.safeToFixed(toAngle)}°`);
        }

        const center = this.calculateCenter(points);
        const deltaAngle = (toAngle - fromAngle) * Math.PI / 180;
        const cos = Math.cos(deltaAngle);
        const sin = Math.sin(deltaAngle);

        const transformed = points.map(point => {
            // Сдвигаем к центру
            const x = point.x - center.x;
            const y = point.y - center.y;

            // Поворачиваем
            const rotatedX = x * cos - y * sin;
            const rotatedY = x * sin + y * cos;

            // Возвращаем обратно
            return {
                ...point,
                x: rotatedX + center.x,
                y: rotatedY + center.y
            };
        });

        return transformed;
    }

    // 🔥 ВЫРОВНЯТЬ ТОЧКИ К ОБЩЕЙ СИСТЕМЕ КООРДИНАТ
    alignPointsToCommonSystem(points, targetCenter = { x: 500, y: 500 }) {
        if (this.config.debug) {
            console.log(`🎯 ВЫРАВНИВАНИЕ К СТАНДАРТНОЙ СИСТЕМЕ КООРДИНАТ...`);
            console.log(`   Целевой центр: (${targetCenter.x}, ${targetCenter.y})`);
            console.log(`   Количество точек: ${points.length}`);
        }

        if (points.length === 0) {
            console.log('⚠️ Нет точек для выравнивания');
            return points;
        }

        const currentCenter = this.calculateCenter(points);
        if (this.config.debug) {
            console.log(`   Текущий центр: (${currentCenter.x.toFixed(1)}, ${currentCenter.y.toFixed(1)})`);
        }

        const offsetX = targetCenter.x - currentCenter.x;
        const offsetY = targetCenter.y - currentCenter.y;

        if (this.config.debug) {
            console.log(`   Смещение: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
        }

        const alignedPoints = points.map(point => ({
            ...point,
            x: point.x + offsetX,
            y: point.y + offsetY,
            originalX: point.x,
            originalY: point.y,
            offsetApplied: { x: offsetX, y: offsetY }
        }));

        // Проверка после выравнивания
        const alignedCenter = this.calculateCenter(alignedPoints);
        const centerDistance = Math.sqrt(
            Math.pow(alignedCenter.x - targetCenter.x, 2) +
            Math.pow(alignedCenter.y - targetCenter.y, 2)
        );

        if (this.config.debug) {
            console.log(`   Центр после выравнивания: (${alignedCenter.x.toFixed(1)}, ${alignedCenter.y.toFixed(1)})`);
            console.log(`   Отклонение от цели: ${centerDistance.toFixed(1)}px`);
        }

        if (centerDistance > 10) {
            console.log(`⚠️ Центр все еще далеко от цели: ${centerDistance.toFixed(1)}px`);
        }

        return alignedPoints;
    }

    // 🔥 ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ВАЛИДАЦИИ
    verifyTransformationResults(pointsBefore, pointsAfter, transformation) {
        console.log(`\n✅ [VERIFICATION] Проверка результатов преобразования:`);
       
        if (pointsBefore.length !== pointsAfter.length) {
            console.log(`   ⚠️ Количество точек изменилось: ${pointsBefore.length} → ${pointsAfter.length}`);
            return false;
        }

        // Проверить нулевые точки
        const zeroBefore = pointsBefore.filter(p => Math.abs(p.x) < 0.1 && Math.abs(p.y) < 0.1).length;
        const zeroAfter = pointsAfter.filter(p => Math.abs(p.x) < 0.1 && Math.abs(p.y) < 0.1).length;
       
        console.log(`   Точек ~(0,0) до: ${zeroBefore}, после: ${zeroAfter}`);
       
        if (zeroBefore === 0 && zeroAfter > 0) {
            console.log(`   ⚠️ Появились нулевые точки после преобразования!`);
            return false;
        }

        // Проверить границы
        const boundsBefore = this.calculateBounds(pointsBefore);
        const boundsAfter = this.calculateBounds(pointsAfter);
       
        console.log(`   Границы до: ${boundsBefore.width.toFixed(1)}x${boundsBefore.height.toFixed(1)}`);
        console.log(`   Границы после: ${boundsAfter.width.toFixed(1)}x${boundsAfter.height.toFixed(1)}`);
       
        if (boundsAfter.width < 1 || boundsAfter.height < 1) {
            console.log(`   ⚠️ Границы после преобразования слишком малы!`);
            return false;
        }

        return true;
    }

    // 🔥 СРАВНЕНИЕ С ПОВОРОТНОЙ ИНВАРИАНТНОСТЬЮ
    compareWithRotationInvariance(graph1, graph2, options = {}) {
        if (this.config.debug) {
            console.log(`\n🔄 СРАВНЕНИЕ С ПОВОРОТНОЙ ИНВАРИАНТНОСТЬЮ:`);
            console.log(`   Граф 1: ${graph1.name || 'без имени'}`);
            console.log(`   Граф 2: ${graph2.name || 'без имени'}`);
        }

        const startTime = Date.now();

        // Проверяем трансформации
        const hasTrans1 = graph1.transformation && this.validateMatrix(graph1.transformation.matrix);
        const hasTrans2 = graph2.transformation && this.validateMatrix(graph2.transformation.matrix);

        if (hasTrans1 && hasTrans2 && this.config.debug) {
            console.log(`   Оба графа имеют валидные трансформации`);
            console.log(`   Угол 1: ${this.safeToFixed(graph1.transformation.rotationAngle)}°`);
            console.log(`   Угол 2: ${this.safeToFixed(graph2.transformation.rotationAngle)}°`);
        }

        // 🔥 ПРОСТОЕ СРАВНЕНИЕ БЕЗ СОЗДАНИЯ SimpleGraphMatcher
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);

        if (this.config.debug) {
            console.log(`   Точек в графе 1: ${points1.length}`);
            console.log(`   Точек в графе 2: ${points2.length}`);
        }

        // 1. Простое сравнение по количеству точек
        const nodeRatio = Math.min(points1.length, points2.length) /
                        Math.max(points1.length, points2.length);

        // 2. Сравнить центры
        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );

        if (this.config.debug) {
            console.log(`   Центр 1: (${this.safeToFixed(center1.x)}, ${this.safeToFixed(center1.y)})`);
            console.log(`   Центр 2: (${this.safeToFixed(center2.x)}, ${this.safeToFixed(center2.y)})`);
            console.log(`   Расстояние между центрами: ${this.safeToFixed(centerDistance)}px`);
        }

        // 3. Простая оценка схожести
        const sizeSimilarity = Math.max(0, Math.min(1, nodeRatio));
        const centerSimilarity = Math.max(0, Math.min(1, 1 - centerDistance / 300));

        const totalSimilarity = (sizeSimilarity * 0.6 + centerSimilarity * 0.4);

        if (this.config.debug) {
            console.log(`   Схожесть по размеру: ${sizeSimilarity.toFixed(3)}`);
            console.log(`   Схожесть по центру: ${centerSimilarity.toFixed(3)}`);
            console.log(`   Общая схожесть: ${totalSimilarity.toFixed(3)}`);
        }

        const result = {
            similarity: totalSimilarity,
            decision: totalSimilarity > 0.7 ? 'same' :
                    totalSimilarity > 0.5 ? 'similar' : 'different',
            reason: `Простое сравнение: ${totalSimilarity.toFixed(3)}`,
            details: {
                nodeCount1: points1.length,
                nodeCount2: points2.length,
                nodeRatio: nodeRatio,
                centerDistance: centerDistance,
                sizeSimilarity: sizeSimilarity,
                centerSimilarity: centerSimilarity
            },
            method: 'simple_rotation_invariant',
            timeMs: Date.now() - startTime
        };

        if (this.config.debug) {
            console.log(`✅ Результат: ${result.decision} (${totalSimilarity.toFixed(3)})`);
        }

        return result;
    }
}

module.exports = RotationInvariance;
