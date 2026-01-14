// modules/footprint/alignment/coordinate-validator.js
class CoordinateValidator {
    constructor(options = {}) {
        this.debug = options.debug || true;
    }
   
    // 🔥 Проверить согласованность систем координат
    validateCoordinateSystems(footprint1, footprint2) {
        console.log('\n🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ СИСТЕМ КООРДИНАТ:');
       
        // 1. Получить точки в разных системах
        const points1_raw = this.getPointsInOriginalSystem(footprint1);
        const points1_normalized = this.getPointsInNormalizedSystem(footprint1);
       
        const points2_raw = this.getPointsInOriginalSystem(footprint2);
        const points2_normalized = this.getPointsInNormalizedSystem(footprint2);
       
        // 2. Сравнить bounding boxes
        const bb1_raw = this.calculateBoundingBox(points1_raw);
        const bb1_norm = this.calculateBoundingBox(points1_normalized);
       
        const bb2_raw = this.calculateBoundingBox(points2_raw);
        const bb2_norm = this.calculateBoundingBox(points2_normalized);
       
        console.log(`\n📏 RAW COORDINATES:`);
        console.log(`   След 1: ${bb1_raw.width.toFixed(1)}x${bb1_raw.height.toFixed(1)} (ratio: ${(bb1_raw.width/bb1_raw.height).toFixed(2)})`);
        console.log(`   След 2: ${bb2_raw.width.toFixed(1)}x${bb2_raw.height.toFixed(1)} (ratio: ${(bb2_raw.width/bb2_raw.height).toFixed(2)})`);
       
        console.log(`\n📏 NORMALIZED COORDINATES:`);
        console.log(`   След 1: ${bb1_norm.width.toFixed(3)}x${bb1_norm.height.toFixed(3)} (ratio: ${(bb1_norm.width/bb1_norm.height).toFixed(2)})`);
        console.log(`   След 2: ${bb2_norm.width.toFixed(3)}x${bb2_norm.height.toFixed(3)} (ratio: ${(bb2_norm.width/bb2_norm.height).toFixed(2)})`);
       
        // 3. Проверить трансформации
        const trans1 = footprint1.getTransformation();
        const trans2 = footprint2.getTransformation();
       
        if (trans1 && trans2) {
            console.log(`\n📐 ТРАНСФОРМАЦИИ:`);
            console.log(`   След 1: угол=${trans1.rotationAngle?.toFixed(1)}°, зеркало=${trans1.isMirrored}`);
            console.log(`   След 2: угол=${trans2.rotationAngle?.toFixed(1)}°, зеркало=${trans2.isMirrored}`);
           
            const angleDiff = Math.abs(trans1.rotationAngle - trans2.rotationAngle);
            console.log(`   Разница углов: ${angleDiff.toFixed(1)}°`);
           
            if (angleDiff > 80 && angleDiff < 100) {
                console.log(`   ⚠️  Возможно, нужна коррекция на 90°`);
            }
        }
       
        // 4. Проверить совместимость с шаблоном
        const templateCompatible1 = this.checkTemplateCompatibility(points1_normalized);
        const templateCompatible2 = this.checkTemplateCompatibility(points2_normalized);
       
        console.log(`\n🎯 СОВМЕСТИМОСТЬ С ШАБЛОНОМ:`);
        console.log(`   След 1: ${templateCompatible1 ? '✅' : '❌'}`);
        console.log(`   След 2: ${templateCompatible2 ? '✅' : '❌'}`);
       
        // 5. Рекомендации
        this.provideRecommendations(
            bb1_raw, bb1_norm,
            bb2_raw, bb2_norm,
            trans1, trans2
        );
    }
   
    getPointsInOriginalSystem(footprint) {
        const points = [];
        if (footprint.pointTracker) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({ x: point.x, y: point.y });
            }
        }
        return points;
    }
   
    getPointsInNormalizedSystem(footprint) {
        const points = this.getPointsInOriginalSystem(footprint);
        const transformation = footprint.getTransformation();
       
        if (!transformation || !transformation.matrix) {
            return points;
        }
       
        // Применяем трансформацию
        return points.map(point => {
            const matrix = transformation.matrix;
            const center = transformation.center || { x: 0, y: 0 };
           
            const relX = point.x - center.x;
            const relY = point.y - center.y;
           
            const transformedX = relX * matrix[0] + relY * matrix[1] + center.x + matrix[2];
            const transformedY = relX * matrix[3] + relY * matrix[4] + center.y + matrix[5];
           
            return { x: transformedX, y: transformedY };
        });
    }
   
    calculateBoundingBox(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }
   
    checkTemplateCompatibility(points) {
        if (points.length === 0) return false;
       
        const bb = this.calculateBoundingBox(points);
        const ratio = bb.width / Math.max(1, bb.height);
       
        // Шаблон ожидает ratio ~1.0-3.0
        return ratio >= 0.5 && ratio <= 4.0;
    }
   
    provideRecommendations(bb1_raw, bb1_norm, bb2_raw, bb2_norm, trans1, trans2) {
        console.log('\n💡 РЕКОМЕНДАЦИИ:');
       
        const ratio1_raw = bb1_raw.width / bb1_raw.height;
        const ratio2_raw = bb2_raw.width / bb2_raw.height;
        const ratio1_norm = bb1_norm.width / bb1_norm.height;
        const ratio2_norm = bb2_norm.width / bb2_norm.height;
       
        // Проверка на поворот 90°
        if ((ratio1_raw > 2.0 && ratio2_raw < 0.5) || (ratio1_raw < 0.5 && ratio2_raw > 2.0)) {
            console.log(`   1. 🔄 Применить коррекцию поворота 90°`);
            console.log(`      Ratio: ${ratio1_raw.toFixed(2)} vs ${ratio2_raw.toFixed(2)}`);
        }
       
        // Проверка масштаба
        const scaleDiff = Math.abs(bb1_raw.width - bb2_raw.width) / Math.max(bb1_raw.width, bb2_raw.width);
        if (scaleDiff > 0.3) {
            console.log(`   2. 📏 Скорректировать масштаб (разница: ${(scaleDiff*100).toFixed(0)}%)`);
        }
       
        // Проверка нормализации
        if (Math.abs(ratio1_norm - ratio2_norm) > 0.5) {
            console.log(`   3. 🎯 Исправить нормализацию`);
            console.log(`      Нормализованные ratio: ${ratio1_norm.toFixed(2)} vs ${ratio2_norm.toFixed(2)}`);
        }
       
        // Проверка трансформаций
        if (trans1 && trans2 && trans1.isMirrored !== trans2.isMirrored) {
            console.log(`   4. 🪞 Скорректировать зеркальность`);
        }
       
        console.log(`\n🎯 ПРИОРИТЕТ: ${this.getPriorityRecommendation(ratio1_raw, ratio2_raw)}`);
    }
   
    getPriorityRecommendation(ratio1, ratio2) {
        if (Math.abs(ratio1 - ratio2) > 1.5) {
            return "Сначала исправить ориентацию (поворот 90°), затем выравнивание";
        } else if (Math.abs(ratio1 - ratio2) > 0.5) {
            return "Скорректировать выравнивание и масштаб";
        } else {
            return "Системы координат совместимы, можно сравнивать";
        }
    }
}

module.exports = CoordinateValidator;
