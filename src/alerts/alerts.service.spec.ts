import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AlertsService, maskEmail, tg } from './alerts.service.js';

const config = (env: Partial<Env>) =>
  ({
    get: (key: keyof Env) => ({ NODE_ENV: 'test', ...env })[key],
  }) as unknown as ConfigService<Env, true>;

const telegram = { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '-100' };

describe('AlertsService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does nothing without a bot token and chat', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const alerts = new AlertsService(config({}));
    expect(alerts.enabled).toBe(false);
    alerts.notify('hello');
    expect(await alerts.send('hello')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts to the Telegram Bot API as HTML without link previews', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const alerts = new AlertsService(config(telegram));

    expect(await alerts.send('<b>hi</b>')).toBe(true);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bot123:abc/sendMessage');
    expect(JSON.parse(init.body as string)).toEqual({
      chat_id: '-100',
      text: '<b>hi</b>',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  });

  it('never throws, even when Telegram is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const alerts = new AlertsService(config(telegram));
    await expect(alerts.send('hi')).resolves.toBe(false);
  });

  it('drops repeats of the same alert during its cooldown', () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const alerts = new AlertsService(config(telegram));

    alerts.notify('boom', { key: 'x', cooldownMs: 60_000 });
    alerts.notify('boom', { key: 'x', cooldownMs: 60_000 });
    alerts.notify('other', { key: 'y', cooldownMs: 60_000 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('alert text helpers', () => {
  it('escapes for Telegram HTML', () => {
    expect(tg('Tom & <Jerry>')).toBe('Tom &amp; &lt;Jerry&gt;');
  });

  it('masks emails', () => {
    expect(maskEmail('jane.doe@gmail.com')).toBe('j***@gmail.com');
  });
});
