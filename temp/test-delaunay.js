// Быстрый тест клиентского Delaunay (свойство Делоне + Эйлер)
function delaunay(points) {
    const out = { triangles: [], edges: [] };
    const n = points.length;
    if (n < 3) { for (let i = 1; i < n; i++) out.edges.push([i - 1, i]); return out; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const d = Math.max(maxX - minX, maxY - minY, 1) * 2;
    const all = [...points, { x: cx - 4 * d, y: cy - 4 * d }, { x: cx + 4 * d, y: cy - 4 * d }, { x: cx, y: cy + 4 * d }];
    let tris = [[n, n + 1, n + 2]];
    const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const inCircum = (t, p) => {
        const a = all[t[0]], b = all[t[1]], c = all[t[2]];
        const adx = a.x - p.x, ady = a.y - p.y, bdx = b.x - p.x, bdy = b.y - p.y, cdx = c.x - p.x, cdy = c.y - p.y;
        return (adx * adx + ady * ady) * (bdx * cdy - bdy * cdx) + (bdx * bdx + bdy * bdy) * (cdx * ady - cdy * adx) + (cdx * cdx + cdy * cdy) * (adx * bdy - ady * bdx) > 1e-12;
    };
    for (let i = 0; i < n; i++) {
        const p = points[i];
        const bad = [];
        for (let ti = 0; ti < tris.length; ti++) if (inCircum(tris[ti], p)) bad.push(ti);
        if (bad.length === 0) continue;
        const edgeCount = new Map();
        for (const ti of bad) {
            const t = tris[ti];
            for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
                const k = a < b ? a + '--' + b : b + '--' + a;
                edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
            }
        }
        const boundary = [];
        for (const [k, cnt] of edgeCount) if (cnt === 1) boundary.push(k.split('--').map(Number));
        bad.sort((a, b) => b - a);
        for (const ti of bad) tris.splice(ti, 1);
        for (const [a, b] of boundary) {
            let t = [a, b, i];
            if (orient(all[t[0]], all[t[1]], all[t[2]]) < 0) t = [t[1], t[0], t[2]];
            tris.push(t);
        }
    }
    const real = tris.filter(t => t[0] < n && t[1] < n && t[2] < n);
    const es = new Set();
    for (const t of real) for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) es.add(a < b ? a + '--' + b : b + '--' + a);
    out.triangles = real;
    out.edges = [...es].map(k => k.split('--').map(Number));
    return out;
}

let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let fail = 0;
for (let trial = 0; trial < 6; trial++) {
    const pts = [];
    const N = 10 + trial * 4;
    for (let i = 0; i < N; i++) pts.push({ x: rnd() * 800, y: rnd() * 600 });
    const r = delaunay(pts);
    const okIdx = r.triangles.every(t => t.every(i => Number.isInteger(i) && i >= 0 && i < N));
    let okCirc = true;
    for (const t of r.triangles) {
        const [a, b, c] = [pts[t[0]], pts[t[1]], pts[t[2]]];
        const d2 = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        if (Math.abs(d2) < 1e-9) { okCirc = false; break; }
        const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
        const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d2;
        const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d2;
        const rr = Math.hypot(a.x - ux, a.y - uy);
        for (let i = 0; i < N; i++) {
            if (t.includes(i)) continue;
            if (Math.hypot(pts[i].x - ux, pts[i].y - uy) < rr - 1e-6) { okCirc = false; break; }
        }
        if (!okCirc) break;
    }
    const euler = r.triangles.length === r.edges.length - N + 1; // T = E - N + 1 (Эйлер для триангуляции)
    console.log(`trial ${trial + 1}: N=${N} tris=${r.triangles.length} edges=${r.edges.length} | индексы: ${okIdx ? 'OK' : 'FAIL'} | Делоне: ${okCirc ? 'OK' : 'FAIL'} | Эйлер: ${euler ? 'OK' : 'FAIL'}`);
    if (!okIdx || !okCirc || !euler) fail++;
}
console.log(fail === 0 ? '🎉 Delaunay OK (все триаль-прогоны)' : `💥 ПРОВАЛЕНО: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
