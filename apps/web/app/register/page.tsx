// B2 (Sprint 2): give signup a real, discoverable URL. The /login page already has a full
// signup flow (email+password, OAuth, terms) reachable via ?mode=signup and a visible
// "Create an account" switch. Rather than duplicate that 650-line form, /register resolves
// to the signup mode so links/CTAs can point at /register.
import { redirect } from 'next/navigation';

export default function RegisterRedirect() {
  redirect('/login?mode=signup');
}
