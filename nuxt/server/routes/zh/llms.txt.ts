/**
 * /zh/llms.txt — the Chinese prefix otherwise 404s. The facts are the same
 * file as /llms.txt; this does not publish a second, drifting copy.
 */
export default defineEventHandler((event) => {
  return sendRedirect(event, '/llms.txt', 301)
})
