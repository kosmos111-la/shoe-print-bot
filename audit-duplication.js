const fs = require('fs');
const path = require('path');

class ArchitectureAuditor {
    constructor(basePath = './modules/footprint') {
        this.basePath = basePath;
        this.modules = new Map(); // { name: { file, dependencies, classes, functions } }
        this.duplications = [];
    }
   
    async audit() {
        console.log('🔍 АУДИТ АРХИТЕКТУРЫ СИСТЕМЫ ОТПЕЧАТКОВ\n');
       
        // 1. Сканируем все файлы
        await this.scanDirectory(this.basePath);
       
        // 2. Анализируем зависимости
        this.analyzeDependencies();
       
        // 3. Ищем дублирование
        this.findDuplications();
       
        // 4. Ищем циклические зависимости
        this.findCircularDependencies();
       
        // 5. Генерируем отчёт
        this.generateReport();
    }
   
    async scanDirectory(dir, relativePath = '') {
        const files = fs.readdirSync(dir);
       
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const relPath = path.join(relativePath, file);
            const stat = fs.statSync(fullPath);
           
            if (stat.isDirectory()) {
                await this.scanDirectory(fullPath, relPath);
            } else if (file.endsWith('.js')) {
                await this.analyzeFile(fullPath, relPath);
            }
        }
    }
   
    async analyzeFile(filePath, relativePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const moduleName = relativePath.replace('.js', '').replace(/\\/g, '/');
           
            // Извлекаем импорты
            const imports = this.extractImports(content);
           
            // Извлекаем экспорты (классы, функции)
            const exports = this.extractExports(content);
           
            // Извлекаем ключевые слова (для поиска дублирования)
            const keywords = this.extractKeywords(content);
           
            this.modules.set(moduleName, {
                path: relativePath,
                imports,
                exports,
                keywords,
                content: content.substring(0, 500) // первые 500 символов для анализа
            });
           
        } catch (error) {
            console.log(`⚠️ Ошибка анализа ${filePath}:`, error.message);
        }
    }
   
    extractImports(content) {
        const imports = [];
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        const importRegex = /from\s+['"]([^'"]+)['"]/g;
       
        let match;
        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
       
        content.split('\n').forEach(line => {
            if (line.includes('require(')) {
                const match = line.match(/require\(['"]([^'"]+)['"]\)/);
                if (match) imports.push(match[1]);
            }
        });
       
        return [...new Set(imports)]; // Уникальные импорты
    }
   
    extractExports(content) {
        const exports = [];
       
        // Классы
        const classRegex = /class\s+(\w+)/g;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            exports.push({ type: 'class', name: match[1] });
        }
       
        // Функции
        const functionRegex = /(?:async\s+)?function\s+(\w+)/g;
        while ((match = functionRegex.exec(content)) !== null) {
            exports.push({ type: 'function', name: match[1] });
        }
       
        // Константы
        const exportRegex = /module\.exports\s*=\s*{([^}]+)}/s;
        const matchExport = content.match(exportRegex);
        if (matchExport) {
            const exportBody = matchExport[1];
            const lines = exportBody.split('\n');
            lines.forEach(line => {
                const propMatch = line.match(/(\w+):/);
                if (propMatch) {
                    exports.push({ type: 'property', name: propMatch[1] });
                }
            });
        }
       
        return exports;
    }
   
    extractKeywords(content) {
        // Ключевые слова, указывающие на функциональность
        const keywords = [];
        const keywordPatterns = [
            { regex: /session/gi, weight: 3 },
            { regex: /coordinate/gi, weight: 3 },
            { regex: /transform/gi, weight: 3 },
            { regex: /align/gi, weight: 3 },
            { regex: /normaliz/gi, weight: 3 },
            { regex: /match/gi, weight: 2 },
            { regex: /compare/gi, weight: 2 },
            { regex: /footprint/gi, weight: 2 },
            { regex: /graph/gi, weight: 2 },
            { regex: /template/gi, weight: 2 },
            { regex: /vector/gi, weight: 2 },
            { regex: /visualiz/gi, weight: 2 },
            { regex: /telegram/gi, weight: 1 },
            { regex: /diagnos/gi, weight: 1 },
            { regex: /validat/gi, weight: 1 }
        ];
       
        keywordPatterns.forEach(pattern => {
            const matches = content.match(pattern.regex);
            if (matches) {
                keywords.push({
                    word: pattern.regex.source.replace(/[\/gimsuy]/g, '').replace('\\', ''),
                    count: matches.length,
                    weight: pattern.weight * matches.length
                });
            }
        });
       
        // Сортируем по весу
        return keywords.sort((a, b) => b.weight - a.weight);
    }
   
    analyzeDependencies() {
        console.log('📊 АНАЛИЗ ЗАВИСИМОСТЕЙ:');
        console.log('=' .repeat(60));
       
        for (const [moduleName, data] of this.modules) {
            console.log(`\n📁 ${moduleName}:`);
            console.log(`   📦 Импорты (${data.imports.length}):`,
                data.imports.map(i => `\n     - ${i}`).join(''));
            console.log(`   🎯 Экспорты (${data.exports.length}):`,
                data.exports.map(e => `\n     - ${e.type}: ${e.name}`).join(''));
            console.log(`   🔑 Ключевые слова:`,
                data.keywords.slice(0, 5).map(k => `\n     - ${k.word} (${k.count}x)`).join(''));
        }
    }
   
    findDuplications() {
        console.log('\n\n🔍 ПОИСК ДУБЛИРОВАНИЯ:');
        console.log('=' .repeat(60));
       
        const allKeywords = new Map(); // слово -> [модули]
       
        // Собираем все ключевые слова
        for (const [moduleName, data] of this.modules) {
            data.keywords.forEach(keywordObj => {
                const word = keywordObj.word.toLowerCase();
                if (!allKeywords.has(word)) {
                    allKeywords.set(word, []);
                }
                allKeywords.get(word).push({
                    module: moduleName,
                    count: keywordObj.count,
                    weight: keywordObj.weight
                });
            });
        }
       
        // Ищем слова, которые встречаются в нескольких модулях
        for (const [word, modules] of allKeywords) {
            if (modules.length > 1 && word.length > 4) { // Игнорируем короткие слова
                const totalWeight = modules.reduce((sum, m) => sum + m.weight, 0);
               
                // Если слово встречается в 3+ модулях с большим весом
                if (modules.length >= 3 && totalWeight > 10) {
                    this.duplications.push({
                        word,
                        modules: modules.map(m => ({
                            name: m.module,
                            count: m.count,
                            weight: m.weight
                        })),
                        totalWeight
                    });
                   
                    console.log(`\n⚠️  ДУБЛИРОВАНИЕ "${word}":`);
                    modules.forEach(m => {
                        console.log(`   - ${m.module}: ${m.count} раз (вес: ${m.weight})`);
                    });
                }
            }
        }
       
        // Сортируем по уровню дублирования
        this.duplications.sort((a, b) => b.totalWeight - a.totalWeight);
    }
   
    findCircularDependencies() {
        console.log('\n\n🔄 ПОИСК ЦИКЛИЧЕСКИХ ЗАВИСИМОСТЕЙ:');
        console.log('=' .repeat(60));
       
        const graph = new Map();
       
        // Строим граф зависимостей
        for (const [moduleName, data] of this.modules) {
            graph.set(moduleName, new Set());
            data.imports.forEach(imp => {
                // Преобразуем импорт в имя модуля
                const importName = imp.replace('./', '').replace('.js', '');
                graph.get(moduleName).add(importName);
            });
        }
       
        // Ищем циклы (упрощённый алгоритм)
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
       
        const dfs = (node, path = []) => {
            if (recursionStack.has(node)) {
                const cycleStart = path.indexOf(node);
                if (cycleStart !== -1) {
                    cycles.push(path.slice(cycleStart));
                }
                return;
            }
           
            if (visited.has(node)) return;
           
            visited.add(node);
            recursionStack.add(node);
           
            const neighbors = graph.get(node) || new Set();
            for (const neighbor of neighbors) {
                if (graph.has(neighbor)) {
                    dfs(neighbor, [...path, node]);
                }
            }
           
            recursionStack.delete(node);
        };
       
        for (const node of graph.keys()) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }
       
        if (cycles.length > 0) {
            console.log('\n❌ ОБНАРУЖЕНЫ ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ:');
            cycles.forEach((cycle, i) => {
                console.log(`   Цикл ${i + 1}: ${cycle.join(' → ')} → ${cycle[0]}`);
            });
        } else {
            console.log('\n✅ Циклических зависимостей не обнаружено');
        }
    }
   
    generateReport() {
        console.log('\n\n📋 ИТОГОВЫЙ ОТЧЁТ:');
        console.log('=' .repeat(60));
       
        console.log(`\n📈 СТАТИСТИКА:`);
        console.log(`   • Всего модулей: ${this.modules.size}`);
        console.log(`   • Файлов с дублированием: ${this.duplications.length}`);
       
        if (this.duplications.length > 0) {
            console.log(`\n🚨 КРИТИЧЕСКИЕ ОБЛАСТИ ДУБЛИРОВАНИЯ:`);
            this.duplications.slice(0, 10).forEach((dup, i) => {
                console.log(`\n   ${i + 1}. "${dup.word}" в ${dup.modules.length} модулях:`);
                dup.modules.forEach(m => {
                    console.log(`      • ${m.name} (${m.count} упоминаний)`);
                });
            });
        }
       
        // Рекомендации по консолидации
        console.log('\n🎯 РЕКОМЕНДАЦИИ ПО КОНСОЛИДАЦИИ:');
       
        // Группируем модули по функциональности
        const functionalGroups = {};
       
        for (const dup of this.duplications) {
            if (!functionalGroups[dup.word]) {
                functionalGroups[dup.word] = new Set();
            }
            dup.modules.forEach(m => functionalGroups[dup.word].add(m.name));
        }
       
        Object.entries(functionalGroups).forEach(([group, modules]) => {
            if (modules.size >= 3) {
                console.log(`\n   🔄 "${group.toUpperCase()}":`);
                console.log(`      Объединить в единый модуль:`);
                Array.from(modules).forEach(m => console.log(`      - ${m}`));
            }
        });
    }
}

// Запуск аудита
const auditor = new ArchitectureAuditor();
auditor.audit().catch(console.error);
