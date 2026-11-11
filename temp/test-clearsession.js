// Юнит-тест clearSession: после исправления сессия удаляется по правильному ключу,
// другие пользователи не задеваются, топология/сессии очищаются согласованно.
const SimpleFootprintManager = require('../modules/footprint/simple-manager');

const mgr = new SimpleFootprintManager({
    enableTopology: true,
    enableMergeVisualization: false,
    minPointsForFootprint: 3,
    debug: false
});

const sm = mgr.sessionManager;

// Два пользователя, у обоих песочница + топология
sm.createSandboxSession('u1', 'Тест u1');
sm.createSandboxSession('u2', 'Тест u2');
mgr.topologyManagers.set('u1', 'fake-tm-u1');
mgr.topologyManagers.set('u2', 'fake-tm-u2');
mgr.userSessions.set('u1', {});
mgr.userSessions.set('u2', {});

const before = {
    sandboxU1: sm.sandboxSessions.has('u1'),
    sandboxU2: sm.sandboxSessions.has('u2'),
    sessionsSize: sm.sessions.size
};
console.log('до  : sandboxU1=', before.sandboxU1, 'sandboxU2=', before.sandboxU2, 'sessions=', before.sessionsSize);

const res = mgr.clearSession('u1');

const after = {
    sandboxU1: sm.sandboxSessions.has('u1'),
    sandboxU2: sm.sandboxSessions.has('u2'),
    sessionsSize: sm.sessions.size,
    tmU1: mgr.topologyManagers.has('u1'),
    tmU2: mgr.topologyManagers.has('u2'),
    usU1: mgr.userSessions.has('u1'),
    usU2: mgr.userSessions.has('u2')
};
console.log('после: sandboxU1=', after.sandboxU1, 'sandboxU2=', after.sandboxU2, 'sessions=', after.sessionsSize,
    'tmU1=', after.tmU1, 'tmU2=', after.tmU2, 'usU1=', after.usU1, 'usU2=', after.usU2);

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

check('u1: песочница удалена', before.sandboxU1 && !after.sandboxU1);
check('u1: topologyManager удалён', !after.tmU1);
check('u1: userSessions удалён', !after.usU1);
check('u2: песочница не тронута', before.sandboxU2 && after.sandboxU2);
check('u2: topologyManager не тронут', after.tmU2);
check('u2: userSessions не тронут', after.usU2);
check('sessions: осталась ровно сессия u2', before.sessionsSize === 2 && after.sessionsSize === 1);
check('clearSession вернул success', res && res.success === true);
check('после clearSession можно создать новую песочницу u1', (() => {
    sm.createSandboxSession('u1', 'Новая');
    return sm.sandboxSessions.has('u1');
})());

console.log(fail === 0 ? '\n🎉 clearSession OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);
