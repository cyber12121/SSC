import React, { useMemo } from 'react';
import { Zap, BookOpen, Calculator, ListOrdered, Lightbulb, CheckCircle2 } from 'lucide-react';
import { FormattedText } from './FormattedText';
import { parseSolutionSections, extractSolutionLanguage, SolutionSection } from '../utils/cleanSolution';

interface SolutionViewerProps {
  solution?: string;
  language?: 'English' | 'Hindi' | 'Bilingual' | string;
  className?: string;
  subject?: string;
}

export const SolutionViewer: React.FC<SolutionViewerProps> = React.memo(({
  solution = '',
  language = 'English',
  className = '',
  subject,
}) => {
  const localizedSolution = useMemo(() => {
    if (!solution) return '';
    return extractSolutionLanguage(solution, language);
  }, [solution, language]);

  const sections = useMemo(() => {
    if (!localizedSolution) return [];
    return parseSolutionSections(localizedSolution);
  }, [localizedSolution]);

  if (!localizedSolution) {
    return (
      <div className="text-sm text-slate-500 italic py-2">
        Solution details are available in the question paper bank.
      </div>
    );
  }

  // If there's only one general section or no section headers, render standard clean container
  if (sections.length <= 1 && sections[0]?.type === 'general') {
    return (
      <div className={`text-slate-800 leading-relaxed font-sans ${className}`}>
        <FormattedText text={localizedSolution} language={language} as="div" breakOnSentences />
      </div>
    );
  }

  const renderSectionIcon = (type: SolutionSection['type']) => {
    switch (type) {
      case 'shortcut':
        return <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />;
      case 'formula':
        return <Calculator className="w-4 h-4 text-emerald-600" />;
      case 'given':
        return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'calculation':
        return <ListOrdered className="w-4 h-4 text-indigo-600" />;
      case 'additional':
        return <Lightbulb className="w-4 h-4 text-purple-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-500" />;
    }
  };

  const getSectionBadgeStyle = (type: SolutionSection['type']) => {
    switch (type) {
      case 'shortcut':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'formula':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case 'given':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'calculation':
        return 'bg-indigo-50 border-indigo-200 text-indigo-900';
      case 'additional':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  return (
    <div className={`space-y-3.5 font-sans ${className}`}>
      {sections.map((sec, idx) => {
        // Special card for Shortcut Trick
        if (sec.type === 'shortcut') {
          return (
            <div
              key={idx}
              className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3.5 sm:p-4 shadow-2xs"
            >
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-amber-200/60 font-semibold text-amber-900 text-sm">
                <div className="p-1 rounded-md bg-amber-100/80">
                  {renderSectionIcon('shortcut')}
                </div>
                <span>{sec.title || 'Shortcut Trick'}</span>
              </div>
              <div className="text-[14px] text-slate-800 leading-relaxed whitespace-pre-line">
                <FormattedText text={sec.content} language={language} as="div" breakOnSentences />
              </div>
            </div>
          );
        }

        // Special card for Additional Information
        if (sec.type === 'additional') {
          return (
            <div
              key={idx}
              className="rounded-lg border border-purple-100 bg-purple-50/30 p-3.5 sm:p-4 shadow-2xs"
            >
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-purple-200/50 font-semibold text-purple-900 text-sm">
                <div className="p-1 rounded-md bg-purple-100/70">
                  {renderSectionIcon('additional')}
                </div>
                <span>{sec.title || 'Additional Information & Key Concepts'}</span>
              </div>
              <div className="text-[13.5px] text-slate-700 leading-relaxed whitespace-pre-line">
                <FormattedText text={sec.content} language={language} as="div" breakOnSentences />
              </div>
            </div>
          );
        }

        // Step-by-Step Calculation or Formula or Given
        return (
          <div
            key={idx}
            className="rounded-lg border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs"
          >
            {sec.title && (
              <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-slate-100">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getSectionBadgeStyle(sec.type)}`}>
                  {renderSectionIcon(sec.type)}
                  {sec.title}
                </span>
              </div>
            )}
            <div className="text-[14px] text-slate-800 leading-relaxed whitespace-pre-line">
              <FormattedText text={sec.content} language={language} as="div" breakOnSentences />
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default SolutionViewer;
