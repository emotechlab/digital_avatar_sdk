const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isFunction = (val) => typeof val === "function";

const isLandscape = () => {
  const { clientWidth, clientHeight } = document.documentElement;
  return clientWidth > clientHeight;
};

/**
 * Represents a Socket object that extends the WebSocket class.
 * @class
 * @extends WebSocket
 */
class Socket extends WebSocket {
  constructor(prop) {
    super(prop);
    this.binaryType = "arraybuffer";
  }

  /**
   * Sends content over the WebSocket connection.
   * @param {...any} args - The content to send.
   * @returns {Promise<void>} - A promise that resolves when the content is sent.
   */
  async sendContent(...args) {
    if (this.readyState === this.OPEN) {
      this.send(...args);
    }
    if (this.readyState === this.CONNECTING) {
      await sleep(1000);
      return this.sendContent(...args);
    }
  }
}

/**
 * Enum representing the types of messages sent from the server to the client.
 * @enum {number}
 */
const ToClientMessageType = {
  QualityControlOwnership: 0,
  Response: 1,
  Command: 2,
  FreezeFrame: 3,
  UnfreezeFrame: 4,
  VideoEncoderAvgQP: 5,
  LatencyTest: 6,
  InitialSettings: 7,
  FileExtension: 8,
  FileMimeType: 9,
  FileContents: 10,
};

/**
 * Enum representing the types of messages that can be emitted.
 * @enum {number}
 */
const EmitMessageType = {
  UI: 50,
  Command: 51,
};

let renderid = null;

/**
 * Represents a WebRTC player. PLay an RTC stream in the browser.
 */
class WebRtcPlayer {
  version = 4; // 4 or 5, default: 5
  video = null;
  audio = null;
  webrtc = null;
  dcClient = null;
  stream = new MediaStream();
  audioStream = new MediaStream();
  config = {
    sdpSemantics: "unified-plan",
    offerExtmapAllowMixed: false,
    bundlePolicy: "balanced",
  };
  options = {
    handleTrack: null,
    dataChannelReadyCallBack: null,
    renderIdCallBack: null,
    startTalkingCallBack: null,
    stopTalkingCallBack: null,
    handleCreateOffer: null,
    handleStateChange: null,
    handleIceCandidate: null,
  };

  constructor(id, { config, version, videoStyle, ...options } = {}) {
    this.video = this.formatVideo(id, videoStyle);
    this.audio = this.formatAudio(id);
    this.config = {
      ...this.config,
      ...config,
    };
    this.options = {
      ...this.options,
      ...options,
    };
    version && (this.version = version);
    this.version === 4 && this.play();
  }

  /**
   * Plays the media and sets up the WebRTC connection.
   */
  play() {
    this.webrtc = new RTCPeerConnection(this.config);
    this.webrtc.ontrack = (...args) => this.onTrack(...args);
    this.webrtc.onicecandidateerror = console.error;
    isFunction(this.options.handleIceCandidate) &&
      (this.webrtc.onicecandidate = this.options.handleIceCandidate);
    isFunction(this.options.handleStateChange) &&
      (this.webrtc.onconnectionstatechange = this.options.handleStateChange);
    this.setupDataChannel();
    this.version === 4 && this.doCreateOffer();
  }

  /**
   * Formats a video element based on the given ID.
   * If the element with the given ID is a video element, it returns the element itself.
   * Otherwise, it creates a new video element based on the given element and returns it.
   * @param {string} id - The CSS selector of the element to format as a video.
   * @param {Object} [customStyle={}] - Optional custom CSS styles to apply if a new video element is created.
   * @returns {HTMLVideoElement|null} - The existing or newly created video element, or null if the element doesn't exist.
   */
  formatVideo(id, customStyle = {}) {
    const el = document.querySelector(id);
    if (!el) return null;
    return el.tagName === "VIDEO" ? el : this.createVideo(el, customStyle);
  }

  /**
   * Formats the audio element with the given id.
   * If the element with the given id is an <audio> element, it returns the element itself.
   * Otherwise, it creates a new <audio> element based on the provided element and returns it.
   * @param {string} id - The id of the element to format.
   * @returns {HTMLAudioElement} - The formatted <audio> element.
   */
  formatAudio(id) {
    const el = document.querySelector(id);
    return el.tagName === "AUDIO" ? el : this.createAudio(el);
  }

  /**
   * Creates a video element, applies default and custom styles, and appends it to the specified element.
   * @param {HTMLElement} el - The element to which the video element will be appended.
   * @param {Object} [customStyle={}] - Optional custom CSS styles to apply to the video element.
   * @returns {HTMLVideoElement} - The created video element.
   */
  createVideo(el, customStyle = {}) {
    const video = document.createElement("video");

    const defaultStyle = {
      position: "fixed",
      width: "100%",
      height: "100%",
      left: 0,
      top: 0,
      objectFit: isLandscape() ? "contain" : "cover",
    };

    Object.assign(video.style, defaultStyle, customStyle);

    video.disablePictureInPicture = true;
    video.playsInline = true;
    video.controls = false;
    video.muted = true;

    el.appendChild(video);
    return video;
  }

  /**
   * Creates an audio element and appends it to the specified element.
   * @param {HTMLElement} el - The element to which the audio element will be appended.
   * @returns {HTMLAudioElement} - The created audio element.
   */
  createAudio(el) {
    const audio = document.createElement("audio");
    audio.playsInline = true;
    audio.muted = true;
    el.appendChild(audio);
    return audio;
  }

  /**
   * Creates an offer for WebRTC communication.
   * @returns {Promise<void>} A promise that resolves when the offer is created.
   */
  async doCreateOffer() {
    const offer = await this.webrtc.createOffer({
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1,
      voiceActivityDetection: false,
    });
    await this.webrtc.setLocalDescription(offer);
    isFunction(this.options.handleCreateOffer) &&
      this.options.handleCreateOffer({
        type: "offer",
        sdp: offer.sdp.replace(
          "useinbandfec=1",
          "maxaveragebitrate=510000;sprop-maxcapturerate=48000;sprop-stereo=1;stereo=1;useinbandfec=1;"
        ),
      });
  }

  /**
   * Receives an offer and handles it by setting the remote description,
   * creating an answer, and setting the local description.
   * If the webrtc object is not initialized, it will also play the media.
   * @param {RTCSessionDescription} data - The offer data to be received.
   * @returns {Promise<void>} - A promise that resolves when the offer is handled.
   */
  async receiveOffer(data) {
    if (!this.webrtc) {
      this.play();
      const desc = new RTCSessionDescription(data);
      this.webrtc.setRemoteDescription(desc);
      const answer = await this.webrtc.createAnswer();
      this.webrtc.setLocalDescription(answer);
      isFunction(this.options.handleCreateAnswer) &&
        this.options.handleCreateAnswer({
          type: "answer",
          sdp: answer.sdp.replace(
            "useinbandfec=1",
            "maxaveragebitrate=510000;minptime=10;sprop-stereo=1;stereo=1;useinbandfec=1"
          ),
        });
    }
  }

  /**
   * Receives an answer from the remote peer and sets it as the remote description.
   * @param {RTCSessionDescriptionInit} data - The answer received from the remote peer.
   */
  receiveAnswer(data) {
    const desc = new RTCSessionDescription(data);
    this.webrtc.setRemoteDescription(desc);
  }

  /**
   * Adds an ICE candidate to the WebRTC connection.
   * @param {Object} iceCandidate - The ICE candidate object.
   */
  addIceCandidate(iceCandidate) {
    const candidate = new RTCIceCandidate(iceCandidate);
    this.webrtc.addIceCandidate(candidate);
  }

  /**
   * Handles the onTrack event.
   * @param {Event} event - The event object.
   */
  onTrack(event) {
    if (event.track.kind === "audio") {
      this.audioStream = new MediaStream();
      this.audioStream.addTrack(event.track);
      this.audio.srcObject = this.audioStream;
    } else {
      this.stream = new MediaStream();
      this.stream.addTrack(event.track);
      this.video.srcObject = this.stream;
      this.video.play();
    }
    isFunction(this.options.handleOnTrack) && this.options.handleOnTrack(event);
  }

  /**
   * Sets up the data channel for communication.
   */
  setupDataChannel() {
    try {
      this.dcClient = this.webrtc.createDataChannel("cirrus", {
        ordered: true,
      });
      console.log(`Created emoDA datachannel`);
      this.dcClient.binaryType = "arraybuffer";
      this.dcClient.onopen = () => {
        console.log(`data channel connect`);
        isFunction(this.options.dataChannelReadyCallBack) &&
          this.options.dataChannelReadyCallBack();
      };
      this.dcClient.onclose = function doClose() {
        console.log(`data channel closed`);
      };
      this.dcClient.onmessage = ({ data }) => {
        const view = new Uint8Array(data);

        if (view[0] === ToClientMessageType.Response) {
          const response = new TextDecoder("utf-16").decode(data.slice(1));
          console.log("response!!!", response);
          if (response == "StartTalking") {
            isFunction(this.options.startTalkingCallBack) &&
              this.options.startTalkingCallBack();
          } else if (response == "EndTalking") {
            isFunction(this.options.stopTalkingCallBack) &&
              this.options.stopTalkingCallBack();
          } else {
            renderid = response;
            console.log("response", response, renderid);
            isFunction(this.options.renderIdCallBack) &&
              this.options.renderIdCallBack();
          }
        }
      };
    } catch (e) {
      console.warn("No data channel", e);
    }
  }

  /**
   * Checks if the dcClient is available and in an open state.
   * @returns {boolean} Returns true if the dcClient is available and in an open state, otherwise false.
   */
  isCanSend() {
    return this.dcClient && this.dcClient.readyState === "open";
  }

  /**
   * Sends the provided data if the send condition is met.
   * @param {any} data - The data to be sent.
   */
  send(data) {
    this.isCanSend() && this.dcClient.send(data);
  }

  /**
   * Stops the video streaming and resets the media stream.
   */
  stop() {
    this.webrtc.close();
    this.webrtc = null;
    this.video.srcObject = null;
    this.stream = new MediaStream();
  }

  /**
   * Sets the video enabled state.
   * @param {boolean} enabled - The desired enabled state for the video.
   */
  setVideoEnabled(enabled) {
    this.video.srcObject
      .getTracks()
      .forEach((track) => (track.enabled = enabled));
  }

  /**
   * Emits a message with the specified message type and descriptor.
   * @param {number} messageType - The type of the message.
   * @param {object} descriptor - The descriptor object.
   */
  emit(messageType, descriptor) {
    const descriptorAsString = JSON.stringify(descriptor);
    const data = new DataView(
      new ArrayBuffer(1 + 2 + 2 * descriptorAsString.length)
    );
    let byteIdx = 0;
    data.setUint8(byteIdx, messageType);
    byteIdx += 1;
    data.setUint16(byteIdx, descriptorAsString.length, true);
    byteIdx += 2;
    for (let i = 0; i < descriptorAsString.length; i += 1) {
      data.setUint16(byteIdx, descriptorAsString.charCodeAt(i), true);
      byteIdx += 2;
    }
    this.send(data.buffer);
  }
}

// Contains settings for each available actor/avatar
const actorObj = {
  ali: {
    render_name: "ali",
    dealer_actor: "ali_white",
    gender: "Male",
  },
  aliCasual: {
    render_name: "casual_ali",
    dealer_actor: "ali_white",
    gender: "Male",
  },
  james: {
    render_name: "james",
    dealer_actor: "james",
    gender: "Male",
  },
  doctor: {
    render_name: "doctor",
    dealer_actor: "james",
    gender: "Male",
  },
  saudi_ali: {
    render_name: "saudi_ali",
    dealer_actor: "ali_white",
    gender: "Male",
  },
  omani_ali: {
    render_name: "omani_ali",
    dealer_actor: "ali_white",
    gender: "Male",
  },
  emirati_ali_red: {
    render_name: "emirati_ali_red",
    dealer_actor: "ali_white",
    gender: "Male",
  },
  emirati_ali_white: {
    render_name: "emirati_ali_white",
    dealer_actor: "ali_white",
    gender: "Male",
  },
  qatar_ali: {
    render_name: "qatar_ali",
    dealer_actor: "ali_white",
    gender: "Male",
  },
  qatar_ali_red: {
    render_name: "qatar_ali_red",
    dealer_actor: "ali_white",
    gender: "Male",
  },
  laura: {
    render_name: "amy",
    dealer_actor: "annie",
    gender: "Female",
  },
  aisha: {
    render_name: "aisha_new",
    dealer_actor: "aisha_new",
    gender: "Female",
  },
  aisha3: {
    render_name: "aisha3",
    dealer_actor: "aisha_new",
    gender: "Female",
  },
  aishaCasual: {
    render_name: "casual_aisha",
    dealer_actor: "aisha_new",
    gender: "Female",
  },
  aishablue: {
    render_name: "aisha_blue_hijab",
    dealer_actor: "aisha_new",
    gender: "Female",
  },
  lina: {
    render_name: "Lina",
    dealer_actor: "aisha_new",
    gender: "Female",
  },
  fatima: {
    render_name: "fatima_black_abaya",
    dealer_actor: "aisha_new",
    gender: "Female",
  },
  yasmine: {
    render_name: "sarah",
    dealer_actor: "aisha_new",
    gender: "Female",
  },
  aishaDemo: {
    render_name: "aisha_demo",
    dealer_actor: "aisha_new",
    gender: "Female",
  },
};

// Contains settings for each available language
const languageObj = {
  english: {
    dealer_lan_code: "en-US",
    support_gender: ["Female", "Male"],
    default_avatar: "ali",
  },
  arabicMsa: {
    dealer_lan_code: "ar",
    dialect: "msa",
    support_gender: ["Female"],
    default_avatar: "aisha",
  },
  arabicKsa: {
    dealer_lan_code: "ar",
    dialect: "ksa",
    support_gender: ["Female", "Male"],
    default_avatar: "ali",
  },
  arabicEgypt: {
    dealer_lan_code: "ar",
    dialect: "egypt",
    support_gender: ["Female", "Male"],
    default_avatar: "ali",
  },
};

// Contains settings for each available camera angle
const cameraObj = {
  face: {
    camera_name: "API_face",
  },
  mobile: {
    camera_name: "API_mobile",
  },
  face_far: {
    camera_name: "API_face_side",
  },
  side_close_up: {
    camera_name: "API_profile_cinema",
  },
};

/**
 * Emotech DA
 * EmoDA is a SDK for displaying digital avatar in frontend applications.
 * You can use this SDK to create engaging and dynamic user experiences with features like:
 *  - make avatar speak
 *  - change avatar's spoken language
 *  - Set the background color or background image
 *  - Change the avatar camera angle
 *
 * @class
 */
class EmoDA {
  /**
   * Create EmoDA instance
   *
   * @constructor
   * @param {string} apiKey - your Apikey
   * @param {Object} [customStyle={}] - Optional custom CSS styles to apply to the video element.
   * @param {Function} [onDAInit] - Optional custom CSS styles to apply to the video element.
   * @param {Function} [onSpeak] - when DA start speak, SDK will send a signal, Bind your function to recevive it. Can leave it blank if you don't need it.
   * @param {Function} [onFinishSpeak] - when DA finish speak, SDK will send a signal. Bind your function to recevive it. Can leave it blank if you don't need it.
   */
  constructor(
    apiKey,
    videoStyle = {},
    onDAInit = () => {},
    onSpeak = () => {},
    onFinishSpeak = () => {}
  ) {
    this.apiKey = apiKey;
    this.retry = 0;
    this.pingInterval = "";
    this.player = null;
    this.rendererUrl = "";

    // To use London deployment, uncomment the lines below:
    this.requestUrl = "https://chatda.emotechlab.com";
    this.wsUrl = "wss://chatda.emotechlab.com/ws/apikey/";

    // To use the UAE deployment, uncomment the lines below:
    // this.requestUrl = "https://emoda-uae.api.emotechlab.com";
    // this.wsUrl = "wss://emoda-uae.api.emotechlab.com/ws/apikey/";

    this.wsToken = "";
    this.actorIndex = "yasmine";
    this.language = "english";
    this.dialect = "msa";
    this.reachLimit = false;
    this.daIsReady = false;
    this.videoStyle = videoStyle;

    //Optional
    this.onDAStartSpeaking = onSpeak;
    this.onDAFinishSpeaking = onFinishSpeak;
    this.onDAInitDone = onDAInit;

    // Not supported yet
    // this.changeBackgroundImage = this.setBackgroundImage.bind(this);
    this.askForRenderID = this.getRenderId.bind(this);

    this.renderIdCallBack = this.daReady.bind(this);

    this.startTalkingWebrtc = this.startTalkingSignal.bind(this);

    this.stopTalkingWebrtc = this.stopTalkingSignal.bind(this);
  }

  /**
   * Mounts the WebRTCPlayer component to the specified selector.
   * @param {string} selector - The selector to mount the component to.
   * @returns {Promise<void>} - A promise that resolves when the component is mounted.
   */
  async mount(selector) {
    // TODO: mount should only resolve after DA appears and initialization is in fact complete
    this.wsToken = await this.getApiToken();
    console.log("get ws token: ", this.wsToken);
    this.rendererUrl = await this.getRenderUrl();
    console.log("get render url: ", this.rendererUrl);

    this.connectRender();

    const config = await new Promise((resolve) => {
      this.ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        switch (String(data.type)) {
          case "config":
            resolve(data.peerConnectionOptions);
            break;
          case "offer":
            this.player.receiveOffer(data);
            break;
          case "answer":
            this.player.receiveAnswer(data);
            break;
          case "playerCount":
            console.log(data);
            break;
          case "iceCandidate":
            this.player.addIceCandidate(data.candidate);
            break;
        }
      };
    });

    this.player = new WebRtcPlayer(selector, {
      config,
      version: 5,
      videoStyle: this.videoStyle,
      dataChannelReadyCallBack: () => this.askForRenderID(),
      renderIdCallBack: () => this.renderIdCallBack(),
      startTalkingCallBack: () => this.startTalkingWebrtc(),
      stopTalkingCallBack: () => this.stopTalkingWebrtc(),
      handleCreateOffer: (offer) => this.ws.sendContent(JSON.stringify(offer)),
      handleCreateAnswer: (answer) =>
        this.ws.sendContent(JSON.stringify(answer)),
      handleIceCandidate: ({ candidate }) =>
        candidate?.candidate &&
        this.ws.sendContent(
          JSON.stringify({
            type: "iceCandidate",
            candidate,
          })
        ),
    });
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
   * This function to refreshToken.
   *
   */
  refreshToken() {
    console.log("Refresh Token");

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

  /**
   * Establishes a connection to the renderer which provides the video stream.
   * @returns {Promise} A promise that resolves when the connection is established, or rejects with an error if the API key limit is exceeded.
   */
  connectRender() {
    return new Promise((resolve, reject) => {
      if (this.reachLimit) {
        reject(new Error("Your API key has exceeded the limit."));
      }
      clearInterval(this.pingInterval);
      this.ws = new Socket(this.rendererUrl);
      this.ws.onclose = () => {
        (this.retry += 1) <= 3 && setTimeout(() => this.connectRender(), 3000);
      };
      this.ws.onerror = () => {
        (this.retry += 1) <= 3 && setTimeout(() => this.connectRender(), 3000);
      };
      this.ws.onopen = () => {
        setTimeout(
          () =>
            [WebSocket.OPEN, WebSocket.CONNECTING].includes(
              this.ws?.readyState
            ) && (this.retry = 0),
          1000
        );
      };

      this.pingInterval = setInterval(() => {
        this.ws.sendContent(
          JSON.stringify({
            type: "ping",
          })
        );
      }, 5000);
    });
  }

  /**
   * Retrieves the render URL for EmoDA.
   * @returns {Promise<string>} A promise that resolves to the render URL.
   */
  getRenderUrl() {
    let count = 1;
    let accessCodeWs = null;

    if (
      this.wsToken === null ||
      this.wsToken.trim().length == 0 ||
      this.wsToken == ""
    ) {
      return;
    }
    const url = this.wsUrl + this.wsToken;

    return new Promise((resolve) => {
      accessCodeWs = new WebSocket(url);
      accessCodeWs.onopen = () => {
        count = 1;
      };
      accessCodeWs.onmessage = (msg) => {
        if (msg.data == "ping") {
          accessCodeWs.send("pong");
        } else {
          let tokenMsg = JSON.parse(msg.data);
          if (tokenMsg.success) {
            if (tokenMsg.data.hasOwnProperty("render")) {
              resolve(tokenMsg.data.render + "?token=" + this.wsToken);
            } else if (tokenMsg.data.hasOwnProperty("token")) {
              this.wsToken = tokenMsg.data.token;
            }
          } else {
            console.log(tokenMsg.msg);
          }
        }
      };
      accessCodeWs.onclose = () => {
        setTimeout(() => this.getRenderUrl(count), 3000);
      };
      accessCodeWs.onerror = () => {
        setTimeout(() => this.getRenderUrl(count), 3000);
      };
    });
  }

  /**
   * Retrieves the render ID.
   * @returns {void}
   */
  getRenderId() {
    console.log("request render ID");
    this.player.emit(EmitMessageType.UI, "GUID");
  }

  /**
   * This function to makes the avatar speak.
   *
   * @param {string} text - The text for the avatar to speak.
   * @returns {Promise} - return a promise object
   * @rejects {Error} - show error
   */
  speak(text) {
    console.log("This is the function to make DA speak!", text, renderid);

    return new Promise((resolve, reject) => {
      if (!renderid) {
        reject(new Error("DA not ready, please wait."));
        return;
      } else if (!text) {
        reject(new Error("A sentence is required"));
        return;
      }

      if (this.player) {
        this.player.audio.muted = false;
        this.player.audio.play();
      } else {
        reject(new Error("DA not ready, something wrong"));
        return;
      }

      let formVoice = this.dialect + actorObj[this.actorIndex].gender;
      if (languageObj[this.language].dialect) {
        formVoice =
          languageObj[this.language].dialect + actorObj[this.actorIndex].gender;
      }
      formVoice = formVoice.replace("egyptMale", "ar-EG_Male_1");
      formVoice = formVoice.replace("egyptFemale", "ar-EG_Female_1");
      formVoice = formVoice.replace("ksaMale", "ar-SA_Male_1");
      formVoice = formVoice.replace("ksaFemale", "ar-SA_Female_1");

      let ttsObj = {
        engine: "Emotech",
        actor: formVoice,
      };

      let emotionObj = {
        expression: "happy",
        level: 0.3,
      };

      // sends http request with job specification for the avatar to speak
      this.request("post", `${this.requestUrl}/da/dealer`, {
        language: languageObj[this.language].dealer_lan_code,
        lipsync: true,
        facesync: false,
        text: text,
        actor: actorObj[this.actorIndex].dealer_actor,
        tts_params: ttsObj,
        emotion: emotionObj,
        renderer_id: renderid,
        debug: false,
      })
        .then((sentence) => {
          console.log("request send", sentence);
        })
        .catch((err) => {
          console.error("speak request err:", err);
        });
    });
  }

  /**
   * Changes the avatar's spoken language.
   *
   * @param {string} language - support: english, arabic
   * @returns {Promise} - return a promise object
   * @rejects {Error} - show error
   */
  setDALanguage(language) {
    // Currently we need to change avatar when switch language, like use female for arabic and male for english.
    // Default is English
    return new Promise((resolve, reject) => {
      if (!(language in languageObj)) {
        reject(new Error("Your language input is not valid"));
        return;
      }
      this.language = language;
      if (languageObj[this.language].dialect) {
        if (
          !languageObj[this.language].support_gender.includes(
            actorObj[this.actorIndex].gender
          )
        ) {
          console.warn(
            "Your selected dialect conflicts with your avatar, so we updated your avatar to the language default avatar."
          );
          this.actorIndex = languageObj[this.language].default_avatar;
          this.setAvatar(languageObj[this.language].default_avatar);
        }
      }
    });
  }

  /**
   * Skip what avatar is currently speaking
   *
   * @returns {void}
   */
  skipSpeech() {
    this.player.emit(EmitMessageType.UI, {
      StopTalking: true,
    });
    console.log("Current Speech is skipped");
  }

  /**
   * Change the backround color.
   *
   * @param {string} colorHexCode - the color hexcode for the color you wants to change.
   * @returns {void}
   */
  setBackgroundColor(colorHexCode) {
    console.log("Changing background colour to", colorHexCode);

    this.player.emit(EmitMessageType.UI, {
      ChangeBackground: colorHexCode,
    });
  }

  /**
   * Change the avatar camera angle.
   *
   * @param {string} cameraID - support: face, mobile, face_far, side_close_up
   * @returns {Promise} - return a promise object
   * @rejects {Error} - show error
   */
  setCameraAngle(cameraID, blendTime) {
    console.log("This is the function to change camera angle", cameraID);
    return new Promise((resolve, reject) => {
      if (isNaN(blendTime)) {
        reject(new Error("Blend time is not a valid number "));
      } else if (blendTime < 0) {
        reject(new Error("Blend time needs to be >= 0 "));
      } else if (!(cameraID in cameraObj)) {
        reject(new Error("Your cameraID input is not valid"));
      } else {
        this.player.emit(EmitMessageType.UI, {
          "ChangeCamera.Camera": cameraObj[cameraID].camera_name,
          "ChangeCamera.BlendTime": blendTime,
        });
      }
    });
  }

  /**
   * Change the avatar.
   *
   * @param {string} avatarName - support: ali, james, laura, aisha
   * @returns {Promise} - return a promise object
   * @rejects {Error} - show error
   */
  setAvatar(avatarName) {
    return new Promise((resolve, reject) => {
      if (!(avatarName in actorObj)) {
        reject(new Error("Your avatar name is not valid"));
        return;
      }
      this.actorIndex = avatarName;
      console.log("set avatar: ", actorObj[avatarName].render_name);
      this.player.emit(EmitMessageType.UI, {
        Actor: actorObj[avatarName].render_name,
      });
    });
  }

  /**
   * use this function to set the stream size.
   *
   * @param {number} width - stream width
   * @param {number} height - stream height
   * @returns {Promise} - return a promise object
   * @rejects {Error} - show error
   */
  setVideoSize(width, height) {
    return new Promise((resolve, reject) => {
      if (isNaN(width)) {
        reject(new Error("width is not a valid number "));
      } else if (width <= 0) {
        reject(new Error("width needs to be >= 0 "));
      } else if (isNaN(height)) {
        reject(new Error("height is not a valid number "));
      } else if (height <= 0) {
        reject(new Error("height needs to be >= 0 "));
      } else {
        this.player.emit(EmitMessageType.Command, {
          "Resolution.Width": width,
          "Resolution.Height": height,
        });
      }
    });
  }

  /**
   * Checks if a given string is a valid URL.
   *
   * @param {string} inputStr - The string to be checked.
   * @returns {boolean} - True if the string is a valid URL, false otherwise.
   */
  isValidUrl(inputStr) {
    var urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-zA-Z]{2,6})(\/[\w.-]*)*\/?$/;

    return urlPattern.test(inputStr);
  }

  /**
   * use this function to change background image size.
   *
   * @param {string} imageUrl - Must be a pubilc accessible image link.
   * @rejects {Error} - show error
   */
  setBackgroundImage(imageUrl) {
    return new Promise((resolve, reject) => {
      if (!this.isValidUrl(imageUrl)) {
        reject(new Error("imageUrl is not a valid url "));
        return;
      }
      console.log("loading new background, it might take a while", imageUrl);
      this.player.emit(EmitMessageType.UI, { ChangeBackground: imageUrl });
    });
  }

  /**
   * Starts the talking signal.
   */
  startTalkingSignal() {
    console.log("Da start talking");
    this.onDAStartSpeaking();
  }

  /**
   * Stops the talking signal.
   */
  stopTalkingSignal() {
    console.log("Da stop talking");
    this.onDAFinishSpeaking();
  }

  /**
   * Initializes the DA (Digital Assistant) and sets everything to default.
   */
  daReady() {
    if (!this.daIsReady) {
      // console.log("Da is ready to use, setting everything to default.");
      // const { clientWidth: x, clientHeight: y } = this.player.video;
      // this.setVideoSize(x, y);
      // this.setAvatar(this.actorIndex);
      // this.setBackgroundColor("#d9c4c4");
      // this.setCameraAngle("face", 0);
      this.onDAInitDone();
      this.daIsReady = true;
    } else {
      console.log("Just updating render ID due to skip speech.");
    }
  }
}

export default EmoDA;
