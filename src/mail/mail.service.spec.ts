import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { MailService } from './mail.service.js';

const config = (env: Partial<Env>) =>
  ({
    get: (key: keyof Env) =>
      ({ MAIL_FROM: 'Tidepool <hello@usetidepool.app>', ...env })[key],
  }) as unknown as ConfigService<Env, true>;

const message = {
  to: 'reader@example.com',
  subject: 'Your sign-in link',
  html: '<p>Hi</p>',
  text: 'Hi',
  headers: { 'List-Unsubscribe': '<https://example.com/u>' },
};

describe('MailService with Resend', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends through the Resend HTTPS API', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await new MailService(config({ RESEND_API_KEY: 're_test' })).send(message);

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_test' });
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Tidepool <hello@usetidepool.app>',
      to: ['reader@example.com'],
      subject: 'Your sign-in link',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: { 'List-Unsubscribe': '<https://example.com/u>' },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws with the reason when Resend rejects the email', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"message":"The domain is not verified"}', {
          status: 403,
        }),
      ),
    );

    await expect(
      new MailService(config({ RESEND_API_KEY: 're_test' })).send(message),
    ).rejects.toThrow(
      'Resend rejected the email (HTTP 403): The domain is not verified',
    );
  });
});
