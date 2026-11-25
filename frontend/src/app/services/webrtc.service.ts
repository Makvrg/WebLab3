import {
  Injectable,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  TransferState,
  WritableSignal,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import {
  CsvProgressEvent,
  StudentRealtimeEvent,
  WebRtcConnectionStatus,
} from '../entity/RealtimeEvents';
import { RTC_SESSION_URL } from './api.constants';
import { WEBRTC_ICE_SERVERS } from '../tokens/webrtc-ice-servers.token';

interface RtcSessionAnswer {
  peerId?: string;
  type: RTCSdpType;
  sdp: string;
}

interface ChannelPongMessage {
  type: 'PONG';
  ts: number;
}

type InboundChannelMessage = StudentRealtimeEvent | CsvProgressEvent | ChannelPongMessage;

const WEBRTC_ICE_SERVERS_STATE_KEY = makeStateKey<RTCIceServer[]>('WEBRTC_ICE_SERVERS');
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];
const DATA_CHANNEL_LABEL = 'student-events';

const ICE_GATHERING_TIMEOUT_MS = 2_500;
const HEARTBEAT_INTERVAL_MS = 20_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 15_000;
const RECONNECT_BACKOFF_BASE = 2;

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

@Injectable({ providedIn: 'root' })
export class WebRtcService implements OnDestroy {
  private readonly platformId: Object = inject(PLATFORM_ID);
  private readonly ngZone: NgZone = inject(NgZone);
  private readonly http: HttpClient = inject(HttpClient);
  private readonly transferState: TransferState = inject(TransferState);
  private readonly ssrIceServers: RTCIceServer[] | null = inject(WEBRTC_ICE_SERVERS, {
    optional: true,
  });
  private readonly isBrowser: boolean = isPlatformBrowser(this.platformId);
  private readonly iceServers: RTCIceServer[] = this.resolveIceServers();

  private readonly _status: WritableSignal<WebRtcConnectionStatus> =
    signal<WebRtcConnectionStatus>('disconnected');
  readonly status: Signal<WebRtcConnectionStatus> = this._status.asReadonly();

  private readonly _studentEvents$: Subject<StudentRealtimeEvent> =
    new Subject<StudentRealtimeEvent>();
  readonly studentEvents$: Observable<StudentRealtimeEvent> =
    this._studentEvents$.asObservable();

  private readonly _csvProgress$: Subject<CsvProgressEvent> =
    new Subject<CsvProgressEvent>();
  readonly csvProgress$: Observable<CsvProgressEvent> =
    this._csvProgress$.asObservable();

  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;

  private manuallyDisconnected: boolean = true;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectionGeneration: number = 0;

  connect(): void {
    if (!this.isBrowser) {
      return;
    }

    this.manuallyDisconnected = false;

    const dcState = this.dataChannel?.readyState;
    const pcState = this.pc?.connectionState;
    if (
      dcState === 'open' ||
      (this.pc !== null &&
        pcState !== 'failed' &&
        pcState !== 'closed' &&
        dcState !== 'closed')
    ) {
      return;
    }

    this.clearReconnectTimer();
    void this.establishConnection();
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    this.reconnectAttempts = 0;
    this.connectionGeneration++;

    this.clearReconnectTimer();
    this.clearHeartbeatTimer();
    this.cleanupPeerResources();

    this.updateStatus('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
    this._studentEvents$.complete();
    this._csvProgress$.complete();
  }

  private resolveIceServers(): RTCIceServer[] {
    if (!this.isBrowser) {
      const servers =
        this.ssrIceServers && this.ssrIceServers.length > 0
          ? this.ssrIceServers
          : DEFAULT_ICE_SERVERS;
      this.transferState.set(WEBRTC_ICE_SERVERS_STATE_KEY, servers);
      return servers;
    }

    if (this.transferState.hasKey(WEBRTC_ICE_SERVERS_STATE_KEY)) {
      const cached = this.transferState.get(WEBRTC_ICE_SERVERS_STATE_KEY, null);
      this.transferState.remove(WEBRTC_ICE_SERVERS_STATE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    }

    return DEFAULT_ICE_SERVERS;
  }

  private async establishConnection(): Promise<void> {
    if (this.manuallyDisconnected) {
      return;
    }

    this.cleanupPeerResources();

    const generation: number = ++this.connectionGeneration;
    this.updateStatus('connecting');

    const peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });
    this.pc = peerConnection;

    const channel = peerConnection.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    this.dataChannel = channel;

    peerConnection.onconnectionstatechange = (): void => {
      if (generation !== this.connectionGeneration || this.pc !== peerConnection) {
        return;
      }
      const state: RTCPeerConnectionState = peerConnection.connectionState;
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.handleConnectionFailure(generation);
      }
    };

    channel.onopen = (): void => {
      if (generation !== this.connectionGeneration || this.dataChannel !== channel) {
        return;
      }
      this.reconnectAttempts = 0;
      this.updateStatus('connected');
      this.startHeartbeat(generation, channel);
    };

    channel.onmessage = (event: MessageEvent): void => {
      if (generation !== this.connectionGeneration || this.dataChannel !== channel) {
        return;
      }
      if (typeof event.data !== 'string') {
        return;
      }

      let parsed: InboundChannelMessage;
      try {
        parsed = JSON.parse(event.data) as InboundChannelMessage;
      } catch {
        return;
      }

      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      if (parsed.type === 'PONG') {
        return;
      }

      if (parsed.type === 'STUDENT_EVENT') {
        this.ngZone.run(() => {
          this._studentEvents$.next(parsed);
        });
        return;
      }

      if (parsed.type === 'CSV_PROGRESS') {
        this.ngZone.run(() => {
          this._csvProgress$.next(parsed);
        });
      }
    };

    channel.onerror = (): void => {
      if (generation !== this.connectionGeneration || this.dataChannel !== channel) {
        return;
      }
      this.handleConnectionFailure(generation);
    };

    channel.onclose = (): void => {
      if (generation !== this.connectionGeneration || this.dataChannel !== channel) {
        return;
      }
      this.handleConnectionFailure(generation);
    };

    try {
      const offer: RTCSessionDescriptionInit = await peerConnection.createOffer();
      if (generation !== this.connectionGeneration || this.pc !== peerConnection) {
        return;
      }

      await peerConnection.setLocalDescription(offer);
      if (generation !== this.connectionGeneration || this.pc !== peerConnection) {
        return;
      }

      await this.waitForIceGatheringComplete(peerConnection, ICE_GATHERING_TIMEOUT_MS);
      if (generation !== this.connectionGeneration || this.pc !== peerConnection) {
        return;
      }

      const offerSdp: string | undefined =
        peerConnection.localDescription?.sdp ?? offer.sdp;
      if (!offerSdp) {
        this.handleConnectionFailure(generation);
        return;
      }

      const response = await firstValueFrom(
        this.http.post<RtcSessionAnswer>(RTC_SESSION_URL, {
          type: 'offer',
          sdp: offerSdp,
        })
      );

      if (generation !== this.connectionGeneration || this.pc !== peerConnection) {
        return;
      }

      if (!response?.sdp) {
        this.handleConnectionFailure(generation);
        return;
      }

      await peerConnection.setRemoteDescription({
        type: response.type || 'answer',
        sdp: response.sdp,
      });
    } catch (err: unknown) {
      if (
        err instanceof HttpErrorResponse &&
        (err.status === HTTP_UNAUTHORIZED || err.status === HTTP_FORBIDDEN)
      ) {
        this.disconnect();
        return;
      }
      this.handleConnectionFailure(generation);
    }
  }

  private waitForIceGatheringComplete(
    pc: RTCPeerConnection,
    timeoutMs: number = ICE_GATHERING_TIMEOUT_MS
  ): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;

      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        pc.removeEventListener('icecandidate', onIceCandidate);
        resolve();
      };

      const onStateChange = (): void => {
        if (pc.iceGatheringState === 'complete') {
          finish();
        }
      };

      const onIceCandidate = (event: RTCPeerConnectionIceEvent): void => {
        if (!event.candidate) {
          finish();
        }
      };

      const timer = setTimeout(finish, timeoutMs);
      pc.addEventListener('icegatheringstatechange', onStateChange);
      pc.addEventListener('icecandidate', onIceCandidate);
    });
  }

  private startHeartbeat(generation: number, channel: RTCDataChannel): void {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = setInterval(() => {
      if (
        generation !== this.connectionGeneration ||
        this.dataChannel !== channel ||
        channel.readyState !== 'open'
      ) {
        this.clearHeartbeatTimer();
        return;
      }

      try {
        channel.send(JSON.stringify({ type: 'PING', ts: Date.now() }));
      } catch {
        this.handleConnectionFailure(generation);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private handleConnectionFailure(generation: number): void {
    if (generation !== this.connectionGeneration) {
      return;
    }

    this.connectionGeneration++;
    this.clearHeartbeatTimer();
    this.cleanupPeerResources();

    if (this.manuallyDisconnected) {
      this.updateStatus('disconnected');
      return;
    }

    this.updateStatus('connecting');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.manuallyDisconnected || this.reconnectTimer !== null) {
      return;
    }

    const delay: number = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(RECONNECT_BACKOFF_BASE, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.establishConnection();
    }, delay);
  }

  private cleanupPeerResources(): void {
    if (this.dataChannel) {
      const dc = this.dataChannel;
      this.dataChannel = null;
      try {
        dc.onopen = null;
        dc.onmessage = null;
        dc.onerror = null;
        dc.onclose = null;
        if (dc.readyState !== 'closed') {
          dc.close();
        }
      } catch {
      }
    }

    if (this.pc) {
      const peerConn = this.pc;
      this.pc = null;
      try {
        peerConn.onconnectionstatechange = null;
        peerConn.close();
      } catch {
      }
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private updateStatus(nextStatus: WebRtcConnectionStatus): void {
    if (this._status() === nextStatus) {
      return;
    }
    this.ngZone.run(() => {
      this._status.set(nextStatus);
    });
  }
}
