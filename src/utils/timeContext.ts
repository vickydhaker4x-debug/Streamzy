import { TimeOfDay, TimeContextInfo } from '../types';

export function getTimeContext(forcedTimeOfDay?: TimeOfDay | null): TimeContextInfo {
  let timeOfDay: TimeOfDay = 'afternoon';

  if (forcedTimeOfDay) {
    timeOfDay = forcedTimeOfDay;
  } else {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }
  }

  switch (timeOfDay) {
    case 'morning':
      return {
        timeOfDay: 'morning',
        greeting: 'Good morning',
        subtitle: 'Energize your day with upbeat melodies & acoustic vibes',
        icon: 'wb_sunny',
        recommendedVibes: ['Energize', 'Workout', 'Feel good', 'Commute', 'Romance'],
        ambientColor: 'from-amber-500/15 via-rose-500/5 to-transparent'
      };
    case 'afternoon':
      return {
        timeOfDay: 'afternoon',
        greeting: 'Good afternoon',
        subtitle: 'Keep the momentum going with rhythm & focus mixes',
        icon: 'light_mode',
        recommendedVibes: ['Focus', 'Feel good', 'Pop', 'Commute', 'Podcasts'],
        ambientColor: 'from-orange-500/15 via-amber-500/5 to-transparent'
      };
    case 'evening':
      return {
        timeOfDay: 'evening',
        greeting: 'Good evening',
        subtitle: 'Unwind and recharge with sunset melodies & romance',
        icon: 'wb_twilight',
        recommendedVibes: ['Relax', 'Romance', 'Party', 'Feel good', 'Chill'],
        ambientColor: 'from-purple-500/20 via-rose-500/10 to-transparent'
      };
    case 'night':
    default:
      return {
        timeOfDay: 'night',
        greeting: 'Good night',
        subtitle: 'Deep lo-fi beats, ambient acoustics & soothing sleep sounds',
        icon: 'bedtime',
        recommendedVibes: ['Relax', 'Focus', 'Romance', 'Chill', 'Soulful'],
        ambientColor: 'from-indigo-600/25 via-violet-600/10 to-transparent'
      };
  }
}
