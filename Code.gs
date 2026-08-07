const SPREADSHEET_ID        = "1nWuu8US7L0EPMMGsSFzuBEeSlkOL4YPAM7CGPk0T6wA";
const SHEET_NAME            = "Data";
const ATTACHMENTS_SHEET_NAME = "Attachments";
const DRIVE_ROOT_FOLDER_NAME = "RW01 Uploads";
const ADMIN_PASSWORD        = "123456";

const ALLOWED_MIME_TYPES = [
  'image/jpeg','image/jpg','image/png','image/gif',
  'image/webp','image/heic','image/heif','image/bmp'
];
const SECTION_TYPES = ['officer_found','person_portrait','items_evidence'];
const SECTION_MAX   = { officer_found: 2, person_portrait: 1, items_evidence: 10 };

// ===== HTTP ENTRY POINTS =====

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || '';
  var result;
  try {
    if (action === 'dashboard') {
      result = getDashboardData(params.password || '');
    } else if (action === 'amphures') {
      result = getAmphures(parseInt(params.provinceId));
    } else if (action === 'tambons') {
      result = getTambons(parseInt(params.amphureId));
    } else if (action === 'listAttachments') {
      result = listAttachments(params.recordId, params.password || '');
    } else {
      result = { error: 'Unknown action' };
    }
  } catch(err) {
    result = { error: err.toString() };
  }
  return makeResponse(result);
}

function doPost(e) {
  var result;
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || '';
    if (action === 'submit') {
      result = submitData(data);
    } else if (action === 'update') {
      result = updateData(parseInt(data.sheetRow), data, data.password || '');
    } else if (action === 'delete') {
      result = deleteData(parseInt(data.sheetRow), data.password || '');
    } else if (action === 'uploadAttachment') {
      result = uploadAttachment(data);
    } else if (action === 'deleteAttachment') {
      result = deleteAttachmentRecord(data.attachmentId, data.password || '');
    } else {
      result = { success: false, message: 'Unknown action' };
    }
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

// ===== CORE DATA FUNCTIONS =====

function getDashboardData(password) {
  if (password !== ADMIN_PASSWORD) {
    return { error: "รหัสผ่านไม่ถูกต้อง! ไม่มีสิทธิ์เข้าถึงข้อมูล" };
  }
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return { total: 0, allData: [] };

  const rows = data.slice(1).map(function(rowData, i) {
    return { sheetRow: i + 2, data: rowData };
  }).reverse();

  return { total: rows.length, allData: rows };
}

function submitData(formObject) {
  try {
    const sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();
    const recordId = lastRow; // ID = row count before append (matches existing behavior)

    const newRow = buildDataRow(recordId, formObject);
    sheet.appendRow(newRow);
    return { success: true, recordId: recordId, message: "บันทึกข้อมูลสำเร็จ!" };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

function updateData(sheetRowNum, formObject, password) {
  if (password !== ADMIN_PASSWORD) {
    return { success: false, message: "ไม่มีสิทธิ์แก้ไขข้อมูล!" };
  }
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const existingId = sheet.getRange(sheetRowNum, 1).getValue();

    // Read existing full row to preserve new fields (col42–col61) when editing via old form
    const lastCol = Math.max(61, sheet.getLastColumn());
    const existingVals = sheet.getRange(sheetRowNum, 1, 1, lastCol).getValues()[0];

    const updatedRow = buildDataRow(existingId, formObject, existingVals);
    sheet.getRange(sheetRowNum, 1, 1, updatedRow.length).setValues([updatedRow]);
    return { success: true, message: "แก้ไขข้อมูลสำเร็จ!" };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

/**
 * Build the data array for col1–col61.
 * existingVals: optional, the current row values read from Sheet (used in update to preserve new cols)
 */
function buildDataRow(recordId, f, existingVals) {
  // Helper: if existingVals provided and formObject key is missing, keep existing; else use formObject value
  function col(key, existingIdx) {
    if (f[key] !== undefined && f[key] !== null) return f[key];
    if (existingVals && existingIdx !== undefined) return existingVals[existingIdx] || "";
    return "";
  }

  return [
    // col1 (A) – Record ID
    recordId,
    // col2–col41 – original fields
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
    // col42–col61 – new encounter/item fields (index 41–60 in 0-based existingVals)
    col('col42', 41), // notice_status
    col('col43', 42), // notice_detail
    col('col44', 43), // found_location_type
    col('col45', 44), // found_location_detail
    col('col46', 45), // found_date
    col('col47', 46), // found_time
    col('col48', 47), // found_officer_rank
    col('col49', 48), // found_officer_name
    col('col50', 49), // found_officer_phone
    col('col51', 50), // handover_date
    col('col52', 51), // handover_time
    col('col53', 52), // item_visibility
    col('col54', 53), // item_hidden_detail
    col('col55', 54), // carry_methods (JSON array)
    col('col56', 55), // container_types (JSON array)
    col('col57', 56), // envelope_status
    col('col58', 57), // envelope_size
    col('col59', 58), // envelope_size_other
    col('col60', 59), // envelope_color
    col('col61', 60)  // envelope_color_other
  ];
}

function deleteData(sheetRowNum, password) {
  if (password !== ADMIN_PASSWORD) {
    return { success: false, message: "ไม่มีสิทธิ์ลบข้อมูล!" };
  }
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    sheet.deleteRow(sheetRowNum);
    return { success: true, message: "ลบข้อมูลสำเร็จ!" };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

// ===== ATTACHMENT FUNCTIONS =====

function uploadAttachment(data) {
  // Validate required fields
  if (!data.recordId || !data.section || !data.fileData || !data.fileName || !data.mimeType) {
    return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
  }
  if (SECTION_TYPES.indexOf(data.section) === -1) {
    return { success: false, message: 'ประเภทไฟล์ไม่ถูกต้อง: ' + data.section };
  }
  const mime = data.mimeType.toLowerCase().split(';')[0].trim();
  if (ALLOWED_MIME_TYPES.indexOf(mime) === -1) {
    return { success: false, message: 'ไม่รองรับไฟล์ประเภท: ' + mime };
  }

  // Validate RecordID exists in Data sheet
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, message: 'ไม่พบข้อมูล Record' };
  const col1Vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const recordExists = col1Vals.some(function(r) { return String(r[0]) === String(data.recordId); });
  if (!recordExists) return { success: false, message: 'ไม่พบ RecordID: ' + data.recordId };

  // Check section count limit
  const attSheet = getOrCreateAttachmentsSheet();
  const attVals = attSheet.getLastRow() > 1
    ? attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 12).getValues()
    : [];
  var activeCount = 0;
  attVals.forEach(function(r) {
    if (String(r[1]) === String(data.recordId) && r[2] === data.section && r[8] === 'active') {
      activeCount++;
    }
  });
  const maxAllowed = SECTION_MAX[data.section];
  if (activeCount >= maxAllowed) {
    return { success: false, message: 'เกินจำนวนสูงสุด ' + maxAllowed + ' ไฟล์ สำหรับ ' + data.section };
  }

  // Upload to Drive
  try {
    const folder = getOrCreateSectionFolder(data.recordId, data.section);
    const safeName = sanitizeFileName(data.fileName);
    const decoded = Utilities.base64Decode(data.fileData);
    const blob = Utilities.newBlob(decoded, mime, safeName);
    const file = folder.createFile(blob);
    const fileId = file.getId();

    const now = new Date().toISOString();
    const sortOrder = activeCount + 1;
    const attachmentId = 'ATT-' + data.recordId + '-' + data.section + '-' + Date.now();
    attSheet.appendRow([
      attachmentId,
      data.recordId,
      data.section,
      fileId,
      safeName,
      mime,
      data.sizeBytes || 0,
      sortOrder,
      'active',
      now,
      now,
      ''
    ]);
    return { success: true, attachmentId: attachmentId, driveFileId: fileId, message: 'อัปโหลดสำเร็จ' };
  } catch(e) {
    return { success: false, message: 'อัปโหลดล้มเหลว: ' + e.toString() };
  }
}

function listAttachments(recordId, password) {
  if (password !== ADMIN_PASSWORD) return { error: 'ไม่มีสิทธิ์' };
  if (!recordId) return { error: 'ต้องระบุ recordId' };
  const attSheet = getOrCreateAttachmentsSheet();
  if (attSheet.getLastRow() <= 1) return { attachments: [] };
  const vals = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 12).getValues();
  const result = [];
  vals.forEach(function(r) {
    if (String(r[1]) === String(recordId) && r[8] !== 'deleted') {
      result.push({
        attachmentId: r[0], recordId: r[1], section: r[2],
        driveFileId: r[3], fileName: r[4], mimeType: r[5],
        sizeBytes: r[6], sortOrder: r[7], status: r[8],
        uploadedAt: r[9]
      });
    }
  });
  return { attachments: result };
}

function deleteAttachmentRecord(attachmentId, password) {
  if (password !== ADMIN_PASSWORD) return { success: false, message: 'ไม่มีสิทธิ์' };
  if (!attachmentId) return { success: false, message: 'ต้องระบุ attachmentId' };
  const attSheet = getOrCreateAttachmentsSheet();
  if (attSheet.getLastRow() <= 1) return { success: false, message: 'ไม่พบข้อมูล' };
  const vals = attSheet.getRange(2, 1, attSheet.getLastRow() - 1, 12).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === attachmentId) {
      const sheetRow = i + 2;
      const fileId = vals[i][3];
      // Soft delete: update status + DeletedAt
      attSheet.getRange(sheetRow, 9).setValue('deleted');
      attSheet.getRange(sheetRow, 11).setValue(new Date().toISOString());
      attSheet.getRange(sheetRow, 12).setValue(new Date().toISOString());
      // Move file to trash in Drive (reversible)
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
      return { success: true, message: 'ลบไฟล์สำเร็จ (soft delete)' };
    }
  }
  return { success: false, message: 'ไม่พบ attachmentId: ' + attachmentId };
}

// ===== DRIVE HELPERS =====

function getOrCreateRootFolder() {
  var folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
}

function getOrCreateSectionFolder(recordId, sectionType) {
  var root = getOrCreateRootFolder();
  var recordName = String(recordId);
  var recordFolder;
  var rf = root.getFoldersByName(recordName);
  if (rf.hasNext()) { recordFolder = rf.next(); }
  else { recordFolder = root.createFolder(recordName); }
  var sf = recordFolder.getFoldersByName(sectionType);
  if (sf.hasNext()) return sf.next();
  return recordFolder.createFolder(sectionType);
}

function getOrCreateAttachmentsSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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

// ===== INITIALIZE SHEET HEADERS (run once manually) =====
// Call this from Apps Script editor once after deploying to add new column headers.
function initNewColumnHeaders() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const lastCol = sheet.getLastColumn();
  if (lastCol < 42) {
    // Add headers if not present (sheet must already have row 1 as header)
    const newHeaders = [
      'notice_status','notice_detail',
      'found_location_type','found_location_detail',
      'found_date','found_time',
      'found_officer_rank','found_officer_name','found_officer_phone',
      'handover_date','handover_time',
      'item_visibility','item_hidden_detail',
      'carry_methods','container_types',
      'envelope_status','envelope_size','envelope_size_other',
      'envelope_color','envelope_color_other'
    ];
    sheet.getRange(1, 42, 1, newHeaders.length).setValues([newHeaders]);
    SpreadsheetApp.flush();
    return { success: true, message: 'Added ' + newHeaders.length + ' new column headers (col42–col61)' };
  }
  return { success: true, message: 'Headers already present (lastCol=' + lastCol + ')' };
}

// ===== THAILAND GEOGRAPHY (cached 6 h) =====
var GEO_BASE = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/v1/';

function getAmphures(provinceId) {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'geo_amp_' + provinceId;
    var hit = cache.get(key);
    if (hit) return JSON.parse(hit);
    var resp = UrlFetchApp.fetch(GEO_BASE + 'amphure.json', {muteHttpExceptions: true});
    if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
    var data = JSON.parse(resp.getContentText())
      .filter(function(a) { return a.province_id === provinceId; })
      .map(function(a) { return { id: a.id, name: a.name_th }; });
    try { cache.put(key, JSON.stringify(data), 21600); } catch(e) {}
    return data;
  } catch(e) {
    throw new Error('getAmphures failed: ' + e.message);
  }
}

function getTambons(amphureId) {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'geo_tam_' + amphureId;
    var hit = cache.get(key);
    if (hit) return JSON.parse(hit);
    var resp = UrlFetchApp.fetch(GEO_BASE + 'tambon.json', {muteHttpExceptions: true});
    if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
    var data = JSON.parse(resp.getContentText())
      .filter(function(t) { return t.amphure_id === amphureId; })
      .map(function(t) { return { id: t.id, name: t.name_th }; });
    try { cache.put(key, JSON.stringify(data), 21600); } catch(e) {}
    return data;
  } catch(e) {
    throw new Error('getTambons failed: ' + e.message);
  }
}
