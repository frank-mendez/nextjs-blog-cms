export function parsePaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

export function parsePostFilters(searchParams: URLSearchParams) {
  return {
    status: searchParams.get('status') || null,
    category: searchParams.get('category') || null,
    tag: searchParams.get('tag') || null,
    search: searchParams.get('search') || null,
    sort: searchParams.get('sort') || 'created_at',
    order: searchParams.get('order') || 'desc',
  }
}

export function apiSuccess(data: Record<string, unknown>, status = 200) {
  return Response.json({ success: true, ...data }, { status })
}

export function apiError(message: string, status: number, details?: unknown) {
  return Response.json(
    { success: false, error: message, ...(details !== undefined ? { details } : {}) },
    { status }
  )
}
