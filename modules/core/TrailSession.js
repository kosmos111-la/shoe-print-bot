// modules/core/TrailSession.js

class TrailSession {
    constructor(chatId, username) {
        this.chatId = chatId;
        this.expert = username;
        this.sessionId = `session_${chatId}_${Date.now()}`;
        this.startTime = new Date();
        this.footprints = [];
        this.comparisons = [];
        this.status = 'active';
        this.notes = '';
       
        this.assembledModels = [];
        this.footprintParts = new Map();
        this.compatibilityGroups = [];
    }

    addFootprint(analysisData) {
        const footprintRecord = {
            id: `footprint_${this.footprints.length + 1}`,
            timestamp: new Date(),
            imageUrl: analysisData.imageUrl,
            predictions: analysisData.predictions,
            features: analysisData.features,
            perspectiveAnalysis: analysisData.perspectiveAnalysis,
            orientation: analysisData.orientation
        };
       
        this.footprints.push(footprintRecord);
        console.log(`🕵️‍♂️ Добавлен отпечаток в сессию ${this.sessionId}: ${footprintRecord.id}`);
       
        if (this.footprints.length > 1) {
            this.autoCompareWithPrevious(footprintRecord);
        }
       
        return footprintRecord;
    }

    autoCompareWithPrevious(newFootprint) {
        console.log("🕵️‍♂️ Автосравнение нового отпечатка с предыдущими...");
       
        const previousFootprints = this.footprints.slice(0, -1);
       
        previousFootprints.forEach((previous, index) => {
            const comparison = compareFootprints(previous.features, newFootprint.features);
           
            const comparisonRecord = {
                id: `comparison_${this.comparisons.length + 1}`,
                timestamp: new Date(),
                footprintA: previous.id,
                footprintB: newFootprint.id,
                result: comparison,
                similarity: comparison.overallScore,
                notes: this.generateComparisonNotes(comparison, previous, newFootprint)
            };
           
            this.comparisons.push(comparisonRecord);
            console.log(`🔍 Сравнение ${previous.id} vs ${newFootprint.id}: ${comparison.overallScore}%`);
        });
    }

    generateComparisonNotes(comparison, footprintA, footprintB) {
        const notes = [];
       
        if (comparison.overallScore > 70) {
            notes.push('ВЫСОКАЯ СХОДИМОСТЬ - вероятно один источник');
        } else if (comparison.overallScore > 50) {
            notes.push('СРЕДНЯЯ СХОДИМОСТЬ - требуется дополнительный анализ');
        } else {
            notes.push('НИЗКАЯ СХОДИМОСТЬ - разные источники');
        }
        if (comparison.mirrorUsed) {
            notes.push('Учтена зеркальная симметрия (левый/правый)');
        }
        return notes.join('; ');
    }

    getSessionSummary() {
        return {
            sessionId: this.sessionId,
            expert: this.expert,
            duration: new Date() - this.startTime,
            footprintsCount: this.footprints.length,
            comparisonsCount: this.comparisons.length,
            averageSimilarity: this.comparisons.length > 0 ?
                this.comparisons.reduce((sum, comp) => sum + comp.similarity, 0) / this.comparisons.length : 0,
            status: this.status
        };
    }

    generateExpertReport() {
        const summary = this.getSessionSummary();
       
        let report = "🕵️‍♂️ **АНАЛИЗ ТРОПЫ**\n\n";
        report += `**Сессия:** ${summary.sessionId}\n`;
        report += `**Эксперт:** ${summary.expert}\n`;
        report += `**Продолжительность:** ${Math.round(summary.duration / 60000)} мин.\n`;
        report += `**Проанализировано отпечатков:** ${summary.footprintsCount}\n`;
        report += `**Выполнено сравнений:** ${summary.comparisonsCount}\n`;
        report += `**Средняя сходимость:** ${summary.averageSimilarity.toFixed(1)}%\n\n`;
       
        if (this.comparisons.length > 0) {
            report += "**КЛЮЧЕВЫЕ ВЫВОДЫ:**\n";
           
            const highSimilarity = this.comparisons.filter(c => c.similarity > 70);
            if (highSimilarity.length > 0) {
                report += `• Обнаружено ${highSimilarity.length} пар с высокой сходимостью\n`;
            }
            const uniqueGroups = this.identifyUniqueGroups();
            report += `• Выявлено ${uniqueGroups.length} уникальных морфологических групп\n`;
        }
        report += `\n**СТАТУС:** ${this.status === 'active' ? 'АКТИВНА' : 'ЗАВЕРШЕНА'}`;
       
        return report;
    }

    identifyUniqueGroups() {
        const groups = [];
       
        this.footprints.forEach(footprint => {
            let assigned = false;
           
            for (let group of groups) {
                const avgSimilarity = group.members.reduce((sum, member) => {
                    const comparison = this.comparisons.find(c =>
                        (c.footprintA === footprint.id && c.footprintB === member) ||
                        (c.footprintB === footprint.id && c.footprintA === member)
                    );
                    return sum + (comparison ? comparison.similarity : 0);
                }, 0) / group.members.length;
               
                if (avgSimilarity > 60) {
                    group.members.push(footprint.id);
                    assigned = true;
                    break;
                }
            }
           
            if (!assigned) {
                groups.push({ id: `group_${groups.length + 1}`, members: [footprint.id] });
            }
        });
       
        return groups;
    }

    analyzeFootprintParts(imageWidth, imageHeight) {
        console.log(`🕵️‍♂️ Анализирую узоры протектора для ${this.footprints.length} отпечатков...`);
       
        const assembler = footprintAssembler;
       
        this.footprints.forEach(footprint => {
            const patternType = assembler.classifyFootprintPattern(footprint.predictions, imageWidth, imageHeight);
            footprint.patternType = patternType;
            footprint.partType = patternType;
            footprint.assemblyPotential = this.calculateAssemblyPotential(footprint);
            console.log(`📋 Отпечаток ${footprint.id}: ${patternType} (потенциал: ${footprint.assemblyPotential})`);
        });
       
        this.updateCompatibilityGroups();
    }

    calculateAssemblyPotential(footprint) {
        if (!footprint.features) return 0;
       
        let score = 0;
        const details = footprint.features.detailCount || 0;
       
        if (details > 15) score += 40;
        else if (details > 8) score += 25;
        else if (details > 3) score += 15;
       
        if (footprint.features.hasOutline) score += 30;
       
        if (footprint.features.largeDetails > 2) score += 20;
       
        return Math.min(score, 100);
    }

    updateCompatibilityGroups() {
        console.log("🕵️‍♂️ Автоматическая группировка следов по людям...");
       
        this.compatibilityGroups = [];
       
        this.footprints.forEach(footprint => {
            let assignedToGroup = false;
           
            for (let group of this.compatibilityGroups) {
                const groupCompatibility = this.assessGroupCompatibility(group, footprint);
               
                if (groupCompatibility > 0.6) {
                    group.push(footprint);
                    assignedToGroup = true;
                    console.log(`✅ След ${footprint.id} добавлен в группу (совместимость: ${groupCompatibility.toFixed(3)})`);
                    break;
                }
            }
           
            if (!assignedToGroup) {
                this.compatibilityGroups.push([footprint]);
                console.log(`🆕 Создана новая группа для следа ${footprint.id}`);
            }
        });
       
        console.log(`🎯 Обнаружено групп (людей): ${this.compatibilityGroups.length}`);
    }

    assessGroupCompatibility(group, newFootprint) {
        if (group.length === 0) return 0.5;
       
        let totalCompatibility = 0;
       
        group.forEach(existingFootprint => {
            const compatibility = this.calculateFootprintCompatibility(existingFootprint, newFootprint);
            totalCompatibility += compatibility;
        });
       
        return totalCompatibility / group.length;
    }

    calculateFootprintCompatibility(footprintA, footprintB) {
        const assembler = footprintAssembler;
       
        let imageWidth = 800, imageHeight = 600;
        if (footprintA.features?.imageSize) {
            imageWidth = footprintA.features.imageSize.width;
            imageHeight = footprintA.features.imageSize.height;
        }
       
        return assembler.advancedCompatibilityAnalysis(
            [footprintA],
            footprintB,
            imageWidth,
            imageHeight
        ) ? 0.8 : 0.2;
    }

    assembleModelFromGroup(group, imageWidth, imageHeight) {
        if (group.length < 2) {
            return { success: false, error: 'Недостаточно следов в группе для сборки' };
        }
       
        console.log(`🧩 Сборка модели для группы из ${group.length} следов...`);
       
        const assembler = footprintAssembler;
       
        if (!group[0].patternType) {
            group.forEach(footprint => {
                const patternType = assembler.classifyFootprintPattern(
                    footprint.predictions,
                    imageWidth,
                    imageHeight
                );
                footprint.patternType = patternType;
            });
        }
       
        const result = assembler.assembleFullModel(group, imageWidth, imageHeight);
       
        if (result.success) {
            console.log(`✅ Модель собрана из группы: ${result.completeness}% полноты`);
        }
       
        return result;
    }

    assembleModelFromParts(imageWidth, imageHeight) {
        if (this.footprints.length < 2) {
            return { success: false, error: 'Недостаточно отпечатков для сборки' };
        }
       
        console.log(`🧩 Начинаю сборку модели из ${this.footprints.length} отпечатков...`);
       
        const assembler = footprintAssembler;
       
        if (!this.footprints[0].partType) {
            this.analyzeFootprintParts(imageWidth, imageHeight);
        }
       
        const result = assembler.assembleFullModel(this.footprints, imageWidth, imageHeight);
       
        if (result.success) {
            const assembledModel = {
                id: `assembled_${this.assembledModels.length + 1}`,
                timestamp: new Date(),
                model: result.model,
                sourcePrints: result.usedPrints.map(p => p.id),
                completeness: result.completeness,
                confidence: result.confidence
            };
           
            this.assembledModels.push(assembledModel);
            console.log(`✅ Модель собрана: ${result.completeness}% полноты, ${result.confidence}% уверенности`);
        }
       
        return result;
    }

    getPartsStatistics() {
        const parts = {
            left_small: 0, left_medium: 0, left_large: 0,
            right_small: 0, right_medium: 0, right_large: 0,
            center_small: 0, center_medium: 0, center_large: 0,
            unknown: 0
        };
       
        this.footprints.forEach(footprint => {
            const patternType = footprint.patternType || 'unknown';
            parts[patternType] = (parts[patternType] || 0) + 1;
        });
       
        return parts;
    }

    generateEnhancedReport() {
        const summary = this.getSessionSummary();
        const partsStats = this.getPartsStatistics();
       
        let report = "🕵️‍♂️ **РАСШИРЕННЫЙ АНАЛИЗ ТРОПЫ**\n\n";
        report += `**Сессия:** ${summary.sessionId}\n`;
        report += `**Эксперт:** ${this.expert}\n`;
        report += `**Статус:** ${this.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
        report += `**Продолжительность:** ${Math.round(summary.duration / 60000)} мин.\n\n`;
       
        report += "📊 **СТАТИСТИКА УЗОРОВ:**\n";
        report += `• Всего: ${summary.footprintsCount}\n`;
        report += `• Левые: ${partsStats.left_small + partsStats.left_medium + partsStats.left_large}\n`;
        report += `• Правые: ${partsStats.right_small + partsStats.right_medium + partsStats.right_large}\n`;
        report += `• Центральные: ${partsStats.center_small + partsStats.center_medium + partsStats.center_large}\n`;
        report += `• Неизвестные: ${partsStats.unknown}\n\n`;

        report += "🔍 **СРАВНЕНИЯ:**\n";
        report += `• Выполнено: ${summary.comparisonsCount}\n`;
        report += `• Средняя сходимость: ${summary.averageSimilarity.toFixed(1)}%\n\n`;
       
        report += "🧩 **СБОРКА МОДЕЛЕЙ:**\n";
        report += `• Собрано моделей: ${this.assembledModels.length}\n`;
        report += `• Групп совместимости: ${this.compatibilityGroups.length}\n\n`;
       
        if (this.assembledModels.length > 0) {
            const bestModel = this.assembledModels.reduce((best, current) => current.completeness > best.completeness ? current : best);
            report += "🏆 **ЛУЧШАЯ МОДЕЛЬ:**\n";
            report += `• Полнота: ${bestModel.completeness}%\n`;
            report += `• Уверенность: ${bestModel.confidence}%\n`;
            report += `• Источников: ${bestModel.sourcePrints.length}\n`;
        }
       
        if (this.notes) {
            report += `\n📝 **ЗАМЕТКИ ЭКСПЕРТА:**\n${this.notes}\n`;
        }
       
        return report;
    }
}

module.exports = TrailSession;
