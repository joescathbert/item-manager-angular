import { TestBed } from '@angular/core/testing';

import { TagFilter } from './tag-filter';

describe('TagFilter', () => {
  let service: TagFilter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TagFilter);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
