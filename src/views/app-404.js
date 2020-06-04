/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LitElement, html } from 'lit-element';

class App404 extends LitElement {
    render() {
      return html`
        Not Found :(
        `;
    }
}
customElements.define('app-404', App404);