'use client';

import { useEffect, useRef } from 'react';
import { SectionHead } from '@/components/landing/ui/SectionHead';

export function SendToCode() {
  const illustRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = illustRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      el?.classList.add('is-active');
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) el.classList.add('is-active');
          else if (e.intersectionRatio === 0) el.classList.remove('is-active');
        });
      },
      { threshold: [0, 0.35] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="stc">
      <div className="container">
        <SectionHead
          num="03"
          total="05"
          label="Core feature"
          heading={
            <>
              One tap. <span className="serif-italic">Code lands in your editor.</span>
            </>
          }
          lead="No clipboard. No tab juggling. AI writes — you ship."
        />

        <div className="stc-illust" ref={illustRef}>
          {/* Chat */}
          <div className="stc-card-chat">
            <div className="stc-chat-head">
              <span className="mark-tag" aria-hidden="true">
                <svg>
                  <use href="#goblin-mark" />
                </svg>
              </span>
              <span className="name">Goblin Chat</span>
              <span className="model">claude-sonnet-4-6</span>
            </div>
            <div className="stc-body">
              <div className="msg-user">Add a dark mode toggle to the navbar</div>
              <div className="msg-row">
                <span className="msg-avatar" aria-hidden="true">
                  <svg>
                    <use href="#goblin-mark" />
                  </svg>
                </span>
                <div className="msg-ai">
                  Here&apos;s your updated component:
                  <pre className="code-pre">
                    <span className="kw">export function</span> <span className="fn">Navbar</span>() &#123;
                    {'\n  '}
                    <span className="kw">const</span> [dark, setDark] = <span className="fn">useState</span>(false)
                    {'\n  '}
                    <span className="kw">return</span> &lt;<span className="fn">nav</span>&gt;...&lt;/<span className="fn">nav</span>&gt;
                    {'\n'}
                    &#125;
                  </pre>
                  <span className="send-btn">
                    Send to Code <span className="arrow" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="stc-arrow" aria-hidden="true">
            <div className="stc-arrow-line" />
            <div className="stc-arrow-mark">→</div>
          </div>

          {/* Editor */}
          <div className="stc-card-editor">
            <div className="stc-editor-head">
              <span className="file">Navbar.tsx</span>
              <span className="badge">
                <span className="blip" aria-hidden="true" /> Injected
              </span>
            </div>
            <div className="stc-editor-body">
              <div className="comment">// injected via Send to Code</div>
              <div>
                <span className="kw">import</span> &#123; useState &#125; <span className="kw">from</span>{' '}
                <span className="str">&apos;react&apos;</span>
              </div>
              <div style={{ height: 10 }} />
              <span className="injected first">
                <span className="kw">export function</span> <span className="fn">Navbar</span>() &#123;
              </span>
              <span className="injected">
                {'  '}
                <span className="kw">const</span> [dark, setDark] = <span className="fn">useState</span>(
                <span className="kw">false</span>)
              </span>
              <span className="injected">
                {'  '}
                <span className="kw">const</span> toggle = () =&gt; <span className="fn">setDark</span>(d =&gt; !d)
              </span>
              <span className="injected">
                {'  '}
                <span className="kw">return</span> &lt;<span className="fn">nav</span>&gt;...&lt;/
                <span className="fn">nav</span>&gt;
              </span>
              <span className="injected last">
                &#125;
                <span className="cursor" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
