import { TestBed } from '@angular/core/testing';

import { Timeline } from './timeline';

describe('Timeline', () => {
  let service: Timeline;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Timeline);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
