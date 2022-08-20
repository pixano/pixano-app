// ADD BY TOM

/**
 * Utility class to pick labels in a panel
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { LitElement, html, css } from 'lit-element';
import '@material/mwc-dialog';
import '@material/mwc-checkbox';
import '@material/mwc-formfield';
import '@material/mwc-select';
import '@material/mwc-list/mwc-list-item';
import { GET, PUT } from '../actions/requests';
import { getState } from '../store';


// TODO: move to pixano-elements
export class ValidatorComment extends LitElement {

    async refresh() {
        if (!this.element) {
          return;
        }
        // need to make immutable variable as not to change directly
        // the redux store
        this.element.shapes = JSON.parse(JSON.stringify(this.annotations.map((l) => {
          return {...l, color: this._colorFor(l.category)}
        })));
      }

    render(){
        const taskName = getState('application').taskName;
        //const data_id = getState('media').info.id;
        const media = getState('media');
        //const data_info = await GET(`/api/v1/tasks/${taskName}/results/${data_id}`);
        //console.log("HERE1 "+taskName+" "+data_id);
        console.log("This "+this.schema);
        console.log("HERE1 "+Object.getOwnPropertyNames(media));
        console.log("HERE1 "+media.info);
        GET(`/api/v1/tasks/${taskName}`).then(res => console.log("HERE2 "+res));

        //console.log("HERE "+data_info);
        console.log("This "+Object.getOwnPropertyNames(this));

        return html`
            No comment yet ...
        `;
    }
}

customElements.define('validator-comment', ValidatorComment);