// modules/footprint/alignment/transformation-debugger.js

class TransformationDebugger {
    constructor(options = {}) {
        this.config = {
            debug: options.debug || true,
            logDetails: options.logDetails !== false,
            ...options
        };
    }

    // Анализ трансформаций двух следов
    analyzeTransformation(footprint1, footprint2) {
        console.log(`\n🔍🔍🔍 ГЛУБОКИЙ АНАЛИЗ ТРАНСФОРМАЦИЙ:`);
       
        // Получаем ВСЕ возможные способы получения трансформации
        const trans1_raw = footprint1.transformation;
        const trans1_get = footprint1.getTransformation();
        const trans1_meta = footprint1.metadata?.normalizationInfo;
       
        const trans2_raw = footprint2.transformation;
        const trans2_get = footprint2.getTransformation();
        const trans2_meta = footprint2.metadata?.normalizationInfo;
       
        console.log(`📌 СЛЕД 1 "${footprint1.name}":`);
        console.log(`   • this.transformation: ${trans1_raw?.rotationAngle?.toFixed(1) || 'нет'}°`);
        console.log(`   • getTransformation(): ${trans1_get?.rotationAngle?.toFixed(1) || 'нет'}°`);
        console.log(`   • metadata.normalizationInfo: ${trans1_meta?.rotationAngle?.toFixed(1) || 'нет'}°`);
       
        console.log(`\n📌 СЛЕД 2 "${footprint2.name}":`);
        console.log(`   • this.transformation: ${trans2_raw?.rotationAngle?.toFixed(1) || 'нет'}°`);
        console.log(`   • getTransformation(): ${trans2_get?.rotationAngle?.toFixed(1) || 'нет'}°`);
        console.log(`   • metadata.normalizationInfo: ${trans2_meta?.rotationAngle?.toFixed(1) || 'нет'}°`);
       
        // Проверяем согласованность
        const inconsistencies1 = this.checkInconsistencies(trans1_raw, trans1_get, trans1_meta);
        const inconsistencies2 = this.checkInconsistencies(trans2_raw, trans2_get, trans2_meta);
       
        if (inconsistencies1.length > 0) {
            console.log(`\n⚠️ НЕСОГЛАСОВАННОСТИ В СЛЕДЕ 1:`);
            inconsistencies1.forEach(issue => {
                console.log(`   • ${issue}`);
            });
        }
       
        if (inconsistencies2.length > 0) {
            console.log(`\n⚠️ НЕСОГЛАСОВАННОСТИ В СЛЕДЕ 2:`);
            inconsistencies2.forEach(issue => {
                console.log(`   • ${issue}`);
            });
        }
       
        // Определяем, какую трансформацию использовать
        const recommendedTrans1 = this.recommendTransformation(trans1_raw, trans1_get, trans1_meta);
        const recommendedTrans2 = this.recommendTransformation(trans2_raw, trans2_get, trans2_meta);
       
        console.log(`\n🎯 РЕКОМЕНДОВАННЫЕ ТРАНСФОРМАЦИИ:`);
        console.log(`   ${footprint1.name}: ${recommendedTrans1.source} (${recommendedTrans1.transformation?.rotationAngle?.toFixed(1) || 0}°)`);
        console.log(`   ${footprint2.name}: ${recommendedTrans2.source} (${recommendedTrans2.transformation?.rotationAngle?.toFixed(1) || 0}°)`);
       
        // Анализ точек для проверки реального поворота
        const realRotationAnalysis = this.analyzeRealRotation(footprint1, footprint2);
       
        return {
            footprint1: {
                raw: trans1_raw,
                getter: trans1_get,
                metadata: trans1_meta,
                recommended: recommendedTrans1,
                inconsistencies: inconsistencies1
            },
            footprint2: {
                raw: trans2_raw,
                getter: trans2_get,
                metadata: trans2_meta,
                recommended: recommendedTrans2,
                inconsistencies: inconsistencies2
            },
            realRotationAnalysis: realRotationAnalysis,
            summary: {
                angleDifference: Math.abs(
                    (recommendedTrans1.transformation?.rotationAngle || 0) -
                    (recommendedTrans2.transformation?.rotationAngle || 0)
                ),
                needsCorrection: realRotationAnalysis.needsCorrection
            }
        };
    }
   
    // Проверить несоответствия
    checkInconsistencies(trans1, trans2, trans3) {
        const issues = [];
       
        const angle1 = trans1?.rotationAngle || 0;
        const angle2 = trans2?.rotationAngle || 0;
        const angle3 = trans3?.rotationAngle || 0;
       
        // Проверяем разницу между разными источниками
        if (Math.abs(angle1 - angle2) > 0.1) {
            issues.push(`this.transformation (${angle1.toFixed(1)}°) ≠ getTransformation() (${angle2.toFixed(1)}°)`);
        }
       
        if (Math.abs(angle2 - angle3) > 0.1) {
            issues.push(`getTransformation() (${angle2.toFixed(1)}°) ≠ metadata.normalizationInfo (${angle3.toFixed(1)}°)`);
        }
       
        if (Math.abs(angle1 - angle3) > 0.1) {
            issues.push(`this.transformation (${angle1.toFixed(1)}°) ≠ metadata.normalizationInfo (${angle3.toFixed(1)}°)`);
        }
       
        // Проверяем зеркальное отражение
        const mirror1 = trans1?.isMirrored || false;
        const mirror2 = trans2?.isMirrored || false;
        const mirror3 = trans3?.isMirrored || false;
       
        if (mirror1 !== mirror2) {
            issues.push('Несоответствие зеркального отражения между this.transformation и getTransformation()');
        }
       
        if (mirror2 !== mirror3) {
            issues.push('Несоответствие зеркального отражения между getTransformation() и metadata.normalizationInfo');
        }
       
        return issues;
    }
   
    // Рекомендовать какую трансформацию использовать
    recommendTransformation(rawTrans, getterTrans, metaTrans) {
        // Приоритет: metadata.normalizationInfo > getTransformation() > this.transformation
        if (metaTrans && metaTrans.rotationAngle !== undefined) {
            return {
                transformation: metaTrans,
                source: 'metadata.normalizationInfo',
                reason: 'Содержит историю нормализации'
            };
        }
       
        if (getterTrans && getterTrans.rotationAngle !== undefined) {
            return {
                transformation: getterTrans,
                source: 'getTransformation()',
                reason: 'Метод получения трансформации'
            };
        }
       
        return {
            transformation: rawTrans || { rotationAngle: 0, isMirrored: false },
            source: 'this.transformation',
            reason: 'Прямое свойство (последний вариант)'
        };
    }
   
    // Анализ реального поворота на основе точек
    analyzeRealRotation(footprint1, footprint2) {
        console.log(`\n📐 АНАЛИЗ РЕАЛЬНОГО ПОВОРОТА ПО ТОЧКАМ:`);
       
        // Получаем точки из следов
        const points1 = this.extractPoints(footprint1);
        const points2 = this.extractPoints(footprint2);
       
        if (points1.length < 3 || points2.length < 3) {
            console.log(`   Недостаточно точек для анализа: ${points1.length} и ${points2.length}`);
            return { needsCorrection: false, reason: 'Недостаточно точек' };
        }
       
        // Рассчитываем границы и пропорции
        const bounds1 = this.calculateBounds(points1);
        const bounds2 = this.calculateBounds(points2);
       
        const ratio1 = bounds1.width / Math.max(1, bounds1.height);
        const ratio2 = bounds2.width / Math.max(1, bounds2.height);
       
        console.log(`   Пропорции:`);
        console.log(`     ${footprint1.name}: ${bounds1.width.toFixed(1)}x${bounds1.height.toFixed(1)} (ratio: ${ratio1.toFixed(2)})`);
        console.log(`     ${footprint2.name}: ${bounds2.width.toFixed(1)}x${bounds2.height.toFixed(1)} (ratio: ${ratio2.toFixed(2)})`);
       
        // Определяем ориентацию
        const orientation1 = this.determineOrientation(ratio1);
        const orientation2 = this.determineOrientation(ratio2);
       
        console.log(`   Ориентация:`);
        console.log(`     ${footprint1.name}: ${orientation1}`);
        console.log(`     ${footprint2.name}: ${orientation2}`);
       
        // Проверяем, нужна ли коррекция 90°
        const needs90DegreeCorrection = this.check90DegreeMismatch(orientation1, orientation2);
       
        if (needs90DegreeCorrection) {
            console.log(`   🚨 ОБНАРУЖЕНО: Следы повернуты на 90° друг относительно друга!`);
            console.log(`      ${footprint1.name}: ${orientation1}`);
            console.log(`      ${footprint2.name}: ${orientation2}`);
            console.log(`      Рекомендация: применить поворот на 90°`);
        } else {
            console.log(`   ✅ Ориентация следов согласована`);
        }
       
        return {
            needsCorrection: needs90DegreeCorrection,
            orientation1,
            orientation2,
            ratio1,
            ratio2,
            bounds1,
            bounds2
        };
    }
   
    // Извлечь точки из следа
    extractPoints(footprint) {
        const points = [];
       
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    x: point.x,
                    y: point.y,
                    id: id
                });
            }
        }
       
        return points;
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
   
    // Определить ориентацию по соотношению сторон
    determineOrientation(ratio) {
        if (ratio < 0.5) return 'vertical';
        if (ratio > 2.0) return 'horizontal';
        return 'square';
    }
   
    // Проверить несоответствие на 90°
    check90DegreeMismatch(orientation1, orientation2) {
        // Если один след вертикальный, а другой горизонтальный
        return (orientation1 === 'vertical' && orientation2 === 'horizontal') ||
               (orientation1 === 'horizontal' && orientation2 === 'vertical');
    }
   
    // Дебаг одной трансформации
    debugSingleTransformation(footprint, name = 'След') {
        console.log(`\n🔍 ДЕБАГ ТРАНСФОРМАЦИИ ${name} "${footprint.name}":`);
       
        const trans = footprint.getTransformation();
       
        if (!trans) {
            console.log(`   ❌ Нет трансформации`);
            return;
        }
       
        console.log(`   📐 Угол поворота: ${trans.rotationAngle?.toFixed(1) || 0}°`);
        console.log(`   🪞 Зеркало: ${trans.isMirrored ? 'да' : 'нет'}`);
        console.log(`   🎯 Центр: (${trans.center?.x?.toFixed(1) || 0}, ${trans.center?.y?.toFixed(1) || 0})`);
       
        if (trans.matrix) {
            console.log(`   📊 Матрица 3x3:`);
            console.log(`     [${trans.matrix[0]?.toFixed(3)}, ${trans.matrix[1]?.toFixed(3)}, ${trans.matrix[2]?.toFixed(3)}]`);
            console.log(`     [${trans.matrix[3]?.toFixed(3)}, ${trans.matrix[4]?.toFixed(3)}, ${trans.matrix[5]?.toFixed(3)}]`);
            console.log(`     [${trans.matrix[6]?.toFixed(3)}, ${trans.matrix[7]?.toFixed(3)}, ${trans.matrix[8]?.toFixed(3)}]`);
        }
       
        // Проверяем, является ли трансформация единичной
        const isIdentity = this.isIdentityTransformation(trans);
        console.log(`   🔄 Единичная трансформация: ${isIdentity ? 'да' : 'нет'}`);
       
        return {
            transformation: trans,
            isIdentity,
            hasMatrix: !!trans.matrix,
            hasCenter: !!(trans.center && trans.center.x !== undefined)
        };
    }
   
    // Проверить, является ли трансформация единичной
    isIdentityTransformation(trans) {
        if (!trans) return false;
       
        // Проверяем угол
        if (trans.rotationAngle && Math.abs(trans.rotationAngle) > 0.1) return false;
       
        // Проверяем зеркало
        if (trans.isMirrored) return false;
       
        // Проверяем матрицу если есть
        if (trans.matrix) {
            const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
            for (let i = 0; i < 9; i++) {
                if (Math.abs(trans.matrix[i] - identity[i]) > 0.001) return false;
            }
        }
       
        return true;
    }
}

module.exports = TransformationDebugger;
