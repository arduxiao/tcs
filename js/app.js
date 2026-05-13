// ============================================
// app.js — 视图路由与事件绑定
// type="module" 脚本默认 defer，无需 DOMContentLoaded 包裹
// ============================================

import * as Auth      from './auth.js';
import * as DataStore from './data.js';
import game           from './game.js';

// ---------- DOM 引用 ----------
const navbar        = document.getElementById('navbar');
const authOverlay   = document.getElementById('auth-overlay');
const viewGame      = document.getElementById('view-game');
const viewBoard     = document.getElementById('view-leaderboard');
const navBtns       = document.querySelectorAll('.nav-btn[data-view]');
const authForm      = document.getElementById('auth-form');
const authMsg       = document.getElementById('auth-msg');
const authSubmitBtn = document.getElementById('btn-auth-submit');
const authSubtitle  = document.getElementById('auth-subtitle');
const authSwitch    = document.getElementById('auth-switch');
const inputUser     = document.getElementById('input-username');
const inputPass     = document.getElementById('input-password');
const scoreValue    = document.getElementById('score-value');
const btnStart      = document.getElementById('btn-start');
const btnPause      = document.getElementById('btn-pause');
const btnLogout     = document.getElementById('btn-logout');
const navUsername   = document.getElementById('nav-username');

let isLoginMode = true;

// ---------- 视图切换 ----------
function showView(name) {
  viewGame.classList.remove('active');
  viewBoard.classList.remove('active');
  navBtns.forEach(b => b.classList.remove('active'));

  if (name === 'auth') {
    viewGame.classList.add('active');
    authOverlay.classList.remove('hidden');
    navbar.classList.remove('visible');
    game.init('game-canvas', {});
    game.startDemo('game-canvas');
  } else if (name === 'game') {
    authOverlay.classList.add('hidden');
    game.stopDemo();
    viewGame.classList.add('active');
    navbar.classList.add('visible');
    document.querySelector('[data-view="game"]').classList.add('active');
  } else if (name === 'leaderboard') {
    authOverlay.classList.add('hidden');
    viewBoard.classList.add('active');
    navbar.classList.add('visible');
    document.querySelector('[data-view="leaderboard"]').classList.add('active');
    renderLeaderboard();
  }
}

// ---------- 登录/注册 UI ----------
function updateAuthUI() {
  authSubmitBtn.textContent = isLoginMode ? '登 录' : '注 册';
  authSubtitle.textContent  = isLoginMode ? '登录后开始游戏' : '创建账号开始游戏';
  authSwitch.innerHTML      = isLoginMode
    ? '还没有账号？<a id="auth-toggle">立即注册</a>'
    : '已有账号？<a id="auth-toggle">去登录</a>';
}

// 事件委托：一个永久监听器，不再每次点击后重新绑定（修复原代码内存泄漏 bug）
authSwitch.addEventListener('click', (e) => {
  if (e.target.id !== 'auth-toggle') return;
  isLoginMode = !isLoginMode;
  authMsg.textContent = '';
  authMsg.className   = 'auth-msg';
  updateAuthUI();
});

// ---------- 表单提交 ----------
authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = inputUser.value;
  const password = inputPass.value;

  let result = isLoginMode
    ? Auth.login(username, password)
    : Auth.register(username, password);

  if (!isLoginMode && result.success) {
    result = Auth.login(username, password);
  }

  authMsg.textContent = result.message;
  authMsg.className   = `auth-msg ${result.success ? 'success' : 'error'}`;

  if (result.success) enterGame();
});

// ---------- 进入游戏 ----------
function enterGame() {
  navUsername.textContent = `👤 ${Auth.getCurrentUser()}`;
  game.stopDemo();
  showView('game');
  game.init('game-canvas', {
    onScoreUpdate: (s) => { scoreValue.textContent = s; },
    onGameOver:    ()  => { btnStart.textContent = '🔄 再来一局'; },
  });
}

// ---------- 导航 ----------
navBtns.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

// ---------- 游戏按钮 ----------
btnStart.addEventListener('click', () => {
  game.start();
  btnStart.textContent = '🔄 重新开始';
  btnPause.textContent = '⏸ 暂停';
});

btnPause.addEventListener('click', () => {
  btnPause.textContent = game.pause() ? '▶ 继续' : '⏸ 暂停';
});

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    game.setDifficulty(btn.dataset.diff);
  });
});

// ---------- 登出 ----------
btnLogout.addEventListener('click', () => {
  Auth.logout();
  game.stop();
  inputUser.value     = '';
  inputPass.value     = '';
  authMsg.textContent = '';
  authMsg.className   = 'auth-msg';
  isLoginMode = true;
  updateAuthUI();
  showView('auth');
});

// ---------- 排行榜渲染 ----------
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function renderLeaderboard() {
  const user = Auth.getCurrentUser();

  // 全局排行
  const board   = DataStore.getLeaderboard();
  const isEmpty = board.length === 0;
  document.getElementById('hint-global').style.display = isEmpty ? 'block' : 'none';
  document.getElementById('table-global').querySelector('thead').style.display = isEmpty ? 'none' : '';
  document.getElementById('tbody-global').innerHTML = board.map((r, i) => {
    const rankCls = ['gold', 'silver', 'bronze'][i] ?? '';
    return `<tr>
      <td class="rank ${rankCls}">${i + 1}</td>
      <td>${esc(r.username)}</td>
      <td class="score-cell">${r.score}</td>
      <td>${r.date}</td>
    </tr>`;
  }).join('');

  // 个人记录
  const records  = DataStore.getUserRecords(user);
  const isEmptyP = records.length === 0;
  document.getElementById('hint-personal').style.display = isEmptyP ? 'block' : 'none';
  document.getElementById('table-personal').querySelector('thead').style.display = isEmptyP ? 'none' : '';
  document.getElementById('tbody-personal').innerHTML = records.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td class="score-cell">${r.score}</td>
    <td>${r.duration}秒</td>
    <td>${r.formatted}</td>
  </tr>`).join('');

  // 登录历史
  const logins   = DataStore.getLoginHistory(user);
  const isEmptyL = logins.length === 0;
  document.getElementById('hint-logins').style.display = isEmptyL ? 'block' : 'none';
  document.getElementById('table-logins').querySelector('thead').style.display = isEmptyL ? 'none' : '';
  document.getElementById('tbody-logins').innerHTML = [...logins].reverse().map((l, i) => `<tr>
    <td>${i + 1}</td>
    <td>${l.formatted}</td>
  </tr>`).join('');
}

// ---------- 启动 ----------
if (Auth.isLoggedIn()) {
  enterGame();
} else {
  showView('auth');
}
