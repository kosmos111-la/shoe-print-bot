// modules/footprint/alignment/coordinate-validator.js

class CoordinateValidator {
    constructor(options = {}) {
        this.config = {
            debug: options.debug || false,
            ...options
        };
    }

    // Валидация систем координат перед сравнением
    validateCoordinateSystems(footprint1, footprint2) {
        console.log('\n🔍 ВАЛИДАЦИЯ СИСТЕМ КООРДИНАТ:');
       
        // 1. Получаем трансформации
        const trans1 = footprint1.getTransformation();
        const trans2 = footprint2.getTransformation();
       
        console.log(`📌 След 1 "${footprint1.name}":`);
        console.log(`   • Угол: ${trans1?.rotationAngle?.toFixed(1) || 0}°`);
        console.log(`   • Зеркало: ${trans1?.isMirrored ? 'да' : 'нет'}`);
        console.log(`   • Матрица: ${trans1?.matrix ? 'есть' : 'нет'}`);
       
        console.log(`\n📌 След 2 "${footprint2.name}":`);
        console.log(`   • Угол: ${trans2?.rotationAngle?.toFixed(1) || 0}°`);
        console.log(`   • Зеркало: ${trans2?.isMirrored ? 'да' : 'нет'}`);
        console.log(`   • Матрица: ${trans2?.matrix ? 'есть' : 'нет'}`);
       
        // 2. Проверяем согласованность
        const issues = [];
       
        // Проверка углов
        if (trans1?.rotationAngle !== trans2?.rotationAngle) {
            const angleDiff = Math.abs((trans1?.rotationAngle || 0) - (trans2?.rotationAngle || 0));
            console.log(`⚠️ Разница углов: ${angleDiff.toFixed(1)}°`);
           
            if (angleDiff > 45 && angleDiff < 135) {
                issues.push({
                    type: 'rotation_mismatch',
                    severity: 'high',
                    message: `Существенная разница в углах поворота: ${angleDiff.toFixed(1)}°`,
                    suggestion: 'Применить автоматическую коррекцию поворота'
                });
            }
        }
       
        // Проверка зеркального отражения
        if (trans1?.isMirrored !== trans2?.isMirrored) {
            issues.push({
                type: 'mirror_mismatch',
                severity: 'high',
                message: 'Несовпадение зеркального отражения',
                suggestion: 'Применить коррекцию зеркального отражения'
            });
        }
       
        // 3. Проверяем точки
        const points1 = this.getPointsInfo(footprint1);
        const points2 = this.getPointsInfo(footprint2);
       
        console.log(`\n📊 ИНФОРМАЦИЯ О ТОЧКАХ:`);
        console.log(`   ${footprint1.name}: ${points1.count} точек, границы: ${points1.width.toFixed(1)}x${points1.height.toFixed(1)}`);
        console.log(`   ${footprint2.name}: ${points2.count} точек, границы: ${points2.width.toFixed(1)}x${points2.height.toFixed(1)}`);
       
        // Проверка пропорций
        const ratio1 = points1.width / Math.max(1, points1.height);
        const ratio2 = points2.width / Math.max(1, points2.height);
       
        console.log(`   Пропорции: ${ratio1.toFixed(2)} vs ${ratio2.toFixed(2)}`);
       
        // Если один след вертикальный, а другой горизонтальный
        const VERTICAL_THRESHOLD = 0.5;
        const HORIZONTAL_THRESHOLD = 2.0;
       
        const isVertical1 = ratio1 < VERTICAL_THRESHOLD;
        const isHorizontal1 = ratio1 > HORIZONTAL_THRESHOLD;
        const isVertical2 = ratio2 < VERTICAL_THRESHOLD;
        const isHorizontal2 = ratio2 > HORIZONTAL_THRESHOLD;
       
        if ((isVertical1 && isHorizontal2) || (isHorizontal1 && isVertical2)) {
            issues.push({
                type: 'orientation_mismatch',
                severity: 'high',
                message: 'Следы имеют разную ориентацию (вертикальный vs горизонтальный)',
                suggestion: 'Применить поворот на 90° для выравнивания ориентации'
            });
        }
       
        // 4. Вывод результатов валидации
        if (issues.length === 0) {
            console.log(`✅ Системы координат согласованы`);
            return {
                valid: true,
                issues: []
            };
        } else {
            console.log(`⚠️ Обнаружены проблемы:`);
            issues.forEach(issue => {
                console.log(`   • ${issue.type}: ${issue.message}`);
                console.log(`     Рекомендация: ${issue.suggestion}`);
            });
           
            return {
                valid: false,
                issues: issues,
                needsCorrection: issues.some(issue => issue.severity === 'high')
            };
        }
    }
   
    // Получить информацию о точках
    getPointsInfo(footprint) {
        const points = [];
       
        if (footprint.pointTracker) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({ x: point.x, y: point.y });
            }
        }
       
        if (points.length === 0) {
            return { count: 0, width: 0, height: 0 };
        }
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
       
        return {
            count: points.length,
            width,
            height,
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }
   
    // Проверить ориентацию следа
    checkOrientation(points) {
        if (points.length < 3) {
            return 'unknown';
        }
       
        const bounds = this.calculateBounds(points);
        const ratio = bounds.width / Math.max(1, bounds.height);
       
        if (ratio < 0.5) return 'vertical';
        if (ratio > 2.0) return 'horizontal';
        return 'square';
    }
   
    // Рассчитать границы
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
}

module.exports = CoordinateValidator;
