import fitz
doc = fitz.open('pdfs/top/Top 500 Only Questions Book by Jyotiprakash Mohanty.pdf')
output = []
for i in range(len(doc)):
    page = doc[i]
    text = page.get_text()
    lines = text.split('\n')
    for line in lines:
        line_stripped = line.strip()
        if len(line_stripped) > 3 and len(line_stripped) < 60 and line_stripped.isupper() and any(c.isalpha() for c in line_stripped):
            if 'SIMPLICRACK' not in line_stripped and 'MRQ' not in line_stripped and 'SSC' not in line_stripped and 'CGL' not in line_stripped and 'SERIES' not in line_stripped and 'MATH' not in line_stripped and 'PREFACE' not in line_stripped:
                output.append(f'Page {i+1}: {line_stripped}')
with open('output.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
