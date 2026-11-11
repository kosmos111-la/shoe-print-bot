// Проверка математики вида: viewToCanvas / canvasToView / anchorViewAroundCursor / applyViewTransform
function viewToCanvas(view, x, y) {
    const cos = Math.cos(view.rot), sin = Math.sin(view.rot);
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;
    let px = view.tx + view.s * xr;
    let py = view.ty + view.s * yr;
    if (view.fx < 0) px = view.cw - px;
    if (view.fy < 0) py = view.ch - py;
    return { x: px, y: py };
}
function canvasToView(view, px, py) {
    if (view.fx < 0) px = view.cw - px;
    if (view.fy < 0) py = view.ch - py;
    const cos = Math.cos(view.rot), sin = Math.sin(view.rot);
    const dx = (px - view.tx) / view.s;
    const dy = (py - view.ty) / view.s;
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}
function applyViewTransform(ctx, view) {
    const cos = Math.cos(view.rot), sin = Math.sin(view.rot);
    let a = view.s * cos, b = view.s * sin, c = -view.s * sin, d = view.s * cos, e = view.tx, f = view.ty;
    if (view.fx < 0) { a = -a; c = -c; e = view.cw - e; }
    if (view.fy < 0) { b = -b; d = -d; f = view.ch - f; }
    ctx.setTransform(a, b, c, d, e, f);
}
function anchorViewAroundCursor(view, cx, cy, sNew, rotNew) {
    const dp = canvasToView(view, cx, cy);
    const cos = Math.cos(rotNew), sin = Math.sin(rotNew);
    const xr = dp.x * cos - dp.y * sin;
    const yr = dp.x * sin + dp.y * cos;
    view.s = sNew;
    view.rot = rotNew;
    view.tx = (view.fx < 0 ? view.cw - cx : cx) - sNew * xr;
    view.ty = (view.fy < 0 ? view.ch - cy : cy) - sNew * yr;
}

// фейковый ctx, запоминающий setTransform
const fakeCtx = { m: null, setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; } };

let fail = 0;
const check = (name, ok) => { console.log((ok ? '  ✅' : '  ❌'), name); if (!ok) fail++; };

// 1) Round-trip: данные → canvas → данные = identity (с вращением и зеркалами)
for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const view = { s: 0.7, rot: 1.1, fx, fy, tx: 130, ty: -40, cw: 540, ch: 500 };
    const pt = { x: 1234.5, y: 678.9 };
    const c = viewToCanvas(view, pt.x, pt.y);
    const back = canvasToView(view, c.x, c.y);
    check(`round-trip fx=${fx} fy=${fy}`, Math.abs(back.x - pt.x) < 1e-9 && Math.abs(back.y - pt.y) < 1e-9);
}

// 2) Якорь: после зума+вращения вокруг (cx,cy) точка данных под курсором не сдвигается
{
    const view = { s: 1.0, rot: 0, fx: -1, fy: 1, tx: 270, ty: 250, cw: 540, ch: 500 };
    const cx = 300, cy = 200;
    const before = canvasToView(view, cx, cy);
    anchorViewAroundCursor(view, cx, cy, 2.5, 0.7);
    const after = canvasToView(view, cx, cy);
    check('якорь под курсором (зум+вращение, с зеркалом X)',
        Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
}

// 3) applyViewTransform даёт тот же результат, что viewToCanvas
for (const [fx, fy] of [[1, 1], [-1, 1], [-1, -1]]) {
    const view = { s: 0.5, rot: -0.4, fx, fy, tx: 100, ty: 50, cw: 540, ch: 500 };
    applyViewTransform(fakeCtx, view);
    const [a, b, c, d, e, f] = fakeCtx.m;
    const pt = { x: 800, y: 300 };
    const viaMatrix = { x: a * pt.x + c * pt.y + e, y: b * pt.x + d * pt.y + f };
    const viaFormula = viewToCanvas(view, pt.x, pt.y);
    check(`матрица==формула fx=${fx} fy=${fy}`,
        Math.abs(viaMatrix.x - viaFormula.x) < 1e-9 && Math.abs(viaMatrix.y - viaFormula.y) < 1e-9);
}

// 4) Зеркало вокруг центра: точка по центру не двигается
{
    const view = { s: 0.5, rot: 0, fx: 1, fy: 1, tx: 270, ty: 250, cw: 540, ch: 500 };
    const centerData = canvasToView(view, 270, 250);
    view.fx = -1;
    const centerCanvas = viewToCanvas(view, centerData.x, centerData.y);
    check('зеркало: центр холста неподвижен', Math.abs(centerCanvas.x - 270) < 1e-9 && Math.abs(centerCanvas.y - 250) < 1e-9);
}

console.log(fail === 0 ? '🎉 ТРАНСФОРМАЦИЯ OK' : `💥 ПРОВАЛЕНО: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
