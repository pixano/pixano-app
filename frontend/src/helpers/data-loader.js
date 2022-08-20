/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

/**
 * Local video cache.
 */
export class VideoCache {

    constructor() {
        this.frames = [];
        this._numFrames = -1;
        this._sourceId = '';
        this._frameIndex = -1;
    }

    get sourceId() {
        return this._sourceId;
    }

    set sourceId(value) {
        this._sourceId = value;
    }

    get frameIndex() {
        return this._frameIndex;
    }

    set frameIndex(frameIndex) {
        this._frameIndex = frameIndex;
    }

    getNextIdxToLoad(start) {
        const idx = this.frames.slice(start + 1).findIndex((f) => f.data == null);
        if (idx !== -1) {
            return start + 1 + idx;
        } else {
            return -1;
        }
    }

    /**
     * Set the total number of frames.
     * @param value total number of frames
     */
    setNumFrames(value) {
        this._numFrames = value;
    }

    /**
     * Get the total number of frames.
     */
    get numFrames() {
        return this._numFrames;
    }

    /**
     * Get the number of currently loaded frames in the cache.
     */
    getNumLoadedFrames() {
        return this.frames.filter((f) => f.data != null).length;
    }

    getLoadedBetween(a, b) {
        return this.frames.slice(a, b).filter((f) => f.data != null).length;
    }

    getMaxLoaded() {
        const revArray = this.frames.slice().reverse();
        const lastIdx = revArray.findIndex((f) => f.data != null);
        return this.frames.length - lastIdx;
    }

    /**
     * Chech if the frames are completly loaded in the cache.
     */
    isFullyLoaded() {
        return ((this.numFrames === this.frames.length) && this.frames.length > 0);
    }

    isLoadedByTimestamp(timestamp) {
        const index = this.frames.findIndex((f) => f.timestamp === timestamp);
        return index !== -1 && this.frames[index].data != null;
    }

    isLoadedByIndex(idx) {
        return this.frames[idx] && this.frames[idx].data != null;
    }

    /**
     * Get image from the cache by id
     * @param id frame id in the cache
     */
    getFrameByIndex(idx) {
        return (this.frames[idx] && this.frames[idx].data != null) ? this.frames[idx].data : null;
    }

    /**
     * Get image from the cache by timestamp
     * @param id frame id in the cache
     */
    getFrameByTimestamp(timestamp) {
        const index = this.frames.findIndex((f) => f.timestamp === timestamp);
        if (index !== -1) {
            return this.frames[index].data;
        }
        return new Image();
    }

    /**
     * Set image from the cache by id
     * @param id frame id in the cache
     */
    setCacheByTimestamp(frame) {
        const index = this.frames.findIndex((f) => f.timestamp === frame.timestamp);
        this.frames[index] = frame;
    }

    /**
     * Get the timestamp for the frame at index.
     * @param id frame index
     */
    toTimestamp(id) {
        return this.frames[id] ? this.frames[id].timestamp : -1;
    }

    /**
     * Get the timestamp for the frame at index.
     * @param id frame index
     */
    getFrameIndex(timestamp) {
        return this.frames.findIndex((f) => f.timestamp === timestamp);
    }

    /**
     * Add new frame to the cache.
     * @param f frame to add
     */
    add(f) {
        this.frames.push(f);
    }

    /**
     * Clear cache.
     */
    clear() {
        this.frames = [];
        this._numFrames = 0;
    }

    clearData() {
        this.frames.forEach((f) => f.data = null);
    }
}

////// Data loaders

function readImage(dataUrl) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            resolve(image);
        };
        image.src = dataUrl;
    });
}

function readPcl(path) {
    return new Promise((resolve) => {
        fetch(path).then((response) => {
            return response.ok ? response.arrayBuffer() : Promise.reject(response.status);
        }).then((points) => {
            resolve(new Float32Array(points));
        }); 
    });
}

function read(path) {
    if (!path) {
        console.warn('Path undefined', path);
    }
    if (path.endsWith('bin')) {
        return readPcl(path);
    } else if (path.match(/\.(jpeg|jpg|gif|png)$/) != null) {
        return readImage(path);
    }
}

function dynamicRead(path) {
    if (typeof path === 'string') {
        return read(path);
    } else if (Array.isArray(path)) {
        return Promise.all(path.map(read));
    }
}

/**
 * Handle loading of view(s)
 */
export class Loader extends EventTarget {

    load(path) {
        return dynamicRead(path);
    }
}

/**
 * Handle loading of a sequence
 * of files.
 */
export class SequenceLoader extends EventTarget {

    constructor() {
        super();
        this.bufferSize = 2500; // number of frames max
        this.loadedFrameNumber = 0;
        this.isLoading = false;
        this.loadStop = false;
        this.cache = null;
        this.frames = [];
        this._eventAbortCompleted = new Event('cancel_completed');
    }

    /**
     * Load metadata
     * @param { <timestamp: number, path: [string]>[] } frames 
     */
    init(frames) {
        // fill cache with empty timestamped images to make sure that
        // the timestamps are in order
        this.cache = new VideoCache;
        for (const source of frames) {
            this.cache.add({ timestamp: source.timestamp, data: null });
        }
        this.cache.setNumFrames(frames.length);
        this.frames = frames;
        this.frames.sort((a, b) => {
            return a.timestamp - b.timestamp;
        });
        return Promise.resolve(frames.length);
    }

    read(path) {
        return dynamicRead(path);
    }

    /**
     * Peek frame at index.
     * @param {number} idx 
     */
    peekFrame(idx) {
        const requestedFrame = this.cache.getFrameByIndex(idx);
        if (requestedFrame == null) {
            return this.abortLoading().then(() => {
                this.cache.clearData();
                return this.load(idx); 
            });
            // if frame not loaded, abort current load and start from there
            // this.videoLoader.setFrameIndex(frameIndex);
        } else {
            return Promise.resolve(requestedFrame);
        }
    }

    /**
     * Cancel image requests by emptying their src
     */
    abortLoading() {
        if (!this.isLoading) {
            return Promise.resolve();
        } else {
            this.loadStop = true;
            const self = this;
            return new Promise((resolve, reject) => {
                self.addEventListener('cancel_completed', () => {
                    self.isLoading = false;
                    resolve();
                })
            }); 
        }
    }

    /**
     * Launch load of images.
     * Resolve first frame as soon as loaded
     * @param idx first frame index to load
     */
    load(idx, startBufferIdx) {
        startBufferIdx = startBufferIdx || idx;
        const self = this;
        if (!this.frames[idx]) {
            return Promise.resolve();
        }
        const timestamp = this.frames[idx] ? this.frames[idx].timestamp : 0;
        const path = this.frames[idx].path;
        const next = idx + 1;
        this.isLoading = true;
        const maxi = Math.min(this.frames.length - 1, startBufferIdx + this.bufferSize - 1)
        if (this.loadStop) {
            this.dispatchEvent(this._eventAbortCompleted)
            this.loadStop = false;
            this.isLoading = false;
        } else {
            return new Promise((resolve) => {
                return this.read(path).then((data) => {
                    self.cache.setCacheByTimestamp({ timestamp, data });
                    this.dispatchEvent(new CustomEvent('loaded_frame_index', {detail: idx}));
                    if (idx === startBufferIdx) {
                        resolve(data);
                    }
                    if (next <= maxi){
                        self.load(next, startBufferIdx);
                    } else {
                        this.isLoading = false;
                        if (this.loadStop) {
                            this.dispatchEvent(this._eventAbortCompleted)
                            this.loadStop = false;
                        }
                    }                
                });
            });
        }
    }
}
