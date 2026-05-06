import { useI18n } from '../../i18n';

interface OnlineIndicatorProps {
  online?: boolean | null;
  lastSeenMs?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}

export default function OnlineIndicator({ online, lastSeenMs, size = 'sm', className = '' }: OnlineIndicatorProps) {
  const { t } = useI18n();
  const isOnline = !!online;
  const dim = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  const title = isOnline
    ? t.statusOnline
    : lastSeenMs
      ? `${t.statusOffline} · ${new Date(lastSeenMs).toLocaleString()}`
      : t.statusOffline;
  return (
    <span
      className={`inline-block rounded-full ${dim} ${
        isOnline
          ? 'bg-green-500 ring-2 ring-green-500/30'
          : 'bg-gray-400 dark:bg-gray-500'
      } ${className}`}
      title={title}
      aria-label={title}
    />
  );
}
