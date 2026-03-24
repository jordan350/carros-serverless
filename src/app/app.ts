import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CatalogoComponent } from './components/catalogo/catalogo.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CatalogoComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('carros-serverless');
}
