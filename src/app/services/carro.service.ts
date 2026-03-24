import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Carro } from '../models/carros.model';

@Injectable({
  providedIn: 'root'
})
export class CarroService {
  // URL de la Azure Function 
  private apiUrl = 'https://tu-app-functions.azurewebsites.net/api/GetCarros';

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