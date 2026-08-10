/**
 * Launcher category site catalog (SSOT for Launch Deck composition).
 *
 * - seed: true  → shown on a fresh deck even if never visited
 * - seed omitted/false → catalog-only; appears after visit auto-add or manual Add
 * - description: short one-line blurb for UI / add picker
 *
 * `searches` comes from search-engines.js (shared with settings).
 */

import { LAUNCHER_SEARCH_SITES } from './search-engines.js';

/**
 * @typedef {{
 *   title: string,
 *   url: string,
 *   description: string,
 *   seed?: boolean,
 *   searchUrlPrefix?: string,
 *   isDefault?: boolean
 * }} LauncherSiteEntry
 */

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const SOCIAL = Object.freeze([
  { title: 'Instagram', url: 'https://instagram.com', description: 'Photo and short-video social network', seed: true },
  { title: 'Facebook', url: 'https://facebook.com', description: 'Friends, groups, and community feed', seed: true },
  { title: 'X (Twitter)', url: 'https://x.com', description: 'Real-time posts and public conversation', seed: true },
  { title: 'Reddit', url: 'https://reddit.com', description: 'Topic communities and discussion threads', seed: true },
  { title: 'Bluesky', url: 'https://bsky.app', description: 'Decentralized microblogging network', seed: true },
  { title: 'LinkedIn', url: 'https://linkedin.com', description: 'Professional networking and careers', seed: true },
  { title: 'Threads', url: 'https://threads.net', description: 'Text-focused social feed from Meta', seed: true },
  { title: 'Mastodon', url: 'https://mastodon.social', description: 'Federated open-source social network', seed: true },
  { title: 'TikTok', url: 'https://tiktok.com', description: 'Short-form video discovery and creation' },
  { title: 'WhatsApp', url: 'https://whatsapp.com', description: 'Encrypted messaging and group chats' },
  { title: 'Pinterest', url: 'https://pinterest.com', description: 'Visual boards for ideas and inspiration' },
  { title: 'Discord', url: 'https://discord.com', description: 'Voice, chat, and community servers' },
  { title: 'Telegram', url: 'https://telegram.org', description: 'Cloud messaging and large channels' },
  { title: 'Snapchat', url: 'https://snapchat.com', description: 'Ephemeral snaps and Stories' },
  { title: 'Messenger', url: 'https://messenger.com', description: 'Facebook messaging app on the web' },
  { title: 'Nextdoor', url: 'https://nextdoor.com', description: 'Neighborhood news and local chat' },
  { title: 'Tumblr', url: 'https://tumblr.com', description: 'Blogs, fandoms, and creative posts' },
  { title: 'Quora', url: 'https://quora.com', description: 'Q&A from experts and communities' },
  { title: 'Medium', url: 'https://medium.com', description: 'Long-form writing and essays' },
  { title: 'Behance', url: 'https://behance.net', description: 'Creative portfolios and project showcases' },
  { title: 'Dribbble', url: 'https://dribbble.com', description: 'Design shots and creative hiring' },
  { title: 'Goodreads', url: 'https://goodreads.com', description: 'Book reviews, lists, and reading goals' },
  { title: 'Flickr', url: 'https://flickr.com', description: 'Photo hosting and photographer community' },
  { title: 'Patreon', url: 'https://patreon.com', description: 'Support creators with memberships' },
  { title: 'Substack Notes', url: 'https://substack.com', description: 'Writer network and short social posts' },
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const NEWS = Object.freeze([
  { title: 'CNN', url: 'https://cnn.com', description: 'Breaking news and US/world coverage', seed: true },
  { title: 'BBC News', url: 'https://bbc.com/news', description: 'International news from the BBC', seed: true },
  { title: 'NY Times', url: 'https://nytimes.com', description: 'In-depth reporting and analysis', seed: true },
  { title: 'Reuters', url: 'https://reuters.com', description: 'Wire-service news and business headlines', seed: true },
  { title: 'The Guardian', url: 'https://theguardian.com', description: 'UK and global news and opinion', seed: true },
  { title: 'AP News', url: 'https://apnews.com', description: 'Associated Press wire and photos', seed: true },
  { title: 'Google News', url: 'https://news.google.com', description: 'Personalized news aggregator' },
  { title: 'Yahoo News', url: 'https://news.yahoo.com', description: 'Aggregated headlines and original stories' },
  { title: 'MSN', url: 'https://msn.com', description: 'Microsoft news portal and lifestyle feeds' },
  { title: 'Fox News', url: 'https://foxnews.com', description: 'US news and opinion programming' },
  { title: 'NBC News', url: 'https://nbcnews.com', description: 'Network news and investigations' },
  { title: 'ABC News', url: 'https://abcnews.go.com', description: 'US broadcast news and live updates' },
  { title: 'CBS News', url: 'https://cbsnews.com', description: 'National news and 60 Minutes' },
  { title: 'USA Today', url: 'https://usatoday.com', description: 'National newspaper and sports coverage' },
  { title: 'Washington Post', url: 'https://washingtonpost.com', description: 'Politics and national reporting' },
  { title: 'Wall Street Journal', url: 'https://wsj.com', description: 'Business and finance journalism', seed: true },
  { title: 'NPR', url: 'https://npr.org', description: 'Public radio news and podcasts' },
  { title: 'CNBC', url: 'https://cnbc.com', description: 'Markets, business, and finance TV' },
  { title: 'Bloomberg', url: 'https://bloomberg.com', description: 'Global markets and financial news' },
  { title: 'The Atlantic', url: 'https://theatlantic.com', description: 'Long-form culture and politics' },
  { title: 'Politico', url: 'https://politico.com', description: 'Politics and policy reporting' },
  { title: 'Axios', url: 'https://axios.com', description: 'Short, scannable news briefings' },
  { title: 'The Hill', url: 'https://thehill.com', description: 'Congress, campaigns, and policy' },
  { title: 'Al Jazeera', url: 'https://aljazeera.com', description: 'International news and documentaries' },
  { title: 'Time', url: 'https://time.com', description: 'Magazine news and covers' },
  { title: 'Newsweek', url: 'https://newsweek.com', description: 'Weekly news and opinion magazine' },
  { title: 'Daily Mail', url: 'https://dailymail.co.uk', description: 'UK tabloid news and celebrity', seed: true },
  { title: 'The Epoch Times', url: 'https://theepochtimes.com', description: 'Independent news and China coverage' },
  { title: 'NTD', url: 'https://ntd.com', description: 'New Tang Dynasty news and video' },
  { title: 'New York Post', url: 'https://nypost.com', description: 'NY metro news and entertainment', seed: true },
  { title: 'Substack', url: 'https://substack.com', description: 'Independent newsletters and writers' },
  { title: 'TechCrunch', url: 'https://techcrunch.com', description: 'Startups, tech, and venture news' }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const PRODUCTIVITY = Object.freeze([
  { title: 'Gmail', url: 'https://gmail.com', description: 'Google email and inbox', seed: true },
  { title: 'Google Calendar', url: 'https://calendar.google.com', description: 'Schedules, events, and reminders', seed: true },
  { title: 'Google Drive', url: 'https://drive.google.com', description: 'Cloud files and shared folders', seed: true },
  { title: 'Google Docs', url: 'https://docs.google.com', description: 'Collaborative documents and sheets', seed: true },
  { title: 'Notion', url: 'https://notion.so', description: 'Notes, wikis, and project databases', seed: true },
  { title: 'Slack', url: 'https://slack.com', description: 'Team chat and workplace channels', seed: true },
  { title: 'Trello', url: 'https://trello.com', description: 'Kanban boards for tasks', seed: true },
  { title: 'Outlook', url: 'https://outlook.live.com', description: 'Microsoft email and calendar', seed: true },
  { title: 'Microsoft Teams', url: 'https://teams.microsoft.com', description: 'Meetings, chat, and team hubs' },
  { title: 'OneDrive', url: 'https://onedrive.live.com', description: 'Microsoft cloud storage' },
  { title: 'Dropbox', url: 'https://dropbox.com', description: 'File sync and shared folders' },
  { title: 'Evernote', url: 'https://evernote.com', description: 'Notes, clippings, and notebooks' },
  { title: 'Monday.com', url: 'https://monday.com', description: 'Work OS for teams and projects' },
  { title: 'Airtable', url: 'https://airtable.com', description: 'Spreadsheet-database hybrid apps' },
  { title: 'Figma', url: 'https://figma.com', description: 'Collaborative UI and design files' },
  { title: 'Canva', url: 'https://canva.com', description: 'Easy graphic design templates' },
  { title: 'Zoom', url: 'https://zoom.us', description: 'Video meetings and webinars' },
  { title: 'Google Meet', url: 'https://meet.google.com', description: 'Google video calls' },
  { title: 'GitHub', url: 'https://github.com', description: 'Code hosting and pull requests' },
  { title: 'GitLab', url: 'https://gitlab.com', description: 'DevOps platform and Git repos' },
  { title: 'Linear', url: 'https://linear.app', description: 'Issue tracking for product teams' },
  { title: 'Jira', url: 'https://atlassian.com/software/jira', description: 'Agile project and issue tracking' },
  { title: 'Confluence', url: 'https://www.atlassian.com/software/confluence', description: 'Team wikis and documentation' },
  { title: 'Miro', url: 'https://miro.com', description: 'Online whiteboard for workshops', seed: true },
  { title: 'Obsidian Publish', url: 'https://obsidian.md', description: 'Local-first knowledge base notes' },
  { title: 'iCloud', url: 'https://icloud.com', description: 'Apple mail, photos, and Drive', seed: true }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const VIDEOS = Object.freeze([
  {
    title: 'YouTube',
    url: 'https://youtube.com',
    description: 'World’s largest video hosting platform',
    searchUrlPrefix: 'https://www.youtube.com/results?search_query=',
    seed: true
  },
  {
    title: 'Rumble',
    url: 'https://rumble.com',
    description: 'Video hosting with creator-focused payouts',
    searchUrlPrefix: 'https://rumble.com/search/all?q=',
    seed: true
  },
  {
    title: 'Twitch',
    url: 'https://twitch.tv',
    description: 'Live streaming for games and creators',
    searchUrlPrefix: 'https://www.twitch.tv/search?term=',
    seed: true
  },
  {
    title: 'Vimeo',
    url: 'https://vimeo.com',
    description: 'High-quality creator and pro video hosting',
    searchUrlPrefix: 'https://vimeo.com/search?q=',
    seed: true
  },
  {
    title: 'Dailymotion',
    url: 'https://dailymotion.com',
    description: 'Video sharing and publisher player network',
    searchUrlPrefix: 'https://www.dailymotion.com/search/',
    seed: true
  },
  {
    title: 'Odysee',
    url: 'https://odysee.com',
    description: 'Decentralized video on the LBRY network',
    searchUrlPrefix: 'https://odysee.com/$/search?q=',
    seed: true
  },
  {
    title: 'TikTok',
    url: 'https://tiktok.com',
    description: 'Short-form vertical video feed',
    searchUrlPrefix: 'https://www.tiktok.com/search?q='
  },
  {
    title: 'Ganjing World',
    url: 'https://ganjingworld.com',
    description: 'Clean family-friendly video platform',
    searchUrlPrefix: 'https://www.ganjingworld.com/search?s=',
    seed: true
  },
  {
    title: 'Kick',
    url: 'https://kick.com',
    description: 'Live streaming alternative for creators',
    searchUrlPrefix: 'https://kick.com/search?query='
  },
  { title: 'YouTube Music', url: 'https://music.youtube.com', description: 'Music streaming powered by YouTube' },
  { title: 'YouTube Studio', url: 'https://studio.youtube.com', description: 'Creator dashboard for YouTube channels' },
  { title: 'Curiosity Stream', url: 'https://curiositystream.com', description: 'Documentaries and nonfiction video' },
  { title: 'TED', url: 'https://ted.com', description: 'Ideas talks and TED conferences' },
  { title: 'Facebook Watch', url: 'https://facebook.com/watch', description: 'Shows and videos on Facebook' },
  { title: 'Instagram Reels', url: 'https://instagram.com/reels', description: 'Short clips on Instagram' },
  { title: 'Archive Video', url: 'https://archive.org/details/movies', description: 'Public-domain and archived films' },
  { title: 'Plex Discover', url: 'https://watch.plex.tv', description: 'Free movies and TV via Plex' },
  { title: 'Plex', url: 'https://plex.tv', description: 'Free movies and TV via Plex' }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const ENTERTAINMENT = Object.freeze([
  { title: 'Netflix', url: 'https://netflix.com', description: 'Subscription movies and TV originals', seed: true },
  { title: 'Disney+', url: 'https://disneyplus.com', description: 'Disney, Marvel, Star Wars, and Pixar', seed: true },
  { title: 'Hulu', url: 'https://hulu.com', description: 'On-demand TV and current-season shows', seed: true },
  { title: 'YouTube', url: 'https://youtube.com', description: 'Watch videos and live streams', seed: true },
  { title: 'HBO Max', url: 'https://max.com', description: 'HBO series, movies, and Max originals', seed: true },
  { title: 'Prime Video', url: 'https://primevideo.com', description: 'Amazon streaming movies and shows', seed: true },
  { title: 'Paramount+', url: 'https://paramountplus.com', description: 'CBS, Paramount, and sports streams', seed: true },
  { title: 'Peacock', url: 'https://peacocktv.com', description: 'NBCUniversal streaming library', seed: true },
  { title: 'Spotify', url: 'https://spotify.com', description: 'Music, podcasts, and playlists', seed: true },
  { title: 'Suno', url: 'https://suno.com', description: 'AI music generation and songs', seed: true },
  { title: 'Apple TV+', url: 'https://tv.apple.com', description: 'Apple original series and films' },
  { title: 'Crunchyroll', url: 'https://crunchyroll.com', description: 'Anime streaming and simulcasts' },
  { title: 'Tubi', url: 'https://tubitv.com', description: 'Free ad-supported movies and TV' },
  { title: 'Pluto TV', url: 'https://pluto.tv', description: 'Free live TV channels and on-demand' },
  { title: 'IMDb', url: 'https://imdb.com', description: 'Movie database, ratings, and trailers' },
  { title: 'Rotten Tomatoes', url: 'https://rottentomatoes.com', description: 'Critics and audience movie scores' },
  { title: 'Letterboxd', url: 'https://letterboxd.com', description: 'Film diary and social reviews' },
  { title: 'SoundCloud', url: 'https://soundcloud.com', description: 'Independent music and audio tracks' },
  { title: 'Bandcamp', url: 'https://bandcamp.com', description: 'Buy music directly from artists' },
  { title: 'Pandora', url: 'https://pandora.com', description: 'Personalized radio and music stations' },
  { title: 'Twitch', url: 'https://twitch.tv', description: 'Live games and creator streams' },
  { title: 'Steam', url: 'https://store.steampowered.com', description: 'PC game store and library' },
  { title: 'Epic Games', url: 'https://store.epicgames.com', description: 'Epic Games Store and free games' },
  { title: 'Xbox', url: 'https://xbox.com', description: 'Xbox consoles, Game Pass, and store' },
  { title: 'PlayStation', url: 'https://playstation.com', description: 'PlayStation games and PS Plus' },
  { title: 'Nintendo', url: 'https://nintendo.com', description: 'Nintendo Switch games and news' },
  { title: 'Goodreads', url: 'https://goodreads.com', description: 'Track books and reading lists' },
  { title: 'Audible', url: 'https://audible.com', description: 'Audiobooks and spoken-word content' },
  { title: 'Podcasts (Apple)', url: 'https://podcasts.apple.com', description: 'Apple Podcasts directory and shows' }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const SHOPPING = Object.freeze([
  { title: 'Amazon', url: 'https://amazon.com', description: 'Everything marketplace and Prime shipping', seed: true },
  { title: 'eBay', url: 'https://ebay.com', description: 'Auctions and buy-it-now marketplace', seed: true },
  { title: 'Walmart', url: 'https://walmart.com', description: 'Retail goods with store pickup', seed: true },
  { title: 'Target', url: 'https://target.com', description: 'Home, apparel, and everyday essentials', seed: true },
  { title: 'Etsy', url: 'https://etsy.com', description: 'Handmade, vintage, and craft goods', seed: true },
  { title: 'Best Buy', url: 'https://bestbuy.com', description: 'Consumer electronics and appliances' },
  { title: 'Costco', url: 'https://costco.com', description: 'Membership warehouse club shopping' },
  { title: 'AliExpress', url: 'https://aliexpress.com', description: 'Global marketplace from Chinese sellers' },
  { title: 'Temu', url: 'https://temu.com', description: 'Discount marketplace for everyday goods' },
  { title: 'Wayfair', url: 'https://wayfair.com', description: 'Furniture and home décor online' },
  { title: 'Home Depot', url: 'https://homedepot.com', description: 'Home improvement and building supplies' },
  { title: "Lowe's", url: 'https://lowes.com', description: 'Hardware, appliances, and DIY tools' },
  { title: 'IKEA', url: 'https://ikea.com', description: 'Affordable furniture and home goods' },
  { title: 'Apple Store', url: 'https://apple.com/shop', description: 'Apple devices, accessories, and trade-in' },
  { title: 'Newegg', url: 'https://newegg.com', description: 'PC parts and tech gear' },
  { title: 'Craigslist', url: 'https://craigslist.org', description: 'Local classifieds and personals' },
  { title: 'Facebook Marketplace', url: 'https://facebook.com/marketplace', description: 'Local buy/sell via Facebook' },
  { title: 'Shopify', url: 'https://shopify.com', description: 'E-commerce platform for online stores' },
  { title: 'Nike', url: 'https://nike.com', description: 'Athletic shoes, apparel, and gear' },
  { title: 'Adidas', url: 'https://adidas.com', description: 'Sportswear, sneakers, and training gear' },
  { title: 'Zappos', url: 'https://zappos.com', description: 'Shoes and apparel with free returns' },
  { title: 'Nordstrom', url: 'https://nordstrom.com', description: 'Department store fashion and beauty' },
  { title: "Macy's", url: 'https://macys.com', description: 'Clothing, home, and department store' },
  { title: 'Sephora', url: 'https://sephora.com', description: 'Beauty products and makeup' },
  { title: 'Ulta', url: 'https://ulta.com', description: 'Beauty retail and salon products' },
  { title: 'Chewy', url: 'https://chewy.com', description: 'Pet food, supplies, and pharmacy' },
  { title: 'Ticketmaster', url: 'https://ticketmaster.com', description: 'Event tickets for concerts and sports' },
  { title: 'Rakuten', url: 'https://rakuten.com', description: 'Cash-back shopping portal' }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const AI = Object.freeze([
  { title: 'ChatGPT', url: 'https://chat.openai.com', description: 'OpenAI conversational AI assistant', seed: true },
  { title: 'Claude', url: 'https://claude.ai', description: 'Anthropic AI assistant for writing and code', seed: true },
  { title: 'Grok', url: 'https://grok.com', description: 'xAI chatbot with real-time knowledge', seed: true },
  { title: 'Gemini', url: 'https://gemini.google.com', description: 'Google multimodal AI assistant', seed: true },
  { title: 'Copilot', url: 'https://copilot.microsoft.com', description: 'Microsoft AI chat and Office help', seed: true },
  { title: 'Perplexity', url: 'https://perplexity.ai', description: 'AI search with cited answers', seed: true },
  { title: 'Poe', url: 'https://poe.com', description: 'Multi-bot AI chat hub', seed: true },
  { title: 'Character.AI', url: 'https://character.ai', description: 'Chat with custom AI characters', seed: true },
  { title: 'Hugging Face', url: 'https://huggingface.co/chat', description: 'Open models and AI chat demos', seed: true },
  { title: 'OpenAI', url: 'https://openai.com', description: 'OpenAI research, API, and products' },
  { title: 'Anthropic', url: 'https://anthropic.com', description: 'Claude maker and AI safety company' },
  { title: 'Google AI Studio', url: 'https://aistudio.google.com', description: 'Build and test Gemini prompts' },
  { title: 'NotebookLM', url: 'https://notebooklm.google.com', description: 'AI research notebooks from your sources' },
  { title: 'Midjourney', url: 'https://midjourney.com', description: 'AI image generation community' },
  { title: 'Suno', url: 'https://suno.com', description: 'Generate songs with AI', seed: true },
  { title: 'Leonardo AI', url: 'https://leonardo.ai', description: 'AI image and asset generation' },
  { title: 'Ideogram', url: 'https://ideogram.ai', description: 'AI images with strong text rendering' },
  { title: 'Runway', url: 'https://runwayml.com', description: 'AI video generation and editing' },
  { title: 'ElevenLabs', url: 'https://elevenlabs.io', description: 'AI voice synthesis and cloning' },
  { title: 'Groq', url: 'https://groq.com', description: 'Ultra-fast LLM inference platform' },
  { title: 'Mistral', url: 'https://chat.mistral.ai', description: 'European open-weight AI chat' },
  { title: 'DeepSeek', url: 'https://chat.deepseek.com', description: 'Reasoning-focused AI chat models' },
  { title: 'Cursor', url: 'https://cursor.com', description: 'AI-powered code editor' },
  { title: 'Replicate', url: 'https://replicate.com', description: 'Run open ML models via API' },
  { title: 'Together AI', url: 'https://together.ai', description: 'Hosted open-source LLM inference' },
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const ARCHIVE = Object.freeze([
  { title: 'Internet Archive', url: 'https://archive.org', description: 'Digital library of books, media, and web', seed: true },
  { title: 'Web', url: 'https://web.archive.org', description: 'Wayback Machine archived web pages', seed: true },
  { title: 'Texts', url: 'https://archive.org/details/texts', description: 'Books and texts collection', seed: true },
  { title: 'Video', url: 'https://archive.org/details/movies', description: 'Movies and video archive', seed: true },
  { title: 'Audio', url: 'https://archive.org/details/audio', description: 'Audio recordings and music archive', seed: true },
  { title: 'Software', url: 'https://archive.org/details/software', description: 'Vintage software and apps archive', seed: true },
  { title: 'Images', url: 'https://archive.org/details/image', description: 'Image and photo collections', seed: true },
  { title: 'Open Library', url: 'https://openlibrary.org', description: 'Borrow and catalog books online' },
  { title: 'TV News', url: 'https://archive.org/details/tv', description: 'Searchable TV news archive' },
  { title: 'Wayback Machine', url: 'https://web.archive.org', description: 'Browse historical snapshots of the web' },
  { title: 'Archive-It', url: 'https://archive-it.org', description: 'Curated web archiving for institutions' },
  { title: 'Smithsonian Open Access', url: 'https://www.si.edu/openaccess', description: 'Free Smithsonian collection images' },
  { title: 'Europeana', url: 'https://europeana.eu', description: 'European cultural heritage portal' },
  { title: 'Project Gutenberg', url: 'https://gutenberg.org', description: 'Free public-domain ebooks' },
  { title: 'HathiTrust', url: 'https://hathitrust.org', description: 'Digitized library books and research' },
  { title: 'Digital Public Library', url: 'https://dp.la', description: 'US libraries and museums portal' },
  { title: 'Library of Congress', url: 'https://loc.gov', description: 'US national library collections' },
  { title: 'Wikimedia Commons', url: 'https://commons.wikimedia.org', description: 'Free media files for Wikipedia' },
  { title: 'Wikipedia', url: 'https://wikipedia.org', description: 'Free encyclopedia anyone can edit' },
  { title: 'Wikisource', url: 'https://wikisource.org', description: 'Free source texts and documents' }
]);

/** @type {Readonly<Record<string, string>>} */
const SEARCH_ENGINE_DESCRIPTIONS = Object.freeze({
  Google: 'General web search from Google',
  Bing: 'Microsoft Bing web search',
  DuckDuckGo: 'Privacy-focused web search',
  Yahoo: 'Yahoo Search portal',
  'Brave Search': 'Independent search from Brave',
  Ecosia: 'Search that plants trees',
  Startpage: 'Private Google results proxy'
});

/**
 * Full catalog keyed by launcher category.
 * @type {Readonly<Record<string, ReadonlyArray<LauncherSiteEntry>>>}
 */
export const LAUNCHER_SITE_CATALOG = Object.freeze({
  social: SOCIAL,
  news: NEWS,
  productivity: PRODUCTIVITY,
  videos: VIDEOS,
  entertainment: ENTERTAINMENT,
  shopping: SHOPPING,
  ai: AI,
  archive: ARCHIVE,
  searches: Object.freeze(
    LAUNCHER_SEARCH_SITES.map((s) =>
      Object.freeze({
        title: s.title,
        url: s.url,
        description: SEARCH_ENGINE_DESCRIPTIONS[s.title] || `${s.title} web search`,
        seed: true,
        isDefault: true
      })
    )
  )
});

/** Categories that use the catalog composer (not Bookmarks special deck). */
export const LAUNCHER_CATALOG_CATEGORY_KEYS = Object.freeze(
  Object.keys(LAUNCHER_SITE_CATALOG)
);

/**
 * @param {string} categoryKey
 * @returns {ReadonlyArray<LauncherSiteEntry>}
 */
export function getLauncherCatalog(categoryKey) {
  return LAUNCHER_SITE_CATALOG[categoryKey] || [];
}
