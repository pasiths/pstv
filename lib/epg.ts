/**
 * Program guide helpers. Real EPG entries come from the epg_entry table;
 * when a channel has none we generate a stable, category-themed daily
 * schedule so every channel still shows a programming list.
 */

export type ProgramSlot = {
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  generated: boolean;
};

const POOLS: Record<string, string[]> = {
  News: [
    "Morning Headlines",
    "News Hour",
    "World Report",
    "Business Briefing",
    "Midday Bulletin",
    "Politics Today",
    "Evening News",
    "Late Night Report",
    "Weather Watch",
    "Special Coverage",
  ],
  Sports: [
    "Match Day Live",
    "Sports Center",
    "Game Highlights",
    "The Analysis Desk",
    "Championship Replay",
    "Fan Zone",
    "Pre-Game Show",
    "Post-Game Wrap",
    "Legends of the Game",
    "Training Ground",
  ],
  Movies: [
    "Feature Film",
    "Classic Cinema",
    "Blockbuster Night",
    "Director's Cut",
    "Movie Marathon",
    "Indie Spotlight",
    "Action Hour",
    "Romance Matinee",
    "Thriller Zone",
    "Family Movie Time",
  ],
  Music: [
    "Top Hits Countdown",
    "Music Video Mix",
    "Acoustic Sessions",
    "Concert Replay",
    "Artist Spotlight",
    "Retro Rewind",
    "Chart Toppers",
    "Late Night Beats",
    "Unplugged",
    "Festival Highlights",
  ],
  Kids: [
    "Cartoon Block",
    "Story Time",
    "Adventure Club",
    "Learning Fun",
    "Animated Classics",
    "Puzzle Play",
    "Superhero Hour",
    "Bedtime Tales",
    "Craft Corner",
    "Sing Along",
  ],
  Entertainment: [
    "Variety Show",
    "Celebrity Talk",
    "Reality Hour",
    "Comedy Night",
    "Drama Series",
    "Game Show",
    "Talent Search",
    "Behind the Scenes",
    "Prime Time Special",
    "Late Show",
  ],
  Documentary: [
    "Nature Watch",
    "History Uncovered",
    "Science Frontiers",
    "True Stories",
    "Wildlife Journey",
    "Engineering Marvels",
    "Ancient Worlds",
    "Ocean Deep",
    "Space Explored",
    "Human Stories",
  ],
  Religious: [
    "Morning Devotion",
    "Sacred Teachings",
    "Community Prayer",
    "Spiritual Reflections",
    "Scripture Study",
    "Evening Worship",
    "Faith and Life",
    "Sacred Music",
    "Sermon of the Day",
    "Meditation Hour",
  ],
  Education: [
    "Classroom Live",
    "Language Lessons",
    "STEM Hour",
    "History Class",
    "Study Zone",
    "Exam Prep",
    "Skills Workshop",
    "Open University",
    "Kids Learning",
    "Evening Lecture",
  ],
  Culture: [
    "Heritage Hour",
    "Arts Showcase",
    "Folk Traditions",
    "Theatre Live",
    "Cultural Digest",
    "Museum Walk",
    "Literature Corner",
    "Dance Stage",
    "Local Voices",
    "Night Culture",
  ],
  General: [
    "Morning Show",
    "Community Spotlight",
    "Talk of the Town",
    "Lifestyle Hour",
    "Local Stories",
    "Afternoon Magazine",
    "Prime Time",
    "Evening Special",
    "Culture Corner",
    "Night Owl",
  ],
};

function hashCode(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Build a full-day hourly schedule in the viewer's local timezone.
 * @param tzOffsetMinutes - minutes to add to UTC to get local time
 *   (same sign as Date#getTimezoneOffset but inverted: use -getTimezoneOffset()).
 */
export function generateDaySchedule(
  channel: { id: string; name: string; category: string },
  day: Date,
  tzOffsetMinutes?: number,
): ProgramSlot[] {
  const pool = POOLS[channel.category] || POOLS.General;
  const offset =
    typeof tzOffsetMinutes === "number"
      ? tzOffsetMinutes
      : -day.getTimezoneOffset();

  // Local midnight as UTC ms
  const local = new Date(day.getTime() + offset * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const dayStartUtc = Date.UTC(y, m, d, 0, 0, 0) - offset * 60_000;

  const seedBase = `${channel.id}:${y}-${m + 1}-${d}`;
  const slots: ProgramSlot[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const pick = hashCode(`${seedBase}:${hour}`) % pool.length;
    const startsAt = new Date(dayStartUtc + hour * 3_600_000);
    const endsAt = new Date(startsAt.getTime() + 3_600_000);
    slots.push({
      title: pool[pick],
      description: `${channel.name} · ${channel.category}`,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      generated: true,
    });
  }

  return slots;
}

export function findNowIndex(programs: ProgramSlot[], nowMs = Date.now()): number {
  return programs.findIndex((p) => {
    const start = new Date(p.startsAt).getTime();
    const end = new Date(p.endsAt).getTime();
    return start <= nowMs && end > nowMs;
  });
}
