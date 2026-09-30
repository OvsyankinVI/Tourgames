import { freeSpots, genderType, type Tournament } from '../domain/tournament';
import { formatDate, formatDuration, formatTime } from '../utils/dates';
import { Icon } from './Icon';

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
export function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const spots = freeSpots(t);
  const grade = [t.displayMinGrade || t.minGrade, t.displayMaxGrade || t.maxGrade].filter((x, i, arr) => x && arr.indexOf(x) === i).join('–');
  const gender = genderType(t.genders);
  const closed = ['CANCELLED', 'CANCELED', 'FINISHED', 'COMPLETED'].includes(t.status);
  return <article className={`tournament-card${spots === 0 ? ' is-full' : ''}`}>
    <div className="card-topline"><span className="format-label">{t.formatName}</span><Icon name="ball" size={23} /></div>
    <h3>{t.title}</h3>
    <div className="card-date"><span>{formatDate(t.startAt)}</span><span className="date-dot">·</span><time dateTime={t.startAt}>{formatTime(t.startAt)}</time></div>
    <div className="card-duration"><Icon name="clock" size={14} />{formatDuration(t.durationMinutes)}<span>МСК</span></div>
    <div className="club-block"><Icon name="pin" size={18} /><div><strong>{t.club.name}</strong><p>{t.club.address || 'Адрес уточняется'}</p></div></div>
    <div className="badges">{grade && <span>Уровень {grade}</span>}{t.isTeam && <span>Парный / командный</span>}{gender === 'women' && <span>Женский</span>}{gender === 'men' && <span>Мужской</span>}</div>
    <div className="card-bottom">
      <div className="occupancy"><span>{t.playersCount !== null && t.playersLimit !== null ? `${t.playersCount} / ${t.playersLimit} участников` : 'Состав уточняется'}</span>
        <strong className={spots === 0 || closed ? 'spots-full' : 'spots-open'}>{closed ? (t.status.startsWith('CANCEL') ? 'Отменён' : 'Завершён') : spots === null ? 'Места уточняются' : spots === 0 ? 'Мест нет' : `Свободно мест: ${spots}`}</strong>
        {t.isTeam && t.teamsCount !== null && t.teamsLimit !== null && <small>{t.teamsCount} / {t.teamsLimit} команд</small>}
      </div>
      <div className="price"><strong>{t.price === null ? 'Уточняется' : t.price === 0 ? 'Бесплатно' : money.format(t.price)}</strong><span>стоимость участия</span></div>
    </div>
  </article>;
}

export function SkeletonGrid() {
  return <div className="tournament-grid" aria-label="Загрузка турниров" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div className="tournament-card skeleton" key={i}><i /><i /><i /><i /><i /></div>)}</div>;
}
