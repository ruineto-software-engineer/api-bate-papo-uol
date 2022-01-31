import express, { json } from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from 'cors';
import dayjs from "dayjs";
import joi from 'joi';
import { stripHtml } from "string-strip-html";
import dotenv from "dotenv";
dotenv.config();



/* MongoDB - Data Base Connection */
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
  db = mongoClient.db("api_bate_papo_uol");
});

const app = express();
app.use(cors());
app.use(json());



/* Participants Routes */
app.post('/participants', async (req, res) => {
  const user = { ...req.body, lastStatus: Date.now() };

  const userSchema = joi.object({
    name: joi.string().required()
  });
  const validation = userSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    res.status(422).send(validation.error.details.map(error => error.message));
    return;
  }

  try {
    const loggedUsers = await db.collection('users').find({}).toArray();
    const loggedUsersCollection = loggedUsers.map(user => user.name);
    const loggedUserSearch = loggedUsersCollection.find(loggedUser => loggedUser === user.name);
    if(loggedUserSearch === undefined){
      const userSanitazed = { 
        name: stripHtml(user.name).result.trim(),
        lastStatus: user.lastStatus
      };
      await db.collection('users').insertOne(userSanitazed);

      let status = {
        from: user.name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: dayjs(user.lastStatus).format('HH:mm:ss')
      }
      await db.collection('messages').insertOne(status);

      res.sendStatus(201);
    }else{
      res.status(409).send("O nome informado não pode ser utilizado, pois já está em uso!");
      return;
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.get('/participants', async (req, res) => {
  try {
    const loggedUsers = await db.collection('users').find({}).toArray();
    res.send(loggedUsers);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});



/* Messages Routes */
app.post('/messages', async (req, res) => {
  try {
    const from = req.header('User');
    const message = { from, ...req.body };
    const loggedUsers = await db.collection('users').find({}).toArray();
    const loggedUsersCollection = loggedUsers.map(user => user.name);

    const messageSchema = joi.object({
      from: joi.string().valid( ...loggedUsersCollection ).required(),
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid('message', 'private_message').required()
    });
    const validation = messageSchema.validate(message, { abortEarly: false });
    if (validation.error) {
      res.status(422).send(validation.error.details.map(error => error.message));
      return;
    }

    message.time = dayjs(Date.now()).format('HH:mm:ss');
    const messageSanitazed = {
      from: stripHtml(message.from).result.trim(),
      to: stripHtml(message.to).result.trim(),
      text: stripHtml(message.text).result.trim(),
      type: stripHtml(message.type).result.trim(),
      time: message.time
    };
    await db.collection('messages').insertOne(messageSanitazed);
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500); 
  }
});

app.get('/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit);
    const currentUser = req.header('User');
    const messages = await db.collection('messages').find({}).toArray();
    const filteredMessages = messages.filter((message) => {
      if (
        message.type === 'status' || message.type === 'message' || 
        message.from === currentUser || message.to === currentUser
      ) {
        return true;
      }
      else {
        return false;
      }
    });
  
    let currentMessages;
    let currentMessagesUser;
    if(limit === NaN){
      currentMessages = filteredMessages.length;
    }else{
      currentMessages = limit;
    }
  
    currentMessagesUser = filteredMessages.slice(-currentMessages);
    res.send(currentMessagesUser);
  } catch (error) {
    console.log(error);
    res.sendStatus(500); 
  }
});

app.delete('/messages/:idMessage', async (req, res) => {
  const user = req.header('User');
  const idMessage = req.params.idMessage;

  try {
    const searchedMessage = await db.collection('messages').findOne({ _id: new ObjectId(idMessage) });
    if(!searchedMessage){
      res.sendStatus(404);
      return;
    }

    if(searchedMessage.from !== user){
      res.sendStatus(401);
      return;
    }

    await db.collection('messages').deleteOne({ _id: searchedMessage._id });
    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.put('/messages/:idMessage', async (req, res) => {
  const idMessage = req.params.idMessage;
  const from = req.header('User');
  const message = { from, ...req.body };
  
  try {
    const loggedUsers = await db.collection('users').find({}).toArray();
    const loggedUsersCollection = loggedUsers.map(user => user.name);
  
    const messageSchema = joi.object({
      from: joi.string().valid( ...loggedUsersCollection ).required(),
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid('message', 'private_message').required()
    });
    const validation = messageSchema.validate(message, { abortEarly: false });
    if (validation.error) {
      res.status(422).send(validation.error.details.map(error => error.message));
      return;
    }

    message.time = dayjs(Date.now()).format('HH:mm:ss');
    const updatedMessageSanitazed = {
      from: stripHtml(message.from).result.trim(),
      to: stripHtml(message.to).result.trim(),
      text: stripHtml(message.text).result.trim(),
      type: stripHtml(message.type).result.trim(),
      time: message.time
    };

    const searchedMessage = await db.collection('messages').findOne({ _id: new ObjectId(idMessage) });
    if(!searchedMessage){
      res.sendStatus(404);
      return;
    }

    if(searchedMessage.from !== from){
      res.sendStatus(401);
      return;
    }

    await db.collection('messages').updateOne(
      { _id: searchedMessage._id },
      { $set: updatedMessageSanitazed }
    );
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});



/* Status Route */
app.post('/status', async (req, res) => {
  const user = req.header('User');
  if(!user){
    res.sendStatus(400);
    return;
  }

  try {
    const loggedUser = await db.collection('users').findOne({ name: user });
    if(!loggedUser){
      res.sendStatus(404);
      return;
    }

    let timestamp = Date.now();
    await db.collection('users').updateOne(
      { _id: loggedUser._id  },
      { $set: { lastStatus: timestamp } }
    );
    
    res.sendStatus(200);
    return;
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
    return;
  }
});



/* Away From Keyboard */
setInterval(async () => {
  let timestampOut = Date.now() - 10000;
  try {
    const usersAFK = await db.collection('users').find({ lastStatus: { $lte: timestampOut } }).toArray();
    if(usersAFK.length === 0){
      return;
    }
    await db.collection('users').deleteMany({ lastStatus: { $lte: timestampOut } });

    let messagesOut = usersAFK.map(userAFK => {
      let newFormattedMessage = {
        from: userAFK.name,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
      }
      return newFormattedMessage;
    })

    await db.collection('messages').insertMany([ ...messagesOut ]);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
}, 15000);



/* Listen - Running app in http://localhost:5000 */
app.listen(5000, () => {
  console.log('Running app in http://localhost:5000');
});