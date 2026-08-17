// next/navigation outside the Next runtime. The evidence harness never performs an
// interaction that routes, so these are inert rather than fake: a call would be a bug in
// the harness, not something to silently absorb.
export function useRouter() {
  return {
    push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {},
  };
}
export function usePathname() { return '/dashboard/project/evidence/work'; }
export function useSearchParams() { return new URLSearchParams(); }
