import { Pipe, PipeTransform, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Loads an uploaded file (a tenant's ID photo) with the user's login and hands
 * it to an <img>. A plain image link cannot be used: the files need a login,
 * and the browser does not send one for images.
 *
 *   <img [src]="tenant.id_photo_front | secureImage | async">
 */
@Pipe({ name: 'secureImage', standalone: true })
export class SecureImagePipe implements PipeTransform {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  transform(path: string | null | undefined): Observable<SafeUrl | null> {
    if (!path) {
      return of(null);
    }
    const url = /^https?:\/\//.test(path)
      ? path
      : `${environment.apiUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      map(blob => this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob))),
      catchError(() => of(null)),
    );
  }
}
