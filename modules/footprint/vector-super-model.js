// modules/footprint/vector-super-model.js
// ПРОСТАЯ ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ - без сложностей!

class VectorSuperModel {
    constructor(options = {}) {
        this.id = `vsm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Векторная супер-модель';
       
        // Векторные узлы в нормализованном пространстве [0, 1]
        this.nodes = []; // {id, nx, ny, confirmedCount, confidence, sources[]}
       
        // Статистика
        this.stats = {
            totalMerges: 0,
            totalNodesAdded: 0,
            confidence: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        // Минимальные настройки
        this.config = {
            matchThreshold: options.matchThreshold || 0.08, // в нормализованном пространстве
            minConfirmationsForHighConfidence: 2,
            ...options
        };
       
        console.log(`🏗️ Создана векторная супер-модель "${this.name}"`);
    }
   
    // 1. ОСНОВНОЙ МЕТОД: добавить граф в супер-модель
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} в супер-модель ${this.id}...`);
       
        // Получаем инварианты графа
        const invariants = graph.getBasicInvariants();
        if (!invariants || !invariants.normalizedMetrics) {
            console.log('⚠️ Граф не имеет нормализованных метрик');
            return false;
        }
       
        const normalizedNodes = invariants.normalizedMetrics.normalizedNodeDistribution || [];
        console.log(`📊 Получил ${normalizedNodes.length} нормализованных узлов`);
       
        if (this.nodes.length === 0) {
            // ПЕРВЫЙ ГРАФ - просто копируем
            this.nodes = normalizedNodes.map((node, i) => ({
                id: `vn_${i}`,
                nx: node.nx || 0,
                ny: node.ny || 0,
                confirmedCount: 1,
                confidence: 0.7,
                sources: [graphId],
                metadata: metadata
            }));
           
            console.log(`✅ Первый граф добавлен: ${this.nodes.length} узлов`);
        } else {
            // СЛИЯНИЕ с существующими узлами
            this.mergeWith(normalizedNodes, graphId, metadata);
        }
       
        // Обновить статистику
        this.stats.totalMerges++;
        this.stats.lastUpdated = new Date();
        this.updateStats();
       
        console.log(`✅ Граф добавлен. Теперь ${this.nodes.length} узлов, ${this.stats.confidence.toFixed(3)} уверенность`);
        return true;
    }
   
    // 2. ПРОСТОЕ СЛИЯНИЕ
    mergeWith(newNodes, sourceId, metadata = {}) {
        console.log(`🔍 Ищу совпадения для ${newNodes.length} новых узлов...`);
       
        let matchedCount = 0;
        let addedCount = 0;
       
        newNodes.forEach((newNode, newIdx) => {
            const nx = newNode.nx || 0;
            const ny = newNode.ny || 0;
           
            // Поиск ближайшего существующего узла
            let bestMatch = null;
            let minDistance = Infinity;
           
            this.nodes.forEach((existingNode, existingIdx) => {
                const dx = existingNode.nx - nx;
                const dy = existingNode.ny - ny;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { idx: existingIdx, node: existingNode, distance };
                }
            });
           
            // Проверяем порог совпадения
            if (bestMatch && minDistance < this.config.matchThreshold) {
                // СОВПАЛО - увеличиваем подтверждения
                bestMatch.node.confirmedCount++;
                bestMatch.node.confidence = Math.min(1.0, bestMatch.node.confidence + 0.1);
                if (!bestMatch.node.sources.includes(sourceId)) {
                    bestMatch.node.sources.push(sourceId);
                }
                matchedCount++;
               
                // Легкая коррекция позиции (взвешенное среднее)
                const weight = 1 / bestMatch.node.confirmedCount;
                bestMatch.node.nx = bestMatch.node.nx * (1 - weight) + nx * weight;
                bestMatch.node.ny = bestMatch.node.ny * (1 - weight) + ny * weight;
               
            } else {
                // НЕ СОВПАЛО - добавляем новый узел
                this.nodes.push({
                    id: `vn_${this.nodes.length}`,
                    nx: nx,
                    ny: ny,
                    confirmedCount: 1,
                    confidence: 0.5,
                    sources: [sourceId],
                    metadata: metadata,
                    isNew: true
                });
                addedCount++;
            }
        });
       
        console.log(`📊 Слияние: ${matchedCount} совпадений, ${addedCount} новых узлов`);
        this.stats.totalNodesAdded += addedCount;
    }
   
    // 3. ОБНОВИТЬ СТАТИСТИКУ
    updateStats() {
        if (this.nodes.length === 0) {
            this.stats.confidence = 0;
            return;
        }
       
        // Подсчитываем узлы с подтверждениями
        const confirmedNodes = this.nodes.filter(n => n.confirmedCount > 1);
        const confirmedRatio = confirmedNodes.length / this.nodes.length;
       
        // Среднее количество подтверждений
        const avgConfirmations = this.nodes.reduce((sum, n) => sum + n.confirmedCount, 0) /
                               this.nodes.length;
       
        // Расчет уверенности
        this.stats.confidence = Math.min(1.0,
            confirmedRatio * 0.6 + // 60% за долю подтвержденных узлов
            Math.min(0.3, (avgConfirmations - 1) * 0.15) + // 30% за среднее подтверждений
            Math.min(0.1, this.stats.totalMerges * 0.05) // 10% за количество слияний
        );
       
        // Дополнительная статистика
        this.stats.nodeCount = this.nodes.length;
        this.stats.confirmedNodeCount = confirmedNodes.length;
        this.stats.highConfidenceNodes = this.nodes.filter(n => n.confirmedCount >= 3).length;
        this.stats.avgConfirmations = avgConfirmations;
    }
   
    // 4. ПОЛУЧИТЬ ИНФОРМАЦИЮ
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                confidence: Math.round(this.stats.confidence * 1000) / 1000,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU')
            },
            nodes: this.nodes.length,
            confirmedNodes: this.stats.confirmedNodeCount || 0,
            highConfidenceNodes: this.stats.highConfidenceNodes || 0,
            config: this.config
        };
    }
   
    // 5. ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
   getVisualizationData() {
    const confirmedNodes = this.nodes.filter(n => n.confirmedCount > 1);
    const highConfidenceNodes = this.nodes.filter(n => n.confirmedCount >= 3);
    const newNodes = this.nodes.filter(n => n.confirmedCount === 1);
   
    return {
        nodes: this.nodes.map(node => ({
            id: node.id,
            nx: node.nx,
            ny: node.ny,
            confirmedCount: node.confirmedCount,
            confidence: node.confidence,
            isHighConfidence: node.confirmedCount >= 3,
            isNew: node.confirmedCount === 1 || node.isNew
        })),
        stats: {
            total: this.nodes.length,
            confirmed: confirmedNodes.length,
            highConfidence: highConfidenceNodes.length,
            new: newNodes.length,
            confidence: this.stats.confidence
        },
        metadata: {
            id: this.id,
            name: this.name,
            merges: this.stats.totalMerges,
            createdAt: this.stats.createdAt
        }
    };
}
   
    // 6. СОХРАНИТЬ В JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            nodes: this.nodes,
            stats: {
                ...this.stats,
                createdAt: this.stats.createdAt.toISOString(),
                lastUpdated: this.stats.lastUpdated.toISOString()
            },
            config: this.config,
            _version: '1.0',
            _type: 'vector_super_model'
        };
    }
   
    // 7. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        const model = new VectorSuperModel({
            name: data.name,
            matchThreshold: data.config?.matchThreshold
        });
       
        model.id = data.id || model.id;
        model.nodes = data.nodes || [];
        model.stats = data.stats || model.stats;
        model.config = data.config || model.config;
       
        // Восстановить даты
        if (model.stats.createdAt && typeof model.stats.createdAt === 'string') {
            model.stats.createdAt = new Date(model.stats.createdAt);
        }
        if (model.stats.lastUpdated && typeof model.stats.lastUpdated === 'string') {
            model.stats.lastUpdated = new Date(model.stats.lastUpdated);
        }
       
        console.log(`📂 Загружена векторная супер-модель "${model.name}" с ${model.nodes.length} узлами`);
        return model;
    }
}

module.exports = VectorSuperModel;
