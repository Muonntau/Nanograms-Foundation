export const URLS = {
  home: "https://nanograms-foundation.muontau.chatgpt.site/",
  foundation: "https://nanograms-foundation.muontau.chatgpt.site/foundation",
  studio: "https://nanograms-foundation.muontau.chatgpt.site/studio",
  research: "https://nanograms-foundation.muontau.chatgpt.site/research",
  nook: "https://nanograms-foundation.muontau.chatgpt.site/nook",
  archive: "https://nanograms-foundation.muontau.chatgpt.site/archive",
  studioHome: "https://nanogram-foundation-studio.muontau.chatgpt.site/",
  observatory: "https://evil-and-good-observatory.muontau.chatgpt.site/",
  creed: "https://paragon-order.muontau.chatgpt.site/creed",
  paragon: "https://paragon-order.muontau.chatgpt.site/",
  mercy: "https://mercy-engine.muontau.chatgpt.site/",
  palimpsest: "https://mercy-engine.muontau.chatgpt.site/games/Palimpsest.html",
  beginning: "https://mercy-engine.muontau.chatgpt.site/games/Miasmore_Beginning.html",
  middle: "https://mercy-engine.muontau.chatgpt.site/games/Miasmore_Middle.html",
  ending: "https://mercy-engine.muontau.chatgpt.site/games/Miasmore_Ending.html",
  shift: "https://shift-2.muontau.chatgpt.site/",
  squad: "https://squad.muontau.chatgpt.site/",
  mirtheaWorld: "https://mirtheas-world.muontau.chatgpt.site/",
  compendium: "https://eternal-powers-compendium.flaredcart2.chatgpt.site/",
  proving: "https://eternal-powers-proving-grounds.flaredcart2.chatgpt.site/",
  particles: "https://eternal-powers-observatory.flaredcart2.chatgpt.site/",
  market: "https://mirthea-moonlit-market.flaredcart2.chatgpt.site/",
  creator: "https://eternal-powers-character-creator.muontau.chatgpt.site/",
} as const;

export interface LinkItem {
  label: string;
  href: string;
}

export interface Article {
  kicker: string;
  title: string;
  status: string;
  lede: string;
  body: string[];
  quote?: string;
  principles?: string[];
  note?: string;
  links: LinkItem[];
}

const creedPrinciples = [
  "We hold ourselves to the highest standard",
  "We never harm anyone physically or mentally",
  "We act as if existence is watching our every move",
  "We never take unnecessary risks",
  "We only take what we need",
  "We only interact with those who show us respect",
  "We love everyone unconditionally and equally",
  "We preserve our own well being above all else",
  "We show the utmost respect to everything and everyone",
  "We focus on the present",
  "We only assume what we can prove is true",
  "We do everything for the benefit of everyone",
  "We never lie",
  "We only say what is absolutely necessary",
  "We seek to understand others and existence",
  "We only take action when absolutely necessary",
  "We strive for improvement",
  "We trust existence",
  "We share everything we have",
  "We only wish happiness for everyone",
  "We learn from our mistakes",
  "We show gratitude",
  "We admire our surroundings",
  "We ask for help when we need it",
  "We take our time",
  "We seek pleasure",
  "We have fun",
];

export const ARTICLES: Record<string, Article> = {
  gateway: {
    kicker: "Grand Terrace · Arrival",
    title: "The Amber Gateway",
    status: "Campus monument",
    lede: "Imagine beyond. Build with purpose.",
    body: [
      "Every visit begins under chrome and amber. The gateway is the Foundation’s front door: dark stone for what should last, burnished metal for what should catch the light, and a band of sunset glass set high enough that you can walk through without bowing.",
      "Nanograms Foundation is a creative institution with a plain assignment. Extraordinary experiences deserve thoughtful foundations. Game design, interactive software, visual storytelling, and exploratory research share one terrace, and each project keeps an honest status: what is playable, what is proposed, and what is still a question.",
      "You may break this gate. That is allowed. Restoration is part of the welcome. Agency includes the freedom to make a mess and the means to put the room back.",
    ],
    quote: "One foundation. Three distinct expressions.",
    links: [
      { label: "Nanograms Foundation", href: URLS.home },
      { label: "The Foundation", href: URLS.foundation },
      { label: "Project archive", href: URLS.archive },
    ],
  },
  agency: {
    kicker: "Ethos · 01",
    title: "Agency",
    status: "Foundation principle",
    lede: "Clear choices, understandable consequences, and the ability to pause or leave.",
    body: [
      "The figure is mid-step on purpose. Agency, in the Foundation’s vocabulary, is not a costume of power. It is a person who can see the next action, try it, cancel it, or walk away, and still understand what changed.",
      "Eternal Powers is the flagship expression of that idea: creation, consequence, and extraordinary ability, held in a world of Earth, Heaven, and Hell. The long vision includes a surrounding Nanograms field. The field remains an unproven research concept. The current playable work is a set of browser prototypes, and this campus is one of them.",
      "If the arm breaks off, press R. A principle that cannot survive a prototype is only a slogan.",
    ],
    links: [
      { label: "Mission & approach", href: URLS.foundation },
      { label: "Eternal Powers, in the Studio", href: URLS.studio },
      { label: "Character creator alpha", href: URLS.creator },
    ],
  },
  evidence: {
    kicker: "Ethos · 02",
    title: "Evidence",
    status: "Foundation principle",
    lede: "Distinguish a compelling demonstration from a demonstrated capability.",
    body: [
      "The lens is larger than the book. That is the warning and the invitation. A beautiful model can show an idea clearly and still prove nothing about the world outside the model. The Foundation asks every project to say which of the four it is: established knowledge, a testable hypothesis, an untested proposal, or creative fiction.",
      "The ledger under the glass is short on purpose. Purpose, scope, and what would count as a result belong on the same page as the picture. Architectural images on the Foundation site describe a design vision. They are not photographs of operating facilities. This terrace is the same kind of honesty, built at walking scale.",
    ],
    quote: "Ideas become more useful when their status is clear.",
    links: [
      { label: "E&G Research", href: URLS.research },
      { label: "The Observatory", href: URLS.observatory },
      { label: "Founding overview", href: URLS.foundation },
    ],
  },
  compass: {
    kicker: "Ethos · Three doors",
    title: "Three Expressions",
    status: "Wayfinding",
    lede: "Different disciplines. A shared sense of possibility.",
    body: [
      "Three arches, one center. Nanogram Studio makes playable worlds and the tools around them. E&G keeps the research, the models, and the duty to say what a model is not. Mirthea’s Nook keeps the art, the collectibles, and a little mischief so the campus does not forget to be a place where someone might laugh.",
      "Stand in the middle and the whole estate is a sentence. East is the Studio. West is the Observatory. North is the Nook. South is Mercy Engine and the Paragon pavilion. The quick-travel bar above you is the same map, for days when walking is not the point.",
    ],
    links: [
      { label: "Studio", href: URLS.studio },
      { label: "Research", href: URLS.research },
      { label: "Mirthea’s Nook", href: URLS.nook },
    ],
  },
  wilds: {
    kicker: "Nanogram Studio · Centerpiece",
    title: "Wilds Reborn",
    status: "Vision · planned 29 Nov 2030",
    lede: "Create. Restore. Transform. Choose what your power becomes.",
    body: [
      "Wilds Reborn is the Studio wing’s centerpiece: a living world gathered into one sculpture. Earth, Heaven, and Hell are not posters. They are the ground Eternal Powers intends to let people walk, plant, break, trade, and restore. Sixteen branches grow from that ground — Love and Hate, Light and Dark, Fire and Water, Air and Earth — ten named levels each, one hundred and sixty powers in the compendium.",
      "The chrome bands are the made thing. The green crystals are the wild thing coming back through it. Creation and consequence are meant to share a root system: building, healing, movement, and transformation sit beside conflict, and local actions are not the same as world interventions.",
      "What you can touch today is this sculpture and the browser studies linked below. The embodied field remains research, not a device. Eternal Powers is planned for 29 November 2030, to be developed with Mercy Engine. The date is a horizon, and horizons move when the work learns something.",
    ],
    quote: "The vision is expansive. The work begins with playable experiments.",
    links: [
      { label: "Eternal Powers", href: URLS.studio },
      { label: "The Grand Compendium", href: URLS.compendium },
      { label: "The Proving Grounds", href: URLS.proving },
    ],
  },
  affinity: {
    kicker: "Nanogram Studio · Sixteen branches",
    title: "Elemental Affinities",
    status: "Design reference",
    lede: "Eight pillars. The paired weather of a long game.",
    body: [
      "Love, Hate, Light, Dark, Fire, Water, Air, and Earth. Each pillar is a branch you can walk around, and each branch in the manual opens into a pair, ten named levels deep. The circle is the point. No element gets the center. The center belongs to Wilds Reborn, the world they are supposed to change.",
      "Power, in this design, is only the beginning. Karma and trade give choices a cost. Creatures can be met, helped, or left alone. Shared worlds need permissions. None of that is a statue yet. The pillars are a memory aid for a rulebook that would rather be played than framed.",
    ],
    links: [
      { label: "Sixteen branches", href: URLS.studio },
      { label: "Particle studies", href: URLS.particles },
      { label: "Power sandbox", href: URLS.proving },
    ],
  },
  genesis: {
    kicker: "The Genesis Atelier · v1",
    title: "The Genesis Atelier",
    status: "Alpha · on your device",
    lede: "Begin the story by deciding who is holding it.",
    body: [
      "Two figures share a floor: one gathered in gold, one in graphite. The atelier is the character-creation alpha of Eternal Powers. You shape a three-dimensional angel or demon, look through the hundred and sixty powers, and plan a progression. Saves stay on your device. The journey they are packing for is still ahead of them.",
      "The ring of small suns is not a promise that every power is finished. It is a place to stand while you choose. Preview, cancel, commit, recover. The Foundation would like those four verbs to work even when the verbs are about a person you invented.",
    ],
    links: [
      { label: "Open the character creator", href: URLS.creator },
      { label: "Studio — Genesis Atelier", href: URLS.studio },
    ],
  },
  pod: {
    kicker: "Studio concepts · Flagship",
    title: "The Pod",
    status: "Prototype concept",
    lede: "Your seat in another world.",
    body: [
      "The Pod is the flagship of five entertainment concepts: a personal capsule imagined for racing, flight, spaceflight, and cinema. The enclosure is the product. Immersion, here, is a room you sit inside, not a claim about a neural field.",
      "It is a concept sculpture. Availability and final specifications are not announced. If you take it apart, you are critiquing a prototype, which is one of the more respectful things a visitor can do.",
    ],
    links: [
      { label: "Five concepts, on the Studio site", href: URLS.studioHome },
      { label: "Foundation Studio page", href: URLS.studio },
    ],
  },
  frame: {
    kicker: "Studio concepts · 02",
    title: "The Living Frame",
    status: "Prototype concept",
    lede: "Art that feels alive, and a world that continues past the gilt.",
    body: [
      "A wall-sized frame for scenes that seem to extend beyond the rectangle: cinematic environments, responsive artwork, a room pretending to be a window and a window pretending to be a room. The blocks inside this one are a miniature landscape, small enough to lose and heavy enough to clatter.",
      "The Living Frame is a product concept, with an enquiry range published on the Studio site and no promise of a shipping date. The frame in front of you is the part we could build this afternoon: gold edge, dark ground, and a view you are allowed to knock over.",
    ],
    links: [
      { label: "The Living Frame", href: URLS.studioHome },
      { label: "Visual archive", href: URLS.archive },
    ],
  },
  deck: {
    kicker: "Studio concepts · 03",
    title: "The Infinite Deck",
    status: "Prototype concept",
    lede: "A new world. Every game.",
    body: [
      "The Infinite Deck is a board-game platform: interchangeable terrain, illuminated pieces, battlefields that can change their mind. Tactile play on one side, digital storytelling on the other, and a spiral of cards so the last one is always one step higher than you thought.",
      "Nothing in the spiral is for sale from this campus. The Studio describes a concept and a range. This sculpture is the feeling of that range: wood, a gold edge, and a light in the middle that does not own the game.",
    ],
    links: [
      { label: "The Infinite Deck", href: URLS.studioHome },
      { label: "Moonlit Market", href: URLS.market },
    ],
  },
  differentiality: {
    kicker: "Observatory · A sculptural hypothesis",
    title: "Differentiality",
    status: "Model, not a result",
    lede: "z = 1/E. Offered as a question you can walk around.",
    body: [
      "The needle is a z-axis. The cubes travel at different heights, a kinetic sketch of an inverse: as one quantity grows, another is asked to become gentler. The Studio writes it z = 1/E and sets it in metal so it can be argued with in public.",
      "This is a creative and pedagogical model. It is not a demonstrated physical law, and a moving sculpture is not confirmation. The Observatory’s own rule sits on the next plinth and in the research pages: say what would count as being wrong, keep the units, and do not promote a visualisation into evidence.",
      "The fifth power on your bar borrows the name. For a moment, gravity in a small field is persuaded to loosen, and then it is asked to come back. That is a game feeling. It is not an experiment.",
    ],
    quote: "A game visualization does not establish field hardware.",
    links: [
      { label: "E&G Research", href: URLS.research },
      { label: "The Observatory", href: URLS.observatory },
    ],
  },
  twinlens: {
    kicker: "Observatory · Dimension & Dimensionette",
    title: "Phased Universes",
    status: "Instrument",
    lede: "Two universes occupy the same place.",
    body: [
      "Turn the lens and watch one come into focus inside the other. The twin rings are Dimension and Dimensionette: a pair of worlds sharing coordinates, chrome and amber, almost touching, neither one permitted to erase the other.",
      "On the Observatory site the Phase Orrery lets you resolve two universes at one coordinate and change three equally weighted wishes. First Light at D12 flies from the northern manors toward the estate below Portal. This monument is the still version, so you can see the idea before you operate it.",
    ],
    quote: "Two universes occupy the same place. Turn the lens and watch one come into focus inside the other.",
    links: [
      { label: "Open the Observatory", href: URLS.observatory },
      { label: "Research notes", href: URLS.research },
    ],
  },
  lattice: {
    kicker: "Observatory · Geometry",
    title: "The No-Harm Lattice",
    status: "Simplified spatial study",
    lede: "Particles, separation, and a rule that is also an ethic.",
    body: [
      "The lattice is a small instrument for a large sentence. Points prefer a distance. Push them together and the structure spends its energy getting the distance back. The Observatory’s live study lets you adjust motion and separation directly. Here the points are stone and glass, so the constraint is something you can see fail.",
      "Do no harm, in the creed beside this wing, is not a texture. It is a limit on action: physical and mental, toward other people and toward oneself. A physics toy does not discharge that duty. It does remind the building what kind of building it wants to be.",
    ],
    links: [
      { label: "Test the separation rule", href: URLS.observatory },
      { label: "Paragon’s Creed", href: URLS.creed },
    ],
  },
  threefold: {
    kicker: "Observatory · Cosmology",
    title: "The Threefold Cosmos",
    status: "Visual model",
    lede: "Reality, Dream, and Creation, and the Earth they share.",
    body: [
      "Cube, pyramid, sphere. In the Observatory’s first drawing, Reality is the cube, Dream is the pyramid, Creation is the sphere, and Earth sits at the shared center. You can orbit the digital model on the Observatory site. You can also walk around this one until one of the three forms decides to become rubble, which is a kind of cosmology too.",
      "The family’s symbolic dates and the conversations that named these places have their own entries in the codex. What stands here is the diagram, solid enough to cast a shadow at sunset.",
    ],
    links: [
      { label: "Orbit the three forms", href: URLS.observatory },
      { label: "Inside Evil & Good", href: URLS.observatory },
    ],
  },
  tea: {
    kicker: "Mirthea’s Nook",
    title: "Tea & Paradox",
    status: "A valid development milestone",
    lede: "You look like someone who could use a cup of tea and fewer cosmic responsibilities.",
    body: [
      "The cup is oversized because the day was. Mirthea, self-appointed Chief Mirth Officer, keeps the corner of the Foundation where the tea is warm, the plush ambitions are serious, and the halo has filed for overtime. Please do not feed the portals. Tea, however, is a milestone.",
      "The cube on the saucer is a paradox only in the way a sugar cube is a paradox: it is small, it is extra, and it will not survive contact with a determined visitor. The halo stays because somebody has to look like they are in charge.",
    ],
    quote: "The universe is very large. We should probably bring snacks.",
    links: [
      { label: "Mirthea’s Nook", href: URLS.nook },
      { label: "Mirthea’s World", href: URLS.mirtheaWorld },
      { label: "Moonlit Market", href: URLS.market },
    ],
  },
  starchart: {
    kicker: "Mirthea’s Nook · Night table",
    title: "The Star Chart",
    status: "Keepsake",
    lede: "The stars are sometimes on their lunch break. The chart stays.",
    body: [
      "A table for a small break in a large universe. The rings are not a claim about orbits. They are a way to keep a cup, a note, and a few misplaced stars from rolling off the edge of the day.",
      "On the Nook site you can catch a glowing star for twenty seconds, or flip through the family album Mirthea saved — including the day a pigeon was given the best seat at the station piano. Pocket Pairs lives in that arcade. This table is the quiet version: wood, brass, and lights at different heights so nobody has to pretend they are the same distance away.",
    ],
    links: [
      { label: "Spend a moment in the Nook", href: URLS.nook },
      { label: "Mirthea’s World", href: URLS.mirtheaWorld },
    ],
  },
  lantern: {
    kicker: "Mirthea and the Eightfold Lantern",
    title: "The Eightfold Lantern",
    status: "Storybook",
    lede: "One halo. Zero supervision. Eight panes of warm light.",
    body: [
      "Mirthea and the Eightfold Lantern is a 69-page illustrated fairy tale: powers, creatures, and possibility, told sideways so the manual does not have to do all the welcoming. The mechanical reference and the storybook have different jobs. One makes rules clear. The other invites you in.",
      "The lantern has eight faces because the story does. It also has wings, because she would not have signed off on a lamp that could not get into trouble. Eternal Powers is planned for 29 November 2030. Mirthea has begun packing. She reports seventeen teacups so far.",
    ],
    links: [
      { label: "The illustrated introduction", href: URLS.studio },
      { label: "Nook", href: URLS.nook },
      { label: "Archive", href: URLS.archive },
    ],
  },
  creed: {
    kicker: "Paragon pavilion",
    title: "Paragon’s Creed",
    status: "Twenty-seven principles",
    lede: "An Acolyte carries a single spark. A Paragon bears the crowned infinity.",
    body: [
      "The creed moves from the highest standard to the ordinary work of telling the truth, sharing, and leaving room for pleasure. The monolith holds the infinity. The small light at its foot is the spark. Both stay, because a rank that forgets the spark is only a hat.",
      "Selected themes sit in the Observatory’s gallery as well: do no harm, tell the truth, stay in the present, have fun. The full twenty-seven are cut into this reader so you do not have to memorize a building.",
    ],
    quote: "We seek to understand others and existence.",
    principles: creedPrinciples,
    links: [
      { label: "Read the Creed", href: URLS.creed },
      { label: "Paragon Order", href: URLS.paragon },
      { label: "Observatory, on respect", href: URLS.observatory },
    ],
  },
  palimpsest: {
    kicker: "Mercy Engine · Released",
    title: "Palimpsest",
    status: "Living Chronicle v2 · free in the browser",
    lede: "The city that remembers tomorrow.",
    body: [
      "Palimpsest joins the Miasmore Trilogy as a released Mercy Engine game. You become the Continuity Architect of a city that keeps what you tried to erase. Six districts, eight citizens, five acts, expeditions, impossible inventions, and futures you can rewrite. Fork an earlier day to walk another branch, or stay and shape the city in sandbox play.",
      "Drag to orbit, scroll to zoom, press 1–6 for a district, N to advance a day, Space to run or pause time. Saves live in the browser. Export Save makes a copy you can carry. The pages of this sculpture are only the invitation. The city itself opens in another tab.",
    ],
    links: [
      { label: "Play Palimpsest", href: URLS.palimpsest },
      { label: "Mercy Engine", href: URLS.mercy },
    ],
  },
  miasmore: {
    kicker: "Mercy Engine · The trilogy",
    title: "Three Doors",
    status: "Released · play in order",
    lede: "Beginning, Middle, and Ending. Hell can wait.",
    body: [
      "Three doors, one impossible world. Beginning is an atmospheric descent: Hell has been expanding downward, the architects have stopped answering, and you recover inscriptions on the way to the bottom. Middle is horror combat: John steps through with a scythe he does not remember earning. Ending is a psychological narrative: nine impossible places, eight doors, one voice, no weapons.",
      "The doors here are stone, not the games. The games are free in the browser, with touch controls and standalone downloads. Take them in order. Take your time.",
    ],
    note: "The trilogy includes psychological horror, grief, unsettling imagery, and, especially in Middle and Ending, sudden faces and audio shocks. Start at a comfortable volume. Pause and comfort options are inside each game. This pavilion does not play those shocks.",
    links: [
      { label: "Play Beginning", href: URLS.beginning },
      { label: "Play Middle", href: URLS.middle },
      { label: "Play Ending", href: URLS.ending },
      { label: "Comfort & controls", href: URLS.mercy },
    ],
  },
  shift: {
    kicker: "Nanogram Foundation Studio",
    title: "Shift 2",
    status: "A darker room, clearly marked",
    lede: "Something changed while you were looking.",
    body: [
      "Shift 2 is the Studio’s cosmic-horror threshold: strange intelligence, environments that seem to notice you, art and interactive characters built as an experience rather than a secret. The ring on this path is a doorframe between the released worlds of Mercy Engine and that darker room. One half is the stone you already know. The other half is a different weather.",
      "Mercy Engine remains the studio’s game-engine focus, from Miasmore’s depths to Palimpsest’s branching futures, with Eternal Powers on the horizon. Shift 2 is not that horizon. It is a side chapel with the lights down, and it says so before you enter.",
    ],
    note: "Shift 2 is a horror experience: jump scares, visual distortions, and intense imagery. Open it when you mean to. Nothing in this terrace will startle you on its behalf.",
    links: [
      { label: "Enter Shift 2", href: URLS.shift },
      { label: "The Studio", href: URLS.studioHome },
      { label: "Mercy Engine", href: URLS.mercy },
    ],
  },
  squad: {
    kicker: "Hell Squad · Evil & Good",
    title: "The Assembly",
    status: "Twenty-four seats",
    lede: "Turn the Assembly. Each light is a person and a proposed day’s work.",
    body: [
      "Hell Squad is twenty-four members and twenty-four assignments for Earth. The lights circle a single table. Six taller posts mark the mission fields: civic life, lifelines, safeguards, living systems, making and repair, and everyday access — school, work, a workshop, or simply outside.",
      "Featured on the Squad site as you arrive: Vania, for civic priorities; Frendisia, for missing services; Cyan, for ocean recovery; Mirthea, for public accountability. The other twenty are a turn of the Assembly away. This sculpture does not invent private lives for them. It keeps their seats lit.",
      "The practical-care exhibits are the posts, not the fireworks. Power, water, food, spare parts, a route that still works when the ordinary one fails. If you scatter the lights, restore them. A seat should be easy to find again.",
    ],
    links: [
      { label: "Meet Hell Squad", href: URLS.squad },
      { label: "The Observatory", href: URLS.observatory },
    ],
  },
  bust: {
    kicker: "Colonnade · On loan from the commons",
    title: "Marble Study",
    status: "CC0 scan · not a portrait",
    lede: "A campus should have a face that is only a face.",
    body: [
      "This bust is a real scanned sculpture, Marble Bust 01 by Rico Cilliers, released CC0 on Poly Haven and bundled locally. It is not a portrait of Vania Sazonov or of anyone in the Squad. It is here because the colonnade wanted a neighbor, and the public domain had a good one.",
      "The powers are aimed at the campus monuments, which were built to come apart. The study is a guest. You may admire it, read this plaque, and let it keep its nose.",
    ],
    links: [
      { label: "Marble Bust 01 on Poly Haven", href: "https://polyhaven.com/a/marble_bust_01" },
      { label: "Foundation archive", href: URLS.archive },
    ],
  },
  guardian: {
    kicker: "Mirthea’s Nook · Desk guardian",
    title: "Honorary Desk Guardian",
    status: "CC0 scan · appointed without a vote",
    lede: "No guardian appointed? Consider the matter closed.",
    body: [
      "The Nook site lets you appoint an honorary desk guardian so your biscuits survive the afternoon. The campus went ahead and hired a concrete cat. The scan is Concrete Cat Statue by Riley Queen, with guidance from Rico Cilliers, CC0 on Poly Haven.",
      "Mirthea approves, which is to say nobody remembers the vote and everybody remembers the snacks. The cat does not sell plushies. The plush council remains a design showcase, not a shop.",
    ],
    quote: "Your biscuits remain unprotected. Not anymore.",
    links: [
      { label: "Concrete Cat Statue on Poly Haven", href: "https://polyhaven.com/a/concrete_cat_statue" },
      { label: "Appoint one yourself", href: URLS.nook },
    ],
  },
};

export function articleFor(id: string): Article | undefined {
  return ARTICLES[id];
}
