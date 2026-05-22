type LockupProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onDeep?: boolean;
  href?: string;
  ariaLabel?: string;
  asLink?: boolean;
};

export function Lockup({ size = 'sm', onDeep = false, href = '#', ariaLabel = 'Goblin home', asLink = true }: LockupProps) {
  const classes = ['lockup'];
  if (size === 'md') classes.push('lockup--md');
  if (size === 'lg') classes.push('lockup--lg');
  if (size === 'xl') classes.push('lockup--xl');
  if (onDeep) classes.push('lockup--on-deep');

  const content = (
    <>
      <span className="mark">
        <svg>
          <use href="#goblin-mark" />
        </svg>
      </span>
      <span className="wordmark">GOBLIN</span>
    </>
  );

  if (!asLink) {
    return (
      <span className={classes.join(' ')} aria-label={ariaLabel}>
        {content}
      </span>
    );
  }

  return (
    <a href={href} className={classes.join(' ')} aria-label={ariaLabel}>
      {content}
    </a>
  );
}
