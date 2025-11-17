// Setup canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// Teams (8) config
const TEAMS_NAMES = [
    'Germany', 'Canada', 'Costa Rica', 'Italy', 'England', 'United States', 'Spain', 'Poland'
];
const TEAMS = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: TEAMS_NAMES[i],
    css: 'team-' + (i + 1),
    score: 0,
    fixed: false,
    fixUntil: 0,
    ledger: {}, // ledger per service: { serviceName: cumulativePts }
    tempLedger: {} // Temporary ledger for current tick
}));

// Services
const SERVICES = [
    { id: 'babylon', service: 'babylon', type: 'Path Traversal', payload: (s, d) => `GET /download?f=../../../flag_${d}.txt` },
    { id: 'ayuge', service: 'ayuge', type: 'Buffer Overflow', payload: (s, d) => `USER ${'A'.repeat(140)}\\r\\nPASS x` },
    { id: 'catbat', service: 'catbat', type: 'SQL Injection', payload: (s, d) => `id=1 UNION SELECT flag FROM secrets --` },
    { id: 'moonapi', service: 'moonapi', type: 'Auth Bypass', payload: (s, d) => `POST /auth bypass payload` },
    { id: 'vaultfs', service: 'vaultfs', type: 'Deserialization', payload: (s, d) => `deserialize(payload)` },
    { id: 'sshx', service: 'sshx', type: 'Race Condition', payload: (s, d) => `burst ssh auth attempts` },
    { id: 'imgsrv', service: 'imgsrv', type: 'Image RCE', payload: (s, d) => `upload malicious image` },
    { id: 'store', service: 'storage', type: 'Insecure Direct Object', payload: (s, d) => `GET /store/${d}/file` }
];
function randomService() { return SERVICES[Math.floor(Math.random() * SERVICES.length)]; }

// DOM refs
const nodesRoot = document.getElementById('nodes-root');
const consoleEl = document.getElementById('console');
const scoresEl = document.getElementById('scores');
const countdownEl = document.getElementById('countdown');
const tickNumEl = document.getElementById('tickNum');

// compute positions on a circle
function computePositions() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const r = Math.min(canvas.width, canvas.height) * 0.38;
    TEAMS.forEach((t, i) => {
        const angle = (i / TEAMS.length) * Math.PI * 2 - Math.PI / 2;
        t.x = cx + Math.cos(angle) * r;
        t.y = cy + Math.sin(angle) * r;
    });
}
computePositions();
window.addEventListener('resize', computePositions);

// render nodes
TEAMS.forEach(t => {
    const node = document.createElement('div');
    node.className = 'node ' + t.css;
    node.style.left = t.x + 'px';
    node.style.top = t.y + 'px';
    node.innerHTML = `
        <div class="team-core" style="--team-color:var(--team-${t.id});">
            <div class="member top"><i class="fa-solid fa-laptop"></i></div>
            <div class="member left"><i class="fa-solid fa-laptop"></i></div>
            <div class="member right"><i class="fa-solid fa-laptop"></i></div>
            <div class="member bottom"><i class="fa-solid fa-laptop"></i></div>
            <div class="switch"><i class="fa-solid fa-inbox"></i></div>
        </div>
        <div class="label">${t.name}</div>
    `;
    nodesRoot.appendChild(node);
    t.nodeEl = node;
    t.coreEl = node.querySelector('.team-core');
    // set computed team color var for log styling
    node.style.setProperty('--team-color', getComputedStyle(document.documentElement).getPropertyValue('--team-' + t.id));
});

// Console logger (with header "LOG EVENT")
function addLog(team, html) {
    const wrap = document.createElement('div');
    wrap.className = 'log-wrapper ' + team.css;

    const head = document.createElement('div');
    head.className = 'log-header';
    head.textContent = 'LOG EVENT';

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<strong>[${team.name}]</strong> ${html}`;

    wrap.appendChild(head);
    wrap.appendChild(entry);
    consoleEl.appendChild(wrap);
    consoleEl.scrollTop = consoleEl.scrollHeight;

    // Limit
    if (consoleEl.children.length > 400) consoleEl.removeChild(consoleEl.children[1]);
}

// Scoreboard render (with per-service breakdown)
function updateScores() {
    scoresEl.innerHTML = '';
    TEAMS.forEach(t => {
        const line = document.createElement('div');
        line.className = 'score-line';
        const top = document.createElement('div');
        top.className = 'score-top';
        const left = document.createElement('div');
        left.className = 'score-left';
        const dot = document.createElement('span');
        dot.className = 'score-dot';
        dot.style.background = getComputedStyle(document.documentElement).getPropertyValue('--team-' + t.id).trim();
        const nameSpan = document.createElement('span');
        nameSpan.className = 'team-name';
        nameSpan.textContent = t.name;
        left.appendChild(dot);
        left.appendChild(nameSpan);

        const right = document.createElement('div');
        right.className = 'team-total';
        right.textContent = t.score;

        top.appendChild(left);
        top.appendChild(right);

        // services breakdown
        const svcRow = document.createElement('div');
        svcRow.className = 'services-row';

        // ensure we show all known services (even zero)
        SERVICES.forEach(svc => {
            const pill = document.createElement('div');
            pill.className = 'svc-pill';
            const val = t.ledger[svc.service] || 0;
            pill.innerHTML = `<div style="font-size:11px;font-weight:700">${svc.service}</div>
                              <div class="${val >= 0 ? 'svc-plus' : 'svc-minus'}">${val >= 0 ? '+' + val : val}</div>`;
            svcRow.appendChild(pill);
        });

        // summary string like "Spain: 450+  -100" -> we produce positive/negative totals
        const pos = Object.values(t.ledger).filter(v => v > 0).reduce((a, b) => a + b, 0);
        const neg = Object.values(t.ledger).filter(v => v < 0).reduce((a, b) => a + b, 0); // negative number
        const summary = document.createElement('div');
        summary.style.fontSize = '12px';
        summary.style.color = 'var(--fg2-color)';
        summary.textContent = `+${pos}   ${neg}`;

        line.appendChild(top);
        line.appendChild(svcRow);
        line.appendChild(summary);
        scoresEl.appendChild(line);
    });
}

updateScores();

// Packets / attacks
function createPacket(kind, color) {
    const el = document.createElement('div');
    el.className = 'packet ' + kind;
    el.innerHTML = kind === 'exploit' ? '<i class="fa-solid fa-bug"></i>' :
        kind === 'flag' ? '<i class="fa-solid fa-flag"></i>' :
            '<i class="fa-solid fa-wrench"></i>';
    el.style.color = color;
    document.body.appendChild(el);
    return el;
}

let attacks = [];
function launchAttack(attacker, victim) {
    const svc = randomService();
    const targetIp = `10.10.${victim.id}.${attacker.id + 1}`;
    const payload = svc.payload(attacker.id, victim.id);
    const cmd = `python3 exploit.py -p 3456 -u http://${targetIp}/${svc.service} -x "${payload}"`;

    addLog(attacker, `<span style="opacity:0.95">${svc.type}</span> → Target: ${svc.service} (${victim.name})`);
    addLog(attacker, `<span style="color:#bfc6cc">${cmd}</span>`);

    const color = getComputedStyle(document.documentElement).getPropertyValue('--team-' + attacker.id).trim() || '#fff';
    const packetEl = createPacket('exploit', color);

    attacks.push({
        attacker, victim, svc, payload, cmd,
        t: 0, speed: 0.008 + Math.random() * 0.02,
        phase: 'outbound',
        packetEl, color: color
    });
}

// Resolve arrival: now with points between 80 and 200 when flag captured
function resolveArrival(atk) {
    const victim = atk.victim;
    const now = Date.now();
    const victimFixedNow = (victim.fixed && now < victim.fixUntil);
    const prevented = victimFixedNow || (Math.random() < 0.28);

    if (prevented) {
        addLog(victim, `<i class="fa-solid fa-wrench"></i> Vulnerabilidad FIXED en ${victim.name}`);
        atk.phase = 'return';
        atk.returnKind = 'fix';
        atk.packetEl.innerHTML = '<i class="fa-solid fa-wrench"></i>';
        atk.packetEl.classList.remove('exploit');
        atk.packetEl.classList.add('fix');
        atk.speed = 0.006 + Math.random() * 0.01;
    } else {
        // assign random points between 80 and 200
        const pts = Math.floor(80 + Math.random() * (200 - 80 + 1));
        addLog(atk.attacker, `<i class="fa-solid fa-flag"></i> Flag capturada de ${victim.name} (${atk.svc.service}) → ${pts} pts`);
        atk.phase = 'return';
        atk.returnKind = 'flag';
        atk.packetEl.innerHTML = '<i class="fa-solid fa-flag"></i>';
        atk.packetEl.classList.remove('exploit');
        atk.packetEl.classList.add('flag');

        // Store points in temporary ledger instead of applying immediately
        atk.attacker.tempLedger[atk.svc.service] = (atk.attacker.tempLedger[atk.svc.service] || 0) + pts;
        victim.tempLedger[atk.svc.service] = (victim.tempLedger[atk.svc.service] || 0) - pts;
    }
}

// Random fix window for teams
function randomFixTick() {
    const t = TEAMS[Math.floor(Math.random() * TEAMS.length)];
    t.fixed = true;
    t.fixUntil = Date.now() + (2500 + Math.random() * 6000); // 2.5-8.5s
    addLog(t, `<i class="fa-solid fa-wrench"></i> ${t.name} aplica FIX (window breve)`);
}

// Render loop - draw lines and move packets
function lerp(a, b, t) { return a + (b - a) * t; }
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    TEAMS.forEach(t => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, 48, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    for (let i = attacks.length - 1; i >= 0; i--) {
        const a = attacks[i];
        a.t += a.speed;

        if (a.phase === 'outbound') {
            const sx = a.attacker.x, sy = a.attacker.y;
            const tx = a.victim.x, ty = a.victim.y;
            const px = lerp(sx, tx, a.t), py = lerp(sy, ty, a.t);

            // dashed outbound
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(px, py);
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 8]);
            ctx.stroke();
            ctx.setLineDash([]);

            a.packetEl.style.left = px + 'px';
            a.packetEl.style.top = py + 'px';

            if (a.t >= 1) {
                a.t = 0;
                resolveArrival(a);
            }
        } else if (a.phase === 'return') {
            const sx = a.victim.x, sy = a.victim.y;
            const tx = a.attacker.x, ty = a.attacker.y;
            const px = lerp(sx, tx, a.t), py = lerp(sy, ty, a.t);

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(px, py);
            ctx.strokeStyle = (a.returnKind === 'flag') ? 'rgba(120,255,140,0.95)' : 'rgba(102,226,255,0.95)';
            ctx.lineWidth = 3;
            ctx.stroke();

            a.packetEl.style.left = px + 'px';
            a.packetEl.style.top = py + 'px';

            if (a.t >= 1) {
                if (a.returnKind === 'flag') addLog(a.attacker, `<strong style="color:var(--team-color)">${a.attacker.name} recibe FLAG</strong>`);
                else addLog(a.attacker, `<span style="opacity:0.9">Exploit falló: target FIXED</span>`);
                a.packetEl.remove();
                attacks.splice(i, 1);
            }
        }
    }

    // Unfix expired
    const now = Date.now();
    TEAMS.forEach(t => {
        if (t.fixed && now > t.fixUntil) {
            t.fixed = false;
            addLog(t, `FIX window ended en ${t.name}`);
        }
    });

    requestAnimationFrame(render);
}
render();

// Orchestration: periodic attacks & fixes
function periodicAttack() {
    const aIdx = Math.floor(Math.random() * TEAMS.length);
    let vIdx = Math.floor(Math.random() * TEAMS.length);
    if (vIdx === aIdx) vIdx = (vIdx + 1) % TEAMS.length;
    const attacker = TEAMS[aIdx], victim = TEAMS[vIdx];
    launchAttack(attacker, victim);
}

setInterval(periodicAttack, 1200);
setInterval(randomFixTick, 5200 + Math.random() * 3000);
for (let i = 0; i < 4; i++) setTimeout(periodicAttack, i * 300);

// Cleanup on unload
window.addEventListener('beforeunload', () => attacks.forEach(a => a.packetEl && a.packetEl.remove()));

// Ensure node DOM follows positions on resize/animation
function updateNodePositions() {
    TEAMS.forEach(t => {
        if (t.nodeEl) {
            t.nodeEl.style.left = t.x + 'px';
            t.nodeEl.style.top = t.y + 'px';
        }
    });
}
window.addEventListener('resize', updateNodePositions);
setInterval(updateNodePositions, 300);

/* ---------- TICK logic (20s) ---------- */
const TICK_INTERVAL_MS = 20000; // 20s
let tickNumber = 1;
let tickCountdown = Math.ceil(TICK_INTERVAL_MS / 1000); // seconds
let lastTickAt = Date.now();

countdownEl.textContent = tickCountdown.toString();
tickNumEl.textContent = `Tick: ${tickNumber}`;

// Every second update countdown display
const countdownTimer = setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastTickAt;
    const remainMs = Math.max(0, TICK_INTERVAL_MS - elapsed);
    const remainSec = Math.ceil(remainMs / 1000);
    countdownEl.textContent = String(remainSec).padStart(2, '0');

    if (remainMs <= 0) {
        // tick event
        onTick();
        lastTickAt = Date.now();
    }
}, 250); // 250ms gives smoother numbers

function onTick() {
    // increment tick number
    tickNumber++;
    tickNumEl.textContent = `Tick: ${tickNumber}`;

    // Apply temporary points to actual scores and ledgers
    TEAMS.forEach(t => {
        // Apply temporary ledger to actual ledger and score
        Object.keys(t.tempLedger).forEach(service => {
            const points = t.tempLedger[service];
            t.ledger[service] = (t.ledger[service] || 0) + points;
            t.score += points;
        });

        // Reset temporary ledger for next tick
        t.tempLedger = {};
    });

    // Log tick summary
    addLog({ name: 'SYSTEM', css: '' }, `<span style="opacity:0.95">--- TICK ${tickNumber} --- scoreboard actualizado</span>`);

    // Update scoreboard with new scores
    updateScores();

    // Log team summaries
    TEAMS.forEach(t => {
        const pos = Object.values(t.ledger).filter(v => v > 0).reduce((a, b) => a + b, 0);
        const neg = Object.values(t.ledger).filter(v => v < 0).reduce((a, b) => a + b, 0);
        addLog(t, `Resumen tick ${tickNumber}: +${pos} ${neg}`);
    });
}

// Also provide a manual trigger (optional) by clicking tickDisplay
document.getElementById('tickDisplay').addEventListener('click', () => {
    lastTickAt = Date.now() - TICK_INTERVAL_MS; // force immediate tick next loop
});