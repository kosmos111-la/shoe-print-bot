#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class FootprintAnalyzer {
    constructor() {
        this.modules = new Map();
        this.entryPoints = ['simple-manager.js', 'index.js', 'main.js'];
        this.problematicPatterns = [
            { pattern: /transformPointsBetweenSystems/, label: 'СЛОМАННАЯ трансформация' },
            { pattern: /template-builder.*addGraph/, label: 'СЛОЖНЫЙ TemplateBuilder' },
            { pattern: /Cannot read properties of undefined/, label: 'ОШИБКА undefined' },
            { pattern: /rotationAngle.*[\+\-].*rotationAngle/, label: 'СЛОЖНАЯ трансформация углов' },
            { pattern: /normalizeToTemplateSystem/, label: 'ПРОБЛЕМНАЯ нормализация' },
            { pattern: /getPointsInNormalizedSystem/, label: 'ПРОБЛЕМНЫЙ метод нормализации' }
        ];
    }

    run() {
        console.log('🔍 ЗАПУСК АНАЛИЗАТОРА FOOTPRINT СИСТЕМЫ\n');
        console.log('=' .repeat(60));

        // 1. Находим все модули
        this.findModules('./modules/footprint');

        // 2. Анализируем зависимости
        this.analyzeDependencies();

        // 3. Ищем проблемный код
        this.findProblematicCode();

        // 4. Генерируем отчёт
        this.generateReport();

        console.log('\n' + '=' .repeat(60));
        console.log('✅ АНАЛИЗ ЗАВЕРШЁН!');
        console.log('💡 Рекомендации выше ↑');
    }

    findModules(dir) {
        if (!fs.existsSync(dir)) {
            console.log(`❌ Папка ${dir} не найдена!`);
            return;
        }

        const scan = (currentDir) => {
            const items = fs.readdirSync(currentDir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(currentDir, item.name);
                const relPath = path.relative('./modules/footprint', fullPath);

                if (item.isDirectory() && !item.name.startsWith('.')) {
                    scan(fullPath);
                } else if (item.isFile() && item.name.endsWith('.js')) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const lines = content.split('\n').length;

                        this.modules.set(relPath, {
                            name: item.name,
                            path: relPath,
                            fullPath: fullPath,
                            lines: lines,
                            size: content.length,
                            content: content,
                            dependencies: [],
                            dependents: new Set(),
                            problems: []
                        });
                    } catch (error) {
                        console.log(`⚠️ Не могу прочитать ${fullPath}: ${error.message}`);
                    }
                }
            }
        };

        scan(dir);
        console.log(`📁 Найдено модулей: ${this.modules.size}`);
    }

    analyzeDependencies() {
        console.log('\n📊 АНАЛИЗ ЗАВИСИМОСТЕЙ:');

        // 1. Находим зависимости
        for (const [modPath, module] of this.modules) {
            const dependencies = this.extractDependencies(module.content, modPath);
            module.dependencies = dependencies;
        }

        // 2. Находим обратные зависимости (кто зависит от кого)
        for (const [modPath, module] of this.modules) {
            module.dependencies.forEach(dep => {
                const depModule = this.findModuleByName(dep);
                if (depModule) {
                    depModule.dependents.add(modPath);
                }
            });
        }

        // 3. Показываем статистику
        const unused = [];
        const complex = [];
        const isolated = [];

        for (const [modPath, module] of this.modules) {
            // Неиспользуемые
            if (module.dependents.size === 0 &&
                !this.isEntryPoint(module.name) &&
                !module.name.includes('test') &&
                module.lines > 50) {
                unused.push(module);
            }

            // Сложные (> 300 строк)
            if (module.lines > 300) {
                complex.push(module);
            }

            // Изолированные (мало зависимостей)
            if (module.dependencies.length <= 2 &&
                module.dependents.size <= 2 &&
                module.lines > 100) {
                isolated.push(module);
            }
        }

        console.log(`   🗑️  Неиспользуемых модулей: ${unused.length}`);
        console.log(`   🏗️  Сложных модулей (>300 строк): ${complex.length}`);
        console.log(`   🏝️  Изолированных модулей: ${isolated.length}`);
    }

    extractDependencies(content, filePath) {
        const deps = new Set();
        const dir = path.dirname(filePath);

        // Ищем require('./something')
        const requireRegex = /require\(['"](\.\/[^'"]+)['"]\)/g;
        let match;

        while ((match = requireRegex.exec(content)) !== null) {
            let dep = match[1];
           
            // Добавляем .js если нет
            if (!dep.endsWith('.js')) {
                dep += '.js';
            }

            // Делаем путь относительным от footprint
            const fullDepPath = path.join(dir, dep);
            const normalized = path.normalize(fullDepPath).replace(/^\.\//, '');
           
            deps.add(normalized);
        }

        return Array.from(deps);
    }

    findModuleByName(name) {
        // Ищем по имени файла
        for (const [modPath, module] of this.modules) {
            if (modPath === name || module.name === name) {
                return module;
            }
        }
        return null;
    }

    isEntryPoint(filename) {
        return this.entryPoints.some(ep => filename.includes(ep));
    }

    findProblematicCode() {
        console.log('\n🔎 ПОИСК ПРОБЛЕМНОГО КОДА:');

        for (const [modPath, module] of this.modules) {
            this.problematicPatterns.forEach(({ pattern, label }) => {
                if (pattern.test(module.content)) {
                    const count = (module.content.match(pattern) || []).length;
                    module.problems.push({ label, count, pattern: pattern.toString() });
                }
            });
        }

        // Сортируем по количеству проблем
        const problematic = Array.from(this.modules.values())
            .filter(m => m.problems.length > 0)
            .sort((a, b) => b.problems.length - a.problems.length);

        if (problematic.length > 0) {
            problematic.forEach(module => {
                console.log(`\n   🔴 ${module.name} (${module.lines} строк):`);
                module.problems.forEach(prob => {
                    console.log(`      ❗ ${prob.label}: найдено ${prob.count}`);
                });
            });
        } else {
            console.log('   ✅ Проблемных паттернов не найдено');
        }
    }

    generateReport() {
        console.log('\n📋 РЕКОМЕНДАЦИИ ПО ОЧИСТКЕ КОДА:\n');

        // 1. Удалить неиспользуемые модули
        const unused = Array.from(this.modules.values())
            .filter(m => m.dependents.size === 0 && !this.isEntryPoint(m.name) && m.lines > 50);

        if (unused.length > 0) {
            console.log('1. 🗑️  УДАЛИТЬ НЕИСПОЛЬЗУЕМЫЕ МОДУЛИ:');
            unused.forEach(module => {
                console.log(`   • ${module.name.padEnd(25)} ${module.lines.toString().padStart(4)} строк`);
                console.log(`     ${module.path}`);
            });
        }

        // 2. Упростить сложные модули
        const complex = Array.from(this.modules.values())
            .filter(m => m.lines > 300)
            .sort((a, b) => b.lines - a.lines);

        if (complex.length > 0) {
            console.log('\n2. 🏗️  УПРОСТИТЬ СЛОЖНЫЕ МОДУЛИ:');
            complex.forEach(module => {
                const deps = module.dependencies.length;
                const dependents = module.dependents.size;
                console.log(`   • ${module.name.padEnd(25)} ${module.lines.toString().padStart(4)} строк`);
                console.log(`     ← ${dependents} модулей зависят, → ${deps} зависимостей`);
            });
        }

        // 3. Вынести изолированные модули
        const isolated = Array.from(this.modules.values())
            .filter(m => m.dependencies.length <= 2 && m.dependents.size <= 2 && m.lines > 100)
            .sort((a, b) => b.lines - a.lines);

        if (isolated.length > 0) {
            console.log('\n3. 🏝️  ВЫНЕСТИ В ОТДЕЛЬНЫЕ МОДУЛИ:');
            isolated.forEach(module => {
                console.log(`   • ${module.name.padEnd(25)} ${module.lines.toString().padStart(4)} строк`);
                console.log(`     Можно вынести во временный модуль для тестирования`);
            });
        }

        // 4. Проблемные модули по паттернам
        const problematic = Array.from(this.modules.values())
            .filter(m => m.problems.length > 0)
            .sort((a, b) => b.problems.length - a.problems.length);

        if (problematic.length > 0) {
            console.log('\n4. 🔴 ИСПРАВИТЬ ПРОБЛЕМНЫЕ МОДУЛИ:');
            problematic.forEach(module => {
                console.log(`   • ${module.name}:`);
                module.problems.forEach(prob => {
                    console.log(`     - ${prob.label}`);
                });
            });
        }

        // 5. Статистика
        console.log('\n5. 📈 ОБЩАЯ СТАТИСТИКА:');
        console.log(`   • Всего модулей: ${this.modules.size}`);
       
        const totalLines = Array.from(this.modules.values())
            .reduce((sum, m) => sum + m.lines, 0);
        console.log(`   • Всего строк кода: ${totalLines}`);
       
        const avgLines = Math.round(totalLines / this.modules.size);
        console.log(`   • Средний размер модуля: ${avgLines} строк`);
       
        // Находим simple-manager.js
        const manager = this.findModuleByName('simple-manager.js');
        if (manager) {
            console.log(`   • simple-manager.js: ${manager.lines} строк, ${manager.dependencies.length} зависимостей`);
        }
    }
}

// 🔥 ЗАПУСК АНАЛИЗАТОРА
const analyzer = new FootprintAnalyzer();

try {
    analyzer.run();
   
    // Дополнительно: быстрый анализ template-builder.js если есть
    const tbPath = './modules/footprint/template-builder.js';
    if (fs.existsSync(tbPath)) {
        console.log('\n\n🔍 ДОПОЛНИТЕЛЬНЫЙ АНАЛИЗ template-builder.js:');
        const content = fs.readFileSync(tbPath, 'utf8');
        const lines = content.split('\n').length;
        const classes = (content.match(/class\s+\w+/g) || []).length;
        const methods = (content.match(/\w+\([^)]*\)\s*\{/g) || []).length;
       
        console.log(`   Строк: ${lines}`);
        console.log(`   Классов: ${classes}`);
        console.log(`   Методов: ~${methods}`);
       
        if (lines > 500) {
            console.log(`   ⚠️  СЛИШКОМ БОЛЬШОЙ! Нужно разбить на части`);
        }
    }
   
} catch (error) {
    console.log('❌ Ошибка при анализе:', error.message);
    console.log('Проверь путь: ./modules/footprint/');
}
