import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold mb-4" style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--goblin-moss)' }}>
        404
      </h1>
      <p className="text-lg mb-6 max-w-md" style={{ color: 'var(--goblin-gray)' }}>
        Your goblin couldn't find this page.
      </p>

      <Link
        href="/"
        className="px-6 py-2.5 rounded-lg font-medium"
        style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
      >
        Back to workshop
      </Link>
    </div>
  );
}