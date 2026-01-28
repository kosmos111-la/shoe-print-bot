// modules/core/coordinate-director.js
// 🎬 ГЛАВНЫЙ РЕГУЛЯТОР СИСТЕМ КООРДИНАТ - ТЕПЕРЬ ТОНКИЙ СЛОЙ

const fs = require('fs');
const path = require('path');

// 🔥 НОВЫЙ ИМПОРТ - ВСЕ ТРАНСФОРМАЦИИ В ОДНОМ МЕСТЕ
const CoordinateSystem = require('./coordinate-system');

class CoordinateDirector {
    constructor(manager) {
        this.manager = manager;
        this.debug = manager?.config?.debug || false;
       
        // 🔥 ИСПОЛЬЗУЕМ КОНСТАНТЫ ИЗ ЕДИНОЙ СИСТЕМЫ
        this.CONSTANTS = CoordinateSystem.CONSTANTS;
       
        // 🔥 ИСТОРИЯ КОРРЕКЦИЙ
        this.correctionHistory = [];
        this.systemRegistry = new Map(); // systemName → { transformation, lastValidated }
       
        // 🔥 КОНТРОЛИРУЕМЫЕ СИСТЕМЫ
        this.registerSystem('simple-manager');
        this.registerSystem('vector-model');
        this.registerSystem('template-builder');
        this.registerSystem('rotation-invariance');
       
        console.log('🎬 CoordinateDirector создан (обновленная версия)');
        console.log(`   Использую единую систему координат из core/coordinate-system`);
    }
   
    // 🔥 ОБНОВЛЕННЫЙ МЕТОД - используем новую систему
    enforceCanonicalSystem(systemName, transformation) {
        console.log(`\n🎬 [DIRECTOR] Проверяю систему "${systemName}"`);
       
        // 🔥 ВСЯ ЛОГИКА ТЕПЕРЬ В CoordinateSystem
        const result = CoordinateSystem.enforceCanonical(transformation, systemName);
       
        // Обновляем реестр
        const systemInfo = this.systemRegistry.get(systemName);
        if (systemInfo) {
            systemInfo.transformation = result;
            systemInfo.canonical = true;
            systemInfo.correctionsApplied = (systemInfo.correctionsApplied || 0) + 1;
            systemInfo.lastValidated = new Date();
        }
       
        return result;
    }
   
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ КООРДИНАЦИИ (менеджмент, не трансформации)
    registerSystem(systemName, initialTransformation = null) {
        const canonicalTransformation = CoordinateSystem.createCanonicalTransformation();
       
        this.systemRegistry.set(systemName, {
            name: systemName,
            transformation: initialTransformation || canonicalTransformation,
            canonical: CoordinateSystem.isCanonical(initialTransformation),
            lastValidated: new Date(),
            correctionsApplied: 0
        });
       
        console.log(`📝 Зарегистрирована система: "${systemName}"`);
        return canonicalTransformation;
    }
   
    isCanonical(transformation) {
        return CoordinateSystem.isCanonical(transformation);
    }
   
    createCanonicalTransformation() {
        return CoordinateSystem.createCanonicalTransformation();
    }
   
    correctToCanonical(transformation) {
        // Просто делегируем
        return CoordinateSystem.correctToCanonical(transformation);
    }
   
    // 🔥 МЕТОДЫ УПРАВЛЕНИЯ (специфичные для директора)
    recordCorrection(systemName, oldAngle, newAngle, oldTrans, newTrans) {
        const correction = {
            system: systemName,
            timestamp: new Date(),
            before: {
                angle: oldAngle,
                center: oldTrans?.center || { x: 0, y: 0 }
            },
            after: {
                angle: newAngle,
                center: newTrans?.center || this.CONSTANTS.CENTER
            },
            delta: Math.abs(oldAngle - newAngle),
            autoCorrected: this.CONSTANTS.FORCE_CORRECTION
        };
       
        this.correctionHistory.push(correction);
        this.saveCorrectionToFile(correction);
       
        return correction;
    }
   
    auditAllSystems() {
        console.log('\n🎬 АУДИТ ВСЕХ СИСТЕМ КООРДИНАТ:');
        console.log('═'.repeat(50));
       
        let allCanonical = true;
        const results = [];
       
        for (const [systemName, systemInfo] of this.systemRegistry) {
            const isCanonical = CoordinateSystem.isCanonical(systemInfo.transformation);
            const angle = systemInfo.transformation?.rotationAngle || 0;
           
            console.log(`   ${systemName}: ${isCanonical ? '✅' : '❌'} ${angle.toFixed(1)}°`);
           
            if (!isCanonical) {
                allCanonical = false;
            }
           
            results.push({
                system: systemName,
                canonical: isCanonical,
                angle: angle,
                corrections: systemInfo.correctionsApplied,
                lastValidated: systemInfo.lastValidated
            });
        }
       
        console.log('═'.repeat(50));
        console.log(`🎯 ИТОГ: ${allCanonical ? '✅ ВСЕ СИСТЕМЫ СОГЛАСОВАНЫ' : '❌ ЕСТЬ РАСХОЖДЕНИЯ'}`);
       
        return {
            allCanonical,
            results,
            timestamp: new Date(),
            totalSystems: this.systemRegistry.size,
            correctionsInHistory: this.correctionHistory.length
        };
    }
   
    applyGlobalCorrections() {
        console.log('\n🎬 ПРИМЕНЯЮ ГЛОБАЛЬНЫЕ ИСПРАВЛЕНИЯ:');
       
        let correctedCount = 0;
       
        // Используем новую систему для всех коррекций
        for (const [systemName, systemInfo] of this.systemRegistry) {
            if (!CoordinateSystem.isCanonical(systemInfo.transformation)) {
                const oldAngle = systemInfo.transformation.rotationAngle || 0;
                systemInfo.transformation = CoordinateSystem.correctToCanonical(systemInfo.transformation);
                systemInfo.canonical = true;
                systemInfo.correctionsApplied++;
                correctedCount++;
               
                console.log(`   📦 ${systemName}: ${oldAngle.toFixed(1)}° → 0°`);
            }
        }
       
        console.log(`✅ Исправлено ${correctedCount} систем координат`);
        return { correctedCount, timestamp: new Date() };
    }
   
    saveCorrectionToFile(correction) {
        try {
            const reportsDir = path.join(this.manager?.config?.dbPath || './data', 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
           
            const filename = `corrections_${new Date().toISOString().slice(0, 10)}.json`;
            const filepath = path.join(reportsDir, filename);
           
            let existing = [];
            if (fs.existsSync(filepath)) {
                existing = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            }
           
            existing.push(correction);
            fs.writeFileSync(filepath, JSON.stringify(existing, null, 2));
           
        } catch (error) {
            console.log(`⚠️ Не удалось сохранить историю коррекций: ${error.message}`);
        }
    }
   
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (без изменений, но используют новую систему)
    getStats() {
        let canonicalCount = 0;
        let totalAngle = 0;
        let maxDeviation = 0;
       
        for (const [, systemInfo] of this.systemRegistry) {
            const angle = systemInfo.transformation?.rotationAngle || 0;
            const deviation = Math.abs(angle);
           
            if (CoordinateSystem.isCanonical(systemInfo.transformation)) {
                canonicalCount++;
            }
           
            totalAngle += deviation;
            if (deviation > maxDeviation) {
                maxDeviation = deviation;
            }
        }
       
        return {
            totalSystems: this.systemRegistry.size,
            canonicalSystems: canonicalCount,
            canonicalPercentage: (canonicalCount / this.systemRegistry.size * 100).toFixed(1),
            avgAngleDeviation: (totalAngle / this.systemRegistry.size).toFixed(1),
            maxAngleDeviation: maxDeviation.toFixed(1),
            totalCorrections: this.correctionHistory.length,
            lastCorrection: this.correctionHistory.length > 0 ?
                this.correctionHistory[this.correctionHistory.length - 1].timestamp : null
        };
    }
   
    validateForComparison(trans1, trans2) {
        console.log('\n🎬 ВАЛИДАЦИЯ ДЛЯ СРАВНЕНИЯ:');
       
        // Используем новую систему
        const canonical1 = CoordinateSystem.enforceCanonical(trans1, 'comparison_source');
        const canonical2 = CoordinateSystem.enforceCanonical(trans2, 'comparison_target');
       
        const angle1 = canonical1.rotationAngle || 0;
        const angle2 = canonical2.rotationAngle || 0;
        const angleDiff = Math.abs(angle1 - angle2);
       
        console.log(`   Трансформация 1: ${angle1.toFixed(1)}°`);
        console.log(`   Трансформация 2: ${angle2.toFixed(1)}°`);
        console.log(`   Разница: ${angleDiff.toFixed(1)}°`);
       
        const isValid = angleDiff < this.CONSTANTS.CANONICAL_THRESHOLD;
       
        return {
            valid: isValid,
            transformation1: canonical1,
            transformation2: canonical2,
            wasCorrected: !isValid,
            angleDiff: angleDiff
        };
    }
   
    getInfo() {
        const stats = this.getStats();
       
        return {
            directorVersion: '2.0-refactored',
            constants: this.CONSTANTS,
            stats: stats,
            registeredSystems: Array.from(this.systemRegistry.keys()),
            forceCorrection: this.CONSTANTS.FORCE_CORRECTION,
            status: stats.canonicalPercentage === '100.0' ? '✅ ВСЕ СИСТЕМЫ СОГЛАСОВАНЫ' : '⚠️ ТРЕБУЕТСЯ КОРРЕКЦИЯ',
            usingUnifiedSystem: true
        };
    }
}

module.exports = CoordinateDirector;
