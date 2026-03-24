import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Necesario para *ngFor y *ngIf
import { CarroService } from '../../services/carro.service';
import { Carro } from '../../models/carros.model';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catalogo.component.html',
  styleUrls: ['./catalogo.component.scss']
})
export class CatalogoComponent implements OnInit {
  listaCarros: Carro[] = [];
  cargando: boolean = false;

  constructor(private carroService: CarroService) {}

  ngOnInit(): void {
    this.listaCarros = [
    { 
      name: 'Maruti 800 AC', 
      year: 2007, 
      selling_price: 60000, 
      km_driven: 70000, 
      fuel: 'Petrol', 
      seller_type: 'Individual', 
      transmission: 'Manual', 
      owner: 'First Owner' 
    },
    { 
      name: 'Hyundai Verna 1.6 SX', 
      year: 2012, 
      selling_price: 600000, 
      km_driven: 100000, 
      fuel: 'Diesel', 
      seller_type: 'Individual', 
      transmission: 'Manual', 
      owner: 'Second Owner' 
    },
    { 
      name: 'Toyota Corolla Altis', 
      year: 2017, 
      selling_price: 1500000, 
      km_driven: 25000, 
      fuel: 'Petrol', 
      seller_type: 'Dealer', 
      transmission: 'Automatic', 
      owner: 'First Owner' 
    }
  ];
    //this.obtenerTodos();
  }

  obtenerTodos(): void {
    this.cargando = true;
    this.carroService.getCarros().subscribe({
      next: (data) => {
        this.listaCarros = data;
        this.cargando = false;
      },
      error: (e) => {
        console.error(e);
        this.cargando = false;
      }
    });
  }

  // Lógica para buscar por columna secundaria (name) 
  buscar(nombre: string): void {
    this.cargando = true;
    this.carroService.buscarPorNombre(nombre).subscribe({
      next: (data) => {
        this.listaCarros = data;
        this.cargando = false;
      }
    });
  }
}