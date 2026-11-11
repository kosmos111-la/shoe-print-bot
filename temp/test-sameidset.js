// Тест sameIdSet (сравнение треугольников как множеств, порядок не важен)
function sameIdSet(t, ids) {
    if (!t || t.length !== ids.length) return false;
    const set = new Set(ids);
    return t.every(id => set.has(id));
}

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

check('порядок не важен', sameIdSet(['pt_1', 'pt_2', 'pt_4'], ['pt_4', 'pt_1', 'pt_2']));
check('идентичный порядок', sameIdSet(['pt_1', 'pt_2', 'pt_4'], ['pt_1', 'pt_2', 'pt_4']));
check('другая вершина — false', !sameIdSet(['pt_1', 'pt_2', 'pt_4'], ['pt_1', 'pt_2', 'pt_5']));
check('разная длина — false', !sameIdSet(['pt_1', 'pt_2', 'pt_4'], ['pt_1', 'pt_2', 'pt_4', 'pt_6']));
check('null — false', !sameIdSet(null, ['pt_1', 'pt_2', 'pt_4']));

console.log(fail === 0 ? '\n🎉 sameIdSet OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);
