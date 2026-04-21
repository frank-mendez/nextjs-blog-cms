'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({ email: z.string().email('Enter a valid email address') })
type FormValues = z.infer<typeof schema>

export function SubscribeForm() {
  const [subscribed, setSubscribed] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    const res = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const json = await res.json()
    if (json.success) {
      setSubscribed(true)
      toast.success(json.message)
    } else {
      toast.error(json.message ?? 'Something went wrong')
    }
  }

  if (subscribed) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center max-w-lg mx-auto mt-12">
        <p className="font-semibold text-lg">You&apos;re subscribed!</p>
        <p className="text-muted-foreground text-sm mt-1">
          You&apos;ll get an email when the next post is published.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-8 text-center max-w-lg mx-auto mt-12">
      <h2 className="text-xl font-bold mb-1">Stay in the loop</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Get notified when new posts are published. No spam, unsubscribe anytime.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 max-w-sm mx-auto">
        <Input
          {...register('email')}
          type="email"
          placeholder="your@email.com"
          className="flex-1"
          disabled={isSubmitting}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Subscribing...' : 'Subscribe'}
        </Button>
      </form>
      {errors.email && (
        <p className="text-destructive text-xs mt-2">{errors.email.message}</p>
      )}
      <p className="text-muted-foreground text-xs mt-3">No spam · Unsubscribe anytime</p>
    </div>
  )
}
