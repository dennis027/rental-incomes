import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE } from '../../site-info';

@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms.html',
})
export class TermsPage {
  site = SITE;
}
