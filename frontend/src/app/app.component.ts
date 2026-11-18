import { Component, PLATFORM_ID, effect, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { RealtimeToastComponent } from './components/realtime-toast/realtime-toast.component';
import { UserContextService } from './user-context/user-context.service';
import { WebRtcService } from './services/webrtc.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, RealtimeToastComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export default class AppComponent {
  title: string = 'frontend';

  private readonly platformId: Object = inject(PLATFORM_ID);
  private readonly userContextService: UserContextService = inject(UserContextService);
  private readonly webRtcService: WebRtcService = inject(WebRtcService);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        if (this.userContextService.isAuthenticated()) {
          this.webRtcService.connect();
        } else {
          this.webRtcService.disconnect();
        }
      });
    }
  }
}
