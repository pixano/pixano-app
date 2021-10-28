/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

import { html } from 'lit-element';
import { settings } from '@pixano/graphics-2d/lib/pxn-graph';
import '@material/mwc-icon-button';
import { colorNames, shuffle } from '@pixano/core/lib/utils'
import { TemplatePluginInstance } from '../templates/template-plugin-instance';
import { store } from '../store';
import { setAnnotations } from '../actions/annotations';

export class PluginKeypointsBox extends TemplatePluginInstance {

  constructor() {
    super();
    this.viewMode = 'single_to_annotate'; // or all;
    this.colors = shuffle(Object.keys(colorNames)); // list of color names
    // window.addEventListener('keydown', (evt) => {
    //   const lowerKey = evt.key.toLowerCase();
    //   if (lowerKey === 'c') {
    //     this.viewMode = this.viewMode == 'all' ? 'single_to_annotate' : 'all';
    //     this.refresh();
    //   }
    // });
  }

  updated(changedProperties) {
    if (changedProperties.has('mode')) {
      this.viewMode = this.mode == 'create' ? 'single_to_annotate' : 'all';
      this.refresh();
    }
  }

  firstUpdated() {
    super.firstUpdated();
    settings.edges = [[0,1], [1,2]];
    settings.colorFillType = "order";
    settings.orderedColors =[
      0xffff00, 0x008000, 0xff0000
    ];
    // To edit skeleton structure:
    // this.element.graphType = {
    //   names: ['center']
    // }
  }

  newData() {
    super.newData();
    // reset global counter
    const ids = this.annotations
                        .filter((a) => a.geometry.type == "graph")
                        .map((kpt) => kpt.id);
    const boxes = this.annotations
                        .filter((a) => a.geometry.type == "rectangle")
    const doneBoxes = boxes.filter((r) => ids.includes(r.id));
    this.attributePicker.numDone = doneBoxes.length;
    this.attributePicker.numTotal = boxes.length;

  }

  refresh() {
    if (!this.element) {
      return;
    }
    // need to make immutable variable as not to change directly
    // the redux store
    if (this.viewMode == 'single_to_annotate') {
      this.showNextFreeBox();
    } else {
      this.showAll();
    }

  }

  /**
   * Invoked on instance removal
   * @param {CustomEvent} evt 
   */
  onDelete() {
    super.onDelete();
    this.attributePicker.numDone -= evt.detail.length;
  }

  onCreate(evt) {
    if (this.viewMode == 'all') {
      this.element.shapes.delete(evt.detail);
      return;
    }
    const ids = this.annotations
                        .filter((a) => a.geometry.type == "graph")
                        .map((kpt) => kpt.id);
    const freeBoxes = this.annotations
                        .filter((a) => a.geometry.type == "rectangle")
                        .filter((r) => !ids.includes(r.id));
    
    if (freeBoxes.length) {
      evt.detail.id = freeBoxes[0].id;
      let { color, ...newAnnotation } = {
        ...JSON.parse(JSON.stringify(evt.detail)),
        ...this.attributePicker.defaultValue
      };
      if (this.isSequence) {
        newAnnotation.timestamp = this.targetFrameIdx;
      }
      freeBoxes.shift();
      this.attributePicker.numDone = this.attributePicker.numTotal - freeBoxes.length;
      store.dispatch(createAnnotation(newAnnotation));
      this.element.shapes = freeBoxes.length ? [{...freeBoxes[0], color: this._colorFor(freeBoxes[0].categoryName) }] : [];
    } else {
      this.element.shapes = [];
    }
  }

  showAll() {
    const annotations = JSON.parse(JSON.stringify(this.annotations));
    const rectangles = annotations.filter((a) => a.geometry.type == "rectangle");
    const keypoints = annotations.filter((a) => a.geometry.type == "graph");

    rectangles.forEach((rect, idx) => {
      rect.color = this.colors[idx%this.colors.length];
      const kpt = keypoints.find((k) => k.id == rect.id);
      if (kpt) {
        kpt.color = rect.color;
      }
    })
    this.element.shapes = [...keypoints, ...rectangles];
  }

  showNextFreeBox() {
    const ids = this.annotations
                        .filter((a) => a.geometry.type == "graph")
                        .map((kpt) => kpt.id);
    const freeBoxes = this.annotations
                          .filter((a) => a.geometry.type == "rectangle")
                          .filter((r) => !ids.includes(r.id));
    if (freeBoxes.length) {
      
      this.element.shapes = [{...freeBoxes[0], color: this._colorFor(freeBoxes[0].categoryName) }];
    }
  }
  
  allVisible() {
    const selectedLabels = this.element.selectedShapes;
    if (selectedLabels.length === 1) {
      selectedLabels[0].geometry.visibles = selectedLabels[0].geometry.visibles.map(() => true);
      this.collect();
    }  
  }

  swap() {
    const selectedLabels = this.element.selectedShapes;
    if (selectedLabels.length === 1) {
      const vs = selectedLabels[0].geometry.vertices;
      selectedLabels[0].geometry.vertices = [vs[0], vs[1], vs[4], vs[5], vs[2], vs[3]];
      this.collect();
    }
  }

  get editor() {
    return html`<pxn-graph id="main"
                      enableOutsideDrawing
                      mode=${this.mode}
                      @create=${this.onCreate}
                      @update=${this.onUpdate}
                      @delete=${this.onDelete}
                      @selection=${this.onSelection}></pxn-graph>`;
  }
}
customElements.define('plugin-keypoints-box', PluginKeypointsBox);
