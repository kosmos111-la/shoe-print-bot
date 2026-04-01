// modules/footprint/topology/AffineRefiner.js
// 🔧 ГЛОБАЛЬНАЯ АФФИННАЯ КОРРЕКЦИЯ (6 степеней свободы)

class AffineRefiner {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.maxIterations = options.maxIterations || 3;
        this.convergenceThreshold = options.convergenceThreshold || 0.001;
        this.outlierThreshold = options.outlierThreshold || 0.1; // 10% ошибки
        this.useRansac = options.useRansac !== false;
        this.ransacIterations = options.ransacIterations || 100;
        this.ransacThreshold = options.ransacThreshold || 5; // пикселей
    }

    /**
     * Основной метод: уточняет transform по опорным парам
     * @param {Array} pairs - массив пар { src: {x,y}, dst: {x,y}, weight }
     * @param {Object} currentTransform - текущий transform (опционально)
     * @returns {Object} - уточнённый transform { a,b,c,d,e,f }
     */
    refine(pairs, currentTransform = null) {
        if (!pairs || pairs.length < 3) {
            console.log(`⚠️ Недостаточно пар для аффинной коррекции: ${pairs?.length || 0}`);
            return currentTransform || this.getIdentityTransform();
        }

        console.log(`\n🔧 АФФИННАЯ КОРРЕКЦИЯ по ${pairs.length} парам`);

        // Подготовка пар с весами
        const weightedPairs = this.preparePairs(pairs);
       
        let bestTransform = null;
        let bestError = Infinity;
       
        // RANSAC для отсева выбросов
        if (this.useRansac && weightedPairs.length >= 4) {
            const ransacResult = this.ransacAffine(weightedPairs);
            if (ransacResult.transform) {
                bestTransform = ransacResult.transform;
                bestError = ransacResult.error;
                console.log(`   🎯 RANSAC: отобрано ${ransacResult.inliers.length} inliers из ${weightedPairs.length}`);
            }
        }
       
        // Если RANSAC не дал результата или выключен, используем все пары
        if (!bestTransform) {
            bestTransform = this.solveAffine(weightedPairs);
            bestError = this.calculateRMSE(weightedPairs, bestTransform);
        }
       
        // Итеративное уточнение
        let currentPairs = weightedPairs;
        let currentTransform_ = bestTransform;
       
        for (let iter = 0; iter < this.maxIterations; iter++) {
            // Применяем transform к src точкам
            const transformedPairs = currentPairs.map(pair => ({
                ...pair,
                transformed: this.applyTransform(pair.src, currentTransform_)
            }));
           
            // Вычисляем ошибки
            const errors = transformedPairs.map(pair =>
                this.distance(pair.transformed, pair.dst)
            );
           
            // Фильтруем выбросы (ошибка > порога)
            const filteredPairs = currentPairs.filter((_, i) =>
                errors[i] <= this.outlierThreshold * this.getScale(currentPairs)
            );
           
            if (filteredPairs.length < 3) {
                if (this.debug) console.log(`   ⚠️ Слишком мало пар после фильтрации: ${filteredPairs.length}`);
                break;
            }
           
            // Вычисляем новый transform
            const newTransform = this.solveAffine(filteredPairs);
           
            // Комбинируем (delta ◦ current)
            const combinedTransform = this.composeAffine(newTransform, currentTransform_);
           
            // Проверяем сходимость
            const delta = this.transformDelta(currentTransform_, combinedTransform);
            if (delta < this.convergenceThreshold) {
                if (this.debug) console.log(`   ✅ Сходимость на итерации ${iter + 1}`);
                currentTransform_ = combinedTransform;
                break;
            }
           
            currentTransform_ = combinedTransform;
            currentPairs = filteredPairs;
           
            if (this.debug) {
                console.log(`   🔄 Итерация ${iter + 1}: ошибка = ${this.calculateRMSE(filteredPairs, currentTransform_).toFixed(3)}px`);
            }
        }
       
        // Декомпозиция для диагностики
        const decomposed = this.decompose(currentTransform_);
       
        console.log(`\n📊 РЕЗУЛЬТАТ АФФИННОЙ КОРРЕКЦИИ:`);
        console.log(`   Масштаб X: ${decomposed.scaleX.toFixed(3)} (${((decomposed.scaleX - 1) * 100).toFixed(1)}%)`);
        console.log(`   Масштаб Y: ${decomposed.scaleY.toFixed(3)} (${((decomposed.scaleY - 1) * 100).toFixed(1)}%)`);
        console.log(`   Поворот: ${(decomposed.rotation * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   Скос: ${(decomposed.shear * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   Сдвиг: (${decomposed.translateX.toFixed(1)}, ${decomposed.translateY.toFixed(1)})`);
        console.log(`   Средняя ошибка: ${this.calculateRMSE(weightedPairs, currentTransform_).toFixed(2)}px`);
       
        return currentTransform_;
    }

    /**
     * Подготовка пар: извлечение координат и весов
     */
    preparePairs(pairs) {
        return pairs.map(pair => ({
            src: { x: pair.src.x, y: pair.src.y },
            dst: { x: pair.dst.x, y: pair.dst.y },
            weight: pair.weight || 1.0
        }));
    }

    /**
     * Решение аффинной трансформации методом наименьших квадратов
     * Решаем систему: A * params = B
     */
    solveAffine(pairs) {
        const n = pairs.length;
       
        // Строим матрицу A (2n x 6) и вектор B (2n)
        const A = [];
        const Bx = [];
        const By = [];
       
        for (const pair of pairs) {
            const { x, y } = pair.src;
            const { x: xp, y: yp } = pair.dst;
            const w = pair.weight || 1;
           
            // Для X: a*x + b*y + c = xp
            A.push([w * x, w * y, w, 0, 0, 0]);
            Bx.push(w * xp);
           
            // Для Y: d*x + e*y + f = yp
            A.push([0, 0, 0, w * x, w * y, w]);
            By.push(w * yp);
        }
       
        // Решаем нормальные уравнения: (A^T * A) * params = A^T * B
        const AtA = this.multiplyMatrices(this.transpose(A), A);
        const AtBx = this.multiplyMatrixVector(this.transpose(A), Bx);
        const AtBy = this.multiplyMatrixVector(this.transpose(A), By);
       
        const paramsX = this.solveLinearSystem(AtA, AtBx);
        const paramsY = this.solveLinearSystem(AtA, AtBy);
       
        if (!paramsX || !paramsY) {
            console.log(`⚠️ Не удалось решить систему, возвращаю единичную матрицу`);
            return this.getIdentityTransform();
        }
       
        return {
            a: paramsX[0], b: paramsX[1], c: paramsX[2],
            d: paramsY[0], e: paramsY[1], f: paramsY[2]
        };
    }

    /**
     * RANSAC для поиска максимального набора inliers
     */
    ransacAffine(pairs) {
        const n = pairs.length;
        if (n < 3) return { transform: null, inliers: [], error: Infinity };
       
        let bestInliers = [];
        let bestTransform = null;
        let bestError = Infinity;
       
        for (let iter = 0; iter < this.ransacIterations; iter++) {
            // Случайно выбираем 3 пары
            const indices = this.randomIndices(n, 3);
            const sample = indices.map(i => pairs[i]);
           
            // Вычисляем transform по выборке
            const transform = this.solveAffine(sample);
            if (!transform) continue;
           
            // Находим inliers
            const inliers = [];
            const errors = [];
           
            for (const pair of pairs) {
                const transformed = this.applyTransform(pair.src, transform);
                const dist = this.distance(transformed, pair.dst);
                if (dist <= this.ransacThreshold) {
                    inliers.push(pair);
                    errors.push(dist);
                }
            }
           
            const avgError = errors.reduce((a, b) => a + b, 0) / (errors.length || 1);
           
            if (inliers.length > bestInliers.length ||
                (inliers.length === bestInliers.length && avgError < bestError)) {
                bestInliers = inliers;
                bestError = avgError;
               
                // Пересчитываем transform по всем inliers
                if (bestInliers.length >= 3) {
                    bestTransform = this.solveAffine(bestInliers);
                }
            }
        }
       
        if (bestInliers.length < 3) {
            return { transform: null, inliers: [], error: Infinity };
        }
       
        // Финальный пересчёт по всем inliers
        const finalTransform = this.solveAffine(bestInliers);
        const finalError = this.calculateRMSE(bestInliers, finalTransform);
       
        return {
            transform: finalTransform,
            inliers: bestInliers,
            error: finalError
        };
    }

    /**
     * Применяет аффинную трансформацию к точке
     */
    applyTransform(point, transform) {
        const { a, b, c, d, e, f } = transform;
        return {
            x: a * point.x + b * point.y + c,
            y: d * point.x + e * point.y + f
        };
    }

    /**
     * Композиция двух аффинных трансформаций: T = T2 ◦ T1
     */
    composeAffine(t2, t1) {
        // Матричное умножение: M = M2 * M1
        // M1 = [a1 b1 c1; d1 e1 f1; 0 0 1]
        // M2 = [a2 b2 c2; d2 e2 f2; 0 0 1]
        return {
            a: t2.a * t1.a + t2.b * t1.d,
            b: t2.a * t1.b + t2.b * t1.e,
            c: t2.a * t1.c + t2.b * t1.f + t2.c,
            d: t2.d * t1.a + t2.e * t1.d,
            e: t2.d * t1.b + t2.e * t1.e,
            f: t2.d * t1.c + t2.e * t1.f + t2.f
        };
    }

    /**
     * Вычисляет разницу между двумя трансформациями
     */
    transformDelta(t1, t2) {
        const diffA = Math.abs(t1.a - t2.a);
        const diffB = Math.abs(t1.b - t2.b);
        const diffC = Math.abs(t1.c - t2.c);
        const diffD = Math.abs(t1.d - t2.d);
        const diffE = Math.abs(t1.e - t2.e);
        const diffF = Math.abs(t1.f - t2.f);
        return (diffA + diffB + diffC + diffD + diffE + diffF) / 6;
    }

    /**
     * Декомпозиция аффинной матрицы на компоненты
     */
    decompose(transform) {
        const { a, b, c, d, e, f } = transform;
       
        // Масштаб по X
        const scaleX = Math.sqrt(a * a + d * d);
       
        // Масштаб по Y
        const scaleY = Math.sqrt(b * b + e * e);
       
        // Поворот
        const rotation = Math.atan2(d, a);
       
        // Скос (shear) — насколько неортогональны оси
        const dot = a * b + d * e;
        const shear = Math.asin(Math.min(1, Math.max(-1, dot / (scaleX * scaleY))));
       
        return {
            scaleX,
            scaleY,
            rotation,
            shear,
            translateX: c,
            translateY: f
        };
    }

    /**
     * Вычисляет RMSE по парам
     */
    calculateRMSE(pairs, transform) {
        if (pairs.length === 0) return Infinity;
       
        let sumSq = 0;
        for (const pair of pairs) {
            const transformed = this.applyTransform(pair.src, transform);
            const dx = transformed.x - pair.dst.x;
            const dy = transformed.y - pair.dst.y;
            sumSq += dx * dx + dy * dy;
        }
        return Math.sqrt(sumSq / pairs.length);
    }

    /**
     * Возвращает единичную трансформацию
     */
    getIdentityTransform() {
        return { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
    }

    /**
     * Оценивает характерный размер облака точек
     */
    getScale(pairs) {
        let maxDist = 0;
        const center = { x: 0, y: 0 };
        for (const pair of pairs) {
            center.x += pair.src.x;
            center.y += pair.src.y;
        }
        center.x /= pairs.length;
        center.y /= pairs.length;
       
        for (const pair of pairs) {
            const dx = pair.src.x - center.x;
            const dy = pair.src.y - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) maxDist = dist;
        }
        return maxDist;
    }

    /**
     * Расстояние между двумя точками
     */
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Транспонирование матрицы
     */
    transpose(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const result = Array(cols).fill().map(() => Array(rows));
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                result[j][i] = matrix[i][j];
            }
        }
        return result;
    }

    /**
     * Умножение матриц
     */
    multiplyMatrices(A, B) {
        const rowsA = A.length;
        const colsA = A[0].length;
        const colsB = B[0].length;
        const result = Array(rowsA).fill().map(() => Array(colsB).fill(0));
       
        for (let i = 0; i < rowsA; i++) {
            for (let j = 0; j < colsB; j++) {
                let sum = 0;
                for (let k = 0; k < colsA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    /**
     * Умножение матрицы на вектор
     */
    multiplyMatrixVector(matrix, vector) {
        const rows = matrix.length;
        const result = Array(rows).fill(0);
        for (let i = 0; i < rows; i++) {
            let sum = 0;
            for (let j = 0; j < matrix[i].length; j++) {
                sum += matrix[i][j] * vector[j];
            }
            result[i] = sum;
        }
        return result;
    }

    /**
     * Решение линейной системы Ax = B (методом Гаусса)
     */
    solveLinearSystem(A, B) {
        const n = A.length;
        const augmented = A.map((row, i) => [...row, B[i]]);
       
        // Прямой ход (метод Гаусса)
        for (let i = 0; i < n; i++) {
            // Поиск максимального элемента в столбце
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                    maxRow = k;
                }
            }
           
            // Перестановка строк
            [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
           
            // Нормализация
            const pivot = augmented[i][i];
            if (Math.abs(pivot) < 1e-10) {
                console.log(`⚠️ Вырожденная матрица, pivot = ${pivot}`);
                return null;
            }
           
            for (let k = i; k <= n; k++) {
                augmented[i][k] /= pivot;
            }
           
            // Исключение
            for (let k = 0; k < n; k++) {
                if (k !== i && Math.abs(augmented[k][i]) > 1e-10) {
                    const factor = augmented[k][i];
                    for (let j = i; j <= n; j++) {
                        augmented[k][j] -= factor * augmented[i][j];
                    }
                }
            }
        }
       
        // Извлечение решения
        return augmented.map(row => row[n]);
    }

    /**
     * Случайные индексы без повторений
     */
    randomIndices(max, count) {
        const indices = Array.from({ length: max }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices.slice(0, count);
    }

    /**
     * Преобразование из аффинной матрицы в объект для визуализации
     */
    toLegacyTransform(affine) {
        // Преобразуем в формат { scale, rotation, translation }
        const decomposed = this.decompose(affine);
       
        // Усредняем масштабы для совместимости
        const scale = (decomposed.scaleX + decomposed.scaleY) / 2;
       
        return {
            scale: scale,
            rotation: decomposed.rotation,
            translation: { x: decomposed.translateX, y: decomposed.translateY },
            affine: affine, // сохраняем полную матрицу для продвинутого использования
            scaleX: decomposed.scaleX,
            scaleY: decomposed.scaleY,
            shear: decomposed.shear
        };
    }
}

module.exports = AffineRefiner;
