const SPREADSHEET_ID         = "1nWuu8US7L0EPMMGsSFzuBEeSlkOL4YPAM7CGPk0T6wA";
const SHEET_NAME             = "Data";
const ATTACHMENTS_SHEET_NAME = "Attachments";
const DRIVE_ROOT_FOLDER_NAME = "RW01 Uploads";
const ADMIN_PASSWORD_DEFAULT = "123456";   // fallback only; prefer Script Properties
const SESSION_TTL_SECS       = 3600;       // 1-hour session token

// Phone / ID columns (1-based sheet col index) — force text storage
const PHONE_COLS_1BASED = [7, 9, 27, 50, 107, 109, 111, 117, 132];

const ALLOWED_MIME_TYPES = [
  'image/jpeg','image/jpg','image/png','image/gif',
  'image/webp','image/heic','image/heif','image/bmp'
];
const SECTION_TYPES = [
  'officer_found','person_portrait','items_evidence',
  'appearance_photo',
  'source_profile_71','source_post_71','source_other_71',
  'source_profile_72','source_post_72','source_other_72'
];
const SECTION_MAX = {
  officer_found: 2, person_portrait: 1, items_evidence: 10,
  appearance_photo: 3,
  source_profile_71: 1, source_post_71: 3, source_other_71: 3,
  source_profile_72: 1, source_post_72: 3, source_other_72: 3
};

const USERS_SHEET_NAME = 'Users';
const AUDIT_SHEET_NAME = 'AuditLog';
const PERMISSIONS = {
  viewer:      ['view_dashboard', 'view_records'],
  report:      ['view_dashboard', 'view_records', 'export_records'],
  operator:    ['view_dashboard', 'view_records', 'create_record', 'upload_attachment'],
  admin:       ['view_dashboard', 'view_records', 'create_record', 'upload_attachment',
                'edit_record', 'delete_record', 'export_records', 'manage_attachments',
                'view_audit'],
  super_admin: ['view_dashboard', 'view_records', 'create_record', 'upload_attachment',
                'edit_record', 'delete_record', 'export_records', 'manage_attachments',
                'manage_users', 'manage_system', 'view_audit']
};

// ===== HTTP ENTRY POINTS =====

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || '';
  var result;
  try {
    if (action === 'amphures') {
      result = getAmphures(parseInt(params.provinceId));
    } else if (action === 'tambons') {
      result = getTambons(parseInt(params.amphureId));
    } else {
      result = { error: 'Unknown GET action. Admin endpoints now use POST.' };
    }
  } catch(err) {
    result = { error: err.toString() };
  }
  return makeResponse(result);
}

function doPost(e) {
  var result;
  try {
    var data   = JSON.parse(e.postData.contents);
    var action = data.action || '';
    var token  = data.token  || '';
    if      (action === 'loginUser')   result = loginUser(data.username || '', data.password || '');
    else if (action === 'login')       result = { success: false, message: 'ช่องทางนี้ไม่รองรับแล้ว กรุณาใช้ loginUser' };
    else if (action === 'logout')      result = logoutAdmin(token);
    else if (action === 'dashboard')   result = getDashboardData(token);
    else if (action === 'submit') {
      if (!hasPermission(token, 'create_record')) result = { success: false, message: 'ต้องเข้าสู่ระบบก่อนบันทึกข้อมูล' };
      else result = submitData(data);
    }
    else if (action === 'update') {
      if (!hasPermission(token, 'edit_record')) result = { success: false, message: 'ไม่มีสิทธิ์แก้ไขข้อมูล' };
      else result = updateData(parseInt(data.sheetRow), data, token);
    }
    else if (action === 'delete') {
      if (!hasPermission(token, 'delete_record')) result = { success: false, message: 'ไม่มีสิทธิ์ลบข้อมูล' };
      else result = deleteData(parseInt(data.sheetRow), token);
    }
    else if (action === 'uploadAttachment') {
      if (!hasPermission(token, 'upload_attachment')) result = { success: false, message: 'ต้องเข้าสู่ระบบก่อนอัปโหลดรูป' };
      else result = uploadAttachment(data);
    }
    else if (action === 'listAttachments')   result = listAttachments(data.recordId, token);
    else if (action === 'getAttachmentData') result = getAttachmentData(data.attachmentId, token);
    else if (action === 'deleteAttachment') {
      if (!hasPermission(token, 'manage_attachments')) result = { success: false, message: 'ไม่มีสิทธิ์ลบไฟล์แนบ' };
      else result = deleteAttachmentRecord(data.attachmentId, token);
    }
    else if (action === 'cleanupTestRecords')  result = cleanupTestRecords(data.recordIds || [], token);
    else if (action === 'listExportAttachments') result = listExportAttachments(data, token);
    else if (action === 'checkDuplicate')      result = checkDuplicate(data, token);
    else if (action === 'checkDuplicatePublic') result = checkDuplicatePublic(data);
    else if (action === 'listUsers')           result = listUsers(token);
    else if (action === 'createUser')          result = createUser(data, token);
    else if (action === 'updateUser')          result = updateUser(data, token);
    else if (action === 'resetUserPassword')   result = resetUserPassword(data, token);
    else if (action === 'initUserSystem')      result = { success: false, message: 'Initialization endpoint disabled' };
    else if (action === 'initMetadataColumns') {
      if (!hasPermission(token, 'manage_system')) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = initMetadataColumns();
    }
    else if (action === 'initAddressColumns') {
      if (!hasPermission(token, 'manage_system')) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = initAddressColumns();
    }
    else if (action === 'initNewFormColumns') {
      if (!hasPermission(token, 'manage_system')) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = initNewFormColumns();
    }
    else if (action === 'initRecordIdCounter') {
      if (!hasPermission(token, 'manage_system')) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = initRecordIdCounter();
    }
    else if (action === 'findDuplicateRecordIds') {
      if (!hasPermission(token, 'manage_system')) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = findDuplicateRecordIds();
    }
    else if (action === 'listRecentRevisions') {
      if (!validateSession(token)) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = listRecentRevisions();
    }
    else if (action === 'exportRevisionRows') {
      if (!validateSession(token)) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = exportRevisionRows(data.revisionId || '', parseInt(data.minRecordId || '420'));
    }
    else if (action === 'listAuditLogs') {
      if (!hasPermission(token, 'view_audit')) result = { success: false, message: 'ไม่มีสิทธิ์ดูประวัติการใช้งาน' };
      else result = listAuditLogs(data, token);
    }
    else if (action === 'auditExport') {
      if (!validateSession(token)) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = auditExport(data, token);
    }
    else if (action === 'initAuditLog') {
      if (!hasPermission(token, 'manage_system')) result = { success: false, message: 'ไม่มีสิทธิ์' };
      else result = initAuditLog();
    }
    else result = { success: false, message: 'Unknown action: ' + action };
  } catch(err) {
    result = { success: false, message: err.toString() };
  }
  return makeResponse(result);
}

function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== AUTHENTICATION =====

function hashPassword(password, salt) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ':' + password,
    Utilities.Charset.UTF_8
  );
  return raw.map(function(b) {
    var hex = (b < 0 ? b + 256 : b).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '');
}

function getOrCreateUsersSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    var headers = ['UserID','Username','PasswordHash','Salt','DisplayName','Role','Active','LastLoginAt','CreatedAt','UpdatedAt'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAdminPassword() {
  try {
    var p = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
    return p || ADMIN_PASSWORD_DEFAULT;
  } catch(e) { return ADMIN_PASSWORD_DEFAULT; }
}

// New user-based login with username + hashed password
function loginUser(username, password) {
  if (!username || !password) return { success: false, message: 'ต้องระบุชื่อผู้ใช้และรหัสผ่าน' };
  // Rate limit: max 10 failed attempts per username per 10 minutes
  var _rl    = CacheService.getScriptCache();
  var _rlKey = 'loginrl_' + username.toLowerCase().substring(0, 30);
  var _fails = parseInt(_rl.get(_rlKey) || '0');
  if (_fails >= 10) {
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่ภายหลัง' };
  }
  var sheet   = getOrCreateUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, message: 'ยังไม่มีบัญชีผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลระบบ' };
  var vals    = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  var userRow = null;
  var rowIdx  = -1;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][1]).toLowerCase() === String(username).toLowerCase()) {
      userRow = vals[i]; rowIdx = i + 2; break;
    }
  }
  if (!userRow) {
    _rl.put(_rlKey, String(_fails + 1), 600);
    writeAuditLog({ action: 'LOGIN_FAILED', username: username, status: 'FAILED', metadata: { reason: 'user_not_found' } });
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }
  if (!userRow[6]) {
    _rl.put(_rlKey, String(_fails + 1), 600);
    writeAuditLog({ action: 'LOGIN_FAILED', username: username, userId: String(userRow[0]), displayName: String(userRow[4]), role: String(userRow[5]), status: 'FAILED', metadata: { reason: 'account_disabled' } });
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }
  var expectedHash = hashPassword(password, String(userRow[3]));
  if (expectedHash !== String(userRow[2])) {
    _rl.put(_rlKey, String(_fails + 1), 600);
    writeAuditLog({ action: 'LOGIN_FAILED', username: username, userId: String(userRow[0]), displayName: String(userRow[4]), role: String(userRow[5]), status: 'FAILED', metadata: { reason: 'wrong_password' } });
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  try { _rl.remove(_rlKey); } catch(ex) {}
  var token   = Utilities.getUuid();
  var session = { userId: String(userRow[0]), role: String(userRow[5]), displayName: String(userRow[4]), username: String(userRow[1]) };
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify(session), SESSION_TTL_SECS);
  try { CacheService.getScriptCache().remove('rolerev_' + session.userId); } catch(ex) {}
  writeAuditLog({ action: 'LOGIN_SUCCESS', token: token, userId: String(userRow[0]), username: String(userRow[1]), displayName: String(userRow[4]), role: String(userRow[5]), status: 'SUCCESS' });

  var now = new Date().toISOString();
  sheet.getRange(rowIdx, 8).setValue(now);
  sheet.getRange(rowIdx, 10).setValue(now);

  var dash = {};
  if ((PERMISSIONS[session.role] || []).indexOf('view_dashboard') !== -1) {
    dash = getDashboardDataInternal();
  }
  dash.success     = true;
  dash.token       = token;
  dash.expiresIn   = SESSION_TTL_SECS;
  dash.user        = { userId: session.userId, role: session.role, displayName: session.displayName };
  dash.permissions = PERMISSIONS[session.role] || [];
  return dash;
}

// Legacy password-only login (kept for backward compatibility during transition)
function loginAdmin(password) {
  if (password !== getAdminPassword()) {
    return { success: false, message: 'รหัสผ่านไม่ถูกต้อง!' };
  }
  var token   = Utilities.getUuid();
  var session = { userId: 'legacy', role: 'admin', displayName: 'Admin' };
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify(session), SESSION_TTL_SECS);
  var dash = getDashboardDataInternal();
  dash.success     = true;
  dash.token       = token;
  dash.expiresIn   = SESSION_TTL_SECS;
  dash.user        = session;
  dash.permissions = PERMISSIONS['admin'];
  return dash;
}

function logoutAdmin(token) {
  if (token) {
    try { CacheService.getScriptCache().remove('sess_' + token); } catch(e) {}
  }
  return { success: true, message: 'ออกจากระบบแล้ว' };
}

// Returns {userId, role, displayName} or null
function getSession(token) {
  if (!token) return null;
  try {
    var raw = CacheService.getScriptCache().get('sess_' + token);
    if (!raw) return null;
    // Legacy '1' value from old loginAdmin (backward compat)
    if (raw === '1') return { userId: 'legacy', role: 'admin', displayName: 'Admin' };
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function validateSession(token) {
  var session = getSession(token);
  if (!session) return false;
  try { if (CacheService.getScriptCache().get('deact_' + session.userId)) return false; } catch(ex) {}
  try {
    var _rv = CacheService.getScriptCache().get('rolerev_' + session.userId);
    if (_rv !== null && _rv !== session.role) return false;
  } catch(ex) {}
  return true;
}

function hasPermission(token, permission) {
  var session = getSession(token);
  if (!session) return false;
  try { if (CacheService.getScriptCache().get('deact_' + session.userId)) return false; } catch(ex) {}
  try {
    var _rv = CacheService.getScriptCache().get('rolerev_' + session.userId);
    if (_rv !== null && _rv !== session.role) return false;
  } catch(ex) {}
  var perms = PERMISSIONS[session.role] || [];
  return perms.indexOf(permission) !== -1;
}

// ===== USER MANAGEMENT =====

function listUsers(token) {
  if (!hasPermission(token, 'manage_users')) return { success: false, message: 'ไม่มีสิทธิ์' };
  var sheet = getOrCreateUsersSheet();
  if (sheet.getLastRow() <= 1) return { success: true, users: [] };
  var vals  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  var users = vals.map(function(r) {
    return { userId: r[0], username: r[1], displayName: r[4], role: r[5], active: !!r[6], lastLoginAt: r[7], createdAt: r[8] };
  });
  return { success: true, users: users };
}

function createUser(data, token) {
  if (!hasPermission(token, 'manage_users')) return { success: false, message: 'ไม่มีสิทธิ์' };
  if (!data.username || !data.password || !data.role) return { success: false, message: 'ข้อมูลไม่ครบ: username, password, role' };
  if (!PERMISSIONS[data.role]) return { success: false, message: 'role ไม่ถูกต้อง: ' + data.role };
  var sheet   = getOrCreateUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).toLowerCase() === String(data.username).toLowerCase()) {
        return { success: false, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
      }
    }
  }
  var salt        = generateSalt();
  var hash        = hashPassword(data.password, salt);
  var userId      = 'USR-' + Date.now();
  var now         = new Date().toISOString();
  var displayName = data.displayName || data.username;
  sheet.appendRow([userId, data.username, hash, salt, displayName, data.role, true, '', now, now]);
  writeAuditLog({ action: 'USER_CREATE', token: token, target: userId, metadata: { username: data.username, role: data.role, displayName: displayName }, status: 'SUCCESS' });
  return { success: true, userId: userId, message: 'สร้างบัญชีผู้ใช้ "' + data.username + '" สำเร็จ' };
}

function updateUser(data, token) {
  if (!hasPermission(token, 'manage_users')) return { success: false, message: 'ไม่มีสิทธิ์' };
  if (!data.userId) return { success: false, message: 'ต้องระบุ userId' };
  var sheet   = getOrCreateUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, message: 'ไม่พบผู้ใช้' };
  var vals = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(data.userId)) {
      var isSA           = String(vals[i][5]) === 'super_admin';
      var willDowngrade  = data.role !== undefined && PERMISSIONS[data.role] && data.role !== 'super_admin';
      var willDeactivate = data.active !== undefined && !data.active;
      if (isSA && (willDowngrade || willDeactivate)) {
        var remainingSA = 0;
        for (var j = 0; j < vals.length; j++) {
          if (j === i) continue;
          if (String(vals[j][5]) === 'super_admin' && !!vals[j][6]) remainingSA++;
        }
        if (remainingSA === 0) {
          return { success: false, message: 'ไม่สามารถดำเนินการได้: ต้องมี super_admin ที่ active อย่างน้อย 1 คนในระบบ' };
        }
      }
      var rowNum = i + 2;
      var now    = new Date().toISOString();
      if (data.displayName !== undefined) sheet.getRange(rowNum, 5).setValue(data.displayName);
      if (data.role !== undefined && PERMISSIONS[data.role]) {
        sheet.getRange(rowNum, 6).setValue(data.role);
        try { CacheService.getScriptCache().put('rolerev_' + String(data.userId), data.role, SESSION_TTL_SECS); } catch(ex) {}
      }
      if (data.active !== undefined) sheet.getRange(rowNum, 7).setValue(!!data.active);
      sheet.getRange(rowNum, 10).setValue(now);
      if (willDeactivate) {
        try { CacheService.getScriptCache().put('deact_' + String(data.userId), '1', SESSION_TTL_SECS); } catch(ex) {}
      }
      var uAction = data.role !== undefined ? 'USER_ROLE_CHANGE'
                  : (data.active !== undefined ? (data.active ? 'USER_ACTIVATE' : 'USER_DEACTIVATE')
                  : 'USER_UPDATE');
      writeAuditLog({ action: uAction, token: token, target: data.userId, metadata: { displayName: data.displayName, role: data.role, active: data.active }, status: 'SUCCESS' });
      return { success: true, message: 'อัปเดตผู้ใช้สำเร็จ' };
    }
  }
  return { success: false, message: 'ไม่พบ userId: ' + data.userId };
}

function resetUserPassword(data, token) {
  if (!hasPermission(token, 'manage_users')) return { success: false, message: 'ไม่มีสิทธิ์' };
  if (!data.userId || !data.newPassword) return { success: false, message: 'ต้องระบุ userId และ newPassword' };
  var sheet   = getOrCreateUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, message: 'ไม่พบผู้ใช้' };
  var vals = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(data.userId)) {
      var rowNum = i + 2;
      var salt   = generateSalt();
      var hash   = hashPassword(data.newPassword, salt);
      var now    = new Date().toISOString();
      sheet.getRange(rowNum, 3).setValue(hash);
      sheet.getRange(rowNum, 4).setValue(salt);
      sheet.getRange(rowNum, 10).setValue(now);
      writeAuditLog({ action: 'USER_PASSWORD_RESET', token: token, target: data.userId, status: 'SUCCESS' });
      return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
    }
  }
  return { success: false, message: 'ไม่พบ userId: ' + data.userId };
}

// Run once from GAS Editor after setting Script Properties:
//   INITIAL_SUPERADMIN_USERNAME  and  INITIAL_SUPERADMIN_PASSWORD
function initUserSystem() {
  var props    = PropertiesService.getScriptProperties();
  var username = props.getProperty('INITIAL_SUPERADMIN_USERNAME');
  var password = props.getProperty('INITIAL_SUPERADMIN_PASSWORD');
  if (!username || !password) {
    return { success: false, message: 'กรุณาตั้งค่า Script Properties: INITIAL_SUPERADMIN_USERNAME และ INITIAL_SUPERADMIN_PASSWORD ก่อน' };
  }
  var sheet   = getOrCreateUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).toLowerCase() === String(username).toLowerCase()) {
        return { success: false, message: 'ผู้ใช้ "' + username + '" มีอยู่แล้วในระบบ' };
      }
    }
  }
  var salt   = generateSalt();
  var hash   = hashPassword(password, salt);
  var userId = 'USR-SA-' + Date.now();
  var now    = new Date().toISOString();
  sheet.appendRow([userId, username, hash, salt, username, 'super_admin', true, '', now, now]);
  return { success: true, userId: userId, message: 'สร้างบัญชี super_admin "' + username + '" สำเร็จ กรุณาล็อกอินได้เลย' };
}

// ===== DASHBOARD =====

function getDashboardData(token) {
  if (!validateSession(token)) return { success: false, message: 'Session หมดอายุ กรุณาล็อกอินใหม่' };
  var dash = getDashboardDataInternal();
  dash.success = true;
  return dash;
}

function getDashboardDataInternal() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var raw   = sheet.getDataRange().getDisplayValues();
  if (raw.length <= 1) return { total: 0, allData: [], attachmentCounts: {} };
  var rows = raw.slice(1).map(function(rowData, i) {
    return { sheetRow: i + 2, seqNo: i + 1, data: rowData };
  }).reverse();
  return {
    total:            rows.length,
    allData:          rows,
    attachmentCounts: getBatchAttachmentCounts()
  };
}

function getBatchAttachmentCounts() {
  var attSheet = getOrCreateAttachmentsSheet();
  if (attSheet.getLastRow() <= 1) return {};
  var vals = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 9).getValues();
  var counts = {};
  vals.forEach(function(r) {
    if (r[8] === 'deleted') return;
    var recId = String(r[1]);
    var sec   = r[2];
    if (!counts[recId]) counts[recId] = {
      officer_found: 0, person_portrait: 0, items_evidence: 0,
      appearance_photo: 0,
      source_profile_71: 0, source_post_71: 0, source_other_71: 0,
      source_profile_72: 0, source_post_72: 0, source_other_72: 0,
      total: 0
    };
    if (sec in counts[recId]) counts[recId][sec]++;
    counts[recId].total++;
  });
  return counts;
}

// ===== RECORD ID ALLOCATION (concurrency-safe) =====

/**
 * Allocates the next unique RecordID using LockService + PropertiesService.
 * Prevents race conditions when two users submit simultaneously.
 * Uses an atomic counter; also guards against pre-existing sheet collisions.
 */
function allocateNextRecordId() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000); // wait up to 15 seconds for the lock
  try {
    var props = PropertiesService.getScriptProperties();
    var stored = props.getProperty('NEXT_REC_ID');
    var nextId;

    if (!stored) {
      // Counter not yet initialized — scan sheet for max existing ID
      var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
      var lastRow = sheet.getLastRow();
      var maxId = 0;
      if (lastRow > 1) {
        var col1 = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        col1.forEach(function(r) {
          var v = parseInt(r[0]);
          if (!isNaN(v) && v > maxId) maxId = v;
        });
      }
      nextId = maxId + 1;
    } else {
      nextId = parseInt(stored);
    }

    // Uniqueness guard: skip if this ID already exists (handles legacy gaps/duplicates)
    var sheet2 = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    var lr2 = sheet2.getLastRow();
    if (lr2 > 1) {
      var existingIds = sheet2.getRange(2, 1, lr2 - 1, 1).getValues();
      var idSet = {};
      existingIds.forEach(function(r) { idSet[String(r[0])] = true; });
      while (idSet[String(nextId)]) { nextId++; }
    }

    // Persist the counter one step ahead
    props.setProperty('NEXT_REC_ID', String(nextId + 1));
    return nextId;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Initialize the PropertiesService counter from the current sheet max ID.
 * Run once after deployment, or call via initRecordIdCounter API action.
 */
function initRecordIdCounter() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    var lastRow = sheet.getLastRow();
    var maxId = 0;
    if (lastRow > 1) {
      var col1 = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      col1.forEach(function(r) {
        var v = parseInt(r[0]);
        if (!isNaN(v) && v > maxId) maxId = v;
      });
    }
    var nextId = maxId + 1;
    PropertiesService.getScriptProperties().setProperty('NEXT_REC_ID', String(nextId));
    return { success: true, message: 'Counter initialized. maxId=' + maxId + ', NEXT_REC_ID=' + nextId };
  } finally {
    lock.releaseLock();
  }
}

// ===== CORE DATA FUNCTIONS =====

function submitData(formObject) {
  try {
    var sheet    = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    var recordId = allocateNextRecordId(); // concurrency-safe atomic allocation
    var newRow   = buildDataRow(recordId, formObject, null);
    sheet.appendRow(newRow);
    var newRowNum = sheet.getLastRow();
    rewritePhoneCells(sheet, newRowNum, newRow);
    writeAuditLog({ action: 'CREATE_RECORD', token: formObject.token || '', recordId: String(recordId), status: 'SUCCESS' });
    return { success: true, recordId: recordId, message: 'บันทึกข้อมูลสำเร็จ!' };
  } catch(e) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.toString() };
  }
}

function updateData(sheetRowNum, formObject, token) {
  if (!hasPermission(token, 'edit_record')) return { success: false, message: 'ไม่มีสิทธิ์แก้ไขข้อมูล!' };
  try {
    var sheet        = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    var existingId   = sheet.getRange(sheetRowNum, 1).getValue();
    var lastCol      = Math.max(152, sheet.getLastColumn());
    var existingVals = sheet.getRange(sheetRowNum, 1, 1, lastCol).getValues()[0];
    var updatedRow   = buildDataRow(existingId, formObject, existingVals);

    // Collect field-level diff before overwrite
    var auditEntries = [{ action: 'UPDATE_RECORD', token: token, recordId: String(existingId), status: 'SUCCESS' }];
    var skipIdx      = { 0: true, 61: true, 62: true }; // RecordID, CreatedAt, UpdatedAt
    for (var fi = 0; fi < updatedRow.length; fi++) {
      if (skipIdx[fi]) continue;
      var fl = FIELD_LABEL_MAP[fi] || ('col' + (fi + 1));
      var ov = String(existingVals[fi] !== null && existingVals[fi] !== undefined ? existingVals[fi] : '').replace(/^'/, '');
      var nv = String(updatedRow[fi] !== null && updatedRow[fi] !== undefined ? updatedRow[fi] : '');
      if (ov === nv) continue;
      auditEntries.push({
        action: 'UPDATE_FIELD', token: token, recordId: String(existingId),
        target: fl,
        oldVal: fi === 6 ? '[SENSITIVE]' : ov,
        newVal: fi === 6 ? '[SENSITIVE]' : nv,
        status: 'SUCCESS'
      });
    }

    sheet.getRange(sheetRowNum, 1, 1, updatedRow.length).setValues([updatedRow]);
    rewritePhoneCells(sheet, sheetRowNum, updatedRow);
    batchWriteAuditLogs(auditEntries);
    return { success: true, message: 'แก้ไขข้อมูลสำเร็จ!' };
  } catch(e) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.toString() };
  }
}

function deleteData(sheetRowNum, token) {
  if (!hasPermission(token, 'delete_record')) return { success: false, message: 'ไม่มีสิทธิ์ลบข้อมูล!' };
  try {
    var sheet    = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    var recId    = String(sheet.getRange(sheetRowNum, 1).getValue());
    // Cascade soft-delete attachments
    cascadeDeleteAttachments(recId);
    sheet.deleteRow(sheetRowNum);
    writeAuditLog({ action: 'DELETE_RECORD', token: token, recordId: recId, status: 'SUCCESS' });
    return { success: true, message: 'ลบข้อมูลสำเร็จ!' };
  } catch(e) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.toString() };
  }
}

function cascadeDeleteAttachments(recordId) {
  var attSheet = getOrCreateAttachmentsSheet();
  if (attSheet.getLastRow() <= 1) return;
  var vals = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 12).getValues();
  var now  = new Date().toISOString();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][1]) === String(recordId) && vals[i][8] !== 'deleted') {
      attSheet.getRange(i + 2, 9).setValue('deleted');
      attSheet.getRange(i + 2, 11).setValue(now);
      attSheet.getRange(i + 2, 12).setValue(now);
      try { DriveApp.getFileById(vals[i][3]).setTrashed(true); } catch(e) {}
    }
  }
}

/**
 * Build the 61-element data row.
 * existingVals: current row from getValues() — used on update to preserve cols not in formObject.
 */
function buildDataRow(recordId, f, existingVals) {
  function col(key, existingIdx) {
    if (f[key] !== undefined && f[key] !== null) {
      // Strip leading apostrophe if frontend still sends it (backward compat)
      var v = String(f[key]);
      return v.replace(/^'/, '');
    }
    if (existingVals && existingIdx !== undefined) {
      var ev = existingVals[existingIdx];
      if (ev === null || ev === undefined) return '';
      return String(ev).replace(/^'/, '');
    }
    return '';
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss");
  // Preserve CreatedAt on update; blank for legacy records with no existing value
  var createdAt = existingVals ? (existingVals[61] || '') : now;
  var updatedAt = now; // always set to current time on any write

  return [
    recordId,
    col('col2'),  col('col3'),  col('col4'),  col('col5'),
    col('col6'),  col('col7'),  col('col8'),  col('col9'),
    col('col10'), col('col11'), col('col12'), col('col13'),
    col('col14'), col('col15'), col('col16'), col('col17'),
    col('col18'), col('col19'), col('col20'), col('col21'),
    col('col22'), col('col23'), col('col24'), col('col25'),
    col('col26'), col('col27'), col('col28'), col('col29'),
    col('col30'), col('col31'), col('col32'), col('col33'),
    col('col34'), col('col35'), col('col36'), col('col37'),
    col('col38'), col('col39'), col('col40'), col('col41'),
    col('col42', 41), col('col43', 42), col('col44', 43), col('col45', 44),
    col('col46', 45), col('col47', 46), col('col48', 47), col('col49', 48),
    col('col50', 49), col('col51', 50), col('col52', 51), col('col53', 52),
    col('col54', 53), col('col55', 54), col('col56', 55), col('col57', 56),
    col('col58', 57), col('col59', 58), col('col60', 59), col('col61', 60),
    createdAt,  // col62 — set once on create, preserved on update
    updatedAt,  // col63 — updated on every write
    // Structured address groups col64-col93 (appended; old free-text cols 8/38/23 preserved via existingVals)
    // A: ที่อยู่ปัจจุบัน
    col('col64', 63),  col('col65', 64),  col('col66', 65),  col('col67', 66),
    col('col68', 67),  col('col69', 68),  col('col70', 69),  col('col71', 70),
    // B: ที่อยู่ภูมิลำเนา
    col('col72', 71),  col('col73', 72),  col('col74', 73),  col('col75', 74),
    col('col76', 75),  col('col77', 76),  col('col78', 77),  col('col79', 78),
    // C: สถานที่เกิดเรื่อง extra (province/district/subdistrict reuse col39/40/41)
    col('col80', 79),  col('col81', 80),  col('col82', 81),  col('col83', 82),  col('col84', 83),
    // D: สถานที่พักใน กทม
    col('col85', 84),  col('col86', 85),  col('col87', 86),  col('col88', 87),
    col('col89', 88),  col('col90', 89),  col('col91', 90),  col('col92', 91),  col('col93', 92),
    // Section 2 extension
    col('col94',  93),  // found_officer_position
    // Section 3 extension
    col('col95',  94),  // carry_method_detail
    col('col96',  95),  // container_width_cm
    col('col97',  96),  // container_length_cm
    col('col98',  97),  // container_source
    col('col99',  98),  // envelope_width_cm
    col('col100', 99),  // envelope_length_cm
    col('col101',100),  // envelope_source
    // Section 4 extension
    col('col102',101),  // education
    col('col103',102),  // institution
    col('col104',103),  // occupation
    col('col105',104),  // income
    col('col106',105),  // father_name
    col('col107',106),  // father_phone
    col('col108',107),  // mother_name
    col('col109',108),  // mother_phone
    col('col110',109),  // guardian_name
    col('col111',110),  // guardian_phone
    // Section 5 extension
    col('col112',111),  // visited_royal_count
    // Section 6 extension
    col('col113',112),  // petition_case_type
    // Section 7.1 — ทราบเรื่องการถวายฎีกาจากที่ใด
    col('col114',113),  // source71_person_name
    col('col115',114),  // source71_person_age
    col('col116',115),  // source71_person_idcard
    col('col117',116),  // source71_person_phone
    col('col118',117),  // source71_person_education
    col('col119',118),  // source71_person_institution
    col('col120',119),  // source71_person_occupation
    col('col121',120),  // source71_person_income
    col('col122',121),  // source71_platform_type
    col('col123',122),  // source71_platform_url
    col('col124',123),  // source71_platform_name
    col('col125',124),  // source71_platform_followers
    col('col126',125),  // source71_post_url
    col('col127',126),  // source71_post_date
    col('col128',127),  // source71_other_detail
    // Section 7.2 — ทราบจากที่ใดว่าจะมีขบวนเสด็จ
    col('col129',128),  // source72_person_name
    col('col130',129),  // source72_person_age
    col('col131',130),  // source72_person_idcard
    col('col132',131),  // source72_person_phone
    col('col133',132),  // source72_person_education
    col('col134',133),  // source72_person_institution
    col('col135',134),  // source72_person_occupation
    col('col136',135),  // source72_person_income
    col('col137',136),  // source72_platform_type
    col('col138',137),  // source72_platform_url
    col('col139',138),  // source72_platform_name
    col('col140',139),  // source72_platform_followers
    col('col141',140),  // source72_post_url
    col('col142',141),  // source72_post_date
    col('col143',142),  // source72_other_detail
    // Section 7.4 — เคยมายื่นถวายฎีกาที่พระบรมมหาราชวัง
    col('col144',143),  // palace_visit_count
    col('col145',144),  // palace_visit_date1
    col('col146',145),  // palace_visit_date2
    col('col147',146),  // palace_visit_date3
    col('col148',147),  // palace_visit_date4
    col('col149',148),  // doc_submit_status
    col('col150',149),  // doc_submit_date
    col('col151',150),  // doc_submit_detail
    // Section 7.9
    col('col152',151)   // after_petition_destination
  ];
}

/**
 * After writing a row, overwrite phone/ID cells with explicit text format.
 * This prevents Google Sheets from converting "0891234567" → 891234567.
 */
function rewritePhoneCells(sheet, rowNum, rowData) {
  PHONE_COLS_1BASED.forEach(function(c) {
    if (c <= rowData.length) {
      var val = String(rowData[c - 1] || '').replace(/^'/, '').trim();
      sheet.getRange(rowNum, c).setNumberFormat('@').setValue(val);
    }
  });
}

// ===== ATTACHMENT FUNCTIONS =====

function uploadAttachment(data) {
  if (!data.recordId || !data.section || !data.fileData || !data.fileName || !data.mimeType) {
    return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
  }
  if (SECTION_TYPES.indexOf(data.section) === -1) {
    return { success: false, message: 'section ไม่ถูกต้อง: ' + data.section };
  }
  var mime = data.mimeType.toLowerCase().split(';')[0].trim();
  if (ALLOWED_MIME_TYPES.indexOf(mime) === -1) {
    return { success: false, message: 'ไม่รองรับไฟล์ประเภท: ' + mime };
  }

  // Verify RecordID exists
  var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, message: 'ไม่พบข้อมูล Record' };
  var col1Vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var recExists = col1Vals.some(function(r) { return String(r[0]) === String(data.recordId); });
  if (!recExists) return { success: false, message: 'ไม่พบ RecordID: ' + data.recordId };

  // Check section count limit
  var attSheet  = getOrCreateAttachmentsSheet();
  var attLastRow = attSheet.getLastRow();
  var activeCount = 0;
  if (attLastRow > 1) {
    var attVals = attSheet.getRange(2, 1, attLastRow - 1, 9).getValues();
    attVals.forEach(function(r) {
      if (String(r[1]) === String(data.recordId) && r[2] === data.section && r[8] === 'active') activeCount++;
    });
  }
  var maxAllowed = SECTION_MAX[data.section];
  if (activeCount >= maxAllowed) {
    return { success: false, message: 'เกินจำนวนสูงสุด ' + maxAllowed + ' ไฟล์ สำหรับ ' + data.section };
  }

  try {
    var folder   = getOrCreateSectionFolder(data.recordId, data.section);
    var safeName = sanitizeFileName(data.fileName);
    var decoded  = Utilities.base64Decode(data.fileData);
    var blob     = Utilities.newBlob(decoded, mime, safeName);
    var file     = folder.createFile(blob);
    var fileId   = file.getId();

    var now          = new Date().toISOString();
    var sortOrder    = activeCount + 1;
    var attachmentId = 'ATT-' + data.recordId + '-' + data.section + '-' + Date.now();
    attSheet.appendRow([
      attachmentId, data.recordId, data.section, fileId, safeName,
      mime, data.sizeBytes || 0, sortOrder, 'active', now, now, ''
    ]);
    touchRecordUpdatedAt(data.recordId);
    writeAuditLog({ action: 'UPLOAD_ATTACHMENT', token: data.token || '', recordId: String(data.recordId), target: data.section, metadata: { fileName: safeName, attachmentId: attachmentId }, status: 'SUCCESS' });
    return { success: true, attachmentId: attachmentId, driveFileId: fileId, message: 'อัปโหลดสำเร็จ' };
  } catch(e) {
    return { success: false, message: 'อัปโหลดล้มเหลว: ' + e.toString() };
  }
}

function listAttachments(recordId, token) {
  if (!validateSession(token)) return { success: false, message: 'ไม่มีสิทธิ์' };
  if (!recordId) return { success: false, message: 'ต้องระบุ recordId' };
  var attSheet = getOrCreateAttachmentsSheet();
  if (attSheet.getLastRow() <= 1) return { success: true, attachments: [] };
  var vals = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 12).getValues();
  var result = [];
  vals.forEach(function(r) {
    if (String(r[1]) === String(recordId) && r[8] !== 'deleted') {
      result.push({
        attachmentId: r[0], recordId: r[1], section: r[2], driveFileId: r[3],
        fileName: r[4], mimeType: r[5], sizeBytes: r[6], sortOrder: r[7],
        status: r[8], uploadedAt: r[9]
      });
    }
  });
  result.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
  return { success: true, attachments: result };
}

function getAttachmentData(attachmentId, token) {
  if (!validateSession(token)) return { success: false, message: 'ไม่มีสิทธิ์' };
  if (!attachmentId) return { success: false, message: 'ต้องระบุ attachmentId' };
  var attSheet = getOrCreateAttachmentsSheet();
  if (attSheet.getLastRow() <= 1) return { success: false, message: 'ไม่พบไฟล์' };
  var vals = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 12).getValues();
  var att  = null;
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === attachmentId && vals[i][8] !== 'deleted') { att = vals[i]; break; }
  }
  if (!att) return { success: false, message: 'ไม่พบ attachment: ' + attachmentId };
  try {
    var file     = DriveApp.getFileById(att[3]);
    var bytes    = file.getBlob().getBytes();
    var base64   = Utilities.base64Encode(bytes);
    return { success: true, base64: base64, mimeType: att[5], fileName: att[4] };
  } catch(e) {
    return { success: false, message: 'ไม่สามารถโหลดไฟล์ได้: ' + e.toString() };
  }
}

function deleteAttachmentRecord(attachmentId, token) {
  if (!validateSession(token)) return { success: false, message: 'ไม่มีสิทธิ์' };
  if (!attachmentId) return { success: false, message: 'ต้องระบุ attachmentId' };
  var attSheet = getOrCreateAttachmentsSheet();
  if (attSheet.getLastRow() <= 1) return { success: false, message: 'ไม่พบข้อมูล' };
  var vals = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 12).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === attachmentId) {
      var rowNum  = i + 2;
      var fileId  = vals[i][3];
      var now     = new Date().toISOString();
      attSheet.getRange(rowNum, 9).setValue('deleted');
      attSheet.getRange(rowNum, 11).setValue(now);
      attSheet.getRange(rowNum, 12).setValue(now);
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
      touchRecordUpdatedAt(vals[i][1]); // vals[i][1] = RecordID
      writeAuditLog({ action: 'DELETE_ATTACHMENT', token: token, recordId: String(vals[i][1]), target: attachmentId, metadata: { fileName: String(vals[i][4]) }, status: 'SUCCESS' });
      return { success: true, message: 'ลบไฟล์สำเร็จ (soft delete)' };
    }
  }
  return { success: false, message: 'ไม่พบ attachmentId: ' + attachmentId };
}

// ===== PDF EXPORT ATTACHMENT LOADER =====

function listExportAttachments(data, token) {
  if (!hasPermission(token, 'export_records')) {
    return { success: false, message: 'ไม่มีสิทธิ์ export PDF' };
  }
  var recordId = String(data.recordId || '');
  if (!recordId) return { success: false, message: 'ต้องระบุ recordId' };
  var attSheet = getOrCreateAttachmentsSheet();
  var result   = {};
  if (attSheet.getLastRow() <= 1) return { success: true, attachments: {} };
  var vals = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 12).getValues();
  vals.forEach(function(r) {
    if (String(r[1]) !== recordId) return;
    if (String(r[8]) === 'deleted') return;
    var section = String(r[2]);
    if (!result[section]) result[section] = [];
    try {
      var file  = DriveApp.getFileById(String(r[3]));
      var bytes = file.getBlob().getBytes();
      result[section].push({
        fileName: String(r[4]),
        mimeType: String(r[5]),
        base64:   Utilities.base64Encode(bytes)
      });
    } catch(e) { /* skip inaccessible files */ }
  });
  return { success: true, attachments: result };
}

// ===== TEST RECORD CLEANUP (cascade) =====

function cleanupTestRecords(recordIds, token) {
  if (!validateSession(token)) return { success: false, message: 'ไม่มีสิทธิ์' };
  if (!recordIds || !recordIds.length) return { success: false, message: 'ต้องระบุ recordIds' };

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var idList = recordIds.map(String);

  // Find target rows + verify they exist
  var raw    = sheet.getDataRange().getValues();
  var toDelete = [];
  for (var i = 1; i < raw.length; i++) {
    var recId = String(raw[i][0]);
    if (idList.indexOf(recId) === -1) continue;
    toDelete.push({ sheetRow: i + 1, recordId: recId, col4: String(raw[i][3] || ''), col5: String(raw[i][4] || '') });
  }

  if (!toDelete.length) return { success: true, deleted: [], message: 'ไม่พบ record ที่ระบุ' };

  // Sort descending by sheetRow (delete from bottom to avoid shifting)
  toDelete.sort(function(a, b) { return b.sheetRow - a.sheetRow; });

  var results = [];
  toDelete.forEach(function(item) {
    cascadeDeleteAttachments(item.recordId);
    sheet.deleteRow(item.sheetRow);
    results.push({ recordId: item.recordId, name: (item.col4 + ' ' + item.col5).trim(), deleted: true });
  });

  return { success: true, deleted: results, message: 'ลบ ' + results.length + ' record แล้ว' };
}

// ===== DRIVE HELPERS =====

function getOrCreateRootFolder() {
  var folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
}

function getOrCreateSectionFolder(recordId, sectionType) {
  var root         = getOrCreateRootFolder();
  var recordName   = String(recordId);
  var rf           = root.getFoldersByName(recordName);
  var recordFolder = rf.hasNext() ? rf.next() : root.createFolder(recordName);
  var sf           = recordFolder.getFoldersByName(sectionType);
  return sf.hasNext() ? sf.next() : recordFolder.createFolder(sectionType);
}

function getOrCreateAttachmentsSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(ATTACHMENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ATTACHMENTS_SHEET_NAME);
    var headers = [
      'AttachmentID','RecordID','Section','DriveFileID','FileName',
      'MimeType','SizeBytes','SortOrder','Status','UploadedAt','UpdatedAt','DeletedAt'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sanitizeFileName(name) {
  return (name || 'file').replace(/[^\w.\-ก-๙]/g, '_').substring(0, 100);
}

// ===== PHONE / TEXT MIGRATION (run once from editor) =====

/**
 * Sets phone/ID columns to Plain Text format and strips stray leading apostrophes.
 * Run once from the Apps Script editor after deploying.
 */
function setPhoneColumnsAsText() {
  var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, message: 'No data rows to migrate' };
  var fixed = 0;
  PHONE_COLS_1BASED.forEach(function(colIdx) {
    var range = sheet.getRange(2, colIdx, lastRow - 1, 1);
    range.setNumberFormat('@');
    var vals = range.getValues();
    var newVals = vals.map(function(row) {
      return [String(row[0] || '').replace(/^'/, '').trim()];
    });
    range.setValues(newVals);
    fixed++;
  });
  SpreadsheetApp.flush();
  return { success: true, message: 'Formatted ' + fixed + ' phone/ID columns as text. Rows: ' + (lastRow - 1) };
}

// ===== ONE-TIME SETUP HELPERS (run manually from editor) =====

function initNewColumnHeaders() {
  var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var lastCol = sheet.getLastColumn();
  if (lastCol >= 61) return { success: true, message: 'Headers already present (lastCol=' + lastCol + ')' };
  var newHeaders = [
    'notice_status','notice_detail','found_location_type','found_location_detail',
    'found_date','found_time','found_officer_rank','found_officer_name','found_officer_phone',
    'handover_date','handover_time','item_visibility','item_hidden_detail',
    'carry_methods','container_types','envelope_status','envelope_size',
    'envelope_size_other','envelope_color','envelope_color_other'
  ];
  sheet.getRange(1, 42, 1, newHeaders.length).setValues([newHeaders]);
  SpreadsheetApp.flush();
  return { success: true, message: 'Added ' + newHeaders.length + ' new column headers (col42–col61)' };
}

// ===== METADATA HELPERS =====

/**
 * Sets UpdatedAt (col63) on the main Data sheet row for the given recordId.
 * Called after attachment create/delete so the record timestamp reflects the change.
 */
function touchRecordUpdatedAt(recordId) {
  try {
    var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    var col1Vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < col1Vals.length; i++) {
      if (String(col1Vals[i][0]) === String(recordId)) {
        var now = Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss");
        sheet.getRange(i + 2, 63).setValue(now);
        return;
      }
    }
  } catch(e) {}
}

/**
 * Add structured address column headers (col64–col93) to the Data sheet.
 * Run once from the Apps Script editor after deploying this version.
 */
function initAddressColumns() {
  var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var lastCol = sheet.getLastColumn();
  if (lastCol >= 93) return { success: true, message: 'Address columns already present (lastCol=' + lastCol + ')' };
  var headers = [
    // col64-71: ที่อยู่ปัจจุบัน
    'current_address_house_no','current_address_moo','current_address_soi','current_address_road',
    'current_address_subdistrict','current_address_district','current_address_province','current_address_police_station',
    // col72-79: ที่อยู่ภูมิลำเนา
    'domicile_house_no','domicile_moo','domicile_soi','domicile_road',
    'domicile_subdistrict','domicile_district','domicile_province','domicile_police_station',
    // col80-84: สถานที่เกิดเรื่อง extra (province/district/subdistrict reuse col39/40/41)
    'incident_house_no','incident_moo','incident_soi','incident_road','incident_police_station',
    // col85-93: สถานที่พักใน กทม
    'bangkok_stay_status',
    'bangkok_stay_house_no','bangkok_stay_moo','bangkok_stay_soi','bangkok_stay_road',
    'bangkok_stay_subdistrict','bangkok_stay_district','bangkok_stay_province','bangkok_stay_police_station'
  ];
  // Start at col64 (index 64, 1-based)
  sheet.getRange(1, 64, 1, headers.length).setValues([headers]);
  SpreadsheetApp.flush();
  return { success: true, message: 'Added ' + headers.length + ' address column headers (col64–col93)' };
}

/**
 * Add col94–col152 headers for Section 2–7 new fields (run once via initNewFormColumns action).
 */
function initNewFormColumns() {
  var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var lastCol = sheet.getLastColumn();
  if (lastCol >= 152) return { success: true, message: 'New form columns already present (lastCol=' + lastCol + ')' };
  var headers = [
    // col94-101: Section 2-3 extensions
    'found_officer_position',
    'carry_method_detail',
    'container_width_cm','container_length_cm','container_source',
    'envelope_width_cm','envelope_length_cm','envelope_source',
    // col102-111: Section 4 personal + family
    'education','institution','occupation','income',
    'father_name','father_phone','mother_name','mother_phone','guardian_name','guardian_phone',
    // col112: Section 5
    'visited_royal_count',
    // col113: Section 6
    'petition_case_type',
    // col114-128: Section 7.1
    'source71_person_name','source71_person_age','source71_person_idcard','source71_person_phone',
    'source71_person_education','source71_person_institution','source71_person_occupation','source71_person_income',
    'source71_platform_type','source71_platform_url','source71_platform_name','source71_platform_followers',
    'source71_post_url','source71_post_date','source71_other_detail',
    // col129-143: Section 7.2
    'source72_person_name','source72_person_age','source72_person_idcard','source72_person_phone',
    'source72_person_education','source72_person_institution','source72_person_occupation','source72_person_income',
    'source72_platform_type','source72_platform_url','source72_platform_name','source72_platform_followers',
    'source72_post_url','source72_post_date','source72_other_detail',
    // col144-152: Section 7.4 + 7.9
    'palace_visit_count','palace_visit_date1','palace_visit_date2','palace_visit_date3','palace_visit_date4',
    'doc_submit_status','doc_submit_date','doc_submit_detail',
    'after_petition_destination'
  ];
  var startCol = 94;
  sheet.getRange(1, startCol, 1, headers.length).setValues([headers]);
  SpreadsheetApp.flush();
  return { success: true, message: 'Added ' + headers.length + ' new form column headers (col94–col152)' };
}

/**
 * Add CreatedAt/UpdatedAt headers to the Data sheet (run once from editor).
 */
function initMetadataColumns() {
  var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var lastCol = sheet.getLastColumn();
  if (lastCol >= 63) return { success: true, message: 'Metadata columns already present (lastCol=' + lastCol + ')' };
  sheet.getRange(1, 62, 1, 2).setValues([['CreatedAt', 'UpdatedAt']]);
  SpreadsheetApp.flush();
  return { success: true, message: 'Added CreatedAt (col62) and UpdatedAt (col63)' };
}

// ===== DUPLICATE CHECK =====

/**
 * Search existing records for potential duplicates.
 * Requires valid admin session token.
 * Returns only minimal candidate info — no full record data.
 */
function checkDuplicate(data, token) {
  if (!validateSession(token)) return { success: false, message: 'ไม่มีสิทธิ์' };

  var idCard    = (data.idCard    || '').toString().trim();
  var phone     = normPhoneForDup(data.phone  || '');
  var name      = normNameForDup(data.name    || '');
  var excludeId = (data.excludeRecordId || '').toString().trim();

  if (!idCard && phone.length < 8 && name.length < 2) {
    return { success: true, candidates: [] };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var raw   = sheet.getDataRange().getDisplayValues();
  if (raw.length <= 1) return { success: true, candidates: [] };

  var candidates = [];
  for (var i = 1; i < raw.length; i++) {
    var row    = raw[i];
    var recId  = String(row[0]);
    if (excludeId && recId === excludeId) continue;

    var rowIdCard = (row[6] || '').toString().trim();
    var rowPhone  = normPhoneForDup((row[8] || '').toString());
    var rowName   = normNameForDup((row[3] || '') + ' ' + (row[4] || ''));

    var reasons = [];
    if (idCard.length >= 10 && rowIdCard && idCard === rowIdCard)    reasons.push('เลขบัตรประชาชน');
    if (phone.length >= 8  && rowPhone  && phone  === rowPhone)      reasons.push('เบอร์โทร');
    if (!reasons.length && name.length >= 3 && rowName && name === rowName) reasons.push('ชื่อ-สกุล');

    if (reasons.length) {
      candidates.push({
        recordId:    recId,
        name:        ((row[3] || '') + ' ' + (row[4] || '')).trim(),
        date:        (row[1] || '').toString(),
        matchReason: reasons
      });
      if (candidates.length >= 5) break; // cap at 5
    }
  }
  return { success: true, candidates: candidates };
}

function normPhoneForDup(str) {
  if (!str) return '';
  return str.toString().replace(/^'/, '').replace(/\D/g, '');
}

function normNameForDup(str) {
  if (!str) return '';
  return str.toString().trim().replace(/\s+/g, ' ');
}

function maskName(name) {
  if (!name) return '***';
  return name.split(' ').map(function(p) {
    return p.length <= 2 ? p + '***' : p.slice(0, 2) + '***';
  }).join(' ');
}

/**
 * Lightweight rate guard for the public duplicate endpoint.
 * Two-layer: global calls/min ceiling + per-query key cap.
 * Uses CacheService sliding window (acceptable for abuse deterrence).
 * Returns false if limit exceeded.
 */
function publicDupRateOk(idCard, phone, name) {
  var cache = CacheService.getScriptCache();

  // Global: max 60 calls per 60-second window across all users
  var g = parseInt(cache.get('pdup_g') || '0');
  if (g >= 60) return false;
  cache.put('pdup_g', String(g + 1), 60);

  // Per-input: max 6 lookups for the same query in 60 seconds
  var raw     = (idCard + '|' + phone + '|' + name).slice(0, 64);
  var digest  = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  var hexKey  = digest.slice(0, 8).map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
  var pk = 'pdup_k' + hexKey;
  var kc = parseInt(cache.get(pk) || '0');
  if (kc >= 6) return false;
  cache.put(pk, String(kc + 1), 60);

  return true;
}

/**
 * Public duplicate check — no admin token required.
 * Returns masked name + date only; caps at 3 candidates.
 */
function checkDuplicatePublic(data) {
  var idCard    = (data.idCard    || '').toString().trim();
  var phone     = normPhoneForDup(data.phone  || '');
  var name      = normNameForDup(data.name    || '');
  var excludeId = (data.excludeRecordId || '').toString().trim();

  if (!idCard && phone.length < 8 && name.length < 2) {
    return { success: true, candidates: [] };
  }

  if (!publicDupRateOk(idCard, phone, name)) {
    return { success: false, rateLimited: true, message: 'ลองใหม่อีกครั้งในอีกสักครู่' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var raw   = sheet.getDataRange().getDisplayValues();
  if (raw.length <= 1) return { success: true, candidates: [] };

  var candidates = [];
  for (var i = 1; i < raw.length; i++) {
    var row    = raw[i];
    var recId  = String(row[0]);
    if (excludeId && recId === excludeId) continue;

    var rowIdCard = (row[6] || '').toString().trim();
    var rowPhone  = normPhoneForDup((row[8] || '').toString());
    var rowName   = normNameForDup((row[3] || '') + ' ' + (row[4] || ''));

    var reasons = [];
    if (idCard.length >= 10 && rowIdCard && idCard === rowIdCard)          reasons.push('เลขบัตรประชาชน');
    if (phone.length >= 8  && rowPhone  && phone  === rowPhone)            reasons.push('เบอร์โทร');
    if (!reasons.length && name.length >= 3 && rowName && name === rowName) reasons.push('ชื่อ-สกุล');

    if (reasons.length) {
      var fullName = ((row[3] || '') + ' ' + (row[4] || '')).trim();
      candidates.push({
        recordId:    recId,
        maskedName:  maskName(fullName),
        date:        (row[1] || '').toString(),
        matchReason: reasons
      });
      if (candidates.length >= 3) break;
    }
  }
  return { success: true, candidates: candidates };
}

// ===== DIAGNOSTIC: DUPLICATE RECORD ID SCAN =====

/**
 * Scans entire Data sheet for rows sharing the same RecordID.
 * Returns duplicates with sheetRow info for manual investigation.
 */
function findDuplicateRecordIds() {
  var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, duplicates: [], total: 0 };

  var col1 = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // id, date, prefix
  var seen = {};
  var duplicates = [];

  col1.forEach(function(r, i) {
    var id = String(r[0]);
    if (!id || id === '') return;
    if (seen[id] !== undefined) {
      // Find or update existing dupe entry
      var existing = duplicates.find(function(d) { return d.recordId === id; });
      if (existing) {
        existing.sheetRows.push(i + 2);
      } else {
        duplicates.push({ recordId: id, sheetRows: [seen[id], i + 2] });
      }
    } else {
      seen[id] = i + 2;
    }
  });

  return { success: true, duplicates: duplicates, total: lastRow - 1, activeDuplicates: duplicates.length };
}

// ===== RECOVERY: GOOGLE SHEETS REVISION HISTORY =====

/**
 * Lists recent revisions of the Data spreadsheet using the Drive REST API.
 * Used to identify which revision to export for missing record recovery.
 */
function listRecentRevisions() {
  try {
    var oauthToken = ScriptApp.getOAuthToken();
    var baseUrl = 'https://www.googleapis.com/drive/v3/files/' + SPREADSHEET_ID +
                  '/revisions?pageSize=1000&fields=revisions(id,modifiedTime,lastModifyingUser),nextPageToken';
    var allRevs = [];
    var pageToken = null;

    // Paginate through ALL revisions to reach the most recent ones
    do {
      var url = baseUrl + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
      var resp   = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + oauthToken }, muteHttpExceptions: true });
      var parsed = JSON.parse(resp.getContentText());
      if (parsed.error) return { success: false, message: JSON.stringify(parsed.error) };
      if (parsed.revisions) allRevs = allRevs.concat(parsed.revisions);
      pageToken = parsed.nextPageToken || null;
    } while (pageToken);

    // Return newest 30
    var recent = allRevs.slice(-30).reverse();
    return {
      success: true,
      totalRevisions: allRevs.length,
      revisions: recent.map(function(r) {
        return {
          id:           r.id,
          modifiedTime: r.modifiedTime,
          modifiedBy:   r.lastModifyingUser ? r.lastModifyingUser.displayName : 'unknown'
        };
      })
    };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Exports a specific revision of the Data sheet as CSV.
 * Uses the Sheets HTML export URL with ?rev= parameter (not the Drive API).
 * Returns rows where RecordID >= minRecordId — for incident recovery.
 */
function exportRevisionRows(revisionId, minRecordId) {
  if (!revisionId) return { success: false, message: 'revisionId required' };
  try {
    var oauthToken = ScriptApp.getOAuthToken();

    // Step 1: Get the Data sheet's GID via built-in SpreadsheetApp (no external API needed)
    var dataSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!dataSheet) return { success: false, message: 'Data sheet not found in spreadsheet' };
    var dataGid = dataSheet.getSheetId();

    // Step 2: Export this specific revision as CSV via the Sheets export URL
    var exportUrl = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID +
                    '/export?format=csv&gid=' + dataGid + '&rev=' + encodeURIComponent(revisionId);
    var resp = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + oauthToken },
      followRedirects: true,
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      return {
        success: false,
        message: 'Export HTTP ' + resp.getResponseCode(),
        dataGid: dataGid,
        hint: resp.getContentText().slice(0, 200)
      };
    }

    var csv  = resp.getContentText();
    var rows = Utilities.parseCsv(csv);
    if (!rows || rows.length <= 1) return { success: true, totalInRevision: 0, filtered: [], dataGid: dataGid };

    var filtered = [];
    for (var i = 1; i < rows.length; i++) {
      var id = parseInt(rows[i][0]);
      if (!isNaN(id) && id >= minRecordId) {
        filtered.push({ rowNum: i + 1, row: rows[i].slice(0, 15) }); // first 15 cols for recovery
      }
    }
    return {
      success:        true,
      totalInRevision: rows.length - 1,
      dataGid:        dataGid,
      filtered:       filtered
    };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

function authorizeDriveScope() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, ['https://www.googleapis.com/auth/drive']);
  var root = DriveApp.getRootFolder();
  var msg  = 'Drive authorized ✅ Root: ' + root.getName() + ' (' + root.getId() + ')';
  Logger.log(msg);
  return msg;
}

// ===== AUDIT LOG =====

var FIELD_LABEL_MAP = {
  1: 'วันที่บันทึก',     2: 'เวลาบันทึก',       3: 'ชื่อ',           4: 'นามสกุล',
  5: 'ชื่อเล่น',         6: 'เลขบัตรประชาชน',   7: 'ที่อยู่(ข้อความ)', 8: 'เบอร์โทร',
  29: 'เคยมา',
  41: 'สถานะหมายเสด็จ',  42: 'รายละเอียดหมายเสด็จ',
  43: 'ประเภทสถานที่ตรวจพบ', 44: 'รายละเอียดสถานที่',
  45: 'วันที่ตรวจพบ',    46: 'เวลาตรวจพบ',
  47: 'ยศเจ้าหน้าที่',   48: 'ชื่อเจ้าหน้าที่',  49: 'โทรเจ้าหน้าที่',
  50: 'วันส่งมอบ',       51: 'เวลาส่งมอบ',
  52: 'การซ่อนเร้น',     53: 'รายละเอียดซ่อนเร้น',
  54: 'วิธีพกพา',        55: 'ประเภทภาชนะ',
  56: 'สภาพซอง',         57: 'ขนาดซอง',          59: 'สีซอง',
  63: 'บ้านเลขที่(ปัจจุบัน)',  64: 'หมู่(ปัจจุบัน)',    65: 'ซอย(ปัจจุบัน)',
  66: 'ถนน(ปัจจุบัน)',   67: 'ตำบล/แขวง(ปัจจุบัน)', 68: 'อำเภอ/เขต(ปัจจุบัน)', 69: 'จังหวัด(ปัจจุบัน)',
  71: 'บ้านเลขที่(ภูมิลำเนา)', 75: 'ตำบล/แขวง(ภูมิลำเนา)', 76: 'อำเภอ/เขต(ภูมิลำเนา)', 77: 'จังหวัด(ภูมิลำเนา)',
  84: 'สถานะที่พัก กทม',
  89: 'ตำบล/แขวง(ที่พัก กทม)', 90: 'อำเภอ/เขต(ที่พัก กทม)', 91: 'จังหวัด(ที่พัก กทม)',
  93: 'ตำแหน่งเจ้าหน้าที่',
  101: 'ระดับการศึกษา',  102: 'สถานที่ศึกษา',    103: 'อาชีพ',        104: 'รายได้',
  105: 'ชื่อบิดา',       107: 'ชื่อมารดา',        109: 'ชื่อผู้ปกครอง',
  111: 'จำนวนเคยเข้าเฝ้า', 112: 'ประเภทคดี',
  143: 'จำนวนเยี่ยมพระบรมมหาราชวัง',
  148: 'สถานะเอกสาร',    149: 'วันส่งเอกสาร',     150: 'รายละเอียดเอกสาร',
  151: 'ปลายทางหลังยื่นฎีกา'
};

function getOrCreateAuditLogSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET_NAME);
    sheet.getRange(1, 1, 1, 15).setValues([[
      'AuditID','Timestamp','UserID','Username','DisplayName','Role',
      'Action','RecordID','Target','OldValue','NewValue',
      'Metadata','SessionKey','Client','Status'
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function initAuditLog() {
  var sheet = getOrCreateAuditLogSheet();
  return { success: true, message: 'AuditLog sheet ready. Rows: ' + (sheet.getLastRow() - 1) };
}

function writeAuditLog(opts) {
  try {
    var auditSheet = getOrCreateAuditLogSheet();
    var sess = null;
    if (opts.token) { try { sess = getSession(opts.token); } catch(ex) {} }
    var userId      = (sess && sess.userId)      || opts.userId      || '';
    var username    = (sess && sess.username)    || opts.username    || '';
    var displayName = (sess && sess.displayName) || opts.displayName || '';
    var role        = (sess && sess.role)        || opts.role        || '';
    var metaStr     = '';
    if (opts.metadata !== null && opts.metadata !== undefined) {
      try { metaStr = typeof opts.metadata === 'string' ? opts.metadata : JSON.stringify(opts.metadata); } catch(ex) {}
    }
    auditSheet.appendRow([
      Utilities.getUuid(),
      Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss"),
      userId, username, displayName, role,
      opts.action || '', opts.recordId || '', opts.target || '',
      (opts.oldVal !== null && opts.oldVal !== undefined) ? String(opts.oldVal) : '',
      (opts.newVal !== null && opts.newVal !== undefined) ? String(opts.newVal) : '',
      metaStr,
      opts.token ? String(opts.token).substring(0, 8) : '',
      'GAS',
      opts.status || 'SUCCESS'
    ]);
  } catch(e) {
    Logger.log('writeAuditLog error: ' + e.toString());
  }
}

function batchWriteAuditLogs(entries) {
  try {
    if (!entries || !entries.length) return;
    var auditSheet = getOrCreateAuditLogSheet();
    // Resolve session once — all entries share the same actor
    var sess   = null;
    var token0 = entries[0] && entries[0].token;
    if (token0) { try { sess = getSession(token0); } catch(ex) {} }
    var rows = entries.map(function(opts) {
      var userId      = (sess && sess.userId)      || opts.userId      || '';
      var username    = (sess && sess.username)    || opts.username    || '';
      var displayName = (sess && sess.displayName) || opts.displayName || '';
      var role        = (sess && sess.role)        || opts.role        || '';
      var metaStr     = '';
      if (opts.metadata !== null && opts.metadata !== undefined) {
        try { metaStr = typeof opts.metadata === 'string' ? opts.metadata : JSON.stringify(opts.metadata); } catch(ex) {}
      }
      return [
        Utilities.getUuid(),
        Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss"),
        userId, username, displayName, role,
        opts.action || '', opts.recordId || '', opts.target || '',
        (opts.oldVal !== null && opts.oldVal !== undefined) ? String(opts.oldVal) : '',
        (opts.newVal !== null && opts.newVal !== undefined) ? String(opts.newVal) : '',
        metaStr,
        opts.token ? String(opts.token).substring(0, 8) : '',
        'GAS',
        opts.status || 'SUCCESS'
      ];
    });
    var startRow = auditSheet.getLastRow() + 1;
    auditSheet.getRange(startRow, 1, rows.length, 15).setValues(rows);
  } catch(e) {
    Logger.log('batchWriteAuditLogs error: ' + e.toString());
  }
}

function listAuditLogs(data, token) {
  var auditSheet   = getOrCreateAuditLogSheet();
  if (auditSheet.getLastRow() <= 1) return { success: true, entries: [], total: 0, page: 1, pageSize: 50 };
  var page         = Math.max(1, parseInt(data.page         || '1'));
  var pageSize     = Math.min(200, Math.max(1, parseInt(data.pageSize  || '50')));
  var dateFrom     = (data.dateFrom     || '').toString().trim();
  var dateTo       = (data.dateTo       || '').toString().trim();
  var usernameF    = (data.username     || '').toString().trim().toLowerCase();
  var filterAction = (data.filterAction || '').toString().trim();
  var recordIdF    = (data.recordId     || '').toString().trim();
  var lastRow      = auditSheet.getLastRow();
  var vals         = auditSheet.getRange(2, 1, lastRow - 1, 15).getValues();
  var filtered = [];
  for (var i = 0; i < vals.length; i++) {
    var r  = vals[i];
    var ts = r[1] instanceof Date
      ? Utilities.formatDate(r[1], 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss")
      : String(r[1] || '');
    if (dateFrom && ts < dateFrom) continue;
    if (dateTo   && ts > dateTo + 'T23:59:59') continue;
    if (usernameF    && String(r[3] || '').toLowerCase().indexOf(usernameF)    === -1) continue;
    if (filterAction && String(r[6]) !== filterAction) continue;
    if (recordIdF    && String(r[7]) !== recordIdF) continue;
    filtered.push(r);
  }
  filtered.reverse(); // newest first
  var total    = filtered.length;
  var startIdx = (page - 1) * pageSize;
  var pageData = filtered.slice(startIdx, startIdx + pageSize);
  var entries  = pageData.map(function(r) {
    var tsStr = r[1] instanceof Date
      ? Utilities.formatDate(r[1], 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss")
      : String(r[1] || '');
    return {
      auditId: r[0], timestamp: tsStr, userId: r[2], username: r[3],
      displayName: r[4], role: r[5], action: r[6], recordId: r[7],
      target: r[8], oldValue: r[9], newValue: r[10],
      metadata: r[11], sessionKey: r[12], client: r[13], status: r[14]
    };
  });
  return { success: true, entries: entries, total: total, page: page, pageSize: pageSize };
}

function auditExport(data, token) {
  var exportType   = (data.exportType || '').toString();
  var allowedTypes = ['EXPORT_EXCEL', 'EXPORT_PDF_SUMMARY', 'EXPORT_PDF_INDIVIDUAL'];
  if (allowedTypes.indexOf(exportType) === -1) return { success: false, message: 'exportType ไม่ถูกต้อง' };
  writeAuditLog({
    action:   exportType,
    token:    token,
    metadata: { scope: data.scope || '', count: parseInt(data.count || '0') },
    status:   'SUCCESS'
  });
  return { success: true };
}

// ===== THAILAND GEOGRAPHY (public GET, cached 6h) =====

var GEO_BASE = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/v1/';

function getAmphures(provinceId) {
  try {
    var cache = CacheService.getScriptCache();
    var key   = 'geo_amp_' + provinceId;
    var hit   = cache.get(key);
    if (hit) return JSON.parse(hit);
    var resp  = UrlFetchApp.fetch(GEO_BASE + 'amphure.json', { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
    var data  = JSON.parse(resp.getContentText())
      .filter(function(a) { return a.province_id === provinceId; })
      .map(function(a) { return { id: a.id, name: a.name_th }; });
    try { cache.put(key, JSON.stringify(data), 21600); } catch(e) {}
    return data;
  } catch(e) { throw new Error('getAmphures failed: ' + e.message); }
}

function getTambons(amphureId) {
  try {
    var cache = CacheService.getScriptCache();
    var key   = 'geo_tam_' + amphureId;
    var hit   = cache.get(key);
    if (hit) return JSON.parse(hit);
    var resp  = UrlFetchApp.fetch(GEO_BASE + 'tambon.json', { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
    var data  = JSON.parse(resp.getContentText())
      .filter(function(t) { return t.amphure_id === amphureId; })
      .map(function(t) { return { id: t.id, name: t.name_th }; });
    try { cache.put(key, JSON.stringify(data), 21600); } catch(e) {}
    return data;
  } catch(e) { throw new Error('getTambons failed: ' + e.message); }
}
