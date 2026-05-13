// ============================================
// data.js — 数据存取层（localStorage 封装）
// ============================================

const KEYS = Object.freeze({
  USERS:         'snake_users',
  CURRENT_USER:  'snake_current',
  GAME_RECORDS:  'snake_records',
  LOGIN_HISTORY: 'snake_logins',
});

function _get(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function _set(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- 用户管理 ----------
export function getUsers() {
  return _get(KEYS.USERS) ?? {};
}

export function saveUser(username, passwordHash) {
  const users = getUsers();
  users[username] = { passwordHash, createdAt: Date.now() };
  _set(KEYS.USERS, users);
}

export function userExists(username) {
  return username in getUsers();
}

export function getUserPasswordHash(username) {
  return getUsers()[username]?.passwordHash ?? null;
}

// ---------- 会话管理 ----------
export function setCurrentUser(username) {
  _set(KEYS.CURRENT_USER, username);
}

export function getCurrentUser() {
  return _get(KEYS.CURRENT_USER);
}

export function clearCurrentUser() {
  localStorage.removeItem(KEYS.CURRENT_USER);
}

// ---------- 登录历史 ----------
export function addLoginRecord(username) {
  const history = _get(KEYS.LOGIN_HISTORY) ?? {};
  history[username] ??= [];
  history[username].push({
    time:      Date.now(),
    formatted: new Date().toLocaleString('zh-CN'),
  });
  _set(KEYS.LOGIN_HISTORY, history);
}

export function getLoginHistory(username) {
  return (_get(KEYS.LOGIN_HISTORY) ?? {})[username] ?? [];
}

// ---------- 游戏记录 ----------
export function saveGameRecord(username, score, duration) {
  const records = _get(KEYS.GAME_RECORDS) ?? {};
  records[username] ??= [];
  records[username].push({
    score,
    duration,
    date:      Date.now(),
    formatted: new Date().toLocaleString('zh-CN'),
  });
  _set(KEYS.GAME_RECORDS, records);
}

export function getUserRecords(username) {
  return ((_get(KEYS.GAME_RECORDS) ?? {})[username] ?? [])
    .sort((a, b) => b.date - a.date);
}

export function getLeaderboard() {
  const records = _get(KEYS.GAME_RECORDS) ?? {};
  return Object.entries(records)
    .filter(([, list]) => list.length > 0)
    .map(([username, list]) => {
      const best = list.reduce((a, b) => a.score >= b.score ? a : b);
      return { username, score: best.score, date: best.formatted };
    })
    .sort((a, b) => b.score - a.score);
}
