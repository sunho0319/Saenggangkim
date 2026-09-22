// 신청 내용을 Google 스프레드시트에 한 줄씩 쌓는 Apps Script.
// 사용법은 README.md 참고.

const SHEET_NAME = "신청";
const HEADERS = ["접수시각", "이름", "연락처", "이메일", "인원", "입장료", "알게 된 경로", "요청사항"];

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

  // 연락처가 숫자로 변환되어 0이 사라지지 않도록 문자열로 저장
  sheet.appendRow([
    new Date(d.submittedAt), d.name, "'" + d.phone, d.email,
    d.guests, d.total, d.source, d.note,
  ]);
  return ContentService.createTextOutput("ok");
}
