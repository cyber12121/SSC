import React, { useMemo } from 'react';
import katex from 'katex';
import { getLanguageText, tokenizeTextWithMath, MathToken } from '../utils/formatQuestionText';

interface FormattedTextProps {
  text?: string;
  language?: 'English' | 'Hindi' | 'Bilingual' | string;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

export const FormattedText: React.FC<FormattedTextProps> = React.memo(({
  text = '',
  language = 'English',
  className = '',
  as: Component = 'span',
}) => {
  const tokens = useMemo(() => {
    if (!text) return [];
    const localized = getLanguageText(text, (language as any) || 'English');
    return tokenizeTextWithMath(localized);
  }, [text, language]);

  if (!tokens || tokens.length === 0) return null;

  return (
    <Component className={className}>
      {tokens.map((token, idx) => {
        if (token.type === 'math') {
          try {
            const html = katex.renderToString(token.value, {
              throwOnError: false,
              displayMode: Boolean(token.display),
            });
            return (
              <span
                key={idx}
                className={token.display ? 'block my-2 overflow-x-auto text-center' : 'inline-block px-0.5 align-baseline'}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return (
              <span key={idx} className="font-mono text-sm px-1 bg-gray-100 rounded">
                {token.value}
              </span>
            );
          }
        }

        return (
          <span key={idx} className="whitespace-pre-line">
            {token.value}
          </span>
        );
      })}
    </Component>
  );
});

export default FormattedText;
