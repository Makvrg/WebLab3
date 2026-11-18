import {
  Injectable,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import {
  CsvProgressEvent,
  StudentRealtimeEvent,
  WebRtcConnectionStatus,
} from '../entity/RealtimeEvents';
import { RT_URL } from './api.constants';

interface SignalWelcomeMessage {
  type: 'welcome';
  peerId: string;
  role: string;
}

interface SignalAnswerMessage {
  type: 'answer';
  sdp: string;
}

interface SignalCandidateMessage {
  type: 'candidate';
  candidate: RTCIceCandidateInit;
}

interface SignalErrorMessage {
  type: 'error';
  code?: string;
  message: string;
}

type InboundSignalMessage =
  | SignalWelcomeMessage
  | SignalAnswerMessage
  | SignalCandidateMessage
  | SignalErrorMessage;

interface ChannelPongMessage {
  type: 'PONG';
  ts: number;
}

type InboundChannelMessage = StudentRealtimeEvent | CsvProgressEvent | ChannelPongMessage;

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const HEARTBEAT_INTERVAL_MS = 20_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class WebRtcService implements OnDestroy {
  private readonly platformId: Object = inject(PLATFORM_ID);
  private readonly ngZone: NgZone = inject(NgZone);
  private readonly isBrowser: boolean = isPlatformBrowser(this.platformId);

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

  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;

  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet: boolean = false;

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

    const wsActive: boolean =
      this.ws !== null &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING);
    const dcOpen: boolean =
      this.dataChannel !== null && this.dataChannel.readyState === 'open';

    if (wsActive || dcOpen) {
      return;
    }

    this.clearReconnectTimer();
    this.openSignalingSocket();
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    this.reconnectAttempts = 0;
    this.connectionGeneration++;

    this.clearReconnectTimer();
    this.clearHeartbeatTimer();
    this.cleanupPeerResources();
    this.cleanupSocket();

    this.updateStatus('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
    this._studentEvents$.complete();
    this._csvProgress$.complete();
  }

  private openSignalingSocket(): void {
    this.cleanupPeerResources();
    this.cleanupSocket();

    const generation: number = ++this.connectionGeneration;
    this.updateStatus('connecting');

    const protocol: string = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const signalUrl: string = `${protocol}//${window.location.host}${RT_URL}/signal`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(signalUrl);
    } catch {
      this.handleConnectionFailure(generation);
      return;
    }

    this.ws = socket;

    socket.onmessage = (event: MessageEvent): void => {
      if (generation !== this.connectionGeneration || this.ws !== socket) {
        return;
      }

      if (typeof event.data !== 'string') {
        return;
      }

      let message: InboundSignalMessage;
      try {
        message = JSON.parse(event.data) as InboundSignalMessage;
      } catch {
        return;
      }

      void this.handleSignalMessage(generation, message);
    };

    socket.onerror = (): void => {
      if (generation !== this.connectionGeneration || this.ws !== socket) {
        return;
      }
      if (this.dataChannel?.readyState !== 'open') {
        this.handleConnectionFailure(generation);
      }
    };

    socket.onclose = (): void => {
      if (generation !== this.connectionGeneration) {
        return;
      }
      if (this.ws === socket) {
        this.ws = null;
      }
      if (this.dataChannel?.readyState !== 'open') {
        this.handleConnectionFailure(generation);
      }
    };
  }

  private async handleSignalMessage(
    generation: number,
    message: InboundSignalMessage
  ): Promise<void> {
    if (!message || typeof message !== 'object') {
      return;
    }

    switch (message.type) {
      case 'welcome': {
        await this.startPeerNegotiation(generation);
        break;
      }

      case 'answer': {
        if (!this.pc || !message.sdp) {
          return;
        }
        try {
          await this.pc.setRemoteDescription({
            type: 'answer',
            sdp: message.sdp,
          });
          if (generation !== this.connectionGeneration || !this.pc) {
            return;
          }
          this.remoteDescriptionSet = true;
          await this.flushPendingCandidates(generation);
        } catch {
          this.handleConnectionFailure(generation);
        }
        break;
      }

      case 'candidate': {
        if (!message.candidate) {
          return;
        }
        if (!this.pc || !this.remoteDescriptionSet) {
          this.pendingRemoteCandidates.push(message.candidate);
          return;
        }
        await this.safeAddIceCandidate(message.candidate);
        break;
      }

      case 'error': {
        console.warn('[WebRTC Signaling] Ошибка от сервера:', message.message);
        break;
      }

      default:
        break;
    }
  }

  private async startPeerNegotiation(generation: number): Promise<void> {
    this.cleanupPeerResources();

    const peerConnection = new RTCPeerConnection({
      iceServers: DEFAULT_ICE_SERVERS,
    });
    this.pc = peerConnection;

    const channel = peerConnection.createDataChannel('student-events', {
      ordered: true,
    });
    this.dataChannel = channel;

    peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent): void => {
      if (generation !== this.connectionGeneration || this.pc !== peerConnection) {
        return;
      }
      if (event.candidate && event.candidate.candidate) {
        this.sendSignal({
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

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

      const offerSdp: string | undefined =
        peerConnection.localDescription?.sdp ?? offer.sdp;
      if (!offerSdp) {
        this.handleConnectionFailure(generation);
        return;
      }

      this.sendSignal({
        type: 'offer',
        sdp: offerSdp,
      });
    } catch {
      this.handleConnectionFailure(generation);
    }

  }

  private async flushPendingCandidates(generation: number): Promise<void> {
    if (this.pendingRemoteCandidates.length === 0) {
      return;
    }

    const queued: RTCIceCandidateInit[] = this.pendingRemoteCandidates.splice(
      0,
      this.pendingRemoteCandidates.length
    );

    for (const candidate of queued) {
      if (generation !== this.connectionGeneration || !this.pc) {
        return;
      }
      await this.safeAddIceCandidate(candidate);
    }
  }

  private async safeAddIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) {
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      console.warn('[WebRTC] Ошибка добавления ICE-кандидата:', err);
    }
  }

  private sendSignal(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
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
    this.cleanupSocket();

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
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyDisconnected) {
        this.openSignalingSocket();
      }
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
        // Игнорируем ошибки при закрытии канала
      }
    }

    if (this.pc) {
      const peerConn = this.pc;
      this.pc = null;
      try {
        peerConn.onicecandidate = null;
        peerConn.onconnectionstatechange = null;
        peerConn.close();
      } catch {
        // Игнорируем ошибки при закрытии соединения
      }
    }

    this.pendingRemoteCandidates = [];
    this.remoteDescriptionSet = false;
  }

  private cleanupSocket(): void {
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      } catch {
        // Игнорируем ошибки при закрытии сокета
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
