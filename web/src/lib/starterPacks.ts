export interface StarterPack {
  name: string
  blurb: string
  blogs: { name: string; url: string }[]
}

// Every address here was checked against Tidepool's feed discovery (2026-09-29).
export const STARTER_PACKS: StarterPack[] = [
  {
    name: 'Programming',
    blurb: 'Craft, languages and performance, from people who go deep.',
    blogs: [
      { name: 'Coding Horror', url: 'blog.codinghorror.com' },
      { name: 'Hillel Wayne', url: 'www.hillelwayne.com' },
      { name: 'Eli Bendersky', url: 'eli.thegreenplace.net' },
      { name: 'Daniel Lemire', url: 'lemire.me/blog' },
      { name: 'fasterthanli.me', url: 'fasterthanli.me' },
    ],
  },
  {
    name: 'Frontend',
    blurb: 'CSS, JavaScript and the web platform, explained well.',
    blogs: [
      { name: 'Josh W. Comeau', url: 'www.joshwcomeau.com' },
      { name: 'Jake Archibald', url: 'jakearchibald.com' },
      { name: 'Jeremy Keith', url: 'adactio.com' },
      { name: 'Zach Leatherman', url: 'www.zachleat.com' },
      { name: 'Smashing Magazine', url: 'www.smashingmagazine.com' },
    ],
  },
  {
    name: 'Backend & infrastructure',
    blurb: 'Distributed systems, databases and running things in production.',
    blogs: [
      { name: 'brandur.org', url: 'brandur.org' },
      { name: 'Martin Fowler', url: 'martinfowler.com' },
      { name: 'Cloudflare Blog', url: 'blog.cloudflare.com' },
      { name: 'All Things Distributed', url: 'www.allthingsdistributed.com' },
      { name: 'Charity Majors', url: 'charity.wtf' },
    ],
  },
  {
    name: 'UI/UX & design',
    blurb: 'Research-backed usability and thoughtful product design.',
    blogs: [
      { name: 'Nielsen Norman Group', url: 'www.nngroup.com' },
      { name: 'A List Apart', url: 'alistapart.com' },
      { name: 'LukeW', url: 'www.lukew.com' },
    ],
  },
  {
    name: 'Cybersecurity',
    blurb: 'Breaches, vulnerabilities and cryptography, from the experts.',
    blogs: [
      { name: 'Krebs on Security', url: 'krebsonsecurity.com' },
      { name: 'Schneier on Security', url: 'www.schneier.com' },
      { name: 'Troy Hunt', url: 'www.troyhunt.com' },
      { name: 'Google Project Zero', url: 'googleprojectzero.blogspot.com' },
      { name: 'Matthew Green', url: 'blog.cryptographyengineering.com' },
    ],
  },
  {
    name: 'Engineering essays',
    blurb: 'Deep, practical writing about how software really works.',
    blogs: [
      { name: 'Dan Luu', url: 'danluu.com' },
      { name: 'Julia Evans', url: 'jvns.ca' },
      { name: 'overreacted', url: 'overreacted.io' },
      { name: 'Schneems', url: 'www.schneems.com' },
      { name: 'rachelbythebay', url: 'rachelbythebay.com/w' },
    ],
  },
  {
    name: 'Indie web classics',
    blurb: 'Long-running personal sites worth checking every week.',
    blogs: [
      { name: 'kottke.org', url: 'kottke.org' },
      { name: 'Daring Fireball', url: 'daringfireball.net' },
      { name: 'Waxy', url: 'waxy.org' },
      { name: 'Simon Willison', url: 'simonwillison.net' },
      { name: 'xkcd', url: 'xkcd.com' },
    ],
  },
  {
    name: 'Startups & strategy',
    blurb: 'How companies are built, and why some of them win.',
    blogs: [
      { name: 'Paul Graham', url: 'paulgraham.com/articles.html' },
      { name: 'Stratechery', url: 'stratechery.com' },
      { name: 'Joel on Software', url: 'www.joelonsoftware.com' },
      { name: 'The Pragmatic Engineer', url: 'blog.pragmaticengineer.com' },
      { name: "Lenny's Newsletter", url: 'www.lennysnewsletter.com' },
    ],
  },
  {
    name: 'Creativity & ideas',
    blurb: 'Slow reading about making things and thinking well.',
    blogs: [
      { name: 'Austin Kleon', url: 'austinkleon.com' },
      { name: 'The Marginalian', url: 'www.themarginalian.org' },
      { name: "Seth's Blog", url: 'seths.blog' },
    ],
  },
]
