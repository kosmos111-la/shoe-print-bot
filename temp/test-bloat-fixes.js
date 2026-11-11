// Фокус-тест двух фиксов ModelEnhancer:
// 1) предохранитель transform (medianError>30 || scale>1.3 || scale<0.7 → отмена слияния)
// 2) жёсткая дедупликация (<2px игнор, 2..5px слияние, >=5px новая точка)

// ── 1) Логика предохранителя (как в enhance(): guardScaleOk && guardErrorOk) ──
function guardPassed(scale, medianError, guardPoints) {
    const guardScaleOk = scale > 0.7 && scale < 1.3;
    const guardErrorOk = guardPoints < 2 || medianError <= 30;
    return guardScaleOk && guardErrorOk;
}

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

// 🔥 Точный случай пользователя: scale=2.322, medianError=306px → слияние ОТМЕНЕНО
check('user case: scale=2.322, err=306 → ОТКЛОНЕНО', !guardPassed(2.322, 306, 20));
check('scale=2.322 сам по себе → ОТКЛОНЕНО', !guardPassed(2.322, 5, 20));
check('medianError=306 сам по себе → ОТКЛОНЕНО', !guardPassed(1.0, 306, 20));
check('scale=0.6 (<0.7) → ОТКЛОНЕНО', !guardPassed(0.6, 5, 20));
check('scale=1.35 (>1.3) → ОТКЛОНЕНО', !guardPassed(1.35, 5, 20));
check('scale=1.31 (пограничный) → ОТКЛОНЕНО', !guardPassed(1.31, 5, 20));
check('scale=0.7 (ровно порог) → ОТКЛОНЕНО (строго <)', !guardPassed(0.7, 5, 20));
check('норма: scale=1.02, err=8 → ПРОПУЩЕНО', guardPassed(1.02, 8, 20));
check('норма: scale=1.29, err=30 (ровно порог) → ПРОПУЩЕНО (<=)', guardPassed(1.29, 30, 20));
check('норма: scale=1.1, err=15 → ПРОПУЩЕНО', guardPassed(1.1, 15, 20));

// ── 2) Логика дедупликации (как в _updateModel) ──
function dedupDecision(closestDist, hasNode) {
    if (!hasNode) return 'add';
    if (closestDist < 2) return 'ignore';   // <2px — дубликат с точностью до шума
    if (closestDist < 5) return 'merge';    // 2..5px — сливаем (усредняем + conf++)
    return 'add';                            // >=5px — новая точка
}
check('dedup: 1.5px → ignore', dedupDecision(1.5, true) === 'ignore');
check('dedup: 2.0px → merge', dedupDecision(2.0, true) === 'merge');
check('dedup: 4.9px → merge', dedupDecision(4.9, true) === 'merge');
check('dedup: 5.0px → add', dedupDecision(5.0, true) === 'add');
check('dedup: 50px → add', dedupDecision(50, true) === 'add');
check('dedup: нет ближайшего → add', dedupDecision(Infinity, false) === 'add');

console.log(fail === 0 ? '\n🎉 ЛОГИКА ФИКСОВ OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);
