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
