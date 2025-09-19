import Recorder from "../recorder.js";
import Utils from "../utils.js";

//language: "ar-AE" or "en-US"
class EmoASR {
  constructor({ auth, language, whisper_config }) {
    if (!auth) {
      throw new Error("No API key provided!");
    }

    this.apiKey = auth;
    this.wsToken = "";

    // To use the London deployment, uncomment the lines below:
    this.requestUrl = "https://chatda.api.emotechlab.com";
    this.wsUrl = "wss://chatda.api.emotechlab.com/asr/ws/";

    // To use the UAE deployment, uncomment the lines below:
    // this.requestUrl = "https://emoda-uae.api.emotechlab.com";
    // this.wsUrl = "wss://emoda-uae.api.emotechlab.com/asr/ws/";

    this.mediaAcquired = false;
    this.recording = false;
    this.language = language || "en-US";
    this.sample_rate = 16000;
    this.asrStartSend = false;
    this.whisper_config = whisper_config || null;
    this.recorder = new Recorder();
  }

  async mount() {
    this.wsToken = await this.getApiToken();
    console.log("get ws token for asr: ", this.wsToken);
  }
  /**
   * Sends an HTTP request.
   *
   * @param {string} method - The HTTP method (e.g., GET, POST, PUT, DELETE).
   * @param {string} url - The URL to send the request to.
   * @param {Object} data - The data to send with the request.
   * @returns {Promise} A promise that resolves with the response data if the request is successful, or rejects with an error if the request fails.
   */
  request(method, url, data) {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", "Bearer " + this.wsToken);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.statusText));
          }
        }
      };
      xhr.send(JSON.stringify(data));
    });
  }

  /**
   * Retrieves the API token.
   * @returns {Promise<string>} A promise that resolves with the API token.
   */
  getApiToken() {
    return new Promise((resolve, reject) => {
      this.request("get", `${this.requestUrl}/token/init?apikey=${this.apiKey}`)
        .then((res) => {
          let tokenExpire = Number(res.data.timeOut);
          let refrshTime = tokenExpire * 60 * 1000 - 2 * 60 * 1000;
          setInterval(() => {
            this.refreshToken();
          }, refrshTime);
          resolve(res.data.token);
        })
        .catch((err) => {
          console.error(err);
          reject(err);
        });
    });
  }

  /**
   * This function are use to refreshToken.
   *
   */
  refreshToken() {
    return new Promise((resolve, reject) => {
      this.request("get", `${this.requestUrl}/da/user/token`)
        .then((res) => {
          console.log("request send", res.data);
          this.wsToken = res.data;
        })
        .catch((err) => {
          console.error("speak request err:", err);
        });
    });
  }

  async startRecording(onData) {
    if (this.recording) {
      return;
    }

    if (this.language === "en-US") {
      this.socket = new WebSocket(`${this.wsUrl}en?token=${this.wsToken}`);
    } else if (this.language === "ar-AE") {
      this.socket = new WebSocket(`${this.wsUrl}ar?token=${this.wsToken}`);
    }
    this.socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (onData) {
        onData(msg);
      }
    });

    this.handshake = {
      request: "start",
      channel_index: 0,
      params: {
        encoding: "s16",
        sample_rate: this.sample_rate,
        channel_count: 1,
      },
      config: {
        single_utterance: true,
        keep_connection: false,
        partial_interval: 500,
        reuse_tolerance: 100,
        "silence-threshold": 1000,
      },
    };

    // There is a chance when we call this, socket already opened. so eventListneer will be skiped.
    let wsConnected = new Promise((resolve) => {
      if (this.socket.readyState == this.socket.OPEN) {
        this.socket.send(JSON.stringify(this.handshake));
        this.asrStartSend = true;
        resolve();
      } else {
        this.socket.addEventListener("open", (_) => {
          this.socket.send(JSON.stringify(this.handshake));
          this.asrStartSend = true;
          resolve();
        });
      }
    });
    await wsConnected;
    this.recording = true;
    this.recorder.record();
    this.recorder.onMessage = (wavBlob) => {
      this._sendAudio(wavBlob);
    };
    console.log("Finished connecting");
  }

  _sendAudio(buf) {
    if (
      this.socket &&
      this.socket.readyState == this.socket.OPEN &&
      this.asrStartSend
    ) {
      const data = Utils.arrayBufferToBase64({ buffer: buf });
      data.length > 0 &&
        this.socket.send(JSON.stringify({ request: "audio", data }));
    }
  }

  async stopRecording() {
    if (!this.recording) {
      return;
    }
    await new Promise((resolve) => {
      this.socket.send(
        JSON.stringify({
          request: "stop",
        })
      );
      this.asrStartSend = false;
      this.socket.onclose = resolve;
    });

    this.recording = false;
    this.recorder.stopRecord();
    this.recorder.currentBufferClear();
    console.log("Stopped recording");
  }
}

export default EmoASR;
