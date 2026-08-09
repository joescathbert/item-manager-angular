import { Component, signal, OnDestroy, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Item as ItemService } from '../services/item';
import { FeedItem } from '../interfaces/item';
import { TagFilter as TagFilterService } from '../services/tag-filter';
import { VideoObserver } from '../directives/video-observer';
import { ScrollSentinel } from '../directives/scroll-sentinel';

@Component({
  selector: 'app-item-feed',
  imports: [VideoObserver, ScrollSentinel],
  templateUrl: './item-feed.html',
  styleUrl: './item-feed.scss',
})
export class ItemFeed implements OnInit, OnDestroy {
  // Injections
  private router = inject(Router);
  private itemService = inject(ItemService);
  private tagFilterService = inject(TagFilterService);

  // Core component reactive streams
  feedData = signal<FeedItem[]>([]);
  nextPageUrl = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  isMuted = signal<boolean>(true); // Global Volume State Signal
  
  // 🚀 Added: Global UI state to manage automatic fading bottom overlay bars
  activeOverlayMap = signal<Record<string | number, boolean>>({});

  // Interaction Trackers
  activeMediaMap = signal<Record<string | number, number>>({});
  videoProgressMap = signal<Record<string | number, number>>({});
  activeCueMap = signal<Record<string | number, { type: 'play' | 'pause' | 'forward' | 'backward' } | null>>({});
  isFastForwardingMap = signal<Record<string | number, boolean>>({});

  activeTagFilters: string[] = []; // Variable to store the tags currently being filtered

  private longPressTimer: any;
  private progressInterval: any;
  private wasLongPressing = false;
  private cueTimeoutMap: Record<string | number, any> = {};
  private overlayTimers: Record<string | number, any> = {}; // 🚀 Added: Tracks fading timers per item

  constructor() {
    this.progressInterval = setInterval(() => this.updateAllVideoProgress(), 100);
  }

  ngOnInit() {
    // Fresh reset guarantees clean states if navigating between components
    this.itemService.resetFeedPagination();
    this.fetchNextFeedPage();
  }

  ngOnDestroy() {
    clearInterval(this.progressInterval);
    clearTimeout(this.longPressTimer);
    Object.values(this.cueTimeoutMap).forEach(clearTimeout);
    Object.values(this.overlayTimers).forEach(clearTimeout); // 🚀 Added: Prevent memory leaks from active UI overlays
  }

  // --- API Pagination Feed Loader ---
  fetchNextFeedPage() {
    if (this.isLoading()) return;

    // Use our signal state link to drive the specific feed method chunk request
    const nextTarget = this.feedData().length === 0 ? null : this.nextPageUrl();
    if (this.feedData().length > 0 && !nextTarget) return; // End of list

    this.activeTagFilters = this.tagFilterService.currentFilters;

    this.isLoading.set(true);
    this.itemService.getItemFeed(nextTarget, this.activeTagFilters).subscribe({
      next: (response) => {
        this.feedData.update(currentItems => [...currentItems, ...response.results]);
        this.nextPageUrl.set(response.next);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  // --- Utility: Grab the raw HTML video element ---
  private getVideoElement(mediaId: string | number): HTMLVideoElement | null {
    return document.getElementById(`video-${mediaId}`) as HTMLVideoElement;
  }

  // --- 🚀 Added: Composite Center Zone Event Handler ---
  handleCenterTap(itemId: string | number, mediaId: string | number) {
    // 1. Core video play/pause layout action
    this.togglePlay(mediaId);

    // 2. Trigger translucent bar visibility state loop
    this.showBottomOverlay(itemId);
  }

  // --- 🚀 Added: Translucent Timed Overlay Controller ---
  showBottomOverlay(itemId: string | number) {
    if (this.overlayTimers[itemId]) {
      clearTimeout(this.overlayTimers[itemId]);
    }

    // Set visibility token to true
    this.activeOverlayMap.update(map => ({ ...map, [itemId]: true }));

    // Unhide the element, then fade it out cleanly after exactly 2 seconds
    this.overlayTimers[itemId] = setTimeout(() => {
      this.activeOverlayMap.update(map => ({ ...map, [itemId]: false }));
      delete this.overlayTimers[itemId];
    }, 2000);
  }

  // --- Video Playback & Seeking ---
  togglePlay(mediaId: string | number) {
    if (this.wasLongPressing) {
      this.wasLongPressing = false;
      return;
    }

    const video = this.getVideoElement(mediaId);
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => { });
      this.triggerCue(mediaId, 'play');
    } else {
      video.pause();
      this.triggerCue(mediaId, 'pause');
    }
  }

  seekVideo(mediaId: string | number, offset: number) {
    const video = this.getVideoElement(mediaId);
    if (video) {
      video.currentTime += offset;
      this.triggerCue(mediaId, offset > 0 ? 'forward' : 'backward');
      
      // Pin the bottom overlay open if they are actively jumping tracks via double tap
      const item = this.feedData().find(i => i.mediaList.some(m => m.id === mediaId));
      if (item) this.showBottomOverlay(item.id);
    }
  }

  // --- Long Press (2x Speed) ---
  startLongPress(event: PointerEvent, mediaId: string | number) {
    if (event.pointerType === 'touch') {
      event.preventDefault();
    }

    this.longPressTimer = setTimeout(() => {
      const video = this.getVideoElement(mediaId);
      if (video) {
        video.playbackRate = 2.0;
        this.wasLongPressing = true;
        this.isFastForwardingMap.update(map => ({ ...map, [mediaId]: true }));
      }
    }, 400);
  }

  clearLongPress(mediaId: string | number) {
    clearTimeout(this.longPressTimer);
    const video = this.getVideoElement(mediaId);
    if (video) {
      video.playbackRate = 1.0;
      this.isFastForwardingMap.update(map => ({ ...map, [mediaId]: false }));
    }

    setTimeout(() => {
      if (!this.isFastForwardingMap()[mediaId]) {
        this.wasLongPressing = false;
      }
    }, 50);
  }

  private triggerCue(mediaId: string | number, type: 'play' | 'pause' | 'forward' | 'backward') {
    if (this.cueTimeoutMap[mediaId]) {
      clearTimeout(this.cueTimeoutMap[mediaId]);
    }

    this.activeCueMap.update(map => ({ ...map, [mediaId]: { type } }));

    this.cueTimeoutMap[mediaId] = setTimeout(() => {
      this.activeCueMap.update(map => ({ ...map, [mediaId]: null }));
    }, 600);
  }

  // --- Horizontal Scrolling (Safely tracking finalized positions) ---
  onHorizontalScroll(event: Event, itemId: string | number) {
    const element = event.target as HTMLElement;

    // Calculate final resting position once layout engine stops shifting
    const currentSlideIndex = Math.round(element.scrollLeft / element.clientWidth);

    // Update state safely without mid-swipe skipping artifacts
    this.activeMediaMap.update(map => ({ ...map, [itemId]: currentSlideIndex }));
    
    // Unhide overlay to flash context adjustments when changing carousel index items
    this.showBottomOverlay(itemId);
  }

  // --- Bottom Slider Progress Logic ---
  updateAllVideoProgress() {
    const newProgress = { ...this.videoProgressMap() };
    let changed = false;

    this.feedData().forEach(item => {
      const activeIndex = this.activeMediaMap()[item.id] || 0;
      const activeMedia = item.mediaList[activeIndex];

      if (activeMedia && activeMedia.type === 'video') {
        const video = this.getVideoElement(activeMedia.id);
        if (video && video.duration) {
          const progress = (video.currentTime / video.duration) * 100;
          if (newProgress[item.id] !== progress) {
            newProgress[item.id] = progress;
            changed = true;
          }
        }
      } else {
        if (newProgress[item.id] !== 100) {
          newProgress[item.id] = 100;
          changed = true;
        }
      }
    });

    if (changed) {
      this.videoProgressMap.set(newProgress);
    }
  }

  getVideoProgress(itemId: string | number): number {
    return this.videoProgressMap()[itemId] || 0;
  }

  onSeekScrub(event: Event, itemId: string | number) {
    const input = event.target as HTMLInputElement;
    const targetPercentage = parseFloat(input.value);

    const activeIndex = this.activeMediaMap()[itemId] || 0;
    const item = this.feedData().find(i => i.id === itemId);
    if (!item) return;

    const activeMedia = item.mediaList[activeIndex];
    if (activeMedia && activeMedia.type === 'video') {
      const video = this.getVideoElement(activeMedia.id);
      if (video && video.duration) {
        video.currentTime = (targetPercentage / 100) * video.duration;
      }
    }
    
    // Keep overlay alive while user is actively sliding their thumb
    this.showBottomOverlay(itemId);
  }

  // --- Options ---
  openOptions(itemId: string | number) {
    console.log(`Menu triggered for item: ${itemId}`);
  }

  // Action Method to toggle global state and mute/unmute elements instantly
  toggleMute() {
    const newMuteState = !this.isMuted();
    this.isMuted.set(newMuteState);

    // Apply change immediately to all currently rendered videos in the DOM
    this.feedData().forEach(item => {
      item.mediaList.forEach(media => {
        if (media.type === 'video') {
          const video = this.getVideoElement(media.id);
          if (video) {
            video.muted = newMuteState;
          }
        }
      });
    });
  }

  // Action Method to exit feed
  exitFeed() {
    this.router.navigate(['/home']); 
  }
}