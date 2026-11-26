/* ================================================================
   Раскопки Андрюшки — классический сапёр на 10×10.
   Чистый Vanilla JS: механика, дневник, звания и интерфейс.
   ================================================================ */

'use strict';

/* ---------- Константы ---------- */
const SIZE = 10;                       // сторона поля
const MINES = 10;                      // количество «какашек»
const CELL_COUNT = SIZE * SIZE;        // всего клеток
const STORAGE_KEY = 'andryushka-sapper-stats-v1';

// Соответствие находок и количеству какашек вокруг (1–8)
const ARTIFACTS = [
  { id: 1, name: 'Лопаточка',        note: 'совок археолога' },
  { id: 2, name: 'Кисточка',         note: 'для смахивания пыли' },
  { id: 3, name: 'Осколок вазы',     note: 'древней глиняной' },
  { id: 4, name: 'Древняя монета',   note: 'с загадочным знаком' },
  { id: 5, name: 'Лупа',             note: 'для мелочей' },
  { id: 6, name: 'Кость динозавра',  note: 'очень старая' },
  { id: 7, name: 'Древний свиток',   note: 'с тайнами' },
  { id: 8, name: 'Золотой идол',     note: 'главный клад' }
];

// Звания: нужно выполнить ОБА условия (побед И процент успеха)
const RANKS = [
  { name: 'Копарь',              wins: 0,   rate: 0  },
  { name: 'Землекоп-стажёр',     wins: 3,   rate: 30 },
  { name: 'Искатель черепков',   wins: 7,   rate: 40 },
  { name: 'Полевой лаборант',    wins: 15,  rate: 50 },
  { name: 'Младший археолог',    wins: 25,  rate: 60 },
  { name: 'Опытный шурфовщик',   wins: 40,  rate: 70 },
  { name: 'Начальник раскопа',   wins: 60,  rate: 80 },
  { name: 'Профессор древности', wins: 80,  rate: 90 },
  { name: 'Легенда экспедиций',  wins: 95,  rate: 95 },
  { name: 'Индиана Джонс',       wins: 100, rate: 99 }
];

const CONFETTI_COLORS = ['#e7b93f', '#8fae5e', '#d4774c', '#fff3d0', '#6fa9b8'];

/* ---------- DOM ---------- */
const el = {
  board:            document.getElementById('board'),
  modeSwitch:       document.getElementById('mode-switch'),
  modeButtons:      document.querySelectorAll('.mode-btn'),
  minesLeft:        document.getElementById('mines-left'),
  timer:            document.getElementById('timer'),
  portrait:         document.getElementById('portrait-btn'),
  heroUse:          document.getElementById('hero-use'),
  status:           document.getElementById('status-text'),
  legendList:       document.getElementById('legend-list'),
  newGameBtn:       document.getElementById('new-game-btn'),
  resetBtn:         document.getElementById('reset-btn'),

  statTotal:        document.getElementById('stat-total'),
  statWins:         document.getElementById('stat-wins'),
  statLosses:       document.getElementById('stat-losses'),
  statRate:         document.getElementById('stat-rate'),
  rankName:         document.getElementById('rank-name'),
  rankLevel:        document.getElementById('rank-level'),
  rankProgress:     document.getElementById('rank-progress-fill'),
  rankPercent:      document.getElementById('rank-progress-percent'),
  rankNext:         document.getElementById('rank-next'),
  rankProgressText: document.getElementById('rank-progress-text'),

  ranksModal:       document.getElementById('ranks-modal'),
  ranksSummary:     document.getElementById('ranks-summary'),
  rankTable:        document.getElementById('rank-table'),

  celebration:      document.getElementById('celebration'),
  celebrationClose: document.getElementById('celebration-close'),
  celebrationRank:  document.getElementById('celebration-rank'),
  celebrationText:  document.getElementById('celebration-text'),
  confetti:         document.getElementById('confetti'),
  toast:            document.getElementById('toast')
};

/* ---------- Состояние раскопа ---------- */
let cells = [];                 // { mine, adjacent, revealed, flagged }
let cellButtons = [];           // ссылки на кнопки полевые кнопки
let firstClick = true;          // какашки ещё не расставлены
let gameOver = false;
let won = false;
let revealedCount = 0;
let flagsPlaced = 0;
let seconds = 0;
let timerId = null;
let explodedIndex = -1;
let moodTimer = null;
let toastTimer = null;
let celebrationTimer = null;
let suppressClick = false;      // защита от клика после долгого нажатия на телефоне
let ignoreContextMenuUntil = 0; // мобильный браузер после долгого тапа шлёт ещё и contextmenu
let actionMode = 'dig';         // dig — копать, flag — ставить таблички
let touchTimer = null;          // таймер долгого нажатия (touchstart/touchend)
let touchIndex = null;
let touchStart = { x: 0, y: 0 };

/* ---------- Дневник ---------- */
let stats = loadStats();
let currentRankIndex = 0;

/* ================================================================
   Утилиты
   ================================================================ */

/** Русское склонение: 1 какашка, 2 какашки, 5 какашек. */
function plural(number, forms) {
  const mod100 = number % 100;
  const mod10 = number % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** Процент успеха без округления — используется для расчёта звания. */
function winRate(data) {
  return data.total > 0 ? (data.wins / data.total) * 100 : 0;
}

/** Красивый вывод процента: 66.7%, 100%. */
function formatRate(rate) {
  const value = (Math.round(rate * 10) / 10).toFixed(1);
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}

/** Самое высокое звание, для которого выполнены оба условия. */
function rankIndex(wins, rate) {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (wins >= rank.wins && rate >= rank.rate) index = i;
  });
  return index;
}

/** Соседние клетки (включая диагонали). */
function neighbors(index) {
  const x = index % SIZE;
  const y = Math.floor(index / SIZE);
  const result = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
        result.push(ny * SIZE + nx);
      }
    }
  }
  return result;
}

/** Таймер в формате мм:сс. */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const secondsLeft = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
}

/* ================================================================
   LOCALSTORAGE: загрузка и сохранение дневника
   ================================================================ */

function loadStats() {
  const empty = { total: 0, wins: 0, losses: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    const wins = Math.max(0, Math.floor(Number(data.wins) || 0));
    const losses = Math.max(0, Math.floor(Number(data.losses) || 0));
    const total = Math.max(wins + losses, Math.floor(Number(data.total) || 0));
    return { total, wins: Math.min(wins, total), losses: Math.min(losses, total) };
  } catch (error) {
    return empty; // приватный режим или повреждённые данные — начинаем с нуля
  }
}

function saveStats(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showToast('Не удалось сохранить дневник в этом браузере.');
  }
}

/* ================================================================
   Подготовка интерфейса
   ================================================================ */

/** Создаём 100 кнопок один раз и переиспользуем их при новых играх. */
function buildBoardDOM() {
  const fragment = document.createDocumentFragment();
  cellButtons = [];

  for (let i = 0; i < CELL_COUNT; i++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell closed';
    button.dataset.index = String(i);
    button.setAttribute('aria-label', `Клетка ${i + 1}: не вскопана`);
    fragment.appendChild(button);
    cellButtons.push(button);
  }
  el.board.appendChild(fragment);
}

/** Легенда строится из того же списка находок, что и подсказки в клетках. */
function buildLegend() {
  el.legendList.innerHTML = ARTIFACTS.map((artifact) => `
    <li class="legend-row">
      <svg class="legend-icon" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-${artifact.id}"></use></svg>
      <strong>${artifact.id} · ${artifact.name}</strong>
      <span>= ${artifact.id} ${plural(artifact.id, ['какашка', 'какашки', 'какашек'])} рядом</span>
    </li>
  `).join('');
}

/** Смена эмоции Андрюшки на портрете. */
function setMood(mood, autoReset = false) {
  el.heroUse.setAttribute('href', `#hero-${mood}`);
  el.portrait.classList.remove('mood-normal', 'mood-tense', 'mood-win', 'mood-lose');
  el.portrait.classList.add(`mood-${mood}`);

  clearTimeout(moodTimer);
  if (autoReset && !gameOver) {
    moodTimer = setTimeout(() => setMood('normal'), 900);
  }
}

function setStatus(text, kind = '') {
  el.status.textContent = text;
  el.status.className = `status-message${kind ? ` ${kind}` : ''}`;
}

function showToast(text) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2800);
}

/* ================================================================
   Игровая механика
   ================================================================ */

/** Полный сброс текущего поля (статистика не трогается). */
function resetGame(showMessage = true) {
  stopTimer();
  clearTimeout(moodTimer);

  cells = Array.from({ length: CELL_COUNT }, () => ({
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false
  }));

  firstClick = true;
  gameOver = false;
  won = false;
  revealedCount = 0;
  flagsPlaced = 0;
  seconds = 0;
  explodedIndex = -1;
  suppressClick = false;
  ignoreContextMenuUntil = 0;
  clearTouchPress();

  el.timer.textContent = '00:00';
  setMood('normal');
  if (showMessage) setStatus('Андрюшка: «Новый шурф! Первый удар всегда безопасен.»');
  renderBoard();
  updateHud();
}

/** Какашки появляются только после первого нажатия. */
function placeMines(safeIndex) {
  const safeZone = new Set([safeIndex, ...neighbors(safeIndex)]);
  const pool = [];

  for (let i = 0; i < CELL_COUNT; i++) {
    if (!safeZone.has(i)) pool.push(i);
  }

  // Перемешиваем, чтобы какашки попадали в разные места каждую игру
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  pool.slice(0, MINES).forEach((index) => { cells[index].mine = true; });

  cells.forEach((cell, index) => {
    if (!cell.mine) {
      cell.adjacent = neighbors(index).filter((n) => cells[n].mine).length;
    }
  });
}

/** Открыть шурф; вокруг пустой клетки — каскад. */
function reveal(index) {
  if (gameOver) return;
  const clicked = cells[index];
  if (clicked.revealed || clicked.flagged) return;

  if (firstClick) {
    firstClick = false;
    placeMines(index);
    startTimer();
  }

  setMood('tense', true);
  setStatus('Андрюшка: «Ой… лопатка дрожит. Что тут?»');

  const stack = [index];

  while (stack.length > 0) {
    const current = stack.pop();
    const cell = cells[current];

    if (cell.revealed || cell.flagged) continue;

    if (cell.mine) {
      finishGame(false, current);
      return;
    }

    cell.revealed = true;
    revealedCount++;

    // Ноль какашек вокруг — продолжаем копать соседние клетки
    if (cell.adjacent === 0) {
      neighbors(current).forEach((next) => {
        if (!cells[next].revealed && !cells[next].flagged && !cells[next].mine) {
          stack.push(next);
        }
      });
    }
  }

  renderBoard();
  updateHud();

  if (revealedCount === CELL_COUNT - MINES) {
    finishGame(true, -1);
  }
}

/** Поставить или убрать табличку «Опасно! Не копать». */
function toggleFlag(index) {
  if (gameOver) return;
  const cell = cells[index];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  flagsPlaced += cell.flagged ? 1 : -1;

  setMood('tense', true);
  setStatus(cell.flagged
    ? 'Андрюшка: «Поставил табличку: опасно, не копать!»'
    : 'Андрюшка: «Убрал табличку — рискнём?»');

  renderBoard();
  updateHud();
}

/** Конец раскопа: обновляем поле, эмоцию и дневник. */
function finishGame(isVictory, exploded) {
  gameOver = true;
  won = isVictory;
  explodedIndex = exploded;
  stopTimer();
  clearTouchPress();

  const previousRank = currentRankIndex;

  if (isVictory) {
    cells.forEach((cell) => { if (cell.mine) cell.revealed = true; });
    setMood('win');
    setStatus('Ура! Все находки собраны, Андрюшка надел пробковый шлем!', 'is-win');
  } else {
    cells.forEach((cell) => { if (cell.mine) cell.revealed = true; });
    setMood('lose');
    setStatus('Обвал! Андрюшка выкопал какашку — и срочно закрыл нос.', 'is-lose');
  }

  stats.total += 1;
  if (isVictory) stats.wins += 1;
  else stats.losses += 1;
  saveStats(stats);

  renderBoard();
  updateHud();
  updateDiary();

  if (currentRankIndex > previousRank) {
    showCelebration(currentRankIndex);
  }
}

/* ================================================================
   Отрисовка поля и верхней панели
   ================================================================ */

function renderBoard() {
  cells.forEach((_, index) => renderCell(index));
}

/** Одна клетка: дёрн, шурф, находка, какашка или табличка. */
function renderCell(index) {
  const cell = cells[index];
  const button = cellButtons[index];
  let className = 'cell';
  let content = '';
  let description = `Клетка ${index + 1}:`;

  if (cell.revealed && cell.mine) {
    className += ' open mine-shown';
    if (index === explodedIndex) className += ' mine-hit';
    content = '<span class="cell-content">💩</span>';
    description += ' какашка';
    if (index === explodedIndex) description += ' (здесь произошёл обвал)';
  } else if (cell.revealed && cell.adjacent > 0) {
    const artifact = ARTIFACTS[cell.adjacent - 1];
    className += ` open has-find n${cell.adjacent}`;
    content = `
      <span class="cell-content">
        <svg class="find-icon" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-${cell.adjacent}"></use></svg>
        <span class="pip"></span>
      </span>`;
    description += ` ${artifact.name}, ${cell.adjacent} ${plural(cell.adjacent, ['какашка', 'какашки', 'какашек'])} рядом`;
  } else if (cell.revealed) {
    className += ' open';
    description += ' пустой шурф';
  } else if (cell.flagged) {
    className += ' closed flagged';
    if (gameOver && !cell.mine) className += ' wrong-flag';
    content = `
      <span class="cell-content">
        <span class="flag-sign" aria-hidden="true"><span class="flag-board">⚠</span><span class="flag-post"></span></span>
      </span>`;
    description += ' табличка «Опасно! Не копать»';
    if (gameOver && !cell.mine) description += ' (ошибка: здесь нет какашки)';
  } else {
    className += ' closed';
    description += ' не вскопана';
  }

  button.className = className;
  button.innerHTML = content;
  button.title = cell.flagged && !cell.revealed ? 'Опасно! Не копать' : description;
  button.setAttribute('aria-label', description);
}

function updateHud() {
  const left = won ? 0 : MINES - flagsPlaced;
  el.minesLeft.textContent = String(left);
  el.minesLeft.parentElement.classList.toggle('is-danger', left < 0);
}

/* ================================================================
   Таймер
   ================================================================ */

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    seconds += 1;
    el.timer.textContent = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

/* ================================================================
   Дневник экспедиций и ранги
   ================================================================ */

function updateDiary() {
  const rate = winRate(stats);
  currentRankIndex = rankIndex(stats.wins, rate);
  const rank = RANKS[currentRankIndex];

  el.statTotal.textContent = String(stats.total);
  el.statWins.textContent = String(stats.wins);
  el.statLosses.textContent = String(stats.losses);
  el.statRate.textContent = `${formatRate(rate)}%`;

  el.rankName.textContent = rank.name;
  el.rankLevel.textContent = `Звание ${currentRankIndex + 1} из ${RANKS.length}`;

  // Шкала прогресса до следующего звания: учитываются оба условия сразу
  if (currentRankIndex === RANKS.length - 1) {
    el.rankProgress.style.width = '100%';
    el.rankPercent.textContent = '100%';
    el.rankNext.textContent = 'Высшее звание достигнуто!';
    el.rankProgressText.textContent = 'Индиана Джонс восхищается вами.';
  } else {
    const next = RANKS[currentRankIndex + 1];
    const needWins = Math.max(0, next.wins - stats.wins);
    const needRate = Math.max(0, next.rate - rate);
    const progress = Math.min(
      stats.wins / next.wins,
      rate / next.rate
    ) * 100;
    const safeProgress = Math.max(0, Math.min(100, progress));

    el.rankProgress.style.width = `${safeProgress}%`;
    el.rankPercent.textContent = `${Math.floor(safeProgress)}%`;
    el.rankNext.textContent = `Следующее: ${next.name}`;

    if (needWins === 0 && needRate === 0) {
      el.rankProgressText.textContent = 'Новое звание уже ближе, чем кажется!';
    } else if (needWins === 0) {
      el.rankProgressText.textContent = `Осталось ${formatRate(needRate)}% успеха`;
    } else if (needRate === 0) {
      el.rankProgressText.textContent = `Осталось ${needWins} ${plural(needWins, ['победа', 'победы', 'побед'])}`;
    } else {
      el.rankProgressText.textContent = `Ещё ${needWins} ${plural(needWins, ['победа', 'победы', 'побед'])} и ${formatRate(needRate)}% успеха`;
    }
  }

  renderRankTable();
}

/** Полная таблица из 10 званий с требованиями. */
function renderRankTable() {
  const rate = winRate(stats);
  el.ranksSummary.textContent = `Сейчас: ${RANKS[currentRankIndex].name} · ${stats.wins} ${plural(stats.wins, ['победа', 'победы', 'побед'])} · ${formatRate(rate)}% успеха`;

  el.rankTable.innerHTML = RANKS.map((rank, index) => {
    const unlocked = stats.wins >= rank.wins && rate >= rank.rate;
    const isCurrent = index === currentRankIndex;
    const status = isCurrent ? 'Ваше звание' : (unlocked ? 'Пройдено' : 'Пока недоступно');

    return `
      <div class="rank-row${isCurrent ? ' current' : ''}${unlocked ? '' : ' locked'}">
        <div class="rank-num">${index + 1}</div>
        <div>
          <div class="rank-title">${rank.name}</div>
          <div class="rank-req">от ${rank.wins} побед · от ${rank.rate}% успеха</div>
        </div>
        <div class="rank-status">${status}</div>
      </div>`;
  }).join('');
}

function openRanks() {
  renderRankTable();
  el.ranksModal.hidden = false;
}

function closeRanks() {
  el.ranksModal.hidden = true;
}

/* ================================================================
   Поздравление с повышением
   ================================================================ */

function showCelebration(index) {
  const rank = RANKS[index];
  el.celebrationRank.textContent = rank.name;
  el.celebrationText.textContent = index === RANKS.length - 1
    ? 'Андрюшка на вершине! Даже Индиана Джонс просит автограф.'
    : 'Андрюшка получил новый чин и теперь копает ещё усерднее!';

  el.confetti.innerHTML = Array.from({ length: 28 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = (Math.random() * 1.2).toFixed(2);
    const duration = (2.2 + Math.random() * 1.8).toFixed(2);
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return `<span style="left:${left}%;background:${color};animation-delay:${delay}s;animation-duration:${duration}s"></span>`;
  }).join('');

  el.celebration.hidden = false;
  clearTimeout(celebrationTimer);
  celebrationTimer = setTimeout(hideCelebration, 6500);
}

function hideCelebration() {
  el.celebration.hidden = true;
  clearTimeout(celebrationTimer);
}

/* ================================================================
   Режим действия и долгое нажатие (для сенсорных экранов)
   ================================================================ */

/** Сброс состояния долгого нажатия. */
function clearTouchPress() {
  clearTimeout(touchTimer);
  touchTimer = null;
  touchIndex = null;
}

/** Выбор действия по обычному нажатию: копать или ставить флажок. */
function setActionMode(mode) {
  actionMode = mode;
  el.modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

/** Touch-события: долгое удержание на закрытой клетке ставит/снимает флажок. */
function handleTouchStart(event) {
  if (event.touches.length !== 1) {
    clearTouchPress();
    return;
  }

  const button = event.target.closest('.cell');
  if (!button) return;

  const touch = event.touches[0];
  touchIndex = Number(button.dataset.index);
  touchStart = { x: touch.clientX, y: touch.clientY };

  clearTimeout(touchTimer);
  touchTimer = setTimeout(() => {
    if (touchIndex === null) return;
    toggleFlag(touchIndex);
    // Долгий тап уже поставил флажок — не даём контекстному меню снять его второй раз
    ignoreContextMenuUntil = Date.now() + 1500;
    if (typeof navigator.vibrate === 'function') navigator.vibrate(40);
    suppressClick = true; // чтобы после долгого тапа клетка не открылась
    setTimeout(() => { suppressClick = false; }, 700);
    clearTouchPress();
  }, 380);
}

function handleTouchMove(event) {
  if (touchTimer === null) return;
  const touch = event.touches[0];
  if (!touch) return;
  const distance = Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y);
  if (distance > 20) clearTouchPress(); // палец уехал — это прокрутка, не долгий тап
}

function setupEvents() {
  el.board.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const button = event.target.closest('.cell');
    if (!button) return;

    const index = Number(button.dataset.index);
    if (actionMode === 'flag') toggleFlag(index);
    else reveal(index);
  });

  // ПКМ на ПК всегда ставит/снимает флажок, независимо от выбранного режима
  el.board.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // запрещаем системное меню при долгом тапе

    // На телефоне после долгого удержания браузер сам шлёт contextmenu.
    // Флажок там уже поставлен таймером — пропускаем повторное срабатывание.
    if (Date.now() < ignoreContextMenuUntil) {
      ignoreContextMenuUntil = 0;
      return;
    }

    const button = event.target.closest('.cell');
    if (button) toggleFlag(Number(button.dataset.index));
  });

  // Клавиатура: Enter/Space копает (родное поведение кнопки), F — флаг
  el.board.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key !== 'f' && key !== 'ф') return;
    const button = event.target.closest('.cell');
    if (!button) return;
    event.preventDefault();
    toggleFlag(Number(button.dataset.index));
  });

  // Сенсорное управление: тап — выбранное действие, долгое нажатие — флажок
  el.board.addEventListener('touchstart', handleTouchStart, { passive: true });
  el.board.addEventListener('touchmove', handleTouchMove, { passive: true });
  el.board.addEventListener('touchend', clearTouchPress, { passive: true });
  el.board.addEventListener('touchcancel', clearTouchPress, { passive: true });

  el.modeButtons.forEach((button) => {
    button.addEventListener('click', () => setActionMode(button.dataset.mode));
  });

  el.portrait.addEventListener('click', () => resetGame());
  el.newGameBtn.addEventListener('click', () => resetGame());

  document.querySelectorAll('[data-open-ranks]').forEach((button) => {
    button.addEventListener('click', openRanks);
  });
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeRanks);
  });

  el.celebration.addEventListener('click', hideCelebration);
  el.celebrationClose.addEventListener('click', hideCelebration);

  el.resetBtn.addEventListener('click', () => {
    const agreed = confirm('Сбросить дневник экспедиций? Победы, обвалы и звание Андрюшки обнулятся.');
    if (!agreed) return;

    stats = { total: 0, wins: 0, losses: 0 };
    saveStats(stats);
    updateDiary();
    hideCelebration();
    showToast('Дневник очищен. Андрюшка снова начинает с звания «Копарь».');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeRanks();
    hideCelebration();
  });
}

/* ================================================================
   Запуск
   ================================================================ */
buildBoardDOM();
buildLegend();
updateDiary();
setActionMode(actionMode);
setupEvents();
resetGame(false);
