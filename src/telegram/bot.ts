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

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '8573783956:AAF7SGdPHbfpJs2zH8tmQfXsUsVPBORAsHM';
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
    .text('🎯 Mock Errors', 'nav_mock_errors')
    .row()
    .text('⚡ Speed Lab', 'nav_speed_lab')
    .row()
    .text('💡 Help & Guide', 'nav_help');
}

function getChapterBankSubjectsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📐 Mathematics', 'cb_sub_math')
    .text('🧠 Reasoning', 'cb_sub_reasoning')
    .row()
    .text('📖 English', 'cb_sub_english')
    .text('🏛️ General Awareness', 'cb_sub_ga')
    .row()
    .text('⬅️ Back to Main Menu', 'nav_root');
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
  const total = session.questions.length;

  if (q.preamble) {
    try {
      await botInstance.api.sendMessage(session.chatId, q.preamble, { parse_mode: 'Markdown' });
    } catch {}
  }

  const header = `[Q ${qNum}/${total}]`;
  const formattedQuestion = `${header} ${q.question}`;

  try {
    const pollMsg = await botInstance.api.sendPoll(
      session.chatId,
      formattedQuestion.slice(0, 298),
      q.options,
      {
        type: 'quiz',
        correct_option_ids: [q.correctOptionIndex],
        correct_option_id: q.correctOptionIndex,
        explanation: q.explanation || undefined,
        is_anonymous: false,
      } as any
    );

    registerActivePoll(pollMsg.poll.id, session.userId);
  } catch (err: any) {
    console.error(`[TelegramBot] Error sending quiz poll (Q${qNum}):`, err?.message || err);
    await botInstance.api.sendMessage(
      session.chatId,
      `⚠️ Could not display in quiz poll format:\n\n${q.question}\n\n*Moving to next question...*`,
      { parse_mode: 'Markdown' }
    );
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
    medal = '🏆 OUTSTANDING PERFORMANCE!';
    comment = 'Top tier accuracy! Your concepts in this set are rock solid!';
  } else if (percentage >= 70) {
    medal = '🔥 WELL DONE!';
    comment = 'Great score! Review the couple of questions you missed.';
  } else if (percentage >= 50) {
    medal = '👍 GOOD PROGRESS!';
    comment = 'Solid foundation, practice this set once more for mastery.';
  } else {
    medal = '💪 KEEP WORKING!';
    comment = 'Revisit the solutions and repeat the set to build confidence.';
  }

  const report =
    `${medal}\n\n` +
    `*${session.drillTitle}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Total Score:* ${score} / ${total} (${percentage}%)\n` +
    `⏱️ *Time Taken:* ${timeFormatted}\n` +
    `⚡ *Average Pace:* ${speedPerQ}s / question\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_${comment}_\n\n` +
    `*Where to next?*`;

  const afterQuizKeyboard = new InlineKeyboard()
    .text('📁 Chapter Bank', 'nav_chapter_bank')
    .text('🎯 Mock Errors', 'nav_mock_errors')
    .row()
    .text('⚡ Speed Lab', 'nav_speed_lab')
    .text('🏠 Main Menu', 'nav_root');

  clearSession(session.userId);

  await botInstance.api.sendMessage(session.chatId, report, {
    parse_mode: 'Markdown',
    reply_markup: afterQuizKeyboard,
  });
}

async function startQuizForUser(
  userId: number,
  chatId: number,
  title: string,
  questions: TelegramQuizQuestion[]
) {
  if (!questions || questions.length === 0) {
    await bot.api.sendMessage(
      chatId,
      `⚠️ No questions found for *${title}*. Please choose another section.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getRootMenuKeyboard(),
      }
    );
    return;
  }

  const session = startSession(userId, chatId, title, questions);
  await bot.api.sendMessage(
    chatId,
    `🚀 *${title}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Questions:* ${questions.length} Questions\n` +
      `💡 _Tap an answer on each quiz card below._\n` +
      `🛑 _Type /stop anytime to end early and see your score._`,
    { parse_mode: 'Markdown' }
  );

  await sendCurrentQuestion(bot, session);
}

// ----------------------------------------------------
// COMMAND HANDLERS
// ----------------------------------------------------

bot.command(['start', 'menu'], async (ctx) => {
  const name = ctx.from?.first_name || 'Aspirant';
  const text =
    `👋 *Welcome ${name} to your CGL Preparation Cockpit!*\n\n` +
    `Everything is structured just like the website:\n` +
    `• 📁 *Chapter Bank:* Math, Reasoning, English (Black Book & Ayush), GA\n` +
    `• 🎯 *Mock Errors:* Revise mistakes by subject & chapter\n` +
    `• ⚡ *Speed Lab:* Triplets, Fractions, Squares, Simplification\n\n` +
    `👉 *Select an area to explore:*`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
});

bot.command('stop', async (ctx) => {
  const session = getSession(ctx.from!.id);
  if (!session) {
    await ctx.reply('No active quiz is currently running. Send /menu to start one!');
    return;
  }
  await sendCompletionSummary(bot, session);
});

bot.command('help', async (ctx) => {
  const helpText =
    `💡 *CGL Bot Guide*\n\n` +
    `• /start or /menu — Open the main category menu\n` +
    `• /stop — Finish active test and generate score card\n\n` +
    `*How it works:*\n` +
    `1. Select Chapter Bank, Mock Errors, or Speed Lab\n` +
    `2. Pick your subject and topic\n` +
    `3. Choose a Set — then pick **Attempt ALL Questions** (full set) or **Quick 10**!\n` +
    `4. Instant feedback and solutions appear automatically as you tap.`;

  await ctx.reply(helpText, {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
});

// ----------------------------------------------------
// NAVIGATION: ROOT & SUBJECTS
// ----------------------------------------------------

bot.callbackQuery('nav_root', async (ctx) => {
  await ctx.editMessageText('👉 *Select an area to explore:*', {
    parse_mode: 'Markdown',
    reply_markup: getRootMenuKeyboard(),
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('nav_chapter_bank', async (ctx) => {
  await ctx.editMessageText('📁 *Chapter Bank:* Select a subject:', {
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
  if (!setInfo) return;

  const kb = new InlineKeyboard()
    .text(`🚀 Practice ALL (${setInfo.total} Questions)`, `run_eng:${secCode}:${topicCode}:${setCode}:all`)
    .row()
    .text('⚡ Quick 10 Questions', `run_eng:${secCode}:${topicCode}:${setCode}:10`)
    .row()
    .text('⬅️ Back to Sets', `eng_top:${secCode}:${topicCode}`);

  const msg =
    `📖 *${setInfo.title}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 *Total Questions:* ${setInfo.total}\n\n` +
    `👉 *How would you like to practice?*`;

  await ctx.editMessageText(msg, {
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
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `${setInfo.title} (${modeLabel})`, qs);
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
    .text(`🚀 Practice ALL (${setInfo.total} Questions)`, `run_math:${topicCode}:${setCode}:all`)
    .row()
    .text('⚡ Quick 10 Questions', `run_math:${topicCode}:${setCode}:10`)
    .row()
    .text('⬅️ Back to Sets', `math_top:${topicCode}`);

  const msg =
    `📊 *${setInfo.title}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 *Total Questions in Set:* ${setInfo.total}\n\n` +
    `👉 *How would you like to practice?*`;

  await ctx.editMessageText(msg, {
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
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `${setInfo.title} (${modeLabel})`, qs);
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
    .text(`🚀 Practice ALL (${setInfo.total} Questions)`, `run_ga:${topicCode}:${setCode}:all`)
    .row()
    .text('⚡ Quick 10 Questions', `run_ga:${topicCode}:${setCode}:10`)
    .row()
    .text('⬅️ Back to Chapters', `ga_top:${topicCode}`);

  const msg =
    `🏛️ *${setInfo.title}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 *Total Questions in Chapter:* ${setInfo.total}\n\n` +
    `👉 *How would you like to practice?*`;

  await ctx.editMessageText(msg, {
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
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `${setInfo.title} (${modeLabel})`, qs);
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
    .text('⬅️ Back to Subjects', 'nav_chapter_bank');

  await ctx.editMessageText('🧠 *Reasoning Bank:*\nSelect practice mode below:', {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
  await ctx.answerCallbackQuery();
});

// ----------------------------------------------------
// MOCK ERRORS (RCA)
// ----------------------------------------------------

bot.callbackQuery('nav_mock_errors', async (ctx) => {
  const catalog = getMockErrorsCatalog();
  const kb = new InlineKeyboard();

  for (const item of catalog) {
    kb.text(`${item.title} (${item.totalQuestions} Qs)`, `mock_sub:${item.subjectId}`).row();
  }
  kb.text('⬅️ Back to Main Menu', 'nav_root');

  await ctx.editMessageText(
    '🎯 *Mock Errors Bank:*\nReview all mistakes you made in full test series.\n\nSelect a subject:',
    {
      parse_mode: 'Markdown',
      reply_markup: kb,
    }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^mock_sub:(mathematics|reasoning|english|general_awareness)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const subId = ctx.match[1] as any;
  const catalog = getMockErrorsCatalog();
  const item = catalog.find((c) => c.subjectId === subId);
  if (!item) return;

  const kb = new InlineKeyboard()
    .text(`🔥 Practice ALL ${item.totalQuestions} Mistakes`, `run_mock:${subId}:all`)
    .row()
    .text(`⚡ Quick 10 Mistakes`, `run_mock:${subId}:10`)
    .row();

  for (const ch of item.chapters) {
    if (ch.count > 0 && ch.chapterNum !== undefined) {
      kb.text(`📁 ${ch.title} (${ch.count} Qs)`, `run_mock_ch:${subId}:${ch.chapterNum}:all`).row();
    }
  }
  kb.text('⬅️ Back to Mock Subjects', 'nav_mock_errors');

  const msg =
    `🎯 *${item.title}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Total Mistakes Logged: *${item.totalQuestions} Questions*\n\n` +
    `Select a practice option below:`;

  await ctx.editMessageText(msg, {
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
});

bot.callbackQuery(/^run_mock:([a-z_]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subId, mode] = ctx.match;
  const qs = loadMockErrorsForSubject(subId as any, undefined, mode as 'all' | '10');
  const subTitle = subId.charAt(0).toUpperCase() + subId.slice(1).replace('_', ' ');
  const modeLabel = mode === 'all' ? `All ${qs.length} Questions` : 'Quick 10';
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `🎯 ${subTitle} Mistakes (${modeLabel})`, qs);
});

bot.callbackQuery(/^run_mock_ch:([a-z_]+):([0-9]+):(all|10)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, subId, chNum, mode] = ctx.match;
  const qs = loadMockErrorsForSubject(subId as any, parseInt(chNum, 10), mode as 'all' | '10');
  const subTitle = subId.charAt(0).toUpperCase() + subId.slice(1).replace('_', ' ');
  await startQuizForUser(ctx.from.id, ctx.chat!.id, `🎯 ${subTitle} Chapter ${chNum} Mistakes (${qs.length} Qs)`, qs);
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

  await startQuizForUser(ctx.from.id, ctx.chat!.id, title, qs);
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
    .text(`🚀 Practice ALL (${total} Questions)`, `run_calc:${stepCode}:all`)
    .row()
    .text('⚡ Quick 10 Questions', `run_calc:${stepCode}:10`)
    .row()
    .text('⬅️ Back to Steps', 'speed_calc_studio');
}

bot.callbackQuery('calc_step_triplets', async (ctx) => {
  await ctx.editMessageText(
    '📐 *Step 1: Primitive Triplets*\nTotal Questions: *16 Triplets*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Triplets', 16, 'triplets') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_tables', async (ctx) => {
  await ctx.editMessageText(
    '✖️ *Step 2: Multiplication Tables (12 to 24)*\nTotal Questions: *13 Tables*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Tables', 13, 'tables') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_squares', async (ctx) => {
  await ctx.editMessageText(
    '🔢 *Step 3: Squares (17² to 39²)*\nTotal Questions: *23 Squares*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Squares', 23, 'squares') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_cubes', async (ctx) => {
  await ctx.editMessageText(
    '🧊 *Step 4: Cubes (11³ to 25³)*\nTotal Questions: *15 Cubes*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Cubes', 15, 'cubes') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_powers', async (ctx) => {
  await ctx.editMessageText(
    '⚡ *Step 5: Powers (2–9)*\nTotal Questions: *38 Powers*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Powers', 38, 'powers') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_factorials', async (ctx) => {
  await ctx.editMessageText(
    '❗ *Step 6: Factorials (1! to 8!)*\nTotal Questions: *8 Factorials*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Factorials', 8, 'factorials') }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('calc_step_fractions', async (ctx) => {
  await ctx.editMessageText(
    '💯 *Step 7: Fractions ↔ Percentages*\nTotal Questions: *73 Values*\n\nSelect practice mode:',
    { parse_mode: 'Markdown', reply_markup: renderStepOptions('Fractions', 73, 'fractions') }
  );
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

  await startQuizForUser(ctx.from.id, ctx.chat!.id, title, qs);
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

  await startQuizForUser(ctx.from.id, ctx.chat!.id, `📐 ${target.title} (All ${questions.length} Qs)`, questions);
});

bot.callbackQuery('speed_routine', async (ctx) => {
  await ctx.answerCallbackQuery();
  const qs = getDailyRoutineWorkout();
  await startQuizForUser(ctx.from.id, ctx.chat!.id, '🏆 Daily 25-Question Routine Workout', qs);
});

bot.callbackQuery('speed_mixed', async (ctx) => {
  await ctx.answerCallbackQuery();
  await startQuizForUser(ctx.from.id, ctx.chat!.id, '⚡ Mixed Speed Blitz', generateMixedSpeedDrill(10));
});

bot.callbackQuery('nav_help', async (ctx) => {
  const helpText =
    `💡 *CGL Bot Navigation Guide*\n\n` +
    `1. *Chapter Bank* — All chapters in Math, English, GK & Reasoning.\n` +
    `2. *Mock Errors* — Directly attempt questions you missed in mocks.\n` +
    `3. *Full Set vs Quick 10* — Whenever you choose a set, you can practice **ALL questions** in that set or do a quick 10!\n` +
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
