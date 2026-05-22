import type { ReactNode } from 'react';

type SectionHeadProps = {
  num?: string;
  total?: string;
  label: ReactNode;
  heading: ReactNode;
  lead?: ReactNode;
  centered?: boolean;
  style?: React.CSSProperties;
};

export function SectionHead({ num, total, label, heading, lead, centered = true, style }: SectionHeadProps) {
  return (
    <div className={`section-head${centered ? ' centered' : ''}`} style={style}>
      <div className="meta-row">
        <span className="rule" aria-hidden="true" />
        <span>
          {num ? <span className="num">{num}</span> : null}
          {num && total ? <> / {total} · </> : null}
          {!num && total ? <> · </> : null}
          {label}
        </span>
        <span className="rule" aria-hidden="true" />
      </div>
      <h2 className="h2">{heading}</h2>
      {lead ? <p className="lead">{lead}</p> : null}
    </div>
  );
}
