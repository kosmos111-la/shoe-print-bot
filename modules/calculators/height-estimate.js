/**
* Оценка роста по размеру стопы
*/
function estimateHeight(options) {
    const { footLength, shoeSize, shoeSystem = 'RU' } = options;
   
    try {
        let actualFootLength = footLength;
       
        // Если указан размер, а не длина - вычисляем длину
        if (shoeSize && !footLength) {
            const baseLength = 20; // см для размера 34
            const cmPerSize = 0.67;
            actualFootLength = baseLength + (shoeSize - 34) * cmPerSize;
        }
       
        if (!actualFootLength) {
            return {
                success: false,
                error: 'Укажите длину стопы или размер обуви'
            };
        }
       
        // Формула оценки роста (антропометрическая)
        // Среднее соотношение рост/длина стопы = ~6.5-7.0
        const minRatio = 6.5;
        const maxRatio = 7.0;
       
        const minHeight = actualFootLength * minRatio;
        const maxHeight = actualFootLength * maxRatio;
        const avgHeight = (minHeight + maxHeight) / 2;
       
        return {
            success: true,
            result: {
                footLength: actualFootLength,
                estimatedHeight: {
                    min: Math.round(minHeight),
                    max: Math.round(maxHeight),
                    average: Math.round(avgHeight)
                },
                confidence: 'средняя', // низкая/средняя/высокая
                message: `📐 Длина стопы: ${actualFootLength}см\n📏 Примерный рост: ${Math.round(avgHeight)}см\n📊 Диапазон: ${Math.round(minHeight)}-${Math.round(maxHeight)}см\n⚠️ Погрешность: ±${Math.round((maxHeight - minHeight)/2)}см`
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Ошибка расчета: ${error.message}`
        };
    }
}

module.exports = { estimate: estimateHeight };
```

3. modules/calculators/snow-depth.js

```javascript
/**
* Расчет высоты снега по следам
*/
function calculateSnowDepth(options) {
    const { trackDepth, snowType = 'fresh', compression = 'medium' } = options;
   
    // Коэффициенты уплотнения для разных типов снега
    const compressionFactors = {
        'fresh': { low: 1.8, medium: 2.2, high: 2.5 },
        'settled': { low: 1.3, medium: 1.6, high: 1.9 },
        'compact': { low: 1.1, medium: 1.3, high: 1.5 },
        'icy': { low: 1.0, medium: 1.1, high: 1.2 }
    };
   
    try {
        if (!trackDepth || trackDepth <= 0) {
            return {
                success: false,
                error: 'Укажите глубину следа в см'
            };
        }
       
        const factors = compressionFactors[snowType] || compressionFactors.fresh;
        const factor = factors[compression] || factors.medium;
       
        const estimatedDepth = trackDepth * factor;
       
        return {
            success: true,
            result: {
                trackDepth: trackDepth,
                snowType: snowType,
                compression: compression,
                compressionFactor: factor,
                estimatedSnowDepth: Math.round(estimatedDepth * 10) / 10,
                message: `❄️ Глубина следа: ${trackDepth}см\n📏 Высота снега: ~${Math.round(estimatedDepth)}см\n🏷️ Тип снега: ${getSnowTypeName(snowType)}\n📊 Коэффициент уплотнения: ${factor}`
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Ошибка расчета: ${error.message}`
        };
    }
}

function getSnowTypeName(type) {
    const names = {
        'fresh': 'свежий пушистый',
        'settled': 'уплотненный',
        'compact': 'плотный',
        'icy': 'ледяной'
    };
    return names[type] || type;
}

module.exports = { calculate: calculateSnowDepth };
