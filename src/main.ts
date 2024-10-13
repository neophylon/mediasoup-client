import fs from 'fs';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import *as https from 'https';
import *as http from 'http';
import *as protoo from 'protoo-server';
import { ProtooConnection } from './lib/protoo'

const main = async () => {
    const __dirname = path.resolve();
    const app = express();

    const port = 8000;
    const tls = {
        key: fs.readFileSync('./certs/privkey.pem','utf-8'),
        cert: fs.readFileSync('./certs/fullchain.pem','utf-8')
    };
    app.use(bodyParser.json());
    // app.param(
    //     'roomId',(req,res,next,roomId) =>
    //     {
    //         next();
    //     }
    // )
    // app.get('/', (req, res) => {
    //     res.send('Hello from mediasoup app!')
    // })
    app.get('*',(req,res,next) =>{
        const path = '/api/';
        if(req.path.indexOf(path) == 0 && req.path.length > path.length) return next();
        res.send('You need to spcify a room name ');
    });

    app.use('/api/:roomId/:peerId', express.static(path.join(__dirname, 'public')));

    const httpsServer = https.createServer(tls,app);
    // const httpServer = http.createServer(app);
    const options =
    {
      maxReceivedFrameSize     : 960000, // 960 KBytes.
      maxReceivedMessageSize   : 960000,
      fragmentOutgoingMessages : true,
      fragmentationThreshold   : 960000
    };
    
    const protooWebSocketServer = new protoo.WebSocketServer(httpsServer,options);
    // const protooWebSocketServer = new protoo.WebSocketServer(httpServer,options);

    ProtooConnection(protooWebSocketServer);

    httpsServer.listen(port, ()=>{
    // httpServer.listen(port, ()=>{
        console.log('Server started on port :',port);
    })
}

export { main }