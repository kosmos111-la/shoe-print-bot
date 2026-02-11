// modules/footprint/topology/TransformCalculator.js
// 🔥 ГЛОБАЛЬНАЯ ТРАНСФОРМАЦИЯ МЕЖДУ ФОТО ПО ОБЩИМ ТОЧКАМ

class TransformCalculator {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🔄 TransformCalculator создан (глобальная трансформация)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Вычислить трансформацию по общим точкам
    computeTransformation(points1, points2) {
        if (points1.length < 2 || points2.length < 2 || points1.length !== points2.length) {
            if (this.debug) console.log(`⚠️ Недостаточно точек: ${points1.length}/${points2.length}`);
            return null;
        }

        if (this.debug) console.log(`🔄 Вычисляю трансформацию по ${points1.length} общим точкам...`);

        // Всегда используем подобие (поворот + масштаб + сдвиг) - достаточно для наших задач
        const transform = this.computeSimilarityTransform(points1, points2);
       
        if (transform && this.debug) {
            console.log(`   ✅ Трансформация подобия:`);
            console.log(`      Угол: ${transform.angle.toFixed(2)}°`);
            console.log(`      Масштаб: ${transform.scale.toFixed(3)}`);
            console.log(`      Сдвиг: (${transform.dx.toFixed(1)}, ${transform.dy.toFixed(1)})`);
            console.log(`      Ошибка: ${transform.error.toFixed(2)}px`);
            console.log(`      Уверенность: ${(transform.confidence * 100).toFixed(0)}%`);
        }

        return transform;
    }

    // 🔥 ТРАНСФОРМАЦИЯ ПОДОБИЯ (сдвиг + поворот + масштаб)
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

        // Вычисляем масштаб
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
        let sumSin = 0, sumCos = 0;
        for (let i = 0; i < points1.length; i++) {
            const x1 = points1[i].x - cx1;
            const y1 = points1[i].y - cy1;
            const x2 = points2[i].x - cx2;
            const y2 = points2[i].y - cy2;
           
            sumSin += x1 * y2 - y1 * x2;
            sumCos += x1 * x2 + y1 * y2;
        }
        const angle = Math.atan2(sumSin, sumCos) * 180 / Math.PI;

        // Вычисляем сдвиг
        const rad = angle * Math.PI / 180;
        const dx = cx2 - scale * (cx1 * Math.cos(rad) - cy1 * Math.sin(rad));
        const dy = cy2 - scale * (cx1 * Math.sin(rad) + cy1 * Math.cos(rad));

        // Оценка качества
        let error = 0;
for (let i = 0; i < points1.length; i++) {
    // 🔥🔥🔥 ПРИМЕНЯЕМ ТРАНСФОРМАЦИЮ К ТОЧКАМ ИЗ МОДЕЛИ, А НЕ ИЗ ФОТО!
    const transformed = this.applyTransform(points2[i], { angle, scale, dx, dy, type: 'similarity' });
    const err = Math.hypot(transformed.x - points1[i].x, transformed.y - points1[i].y);
    error += err;
}
        error /= points1.length;

        // Уверенность: чем меньше ошибка, тем выше уверенность
        const confidence = Math.max(0, Math.min(1, 1 - error / 50));

        return {
            type: 'similarity',
            angle,
            scale,
            dx,
            dy,
            error,
            confidence,
            center1: { x: cx1, y: cy1 },
            center2: { x: cx2, y: cy2 }
        };
    }

    // 🔥 ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ К ТОЧКЕ
    applyTransform(point, transform) {
        if (!transform) return { x: point.x, y: point.y };

        const rad = transform.angle * Math.PI / 180;
        const x = point.x;
        const y = point.y;
       
        const tx = transform.dx + transform.scale * (x * Math.cos(rad) - y * Math.sin(rad));
        const ty = transform.dy + transform.scale * (x * Math.sin(rad) + y * Math.cos(rad));
       
        return { x: tx, y: ty };
    }

    // 🔥 ПРИМЕНИТЬ ОБРАТНУЮ ТРАНСФОРМАЦИЮ
    applyInverse(point, transform) {
        if (!transform) return { x: point.x, y: point.y };

        const rad = -transform.angle * Math.PI / 180;
        const x = point.x - transform.dx;
        const y = point.y - transform.dy;
       
        const tx = (x * Math.cos(rad) - y * Math.sin(rad)) / transform.scale;
        const ty = (x * Math.sin(rad) + y * Math.cos(rad)) / transform.scale;
       
        return { x: tx, y: ty };
    }
}

module.exports = TransformCalculator;
