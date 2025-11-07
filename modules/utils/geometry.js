// modules/utils/geometry.js

/**
* 🎯 Геометрические утилиты
*/

/**
* Вычисляет bounding box для точек
*/
function calculateBoundingBox(points) {
    if (!points || points.length === 0) {
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

/**
* Вычисляет общий bounding box для предсказаний
*/
function calculateOverallBoundingBox(predictions) {
    if (!predictions || predictions.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }
   
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
   
    predictions.forEach(pred => {
        if (pred.points && pred.points.length > 0) {
            pred.points.forEach(point => {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
        }
    });
   
    return {
        minX, minY, maxX, maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

module.exports = {
    calculateBoundingBox,
    calculateOverallBoundingBox
};
```

🔧 Шаг 2: Исправляем photoHandler.js

Обновляем: /modules/handlers/photoHandler.js

```javascript
// В начале файла заменяем импорты:
const { compareFootprints, compareWithMirror } = require('../utils/comparison');
const { calculateBoundingBox } = require('../utils/geometry');
