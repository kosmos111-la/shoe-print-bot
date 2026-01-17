// modules/footprint/rotation-invariance.js
// АВТООПРЕДЕЛЕНИЕ УГЛА ПОВОРОТА И НОРМАЛИЗАЦИЯ ПРОТЕКТОРА (ВЕРСИЯ С ОТЛАДКОЙ)

class RotationInvariance {
    constructor(options = {}) {
        this.config = {
            canonicalOrientation: 'horizontal',
            rotationStep: 15,
            maxRotationAngle: 180,
            enableAutoRotation: true,
            debug: options.debug || true, // ВКЛЮЧАЕМ ОТЛАДКУ ПО УМОЛЧАНИЮ
            verbose: options.verbose || true,
            ...options
        };

        console.log('🎯 RotationInvariance инициализирован (режим отладки ВКЛЮЧЕН)');
        console.log(`   Режим отладки: ${this.config.debug ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   Детальный вывод: ${this.config.verbose ? 'ВКЛ' : 'ВЫКЛ'}`);
    }

    // 🔥 НОВЫЙ МЕТОД: Нормализация с сохранением относительных пропорций
    normalizeWithRelativePreservation(graph, metadata = {}) {
        console.log(`\n🔄 НОРМАЛИЗАЦИЯ С СОХРАНЕНИЕМ ПРОПОРЦИЙ:`);

        const points = this.extractPointsFromGraph(graph);

        // 1. Определяем текущий угол
        const rotationAngle = this.detectRotationAngle(points);

        // 2. Находим bounding box ДО поворота
        const originalBounds = this.calculateBounds(points);
        const originalCenter = this.calculateCenter(points);
        const originalRatio = originalBounds.width / Math.max(1, originalBounds.height);

        console.log(`📐 Оригинальные пропорции: ${originalBounds.width.toFixed(1)}x${originalBounds.height.toFixed(1)} (ratio: ${originalRatio.toFixed(2)})`);

        // 3. Нормализуем как обычно
        const normalized = this.normalizeToCanonical(graph, metadata);

        // 4. Находим bounding box ПОСЛЕ поворота
        const normalizedPoints = this.extractPointsFromGraph(normalized.graph);
        const normalizedBounds = this.calculateBounds(normalizedPoints);
        const normalizedRatio = normalizedBounds.width / Math.max(1, normalizedBounds.height);

        console.log(`📐 Нормализованные пропорции: ${normalizedBounds.width.toFixed(1)}x${normalizedBounds.height.toFixed(1)} (ratio: ${normalizedRatio.toFixed(2)})`);

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

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: Нормализация с сохранением трансформации И ОТЛАДКОЙ
    normalizeToCanonical(graph, metadata = {}) {
        console.log(`\n🔄 ========== НАЧАЛО НОРМАЛИЗАЦИИ ==========`);
        console.log(`🔄 Граф: "${graph.name || 'без имени'}"`);
        console.log(`🔄 Количество узлов: ${graph.nodes ? graph.nodes.size : 0}`);

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
        if (this.config.verbose) {
            console.log(`🔍 ТОЧКИ ДО НОРМАЛИЗАЦИИ (первые 3 из ${points.length}):`);
            points.slice(0, 3).forEach((p, i) => {
                console.log(`   Точка ${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
            });
        }

        // 1. Определить текущий угол поворота
const rotationAngleResult = this.detectRotationAngle(points);
const rotationAngle = rotationAngleResult.angle || rotationAngleResult; // Поддержка старого формата
console.log(`📐 ОПРЕДЕЛЁН УГОЛ ПОВОРОТА: ${rotationAngle.toFixed(1)}°`);

        // 2. Определить зеркальность
        const mirrorInfo = this.detectMirroring(points);
        console.log(`🪞 ЗЕРКАЛЬНОСТЬ: ${mirrorInfo.isMirrored ? 'ЗЕРКАЛЬНЫЙ' : 'ОРИГИНАЛ'}`);

        // 3. Рассчитать масштаб и центр
        const bounds = this.calculateBounds(points);
        const center = this.calculateCenter(points);
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);

        console.log(`📊 ПАРАМЕТРЫ ДО НОРМАЛИЗАЦИИ:`);
        console.log(`   Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
        console.log(`   Границы: X[${bounds.minX.toFixed(1)}-${bounds.maxX.toFixed(1)}], Y[${bounds.minY.toFixed(1)}-${bounds.maxY.toFixed(1)}]`);
        console.log(`   Размеры: ${width.toFixed(1)}x${height.toFixed(1)}`);

        // 4. 🔥 СОЗДАЕМ ТРАНСФОРМАЦИЮ
        const transformation = this.createTransformation(
            rotationAngle,
            mirrorInfo.isMirrored,
            center,
            bounds,
            width,
            height
        );

        console.log(`🔧 СОЗДАНА ТРАНСФОРМАЦИЯ:`);
        console.log(`   Матрица: [${transformation.matrix.map(v => v.toFixed(3)).join(', ')}]`);
        console.log(`   Угол в трансформации: ${transformation.rotationAngle.toFixed(1)}°`);

        // 5. Повернуть граф к канонической ориентации
        console.log(`🔄 ВЫПОЛНЯЮ ПОВОРОТ НА ${-rotationAngle.toFixed(1)}°...`);
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
                console.log(`   Точка ${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);

                // Сравниваем с исходными точками
                if (i < points.length) {
                    const dx = p.x - points[i].x;
                    const dy = p.y - points[i].y;
                    console.log(`        ΔX: ${dx.toFixed(1)}, ΔY: ${dy.toFixed(1)}`);
                }
            });
        }

        // Проверяем угол после нормализации
        const angleAfterNormalization = this.detectRotationAngle(normalizedPoints);
        console.log(`📐 УГОЛ ПОСЛЕ НОРМАЛИЗАЦИИ: ${angleAfterNormalization.toFixed(1)}°`);

// 🔥 ШАГ 8: ЦЕНТРИРОВАНИЕ К СТАНДАРТНОЙ СИСТЕМЕ КООРДИНАТ
console.log(`🎯 ЦЕНТРИРУЮ СЛЕД К СТАНДАРТНОЙ СИСТЕМЕ...`);

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
      
        console.log(`✅ ========== НОРМАЛИЗАЦИЯ ЗАВЕРШЕНА ==========`);
        console.log(`   Поворот: ${rotationAngle.toFixed(1)}° → ${angleAfterNormalization.toFixed(1)}°`);
        console.log(`   Зеркало: ${mirrorInfo.isMirrored ? 'ДА' : 'НЕТ'}`);
        console.log(`   Центр сохранен: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);

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

    // 🔥 НОВЫЙ МЕТОД: Создание трансформации С ОТЛАДКОЙ
    createTransformation(rotationAngle, isMirrored, center, bounds, width, height) {
        console.log(`\n🔧 СОЗДАНИЕ ТРАНСФОРМАЦИИ:`);
        console.log(`   Входной угол: ${rotationAngle.toFixed(1)}°`);
        console.log(`   Зеркало: ${isMirrored}`);
        console.log(`   Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);

        const angleRad = rotationAngle * (Math.PI / 180);
        const cosA = Math.cos(-angleRad); // Отрицательный угол для нормализации
        const sinA = Math.sin(-angleRad);

        console.log(`   cos(-${rotationAngle.toFixed(1)}°): ${cosA.toFixed(4)}`);
        console.log(`   sin(-${rotationAngle.toFixed(1)}°): ${sinA.toFixed(4)}`);

        // Аффинная матрица преобразования
        const matrix = [
            cosA, -sinA, 0,
            sinA, cosA,  0,
            0,    0,     1
        ];

        // Если зеркально - добавляем отражение по X
        if (isMirrored) {
            console.log(`   Применяю зеркальное отражение по X`);
            matrix[0] = -matrix[0];  // Меняем знак у cosA
            matrix[1] = -matrix[1];  // Меняем знак у -sinA
        }

        // Сдвиг для центрирования
        const tx = -center.x * matrix[0] - center.y * matrix[1] + center.x;
        const ty = -center.x * matrix[3] - center.y * matrix[4] + center.y;

        matrix[2] = tx;
        matrix[5] = ty;

        console.log(`   Смещение: tx=${tx.toFixed(2)}, ty=${ty.toFixed(2)}`);
        console.log(`   Итоговая матрица: [${matrix.map(v => v.toFixed(4)).join(', ')}]`);

        return {
            matrix: matrix,                     // 3x3 аффинная матрица
            rotationAngle: rotationAngle,
            isMirrored: isMirrored,
            center: { x: center.x, y: center.y },
            bounds: bounds,
            scale: { x: 1.0, y: 1.0 },         // Пока без масштаба, можно добавить позже
            translation: { x: tx, y: ty },
            type: 'rigid_with_possible_mirror',
            timestamp: new Date()
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Поворот графа с трансформацией С ОТЛАДКОЙ
    rotateGraphWithTransformation(graph, transformation, mirror = false) {
        console.log(`\n🔄 ВРАЩЕНИЕ ГРАФА С ТРАНСФОРМАЦИЕЙ:`);

        const SimpleGraph = require('./simple-graph');
        const rotatedGraph = new SimpleGraph(`${graph.name} (нормализованный)`);

        const matrix = transformation.matrix;
        const center = transformation.center;

        console.log(`   Центр вращения: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
        console.log(`   Количество узлов: ${graph.nodes.size}`);

        // Собираем статистику
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

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
                console.log(`   Узел ${rotatedGraph.nodes.size}:`);
                console.log(`       Было: (${origX.toFixed(1)}, ${origY.toFixed(1)})`);
                console.log(`       Стало: (${transformedX.toFixed(1)}, ${transformedY.toFixed(1)})`);
                console.log(`       Δ: (${(transformedX - origX).toFixed(1)}, ${(transformedY - origY).toFixed(1)})`);
            }
        });

        console.log(`   Границы после вращения: X[${minX.toFixed(1)}-${maxX.toFixed(1)}], Y[${minY.toFixed(1)}-${maxY.toFixed(1)}]`);

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
   
    // 🔥 ИСПРАВЛЕНИЕ 1: Правильное вычисление обратной матрицы
    // Для аффинной матрицы [a, b, tx, c, d, ty, 0, 0, 1]
    const a = matrix[0], b = matrix[1], tx = matrix[2];
    const c = matrix[3], d = matrix[4], ty = matrix[5];
   
    const det = a * d - b * c;
   
    if (Math.abs(det) < 1e-10) {
        console.log('⚠️ Матрица вырождена');
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

// 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Прямое преобразование
applyTransformation(point, transformation) {
    if (!transformation || !transformation.matrix) {
        return point;
    }

    const matrix = transformation.matrix;
    const center = transformation.center || { x: 0, y: 0 };
   
    // 🔥 ИСПРАВЛЕНИЕ: Простая и понятная формула
    const a = matrix[0], b = matrix[1], tx = matrix[2];
    const c = matrix[3], d = matrix[4], ty = matrix[5];
   
    const x = point.x - center.x;
    const y = point.y - center.y;
   
    const transformedX = a * x + c * y + tx + center.x;
    const transformedY = b * x + d * y + ty + center.y;
   
    return {
        x: transformedX,
        y: transformedY,
        transformed: true
    };
}

    // 🔥 НОВЫЙ МЕТОД: Преобразование точек из одной системы в другую С ОТЛАДКОЙ
    transformPointsBetweenSystems(points, fromTransformation, toTransformation) {
    if (!fromTransformation || !toTransformation) {
        console.log('⚠️ Нет трансформаций для преобразования');
        return points;
    }

    console.log(`\n🔄 ПРЕОБРАЗОВАНИЕ ТОЧЕК МЕЖДУ СИСТЕМАМИ:`);
    console.log(`   Из: ${fromTransformation.rotationAngle.toFixed(1)}° → В: ${toTransformation.rotationAngle.toFixed(1)}°`);
   
    // 🔥 НОВОЕ: Проверяем границы до преобразования
    const originalBounds = this.calculateBounds(points);
    console.log(`   Исходные границы: ${originalBounds.width.toFixed(1)}x${originalBounds.height.toFixed(1)}`);

    const transformedPoints = [];
   
    points.forEach((point, index) => {
        // 1. Получаем исходную точку в системе fromTransformation
        const originalInFromSystem = { x: point.x, y: point.y };
       
        // 2. Преобразуем в глобальную систему (через обратное преобразование from)
        const inGlobalSystem = this.applyInverseTransformation(
            originalInFromSystem,
            fromTransformation
        );
       
        // 3. Преобразуем из глобальной системы в систему to
        const inToSystem = this.applyTransformation(
            inGlobalSystem,
            toTransformation
        );
       
        transformedPoints.push({
            ...point,
            x: inToSystem.x,
            y: inToSystem.y,
            originalCoordinates: { x: point.x, y: point.y }
        });
    });
   
    // 🔥 НОВОЕ: Проверяем границы после преобразования
    const newBounds = this.calculateBounds(transformedPoints);
    console.log(`   Новые границы: ${newBounds.width.toFixed(1)}x${newBounds.height.toFixed(1)}`);
   
    return transformedPoints;
}

    // 🔥 НОВЫЙ МЕТОД: Прямое преобразование С ОТЛАДКОЙ
    applyTransformation(point, transformation) {
        if (!transformation || !transformation.matrix) {
            return point;
        }

        const matrix = transformation.matrix;
        const center = transformation.center;

        const relX = point.x - center.x;
        const relY = point.y - center.y;

        const transformedX = relX * matrix[0] + relY * matrix[1] + center.x + matrix[2];
        const transformedY = relX * matrix[3] + relY * matrix[4] + center.y + matrix[5];

        return {
            x: transformedX,
            y: transformedY,
            transformed: true
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Создание единичной трансформации
    createIdentityTransformation() {
        console.log(`🔧 СОЗДАНИЕ ЕДИНИЧНОЙ ТРАНСФОРМАЦИИ`);

        return {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            rotationAngle: 0,
            isMirrored: false,
            center: { x: 0, y: 0 },
            bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
            scale: { x: 1.0, y: 1.0 },
            translation: { x: 0, y: 0 },
            type: 'identity',
            timestamp: new Date()
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Расчет границ С ОТЛАДКОЙ
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        if (this.config.verbose) {
            console.log(`📏 РАСЧЕТ ГРАНИЦ:`);
            console.log(`   X: ${minX.toFixed(1)} → ${maxX.toFixed(1)} (ширина: ${(maxX - minX).toFixed(1)})`);
            console.log(`   Y: ${minY.toFixed(1)} → ${maxY.toFixed(1)} (высота: ${(maxY - minY).toFixed(1)})`);
        }

        return { minX, maxX, minY, maxY };
    }

    // Метод: Определение угла поворота с помощью PCA С ОТЛАДКОЙ
    detectRotationAngle(points) {
    if (points.length < 3) {
        console.log(`⚠️ Мало точек для PCA: ${points.length}`);
        return 0;
    }

    console.log(`\n📐 ОПРЕДЕЛЕНИЕ УГЛА ПОВОРОТА (PCA):`);
    console.log(`   Количество точек: ${points.length}`);

    // 1. Вычисляем границы
    const bounds = this.calculateBounds(points);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const aspectRatio = width / Math.max(1, height);

    console.log(`   Размеры: ${width.toFixed(1)}x${height.toFixed(1)}`);
    console.log(`   Соотношение сторон: ${aspectRatio.toFixed(2)}`);

    // 2. Вычисляем центр масс
    const center = this.calculateCenter(points);
    console.log(`   Центр масс: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);

    // 3. Центрируем точки
    const centeredPoints = points.map(p => ({
        x: p.x - center.x,
        y: p.y - center.y
    }));

    // 4. Строим ковариационную матрицу
    const covMatrix = this.calculateCovarianceMatrix(centeredPoints);
    console.log(`   Ковариационная матрица:`);
    console.log(`       [${covMatrix[0][0].toFixed(1)}, ${covMatrix[0][1].toFixed(1)}]`);
    console.log(`       [${covMatrix[1][0].toFixed(1)}, ${covMatrix[1][1].toFixed(1)}]`);

    // 5. Находим собственные векторы (PCA)
    const eigenvectors = this.calculateEigenvectors(covMatrix);
    console.log(`   Собственные векторы:`);
    console.log(`       Главный: [${eigenvectors[0][0].toFixed(3)}, ${eigenvectors[0][1].toFixed(3)}]`);
    console.log(`       Второй:  [${eigenvectors[1][0].toFixed(3)}, ${eigenvectors[1][1].toFixed(3)}]`);

    // 6. Главная ось = собственный вектор с максимальным собственным значением
    const mainAxis = eigenvectors[0];

    // 7. Вычисляем угол относительно горизонтали
    let angleRad = Math.atan2(mainAxis[1], mainAxis[0]);
    let angleDeg = angleRad * (180 / Math.PI);

    console.log(`   Угол в радианах: ${angleRad.toFixed(3)}`);
    console.log(`   Угол в градусах: ${angleDeg.toFixed(1)}°`);

    // 8. Нормализуем угол к [-90°, 90°]
    if (angleDeg > 90) {
        console.log(`   Нормализация: ${angleDeg.toFixed(1)}° → ${(angleDeg - 180).toFixed(1)}°`);
        angleDeg -= 180;
    }
    if (angleDeg < -90) {
        console.log(`   Нормализация: ${angleDeg.toFixed(1)}° → ${(angleDeg + 180).toFixed(1)}°`);
        angleDeg += 180;
    }

    // 🔥 ИСПРАВЛЕНИЕ 1: Интеллектуальная коррекция для сравнения
    const VERTICAL_THRESHOLD = 0.7;   // ratio < 0.7 = вертикальный
    const HORIZONTAL_THRESHOLD = 1.5; // ratio > 1.5 = горизонтальный
   
    if (aspectRatio < VERTICAL_THRESHOLD) {
        // След вертикальный
        console.log(`   📏 След ВЕРТИКАЛЬНЫЙ (ratio: ${aspectRatio.toFixed(2)} < ${VERTICAL_THRESHOLD})`);
       
        if (Math.abs(angleDeg) < 30) {
            // PCA показывает ~0°, но след вертикальный → корректируем на 90°
            console.log(`   🔧 PCA показывает ${angleDeg.toFixed(1)}°, но след вертикальный → корректирую к 90°`);
            angleDeg += 90;
        }
    } else if (aspectRatio > HORIZONTAL_THRESHOLD) {
        // След горизонтальный
        console.log(`   📏 След ГОРИЗОНТАЛЬНЫЙ (ratio: ${aspectRatio.toFixed(2)} > ${HORIZONTAL_THRESHOLD})`);
       
        if (Math.abs(angleDeg) > 60) {
            // PCA показывает ~90°, но след горизонтальный → корректируем к 0°
            console.log(`   🔧 PCA показывает ${angleDeg.toFixed(1)}°, но след горизонтальный → корректирую к 0°`);
            angleDeg = Math.abs(angleDeg) > 90 ? angleDeg - 90 : angleDeg;
        }
    } else {
        // След средней пропорции - используем реальный угол PCA
        console.log(`   📏 След СРЕДНИХ пропорций (ratio: ${aspectRatio.toFixed(2)}) → использую реальный PCA угол`);
        // Никакой коррекции - оставляем как есть (45°, 30°, 60° и т.д.)
    }

    // Финальная нормализация
    if (angleDeg > 90) angleDeg -= 180;
    if (angleDeg < -90) angleDeg += 180;

    console.log(`📐 ИТОГОВЫЙ УГОЛ: ${angleDeg.toFixed(1)}°`);
   
    // 🔥 ИСПРАВЛЕНИЕ 2: Гарантируем, что возвращаем ЧИСЛО
    const finalAngle = Number(angleDeg.toFixed(1));
   
    return finalAngle; // ✅ Всегда число, не объект
}

// 🔥 НОВЫЙ МЕТОД: Интеллектуальная нормализация угла
normalizeAngleForFootprint(angleDeg, aspectRatio) {
    // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:
    // Если след вертикальный и угол близок к 0°, корректируем на 90°
    // Если след горизонтальный и угол близок к 90°, корректируем на 0°
   
    const VERTICAL_THRESHOLD = 0.7;   // Высота > ширина/0.7
    const HORIZONTAL_THRESHOLD = 1.5; // Ширина > высота*1.5
   
    let normalizedAngle = angleDeg;
   
    // Нормализуем к [-90°, 90°]
    if (normalizedAngle > 90) normalizedAngle -= 180;
    if (normalizedAngle < -90) normalizedAngle += 180;
   
    // 🔥 АВТОКОРРЕКЦИЯ на основе пропорций
    if (aspectRatio < VERTICAL_THRESHOLD) {
        // След вертикальный
        if (Math.abs(normalizedAngle) < 45) {
            console.log(`   📏 Вертикальный след (ratio: ${aspectRatio.toFixed(2)}), ` +
                       `но угол ${normalizedAngle.toFixed(1)}° близок к 0°`);
            console.log(`   🔧 Корректирую на 90° для удобства сравнения`);
            normalizedAngle += 90;
        }
    } else if (aspectRatio > HORIZONTAL_THRESHOLD) {
        // След горизонтальный
        if (Math.abs(normalizedAngle) > 45) {
            console.log(`   📏 Горизонтальный след (ratio: ${aspectRatio.toFixed(2)}), ` +
                       `но угол ${normalizedAngle.toFixed(1)}° близок к 90°`);
            console.log(`   🔧 Корректирую на -90° для удобства сравнения`);
            normalizedAngle -= 90;
        }
    }
   
    // Финальная нормализация к [-90°, 90°]
    if (normalizedAngle > 90) normalizedAngle -= 180;
    if (normalizedAngle < -90) normalizedAngle += 180;
   
    return normalizedAngle;
}

    // Метод: Определение зеркальности С ОТЛАДКОЙ
    detectMirroring(points) {
        if (points.length < 10) {
            console.log(`⚠️ Мало точек для определения зеркальности: ${points.length}`);
            return { isMirrored: false, footType: 'unknown', confidence: 0 };
        }

        console.log(`\n🪞 ОПРЕДЕЛЕНИЕ ЗЕРКАЛЬНОСТИ:`);
        console.log(`   Количество точек: ${points.length}`);

        const center = this.calculateCenter(points);
        console.log(`   Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);

        // Разделяем точки на левую и правую половины
        const leftPoints = points.filter(p => p.x < center.x);
        const rightPoints = points.filter(p => p.x >= center.x);

        console.log(`   Точки слева: ${leftPoints.length}`);
        console.log(`   Точки справа: ${rightPoints.length}`);

        const leftDensity = leftPoints.length / points.length;
        const rightDensity = rightPoints.length / points.length;

        const asymmetry = leftDensity - rightDensity;
        const threshold = 0.1;

        console.log(`   Плотность слева: ${leftDensity.toFixed(3)}`);
        console.log(`   Плотность справа: ${rightDensity.toFixed(3)}`);
        console.log(`   Асимметрия: ${asymmetry.toFixed(3)}`);
        console.log(`   Порог: ${threshold}`);

        let isMirrored = false;
        let footType = 'unknown';
        let confidence = Math.min(1, Math.abs(asymmetry) / 0.3);

        if (Math.abs(asymmetry) > threshold) {
            if (asymmetry > 0) {
                footType = 'right';
                isMirrored = false;
                console.log(`   Определение: ПРАВАЯ НОГА (оригинал)`);
            } else {
                footType = 'left';
                isMirrored = true;
                console.log(`   Определение: ЛЕВАЯ НОГА (зеркальная)`);
            }
        } else {
            console.log(`   Определение: НЕИЗВЕСТНО (асимметрия ниже порога)`);
        }

        console.log(`   Уверенность: ${confidence.toFixed(2)}`);
        console.log(`   Зеркальность: ${isMirrored ? 'ДА' : 'НЕТ'}`);

        return { isMirrored, footType, confidence, asymmetry };
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки в нормализованной системе
    getNormalizedPoints(graph) {
        console.log(`\n📊 ПОЛУЧЕНИЕ ТОЧЕК В НОРМАЛИЗОВАННОЙ СИСТЕМЕ:`);

        if (!graph.transformation) {
            console.log(`   Граф не имеет трансформации, возвращаю исходные точки`);
            return this.extractPointsFromGraph(graph);
        }

        const originalPoints = this.extractPointsFromGraph(graph.originalGraph || graph);
        const normalizedPoints = this.extractPointsFromGraph(graph);

        console.log(`   Оригинальных точек: ${originalPoints.length}`);
        console.log(`   Нормализованных точек: ${normalizedPoints.length}`);
        console.log(`   Угол трансформации: ${graph.transformation.rotationAngle.toFixed(1)}°`);

        return normalizedPoints;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить исходные точки (до нормализации)
    getOriginalPoints(graph) {
        console.log(`\n📊 ПОЛУЧЕНИЕ ИСХОДНЫХ ТОЧЕК:`);

        if (graph.originalGraph) {
            console.log(`   Возвращаю точки из оригинального графа`);
            return this.extractPointsFromGraph(graph.originalGraph);
        } else {
            console.log(`   Граф не имеет оригинала, возвращаю его текущие точки`);
            return this.extractPointsFromGraph(graph);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Проверка трансформации
    validateTransformation(graph) {
        console.log(`\n🔍 ПРОВЕРКА ТРАНСФОРМАЦИИ:`);

        if (!graph.transformation) {
            console.log(`   ❌ Граф не имеет трансформации`);
            return false;
        }

        const trans = graph.transformation;
        console.log(`   Угол: ${trans.rotationAngle.toFixed(1)}°`);
        console.log(`   Зеркало: ${trans.isMirrored ? 'ДА' : 'НЕТ'}`);
        console.log(`   Центр: (${trans.center.x.toFixed(1)}, ${trans.center.y.toFixed(1)})`);
        console.log(`   Тип: ${trans.type}`);
        console.log(`   Время: ${trans.timestamp}`);

        // Проверяем матрицу
        const matrix = trans.matrix;
        if (matrix.length !== 9) {
            console.log(`   ❌ Неверный размер матрицы: ${matrix.length}`);
            return false;
        }

        // Проверяем определитель (должен быть около 1 для поворотов)
        const det = matrix[0] * matrix[4] - matrix[1] * matrix[3];
        console.log(`   Определитель матрицы: ${det.toFixed(4)}`);

        if (Math.abs(det - 1.0) > 0.1 && !trans.isMirrored) {
            console.log(`   ⚠️ Необычный определитель для чистого поворота`);
        }

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Тестовый поворот точки
    testRotation(point, angle) {
        console.log(`\n🧪 ТЕСТ ПОВОРОТА ТОЧКИ:`);
        console.log(`   Точка: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        console.log(`   Угол: ${angle}°`);

        const angleRad = angle * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const rotatedX = point.x * cosA - point.y * sinA;
        const rotatedY = point.x * sinA + point.y * cosA;

        console.log(`   Результат: (${rotatedX.toFixed(1)}, ${rotatedY.toFixed(1)})`);
        console.log(`   Смещение: ΔX=${(rotatedX - point.x).toFixed(1)}, ΔY=${(rotatedY - point.y).toFixed(1)}`);

        return { x: rotatedX, y: rotatedY };
    }

    // Метод: Поворот графа на заданный угол (старая версия для совместимости)
    rotateGraph(graph, angleDeg, mirror = false) {
        console.log(`\n🔄 ПОВОРОТ ГРАФА (старая версия):`);
        console.log(`   Угол: ${angleDeg}°`);
        console.log(`   Зеркало: ${mirror ? 'ДА' : 'НЕТ'}`);

        const angleRad = angleDeg * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const center = this.calculateCenter(Array.from(graph.nodes.values()));
        console.log(`   Центр вращения: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);

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

            // Добавляем узел
            rotatedGraph.addNode(
                { x: rotatedX, y: rotatedY },
                node.confidence || 0.5
            );
        });

        // Копируем метаданные
        rotatedGraph.originalGraphId = graph.id;
        rotatedGraph.originalName = graph.name;

        console.log(`   Повёрнуто узлов: ${rotatedGraph.nodes.size}`);

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

        console.log(`🔗 Перестроено ${graph.edges.size} рёбер после поворота`);
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: БЕЗ РЕКУРСИИ
    compareWithRotationInvariance(graph1, graph2, options = {}) {
        console.log(`\n🔄 СРАВНЕНИЕ С ПОВОРОТНОЙ ИНВАРИАНТНОСТЬЮ:`);
        console.log(`   Граф 1: ${graph1.name || 'без имени'}`);
        console.log(`   Граф 2: ${graph2.name || 'без имени'}`);

        const startTime = Date.now();

        // Проверяем трансформации
        const hasTrans1 = this.validateTransformation(graph1);
        const hasTrans2 = this.validateTransformation(graph2);

        if (hasTrans1 && hasTrans2) {
            console.log(`   Оба графа имеют трансформации`);
            console.log(`   Угол 1: ${graph1.transformation.rotationAngle.toFixed(1)}°`);
            console.log(`   Угол 2: ${graph2.transformation.rotationAngle.toFixed(1)}°`);
        }

        // 🔥 ПРОСТОЕ СРАВНЕНИЕ БЕЗ СОЗДАНИЯ SimpleGraphMatcher
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);

        console.log(`   Точек в графе 1: ${points1.length}`);
        console.log(`   Точек в графе 2: ${points2.length}`);

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

        console.log(`   Центр 1: (${center1.x.toFixed(1)}, ${center1.y.toFixed(1)})`);
        console.log(`   Центр 2: (${center2.x.toFixed(1)}, ${center2.y.toFixed(1)})`);
        console.log(`   Расстояние между центрами: ${centerDistance.toFixed(1)}px`);

        // 3. Простая оценка схожести
        const sizeSimilarity = Math.max(0, Math.min(1, nodeRatio));
        const centerSimilarity = Math.max(0, Math.min(1, 1 - centerDistance / 300));

        const totalSimilarity = (sizeSimilarity * 0.6 + centerSimilarity * 0.4);

        console.log(`   Схожесть по размеру: ${sizeSimilarity.toFixed(3)}`);
        console.log(`   Схожесть по центру: ${centerSimilarity.toFixed(3)}`);
        console.log(`   Общая схожесть: ${totalSimilarity.toFixed(3)}`);

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

        console.log(`✅ Результат: ${result.decision} (${totalSimilarity.toFixed(3)})`);

        return result;
    }

    // Метод: Создание полярных координат
    createPolarDescriptors(graph) {
        const nodes = Array.from(graph.nodes.values());
        const center = this.calculateCenter(nodes);

        // Преобразуем в полярные координаты относительно центра
        const polarPoints = nodes.map(node => {
            const dx = node.x - center.x;
            const dy = node.y - center.y;

            return {
                r: Math.sqrt(dx * dx + dy * dy),
                theta: Math.atan2(dy, dx),
                originalNode: node
            };
        });

        // Сортируем по углу
        polarPoints.sort((a, b) => a.theta - b.theta);

        // Нормализуем углы к [0, 2π]
        const normalized = polarPoints.map(p => ({
            r: p.r,
            theta: p.theta < 0 ? p.theta + 2 * Math.PI : p.theta,
            originalNode: p.originalNode
        }));

        return {
            center,
            polarPoints: normalized,
            nodeCount: nodes.length
        };
    }

    // Метод: Сравнение по полярным дескрипторам
    comparePolarDescriptors(desc1, desc2) {
        if (desc1.nodeCount < 5 || desc2.nodeCount < 5) {
            console.log(`⚠️ Мало точек для полярного сравнения: ${desc1.nodeCount}, ${desc2.nodeCount}`);
            return { similarity: 0, method: 'polar_invalid' };
        }

        // Приводим к одинаковому количеству точек
        const normalized1 = this.normalizePolarDescriptor(desc1);
        const normalized2 = this.normalizePolarDescriptor(desc2);

        // Сравниваем радиальные распределения
        const radialSimilarity = this.compareRadialDistributions(normalized1, normalized2);

        // Сравниваем угловые распределения
        const angularSimilarity = this.compareAngularDistributions(normalized1, normalized2);

        // Комбинируем
        const similarity = radialSimilarity * 0.6 + angularSimilarity * 0.4;

        return {
            similarity: Math.max(0, Math.min(1, similarity)),
            radialSimilarity,
            angularSimilarity,
            method: 'polar_comparison'
        };
    }

    // Метод: Нормализация полярного дескриптора
    normalizePolarDescriptor(desc, targetPoints = 36) {
        if (desc.polarPoints.length === 0) {
            return { radii: Array(targetPoints).fill(0), angles: Array(targetPoints).fill(0) };
        }

        // Интерполируем к фиксированному количеству точек
        const radii = [];
        const angles = [];

        const angleStep = (2 * Math.PI) / targetPoints;

        for (let i = 0; i < targetPoints; i++) {
            const targetAngle = i * angleStep;

            // Находим ближайшие точки для интерполяции
            const nearest = this.findNearestAngles(desc.polarPoints, targetAngle);

            if (nearest.before && nearest.after) {
                // Линейная интерполяция по углу
                const t = (targetAngle - nearest.before.theta) /
                        (nearest.after.theta - nearest.before.theta);
                const interpRadius = nearest.before.r * (1 - t) + nearest.after.r * t;

                radii.push(interpRadius);
                angles.push(targetAngle);
            } else {
                radii.push(0);
                angles.push(targetAngle);
            }
        }

        // Нормализуем радиусы к [0, 1]
        const maxRadius = Math.max(...radii.filter(r => !isNaN(r)));
        const normalizedRadii = maxRadius > 0 ?
            radii.map(r => r / maxRadius) : Array(targetPoints).fill(0);

        return {
            radii: normalizedRadii,
            angles: angles,
            center: desc.center,
            originalPoints: desc.polarPoints.length
        };
    }

    // Метод: Поиск ближайших углов для интерполяции
    findNearestAngles(polarPoints, targetAngle) {
        let before = null;
        let after = null;

        for (const point of polarPoints) {
            if (point.theta <= targetAngle) {
                if (!before || point.theta > before.theta) {
                    before = point;
                }
            }
            if (point.theta >= targetAngle) {
                if (!after || point.theta < after.theta) {
                    after = point;
                }
            }
        }

        // Замыкаем круг
        if (!before && polarPoints.length > 0) {
            before = polarPoints[polarPoints.length - 1];
            before = { ...before, theta: before.theta - 2 * Math.PI };
        }
        if (!after && polarPoints.length > 0) {
            after = polarPoints[0];
            after = { ...after, theta: after.theta + 2 * Math.PI };
        }

        return { before, after };
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД: БЕЗ РЕКУРСИИ
    compareWithAllMethods(graph1, graph2, options = {}) {
        console.log(`\n🔍 КОМБИНИРОВАННОЕ ИНВАРИАНТНОЕ СРАВНЕНИЕ:`);
        console.log(`   Граф 1: ${graph1.name || 'без имени'} (${graph1.nodes.size} узлов)`);
        console.log(`   Граф 2: ${graph2.name || 'без имени'} (${graph2.nodes.size} узлов)`);

        const startTime = Date.now();

        // 🔥 ИСПОЛЬЗУЕМ ТОЛЬКО ПРОСТЫЕ МЕТОДЫ БЕЗ СОЗДАНИЯ SimpleGraphMatcher

        // 1. Сравнение с Hu моментами
        const huResult = this.compareWithHuMoments(graph1, graph2);
        console.log(`   Hu моменты: ${huResult.similarity.toFixed(3)}`);

        // 2. Сравнение по полярным дескрипторам
        const polarDesc1 = this.createPolarDescriptors(graph1);
        const polarDesc2 = this.createPolarDescriptors(graph2);
        const polarResult = this.comparePolarDescriptors(polarDesc1, polarDesc2);
        console.log(`   Полярные дескрипторы: ${polarResult.similarity.toFixed(3)}`);

        // 3. Простая проверка размеров
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);
        const sizeRatio = Math.min(points1.length, points2.length) /
                        Math.max(points1.length, points2.length);
        const sizeScore = Math.max(0, Math.min(1, sizeRatio * 1.5 - 0.5));
        console.log(`   Схожесть размеров: ${sizeScore.toFixed(3)} (ratio: ${sizeRatio.toFixed(3)})`);

        // 4. Простая оценка
        const totalSimilarity =
            huResult.similarity * 0.4 +
            polarResult.similarity * 0.4 +
            sizeScore * 0.2;

        console.log(`   Общая схожесть: ${totalSimilarity.toFixed(3)}`);

        // 5. Определение решения
        let decision, reason;
        if (totalSimilarity >= 0.7) {
            decision = 'same';
            reason = `Инвариантная схожесть (${totalSimilarity.toFixed(3)})`;
        } else if (totalSimilarity >= 0.5) {
            decision = 'similar';
            reason = `Умеренная схожесть (${totalSimilarity.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть (${totalSimilarity.toFixed(3)})`;
        }

        const finalResult = {
            similarity: totalSimilarity,
            decision: decision,
            reason: reason,
            details: {
                huMoments: huResult.similarity,
                polarDescriptors: polarResult.similarity,
                sizeScore: sizeScore
            },
            processingTime: Date.now() - startTime,
            method: 'safe_invariant_comparison'
        };

        console.log(`✅ Результат: ${decision} (${totalSimilarity.toFixed(3)})`);

        return finalResult;
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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

    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    calculateCovarianceMatrix(points) {
        let xx = 0, xy = 0, yy = 0;

        points.forEach(p => {
            xx += p.x * p.x;
            xy += p.x * p.y;
            yy += p.y * p.y;
        });

        const n = points.length;
        return [
            [xx / n, xy / n],
            [xy / n, yy / n]
        ];
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

        // Собственные значения
        const lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;
        const lambda2 = (trace - Math.sqrt(trace * trace - 4 * det)) / 2;

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

    compareRadialDistributions(desc1, desc2) {
        if (desc1.radii.length !== desc2.radii.length) return 0;

        let sumDiff = 0;
        for (let i = 0; i < desc1.radii.length; i++) {
            sumDiff += Math.abs(desc1.radii[i] - desc2.radii[i]);
        }

        return Math.max(0, 1 - sumDiff / desc1.radii.length);
    }

    compareAngularDistributions(desc1, desc2) {
        // Сдвигаем второй дескриптор для поиска наилучшего совпадения
        const len = desc1.angles.length;
        let bestScore = 0;

        for (let shift = 0; shift < len; shift++) {
            let score = 0;
            for (let i = 0; i < len; i++) {
                const j = (i + shift) % len;
                const angleDiff = Math.abs(desc1.angles[i] - desc2.angles[j]);
                const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff) / Math.PI;
                score += 1 - normalizedDiff;
            }
            score /= len;
            bestScore = Math.max(bestScore, score);
        }

        return bestScore;
    }

    // Метод: Расчет Hu моментов
    calculateHuMoments(graph) {
        const points = this.extractPointsFromGraph(graph);
        if (points.length < 3) return Array(7).fill(0);

        const center = this.calculateCenter(points);

        // Центрированные моменты
        let m00 = 0, m10 = 0, m01 = 0;
        let m20 = 0, m02 = 0, m11 = 0;
        let m30 = 0, m03 = 0, m12 = 0, m21 = 0;

        points.forEach(p => {
            const x = p.x - center.x;
            const y = p.y - center.y;

            m00 += 1;
            m10 += x;
            m01 += y;
            m20 += x * x;
            m02 += y * y;
            m11 += x * y;
            m30 += x * x * x;
            m03 += y * y * y;
            m12 += x * y * y;
            m21 += x * x * y;
        });

        // Нормализованные центральные моменты
        const n20 = m20 / m00;
        const n02 = m02 / m00;
        const n11 = m11 / m00;
        const n30 = m30 / m00;
        const n03 = m03 / m00;
        const n12 = m12 / m00;
        const n21 = m21 / m00;

        // Hu моменты (инвариантные)
        const hu = [
            n20 + n02,
            Math.pow((n20 - n02), 2) + 4 * Math.pow(n11, 2),
            Math.pow((n30 - 3 * n12), 2) + Math.pow((3 * n21 - n03), 2),
            Math.pow((n30 + n12), 2) + Math.pow((n21 + n03), 2),
            (n30 - 3 * n12) * (n30 + n12) * (Math.pow((n30 + n12), 2) - 3 * Math.pow((n21 + n03), 2)) +
            (3 * n21 - n03) * (n21 + n03) * (3 * Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2)),
            (n20 - n02) * (Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2)) +
            4 * n11 * (n30 + n12) * (n21 + n03),
            (3 * n21 - n03) * (n30 + n12) * (Math.pow((n30 + n12), 2) - 3 * Math.pow((n21 + n03), 2)) -
            (n30 - 3 * n12) * (n21 + n03) * (3 * Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2))
        ];

        // Логарифмическая шкала
        return hu.map(h => Math.log(Math.abs(h) + 1e-10));
    }

    // Метод: Инвариантное сравнение с Hu моментами
    compareWithHuMoments(graph1, graph2) {
        const hu1 = this.calculateHuMoments(graph1);
        const hu2 = this.calculateHuMoments(graph2);

        let similarity = 0;
        const weights = [0.2, 0.2, 0.15, 0.15, 0.1, 0.1, 0.1];

        for (let i = 0; i < 7; i++) {
            const diff = Math.abs(hu1[i] - hu2[i]);
            const maxAbs = Math.max(Math.abs(hu1[i]), Math.abs(hu2[i]));
            const normalizedDiff = maxAbs > 0 ? diff / maxAbs : 0;
            similarity += (1 - normalizedDiff) * weights[i];
        }

        return {
            similarity: Math.max(0, Math.min(1, similarity)),
            method: 'hu_moments'
        };
    }

    compareRadialDistributions(desc1, desc2) {
        if (desc1.radii.length !== desc2.radii.length) return 0;

        let sumDiff = 0;
        for (let i = 0; i < desc1.radii.length; i++) {
            sumDiff += Math.abs(desc1.radii[i] - desc2.radii[i]);
        }

        return Math.max(0, 1 - sumDiff / desc1.radii.length);
    }

    compareAngularDistributions(desc1, desc2) {
        // Сдвигаем второй дескриптор для поиска наилучшего совпадения
        const len = desc1.angles.length;
        let bestScore = 0;

        for (let shift = 0; shift < len; shift++) {
            let score = 0;
            for (let i = 0; i < len; i++) {
                const j = (i + shift) % len;
                const angleDiff = Math.abs(desc1.angles[i] - desc2.angles[j]);
                const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff) / Math.PI;
                score += 1 - normalizedDiff;
            }
            score /= len;
            bestScore = Math.max(bestScore, score);
        }

        return bestScore;
    }

    // 🔥 НОВЫЙ МЕТОД: Выровнять точки к общей системе координат
alignPointsToCommonSystem(points, targetCenter = { x: 500, y: 500 }) {
    console.log(`🎯 ВЫРАВНИВАНИЕ К СТАНДАРТНОЙ СИСТЕМЕ КООРДИНАТ...`);
    console.log(`   Целевой центр: (${targetCenter.x}, ${targetCenter.y})`);
    console.log(`   Количество точек: ${points.length}`);

    if (points.length === 0) {
        console.log('⚠️ Нет точек для выравнивания');
        return points;
    }

    const currentCenter = this.calculateCenter(points);
    console.log(`   Текущий центр: (${currentCenter.x.toFixed(1)}, ${currentCenter.y.toFixed(1)})`);

    const offsetX = targetCenter.x - currentCenter.x;
    const offsetY = targetCenter.y - currentCenter.y;

    console.log(`   Смещение: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);

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

    console.log(`   Центр после выравнивания: (${alignedCenter.x.toFixed(1)}, ${alignedCenter.y.toFixed(1)})`);
    console.log(`   Отклонение от цели: ${centerDistance.toFixed(1)}px`);

    if (centerDistance > 10) {
        console.log(`⚠️ Центр все еще далеко от цели: ${centerDistance.toFixed(1)}px`);
    }

    return alignedPoints;
}  

// 🔥 НОВЫЙ МЕТОД: Простое преобразование для произвольных углов
transformPointsSimple(points, fromAngle, toAngle) {
    console.log(`\n🔄 ПРОСТОЕ ПРЕОБРАЗОВАНИЕ: ${fromAngle.toFixed(1)}° → ${toAngle.toFixed(1)}°`);
   
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

// 🔥 ОБНОВЛЕННЫЙ метод getPointsInNormalizedSystem в simple-footprint.js:
getPointsInNormalizedSystem() {
    console.log(`🔧 getPointsInNormalizedSystem() для "${this.name}"`);
   
    const points = this.getPointsInMySystem();
   
    if (!this.transformation || points.length === 0) {
        return points;
    }
   
    const currentAngle = this.transformation.rotationAngle || 0;
    console.log(`📐 Текущий угол: ${currentAngle}°, нормализую к 0°`);
   
    // 🔥 ИСПРАВЛЕНИЕ: Используем ПРОСТОЙ метод для поворота
    const RotationInvariance = require('./rotation-invariance');
    const processor = new RotationInvariance({ debug: false });
   
    // 1. Просто поворачиваем к 0°
    const rotatedPoints = processor.transformPointsSimple(points, currentAngle, 0);
   
    // 2. Центрируем
    const centeredPoints = processor.alignPointsToCommonSystem(rotatedPoints);
   
    console.log(`✅ Нормализовано ${centeredPoints.length} точек`);
   
    return centeredPoints;
}      
      
}

module.exports = RotationInvariance;
