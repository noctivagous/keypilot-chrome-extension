/**
 * Launcher category site catalog (SSOT for Launch Deck composition).
 *
 * - seed: true  → shown on a fresh deck even if never visited
 * - seed omitted/false → catalog-only; appears after visit auto-add or manual Add
 * - descriptionKey: message key for the short UI / add-picker blurb
 *
 * `searches` comes from search-engines.js (shared with settings).
 */

import { LAUNCHER_SEARCH_SITES } from './search-engines.js';
import { getMessage } from '../utils/i18n.js';

/**
 * @typedef {{
 *   title: string,
 *   url: string,
 *   descriptionKey: string,
 *   seed?: boolean,
 *   searchUrlPrefix?: string,
 *   isDefault?: boolean
 * }} LauncherSiteEntry
 */

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const SOCIAL = Object.freeze([
  { title: 'Instagram', url: 'https://instagram.com', descriptionKey: 'launcher_site_social_001_description', seed: true },
  { title: 'Facebook', url: 'https://facebook.com', descriptionKey: 'launcher_site_social_002_description', seed: true },
  { title: 'X (Twitter)', url: 'https://x.com', descriptionKey: 'launcher_site_social_003_description', seed: true },
  { title: 'Reddit', url: 'https://reddit.com', descriptionKey: 'launcher_site_social_004_description', seed: true },
  { title: 'Bluesky', url: 'https://bsky.app', descriptionKey: 'launcher_site_social_005_description', seed: true },
  { title: 'LinkedIn', url: 'https://linkedin.com', descriptionKey: 'launcher_site_social_006_description', seed: true },
  { title: 'Threads', url: 'https://threads.net', descriptionKey: 'launcher_site_social_007_description', seed: true },
  { title: 'Mastodon', url: 'https://mastodon.social', descriptionKey: 'launcher_site_social_008_description', seed: true },
  { title: 'TikTok', url: 'https://tiktok.com', descriptionKey: 'launcher_site_social_009_description' },
  { title: 'WhatsApp', url: 'https://whatsapp.com', descriptionKey: 'launcher_site_social_010_description' },
  { title: 'Pinterest', url: 'https://pinterest.com', descriptionKey: 'launcher_site_social_011_description' },
  { title: 'Discord', url: 'https://discord.com', descriptionKey: 'launcher_site_social_012_description' },
  { title: 'Telegram', url: 'https://telegram.org', descriptionKey: 'launcher_site_social_013_description' },
  { title: 'Snapchat', url: 'https://snapchat.com', descriptionKey: 'launcher_site_social_014_description' },
  { title: 'Messenger', url: 'https://messenger.com', descriptionKey: 'launcher_site_social_015_description' },
  { title: 'Nextdoor', url: 'https://nextdoor.com', descriptionKey: 'launcher_site_social_016_description' },
  { title: 'Tumblr', url: 'https://tumblr.com', descriptionKey: 'launcher_site_social_017_description' },
  { title: 'Quora', url: 'https://quora.com', descriptionKey: 'launcher_site_social_018_description' },
  { title: 'Medium', url: 'https://medium.com', descriptionKey: 'launcher_site_social_019_description' },
  { title: 'Behance', url: 'https://behance.net', descriptionKey: 'launcher_site_social_020_description' },
  { title: 'Dribbble', url: 'https://dribbble.com', descriptionKey: 'launcher_site_social_021_description' },
  { title: 'Goodreads', url: 'https://goodreads.com', descriptionKey: 'launcher_site_social_022_description' },
  { title: 'Flickr', url: 'https://flickr.com', descriptionKey: 'launcher_site_social_023_description' },
  { title: 'Patreon', url: 'https://patreon.com', descriptionKey: 'launcher_site_social_024_description' },
  { title: 'Substack Notes', url: 'https://substack.com', descriptionKey: 'launcher_site_social_025_description' },
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const NEWS = Object.freeze([
  { title: 'CNN', url: 'https://cnn.com', descriptionKey: 'launcher_site_news_001_description', seed: true },
  { title: 'BBC News', url: 'https://bbc.com/news', descriptionKey: 'launcher_site_news_002_description', seed: true },
  { title: 'NY Times', url: 'https://nytimes.com', descriptionKey: 'launcher_site_news_003_description', seed: true },
  { title: 'Reuters', url: 'https://reuters.com', descriptionKey: 'launcher_site_news_004_description', seed: true },
  { title: 'The Guardian', url: 'https://theguardian.com', descriptionKey: 'launcher_site_news_005_description', seed: true },
  { title: 'AP News', url: 'https://apnews.com', descriptionKey: 'launcher_site_news_006_description', seed: true },
  { title: 'Google News', url: 'https://news.google.com', descriptionKey: 'launcher_site_news_007_description' },
  { title: 'Yahoo News', url: 'https://news.yahoo.com', descriptionKey: 'launcher_site_news_008_description' },
  { title: 'MSN', url: 'https://msn.com', descriptionKey: 'launcher_site_news_009_description' },
  { title: 'Fox News', url: 'https://foxnews.com', descriptionKey: 'launcher_site_news_010_description' },
  { title: 'NBC News', url: 'https://nbcnews.com', descriptionKey: 'launcher_site_news_011_description' },
  { title: 'ABC News', url: 'https://abcnews.go.com', descriptionKey: 'launcher_site_news_012_description' },
  { title: 'CBS News', url: 'https://cbsnews.com', descriptionKey: 'launcher_site_news_013_description' },
  { title: 'USA Today', url: 'https://usatoday.com', descriptionKey: 'launcher_site_news_014_description' },
  { title: 'Washington Post', url: 'https://washingtonpost.com', descriptionKey: 'launcher_site_news_015_description' },
  { title: 'Wall Street Journal', url: 'https://wsj.com', descriptionKey: 'launcher_site_news_016_description', seed: true },
  { title: 'NPR', url: 'https://npr.org', descriptionKey: 'launcher_site_news_017_description' },
  { title: 'CNBC', url: 'https://cnbc.com', descriptionKey: 'launcher_site_news_018_description' },
  { title: 'Bloomberg', url: 'https://bloomberg.com', descriptionKey: 'launcher_site_news_019_description' },
  { title: 'The Atlantic', url: 'https://theatlantic.com', descriptionKey: 'launcher_site_news_020_description' },
  { title: 'Politico', url: 'https://politico.com', descriptionKey: 'launcher_site_news_021_description' },
  { title: 'Axios', url: 'https://axios.com', descriptionKey: 'launcher_site_news_022_description' },
  { title: 'The Hill', url: 'https://thehill.com', descriptionKey: 'launcher_site_news_023_description' },
  { title: 'Al Jazeera', url: 'https://aljazeera.com', descriptionKey: 'launcher_site_news_024_description' },
  { title: 'Time', url: 'https://time.com', descriptionKey: 'launcher_site_news_025_description' },
  { title: 'Newsweek', url: 'https://newsweek.com', descriptionKey: 'launcher_site_news_026_description' },
  { title: 'Daily Mail', url: 'https://dailymail.co.uk', descriptionKey: 'launcher_site_news_027_description', seed: true },
  { title: 'The Epoch Times', url: 'https://theepochtimes.com', descriptionKey: 'launcher_site_news_028_description' },
  { title: 'NTD', url: 'https://ntd.com', descriptionKey: 'launcher_site_news_029_description' },
  { title: 'New York Post', url: 'https://nypost.com', descriptionKey: 'launcher_site_news_030_description', seed: true },
  { title: 'Substack', url: 'https://substack.com', descriptionKey: 'launcher_site_news_031_description' },
  { title: 'TechCrunch', url: 'https://techcrunch.com', descriptionKey: 'launcher_site_news_032_description' }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const PRODUCTIVITY = Object.freeze([
  { title: 'Gmail', url: 'https://gmail.com', descriptionKey: 'launcher_site_productivity_001_description', seed: true },
  { title: 'Google Calendar', url: 'https://calendar.google.com', descriptionKey: 'launcher_site_productivity_002_description', seed: true },
  { title: 'Google Drive', url: 'https://drive.google.com', descriptionKey: 'launcher_site_productivity_003_description', seed: true },
  { title: 'Google Docs', url: 'https://docs.google.com', descriptionKey: 'launcher_site_productivity_004_description', seed: true },
  { title: 'Notion', url: 'https://notion.so', descriptionKey: 'launcher_site_productivity_005_description', seed: true },
  { title: 'Slack', url: 'https://slack.com', descriptionKey: 'launcher_site_productivity_006_description', seed: true },
  { title: 'Trello', url: 'https://trello.com', descriptionKey: 'launcher_site_productivity_007_description', seed: true },
  { title: 'Outlook', url: 'https://outlook.live.com', descriptionKey: 'launcher_site_productivity_008_description', seed: true },
  { title: 'Microsoft Teams', url: 'https://teams.microsoft.com', descriptionKey: 'launcher_site_productivity_009_description' },
  { title: 'OneDrive', url: 'https://onedrive.live.com', descriptionKey: 'launcher_site_productivity_010_description' },
  { title: 'Dropbox', url: 'https://dropbox.com', descriptionKey: 'launcher_site_productivity_011_description' },
  { title: 'Evernote', url: 'https://evernote.com', descriptionKey: 'launcher_site_productivity_012_description' },
  { title: 'Monday.com', url: 'https://monday.com', descriptionKey: 'launcher_site_productivity_013_description' },
  { title: 'Airtable', url: 'https://airtable.com', descriptionKey: 'launcher_site_productivity_014_description' },
  { title: 'Figma', url: 'https://figma.com', descriptionKey: 'launcher_site_productivity_015_description' },
  { title: 'Canva', url: 'https://canva.com', descriptionKey: 'launcher_site_productivity_016_description' },
  { title: 'Zoom', url: 'https://zoom.us', descriptionKey: 'launcher_site_productivity_017_description' },
  { title: 'Google Meet', url: 'https://meet.google.com', descriptionKey: 'launcher_site_productivity_018_description' },
  { title: 'GitHub', url: 'https://github.com', descriptionKey: 'launcher_site_productivity_019_description' },
  { title: 'GitLab', url: 'https://gitlab.com', descriptionKey: 'launcher_site_productivity_020_description' },
  { title: 'Linear', url: 'https://linear.app', descriptionKey: 'launcher_site_productivity_021_description' },
  { title: 'Jira', url: 'https://atlassian.com/software/jira', descriptionKey: 'launcher_site_productivity_022_description' },
  { title: 'Confluence', url: 'https://www.atlassian.com/software/confluence', descriptionKey: 'launcher_site_productivity_023_description' },
  { title: 'Miro', url: 'https://miro.com', descriptionKey: 'launcher_site_productivity_024_description', seed: true },
  { title: 'Obsidian Publish', url: 'https://obsidian.md', descriptionKey: 'launcher_site_productivity_025_description' },
  { title: 'iCloud', url: 'https://icloud.com', descriptionKey: 'launcher_site_productivity_026_description', seed: true }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const VIDEOS = Object.freeze([
  {
    title: 'YouTube',
    url: 'https://youtube.com',
    descriptionKey: 'launcher_site_videos_001_description',
    searchUrlPrefix: 'https://www.youtube.com/results?search_query=',
    seed: true
  },
  {
    title: 'Rumble',
    url: 'https://rumble.com',
    descriptionKey: 'launcher_site_videos_002_description',
    searchUrlPrefix: 'https://rumble.com/search/all?q=',
    seed: true
  },
  {
    title: 'Twitch',
    url: 'https://twitch.tv',
    descriptionKey: 'launcher_site_videos_003_description',
    searchUrlPrefix: 'https://www.twitch.tv/search?term=',
    seed: true
  },
  {
    title: 'Vimeo',
    url: 'https://vimeo.com',
    descriptionKey: 'launcher_site_videos_004_description',
    searchUrlPrefix: 'https://vimeo.com/search?q=',
    seed: true
  },
  {
    title: 'Dailymotion',
    url: 'https://dailymotion.com',
    descriptionKey: 'launcher_site_videos_005_description',
    searchUrlPrefix: 'https://www.dailymotion.com/search/',
    seed: true
  },
  {
    title: 'Odysee',
    url: 'https://odysee.com',
    descriptionKey: 'launcher_site_videos_006_description',
    searchUrlPrefix: 'https://odysee.com/$/search?q=',
    seed: true
  },
  {
    title: 'TikTok',
    url: 'https://tiktok.com',
    descriptionKey: 'launcher_site_videos_007_description',
    searchUrlPrefix: 'https://www.tiktok.com/search?q='
  },
  {
    title: 'Ganjing World',
    url: 'https://ganjingworld.com',
    descriptionKey: 'launcher_site_videos_008_description',
    searchUrlPrefix: 'https://www.ganjingworld.com/search?s=',
    seed: true
  },
  {
    title: 'Kick',
    url: 'https://kick.com',
    descriptionKey: 'launcher_site_videos_009_description',
    searchUrlPrefix: 'https://kick.com/search?query='
  },
  { title: 'YouTube Music', url: 'https://music.youtube.com', descriptionKey: 'launcher_site_videos_010_description' },
  { title: 'YouTube Studio', url: 'https://studio.youtube.com', descriptionKey: 'launcher_site_videos_011_description' },
  { title: 'Curiosity Stream', url: 'https://curiositystream.com', descriptionKey: 'launcher_site_videos_012_description' },
  { title: 'TED', url: 'https://ted.com', descriptionKey: 'launcher_site_videos_013_description' },
  { title: 'Facebook Watch', url: 'https://facebook.com/watch', descriptionKey: 'launcher_site_videos_014_description' },
  { title: 'Instagram Reels', url: 'https://instagram.com/reels', descriptionKey: 'launcher_site_videos_015_description' },
  { title: 'Archive Video', url: 'https://archive.org/details/movies', descriptionKey: 'launcher_site_videos_016_description' },
  { title: 'Plex Discover', url: 'https://watch.plex.tv', descriptionKey: 'launcher_site_videos_017_description' },
  { title: 'Plex', url: 'https://plex.tv', descriptionKey: 'launcher_site_videos_018_description' }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const ENTERTAINMENT = Object.freeze([
  { title: 'Netflix', url: 'https://netflix.com', descriptionKey: 'launcher_site_entertainment_001_description', seed: true },
  { title: 'Disney+', url: 'https://disneyplus.com', descriptionKey: 'launcher_site_entertainment_002_description', seed: true },
  { title: 'Hulu', url: 'https://hulu.com', descriptionKey: 'launcher_site_entertainment_003_description', seed: true },
  { title: 'YouTube', url: 'https://youtube.com', descriptionKey: 'launcher_site_entertainment_004_description', seed: true },
  { title: 'HBO Max', url: 'https://max.com', descriptionKey: 'launcher_site_entertainment_005_description', seed: true },
  { title: 'Prime Video', url: 'https://primevideo.com', descriptionKey: 'launcher_site_entertainment_006_description', seed: true },
  { title: 'Paramount+', url: 'https://paramountplus.com', descriptionKey: 'launcher_site_entertainment_007_description', seed: true },
  { title: 'Peacock', url: 'https://peacocktv.com', descriptionKey: 'launcher_site_entertainment_008_description', seed: true },
  { title: 'Spotify', url: 'https://spotify.com', descriptionKey: 'launcher_site_entertainment_009_description', seed: true },
  { title: 'Suno', url: 'https://suno.com', descriptionKey: 'launcher_site_entertainment_010_description', seed: true },
  { title: 'Apple TV+', url: 'https://tv.apple.com', descriptionKey: 'launcher_site_entertainment_011_description' },
  { title: 'Crunchyroll', url: 'https://crunchyroll.com', descriptionKey: 'launcher_site_entertainment_012_description' },
  { title: 'Tubi', url: 'https://tubitv.com', descriptionKey: 'launcher_site_entertainment_013_description' },
  { title: 'Pluto TV', url: 'https://pluto.tv', descriptionKey: 'launcher_site_entertainment_014_description' },
  { title: 'IMDb', url: 'https://imdb.com', descriptionKey: 'launcher_site_entertainment_015_description' },
  { title: 'Rotten Tomatoes', url: 'https://rottentomatoes.com', descriptionKey: 'launcher_site_entertainment_016_description' },
  { title: 'Letterboxd', url: 'https://letterboxd.com', descriptionKey: 'launcher_site_entertainment_017_description' },
  { title: 'SoundCloud', url: 'https://soundcloud.com', descriptionKey: 'launcher_site_entertainment_018_description' },
  { title: 'Bandcamp', url: 'https://bandcamp.com', descriptionKey: 'launcher_site_entertainment_019_description' },
  { title: 'Pandora', url: 'https://pandora.com', descriptionKey: 'launcher_site_entertainment_020_description' },
  { title: 'Twitch', url: 'https://twitch.tv', descriptionKey: 'launcher_site_entertainment_021_description' },
  { title: 'Steam', url: 'https://store.steampowered.com', descriptionKey: 'launcher_site_entertainment_022_description' },
  { title: 'Epic Games', url: 'https://store.epicgames.com', descriptionKey: 'launcher_site_entertainment_023_description' },
  { title: 'Xbox', url: 'https://xbox.com', descriptionKey: 'launcher_site_entertainment_024_description' },
  { title: 'PlayStation', url: 'https://playstation.com', descriptionKey: 'launcher_site_entertainment_025_description' },
  { title: 'Nintendo', url: 'https://nintendo.com', descriptionKey: 'launcher_site_entertainment_026_description' },
  { title: 'Goodreads', url: 'https://goodreads.com', descriptionKey: 'launcher_site_entertainment_027_description' },
  { title: 'Audible', url: 'https://audible.com', descriptionKey: 'launcher_site_entertainment_028_description' },
  { title: 'Podcasts (Apple)', url: 'https://podcasts.apple.com', descriptionKey: 'launcher_site_entertainment_029_description' }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const SHOPPING = Object.freeze([
  { title: 'Amazon', url: 'https://amazon.com', descriptionKey: 'launcher_site_shopping_001_description', seed: true },
  { title: 'eBay', url: 'https://ebay.com', descriptionKey: 'launcher_site_shopping_002_description', seed: true },
  { title: 'Walmart', url: 'https://walmart.com', descriptionKey: 'launcher_site_shopping_003_description', seed: true },
  { title: 'Target', url: 'https://target.com', descriptionKey: 'launcher_site_shopping_004_description', seed: true },
  { title: 'Etsy', url: 'https://etsy.com', descriptionKey: 'launcher_site_shopping_005_description', seed: true },
  { title: 'Best Buy', url: 'https://bestbuy.com', descriptionKey: 'launcher_site_shopping_006_description' },
  { title: 'Costco', url: 'https://costco.com', descriptionKey: 'launcher_site_shopping_007_description' },
  { title: 'AliExpress', url: 'https://aliexpress.com', descriptionKey: 'launcher_site_shopping_008_description' },
  { title: 'Temu', url: 'https://temu.com', descriptionKey: 'launcher_site_shopping_009_description' },
  { title: 'Wayfair', url: 'https://wayfair.com', descriptionKey: 'launcher_site_shopping_010_description' },
  { title: 'Home Depot', url: 'https://homedepot.com', descriptionKey: 'launcher_site_shopping_011_description' },
  { title: "Lowe's", url: 'https://lowes.com', descriptionKey: 'launcher_site_shopping_012_description' },
  { title: 'IKEA', url: 'https://ikea.com', descriptionKey: 'launcher_site_shopping_013_description' },
  { title: 'Apple Store', url: 'https://apple.com/shop', descriptionKey: 'launcher_site_shopping_014_description' },
  { title: 'Newegg', url: 'https://newegg.com', descriptionKey: 'launcher_site_shopping_015_description' },
  { title: 'Craigslist', url: 'https://craigslist.org', descriptionKey: 'launcher_site_shopping_016_description' },
  { title: 'Facebook Marketplace', url: 'https://facebook.com/marketplace', descriptionKey: 'launcher_site_shopping_017_description' },
  { title: 'Shopify', url: 'https://shopify.com', descriptionKey: 'launcher_site_shopping_018_description' },
  { title: 'Nike', url: 'https://nike.com', descriptionKey: 'launcher_site_shopping_019_description' },
  { title: 'Adidas', url: 'https://adidas.com', descriptionKey: 'launcher_site_shopping_020_description' },
  { title: 'Zappos', url: 'https://zappos.com', descriptionKey: 'launcher_site_shopping_021_description' },
  { title: 'Nordstrom', url: 'https://nordstrom.com', descriptionKey: 'launcher_site_shopping_022_description' },
  { title: "Macy's", url: 'https://macys.com', descriptionKey: 'launcher_site_shopping_023_description' },
  { title: 'Sephora', url: 'https://sephora.com', descriptionKey: 'launcher_site_shopping_024_description' },
  { title: 'Ulta', url: 'https://ulta.com', descriptionKey: 'launcher_site_shopping_025_description' },
  { title: 'Chewy', url: 'https://chewy.com', descriptionKey: 'launcher_site_shopping_026_description' },
  { title: 'Ticketmaster', url: 'https://ticketmaster.com', descriptionKey: 'launcher_site_shopping_027_description' },
  { title: 'Rakuten', url: 'https://rakuten.com', descriptionKey: 'launcher_site_shopping_028_description' }
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const AI = Object.freeze([
  { title: 'ChatGPT', url: 'https://chat.openai.com', descriptionKey: 'launcher_site_ai_001_description', seed: true },
  { title: 'Claude', url: 'https://claude.ai', descriptionKey: 'launcher_site_ai_002_description', seed: true },
  { title: 'Grok', url: 'https://grok.com', descriptionKey: 'launcher_site_ai_003_description', seed: true },
  { title: 'Gemini', url: 'https://gemini.google.com', descriptionKey: 'launcher_site_ai_004_description', seed: true },
  { title: 'Copilot', url: 'https://copilot.microsoft.com', descriptionKey: 'launcher_site_ai_005_description', seed: true },
  { title: 'Perplexity', url: 'https://perplexity.ai', descriptionKey: 'launcher_site_ai_006_description', seed: true },
  { title: 'Poe', url: 'https://poe.com', descriptionKey: 'launcher_site_ai_007_description', seed: true },
  { title: 'Character.AI', url: 'https://character.ai', descriptionKey: 'launcher_site_ai_008_description', seed: true },
  { title: 'Hugging Face', url: 'https://huggingface.co/chat', descriptionKey: 'launcher_site_ai_009_description', seed: true },
  { title: 'OpenAI', url: 'https://openai.com', descriptionKey: 'launcher_site_ai_010_description' },
  { title: 'Anthropic', url: 'https://anthropic.com', descriptionKey: 'launcher_site_ai_011_description' },
  { title: 'Google AI Studio', url: 'https://aistudio.google.com', descriptionKey: 'launcher_site_ai_012_description' },
  { title: 'NotebookLM', url: 'https://notebooklm.google.com', descriptionKey: 'launcher_site_ai_013_description' },
  { title: 'Midjourney', url: 'https://midjourney.com', descriptionKey: 'launcher_site_ai_014_description' },
  { title: 'Suno', url: 'https://suno.com', descriptionKey: 'launcher_site_ai_015_description', seed: true },
  { title: 'Leonardo AI', url: 'https://leonardo.ai', descriptionKey: 'launcher_site_ai_016_description' },
  { title: 'Ideogram', url: 'https://ideogram.ai', descriptionKey: 'launcher_site_ai_017_description' },
  { title: 'Runway', url: 'https://runwayml.com', descriptionKey: 'launcher_site_ai_018_description' },
  { title: 'ElevenLabs', url: 'https://elevenlabs.io', descriptionKey: 'launcher_site_ai_019_description' },
  { title: 'Groq', url: 'https://groq.com', descriptionKey: 'launcher_site_ai_020_description' },
  { title: 'Mistral', url: 'https://chat.mistral.ai', descriptionKey: 'launcher_site_ai_021_description' },
  { title: 'DeepSeek', url: 'https://chat.deepseek.com', descriptionKey: 'launcher_site_ai_022_description' },
  { title: 'Cursor', url: 'https://cursor.com', descriptionKey: 'launcher_site_ai_023_description' },
  { title: 'Replicate', url: 'https://replicate.com', descriptionKey: 'launcher_site_ai_024_description' },
  { title: 'Together AI', url: 'https://together.ai', descriptionKey: 'launcher_site_ai_025_description' },
]);

/** @type {ReadonlyArray<LauncherSiteEntry>} */
const ARCHIVE = Object.freeze([
  { title: 'Internet Archive', url: 'https://archive.org', descriptionKey: 'launcher_site_archive_001_description', seed: true },
  { title: 'Web', url: 'https://web.archive.org', descriptionKey: 'launcher_site_archive_002_description', seed: true },
  { title: 'Texts', url: 'https://archive.org/details/texts', descriptionKey: 'launcher_site_archive_003_description', seed: true },
  { title: 'Video', url: 'https://archive.org/details/movies', descriptionKey: 'launcher_site_archive_004_description', seed: true },
  { title: 'Audio', url: 'https://archive.org/details/audio', descriptionKey: 'launcher_site_archive_005_description', seed: true },
  { title: 'Software', url: 'https://archive.org/details/software', descriptionKey: 'launcher_site_archive_006_description', seed: true },
  { title: 'Images', url: 'https://archive.org/details/image', descriptionKey: 'launcher_site_archive_007_description', seed: true },
  { title: 'Open Library', url: 'https://openlibrary.org', descriptionKey: 'launcher_site_archive_008_description' },
  { title: 'TV News', url: 'https://archive.org/details/tv', descriptionKey: 'launcher_site_archive_009_description' },
  { title: 'Wayback Machine', url: 'https://web.archive.org', descriptionKey: 'launcher_site_archive_010_description' },
  { title: 'Archive-It', url: 'https://archive-it.org', descriptionKey: 'launcher_site_archive_011_description' },
  { title: 'Smithsonian Open Access', url: 'https://www.si.edu/openaccess', descriptionKey: 'launcher_site_archive_012_description' },
  { title: 'Europeana', url: 'https://europeana.eu', descriptionKey: 'launcher_site_archive_013_description' },
  { title: 'Project Gutenberg', url: 'https://gutenberg.org', descriptionKey: 'launcher_site_archive_014_description' },
  { title: 'HathiTrust', url: 'https://hathitrust.org', descriptionKey: 'launcher_site_archive_015_description' },
  { title: 'Digital Public Library', url: 'https://dp.la', descriptionKey: 'launcher_site_archive_016_description' },
  { title: 'Library of Congress', url: 'https://loc.gov', descriptionKey: 'launcher_site_archive_017_description' },
  { title: 'Wikimedia Commons', url: 'https://commons.wikimedia.org', descriptionKey: 'launcher_site_archive_018_description' },
  { title: 'Wikipedia', url: 'https://wikipedia.org', descriptionKey: 'launcher_site_archive_019_description' },
  { title: 'Wikisource', url: 'https://wikisource.org', descriptionKey: 'launcher_site_archive_020_description' }
]);

/** @type {Readonly<Record<string, string>>} */
const SEARCH_ENGINE_DESCRIPTION_KEYS = Object.freeze({
  Google: 'launcher_search_google_description',
  Bing: 'launcher_search_bing_description',
  DuckDuckGo: 'launcher_search_duckduckgo_description',
  Yahoo: 'launcher_search_yahoo_description',
  'Brave Search': 'launcher_search_brave_description',
  Ecosia: 'launcher_search_ecosia_description',
  Startpage: 'launcher_search_startpage_description'
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
        descriptionKey: SEARCH_ENGINE_DESCRIPTION_KEYS[s.title] || 'launcher_search_generic_description',
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
 * Resolve KeyPilot-owned launcher descriptions for presentation without changing
 * public site titles, URLs, or the persisted Launch Deck state.
 * @param {LauncherSiteEntry} entry
 * @returns {LauncherSiteEntry & { description: string }}
 */
export function localizeLauncherCatalogEntry(entry) {
  if (!entry) return { title: '', url: '', descriptionKey: '', description: '' };
  const description = entry.descriptionKey === 'launcher_search_generic_description'
    ? getMessage(entry.descriptionKey, entry.title)
    : getMessage(entry.descriptionKey);
  return { ...entry, description };
}

export function getLauncherCatalog(categoryKey) {
  return (LAUNCHER_SITE_CATALOG[categoryKey] || []).map(localizeLauncherCatalogEntry);
}
