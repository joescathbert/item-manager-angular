import { Directive, ElementRef, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';

@Directive({
  selector: '[appScrollSentinel]',
  standalone: true
})
export class ScrollSentinel implements OnInit, OnDestroy {
  @Output() visible = new EventEmitter<void>();
  private observer!: IntersectionObserver;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        this.visible.emit();
      }
    }, { 
      root: null, // Viewport
      threshold: 0.01 // Fires as soon as 1px is visible
    });

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}