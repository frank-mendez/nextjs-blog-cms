import type { Metadata } from 'next'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { requirePermission } from '@/lib/auth/session'
import {
  getSubscriberStats,
  getScheduledSends,
  getRecentSubscribers,
} from '@/features/newsletter/queries'

export const metadata: Metadata = { title: 'Newsletter' }

export default async function NewsletterPage() {
  await requirePermission('users:read')

  const [stats, scheduledSends, recentSubscribers] = await Promise.all([
    getSubscriberStats(),
    getScheduledSends(),
    getRecentSubscribers(20),
  ])

  return (
    <div className="p-4 md:p-8 space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Newsletter</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage subscribers and scheduled sends
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Active Subscribers" value={stats.active} />
        <StatCard label="Sends Dispatched" value={stats.sends_dispatched} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} />
      </div>

      {scheduledSends.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b font-semibold text-sm">Scheduled Sends</div>
          <div className="divide-y">
            {scheduledSends.map((send) => (
              <div key={send.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="font-medium truncate mr-4">{send.post_title}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-muted-foreground text-xs">
                    {new Date(send.scheduled_at) > new Date()
                      ? `Sends in ${formatDistanceToNow(new Date(send.scheduled_at))}`
                      : 'Processing...'}
                  </span>
                  <StatusBadge status={send.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
          <span>Subscribers</span>
          <Link
            href="/api/newsletter/subscribers/export"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Export CSV
          </Link>
        </div>
        {recentSubscribers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No subscribers yet.</p>
        ) : (
          <div className="divide-y">
            {recentSubscribers.map((sub) => (
              <div key={sub.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span>{sub.email}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(sub.subscribed_at), 'MMM d, yyyy')}
                  </span>
                  <StatusBadge status={sub.unsubscribed_at ? 'unsubscribed' : 'active'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

const statusClasses: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  sending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  unsubscribed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses[status] ?? ''}`}
    >
      {status}
    </span>
  )
}
