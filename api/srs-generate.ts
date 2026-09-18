import type { Request, Response } from 'express';

const SYSTEM_PROMPT = `You are the Expert SSC CGL & Competitive Exam Anki Card Architect.
Your task is to generate high-yield, exam-calibrated Spaced Repetition (Anki/SRS) Flashcards for SSC CGL, Banking, and State PSC aspirants.

You cover four distinct subject domains:
1. English Vocabulary (Synonyms, Antonyms, One-Word Substitution, Idioms & Phrases, Spellings):
   - "front": Target Word, Idiom, or Question Prompt. Include Part of Speech hint if applicable (e.g. "(adj)", "(idiom)").
   - "back": Concise, accurate meaning + Example usage.
   - "mnemonic": A vivid, memorable memory hook or associative trick (e.g. "Link 'Obfuscate' with 'Confuse'").

2. General Knowledge / Awareness (Static GK, History, Polity, Geography, Science):
   - "front": High-yield factual prompt (e.g. "Which classical dance originated in Andhra Pradesh?").
   - "back": Direct factual answer + surrounding exam context.
   - "mnemonic": A factual memory hook or mnemonic if helpful.

3. Mathematics / Quantitative Aptitude (Arithmetic, Advance Math, Geometry, Algebra, Number System):
   - "front": Problem statement or formula prompt with clean mathematical clarity.
   - "conceptTested": The core mathematical concept tested (e.g. "Pythagorean Triplet", "Remainder Theorem").
   - "back": Clear step-by-step resolution and final answer.
   - "shortcutFormula": The fastest Arun Sharma / Vedic shortcut formula or digit-sum technique.
   - "trapAlert": Common error trap or deceptive distractor warning.

4. Reasoning / Mental Ability (Series, Coding-Decoding, Syllogisms, Matrices, Puzzles):
   - "front": The puzzle, series, or coding challenge.
   - "back": Step-by-step decoding logic.
   - "shortcutFormula": The pattern rule (e.g. "Alternating +1^2, -2^2").

STRICT RESPONSE FORMAT:
You MUST return ONLY a valid JSON array of card objects. Do not include markdown formatting, backticks, or introductory text.
Example schema:
[
  {
    "subject": "English" | "General Awareness" | "Mathematics" | "Reasoning",
    "type": "vocab" | "gk" | "math" | "reasoning",
    "topic": "Topic Name",
    "subtopic": "Subtopic Name",
    "front": "Front question/word/problem",
    "back": "Back answer and explanation",
    "mnemonic": "Optional memory trick",
    "shortcutFormula": "Optional shortcut trick",
    "conceptTested": "Optional concept tested",
    "trapAlert": "Optional trap warning",
    "options": { "a": "...", "b": "...", "c": "...", "d": "..." },
    "answer": "a" | "b" | "c" | "d"
  }
]`;

export default async function srsGenerateHandler(req: Request, res: Response) {
  try {
    const rawApiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
    const apiKey = rawApiKey.replace(/^["']|["']$/g, '');

    if (!apiKey) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured in server environment.'
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { prompt, textNotes, question, imageData, pdfData, subject, count = 5 } = body;

    if (!prompt && !textNotes && !question && !imageData && !pdfData) {
      return res.status(400).json({
        error: 'Please provide a prompt, study notes, question object, or an image/pdf file.'
      });
    }

    // Build the user content message
    const userParts: any[] = [];

    // If an image or PDF was uploaded (base64 inline data)
    if (imageData?.data && imageData?.mimeType) {
      userParts.push({
        inlineData: {
          data: imageData.data,
          mimeType: imageData.mimeType
        }
      });
      userParts.push({
        text: `Analyze this image document. Extract high-yield concepts or questions and generate ${count} exam-calibrated Anki flashcards.`
      });
    } else if (pdfData?.data && pdfData?.mimeType) {
      userParts.push({
        inlineData: {
          data: pdfData.data,
          mimeType: pdfData.mimeType || 'application/pdf'
        }
      });
      userParts.push({
        text: `Analyze this PDF document. Extract ${count} high-yield concept and question Anki flashcards.`
      });
    }

    let instructionText = '';
    if (question) {
      instructionText += `Convert this specific question into a high-retention Anki Flashcard with shortcut tricks, concept breakdown, and trap analysis:\n` +
        `Subject: ${question.subject || subject || 'General'}\n` +
        `Question: ${question.question || question.questionText}\n` +
        `Options: ${JSON.stringify(question.options || {})}\n` +
        `Correct Answer: ${question.answer || question.correctOption}\n` +
        `Solution: ${question.solution || ''}\n` +
        `Topic: ${question.topic || ''}\n`;
    }

    if (textNotes) {
      instructionText += `\nTransform these study notes into ${count} high-yield Anki flashcards:\n${textNotes}\n`;
    }

    if (prompt) {
      instructionText += `\nUser Prompt: ${prompt}\nTarget Subject: ${subject || 'Auto-detect'}\nNumber of Cards: ${count}\n`;
    }

    if (instructionText) {
      userParts.push({ text: instructionText });
    }

    let configuredModel = (process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || '').trim().replace(/^["']|["']$/g, '');
    const modelName = configuredModel || 'gemini-2.5-flash';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: userParts }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!geminiRes.ok) {
      const errJson = await geminiRes.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Google API error status ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const rawReply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Parse JSON safely
    let cards: any[] = [];
    try {
      const cleanJson = rawReply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      cards = JSON.parse(cleanJson);
      if (!Array.isArray(cards)) {
        if (typeof cards === 'object' && Array.isArray((cards as any).cards)) {
          cards = (cards as any).cards;
        } else {
          cards = [cards];
        }
      }
    } catch (parseErr) {
      console.error('Failed to parse Gemini cards JSON:', rawReply);
      throw new Error('AI returned non-JSON card formatting. Please try again.');
    }

    return res.status(200).json({
      success: true,
      cards: cards.map((c, i) => ({
        ...c,
        id: `srs_ai_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        source: 'ai_generated',
        addedAt: new Date().toISOString()
      }))
    });
  } catch (error: any) {
    console.error('[SRS AI Generate Error]:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate Anki cards with AI.'
    });
  }
}
