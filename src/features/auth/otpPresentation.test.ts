import { describe, expect, it } from 'vitest'
import {
  otpErrorKey,
  otpResendEndpoint,
  otpVerificationEndpoint,
  parseOtpDate,
} from './otpPresentation'

describe('OTP presentation contract', () => {
  it('uses authenticated email-change endpoints only for update-email flows', () => {
    expect(otpVerificationEndpoint('update_email')).toBe('/auth/email-change/verify')
    expect(otpResendEndpoint('update_email')).toBe('/auth/email-change/resend')
    expect(otpVerificationEndpoint('register')).toBe('/auth/verify-otp')
    expect(otpResendEndpoint('forgot_password')).toBe('/auth/resend-otp')
  })

  it('maps bounded OTP states to locale keys without displaying backend text', () => {
    expect(otpErrorKey('otp_locked')).toBe('errors.otpLocked')
    expect(otpErrorKey('otp_invalid')).toBe('errors.otpInvalidOrExpired')
    expect(otpErrorKey('otp_resend_cooldown', true)).toBe('errors.otpResendCooldown')
    expect(otpErrorKey('otp_issue_limit')).toBe('errors.otpIssueLimit')
    expect(otpErrorKey('unknown', true)).toBe('errors.resendFailed')
  })

  it('parses server cooldown dates defensively', () => {
    expect(parseOtpDate('2026-07-29T10:00:00.000Z')).toBe(Date.parse('2026-07-29T10:00:00.000Z'))
    expect(parseOtpDate('invalid')).toBe(0)
    expect(parseOtpDate(undefined)).toBe(0)
  })
})
