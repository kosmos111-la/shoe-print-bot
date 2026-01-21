// check-syntax.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules/footprint/simple-footprint.js');

console.log('🔍 Проверка синтаксиса simple-footprint.js...\n');

try {
    const content = fs.readFileSync(filePath, 'utf8');
   
    // Ищем строки с console.log без обратных кавычек
    const lines = content.split('\n');
   
    console.log('Поиск проблемных console.log...');
    let foundErrors = false;
   
    lines.forEach((line, index) => {
        // Ищем console.log с ${ но без обратных кавычек
        const lineNumber = index + 1;
       
        if (line.includes('console.log(') &&
            line.includes('${') &&
            !line.includes('console.log(`')) {
           
            console.log(`⚠️ Строка ${lineNumber}: ${line.trim().substring(0, 60)}...`);
            foundErrors = true;
           
            // Показываем контекст
            const start = Math.max(0, index - 2);
            const end = Math.min(lines.length - 1, index + 2);
            console.log('   Контекст:');
            for (let i = start; i <= end; i++) {
                const marker = i === index ? '>>>' : '   ';
                console.log(`${marker} ${i+1}: ${lines[i].trim()}`);
            }
            console.log();
        }
    });
   
    if (!foundErrors) {
        console.log('✅ Все console.log в порядке');
    }
   
} catch (error) {
    console.error('❌ Ошибка при чтении файла:', error.message);
}
