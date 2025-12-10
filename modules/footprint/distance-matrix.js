// modules/footprint/distance-matrix.js
// МАТРИЦЫ РАССТОЯНИЙ ДЛЯ ТОЧНОГО СРАВНЕНИЯ СТРУКТУР

class DistanceMatrix {
    constructor(options = {}) {
        this.matrix = options.matrix || null; // N×N матрица
        this.points = options.points || [];
        this.normalizedMatrix = null;
        this.confidence = 0.8; // Добавлено для гибридной системы
        this.config = {
            normalize: true,
            size: options.size || 50, // Максимальный размер матрицы
            symmetryCheck: true
        };
    }

    // 1. СОЗДАТЬ МАТРИЦУ РАССТОЯНИЙ ИЗ ТОЧЕК
    createFromPoints(points) {
        if (!points || points.length < 3) {
            console.log('⚠️ Слишком мало точек для матрицы');
            return null;
        }

        this.points = points;
        const n = Math.min(points.length, this.config.size);

        // Создать квадратную матрицу N×N
        this.matrix = new Array(n);
        for (let i = 0; i < n; i++) {
            this.matrix[i] = new Array(n).fill(0);
        }

        // Заполнить матрицу расстояний
        for (let i = 0; i < n; i++) {
            for (let j = i; j < n; j++) {
                if (i === j) {
                    this.matrix[i][j] = 0;
                } else {
                    const dx = points[i].x - points[j].x;
                    const dy = points[i].y - points[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    this.matrix[i][j] = distance;
                    this.matrix[j][i] = distance; // Симметрия
                }
            }
        }

        // Нормализовать матрицу
        if (this.config.normalize) {
            this.normalize();
        }

        // Обновить уверенность
        this.updateConfidence();

        return this.matrix;
    }

    // 2. НОРМАЛИЗОВАТЬ МАТРИЦУ (инвариантность к масштабу)
    normalize() {
        if (!this.matrix || this.matrix.length === 0) return;

        const n = this.matrix.length;
        this.normalizedMatrix = new Array(n);
        for (let i = 0; i < n; i++) {
            this.normalizedMatrix[i] = new Array(n).fill(0);
        }

        // Найти максимальное расстояние в матрице
        let maxDist = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                maxDist = Math.max(maxDist, this.matrix[i][j]);
            }
        }

        if (maxDist === 0) maxDist = 1;

        // Нормализовать все расстояния
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                this.normalizedMatrix[i][j] = this.matrix[i][j] / maxDist;
            }
        }

        return this.normalizedMatrix;
    }

    // 3. СРАВНИТЬ С ДРУГОЙ МАТРИЦЕЙ
    compare(otherMatrix) {
        if (!this.normalizedMatrix || !otherMatrix.normalizedMatrix) {
            return { similarity: 0, error: 'Матрицы не нормализованы' };
        }

        const mat1 = this.normalizedMatrix;
        const mat2 = otherMatrix.normalizedMatrix;
        const n1 = mat1.length;
        const n2 = mat2.length;

        // Если матрицы разного размера, использовать минимальный размер
        const n = Math.min(n1, n2, 20); // Сравниваем первые 20×20

        let totalDiff = 0;
        let comparisons = 0;

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const diff = Math.abs(mat1[i][j] - mat2[i][j]);
                totalDiff += diff;
                comparisons++;
            }
        }

        const avgDiff = totalDiff / comparisons;
        const similarity = 1 - avgDiff;

        // Проверить на зеркальность (транспонирование)
        let mirrorSimilarity = 0;
        if (this.config.symmetryCheck) {
            mirrorSimilarity = this.compareMirrored(otherMatrix);
        }

        const finalSimilarity = Math.max(similarity, mirrorSimilarity);
        const isMirrored = mirrorSimilarity > similarity;

        return {
            similarity: finalSimilarity,
            isMirrored,
            avgDiff,
            matrixSize: n,
            comparisons,
            details: {
                directSimilarity: similarity,
                mirrorSimilarity: mirrorSimilarity,
                n1, n2
            }
        };
    }

    // 4. ПРОВЕРИТЬ ЗЕРКАЛЬНОСТЬ (транспонирование)
    compareMirrored(otherMatrix) {
        const mat1 = this.normalizedMatrix;
        const mat2 = otherMatrix.normalizedMatrix;
        const n = Math.min(mat1.length, mat2.length, 20);

        let totalDiff = 0;
        let comparisons = 0;

        // Сравнить mat1[i][j] с mat2[j][i] (транспонирование)
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const diff = Math.abs(mat1[i][j] - mat2[j][i]);
                totalDiff += diff;
                comparisons++;
            }
        }

        const avgDiff = totalDiff / comparisons;
        return 1 - avgDiff;
    }

    // 5. ПОИСК ОПТИМАЛЬНОГО СОВМЕЩЕНИЯ
    findBestAlignment(otherMatrix, maxRotation = 8) {
        const mat1 = this.normalizedMatrix;
        const mat2 = otherMatrix.normalizedMatrix;
        const n = Math.min(mat1.length, mat2.length, 15);

        let bestSimilarity = 0;
        let bestRotation = 0;
        let bestIsMirrored = false;

        // Проверить прямое сравнение
        const direct = this.compare(otherMatrix);
        bestSimilarity = direct.similarity;
        bestIsMirrored = direct.isMirrored;

        // Если мало точек - пропустить ротацию
        if (n < 10) {
            return {
                similarity: bestSimilarity,
                rotation: bestRotation,
                isMirrored: bestIsMirrored,
                matrixSize: n
            };
        }

        // Проверить ротации (каждые 45°)
        for (let r = 1; r < maxRotation; r++) {
            const rotated = this.rotateMatrix(mat2, r);
            const similarity = this.compareMatrices(mat1, rotated, n);

            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestRotation = r;
                bestIsMirrored = false;
            }

            // Проверить зеркальную ротацию
            const mirroredRotated = this.mirrorMatrix(rotated);
            const mirrorSimilarity = this.compareMatrices(mat1, mirroredRotated, n);

            if (mirrorSimilarity > bestSimilarity) {
                bestSimilarity = mirrorSimilarity;
                bestRotation = r;
                bestIsMirrored = true;
            }
        }

        return {
            similarity: bestSimilarity,
            rotation: bestRotation,
            isMirrored: bestIsMirrored,
            matrixSize: n,
            rotationStep: 360 / maxRotation
        };
    }

    // 6. ПОВЕРНУТЬ МАТРИЦУ (циклический сдвиг строк и столбцов)
    rotateMatrix(matrix, rotation) {
        const n = matrix.length;
        const rotated = new Array(n);
        for (let i = 0; i < n; i++) {
            rotated[i] = new Array(n);
            for (let j = 0; j < n; j++) {
                const newI = (i + rotation) % n;
                const newJ = (j + rotation) % n;
                rotated[i][j] = matrix[newI][newJ];
            }
        }
        return rotated;
    }

    // 7. ОТРАЗИТЬ МАТРИЦУ (зеркало)
    mirrorMatrix(matrix) {
        const n = matrix.length;
        const mirrored = new Array(n);
        for (let i = 0; i < n; i++) {
            mirrored[i] = new Array(n);
            for (let j = 0; j < n; j++) {
                mirrored[i][j] = matrix[j][i];
            }
        }
        return mirrored;
    }

    // 8. СРАВНИТЬ ДВЕ МАТРИЦЫ
    compareMatrices(mat1, mat2, size) {
        let totalDiff = 0;
        let comparisons = 0;

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const diff = Math.abs(mat1[i][j] - mat2[i][j]);
                totalDiff += diff;
                comparisons++;
            }
        }

        const avgDiff = totalDiff / comparisons;
        return 1 - avgDiff;
    }

    // 9. ВЫДЕЛИТЬ ОСОБЕННОСТИ МАТРИЦЫ
    extractFeatures() {
        if (!this.normalizedMatrix) return null;

        const mat = this.normalizedMatrix;
        const n = mat.length;
        const features = {
            avgDistance: 0,
            maxDistance: 0,
            minDistance: Infinity,
            symmetry: 0,
            density: 0
        };

        let sum = 0;
        let count = 0;
        let symmetricPairs = 0;

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i === j) continue;

                const val = mat[i][j];
                sum += val;
                count++;
                features.maxDistance = Math.max(features.maxDistance, val);
                features.minDistance = Math.min(features.minDistance, val);

                // Проверить симметрию
                if (Math.abs(val - mat[j][i]) < 0.01) {
                    symmetricPairs++;
                }
            }
        }

        features.avgDistance = sum / count;
        features.symmetry = symmetricPairs / (n * n - n);
        features.density = this.calculateDensity();

        return features;
    }

    // 10. РАССЧИТАТЬ ПЛОТНОСТЬ (близкие точки)
    calculateDensity(threshold = 0.2) {
        if (!this.normalizedMatrix) return 0;

        const mat = this.normalizedMatrix;
        const n = mat.length;
        let closePairs = 0;
        let totalPairs = 0;

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (mat[i][j] < threshold) {
                    closePairs++;
                }
                totalPairs++;
            }
        }

        return totalPairs > 0 ? closePairs / totalPairs : 0;
    }

    // 11. ПОЛУЧИТЬ УПРОЩЁННУЮ МАТРИЦУ (для быстрого сравнения)
    getSimplifiedMatrix(size = 8) {
        if (!this.normalizedMatrix) return null;

        const fullSize = this.normalizedMatrix.length;
        const simplified = new Array(size);

        // Усреднить блоки матрицы
        const blockSize = Math.floor(fullSize / size);

        for (let i = 0; i < size; i++) {
            simplified[i] = new Array(size).fill(0);
            for (let j = 0; j < size; j++) {
                let sum = 0;
                let count = 0;

                const startI = i * blockSize;
                const startJ = j * blockSize;
                const endI = Math.min(startI + blockSize, fullSize);
                const endJ = Math.min(startJ + blockSize, fullSize);

                for (let x = startI; x < endI; x++) {
                    for (let y = startJ; y < endJ; y++) {
                        sum += this.normalizedMatrix[x][y];
                        count++;
                    }
                }

                simplified[i][j] = count > 0 ? sum / count : 0;
            }
        }

        return simplified;
    }

    // 12. ВИЗУАЛИЗИРОВАТЬ МАТРИЦУ
    visualize(maxSize = 10) {
        if (!this.normalizedMatrix) {
            console.log('❌ Матрица не создана');
            return;
        }

        const n = Math.min(this.normalizedMatrix.length, maxSize);

        console.log(`\n📊 МАТРИЦА РАССТОЯНИЙ ${n}×${n}:`);

        for (let i = 0; i < n; i++) {
            let row = '';
            for (let j = 0; j < n; j++) {
                const val = this.normalizedMatrix[i][j];
                // Градации серого от ░ до █
                const level = Math.floor(val * 5);
                const chars = [' ', '░', '▒', '▓', '█'];
                row += chars[level] + chars[level];
            }
            console.log(row);
        }

        const features = this.extractFeatures();
        if (features) {
            console.log(`\n📈 ОСОБЕННОСТИ:`);
            console.log(`├─ Среднее расстояние: ${features.avgDistance.toFixed(3)}`);
            console.log(`├─ Симметрия: ${(features.symmetry * 100).toFixed(1)}%`);
            console.log(`├─ Плотность: ${(features.density * 100).toFixed(1)}%`);
            console.log(`├─ Уверенность: ${(this.confidence * 100).toFixed(1)}%`);
            console.log(`└─ Точек в матрице: ${this.points.length}`);
        }
    }

    // 13. ОБНОВИТЬ УВЕРЕННОСТЬ
    updateConfidence() {
        if (!this.normalizedMatrix || this.normalizedMatrix.length === 0) {
            this.confidence = 0;
            return;
        }

        const features = this.extractFeatures();
        if (!features) {
            this.confidence = 0.5;
            return;
        }

        // Рассчитать уверенность на основе особенностей матрицы
        const n = this.normalizedMatrix.length;
        const sizeScore = Math.min(1, n / 20); // Хотя бы 20 точек
        const symmetryScore = features.symmetry;
        const densityScore = Math.min(1, features.density * 2);
       
        this.confidence = (sizeScore * 0.4 + symmetryScore * 0.3 + densityScore * 0.3);
    }

    // 14. ПОЛУЧИТЬ РАЗМЕР МАТРИЦЫ В СТРОКОВОМ ФОРМАТЕ
    getSizeString() {
        if (!this.matrix || this.matrix.length === 0) {
            return '0x0';
        }
        const rows = this.matrix.length;
        const cols = rows > 0 && this.matrix[0] ? this.matrix[0].length : 0;
        return `${rows}x${cols}`;
    }

    // 15. ГЕТТЕР ДЛЯ РАЗМЕРА
    get size() {
        if (!this.matrix || this.matrix.length === 0) {
            return { rows: 0, columns: 0 };
        }
        return {
            rows: this.matrix.length,
            columns: this.matrix[0] ? this.matrix[0].length : 0
        };
    }

    // 16. СОХРАНИТЬ В JSON
    toJSON() {
        // Сохраняем только упрощённую матрицу для экономии места
        const simplified = this.getSimplifiedMatrix(12);

        return {
            simplifiedMatrix: simplified,
            pointsCount: this.points.length,
            features: this.extractFeatures(),
            config: this.config,
            confidence: this.confidence
        };
    }

    // 17. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        const matrix = new DistanceMatrix({
            matrix: null,
            points: [],
            size: data.config?.size || 50
        });

        // Восстановить особенности
        matrix.points = Array(data.pointsCount || 0).fill({ x: 0, y: 0 });
        matrix.confidence = data.confidence || 0.8;

        return matrix;
    }

    // 18. ТЕСТ МАТРИЦЫ
    static test() {
        console.log('\n🧪 ТЕСТ МАТРИЦЫ РАССТОЯНИЙ:');

        // Создать тестовые точки
        const points = [];
        for (let i = 0; i < 15; i++) {
            points.push({
                x: Math.random() * 100,
                y: Math.random() * 100,
                confidence: 0.8
            });
        }

        const matrix1 = new DistanceMatrix();
        matrix1.createFromPoints(points);

        // Создать немного смещённые точки
        const points2 = points.map(p => ({
            x: p.x + Math.random() * 10 - 5,
            y: p.y + Math.random() * 10 - 5,
            confidence: 0.8
        }));

        const matrix2 = new DistanceMatrix();
        matrix2.createFromPoints(points2);

        // Сравнить матрицы
        const comparison = matrix1.compare(matrix2);
        console.log(`📊 Схожесть матриц: ${comparison.similarity.toFixed(3)}`);
        console.log(`🔄 Зеркальность: ${comparison.isMirrored ? 'ДА' : 'НЕТ'}`);
        console.log(`📏 Размер сравнения: ${comparison.matrixSize}×${comparison.matrixSize}`);

        // Показать визуализацию
        matrix1.visualize(8);

        return {
            matrix1,
            matrix2,
            comparison
        };
    }
}

module.exports = DistanceMatrix;
