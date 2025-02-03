import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SignalingService {
  private socket: Socket;
  private serverUrl: string = 'wss://signaling-server-i9zw.onrender.com'; // Use wss:// for WebSockets


  constructor() {
    this.socket = io(this.serverUrl, {
      transports: ['websocket'],  // Force WebSockets (avoid polling issues)
      withCredentials: true       // Ensure cookies & auth headers are sent
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

    // Handle signaling messages
    this.socket.on('offer', (offer) => {
      console.log('Received offer:', offer);
    });

    this.socket.on('answer', (answer) => {
      console.log('Received answer:', answer);
    });

    this.socket.on('ice-candidate', (candidate) => {
      console.log('Received ICE candidate:', candidate);
    });
  }

  // Send signaling messages
  sendOffer(offer: any) {
    this.socket.emit('offer', offer);
  }

  sendAnswer(answer: any) {
    this.socket.emit('answer', answer);
  }

  sendIceCandidate(candidate: RTCIceCandidate) {
    this.socket.emit('ice-candidate', candidate);
  }

  // Listen for signaling messages
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
