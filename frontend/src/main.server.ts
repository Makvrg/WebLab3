import 'zone.js/node';
import { ApplicationRef, enableProdMode } from '@angular/core';
import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import AppComponent from './app/app.component';
import { config } from './app/app.config.server';
import { SSR_COOKIE } from './app/tokens/ssr-cookie.token';
import { WEBRTC_ICE_SERVERS } from './app/tokens/webrtc-ice-servers.token';

if (import.meta.env.PROD) {
  enableProdMode();
}

const DEFAULT_WEBRTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

function parseWebRtcIceServers(raw: string | undefined): RTCIceServer[] {
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_WEBRTC_ICE_SERVERS;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((item) => item && typeof item === 'object' && 'urls' in item)
    ) {
      return parsed as RTCIceServer[];
    }
  } catch {
  }

  return DEFAULT_WEBRTC_ICE_SERVERS;
}

export function bootstrap(context?: any): Promise<ApplicationRef> {
  return bootstrapApplication(AppComponent, config, context);
}

export default async function render(
  url: string,
  document: string,
  serverContext?: any
): Promise<string> {
  const cookie =
    serverContext?.req?.headers?.cookie ||
    serverContext?.event?.node?.req?.headers?.cookie ||
    '';
  const iceServers = parseWebRtcIceServers(process.env['WEBRTC_ICE_SERVERS']);

  return await renderApplication(
    (context: BootstrapContext): Promise<ApplicationRef> => bootstrap(context),
    {
      document,
      url,
      platformProviders: [
        { provide: SSR_COOKIE, useValue: cookie },
        { provide: WEBRTC_ICE_SERVERS, useValue: iceServers },
      ],
    }
  );
}
