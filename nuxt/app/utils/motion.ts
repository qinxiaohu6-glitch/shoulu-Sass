/**
 * Respect the operating-system motion preference for scripted page scrolling.
 * The matching CSS rule sets `scroll-behavior: auto` too, so `auto` is instant
 * under reduced motion instead of inheriting the site's normal smooth scroll.
 */
export function pageScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto'
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}
