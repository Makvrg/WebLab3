import 'zone.js/node';
import {ApplicationRef, enableProdMode} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import AppComponent from './app/app.component';
import { config } from './app/app.config.server';

if (import.meta.env.PROD) {
  enableProdMode();
}

export function bootstrap(context?: any): Promise<ApplicationRef> {
  return bootstrapApplication(AppComponent, config, context);
}

export default async function render(url: string, document: string): Promise<string> {
  return await renderApplication(
      (context) => bootstrap(context),
      {
        document,
        url,
      }
  );
}
