import { useEffect, useRef, useState } from 'react';
import type { Tournament } from '../domain/tournament';
import { formatDate, formatTime } from '../utils/dates';

declare global { interface Window { L?: any } }

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const MOSCOW: [number, number] = [55.7558, 37.6176];

function loadLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  if (!document.querySelector('link[data-leaflet]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = LEAFLET_CSS; link.dataset.leaflet = '1'; document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet]');
    if (existing) { existing.addEventListener('load', () => resolve(window.L)); existing.addEventListener('error', reject); return; }
    const script = document.createElement('script'); script.src = LEAFLET_JS; script.dataset.leaflet = '1'; script.onload = () => resolve(window.L); script.onerror = reject; document.head.appendChild(script);
  });
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function geocode(address:string, city:string): Promise<[number,number]|null> {
  const key='tour-games-geo:'+address;
  try { const cached=localStorage.getItem(key); if(cached) return JSON.parse(cached); } catch {}
  const q=[address,city||'Москва','Россия'].filter(Boolean).join(', ');
  const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});
  if(!r.ok) return null; const data=await r.json(); if(!data[0]) return null;
  const point:[number,number]=[Number(data[0].lat),Number(data[0].lon)];
  try { localStorage.setItem(key,JSON.stringify(point)); } catch {} return point;
}
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export function TournamentMap({tournaments}:{tournaments:Tournament[]}) {
  const el=useRef<HTMLDivElement>(null); const [status,setStatus]=useState('Готовим карту клубов…');
  useEffect(()=>{ let disposed=false; let map:any;
    (async()=>{ try {
      const L=await loadLeaflet(); if(disposed||!el.current)return;
      map=L.map(el.current,{scrollWheelZoom:false}).setView(MOSCOW,10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
      const groups=new Map<string,Tournament[]>();
      tournaments.forEach(t=>{const key=t.club.id||t.club.address||t.club.name; groups.set(key,[...(groups.get(key)||[]),t]);});
      const bounds:any[]=[]; let done=0;
      for(const group of groups.values()){ if(disposed)return; const club=group[0].club; if(!club.address)continue;
        setStatus(`Находим клубы на карте: ${done}/${groups.size}`);
        const p=await geocode(club.address,club.city); done++; if(!p){await wait(1050);continue;} bounds.push(p);
        const shown=group.slice(0,4).map(t=>`<div class="map-tournament"><div class="map-title">${esc(t.title)}</div><div class="map-meta">${esc(formatDate(t.startAt))} · ${esc(formatTime(t.startAt))}</div></div>`).join('');
        const more=group.length>4?`<div class="map-more">Ещё турниров: ${group.length-4}</div>`:'';
        L.marker(p).addTo(map).bindPopup(`<div class="map-popup"><strong>${esc(club.name)}</strong><div class="map-club">${esc(club.address)}</div>${shown}${more}</div>`,{maxWidth:290});
        await wait(1050);
      }
      if(bounds.length) map.fitBounds(bounds,{padding:[35,35],maxZoom:13});
      setStatus(bounds.length?`Клубов на карте: ${bounds.length}`:'Не удалось определить адреса клубов');
      setTimeout(()=>!disposed&&setStatus(''),1800);
    } catch { if(!disposed)setStatus('Не удалось загрузить карту'); } })();
    return()=>{disposed=true;if(map)map.remove();};
  },[tournaments]);
  return <div className="tournament-map-wrap">{status&&<div className="map-status" role="status">{status}</div>}<div ref={el} className="tournament-map" aria-label="Карта отфильтрованных турниров" /></div>;
}
