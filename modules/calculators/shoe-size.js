/**
* Калькулятор размеров обуви для взрослых
*/
class AdultFootwearCalculator {
    constructor() {
        // Константы штихмассовой системы для взрослых
        this.STICH_CM = 2.0 / 3.0; // 0.666 см
        this.ADULT_INSOLE_ADDITION = 1.0; // 1 см припуск для взрослых
       
        // Типы обуви с добавками
        this.footwearTypes = {
            GALOSHI: { name: "Галоши", addition: 2.5 },
            RUBBER_BOOTS: { name: "Резиновый сапог, кеды, тапки, сланцы", addition: 3.5 },
            BOOTS: { name: "Ботинки, берец, резиновые сапоги для охоты и рыбалки", addition: 4.5 },
            TREKKING: { name: "Трекинговые", addition: 5.0 },
            SNEAKERS: { name: "Кроссовки", addition: 6.0 },
            UNKNOWN: { name: "Неизвестно", addition: 6.0 }
        };
    }

    /**
     * Основной расчет для взрослых
     */
    calculateForAdult(shoeSize, footwearTypeName) {
        const footwearType = this.footwearTypes[footwearTypeName] || this.footwearTypes.UNKNOWN;
       
        // 1. Длина стельки по штихмассовой системе
        const insoleLength = shoeSize * this.STICH_CM;
       
        // 2. Длина стопы взрослого (стелька - 1 см припуска)
        const footLength = insoleLength - this.ADULT_INSOLE_ADDITION;
       
        // 3. Диапазон отпечатка
        const footprintMin = footLength; // Абсолютный минимум - длина стопы
        const footprintMax = insoleLength + footwearType.addition;
       
        return {
            shoeSize: shoeSize,
            footLength: this.round(footLength),
            insoleLength: this.round(insoleLength),
            footprintMin: this.round(footprintMin),
            footprintMax: this.round(footprintMax),
            footwearType: footwearType.name,
            footwearAddition: footwearType.addition
        };
    }

    /**
     * Обратный расчет: отпечаток → диапазон размеров
     */
    footprintToSizeRange(footprintLength) {
        // Верхний предел: стелька = отпечатку
        const maxInsole = footprintLength;
        const maxSize = this.insoleToWholeSize(maxInsole);
       
        // Нижний предел: отпечаток = стелька + 6 см
        const minInsole = footprintLength - 6.0;
        const minSize = this.insoleToWholeSize(minInsole);
       
        return {
            footprintLength: this.round(footprintLength),
            minSize: minSize,
            maxSize: maxSize,
            minInsole: this.round(minInsole),
            maxInsole: this.round(maxInsole)
        };
    }

    /**
     * Форматирование результата обратного расчета
     */
    formatReverseResult(result) {
        return `👣 <b>Обратный расчет:</b>\n\n` +
               `📏 Длина отпечатка: <b>${result.footprintLength} см</b>\n` +
               `👟 Диапазон размеров: <b>${result.minSize}-${result.maxSize}</b>\n` +
               `📐 Диапазон стелек: <b>${result.minInsole}-${result.maxInsole} см</b>\n\n` +
               `💡 <b>Логика расчета:</b>\n` +
               `• Макс: стелька = отпечатку (<b>${result.maxSize}</b> размер)\n` +
               `• Мин: стелька + 6 см = отпечатку (<b>${result.minSize}</b> размер)\n\n` +
               `⚠️ <i>Учитывайте тип грунта и конструкцию подошвы</i>`;
    }

    /**
     * Поиск типа обуви по ключевым словам
     */
    findFootwearType(input) {
        if (!input || input.trim() === '') {
            return 'UNKNOWN';
        }
       
        const lowerInput = input.toLowerCase();
       
        if (this.containsAny(lowerInput, ["галоши", "галоша"])) {
            return 'GALOSHI';
        } else if (this.containsAny(lowerInput, ["резиновый", "сапог", "кеды", "тапки", "сланцы", "тапочки"])) {
            return 'RUBBER_BOOTS';
        } else if (this.containsAny(lowerInput, ["ботинки", "берец", "охота", "рыбалка", "охотничьи", "рыбацкие"])) {
            return 'BOOTS';
        } else if (this.containsAny(lowerInput, ["трекинговые", "треккинговые", "походные", "горные"])) {
            return 'TREKKING';
        } else if (this.containsAny(lowerInput, ["кроссовки", "кроссы", "sneakers"])) {
            return 'SNEAKERS';
        } else {
            return 'UNKNOWN';
        }
    }

    /**
     * Получить список всех типов для отображения
     */
    getFootwearTypesList() {
        let list = "👟 <b>Выберите тип обуви:</b>\n\n";
       
        Object.keys(this.footwearTypes).forEach(key => {
            if (key !== 'UNKNOWN') {
                const type = this.footwearTypes[key];
                list += `• <b>${type.name}</b> (+${type.addition} см)\n`;
            }
        });
       
        list += "\n💡 Можно ввести название или часть названия.\n";
        list += "❓ Если тип неизвестен, введите <i>\"не знаю\"</i>";
       
        return list;
    }

    /**
     * Форматирование результата для Telegram
     */
    formatResult(result) {
        return `📊 <b>Результаты расчета для взрослого:</b>

👣 Размер обуви: <b>${result.shoeSize}</b>
🦶 Длина стопы: <b>${result.footLength} см</b>
📏 Длина стельки: <b>${result.insoleLength} см</b>
👟 Тип обуви: <b>${result.footwearType}</b>
➕ Добавка к стельке: <b>${result.footwearAddition} см</b>

🔍 <b>Диапазон отпечатка для поиска:</b>
🔻 Мин. длина: <b>${result.footprintMin} см</b> (длина стопы)
🔺 Макс. длина: <b>${result.footprintMax} см</b>

⚠️ <i>Учитывайте особенности грунта и конструкцию подошвы</i>`;
    }

    // Вспомогательные методы
    containsAny(input, keywords) {
        return keywords.some(keyword => input.includes(keyword));
    }

    round(value) {
        return Math.round(value * 10) / 10;
    }

    insoleToWholeSize(insoleLength) {
        return Math.round(insoleLength / this.STICH_CM);
    }
}

// Экспортируем класс
const calculator = new AdultFootwearCalculator();

function calculate(options) {
    try {
        const { size, type } = options;
        const footwearType = calculator.findFootwearType(type);
        const result = calculator.calculateForAdult(parseInt(size), footwearType);
        return {
            success: true,
            result: calculator.formatResult(result)
        };
    } catch (error) {
        return {
            success: false,
            error: `Ошибка расчета: ${error.message}`
        };
    }
}

// Функция обратного расчета
function calculateReverse(footprintLength) {
    try {
        const length = parseFloat(footprintLength);
        if (isNaN(length) || length <= 0) {
            return {
                success: false,
                error: "Некорректная длина отпечатка"
            };
        }
       
        const result = calculator.footprintToSizeRange(length);
        return {
            success: true,
            result: calculator.formatReverseResult(result)
        };
    } catch (error) {
        return {
            success: false,
            error: `Ошибка обратного расчета: ${error.message}`
        };
    }
}

module.exports = {
    calculate,
    calculateReverse,
    getFootwearTypesList: () => calculator.getFootwearTypesList()
};
