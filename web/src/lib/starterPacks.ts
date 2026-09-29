export const PACK_CATEGORIES = [
  'Tech',
  'Work & money',
  'Health & wellbeing',
  'Science & ideas',
  'Culture & arts',
  'Home & life',
  'Hobbies & outdoors',
] as const
export type PackCategory = (typeof PACK_CATEGORIES)[number]

export interface StarterPack {
  category: PackCategory
  name: string
  blurb: string
  blogs: { name: string; url: string }[]
}

// Generated from a candidate list; every address passed Tidepool's own feed
// discovery on 2026-09-29, and rechecked after the fetcher fix (#25). Sites
// that still block automated readers were left out.
export const STARTER_PACKS: StarterPack[] = [
  {
    category: 'Tech',
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
    category: 'Tech',
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
    category: 'Tech',
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
    category: 'Tech',
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
    category: 'Tech',
    name: 'UI/UX & design',
    blurb: 'Research-backed usability and thoughtful product design.',
    blogs: [
      { name: 'Nielsen Norman Group', url: 'www.nngroup.com' },
      { name: 'A List Apart', url: 'alistapart.com' },
      { name: 'LukeW', url: 'www.lukew.com' },
      {
        name: 'Smashing Magazine UX',
        url: 'www.smashingmagazine.com/category/ux-design',
      },
    ],
  },
  {
    category: 'Tech',
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
    category: 'Tech',
    name: 'AI & machine learning',
    blurb: 'How modern AI works, from researchers and practitioners.',
    blogs: [
      { name: 'Lilian Weng', url: 'lilianweng.github.io' },
      { name: 'Sebastian Raschka', url: 'magazine.sebastianraschka.com' },
      { name: 'Import AI', url: 'jack-clark.net' },
      { name: 'Chip Huyen', url: 'huyenchip.com' },
      { name: 'Jay Alammar', url: 'jalammar.github.io' },
    ],
  },
  {
    category: 'Tech',
    name: 'Data & visualization',
    blurb: 'Charts, statistics and stories told with data.',
    blogs: [
      { name: 'Storytelling with Data', url: 'www.storytellingwithdata.com' },
      { name: 'The Pudding', url: 'pudding.cool' },
      { name: 'Datawrapper Blog', url: 'www.datawrapper.de/blog' },
      { name: 'FlowingData', url: 'flowingdata.com' },
      { name: 'Statistical Modeling', url: 'statmodeling.stat.columbia.edu' },
    ],
  },
  {
    category: 'Tech',
    name: 'Apple & gadgets',
    blurb: 'Thoughtful coverage of the devices we use every day.',
    blogs: [
      { name: 'Daring Fireball', url: 'daringfireball.net' },
      { name: 'Six Colors', url: 'sixcolors.com' },
      { name: 'MacStories', url: 'www.macstories.net' },
      { name: '512 Pixels', url: '512pixels.net' },
      { name: 'The Verge', url: 'www.theverge.com' },
    ],
  },
  {
    category: 'Tech',
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
    category: 'Work & money',
    name: 'Personal finance',
    blurb: 'Saving, investing and spending with intention.',
    blogs: [
      { name: 'Mr. Money Mustache', url: 'www.mrmoneymustache.com' },
      { name: 'The Financial Diet', url: 'thefinancialdiet.com' },
      { name: 'Of Dollars And Data', url: 'ofdollarsanddata.com' },
      { name: 'A Wealth of Common Sense', url: 'awealthofcommonsense.com' },
      { name: 'Monevator', url: 'monevator.com' },
    ],
  },
  {
    category: 'Work & money',
    name: 'Productivity & careers',
    blurb: 'Doing focused work and building a career you like.',
    blogs: [
      { name: 'Cal Newport', url: 'calnewport.com/blog' },
      { name: 'Zen Habits', url: 'zenhabits.net' },
      { name: 'Farnam Street', url: 'fs.blog' },
      { name: 'Ask a Manager', url: 'www.askamanager.org' },
      { name: 'Scott H. Young', url: 'www.scotthyoung.com/blog' },
    ],
  },
  {
    category: 'Work & money',
    name: 'Product management',
    blurb: 'Building products people want.',
    blogs: [
      { name: 'SVPG', url: 'www.svpg.com/articles' },
      { name: 'Julie Zhuo', url: 'lg.substack.com' },
      { name: 'Mind the Product', url: 'www.mindtheproduct.com' },
      { name: 'Andrew Chen', url: 'andrewchen.com' },
    ],
  },
  {
    category: 'Work & money',
    name: 'Economics',
    blurb: 'How the economy works, in plain language.',
    blogs: [
      { name: 'Marginal Revolution', url: 'marginalrevolution.com' },
      { name: 'Noahpinion', url: 'www.noahpinion.blog' },
      { name: 'Paul Krugman', url: 'paulkrugman.substack.com' },
      { name: 'Freakonomics', url: 'freakonomics.com' },
      { name: 'Calculated Risk', url: 'www.calculatedriskblog.com' },
    ],
  },
  {
    category: 'Health & wellbeing',
    name: 'Fitness & health',
    blurb: 'Evidence-based training, nutrition and longevity.',
    blogs: [
      { name: 'Peter Attia', url: 'peterattiamd.com' },
      { name: 'Nerd Fitness', url: 'www.nerdfitness.com/blog' },
      { name: 'Precision Nutrition', url: 'www.precisionnutrition.com/blog' },
    ],
  },
  {
    category: 'Health & wellbeing',
    name: 'Mind & mental health',
    blurb: 'Calmer minds, better habits, kinder self-talk.',
    blogs: [
      { name: 'Psyche', url: 'psyche.co' },
      { name: 'Tiny Buddha', url: 'tinybuddha.com' },
      { name: 'Mark Manson', url: 'markmanson.net' },
      { name: 'Greater Good', url: 'greatergood.berkeley.edu' },
    ],
  },
  {
    category: 'Health & wellbeing',
    name: 'Food & cooking',
    blurb: 'Recipes and kitchen know-how worth reading.',
    blogs: [
      { name: 'Smitten Kitchen', url: 'smittenkitchen.com' },
      { name: 'Budget Bytes', url: 'www.budgetbytes.com' },
      { name: 'David Lebovitz', url: 'www.davidlebovitz.com' },
      { name: 'Serious Eats', url: 'www.seriouseats.com' },
    ],
  },
  {
    category: 'Health & wellbeing',
    name: 'Running & endurance',
    blurb: 'Training, races and the science of going far.',
    blogs: [
      { name: 'iRunFar', url: 'www.irunfar.com' },
      { name: 'Marathon Handbook', url: 'marathonhandbook.com' },
      { name: 'Believe in the Run', url: 'believeintherun.com' },
      { name: 'Trail Runner', url: 'www.trailrunnermag.com' },
      { name: "Runner's World", url: 'www.runnersworld.com' },
    ],
  },
  {
    category: 'Science & ideas',
    name: 'Science',
    blurb: 'Discoveries explained by people who understand them.',
    blogs: [
      { name: 'Quanta Magazine', url: 'www.quantamagazine.org' },
      { name: 'Nautilus', url: 'nautil.us' },
      { name: 'Science-Based Medicine', url: 'sciencebasedmedicine.org' },
      { name: 'Astral Codex Ten', url: 'www.astralcodexten.com' },
    ],
  },
  {
    category: 'Science & ideas',
    name: 'Space & astronomy',
    blurb: 'Planets, stars and the missions exploring them.',
    blogs: [
      { name: 'Universe Today', url: 'www.universetoday.com' },
      { name: 'The Planetary Society', url: 'www.planetary.org' },
      { name: 'NASA', url: 'www.nasa.gov' },
      { name: 'Centauri Dreams', url: 'www.centauri-dreams.org' },
    ],
  },
  {
    category: 'Science & ideas',
    name: 'Philosophy & big ideas',
    blurb: 'Essays that change how you see things.',
    blogs: [
      { name: 'Aeon', url: 'aeon.co' },
      { name: 'Wait But Why', url: 'waitbutwhy.com' },
      { name: '3 Quarks Daily', url: '3quarksdaily.com' },
      { name: 'The Marginalian', url: 'www.themarginalian.org' },
    ],
  },
  {
    category: 'Science & ideas',
    name: 'Climate & environment',
    blurb: 'Clear reporting on the climate and energy transition.',
    blogs: [
      { name: 'Carbon Brief', url: 'www.carbonbrief.org' },
      { name: 'Grist', url: 'grist.org' },
      { name: 'Yale Environment 360', url: 'e360.yale.edu' },
      { name: 'Volts', url: 'www.volts.wtf' },
      { name: 'Inside Climate News', url: 'insideclimatenews.org' },
    ],
  },
  {
    category: 'Science & ideas',
    name: 'Understanding the world',
    blurb: 'Data and reporting beyond the headlines.',
    blogs: [
      { name: 'Our World in Data', url: 'ourworldindata.org' },
      { name: 'Rest of World', url: 'restofworld.org' },
      { name: 'The Conversation', url: 'theconversation.com' },
      { name: 'kottke.org', url: 'kottke.org' },
    ],
  },
  {
    category: 'Science & ideas',
    name: 'History',
    blurb: 'The past, told with care and good stories.',
    blogs: [
      { name: 'A Collection of Unmitigated Pedantry', url: 'acoup.blog' },
      { name: 'The Public Domain Review', url: 'publicdomainreview.org' },
      { name: 'History Today', url: 'www.historytoday.com' },
      { name: 'JSTOR Daily', url: 'daily.jstor.org' },
      { name: 'HistoryExtra', url: 'www.historyextra.com' },
    ],
  },
  {
    category: 'Culture & arts',
    name: 'Books & reading',
    blurb: 'What to read next, and why it matters.',
    blogs: [
      { name: 'Literary Hub', url: 'lithub.com' },
      { name: 'Book Riot', url: 'bookriot.com' },
      { name: 'The Millions', url: 'themillions.com' },
      { name: 'Five Books', url: 'fivebooks.com' },
    ],
  },
  {
    category: 'Culture & arts',
    name: 'Music',
    blurb: 'New music and the stories behind it.',
    blogs: [
      { name: 'Pitchfork', url: 'pitchfork.com' },
      { name: 'Stereogum', url: 'www.stereogum.com' },
      { name: 'The Quietus', url: 'thequietus.com' },
      { name: 'Aquarium Drunkard', url: 'aquariumdrunkard.com' },
    ],
  },
  {
    category: 'Culture & arts',
    name: 'Art & photography',
    blurb: 'Beautiful work and the people making it.',
    blogs: [
      { name: 'Colossal', url: 'www.thisiscolossal.com' },
      { name: 'Hyperallergic', url: 'hyperallergic.com' },
      { name: 'PetaPixel', url: 'petapixel.com' },
      { name: "It's Nice That", url: 'www.itsnicethat.com' },
    ],
  },
  {
    category: 'Culture & arts',
    name: 'Writing',
    blurb: 'Craft advice for writers of every kind.',
    blogs: [
      { name: 'Jane Friedman', url: 'janefriedman.com' },
      { name: 'Austin Kleon', url: 'austinkleon.com' },
      { name: "Writer's Digest", url: 'www.writersdigest.com' },
      { name: "Seth's Blog", url: 'seths.blog' },
    ],
  },
  {
    category: 'Culture & arts',
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
    category: 'Culture & arts',
    name: 'Film & TV',
    blurb: 'Criticism and craft from people who love the screen.',
    blogs: [
      { name: 'RogerEbert.com', url: 'www.rogerebert.com' },
      { name: 'IndieWire', url: 'www.indiewire.com' },
      { name: 'No Film School', url: 'nofilmschool.com' },
      { name: 'Film Comment', url: 'www.filmcomment.com' },
      { name: 'Letterboxd Journal', url: 'letterboxd.com/journal' },
    ],
  },
  {
    category: 'Home & life',
    name: 'Parenting & family',
    blurb: 'Thoughtful, evidence-minded parenting.',
    blogs: [
      { name: 'ParentData', url: 'parentdata.org' },
      { name: 'Fatherly', url: 'www.fatherly.com' },
      { name: 'A Cup of Jo', url: 'cupofjo.com' },
      { name: 'Janet Lansbury', url: 'www.janetlansbury.com' },
    ],
  },
  {
    category: 'Home & life',
    name: 'Home, DIY & interiors',
    blurb: 'Making a home you love, one project at a time.',
    blogs: [
      { name: 'Apartment Therapy', url: 'www.apartmenttherapy.com' },
      { name: 'Young House Love', url: 'www.younghouselove.com' },
      { name: 'Design Milk', url: 'design-milk.com' },
      { name: 'Dezeen', url: 'www.dezeen.com' },
    ],
  },
  {
    category: 'Home & life',
    name: 'Gardening',
    blurb: 'Growing things, indoors and out.',
    blogs: [
      { name: 'Gardenista', url: 'www.gardenista.com' },
      { name: 'Garden Rant', url: 'gardenrant.com' },
      { name: 'Joe Gardener', url: 'joegardener.com' },
      { name: 'Garden Betty', url: 'www.gardenbetty.com' },
    ],
  },
  {
    category: 'Home & life',
    name: 'Travel',
    blurb: 'Ideas, tips and stories from the road.',
    blogs: [
      { name: 'The Points Guy', url: 'thepointsguy.com' },
      { name: 'Legal Nomads', url: 'www.legalnomads.com' },
      { name: 'Adventurous Kate', url: 'www.adventurouskate.com' },
      { name: 'Atlas Obscura', url: 'www.atlasobscura.com' },
    ],
  },
  {
    category: 'Home & life',
    name: 'Style',
    blurb: 'Clothes, craft and dressing well.',
    blogs: [
      { name: 'Put This On', url: 'putthison.com' },
      { name: 'Die, Workwear!', url: 'dieworkwear.com' },
      { name: 'Into Mind', url: 'intomind.com' },
      { name: 'Permanent Style', url: 'www.permanentstyle.com' },
    ],
  },
  {
    category: 'Hobbies & outdoors',
    name: 'Outdoors & adventure',
    blurb: 'Hiking, climbing and getting outside.',
    blogs: [
      { name: 'Semi-Rad', url: 'semi-rad.com' },
      { name: 'The Trek', url: 'thetrek.co' },
      { name: 'Adventure Journal', url: 'www.adventure-journal.com' },
    ],
  },
  {
    category: 'Hobbies & outdoors',
    name: 'Gaming',
    blurb: "Thoughtful writing about games and how they're made.",
    blogs: [
      { name: 'Rock Paper Shotgun', url: 'www.rockpapershotgun.com' },
      { name: 'Game Developer', url: 'www.gamedeveloper.com' },
      { name: 'Eurogamer', url: 'www.eurogamer.net' },
      { name: 'Polygon', url: 'www.polygon.com' },
    ],
  },
  {
    category: 'Hobbies & outdoors',
    name: 'Creativity & ideas',
    blurb: 'Slow reading about making things and thinking well.',
    blogs: [
      { name: 'Austin Kleon', url: 'austinkleon.com' },
      { name: 'The Marginalian', url: 'www.themarginalian.org' },
      { name: "Seth's Blog", url: 'seths.blog' },
      { name: 'Wait But Why', url: 'waitbutwhy.com' },
    ],
  },
  {
    category: 'Hobbies & outdoors',
    name: 'Cars & motoring',
    blurb: 'Car culture, reviews and the future of driving.',
    blogs: [
      { name: 'Jalopnik', url: 'jalopnik.com' },
      { name: 'The Drive', url: 'www.thedrive.com' },
      { name: 'Electrek', url: 'electrek.co' },
      { name: 'Car and Driver', url: 'www.caranddriver.com' },
    ],
  },
]
