import 'zone.js/node';
import { ApplicationRef, enableProdMode } from '@angular/core';
import {bootstrapApplication, BootstrapContext} from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import AppComponent from './app/app.component';
import { config } from './app/app.config.server';
import { SSR_COOKIE } from './app/tokens/ssr-cookie.token';

if (import.meta.env.PROD) {
  enableProdMode();
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

  return await renderApplication(
    (context: BootstrapContext): Promise<ApplicationRef> => bootstrap(context) ,
    {
      document,
      url,
      platformProviders: [
        { provide: SSR_COOKIE, useValue: cookie },
      ],
    }
  );
}
