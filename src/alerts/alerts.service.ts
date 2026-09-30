import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

const TELEGRAM_TIMEOUT_MS = 5_000;
/** Keeps the cooldown map from growing without bound. */
const MAX_REMEMBERED_KEYS = 500;

/** Escapes text for Telegram's HTML parse mode. */
export function tg(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** "jane.doe@gmail.com" → "j***@gmail.com": enough to spot a pattern, not to identify. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Ops alerts to a Telegram chat: new readers, new blogs, and things going
 * wrong. Optional (needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID) and
 * fire-and-forget: an alert can never slow down or break the request that
 * triggered it.
 */
@Injectable()
export class AlertsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AlertsService.name);
  private readonly token?: string;
  private readonly chatId?: string;
  private readonly environment: string;
  private readonly lastSent = new Map<string, number>();

  constructor(config: ConfigService<Env, true>) {
    this.token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this.chatId = config.get('TELEGRAM_CHAT_ID', { infer: true });
    this.environment = config.get('NODE_ENV', { infer: true });
  }

  /**
   * Only production alerts. A developer's .env often holds the real bot
   * token, and a local server fetching leftover test blogs would otherwise
   * flood the chat with failures that aren't real.
   */
  get enabled(): boolean {
    return Boolean(
      this.token && this.chatId && this.environment === 'production',
    );
  }

  onApplicationBootstrap() {
    this.notify(`🚀 Tidepool API started (${tg(this.environment)})`);
  }

  /**
   * Sends `html` (already escaped with `tg`) in the background. With a `key`,
   * repeats within `cooldownMs` are dropped, so a failure storm is one alert.
   */
  notify(
    html: string,
    options: { key?: string; cooldownMs?: number } = {},
  ): void {
    if (!this.enabled) return;
    if (options.key && this.coolingDown(options.key, options.cooldownMs)) {
      return;
    }
    void this.send(html);
  }

  /** Posts to Telegram; resolves false instead of throwing on any failure. */
  async send(html: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: html,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
        },
      );
      if (!res.ok) this.logger.warn(`Telegram answered ${res.status}`);
      return res.ok;
    } catch (err) {
      this.logger.warn(`Telegram alert failed: ${(err as Error).message}`);
      return false;
    }
  }

  private coolingDown(key: string, cooldownMs = 10 * 60_000): boolean {
    const now = Date.now();
    const last = this.lastSent.get(key);
    if (last !== undefined && now - last < cooldownMs) return true;
    if (this.lastSent.size >= MAX_REMEMBERED_KEYS) {
      for (const [k, at] of this.lastSent) {
        if (now - at >= cooldownMs) this.lastSent.delete(k);
      }
    }
    this.lastSent.set(key, now);
    return false;
  }
}
