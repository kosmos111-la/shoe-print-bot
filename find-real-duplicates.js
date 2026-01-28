// find-real-duplicates.js
const fs = require('fs');
const path = require('path');

class RealDuplicateFinder {
    findFunctionDuplicates(dir) {
        const functions = new Map(); // hash -> [files]
       
        this.scanFiles(dir, (filePath, content) => {
            // Ищем функции (упрощённо)
            const functionRegex = /(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*\([^)]*\)\s*{)/g;
           
            let match;
            while ((match = functionRegex.exec(content)) !== null) {
                const funcName = match[1] || match[2] || match[3];
               
                // Извлекаем тело функции (приблизительно)
                const funcStart = match.index;
                let braceCount = 0;
                let funcEnd = funcStart;
               
                for (let i = funcStart; i < content.length; i++) {
                    if (content[i] === '{') braceCount++;
                    if (content[i] === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            funcEnd = i;
                            break;
                        }
                    }
                }
               
                const funcBody = content.substring(funcStart, funcEnd + 1);
                const hash = this.hashFunction(funcBody);
               
                if (!functions.has(hash)) {
                    functions.set(hash, []);
                }
                functions.get(hash).push({
                    file: path.relative(dir, filePath),
                    name: funcName,
                    body: funcBody.substring(0, 100) + '...'
                });
            }
        });
       
        // Выводим реальные дубли
        console.log('🔍 РЕАЛЬНЫЕ ДУБЛИКАТЫ ФУНКЦИЙ:');
        for (const [hash, files] of functions) {
            if (files.length > 1) {
                console.log(`\n📌 ${files[0].name} (${files.length} копий):`);
                files.forEach(f => {
                    console.log(`   📁 ${f.file}`);
                });
            }
        }
    }
   
    hashFunction(body) {
        // Упрощённый хэш (игнорируем пробелы, имена переменных)
        return body
            .replace(/\s+/g, '')
            .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, 'VAR')
            .replace(/\d+/g, 'NUM');
    }
   
    scanFiles(dir, callback) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
           
            if (stat.isDirectory()) {
                this.scanFiles(fullPath, callback);
            } else if (file.endsWith('.js')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    callback(fullPath, content);
                } catch (e) {
                    console.log(`⚠️ Ошибка чтения ${fullPath}:`, e.message);
                }
            }
        });
    }
}

// Запуск
const finder = new RealDuplicateFinder();
finder.findFunctionDuplicates('./modules/footprint');
