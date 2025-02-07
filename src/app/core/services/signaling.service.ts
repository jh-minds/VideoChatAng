import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { VideoChatComponent } from '../../features/video-chat/components/video-call.component';

@Injectable({
  providedIn: 'root'
})
export class SignalingService {
  private socket!: Socket;
  private serverUrl: string = 'wss://signaling-server-i9zw.onrender.com';
  private isConnected: boolean = false;
  private currentRoom: string | null = null;

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
      console.log('Socket connected?:', this.socket.connected);
      this.isConnected = true;
      this.joinRoom();
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Disconnected from signaling server:', reason);
      console.log(this.socket.connected);
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

    this.setupRoomListeners();

  }

  joinRoom() {
    this.socket.emit('join-room');

    this.socket.on('room-joined', (room: string) => {
      this.currentRoom = room;
      console.log(`Joined room: ${room}`);
    });

    this.socket.on('room-ready', (room: string) => {
      console.log(`Room is ready: ${room}`);
    });
  }

  sendOffer(offer: any) {
    if (!this.currentRoom) {
      console.warn("Cannot send offer, not in a room.");
      return;
    }
    this.socket.emit("offer", offer, this.currentRoom);
  }

  sendAnswer(answer: any) {
    if (!this.currentRoom) {
      console.warn("Cannot send answer, not in a room.");
      return;
    }
    this.socket.emit("answer", answer, this.currentRoom);
  }

  sendIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.currentRoom) {
      console.warn("Cannot send ICE candidate, not in a room.");
      return;
    }
    this.socket.emit("ice-candidate", candidate, this.currentRoom);
  }

  onOffer(callback: (offer: any) => void) {
    this.socket.on('offer', callback);
  }

  onAnswer(callback: (answer: any) => void) {
    this.socket.on('answer', callback);
  }

  // onOffer(callback: (offer: RTCSessionDescriptionInit) => void) {
  //   this.socket.on("offer", callback);
  // }

  // onAnswer(callback: (answer: RTCSessionDescriptionInit) => void) {
  //   this.socket.on("answer", callback);
  // }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.socket.on('ice-candidate', callback);
  }

  removeListeners() {
    this.socket.off('offer');
    this.socket.off('answer');
    this.socket.off('ice-candidate');
    this.socket.off("room-joined");
    this.socket.off("room-ready");
  }

  private setupRoomListeners() {
    this.socket.on("room-joined", (room: string) => {
      this.currentRoom = room;
      console.log(`Joined room: ${room}`);
    });

    this.socket.on("room-ready", (room: string) => {
      console.log(`Room is ready: ${room}`);
    });
  }
}
