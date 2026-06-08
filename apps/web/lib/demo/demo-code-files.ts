// The demo code file(s). For the Sprint 10 §B0.1 Option-β code view, the demo
// renders the real CodeEditor leaf with DEMO_CODE_FILES[0] (Navbar.tsx). The
// richer shape (path/language) leaves room for the full-workspace Option α later.

export interface DemoCodeFile {
  path: string;
  filename: string;
  language: string;
  content: string;
}

const NAVBAR = `export function Navbar() {
  const [dark, setDark] = useState(false)
  const toggle = () => setDark((d) => !d)

  return (
    <nav className={dark ? 'dark' : ''}>
      <Logo />
      <div className="links">
        <a href="/work">Work</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </div>
      <Toggle onChange={toggle} checked={dark} />
    </nav>
  )
}
`;

export const DEMO_CODE_FILES: DemoCodeFile[] = [
  {
    path: "src/components/Navbar.tsx",
    filename: "Navbar.tsx",
    language: "tsx",
    content: NAVBAR,
  },
];
