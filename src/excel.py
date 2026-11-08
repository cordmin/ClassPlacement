"""엑셀 파일: 학생기초자료 양식, 편성 결과."""
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

SHEET = "성적기초자료"
HEADERS = ["반", "번호", "이름", "성별", "성적"]


def read_students(path):
    return pd.read_excel(path, sheet_name=SHEET)


def write_template(path):
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET
    ws.append(HEADERS)
    sample_rows = [[1, 1, "김철수", "남", 90.5], [1, 2, "이영희", "여", 95.0], [1, 3, "박민수", "남", 88.0]]
    for r in sample_rows:
        ws.append(r)

    thin = Side(style="thin", color="CBD5E1")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    center = Alignment(horizontal="center", vertical="center")
    for row in ws.iter_rows(min_row=1, max_row=len(sample_rows) + 1, max_col=len(HEADERS)):
        for cell in row:
            cell.border, cell.alignment = border, center
    for cell in ws[1]:
        cell.fill = PatternFill("solid", fgColor="1E293B")
        cell.font = Font(bold=True, color="FFFFFF", name="맑은 고딕", size=11)
    for col, width in zip("ABCDE", (10, 10, 15, 10, 12)):
        ws.column_dimensions[col].width = width
    wb.save(path)


# ── 결과 파일 색 ──
HDR_FONT = Font(bold=True, color="FFFFFF", name="맑은 고딕", size=11)
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center")
THIN, MED = Side(style="thin", color="D4C5B0"), Side(style="medium", color="B8A898")
BORDER_THIN = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
BORDER_HDR = Border(left=MED, right=MED, top=MED, bottom=MED)
ROW_FILLS = ["FDF8F2", "F5EFE6"]
CLASS_COLORS = ["E8956C", "80B5D8", "8FC495", "D4908F", "C4B56A", "A884C4", "6EC4C4", "C4A07A"]
ALL_COLOR, STATS_COLOR = "C4704A", "6B8F71"


def _style_sheet(ws, cols, rows, hdr_color):
    fill_h = PatternFill("solid", fgColor=hdr_color)
    name_col = cols.index("이름") + 1 if "이름" in cols else -1
    for ci, col in enumerate(cols, 1):
        cell = ws.cell(row=1, column=ci, value=col)
        cell.fill, cell.font, cell.alignment, cell.border = fill_h, HDR_FONT, CENTER, BORDER_HDR
    for ri, row in enumerate(rows, 2):
        fill_r = PatternFill("solid", fgColor=ROW_FILLS[(ri - 2) % 2])
        for ci, val in enumerate(row, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.fill, cell.border = fill_r, BORDER_THIN
            cell.alignment = LEFT if ci == name_col else CENTER
    for ci, col in enumerate(cols, 1):
        max_len = max([len(str(col))] + [len(str(r[ci - 1] or "")) for r in rows])
        ws.column_dimensions[get_column_letter(ci)].width = min(max_len + 4, 30)
    ws.row_dimensions[1].height = 24
    for ri in range(2, ws.max_row + 1):
        ws.row_dimensions[ri].height = 20
    ws.sheet_properties.tabColor = hdr_color


def write_result(path, full_result, stats, num_classes):
    """전체편성 / 반별 / 편성통계 시트. '기존번호'는 엑셀에 넣지 않는다."""
    df = pd.DataFrame(full_result)
    df = df[[c for c in df.columns if c != "기존번호"]]
    cols = list(df.columns)
    wb = Workbook()
    ws_all = wb.active
    ws_all.title = "전체편성"
    _style_sheet(ws_all, cols, [list(r) for r in df.itertuples(index=False)], ALL_COLOR)
    for i in range(1, num_classes + 1):
        df_c = df[df["배정학급"] == f"{i}반"]
        _style_sheet(wb.create_sheet(title=f"{i}반"), cols, [list(r) for r in df_c.itertuples(index=False)],
                     CLASS_COLORS[(i - 1) % len(CLASS_COLORS)])
    cols_s = list(stats[0].keys()) if stats else []
    _style_sheet(wb.create_sheet(title="편성통계"), cols_s, [[row[c] for c in cols_s] for row in stats], STATS_COLOR)
    wb.save(path)
