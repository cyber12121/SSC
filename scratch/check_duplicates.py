import json
import os
import re
import sys

def normalize(text):
    if not text:
        return ""
    # Remove common instructions/prefixes
    text = re.sub(r'^(Select the|Choose the|Direction:|Directions:|In the question,|Read each sentence|From the given|Identify the|What will come in blank|Change the sentence from|What is the).*?[\.:?]\s*', '', text, flags=re.IGNORECASE)
    # Lowercase
    text = text.lower()
    # Remove all non-alphanumeric
    text = re.sub(r'[^a-zA-Z0-9]', '', text)
    return text

def check_duplicates(folder_path, output_file):
    files = [f for f in os.listdir(folder_path) if f.endswith('.json')]
    
    all_data = []
    summary = {}
    
    with open(output_file, 'w', encoding='utf-8') as out:
        def log(msg):
            print(msg)
            out.write(msg + '\n')

        for file in files:
            file_path = os.path.join(folder_path, file)
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            log(f"\n--- Analyzing file: {file} ---")
            file_questions = []
            for chapter in data:
                for q in chapter.get('questions', []):
                    q_text = q.get('question', '')
                    norm_text = normalize(q_text)
                    file_questions.append({
                        'file': file,
                        'chapter': chapter.get('chapter_title'),
                        'question': q_text,
                        'norm': norm_text,
                        'q_num': q.get('q_num')
                    })
            
            # Exact duplicates
            seen_exact = {}
            exact_dupes = []
            for q in file_questions:
                if q['question'] in seen_exact:
                    exact_dupes.append((seen_exact[q['question']], q))
                else:
                    seen_exact[q['question']] = q
            
            if exact_dupes:
                log(f"  [EXACT] Found {len(exact_dupes)} exact duplicates:")
                for d1, d2 in exact_dupes:
                    log(f"    - \"{d2['question'][:80]}...\"")
                    log(f"      Loc 1: Chapter '{d1['chapter']}', q_num {d1['q_num']}")
                    log(f"      Loc 2: Chapter '{d2['chapter']}', q_num {d2['q_num']}")
            
            # Normalized duplicates (excluding exact ones)
            seen_norm = {}
            norm_dupes = []
            for q in file_questions:
                if q['norm'] in seen_norm:
                    if q['question'] != seen_norm[q['norm']]['question']:
                        norm_dupes.append((seen_norm[q['norm']], q))
                else:
                    if q['norm']:
                        seen_norm[q['norm']] = q
            
            if norm_dupes:
                log(f"  [SOFT] Found {len(norm_dupes)} potential duplicates (similar text):")
                for d1, d2 in norm_dupes:
                    # Escape non-encodable chars if needed for console, but writing to file is fine
                    log(f"    - Match 1: \"{d1['question'][:80].encode('ascii', 'replace').decode('ascii')}...\"")
                    log(f"    - Match 2: \"{d2['question'][:80].encode('ascii', 'replace').decode('ascii')}...\"")
                    log(f"      Loc 1: Chapter '{d1['chapter']}', q_num {d1['q_num']}")
                    log(f"      Loc 2: Chapter '{d2['chapter']}', q_num {d2['q_num']}")
            
            summary[file] = {'exact': len(exact_dupes), 'soft': len(norm_dupes)}
            if not exact_dupes and not norm_dupes:
                log("  No duplicates found.")
                
            all_data.extend(file_questions)

        # Check across files
        log("\n--- Checking across all files ---")
        seen_all = {}
        cross_dupes = []
        for q in all_data:
            if q['norm'] in seen_all:
                if seen_all[q['norm']]['file'] != q['file']:
                    cross_dupes.append((seen_all[q['norm']], q))
            else:
                if q['norm']:
                    seen_all[q['norm']] = q
                    
        if cross_dupes:
            log(f"  Found {len(cross_dupes)} cross-file duplicates:")
            for d1, d2 in cross_dupes:
                log(f"    - \"{d1['question'][:50].encode('ascii', 'replace').decode('ascii')}...\" in {d1['file']} and {d2['file']}")
        else:
            log("  No cross-file duplicates found.")

        log("\n--- FINAL SUMMARY ---")
        for file, counts in summary.items():
            log(f"{file}: {counts['exact']} exact duplicates, {counts['soft']} soft duplicates")

if __name__ == "__main__":
    folder = r"d:\MY Project\ssc-cgl-practice-pro\src\data\mock_errors"
    output = r"d:\MY Project\ssc-cgl-practice-pro\scratch\dupe_results.txt"
    check_duplicates(folder, output)
