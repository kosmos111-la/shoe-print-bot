const shoeSizeCalculator = require('./shoe-size');
//const heightCalculator = { estimate: () => ({ success: false, error: 'В разработке' }) };
// const snowCalculator = { calculate: () => ({ success: false, error: 'В разработке' }) };
// const weatherModule = { getWeather: () => ({ success: false, error: 'В разработке' }) };

/**
* Меню калькуляторов
*/
function initialize() {
    console.log('✅ Модуль калькуляторов загружен');

    return {
        getMenu: () => ({
            title: "🧮 КАЛЬКУЛЯТОРЫ",
            sections: [
                {
                    name: "📏 Калькулятор размеров обуви",
                    command: "/calc_shoe",
                    description: "Расчет длины отпечатка по размеру обуви"
                }
            ]
        }),

        // Используем реальный калькулятор вместо заглушки
        calculateShoeSize: (size, type) => {
            const result = shoeSizeCalculator.calculate({ size, type });
            if (result.success) {
                return result.result;
            } else {
                return `❌ ${result.error}`;
            }
        },

        getShoeTypes: () => {
            return shoeSizeCalculator.getFootwearTypesList();
        },

        // Остальные калькуляторы - заглушки
        estimateHeight: () => "📏 Калькулятор роста в разработке",
        calculateSnowDepth: () => "❄️ Калькулятор снега в разработке",
        getWeatherData: () => "🌤️ Модуль погоды в разработке"
    };
}

module.exports = { initialize };
