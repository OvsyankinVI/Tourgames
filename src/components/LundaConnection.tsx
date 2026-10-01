import { useState, type FormEvent } from 'react';
import type { LundaCredentials } from '../providers/DirectLundaTournamentProvider';

export function LundaConnection({ active, connected, onConnect, onDisconnect, onRefresh }: {
  active: boolean;
  connected: boolean;
  onConnect: (credentials: LundaCredentials) => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}) {
  const [invalid, setInvalid] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const token = String(data.get('token') || '').trim();
    const profileId = String(data.get('profile') || '').trim();
    if (!/^[A-Za-z0-9._~-]+$/.test(token) || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(profileId)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    form.reset();
    onConnect({ token, profileId });
  }
  return <section className="lunda-connection" aria-label="Прямое подключение LUNDA">
    {active ? <div className="connection-active"><div><strong>{connected ? 'Подключено к LUNDA напрямую' : 'Прямое подключение LUNDA'}</strong><p>Токен хранится только в памяти этой вкладки.</p></div><div className="connection-actions"><button type="button" className="secondary-button" onClick={onRefresh}>Обновить</button><button type="button" className="text-button" onClick={onDisconnect}>Отключить и забыть токен</button></div></div> : <details>
      <summary>Подключить реальные турниры LUNDA</summary>
      <p className="connection-hint">Введите значения из вашего запроса LUNDA. Они отправляются только в LUNDA и не сохраняются после перезагрузки. Город берётся из профиля — для этого каталога выберите Москву в LUNDA.</p>
      <form onSubmit={submit} autoComplete="off">
        <div className="field-pair"><label className="field"><span>X-Auth-Token</span><input name="token" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required aria-describedby="connection-error" /></label><label className="field"><span>X-Profile-Id</span><input name="profile" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} required aria-describedby="connection-error" /></label></div>
        <p id="connection-error" className="field-error" role={invalid ? 'alert' : undefined}>{invalid ? 'Введите только значение токена и UUID профиля, без названий заголовков.' : ''}</p>
        <button type="submit" className="primary-button">Загрузить из LUNDA</button>
      </form>
    </details>}
  </section>;
}
