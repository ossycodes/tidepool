import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

const RESEND_URL = 'https://api.resend.com/emails';
/** Sign-in waits on this, so a slow mail provider must fail rather than hang. */
const SEND_TIMEOUT_MS = 15_000;

/**
 * Sends through Resend's HTTPS API when RESEND_API_KEY is set, otherwise
 * over SMTP. Hosts like Railway block outbound SMTP on smaller plans, so
 * production uses the API; local development keeps SMTP (Mailpit).
 */
@Injectable()
export class MailService {
  private readonly from: string;
  private readonly resendKey?: string;
  private readonly transporter?: Transporter;

  constructor(config: ConfigService<Env, true>) {
    this.from = config.get('MAIL_FROM', { infer: true });
    this.resendKey = config.get('RESEND_API_KEY', { infer: true });
    if (this.resendKey) return;

    const user = config.get('SMTP_USER', { infer: true });
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      auth: user
        ? { user, pass: config.get('SMTP_PASS', { infer: true }) }
        : undefined,
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
  }

  async send(message: MailMessage): Promise<void> {
    if (this.resendKey) return this.sendWithResend(message);
    await this.transporter!.sendMail({ from: this.from, ...message });
  }

  private async sendWithResend(message: MailMessage): Promise<void> {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(
        `Resend rejected the email (HTTP ${res.status})${body.message ? `: ${body.message}` : ''}`,
      );
    }
  }
}
