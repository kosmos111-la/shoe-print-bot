// modules/footprint/moment-footprint.js
// 7 ГЕОМЕТРИЧЕСКИХ МОМЕНТОВ ДЛЯ БЫСТРОЙ КЛАССИФИКАЦИИ

class MomentFootprint {
    constructor(options = {}) {
        this.moments = options.moments || {
            m00: 0, // площадь (количество точек)
            m10: 0, m01: 0, // центроид
            m20: 0, m02: 0, // моменты инерции
            m11: 0, // корреляция
            m30: 0, m03: 0, // асимметрия
            hu1: 0, hu2: 0, hu3: 0, hu4: 0, // моменты Ху
            hu5: 0, hu6: 0, hu7: 0
        };
       
        this.points = options.points || [];
        this.config = {
            normalize: true,
            calculateHuMoments: true
        };
    }

    // 1. ВЫЧИСЛИТЬ МОМЕНТЫ ИЗ ТОЧЕК
    calculateFromPoints(points) {
        if (!points || points.length < 3) {
            console.log('⚠️ Слишком мало точек для моментов');
            return this.moments;
        }

        this.points = points;
       
        // Нормализовать точки
        const normalized = this.normalizePoints(points);
       
        // Рассчитать моменты
        this.calculateRawMoments(normalized);
       
        // Рассчитать центральные моменты
        this.calculateCentralMoments(normalized);
       
        // Рассчитать моменты Ху (инвариантные к масштабу, повороту, отражению)
        if (this.config.calculateHuMoments) {
            this.calculateHuMoments();
        }
       
        return this.moments;
    }

    // 2. РАСЧЁТ СЫРЫХ МОМЕНТОВ
    calculateRawMoments(points) {
        let m00 = points.length;
        let m10 = 0, m01 = 0;
        let m20 = 0, m02 = 0, m11 = 0;
        let m30 = 0, m03 = 0, m21 = 0, m12 = 0;

        points.forEach(p => {
            const x = p.x;
            const y = p.y;
           
            m10 += x;
            m01 += y;
            m20 += x * x;
            m02 += y * y;
            m11 += x * y;
            m30 += x * x * x;
            m03 += y * y * y;
            m21 += x * x * y;
            m12 += x * y * y;
        });

        this.moments = {
            ...this.moments,
            m00, m10, m01, m20, m02, m11, m30, m03, m21, m12
        };
    }

    // 3. РАСЧЁТ ЦЕНТРАЛЬНЫХ МОМЕНТОВ
    calculateCentralMoments(points) {
        const { m00, m10, m01 } = this.moments;
       
        if (m00 === 0) return;
       
        const xc = m10 / m00; // Центр масс X
        const yc = m01 / m00; // Центр масс Y
       
        let mu20 = 0, mu02 = 0, mu11 = 0;
        let mu30 = 0, mu03 = 0, mu21 = 0, mu12 = 0;

        points.forEach(p => {
            const x = p.x - xc;
            const y = p.y - yc;
           
            mu20 += x * x;
            mu02 += y * y;
            mu11 += x * y;
            mu30 += x * x * x;
            mu03 += y * y * y;
            mu21 += x * x * y;
            mu12 += x * y * y;
        });

        // Нормализация
        const area = m00;
        const n20 = mu20 / Math.pow(area, 2);
        const n02 = mu02 / Math.pow(area, 2);
        const n11 = mu11 / Math.pow(area, 2);
        const n30 = mu30 / Math.pow(area, 2.5);
        const n03 = mu03 / Math.pow(area, 2.5);
        const n21 = mu21 / Math.pow(area, 2.5);
        const n12 = mu12 / Math.pow(area, 2.5);

        this.moments = {
            ...this.moments,
            xc, yc,
            mu20, mu02, mu11,
            mu30, mu03, mu21, mu12,
            n20, n02, n11,
            n30, n03, n21, n12
        };
    }

    // 4. РАСЧЁТ МОМЕНТОВ ХУ (7 инвариантных моментов)
    calculateHuMoments() {
        const { n20, n02, n11, n30, n03, n21, n12 } = this.moments;
       
        // Моменты Ху
        const hu1 = n20 + n02;
        const hu2 = Math.pow((n20 - n02), 2) + 4 * Math.pow(n11, 2);
        const hu3 = Math.pow((n30 - 3 * n12), 2) + Math.pow((3 * n21 - n03), 2);
        const hu4 = Math.pow((n30 + n12), 2) + Math.pow((n21 + n03), 2);
        const hu5 = (n30 - 3 * n12) * (n30 + n12) *
                   (Math.pow((n30 + n12), 2) - 3 * Math.pow((n21 + n03), 2)) +
                   (3 * n21 - n03) * (n21 + n03) *
                   (3 * Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2));
        const hu6 = (n20 - n02) * (Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2)) +
                   4 * n11 * (n30 + n12) * (n21 + n03);
        const hu7 = (3 * n21 - n03) * (n30 + n12) *
                   (Math.pow((n30 + n12), 2) - 3 * Math.pow((n21 + n03), 2)) -
                   (n30 - 3 * n12) * (n21 + n03) *
                   (3 * Math.pow((n30 + n12), 2) - Math.pow((n21 + n03), 2));

        this.moments = {
            ...this.moments,
            hu1, hu2, hu3, hu4, hu5, hu6, hu7
        };
    }

    // 5. НОРМАЛИЗОВАТЬ ТОЧКИ
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

    // 6. СРАВНИТЬ С ДРУГИМИ МОМЕНТАМИ
    compare(otherMoments) {
        if (!otherMoments || !otherMoments.moments) {
            return { distance: Infinity, similarity: 0 };
        }

        const moments1 = this.get7Moments();
        const moments2 = otherMoments.get7Moments();

        // Евклидово расстояние между 7 моментами
        let distance = 0;
        for (let i = 0; i < moments1.length; i++) {
            const diff = moments1[i] - moments2[i];
            distance += diff * diff;
        }
        distance = Math.sqrt(distance);

        // Логарифмическое сходство (моменты Ху могут быть очень малыми)
        const similarity = 1 / (1 + distance);

        let decision;
        if (distance < 0.1) decision = 'highly_similar';
        else if (distance < 0.3) decision = 'similar';
        else if (distance < 0.5) decision = 'somewhat_similar';
        else decision = 'different';

        return {
            distance,
            similarity,
            decision,
            reason: `Евклидово расстояние между моментами Ху: ${distance.toFixed(4)}`
        };
    }

    // 7. ПОЛУЧИТЬ 7 ОСНОВНЫХ МОМЕНТОВ ХУ
    get7Moments() {
        return [
            this.moments.hu1 || 0,
            this.moments.hu2 || 0,
            this.moments.hu3 || 0,
            this.moments.hu4 || 0,
            this.moments.hu5 || 0,
            this.moments.hu6 || 0,
            this.moments.hu7 || 0
        ];
    }

    // 8. ПРОВЕРИТЬ ФОРМУ СЛЕДА
    analyzeShape() {
        const moments = this.get7Moments();
       
        // Эмпирические пороги для разных форм
        const analysis = {
            isRound: moments[0] > 0.5 && moments[1] < 0.1,
            isElongated: moments[1] > 0.3,
            isSymmetric: moments[2] < 0.05 && moments[3] < 0.05,
            isComplex: moments[6] > 0.1,
            hasClearOrientation: moments[1] > 0.2
        };

        // Определить тип формы
        let shapeType = 'unknown';
        if (analysis.isRound) shapeType = 'round';
        else if (analysis.isElongated && analysis.hasClearOrientation) shapeType = 'elongated';
        else if (analysis.isComplex) shapeType = 'complex_pattern';
        else if (analysis.isSymmetric) shapeType = 'symmetric';

        return {
            shapeType,
            analysis,
            moments: moments.map(m => m.toFixed(6))
        };
    }

    // 9. ВИЗУАЛИЗИРОВАТЬ МОМЕНТЫ
    visualize() {
        console.log('\n📐 ГЕОМЕТРИЧЕСКИЕ МОМЕНТЫ:');
       
        const shapeAnalysis = this.analyzeShape();
        console.log(`📊 Тип формы: ${shapeAnalysis.shapeType}`);
       
        console.log('\n🔢 МОМЕНТЫ ХУ (инвариантные):');
        const huMoments = this.get7Moments();
        huMoments.forEach((m, i) => {
            console.log(`  hu${i+1}: ${m.toExponential(4)}`);
        });
       
        console.log('\n📈 СЫРЫЕ МОМЕНТЫ:');
        console.log(`  Площадь (m00): ${this.moments.m00}`);
        console.log(`  Центр масс: (${this.moments.xc?.toFixed(3) || '?'}, ${this.moments.yc?.toFixed(3) || '?'})`);
        console.log(`  Моменты инерции: mu20=${this.moments.mu20?.toFixed(2) || '?'}, mu02=${this.moments.mu02?.toFixed(2) || '?'}`);
    }

    // 10. СОХРАНИТЬ В JSON
    toJSON() {
        return {
            moments: this.moments,
            pointsCount: this.points.length,
            config: this.config
        };
    }

    // 11. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        return new MomentFootprint({
            moments: data.moments || {},
            points: data.points || [],
            config: data.config || {}
        });
    }

    // 12. СГЕНЕРИРОВАТЬ ТЕСТОВЫЕ МОМЕНТЫ
    static generateTestShape(shapeType = 'random', pointCount = 30) {
        const points = [];
       
        switch(shapeType) {
            case 'circle':
                for (let i = 0; i < pointCount; i++) {
                    const angle = (i / pointCount) * Math.PI * 2;
                    points.push({
                        x: 0.5 + 0.4 * Math.cos(angle),
                        y: 0.5 + 0.4 * Math.sin(angle),
                        confidence: 0.8
                    });
                }
                break;
               
            case 'ellipse':
                for (let i = 0; i < pointCount; i++) {
                    const angle = (i / pointCount) * Math.PI * 2;
                    points.push({
                        x: 0.5 + 0.6 * Math.cos(angle),
                        y: 0.5 + 0.3 * Math.sin(angle),
                        confidence: 0.8
                    });
                }
                break;
               
            case 'rectangle':
                const sides = 4;
                for (let i = 0; i < pointCount; i++) {
                    const side = i % sides;
                    const pos = (i % (pointCount/sides)) / (pointCount/sides);
                   
                    let x, y;
                    switch(side) {
                        case 0: x = pos; y = 0; break;
                        case 1: x = 1; y = pos; break;
                        case 2: x = 1 - pos; y = 1; break;
                        case 3: x = 0; y = 1 - pos; break;
                    }
                    points.push({ x, y, confidence: 0.8 });
                }
                break;
               
            default: // random
                for (let i = 0; i < pointCount; i++) {
                    points.push({
                        x: Math.random(),
                        y: Math.random(),
                        confidence: 0.5 + Math.random() * 0.5
                    });
                }
        }
       
        const momentFootprint = new MomentFootprint();
        momentFootprint.calculateFromPoints(points);
        return momentFootprint;
    }
}

module.exports = MomentFootprint;
