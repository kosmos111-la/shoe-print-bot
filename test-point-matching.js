// test-point-matching.js
console.log('🎯 АЛГОРИТМ СОПОСТАВЛЕНИЯ ТОЧЕК\n');

// 1. СОЗДАЕМ РЕАЛЬНЫЕ ФИГУРЫ
class RealShapes {
    // Создаем стрелу (прямую)
    static createArrowStraight(centerX = 400, centerY = 300, length = 200) {
        const points = [];
       
        // Наконечник
        points.push({ x: centerX, y: centerY - length/2, id: 'tip', type: 'tip' });
       
        // Верхняя часть
        for (let i = 1; i <= 5; i++) {
            const y = centerY - length/2 + i * length/10;
            points.push({
                x: centerX,
                y: Math.round(y),
                id: `upper_${i}`,
                type: 'shaft'
            });
        }
       
        // Середина
        for (let i = 6; i <= 10; i++) {
            const y = centerY - length/2 + i * length/10;
            // Прямая линия
            points.push({
                x: centerX,
                y: Math.round(y),
                id: `mid_${i}`,
                type: 'shaft'
            });
        }
       
        // Оперение (расширяется)
        for (let i = 11; i <= 15; i++) {
            const y = centerY - length/2 + i * length/10;
            const width = (i - 10) * 10;
            points.push({
                x: centerX - width/2,
                y: Math.round(y),
                id: `left_${i}`,
                type: 'fletching'
            });
            points.push({
                x: centerX + width/2,
                y: Math.round(y),
                id: `right_${i}`,
                type: 'fletching'
            });
        }
       
        console.log(`🏹 Создана прямая стрела: ${points.length} точек`);
        return points;
    }
   
    // Создаем изогнутую стрелу
    static createArrowCurved(centerX = 400, centerY = 300, length = 200, curve = 0.3) {
        const points = [];
       
        // Наконечник
        points.push({
            x: centerX,
            y: centerY - length/2,
            id: 'tip',
            type: 'tip',
            curveOffset: 0
        });
       
        // Верхняя часть с изгибом
        for (let i = 1; i <= 5; i++) {
            const t = i / 5;
            const y = centerY - length/2 + i * length/10;
            const xOffset = Math.sin(t * Math.PI) * length * curve;
            points.push({
                x: centerX + Math.round(xOffset),
                y: Math.round(y),
                id: `upper_${i}`,
                type: 'shaft',
                curveOffset: Math.round(xOffset)
            });
        }
       
        // Середина
        for (let i = 6; i <= 10; i++) {
            const t = i / 10;
            const y = centerY - length/2 + i * length/10;
            const xOffset = Math.sin(t * Math.PI) * length * curve;
            points.push({
                x: centerX + Math.round(xOffset),
                y: Math.round(y),
                id: `mid_${i}`,
                type: 'shaft',
                curveOffset: Math.round(xOffset)
            });
        }
       
        // Оперение (изогнутое)
        for (let i = 11; i <= 15; i++) {
            const t = i / 15;
            const y = centerY - length/2 + i * length/10;
            const width = (i - 10) * 10;
            const mainOffset = Math.sin(t * Math.PI) * length * curve;
           
            points.push({
                x: centerX + Math.round(mainOffset) - width/2,
                y: Math.round(y),
                id: `left_${i}`,
                type: 'fletching',
                curveOffset: Math.round(mainOffset)
            });
            points.push({
                x: centerX + Math.round(mainOffset) + width/2,
                y: Math.round(y),
                id: `right_${i}`,
                type: 'fletching',
                curveOffset: Math.round(mainOffset)
            });
        }
       
        console.log(`🏹 Создана изогнутая стрела: ${points.length} точек (изгиб: ${curve})`);
        return points;
    }
   
    // Создаем восьмёрку
    static createEight(centerX = 400, centerY = 300, scale = 1.0) {
        const points = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        // Нижняя петля (пятка)
        let pointId = 0;
        for (let t = 0; t < Math.PI; t += 0.15) {
            const x = centerX + b * Math.sin(t);
            const y = centerY + a/2 + a/3 * Math.cos(t);
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `heel_${pointId++}`,
                type: 'heel',
                angle: t
            });
        }
       
        // Верхняя петля (носок)
        for (let t = Math.PI; t < 2 * Math.PI; t += 0.15) {
            const x = centerX + b * Math.sin(t);
            const y = centerY - a/2 + a/4 * Math.cos(t);
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `toe_${pointId++}`,
                type: 'toe',
                angle: t
            });
        }
       
        console.log(`8️⃣ Создана восьмёрка: ${points.length} точек`);
        return points;
    }
   
    // Создаем шестёрку (без части носка)
    static createSix(centerX = 400, centerY = 300, scale = 1.0) {
        const points = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        // Нижняя петля (такая же)
        let pointId = 0;
        for (let t = 0; t < Math.PI; t += 0.15) {
            const x = centerX + b * Math.sin(t);
            const y = centerY + a/2 + a/3 * Math.cos(t);
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `heel_${pointId++}`,
                type: 'heel',
                angle: t
            });
        }
       
        // Верхняя петля НЕПОЛНАЯ
        let skipped = 0;
        for (let t = Math.PI; t < 2 * Math.PI; t += 0.15) {
            // Пропускаем 3 точки подряд в определенном месте
            if (t > 4.2 && t < 4.8 && skipped < 3) {
                skipped++;
                continue;
            }
            const x = centerX + b * Math.sin(t);
            const y = centerY - a/2 + a/4 * Math.cos(t);
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `toe_${pointId++}`,
                type: 'toe',
                angle: t,
                missing: skipped > 0 && skipped < 3
            });
        }
       
        console.log(`6️⃣ Создана шестёрка: ${points.length} точек (отсутствует ${skipped} точек в носке)`);
        return points;
    }
   
    // Трансформация
    static transform(points, angle = 0, scale = 1.0, offsetX = 0, offsetY = 0) {
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
        const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;
       
        return points.map(p => {
            const xRel = p.x - centerX;
            const yRel = p.y - centerY;
           
            const xRot = xRel * cosA - yRel * sinA;
            const yRot = xRel * sinA + yRel * cosA;
           
            return {
                ...p,
                x: Math.round(xRot * scale + centerX + offsetX),
                y: Math.round(yRot * scale + centerY + offsetY)
            };
        });
    }
}

// 2. АЛГОРИТМ СОПОСТАВЛЕНИЯ ТОЧЕК
class PointMatcher {
    constructor() {
        this.debug = true;
    }
   
    // ОСНОВНОЙ МЕТОД: находим соответствия между точками
    matchPoints(points1, points2, description) {
        console.log(`\n🔍 ${description}`);
        console.log(`   Форма 1: ${points1.length} точек`);
        console.log(`   Форма 2: ${points2.length} точек`);
       
        // ШАГ 1: Находим ключевые точки-ориентиры
        const landmarks1 = this.findLandmarks(points1);
        const landmarks2 = this.findLandmarks(points2);
       
        console.log(`   • Найдено ориентиров: ${landmarks1.length} vs ${landmarks2.length}`);
       
        // ШАГ 2: Сопоставляем ориентиры
        const landmarkMatches = this.matchLandmarks(landmarks1, landmarks2);
       
        console.log(`   • Совпало ориентиров: ${landmarkMatches.length}`);
       
        // ШАГ 3: На основе совпавших ориентиров находим остальные точки
        const allMatches = this.findRemainingMatches(points1, points2, landmarkMatches);
       
        // ШАГ 4: Анализируем качество сопоставления
        const analysis = this.analyzeMatches(allMatches, points1.length, points2.length);
       
        // ШАГ 5: Визуализируем
        this.visualizeMatches(points1, points2, allMatches);
       
        return {
            matches: allMatches,
            totalMatches: allMatches.length,
            analysis: analysis
        };
    }
   
    // НАХОДИМ ОРИЕНТИРЫ (ключевые точки)
    findLandmarks(points) {
        const landmarks = [];
       
        // 1. Крайние точки
        const extremes = this.findExtremePoints(points);
        landmarks.push(...extremes);
       
        // 2. Точки с особыми типами
        points.forEach(p => {
            if (p.type === 'tip' || p.type === 'heel' || p.type === 'toe') {
                landmarks.push(p);
            }
        });
       
        // 3. Точки с максимальной кривизной
        if (points.length > 10) {
            const highCurvature = this.findHighCurvaturePoints(points);
            landmarks.push(...highCurvature);
        }
       
        // Уникализируем
        const seen = new Set();
        return landmarks.filter(p => {
            const key = `${p.x},${p.y}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
   
    // Крайние точки (min/max по осям)
    findExtremePoints(points) {
        if (points.length < 3) return [];
       
        const extremes = [];
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Находим точки на границах
        points.forEach(p => {
            if (p.x === minX || p.x === maxX || p.y === minY || p.y === maxY) {
                extremes.push({...p, landmarkType: 'extreme'});
            }
        });
       
        return extremes;
    }
   
    // Точки с высокой кривизной (резкие изгибы)
    findHighCurvaturePoints(points) {
        if (points.length < 5) return [];
       
        const curvaturePoints = [];
       
        for (let i = 2; i < points.length - 2; i++) {
            const p0 = points[i-2];
            const p1 = points[i-1];
            const p2 = points[i];
            const p3 = points[i+1];
            const p4 = points[i+2];
           
            // Простая оценка кривизны
            const dx1 = p2.x - p0.x;
            const dy1 = p2.y - p0.y;
            const dx2 = p4.x - p2.x;
            const dy2 = p4.y - p2.y;
           
            const angle1 = Math.atan2(dy1, dx1);
            const angle2 = Math.atan2(dy2, dx2);
            const angleDiff = Math.abs(angle1 - angle2);
           
            if (angleDiff > Math.PI / 4) { // Резкий изгиб
                curvaturePoints.push({
                    ...p2,
                    landmarkType: 'high_curvature',
                    curvature: angleDiff
                });
            }
        }
       
        return curvaturePoints;
    }
   
    // СОПОСТАВЛЯЕМ ОРИЕНТИРЫ
    matchLandmarks(landmarks1, landmarks2) {
        const matches = [];
        const used2 = new Set();
       
        // Для каждого ориентира из первой формы
        landmarks1.forEach(l1 => {
            let bestMatch = null;
            let bestScore = -Infinity;
            let bestIndex = -1;
           
            // Ищем наиболее похожий ориентир во второй форме
            landmarks2.forEach((l2, j) => {
                if (used2.has(j)) return;
               
                // Оценка схожести
                let score = 0;
               
                // 1. Схожесть типа
                if (l1.type === l2.type) score += 3;
                if (l1.landmarkType === l2.landmarkType) score += 2;
               
                // 2. Относительное положение (после нормализации)
                const dx = l1.x - l2.x;
                const dy = l1.y - l2.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
               
                // Нормализуем расстояние
                const allPoints = [...landmarks1, ...landmarks2];
                const allXs = allPoints.map(p => p.x);
                const allYs = allPoints.map(p => p.y);
                const maxDist = Math.sqrt(
                    Math.pow(Math.max(...allXs) - Math.min(...allXs), 2) +
                    Math.pow(Math.max(...allYs) - Math.min(...allYs), 2)
                );
               
                const normalizedDist = distance / (maxDist || 1);
                if (normalizedDist < 0.2) {
                    score += (1 - normalizedDist) * 5;
                }
               
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = l2;
                    bestIndex = j;
                }
            });
           
            if (bestMatch && bestScore > 3) {
                matches.push({
                    point1: l1,
                    point2: bestMatch,
                    score: bestScore,
                    distance: Math.sqrt(
                        Math.pow(bestMatch.x - l1.x, 2) +
                        Math.pow(bestMatch.y - l1.y, 2)
                    )
                });
                used2.add(bestIndex);
            }
        });
       
        return matches;
    }
   
    // НАХОДИМ ОСТАЛЬНЫЕ ТОЧКИ НА ОСНОВЕ ОРИЕНТИРОВ
    findRemainingMatches(points1, points2, landmarkMatches) {
        if (landmarkMatches.length < 2) {
            // Если мало ориентиров, используем простой алгоритм
            return this.simpleMatching(points1, points2);
        }
       
        // Оцениваем трансформацию на основе совпавших ориентиров
        const transform = this.estimateTransform(landmarkMatches);
       
        // Применяем трансформацию ко всем точкам первой формы
        const transformed1 = this.applyTransform(points1, transform);
       
        // Теперь ищем совпадения между transformed1 и points2
        const allMatches = [];
        const used2 = new Set();
       
        transformed1.forEach(p1 => {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestIndex = -1;
           
            points2.forEach((p2, j) => {
                if (used2.has(j)) return;
               
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
               
                // Адаптивный порог
                const threshold = 20; // пикселей
               
                if (distance < minDistance && distance < threshold) {
                    minDistance = distance;
                    bestMatch = p2;
                    bestIndex = j;
                }
            });
           
            if (bestMatch) {
                allMatches.push({
                    point1: p1,
                    point2: bestMatch,
                    distance: minDistance
                });
                used2.add(bestIndex);
            }
        });
       
        return allMatches;
    }
   
    // ОЦЕНИВАЕМ ТРАНСФОРМАЦИЮ (сдвиг + масштаб + поворот)
    estimateTransform(matches) {
        if (matches.length < 2) {
            return { dx: 0, dy: 0, scale: 1, angle: 0 };
        }
       
        // Простая оценка: средний сдвиг
        const dxSum = matches.reduce((sum, m) => sum + (m.point2.x - m.point1.x), 0);
        const dySum = matches.reduce((sum, m) => sum + (m.point2.y - m.point1.y), 0);
       
        const avgDx = dxSum / matches.length;
        const avgDy = dySum / matches.length;
       
        // Оценка масштаба (по расстояниям между парами)
        let scaleSum = 0;
        let scaleCount = 0;
       
        for (let i = 0; i < matches.length; i++) {
            for (let j = i + 1; j < matches.length; j++) {
                const dist1 = Math.sqrt(
                    Math.pow(matches[i].point1.x - matches[j].point1.x, 2) +
                    Math.pow(matches[i].point1.y - matches[j].point1.y, 2)
                );
               
                const dist2 = Math.sqrt(
                    Math.pow(matches[i].point2.x - matches[j].point2.x, 2) +
                    Math.pow(matches[i].point2.y - matches[j].point2.y, 2)
                );
               
                if (dist1 > 0) {
                    scaleSum += dist2 / dist1;
                    scaleCount++;
                }
            }
        }
       
        const avgScale = scaleCount > 0 ? scaleSum / scaleCount : 1;
       
        return {
            dx: avgDx,
            dy: avgDy,
            scale: avgScale,
            angle: 0 // Упрощенно, без поворота
        };
    }
   
    // ПРИМЕНЯЕМ ТРАНСФОРМАЦИЮ
    applyTransform(points, transform) {
        return points.map(p => ({
            ...p,
            x: p.x * transform.scale + transform.dx,
            y: p.y * transform.scale + transform.dy
        }));
    }
   
    // ПРОСТОЕ СОПОСТАВЛЕНИЕ (если мало ориентиров)
    simpleMatching(points1, points2) {
        const matches = [];
        const used2 = new Set();
       
        points1.forEach(p1 => {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestIndex = -1;
           
            points2.forEach((p2, j) => {
                if (used2.has(j)) return;
               
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
               
                const threshold = 30; // пикселей
               
                if (distance < minDistance && distance < threshold) {
                    minDistance = distance;
                    bestMatch = p2;
                    bestIndex = j;
                }
            });
           
            if (bestMatch) {
                matches.push({
                    point1: p1,
                    point2: bestMatch,
                    distance: minDistance
                });
                used2.add(bestIndex);
            }
        });
       
        return matches;
    }
   
    // АНАЛИЗ РЕЗУЛЬТАТОВ
    analyzeMatches(matches, total1, total2) {
        const matchPercent1 = (matches.length / total1 * 100).toFixed(1);
        const matchPercent2 = (matches.length / total2 * 100).toFixed(1);
       
        // Среднее расстояние между совпавшими точками
        const avgDistance = matches.length > 0
            ? (matches.reduce((sum, m) => sum + m.distance, 0) / matches.length).toFixed(1)
            : 0;
       
        // Анализ качества сопоставления
        let quality = 'плохое';
        if (parseFloat(matchPercent1) > 80 && parseFloat(avgDistance) < 10) {
            quality = 'отличное';
        } else if (parseFloat(matchPercent1) > 60) {
            quality = 'хорошее';
        } else if (parseFloat(matchPercent1) > 30) {
            quality = 'удовлетворительное';
        }
       
        return {
            matchPercent1: parseFloat(matchPercent1),
            matchPercent2: parseFloat(matchPercent2),
            avgDistance: parseFloat(avgDistance),
            quality: quality
        };
    }
   
    // ВИЗУАЛИЗАЦИЯ
    visualizeMatches(points1, points2, matches) {
        const gridSize = 40;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));
       
        const allPoints = [...points1, ...points2];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
       
        if (xs.length === 0) return;
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const scaleX = maxX - minX || 1;
        const scaleY = maxY - minY || 1;
       
        // Отмечаем совпадения
        const matchedPoints1 = new Set(matches.map(m => `${m.point1.x},${m.point1.y}`));
        const matchedPoints2 = new Set(matches.map(m => `${m.point2.x},${m.point2.y}`));
       
        // Первая форма
        points1.forEach(p => {
            const key = `${p.x},${p.y}`;
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (matchedPoints1.has(key)) {
                    grid[gridY][gridX] = '●';
                } else if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = 'O';
                }
            }
        });
       
        // Вторая форма
        points2.forEach(p => {
            const key = `${p.x},${p.y}`;
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (matchedPoints2.has(key)) {
                    // Уже отмечено как совпадение
                } else if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = 'X';
                }
            }
        });
       
        console.log('\n📊 Визуализация:');
        console.log('O - форма 1, X - форма 2, ● - совпадение');
        console.log('┌' + '─'.repeat(gridSize) + '┐');
        for (let y = 0; y < gridSize; y++) {
            let row = '│';
            for (let x = 0; x < gridSize; x++) {
                row += grid[y][x];
            }
            row += '│';
            console.log(row);
        }
        console.log('└' + '─'.repeat(gridSize) + '┘');
    }
}

// 3. ТЕСТИРОВАНИЕ
class PointMatchingTests {
    constructor() {
        this.matcher = new PointMatcher();
    }
   
    runArrowTests() {
        console.log('🏹 ТЕСТЫ СО СТРЕЛАМИ\n');
       
        const results = [];
       
        // ТЕСТ 1: Прямая стрела vs Прямая стрела
        console.log('1. 🎯 ПРЯМАЯ СТРЕЛА vs ПРЯМАЯ СТРЕЛА');
        const arrow1 = RealShapes.createArrowStraight();
        const arrow2 = JSON.parse(JSON.stringify(arrow1));
       
        const test1 = this.matcher.matchPoints(arrow1, arrow2, 'Одна и та же прямая стрела');
        results.push(this.evaluateTest(test1, 85, 100, 'Одна и та же прямая стрела'));
       
        // ТЕСТ 2: Прямая vs Изогнутая стрела
        console.log('\n2. 🎯 ПРЯМАЯ vs ИЗОГНУТАЯ СТРЕЛА');
        const curvedArrow = RealShapes.createArrowCurved(400, 300, 200, 0.3);
       
        const test2 = this.matcher.matchPoints(arrow1, curvedArrow, 'Прямая vs Изогнутая стрела');
        results.push(this.evaluateTest(test2, 70, 90, 'Прямая vs Изогнутая стрела'));
       
        // ТЕСТ 3: Изогнутая vs Сильно изогнутая
        console.log('\n3. 🎯 ИЗОГНУТАЯ vs СИЛЬНО ИЗОГНУТАЯ');
        const veryCurved = RealShapes.createArrowCurved(400, 300, 200, 0.6);
       
        const test3 = this.matcher.matchPoints(curvedArrow, veryCurved, 'Изогнутая vs Сильно изогнутая');
        results.push(this.evaluateTest(test3, 60, 85, 'Изогнутая vs Сильно изогнутая'));
       
        // ТЕСТ 4: С поворотом
        console.log('\n4. 🎯 ПРЯМАЯ СТРЕЛА vs ПОВЕРНУТАЯ НА 45°');
        const rotatedArrow = RealShapes.transform(arrow1, 45);
       
        const test4 = this.matcher.matchPoints(arrow1, rotatedArrow, 'С поворотом 45°');
        results.push(this.evaluateTest(test4, 70, 90, 'С поворотом 45°'));
       
        return results;
    }
   
    runEightSixTests() {
        console.log('\n🔢 ТЕСТЫ С ВОСЬМЁРКОЙ И ШЕСТЁРКОЙ\n');
       
        const results = [];
       
        // ТЕСТ 5: Восьмёрка vs Восьмёрка
        console.log('5. 🎯 ВОСЬМЁРКА vs ВОСЬМЁРКА');
        const eight1 = RealShapes.createEight();
        const eight2 = JSON.parse(JSON.stringify(eight1));
       
        const test5 = this.matcher.matchPoints(eight1, eight2, 'Одна и та же восьмёрка');
        results.push(this.evaluateTest(test5, 85, 100, 'Одна и та же восьмёрка'));
       
        // ТЕСТ 6: Восьмёрка vs Шестёрка
        console.log('\n6. 🎯 ВОСЬМЁРКА vs ШЕСТЁРКА');
        const six = RealShapes.createSix();
       
        const test6 = this.matcher.matchPoints(eight1, six, 'Восьмёрка vs Шестёрка');
        results.push(this.evaluateTest(test6, 60, 80, 'Восьмёрка vs Шестёрка'));
       
        // ТЕСТ 7: Восьмёрка vs Повернутая восьмёрка
        console.log('\n7. 🎯 ВОСЬМЁРКА vs ПОВЕРНУТАЯ НА 30°');
        const rotatedEight = RealShapes.transform(eight1, 30);
       
        const test7 = this.matcher.matchPoints(eight1, rotatedEight, 'С поворотом 30°');
        results.push(this.evaluateTest(test7, 75, 95, 'С поворотом 30°'));
       
        return results;
    }
   
    evaluateTest(testResult, minExpected, maxExpected, description) {
        const percent = testResult.analysis.matchPercent1;
        const inRange = percent >= minExpected && percent <= maxExpected;
        const status = inRange ? '✅' : '❌';
       
        console.log(`   ${status} Результат: ${percent}% совпадений (ожидалось ${minExpected}-${maxExpected}%)`);
        console.log(`     • Качество: ${testResult.analysis.quality}`);
        console.log(`     • Среднее расстояние: ${testResult.analysis.avgDistance}px`);
        console.log(`     • Найдено соответствий: ${testResult.totalMatches}`);
       
        return {
            test: description,
            result: percent,
            expected: { min: minExpected, max: maxExpected },
            inRange: inRange,
            quality: testResult.analysis.quality,
            avgDistance: testResult.analysis.avgDistance
        };
    }
   
    runAllTests() {
        console.log('🎯 КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ СОПОСТАВЛЕНИЯ ТОЧЕК\n');
       
        const arrowResults = this.runArrowTests();
        const eightSixResults = this.runEightSixTests();
       
        const allResults = [...arrowResults, ...eightSixResults];
       
        this.printSummary(allResults);
       
        return allResults;
    }
   
    printSummary(results) {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        const passed = results.filter(r => r.inRange).length;
        const total = results.length;
       
        results.forEach(r => {
            const status = r.inRange ? '✅' : '❌';
            console.log(`${status} ${r.test}: ${r.result}% (качество: ${r.quality}, расстояние: ${r.avgDistance}px)`);
        });
       
        console.log(`\n🎯 ИТОГО: ${passed}/${total} тестов пройдено`);
       
        if (passed >= total - 1) {
            console.log('\n✅ АЛГОРИТМ РАБОТАЕТ ПРАВИЛЬНО!');
            console.log('🚀 Можно интегрировать в систему для "примагничивания" точек');
        } else {
            console.log('\n⚠️ Требуется доработка алгоритма');
        }
    }
}

// ЗАПУСК
console.log('🎯 АЛГОРИТМ ТОЧЕЧНОГО СОПОСТАВЛЕНИЯ\n');
console.log('📚 КЛЮЧЕВЫЕ ИДЕИ:');
console.log('1. Находим ОРИЕНТИРЫ (ключевые точки) в каждой форме');
console.log('2. Сопоставляем ОРИЕНТИРЫ между формами');
console.log('3. На основе совпавших ориентиров находим остальные точки');
console.log('4. Оцениваем трансформацию между формами');
console.log('5. "Примагничиваем" точки на основе этой трансформации\n');

const tests = new PointMatchingTests();
const results = tests.runAllTests();

console.log('\n💡 КАК ИНТЕГРИРОВАТЬ В ВАШУ СИСТЕМУ:');
console.log('1. При получении нового отпечатка находим его ориентиры');
console.log('2. Ищем совпадения ориентиров с существующими отпечатками');
console.log('3. Если найдены совпадения - оцениваем трансформацию');
console.log('4. "Примагничиваем" точки нового отпечатка к точкам старого');
console.log('5. Увеличиваем счетчик подтверждений для совпавших точек');
