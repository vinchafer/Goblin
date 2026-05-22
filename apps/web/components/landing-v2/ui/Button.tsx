import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary';
type Size = 'default' | 'large';

type Common = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

type AsLink = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { href: string };
type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };

function classes(variant: Variant, size: Size, extra?: string) {
  const c = ['btn', `btn-${variant}`];
  if (size === 'large') c.push('btn-large');
  if (extra) c.push(extra);
  return c.join(' ');
}

export function Button(props: AsLink | AsButton) {
  const { variant = 'primary', size = 'default', children, className } = props;
  const cls = classes(variant, size, className);

  if (props.href !== undefined) {
    const { variant: _v, size: _s, children: _c, className: _cn, ...rest } = props;
    void _v; void _s; void _c; void _cn;
    return (
      <a {...rest} className={cls}>
        {children}
      </a>
    );
  }

  const { variant: _v, size: _s, children: _c, className: _cn, href: _h, ...rest } = props;
  void _v; void _s; void _c; void _cn; void _h;
  return (
    <button {...rest} className={cls}>
      {children}
    </button>
  );
}
