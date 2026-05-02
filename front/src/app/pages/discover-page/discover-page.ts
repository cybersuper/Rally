import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ClubDiscoveryComponent } from '../../components/club-discovery/club-discovery';

@Component({
  selector: 'app-discover-page',
  imports: [CommonModule, ClubDiscoveryComponent],
  templateUrl: './discover-page.html',
})
export class DiscoverPageComponent {}
