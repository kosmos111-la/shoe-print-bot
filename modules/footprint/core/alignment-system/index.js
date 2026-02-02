// modules/footprint/core/alignment-system/index.js
const CoordinateSystem = require('../coordinate-system');

/**
* Унифицированная система выравнивания
* Заменяет 5 модулей: simple-aligner, improved-aligner,
* coordinate-system-converter, coordinate-validator, transformation-debugger
*/
class AlignmentSystem {
    static alignPoints(points, reference, options = {}) {
        console.log('[AlignmentSystem] Выравнивание точек');
       
        const opts = {
            method: 'procrustes', // 'procrustes', 'affine', 'similarity'
            scale: true,
            rotation: true,
            translation: true,
            ...options
        };
       
        // Если недостаточно точек
        if (points.length < 3 || reference.length < 3) {
            return this.simpleAlignment(points, reference, opts);
        }
       
        switch (opts.method) {
            case 'procrustes':
                return this.procrustesAlignment(points, reference, opts);
            case 'affine':
                return this.affineAlignment(points, reference, opts);
            case 'similarity':
                return this.similarityAlignment(points, reference, opts);
            default:
                return this.simpleAlignment(points, reference, opts);
        }
    }
   
    static simpleAlignment(points, reference, options) {
        // Простое центрирование
        const pointsCenter = CoordinateSystem.calculateCenter(points);
        const refCenter = CoordinateSystem.calculateCenter(reference);
       
        const dx = refCenter.x - pointsCenter.x;
        const dy = refCenter.y - pointsCenter.y;
       
        return points.map(p => ({
            x: p.x + dx,
            y: p.y + dy,
            aligned: true,
            method: 'simple_translation'
        }));
    }
   
    static procrustesAlignment(points, reference, options) {
        // Упрощённая версия Procrustes
        console.log('[AlignmentSystem] Procrustes выравнивание');
       
        // 1. Центрируем
        const centeredPoints = CoordinateSystem.centerPoints(points);
        const centeredRef = CoordinateSystem.centerPoints(reference);
       
        // 2. Вычисляем масштаб
        const scale = this.calculateScale(centeredPoints, centeredRef);
       
        // 3. Вычисляем оптимальный поворот
        const angle = this.calculateOptimalRotation(centeredPoints, centeredRef);
       
        // 4. Применяем трансформацию
        const rotated = CoordinateSystem.rotate(centeredPoints, angle);
        const scaled = rotated.map(p => ({
            x: p.x * scale,
            y: p.y * scale
        }));
       
        // 5. Возвращаем в исходную позицию
        const pointsCenter = CoordinateSystem.calculateCenter(points);
        return scaled.map(p => ({
            x: p.x + pointsCenter.x,
            y: p.y + pointsCenter.y,
            aligned: true,
            method: 'procrustes',
            scale,
            angle
        }));
    }
   
    static calculateScale(points1, points2) {
        if (points1.length !== points2.length || points1.length < 2) {
            return 1.0;
        }
       
        let sum1 = 0, sum2 = 0;
        for (let i = 0; i < points1.length; i++) {
            const d1 = Math.sqrt(points1[i].x * points1[i].x + points1[i].y * points1[i].y);
            const d2 = Math.sqrt(points2[i].x * points2[i].x + points2[i].y * points2[i].y);
            sum1 += d1;
            sum2 += d2;
        }
       
        return sum2 / (sum1 || 1);
    }
   
    static calculateOptimalRotation(points1, points2) {
        if (points1.length !== points2.length || points1.length < 2) {
            return 0;
        }
       
        let sum = 0;
        for (let i = 0; i < points1.length; i++) {
            sum += points1[i].x * points2[i].y - points1[i].y * points2[i].x;
        }
       
        return Math.atan2(sum, 1) * 180 / Math.PI;
    }
   
    // Для обратной совместимости
    static convertCoordinates(points, fromSystem, toSystem) {
        console.log(`[AlignmentSystem] Конвертация: ${fromSystem} → ${toSystem}`);
        return points; // В единой системе конвертация не нужна
    }
   
    static validateAlignment(points, reference, threshold = 10) {
        if (points.length !== reference.length) {
            return { valid: false, error: 'Разное количество точек' };
        }
       
        let totalError = 0;
        const errors = [];
       
        for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - reference[i].x;
    const dy = points[i].y - reference[i].y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    totalError += distance;
    errors.push({ index: i, distance });

    if (distance > threshold) {
        // Не возвращаем сразу, а собираем все ошибки
        return {
            valid: false,
            error: `Точка ${i} слишком далеко: ${distance.toFixed(1)}px`,
            maxError: distance,
            averageError: totalError / (i + 1),
            allErrors: errors // Добавляем все ошибки
        };
    }
}

const avgError = totalError / points.length;
return {
    valid: true,
    averageError: avgError,
    maxError: Math.max(...errors.map(e => e.distance)),
    errors
};
       
        const avgError = totalError / points.length;
        return {
            valid: true,
            averageError: avgError,
            maxError: Math.max(...errors.map(e => e.distance)),
            errors
        };
    }
}

module.exports = AlignmentSystem;
