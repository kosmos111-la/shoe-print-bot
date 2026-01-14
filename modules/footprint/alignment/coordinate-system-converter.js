// modules/footprint/alignment/coordinate-system-converter.js
class CoordinateSystemConverter {
    constructor(options = {}) {
        this.debug = options.debug || true;
    }
   
    // 🔥 Преобразовать точки из одной системы координат в другую
    convertPoints(points, fromSystem, toSystem) {
        console.log(`🔄 Преобразование ${points.length} точек между системами координат...`);
       
        if (!fromSystem || !toSystem) {
            console.log('⚠️ Нет информации о системах координат');
            return points;
        }
       
        console.log(`📐 ИЗ системы: ${fromSystem.type || 'unknown'} (угол: ${fromSystem.rotationAngle?.toFixed(1)}°)`);
        console.log(`📐 В систему: ${toSystem.type || 'unknown'} (угол: ${toSystem.rotationAngle?.toFixed(1)}°)`);
       
        // 1. Если системы одинаковые - возвращаем как есть
        if (this.areSystemsCompatible(fromSystem, toSystem)) {
            console.log('✅ Системы координат совместимы, преобразование не требуется');
            return points;
        }
       
        // 2. Применяем преобразование
        const convertedPoints = points.map(point => {
            return this.convertSinglePoint(point, fromSystem, toSystem);
        });
       
        // 3. Дебаг
        if (this.debug && points.length > 0) {
            const original = points[0];
            const converted = convertedPoints[0];
            console.log(`🔍 Пример преобразования:`);
            console.log(`   Было: (${original.x?.toFixed(1)}, ${original.y?.toFixed(1)})`);
            console.log(`   Стало: (${converted.x?.toFixed(1)}, ${converted.y?.toFixed(1)})`);
            console.log(`   Смещение: (${(converted.x - original.x).toFixed(1)}, ${(converted.y - original.y).toFixed(1)})`);
        }
       
        return convertedPoints;
    }
   
    // 🔥 Преобразовать одну точку
    convertSinglePoint(point, fromSystem, toSystem) {
        let x = point.x;
        let y = point.y;
       
        // 1. Обратное преобразование из исходной системы
        if (fromSystem.matrix && fromSystem.matrix.length === 9) {
            const invPoint = this.applyInverseTransformation({x, y}, fromSystem);
            x = invPoint.x;
            y = invPoint.y;
        }
       
        // 2. Прямое преобразование в целевую систему
        if (toSystem.matrix && toSystem.matrix.length === 9) {
            const transPoint = this.applyTransformation({x, y}, toSystem);
            x = transPoint.x;
            y = transPoint.y;
        }
       
        return {
            ...point,
            x: x,
            y: y,
            converted: true,
            fromSystem: fromSystem.type,
            toSystem: toSystem.type
        };
    }
   
    // 🔥 Проверить совместимость систем
    areSystemsCompatible(system1, system2) {
        if (!system1 || !system2) return false;
       
        // Проверяем углы
        const angle1 = system1.rotationAngle || 0;
        const angle2 = system2.rotationAngle || 0;
        const angleDiff = Math.abs(angle1 - angle2) % 360;
       
        // Углы должны быть близки (в пределах 5°) или различаться на 180°
        const isAngleCompatible = angleDiff < 5 || Math.abs(angleDiff - 180) < 5;
       
        // Проверяем зеркальность
        const isMirrorCompatible = system1.isMirrored === system2.isMirrored;
       
        return isAngleCompatible && isMirrorCompatible;
    }
   
    // 🔥 Применить обратную трансформацию
    applyInverseTransformation(point, transformation) {
        if (!transformation.matrix || transformation.matrix.length !== 9) {
            return point;
        }
       
        const matrix = transformation.matrix;
        const center = transformation.center || { x: 0, y: 0 };
       
        // Вычисляем обратную матрицу для поворота+сдвига
        const det = matrix[0] * matrix[4] - matrix[1] * matrix[3];
       
        if (Math.abs(det) < 1e-10) {
            console.log('⚠️ Вырожденная матрица, возвращаю исходную точку');
            return point;
        }
       
        const invMatrix = [
            matrix[4] / det, -matrix[1] / det, 0,
            -matrix[3] / det, matrix[0] / det, 0,
            0, 0, 1
        ];
       
        const tx = matrix[2];
        const ty = matrix[5];
       
        const relX = point.x - center.x - tx;
        const relY = point.y - center.y - ty;
       
        const originalX = relX * invMatrix[0] + relY * invMatrix[1] + center.x;
        const originalY = relX * invMatrix[3] + relY * invMatrix[4] + center.y;
       
        return { x: originalX, y: originalY };
    }
   
    // 🔥 Применить прямую трансформацию
    applyTransformation(point, transformation) {
        if (!transformation.matrix || transformation.matrix.length !== 9) {
            return point;
        }
       
        const matrix = transformation.matrix;
        const center = transformation.center || { x: 0, y: 0 };
       
        const relX = point.x - center.x;
        const relY = point.y - center.y;
       
        const transformedX = relX * matrix[0] + relY * matrix[1] + center.x + matrix[2];
        const transformedY = relX * matrix[3] + relY * matrix[4] + center.y + matrix[5];
       
        return { x: transformedX, y: transformedY };
    }
   
    // 🔥 Анализировать системы координат
    analyzeCoordinateSystems(footprint1, footprint2) {
        console.log('\n🔍 АНАЛИЗ СИСТЕМ КООРДИНАТ:');
       
        const system1 = this.extractCoordinateSystem(footprint1);
        const system2 = this.extractCoordinateSystem(footprint2);
       
        console.log(`\n📐 СИСТЕМА 1 (${footprint1.name}):`);
        this.printSystemInfo(system1);
       
        console.log(`\n📐 СИСТЕМА 2 (${footprint2.name}):`);
        this.printSystemInfo(system2);
       
        console.log(`\n🎯 СОВМЕСТИМОСТЬ: ${this.areSystemsCompatible(system1, system2) ? '✅' : '❌'}`);
       
        if (!this.areSystemsCompatible(system1, system2)) {
            console.log(`💡 РЕКОМЕНДАЦИЯ: Нужно преобразовать System2 → System1`);
            return this.createConversionPlan(system1, system2);
        }
       
        return { compatible: true };
    }
   
    extractCoordinateSystem(footprint) {
        const transformation = footprint.getTransformation();
        const points = this.getSamplePoints(footprint);
        const bounds = this.calculateBounds(points);
       
        return {
            type: transformation ? 'transformed' : 'raw',
            rotationAngle: transformation?.rotationAngle || 0,
            isMirrored: transformation?.isMirrored || false,
            matrix: transformation?.matrix,
            center: transformation?.center,
            bounds: bounds,
            pointCount: points.length,
            footprintName: footprint.name
        };
    }
   
    printSystemInfo(system) {
        console.log(`   • Тип: ${system.type}`);
        console.log(`   • Угол: ${system.rotationAngle.toFixed(1)}°`);
        console.log(`   • Зеркало: ${system.isMirrored ? 'да' : 'нет'}`);
        console.log(`   • Границы: ${system.bounds.width.toFixed(1)}x${system.bounds.height.toFixed(1)}`);
        console.log(`   • Ratio: ${(system.bounds.width / system.bounds.height).toFixed(2)}`);
        console.log(`   • Точки: ${system.pointCount}`);
    }
   
    getSamplePoints(footprint) {
        const points = [];
        if (footprint.pointTracker) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({ x: point.x, y: point.y });
                if (points.length >= 10) break;
            }
        }
        return points;
    }
   
    calculateBounds(points) {
        if (points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
       
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
   
    createConversionPlan(system1, system2) {
        console.log('\n📋 ПЛАН ПРЕОБРАЗОВАНИЯ:');
       
        const steps = [];
       
        // 1. Коррекция угла
        const angleDiff = Math.abs(system1.rotationAngle - system2.rotationAngle);
        if (angleDiff > 5 && angleDiff < 355) {
            const neededRotation = system1.rotationAngle - system2.rotationAngle;
            steps.push(`1. Повернуть на ${neededRotation.toFixed(1)}°`);
        }
       
        // 2. Коррекция зеркальности
        if (system1.isMirrored !== system2.isMirrored) {
            steps.push(`2. ${system2.isMirrored ? 'Убрать' : 'Применить'} зеркальное отражение`);
        }
       
        // 3. Коррекция масштаба
        const scaleX = system1.bounds.width / system2.bounds.width;
        const scaleY = system1.bounds.height / system2.bounds.height;
       
        if (Math.abs(scaleX - 1) > 0.1 || Math.abs(scaleY - 1) > 0.1) {
            steps.push(`3. Масштабировать: X=${scaleX.toFixed(2)}x, Y=${scaleY.toFixed(2)}x`);
        }
       
        // 4. Коррекция центра
        const center1 = {
            x: (system1.bounds.minX + system1.bounds.maxX) / 2,
            y: (system1.bounds.minY + system1.bounds.maxY) / 2
        };
       
        const center2 = {
            x: (system2.bounds.minX + system2.bounds.maxX) / 2,
            y: (system2.bounds.minY + system2.bounds.maxY) / 2
        };
       
        const centerDiff = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );
       
        if (centerDiff > 50) {
            steps.push(`4. Сдвинуть центр на (${(center1.x - center2.x).toFixed(1)}, ${(center1.y - center2.y).toFixed(1)})px`);
        }
       
        return {
            compatible: false,
            steps: steps,
            system1: system1,
            system2: system2
        };
    }
}

module.exports = CoordinateSystemConverter;
