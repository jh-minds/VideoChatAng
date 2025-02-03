import { Component, ElementRef, ViewChild } from '@angular/core';
import { SignalingService } from '../../../core/services/signaling.service';

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.css'],
  standalone: true
})
export class VideoCallComponent {

  @ViewChild('localVideo') localVideoRef!: ElementRef;
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef;
  private localStream!: MediaStream;
  private peerConnection!: RTCPeerConnection;
  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:your.turn.server' } // Optional: You can set up a TURN server here
    ]
  };

  constructor(private signalingService: SignalingService) {
    this.signalingService.onOffer((offer: any) => this.handleOffer(offer));
    this.signalingService.onAnswer((answer: any) => this.handleAnswer(answer));
    this.signalingService.onIceCandidate((candidate: RTCIceCandidate) => this.handleIceCandidate(candidate));
  }

  async ngOnInit() {
    await this.initLocalStream();
  }

  async initLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this.localVideoRef.nativeElement.srcObject = this.localStream;
    } catch (err) {
      console.error('Error accessing media devices.', err);
    }
  }

  startCall() {
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    this.localStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localStream));

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingService.sendIceCandidate(event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteVideoRef.nativeElement.srcObject = event.streams[0];
    };

    this.peerConnection.createOffer().then(offer => {
      return this.peerConnection.setLocalDescription(offer);
    }).then(() => {
      this.signalingService.sendOffer(this.peerConnection.localDescription);
    }).catch(error => console.error(error));
  }

  handleOffer(offer: RTCSessionDescriptionInit) {
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    this.localStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localStream));

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingService.sendIceCandidate(event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteVideoRef.nativeElement.srcObject = event.streams[0];
    };

    this.peerConnection.createAnswer().then(answer => {
      return this.peerConnection.setLocalDescription(answer);
    }).then(() => {
      this.signalingService.sendAnswer(this.peerConnection.localDescription);
    }).catch(error => console.error(error));
  }

  handleAnswer(answer: RTCSessionDescriptionInit) {
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer)).catch(error => console.error(error));
  }

  handleIceCandidate(candidate: RTCIceCandidate) {
    this.peerConnection.addIceCandidate(candidate).catch(error => console.error(error));
  }
}
