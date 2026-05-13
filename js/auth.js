// ============================================
// auth.js — 用户认证模块（注册 / 登录 / 登出）
// ============================================

import {
  userExists, saveUser, getUserPasswordHash,
  setCurrentUser, addLoginRecord, clearCurrentUser,
  getCurrentUser as _getCurrentUser,
} from './data.js';

function _hashPassword(password) {
  let hash = 0;
  for (const char of password) {
    hash = Math.imul(31, hash) + char.charCodeAt(0) | 0;
  }
  return Math.abs(hash).toString(16);
}

export function register(username, password) {
  username = username.trim();
  if (!username || !password)
    return { success: false, message: '用户名和密码不能为空' };
  if (username.length < 2 || username.length > 12)
    return { success: false, message: '用户名长度需在 2-12 个字符之间' };
  if (password.length < 4)
    return { success: false, message: '密码长度至少 4 个字符' };
  if (userExists(username))
    return { success: false, message: '用户名已存在' };

  saveUser(username, _hashPassword(password));
  return { success: true, message: '注册成功' };
}

export function login(username, password) {
  username = username.trim();
  if (!username || !password)
    return { success: false, message: '请输入用户名和密码' };

  const storedHash = getUserPasswordHash(username);
  if (!storedHash)
    return { success: false, message: '用户不存在' };
  if (storedHash !== _hashPassword(password))
    return { success: false, message: '密码错误' };

  setCurrentUser(username);
  addLoginRecord(username);
  return { success: true, message: '登录成功' };
}

export const logout        = clearCurrentUser;
export const getCurrentUser = _getCurrentUser;

export function isLoggedIn() {
  return _getCurrentUser() != null;
}
