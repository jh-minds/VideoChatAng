import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VideoChatComponent } from './features/video-chat/components/video-call.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VideoChatComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  standalone: true

})
export class AppComponent {
  title = 'VideoChatAng';
}
