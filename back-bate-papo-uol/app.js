import express, { json } from "express";
import cors from 'cors';
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import joi from 'joi';
import dotenv from "dotenv";
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
  db = mongoClient.db("api_bate_papo_uol");
});

const app = express();
app.use(cors());
app.use(json());

const userSchema = joi.object({
  name: joi.string().required()
});

/* Participants Routes */
app.post('/participants', async (req, res) => {
  const user = { ...req.body, lastStatus: Date.now() };
  const validation = userSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    res.status(422).send(validation.error.details.map(error => error.message));
    return;
  }

  try {
    /* await db.collection('users').deleteMany({}); */
    /* await db.collection('messages').deleteMany({}); */

    const loggedUsers = await db.collection('users').find({}).toArray();
    const loggedUsersCollection = loggedUsers.map(user => user.name);
    const result = loggedUsersCollection.find(loggedUser => loggedUser === user.name);

    console.log("result: ",result);
    console.log("loggedUsersCollection: ", loggedUsersCollection);

    if(result === undefined){
      await db.collection('users').insertOne(user);

      let status = {
        from: user.name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: dayjs(user.lastStatus).format('HH:MM:SS')
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
  const from = req.header('User');
  const message = { ...req.body, from };
  const loggedUsers = await db.collection('users').find({}).toArray();

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required(),
    from: joi.string().valid( ...loggedUsers ).required()
  });
  const validation = messageSchema.validate(message, { abortEarly: false });
  if (validation.error) {
    res.status(422).send(validation.error.details.map(error => error.message));
    return;
  }

  try {
    message.time = dayjs(Date.now()).format('HH:MM:SS')
    console.log(message);

    await db.collection('messages').insertOne(message);
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500); 
  }
});

app.listen(5000, () => {
  console.log('Running app in http://localhost:5000');
});