import { normalizeTournament } from '../api/normalize';
import type { Tournament } from '../domain/tournament';
import { addDays, dayKey } from '../utils/dates';

// Synthetic public examples, not an actual LUNDA snapshot. Dates stay useful for UI testing.
export function demoTournaments(now = new Date()): Tournament[] {
  const today = dayKey(now);
  const clubs = [
    { uid: 'demo-first', displayName: 'First Padel Club', address: 'Шарикоподшипниковская улица, 13с5', city: 'Москва' },
    { uid: 'demo-luzhniki', displayName: 'Падел в Лужниках', address: 'Лужнецкая набережная, 24', city: 'Москва' },
    { uid: 'demo-multisport', displayName: 'Мультиспорт', address: 'Лужники, 24с10, вход со стороны набережной', city: 'Москва' },
    { uid: 'demo-raketa', displayName: 'Ракета Падел', address: 'Ленинградский проспект, 36, спортивный комплекс', city: 'Москва' },
  ];
  const specs = [
    ['Утро начинается с падела', 'AMERICANO', 'Americano', false, 0, '09:00', 2500, 7, 12, 1, 2, 90],
    ['Парный Americano D+ / C', 'TEAM_AMERICANO', 'Парный Americano', true, 0, '18:30', 7500, 10, 12, 2, 3, 120],
    ['Вечерний Escalera', 'ESCALERA', 'Escalera', false, 0, '20:00', 3200, 12, 16, 3, 4, 120],
    ['Girls on court ✨', 'AMERICANO', 'Americano', false, 1, '10:00', 2800, 6, 12, 1, 3, 120],
    ['Больше игры. Americano Flex', 'AMERICANO_OVERBOOKED', 'Americano Flex', false, 1, '13:30', 3500, 9, 12, 2, 4, 150],
    ['Суббота на корте — турнир для тех, кто любит длинные розыгрыши 🎾', 'TEAM_AMERICANO', 'Парный Americano', true, 2, '12:00', 6400, 16, 16, 2, 3, 120],
    ['Первый турнир? Самое время!', 'AMERICANO', 'Americano', false, 2, '09:30', 2000, 4, 12, 1, 1, 90],
    ['Мужской Escalera C+', 'ESCALERA', 'Escalera', false, 3, '19:00', 4000, 11, 12, 3, 4, 120],
    ['Воскресный микст', 'TEAM_AMERICANO', 'Парный Americano', true, 4, '14:00', 6000, 8, 16, 1, 3, 150],
    ['Новый формат: King of the court', 'KING_OF_COURT', 'King of the court', false, 5, '18:00', 3000, 8, 12, 2, 4, 120],
    ['Дружеская встреча на корте', 'AMERICANO', 'Americano', false, 7, '11:00', null, 6, 12, 1, 2, null],
    ['Большой парный турнир', 'TEAM_AMERICANO', 'Парный Americano', true, 8, '16:00', 8000, 12, 16, 3, 5, 180],
  ] as const;
  const grades = ['D', 'D+', 'C', 'C+', 'B'];
  return specs.map((s, i) => normalizeTournament({
    uid: `demo-${i}`, title: s[0], kind: s[1], kindName: s[2], teamType: s[3] ? 'TEAM' : 'INDIVIDUAL',
    plannedDate: `${addDays(today, s[4])}T${s[5]}:00+03:00`, price: s[6], countPlayers: s[7], playersLimit: s[8],
    minGrade: `GRADE_${s[9]}`, maxGrade: `GRADE_${s[10]}`, displayMinGrade: grades[s[9] - 1], displayMaxGrade: grades[s[10] - 1],
    duration: s[11], tournamentStatus: 'REGISTRATION', minRating: s[9], maxRating: s[10] + 1,
    countParticipantTeams: s[3] ? s[7] / 2 : null, teamsLimit: s[3] ? s[8] / 2 : null,
    genders: i === 3 ? ['WOMAN'] : i === 7 ? ['MAN'] : ['MAN', 'WOMAN'], ranking: i % 3 === 0,
    clubInfo: clubs[i % clubs.length], organizerInfo: { uid: 'demo-organizer', name: 'Команда клуба' },
  })!);
}
