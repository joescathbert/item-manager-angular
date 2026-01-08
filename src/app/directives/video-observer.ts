import { Directive, ElementRef, OnInit, OnDestroy, Input } from '@angular/core';
import { Logger } from '../services/logger';

@Directive({
  selector: '[appVideoObserver]',
})
export class VideoObserver {

  private observer!: IntersectionObserver;

  // Input to optionally control the visibility threshold (default is 50%)
  @Input() threshold: number = 0.5; 

  constructor(private el: ElementRef<HTMLVideoElement>, private logger: Logger) {
    // Ensure the directive is only applied to video elements
    if (this.el.nativeElement.tagName.toLowerCase() !== 'video') {
      this.logger.error('appVideoObserver directive must be applied to a <video> element.');
    }
  }

  ngOnInit(): void {
    // 1. Define the observer options
    const options: IntersectionObserverInit = {
      root: null, // null means the viewport is the root
      rootMargin: '0px',
      threshold: this.threshold // Use the input threshold
    };

    // 2. Define the callback function
    const callback: IntersectionObserverCallback = (entries, observer) => {
      entries.forEach(entry => {
        const video = this.el.nativeElement;

        if (entry.isIntersecting) {
          // Video is visible: Play
          // Using .catch() is important for handling browser autoplay policies
          // video.play().catch(e => this.logger.log('Autoplay prevented or failed:', e));
        } else {
          // Video is scrolled away: Pause
          video.pause();
        }
      });
    };

    // 3. Create and start observing
    this.observer = new IntersectionObserver(callback, options);
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    // Clean up: stop observing when the component or video element is destroyed
    if (this.observer) {
      this.observer.unobserve(this.el.nativeElement);
      this.observer.disconnect();
    }
  }

}
