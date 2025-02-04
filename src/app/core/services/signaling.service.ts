import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SignalingService {
  private socket!: Socket;
  private serverUrl: string = 'wss://signaling-server-i9zw.onrender.com';
  private isConnected: boolean = false;

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    if (this.isConnected) return;

    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to signaling server:', this.socket.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Disconnected from signaling server:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    this.socket.on('reconnect_attempt', () => {
      console.warn('Attempting to reconnect...');
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
    });
  }

  sendOffer(offer: any) {
    this.socket.emit('offer', offer, (response: any) => {
      console.log('Offer sent:', response);
    });
  }

  sendAnswer(answer: any) {
    this.socket.emit('answer', answer, (response: any) => {
      console.log('Answer sent:', response);
    });
  }

  sendIceCandidate(candidate: RTCIceCandidate) {
    this.socket.emit('ice-candidate', candidate, (response: any) => {
      console.log('ICE candidate sent:', response);
    });
  }

  onOffer(callback: (offer: any) => void) {
    this.socket.once('offer', callback);
  }

  onAnswer(callback: (answer: any) => void) {
    this.socket.once('answer', callback);
  }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.socket.once('ice-candidate', callback);
  }

  removeListeners() {
    this.socket.off('offer');
    this.socket.off('answer');
    this.socket.off('ice-candidate');
  }
}
