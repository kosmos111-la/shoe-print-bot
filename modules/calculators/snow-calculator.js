/**
* Калькулятор высоты снега по следам
*/
class SnowCalculator {
    calculateSnowDepth(options) {
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
                    snowType: this.getSnowTypeName(snowType),
                    compression: compression,
                    compressionFactor: factor,
                    estimatedSnowDepth: Math.round(estimatedDepth * 10) / 10,
                    message: `Расчет основан на коэффициенте уплотнения для ${this.getSnowTypeName(snowType)} снега`
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `Ошибка расчета: ${error.message}`
            };
        }
    }

    getSnowTypeName(type) {
        const names = {
            'fresh': 'свежего пушистого',
            'settled': 'уплотненного',
            'compact': 'плотного',
            'icy': 'ледяного'
        };
        return names[type] || type;
    }
}

module.exports = { SnowCalculator };
