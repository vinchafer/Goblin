// FINAL-POLISH · U4: the root route splash — now the shared PageLoading, so it is
// pixel-identical to every other loading surface and nothing jumps mid-load. The copy
// was also German-only here; PageLoading resolves DE·EN like the rest of the app.
import { PageLoading } from '@/components/ui/PageLoading';

export default function Loading() {
  return <PageLoading context="workspace" fill="viewport" />;
}
