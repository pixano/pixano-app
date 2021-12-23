/**
 * Utility class to pick labels in a panel
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LitElement, html } from 'lit-element';
import '@material/mwc-dialog';
import '@material/mwc-button';

// TODO: move to pixano-elements
export class PopUp extends LitElement {

    static get properties () {
        return {
            message: { type: String },
            buttons: { type: Array }
        }
    }

    constructor() {
        super();
        this.message = '';
        this.buttons = ['ok'];
    }

    updated(changedProperties) {
        if (changedProperties.has('message') && this.message) {
            this.messageElement.innerHTML = this.message.toString().replace(/\n/g, '<br>');
        }
    }

    get dialog() {
        return this.shadowRoot.getElementById('dialog');
    }

    get messageElement() {
        return this.shadowRoot.getElementById('message');
    }

    prompt() {
        this.dialog.open = true;
        return new Promise((resolve, reject) => {
            this.dialog.addEventListener('closing', (evt) => {
                resolve(evt.detail.action);
            })
        });
    }

    /**
     * Render the element template.
     */
    render() {
        return html`
            <mwc-dialog heading="Message dialog" id="dialog" scrimClickAction="">
                <div id="message"></div>
                ${
                    this.buttons.map((b) => html`<mwc-button slot="secondaryAction" dialogAction="${b}">${b}</mwc-button>`)
                }
            </mwc-dialog>
        `;
    }

}

customElements.define('pop-up', PopUp);
