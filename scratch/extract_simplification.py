import pypdf
import re
import os
import glob
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def parse_set_file(file_path):
    filename = os.path.basename(file_path)
    # Extract set info from filename: e.g. Simplification_Questions_PDF_-_Set_1_(Easy).pdf
    m = re.search(r'Set_(\d+)_?\((Easy|Moderate|Hard)\)', filename, re.IGNORECASE)
    if m:
        set_num = int(m.group(1))
        diff = m.group(2).capitalize()
    else:
        set_num = 1
        diff = 'Easy'
        
    set_id = f"set_{set_num}_{diff.lower()}"
    title = f"Simplification Drill Set {set_num} ({diff})"
    
    try:
        reader = pypdf.PdfReader(file_path)
        full_text = '\n'.join([p.extract_text() for p in reader.pages])
    except Exception as e:
        print(f"Error reading {filename}: {e}")
        return None
        
    parts = re.split(r'Explanations?:', full_text, flags=re.IGNORECASE)
    if len(parts) < 2:
        print(f"No Explanations split found in {filename}")
        return None
    q_section, exp_section = parts[0], parts[1]
    
    # Answers & solutions
    exp_blocks = re.split(r'\n(?:\d+)\.\s*Questions?', exp_section)
    answers = {}
    solutions = {}
    for i, block in enumerate(exp_blocks[1:], 1):
        ans_match = re.search(r'Answer:\s*([A-Ea-e])', block)
        ans = ans_match.group(1).lower() if ans_match else ''
        answers[i] = ans
        sol = block.strip()
        if ans_match:
            sol = block[ans_match.end():].strip()
        # Clean email/boilerplate
        sol = re.sub(r'cyberdevil0101@gmail\.com|PDF Course Subscription.*?\n|Page \d+ Of \d+', '', sol, flags=re.IGNORECASE)
        solutions[i] = sol.strip()
        
    # Questions
    q_blocks = re.split(r'\n(?:\d+)\.\s*Questions?', q_section)
    questions = []
    for i, block in enumerate(q_blocks[1:], 1):
        raw_lines = [l.strip() for l in block.split('\n') if l.strip()]
        lines = [l for l in raw_lines if not ('PDF Course' in l or 'Page ' in l or '@gmail.com' in l or 'Simplification Questions' in l)]
        
        opts = {}
        q_lines = []
        for line in lines:
            # Matches '100a.' or '1 a.' or 'None of thesee.'
            m_opt = re.search(r'^(.*?)\s*([a-e])\.\s*$', line, re.IGNORECASE)
            if not m_opt:
                m_opt = re.search(r'^(.*?)([a-e])\.\s*$', line, re.IGNORECASE)
            if m_opt and len(m_opt.group(2)) == 1:
                opt_letter = m_opt.group(2).lower()
                opt_val = m_opt.group(1).strip()
                if opt_val.lower() == 'none of these' or opt_val.lower() == 'none':
                    opt_val = 'None of these'
                opts[opt_letter] = opt_val
            else:
                q_lines.append(line)
                
        q_text = ' '.join(q_lines).strip()
        q_text = re.sub(r'^What value should come in the place (?:of )?\(\?\) in the following questions\?\s*', '', q_text, flags=re.IGNORECASE).strip()
        
        # Ensure at least 4 options
        if len(opts) < 4:
            print(f"Warning: {filename} Q{i} has only {len(opts)} options: {opts}")
            
        questions.append({
            "id": f"{set_id}_q{i}",
            "q_num": i,
            "question": q_text,
            "options": opts,
            "answer": answers.get(i, 'a'),
            "solution": solutions.get(i, '')
        })
        
    return {
        "id": set_id,
        "title": title,
        "setNumber": set_num,
        "difficulty": diff,
        "totalQuestions": len(questions),
        "questions": questions
    }

def main():
    input_dir = r"C:\Users\panda\Downloads\simplificaiton"
    files = sorted(glob.glob(os.path.join(input_dir, "Simplification_Questions_PDF_-_Set_*.pdf")))
    
    # Sort with custom key: Easy -> Moderate -> Hard, then setNumber
    diff_order = {'Easy': 1, 'Moderate': 2, 'Hard': 3}
    
    all_sets = []
    for f in files:
        parsed = parse_set_file(f)
        if parsed and len(parsed["questions"]) > 0:
            all_sets.append(parsed)
            print(f"Parsed {parsed['title']}: {len(parsed['questions'])} questions", flush=True)
            
    # Sort
    all_sets.sort(key=lambda s: (diff_order.get(s['difficulty'], 99), s['setNumber']))
    
    out_path = r"d:\My-Project\CGL-APP\src\data\drills\simplificationDrills.json"
    with open(out_path, "w", encoding="utf-8") as out_f:
        json.dump(all_sets, out_f, indent=2, ensure_ascii=False)
        
    print(f"\nSuccessfully saved {len(all_sets)} drill sets to {out_path}!", flush=True)

if __name__ == "__main__":
    main()
