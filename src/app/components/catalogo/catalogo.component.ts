import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common'; 
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
  listaCarros: any[] = [];
  cargando: boolean = false;

  constructor(
    private carroService: CarroService,
    private cd: ChangeDetectorRef 
  ) {}

  ngOnInit(): void {
    this.obtenerTodos();
  }

  obtenerTodos(): void {
    this.cargando = true;
    this.carroService.getCarros().subscribe({
      next: (data) => {
        this.listaCarros = data;
        this.cargando = false;
        this.cd.detectChanges(); 
      },
      error: (e) => {
        console.error(e);
        this.cargando = false;
        this.cd.detectChanges();
      }
    });
  }

  buscar(nombre: string): void {

    if (!nombre.trim()) {
      this.obtenerTodos();
      return;
    }

    this.cargando = true;
    this.carroService.buscarPorNombre(nombre).subscribe({
      next: (data) => {
        this.listaCarros = data;
        this.cargando = false;

        this.cd.detectChanges(); 
      },
      error: (e) => {
        console.error(e);
        this.cargando = false;
        this.cd.detectChanges();
      }
    });
  }
}