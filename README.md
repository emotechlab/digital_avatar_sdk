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

First you will need an apikey, same apikey can be use to run both asr and da.

Once you have API key, go to  `asr_example.html` and `da_example.html`, replace this line here: 
![image](https://github.com/user-attachments/assets/39eecc22-5603-4381-beb8-b651a961ab15)

And then run this command below: 
npx http-server -c-1

You will see this in the command line window:
![image](https://github.com/user-attachments/assets/f9f26f0b-fffe-467d-89cb-81488d6e4f0a)


Go to http://127.0.0.1:8080, you will see: ![image](https://github.com/user-attachments/assets/c4499bad-539f-497c-9b36-5f57524690f8)

Click Examples, da_example: ![image](https://github.com/user-attachments/assets/396715f5-d60c-48e8-9ece-3a1f5cf2b780)

If it run successfully, you will see a website like this and you can try out basic DA function here: 
![image](https://github.com/user-attachments/assets/666a99c1-93b0-46d6-b240-bc54a9ea4f27)

