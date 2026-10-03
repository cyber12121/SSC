import pdfplumber
import sys

pdf_path = r'C:\Users\panda\Downloads\grammar_chapters\02_Tenses_Basics_Units_1-18\3 Present continuous and present simple 1 (I am doing and I do).pdf'

try:
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                print(f'=== PAGE {i+1} ===')
                print(text)
                print()
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)