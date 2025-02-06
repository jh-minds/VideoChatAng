import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalingService } from '../../../core/services/signaling.service';

@Component({
  selector: 'app-video-chat',
  standalone: true,
  imports: [CommonModule],
  providers: [SignalingService],
  templateUrl: './video-call.component.html',
  styleUrl: './video-call.component.scss'
})
export class VideoChatComponent implements OnInit, OnDestroy {
  private localStream!: MediaStream;
  private remoteStream!: MediaStream;
  private peerConnection!: RTCPeerConnection;
  private peerConfiguration: any = {};

  constructor(private signalingService: SignalingService) {
    (async () => {
      const response = await fetch("https://videochatang.metered.live/api/v1/turn/credentials?apiKey=073daca3d45f4999c8d19945086e8b279ce9");
      const iceServers = await response.json();
      this.peerConfiguration.iceServers = iceServers;
      this.peerConnection = new RTCPeerConnection(this.peerConfiguration);
    })();
  }
  get localStreamAvailable() {
    return this.localStream !== undefined;
  }

  get remoteStreamAvailable() {
    return this.remoteStream !== undefined;
  }

  async ngOnInit() {
    await this.initializeMedia();
    this.setupPeerConnection();
    this.handleSignalingEvents();
  }

  ngOnDestroy() {
    this.signalingService.removeListeners();
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
  }

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

  setupPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.peerConfiguration);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        this.signalingService.sendIceCandidate(event.candidate);
      }else {
        console.log('All ICE candidates have been sent');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed:', this.peerConnection.iceConnectionState);
      if (this.peerConnection.iceConnectionState === 'failed') {
        console.error('ICE connection failed');
      }
    };

    // Connection state change handler
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'failed') {
        console.error('Connection failed');
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
        const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = this.remoteStream;
        }
      }
      this.remoteStream.addTrack(event.track);
    };

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });
  }

  handleSignalingEvents() {
    this.signalingService.onOffer(async (offer) => {
      console.log('Received offer:', offer);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.signalingService.sendAnswer(answer);
    });

    this.signalingService.onAnswer(async (answer) => {
      console.log('Received answer:', answer);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.signalingService.onIceCandidate((candidate) => {
      console.log('Received ICE candidate:', candidate);
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

  async startCall() {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.signalingService.sendOffer(offer);
  }
}
