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
        <div>
          Something went wrong or you don't have an access yet.
          Please contact tom.keldenich@valeo.com
        <div>
        `;
    }
}
customElements.define('app-404', App404);