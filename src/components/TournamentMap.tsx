import { useEffect, useRef, useState } from 'react';
import type { Tournament } from '../domain/tournament';
import { formatDate, formatTime } from '../utils/dates';

declare global { interface Window { L?: any } }

const LEAFLET_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const MOSCOW:[number,number]=[55.7558,37.6176];
const CACHE_PREFIX='tour-games-geo-v2:';

function loadLeaflet():Promise<any>{
  if(window.L)return Promise.resolve(window.L);
  if(!document.querySelector('link[data-leaflet]')){const l=document.createElement('link');l.rel='stylesheet';l.href=LEAFLET_CSS;l.dataset.leaflet='1';document.head.appendChild(l)}
  return new Promise((resolve,reject)=>{const old=document.querySelector<HTMLScriptElement>('script[data-leaflet]');
    if(old){if(window.L)return resolve(window.L);old.addEventListener('load',()=>resolve(window.L));old.addEventListener('error',reject);return}
    const s=document.createElement('script');s.src=LEAFLET_JS;s.dataset.leaflet='1';s.onload=()=>resolve(window.L);s.onerror=reject;document.head.appendChild(s)
  })
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function cleanAddress(value:string){
  return value.replace(/\([^)]*\)/g,' ').replace(/\b(вход|этаж|подъезд|корпус|ориентир|парковка)\b.*$/i,'').replace(/\s+/g,' ').replace(/\s*,\s*/g,', ').trim()
}
function inMoscow([lat,lon]:[number,number]){return lat>55.0&&lat<56.3&&lon>36.5&&lon<38.8}
function cached(key:string):[number,number]|null|undefined{
  try{const v=localStorage.getItem(CACHE_PREFIX+key);if(v===null)return undefined;return JSON.parse(v)}catch{return undefined}
}
function save(key:string,p:[number,number]|null){try{localStorage.setItem(CACHE_PREFIX+key,JSON.stringify(p))}catch{}}
async function photon(q:string,signal:AbortSignal):Promise<[number,number]|null>{
  try{const u='https://photon.komoot.io/api/?limit=5&lang=ru&lat=55.7558&lon=37.6176&q='+encodeURIComponent(q);
    const r=await fetch(u,{signal,headers:{Accept:'application/json'}});if(!r.ok)return null;const d=await r.json();
    for(const f of d.features||[]){const [lon,lat]=f.geometry?.coordinates||[];if(Number.isFinite(lat)&&Number.isFinite(lon)&&inMoscow([lat,lon]))return [lat,lon]}
  }catch{} return null
}
async function nominatim(q:string,signal:AbortSignal):Promise<[number,number]|null>{
  try{const u='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=ru&accept-language=ru&q='+encodeURIComponent(q);
    const r=await fetch(u,{signal,headers:{Accept:'application/json'}});if(!r.ok)return null;const d=await r.json();
    for(const x of d||[]){const p:[number,number]=[Number(x.lat),Number(x.lon)];if(Number.isFinite(p[0])&&Number.isFinite(p[1])&&inMoscow(p))return p}
  }catch{} return null
}
async function locate(club:Tournament['club'],signal:AbortSignal):Promise<[number,number]|null>{
  const key=club.id||club.address||club.name;const hit=cached(key);if(hit!==undefined)return hit;
  const address=cleanAddress(club.address||'');
  const queries=[
    address&&`${address}, Москва`,
    club.name&&`${club.name}, Москва`,
    address&&club.name&&`${club.name}, ${address}, Москва`
  ].filter((x,i,a):x is string=>Boolean(x)&&a.indexOf(x)===i);
  for(const q of queries){const p=await photon(q,signal);if(p){save(key,p);return p}}
  for(const q of queries){const p=await nominatim(q,signal);if(p){save(key,p);return p}}
  save(key,null);return null
}
function popup(group:Tournament[]){
  const c=group[0].club;
  const rows=group.slice(0,4).map(t=>`<div class="map-tournament"><div class="map-title">${esc(t.title)}</div><div class="map-meta">${esc(formatDate(t.startAt))} · ${esc(formatTime(t.startAt))}</div></div>`).join('');
  return `<div class="map-popup"><strong>${esc(c.name)}</strong><div class="map-club">${esc(c.address||'Адрес уточняется')}</div>${rows}${group.length>4?`<div class="map-more">Ещё турниров: ${group.length-4}</div>`:''}</div>`
}

export function TournamentMap({tournaments}:{tournaments:Tournament[]}){
  const el=useRef<HTMLDivElement>(null);const [status,setStatus]=useState('Готовим карту клубов…');
  useEffect(()=>{const controller=new AbortController();let disposed=false;let map:any;
    (async()=>{try{
      const L=await loadLeaflet();if(disposed||!el.current)return;
      map=L.map(el.current,{scrollWheelZoom:false}).setView(MOSCOW,10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
      const groups=new Map<string,Tournament[]>();tournaments.forEach(t=>{const k=t.club.id||t.club.address||t.club.name;groups.set(k,[...(groups.get(k)||[]),t])});
      const entries=[...groups.values()];const bounds:[number,number][]=[];let done=0,missed=0;let cursor=0;
      const worker=async()=>{while(cursor<entries.length&&!disposed){const group=entries[cursor++];const p=await locate(group[0].club,controller.signal);done++;
        if(p){bounds.push(p);L.marker(p).addTo(map).bindPopup(popup(group),{maxWidth:290})}else missed++;
        if(!disposed)setStatus(`Определяем клубы: ${done}/${entries.length}`);
      }};
      await Promise.all(Array.from({length:Math.min(3,entries.length)},worker));if(disposed)return;
      if(bounds.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:13});
      setStatus(bounds.length?`На карте: ${bounds.length}${missed?` · не найдено: ${missed}`:''}`:'Не удалось определить клубы. Попробуйте обновить карту позже.');
      setTimeout(()=>!disposed&&setStatus(''),3500);
    }catch{if(!disposed)setStatus('Не удалось загрузить карту')}})();
    return()=>{disposed=true;controller.abort();if(map)map.remove()}
  },[tournaments]);
  return <div className="tournament-map-wrap">{status&&<div className="map-status" role="status">{status}</div>}<div ref={el} className="tournament-map" aria-label="Карта отфильтрованных турниров"/></div>
}
