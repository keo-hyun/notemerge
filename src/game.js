// src/game.js
import { Score } from "./score.js";
import { ensureAudio } from "./audio.js";

export function initGame() {
  document.addEventListener("pointerdown", () => ensureAudio(), { once: true });
  // Run the original game code after DOM is ready.
  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');

            let gameState = {
                balls: [],
                nextId: 0,
                dropLine: 150,
                score: 0,
                stageIndex: null,
                stageTitle: '',
                collected: {},
                nextNote: null,
                gameOver: false,
                stageComplete: false,
                animationId: null
            };

            const noteTypes = [
                // 🎵 음표 (파랑 계열: 길어질수록 진해짐)
                { id: 0, name: '16분음표', symbol: '♬', color: '#cfe9ff', size: 20, isRest: false },
                { id: 1, name: '8분음표',  symbol: '♪', color: '#9fd3ff', size: 25, isRest: false },
                { id: 2, name: '점8분음표', symbol: '♪.', color: '#9be7b1', size: 25, isRest: false },
                { id: 3, name: '4분음표',  symbol: '♩', color: '#4a90e2', size: 30, isRest: false },
                { id: 4, name: '점4분음표', symbol: '♩.', color: '#5cbf75', size: 30, isRest: false },
                { id: 5, name: '2분음표',  symbol: '𝅗𝅥', color: '#1f5fbf', size: 35, isRest: false },
                { id: 6, name: '점2분음표', symbol: '𝅗𝅥.', color: '#2e8b57', size: 35, isRest: false },
                { id: 7, name: '온음표',    symbol: '𝅝', color: '#0b3c8a', size: 40, isRest: false },

                // ⏸ 쉼표 (빨강 계열: 길어질수록 진해짐)
                { id: 8,  name: '16분쉼표', symbol: '', color: '#ffd6d6', size: 20, isRest: true, restType: '16th' },
                { id: 9,  name: '8분쉼표',  symbol: '', color: '#ffb3b3', size: 25, isRest: true, restType: '8th' },
                { id: 10, name: '점8분쉼표', symbol: '', color: '#ffb347', size: 25, isRest: true, restType: '8th-dot' },
                { id: 11, name: '4분쉼표',  symbol: '', color: '#ff6b6b', size: 30, isRest: true, restType: 'quarter' },
                { id: 12, name: '점4분쉼표', symbol: '', color: '#ff8c42', size: 30, isRest: true, restType: 'quarter-dot' },
                { id: 13, name: '2분쉼표',  symbol: '', color: '#d63031', size: 35, isRest: true, restType: 'half' },
                { id: 14, name: '점2분쉼표', symbol: '', color: '#e17055', size: 35, isRest: true, restType: 'half-dot' },
                { id: 15, name: '온쉼표',    symbol: '', color: '#8b0000', size: 40, isRest: true, restType: 'whole' }
            ];

            const mergeRules = {
                0: 1, 8: 9,
                1: 3, 9: 11,
                2: 4, 10: 12,
                3: 5, 11: 13,
                4: 6, 12: 14,
                5: 7, 13: 15
            };

            // 곡(스테이지) 목록 + 목표
            const stages = [
                {
                    title: '새싹의 노래',
                    goals: { 3: 13, 1: 22, 11: 2, 5: 1, 6: 1 }
                },
                {
                    title: '구슬비',
                    goals: { 12: 5, 3: 7, 1: 31, 9: 4 }
                },
                { title: '손치기 발치기', goals: null },
                { title: '남생아 놀아라', goals: null },
                { title: '작은 별', goals: null },
                { title: '도롱뇽', goals: null }
            ];

        

            // -------------------------
            // Spawn control
            // - dotted items drop only while needed
            // - rests stop dropping once ALL rest-goals are collected (if stage has rest goals)
            // - 8th note/rest can occasionally drop
            // -------------------------
            const DOTTED_NOTE_IDS = [2, 4, 6];      // 점8분/점4분/점2분 음표
            const DOTTED_REST_IDS = [10, 12, 14];   // 점8분/점4분/점2분 쉼표

            const BASE_NOTE_SEEDS = [0, 1];         // 16분음표, 8분음표
            const BASE_REST_SEEDS = [8, 9];         // 16분쉼표, 8분쉼표

            function stageGoals(){
                const stg = stages[gameState.stageIndex];
                return (stg && stg.goals) ? stg.goals : {};
            }

            function isGoalRemaining(typeId){
                const goals = stageGoals();
                if (!goals[typeId]) return false;
                const current = gameState.collected[typeId] || 0;
                return current < goals[typeId];
            }

            function shouldSpawnDottedNotes(){
                const goals = stageGoals();
                const hasAny = DOTTED_NOTE_IDS.some(id => goals[id]);
                if(!hasAny) return false;
                return DOTTED_NOTE_IDS.some(id => isGoalRemaining(id));
            }

            function shouldSpawnDottedRests(){
                const goals = stageGoals();
                const hasAny = DOTTED_REST_IDS.some(id => goals[id]);
                if(!hasAny) return false;
                return DOTTED_REST_IDS.some(id => isGoalRemaining(id));
            }

            function shouldSpawnRests(){
                const goals = stageGoals();
                // 스테이지에 쉼표 목표가 하나라도 있으면:
                // - "남아있는 쉼표 목표가 있을 때만" 쉼표 드롭 허용
                const restGoalIds = Object.keys(goals)
                    .map(k => Number(k))
                    .filter(id => noteTypes[id] && noteTypes[id].isRest);

                if(restGoalIds.length === 0){
                    // 쉼표 목표가 없다면(자유 모드 느낌): 기본적으로는 쉼표도 드롭 허용
                    return true;
                }

                // 쉼표 목표가 있다면, 하나라도 남아있을 때만 드롭
                return restGoalIds.some(id => isGoalRemaining(id));
            }

            function pickNextSpawnType(){
                // 스테이지 미선택(안전장치)
                if (gameState.stageIndex === null || gameState.stageIndex === undefined) {
                    const safe = [0, 1, 2, 8, 9, 10];
                    return safe[Math.floor(Math.random() * safe.length)];
                }

                // 가중치 풀(중복으로 확률 조정)
                // - 16분이 더 자주, 8분은 가끔
                const pool = [];

                // 🎵 기본 음표 시드
                pool.push(0,0,0,0, 1); // 16분 x4, 8분 x1

                // ⏸ 기본 쉼표 시드(목표가 남아있을 때만)
                if (shouldSpawnRests()) {
                    pool.push(8,8,8, 9); // 16분쉼표 x3, 8분쉼표 x1
                }

                // 🟢 점 계열(목표가 남아있을 때만)
                if (shouldSpawnDottedNotes()) pool.push(2);   // 점8분음표
                if (shouldSpawnDottedRests() && shouldSpawnRests()) pool.push(10);  // 점8분쉼표

                return pool[Math.floor(Math.random() * pool.length)];
            }


            function noteNameById(id){
                const n = noteTypes[Number(id)];
                return n ? n.name : `Type ${id}`;
            }

            function buildStageSelect(){
                const grid = document.getElementById('stageGrid');
                grid.innerHTML = '';

                stages.forEach((stg, idx) => {
                    const card = document.createElement('div');
                    card.className = 'stage-card';

                    const goals = stg.goals;
                    const pill = goals ? '플레이' : '준비중';

                    card.innerHTML = `
                        <div class="name">
                            <span>${stg.title}</span>
                            <span class="pill">${pill}</span>
                        </div>
                        <div class="goals-mini">
                            ${goals ? Object.entries(goals).slice(0,4).map(([k,v]) =>
                                `<span class="mini">${noteNameById(k)} ${v}개</span>`
                            ).join('') : `<span class="mini muted">목표 미정</span>`}
                        </div>
                    `;

                    if(goals){
                        card.addEventListener('click', () => startStage(idx));
                    } else {
                        card.addEventListener('click', () => alert('이 곡은 아직 목표가 준비되지 않았어요.'));
                    }

                    grid.appendChild(card);
                });
            }

            function openStageSelect(){
                if (gameState.animationId) cancelAnimationFrame(gameState.animationId);
                document.getElementById('gameScreen').classList.add('hidden');
                document.getElementById('stageSelectScreen').classList.remove('hidden');
                hideOverlay();
            }

            function startStage(stageIndex){
                const stg = stages[stageIndex];
                if(!stg || !stg.goals) return;

                gameState.stageIndex = stageIndex;
                gameState.stageTitle = stg.title;

                document.getElementById('stageSelectScreen').classList.add('hidden');
                document.getElementById('gameScreen').classList.remove('hidden');

                resetGame(true);
            }

            function drawRest(ctx, x, y, size, restType) {
                ctx.strokeStyle = '#2d3436';
                ctx.fillStyle = '#2d3436';
                ctx.lineWidth = 2;
                const scale = size / 25;

                switch(restType) {
                    case '16th':
                        ctx.beginPath();
                        ctx.moveTo(x + 5 * scale, y - 8 * scale);
                        ctx.lineTo(x + 5 * scale, y + 8 * scale);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(x + 5 * scale, y - 5 * scale);
                        ctx.bezierCurveTo(x + 10 * scale, y - 3 * scale, x + 8 * scale, y, x + 3 * scale, y + 2 * scale);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(x + 5 * scale, y);
                        ctx.bezierCurveTo(x + 10 * scale, y + 2 * scale, x + 8 * scale, y + 5 * scale, x + 3 * scale, y + 7 * scale);
                        ctx.stroke();
                        break;

                    case '8th':
                    case '8th-dot':
                        ctx.beginPath();
                        ctx.moveTo(x + 3 * scale, y - 6 * scale);
                        ctx.lineTo(x + 3 * scale, y + 6 * scale);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(x + 3 * scale, y - 3 * scale);
                        ctx.bezierCurveTo(x + 8 * scale, y - 1 * scale, x + 6 * scale, y + 3 * scale, x + 1 * scale, y + 5 * scale);
                        ctx.stroke();
                        if (restType === '8th-dot') {
                            ctx.beginPath();
                            ctx.arc(x + 8 * scale, y + 2 * scale, 1.5 * scale, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        break;

                    case 'quarter':
                    case 'quarter-dot':
                        ctx.beginPath();
                        ctx.moveTo(x - 4 * scale, y - 8 * scale);
                        ctx.lineTo(x + 2 * scale, y - 2 * scale);
                        ctx.lineTo(x - 2 * scale, y - 2 * scale);
                        ctx.lineTo(x + 4 * scale, y + 8 * scale);
                        ctx.lineTo(x - 2 * scale, y + 2 * scale);
                        ctx.lineTo(x + 2 * scale, y + 2 * scale);
                        ctx.closePath();
                        ctx.fill();
                        if (restType === 'quarter-dot') {
                            ctx.beginPath();
                            ctx.arc(x + 7 * scale, y + 4 * scale, 1.5 * scale, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        break;

                    case 'half':
                    case 'half-dot':
                        ctx.fillRect(x - 6 * scale, y - 8 * scale, 12 * scale, 3 * scale);
                        if (restType === 'half-dot') {
                            ctx.beginPath();
                            ctx.arc(x + 9 * scale, y - 6 * scale, 1.5 * scale, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        break;

                    case 'whole':
                        ctx.fillRect(x - 6 * scale, y + 5 * scale, 12 * scale, 3 * scale);
                        break;
                }
            }

            function updateUI() {
                document.getElementById('score').textContent = gameState.score;
                document.getElementById('stageTitle').textContent = gameState.stageTitle || '-';

                const nextNoteEl = document.getElementById('nextNote');
                if (gameState.nextNote !== null) {
                    const note = noteTypes[gameState.nextNote];
                    nextNoteEl.style.backgroundColor = note.color;
                    // ✅ '다음' 표시를 아이콘이 아니라 텍스트로
                    nextNoteEl.textContent = note.name; // 예: 16분음표, 8분음표, 16분쉼표, 점8분음표...
                }

                const goalsList = document.getElementById('goalsList');
                goalsList.innerHTML = '';

                const stg = stages[gameState.stageIndex];
                const goals = (stg && stg.goals) ? stg.goals : {};

                let total = 0;
                let done = 0;

                Object.entries(goals).forEach(([noteType, count]) => {
                    total += Number(count);
                    const note = noteTypes[Number(noteType)];
                    const current = gameState.collected[noteType] || 0;
                    done += Math.min(current, Number(count));

                    const isComplete = current >= count;
                    const item = document.createElement('div');
                    item.className = 'goal-item' + (isComplete ? ' complete' : '');
                    item.textContent = `${note.name} ${current}/${count}`;
                    goalsList.appendChild(item);
                });

                document.getElementById('goalProgressText').textContent = `${done}/${total}`;
            }

            function checkStageComplete() {
                if (gameState.gameOver) return;

                const stg = stages[gameState.stageIndex];
                const goals = (stg && stg.goals) ? stg.goals : {};
                const keys = Object.keys(goals);

                const isComplete = keys.length > 0 && keys.every(noteType =>
                    (gameState.collected[noteType] || 0) >= goals[noteType]
                );

                if (isComplete) {
                    gameState.stageComplete = true;
                    showOverlay('stageclear');
                }
            }

            function showOverlay(type) {
                const overlay = document.getElementById('overlay');
                overlay.style.display = 'flex';

                const stageName = gameState.stageTitle || '스테이지';

                if (type === 'gameover') {
                    overlay.innerHTML = `
                        <h2>게임 오버!</h2>
                        <p>최종 점수: ${gameState.score}점</p>
                        <p>${stageName} 도전 실패</p>
                        <div class="row">
                            <button onclick="resetGame()">다시 시작</button>
                            <button class="pick-stage" onclick="openStageSelect()">곡 선택</button>
                        </div>
                    `;
                } else if (type === 'stageclear') {
                    const nextIdx = (gameState.stageIndex ?? 0) + 1;
                    const hasNextPlayable = nextIdx < stages.length && stages[nextIdx].goals;

                    overlay.innerHTML = `
                        <h2>🎉 클리어! 🎉</h2>
                        <p>${stageName} 목표를 달성했어요!</p>
                        <div class="row">
                            <button class="next-stage" onclick="${hasNextPlayable ? 'startStage(' + nextIdx + ')' : 'openStageSelect()'}">
                                ${hasNextPlayable ? '다음 곡' : '곡 선택으로'}
                            </button>
                            <button onclick="resetGame()">같은 곡 다시</button>
                            <button class="pick-stage" onclick="openStageSelect()">곡 선택</button>
                        </div>
                    `;
                }
            }

            function hideOverlay() {
                document.getElementById('overlay').style.display = 'none';
            }

            function gameLoop() {
                const gravity = 0.3;
                const friction = 0.99;

                gameState.balls.forEach(ball => {
                    ball.vy += gravity;
                    ball.vy *= friction;
                    ball.vx *= friction;

                    ball.x += ball.vx;
                    ball.y += ball.vy;

                    if (ball.x - ball.radius < 0) {
                        ball.x = ball.radius;
                        ball.vx *= -0.8;
                    }
                    if (ball.x + ball.radius > canvas.width) {
                        ball.x = canvas.width - ball.radius;
                        ball.vx *= -0.8;
                    }
                    if (ball.y + ball.radius > canvas.height) {
                        ball.y = canvas.height - ball.radius;
                        ball.vy *= -0.8;
                        ball.vx *= 0.95;
                    }
                });
                // ✅ 수집 처리된(사라질 예정인) 풍선 제거
                const nowMs = Date.now();
                gameState.balls = gameState.balls.filter(b => !(b.vanishAt && nowMs >= b.vanishAt));


                for (let i = 0; i < gameState.balls.length; i++) {
                    for (let j = i + 1; j < gameState.balls.length; j++) {
                        const b1 = gameState.balls[i];
                        const b2 = gameState.balls[j];

                        // ✅ 머지 직후/사라질 예정인 풍선은 추가 충돌/머지에서 제외
                        const now = Date.now();
                        if (b1.vanishAt || b2.vanishAt) continue;
                        if (b1.justMergedAt && now - b1.justMergedAt < 180) continue;
                        if (b2.justMergedAt && now - b2.justMergedAt < 180) continue;


                        const dx = b2.x - b1.x;
                        const dy = b2.y - b1.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = b1.radius + b2.radius;

                        if (dist < minDist) {
                            if (b1.type === b2.type && mergeRules[b1.type] !== undefined) {
                                const newType = mergeRules[b1.type];
                                const newNote = noteTypes[newType];

                                const stg = stages[gameState.stageIndex];
                                const goals = (stg && stg.goals) ? stg.goals : {};

                                // ✅ 목표에 포함된 음표/쉼표가 만들어지면 "수집" 처리:
                                // - 목표 달성에 필요한 개수만큼은 카운트만 올리고 '변환된 모습'을 잠깐 보여준 뒤 사라짐
                                // - 목표를 이미 달성한 이후에는 캔버스에 남겨서 추가 머지(상위 음가 생성)에 사용할 수 있음
                                let collectedNow = false;
                                if (goals[newType]) {
                                    const current = gameState.collected[newType] || 0;
                                    const target = goals[newType];
                                    if (current < target) {
                                        gameState.collected[newType] = current + 1;
                                        collectedNow = true;
                                        try { Score.revealByType(noteTypes[newType].name); } catch(e) { console.error(e); }
                                    }
                                }

                                // ✅ (요청사항) 즉시 사라지는 대신, b1이 newType으로 '변환'된 모습을 보여준 뒤 사라지게
                                // - b2는 즉시 제거
                                // - b1은 newType으로 바꾸고, collectedNow이면 짧은 시간 후 제거
                                b1.type = newType;
                                b1.radius = newNote.size;
                                b1.vx = 0;
                                b1.vy = -2;
                                b1.merged = true;
                                b1.dropTime = Date.now();
                                b1.justMergedAt = Date.now();

                                if (collectedNow) {
                                    b1.vanishAt = Date.now() + 220; // 0.22s 후 사라짐
                                } else {
                                    delete b1.vanishAt;
                                }

                                // b2 제거
                                gameState.balls.splice(j, 1);

                                gameState.score += (newType + 1) * 10;
                                updateUI();
                                checkStageComplete();
                                break;
                            } else {
                                const angle = Math.atan2(dy, dx);
                                const sin = Math.sin(angle);
                                const cos = Math.cos(angle);

                                const vx1 = b1.vx * cos + b1.vy * sin;
                                const vy1 = b1.vy * cos - b1.vx * sin;
                                const vx2 = b2.vx * cos + b2.vy * sin;
                                const vy2 = b2.vy * cos - b2.vx * sin;

                                b1.vx = vx2 * cos - vy1 * sin;
                                b1.vy = vy1 * cos + vx2 * sin;
                                b2.vx = vx1 * cos - vy2 * sin;
                                b2.vy = vy2 * cos + vx1 * sin;

                                const overlap = minDist - dist;
                                b1.x -= overlap * cos * 0.5;
                                b1.y -= overlap * sin * 0.5;
                                b2.x += overlap * cos * 0.5;
                                b2.y += overlap * sin * 0.5;
                            }
                        }
                    }
                }

                if (gameState.balls.length > 0) {
                    const overLine = gameState.balls.some(ball => {
                        const isAboveLine = ball.y - ball.radius < gameState.dropLine;
                        const isSettled = Math.abs(ball.vy) < 0.3 && Math.abs(ball.vx) < 0.3;
                        const notJustDropped = Date.now() - ball.dropTime > 1000;
                        return isAboveLine && isSettled && notJustDropped;
                    });

                    if (overLine) {
                        gameState.gameOver = true;
                        showOverlay('gameover');
                    }
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#16213e');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.moveTo(0, gameState.dropLine);
                ctx.lineTo(canvas.width, gameState.dropLine);
                ctx.stroke();
                ctx.setLineDash([]);

                gameState.balls.forEach(ball => {
                    const note = noteTypes[ball.type];
                    if (!note) return;

                    const nowDraw = Date.now();
                    if (ball.vanishAt) {
                        const t = Math.max(0, Math.min(1, (ball.vanishAt - nowDraw) / 220));
                        ctx.globalAlpha = t;
                    } else {
                        ctx.globalAlpha = 1;
                    }

                    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                    ctx.shadowBlur = 10;
                    ctx.shadowOffsetY = 5;

                    ctx.fillStyle = note.color;
                    ctx.beginPath();
                    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.shadowColor = 'transparent';

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.fillStyle = '#2d3436';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    if (note.isRest) {
                        drawRest(ctx, ball.x, ball.y, ball.radius, note.restType);
                    } else {
                        ctx.font = `bold ${ball.radius * 1.2}px Arial`;
                        ctx.fillText(note.symbol, ball.x, ball.y);
                    }
                });

                if (!gameState.gameOver && !gameState.stageComplete) {
                    gameState.animationId = requestAnimationFrame(gameLoop);
                }
            }

            canvas.addEventListener('click', (e) => {
                if (gameState.gameOver || gameState.stageComplete || gameState.nextNote === null) return;

                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const note = noteTypes[gameState.nextNote];

                if (!note) return;

                gameState.balls.push({
                    id: gameState.nextId++,
                    x: Math.max(note.size, Math.min(x, canvas.width - note.size)),
                    y: 50,
                    vx: 0,
                    vy: 0,
                    type: gameState.nextNote,
                    radius: note.size,
                    merged: false,
                    dropTime: Date.now()
                });

                // v17 그대로: 16분음표 또는 16분쉼표만 랜덤 드롭
            
                // 다음 드롭 선택(점 계열은 목표가 남아있을 때만)
                gameState.nextNote = pickNextSpawnType();

                updateUI();
            });

            function resetGame(keepStage=true) {
                const stageIndex = keepStage ? gameState.stageIndex : null;
                const stageTitle = keepStage ? gameState.stageTitle : '';

                gameState = {
                    balls: [],
                    nextId: 0,
                    dropLine: 150,
                    score: 0,
                    stageIndex: stageIndex,
                    stageTitle: stageTitle,
                    collected: {},
                    nextNote: pickNextSpawnType(),
                    gameOver: false,
                    stageComplete: false,
                    animationId: null
                };

                hideOverlay();
                updateUI();
                gameLoop();
            }

            // init: build stage select, do not auto-start game
            window.addEventListener('load', () => {
                buildStageSelect();
                // 확실하게: 처음 진입 시에는 곡 선택 화면만 보이도록 강제
                document.getElementById('gameScreen').classList.add('hidden');
                document.getElementById('stageSelectScreen').classList.remove('hidden');
            });
  });
}
