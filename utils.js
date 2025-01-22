/* eslint-disable func-names */
/* eslint-disable no-param-reassign */

/**
 *
 * @param {TypedArrays} data
 * @param {Number}      offset
 * @param {String}      str
 */
function writeString(data, offset, str) {
  for (let i = 0; i < str.length; i += 1) {
    data.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * @param {Array} arr
 * @param {Number} size
 * @returns {Array[Array[]]}
 */
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

class Utils {
  /**
   *
   * ，
   * @function Utils.compress
   * @param {float32array} data       [-1, 1]
   * @param {number} inputSampleRate
   * @param {number} outputSampleRate
   * @returns  {float32array}
   */
  static compress(data, inputSampleRate, outputSampleRate) {
    const rate = inputSampleRate / outputSampleRate;
    const compression = Math.max(rate, 1);
    const lData = data.left;
    const rData = data.right;
    const length = Math.floor((lData.length + rData.length) / rate);
    const result = new Float32Array(length);
    let index = 0;
    let j = 0;

    while (index < length) {
      const temp = Math.floor(j);
      result[index] = lData[temp];
      index += 1;

      if (rData.length) {
        result[index] = rData[temp];
        index += 1;
      }

      j += compression;
    }
    return result;
  }
  // ENDPOINTING

  static getWAVBufferWithoutWavHeader(data, startTime) {
    const audioData = data.slice(startTime, data.length);
    data = null;
    const buffer = new ArrayBuffer(audioData.length * 2);
    const view = new DataView(buffer);
    const { length } = audioData;
    let index = 0;
    const volume = 1;
    for (let i = 0; i < length; i += 1) {
      view.setInt16(index, audioData[i] * (0x7fff * volume), true);
      index += 2;
    }
    return buffer;
  }

  /**
   * getUserMedia
   * @function Utils.initUserMedia
   */
  static initUserMedia() {
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {};
    }

    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = function (constraints) {
        const getUserMedia =
          navigator.getUserMedia ||
          navigator.webkitGetUserMedia ||
          navigator.mozGetUserMedia ||
          navigator.msGetUserMedia;

        if (!getUserMedia) {
          return Promise.reject(new Error(" getUserMedia !"));
        }

        return new Promise(function (resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }

  /**
   * ArrayBuffer to Base64
   * @param {ArrayBuffer} buffer
   * @returns {Base64String}
   */
  static arrayBufferToBase64({ buffer }) {
    return window.btoa(
      ["", ...chunk(new Uint8Array(buffer.slice(0)), 8 * 1024)].reduce(
        (t, c) => t + String.fromCharCode(...c)
      )
    );
  }
}

Utils.Status = {
  initing: "0",
  pauseing: "1",
  recording: "2",
  completed: "3",
};

export default Utils;
