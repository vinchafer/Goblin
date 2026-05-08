import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    version: process.env.npm_package_version || '0.0.0',
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    buildTime: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    webReady: true,
  })
}
