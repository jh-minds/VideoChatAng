import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalingService } from '../../../core/services/signaling.service';

@Component({
  selector: 'app-video-chat',
  standalone: true,
  imports: [CommonModule],
  providers: [SignalingService],
  templateUrl: './video-call.component.html',
  styleUrl: './video-call.component.css'
})
export class VideoChatComponent implements OnInit, OnDestroy {
  private localStream!: MediaStream;
  private remoteStream!: MediaStream;
  private peerConnection: RTCPeerConnection;
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:relay1.expressturn.com:3478',
        username: 'efbbbc2c',
        credential: '8D1@abcXYZ'
      }
    ]
  };

  constructor(private signalingService: SignalingService) {
    this.peerConnection = new RTCPeerConnection(this.configuration);
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
    this.peerConnection = new RTCPeerConnection(this.configuration);

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
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
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
