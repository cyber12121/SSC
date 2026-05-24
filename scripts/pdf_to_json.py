import google.generativeai as genai
import json
import os

# ==========================================
# CONFIGURATION
# ==========================================
# Get your API key from Google AI Studio: https://aistudio.google.com/
API_KEY = "YOUR_GEMINI_API_KEY_HERE" 
INPUT_PDF = "C:/path/to/your/input.pdf"  # Replace with the path to your PDF
OUTPUT_JSON = "output_set.json"          # Where to save the results

def main():
    if API_KEY == "AIzaSyC6TMlfWZV16dQx70U9tDwnE7t1w4J1H6I":
        print("❌ ERROR: Please insert your Gemini API Key at the top of the script.")
        return

    print("🔧 Configuring Gemini API...")
    genai.configure(api_key=API_KEY)

    if not os.path.exists(INPUT_PDF):
        print(f"❌ ERROR: Could not find the PDF file at {INPUT_PDF}")
        return

    print(f"📤 Uploading '{INPUT_PDF}' to Google AI...")
    pdf_file = genai.upload_file(path=INPUT_PDF)

    # We use gemini-3.5-flash as it is fast, cheap, and excellent at extraction/math
    model = genai.GenerativeModel(model_name="gemini-3.5-flash")

    # The prompt explicitly defines the schema
    prompt = """
    You are an expert math teacher and data entry specialist.
    Extract all the multiple-choice questions from the attached PDF.
    Solve each question, figure out the correct option, and write a concise, step-by-step mathematical solution.

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
    """

    print("🧠 Asking Gemini to read, solve, and convert to JSON... (This may take 30-60 seconds)")
    
    # CRITICAL: We enforce JSON output directly from the API! 
    # This prevents the AI from outputting markdown or conversational text.
    response = model.generate_content(
        [pdf_file, prompt],
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json"
        )
    )

    print("🧹 Cleaning up the uploaded PDF from Google servers...")
    pdf_file.delete()

    # Parse and save the result
    try:
        # The response text will be guaranteed JSON because of response_mime_type
        questions_data = json.loads(response.text)
        
        # Save to file
        with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
            json.dump(questions_data, f, indent=2, ensure_ascii=False)
            
        print(f"✅ SUCCESS! Extracted {len(questions_data)} questions and saved to '{OUTPUT_JSON}'")
        
    except json.JSONDecodeError as e:
        print("❌ ERROR: Failed to parse JSON. This shouldn't happen with response_mime_type.")
        print(e)
        print("Raw output:", response.text)

if __name__ == "__main__":
    main()
