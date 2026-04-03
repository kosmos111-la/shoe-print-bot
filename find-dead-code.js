#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// =============================================================================
// КОНФИГУРАЦИЯ
// =============================================================================

const CONFIG = {
    // Директории для анализа
    scanDirs: ['.', './modules', './modules/footprint', './modules/analysis', './modules/visualization'],
    // Игнорируемые директории
    ignoreDirs: ['node_modules', '.git', 'temp', 'data', 'backups', '__pycache__', '.vscode'],
    // Игнорируемые файлы
    ignoreFiles: ['find-dead-code.js', 'package.json', 'package-lock.json', '.env'],
    // Расширения файлов для анализа
    extensions: ['.js', '.json']
};

// =============================================================================
// СБОР ВСЕХ ФАЙЛОВ
// =============================================================================

function getAllFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
   
    const files = fs.readdirSync(dir);
   
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
       
        // Пропускаем игнорируемые директории
        if (CONFIG.ignoreDirs.includes(file)) continue;
        // Пропускаем игнорируемые файлы
        if (CONFIG.ignoreFiles.includes(file)) continue;
       
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else if (CONFIG.extensions.includes(path.extname(file))) {
            fileList.push(filePath);
        }
    }
   
    return fileList;
}

// =============================================================================
// ПОИСК ЭКСПОРТОВ В ФАЙЛЕ
// =============================================================================

function findExports(content, filePath) {
    const exports = [];
   
    // module.exports = { ... }
    const objExportMatch = content.match(/module\.exports\s*=\s*{([^}]+)}/s);
    if (objExportMatch) {
        const exportsStr = objExportMatch[1];
        const propMatches = exportsStr.matchAll(/(\w+)\s*:/g);
        for (const match of propMatches) {
            exports.push({
                name: match[1],
                type: 'property',
                file: filePath
            });
        }
    }
   
    // module.exports = function name
    const funcExportMatch = content.match(/module\.exports\s*=\s*function\s+(\w+)/);
    if (funcExportMatch) {
        exports.push({
            name: funcExportMatch[1],
            type: 'function',
            file: filePath
        });
    }
   
    // module.exports = class Name
    const classExportMatch = content.match(/module\.exports\s*=\s*class\s+(\w+)/);
    if (classExportMatch) {
        exports.push({
            name: classExportMatch[1],
            type: 'class',
            file: filePath
        });
    }
   
    // exports.name = ...
    const namedExports = content.matchAll(/exports\.(\w+)\s*=/g);
    for (const match of namedExports) {
        exports.push({
            name: match[1],
            type: 'named',
            file: filePath
        });
    }
   
    return exports;
}

// =============================================================================
// ПОИСК ИМПОРТОВ В ФАЙЛЕ
// =============================================================================

function findImports(content, filePath) {
    const imports = [];
   
    // require('./path')
    const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
        imports.push({
            target: match[1],
            type: 'require',
            file: filePath,
            line: content.slice(0, match.index).split('\n').length
        });
    }
   
    // const X = require('./path')
    const constRequireMatches = content.matchAll(/const\s+{?\s*(\w+)\s*}?\s*=\s*require\(['"]([^'"]+)['"]\)/g);
    for (const match of constRequireMatches) {
        imports.push({
            target: match[2],
            type: 'require',
            file: filePath,
            variable: match[1],
            line: content.slice(0, match.index).split('\n').length
        });
    }
   
    return imports;
}

// =============================================================================
// ПОИСК ВЫЗОВОВ ФУНКЦИЙ
// =============================================================================

function findFunctionCalls(content, functionName) {
    const calls = [];
   
    // Ищем вызовы функции (functionName()
    const regex = new RegExp(`${functionName}\\s*\\(`, 'g');
    const matches = content.matchAll(regex);
   
    for (const match of matches) {
        calls.push({
            line: content.slice(0, match.index).split('\n').length
        });
    }
   
    return calls;
}

// =============================================================================
// АНАЛИЗ ИСПОЛЬЗОВАНИЯ ЭКСПОРТОВ
// =============================================================================

function analyzeUsage(allFiles) {
    console.log('\n📊 Анализ использования экспортов...\n');
   
    // Собираем все экспорты
    const allExports = [];
    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const exports = findExports(content, file);
        allExports.push(...exports);
    }
   
    // Собираем все импорты
    const allImports = [];
    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const imports = findImports(content, file);
        allImports.push(...imports);
    }
   
    // Находим неиспользуемые экспорты
    const usedExports = new Set();
    for (const imp of allImports) {
        const moduleName = path.basename(imp.target, '.js');
        usedExports.add(moduleName);
    }
   
    const unusedExports = allExports.filter(exp => {
        // Пропускаем main.js
        if (exp.file.includes('main.js')) return false;
        // Проверяем, используется ли экспорт
        return !usedExports.has(exp.name);
    });
   
    if (unusedExports.length > 0) {
        console.log('❌ НЕИСПОЛЬЗУЕМЫЕ ЭКСПОРТЫ:');
        for (const exp of unusedExports) {
            console.log(`   • ${exp.name} (${path.basename(exp.file)})`);
        }
    } else {
        console.log('✅ Все экспорты используются');
    }
   
    return { unusedExports, allImports };
}

// =============================================================================
// ПОИСК МЁРТВЫХ ФАЙЛОВ
// =============================================================================

function findDeadFiles(allFiles, allImports) {
    console.log('\n📁 Поиск мёртвых файлов...\n');
   
    const referencedFiles = new Set();
    for (const imp of allImports) {
        // Преобразуем относительный путь в абсолютный
        let targetPath = imp.target;
        if (targetPath.startsWith('./')) {
            targetPath = targetPath.substring(2);
        }
        if (!targetPath.endsWith('.js')) {
            targetPath += '.js';
        }
        referencedFiles.add(targetPath);
    }
   
    const deadFiles = [];
    for (const file of allFiles) {
        const relativePath = path.relative('.', file);
        // Пропускаем main.js и сам скрипт
        if (relativePath === 'main.js') continue;
        if (relativePath === 'find-dead-code.js') continue;
       
        // Проверяем, импортируется ли файл
        let isReferenced = false;
        for (const ref of referencedFiles) {
            if (relativePath.endsWith(ref) || ref.endsWith(path.basename(relativePath))) {
                isReferenced = true;
                break;
            }
        }
       
        // Проверяем, не является ли файл точкой входа
        const content = fs.readFileSync(file, 'utf8');
        const isEntryPoint = content.includes('app.listen') ||
                            content.includes('bot.startPolling') ||
                            content.includes('module.exports = {') === false;
       
        if (!isReferenced && !isEntryPoint) {
            deadFiles.push(relativePath);
        }
    }
   
    if (deadFiles.length > 0) {
        console.log('❌ МЁРТВЫЕ ФАЙЛЫ (не импортируются):');
        for (const file of deadFiles) {
            console.log(`   • ${file}`);
        }
    } else {
        console.log('✅ Мёртвых файлов не найдено');
    }
   
    return deadFiles;
}

// =============================================================================
// ПОИСК ПУСТЫХ ФАЙЛОВ
// =============================================================================

function findEmptyFiles(allFiles) {
    console.log('\n📄 Поиск пустых файлов...\n');
   
    const emptyFiles = [];
    for (const file of allFiles) {
        const stats = fs.statSync(file);
        if (stats.size === 0) {
            emptyFiles.push(file);
        }
    }
   
    if (emptyFiles.length > 0) {
        console.log('⚠️ ПУСТЫЕ ФАЙЛЫ:');
        for (const file of emptyFiles) {
            console.log(`   • ${file}`);
        }
    } else {
        console.log('✅ Пустых файлов не найдено');
    }
   
    return emptyFiles;
}

// =============================================================================
// ПОИСК ЗАКОММЕНТИРОВАННОГО КОДА
// =============================================================================

function findCommentedCode(allFiles) {
    console.log('\n💬 Поиск закомментированного кода...\n');
   
    let totalComments = 0;
    const filesWithComments = [];
   
    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        let commentedLines = 0;
       
        for (const line of lines) {
            const trimmed = line.trim();
            // Ищем закомментированный код (// что-то не пустое и не JSDoc)
            if (trimmed.startsWith('//') &&
                !trimmed.startsWith('///') &&
                trimmed.length > 3 &&
                !trimmed.includes('eslint') &&
                !trimmed.includes('TODO') &&
                !trimmed.includes('FIXME')) {
                commentedLines++;
            }
        }
       
        if (commentedLines > 5) {
            filesWithComments.push({
                file: path.basename(file),
                lines: commentedLines
            });
            totalComments += commentedLines;
        }
    }
   
    if (filesWithComments.length > 0) {
        console.log(`⚠️ НАЙДЕНО ЗАКОММЕНТИРОВАННОГО КОДА: ${totalComments} строк`);
        for (const item of filesWithComments) {
            console.log(`   • ${item.file}: ${item.lines} строк`);
        }
    } else {
        console.log('✅ Много закомментированного кода не найдено');
    }
}

// =============================================================================
// ПОИСК НЕИСПОЛЬЗУЕМЫХ ПЕРЕМЕННЫХ (БАЗОВЫЙ)
// =============================================================================

function findUnusedVariables(allFiles) {
    console.log('\n🔍 Поиск потенциально неиспользуемых переменных...\n');
   
    const variables = new Map(); // varName -> { file, line }
   
    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
       
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
           
            // Ищем объявления переменных
            const letMatch = line.match(/let\s+(\w+)\s*=/);
            const constMatch = line.match(/const\s+(\w+)\s*=/);
            const varMatch = line.match(/var\s+(\w+)\s*=/);
           
            const match = letMatch || constMatch || varMatch;
            if (match) {
                const varName = match[1];
                // Пропускаем common переменные
                if (!['i', 'j', 'k', 'x', 'y', 'dx', 'dy', 'err', 'res'].includes(varName)) {
                    variables.set(varName, {
                        name: varName,
                        file: path.basename(file),
                        line: i + 1
                    });
                }
            }
        }
    }
   
    // Проверяем использование (упрощённо)
    const unusedVars = [];
    for (const [varName, info] of variables) {
        let usageCount = 0;
        for (const file of allFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const regex = new RegExp(`\\b${varName}\\b`, 'g');
            const matches = content.match(regex);
            if (matches) {
                usageCount += matches.length;
            }
        }
       
        // Если переменная используется только один раз (при объявлении)
        if (usageCount <= 1) {
            unusedVars.push(info);
        }
    }
   
    if (unusedVars.length > 0) {
        console.log('⚠️ ПОТЕНЦИАЛЬНО НЕИСПОЛЬЗУЕМЫЕ ПЕРЕМЕННЫЕ:');
        for (const v of unusedVars.slice(0, 20)) {
            console.log(`   • ${v.name} (${v.file}:${v.line})`);
        }
        if (unusedVars.length > 20) {
            console.log(`   ... и ещё ${unusedVars.length - 20}`);
        }
    } else {
        console.log('✅ Подозрительных переменных не найдено');
    }
}

// =============================================================================
// ПОИСК ДУБЛИРУЮЩИХСЯ ФАЙЛОВ
// =============================================================================

function findDuplicateFiles(allFiles) {
    console.log('\n🔄 Поиск дублирующихся файлов...\n');
   
    const fileHashes = new Map();
   
    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const hash = require('crypto').createHash('md5').update(content).digest('hex');
       
        if (!fileHashes.has(hash)) {
            fileHashes.set(hash, []);
        }
        fileHashes.get(hash).push(path.basename(file));
    }
   
    const duplicates = [];
    for (const [hash, files] of fileHashes) {
        if (files.length > 1) {
            duplicates.push(files);
        }
    }
   
    if (duplicates.length > 0) {
        console.log('⚠️ ДУБЛИРУЮЩИЕСЯ ФАЙЛЫ (одинаковое содержимое):');
        for (const group of duplicates) {
            console.log(`   • ${group.join(' = ')}`);
        }
    } else {
        console.log('✅ Дубликатов не найдено');
    }
}

// =============================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// =============================================================================

function main() {
    console.log('\n🔍 АНАЛИЗ МЁРТВОГО КОДА');
    console.log('='.repeat(50));
   
    // Собираем все файлы
    console.log('\n📂 Сканирование файлов...');
    const allFiles = getAllFiles('.');
    console.log(`   Найдено файлов: ${allFiles.length}`);
   
    // Анализируем импорты
    const { unusedExports, allImports } = analyzeUsage(allFiles);
   
    // Ищем мёртвые файлы
    const deadFiles = findDeadFiles(allFiles, allImports);
   
    // Ищем пустые файлы
    const emptyFiles = findEmptyFiles(allFiles);
   
    // Ищем закомментированный код
    findCommentedCode(allFiles);
   
    // Ищем неиспользуемые переменные
    findUnusedVariables(allFiles);
   
    // Ищем дубликаты
    findDuplicateFiles(allFiles);
   
    // ИТОГИ
    console.log('\n' + '='.repeat(50));
    console.log('📊 ИТОГИ АНАЛИЗА:');
    console.log('='.repeat(50));
    console.log(`   • Всего файлов: ${allFiles.length}`);
    console.log(`   • Неиспользуемых экспортов: ${unusedExports.length}`);
    console.log(`   • Мёртвых файлов: ${deadFiles.length}`);
    console.log(`   • Пустых файлов: ${emptyFiles.length}`);
   
    if (deadFiles.length === 0 && unusedExports.length === 0 && emptyFiles.length === 0) {
        console.log('\n✅ ЧИСТОТА КОДА: ОТЛИЧНО! Мёртвого кода не найдено.');
    } else if (deadFiles.length + unusedExports.length + emptyFiles.length < 10) {
        console.log('\n⚠️ ЧИСТОТА КОДА: ХОРОШО. Небольшой мусор есть.');
    } else {
        console.log('\n❌ ЧИСТОТА КОДА: ТРЕБУЕТ ВНИМАНИЯ. Есть что почистить.');
    }
   
    // Рекомендации
    if (deadFiles.length > 0) {
        console.log('\n💡 РЕКОМЕНДАЦИИ:');
        console.log('   1. Проверьте мёртвые файлы — возможно, их можно удалить');
        console.log('   2. Закомментируйте импорты и проверьте работу бота');
        console.log('   3. После подтверждения — удалите файлы через git rm');
    }
}

// Запуск
main();
