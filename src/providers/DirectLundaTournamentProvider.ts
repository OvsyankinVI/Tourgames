import { LundaTournamentProvider } from './LundaTournamentProvider';

export interface LundaCredentials { token: string; profileId: string }
export const LUNDA_ENDPOINT = 'https://appcloud.lundapadel.ru/api/tourgame/load-list';

/** Credentials live in the current tab only and are sent to this fixed LUNDA URL. */
export class DirectLundaTournamentProvider extends LundaTournamentProvider {
  constructor(credentials: LundaCredentials, request: typeof fetch = fetch) {
    super(LUNDA_ENDPOINT, (_url, init) => {
      const body = JSON.parse(init!.body as string);
      return request(LUNDA_ENDPOINT, {
        ...init,
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Accept: 'application/json', 'Content-Type': 'application/json',
          'X-Auth-Token': credentials.token,
          'X-Profile-Id': credentials.profileId,
          'X-App-Version': '38.0.5',
          'X-Current-App-Page': 'capacitor://localhost/play',
          'Accept-Language': 'ru',
        },
        // City follows the supplied profile. All other filtering stays in the UI.
        body: JSON.stringify({ parameters: { ...body.parameters, inMyCity: true } }),
      });
    });
  }
}
