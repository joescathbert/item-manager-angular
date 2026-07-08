import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemFeed } from './item-feed';

describe('ItemFeed', () => {
  let component: ItemFeed;
  let fixture: ComponentFixture<ItemFeed>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemFeed]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItemFeed);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
