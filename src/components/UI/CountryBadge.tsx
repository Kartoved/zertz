import { getCountryFlagImageUrl, normalizeCountryValue, toCountryEmoji } from '../../utils/country';

interface CountryBadgeProps {
  country: string | null | undefined;
  size?: number;
  className?: string;
}

export default function CountryBadge({ country, size = 18, className = '' }: CountryBadgeProps) {
  const normalized = normalizeCountryValue(country);
  const imageUrl = getCountryFlagImageUrl(normalized);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={normalized}
        width={size}
        height={Math.round(size * 0.75)}
        className={`inline-block rounded-sm align-middle ${className}`.trim()}
        loading="lazy"
      />
    );
  }

  return (
    <span className={className}>
      {toCountryEmoji(normalized)}
    </span>
  );
}
