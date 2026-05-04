/**
 * ═══════════════════════════════════════════════════════════
 *  User Manager — Multi-User Access (10 Seats)
 *  Role-based access, session management, activity logging
 * ═══════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, 'activity_log.json');

const MAX_SEATS = 10;
const ROLES = ['owner', 'admin', 'editor', 'viewer'];
const ROLE_PERMISSIONS = {
  owner:  { manage_users: true, manage_settings: true, manage_billing: true, manage_campaigns: true, send_emails: true, view_data: true, export_data: true, manage_integrations: true },
  admin:  { manage_users: true, manage_settings: true, manage_billing: false, manage_campaigns: true, send_emails: true, view_data: true, export_data: true, manage_integrations: true },
  editor: { manage_users: false, manage_settings: false, manage_billing: false, manage_campaigns: true, send_emails: true, view_data: true, export_data: true, manage_integrations: false },
  viewer: { manage_users: false, manage_settings: false, manage_billing: false, manage_campaigns: false, send_emails: false, view_data: true, export_data: false, manage_integrations: false }
};

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return filePath.endsWith('settings.json') ? {} : []; }
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function initUserSystem() {
  [USERS_FILE, SESSIONS_FILE, ACTIVITY_LOG_FILE].forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8');
  });
  // Create default owner if no users exist
  const users = readJSON(USERS_FILE);
  if (users.length === 0) {
    users.push({
      id: 'usr_owner_' + Date.now(),
      email: 'admin@mailforge.local',
      name: 'Admin',
      role: 'owner',
      avatar: null,
      isActive: true,
      lastLogin: null,
      createdAt: new Date().toISOString()
    });
    writeJSON(USERS_FILE, users);
  }
}

// ─── USER CRUD ──────────────────────────────────────────────

function getUsers() { return readJSON(USERS_FILE); }
function getUser(id) { return getUsers().find(u => u.id === id); }
function getUserByEmail(email) { return getUsers().find(u => u.email === email); }

function createUser({ email, name, role }) {
  const users = getUsers();
  if (users.length >= MAX_SEATS) throw new Error(`Maximum ${MAX_SEATS} seats reached`);
  if (users.find(u => u.email === email)) throw new Error('User with this email already exists');
  if (!ROLES.includes(role)) throw new Error('Invalid role');

  const user = {
    id: 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    email, name, role,
    avatar: null,
    isActive: true,
    lastLogin: null,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeJSON(USERS_FILE, users);
  logActivity(user.id, 'user_created', { email, role });
  return user;
}

function updateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  const allowed = ['name', 'role', 'avatar', 'isActive'];
  for (const key of allowed) {
    if (updates[key] !== undefined) users[idx][key] = updates[key];
  }
  writeJSON(USERS_FILE, users);
  return users[idx];
}

function deleteUser(id) {
  let users = getUsers();
  const user = users.find(u => u.id === id);
  if (user?.role === 'owner') throw new Error('Cannot delete the owner');
  users = users.filter(u => u.id !== id);
  writeJSON(USERS_FILE, users);
  logActivity(id, 'user_deleted', {});
}

function getSeatInfo() {
  const users = getUsers();
  return {
    used: users.filter(u => u.isActive).length,
    total: MAX_SEATS,
    available: MAX_SEATS - users.filter(u => u.isActive).length,
    users: users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, lastLogin: u.lastLogin }))
  };
}

// ─── SESSION MANAGEMENT ─────────────────────────────────────

function createSession(userId) {
  const sessions = readJSON(SESSIONS_FILE);
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  sessions.push(session);
  // Cleanup expired
  const now = new Date().toISOString();
  const active = sessions.filter(s => s.expiresAt > now);
  writeJSON(SESSIONS_FILE, active);

  // Update last login
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) { users[idx].lastLogin = new Date().toISOString(); writeJSON(USERS_FILE, users); }

  return session;
}

function validateSession(token) {
  const sessions = readJSON(SESSIONS_FILE);
  const session = sessions.find(s => s.token === token && s.expiresAt > new Date().toISOString());
  if (!session) return null;
  return getUser(session.userId);
}

function destroySession(token) {
  let sessions = readJSON(SESSIONS_FILE);
  sessions = sessions.filter(s => s.token !== token);
  writeJSON(SESSIONS_FILE, sessions);
}

// ─── PERMISSIONS ────────────────────────────────────────────

function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  return ROLE_PERMISSIONS[user.role]?.[permission] === true;
}

function getUserPermissions(user) {
  if (!user || !user.role) return {};
  return ROLE_PERMISSIONS[user.role] || {};
}

// ─── ACTIVITY LOG ───────────────────────────────────────────

function logActivity(userId, action, details = {}) {
  const log = readJSON(ACTIVITY_LOG_FILE);
  log.unshift({
    id: 'act_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    userId, action, details,
    timestamp: new Date().toISOString()
  });
  if (log.length > 5000) log.length = 5000;
  writeJSON(ACTIVITY_LOG_FILE, log);
}

function getActivityLog(userId, limit = 50) {
  const log = readJSON(ACTIVITY_LOG_FILE);
  let filtered = userId ? log.filter(l => l.userId === userId) : log;
  return filtered.slice(0, limit);
}

module.exports = {
  initUserSystem, ROLES, ROLE_PERMISSIONS, MAX_SEATS,
  getUsers, getUser, getUserByEmail, createUser, updateUser, deleteUser, getSeatInfo,
  createSession, validateSession, destroySession,
  hasPermission, getUserPermissions,
  logActivity, getActivityLog
};
