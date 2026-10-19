import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE } from '../../site-info';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.html',
})
export class PrivacyPage {
  site = SITE;
}
