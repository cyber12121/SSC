import google.generativeai as genai
import json
import os
import glob
import time
import shutil

# ==========================================
# CONFIGURATION
# ==========================================
API_KEY = "AIzaSyBH9T1V-LK0_de8bY7R5UeTCn2_MvoC-gE"#"AIzaSyC6TMlfWZV16dQx70U9tDwnE7t1w4J1H6I" 
INPUT_FOLDER = "d:/CGL-APP/pdfs/Percentage"  
OUTPUT_FOLDER = "d:/CGL-APP/src/data/chapter_bank/mathematics/spartan/Percentage"

def main():
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)

    # Create a 'done' folder inside the INPUT_FOLDER
    done_folder = os.path.join(INPUT_FOLDER, "done")
    if not os.path.exists(done_folder):
        os.makedirs(done_folder)

    print("Configuring Gemini API...")
    genai.configure(api_key=API_KEY)

    pdf_files = glob.glob(os.path.join(INPUT_FOLDER, "*.pdf"))
    if not pdf_files:
        print(f"ERROR: No PDF files found in {INPUT_FOLDER}")
        return

    # Using gemini-1.5-flash (Google does not have a 3.5 model yet!)
    model = genai.GenerativeModel(model_name="gemini-3.5-flash")

    prompt = """
    You are an expert math teacher and data entry specialist.
    Extract all the multiple-choice questions from the attached PDF.
    Solve each question, figure out the correct option, and write a concise, step-by-step mathematical solution.

    dont extract the hindi verdion only english one 
    You must return a JSON array containing objects. 
    Each object must strictly match this exact JSON structure:
    {
      "q_num": 1,
      "question": "The text of the question...",
      "options": {
        "a": "First option text",
        "b": "Second option text",
        "c": "Third option text",
        "d": "Fourth option text"
      },
      "answer": "c", 
      "solution": "The step-by-step mathematical solution..."
    }
    
    Ensure that the 'answer' field contains only the correct lowercase letter ('a', 'b', 'c', or 'd').
    IMPORTANT: You must output perfectly valid JSON. If you use LaTeX or math symbols, you MUST double-escape your backslashes (e.g., use \\\\frac instead of \\frac).
    """

    # Find the highest existing set number so we don't overwrite
    existing_sets = glob.glob(os.path.join(OUTPUT_FOLDER, "set_*.json"))
    max_set_num = 0
    for f in existing_sets:
        try:
            num = int(os.path.basename(f).replace('set_', '').replace('.json', ''))
            if num > max_set_num:
                max_set_num = num
        except ValueError:
            pass
            
    current_set_num = max_set_num + 1

    for idx, pdf_path in enumerate(pdf_files):
        filename = os.path.basename(pdf_path)
        output_json_name = f"set_{current_set_num}.json"
        output_json_path = os.path.join(OUTPUT_FOLDER, output_json_name)
        current_set_num += 1

        print(f"\n[{idx+1}/{len(pdf_files)}] Processing '{filename}'...")
        
        max_retries = 3
        success = False
        
        for attempt in range(max_retries):
            pdf_file = None
            try:
                pdf_file = genai.upload_file(path=pdf_path)
                print(f"Asking Gemini to read, solve, and convert to JSON (Attempt {attempt+1}/{max_retries})...")
                
                response = model.generate_content(
                    [pdf_file, prompt],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json"
                    )
                )

                raw_text = response.text
                
                # Attempt to parse
                try:
                    questions_data = json.loads(raw_text)
                except json.JSONDecodeError:
                    # Fallback: manually escape backslashes if Gemini messed up LaTeX formatting
                    print("JSON decode error detected, attempting to auto-fix backslashes...")
                    sanitized_text = raw_text.replace('\\', '\\\\')
                    questions_data = json.loads(sanitized_text)
                
                with open(output_json_path, 'w', encoding='utf-8') as f:
                    json.dump(questions_data, f, indent=2, ensure_ascii=False)
                    
                print(f"SUCCESS! Saved {len(questions_data)} questions to '{output_json_path}'")
                success = True
                
            except Exception as e:
                print(f"ERROR processing {filename} on attempt {attempt+1}: {e}")
                time.sleep(2)
            finally:
                if pdf_file:
                    print("Cleaning up the uploaded PDF from Google servers...")
                    try:
                        pdf_file.delete()
                    except Exception as e:
                        pass
                        
            if success:
                # Move the file to the 'done' folder
                dest_path = os.path.join(done_folder, filename)
                try:
                    shutil.move(pdf_path, dest_path)
                    print(f"Moved '{filename}' to the done folder.")
                except Exception as e:
                    print(f"Could not move '{filename}' to done folder: {e}")
                
                # Break out of the retry loop if successful
                break
                
        if not success:
            print(f"Failed to process '{filename}' after {max_retries} attempts.")

        time.sleep(2)

if __name__ == "__main__":
    main()
