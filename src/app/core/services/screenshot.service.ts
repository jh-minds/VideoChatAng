import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class ScreenshotService {

  constructor() {}

  private triggerScreenshotEffect() {
    const flash = document.createElement("div");
    flash.classList.add("screenshot-flash");
    document.body.appendChild(flash);

    setTimeout(() => {
      flash.remove();
    }, 300);

    const popup = document.createElement("div");
    popup.classList.add("popup-message");
    popup.textContent = "Thanks for reporting creep. The authorities have been notified.";
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.classList.add("show");
    }, 300);

    setTimeout(() => {
      popup.classList.remove("show");
      setTimeout(() => document.body.removeChild(popup), 500);
    }, 3000);
  }

  takeScreenshot() {
    const body = document.body;

    html2canvas(body, {
      allowTaint: true,
      useCORS: true
    }).then(canvas => {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "CreepShot!.png";
      link.click();

      this.triggerScreenshotEffect();
    });
  }
}
