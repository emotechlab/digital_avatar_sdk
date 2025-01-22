/* eslint-disable no-plusplus */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-new-wrappers */
/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */
/* eslint-disable eqeqeq */
/* eslint-disable no-lonely-if */
import Utils from "../utils.js";

class Recorder {
  #jsNode;
  #stream;
  #tracks;
  #context;
  #analyser;
  #mediaNode;
  #CRbuffer = [];
  #CLbuffer = [];
  #recorder_state;
  #channels;
  #outputSampleRate;

  LBuffer = [];
  RBuffer = [];
  doStart = () => {};
  onMessage = () => {};

  constructor({ channels = 1, sampleRate = 16000, doStart = () => {} } = {}) {
    this.#channels = channels - 0;
    this.doStart = doStart;
    this.#outputSampleRate = sampleRate;
    this.#recorder_state = Utils.Status.initing;
    if (!Utils.support_h5) return;
    Utils.initUserMedia();
  }
  set onMessage(value) {
    typeof value === "function" && (this.onMessage = value);
  }

  record() {
    this.#recorder_state === Utils.Status.pauseing
      ? (this.#recorder_state = Utils.Status.recording)
      : navigator.mediaDevices
          .getUserMedia({
            video: false,
            audio: {
              mandatory: {
                googTypingNoiseDetection: false,
                googEchoCancellation: false,
                googAutoGainControl: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
                sampleRate: this.#outputSampleRate,
                noiseSuppression: false,
                echoCancellation: false,
                autoGainControl: false,
                channelCount: 1,
              },
              optional: [],
            },
          })
          .then((...args) => this._gotStream(...args))
          .catch((error) => console.error(error));
  }

  _mergeAudioStreams(desktopStream, voiceStream) {
    const source1 = this.#context.createMediaStreamSource(desktopStream);
    const source2 = this.#context.createMediaStreamSource(voiceStream);
    const destination = this.#context.createMediaStreamDestination();
    const desktopGain = this.#context.createGain();
    const voiceGain = this.#context.createGain();
    desktopGain.gain.value = 0.7;
    voiceGain.gain.value = 0.7;
    source1.connect(desktopGain).connect(destination);
    source2.connect(voiceGain).connect(destination);
    return new MediaStream(destination.stream.getTracks());
  }

  async _gotStream(stream) {
    this.#context = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "balanced",
      sampleRate: this.#outputSampleRate,
    });
    this.#stream = stream;
    this.#mediaNode = this.#context.createMediaStreamSource(this.#stream);
    this.#jsNode = this._createJSNode(this.#context);
    this.#analyser = this.#context.createAnalyser();
    this.#analyser.fftSize = 256;
    this.#mediaNode.connect(this.#analyser);
    this.#analyser.connect(this.#jsNode);
    this.#jsNode.connect(this.#context.destination);
    this.#jsNode.onaudioprocess = (...args) => this.doAudioProcess(...args);
    this.#recorder_state = Utils.Status.recording;
    this.doStart();
  }

  _createJSNode() {
    const BUFFER_SIZE = 1024;
    const INPUT_CHANNEL_COUNT = this.#channels;
    const OUTPUT_CHANNEL_COUNT = this.#channels;
    let creator =
      this.#context.createScriptProcessor || this.#context.createJavaScriptNode;
    creator = creator.bind(this.#context);
    return creator(BUFFER_SIZE, INPUT_CHANNEL_COUNT, OUTPUT_CHANNEL_COUNT);
  }

  doAudioProcess(ev) {
    if (this.#recorder_state !== Utils.Status.recording) return;
    // ENDPOINTING
    // (this.#channels == 2 ? [this.LBuffer, this.RBuffer] : [this.LBuffer]).map((it, i) =>
    //   it.push(ev.inputBuffer.getChannelData(i).slice(0))
    // );
    // (this.#channels == 2 ? [this.#CLbuffer, this.#CRbuffer] : [this.#CLbuffer]).map((it, i) =>
    //   it.push(ev.inputBuffer.getChannelData(i).slice(0))
    // );
    const [left] = Array.from({ length: this.#channels }, (_, i) =>
      ev.inputBuffer.getChannelData(i).slice(0)
    );
    this.onMessage(Utils.getWAVBufferWithoutWavHeader(this.getBuffer(left)));
  }

  stopRecord() {
    if (this.#recorder_state !== Utils.Status.recording) return;
    this.#tracks && this.#tracks.forEach((track) => track.stop());
    this.#mediaNode.disconnect();
    this.#jsNode.disconnect();
  }

  pauseRecord() {
    this.#recorder_state === Utils.Status.recording &&
      (this.#recorder_state = Utils.Status.pauseing);
  }

  _mergeArray(list) {
    const length = list.length * list[0].length;
    const data = new Float32Array(length);
    let offset = 0;
    for (let i = 0; i < list.length; i++) {
      data.set(list[i], offset);
      offset += list[i].length;
    }
    return data;
  }

  // left right 可能未被释放 (left right may not have been released)
  getBuffer(left, right) {
    const totalLength = left.length;
    const data = new Float32Array(totalLength);
    for (let i = 0; i < left.length; i++) {
      const k = i * this.#channels;
      data[k] = left[i];
    }
    return data;
  }

  getPCM() {
    const [left, right] = [this.#CLbuffer, this.#CRbuffer].map((it) =>
      it.length ? this._mergeArray(it) : it
    );
    const { sampleRate } = this.#context;
    return sampleRate === this.#outputSampleRate
      ? this.getBuffer(left, right)
      : Utils.compress({ left, right }, sampleRate, this.#outputSampleRate);
  }

  getWAV() {
    return Utils.getWAVBuffer(
      this.getPCM(),
      0,
      this.#outputSampleRate,
      this.#channels
    );
  }

  getCurrentResult() {
    const [left, right] = [this.#CLbuffer, this.#CRbuffer].map((it) =>
      it.length ? this._mergeArray(it) : it
    );
    this.#CLbuffer = [];
    this.#CRbuffer = [];
    return this.getBuffer(left, right);
  }

  // ENDPOINTING: Modify getCurrentWavResult so we can pass an startTime variable (端点检测：修改getCurrentWavResult以便我们可以传递一个startTime变量)
  getCurrentWavResult(startTime) {
    const [left, right] = [this.#CLbuffer, this.#CRbuffer].map((it) =>
      it.length ? this._mergeArray(it) : it
    );
    this.#CLbuffer = [];
    this.#CRbuffer = [];
    const buffer = this.getBuffer(left, right);
    return Utils.getWAVBuffer(
      buffer,
      startTime,
      this.#outputSampleRate,
      this.#channels
    );
  }
  // ENDPOINTING

  getCurrentWavResultWithoutWavHeader(startTime) {
    const [left, right] = [this.#CLbuffer, this.#CRbuffer].map((it) =>
      it.length ? this._mergeArray(it) : it
    );
    this.#CLbuffer = [];
    this.#CRbuffer = [];
    return Utils.getWAVBufferWithoutWavHeader(
      this.getBuffer(left, right),
      startTime
    );
  }

  currentBufferClear() {
    this.#CLbuffer = [];
    this.#CRbuffer = [];
  }
}

export default Recorder;
