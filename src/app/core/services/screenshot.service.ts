import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class ScreenshotService {

  constructor() {}

  triggerScreenshotEffect() {
    const flash = document.createElement("div");
    flash.classList.add("screenshot-flash");
    document.body.appendChild(flash);

    setTimeout(() => {
      flash.remove();
    }, 300);
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
