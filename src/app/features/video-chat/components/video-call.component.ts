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
        const response = await fetch("https://videochatang.metered.live/api/v1/turn/credentials?apiKey=933caf0a2c578d0ad0b4dcc03360aa1f45b9");
        const iceServers = await response.json();
        this.peerConfiguration.iceServers = iceServers;
      } catch (error) {
        console.error('Error fetching TURN credentials:', error);
      }
    })();
  }

  // Utility to capture the screen
  captureScreen() {
    this.screenshotService.takeScreenshot();
  }

  async ngOnInit() {
    await this.initializeMedia();
    await this.initializeConnection();
    await this.startCall();
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
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
    console.log("Initializing new connection...");

    // Ensure local media is available before setting up the connection
    if (!this.localStream) {
        console.warn("Local stream not available, attempting to initialize...");
        await this.initializeMedia();
    }

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
        this.remoteStream.addTrack(event.track);
    };

    // Ensure local stream tracks are added again after reconnection
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
    }

    // **Reattach local video stream** to prevent it from turning black
    const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
    if (localVideo) {
        console.log("Reattaching local video stream...");
        localVideo.srcObject = this.localStream;
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
  const offer = await this.peerConnection.createOffer();
  await this.peerConnection.setLocalDescription(offer);
  this.signalingService.sendOffer(offer);

  // REATTACH LOCAL STREAM TO VIDEO ELEMENT
  const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
  if (localVideo && !localVideo.srcObject) {
    console.log("Ensuring local video is visible...");
    localVideo.srcObject = this.localStream;
  }
}


  /**
   * Tears down the current peer connection and stops media tracks.
   */
  private teardownConnection() {
    console.log('Tearing down connection.');
    // Stop local media tracks.
    // if (this.localStream) {
    //   this.localStream.getTracks().forEach(track => track.stop());
    // }
    // Remove event handlers and close the peer connection.
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null!;
    }

    this.remoteStream = null!;
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
