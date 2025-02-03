import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SignalingService {
  private socket: Socket;
  private serverUrl: string = 'wss://signaling-server-i9zw.onrender.com';
  private peerConnection!: RTCPeerConnection;

  constructor() {
    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to signaling server:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Disconnected from signaling server:', reason);
    });

    // Initialize the peer connection
    this.initializePeerConnection();
  }

  private initializePeerConnection() {
    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:your-turn-server.com",
        username: "your-username",
        credential: "your-password"
      }
    ];

    this.peerConnection = new RTCPeerConnection({ iceServers });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection State:', this.peerConnection.connectionState);
    };
  }

  sendOffer(offer: RTCSessionDescriptionInit) {
    this.socket.emit('offer', offer);
  }

  sendAnswer(answer: RTCSessionDescriptionInit) {
    this.socket.emit('answer', answer);
  }

  sendIceCandidate(candidate: RTCIceCandidate) {
    this.socket.emit('ice-candidate', candidate);
  }

  onOffer(callback: (offer: any) => void) {
    this.socket.on('offer', callback);
  }

  onAnswer(callback: (answer: any) => void) {
    this.socket.on('answer', callback);
  }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.socket.on('ice-candidate', callback);
  }
}
