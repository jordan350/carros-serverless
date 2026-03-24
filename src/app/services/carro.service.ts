import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Carro } from '../models/carros.model';

@Injectable({
  providedIn: 'root'
})
export class CarroService {

  private apiUrl = '/api/cars';
  constructor(private http: HttpClient) { }

  // Método para obtener todos los carros 
  getCarros(): Observable<Carro[]> {
    return this.http.get<Carro[]>(this.apiUrl);
  }

  // Método para buscar por nombre
  buscarPorNombre(nombre: string): Observable<Carro[]> {
    return this.http.get<Carro[]>(`${this.apiUrl}?name=${nombre}`);
  }
}