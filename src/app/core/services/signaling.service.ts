import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SignalingService {
  private socket: Socket;
  private serverUrl: string = 'https://signaling-server-i9zw.onrender.com';

  constructor() {
    this.socket = io(this.serverUrl);
  }

  sendOffer(offer: any) {
    this.socket.emit('offer', offer);
  }

  sendAnswer(answer: any) {
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
