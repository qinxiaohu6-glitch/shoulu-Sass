export const APP_PLATFORMS = ['ios', 'android', 'macos'] as const
export type AppPlatform = (typeof APP_PLATFORMS)[number]

/** Store facts imported from an official public listing page or catalog API. */
export interface AppStoreInfo {
  platform: AppPlatform
  appId: string
  storeUrl: string
  name: string
  developer: string
  description: string
  icon: string
  screenshots: string[]
  category: string
  genres: string[]
  version: string
  updatedAt: string
  releasedAt: string
  priceLabel: string
  rating: number | null
  ratingCount: number | null
  size: string
  minimumOsVersion: string
  ageRating: string
}
