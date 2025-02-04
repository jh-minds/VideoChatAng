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
  private peerConnection!: RTCPeerConnection;
  private remoteStream!: MediaStream;
  private configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Public STUN server
  };

  constructor(private signalingService: SignalingService) {}

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
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
        this.signalingService.sendIceCandidate(event.candidate);
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
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.signalingService.sendAnswer(answer);
    });

    this.signalingService.onAnswer(async (answer) => {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.signalingService.onIceCandidate((candidate) => {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
  }

  async startCall() {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.signalingService.sendOffer(offer);
  }
}
