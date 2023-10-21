export const helpBotMsgs = {
  first: `Hi I am your little assistant to test the Chat and other functions of VocChat! 
         I am very simple, but you can ask me for help with the following keywords: <br>
          *Chat* – Explain me the features of this chat.. <br>
*Vocabs* – Tell me more about the vocab options. <br>
*Learning* – Give me information of how the learning works on VocChat. <br>
*Workbooks* – Tell me what workbooks are for. <br>
*Notes* – Help me with the Notes system.`,
  defaultMsg: `Try typing the following Keywords to get specific help:
  Chat, Vocabs, Learning, Workbooks, Notes`,
  chat: `To start chatting add someone by clicking on the *+* Icon. You can search users by name or email. <br> In the Chat you can do more than just chat. By hovering over a Message you can give direct emoji responses or choose other options like: answering, editing or saving a message to the Notes. Additionally, you can highlight your text by surrounding the text in * like I *love* Spanish.
  Edit – A tool to correct the message you received, to help you chat partner to improve his or her language skills. Write the message in the correct way and see how it is shown.
  Notes – If a message teaches you something useful you can save it to your Notebook, so you can find it easier in the future.
  The Chat has additional tools like filtering and searching, which you can use.`,
  vocabs: `There is a lot to say about the vocabs. You can create you own vocabs by pressing the “+” button on the vocab site. All the vocabs you create are saved in the database, so that you can access them from everywhere.
  Creating – When you create your vocabs the vocab language is automatically set to your current learn language and the translation to your default translation language. But you can change the language on the right, if you need to. 
Options – In the create window you have a options menu, which you should check out to change it to your liking
DB-Vocs - There are also a selection of vocabs you can find under the “DB-vocs” field on the vocab site, which you can browse and add either all of them or just the ones you like to your own vocabs. 
Dictionary – Currently only a persian – german dictionary is included, but it contains around 10.000 words, which you can browse or add to your vocabs.
Sharing – You can share your Vocabs with others by clicking on the share button on a vocab card. You can also share whole workbooks with others.`,
  vocab: `There is a lot to say about the vocabs. You can create you own vocabs by pressing the “+” button on the vocab site. All the vocabs you create are saved in the database, so that you can access them from everywhere.
  Creating – When you create your vocabs the vocab language is automatically set to your current learn language and the translation to your default translation language. But you can change the language on the right, if you need to. 
Options – In the create window you have a options menu, which you should check out to change it to your liking
DB-Vocs - There are also a selection of vocabs you can find under the “DB-vocs” field on the vocab site, which you can browse and add either all of them or just the ones you like to your own vocabs. 
Dictionary – Currently only a persian – german dictionary is included, but it contains around 10.000 words, which you can browse or add to your vocabs.
Sharing – You can share your Vocabs with others by clicking on the share button on a vocab card. You can also share whole workbooks with others.`,
  learning: `The Learning feature includes 4 modes of learning and a options menu, where you can specify how many vocabs you want to learn in a session and other options like the method of checking if your input is correct.
  Default Route – In the Default Route the vocabs are sorted based on how you set the importance and your recent learning results. So if you set a high importance and your recent learning results were poor, this vocab will reappear pretty quickly.
  Workbook Route – In this Method you can learn a complete workbook you created or a specific number of Vocabs from this workbook.
  Random – Gives you a set of randomly selected Vocabs.
  Mistakes – Here you get the Vocabs you recently answered wrong.`,
  workbooks: `You can create workbooks and add and remove Vocabs from your Vocablist. This is a tool to group Vocabs to a set in which you want to learn them.`,
  notes: `In the Notebook section you can add Notes like phrases you have heard and want to remember. You can also save messages of the Chat to the Notebook. `,
  note: `In the Notebook section you can add Notes like phrases you have heard and want to remember. You can also save messages of the Chat to the Notebook. `,
};

export const helpBotKeywords = Object.keys(helpBotMsgs);
