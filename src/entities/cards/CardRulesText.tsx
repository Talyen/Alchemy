import type { Ref } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { keywordDefinitions } from '@/shared/content/keywords';

type CardRulesTextProps = {
  color?: string;
  fontSize?: number;
  lineHeight?: number;
  text: string;
  textRef?: Ref<HTMLParagraphElement>;
};

export function CardRulesText({
  color = '#231b18',
  fontSize,
  lineHeight = 1.24,
  text,
  textRef,
}: CardRulesTextProps) {
  const keywordEntries = Object.values(keywordDefinitions).sort(
    (left, right) => right.label.length - left.label.length,
  );
  const matcher = new RegExp(`\\b(${keywordEntries.map((entry) => entry.label).join('|')})\\b`, 'g');
  const segments = text.split(matcher);

  return (
    <TooltipProvider delayDuration={80}>
      <p
        ref={textRef}
        style={{
          color,
          fontSize,
          fontWeight: 600,
          lineHeight,
          overflowWrap: 'anywhere',
          textAlign: 'center',
          textWrap: 'balance',
          whiteSpace: 'pre-line',
        }}
      >
        {segments.map((segment, index) => {
          const definition = keywordEntries.find((entry) => entry.label === segment);

          if (!definition) {
            return <span key={`${segment}-${index}`}>{segment}</span>;
          }

          return (
            <Tooltip key={`${segment}-${index}`}>
              <TooltipTrigger asChild>
                <span className="cursor-help font-extrabold" style={{ color: definition.color }}>
                  {segment}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px]">{definition.description}</TooltipContent>
            </Tooltip>
          );
        })}
      </p>
    </TooltipProvider>
  );
}