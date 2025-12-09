// modules/footprint/bitmask-footprint.js
// 64-БИТНЫЕ МАСКИ ДЛЯ МГНОВЕННОГО ОТСЕВА

class BitmaskFootprint {
    constructor(options = {}) {
        this.bitmask = options.bitmask || 0n;
        this.points = options.points || [];
        this.config = {
            gridSize: options.gridSize || 8, // 8x8 = 64 бита
            normalize: true
        };
    }

    // 1. СОЗДАТЬ БИТОВУЮ МАСКУ ИЗ ТОЧЕК
    createFromPoints(points) {
        if (!points || points.length === 0) {
            this.bitmask = 0n;
            this.points = [];
            return this.bitmask;
        }

        // Нормализовать точки в квадрат 0-1
        const normalized = this.normalizePoints(points);
        this.points = normalized;

        // Создать сетку 8x8
        let mask = 0n;
        const grid = Array(64).fill(0);

        normalized.forEach(point => {
            const x = Math.floor(point.x * this.config.gridSize);
            const y = Math.floor(point.y * this.config.gridSize);
           
            if (x >= 0 && x < this.config.gridSize &&
                y >= 0 && y < this.config.gridSize) {
                const index = y * this.config.gridSize + x;
                grid[index] = 1;
            }
        });

        // Преобразовать в 64-битное число
        for (let i = 0; i < 64; i++) {
            if (grid[i] === 1) {
                mask |= (1n << BigInt(i));
            }
        }

        this.bitmask = mask;
        return mask;
    }

    // 2. НОРМАЛИЗОВАТЬ ТОЧКИ В КВАДРАТ 0-1
    normalizePoints(points) {
        if (!points || points.length === 0) return [];

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const maxDim = Math.max(width, height);

        return points.map(p => ({
            x: (p.x - minX) / maxDim,
            y: (p.y - minY) / maxDim,
            confidence: p.confidence || 0.5
        }));
    }

    // 3. РАССТОЯНИЕ ХЭММИНГА МЕЖДУ МАСКАМИ
    static hammingDistance(mask1, mask2) {
        if (typeof mask1 === 'bigint' && typeof mask2 === 'bigint') {
            const xor = mask1 ^ mask2;
            return this.countBits(xor);
        }
        return 64; // Максимальное расстояние
    }

    // 4. ПОДСЧИТАТЬ КОЛИЧЕСТВО УСТАНОВЛЕННЫХ БИТОВ
    static countBits(n) {
        let count = 0;
        let x = n;
        while (x > 0n) {
            x &= (x - 1n);
            count++;
        }
        return count;
    }

    // 5. СРАВНИТЬ С ДРУГОЙ МАСКОЙ (быстрая проверка)
    compare(otherBitmask) {
        if (!otherBitmask) return { distance: 64, similarity: 0 };

        const distance = BitmaskFootprint.hammingDistance(
            this.bitmask,
            otherBitmask.bitmask || otherBitmask
        );

        // Сходство = 1 - (расстояние / макс. расстояние)
        const maxDistance = 64;
        const similarity = 1 - (distance / maxDistance);

        let decision;
        if (distance <= 10) decision = 'highly_similar';
        else if (distance <= 20) decision = 'similar';
        else if (distance <= 30) decision = 'somewhat_similar';
        else decision = 'different';

        return {
            distance,
            similarity,
            decision,
            reason: `Хэмминг расстояние: ${distance}/64`
        };
    }

    // 6. ПРОВЕРИТЬ, ЯВЛЯЕТСЯ ЛИ ПОДМАСКОЙ
    isSubmaskOf(otherBitmask) {
        if (!otherBitmask) return false;
       
        const other = typeof otherBitmask === 'bigint'
            ? otherBitmask
            : otherBitmask.bitmask;
       
        // Все биты этой маски должны быть в другой маске
        return (this.bitmask & ~other) === 0n;
    }

    // 7. ОБЪЕДИНИТЬ ДВЕ МАСКИ (логическое ИЛИ)
    static mergeMasks(mask1, mask2) {
        if (!mask1 && !mask2) return 0n;
        if (!mask1) return mask2;
        if (!mask2) return mask1;
       
        return mask1 | mask2;
    }

    // 8. ВИЗУАЛИЗИРОВАТЬ МАСКУ (для отладки)
    visualize() {
        console.log('\n🔲 64-БИТНАЯ МАСКА:');
       
        for (let y = 0; y < 8; y++) {
            let row = '';
            for (let x = 0; x < 8; x++) {
                const index = y * 8 + x;
                const bit = (this.bitmask >> BigInt(index)) & 1n;
                row += bit === 1n ? '██' : '░░';
            }
            console.log(row);
        }
       
        const ones = BitmaskFootprint.countBits(this.bitmask);
        console.log(`\n📊 Установлено битов: ${ones}/64 (${Math.round(ones/64*100)}%)`);
        console.log(`📐 Точек в оригинале: ${this.points.length}`);
    }

    // 9. СОХРАНИТЬ В JSON
    toJSON() {
        return {
            bitmask: this.bitmask.toString(),
            pointsCount: this.points.length,
            config: this.config
        };
    }

    // 10. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        const bitmask = data.bitmask ? BigInt(data.bitmask) : 0n;
        return new BitmaskFootprint({
            bitmask: bitmask,
            points: data.points || [],
            gridSize: data.config?.gridSize || 8
        });
    }

    // 11. СГЕНЕРИРОВАТЬ СЛУЧАЙНУЮ МАСКУ (для тестов)
    static random() {
        let mask = 0n;
        for (let i = 0; i < 64; i++) {
            if (Math.random() > 0.7) { // 30% вероятность
                mask |= (1n << BigInt(i));
            }
        }
        return new BitmaskFootprint({ bitmask: mask });
    }
}

module.exports = BitmaskFootprint;
