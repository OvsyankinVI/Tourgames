import { useState, type ReactNode } from 'react';
import type { Tournament } from '../domain/tournament';
import { DATE_OPTIONS, TIME_OPTIONS, TEAM_OPTIONS, GENDER_OPTIONS, DURATION_OPTIONS, levelOptions, type Filters } from '../utils/filters';
import { Icon } from './Icon';

interface Props { filters: Filters; onChange: (filters: Filters) => void; items: Tournament[] }
export function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, name]) => <option value={v} key={v}>{name}</option>)}</select></label>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="filter-group"><legend>{title}</legend>{children}</fieldset>;
}
export function FilterPanel({ filters: f, onChange, items }: Props) {
  const [clubSearch, setClubSearch] = useState('');
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...f, [key]: value });
  const toggle = (key: 'clubs' | 'formats', id: string) => set(key, f[key].includes(id) ? f[key].filter(v => v !== id) : [...f[key], id]);
  const clubs = [...new Map(items.filter(t => t.club.id).map(t => [t.club.id, t.club.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'));
  const formats = [...new Map(items.map(t => [t.formatCode, t.formatName])).entries()];
  const inputNumber = (key: 'priceMin' | 'priceMax' | 'ratingMin' | 'ratingMax', label: string, placeholder: string) => <label className="field"><span>{label}</span><input type="number" inputMode="decimal" min="0" step={key.startsWith('rating') ? '0.1' : '100'} value={f[key]} placeholder={placeholder} onChange={e => set(key, e.target.value)} /></label>;
  return <div className="filter-panel">
    <Group title="Когда играем?">
      <div className="field-pair"><SelectField label="Дата" value={f.date} options={DATE_OPTIONS} onChange={v => onChange({ ...f, date: v, from: '', to: '' })} /><SelectField label="Время · МСК" value={f.time} options={TIME_OPTIONS} onChange={v => set('time', v)} /></div>
      {(f.date === 'custom' || f.date === 'range') && <div className="field-pair custom-dates"><label className="field"><span>{f.date === 'range' ? 'С даты' : 'Дата турнира'}</span><input type="date" value={f.from} max={f.date === 'range' ? f.to || undefined : undefined} onChange={e => set('from', e.target.value)} /></label>{f.date === 'range' && <label className="field"><span>По дату</span><input type="date" min={f.from || undefined} value={f.to} onChange={e => set('to', e.target.value)} /></label>}</div>}
      {f.from && f.to && f.from > f.to && <p className="field-error">Начало диапазона должно быть раньше окончания.</p>}
    </Group>
    <Group title="Клубы">
      <label className="club-search"><Icon name="search" size={17} /><input type="search" aria-label="Поиск клуба" placeholder="Найти клуб" value={clubSearch} onChange={e => setClubSearch(e.target.value)} /></label>
      <button className="text-button all-clubs" type="button" onClick={() => set('clubs', [])}>Все клубы{f.clubs.length === 0 ? ' ✓' : ''}</button>
      <div className="check-list">{clubs.filter(([, name]) => name.toLocaleLowerCase('ru').includes(clubSearch.toLocaleLowerCase('ru'))).map(([id, name]) => <label className="check" key={id}><input type="checkbox" checked={f.clubs.includes(id)} onChange={() => toggle('clubs', id)} /><span>{name}</span></label>)}{!clubs.some(([, name]) => name.toLocaleLowerCase('ru').includes(clubSearch.toLocaleLowerCase('ru'))) && <p className="muted">Клуб не найден</p>}</div>
    </Group>
    <Group title="Формат турнира"><div className="check-list">{formats.map(([id, name]) => <label className="check" key={id}><input type="checkbox" checked={f.formats.includes(id)} onChange={() => toggle('formats', id)} /><span>{name}</span></label>)}</div></Group>
    <Group title="Состав и уровень">
      <div className="field-pair"><SelectField label="Участие" value={f.team} options={TEAM_OPTIONS} onChange={v => set('team', v)} /><SelectField label="Ваш уровень" value={f.level} options={[[ '', 'Любой уровень' ], ...levelOptions(items)]} onChange={v => set('level', v)} /></div>
      <SelectField label="Состав" value={f.gender} options={GENDER_OPTIONS} onChange={v => set('gender', v)} />
    </Group>
    <Group title="Стоимость и длительность">
      <div className="field-pair">{inputNumber('priceMin', 'Цена от, ₽', '0')}{inputNumber('priceMax', 'Цена до, ₽', 'Без лимита')}</div>
      {f.priceMin && f.priceMax && Number(f.priceMin) > Number(f.priceMax) && <p className="field-error">Минимальная цена больше максимальной.</p>}
      <SelectField label="Длительность" value={f.duration} options={DURATION_OPTIONS} onChange={v => set('duration', v)} />
    </Group>
    {items.some(t => t.minRating !== null || t.maxRating !== null) && <Group title="Рейтинг"><p className="field-hint">Турниры с пересекающимся диапазоном рейтинга.</p><div className="field-pair">{inputNumber('ratingMin', 'Рейтинг от', 'Любой')}{inputNumber('ratingMax', 'Рейтинг до', 'Любой')}</div>{f.ratingMin && f.ratingMax && Number(f.ratingMin) > Number(f.ratingMax) && <p className="field-error">Начало диапазона больше окончания.</p>}</Group>}
    <label className="check availability"><input type="checkbox" checked={f.available} onChange={e => set('available', e.target.checked)} /><span>Только со свободными местами</span></label>
  </div>;
}
