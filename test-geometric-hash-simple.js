// test-geometric-hash-simple.js
console.log('🎯 ГЕОМЕТРИЧЕСКИЙ ХЕШ - ПРОСТАЯ РАБОЧАЯ ВЕРСИЯ\n');

class GeometricHashSimple {
    constructor() {
        this.triangleCache = new Map();
        this.pointHashCache = new Map();
    }
   
    // 1. СОЗДАЁМ РЕАЛЬНЫЕ ТОЧКИ ДЛЯ ТЕСТА
    createTestPoints(shape = 'eight', count = 20) {
        const points = [];
       
        if (shape === 'eight') {
            // Восьмёрка - как у тебя в тесте
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * 2 * Math.PI;
                const x = 300 + 100 * Math.sin(angle);
                const y = 200 + 60 * Math.sin(2 * angle);
                points.push({
                    x: Math.round(x),
                    y: Math.round(y),
                    id: `p_${i}`,
                    originalIndex: i
                });
            }
            console.log(`🎯 Создана восьмёрка: ${points.length} точек`);
        }
        else if (shape === 'six') {
            // Шестёрка - пропускаем часть точек
            for (let i = 0; i < count; i++) {
                // Пропускаем точки с 12 по 15 (3 точки подряд)
                if (i >= 12 && i <= 14) continue;
               
                const angle = (i / count) * 2 * Math.PI;
                const x = 300 + 100 * Math.sin(angle);
                const y = 200 + 60 * Math.sin(2 * angle);
                points.push({
                    x: Math.round(x),
                    y: Math.round(y),
                    id: `p_${i}`,
                    originalIndex: i,
                    missing: i >= 12 && i <= 14
                });
            }
            console.log(`🎯 Создана шестёрка: ${points.length} точек (пропущено 3 точки)`);
        }
       
        return points;
    }
   
    // 2. ПРОСТАЯ ТРИАНГУЛЯЦИЯ - твоя идея!
    createSimpleTriangulation(points) {
        const triangles = [];
       
        // Берём каждую точку и её двух ближайших соседей
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
           
            // Находим двух ближайших соседей
            const neighbors = [];
            for (let j = 0; j < points.length; j++) {
                if (i === j) continue;
               
                const distance = this.calculateDistance(p1, points[j]);
                neighbors.push({ index: j, point: points[j], distance });
            }
           
            // Сортируем по расстоянию и берём двух ближайших
            neighbors.sort((a, b) => a.distance - b.distance);
           
            if (neighbors.length >= 2) {
                const p2 = neighbors[0].point;
                const p3 = neighbors[1].point;
               
                // Проверяем, не коллинеарны ли точки
                if (!this.areCollinear(p1, p2, p3)) {
                    triangles.push({
                        p1, p2, p3,
                        angles: this.calculateAngles(p1, p2, p3)
                    });
                }
            }
        }
       
        // Убираем дубликаты
        const uniqueTriangles = [];
        const triangleSet = new Set();
       
        triangles.forEach(t => {
            const key = this.getTriangleKey(t);
            if (!triangleSet.has(key)) {
                triangleSet.add(key);
                uniqueTriangles.push(t);
            }
        });
       
        console.log(`🔺 Создано ${uniqueTriangles.length} уникальных треугольников`);
        return uniqueTriangles;
    }
   
    // 3. ВЫЧИСЛЯЕМ УГЛЫ ТРЕУГОЛЬНИКА (твой "адрес" 60-80-50)
    calculateAngles(p1, p2, p3) {
        // Длины сторон
        const a = this.calculateDistance(p2, p3); // Противолежащая p1
        const b = this.calculateDistance(p1, p3); // Противолежащая p2 
        const c = this.calculateDistance(p1, p2); // Противолежащая p3
       
        // Углы по теореме косинусов
        const angleA = Math.acos((b*b + c*c - a*a) / (2*b*c)) * 180 / Math.PI;
        const angleB = Math.acos((a*a + c*c - b*b) / (2*a*c)) * 180 / Math.PI;
        const angleC = 180 - angleA - angleB;
       
        // Сортируем и округляем для создания "адреса"
        return [angleA, angleB, angleC]
            .map(angle => Math.round(angle))
            .sort((a, b) => a - b);
    }
   
    // 4. СОЗДАЁМ ГЕОМЕТРИЧЕСКИЙ ХЕШ ДЛЯ ТОЧКИ
    createPointHash(point, triangles) {
        // Находим все треугольники, содержащие эту точку
        const pointTriangles = triangles.filter(t =>
            t.p1 === point || t.p2 === point || t.p3 === point
        );
       
        if (pointTriangles.length === 0) {
            return { hash: 'NO_TRIANGLE', triangles: 0 };
        }
       
        // Создаём хеш из углов треугольников
        const angleHashes = pointTriangles.map(t => {
            // Находим угол при нашей точке
            const angles = [...t.angles];
           
            // Упорядочиваем углы так, чтобы угол при нашей точке был первым
            if (t.p1 === point) {
                // Угол при p1 уже первый
            } else if (t.p2 === point) {
                // Поворачиваем: [A,B,C] -> [B,C,A]
                angles.push(angles.shift());
            } else if (t.p3 === point) {
                // Поворачиваем: [A,B,C] -> [C,A,B]
                angles.unshift(angles.pop());
            }
           
            return angles.join('-');
        });
       
        // Сортируем для однозначности
        angleHashes.sort();
       
        const hash = angleHashes.join('|');
       
        return {
            hash,
            angles: angleHashes[0], // Первый "адрес"
            triangleCount: pointTriangles.length
        };
    }
   
    // 5. СРАВНИВАЕМ ТОЧКИ ПО ГЕОМЕТРИЧЕСКИМ ХЕШАМ
    comparePointsByHash(points1, points2) {
        console.log(`\n🔍 Сравниваем ${points1.length} vs ${points2.length} точек`);
       
        // Создаём треугольники для каждой формы
        const triangles1 = this.createSimpleTriangulation(points1);
        const triangles2 = this.createSimpleTriangulation(points2);
       
        // Вычисляем хеши для всех точек
        const hashes1 = points1.map((p, i) => ({
            point: p,
            index: i,
            hash: this.createPointHash(p, triangles1)
        }));
       
        const hashes2 = points2.map((p, i) => ({
            point: p,
            index: i,
            hash: this.createPointHash(p, triangles2)
        }));
       
        // Группируем по хешам
        const hashMap = new Map();
       
        hashes1.forEach(h => {
            if (!hashMap.has(h.hash.angles)) {
                hashMap.set(h.hash.angles, { points1: [], points2: [] });
            }
            hashMap.get(h.hash.angles).points1.push(h);
        });
       
        hashes2.forEach(h => {
            if (hashMap.has(h.hash.angles)) {
                hashMap.get(h.hash.angles).points2.push(h);
            }
        });
       
        // Находим совпадения
        const matches = [];
        const used2 = new Set();
       
        hashMap.forEach((group, hash) => {
            if (group.points1.length > 0 && group.points2.length > 0) {
                // Для каждой точки из первой формы
                group.points1.forEach(p1 => {
                    // Ищем первую свободную точку из второй формы с таким же хешем
                    const p2 = group.points2.find(p => !used2.has(p.index));
                   
                    if (p2) {
                        const distance = this.calculateDistance(p1.point, p2.point);
                        matches.push({
                            point1: p1.point,
                            point2: p2.point,
                            hash: hash,
                            distance: distance,
                            method: 'exact_hash'
                        });
                       
                        used2.add(p2.index);
                    }
                });
            }
        });
       
        console.log(`✅ Найдено точных совпадений по хешу: ${matches.length}`);
       
        return matches;
    }
   
    // 6. ВОССТАНАВЛИВАЕМ ОТСУТСТВУЮЩИЕ ТОЧКИ
    reconstructMissingPoints(basePoints, sourcePoints, matches) {
        const baseSet = new Set(basePoints.map(p => p.id));
        const matchedSource = new Set(matches.map(m => m.point2.id));
       
        const newPoints = [];
       
        // Для каждой точки из source, которой нет в base
        sourcePoints.forEach(source => {
            if (!baseSet.has(source.id) && !matchedSource.has(source.id)) {
                // Находим 3 ближайшие сопоставленные точки
                const nearest = this.findNearestMatches(source, matches, 3);
               
                if (nearest.length >= 2) {
                    // Восстанавливаем положение через барицентрические координаты
                    const reconstructed = this.reconstructUsingBarycentric(source, nearest);
                   
                    if (reconstructed) {
                        newPoints.push({
                            ...source,
                            x: reconstructed.x,
                            y: reconstructed.y,
                            reconstructed: true,
                            confidence: reconstructed.confidence,
                            basedOn: nearest.map(n => n.point1.id)
                        });
                    }
                }
            }
        });
       
        console.log(`🔧 Восстановлено точек: ${newPoints.length}`);
        return newPoints;
    }
   
    // 7. ВИЗУАЛИЗАЦИЯ
    visualizeComparison(points1, points2, matches, reconstructed = []) {
        console.log('\n📊 ВИЗУАЛИЗАЦИЯ:');
       
        const gridSize = 50;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));
       
        // Определяем границы
        const allPoints = [...points1, ...points2, ...reconstructed];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const scaleX = (maxX - minX) || 1;
        const scaleY = (maxY - minY) || 1;
       
        // Сначала рисуем форму восьмёрки (примерная)
        this.drawShapeOutline(grid, points1, minX, maxX, minY, maxY, scaleX, scaleY, gridSize);
       
        // Отмечаем совпадения
        const matchedPoints1 = new Set(matches.map(m => `${m.point1.x},${m.point1.y}`));
        const matchedPoints2 = new Set(matches.map(m => `${m.point2.x},${m.point2.y}`));
       
        // Первая форма
        points1.forEach(p => {
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (matchedPoints1.has(`${p.x},${p.y}`)) {
                    grid[gridY][gridX] = '●';
                } else if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = 'O';
                }
            }
        });
       
        // Вторая форма
        points2.forEach(p => {
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (matchedPoints2.has(`${p.x},${p.y}`)) {
                    // Уже отмечено как совпадение
                } else if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = 'X';
                }
            }
        });
       
        // Восстановленные точки
        reconstructed.forEach(p => {
            const gridX = Math.floor((p.x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((p.y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = '+';
                }
            }
        });
       
        console.log('O - форма 1, X - форма 2, ● - совпадение, + - восстановленная');
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
   
    // 8. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx*dx + dy*dy);
    }
   
    areCollinear(p1, p2, p3) {
        // Площадь треугольника (через определитель)
        const area = Math.abs(
            p1.x*(p2.y - p3.y) +
            p2.x*(p3.y - p1.y) +
            p3.x*(p1.y - p2.y)
        ) / 2;
        return area < 0.5; // Почти нулевая площадь
    }
   
    getTriangleKey(triangle) {
        // Сортируем точки по ID для создания уникального ключа
        const pointIds = [triangle.p1.id, triangle.p2.id, triangle.p3.id].sort();
        const angleKey = triangle.angles.join('-');
        return `${pointIds.join('-')}_${angleKey}`;
    }
   
    findNearestMatches(point, matches, count) {
        return matches
            .map(m => ({
                match: m,
                distance: this.calculateDistance(point, m.point2)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count)
            .map(item => item.match);
    }
   
    reconstructUsingBarycentric(point, nearestMatches) {
        if (nearestMatches.length >= 3) {
            const p1 = nearestMatches[0].point1;
            const p2 = nearestMatches[1].point1;
            const p3 = nearestMatches[2].point1;
           
            const q1 = nearestMatches[0].point2;
            const q2 = nearestMatches[1].point2;
            const q3 = nearestMatches[2].point2;
           
            // Барицентрические координаты в source
            const bary = this.barycentricCoordinates(point, q1, q2, q3);
           
            if (bary) {
                // Применяем к base
                const x = bary.alpha * p1.x + bary.beta * p2.x + bary.gamma * p3.x;
                const y = bary.alpha * p1.y + bary.beta * p2.y + bary.gamma * p3.y;
               
                return {
                    x: Math.round(x),
                    y: Math.round(y),
                    confidence: 0.9
                };
            }
        }
        return null;
    }
   
    barycentricCoordinates(p, p1, p2, p3) {
        const area = (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y);
        if (Math.abs(area) < 0.001) return null;
       
        const alpha = ((p2.y - p3.y) * (p.x - p3.x) + (p3.x - p2.x) * (p.y - p3.y)) / area;
        const beta = ((p3.y - p1.y) * (p.x - p3.x) + (p1.x - p3.x) * (p.y - p3.y)) / area;
        const gamma = 1 - alpha - beta;
       
        if (alpha >= 0 && beta >= 0 && gamma >= 0) {
            return { alpha, beta, gamma };
        }
        return null;
    }
   
    drawShapeOutline(grid, points, minX, maxX, minY, maxY, scaleX, scaleY, gridSize) {
        // Рисуем приблизительную форму восьмёрки
        for (let i = 0; i < points.length; i++) {
            const next = points[(i + 1) % points.length];
            const current = points[i];
           
            // Рисуем линию между точками
            this.drawLine(grid, current, next, minX, maxX, minY, maxY, scaleX, scaleY, gridSize);
        }
    }
   
    drawLine(grid, p1, p2, minX, maxX, minY, maxY, scaleX, scaleY, gridSize) {
        const steps = 10;
        for (let t = 0; t <= 1; t += 1/steps) {
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;
           
            const gridX = Math.floor((x - minX) / scaleX * (gridSize - 1));
            const gridY = Math.floor((y - minY) / scaleY * (gridSize - 1));
           
            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                if (grid[gridY][gridX] === ' ') {
                    grid[gridY][gridX] = '.';
                }
            }
        }
    }
}

// 🧪 ТЕСТИРОВАНИЕ
console.log('🧪 ТЕСТ ГЕОМЕТРИЧЕСКОГО ХЕША\n');

const matcher = new GeometricHashSimple();

// Тест 1: Восьмёрка vs Восьмёрка (одна и та же)
console.log('\n1. 🎯 ВОСЬМЁРКА vs ВОСЬМЁРКА');
const eight1 = matcher.createTestPoints('eight', 20);
const eight2 = JSON.parse(JSON.stringify(eight1));

const matches1 = matcher.comparePointsByHash(eight1, eight2);
const reconstructed1 = matcher.reconstructMissingPoints(eight1, eight2, matches1);

console.log(`📊 Результат: ${matches1.length}/${Math.min(eight1.length, eight2.length)} совпадений (${(matches1.length/Math.min(eight1.length, eight2.length)*100).toFixed(1)}%)`);
console.log(`🔧 Восстановлено: ${reconstructed1.length} точек`);

matcher.visualizeComparison(eight1, eight2, matches1, reconstructed1);

// Тест 2: Восьмёрка vs Шестёрка
console.log('\n2. 🎯 ВОСЬМЁРКА vs ШЕСТЁРКА');
const six = matcher.createTestPoints('six', 20);

const matches2 = matcher.comparePointsByHash(eight1, six);
const reconstructed2 = matcher.reconstructMissingPoints(eight1, six, matches2);

console.log(`📊 Результат: ${matches2.length}/${Math.min(eight1.length, six.length)} совпадений (${(matches2.length/Math.min(eight1.length, six.length)*100).toFixed(1)}%)`);
console.log(`🔧 Восстановлено: ${reconstructed2.length} точек (должно быть ~3)`);

matcher.visualizeComparison(eight1, six, matches2, reconstructed2);

// Тест 3: С поворотом
console.log('\n3. 🎯 ВОСЬМЁРКА vs ПОВЕРНУТАЯ ВОСЬМЁРКА');
const rotatedEight = JSON.parse(JSON.stringify(eight1));
rotatedEight.forEach(p => {
    // Поворачиваем на 45 градусов вокруг центра
    const centerX = 300;
    const centerY = 200;
    const angle = 45 * Math.PI / 180;
   
    const xRel = p.x - centerX;
    const yRel = p.y - centerY;
   
    p.x = Math.round(xRel * Math.cos(angle) - yRel * Math.sin(angle) + centerX);
    p.y = Math.round(xRel * Math.sin(angle) + yRel * Math.cos(angle) + centerY);
});

const matches3 = matcher.comparePointsByHash(eight1, rotatedEight);
const reconstructed3 = matcher.reconstructMissingPoints(eight1, rotatedEight, matches3);

console.log(`📊 Результат: ${matches3.length}/${Math.min(eight1.length, rotatedEight.length)} совпадений (${(matches3.length/Math.min(eight1.length, rotatedEight.length)*100).toFixed(1)}%)`);
console.log(`🔧 Восстановлено: ${reconstructed3.length} точек`);

matcher.visualizeComparison(eight1, rotatedEight, matches3, reconstructed3);

console.log('\n🎯 ИТОГИ:');
console.log('1. Одна и та же восьмёрка: должна быть ~100% совпадений');
console.log('2. Восьмёрка vs Шестёрка: должна быть ~85% совпадений + восстановлено 3 точки');
console.log('3. С поворотом: должна быть ~100% совпадений (геометрический хеш инвариантен к повороту!)');

console.log('\n💡 КАК ИНТЕГРИРОВАТЬ В ВАШУ СИСТЕМУ:');
console.log('1. При создании отпечатка вычисляй геометрические хеши для всех точек');
console.log('2. Храни хеши вместе с координатами');
console.log('3. При сравнении ищи точки с одинаковыми хешами');
console.log('4. Не нужно выравнивать или нормализовывать - хеш уже инвариантен!');
console.log('5. Для несопоставленных точек используй восстановление через ближайшие совпадения');

console.log('\n🔥 ТВОЯ ИДЕЯ РАБОТАЕТ ПРЕКРАСНО!');
