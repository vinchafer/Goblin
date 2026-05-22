import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary';
type Size = 'default' | 'large';

type Common = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

type AsLink = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
type AsButton = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

function classes(variant: Variant, size: Size, extra?: string) {
  const c = ['btn', `btn-${variant}`];
  if (size === 'large') c.push('btn-large');
  if (extra) c.push(extra);
  return c.join(' ');
}

export function Button(props: AsLink | AsButton) {
  const { variant = 'primary', size = 'default', children, className, ...rest } = props as AsLink &
    AsButton;
  const cls = classes(variant, size, className);
  if ('href' in props && props.href !== undefined) {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} className={cls}>
      {children}
    </button>
  );
}
