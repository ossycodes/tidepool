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

export interface DigestEmailInput {
  sections: {
    blogTitle: string;
    siteUrl: string;
    posts: {
      title: string;
      url: string;
      summary?: string | null;
      author?: string | null;
      publishedAt?: Date | null;
    }[];
  }[];
  timezone: string;
  settingsUrl: string;
  unsubscribeUrl: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function digestEmail(input: DigestEmailInput): RenderedEmail {
  const postCount = input.sections.reduce((n, s) => n + s.posts.length, 0);
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: input.timezone,
    });
  const meta = (post: DigestEmailInput['sections'][number]['posts'][number]) =>
    [post.author, post.publishedAt && formatDate(post.publishedAt)]
      .filter(Boolean)
      .join(' · ');

  const html = input.sections
    .map(
      (section) => `
      <h2 style="font-size:17px;margin:24px 0 8px;"><a href="${escapeHtml(section.siteUrl)}" style="color:#1f2328;text-decoration:none;">${escapeHtml(section.blogTitle)}</a></h2>
      ${section.posts
        .map(
          (post) => `
        <div style="margin:0 0 16px;">
          <a href="${escapeHtml(post.url)}" style="color:#0969da;font-weight:600;text-decoration:none;">${escapeHtml(post.title)}</a>
          ${meta(post) ? `<div style="font-size:13px;color:#656d76;">${escapeHtml(meta(post))}</div>` : ''}
          ${post.summary ? `<div style="font-size:14px;margin-top:4px;">${escapeHtml(post.summary)}</div>` : ''}
        </div>`,
        )
        .join('')}`,
    )
    .join('');

  const text = input.sections
    .map(
      (section) =>
        `## ${section.blogTitle}\n\n` +
        section.posts
          .map((post) =>
            [
              `- ${post.title}`,
              `  ${post.url}`,
              meta(post) && `  ${meta(post)}`,
            ]
              .filter(Boolean)
              .join('\n'),
          )
          .join('\n\n'),
    )
    .join('\n\n');

  return {
    subject: `Your weekly digest: ${plural(postCount, 'new post')} from ${plural(input.sections.length, 'blog')}`,
    html: layout(
      `<p style="margin-top:0;">Here's what's new from the blogs you follow this week.</p>${html}`,
      `<a href="${escapeHtml(input.settingsUrl)}" style="color:#656d76;">Manage your blogs and delivery time</a> · <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#656d76;">Unsubscribe</a>`,
    ),
    text: `Here's what's new from the blogs you follow this week.\n\n${text}\n\n---\nManage your blogs and delivery time: ${input.settingsUrl}\nUnsubscribe: ${input.unsubscribeUrl}`,
  };
}

export function magicLinkEmail(
  link: string,
  ttlMinutes: number,
): RenderedEmail {
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
