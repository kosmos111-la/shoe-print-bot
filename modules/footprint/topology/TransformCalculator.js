// modules/footprint/topology/TransformCalculator.js
// 🔄 ВЫЧИСЛЕНИЕ ТРАНСФОРМАЦИИ МЕЖДУ ФОТО ПО ОБЩИМ ТОЧКАМ

class TransformCalculator {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🔄 TransformCalculator создан (глобальная трансформация)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Вычислить трансформацию по общим точкам
    computeTransformation(points1, points2) {
        if (points1.length < 2 || points2.length < 2 || points1.length !== points2.length) {
            console.log(`⚠️ Недостаточно точек для трансформации: ${points1.length}/${points2.length}`);
            return null;
        }

        console.log(`🔄 Вычисляю трансформацию по ${points1.length} общим точкам...`);

        // 1. ПРОСТАЯ ТРАНСФОРМАЦИЯ (сдвиг + поворот + масштаб)
        if (points1.length >= 2) {
            const similarity = this.computeSimilarityTransform(points1, points2);
            if (similarity) {
                console.log(`   ✅ Найдена трансформация подобия:`);
                console.log(`      Угол: ${similarity.angle.toFixed(2)}°`);
                console.log(`      Масштаб: ${similarity.scale.toFixed(3)}`);
                console.log(`      Сдвиг: (${similarity.dx.toFixed(1)}, ${similarity.dy.toFixed(1)})`);
                return similarity;
            }
        }

        // 2. АФФИННАЯ ТРАНСФОРМАЦИЯ (если >= 3 точек)
        if (points1.length >= 3) {
            const affine = this.computeAffineTransform(points1, points2);
            if (affine) {
                console.log(`   ✅ Найдена аффинная трансформация`);
                return affine;
            }
        }

        // 3. ПЕРСПЕКТИВНАЯ ТРАНСФОРМАЦИЯ (если >= 4 точек)
        if (points1.length >= 4) {
            const perspective = this.computePerspectiveTransform(points1, points2);
            if (perspective) {
                console.log(`   ✅ Найдена перспективная трансформация`);
                return perspective;
            }
        }

        console.log(`   ⚠️ Не удалось вычислить трансформацию`);
        return null;
    }

    // 🔥 ТРАНСФОРМАЦИЯ ПОДОБИЯ (сдвиг + поворот + масштаб) - 2+ точек
    computeSimilarityTransform(points1, points2) {
        if (points1.length < 2) return null;

        // Вычисляем центры масс
        let cx1 = 0, cy1 = 0, cx2 = 0, cy2 = 0;
        for (let i = 0; i < points1.length; i++) {
            cx1 += points1[i].x;
            cy1 += points1[i].y;
            cx2 += points2[i].x;
            cy2 += points2[i].y;
        }
        cx1 /= points1.length;
        cy1 /= points1.length;
        cx2 /= points1.length;
        cy2 /= points1.length;

        // Вычисляем масштаб и поворот
        let sumNum = 0, sumDen = 0;
        for (let i = 0; i < points1.length; i++) {
            const x1 = points1[i].x - cx1;
            const y1 = points1[i].y - cy1;
            const x2 = points2[i].x - cx2;
            const y2 = points2[i].y - cy2;
           
            sumNum += x1 * x2 + y1 * y2;
            sumDen += x1 * x1 + y1 * y1;
        }

        const scale = sumNum / Math.max(0.001, sumDen);
       
        // Вычисляем угол поворота
        let angle = 0;
        if (points1.length >= 2) {
            let sumSin = 0, sumCos = 0;
            for (let i = 0; i < points1.length; i++) {
                const x1 = points1[i].x - cx1;
                const y1 = points1[i].y - cy1;
                const x2 = points2[i].x - cx2;
                const y2 = points2[i].y - cy2;
               
                sumSin += x1 * y2 - y1 * x2;
                sumCos += x1 * x2 + y1 * y2;
            }
            angle = Math.atan2(sumSin, sumCos) * 180 / Math.PI;
        }

        // Сдвиг
        const dx = cx2 - scale * (cx1 * Math.cos(angle * Math.PI/180) - cy1 * Math.sin(angle * Math.PI/180));
        const dy = cy2 - scale * (cx1 * Math.sin(angle * Math.PI/180) + cy1 * Math.cos(angle * Math.PI/180));

        // Оценка качества
        let error = 0;
        for (let i = 0; i < points1.length; i++) {
            const transformed = this.applySimilarity(points1[i], { angle, scale, dx, dy });
            const err = Math.hypot(transformed.x - points2[i].x, transformed.y - points2[i].y);
            error += err;
        }
        error /= points1.length;

        return {
            type: 'similarity',
            angle,
            scale,
            dx,
            dy,
            error,
            confidence: Math.max(0, 1 - error / 100)
        };
    }

    // 🔥 АФФИННАЯ ТРАНСФОРМАЦИЯ (3+ точек)
    computeAffineTransform(points1, points2) {
        if (points1.length < 3) return null;

        // Упрощённая аффинная трансформация
        // В реальности здесь решение системы уравнений методом наименьших квадратов
        const similarity = this.computeSimilarityTransform(points1, points2);
        if (!similarity) return null;

        return {
            type: 'affine',
            ...similarity,
            confidence: similarity.confidence * 0.95
        };
    }

    // 🔥 ПЕРСПЕКТИВНАЯ ТРАНСФОРМАЦИЯ (4+ точек)
    computePerspectiveTransform(points1, points2) {
        if (points1.length < 4) return null;

        // Упрощённая перспективная трансформация
        const similarity = this.computeSimilarityTransform(points1, points2);
        if (!similarity) return null;

        return {
            type: 'perspective',
            ...similarity,
            confidence: similarity.confidence * 0.9
        };
    }

    // 🔥 ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ К ТОЧКЕ
    applyTransform(point, transform) {
        if (!transform) return point;

        switch (transform.type) {
            case 'similarity':
                return this.applySimilarity(point, transform);
            case 'affine':
                return this.applySimilarity(point, transform); // Упрощённо
            case 'perspective':
                return this.applySimilarity(point, transform); // Упрощённо
            default:
                return point;
        }
    }

    // 🔥 ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ ПОДОБИЯ
    applySimilarity(point, transform) {
        const rad = transform.angle * Math.PI / 180;
        const x = point.x;
        const y = point.y;
       
        const tx = transform.dx + transform.scale * (x * Math.cos(rad) - y * Math.sin(rad));
        const ty = transform.dy + transform.scale * (x * Math.sin(rad) + y * Math.cos(rad));
       
        return { x: tx, y: ty };
    }

    // 🔥 ПРИМЕНИТЬ ОБРАТНУЮ ТРАНСФОРМАЦИЮ
    applyInverse(point, transform) {
        if (!transform) return point;

        const rad = -transform.angle * Math.PI / 180;
        const x = point.x - transform.dx;
        const y = point.y - transform.dy;
       
        const tx = (x * Math.cos(rad) - y * Math.sin(rad)) / transform.scale;
        const ty = (x * Math.sin(rad) + y * Math.cos(rad)) / transform.scale;
       
        return { x: tx, y: ty };
    }
}

module.exports = TransformCalculator;
