import {
  NotFoundException,
  type ArgumentsHost,
  type HttpServer,
} from '@nestjs/common';
import { AlertingExceptionFilter } from './alerting-exception.filter.js';
import type { AlertsService } from './alerts.service.js';

function setup() {
  const alerts = { notify: vi.fn() };
  const server = {
    reply: vi.fn(),
    isHeadersSent: vi.fn(() => false),
    end: vi.fn(),
  };
  const filter = new AlertingExceptionFilter(
    server as unknown as HttpServer,
    alerts as unknown as AlertsService,
  );
  const req = {
    method: 'PATCH',
    path: '/blogs/cm123',
    route: { path: '/blogs/:id' },
  };
  const res = {};
  const host = {
    getType: () => 'http',
    getArgByIndex: (i: number) => [req, res][i],
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { filter, alerts, server, host };
}

describe('AlertingExceptionFilter', () => {
  it('alerts on server errors with the route pattern, then responds as usual', () => {
    const { filter, alerts, server, host } = setup();
    filter.catch(new Error('database is on fire'), host);

    expect(alerts.notify).toHaveBeenCalledTimes(1);
    const [html] = alerts.notify.mock.calls[0] as [string];
    expect(html).toContain('500 on <code>PATCH /blogs/:id</code>');
    expect(html).toContain('database is on fire');
    expect(html).not.toContain('cm123');
    expect(server.reply).toHaveBeenCalled();
  });

  it('stays quiet on client errors', () => {
    const { filter, alerts, server, host } = setup();
    filter.catch(new NotFoundException('Blog not found'), host);

    expect(alerts.notify).not.toHaveBeenCalled();
    expect(server.reply).toHaveBeenCalled();
  });
});
