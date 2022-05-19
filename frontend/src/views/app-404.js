/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LitElement, html, css } from 'lit-element';
//import TemplatePage from '../templates/template-page';

class App404 extends LitElement {

  render() {
    return html`
      <div style="display: flex; align-items: center; justify-content: center;">
        <div>
          <h1>
            Error 404
          </h1>
          <h3>
            Something went wrong or you don't have an access yet.
          </h3>
          <p>Please contact tom.keldenich@valeo.com</p>
        </div>
      </div>
      `;
  }
}
customElements.define('app-404', App404);