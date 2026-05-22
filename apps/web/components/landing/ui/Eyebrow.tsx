import type { ReactNode } from 'react';

type EyebrowProps = {
  num: ReactNode;
  children: ReactNode;
  onDeep?: boolean;
  className?: string;
};

export function Eyebrow({ num, children, onDeep, className }: EyebrowProps) {
  const classes = ['eyebrow'];
  if (onDeep) classes.push('on-deep');
  if (className) classes.push(className);
  return (
    <div className={classes.join(' ')}>
      <span className="tick" aria-hidden="true" />
      <span className="num">{num}</span>
      <span>·</span>
      <span>{children}</span>
    </div>
  );
}
