// modules/utils/system-diagnostic.js
const fs = require('fs');
const path = require('path');

class SystemDiagnostic {
    constructor() {
        this.modules = new Map();
        this.dependencies = new Map();
        this.issues = [];
        this.stats = {
            totalModules: 0,
            workingModules: 0,
            brokenModules: 0,
            totalDependencies: 0
        };
    }

    // 1. СКАНИРОВАТЬ ВСЕ МОДУЛИ
    async scanProject(rootDir = './modules') {
        console.log('🔍 Сканирую проект...');
        
        const modules = [];
        
        // Рекурсивно ищем все JS файлы
        function scanDir(dir) {
            if (!fs.existsSync(dir)) return;
            
            const items = fs.readdirSync(dir);
            
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDir(fullPath);
                } else if (item.endsWith('.js')) {
                    modules.push({
                        name: item.replace('.js', ''),
                        path: fullPath,
                        relativePath: path.relative('./', fullPath),
                        dir: dir
                    });
                }
            });
        }
        
        scanDir(rootDir);
        
        console.log(`📁 Найдено ${modules.length} модулей`);
        return modules;
    }

    // 2. АНАЛИЗИРОВАТЬ ЗАВИСИМОСТИ МОДУЛЯ
    analyzeModuleDependencies(modulePath) {
        try {
            const content = fs.readFileSync(modulePath, 'utf8');
            const dependencies = [];
            
            // Ищем require/import
            const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
            const importRegex = /from\s+['"]([^'"]+)['"]/g;
            
            let match;
            while ((match = requireRegex.exec(content)) !== null) {
                dependencies.push(match[1]);
            }
            
            while ((match = importRegex.exec(content)) !== null) {
                dependencies.push(match[1]);
            }
            
            // Фильтруем только локальные модули (не node_modules)
            const localDeps = dependencies.filter(dep => 
                !dep.startsWith('.') || dep.includes('./modules/')
            );
            
            return {
                total: dependencies.length,
                local: localDeps,
                raw: dependencies
            };
            
        } catch (error) {
            return { error: error.message, total: 0, local: [] };
        }
    }

    // 3. ПРОВЕРИТЬ РАБОТОСПОСОБНОСТЬ МОДУЛЯ
    async testModule(moduleInfo) {
        const result = {
            module: moduleInfo.name,
            path: moduleInfo.relativePath,
            status: 'unknown',
            exports: [],
            classNames: [],
            functions: [],
            errors: []
        };
        
        try {
            // Пробуем загрузить модуль
            const module = require(moduleInfo.path);
            
            // Анализируем экспорты
            if (typeof module === 'function') {
                result.exports.push('Function');
                result.classNames.push(module.name || 'AnonymousFunction');
            } else if (typeof module === 'object') {
                // Это класс или объект с методами
                if (module.prototype && module.prototype.constructor) {
                    result.exports.push('Class');
                    result.classNames.push(module.name || 'AnonymousClass');
                }
                
                // Собираем все методы/функции
                Object.keys(module).forEach(key => {
                    if (typeof module[key] === 'function') {
                        result.functions.push(key);
                    }
                });
            }
            
            result.status = 'working';
            console.log(`✅ ${moduleInfo.name}: работает`);
            
        } catch (error) {
            result.status = 'broken';
            result.errors.push(error.message);
            console.log(`❌ ${moduleInfo.name}: ошибка - ${error.message}`);
        }
        
        return result;
    }

    // 4. ПОСТРОИТЬ КАРТУ ЗАВИСИМОСТЕЙ
    buildDependencyMap(modules) {
        const map = new Map();
        
        modules.forEach(module => {
            const deps = this.analyzeModuleDependencies(module.path);
            map.set(module.name, {
                module: module,
                dependencies: deps.local,
                rawDependencies: deps.raw,
                status: 'pending'
            });
        });
        
        return map;
    }

    // 5. ГЕНЕРИРОВАТЬ ТЕКСТОВЫЙ ОТЧЕТ
    generateTextReport(results) {
        let report = '🔧 ДИАГНОСТИКА СИСТЕМЫ 🔧\n\n';
        
        report += `📊 ОБЩАЯ СТАТИСТИКА:\n`;
        report += `├─ Всего модулей: ${results.stats.totalModules}\n`;
        report += `├─ Рабочих: ${results.stats.workingModules} ✅\n`;
        report += `├─ С ошибками: ${results.stats.brokenModules} ❌\n`;
        report += `└─ Зависимостей: ${results.stats.totalDependencies}\n\n`;
        
        report += `📁 МОДУЛИ ПО КАТЕГОРИЯМ:\n`;
        
        // Группируем по папкам
        const byCategory = {};
        
        results.modules.forEach(mod => {
            const category = mod.dir.split(path.sep).pop();
            if (!byCategory[category]) byCategory[category] = [];
            byCategory[category].push(mod);
        });
        
        Object.keys(byCategory).forEach(category => {
            report += `\n📂 ${category.toUpperCase()}:\n`;
            
            byCategory[category].forEach(mod => {
                const status = mod.status === 'working' ? '✅' : '❌';
                report += `${status} ${mod.module}`;
                
                if (mod.classNames.length > 0) {
                    report += ` (${mod.classNames.join(', ')})`;
                }
                
                if (mod.functions.length > 0) {
                    report += ` [${mod.functions.slice(0, 3).join(', ')}${mod.functions.length > 3 ? '...' : ''}]`;
                }
                
                report += '\n';
            });
        });
        
        report += `\n🔗 КРИТИЧЕСКИЕ ЗАВИСИМОСТИ:\n`;
        
        // Находим модули от которых много зависит
        const dependencyCounts = {};
        results.dependencyMap.forEach((info, moduleName) => {
            info.dependencies.forEach(dep => {
                const depName = dep.split('/').pop().replace('.js', '');
                dependencyCounts[depName] = (dependencyCounts[depName] || 0) + 1;
            });
        });
        
        const critical = Object.entries(dependencyCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        critical.forEach(([module, count]) => {
            report += `├─ ${module}: ${count} модулей зависит\n`;
        });
        
        report += `\n⚠️ ПРОБЛЕМЫ:\n`;
        if (results.issues.length === 0) {
            report += `Нет критических проблем 🎉\n`;
        } else {
            results.issues.forEach(issue => {
                report += `❌ ${issue}\n`;
            });
        }
        
        return report;
    }

    // 6. ГЕНЕРИРОВАТЬ ДИАГРАММУ В ASCII
    generateAsciiDiagram(results) {
        let diagram = '📊 КАРТА ЗАВИСИМОСТЕЙ:\n\n';
        
        results.dependencyMap.forEach((info, moduleName) => {
            if (info.dependencies.length > 0) {
                diagram += `${moduleName}\n`;
                info.dependencies.forEach((dep, i) => {
                    const depName = dep.split('/').pop().replace('.js', '');
                    const prefix = i === info.dependencies.length - 1 ? '└─ ' : '├─ ';
                    diagram += `${prefix}→ ${depName}\n`;
                });
                diagram += '\n';
            }
        });
        
        return diagram;
    }

    // 7. ГЛАВНЫЙ МЕТОД - ЗАПУСТИТЬ ДИАГНОСТИКУ
    async runFullDiagnostic() {
        console.log('🔄 Запускаю полную диагностику системы...\n');
        
        // 1. Сканируем модули
        const allModules = await this.scanProject();
        
        // 2. Тестируем каждый модуль
        const testResults = [];
        
        for (const moduleInfo of allModules) {
            const result = await this.testModule(moduleInfo);
            testResults.push(result);
            
            // Обновляем статистику
            if (result.status === 'working') {
                this.stats.workingModules++;
            } else {
                this.stats.brokenModules++;
                this.issues.push(`Модуль ${moduleInfo.name} не загружается: ${result.errors[0]}`);
            }
        }
        
        this.stats.totalModules = allModules.length;
        
        // 3. Строим карту зависимостей
        const dependencyMap = this.buildDependencyMap(allModules);
        
        // 4. Считаем зависимости
        let totalDeps = 0;
        dependencyMap.forEach(info => {
            totalDeps += info.dependencies.length;
        });
        this.stats.totalDependencies = totalDeps;
        
        // 5. Генерируем отчет
        const finalReport = {
            modules: testResults,
            dependencyMap: dependencyMap,
            stats: this.stats,
            issues: this.issues,
            timestamp: new Date().toLocaleString('ru-RU')
        };
        
        console.log('\n✅ Диагностика завершена!');
        
        return finalReport;
    }

    // 8. СОЗДАТЬ И ОТПРАВИТЬ ОТЧЕТ В TELEGRAM
    async sendDiagnosticReport(bot, chatId) {
        try {
            await bot.sendMessage(chatId, '🔍 Запускаю диагностику системы...');
            
            const report = await this.runFullDiagnostic();
            
            // Отправляем текстовый отчет
            const textReport = this.generateTextReport(report);
            await bot.sendMessage(chatId, textReport, { parse_mode: 'HTML' });
            
            // Отправляем ASCII диаграмму (если не слишком большая)
            if (report.stats.totalModules < 50) {
                const diagram = this.generateAsciiDiagram(report);
                await bot.sendMessage(chatId, `<pre>${diagram}</pre>`, { parse_mode: 'HTML' });
            }
            
            // Отправляем статистику
            const statsMsg = `📈 СТАТИСТИКА ДИАГНОСТИКИ:\n` +
                           `✅ Рабочих модулей: ${report.stats.workingModules}/${report.stats.totalModules}\n` +
                           `🔗 Всего зависимостей: ${report.stats.totalDependencies}\n` +
                           `⚠️ Проблем: ${report.issues.length}\n` +
                           `🕐 Время: ${report.timestamp}`;
            
            await bot.sendMessage(chatId, statsMsg);
            
            return { success: true, report: report };
            
        } catch (error) {
            console.log('❌ Ошибка диагностики:', error);
            await bot.sendMessage(chatId, `❌ Ошибка диагностики: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SystemDiagnostic;
