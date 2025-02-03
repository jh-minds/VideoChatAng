import { Component, OnInit } from '@angular/core';
import { io } from 'socket.io-client';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class VideoChatComponent implements OnInit {
  private socket: any;
  private localStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;
  isInCall = false;
  private isConnected = false;
  private userQueue: string[] = [];

  constructor() { }

  ngOnInit() {
    // Connect to the signaling server
    this.socket = io('https://signaling-server-i9zw.onrender.com', {
      withCredentials: true
    });

    this.socket.on('offer', (offer: any) => this.handleOffer(offer));
    this.socket.on('answer', (answer: any) => this.handleAnswer(answer));
    this.socket.on('ice-candidate', (candidate: RTCIceCandidate) => this.handleIceCandidate(candidate));
    this.socket.on('user-joined', (userId: string) => this.matchUsers(userId));
  }

  ngOnDestroy() {
    this.socket.disconnect();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }

  async startMatchmaking() {
    // Add user to queue (Here you can handle random matching logic)
    if (!this.isConnected) {
      this.userQueue.push('user' + Math.random().toString(36).substring(7)); // Simulating user IDs
      this.socket.emit('queue', this.userQueue);
      console.log('Queueing user...');
    }
  }

  private async matchUsers(userId: string) {
    // Once another user joins the queue, we start the connection process
    if (this.userQueue.length === 2) {
      this.isConnected = true;
      console.log('Matched with:', userId);
      await this.startVideoCall();
    }
  }

  private async startVideoCall() {
    // Get local media (video and audio)
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
      localVideo.srcObject = this.localStream;

      // Create peer connection
      this.peerConnection = new RTCPeerConnection();

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // Create and send an offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.socket.emit('offer', offer);

      this.peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          this.socket.emit('ice-candidate', event.candidate);
        }
      };

      this.peerConnection.ontrack = (event: any) => {
        const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
        this.remoteStream = event.streams[0];
        remoteVideo.srcObject = this.remoteStream;
      };
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  }

  private async handleOffer(offer: any) {
    if (this.peerConnection) {
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.socket.emit('answer', answer);
    }
  }

  private async handleAnswer(answer: any) {
    if (this.peerConnection) {
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private handleIceCandidate(candidate: RTCIceCandidate) {
    if (this.peerConnection) {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
}
