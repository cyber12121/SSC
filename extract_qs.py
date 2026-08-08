import fitz
doc = fitz.open('pdfs/top/Top 500 Only Questions Book by Jyotiprakash Mohanty.pdf')
output = []
for i in range(len(doc)):
    page = doc[i]
    text = page.get_text()
    lines = text.split('\n')
    for line in lines:
        line_stripped = line.strip()
        # Look for question numbers
        if line_stripped.startswith('Q') and ('.' in line_stripped[:5] or ' ' in line_stripped[:5]):
            output.append(f'Page {i+1}: {line_stripped[:80]}')
with open('questions.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
