import fitz
doc = fitz.open('pdfs/top/Top 500 Only Questions Book by Jyotiprakash Mohanty.pdf')
output = []
for i in range(len(doc)):
    page = doc[i]
    text = page.get_text()
    if 'ANSWER' in text.upper() or 'SOLUTION' in text.upper():
        lines = text.split('\n')
        for line in lines:
            line_stripped = line.strip()
            if 'ANSWER' in line_stripped.upper() or 'SOLUTION' in line_stripped.upper():
                output.append(f'Page {i+1}: {line_stripped[:150]}')
with open('answers.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
