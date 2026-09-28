import { Bot, InlineKeyboard } from 'grammy';
import dotenv from 'dotenv';
import {
  generateMixedSpeedDrill,
  generateTripletsDrill,
  generateFractionsDrill,
  generateSquaresDrill,
  getSimplificationDrill,
  sanitizeTelegramQuiz,
  TelegramQuizQuestion,
  shuffle,
} from './quizData';
import {
  getTripletsStepDrill,
  getTablesStepDrill,
  getSquaresStepDrill,
  getCubesStepDrill,
  getPowersStepDrill,
  getFactorialsStepDrill,
  getFractionsStepDrill,
  getDailyRoutineWorkout,
  getSimplificationCatalog,
} from './speedLabData';
import {
  generateChainAdditionDrill,
  generateSubtractionDrill,
  generateBase100Multiplication,
  generateSquareDiffMultiplication,
  generateDecimalPercentageDrill,
  generateRatioFaceOffDrill,
  generateMentalMathBlitz,
} from './mentalMathData';
import {
  getEnglishCatalog,
  getMathCatalog,
  getGeneralAwarenessCatalog,
  getMockErrorsCatalog,
  resolveEnglishSetFile,
  resolveMathSetFile,
  resolveGASetFile,
  loadQuestionsFromSet,
  loadMockErrorsForSubject,
} from './catalog';
import {
  startSession,
  getSession,
  saveSession,
  clearSession,
  registerActivePoll,
  getSessionByPollId,
  UserQuizSession,
} from './quizSession';
import {
  recordMistake,
  markMistakeMastered,
  deleteMistake,
  getUserMistakes,
  getMistakeStats,
  getTotalMistakesSummary,
  MistakeFilter,
  isSpeedLabItem,
  getCleanQuestionKey,
} from './mistakeStore';
import {
  getMockErrorSubjectsSummary,
  getMockErrorQuestions,
} from './mockErrorBank';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '8855696196:AAFJmjYYmHcgnm_h8u1LjTD_Gvynz3R969o';
export const bot = new Bot(token);

bot.catch((err) => {
  console.error('[TelegramBot] Uncaught error during update handling:', err);
});

// ----------------------------------------------------
// ROOT & HIGH-LEVEL KEYBOARDS
// ----------------------------------------------------

function getRootMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📁 Chapter Bank', 'nav_chapter_bank')
    .row()
    .text('🎯 Mock Errors (1,004 Qs)', 'nav_mock_errors')
    .row()
    .text('📕 My Quiz Mistakes', 'nav_quiz_mistakes')
    .row()
    .text('⚡ Speed Lab', 'nav_speed_lab');
}

function getChapterBankSubjectsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📐 Math', 'cb_sub_math')
    .text('🧠 Reasoning', 'cb_sub_reasoning')
    .row()
    .text('📖 English', 'cb_sub_english')
    .text('🏛️ GK & GA', 'cb_sub_ga')
    .row()
    .text('⬅️ Back', 'nav_root');
}

// Cleans raw explanation strings for elegant Telegram card display
function cleanExplanationForTelegram(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. Remove metadata clutter like "📖 **Source:** ..." or "Source: ..."
  text = text.replace(/📖?\s*\*{0,2}Source:\*{0,2}\s*[^\n\r]+/gi, '');
  text = text.replace(/\[.*?Source.*?\]/gi, '');

  // 2. Handle vocabulary patterns like "**Target Word:** Cavalier **Synonyms:** Dismissive, careless"
  const targetWordMatch = text.match(/\*{0,2}Target Word:\*{0,2}\s*([^*]+?)(?=\*{0,2}(?:Synonyms|Antonyms|Meaning|$))/i);
  const synonymsMatch = text.match(/\*{0,2}Synonyms?:\*{0,2}\s*([^*]+?)(?=\*{0,2}(?:Antonyms|Meaning|Source|$))/i);
  const antonymsMatch = text.match(/\*{0,2}Antonyms?:\*{0,2}\s*([^*]+?)(?=\*{0,2}(?:Meaning|Source|$))/i);

  if (targetWordMatch && (synonymsMatch || antonymsMatch)) {
    const word = targetWordMatch[1].trim();
    const syns = synonymsMatch ? synonymsMatch[1].trim() : '';
    const ants = antonymsMatch ? antonymsMatch[1].trim() : '';
    let result = `*${word}*`;
    if (syns) result += ` ➔ *Syn:* ${syns}`;
    if (ants) result += ` | *Ant:* ${ants}`;
    return result;
  }

  // 3. Clean up common markdown artifacts and convert ** to Telegram single *
  text = text.replace(/\*\*(.*?)\*\*/g, '*$1*');
  text = text.replace(/\\n/g, ' ').replace(/\s+/g, ' ');
  text = text.replace(/^\s*Solution\s*:?/i, '').trim();

  // 4. Truncate gracefully to ~150 chars if too long
  if (text.length > 150) {
    text = text.slice(0, 147).trim() + '...';
  }

  return text.trim();
}

// ----------------------------------------------------
// SYNC PAYLOAD ENCODING FOR WEB NOTEBOOK TRANSFER
// ----------------------------------------------------

export function encodeQuestionForSync(q: TelegramQuizQuestion): string {
  const min = {
    id: q.id,
    q: (q.question || '').slice(0, 250),
    opts: (q.options || []).slice(0, 4).map((o) => String(o).slice(0, 60)),
    ans: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
    exp: (q.explanation || q.fullSolution || '').slice(0, 300),
    sub: q.subject || 'general_awareness',
    top: (q.topic || 'Telegram Quiz').slice(0, 40),
  };
  return Buffer.from(JSON.stringify(min), 'utf8').toString('base64url');
}

export function encodeBatchForSync(questions: TelegramQuizQuestion[]): string {
  // Compact tuple format: [id, q, opts, ans, exp, sub, top]
  const list = questions.slice(0, 20).map((q) => [
    q.id || '',
    (q.question || '').slice(0, 120),
    (q.options || []).slice(0, 4).map((o) => String(o).slice(0, 40)),
    typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
    (q.fullSolution || q.explanation || '').slice(0, 140),
    q.subject || 'general_awareness',
    (q.topic || 'Telegram Quiz').slice(0, 30),
  ]);
  return Buffer.from(JSON.stringify(list), 'utf8').toString('base64url');
}

export function buildSafeWebSyncUrl(questions: TelegramQuizQuestion[]): string {
  if (!questions || questions.length === 0) {
    return 'https://ssc27.vercel.app/?view=botErrors';
  }

  // Reverse so newest mistakes are prioritized first
  const listToSync = [...questions].reverse();

  // Telegram InlineKeyboardButton url has a strict 2048-byte limit; keep safely <= 1800 chars
  let count = Math.min(listToSync.length, 20);
  while (count > 0) {
    const slice = listToSync.slice(0, count);
    const payload = encodeBatchForSync(slice);
    const candidateUrl = `https://ssc27.vercel.app/?view=botErrors&syncBatch=${payload}`;
    if (candidateUrl.length <= 1800) {
      return candidateUrl;
    }
    count--;
  }

  // Fallback to single question payload
  if (listToSync.length > 0) {
    const singlePayload = encodeQuestionForSync(listToSync[0]);
    const singleUrl = `https://ssc27.vercel.app/?view=botErrors&syncQ=${singlePayload}`;
    if (singleUrl.length <= 1800) {
      return singleUrl;
    }
  }

  return 'https://ssc27.vercel.app/?view=botErrors';
}

// ----------------------------------------------------
// QUIZ ENGINE DISPATCH
// ----------------------------------------------------

async function sendCurrentQuestion(botInstance: Bot, session: UserQuizSession) {
  if (session.currentIndex >= session.questions.length) {
    await sendCompletionSummary(botInstance, session);
    return;
  }

  const q = session.questions[session.currentIndex];
  const qNum = session.currentIndex + 1;
  const prompt = (q.question || 'Question').trim().slice(0, 298);

  // Sanitize options for Telegram (1-100 chars each, 2-10 options)
  let cleanOptions = (q.options || []).map((opt) => String(opt).trim().slice(0, 98));
  if (cleanOptions.length < 2) {
    cleanOptions = ['Option A', 'Option B'];
  } else if (cleanOptions.length > 10) {
    cleanOptions = cleanOptions.slice(0, 10);
  }

  // Ensure correct option index is within bounds
  let correctIdx = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0;
  if (correctIdx < 0 || correctIdx >= cleanOptions.length) {
    correctIdx = 0;
  }

  // Telegram explanation in sendPoll must be strictly max 200 chars without entities
  let shortExplanation: string | undefined = undefined;
  if (q.explanation) {
    const rawClean = q.explanation.replace(/[*_`[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (rawClean.length > 0) {
      shortExplanation = rawClean.slice(0, 195);
    }
  }

  try {
    const pollMsg = await botInstance.api.sendPoll(
      session.chatId,
      prompt,
      cleanOptions,
      {
        type: 'quiz',
        correct_option_id: correctIdx,
        explanation: shortExplanation,
        is_anonymous: false,
      } as any
    );

    registerActivePoll(pollMsg.poll.id, session.userId);
  } catch (err: any) {
    console.error(`[TelegramBot] Error sending quiz poll (Q${qNum}):`, err?.message || err);
    session.currentIndex++;
    await sendCurrentQuestion(botInstance, session);
  }
}

async function sendCompletionSummary(botInstance: Bot, session: UserQuizSession) {
  const durationSec = Math.max(1, Math.round((Date.now() - session.startTime) / 1000));
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const timeFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const total = session.questions.length;
  const score = session.score;
  const percentage = Math.round((score / total) * 100);
  const speedPerQ = (durationSec / total).toFixed(1);

  let medal = '🎯';
  let comment = '';
  if (percentage >= 90) {
    medal = '🏆 OUTSTANDING!';
    comment = 'Flawless accuracy! Your mastery is exam-ready.';
  } else if (percentage >= 70) {
    medal = '🔥 WELL DONE!';
    comment = 'Solid accuracy. Review the few missed concepts.';
  } else if (percentage >= 50) {
    medal = '👍 GOOD EFFORT!';
    comment = 'Decent foundation, repeat to improve speed.';
  } else {
    medal = '💪 KEEP DRILLING!';
    comment = 'Review explanations and practice once more.';
  }

  const report =
    `${medal}\n\n` +
    `*${session.drillTitle}*\n\n` +
    `• Score: *${score} / ${total}* (${percentage}%)\n` +
    `• Time: *${timeFormatted}* (${speedPerQ}s / q)\n\n` +
    `_${comment}_`;

  const afterQuizKeyboard = new InlineKeyboard();

  const isSpeedLab = session.category === 'speed_lab' || /speed|mental math|calc studio|routine|blitz/i.test(session.drillTitle);

  if (!isSpeedLab) {
    const missedInSession = (session.missedQuestions && session.missedQuestions.length > 0)
      ? session.missedQuestions
      : (score < total ? session.questions.slice(0, 25) : []);

    const allUserMistakes = getUserMistakes(session.userId, 'all');
    const combinedMap = new Map<string, TelegramQuizQuestion>();
    for (const q of allUserMistakes) {
      if (!isSpeedLabItem(q)) {
        const key = getCleanQuestionKey(q.question, q.id);
        if (key && !combinedMap.has(key)) combinedMap.set(key, q);
      }
    }
    for (const q of missedInSession) {
      if (!isSpeedLabItem(q)) {
        const key = getCleanQuestionKey(q.question, q.id);
        if (key && !combinedMap.has(key)) combinedMap.set(key, q);
      }
    }
    const combinedList = Array.from(combinedMap.values());

    if (combinedList.length > 0) {
      const syncUrl = buildSafeWebSyncUrl(combinedList);
      afterQuizKeyboard
        .url(`📖 View Solutions & AI Tutor on Web`, syncUrl)
        .row();
    }
  }

  afterQuizKeyboard
    .text('📁 Chapter Bank', 'nav_chapter_bank')
    .text('🎯 Mock Errors', 'nav_mock_errors')
    .row()
    .text('⚡ Speed Lab', 'nav_speed_lab')
    .text('🏠 Menu', 'nav_root');

  clearSession(session.userId);

  try {
    await botInstance.api.sendMessage(session.chatId, report, {
      parse_mode: 'Markdown',
      reply_markup: afterQuizKeyboard,
    });
  } catch (err: any) {
    console.warn('[sendCompletionSummary] Markup error, falling back:', err?.message || err);
    const safeKb = new InlineKeyboard()
      .text('📁 Chapter Bank', 'nav_chapter_bank')
      .text('🎯 Mock Errors', 'nav_mock_errors')
      .row()
      .text('⚡ Speed Lab', 'nav_speed_lab')
      .text('🏠 Menu', 'nav_root');
    await botInstance.api.sendMessage(session.chatId, report.replace(/[*_`]/g, ''), {
      reply_markup: safeKb,
    }).catch(() => {});
  }
}

async function startQuizForUser(
  userId: number,
  chatId: number,
  title: string,
  questions: TelegramQuizQuestion[],
  category: 'chapter_bank' | 'mock_errors' | 'speed_lab' | 'other' = 'chapter_bank'
) {
  if (!questions || questions.length === 0) {
    await bot.api.sendMessage(
      chatId,
      `No questions found for *${title}*.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getRootMenuKeyboard(),
      }
    );
    return;
  }

  const session = startSession(userId, chatId, title, questions, category);
  await sendCurrentQuestion(bot, session);
}

// ----------------------------------------------------
// COMMAND HANDLERS
// ----------------------------------------------------

async function handleSyncCommand(ctx: any) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const mistakes = getUserMistakes(userId);
  const session = getSession(userId);
  const missedInSession = session?.missedQuestions || [];

  const combinedMap = new Map<string, TelegramQuizQuestion>();
  for (const q of mistakes) {
    const key = q.id || q.question.trim().toLowerCase();
    combinedMap.set(key, q);
  }
  for (const q of missedInSession) {
    const key = q.id || q.question.trim().toLowerCase();
    combinedMap.set(key, q);
  }

  const allMistakes = Array.from(combinedMap.values());

  if (allMistakes.length === 0) {
    await ctx.reply(
      `📱 *Sync with Web Mistake Notebook*\n\n` +
      `No mistakes recorded on Telegram yet! When you practice questions in any quiz from /menu, incorrect questions will automatically be ready to sync here.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getRootMenuKeyboard(),
      }
    );
    return;
  }

  const syncUrl = buildSafeWebSyncUrl(allMistakes);

  const keyboard = new InlineKeyboard()
    .url(`🚀 Open & Sync Mistakes on Web`, syncUrl)
    .row()
    .text('🏠 Main Menu', 'nav_root');

  try {
    await ctx.reply(
      `📱 *Telegram Mistake Sync Ready!*\n\n` +
      `Found *${allMistakes.length}* question(s) recorded from your Telegram quiz practice.\n\n` +
      `Tap the button below to instantly import them into your **Web Notebook**, view full step-by-step solutions, and practice with the AI Tutor!`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  } catch (syncErr: any) {
    console.warn('[handleSyncCommand] Error sending sync keyboard, falling back:', syncErr?.message || syncErr);
    await ctx.reply(
      `📱 *Telegram Mistake Sync Ready!*\n\n` +
      `Found *${allMistakes.length}* question(s) recorded from your Telegram quiz practice.\n\n` +
      `Open your Web Notebook at https://ssc27.vercel.app/?view=botErrors to review!`,
      {
        reply_markup: new InlineKeyboard().url('🚀 Open Web Notebook', 'https://ssc27.vercel.app/?view=botErrors').row().text('🏠 Main Menu', 'nav_root'),
      }
    ).catch(() => {});
  }
}

bot.command(['start', 'menu'], async (ctx) => {
  if (ctx.match && ctx.match.trim() === 'sync') {
    return handleSyncCommand(ctx);
  }
  const name = ctx.from?.first_name || 'Aspirant';
  const text = `🎯 *SSC CGL Practice Cockpit*\nWelcome, ${name}! Choose a section to drill:`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
});

bot.command('sync', handleSyncCommand);

bot.command('stop', async (ctx) => {
  const session = getSession(ctx.from!.id);
  if (!session) {
    await ctx.reply('No active drill running. Send /menu to start one.');
    return;
  }
  await sendCompletionSummary(bot, session);
});

bot.command('delete', async (ctx) => {
  const session = getSession(ctx.from!.id);
  if (session) {
    const q = session.questions[session.currentIndex];
    if (q) {
      deleteMistake(ctx.from!.id, q.id, q.question);
      await ctx.reply('🗑️ Current question removed from your Mistake Bank and synced with Firebase.');
      return;
    }
  }
  await ctx.reply('No active drill running. You can delete mistakes from the topic menu or directly from the web app.');
});

bot.command('help', async (ctx) => {
  const helpText =
    `💡 *CGL Bot Guide*\n\n` +
    `• /menu — Open the main category menu\n` +
    `• /stop — Finish active test and show score card\n` +
    `• /delete — Remove current active mistake question from database\n` +
    `• Tap any option on quiz polls to answer immediately.`;

  await ctx.reply(helpText, {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
});

// ----------------------------------------------------
// NAVIGATION: ROOT & SUBJECTS
// ----------------------------------------------------

bot.callbackQuery('nav_root', async (ctx) => {
  await ctx.editMessageText('🎯 *SSC CGL Practice Cockpit*\nChoose a section to drill:', {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('nav_chapter_bank', async (ctx) => {
  await ctx.editMessageText('📁 *Chapter Bank*\nSelect a subject:', {
    parse_mode: 'Markdown',
    reply_markup: getChapterBankSubjectsKeyboard(),
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// ENGLISH CHAPTER BANK (Black Book vs Ayush)
// ----------------------------------------------------

bot.callbackQuery('cb_sub_english', async (ctx) => {
  const sections = getEnglishCatalog();
  const kb = new InlineKeyboard();

  for (const sec of sections) {
    kb.text(sec.title, `eng_sec:${sec.code}`).row();
  }
  kb.text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText('📖 *English Chapter Bank:* Choose a book/source:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^eng_sec:(bb|ayush)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const secCode = ctx.match[1];
  const sections = getEnglishCatalog();
  const sec = sections.find((s) => s.code === secCode);
  if (!sec) return;

  const kb = new InlineKeyboard();
  for (const topic of sec.topics) {
    kb.text(`${topic.title} (${topic.sets.length} Sets)`, `eng_top:${secCode}:${topic.code}`).row();
  }
  kb.text('⬅️ Back to Books', 'cb_sub_english');

  await ctx.editMessageText(`📖 *${sec.title}:*\nChoose a vocabulary topic:`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^eng_top:(bb|ayush):([a-z_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const secCode = ctx.match[1];
  const topicCode = ctx.match[2];
  const sections = getEnglishCatalog();
  const sec = sections.find((s) => s.code === secCode);
  const topic = sec?.topics.find((t) => t.code === topicCode);
  if (!topic) return;

  const kb = new InlineKeyboard();
  for (let i = 0; i < topic.sets.length; i += 2) {
    const s1 = topic.sets[i];
    const s2 = topic.sets[i + 1];

    kb.text(`${s1.title} (${s1.totalQuestions} Qs)`, `eng_set:${secCode}:${topicCode}:${s1.code}`);
    if (s2) {
      kb.text(`${s2.title} (${s2.totalQuestions} Qs)`, `eng_set:${secCode}:${topicCode}:${s2.code}`);
    }
    kb.row();
  }
  kb.text('⬅️ Back to Topics', `eng_sec:${secCode}`);

  await ctx.editMessageText(`🔤 *${topic.title}* (${topic.sets.length} Sets Available):\nSelect a set to practice:`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^eng_set:(bb|ayush):([a-z_]+):([a-zA-Z0-9_\-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, secCode, topicCode, setCode] = ctx.match;
  const setInfo = resolveEnglishSetFile(secCode, topicCode, setCode);
  const kb = new InlineKeyboard()
    .text(`🚀 All (${setInfo.total} Qs)`, `run_eng:${secCode}:${topicCode}:${setCode}:all`)
    .text('⚡ Quick 10', `run_eng:${secCode}:${topicCode}:${setCode}:10`)
    .row()
    .text('⬅️ Back', `eng_top:${secCode}:${topicCode}`);

  await ctx.editMessageText(`📖 *${setInfo.title}* • ${setInfo.total} Questions`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^run_eng:(bb|ayush):([a-z_]+):([a-zA-Z0-9_\-]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, secCode, topicCode, setCode, mode] = ctx.match;
  const setInfo = resolveEnglishSetFile(secCode, topicCode, setCode);
  if (!setInfo) return;

  const qs = loadQuestionsFromSet(setInfo.filePath, mode as 'all' | '10');
  const modeLabel = mode === 'all' ? `All ${qs.length} Questions` : 'Quick 10';
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `${setInfo.title} (${modeLabel})`, qs, 'chapter_bank');
});

// ----------------------------------------------------
// MATHEMATICS CHAPTER BANK (Top 500 & Pinnacle)
// ----------------------------------------------------

bot.callbackQuery('cb_sub_math', async (ctx) => {
  const mathSections = getMathCatalog();
  const kb = new InlineKeyboard();

  for (const sec of mathSections) {
    kb.text(sec.title, `math_sec:${sec.code}`).row();
  }
  kb.text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText('📐 *Mathematics Chapter Bank:* Select module:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^math_sec:(t500|pinnacle)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const secCode = ctx.match[1];
  const mathSections = getMathCatalog();
  const sec = mathSections.find((s) => s.code === secCode);
  if (!sec) return;

  const kb = new InlineKeyboard();
  for (let i = 0; i < sec.topics.length; i += 2) {
    const t1 = sec.topics[i];
    const t2 = sec.topics[i + 1];

    kb.text(t1.title, `math_top:${t1.code}`);
    if (t2) {
      kb.text(t2.title, `math_top:${t2.code}`);
    }
    kb.row();
  }
  kb.text('⬅️ Back to Modules', 'cb_sub_math');

  await ctx.editMessageText(`📐 *${sec.title}:*\nChoose a chapter to drill:`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^math_top:([a-z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const topicCode = ctx.match[1];
  const catalog = getMathCatalog();
  let topicFound: any = null;
  for (const sec of catalog) {
    const t = sec.topics.find((x) => x.code === topicCode || x.id.toLowerCase() === topicCode.toLowerCase());
    if (t) {
      topicFound = t;
      break;
    }
  }
  if (!topicFound) return;

  const kb = new InlineKeyboard();
  for (const s of topicFound.sets) {
    kb.text(`▶️ ${s.title} (${s.totalQuestions} Qs)`, `math_set:${topicCode}:${s.code}`).row();
  }
  kb.text('⬅️ Back to Math Chapters', 'cb_sub_math');

  await ctx.editMessageText(`📊 *${topicFound.title}:*\nSelect set to practice:`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^math_set:([a-zA-Z0-9_\-]+):([a-zA-Z0-9_\-]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, topicCode, setCode] = ctx.match;
  const setInfo = resolveMathSetFile(topicCode, setCode);
  if (!setInfo) return;

  const kb = new InlineKeyboard()
    .text(`🚀 All (${setInfo.total} Qs)`, `run_math:${topicCode}:${setCode}:all`)
    .text('⚡ Quick 10', `run_math:${topicCode}:${setCode}:10`)
    .row()
    .text('⬅️ Back', `math_top:${topicCode}`);

  await ctx.editMessageText(`📐 *${setInfo.title}* • ${setInfo.total} Questions`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^run_math:([a-zA-Z0-9_\-]+):([a-zA-Z0-9_\-]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, topicCode, setCode, mode] = ctx.match;
  const setInfo = resolveMathSetFile(topicCode, setCode);
  if (!setInfo) return;

  const qs = loadQuestionsFromSet(setInfo.filePath, mode as 'all' | '10');
  const modeLabel = mode === 'all' ? `All ${qs.length} Questions` : 'Quick 10';
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `${setInfo.title} (${modeLabel})`, qs, 'chapter_bank');
});

// ----------------------------------------------------
// GENERAL AWARENESS CHAPTER BANK
// ----------------------------------------------------

bot.callbackQuery('cb_sub_ga', async (ctx) => {
  const topics = getGeneralAwarenessCatalog();
  const kb = new InlineKeyboard();

  for (let i = 0; i < topics.length; i += 2) {
    const t1 = topics[i];
    const t2 = topics[i + 1];

    kb.text(t1.title, `ga_top:${t1.code}`);
    if (t2) {
      kb.text(t2.title, `ga_top:${t2.code}`);
    }
    kb.row();
  }
  kb.text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText('🏛️ *General Awareness:* Select a subject:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^ga_top:([a-z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const topicCode = ctx.match[1];
  const topics = getGeneralAwarenessCatalog();
  const topic = topics.find((t) => t.code === topicCode || t.id === topicCode);
  if (!topic) return;

  const kb = new InlineKeyboard();
  for (const s of topic.sets) {
    kb.text(`${s.title} (${s.totalQuestions} Qs)`, `ga_set:${topicCode}:${s.code}`).row();
  }
  kb.text('⬅️ Back to GA Subjects', 'cb_sub_ga');

  await ctx.editMessageText(`🏛️ *${topic.title}* (${topic.sets.length} Chapters):\nChoose a chapter to practice:`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^ga_set:([a-z0-9_]+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, topicCode, setCode] = ctx.match;
  const setInfo = resolveGASetFile(topicCode, setCode);
  if (!setInfo) return;

  const kb = new InlineKeyboard()
    .text(`🚀 All (${setInfo.total} Qs)`, `run_ga:${topicCode}:${setCode}:all`)
    .text('⚡ Quick 10', `run_ga:${topicCode}:${setCode}:10`)
    .row()
    .text('⬅️ Back', `ga_top:${topicCode}`);

  await ctx.editMessageText(`🏛️ *${setInfo.title}* • ${setInfo.total} Questions`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^run_ga:([a-zA-Z0-9_\-]+):(.+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, topicCode, setCode, mode] = ctx.match;
  const setInfo = resolveGASetFile(topicCode, setCode);
  if (!setInfo) return;

  const qs = loadQuestionsFromSet(setInfo.filePath, mode as 'all' | '10');
  const modeLabel = mode === 'all' ? `All ${qs.length} Questions` : 'Quick 10';
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `${setInfo.title} (${modeLabel})`, qs, 'chapter_bank');
});

// ----------------------------------------------------
// REASONING
// ----------------------------------------------------

bot.callbackQuery('cb_sub_reasoning', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('🎯 Practice ALL Reasoning Mock Mistakes', 'run_mock:reasoning:all')
    .row()
    .text('⚡ Quick 10 Reasoning Mistakes', 'run_mock:reasoning:10')
    .row()
    .text('📁 Browse Reasoning Chapters', 'me_sub:reas')
    .row()
    .text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText('🧠 *Reasoning Mock Mistakes:*\nSelect practice mode below:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// UNIFIED MISTAKE BANK (OPTION 3: SOURCE FILTER & TOPIC BREAKDOWN)
// ----------------------------------------------------

const SHORT_TO_SUB: Record<string, 'english' | 'mathematics' | 'reasoning' | 'general_awareness'> = {
  eng: 'english',
  math: 'mathematics',
  reas: 'reasoning',
  ga: 'general_awareness',
};

const SUB_TO_SHORT: Record<string, string> = {
  english: 'eng',
  mathematics: 'math',
  reasoning: 'reas',
  general_awareness: 'ga',
};

// ----------------------------------------------------
// SECTION A: MOCK ERRORS (THE 1,004 FULL MOCK TEST QUESTIONS)
// ----------------------------------------------------

bot.callbackQuery('nav_mock_errors', async (ctx) => {
  const subjects = getMockErrorSubjectsSummary();
  const totalMockQs = subjects.reduce((sum, s) => sum + s.total, 0);

  const kb = new InlineKeyboard();
  for (const s of subjects) {
    kb.text(`${s.title} (${s.total} Qs)`, `me_sub:${s.shortCode}`).row();
  }
  kb.text('⬅️ Back to Menu', 'nav_root');

  const text =
    `🎯 *SSC CGL Mock Test Errors*\n\n` +
    `*${totalMockQs}* real questions from your full mock exams, organized by subject and chapter.\n\n` +
    `Select a subject to drill:`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

// Subject Chapter List for Mock Errors
bot.callbackQuery(/^me_sub:(eng|math|reas|ga)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const subCode = ctx.match[1];
  const subjectId = SHORT_TO_SUB[subCode];
  const subjects = getMockErrorSubjectsSummary();
  const subInfo = subjects.find((s) => s.shortCode === subCode);
  if (!subInfo) return;

  const kb = new InlineKeyboard();
  // Quick drill buttons
  kb.text(`🔥 Drill All (${subInfo.total} Qs)`, `me_run:${subCode}:_:all`)
    .text('⚡ Quick 10', `me_run:${subCode}:_:10`)
    .row();

  // Chapters list
  for (const ch of subInfo.chapters) {
    kb.text(`${ch.name} (${ch.count})`, `me_top:${subCode}:${ch.slug}`).row();
  }
  kb.text('⬅️ Back to Mock Errors', 'nav_mock_errors');

  const text =
    `🎯 *${subInfo.title} Mock Errors*\n` +
    `Total: *${subInfo.total}* questions across ${subInfo.chapters.length} chapters.\n\n` +
    `Choose a chapter to practice or start a full session:`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

// Topic Drill Options for Mock Errors
bot.callbackQuery(/^me_top:(eng|math|reas|ga):([a-z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subCode, slug] = ctx.match;
  const subjectId = SHORT_TO_SUB[subCode];
  const subjects = getMockErrorSubjectsSummary();
  const subInfo = subjects.find((s) => s.shortCode === subCode);
  const chapter = subInfo?.chapters.find((c) => c.slug === slug);
  const chTitle = chapter?.name || 'Mock Chapter';
  const count = chapter?.count || 0;

  const kb = new InlineKeyboard()
    .text(`🔥 Practice All (${count} Qs)`, `me_run:${subCode}:${slug}:all`)
    .text('⚡ Quick 10', `me_run:${subCode}:${slug}:10`)
    .row()
    .text('⬅️ Back to Chapters', `me_sub:${subCode}`);

  await ctx.editMessageText(
    `📌 *${chTitle}*\n` +
    `Source: *Full Mock Test Series* • *${count}* Questions\n\n` +
    `Choose drill length:`,
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
});

// Execute Mock Error Drill
bot.callbackQuery(/^me_run:(eng|math|reas|ga):([a-z0-9_]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subCode, slug, mode] = ctx.match;
  const subjectId = SHORT_TO_SUB[subCode];
  const questions = getMockErrorQuestions(subjectId, slug === '_' ? undefined : slug, mode as 'all' | '10');

  if (!questions || questions.length === 0) {
    await ctx.reply('No questions found for this selection.', {
      reply_markup: getRootMenuKeyboard(),
    });
    return;
  }

  const subjects = getMockErrorSubjectsSummary();
  const subInfo = subjects.find((s) => s.shortCode === subCode);
  const chapter = subInfo?.chapters.find((c) => c.slug === slug);
  const label = chapter ? chapter.name : subInfo?.title || 'Mock Errors';

  await startQuizForUser(
    ctx.from.id,
    ctx.chat!.id,
    `🎯 ${label} (${mode === 'all' ? `All ${questions.length}` : 'Quick 10'})`,
    questions,
    'mock_errors'
  );
});

// ----------------------------------------------------
// SECTION B: MY QUIZ MISTAKES (LIVE WRONG ANSWERS FROM TELEGRAM & WEBSITE QUIZZES)
// ----------------------------------------------------

async function showQuizMistakesMenu(ctx: any, isEdit = false) {
  const userId = ctx.from?.id || 0;
  const stats = getMistakeStats(userId, 'all');
  const totalMistakes = stats.reduce((sum, s) => sum + s.total, 0);

  if (totalMistakes === 0) {
    const emptyKb = new InlineKeyboard()
      .text('📁 Practice Chapter Bank', 'nav_chapter_bank')
      .row()
      .text('🎯 Practice Mock Errors', 'nav_mock_errors')
      .row()
      .text('⬅️ Back to Menu', 'nav_root');

    const emptyText =
      `📕 *My Quiz Mistakes Notebook*\n\n` +
      `✨ *Zero pending mistakes!*\n\n` +
      `All mistakes from *Chapter Bank* and *Mock Errors* automatically collect together in this notebook for unified revision.\n\n` +
      `Start practicing from /menu, and any missed questions will appear here!`;

    if (isEdit) {
      await ctx.editMessageText(emptyText, {
        parse_mode: 'Markdown',
        reply_markup: emptyKb,
      }).catch(() => {});
    } else {
      await ctx.reply(emptyText, {
        parse_mode: 'Markdown',
        reply_markup: emptyKb,
      });
    }
    return;
  }

  const kb = new InlineKeyboard();
  kb.text(`🔥 Drill All Mistakes (${totalMistakes} Qs)`, `qm_run_all:all`)
    .text('⚡ Quick 10', `qm_run_all:10`)
    .row();

  const allUserMistakes = getUserMistakes(userId, 'all');
  if (allUserMistakes.length > 0) {
    const syncUrl = buildSafeWebSyncUrl(allUserMistakes);
    kb.url('📖 View Full Solutions on Web', syncUrl).row();
  }

  for (const s of stats) {
    if (s.total > 0) {
      kb.text(`${s.title} (${s.total} Mistakes)`, `qm_sub:${s.shortCode}`).row();
    }
  }
  kb.text('⬅️ Back to Menu', 'nav_root');

  const text =
    `📕 *My Quiz Mistakes Notebook*\n\n` +
    `You have *${totalMistakes}* combined mistakes from your *Chapter Bank* and *Mock Errors* practice.\n\n` +
    `Drill all your mistakes or select a subject below:`;

  if (isEdit) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: kb,
      });
    } catch (err: any) {
      console.warn('[nav_quiz_mistakes] Error editing message with rich markup, falling back:', err?.message || err);
      const safeKb = new InlineKeyboard();
      safeKb.text(`🔥 Drill All Mistakes (${totalMistakes} Qs)`, `qm_run_all:all`)
        .text('⚡ Quick 10', `qm_run_all:10`)
        .row();
      safeKb.url('📖 View Mistakes on Web', 'https://ssc27.vercel.app/?view=botErrors').row();
      for (const s of stats) {
        if (s.total > 0) {
          safeKb.text(`${s.title} (${s.total} Mistakes)`, `qm_sub:${s.shortCode}`).row();
        }
      }
      safeKb.text('⬅️ Back to Menu', 'nav_root');
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: safeKb,
      }).catch(() => {});
    }
  } else {
    try {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: kb,
      });
    } catch {
      await ctx.reply(text.replace(/[*_`]/g, ''), {
        reply_markup: new InlineKeyboard()
          .text(`🔥 Drill All Mistakes (${totalMistakes} Qs)`, `qm_run_all:all`)
          .text('⚡ Quick 10', `qm_run_all:10`)
          .row()
          .url('📖 View Mistakes on Web', 'https://ssc27.vercel.app/?view=botErrors').row()
          .text('⬅️ Back to Menu', 'nav_root'),
      }).catch(() => {});
    }
  }
}

bot.callbackQuery('nav_quiz_mistakes', async (ctx) => {
  await showQuizMistakesMenu(ctx, true);
  await ctx.answerCallbackQuery().catch(() => {});
});

bot.command(['mistakes', 'errors', 'mymistakes'], async (ctx) => {
  await showQuizMistakesMenu(ctx, false);
});

// Drill All Mistakes across all subjects
bot.callbackQuery(/^qm_run_all:(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const mode = ctx.match[1];
  let questions = getUserMistakes(ctx.from.id, 'all');

  if (!questions || questions.length === 0) {
    await ctx.reply('No active mistakes found! Keep practicing to master concepts.', {
      reply_markup: getRootMenuKeyboard(),
    });
    return;
  }

  if (mode === '10' && questions.length > 10) {
    questions = shuffle(questions).slice(0, 10);
  } else {
    questions = shuffle(questions);
  }

  await startQuizForUser(
    ctx.from.id,
    ctx.chat!.id,
    `📕 All Quiz Mistakes (${mode === 'all' ? `All ${questions.length}` : 'Quick 10'})`,
    questions,
    'mock_errors'
  );
});

// Subject Chapter List for Quiz Mistakes
bot.callbackQuery(/^qm_sub:(eng|math|reas|ga)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const subCode = ctx.match[1];
  const subjectId = SHORT_TO_SUB[subCode];
  const stats = getMistakeStats(ctx.from.id, 'all');
  const subStat = stats.find((s) => s.shortCode === subCode);
  if (!subStat || subStat.total === 0) {
    await ctx.editMessageText(`✅ All ${subCode.toUpperCase()} mistakes have been mastered!`, {
      reply_markup: new InlineKeyboard().text('⬅️ Back to Mistakes', 'nav_quiz_mistakes'),
    });
    return;
  }

  const kb = new InlineKeyboard();
  kb.text(`🔥 Drill All (${subStat.total} Qs)`, `qm_run:${subCode}:_:all`)
    .text('⚡ Quick 10', `qm_run:${subCode}:_:10`)
    .row();

  for (const t of subStat.topics) {
    if (t.count > 0) {
      kb.text(`${t.topic} (${t.count})`, `qm_top:${subCode}:${t.slug}`).row();
    }
  }
  kb.text('⬅️ Back to Mistakes', 'nav_quiz_mistakes');

  await ctx.editMessageText(
    `📕 *${subStat.title} Mistakes*\n` +
    `Total: *${subStat.total}* wrong questions to revise.\n\n` +
    `Drill all or choose a specific topic:`,
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
});

// Topic Drill Options for Quiz Mistakes
bot.callbackQuery(/^qm_top:(eng|math|reas|ga):([a-z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subCode, slug] = ctx.match;
  const subjectId = SHORT_TO_SUB[subCode];
  const stats = getMistakeStats(ctx.from.id, 'all');
  const subStat = stats.find((s) => s.shortCode === subCode);
  const topicItem = subStat?.topics.find((t) => t.slug === slug);
  const topicTitle = topicItem?.topic || 'Topic Practice';
  const count = topicItem?.count || 0;

  const kb = new InlineKeyboard()
    .text(`🔥 Practice All (${count} Qs)`, `qm_run:${subCode}:${slug}:all`)
    .text('⚡ Quick 10', `qm_run:${subCode}:${slug}:10`)
    .row()
    .text('🗑️ Clear Topic Mistakes', `qm_del:${subCode}:${slug}`)
    .row()
    .text('⬅️ Back to Topics', `qm_sub:${subCode}`);

  await ctx.editMessageText(
    `📌 *${topicTitle}*\n` +
    `Mistakes logged: *${count}*\n\n` +
    `Select drill mode:`,
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
});

// Clear Quiz Topic Mistakes
bot.callbackQuery(/^qm_del:(eng|math|reas|ga):([a-z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subCode, slug] = ctx.match;
  const subjectId = SHORT_TO_SUB[subCode];

  const questions = getUserMistakes(ctx.from.id, 'all', subjectId, slug === '_' ? undefined : slug);
  for (const q of questions) {
    deleteMistake(ctx.from.id, q.id, q.question);
  }

  await ctx.editMessageText(
    `✅ *Cleared ${questions.length} Mistakes!*\n\n` +
    `These questions have been cleared from your live mistake notebook.`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('⬅️ Back to Mistakes', 'nav_quiz_mistakes'),
    }
  );
});

// Execute Quiz Mistake Drill
bot.callbackQuery(/^qm_run:(eng|math|reas|ga):([a-z0-9_]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subCode, slug, mode] = ctx.match;
  const subjectId = SHORT_TO_SUB[subCode];
  let questions = getUserMistakes(ctx.from.id, 'all', subjectId, slug === '_' ? undefined : slug);

  if (!questions || questions.length === 0) {
    await ctx.reply('No active mistakes found for this selection! Keep practicing to master concepts.', {
      reply_markup: getRootMenuKeyboard(),
    });
    return;
  }

  if (mode === '10' && questions.length > 10) {
    questions = shuffle(questions).slice(0, 10);
  }

  const subTitle = subjectId.charAt(0).toUpperCase() + subjectId.slice(1).replace('_', ' ');
  await startQuizForUser(
    ctx.from.id,
    ctx.chat!.id,
    `📕 ${subTitle} Quiz Mistakes (${mode === 'all' ? `All ${questions.length}` : 'Quick 10'})`,
    questions,
    'chapter_bank'
  );
});

// Legacy Mock routes fallback
bot.callbackQuery(/^run_mock:([a-z_]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subId, mode] = ctx.match;
  const subjectId = (subId === 'reasoning' ? 'reasoning' : subId) as any;
  let questions = getMockErrorQuestions(subjectId, undefined, mode as 'all' | '10');
  if (!questions || questions.length === 0) {
    questions = getUserMistakes(ctx.from.id, 'all', subjectId);
  }
  if (!questions || questions.length === 0) {
    await ctx.reply(`No questions found for ${subId}.`, { reply_markup: getRootMenuKeyboard() });
    return;
  }
  if (mode === '10' && questions.length > 10) {
    questions = shuffle(questions).slice(0, 10);
  }
  const subTitle = subId.charAt(0).toUpperCase() + subId.slice(1).replace('_', ' ');
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `🎯 ${subTitle} Mock Mistakes (${mode === 'all' ? `All ${questions.length}` : 'Quick 10'})`, questions, 'mock_errors');
});

bot.callbackQuery(/^run_mock_ch:([a-z_]+):([0-9]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subId, chNum, mode] = ctx.match;
  const qs = loadMockErrorsForSubject(subId as any, parseInt(chNum, 10), mode as 'all' | '10');
  const subTitle = subId.charAt(0).toUpperCase() + subId.slice(1).replace('_', ' ');
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `🎯 ${subTitle} Chapter ${chNum} Mistakes (${qs.length} Qs)`, qs, 'mock_errors');
});

// ----------------------------------------------------
// SPEED LAB NAVIGATION & STEPS
// ----------------------------------------------------

bot.callbackQuery('nav_speed_lab', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('🧠 Mental Math Studio (Arun Sharma)', 'speed_mental_math')
    .row()
    .text('🧮 Calculation Studio (7 Steps)', 'speed_calc_studio')
    .row()
    .text('📐 Simplification Drills', 'speed_simp_menu')
    .row()
    .text('🏆 Daily 25-Q Routine Workout', 'speed_routine')
    .row()
    .text('⚡ Rapid 10-Q Speed Blitz', 'speed_mixed')
    .row()
    .text('⬅️ Back to Main Menu', 'nav_root');

  await ctx.editMessageText(
    '⚡ *Speed Lab (Same as Website):*\n\n' +
      '• 🧠 *Mental Math Studio:* Addition, Subtraction, Vedic Multiplication, DI Ratios\n' +
      '• 🧮 *Calculation Studio:* Master all 7 building blocks\n' +
      '• 📐 *Simplification Drills:* Easy, Moderate, & Hard sets\n' +
      '• 🏆 *Daily Workout:* 25 questions testing all 7 steps\n\n' +
      '👉 *Choose your speed training mode:*',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// MENTAL MATH STUDIO (ARUN SHARMA SPEED LAB)
// ----------------------------------------------------

bot.callbackQuery('speed_mental_math', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('➕ Chain Addition (5–10 Nodes)', 'mm_add_menu')
    .row()
    .text('➖ Subtraction (Number Line Hops)', 'mm_sub_menu')
    .row()
    .text('✖️ Multiplication (Base 100 & Vedic)', 'mm_mult_menu')
    .row()
    .text('➗ Division & DI Ratios (10% Ladder)', 'mm_div_menu')
    .row()
    .text('🎯 Full Mental Math Blitz (12 Qs)', 'run_mm:blitz:12')
    .row()
    .text('⬅️ Back to Speed Lab', 'nav_speed_lab');

  await ctx.editMessageText(
    '🧠 *Mental Math Studio (Arun Sharma Techniques)*\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      '• *Addition:* Left-to-right running sum in working memory\n' +
      '• *Subtraction:* Forward hops on the number line (zero borrowing)\n' +
      '• *Multiplication:* Base-100 deviations & a² − b² midpoint squares\n' +
      '• *Division:* 10% & 1% mental brackets & DI ratio face-off\n\n' +
      '👉 *Select a module to drill:*',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('mm_add_menu', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('⚡ Sprint 5-Nodes (10 Questions)', 'run_mm:add_5:10')
    .row()
    .text('🚀 Stamina 10-Nodes (10 Questions)', 'run_mm:add_10:10')
    .row()
    .text('⬅️ Back to Mental Math', 'speed_mental_math');

  await ctx.editMessageText(
    '➕ *Chain Addition (Running Mental Sum)*\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      'Add numbers left-to-right mentally without writing down intermediate steps.\n\n' +
      'Select drill mode:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('mm_sub_menu', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('⚡ 2-Digit Decade Hops (10 Questions)', 'run_mm:sub_2d:10')
    .row()
    .text('🚀 3-Digit Century Crossing (10 Questions)', 'run_mm:sub_3d:10')
    .row()
    .text('⬅️ Back to Mental Math', 'speed_mental_math');

  await ctx.editMessageText(
    '➖ *Subtraction (Number Line Forward Hops)*\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      'Never borrow vertically. Jump forward from the subtrahend to nearest ten, then leap to the minuend.\n\n' +
      'Select drill mode:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('mm_mult_menu', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('⚡ Base-100 Deviations (10 Qs)', 'run_mm:mult_base:10')
    .row()
    .text('⚡ Midpoint a² − b² Squares (10 Qs)', 'run_mm:mult_mid:10')
    .row()
    .text('🚀 Comprehensive Multiplication (15 Qs)', 'run_mm:mult_mix:15')
    .row()
    .text('⬅️ Back to Mental Math', 'speed_mental_math');

  await ctx.editMessageText(
    '✖️ *Multiplication Shortcuts (Vedic & Base-100)*\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      '• Base 100: (Num1 + d2 | d1 × d2)\n' +
      '• Midpoint Squares: anchor² − diff²\n\n' +
      'Select shortcut track:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('mm_div_menu', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('⚡ Decimal % 10% Ladder (8 Qs)', 'run_mm:div_pct:8')
    .row()
    .text('⚖️ DI Ratio Face-Off (6 Qs)', 'run_mm:div_ratio:6')
    .row()
    .text('⬅️ Back to Mental Math', 'speed_mental_math');

  await ctx.editMessageText(
    '➗ *Division & DI Ratios (10% Ladder)*\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      '• Decimal %: Calculate 10% steps to bracket percentages quickly\n' +
      '• Ratio Face-Off: Relative numerator vs denominator growth\n\n' +
      'Select drill mode:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^run_mm:([a-z0-9_]+):([0-9]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, type, countStr] = ctx.match;
  const count = parseInt(countStr, 10) || 10;

  let qs: TelegramQuizQuestion[] = [];
  let title = '';

  if (type === 'add_5') {
    qs = generateChainAdditionDrill(5, count);
    title = `➕ Mental Math: Chain Addition 5-Nodes (${count} Qs)`;
  } else if (type === 'add_10') {
    qs = generateChainAdditionDrill(10, count);
    title = `➕ Mental Math: Chain Addition 10-Nodes (${count} Qs)`;
  } else if (type === 'sub_2d') {
    qs = generateSubtractionDrill('2digit', count);
    title = `➖ Mental Math: Subtraction 2-Digit Hops (${count} Qs)`;
  } else if (type === 'sub_3d') {
    qs = generateSubtractionDrill('3digit', count);
    title = `➖ Mental Math: Century Crossing Subtraction (${count} Qs)`;
  } else if (type === 'mult_base') {
    qs = generateBase100Multiplication(count);
    title = `✖️ Mental Math: Base-100 Deviations (${count} Qs)`;
  } else if (type === 'mult_mid') {
    qs = generateSquareDiffMultiplication(count);
    title = `✖️ Mental Math: Midpoint a² − b² Squares (${count} Qs)`;
  } else if (type === 'mult_mix') {
    const base = generateBase100Multiplication(8);
    const sq = generateSquareDiffMultiplication(7);
    qs = [...base, ...sq];
    title = `✖️ Mental Math: Mixed Multiplication (${qs.length} Qs)`;
  } else if (type === 'div_pct') {
    qs = generateDecimalPercentageDrill(count);
    title = `➗ Mental Math: 10% Ladder Decimal % (${count} Qs)`;
  } else if (type === 'div_ratio') {
    qs = generateRatioFaceOffDrill(count);
    title = `⚖️ Mental Math: DI Ratio Face-Off (${count} Qs)`;
  } else if (type === 'blitz') {
    qs = generateMentalMathBlitz(count);
    title = `🎯 Mental Math: Arun Sharma Blitz (${count} Qs)`;
  }

  await startQuizForUser(ctx.from.id, ctx.chat!.id, title, qs, 'speed_lab');
});

bot.callbackQuery('speed_calc_studio', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('Step 1: 📐 Triplets (16 Qs)', 'calc_step_triplets')
    .row()
    .text('Step 2: ✖️ Tables 12–24 (13 Qs)', 'calc_step_tables')
    .row()
    .text('Step 3: 🔢 Squares 17–39 (23 Qs)', 'calc_step_squares')
    .row()
    .text('Step 4: 🧊 Cubes 11–25 (15 Qs)', 'calc_step_cubes')
    .row()
    .text('Step 5: ⚡ Powers 2–9 (38 Qs)', 'calc_step_powers')
    .row()
    .text('Step 6: ❗ Factorials 1–8 (8 Qs)', 'calc_step_factorials')
    .row()
    .text('Step 7: 💯 Fractions % (73 Qs)', 'calc_step_fractions')
    .row()
    .text('⬅️ Back to Speed Lab', 'nav_speed_lab');

  await ctx.editMessageText(
    '🧮 *Calculation Studio (7 Steps)*\n━━━━━━━━━━━━━━━━━━━━━━\nSelect a step to master:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

function renderStepOptions(title: string, total: number, stepCode: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(`🚀 All (${total} Qs)`, `run_calc:${stepCode}:all`)
    .text('⚡ Quick 10', `run_calc:${stepCode}:10`)
    .row()
    .text('⬅️ Back', 'speed_calc_studio');
}

bot.callbackQuery('calc_step_triplets', async (ctx) => {
  await ctx.editMessageText('📐 *Primitive Triplets* • 16 Questions', {
    parse_mode: 'Markdown',
    reply_markup: renderStepOptions('Triplets', 16, 'triplets'),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_tables', async (ctx) => {
  await ctx.editMessageText('✖️ *Tables (12 to 24)* • 13 Questions', {
    parse_mode: 'Markdown',
    reply_markup: renderStepOptions('Tables', 13, 'tables'),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_squares', async (ctx) => {
  await ctx.editMessageText('🔢 *Squares (17² to 39²)* • 23 Questions', {
    parse_mode: 'Markdown',
    reply_markup: renderStepOptions('Squares', 23, 'squares'),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_cubes', async (ctx) => {
  await ctx.editMessageText('🧊 *Cubes (11³ to 25³)* • 15 Questions', {
    parse_mode: 'Markdown',
    reply_markup: renderStepOptions('Cubes', 15, 'cubes'),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_powers', async (ctx) => {
  await ctx.editMessageText('⚡ *Powers (2–9)* • 38 Questions', {
    parse_mode: 'Markdown',
    reply_markup: renderStepOptions('Powers', 38, 'powers'),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_factorials', async (ctx) => {
  await ctx.editMessageText('❗ *Factorials (1! to 8!)* • 8 Questions', {
    parse_mode: 'Markdown',
    reply_markup: renderStepOptions('Factorials', 8, 'factorials'),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_fractions', async (ctx) => {
  await ctx.editMessageText('💯 *Fractions ↔ %* • 73 Questions', {
    parse_mode: 'Markdown',
    reply_markup: renderStepOptions('Fractions', 73, 'fractions'),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^run_calc:([a-z0-9_]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, step, mode] = ctx.match;

  let qs: TelegramQuizQuestion[] = [];
  let title = '';

  if (step === 'triplets') {
    qs = getTripletsStepDrill(mode as any);
    title = `📐 Step 1: Triplets (${mode === 'all' ? 'All 16' : '10 Qs'})`;
  } else if (step === 'tables') {
    qs = getTablesStepDrill(mode as any);
    title = `✖️ Step 2: Tables 12–24 (${mode === 'all' ? 'All 13' : '10 Qs'})`;
  } else if (step === 'squares') {
    qs = getSquaresStepDrill(mode as any);
    title = `🔢 Step 3: Squares 17–39 (${mode === 'all' ? 'All 23' : '10 Qs'})`;
  } else if (step === 'cubes') {
    qs = getCubesStepDrill(mode as any);
    title = `🧊 Step 4: Cubes 11–25 (${mode === 'all' ? 'All 15' : '10 Qs'})`;
  } else if (step === 'powers') {
    qs = getPowersStepDrill(mode as any);
    title = `⚡ Step 5: Powers 2–9 (${mode === 'all' ? 'All 38' : '10 Qs'})`;
  } else if (step === 'factorials') {
    qs = getFactorialsStepDrill(mode as any);
    title = `❗ Step 6: Factorials 1–8 (${mode === 'all' ? 'All 8' : '10 Qs'})`;
  } else if (step === 'fractions') {
    qs = getFractionsStepDrill(mode as any);
    title = `💯 Step 7: Fractions ↔ % (${mode === 'all' ? 'All 73' : '10 Qs'})`;
  }

  await startQuizForUser(ctx.from.id, ctx.chat!.id, title, qs, 'speed_lab');
});

bot.callbackQuery('speed_simp_menu', async (ctx) => {
  const cat = getSimplificationCatalog();
  const kb = new InlineKeyboard();

  for (const c of cat) {
    kb.text(c.title, `simp_cat:${c.difficulty.toLowerCase()}`).row();
  }
  kb.text('⬅️ Back to Speed Lab', 'nav_speed_lab');

  await ctx.editMessageText('📐 *Simplification Drills*\nChoose difficulty level:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^simp_cat:([a-z]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const diffKey = ctx.match[1];
  const cat = getSimplificationCatalog();
  const chosen = cat.find((c) => c.difficulty.toLowerCase() === diffKey);
  if (!chosen) return;

  const kb = new InlineKeyboard();
  for (let i = 0; i < chosen.sets.length; i += 2) {
    const s1 = chosen.sets[i];
    const s2 = chosen.sets[i + 1];

    kb.text(`${s1.title} (10 Qs)`, `run_simp:${s1.id}`);
    if (s2) {
      kb.text(`${s2.title} (10 Qs)`, `run_simp:${s2.id}`);
    }
    kb.row();
  }
  kb.text('⬅️ Back to Difficulties', 'speed_simp_menu');

  await ctx.editMessageText(`📐 *${chosen.title}*\nSelect a set to practice:`, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^run_simp:([a-zA-Z0-9_]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const setId = ctx.match[1];
  const allSets = getSimplificationCatalog().flatMap((c) => c.sets);
  const target = allSets.find((s) => s.id === setId);
  if (!target) return;

  const questions = target.questions.map((q: any) =>
    sanitizeTelegramQuiz({
      id: q.id || `simp_${q.q_num}`,
      question: `📐 [${target.title}]\n${q.question}`,
      options: q.options,
      correctOption: q.answer || q.correctOption,
      solution: q.solution,
      subject: 'Simplification',
      topic: target.title,
      source: target.title,
    })
  );

  await startQuizForUser(ctx.from.id, ctx.chat!.id, `📐 ${target.title} (All ${questions.length} Qs)`, questions, 'speed_lab');
});

bot.callbackQuery('speed_routine', async (ctx) => {
  await ctx.answerCallbackQuery();
  const qs = getDailyRoutineWorkout();
  await startQuizForUser(ctx.from.id, ctx.chat!.id, '🏆 Daily 25-Question Routine Workout', qs, 'speed_lab');
});

bot.callbackQuery('speed_mixed', async (ctx) => {
  await ctx.answerCallbackQuery();
  await startQuizForUser(ctx.from.id, ctx.chat!.id, '⚡ Mixed Speed Blitz', generateMixedSpeedDrill(10), 'speed_lab');
});

bot.callbackQuery('nav_help', async (ctx) => {
  const helpText =
    `💡 *CGL Bot Navigation Guide*\n\n` +
    `1. *Chapter Bank* — All chapters in Math, English, GK & Reasoning.\n` +
    `2. *Mistake Bank* — Option 3 unified error notebook with source filters (Telegram Drills vs Website Mocks) & topic breakdown.\n` +
    `3. *Full Set vs Quick 10* — Practice full sets or quick 10-question sessions.\n` +
    `4. Type /stop anytime to finish early and see your score.`;

  await ctx.editMessageText(helpText, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text('⬅️ Back to Main Menu', 'nav_root'),
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// POLL ANSWER EVENT LISTENER
// ----------------------------------------------------

bot.on('poll_answer', async (ctx) => {
  const answer = ctx.pollAnswer;
  const pollId = answer.poll_id;
  const session = getSessionByPollId(pollId);

  if (!session) return;

  const currentQ = session.questions[session.currentIndex];
  if (!currentQ) return;

  const chosenOptionIndex = answer.option_ids[0];
  if (chosenOptionIndex === currentQ.correctOptionIndex) {
    session.score++;
    if (currentQ.id) {
      markMistakeMastered(session.userId, currentQ.id, currentQ.question);
    }
  } else {
    // Only record & sync mistakes for Chapter Bank and Mock Errors (never for speed drills)
    const isSpeedLab = session.category === 'speed_lab' || isSpeedLabItem(currentQ) || /speed|mental math|calc studio|routine|blitz/i.test(session.drillTitle);

    if (!isSpeedLab) {
      const source = session.category === 'mock_errors' ? 'website_mock' : 'telegram_quiz';
      recordMistake(session.userId, currentQ, source);
      if (!session.missedQuestions) {
        session.missedQuestions = [];
      }
      session.missedQuestions.push(currentQ);
    }

    const correctOpt = (currentQ.options && currentQ.options[currentQ.correctOptionIndex]) ? currentQ.options[currentQ.correctOptionIndex].trim() : '';
    const safeCorrectOpt = correctOpt.replace(/([*_`[\]()])/g, '\\$1');
    const cleanExpl = cleanExplanationForTelegram(currentQ.explanation);

    let feedbackMsg = `❌ *Incorrect*\n\n`;
    if (safeCorrectOpt) {
      feedbackMsg += `✅ *Correct:* ${safeCorrectOpt}\n`;
    }
    if (cleanExpl) {
      feedbackMsg += `💡 ${cleanExpl}\n\n`;
    } else {
      feedbackMsg += `\n`;
    }

    let replyMarkup: InlineKeyboard | undefined = undefined;
    if (!isSpeedLab) {
      feedbackMsg += `📕 _Saved to Mistake Notebook_`;
      const syncParam = encodeQuestionForSync(currentQ);
      const webMistakeUrl = (syncParam && syncParam.length < 1700)
        ? `https://ssc27.vercel.app/?view=botErrors&syncQ=${syncParam}`
        : 'https://ssc27.vercel.app/?view=botErrors';
      replyMarkup = new InlineKeyboard().url('📖 Full Solution & AI Tutor on Web', webMistakeUrl);
    }

    bot.api.sendMessage(
      session.chatId,
      feedbackMsg,
      {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }
    ).catch(() => {
      bot.api.sendMessage(
        session.chatId,
        feedbackMsg.replace(/[*_`]/g, ''),
        {
          reply_markup: replyMarkup,
        }
      ).catch(() => {});
    });
  }
  session.answeredCount++;
  session.currentIndex++;
  saveSession(session);

  // Await the 1-second pause on serverless so function remains alive and delivers the next poll
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await sendCurrentQuestion(bot, session);
  } catch (err) {
    console.error('[TelegramBot] Error sending next question:', err);
  }
});

// ----------------------------------------------------
// LOCAL CLI LAUNCHER & VERCEL HANDLER
// ----------------------------------------------------

export async function launchBot() {
  if (!token) {
    console.warn('[TelegramBot] Bot token missing, skipping startup.');
    return;
  }
  console.log('[TelegramBot] Starting full website-mirrored Telegram bot via Long Polling...');
  bot.catch((err) => {
    console.error('[TelegramBot] Error encountered:', err);
  });
  bot.start({
    onStart: (botInfo) => {
      console.log(`[TelegramBot] Connected! Bot is running as @${botInfo.username}`);
    },
  });
}

const isDirectRun = Boolean(process.argv[1]?.replace(/\\/g, '/').endsWith('src/telegram/bot.ts'));
if (isDirectRun && !process.env.VERCEL) {
  launchBot();
}

let isInitialized = false;
async function ensureInit() {
  if (!isInitialized) {
    try {
      await bot.init();
      isInitialized = true;
    } catch (err) {
      console.error('[TelegramBot] bot.init() error:', err);
    }
  }
}

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    await ensureInit();
    return res.status(200).json({
      status: 'online',
      message: 'Telegram Webhook is live 24/7 on Vercel!',
      bot: bot.botInfo ? `@${bot.botInfo.username}` : '@my_cgl_bot',
      initialized: isInitialized,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'POST') {
    try {
      await ensureInit();
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {}
      }
      if (body) {
        await bot.handleUpdate(body);
      }
      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('[VercelWebhook Error]', err);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
