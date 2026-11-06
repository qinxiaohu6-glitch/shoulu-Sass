/**
 * Transactional email — the part of the submission flow that used to be silent.
 *
 * Until now a submitter got nothing at all: no acknowledgement, no "you're
 * live", no reason when rejected. Six messages now, all plain text, because a
 * plain-text mail renders in every client and does not need a template engine
 * on a Worker.
 *
 * Everything here is optional. With no API key configured `sendMail` returns
 * false and the caller carries on — a directory must not lose a submission
 * because a mail credential is wrong.
 *
 * Transport is an HTTP API rather than SMTP on purpose: this app deploys to
 * Cloudflare Workers, where `node:net` does not exist and no SMTP client can
 * open a socket. Resend's REST endpoint is one `fetch`.
 *
 * Config (runtimeConfig, i.e. NUXT_MAIL_API_KEY / NUXT_MAIL_FROM):
 *   mailApiKey  — the provider key
 *   mailFrom    — "Product Atlas <noreply@dirtool.com>"; must be a verified sender
 *   mailReplyTo — optional; where a reply lands
 *   siteUrl     — optional override of the public origin used in the links
 *   mailEndpoint — test seam only; empty means the real provider endpoint
 */

import type { H3Event } from 'h3'
import type { SubmissionRow } from './submissions'

const SITE_FALLBACK = 'https://dirtool.com'
const ENDPOINT = 'https://api.resend.com/emails'

export type MailMessage = { to: string; subject: string; text: string }

/** The public origin the messages link to, without a trailing slash. */
export function siteUrl(event: H3Event): string {
  const cfg = useRuntimeConfig(event)
  return String(cfg.siteUrl || SITE_FALLBACK).replace(/\/+$/, '')
}

function mailConfig(event: H3Event) {
  const cfg = useRuntimeConfig(event)
  const apiKey = String(cfg.mailApiKey || '')
  const from = String(cfg.mailFrom || '')
  if (!apiKey || !from) return null
  return { apiKey, from, replyTo: String(cfg.mailReplyTo || '') }
}

export function mailConfigured(event: H3Event): boolean {
  return mailConfig(event) !== null
}

/**
 * Queue one message and return immediately.
 *
 * The provider round trip is handed to `waitUntil` so the Worker stays alive
 * long enough to finish it while the HTTP response goes out now. A submitter
 * should not wait on a third-party API to see their own receipt.
 *
 * Returns false when nothing was sent — unconfigured, or no usable address.
 */
export function sendMail(event: H3Event, message: MailMessage): boolean {
  const to = String(message.to || '').trim()
  if (!to || !to.includes('@')) return false

  const cfg = mailConfig(event)
  if (!cfg) return false

  const endpoint = String(useRuntimeConfig(event).mailEndpoint || ENDPOINT)

  const pending = $fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      'content-type': 'application/json',
    },
    body: {
      from: cfg.from,
      to: [to],
      subject: message.subject,
      text: message.text,
      ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
    },
    retry: 0,
  })
    .then(() => true)
    .catch((err: unknown) => {
      // Log and swallow. A bounced receipt is a support ticket; a thrown error
      // here would be a failed submission.
      const detail = (err as { data?: unknown })?.data ?? err
      console.error('[mail] delivery failed', to, detail)
      return false
    })

  const waitUntil = (event as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil
  if (typeof waitUntil === 'function') waitUntil.call(event, pending)
  return true
}

/* -------------------------------------------------------------------------
   messages — plain text, because a plain-text mail always renders
------------------------------------------------------------------------- */

export function submittedMail(row: SubmissionRow, site: string): MailMessage {
  const name = row.name || 'your listing'
  const status = row.awaiting_payment
    ? 'We have your payment request'
    : 'It is in the review queue'
  return {
    to: row.email,
    subject: `We received ${name}`,
    text:
      `Thanks — we received ${name}.\n\n` +
      `${status}. Free listings are usually reviewed in 7–14 days; that is not ` +
      `guaranteed, and busy periods can take longer. Paid placements go live the ` +
      `same day the site owner confirms the payment.\n\n` +
      `You can follow it here: ${site}/settings/submissions\n\n` +
      `— Product Atlas\n`,
  }
}

export function approvedMail(row: SubmissionRow, site: string): MailMessage {
  const name = row.name || 'Your listing'
  return {
    to: row.email,
    subject: `${name} is live`,
    text:
      `${name} is live.\n\n` +
      `Page: ${site}/tools/${row.slug}\n\n` +
      `The link to your site is included on that page. If anything looks wrong, ` +
      `reply to this mail and we will fix it.\n\n` +
      `— Product Atlas\n`,
  }
}

export function rejectedMail(row: SubmissionRow, note: string, site: string): MailMessage {
  const name = row.name || 'Your submission'
  const reason = note ? `\nReason: ${note}\n` : ''
  return {
    to: row.email,
    subject: `${name} was not published`,
    text:
      `${name} was not published.\n${reason}\n` +
      `You can edit it and submit again: ${site}/settings/submissions\n\n` +
      `— Product Atlas\n`,
  }
}

export function paymentConfirmedMail(row: SubmissionRow, site: string): MailMessage {
  const name = row.name || 'Your listing'
  return {
    to: row.email,
    subject: `Payment received — ${name} is live`,
    text:
      `Payment received — ${name} is live.\n\n` +
      `Page: ${site}/tools/${row.slug}\n\n` +
      `Your placement runs for the period shown at checkout. When it ends the ` +
      `page stays up; only the pinned position goes away.\n\n` +
      `— Product Atlas\n`,
  }
}

/* -------------------------------------------------------------------------
   tickets — two messages, both about closing a loop
------------------------------------------------------------------------- */

/**
 * Where the owner reads mail.
 *
 * `mailReplyTo` is the address a recipient's reply lands at, which for a
 * one-person directory *is* the owner's inbox. Unset means no notification —
 * the ticket still lands in the console. Falling back to `mailFrom` would send
 * the owner's alerts to their own no-reply sender, which looks like it worked
 * and silently goes nowhere.
 */
export function ownerInbox(event: H3Event): string {
  return String(useRuntimeConfig(event).mailReplyTo || '').trim()
}

/**
 * "Someone wrote in" — to the owner, so the console is not the only way to
 * find out. Skipped entirely when there is no owner inbox.
 */
export function ticketOpenedMail(
  to: string,
  ticket: { id: string; title: string; user_email: string; user_name: string },
  site: string,
): MailMessage {
  const who = ticket.user_name ? `${ticket.user_name} <${ticket.user_email}>` : ticket.user_email
  return {
    to,
    subject: `New ticket: ${ticket.title}`,
    text:
      `${who} opened a ticket.\n\n` +
      `${ticket.title}\n\n` +
      `Answer it here: ${site}/admin/tickets?id=${ticket.id}\n\n` +
      `— Product Atlas\n`,
  }
}

/**
 * "We answered" — to the person who wrote in.
 *
 * Deliberately does not include the reply body. The thread is the record, and
 * a mail that quotes it invites an answer by mail, which would leave the
 * console holding half a conversation.
 */
export function ticketRepliedMail(
  ticket: { id: string; title: string; user_email: string },
  site: string,
): MailMessage {
  return {
    to: ticket.user_email,
    subject: `Re: ${ticket.title}`,
    text:
      `We answered your ticket.\n\n` +
      `Read the reply and continue here: ${site}/settings/tickets?id=${ticket.id}\n\n` +
      `If the link opens your ticket list, the reply is the newest message in ` +
      `the thread.\n\n` +
      `— Product Atlas\n`,
  }
}
