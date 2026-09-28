import React, { useState } from 'react';
import {
  Search,
  BookOpen,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  Filter,
  Check,
  Layers,
  FileText,
  AlignLeft,
  List
} from 'lucide-react';

interface Props {
  rawTheoryText?: string;
  chapterTitle?: string;
}

export const ChapterBookTheoryViewer: React.FC<Props> = ({ rawTheoryText = '', chapterTitle = 'Noun' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>('all');
  const [displayStyle, setDisplayStyle] = useState<'structured' | 'verbatim'>('structured');

  const sections = [
    { id: 'all', label: 'All (Complete Theory)' },
    { id: 'kinds', label: '1. Kinds of Nouns' },
    { id: 'countable', label: '2. Countable vs Uncountable' },
    { id: 'rules_1_6', label: '3. Rules 1–6 (Agreement)' },
    { id: 'rules_7_13', label: '4. Rules 7–13 (Measurements)' },
    { id: 'rule_14', label: '5. Rule 14 (Indian Errors Table)' },
    { id: 'rules_15_17', label: '6. Rules 15–17 (Prep & Gender)' },
    { id: 'rule_18', label: '7. Rule 18 (55 Collective Nouns)' },
    { id: 'rules_19_21', label: '8. Rules 19–21 (Number & Latin Roots)' },
    { id: 'rule_22', label: '9. Rule 22 (Meaning Shifts)' },
    { id: 'rule_23', label: '10. Rule 23 (Apostrophe Laws)' },
  ];

  const q = searchQuery.toLowerCase().trim();
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q);

  return (
    <div className="flex flex-col space-y-4">
      {/* Non-sticky Header Controls (Does NOT float or block view while scrolling) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all rules, words (e.g. hair, scissors, advice, Latin, dozen, apostrophe, jury)..."
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Style Toggle: Structured Reader vs Verbatim Book Text */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-xs font-semibold shrink-0">
            <button
              onClick={() => setDisplayStyle('structured')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                displayStyle === 'structured'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Structured Reader</span>
            </button>
            <button
              onClick={() => setDisplayStyle('verbatim')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                displayStyle === 'verbatim'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Exact Book Text</span>
            </button>
          </div>
        </div>

        {/* Section Quick Jump Filter */}
        {displayStyle === 'structured' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-semibold text-slate-600">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveSection(sec.id);
                  if (sec.id !== 'all') {
                    const el = document.getElementById(sec.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className={`shrink-0 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeSection === sec.id
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100/90 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* VERBATIM MODE: Clean paper-like book view without uppercase bug */}
      {displayStyle === 'verbatim' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs font-sans text-xs sm:text-sm text-slate-800 leading-relaxed space-y-4">
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base">Book Theory (Unedited Verbatim)</h3>
            <span className="text-xs text-slate-500">Pinnacle 60 Days English Chapter 01</span>
          </div>
          <div className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed selection:bg-indigo-100">
            {rawTheoryText
              .replace(/=== PAGE \d+ ===/g, '')
              .replace(/[ \t]+/g, ' ')
              .split('\n')
              .map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-2" />;
                const isRule = /^RULE\s+\d+/i.test(trimmed);
                const isHeading = /^(NOUN|Kinds of Nouns|RULES FOR|WORDS DENOTING|Usage of Apostrophe)/i.test(trimmed);
                if (isHeading) {
                  return (
                    <h4 key={idx} className="font-black text-indigo-950 text-sm sm:text-base mt-4 pt-2 border-t border-slate-100">
                      {trimmed}
                    </h4>
                  );
                }
                if (isRule) {
                  return (
                    <div key={idx} className="font-bold text-indigo-900 text-xs sm:text-sm mt-3 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                      {trimmed}
                    </div>
                  );
                }
                return <p key={idx} className="leading-relaxed">{trimmed}</p>;
              })}
          </div>
        </div>
      )}

      {/* STRUCTURED MODE */}
      {displayStyle === 'structured' && (
        <div className="space-y-5">
          {/* SECTION 1: Kinds of Nouns */}
          {(activeSection === 'all' || activeSection === 'kinds') && matchesSearch('noun kinds proper common collective material abstract') && (
            <section id="kinds" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-black text-sm">
                  01
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Definition & Kinds of Nouns</h2>
                  <p className="text-xs text-slate-500">The 5 fundamental noun classifications in standard SSC English</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <span className="font-bold text-indigo-900">Definition: </span>
                A noun is a part of speech that represents a person, place, thing, idea, concept, or quality.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. Proper Noun */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">1. Proper Noun</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Specific</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Refers exclusively to a single unique person, place, or thing. Always begins with a <span className="font-semibold text-slate-900">capital letter</span>.
                  </p>
                  <div className="text-xs font-mono bg-white p-2 rounded-lg border border-slate-200/60 text-indigo-700 font-semibold">
                    Examples: Delhi, Yamuna, Rohit, The Taj Mahal
                  </div>
                </div>

                {/* 2. Common Noun */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">2. Common Noun</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">Generic</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Gives a general identity to any item in a class of persons, animals, or places.
                  </p>
                  <div className="text-xs font-mono bg-white p-2 rounded-lg border border-slate-200/60 text-indigo-700 font-semibold">
                    Examples: boy, girl, town, river, country, teacher
                  </div>
                </div>

                {/* 3. Collective Noun */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">3. Collective Noun</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                      High-Yield Exam Trap ⚠️
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    A group-denoting word. Denotes an <strong>undivided unit</strong> OR <strong>individual members acting separately</strong>.
                  </p>
                  <div className="text-xs font-mono bg-white p-2 rounded-lg border border-slate-200/60 text-slate-800">
                    Examples: Committee, clergy, group, family, flock, public, team, army, battalion, audience, shoal, jury, crowd, crew.
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80">
                      <div className="font-bold text-emerald-900 flex items-center gap-1 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Acting Together (Singular Verb + Pronoun)
                      </div>
                      <p className="text-slate-700 text-[11px] leading-relaxed">
                        <em>The team was given a standing ovation for winning the match.</em> (Single unit → <strong className="text-emerald-800">was</strong>).
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200/80">
                      <div className="font-bold text-rose-900 flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Divided in Opinion (Plural Verb + Pronoun)
                      </div>
                      <p className="text-slate-700 text-[11px] leading-relaxed">
                        <em>The jury have not reached a conclusion because they are arguing among themselves.</em> (Divided → <strong className="text-rose-800">have / they</strong>).
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Material Noun */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">4. Material Noun</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">Uncountable</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A raw material or substance. Always <strong>uncountable</strong>: takes a <strong>singular verb</strong> and <strong>NO article (a/an)</strong>.
                  </p>
                  <div className="text-xs font-mono bg-white p-2 rounded-lg border border-slate-200/60 text-indigo-700 font-semibold">
                    Examples: concrete, cotton, gold, iron, milk, rice, coffee
                  </div>
                </div>

                {/* 5. Abstract Noun */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">5. Abstract Noun</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Intangible</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Names an intangible quality, feeling, or concept that has no physical existence.
                  </p>
                  <div className="text-xs font-mono bg-white p-2 rounded-lg border border-slate-200/60 text-indigo-700 font-semibold">
                    Examples: Consideration, honesty, hatred, joy, parenthood
                  </div>
                  <p className="text-[11px] text-slate-600">
                    💡 Endings in: <span className="font-mono font-bold text-indigo-700">-ness, -hood, -ship, -ty, -th</span>.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 2: Countable vs Uncountable */}
          {(activeSection === 'all' || activeSection === 'countable') && matchesSearch('countable uncountable advice furniture information') && (
            <section id="countable" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-black text-sm">
                  02
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Countable vs Uncountable Nouns</h2>
                  <p className="text-xs text-slate-500">Crucial rules on articles (a/an/the) and quantity modifiers</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-[13px]">
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-2">
                  <span className="font-bold text-blue-950 text-sm block">(A) Countable Nouns</span>
                  <p className="text-slate-700 leading-relaxed">
                    Can be counted individually and made plural (Boy → Boys, Chair → Chairs). Can take any article: <strong>a, an, the</strong>.
                  </p>
                  <div className="text-xs font-mono bg-white p-2 rounded-lg border border-blue-200 text-blue-900">
                    a book, an apple, five students, the boys
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
                  <span className="font-bold text-rose-950 text-sm block">(B) Uncountable Nouns</span>
                  <p className="text-slate-700 leading-relaxed">
                    Cannot be counted, cannot take <strong>a/an</strong>, and <strong>cannot be pluralized with -s/-es</strong>.
                  </p>
                  <div className="text-xs font-mono bg-white p-2 rounded-lg border border-rose-200 text-rose-900">
                    information, bread, news, advice, luggage, furniture
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    ❌ <em>an advice, furnitures, luggages</em><br />
                    ✅ <em>a piece of advice, an article of luggage, items of furniture</em>
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 3: Rules 1 to 6 */}
          {(activeSection === 'all' || activeSection === 'rules_1_6') && (
            <section id="rules_1_6" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-black text-sm">
                  03
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Rules 1 to 6: Core Singular & Plural Agreement</h2>
                  <p className="text-xs text-slate-500">The most repeated noun-verb agreement questions in SSC Tier-1 & Tier-2</p>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Rule 1 */}
                {matchesSearch('rule 1 scissors spectacles alms outskirts surroundings trousers') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 1</span>
                      <h3 className="font-bold text-slate-900 text-sm">Always Plural Nouns → Plural Verb</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      These nouns represent paired items or inherent plural entities. They <strong>never exist without -s</strong> and always take a <strong>plural verb</strong>:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'scissors', 'tongs', 'pliers', 'pincers', 'bellows', 'trousers', 'pants', 'pyjamas', 'shorts',
                        'spectacles', 'goggles', 'binoculars', 'eyeglasses', 'alms', 'ruins', 'amends', 'archives',
                        'arrears', 'auspices', 'congratulations', 'embers', 'fireworks', 'lodgings', 'outskirts',
                        'particulars', 'proceeds', 'regards', 'riches', 'remains', 'savings', 'surroundings', 'tidings',
                        'troops', 'tactics', 'thanks', 'valuables', 'wages', 'belongings', 'whereabouts'
                      ].map((word) => (
                        <span key={word} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 rounded text-[11px] font-mono font-medium">
                          {word}
                        </span>
                      ))}
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-slate-800 space-y-1">
                      <strong>💡 "A pair of" Modifier:</strong> When used with <em>"a pair of"</em>, takes a <strong>singular verb</strong>:
                      <p className="font-mono text-emerald-800">✅ He has bought a wonderful pair of shoes. (was/has bought)</p>
                      <p className="font-mono text-rose-800">❌ The scissors is mine. → ✅ The scissors are mine.</p>
                    </div>
                  </div>
                )}

                {/* Rule 2 */}
                {matchesSearch('rule 2 news innings politics physics mathematics diabetes billiards') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 2</span>
                      <h3 className="font-bold text-slate-900 text-sm">Appear Plural (-s) but Actually Singular → Singular Verb</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      These nouns end in <em>-s</em> but denote single subjects, diseases, games, or titles. Never remove <em>-s</em> and always use a <strong>singular verb</strong>:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-bold text-indigo-900 block mb-1">Subjects & Titles</span>
                        <span className="font-mono text-slate-700">Physics, Mathematics, Economics, Civics, Linguistics, News, Innings, Summons</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-bold text-indigo-900 block mb-1">Diseases</span>
                        <span className="font-mono text-slate-700">Diabetes, Rabies, Mumps, Measles, Shingles, Rickets</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-bold text-indigo-900 block mb-1">Games & Sports</span>
                        <span className="font-mono text-slate-700">Billiards, Athletics, Dominoes, Draughts, Darts</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 text-xs font-mono text-emerald-900 border border-emerald-200">
                      ✅ Athletics is good for young people.<br />
                      ✅ No news is good news.<br />
                      ✅ The first innings was completed on time.
                    </div>
                  </div>
                )}

                {/* Rule 3 */}
                {matchesSearch('rule 3 cattle poultry gentry police clergy infantry cavalry') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 3</span>
                      <h3 className="font-bold text-slate-900 text-sm">Appear Singular (No -s) but Actually Plural → Plural Verb</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      These group nouns lack an <em>-s</em> ending, yet inherently denote multiple beings. They take a <strong>plural verb</strong> and must NEVER have <em>-s</em> appended to them:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['cattle', 'cavalry', 'infantry', 'poultry', 'peasantry', 'children', 'gentry', 'police', 'people', 'clergy', 'folk', 'vermin'].map((w) => (
                        <span key={w} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 rounded text-[11px] font-mono font-medium">
                          {w}
                        </span>
                      ))}
                    </div>
                    <div className="p-2 rounded-lg bg-rose-50 text-xs font-mono text-rose-900 border border-rose-200">
                      ❌ The cattles are grazing in the field. → ✅ The cattle are grazing in the field.<br />
                      ❌ The police is chasing the thief. → ✅ The police are chasing the thief.
                    </div>
                  </div>
                )}

                {/* Rule 4 */}
                {matchesSearch('rule 4 scenery poetry furniture advice information hair luggage baggage work') && (
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-black text-xs">RULE 4</span>
                        <h3 className="font-bold text-slate-900 text-sm">Always Singular & Uncountable → No -s, No A/An</h3>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">#1 Most Tested in SSC</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      These nouns are strictly <strong>uncountable</strong>. Never write them with <em>-s/-es</em>, and never precede them with <em>a/an</em>:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Scenery', 'Poetry', 'Furniture', 'Advice', 'Information', 'Hair', 'Business', 'Mischief',
                        'Bread', 'Stationery', 'Crockery', 'Luggage', 'Baggage', 'Postage', 'Knowledge', 'Wastage',
                        'Money', 'Jewellery', 'Breakage', 'Equipment', 'Work', 'Evidence', 'Word', 'Fuel', 'Bedding'
                      ].map((w) => (
                        <span key={w} className="px-2 py-0.5 bg-white border border-amber-200 text-amber-950 rounded text-[11px] font-mono font-bold">
                          {w}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-rose-50 rounded-lg border border-rose-200 text-rose-900 font-mono">
                        ❌ The sceneries of Kashmir are beautiful.<br />
                        ❌ I gave him an advice.
                      </div>
                      <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 font-mono">
                        ✅ The scenery of Kashmir is beautiful.<br />
                        ✅ I gave him a piece of advice.
                      </div>
                    </div>
                  </div>
                )}

                {/* Rule 5 & 6 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matchesSearch('rule 5 hair paper') && (
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px]">RULE 5</span>
                        <span className="font-bold text-slate-900 text-xs">Hair & Paper Dual Usage</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        • <strong>Hair:</strong> Normally uncountable (<em>Her hair is black</em>). Countable when referring to individual strands (<em>Your three hairs are black</em>).<br />
                        • <strong>Paper:</strong> Material is uncountable (<em>A lot of paper is used</em>). Countable when referring to exam papers (<em>two English papers</em>).
                      </p>
                    </div>
                  )}

                  {matchesSearch('rule 6 deer sheep series species innings aircraft headquarters') && (
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px]">RULE 6</span>
                        <span className="font-bold text-slate-900 text-xs">Identical Singular & Plural Forms</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        These words <strong>do not change</strong> in plural (never add -s):
                      </p>
                      <p className="font-mono text-[11px] text-indigo-900 bg-white p-1.5 rounded border border-slate-200">
                        Deer, sheep, series, species, fish, crew, jury, aircraft, counsel, headquarters, innings
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 4: Rules 7 to 13 (NOW FULLY RESTORED & VISIBLE!) */}
          {(activeSection === 'all' || activeSection === 'rules_7_13') && (
            <section id="rules_7_13" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-black text-sm">
                  04
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Rules 7 to 13: Formulas, Modifiers & Measurements</h2>
                  <p className="text-xs text-slate-500">Rules governing hyphenated nouns, dozen/hundreds, 'The + Adjective', and 'Half'</p>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Rule 7 */}
                {matchesSearch('rule 7 common noun abstract animal mother shweta') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 7</span>
                      <h3 className="font-bold text-slate-900 text-sm">[ The + Common Noun ] as Abstract Quality</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      When <strong>[The + common noun]</strong> is used to represent an inner quality or characteristic rather than the physical person/animal, it functions as an <strong>abstract noun</strong>:
                    </p>
                    <div className="p-2.5 rounded-lg bg-emerald-50 text-xs font-mono text-emerald-950 border border-emerald-200 space-y-1">
                      <p>• <em>It is <strong>the animal</strong> in Mr. Pardeep that makes him commit such a heinous crime.</em> ('the animal' = beastly instincts, not an actual animal)</p>
                      <p>❌ <em>A mother in Shweta is still alive.</em></p>
                      <p>✅ <em><strong>The mother</strong> in Shweta is still alive.</em> ('the mother' = maternal feelings / motherhood)</p>
                    </div>
                  </div>
                )}

                {/* Rule 8 */}
                {matchesSearch('rule 8 ful cupfuls teaspoonfuls handfuls') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 8</span>
                      <h3 className="font-bold text-slate-900 text-sm">Pluralizing Nouns Ending in "-ful"</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      For nouns ending in <strong>"-ful"</strong>, always add <strong>"s" to the end of "-ful"</strong> to form the plural. NEVER add 's' to the root word:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-white border border-slate-200 text-center">
                        <span className="text-emerald-700 font-bold">Cupfuls</span><br />
                        <span className="text-rose-500 line-through text-[10px]">Cupsful</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200 text-center">
                        <span className="text-emerald-700 font-bold">Teaspoonfuls</span><br />
                        <span className="text-rose-500 line-through text-[10px]">Teaspoonsful</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200 text-center">
                        <span className="text-emerald-700 font-bold">Handfuls</span><br />
                        <span className="text-rose-500 line-through text-[10px]">Handsful</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200 text-center">
                        <span className="text-emerald-700 font-bold">Glassfuls</span><br />
                        <span className="text-rose-500 line-through text-[10px]">Glassesful</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rule 9 */}
                {matchesSearch('rule 9 half format kilometer glass milk') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 9</span>
                      <h3 className="font-bold text-slate-900 text-sm">Precise Formats for the Word "Half"</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      "Half" strictly follows these 4 syntactic structures:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-white border border-slate-200">
                        1. A + half + noun<br />
                        2. Half + a/an + noun
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200">
                        3. Number + and a half + <strong>Plural noun</strong><br />
                        4. Number (a/an/two…) + noun + and a half
                      </div>
                    </div>
                    <div className="p-2 bg-rose-50 rounded border border-rose-200 text-xs font-mono space-y-1">
                      <p className="text-rose-700">❌ Rachna will have to cover one km and a half in thirty minutes.</p>
                      <p className="text-emerald-700 font-bold">✅ Rachna will have to cover <strong>a km and a half</strong> in thirty minutes.</p>
                      <p className="text-rose-700">❌ One and a half glass of milk will be sufficient.</p>
                      <p className="text-emerald-700 font-bold">✅ One and a half <strong>glasses</strong> of milk will be sufficient.</p>
                    </div>
                  </div>
                )}

                {/* Rule 10 */}
                {matchesSearch('rule 10 hyphenated ten-rupee note two-mile walk committee workshop') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 10</span>
                      <h3 className="font-bold text-slate-900 text-sm">Hyphenated Compound Nouns are NEVER Pluralized</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Expressions functioning as compound adjectives or hyphenated qualifiers (e.g. <em>a ten-rupee note</em>, <em>a two-mile walk</em>, <em>a five-year-old child</em>, <em>a three-day workshop</em>, <em>a twenty-man committee</em>) are <strong>strictly singular</strong>:
                    </p>
                    <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-xs font-mono space-y-1">
                      <p className="text-rose-700">❌ I attended a three-days workshop.</p>
                      <p className="text-emerald-700 font-bold">✅ I attended a <strong>three-day workshop</strong>.</p>
                      <p className="text-rose-700">❌ He gave me a five-hundred-rupees note.</p>
                      <p className="text-emerald-700 font-bold">✅ He gave me a <strong>five-hundred-rupee note</strong>.</p>
                    </div>
                  </div>
                )}

                {/* Rule 11 */}
                {matchesSearch('rule 11 dozen hundred million billion pair score') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 11</span>
                      <h3 className="font-bold text-slate-900 text-sm">Number + Dozen / Hundred / Million / Billion</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      When words like <em>dozen, hundred, thousand, million, billion</em> are preceded by an <strong>exact numeral (one, two, four, eight)</strong>, they remain <strong>strictly singular</strong> without "of":
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 bg-rose-50 rounded border border-rose-200 text-rose-800">
                        ❌ Four dozens bananas<br />
                        ❌ Four dozens of bananas<br />
                        ❌ Eight billions people
                      </div>
                      <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-800 font-bold">
                        ✅ Four dozen bananas<br />
                        ✅ Eight billion people<br />
                        ✅ Two thousand rupees
                      </div>
                    </div>
                    <div className="p-2 bg-amber-50 rounded border border-amber-200 text-xs text-slate-800">
                      <strong>⚡ Indefinite Exception (No number before them):</strong> When no numeral is attached, they can take <strong>-s and "of"</strong>:<br />
                      <span className="font-mono text-indigo-900 font-bold">✅ dozens of men, thousands of people, millions of stars, hundreds of protesters</span>.<br />
                      <em>Note with pair & score:</em> "three pairs of socks", "three scores of pencils".
                    </div>
                  </div>
                )}

                {/* Rule 12 & 13 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matchesSearch('rule 12 the poor the blind the deaf plight') && (
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px]">RULE 12</span>
                        <span className="font-bold text-slate-900 text-xs">[The + Adjective] = Plural Class</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <em>The poor, the blind, the deaf, the rich</em> are <strong>always plural</strong> (taking a plural verb). Do NOT add -s to the adjective. For possession, use <strong>"of"</strong>:
                      </p>
                      <div className="text-[11px] font-mono text-emerald-800 bg-white p-2 rounded border border-slate-200">
                        ✅ The poor need to work hard.<br />
                        ❌ The poor’s plight is pathetic.<br />
                        ✅ The plight of the poor is pathetic.
                      </div>
                    </div>
                  )}

                  {matchesSearch('rule 13 plural surname family sharmas') && (
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px]">RULE 13</span>
                        <span className="font-bold text-slate-900 text-xs">[The + Plural Surname] = Entire Family</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong>[The + pluralized surname]</strong> represents the entire household/family and takes a <strong>plural verb</strong>:
                      </p>
                      <div className="text-[11px] font-mono text-emerald-800 bg-white p-2 rounded border border-slate-200">
                        ✅ The Sharmas have been living here for many years. (have, NOT has)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 5: Rule 14 - Indian Superfluous Errors */}
          {(activeSection === 'all' || activeSection === 'rule_14') && matchesSearch('rule 14 indian cousin blunder name out of station') && (
            <section id="rule_14" className="bg-white rounded-2xl p-5 sm:p-6 border border-rose-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-xs">RULE 14</span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Common Superfluous Errors in Indian English</h2>
                    <p className="text-xs text-slate-500">Everyday Indian conversational habits that SSC penalizes as grammar errors</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">SSC Trap</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs sm:text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 text-rose-700">❌ Incorrect / Indian Slang</th>
                      <th className="py-2.5 px-3 text-emerald-700">✅ Standard SSC English</th>
                      <th className="py-2.5 px-3 text-slate-600">Grammar Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { id: 1, wrong: 'Cousin brother / Cousin sister', right: 'Cousin', reason: 'Cousin is gender-neutral. Brother/sister is redundant.' },
                      { id: 2, wrong: 'The teacher of English', right: 'English teacher', reason: 'Standard noun-adjunct placement.' },
                      { id: 3, wrong: 'Pickpocketer', right: 'Pickpocket', reason: "'Pickpocket' is already the noun for the thief." },
                      { id: 4, wrong: 'What is your good name?', right: 'What is your name?', reason: "'Good name' is a literal Hindi translation of 'Shubh Naam'." },
                      { id: 5, wrong: 'Big blunder / Huge blunder', right: 'Blunder', reason: "'Blunder' inherently means a grave or huge mistake." },
                      { id: 6, wrong: 'Members of the family', right: 'Family members', reason: 'Concise, correct idiom.' },
                      { id: 7, wrong: 'Years back', right: 'Years ago', reason: "'Ago' measures past time from the present." },
                      { id: 8, wrong: 'Out of station', right: 'Out of town', reason: "Archaic British railway term; use 'out of town'." },
                      { id: 9, wrong: 'Going to cinema (building)', right: 'Going to movie / theatre', reason: 'Standard modern English usage.' },
                      { id: 10, wrong: 'Prepone the meeting', right: 'Advance / Reschedule earlier', reason: "'Prepone' is an Indianism coined as opposite of postpone." },
                    ].map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">{row.id}</td>
                        <td className="py-2.5 px-3 font-semibold text-rose-700 font-mono">{row.wrong}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700 font-mono">{row.right}</td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* SECTION 6: Rules 15 to 17 */}
          {(activeSection === 'all' || activeSection === 'rules_15_17') && (
            <section id="rules_15_17" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-black text-sm">
                  06
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Rules 15 to 17: Preposition Repetitions & Gender Laws</h2>
                  <p className="text-xs text-slate-500">Noun repetition structures, common gender pronoun conventions, and gender transformations</p>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Rule 15 */}
                {matchesSearch('rule 15 day after day city after city door to door') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 15</span>
                      <h3 className="font-bold text-slate-900 text-sm">[Noun + Preposition + Same Noun] = Strictly Singular</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      If the same noun appears both before and after a preposition, both nouns MUST be in the <strong>singular form</strong>, and they take a <strong>singular verb</strong>:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 bg-rose-50 rounded border border-rose-200 text-rose-800">
                        ❌ Days after days<br />
                        ❌ Cities after cities were swept away<br />
                        ❌ Doors to doors
                      </div>
                      <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-800 font-bold">
                        ✅ Day after day<br />
                        ✅ City after city <strong>was</strong> swept away<br />
                        ✅ He went from <strong>door to door</strong> in search of water
                      </div>
                    </div>
                  </div>
                )}

                {/* Rule 16 */}
                {matchesSearch('rule 16 common gender teacher student advocate driver default pronoun') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 16</span>
                      <h3 className="font-bold text-slate-900 text-sm">Common Gender Nouns (Default Pronoun Rules)</h3>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Nouns applicable to either gender (<em>student, teacher, child, advocate, worker, clerk, leader, musician, cousin, driver, friend, teenager</em>) are treated as singular. When the specific gender is unspecified, the conventional default pronoun is <strong>he / his / him</strong>:
                    </p>
                    <p className="text-xs font-mono text-indigo-900 bg-white p-2 rounded border border-slate-200">
                      • "My mom works at school. She is a teacher." (Specific female referent → feminine pronoun)<br />
                      • "Every teacher must do his duty." (General unspecified referent → default masculine pronoun)
                    </p>
                  </div>
                )}

                {/* Rule 17 */}
                {matchesSearch('rule 17 gender masculine feminine neuter ess actor actress') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 17</span>
                      <h3 className="font-bold text-slate-900 text-sm">The 4 Rules for Masculine to Feminine Transformations</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                        <strong className="text-indigo-950 block">i. Adding '-ess':</strong>
                        <p className="font-mono text-slate-700">Prince → Princess, Lion → Lioness, Host → Hostess, Tailor → Tailoress</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                        <strong className="text-indigo-950 block">ii. Vowel before 'r' dropped + '-ess':</strong>
                        <p className="font-mono text-slate-700">Actor → Actress, Waiter → Waitress, Founder → Foundress, Hunter → Huntress</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                        <strong className="text-indigo-950 block">iii. Distinct Words:</strong>
                        <p className="font-mono text-slate-700">King → Queen, Dog → Bitch, Son → Daughter, Boy → Girl</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                        <strong className="text-indigo-950 block">iv. Front Word of Compound Noun changes:</strong>
                        <p className="font-mono text-slate-700">He-bear → She-bear, Peacock → Peahen, Landlord → Landlady, Manservant → Maidservant</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SECTION 7: Rule 18 - 55 Collective Nouns */}
          {(activeSection === 'all' || activeSection === 'rule_18') && matchesSearch('rule 18 collective group army pride bevy gaggle shoal flock') && (
            <section id="rule_18" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs">RULE 18</span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Words Denoting Groups (Collective Nouns Bank)</h2>
                    <p className="text-xs text-slate-500">All 55 authentic textbook group terms required for SSC vocabulary & fill-in-the-blanks</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  55 Phrases
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[460px] overflow-y-auto p-1 pr-2">
                {[
                  "1. An army / colony of ants", "2. An armada / fleet of ships", "3. An atlas of maps",
                  "4. A band of musicians", "5. A batch of letters", "6. A bundle of sticks / old clothes",
                  "7. A board of directors", "8. A bevy of girls / women / officers", "9. A brigade / troop of soldiers",
                  "10. A bunch of grapes / keys / bananas", "11. A caravan of merchants / pilgrims", "12. A cast of actors",
                  "13. A coalition of parties", "14. A chain / range of mountains", "15. A choir of singers",
                  "16. A class / batch of students", "17. A collection of stamps", "18. A clump / grove of trees",
                  "19. A cloud of grasshoppers", "20. A code of laws / conduct", "21. A constellation / galaxy of stars",
                  "22. A company / regiment of soldiers", "23. A congregation in a religious place", "24. A course / series of lectures",
                  "25. A crew of sailors", "26. A crowd / mob of people", "27. A curriculum of studies",
                  "28. A flight of steps / stairs", "29. A fleet of motorcars / ships", "30. A flock of geese / sheep / birds",
                  "31. A gaggle of geese", "32. A grove of trees", "33. A bouquet / garland of flowers",
                  "34. A heap of ruins / stones / sand", "35. A herd of cattle / elephants", "36. A hive of bees",
                  "37. A hum of bees", "38. A leap of leopards", "39. A litter of puppies / kittens / pigs",
                  "40. An orchestra of musicians", "41. A peal of bells", "42. A pack of hounds / wolves / cards",
                  "43. A pair of shoes / scissors / trousers", "44. A series of events", "45. A sheaf of corn",
                  "46. A shoal or school of fish", "47. A swarm of ants / bees / flies", "48. A squad of soldiers / police officers",
                  "49. A train of carriages / followers", "50. A troop of horses (cavalry)", "51. A troupe of performers / dancers",
                  "52. A tyranny of dictators", "53. A wealth of information", "54. A yoke of oxen",
                  "55. A volley of shots / arrows / bullets"
                ].map((phrase, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-indigo-50/40 hover:border-indigo-200 transition-all text-xs font-medium text-slate-800"
                  >
                    <span>{phrase}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 8: Rules 19 to 21 - Number Formations & Latin Roots */}
          {(activeSection === 'all' || activeSection === 'rules_19_21') && (
            <section id="rules_19_21" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-black text-sm">
                  08
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Rules 19 to 21: Number Formations & Foreign Roots</h2>
                  <p className="text-xs text-slate-500">Plural formation rules, Latin and Greek loanword conversions, and plural-only compound nouns</p>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Rule 19 */}
                {matchesSearch('rule 19 singular plural number commander-in-chief oxen radii') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 19</span>
                      <h3 className="font-bold text-slate-900 text-sm">Singular to Plural Formation Exceptions</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                        <strong>Ending in -o:</strong>
                        <p className="text-slate-700 font-mono">Consonant + o adds -es (Hero → Heroes, Potato → Potatoes). Exceptions add -s (Dynamo → Dynamos, Piano → Pianos, Photo → Photos, Solo → Solos).</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                        <strong>Ending in -f / -fe:</strong>
                        <p className="text-slate-700 font-mono">Change to -ves (Calf → Calves, Thief → Thieves). Exceptions add only -s (Belief → Beliefs, Chief → Chiefs, Cliff → Cliffs, Grief → Griefs, Roof → Roofs, Safe → Safes).</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 sm:col-span-2">
                        <strong>Compound Nouns: Pluralize the Main / Root Word Only:</strong>
                        <p className="text-slate-700 font-mono">Commander-in-chief → Commanders-in-chief (NOT commander-in-chiefs); Brother-in-law → Brothers-in-law; Maid-servant → Maid-servants; Step-daughter → Step-daughters.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rule 20 */}
                {matchesSearch('rule 20 latin greek datum data radius radii criterion criteria analysis analyses') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-xs">RULE 20</span>
                      <h3 className="font-bold text-slate-900 text-sm">Typical Foreign Plurals (Latin & Greek Roots)</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 font-mono">
                        <strong className="text-indigo-950 font-sans block">Latin: -um → -a</strong>
                        Datum → Data<br />
                        Stratum → Strata<br />
                        Dictum → Dicta<br />
                        Memorandum → Memoranda<br />
                        Addendum → Addenda
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 font-mono">
                        <strong className="text-indigo-950 font-sans block">Latin: -us → -i</strong>
                        Radius → Radii<br />
                        Syllabus → Syllabi<br />
                        Focus → Foci<br />
                        Cactus → Cacti
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 font-mono">
                        <strong className="text-indigo-950 font-sans block">Greek: -is → -es / -on → -a</strong>
                        Analysis → Analyses<br />
                        Crisis → Crises<br />
                        Thesis → Theses<br />
                        Criterion → Criteria<br />
                        Phenomenon → Phenomena
                      </div>
                    </div>
                  </div>
                )}

                {/* Rule 21 */}
                {matchesSearch('rule 21 human rights current events armed forces natural resources') && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px]">RULE 21</span>
                      <span className="font-bold text-slate-900 text-xs">Compound Nouns Always in Plural Form</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      <em>Human rights, current events, inverted commas, armed forces, natural resources, social studies, industrial relations, high heels.</em>
                    </p>
                    <p className="text-[11px] font-mono text-emerald-800 bg-white p-2 rounded border border-slate-200">
                      ✅ High heels cause discomfort.<br />
                      ✅ Natural resources are abundant in this region.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SECTION 9: Rule 22 - Meaning Shifts (Wood vs Woods) */}
          {(activeSection === 'all' || activeSection === 'rule_22') && matchesSearch('rule 22 meaning shift wood woods sand sands spectacle spectacles air airs') && (
            <section id="rule_22" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs">RULE 22</span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Nouns with Radical Meaning Shifts in Plural</h2>
                    <p className="text-xs text-slate-500">Adding '-s' creates an entirely different vocabulary word, NOT just a plural</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">Vocabulary Master</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs sm:text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Singular Form</th>
                      <th className="py-2.5 px-3">Singular Meaning</th>
                      <th className="py-2.5 px-3 text-indigo-700">Plural Form (+s)</th>
                      <th className="py-2.5 px-3 text-indigo-900">Changed Plural Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { s: 'Wood', s_m: 'Timber / trunk material', p: 'Woods', p_m: 'A small forest' },
                      { s: 'Sand', s_m: 'Loose granular particles', p: 'Sands', p_m: 'A desert or beach expanse' },
                      { s: 'Spectacle', s_m: 'A remarkable sight or show', p: 'Spectacles', p_m: 'Eyeglasses (pair of glasses)' },
                      { s: 'Damage', s_m: 'Harm or physical impairment', p: 'Damages', p_m: 'Financial compensation awarded' },
                      { s: 'Air', s_m: 'Atmospheric gas', p: 'Airs', p_m: 'Affected haughty manners to impress' },
                      { s: 'Force', s_m: 'Strength or physical energy', p: 'Forces', p_m: 'Armed military / police personnel' },
                      { s: 'Iron', s_m: 'A metallic chemical element', p: 'Irons', p_m: 'Chains, fetters, or handcuffs' },
                      { s: 'Return', s_m: 'Coming or going back', p: 'Returns', p_m: 'Income tax returns / profits' },
                      { s: 'Custom', s_m: 'A social tradition or practice', p: 'Customs', p_m: 'Import/Export duty tax' },
                      { s: 'Chain', s_m: 'Sequential connected items', p: 'Chains', p_m: 'Linked metal restraints' },
                      { s: 'Ground', s_m: 'Earth’s solid surface', p: 'Grounds', p_m: 'Logical foundation / legal reasons' },
                      { s: 'Asset', s_m: 'A useful quality or trait', p: 'Assets', p_m: 'Financial property / possessions' },
                      { s: 'Alphabet', s_m: 'The set of 26 letters (A–Z)', p: 'Alphabets', p_m: 'Multiple languages' },
                      { s: 'Content', s_m: 'State of mental satisfaction', p: 'Contents', p_m: 'Subject matters in a book/container' },
                      { s: 'Water', s_m: 'Clear liquid (H2O)', p: 'Waters', p_m: 'Ocean / Sea / Territorial sea' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-bold font-mono text-slate-900">{row.s}</td>
                        <td className="py-2 px-3 text-slate-600">{row.s_m}</td>
                        <td className="py-2 px-3 font-bold font-mono text-indigo-700 bg-indigo-50/30">{row.p}</td>
                        <td className="py-2 px-3 font-semibold text-indigo-950 bg-indigo-50/30">{row.p_m}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* SECTION 10: Rule 23 - Apostrophe Laws */}
          {(activeSection === 'all' || activeSection === 'rule_23') && matchesSearch('rule 23 apostrophe s possession living non-living else') && (
            <section id="rule_23" className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs">RULE 23</span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Comprehensive Apostrophe (’s) Laws</h2>
                    <p className="text-xs text-slate-500">The 12 non-negotiable rules governing possession and apostrophes in SSC</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">12 Sub-Rules</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-[13px]">
                {/* i & vii: Living vs Non-Living */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <span className="font-bold text-slate-900 block">i & vii. Living Beings vs Non-Living Objects</span>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    Use <strong>’s</strong> only for living beings. For inanimate objects, strictly use <strong>"of"</strong>:
                  </p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <p className="text-rose-700">❌ The telephone’s cable is damaged.</p>
                    <p className="text-emerald-700">✅ The cable of the telephone is damaged.</p>
                    <p className="text-rose-700">❌ The child broke the table’s leg.</p>
                    <p className="text-emerald-700">✅ The child broke the leg of the table.</p>
                  </div>
                </div>

                {/* ii: Plurals ending in -s */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <span className="font-bold text-slate-900 block">ii. Plurals Ending in 'S'</span>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    To show plural possession for nouns already ending in -s, append <strong>only the apostrophe (’)</strong> without an extra 's':
                  </p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <p className="text-rose-700">❌ boy’s hostel (implies 1 boy)</p>
                    <p className="text-emerald-700">✅ boys’ hostel (all boys)</p>
                    <p className="text-emerald-700">✅ girls’ school, Keats’ poems</p>
                  </div>
                </div>

                {/* viii, ix, x: Non-living Exceptions */}
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2 sm:col-span-2">
                  <span className="font-bold text-amber-950 block">viii, ix, x. Permitted Non-Living Exceptions</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                      <strong className="text-slate-900 block mb-0.5">1. Personification</strong>
                      <p className="text-slate-600">Nature’s fury, The wind’s song, Fortune’s favorite</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                      <strong className="text-slate-900 block mb-0.5">2. Celestial Bodies</strong>
                      <p className="text-slate-600">The Earth’s rotation, The Sun’s rays, The Moon’s surface</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                      <strong className="text-slate-900 block mb-0.5">3. Standard Idioms</strong>
                      <p className="text-slate-600">At one’s wit’s end, At an arm’s length, At a stone’s throw</p>
                    </div>
                  </div>
                </div>

                {/* xi: Double Apostrophe */}
                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
                  <span className="font-bold text-rose-950 block">xi. Double Apostrophe Forbidden 🚫</span>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    Never chain two apostrophes consecutively in a single phrase:
                  </p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <p className="text-rose-700">❌ My mother’s friend’s daughter has topped.</p>
                    <p className="text-emerald-700">✅ The daughter of my mother’s friend has topped the exam.</p>
                  </div>
                </div>

                {/* xii: Indefinite Pronouns + Else */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <span className="font-bold text-slate-900 block">xii. Anybody / Somebody + "Else"</span>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    If <strong>else</strong> follows an indefinite pronoun, put <strong>’s on "else"</strong>:
                  </p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <p className="text-emerald-700">✅ Everyone’s duty is no one’s duty.</p>
                    <p className="text-rose-700">❌ I will follow somebody’s else advice.</p>
                    <p className="text-emerald-700">✅ I will follow somebody else’s advice.</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
