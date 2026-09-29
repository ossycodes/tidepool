export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function layout(body: string, footer = ''): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2328;">
    <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:20px;font-weight:700;margin-bottom:24px;">Tidepool</div>
      <div style="background:#ffffff;border-radius:8px;padding:24px;line-height:1.5;">${body}</div>
      <div style="font-size:12px;color:#656d76;margin-top:24px;line-height:1.5;">${footer}</div>
    </div>
  </body>
</html>`;
}

export function magicLinkEmail(link: string, ttlMinutes: number): RenderedEmail {
  const href = escapeHtml(link);
  return {
    subject: 'Your Tidepool sign-in link',
    html: layout(
      `<p>Click the button below to sign in to Tidepool.</p>
       <p style="margin:24px 0;"><a href="${href}" style="background:#0969da;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Sign in</a></p>
       <p style="font-size:14px;color:#656d76;">This link expires in ${ttlMinutes} minutes and can only be used once.</p>`,
      "If you didn't ask to sign in, you can ignore this email.",
    ),
    text: `Sign in to Tidepool:\n\n${link}\n\nThis link expires in ${ttlMinutes} minutes and can only be used once.\nIf you didn't ask to sign in, you can ignore this email.`,
  };
}
