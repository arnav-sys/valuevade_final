from pathlib import Path
from pypdf import PdfWriter
from openpyxl import Workbook


out = Path('/app/test_reports/artifacts/iteration107_files')
out.mkdir(parents=True, exist_ok=True)

pdf_writer = PdfWriter()
pdf_writer.add_blank_page(width=300, height=300)
with (out / 'qa_upload.pdf').open('wb') as f:
    pdf_writer.write(f)

wb = Workbook()
ws = wb.active
ws.title = 'QA'
ws['A1'] = 'Valuevade QA upload'
ws['B1'] = 2026
wb.save(out / 'qa_replace.xlsx')

(out / 'invalid.pdf').write_bytes(b'not-a-valid-pdf')
(out / 'bad.exe').write_bytes(b'MZ')

print(str(out))