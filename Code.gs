const SPREADSHEET_ID = "1nWuu8US7L0EPMMGsSFzuBEeSlkOL4YPAM7CGPk0T6wA";
const SHEET_NAME = "Data";
const ADMIN_PASSWORD = "123456";

// ===== HTTP API ENTRY POINTS =====

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

// ===== DATA FUNCTIONS =====

function getDashboardData(password) {
  if (password !== ADMIN_PASSWORD) {
    return { error: "รหัสผ่านไม่ถูกต้อง! ไม่มีสิทธิ์เข้าถึงข้อมูล" };
  }
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return { total: 0, allData: [] };

  const rows = data.slice(1).map((rowData, i) => ({
    sheetRow: i + 2,
    data: rowData
  })).reverse();

  return { total: rows.length, allData: rows };
}

function submitData(formObject) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();
    const newRow = [
      lastRow,
      formObject.col2  || "", formObject.col3  || "", formObject.col4  || "", formObject.col5  || "",
      formObject.col6  || "", formObject.col7  || "", formObject.col8  || "", formObject.col9  || "",
      formObject.col10 || "", formObject.col11 || "", formObject.col12 || "", formObject.col13 || "",
      formObject.col14 || "", formObject.col15 || "", formObject.col16 || "", formObject.col17 || "",
      formObject.col18 || "", formObject.col19 || "", formObject.col20 || "", formObject.col21 || "",
      formObject.col22 || "", formObject.col23 || "", formObject.col24 || "", formObject.col25 || "",
      formObject.col26 || "", formObject.col27 || "", formObject.col28 || "", formObject.col29 || "",
      formObject.col30 || "", formObject.col31 || "", formObject.col32 || "", formObject.col33 || "",
      formObject.col34 || "", formObject.col35 || "",
      formObject.col36 || "", formObject.col37 || "",
      formObject.col38 || "", formObject.col39 || "", formObject.col40 || "", formObject.col41 || ""
    ];
    sheet.appendRow(newRow);
    return { success: true, message: "บันทึกข้อมูลสำเร็จ!" };
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
    const updatedRow = [
      existingId,
      formObject.col2  || "", formObject.col3  || "", formObject.col4  || "", formObject.col5  || "",
      formObject.col6  || "", formObject.col7  || "", formObject.col8  || "", formObject.col9  || "",
      formObject.col10 || "", formObject.col11 || "", formObject.col12 || "", formObject.col13 || "",
      formObject.col14 || "", formObject.col15 || "", formObject.col16 || "", formObject.col17 || "",
      formObject.col18 || "", formObject.col19 || "", formObject.col20 || "", formObject.col21 || "",
      formObject.col22 || "", formObject.col23 || "", formObject.col24 || "", formObject.col25 || "",
      formObject.col26 || "", formObject.col27 || "", formObject.col28 || "", formObject.col29 || "",
      formObject.col30 || "", formObject.col31 || "", formObject.col32 || "", formObject.col33 || "",
      formObject.col34 || "", formObject.col35 || "",
      formObject.col36 || "", formObject.col37 || "",
      formObject.col38 || "", formObject.col39 || "", formObject.col40 || "", formObject.col41 || ""
    ];
    sheet.getRange(sheetRowNum, 1, 1, updatedRow.length).setValues([updatedRow]);
    return { success: true, message: "แก้ไขข้อมูลสำเร็จ!" };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
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
