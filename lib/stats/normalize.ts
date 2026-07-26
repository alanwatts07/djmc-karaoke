// Canonical name/song resolution for karaoke stats.
//
// This is HAND-BUILT, not regex. Every mapping was reviewed by eye against the
// real sign-up data. The goal: know who has sung what, and how many times,
// across nights — even though people type their name and song differently each
// visit ("Matt" / "Matthew", "Don't stop believing" / "...- journey.").
//
// How it works:
//   - SINGER_ALIASES maps a raw stage_name (exactly as stored) to one or more
//     canonical singers. Duets/groups credit EACH member (per product decision),
//     so "Lils + Jenna" -> ["Lils", "Jenna"].
//   - SONG_ALIASES maps a raw song to a canonical "Title — Artist".
//   - Anything NOT in a map falls back to a trimmed copy of itself AND is
//     reported by `bun run scripts/normalize-review.ts` so it can be added.
//
// Post-night workflow: run the review script, hand the unmapped list to Claude,
// confirm the uncertain ones, append here, commit. See scripts/normalize-review.ts.
//
// Lines tagged `UNSURE:` are best guesses awaiting confirmation from the host.

// ── Singers ────────────────────────────────────────────────────────────────
// raw stage_name -> canonical singer name(s)
export const SINGER_ALIASES: Record<string, string[]> = {
  // Poeme is a person in their own right (confirmed by host). Combined names
  // are duets that credit both members.
  Poeme: ["Poeme"],
  "Matt poeme": ["Matt", "Poeme"],
  "Poeme Matt": ["Poeme", "Matt"],
  "Poeme erin": ["Poeme", "Erin"],

  // Matt and Matthew are DIFFERENT people (confirmed).
  Matt: ["Matt"],
  Matthew: ["Matthew"],

  Lils: ["Lils"],
  lils: ["Lils"],
  "Lils + jena": ["Lils", "Jenna"],
  "lils & Jenna": ["Lils", "Jenna"],
  Jenna: ["Jenna"],

  Jordan: ["Jordan"],
  caitlin: ["Caitlin"],

  Belle: ["Belle"],
  "Belle Katey": ["Belle", "Katy"],

  Ryn: ["Ryn"],
  Dennis: ["Dennis"],

  // Two different Marias (confirmed).
  Maria: ["Maria"],
  "Maria G": ["Maria G"],
  "Maria G.": ["Maria G"],

  Stephanie: ["Stephanie"],
  Charlie: ["Charlie"],
  Kelso: ["Kelso"],
  "Joey Bonez": ["Joey Bonez"],

  // Two different Kyles (confirmed).
  "Wild Kyle": ["Wild Kyle"],
  Kyle: ["Kyle"],

  Shane: ["Shane"],

  // Sam S., Sam Mac, and Sammie are three DIFFERENT people (confirmed).
  "Sam s.": ["Sam S."],
  "Sam Mac": ["Sam Mac"], // shares device token with "Sami And Matty" -> Sami = Sam Mac
  "Sami And Matty": ["Sam Mac", "Matty"],
  Sammie: ["Sammie"],

  Dana: ["Dana"],
  Amber: ["Amber"],

  // David and David Little are the same person (confirmed) -> "David".
  David: ["David"],
  "David Little (like Chicken Or Stewart)": ["David"],

  Hgonit: ["Hgonit"], // real person (confirmed)
  Lala: ["Lala"],
  Vanessa: ["Vanessa"],
  Elian: ["Elian"],
  Seth: ["Seth"],
  sofia: ["Sofia"],
  Bailey: ["Bailey"],

  Deann: ["Deann"],
  "Deann and lee": ["Deann", "Lee"],

  // Mike + Brian duo, spelled three ways
  "Mike Brian": ["Mike", "Brian"],
  "Mike and Brian": ["Mike", "Brian"],
  "Brian mike": ["Mike", "Brian"],

  Johnny: ["Johnny"],
  Brad: ["Brad"],
  Justin: ["Justin"],
  Ashley: ["Ashley"],
  Nathan: ["Nathan"],
  Tyler: ["Tyler"],
  Hector: ["Hector"],
  Jillian: ["Jillian"],

  // Katie / Katey are the same person, actually spelled "Katy" (confirmed).
  Katie: ["Katy"],
  Katey: ["Katy"],

  Kids: ["Kids"], // not a real singer (a group of kids)
  Chris: ["Chris"],
  Hunter: ["Hunter"],
  "The Reunions": ["The Reunions"],
  Amalia: ["Amalia"],
  X: ["X"], // real singer (confirmed)
  Jeff: ["Jeff"],
  "Ben Dover": ["Ben Dover"], // joke name
  "White girls": ["White girls"],
  "Nata Liza and ida": ["Nata", "Liza", "Ida"],
  Travis: ["Travis"],
  Serge: ["Serge"], // shares a phone token with Courtney (a couple), NOT the same person
  Jenny: ["Jenny"], // distinct from Jenna
  "Jacob Hooper": ["Jacob Hooper"],
  Evan: ["Evan"],
  SLOTH: ["SLOTH"],
  Mar: ["Mar"], // real singer (confirmed)
  Ali: ["Ali"],

  // Katelyn + Lea duo, two spellings
  "Katelyn And Lea": ["Katelyn", "Lea"],
  "Lea & Katelyn": ["Katelyn", "Lea"],

  Lindsey: ["Lindsey"],
  Joyous: ["Joyous"],
  Courtney: ["Courtney"],
  sydney: ["Sydney"],

  // Becca / Becka / Rebecca all the same person (confirmed).
  Becka: ["Becca"],
  Becca: ["Becca"],
  Rebecca: ["Becca"],

  Alex: ["Alex"],
  Peter: ["Peter"],
  Gino: ["Gino"],
  Lisa: ["Lisa"],
  Christina: ["Christina"],
  Sherry: ["Sherry"],

  "Emma, Olivia, Isabelle": ["Emma", "Olivia", "Isabelle"],
  "is and liv": ["Isabelle", "Olivia"], // confirmed

  // Shaun / shawn are the same person (confirmed).
  Shaun: ["Shawn"],
  shawn: ["Shawn"],
  Kristle: ["Kristle"],
  Elizabeth: ["Elizabeth"],
  Connor: ["Connor"],

  // ── Added from the Jul 19, 2026 night ──
  Liz: ["Liz"],
  // Song title got typed into the name field; this row is Matt singing "Without Me".
  "Without me": ["Matt"],

  // ── Added from the Jul 24–25, 2026 nights ──
  Sloth: ["SLOTH"], // same person as SLOTH, just lowercased
  brassie: ["Brassie"],
  Julia: ["Julia"],
  Luke: ["Luke"],
  Devin: ["Devin"],
  Angel: ["Angel"],
  Bill: ["Bill"],
  Sweetpea: ["Sweetpea"],
};

// ── Songs ──────────────────────────────────────────────────────────────────
// raw song -> "Title — Artist"
export const SONG_ALIASES: Record<string, string> = {
  "Beat it": "Beat It — Michael Jackson",
  "Sometimes when we touch": "Sometimes When We Touch — Dan Hill",
  "Love lockdown": "Love Lockdown — Kanye West",
  "Mr brightside": "Mr. Brightside — The Killers",
  "American boy": "American Boy — Estelle",
  "You outta know": "You Oughta Know — Alanis Morissette",
  "Like a virgin": "Like a Virgin — Madonna",
  "My way": "My Way — Frank Sinatra",
  "Frank Sinatra-My way": "My Way — Frank Sinatra",
  "Modern baseball- tears over beers": "Tears Over Beers — Modern Baseball",
  "Modern baseball - tears over beers": "Tears Over Beers — Modern Baseball",
  "Take me to church": "Take Me to Church — Hozier",
  Dragula: "Dragula — Rob Zombie",
  "Rob zombie dragula": "Dragula — Rob Zombie",
  "Dragula rob zombie": "Dragula — Rob Zombie",
  "It's my life bon jovi": "It's My Life — Bon Jovi",
  "Hotel california": "Hotel California — Eagles",
  "Shoop salt pepper": "Shoop — Salt-N-Pepa",
  "What's up four non": "What's Up? — 4 Non Blondes",
  "Im not the only one (Sam smith)": "I'm Not the Only One — Sam Smith",
  "Johnny Went Down to Hell - Thomas Mac": "Johnny Went Down to Hell — Thomas Mac", // UNSURE
  "Just a girl": "Just a Girl — No Doubt",
  "No Doubt - Just a Girl": "Just a Girl — No Doubt",
  "Harry Styles - Falling": "Falling — Harry Styles",
  Barricuda: "Barracuda — Heart",
  "the way i am - eminem": "The Way I Am — Eminem",
  "Before I forget": "Before I Forget — Slipknot",
  "Turn the page bob seger": "Turn the Page — Bob Seger",
  "Hate myself for loving": "I Hate Myself for Loving You — Joan Jett",
  "Meet me halfway": "Meet Me Halfway — Black Eyed Peas",
  "I forget": "I Forget — (unknown)", // UNSURE
  "I can't get no": "(I Can't Get No) Satisfaction — The Rolling Stones",
  "Toxic Britney Spears": "Toxic — Britney Spears",
  Toxic: "Toxic — Britney Spears",
  "December 1963": "December, 1963 (Oh What a Night) — The Four Seasons",
  "Man that I need olivia": "Man I Need — Olivia Dean",
  "Man I need olivia": "Man I Need — Olivia Dean",
  "Man olivia": "Man I Need — Olivia Dean",
  "Man I need": "Man I Need — Olivia Dean",
  "Smooth santana": "Smooth — Santana",
  "Santana smooth": "Smooth — Santana",
  Stronger: "Stronger — Kanye West", // UNSURE: Kanye or Kelly Clarkson?
  "Evanescence My Immortal": "My Immortal — Evanescence",
  "Cooper Alan plead the fifth": "Plead the Fifth — Cooper Alan",
  "Party in use": "Party in the U.S.A. — Miley Cyrus",
  "Greatest love of all whitney": "Greatest Love of All — Whitney Houston",
  "I have nothing whitney": "I Have Nothing — Whitney Houston",
  "I wanna be like you did bader": "I Wanna Be Like You — (unknown)", // UNSURE
  "A boy named sue Johnny": "A Boy Named Sue — Johnny Cash",
  "Colt 45": "Colt 45 — Afroman",
  "Don't stop believing": "Don't Stop Believin' — Journey",
  "Don't stop believing- journey.": "Don't Stop Believin' — Journey",
  "What's my name": "What's My Name? — Rihanna",
  "Too sweet hozier": "Too Sweet — Hozier",
  "Valerie - Amy Winehouse": "Valerie — Amy Winehouse",
  "Problem igggy": "Problem — Ariana Grande",
  "The pretenders stand by me": "I'll Stand by You — The Pretenders",
  "Singwagon Dixie chicks": "Sin Wagon — Dixie Chicks",
  "Xo tour": "XO Tour Llif3 — Lil Uzi Vert",
  "Nickelbakc this is how": "How You Remind Me — Nickelback",
  "Coheed and Cambria - the suffering": "The Suffering — Coheed and Cambria",
  Saltwater: "Saltwater — (unknown)", // UNSURE
  Poison: "Poison — Bell Biv DeVoe", // UNSURE: BBD or Alice Cooper?
  "You and I lady gaga": "You and I — Lady Gaga",
  "Exs and ohs": "Ex's & Oh's — Elle King",
  "He loves me by Jill Scott": "He Loves Me (Lyzel in E Flat) — Jill Scott",
  "Friends in low places": "Friends in Low Places — Garth Brooks",
  "Finger eleven paralyzer": "Paralyzer — Finger Eleven",
  "One step at a time jordyn sparks": "One Step at a Time — Jordin Sparks",
  "Charlie devil went down to": "The Devil Went Down to Georgia — Charlie Daniels Band",
  "So what pinj": "So What — P!nk",
  "Dreams and nightmares": "Dreams and Nightmares — Meek Mill",
  "Save a horse (ride a cowboy)": "Save a Horse (Ride a Cowboy) — Big & Rich",
  "Big and rich - save a horse ride a cowboy":
    "Save a Horse (Ride a Cowboy) — Big & Rich",
  "Heartless kanye": "Heartless — Kanye West",
  "Just dance": "Just Dance — Lady Gaga",
  "Fly away Lenny": "Fly Away — Lenny Kravitz",
  "Sweet Caroline": "Sweet Caroline — Neil Diamond",
  "Mercy by Duffy": "Mercy — Duffy",
  "I'll be there": "I'll Be There — Jackson 5", // UNSURE: Jackson 5 or Mariah?
  "Fuck you- celo green": "Fuck You (Forget You) — CeeLo Green",
  "Celo green- fuck you": "Fuck You (Forget You) — CeeLo Green",
  "The foundations - Build me up buttercup":
    "Build Me Up Buttercup — The Foundations",
  "Tquilaa Ella langley": "Tequila — Ella Langley", // UNSURE
  "Blame Brett - the beaches": "Blame Brett — The Beaches",
  "Angel of mine": "Angel of Mine — Monica", // UNSURE: Monica or Eternal?
  "You and I by Ingrid Michaelson": "You and I — Ingrid Michaelson",
  Crazy: "Crazy — (unknown)", // UNSURE: Gnarls Barkley / Patsy Cline / Aerosmith?
  "Locked outta heaven": "Locked Out of Heaven — Bruno Mars",
  "Sleeping with sirens - If you can't hang":
    "If You Can't Hang — Sleeping with Sirens",
  Somethifn: "Something — (unknown)", // UNSURE: garbled
  "Tennessee whiskey": "Tennessee Whiskey — Chris Stapleton",
  "Ricky Montgomery- line without a hook":
    "Line Without a Hook — Ricky Montgomery",
  "Seven nation army": "Seven Nation Army — The White Stripes",
  "Say hey (i love you) - michael franti & spearhead":
    "Say Hey (I Love You) — Michael Franti & Spearhead",
  "Kiss me thru phone": "Kiss Me thru the Phone — Soulja Boy",
  "Blind melon no rain": "No Rain — Blind Melon",
  "When it rains.": "When It Rains — (unknown)", // UNSURE
  "Summer romance": "Summer Romance — (unknown)", // UNSURE
  "Bruno Mars grenade": "Grenade — Bruno Mars",
  "Bruno mars grenade": "Grenade — Bruno Mars",
  "Hooked on a feeling - blue suede": "Hooked on a Feeling — Blue Swede",
  "Passion fruit by Drake": "Passionfruit — Drake",
  "gives you hell-the all american rejects":
    "Gives You Hell — The All-American Rejects",
  "Redneck woman": "Redneck Woman — Gretchen Wilson",
  "All the lights": "All of the Lights — Kanye West",
  "Baby got back": "Baby Got Back — Sir Mix-a-Lot",
  "Symphony of destruction": "Symphony of Destruction — Megadeth",
  "The chain - Fleetwood Mac": "The Chain — Fleetwood Mac",
  "The chain": "The Chain — Fleetwood Mac",
  "Mamas broken heart": "Mama's Broken Heart — Miranda Lambert",
  "Teenage Dirtbag": "Teenage Dirtbag — Wheatus",
  "Britney Spears": "Toxic — Britney Spears", // UNSURE: artist only, guessed song
  "Rihanna Love on the brain": "Love on the Brain — Rihanna",
  "Love on the brain": "Love on the Brain — Rihanna",
  "Love in the brain": "Love on the Brain — Rihanna",
  "Love in the brain ": "Love on the Brain — Rihanna",
  "Love in": "Love on the Brain — Rihanna", // UNSURE: fragment
  "You pick this song or the other one if you have time lol —-love on the brain by Rihanna":
    "Love on the Brain — Rihanna",
  "dream a little dream of me- the mamas and papas":
    "Dream a Little Dream of Me — The Mamas & the Papas",
  "Dream a little dream of me- the mamas and papas":
    "Dream a Little Dream of Me — The Mamas & the Papas",
  "dream a little dream of me- the mamas and the papas":
    "Dream a Little Dream of Me — The Mamas & the Papas",
  "Love on top -Beyonce": "Love on Top — Beyoncé",
  "cumbersome - seven mary three": "Cumbersome — Seven Mary Three",
  "In too deep - sum 41": "In Too Deep — Sum 41",
  "Devil Always Made Me Think Twice": "Devil Always Made Me Think Twice — (unknown)", // UNSURE
  "Bring my to life": "Bring Me to Life — Evanescence",
  Something: "Something — The Beatles", // UNSURE: The Beatles?
  "My boo usher and Alicia keys": "My Boo — Usher & Alicia Keys",
  "rebel yell": "Rebel Yell — Billy Idol",
  "Just like jess James": "Just Like Jesse James — Cher",
  "Joan Jett-I love rock n roll": "I Love Rock 'n' Roll — Joan Jett",
  "It will rain Bruno mars": "It Will Rain — Bruno Mars",
  "Ain't no sunshine": "Ain't No Sunshine — Bill Withers",
  "Fast car Tracy chapman": "Fast Car — Tracy Chapman",
  "ride the storm-goldford": "Ride the Storm — Goldford", // UNSURE
  "Young Mc - bust a move": "Bust a Move — Young MC",
  "Final countdown": "The Final Countdown — Europe",
  Popular: "Popular — (unknown)", // UNSURE: Wicked / The Weeknd / Nada Surf?
  Amaze: "Amaze — (unknown)", // UNSURE
  "Monster lady gaga": "Monster — Lady Gaga",
  "Creep radiohead": "Creep — Radiohead",
  "Creep - radiohead": "Creep — Radiohead",
  "Killing me softly": "Killing Me Softly — Fugees",
  "Kill me softly": "Killing Me Softly — Fugees",
  Wonderwall: "Wonderwall — Oasis",
  "____": "(unknown)", // blank entry
  "Tears don't cry bullet for my Valentine":
    "Tears Don't Fall — Bullet for My Valentine",
  "Tracy Chapman one reason": "Give Me One Reason — Tracy Chapman",
  Pronises: "Promises — (unknown)", // UNSURE: garbled "Promises"
  "Die on this hill": "Die on This Hill — (unknown)", // UNSURE
  "Drake find your love": "Find Your Love — Drake",
  "man in the box - alice in chains": "Man in the Box — Alice in Chains",
  "My own worst enemy -lit": "My Own Worst Enemy — Lit",
  "regulate - warren g": "Regulate — Warren G",
  "Cooler than": "Cooler Than Me — Mike Posner",
  "Begging you": "Beggin' — Måneskin", // UNSURE
  "I'm made of wax Larry a day to remember":
    "I'm Made of Wax, Larry, What Are You Made Of? — A Day to Remember",
  "Counting crows round here": "Round Here — Counting Crows",
  "Living room tegan and sara": "Living Room — Tegan and Sara", // UNSURE
  "The weekend wicked games": "Wicked Games — The Weeknd",
  otherside: "Otherside — Red Hot Chili Peppers",
  nookie: "Nookie — Limp Bizkit",
  "Rocket man": "Rocket Man — Elton John",
  "Flowers- Miley": "Flowers — Miley Cyrus",
  "Long time day": "Long Time — (unknown)", // UNSURE
  "Lose control- teddy swims": "Lose Control — Teddy Swims",
  "White wedding": "White Wedding — Billy Idol",
  "Ja rule jlo I'm real": "I'm Real — Jennifer Lopez & Ja Rule",
  "Billie Jean - Michael Jackson": "Billie Jean — Michael Jackson",
  "That's life frank": "That's Life — Frank Sinatra",
  "Fame ryn Carrie": "Fame — Irene Cara", // UNSURE
  "Rich girl": "Rich Girl — Gwen Stefani", // UNSURE: Gwen Stefani or Hall & Oates?
  "Fiona apple bad girl": "Fiona Apple — (unknown song)", // UNSURE
  "Weezer- go away": "Go Away — Weezer", // UNSURE
  "aerials - system of a down": "Aerials — System of a Down",
  "Boom boom pow": "Boom Boom Pow — Black Eyed Peas",
  "Cafune-tek it": "Tek It — Cafuné",
  "Ozzy close my eyes forever":
    "Close My Eyes Forever — Ozzy Osbourne & Lita Ford",
  "Genie in a bottle": "Genie in a Bottle — Christina Aguilera",
  "Little big town Pontoon": "Pontoon — Little Big Town",
  "black sheep - metric or brie larson/scott pilgrim": "Black Sheep — Metric",
  "Weezer-island in the sun": "Island in the Sun — Weezer",
  "Jelly roll somebody save me": "Save Me — Jelly Roll",
  "Behind blue eyes": "Behind Blue Eyes — The Who",
  "Silent lucidity queens right": "Silent Lucidity — Queensrÿche",
  "Faith- George Michael": "Faith — George Michael",
  "Higher - Rihanna": "Higher — Rihanna",
  "dont do me like that": "Don't Do Me Like That — Tom Petty",
  "jumper by third eye blind": "Jumper — Third Eye Blind",
  "whats my age again": "What's My Age Again? — Blink-182",
  "What's going on": "What's Going On — Marvin Gaye", // UNSURE
  Radiohead: "Creep — Radiohead", // UNSURE: artist only, guessed song
  "Sweet but psycho": "Sweet but Psycho — Ava Max",

  // ── Added from the Jul 19, 2026 night ──
  "Finger eleven - paralyzer": "Paralyzer — Finger Eleven",
  "Dandelion- Ella Langley": "Dandelion — Ella Langley",
  "Nothing Compares To You - Chris Cornell Version":
    "Nothing Compares 2 U — Chris Cornell",
  "Strawberry wine": "Strawberry Wine — Deana Carter",
  "Dream a little dream mamas and papas":
    "Dream a Little Dream of Me — The Mamas & the Papas",
  "What I want- Morgan wallen": "What I Want — Morgan Wallen",
  "Stand by me - Ben E. King": "Stand by Me — Ben E. King",
  Valerie: "Valerie — Amy Winehouse",
  // Song title accidentally entered in the name field; Matt sang Eminem's "Without Me".
  Eminem: "Without Me — Eminem",
  "Rob zombie-dragula with lily": "Dragula — Rob Zombie",
  Nutshell: "Nutshell — Alice in Chains",
  "Before he cheats": "Before He Cheats — Carrie Underwood",
  "I can't get no satisfaction": "(I Can't Get No) Satisfaction — The Rolling Stones",
  "Suds in the bucket": "Suds in the Bucket — Sara Evans",
  "A day to remember - I'm made of wax larry":
    "I'm Made of Wax, Larry, What Are You Made Of? — A Day to Remember",
  "Without me - Halsey": "Without Me — Halsey",
  "John #1 (NOT KATIE) - Freeebird": "Free Bird — Lynyrd Skynyrd",
  "Fuck you cee lo": "Fuck You (Forget You) — CeeLo Green",
  "Neil young old man": "Old Man — Neil Young",
  "Don't stop the music": "Don't Stop the Music — Rihanna",
  "No Hands": "No Hands — Waka Flocka Flame",
  "Tennessee Whiskey": "Tennessee Whiskey — Chris Stapleton",
  Smooth: "Smooth — Santana",
  "Never say never": "Never Say Never — Justin Bieber",
  // Liz picked this but it was never marked done — kept out of the leaderboard.
  "Oliver tree anything by him": "Oliver Tree — (unsung)",

  // ── Added from the Jul 24–25, 2026 nights ──
  "Crazy - gnarls barkley": "Crazy — Gnarls Barkley",
  "Pan!c at the disco- 9 in the afternoon":
    "Nine in the Afternoon — Panic! at the Disco",
  Rehab: "Rehab — Amy Winehouse",
  "Teenage dritbag": "Teenage Dirtbag — Wheatus",
  "Choosing Texas": "Choosin' Texas — Ella Langley",
  "Vianna Billy joel": "Vienna — Billy Joel",
  "Drunken love": "Drunk in Love — Beyoncé",
  Yay: "Drunk in Love — Beyoncé", // filler entry; the singer actually did Drunk in Love
  "Lisa Lisa all cried out": "All Cried Out — Lisa Lisa and Cult Jam",
  "Loser beck": "Loser — Beck",
  "Beck loser": "Loser — Beck",
  "Dirty work- steely dan": "Dirty Work — Steely Dan",
  "Me and your mama - childish gambino": "Me and Your Mama — Childish Gambino",
  Twisted: "Twisted — Keith Sweat", // "girl you got me twisted over you"
  "orbiter by noah kahan": "Orbiter — Noah Kahan",
  "Green river credence clear water revival":
    "Green River — Creedence Clearwater Revival",
  "Money for nothing": "Money for Nothing — Dire Straits",
  "Whenever Wherever by Shakira": "Whenever, Wherever — Shakira",
  "Heaven can wait": "Heaven Can Wait — Meat Loaf",
  "Hey jealousy": "Hey Jealousy — Gin Blossoms",
  "Skid row 18 to lige": "18 and Life — Skid Row",
  "Skid row": "18 and Life — Skid Row", // best guess from the companion entry
  "Proud Mary by Tina Turner": "Proud Mary — Tina Turner",
  "Lump presidents of the USA":
    "Lump — The Presidents of the United States of America",
  "Earth wind and fire- cant hide love": "Can't Hide Love — Earth, Wind & Fire",
  "Doing time- sublime": "Doin' Time — Sublime",
  "Son of a preacher man": "Son of a Preacher Man — Dusty Springfield",
  "Amy winehouse - valerie": "Valerie — Amy Winehouse",
  "Inside out": "Inside Out — Spoon",
  "Gimme the loot": "Gimme the Loot — The Notorious B.I.G.",
  "Bust a move": "Bust a Move — Young MC",
  Brandy: "Brandy (You're a Fine Girl) — Looking Glass",
  "Valerie Amy whine house": "Valerie — Amy Winehouse",
  "Man I need Olivia dean": "Man I Need — Olivia Dean",
  "Bad romance": "Bad Romance — Lady Gaga",
  "Freestyle lil baby": "Freestyle — Lil Baby",
  Macarena: "Macarena — Los del Río",
  September: "September — Earth, Wind & Fire",
  "Back to black": "Back to Black — Amy Winehouse",
};

// ── Token overrides ──────────────────────────────────────────────────────────
// Some raw stage_names collide across different real people — two different
// people both just type "Seth". When they can't be told apart by name, split
// them by their device token (stable per person). Checked BEFORE the name map,
// so it wins only for the specific person who owns that token; everyone else
// with the same name falls through to SINGER_ALIASES as normal.
export const TOKEN_ALIASES: Record<string, string[]> = {
  // Seth Eberhart-Ladd — shares the stage_name "Seth" with Seth Lenig, told
  // apart by this device token (confirmed by host, Jul 19 2026 night).
  "8712b1bf-fbc7-406d-9b82-e0009ddf2883": ["Seth E."],
};

// ── Resolvers ────────────────────────────────────────────────────────────────

/** Canonical singer name(s) for a raw stage_name, optionally disambiguated by
 *  the device token. Unknown -> [trimmed raw]. */
export function canonicalSingers(
  rawStageName: string,
  token?: string | null,
): string[] {
  if (token && TOKEN_ALIASES[token]) return TOKEN_ALIASES[token];
  const hit = SINGER_ALIASES[rawStageName];
  if (hit) return hit;
  const trimmed = rawStageName.trim();
  return [trimmed.length ? trimmed : "(unknown)"];
}

/** Canonical "Title — Artist" for a raw song. Unknown -> trimmed raw. */
export function canonicalSong(rawSong: string): string {
  const hit = SONG_ALIASES[rawSong];
  if (hit) return hit;
  const trimmed = rawSong.trim();
  return trimmed.length ? trimmed : "(unknown)";
}

/** True if this raw stage_name has an explicit reviewed mapping. */
export function isMappedSinger(rawStageName: string): boolean {
  return rawStageName in SINGER_ALIASES;
}

/** True if this raw song has an explicit reviewed mapping. */
export function isMappedSong(rawSong: string): boolean {
  return rawSong in SONG_ALIASES;
}
