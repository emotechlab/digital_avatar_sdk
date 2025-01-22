# Digital Assistant API Client

Welcome to the official Javascript client for Emotech's Digital Assistant API's. The system works with three modular API's/clients:

- [ASR](emoASRV2.js): Automatic Speech Recognition for talking with the avatar.
- [emoDA](emoDA.mjs): The client which controls things like:
  - The avatar selection
  - What language it speaks (English, Arabic msa, Arabic ksa, Arabic egypt)
  - What the avatar says
  - Background

## HTML Examples

To help get started using the DA API's various examples are provided in the `examples/` directory:

- `asr_example.html`: A simple example of interacting with the ASR endpoint. Click to record audio and the transcript is displayed.
- `da_example.html` An example of all the DA functionality splat onto one webpage. This webpage is intended just as a demo of everything thats offered rather than how a webpage using the avatar might look. It serves as a useful reference for using each feature of the DA.

## How to run Examples

npx http-server -c-1
