import { InjectionToken } from '@angular/core';

export const WEBRTC_ICE_SERVERS = new InjectionToken<RTCIceServer[]>('WEBRTC_ICE_SERVERS');
