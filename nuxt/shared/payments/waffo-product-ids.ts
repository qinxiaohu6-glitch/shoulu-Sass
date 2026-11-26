/**
 * One Waffo product per charge. The value is the product whose stored USD
 * price equals that charge. Written by `scripts/waffo/waffo-products.mjs --apply`
 * after a read-back. The worker secret overrides a key when it sets the same key.
 *
 * These ids are not a secret. They do not replace the legacy plan keys the
 * current production site still uses (`boost`, `ad`, …).
 */
export const WAFFO_PRODUCT_IDS: Record<string, string> = {
  "boost:1000": "PROD_0W7RTBaauecsQhu3opCN2z",
  "boost:499": "PROD_1j7HUJ9so8g5aWKH8bP0ob",
  "standard:1900": "PROD_48ifnToNG6mZa24d3Gjx2h",
  "standard:900": "PROD_4M70yeAtGZI1aQnJ5oCWaH",
  "featured:3900": "PROD_6Mzd5XSbGLnYcQTlkfSwvJ",
  "featured:1900": "PROD_1cohiXUi7R9UIRwk64wsye",
  "pro:6900": "PROD_5PrYQOJRkq0H2YqbujPA2n",
  "pro:2900": "PROD_7dZQ9Dq3lGrKvdDu4F768k",
  "ad:2900": "PROD_6w76qtB4sawTVgI3C5Cti5",
  "ad:11600": "PROD_3dtbsZ5ftZLMxoB97f1Tne",
  "ad:1900": "PROD_2t6wq9wL3Wl0voRlAAjpGU",
  "ad:900": "PROD_0KdPc0mjsZY5U3tjsWzzb1",
  "ad:7600": "PROD_5TwEZ4bmYBM4dN0hglilHe",
  "ad:3200": "PROD_77ciwxRi68FPLyEUxIhK1X",
  "ad:3900": "PROD_7HSJbyGuEILzJ5IQicR6bU",
  "ad:15600": "PROD_54bwXhXENLURIGg3YpUYCV"
}
