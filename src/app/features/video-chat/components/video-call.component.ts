import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalingService } from '../../../core/services/signaling.service';
import { ScreenshotService } from '../../../core/services/screenshot.service';

@Component({
  selector: 'app-video-chat',
  standalone: true,
  imports: [CommonModule],
  providers: [SignalingService],
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.scss'] // Corrected property name to plural `styleUrls`
})
export class VideoChatComponent implements OnInit, OnDestroy {
  private localStream!: MediaStream;
  private remoteStream!: MediaStream;
  private peerConnection!: RTCPeerConnection;
  private peerConfiguration: any = {}; // ICE server configuration will be assigned later

  isCallStarted = false;
  // Optionally track reconnection attempts (and set a limit)
  private reconnectionAttempts = 0;
  private maxReconnectionAttempts = 5;

  constructor(
    private signalingService: SignalingService,
    private screenshotService: ScreenshotService
  ) {
    // Fetch TURN/ICE server credentials and store them in the configuration.
    (async () => {
      try {
        const response = await fetch("https://videochatang.metered.live/api/v1/turn/credentials?apiKey=7c2d35b756dd1ef5d1a447a2d6def2feec7f");
        const iceServers = await response.json();
        this.peerConfiguration.iceServers = iceServers;
        // Note: We do not create a peer connection here. That is handled in initializeConnection().
      } catch (error) {
        console.error('Error fetching TURN credentials:', error);
      }
    })();
  }

  // Utility to capture the screen
  captureScreen() {
    this.screenshotService.takeScreenshot();
  }

  get localStreamAvailable() {
    return !!this.localStream;
  }

  get remoteStreamAvailable() {
    return !!this.remoteStream;
  }

  async ngOnInit() {
    await this.initializeMedia();
    await this.initializeConnection();
  }

  ngOnDestroy() {
    this.signalingService.removeListeners();
    this.teardownConnection();
  }

  /**
   * Initializes the local media stream.
   */
  async initializeMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  }

  /**
   * Creates and configures a new RTCPeerConnection.
   */
  async initializeConnection() {
    // Reset the remote stream and attach it to the remote video element.
    this.remoteStream = new MediaStream();
    const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
    if (remoteVideo) {
      remoteVideo.srcObject = this.remoteStream;
    }

    // Create a new peer connection using the configuration (which includes ICE servers).
    this.peerConnection = new RTCPeerConnection(this.peerConfiguration);

    // Set up ICE candidate handling.
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        this.signalingService.sendIceCandidate(event.candidate);
      } else {
        console.log('All ICE candidates have been sent');
      }
    };

    // Monitor ICE connection state for disconnections.
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
      if (
        this.peerConnection.iceConnectionState === 'disconnected' ||
        this.peerConnection.iceConnectionState === 'failed'
      ) {
        console.warn('ICE connection lost, attempting to reconnect...');
        this.handleReconnection();
      }
    };

    // Monitor overall connection state.
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Peer connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'failed') {
        console.error('Peer connection failed, attempting to reconnect...');
        this.handleReconnection();
      }
    };

    // Handle incoming remote tracks.
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track);
      // Add tracks to the remote stream.
      this.remoteStream.addTrack(event.track);
    };

    // Add all tracks from the local media stream.
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Attach signaling event handlers.
    this.handleSignalingEvents();

    // Reset reconnection attempts on successful connection initialization.
    this.reconnectionAttempts = 0;
  }

  /**
   * Sets up event listeners for signaling (offer, answer, and ICE candidates).
   */
  handleSignalingEvents() {
    // Remove any existing listeners to avoid duplicate handling.
    this.signalingService.removeListeners();

    this.signalingService.onOffer(async (offer) => {
      console.log('Received offer:', offer);
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.signalingService.sendAnswer(answer);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    this.signalingService.onAnswer(async (answer) => {
      console.log('Received answer:', answer);
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    this.signalingService.onIceCandidate((candidate) => {
      console.log('Received ICE candidate:', candidate);
      // Only add ICE candidates if the remote description has been set.
      if (this.peerConnection.remoteDescription) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          .then(() => {
            console.log('ICE candidate added successfully');
          })
          .catch((error) => {
            console.error('Error adding ICE candidate:', error);
          });
      }
    });
  }

  /**
   * Initiates the call by creating and sending an offer.
   */
  async startCall() {
    if (this.isCallStarted) return;
    this.isCallStarted = true;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.signalingService.sendOffer(offer);
    } catch (error) {
      console.error('Error starting call:', error);
      this.handleReconnection();
    }
  }

  /**
   * Tears down the current peer connection and stops media tracks.
   */
  private teardownConnection() {
    console.log('Tearing down connection.');
    // Stop local media tracks.
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    // Remove event handlers and close the peer connection.
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.close();
    }
  }

  /**
   * Handles reconnection logic by tearing down the current connection,
   * waiting briefly, and then reinitializing the connection and restarting the call.
   */
  private async handleReconnection() {
    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.error('Maximum reconnection attempts reached.');
      return;
    }

    this.reconnectionAttempts++;
    this.isCallStarted = false;
    this.teardownConnection();

    // Wait a few seconds before attempting to reconnect.
    setTimeout(async () => {
      console.log(`Reconnection attempt ${this.reconnectionAttempts}...`);
      try {
        await this.initializeConnection();
        await this.startCall();
      } catch (error) {
        console.error('Error during reconnection attempt:', error);
        // Optionally, try to reconnect again.
        this.handleReconnection();
      }
    }, 3000); // 3-second delay before reconnection attempt.
  }
}
