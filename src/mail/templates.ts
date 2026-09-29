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

// The web app's design tokens (web/src/styles/tokens.css), inlined because
// email clients ignore most <style> rules. Keep the two in sync.
export const COLORS = {
  paper: '#faf8f3',
  sheet: '#ffffff',
  ink: '#1c1b18',
  ink2: '#4a4740',
  ink3: '#7a766c',
  rule: '#e7e2d7',
  ruleStrong: '#d5cdbd',
  tide: '#0f766e',
  onTide: '#ffffff',
};

export const SERIF = `'Newsreader', Georgia, 'Times New Roman', serif`;
export const SANS = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&display=swap';

// Clients that honour <style> (Apple Mail, iOS, Outlook.com) get dark mode.
const DARK_MODE_CSS = `
  @media (prefers-color-scheme: dark) {
    .tp-bg { background: #151412 !important; }
    .tp-sheet { background: #1d1c19 !important; border-color: #2b2925 !important; }
    .tp-ink { color: #eeeae1 !important; }
    .tp-ink2 { color: #bcb6a9 !important; }
    .tp-ink3 { color: #8a8477 !important; }
    .tp-tide { color: #5fb9ae !important; }
    .tp-rule { border-color: #2b2925 !important; }
    .tp-rule-strong { border-color: #3b3833 !important; }
    .tp-button { background: #5fb9ae !important; }
    .tp-button a { color: #0a1d1b !important; }
  }
  @media (max-width: 600px) {
    .tp-sheet { padding: 26px 22px !important; }
  }`;

/** A body paragraph in the house style. */
export function paragraph(html: string, marginTop = 16): string {
  return `<p class="tp-ink2" style="margin:${marginTop}px 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${COLORS.ink2};">${html}</p>`;
}

/** Table-based button so it renders in Outlook too. */
export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
  <tr><td class="tp-button" style="background:${COLORS.tide};border-radius:10px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:${COLORS.onTide};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

/**
 * The Tidepool "sheet": paper background, a white page with the italic
 * masthead and a double rule, and a quiet footer underneath. Used for every
 * email and for the few HTML pages the API serves (unsubscribe).
 */
export function layout(options: {
  body: string;
  /** Right side of the masthead, e.g. "No. 12 · Monday, September 29" */
  label?: string;
  footer?: string;
  /** Inbox preview text */
  preheader?: string;
}): string {
  const { body, label = '', footer = '', preheader = '' } = options;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Tidepool</title>
<link href="${FONTS_URL}" rel="stylesheet">
<style>${DARK_MODE_CSS}</style>
</head>
<body class="tp-bg" style="margin:0;padding:0;background:${COLORS.paper};-webkit-font-smoothing:antialiased;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tp-bg" style="background:${COLORS.paper};">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td class="tp-sheet" style="background:${COLORS.sheet};border:1px solid ${COLORS.rule};border-radius:6px;padding:32px 36px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="tp-ink" style="font-family:${SERIF};font-size:24px;font-style:italic;font-weight:500;line-height:1;color:${COLORS.ink};">Tidepool</td>
            <td align="right" class="tp-ink3" style="font-family:${SANS};font-size:12px;line-height:1.4;color:${COLORS.ink3};">${escapeHtml(label)}</td>
          </tr>
          <tr><td colspan="2" class="tp-rule-strong" style="height:12px;font-size:0;line-height:0;border-bottom:3px double ${COLORS.ruleStrong};">&nbsp;</td></tr>
        </table>
        ${body}
      </td></tr>
      ${footer ? `<tr><td class="tp-ink3" style="padding:22px 12px 0;text-align:center;font-family:${SANS};font-size:12px;line-height:1.7;color:${COLORS.ink3};">${footer}</td></tr>` : ''}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function footerLink(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" class="tp-ink3" style="color:${COLORS.ink3};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/** "example.com" or "example.com/blog", without www. */
function hostLabel(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const path = pathname.replace(/\/+$/, '');
    return `${hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return url;
  }
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
  issueNumber: number;
  issueDate: Date;
  /** A test send from the app, not the scheduled issue */
  preview?: boolean;
  timezone: string;
  settingsUrl: string;
  unsubscribeUrl: string;
  /** The web app's address without scheme, e.g. "usetidepool.app", for the quick-add tip */
  appHost: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function digestEmail(input: DigestEmailInput): RenderedEmail {
  const postCount = input.sections.reduce((n, s) => n + s.posts.length, 0);
  const blogCount = input.sections.length;
  const summaryLine = `${plural(postCount, 'new post')} from ${plural(blogCount, 'blog')} you follow`;

  const shortDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: input.timezone,
    });
  const issueDay = input.issueDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: input.timezone,
  });
  const label = input.preview
    ? `Preview · ${issueDay}`
    : `No. ${input.issueNumber} · ${issueDay}`;
  const meta = (post: DigestEmailInput['sections'][number]['posts'][number]) =>
    [post.author, post.publishedAt && shortDate(post.publishedAt)]
      .filter(Boolean)
      .join(' · ');

  const sectionsHtml = input.sections
    .map((section, i) => {
      const posts = section.posts
        .map(
          (post) => `
          <div style="margin:12px 0 0;">
            <a href="${escapeHtml(post.url)}" class="tp-tide" style="font-family:${SANS};font-size:15px;font-weight:600;line-height:1.4;color:${COLORS.tide};text-decoration:none;">${escapeHtml(post.title)}</a>
            ${meta(post) ? `<div class="tp-ink3" style="margin-top:3px;font-family:${SANS};font-size:12.5px;line-height:1.4;color:${COLORS.ink3};">${escapeHtml(meta(post))}</div>` : ''}
            ${post.summary ? `<div class="tp-ink2" style="margin-top:6px;font-family:${SANS};font-size:14px;line-height:1.55;color:${COLORS.ink2};">${escapeHtml(post.summary)}</div>` : ''}
          </div>`,
        )
        .join('');
      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td class="tp-rule" style="padding:${i === 0 ? 22 : 20}px 0 ${i === input.sections.length - 1 ? 0 : 20}px;${i === 0 ? '' : `border-top:1px solid ${COLORS.rule};`}">
          <a href="${escapeHtml(section.siteUrl)}" class="tp-ink" style="font-family:${SERIF};font-size:19px;font-weight:600;line-height:1.3;color:${COLORS.ink};text-decoration:none;">${escapeHtml(section.blogTitle)}</a>
          <div class="tp-ink3" style="margin-top:1px;font-family:${SANS};font-size:12px;line-height:1.4;color:${COLORS.ink3};">${escapeHtml(hostLabel(section.siteUrl))}</div>
          ${posts}
        </td></tr>
      </table>`;
    })
    .join('');

  const text = input.sections
    .map(
      (section) =>
        `${section.blogTitle}\n${'-'.repeat(Math.min(section.blogTitle.length, 60))}\n\n` +
        section.posts
          .map((post) =>
            [post.title, post.url, meta(post)].filter(Boolean).join('\n'),
          )
          .join('\n\n'),
    )
    .join('\n\n\n');

  // Mirrors the web app's quick add: <app>/www.schneems.com follows that blog.
  const prefix = `${input.appHost}/`;
  const example = `${prefix}www.schneems.com`;
  const quickAddTip = {
    html: `<strong class="tp-ink2" style="color:${COLORS.ink2};font-weight:600;">Quick add:</strong> prefix any URL with <span class="tp-ink2" style="color:${COLORS.ink2};font-weight:600;">${escapeHtml(prefix)}</span> to quickly add it to your reading list; for example, <span class="tp-ink2" style="color:${COLORS.ink2};">${escapeHtml(example)}</span>.`,
    text: `Quick add: prefix any URL with ${prefix} to quickly add it to your reading list; for example, ${example}.`,
  };

  const names = input.sections.map((s) => s.blogTitle);
  const preheader =
    names.length <= 2
      ? `New from ${names.join(' and ')}`
      : `New from ${names.slice(0, 2).join(', ')} and ${plural(names.length - 2, 'more blog')}`;

  return {
    subject: `${input.preview ? 'Preview · ' : ''}Tidepool No. ${input.issueNumber}: ${plural(postCount, 'new post')} from ${plural(blogCount, 'blog')}`,
    html: layout({
      label,
      preheader,
      body: `<p class="tp-ink3" style="margin:18px 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${COLORS.ink3};">${escapeHtml(summaryLine)}</p>${sectionsHtml}`,
      footer: `${quickAddTip.html}<br><br>You're getting this because you follow these blogs on Tidepool.<br>${footerLink('Manage blogs and delivery time', input.settingsUrl)} &nbsp;·&nbsp; ${footerLink('Unsubscribe', input.unsubscribeUrl)}`,
    }),
    text: `TIDEPOOL · ${label}\n${summaryLine}\n\n\n${text}\n\n\n---\n${quickAddTip.text}\n\nManage blogs and delivery time: ${input.settingsUrl}\nUnsubscribe: ${input.unsubscribeUrl}`,
  };
}

export function magicLinkEmail(
  link: string,
  ttlMinutes: number,
): RenderedEmail {
  return {
    subject: 'Your Tidepool sign-in link',
    html: layout({
      label: 'Sign-in link',
      preheader: `Your link works once, for the next ${ttlMinutes} minutes.`,
      body: `
        <h1 class="tp-ink" style="margin:28px 0 0;font-family:${SERIF};font-size:28px;font-weight:500;line-height:1.15;letter-spacing:-0.01em;color:${COLORS.ink};">Sign in to Tidepool</h1>
        ${paragraph('Click the button below to sign in. There’s no password to remember.', 12)}
        ${button('Sign in', link)}
        <p class="tp-ink3" style="margin:28px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${COLORS.ink3};">This link works once, for the next ${ttlMinutes} minutes. If the button doesn’t work, paste this into your browser:</p>
        <p style="margin:6px 0 0;font-family:${SANS};font-size:12.5px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(link)}" class="tp-tide" style="color:${COLORS.tide};text-decoration:none;">${escapeHtml(link)}</a></p>`,
      footer: "If you didn't ask to sign in, you can safely ignore this email.",
    }),
    text: `Sign in to Tidepool\n\nOpen this link to sign in:\n${link}\n\nIt works once, for the next ${ttlMinutes} minutes.\nIf you didn't ask to sign in, you can safely ignore this email.`,
  };
}
