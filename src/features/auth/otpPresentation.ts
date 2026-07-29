export type OtpPurpose = 'register' | 'update_email' | 'forgot_password'

export function otpVerificationEndpoint(purpose: OtpPurpose): string {
  return purpose === 'update_email' ? '/auth/email-change/verify' : '/auth/verify-otp'
}

export function otpResendEndpoint(purpose: OtpPurpose): string {
  return purpose === 'update_email' ? '/auth/email-change/resend' : '/auth/resend-otp'
}

export function parseOtpDate(value: unknown): number {
  if (typeof value !== 'string') return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function otpErrorKey(code: unknown, resend = false): string {
  if (code === 'otp_locked') return 'errors.otpLocked'
  if (code === 'otp_consumed') return 'errors.otpConsumed'
  if (code === 'otp_resend_cooldown') return 'errors.otpResendCooldown'
  if (code === 'otp_resend_limit') return 'errors.otpResendLimit'
  if (code === 'otp_issue_limit') return 'errors.otpIssueLimit'
  if (code === 'otp_invalid' || code === 'otp_invalid_or_expired') {
    return 'errors.otpInvalidOrExpired'
  }
  return resend ? 'errors.resendFailed' : 'errors.verificationFailed'
}
