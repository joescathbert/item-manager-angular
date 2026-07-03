import { TestBed } from '@angular/core/testing';

import { Tag } from './tag';

describe('Tag', () => {
  let service: Tag;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Tag);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
