// Тест регексов подсветки лога по коротким id
function idPatterns(ids) {
    const pats = [];
    for (const sid of ids || []) {
        if (!sid) continue;
        const m = /^pt_(\d+)$/.exec(sid);
        if (m) {
            const idx = m[1];
            pats.push(new RegExp('(^|[^\\d])pt_' + idx + '([^\\d]|$)'));   // короткая форма
            pats.push(new RegExp('pt_\\d+_' + idx + '_\\d+'));             // форма ядра pt_<ts>_<idx>_<k>
        } else {
            pats.push(new RegExp(sid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
    }
    return pats;
}

const pats = idPatterns(['pt_2', 'pt_4']);
const tests = [
    ['короткая pt_2', 'pt_2', true],
    ['короткая pt_4', 'pt_4', true],
    ['ядро pt_<ts>_2_<k>', 'pt_1700000000000_2_1', true],
    ['ядро pt_<ts>_4_<k>', 'pt_1700000000002_4_3', true],
    ['НЕ pt_25', 'pt_25', false],
    ['НЕ ядро _25_', 'pt_1700000000000_25_1', false],
    ['ядро внутри текста лога', 'Добавлен треугольник tri_pt_1700_2_1...', true],
    ['длинное ядро pt_3 без совпадения', 'pt_1700000000000_3_1', false]
];

let fail = 0;
for (const [name, line, want] of tests) {
    const got = pats.some(re => re.test(line));
    console.log((got === want ? '  OK  ' : '  FAIL'), name, '->', got);
    if (got !== want) fail++;
}
console.log(fail === 0 ? '\n🎉 highlight regex OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);
