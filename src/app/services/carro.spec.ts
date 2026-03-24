import { TestBed } from '@angular/core/testing';

import { Carro } from './carro';

describe('Carro', () => {
  let service: Carro;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Carro);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
