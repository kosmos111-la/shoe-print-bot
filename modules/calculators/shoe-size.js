/**
* Калькулятор размеров обуви
*/
function calculateShoeSize(options) {
    const { fromSize, fromSystem = 'RU', toSystem = 'EU', footLength } = options;
   
    // Таблица конвертации размеров (примерные значения)
    const sizeTable = {
        'RU': { min: 34, max: 48, step: 0.5 },
        'EU': { min: 34, max: 48, step: 0.5 },
        'US': { min: 5, max: 14, step: 0.5 },
        'UK': { min: 3, max: 12, step: 0.5 }
    };

    // Формулы конвертации (упрощенные)
    const conversionFormulas = {
        'RU→EU': (size) => size,
        'EU→RU': (size) => size,
        'RU→US': (size) => size - 31,
        'US→RU': (size) => size + 31,
        'RU→UK': (size) => size - 32,
        'UK→RU': (size) => size + 32
    };

    // Расчет длины стопы по размеру
    const calculateFootLength = (size, system) => {
        const baseLength = 20; // см для размера 34
        const cmPerSize = 0.67; // примерно 2/3 см на размер
        return baseLength + (size - 34) * cmPerSize;
    };

    // Расчет размера по длине стопы
    const calculateSizeFromLength = (length, system) => {
        const baseLength = 20;
        const cmPerSize = 0.67;
        return 34 + Math.round((length - baseLength) / cmPerSize);
    };

    try {
        if (footLength) {
            // Расчет размера по длине стопы
            const calculatedSize = calculateSizeFromLength(footLength, toSystem);
            return {
                success: true,
                result: {
                    size: calculatedSize,
                    system: toSystem,
                    footLength: footLength,
                    message: `📏 Длина стопы ${footLength}см ≈ размер ${calculatedSize} (${toSystem})`
                }
            };
        } else if (fromSize) {
            // Конвертация размера
            const conversionKey = `${fromSystem}→${toSystem}`;
            const formula = conversionFormulas[conversionKey];
           
            if (formula) {
                const convertedSize = formula(fromSize);
                const estimatedLength = calculateFootLength(convertedSize, toSystem);
               
                return {
                    success: true,
                    result: {
                        original: { size: fromSize, system: fromSystem },
                        converted: { size: convertedSize, system: toSystem },
                        estimatedFootLength: estimatedLength.toFixed(1),
                        message: `👟 ${fromSize} (${fromSystem}) = ${convertedSize} (${toSystem})\n📏 Примерная длина стопы: ${estimatedLength.toFixed(1)}см`
                    }
                };
            } else {
                return {
                    success: false,
                    error: `Конвертация из ${fromSystem} в ${toSystem} не поддерживается`
                };
            }
        } else {
            return {
                success: false,
                error: 'Укажите размер или длину стопы'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Ошибка расчета: ${error.message}`
        };
    }
}

module.exports = { calculate: calculateShoeSize };
