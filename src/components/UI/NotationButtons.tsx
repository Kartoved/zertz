import { useState } from 'react';
import { useI18n } from '../../i18n';

interface NotationButtonsProps {
  /** Compute the ZIP string for the current position (called on click). */
  getZip: () => string;
  /** Compute the ZEN string for the whole game (called on click). */
  getZen?: () => string;
  className?: string;
  /** Override the per-button classes (e.g. compact header styling). */
  buttonClassName?: string;
}

// Copy-to-clipboard buttons for the ZIP (position) and ZEN (game) notations.
// Reused across the local game, online room and studies.
export default function NotationButtons({ getZip, getZen, className, buttonClassName }: NotationButtonsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<'zip' | 'zen' | null>(null);

  const copy = async (which: 'zip' | 'zen', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(c => (c === which ? null : c)), 1500);
    } catch {
      /* clipboard blocked (insecure context) — ignore */
    }
  };

  const base = buttonClassName ??
    'px-4 py-2 rounded-lg transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 ' +
    'dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm';

  return (
    <div className={className ?? 'flex flex-wrap gap-2 justify-center'}>
      <button type="button" onClick={() => copy('zip', getZip())} className={base}>
        {copied === 'zip' ? t.copied : `⧉ ${t.copyPosition}`}
      </button>
      {getZen && (
        <button type="button" onClick={() => copy('zen', getZen())} className={base}>
          {copied === 'zen' ? t.copied : `⤓ ${t.exportGame}`}
        </button>
      )}
    </div>
  );
}
