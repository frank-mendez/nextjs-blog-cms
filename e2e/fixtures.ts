import { test as base, expect } from '@playwright/test'
import { readFileSync } from 'fs'

interface E2EState {
  apiKey: string
  userId: string
  seedPostIds: string[]
}

function readState(): E2EState {
  return JSON.parse(readFileSync('.e2e-state.json', 'utf8'))
}

export const test = base.extend<{
  apiKey: string
  seedPostIds: string[]
}>({
  apiKey: async ({}, use) => {
    await use(readState().apiKey)
  },
  seedPostIds: async ({}, use) => {
    await use(readState().seedPostIds)
  },
})

export { expect }
