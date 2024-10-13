const mediasoup = require('mediasoup-client');
const protooClient = require('protoo-client');

const path = window.location.pathname.split('/');
const roomName = path[2];
const peerId = path[3];

const url = `wss://localhost:4443/?roomId=${roomName}&peerId=${peerId}&consumerReplicas=0`;
console.log(url);
const options = {
    retries    : 5,
    factor     : 2,
    minTimeout : 1 * 1000,
    maxTimeout : 8 * 1000
  };
const transport = new protooClient.WebSocketTransport(url)
const peer = new protooClient.Peer(transport);

peer.on('open', async () => {
    console.log('Connected success!!');
    const data = await peer.request('getOrRouter');
    console.log('open :',data);
});

peer.on('request', async (request,accept,reject) =>{
    console.log('proto "request" event [method:%s, data:$o]',request.method,request.data);
})

peer.on('failed', (err) =>{
    console.log('failed',err);
});
peer.on('disconnected', () => {
    console.log('disconnected');
})

peer.on('notification',(value) => {
    console.log('notify:',value);
});

const getLocalStream = () => {
    console.log('click btn');

}

const goConsume = () =>{
    console.log('....> click subscribe');
}
btn_webcam.disabled = false;
btn_webcam.addEventListener('click', getLocalStream)
btn_subscribe.addEventListener('click', goConsume)