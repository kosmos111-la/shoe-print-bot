// modules/footprint/alignment/transformation-debugger.js
class TransformationDebugger {
    constructor(options = {}) {
        this.debug = options.debug || true;
    }
   
    // 🔥 Анализировать трансформацию между двумя следами
    analyzeTransformation(footprint1, footprint2) {
        console.log('\n🔍 АНАЛИЗ ТРАНСФОРМАЦИИ МЕЖДУ СЛЕДАМИ:');
        console.log(`🔍 ${footprint1.name} vs ${footprint2.name}`);
       
        // 1. Получить трансформации
        const trans1 = footprint1.getTransformation();
        const trans2 = footprint2.getTransformation();
       
        console.log('\n📐 ТРАНСФОРМАЦИЯ СЛЕДА 1:');
        this.printTransformationDetails(trans1);
       
        console.log('\n📐 ТРАНСФОРМАЦИЯ СЛЕДА 2:');
        this.printTransformationDetails(trans2);
       
        // 2. Сравнить углы
        const angleDiff = Math.abs(trans1.rotationAngle - trans2.rotationAngle);
        console.log(`\n📐 РАЗНИЦА УГЛОВ: ${angleDiff.toFixed(1)}°`);
       
        // 3. Проверить зеркальность
        if (trans1.isMirrored !== trans2.isMirrored) {
            console.log(`🪞 РАЗНАЯ ЗЕРКАЛЬНОСТЬ: ${trans1.isMirrored ? 'зеркальный' : 'оригинал'} vs ${trans2.isMirrored ? 'зеркальный' : 'оригинал'}`);
        }
       
        // 4. Проверить масштаб
        const scale1 = this.calculateScaleFromMatrix(trans1.matrix);
        const scale2 = this.calculateScaleFromMatrix(trans2.matrix);
        console.log(`📏 МАСШТАБ: ${scale1.toFixed(3)} vs ${scale2.toFixed(3)}`);
       
        // 5. Визуализировать точки до/после
        this.visualizePointComparison(footprint1, footprint2);
       
        // 6. Предложить коррекцию
        this.suggestCorrection(footprint1, footprint2, angleDiff);
    }
   
    printTransformationDetails(trans) {
        if (!trans) {
            console.log('   ❌ Нет трансформации');
            return;
        }
       
        console.log(`   • Угол: ${trans.rotationAngle?.toFixed(1) || 0}°`);
        console.log(`   • Зеркало: ${trans.isMirrored ? 'да' : 'нет'}`);
        console.log(`   • Центр: (${trans.center?.x?.toFixed(1) || 0}, ${trans.center?.y?.toFixed(1) || 0})`);
        console.log(`   • Матрица: [${trans.matrix?.map(v => v.toFixed(3)).join(', ') || 'нет'}]`);
       
        // Проверить определитель
        if (trans.matrix && trans.matrix.length >= 4) {
            const det = trans.matrix[0] * trans.matrix[4] - trans.matrix[1] * trans.matrix[3];
            console.log(`   • Определитель: ${det.toFixed(3)} (ожидается ~1.0)`);
           
            if (Math.abs(det - 1.0) > 0.2) {
                console.log(`   ⚠️  Странный определитель! Возможно, есть масштабирование`);
            }
        }
    }
   
    // 🔥 Визуализировать сравнение точек
    visualizePointComparison(footprint1, footprint2) {
        const points1 = this.extractPoints(footprint1);
        const points2 = this.extractPoints(footprint2);
       
        console.log('\n📊 СРАВНЕНИЕ ТОЧЕК:');
        console.log(`   • След 1: ${points1.length} точек`);
        console.log(`   • След 2: ${points2.length} точек`);
       
        // Показать статистику по координатам
        const bounds1 = this.calculateBounds(points1);
        const bounds2 = this.calculateBounds(points2);
       
        console.log('\n📏 ГРАНИЦЫ СЛЕДА 1:');
        console.log(`   X: ${bounds1.minX.toFixed(1)} - ${bounds1.maxX.toFixed(1)} (ширина: ${bounds1.width.toFixed(1)})`);
        console.log(`   Y: ${bounds1.minY.toFixed(1)} - ${bounds1.maxY.toFixed(1)} (высота: ${bounds1.height.toFixed(1)})`);
        console.log(`   Ratio: ${(bounds1.width / bounds1.height).toFixed(2)}`);
       
        console.log('\n📏 ГРАНИЦЫ СЛЕДА 2:');
        console.log(`   X: ${bounds2.minX.toFixed(1)} - ${bounds2.maxX.toFixed(1)} (ширина: ${bounds2.width.toFixed(1)})`);
        console.log(`   Y: ${bounds2.minY.toFixed(1)} - ${bounds2.maxY.toFixed(1)} (высота: ${bounds2.height.toFixed(1)})`);
        console.log(`   Ratio: ${(bounds2.width / bounds2.height).toFixed(2)}`);
       
        // Проверить пропорции
        const ratio1 = bounds1.width / bounds1.height;
        const ratio2 = bounds2.width / bounds2.height;
        const ratioDiff = Math.abs(ratio1 - ratio2);
       
        if (ratioDiff > 0.5) {
            console.log(`\n⚠️  СИЛЬНО РАЗНЫЕ ПРОПОРЦИИ: ${ratio1.toFixed(2)} vs ${ratio2.toFixed(2)}`);
            console.log(`   Возможно, один след повернут на 90°!`);
        }
    }
   
    // 🔥 Предложить коррекцию
    suggestCorrection(footprint1, footprint2, angleDiff) {
        console.log('\n💡 ПРЕДЛОЖЕНИЯ ПО КОРРЕКЦИИ:');
       
        if (angleDiff > 80 && angleDiff < 100) {
            console.log(`   1. 📐 Повернуть один из следов на 90°`);
            console.log(`      Угловая разница ${angleDiff.toFixed(1)}° близка к 90°`);
        }
       
        const points1 = this.extractPoints(footprint1);
        const points2 = this.extractPoints(footprint2);
        const bounds1 = this.calculateBounds(points1);
        const bounds2 = this.calculateBounds(points2);
        const ratio1 = bounds1.width / bounds1.height;
        const ratio2 = bounds2.width / bounds2.height;
       
        if (Math.abs(ratio1 - ratio2) > 0.5) {
            console.log(`   2. 🔄 Исправить пропорции (${ratio1.toFixed(2)} vs ${ratio2.toFixed(2)})`);
            console.log(`      Один след может быть повернут относительно другого`);
        }
       
        // Проверить зеркальность
        const trans1 = footprint1.getTransformation();
        const trans2 = footprint2.getTransformation();
       
        if (trans1.isMirrored !== trans2.isMirrored) {
            console.log(`   3. 🪞 Скорректировать зеркальность`);
            console.log(`      Следы имеют разную ориентацию`);
        }
       
        console.log(`\n🎯 РЕКОМЕНДАЦИЯ: Сначала исправить ориентацию, затем выравнивание`);
    }
   
    extractPoints(footprint) {
        const points = [];
        if (footprint.pointTracker) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({ x: point.x, y: point.y });
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
   
    calculateScaleFromMatrix(matrix) {
        if (!matrix || matrix.length < 4) return 1.0;
        return Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1]);
    }
}

module.exports = TransformationDebugger;
