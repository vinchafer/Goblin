export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{
        borderColor: 'var(--goblin-light)',
        borderTopColor: 'var(--goblin-moss)'
      }} />
    </div>
  );
}