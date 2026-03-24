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
  
  listaCarrosCompleta: any[] = []; 
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
       this.listaCarrosCompleta = data; 
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

  buscar(termino: string): void {
  if (!termino.trim()) {
    this.listaCarros = [...this.listaCarrosCompleta];
  } else {
    const busqueda = termino.toLowerCase();
    
    this.listaCarros = this.listaCarrosCompleta.filter(carro => 
      carro.name.toLowerCase().includes(busqueda)
    );
  }
  
  this.cd.detectChanges();
}
}