import pdfplumber

pdf_path = r'C:\Users\panda\Downloads\grammar_chapters\02_Tenses_Basics_Units_1-18\3 Present continuous and present simple 1 (I am doing and I do).pdf'
with pdfplumber.open(pdf_path) as pdf:
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        if text:
            print(f'=== PAGE {i+1} ===')
            print(text)
            print()