/**
 * Which sign-in methods this build actually supports.
 *
 * The source reads these from a `configs` table (`usePublicConfig`), and every
 * auth page branches on them — `email_auth_enabled`, `google_auth_enabled`,
 * `email_verification_enabled`, `password_reset_enabled`,
 * `invite_code_required`. That is why the ported pages can look exactly like
 * the source while showing only what works here: the flags are the switch.
 *
 * The values below describe this build, not a guess:
 *
 *  - **email** off. There is no password store — `server/utils/oauth.ts` only
 *    knows Google. Rendering the email form would be a form whose submit can
 *    never succeed.
 *  - **Google** on. `/auth/google/start` reports `unconfigured` if the client
 *    credentials are missing, which the sign-in page turns into a sentence.
 *  - **GitHub** off. No provider implementation.
 *  - **email verification** off, and **password reset** off — both need an
 *    outbound mailer and a password store.
 *  - **invite codes** off. No invite table.
 *
 * Kept as strings with the source's exact comparisons (`!== 'false'`,
 * `=== 'true'`) so the ported conditions are literally the source's.
 */
export type AuthConfig = {
  email_auth_enabled: string
  google_auth_enabled: string
  github_auth_enabled: string
  email_verification_enabled: string
  password_reset_enabled: string
  invite_code_required: string
}

const CONFIG: AuthConfig = {
  email_auth_enabled: 'false',
  google_auth_enabled: 'true',
  github_auth_enabled: 'false',
  email_verification_enabled: 'false',
  password_reset_enabled: 'false',
  invite_code_required: 'false',
}

export function useAuthConfig() {
  // Known at build time, so there is no loading state to model — but the flag
  // stays, because every ported page checks it before deciding what to draw.
  const configs = CONFIG
  const configsLoaded = true

  return {
    configs,
    configsLoaded,
    emailEnabled: configs.email_auth_enabled !== 'false',
    googleEnabled: configs.google_auth_enabled === 'true',
    githubEnabled: configs.github_auth_enabled === 'true',
    emailVerificationEnabled: configs.email_verification_enabled === 'true',
    passwordResetEnabled: configs.password_reset_enabled === 'true',
    inviteCodeRequired: configs.invite_code_required === 'true',
  }
}
