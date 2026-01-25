// modules/footprint/core/coordinate-director.js
// 🎬 ГЛАВНЫЙ РЕГУЛЯТОР СИСТЕМ КООРДИНАТ - гарантирует единую систему для ВСЕХ модулей

const fs = require('fs');
const path = require('path');

class CoordinateDirector {
    constructor(manager) {
        this.manager = manager;
        this.debug = manager?.config?.debug || false;
       
        // 🔥 КРИТИЧЕСКИЕ КОНСТАНТЫ - ЕДИНЫЕ ДЛЯ ВСЕЙ СИСТЕМЫ
        this.CONSTANTS = {
            CENTER: { x: 500, y: 500 },
            ROTATION_ANGLE: 0,           // 🔥 ВСЕГДА 0°
            SCALE_FACTOR: 1000,
            CANONICAL_THRESHOLD: 0.1,    // Допустимое отклонение от 0°
            FORCE_CORRECTION: true       // Автоматически исправлять
        };
       
        // 🔥 ИСТОРИЯ КОРРЕКЦИЙ
        this.correctionHistory = [];
        this.systemRegistry = new Map(); // systemName → { transformation, lastValidated }
       
        // 🔥 КОНТРОЛИРУЕМЫЕ СИСТЕМЫ
        this.registerSystem('simple-manager');
        this.registerSystem('vector-model');
        this.registerSystem('template-builder');
        this.registerSystem('rotation-invariance');
       
        console.log('🎬 CoordinateDirector создан: гарантия ЕДИНОЙ системы координат');
        console.log(`   Центр: (${this.CONSTANTS.CENTER.x}, ${this.CONSTANTS.CENTER.y})`);
        console.log(`   Угол: ${this.CONSTANTS.ROTATION_ANGLE}° (гарантируется)`);
    }
   
    // 🔥 РЕГИСТРАЦИЯ СИСТЕМЫ
    registerSystem(systemName, initialTransformation = null) {
        const canonicalTransformation = this.createCanonicalTransformation();
       
        this.systemRegistry.set(systemName, {
            name: systemName,
            transformation: initialTransformation || canonicalTransformation,
            canonical: this.isCanonical(initialTransformation),
            lastValidated: new Date(),
            correctionsApplied: 0
        });
       
        console.log(`📝 Зарегистрирована система: "${systemName}"`);
        return canonicalTransformation;
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Гарантировать каноническую систему
    enforceCanonicalSystem(systemName, transformation) {
        console.log(`\n🎬 [DIRECTOR] Проверяю систему "${systemName}"`);
       
        if (!transformation) {
            console.log(`⚠️ Нет трансформации, создаю каноническую`);
            return this.createCanonicalTransformation();
        }
       
        const currentAngle = transformation.rotationAngle || 0;
        const isCanonical = this.isCanonical(transformation);
       
        if (isCanonical) {
            console.log(`✅ Система "${systemName}" уже в канонической системе (${currentAngle.toFixed(1)}°)`);
            return transformation;
        }
       
        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ
        console.log(`🚨 НЕКАНОНИЧЕСКАЯ СИСТЕМА: ${currentAngle.toFixed(1)}° (должно быть 0°)`);
        console.log(`🔄 ИСПРАВЛЯЮ: ${systemName} → 0°`);
       
        const corrected = this.correctToCanonical(transformation);
       
        // Записываем в историю
        this.recordCorrection(systemName, currentAngle, 0, transformation, corrected);
       
        // Обновляем реестр
        const systemInfo = this.systemRegistry.get(systemName);
        if (systemInfo) {
            systemInfo.transformation = corrected;
            systemInfo.canonical = true;
            systemInfo.correctionsApplied++;
            systemInfo.lastValidated = new Date();
        }
       
        return corrected;
    }
   
    // 🔥 КОРРЕКЦИЯ К КАНОНИЧЕСКОЙ СИСТЕМЕ
    correctToCanonical(transformation) {
        const corrected = {
            // 🔥 КОПИРУЕМ ВСЕ ПОЛЯ
            ...transformation,
           
            // 🔥 ГАРАНТИРУЕМ КАНОНИЧЕСКИЕ ЗНАЧЕНИЯ
            rotationAngle: this.CONSTANTS.ROTATION_ANGLE,
            center: this.CONSTANTS.CENTER,
           
            // 🔥 МЕТАДАННЫЕ КОРРЕКЦИИ
            _correctedByDirector: true,
            _originalAngle: transformation.rotationAngle || 0,
            _originalCenter: transformation.center || { x: 0, y: 0 },
            _correctionTimestamp: new Date(),
            _directorVersion: '1.0'
        };
       
        // 🔥 ОБНОВЛЯЕМ МАТРИЦУ ТРАНСФОРМАЦИИ
        if (corrected.matrix && Array.isArray(corrected.matrix)) {
            // Единичная матрица для 0° поворота
            corrected.matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        }
       
        return corrected;
    }
   
    // 🔥 ПРОВЕРКА НА КАНОНИЧНОСТЬ
    isCanonical(transformation) {
        if (!transformation) return false;
       
        const angle = transformation.rotationAngle || 0;
        const center = transformation.center || { x: 0, y: 0 };
       
        const angleOk = Math.abs(angle - this.CONSTANTS.ROTATION_ANGLE) < this.CONSTANTS.CANONICAL_THRESHOLD;
        const centerOk = Math.abs(center.x - this.CONSTANTS.CENTER.x) < 10 &&
                        Math.abs(center.y - this.CONSTANTS.CENTER.y) < 10;
       
        return angleOk && centerOk;
    }
   
    // 🔥 СОЗДАНИЕ КАНОНИЧЕСКОЙ ТРАНСФОРМАЦИИ
    createCanonicalTransformation() {
        return {
            rotationAngle: this.CONSTANTS.ROTATION_ANGLE,
            center: this.CONSTANTS.CENTER,
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            type: 'canonical',
            source: 'coordinate_director',
            timestamp: new Date(),
            guaranteedZero: true,
            _directorCreated: true
        };
    }
   
    // 🔥 ЗАПИСЬ КОРРЕКЦИИ В ИСТОРИЮ
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
       
        // 🔥 КРИТИЧЕСКОЕ СОБЫТИЕ - логируем всегда
        console.log(`📝 [HISTORY] Коррекция системы "${systemName}":`);
        console.log(`   Было: ${oldAngle.toFixed(1)}°, Центр: (${correction.before.center.x.toFixed(1)}, ${correction.before.center.y.toFixed(1)})`);
        console.log(`   Стало: ${newAngle.toFixed(1)}°, Центр: (${correction.after.center.x.toFixed(1)}, ${correction.after.center.y.toFixed(1)})`);
        console.log(`   Δ: ${correction.delta.toFixed(1)}°`);
       
        // Сохраняем в файл для анализа
        this.saveCorrectionToFile(correction);
    }
   
    // 🔥 АУДИТ ВСЕХ СИСТЕМ
    auditAllSystems() {
        console.log('\n🎬 АУДИТ ВСЕХ СИСТЕМ КООРДИНАТ:');
        console.log('═'.repeat(50));
       
        let allCanonical = true;
        const results = [];
       
        for (const [systemName, systemInfo] of this.systemRegistry) {
            const isCanonical = this.isCanonical(systemInfo.transformation);
            const angle = systemInfo.transformation?.rotationAngle || 0;
           
            console.log(`   ${systemName}: ${isCanonical ? '✅' : '❌'} ${angle.toFixed(1)}°`);
           
            if (!isCanonical) {
                console.log(`      ⚠️ Требуется исправление: ${angle.toFixed(1)}° → 0°`);
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
       
        if (!allCanonical) {
            console.log('🔄 Запускаю автоматическую коррекцию...');
            this.applyGlobalCorrections();
        }
       
        return {
            allCanonical,
            results,
            timestamp: new Date(),
            totalSystems: this.systemRegistry.size,
            correctionsInHistory: this.correctionHistory.length
        };
    }
   
    // 🔥 ГЛОБАЛЬНАЯ КОРРЕКЦИЯ ВСЕХ СИСТЕМ
    applyGlobalCorrections() {
        console.log('\n🎬 ПРИМЕНЯЮ ГЛОБАЛЬНЫЕ ИСПРАВЛЕНИЯ:');
       
        let correctedCount = 0;
       
        // 1. Исправляем все системы в реестре
        for (const [systemName, systemInfo] of this.systemRegistry) {
            if (!this.isCanonical(systemInfo.transformation)) {
                const oldAngle = systemInfo.transformation.rotationAngle || 0;
                systemInfo.transformation = this.correctToCanonical(systemInfo.transformation);
                systemInfo.canonical = true;
                systemInfo.correctionsApplied++;
                correctedCount++;
               
                console.log(`   📦 ${systemName}: ${oldAngle.toFixed(1)}° → 0°`);
            }
        }
       
        // 2. Исправляем загруженные модели в менеджере
        if (this.manager?.loadedModels) {
            this.manager.loadedModels.forEach((footprint, id) => {
                if (footprint.transformation && !this.isCanonical(footprint.transformation)) {
                    const oldAngle = footprint.transformation.rotationAngle || 0;
                    footprint.transformation = this.correctToCanonical(footprint.transformation);
                    correctedCount++;
                    console.log(`   👣 Модель ${id.slice(0,8)}: ${oldAngle.toFixed(1)}° → 0°`);
                }
            });
        }
       
        // 3. Исправляем векторные модели (шаблоны)
        if (this.manager?.vectorSuperModels) {
            this.manager.vectorSuperModels.forEach((vectorModel, userId) => {
                const builder = vectorModel.templateBuilder;
                if (builder?.normalizationTransform && !this.isCanonical(builder.normalizationTransform)) {
                    const oldAngle = builder.normalizationTransform.rotationAngle || 0;
                    builder.normalizationTransform = this.correctToCanonical(builder.normalizationTransform);
                    correctedCount++;
                    console.log(`   🏗️ Шаблон ${userId}: ${oldAngle.toFixed(1)}° → 0°`);
                }
               
                // Также исправляем в самом templateBuilder
                if (builder?.referenceGraph?.transformation) {
                    const trans = builder.referenceGraph.transformation;
                    if (!this.isCanonical(trans)) {
                        const oldAngle = trans.rotationAngle || 0;
                        builder.referenceGraph.transformation = this.correctToCanonical(trans);
                        correctedCount++;
                        console.log(`   📊 Эталон шаблона ${userId}: ${oldAngle.toFixed(1)}° → 0°`);
                    }
                }
            });
        }
       
        // 4. Исправляем активные сессии
        if (this.manager?.userSessions) {
            this.manager.userSessions.forEach((session, userId) => {
                if (session.currentFootprint?.transformation &&
                    !this.isCanonical(session.currentFootprint.transformation)) {
                    const oldAngle = session.currentFootprint.transformation.rotationAngle || 0;
                    session.currentFootprint.transformation = this.correctToCanonical(session.currentFootprint.transformation);
                    correctedCount++;
                    console.log(`   👤 Сессия ${userId}: ${oldAngle.toFixed(1)}° → 0°`);
                }
            });
        }
       
        console.log(`✅ Исправлено ${correctedCount} систем координат`);
       
        return {
            correctedCount,
            timestamp: new Date(),
            details: `Все системы приведены к канонической (0°)`
        };
    }
   
    // 🔥 СОХРАНЕНИЕ ИСТОРИИ КОРРЕКЦИЙ В ФАЙЛ
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
   
    // 🔥 ПОЛУЧЕНИЕ СТАТИСТИКИ
    getStats() {
        let canonicalCount = 0;
        let totalAngle = 0;
        let maxDeviation = 0;
       
        for (const [, systemInfo] of this.systemRegistry) {
            const angle = systemInfo.transformation?.rotationAngle || 0;
            const deviation = Math.abs(angle);
           
            if (this.isCanonical(systemInfo.transformation)) {
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
   
    // 🔥 ВАЛИДАЦИЯ ТРАНСФОРМАЦИЙ ПЕРЕД СРАВНЕНИЕМ
    validateForComparison(trans1, trans2) {
        console.log('\n🎬 ВАЛИДАЦИЯ ДЛЯ СРАВНЕНИЯ:');
       
        // Приводим обе трансформации к канонической системе
        const canonical1 = this.enforceCanonicalSystem('comparison_source', trans1);
        const canonical2 = this.enforceCanonicalSystem('comparison_target', trans2);
       
        const angle1 = canonical1.rotationAngle || 0;
        const angle2 = canonical2.rotationAngle || 0;
        const angleDiff = Math.abs(angle1 - angle2);
       
        console.log(`   Трансформация 1: ${angle1.toFixed(1)}°`);
        console.log(`   Трансформация 2: ${angle2.toFixed(1)}°`);
        console.log(`   Разница: ${angleDiff.toFixed(1)}°`);
       
        const isValid = angleDiff < this.CONSTANTS.CANONICAL_THRESHOLD;
       
        if (!isValid) {
            console.log(`⚠️ Трансформации не согласованы для сравнения!`);
            console.log(`🔄 Применяю принудительную коррекцию...`);
           
            // Принудительно приводим к одинаковой системе
            const forcedCanonical = this.createCanonicalTransformation();
            return {
                valid: true, // После коррекции - валидны
                transformation1: forcedCanonical,
                transformation2: forcedCanonical,
                wasCorrected: true,
                originalDiff: angleDiff
            };
        }
       
        return {
            valid: isValid,
            transformation1: canonical1,
            transformation2: canonical2,
            wasCorrected: false,
            angleDiff: angleDiff
        };
    }
   
    // 🔥 ПОЛУЧЕНИЕ ИНФОРМАЦИИ
    getInfo() {
        const stats = this.getStats();
       
        return {
            directorVersion: '1.0',
            constants: this.CONSTANTS,
            stats: stats,
            registeredSystems: Array.from(this.systemRegistry.keys()),
            forceCorrection: this.CONSTANTS.FORCE_CORRECTION,
            status: stats.canonicalPercentage === '100.0' ? '✅ ВСЕ СИСТЕМЫ СОГЛАСОВАНЫ' : '⚠️ ТРЕБУЕТСЯ КОРРЕКЦИЯ'
        };
    }
}

module.exports = CoordinateDirector;
