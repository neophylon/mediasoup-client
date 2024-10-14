const mediasoupClient = require('mediasoup-client');
const protooClient = require('protoo-client');

const path = window.location.pathname.split('/');
const roomName = path[2];
const peerId = path[3];
const VIDEO_CONSTRAINS =
{
	qvga : { width: { ideal: 320 }, height: { ideal: 240 } },
	vga  : { width: { ideal: 640 }, height: { ideal: 480 } },
	hd   : { width: { ideal: 1280 }, height: { ideal: 720 } }
};

const PC_PROPRIETARY_CONSTRAINTS =
{
	// optional : [ { googDscp: true } ]
};

let params = {
    // mediasoup params
    encodings: [
        {
        rid: 'r0',
        maxBitrate: 100000,
        scalabilityMode: 'S1T3',
        },
        {
        rid: 'r1',
        maxBitrate: 300000,
        scalabilityMode: 'S1T3',
        },
        {
        rid: 'r2',
        maxBitrate: 900000,
        scalabilityMode: 'S1T3',
        },
    ],
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
    codecOptions: {
        videoGoogleStartBitrate: 1000
    }
}
let mediasoupDevice = null;
let sendTransport = null;
let forceTcp = false;
let useDataChannel = true;
let producer = null;
let produce = true;
let consume = false;
let protoo;
let routerRtpCapabilities;
let deviceHandlerName;

const goConnect = (isProducer) => {
    const url = `wss://192.168.1.152:4443/?roomId=${roomName}&peerId=${peerId}&consumerReplicas=0`;
    console.log(url);
    produce = isProducer;
    const options = {
        retries    : 5,
        factor     : 2,
        minTimeout : 1 * 1000,
        maxTimeout : 8 * 1000
    };
    const protooTransport = new protooClient.WebSocketTransport(url)
    protoo = new protooClient.Peer(protooTransport);


    // joinRoom
    protoo.on('open', () =>  joinRoom());

    protoo.on('failed', (err) =>{
        console.log('failed',err);
    });

    protoo.on('disconnected', () => {
        console.log('disconnected');
    })

    protoo.on('close', () => {
        console.log('protooWebSocket close');
    });

    protoo.on('request', async(request, accept,reject) =>{

    });
    protoo.on('notification',(notification) => {
        console.log('notify:',notification);
    });
}

const joinRoom = async () => {
    console.log('join room!!');
    //1. get rtpCapabilities;
    
    try {
        deviceHandlerName = mediasoupClient.detectDevice();
        if (deviceHandlerName) {
            console.log("detected handler: %s", deviceHandlerName);
        } else {
            console.warn("no suitable handler found for current browser/device");
        }
        //2. load device
        mediasoupDevice = new mediasoupClient.Device({ handlerName : deviceHandlerName });
        console.log('>>>> mediasoupDevice: ',mediasoupDevice);
        routerRtpCapabilities = await protoo.request('getRouterRtpCapabilities');
        console.log('rtpCapabilites: ',routerRtpCapabilities);

        await mediasoupDevice.load({ routerRtpCapabilities });
        console.log('mediasoup device : ',mediasoupDevice);

        // Join now into the room.
        // NOTE: Don't send our RTP capabilities if we don't want to consume.
        const { peers } = await protoo.request('join',{
            displayName     : peerId,
            device          : mediasoupDevice,
            rtpCapabilities : consume
                ? mediasoupDevice.rtpCapabilities
                : undefined,
            sctpCapabilities : useDataChannel && consume
                ? mediasoupDevice.sctpCapabilities
                : undefined
        });


        if(produce)
        {
            //4. create transport
            const transportInfo = await protoo.request('createWebRtcTransport',{
                forceTcp         : false,
                producing        : true,
                consuming        : false,
                sctpCapabilities : useDataChannel
                    ? mediasoupDevice.sctpCapabilities
                    : undefined

            });
            const {
                id,
                iceParameters,
                iceCandidates,
                dtlsParameters,
                sctpParameters
            } = transportInfo;

            console.log('createWebRtcTransport',transportInfo);
            //connect transport
            sendTransport = mediasoupDevice.createSendTransport({
                id,
                iceParameters,
                iceCandidates,
                dtlsParameters :
                {
                    ...dtlsParameters,
                    // Remote DTLS role. We know it's always 'auto' by default so, if
                    // we want, we can force local WebRTC transport to be 'client' by
                    // indicating 'server' here and vice-versa.
                    role : 'auto'
                },
                sctpParameters,
                iceServers             : [],
                proprietaryConstraints : PC_PROPRIETARY_CONSTRAINTS,
                additionalSettings 	   :
                    { encodedInsertableStreams: false }            
            });

            sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                console.log('>>>> sendTransport connect')
                await protoo.request('connectWebRtcTransport',{
                    transportId : sendTransport.id,
                    iceParameters,
                    dtlsParameters
                })
                .then(callback)
                .catch(errback);
            })

            sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
                console.log('>>>> sendTransport produce')
                try
                {
                    // eslint-disable-next-line no-shadow
                    const { id } = await protoo.request('produce',{
                        transportId : sendTransport.id,
                        kind,
                        rtpParameters,
                        appData
                    });

                    callback({ id });
                } catch (error) {
                    errback(error);
                }
            });
            sendTransport.on('producedata', async ({sctpStreamParameters,label,protocol,appData},callback,errback) => {
                console.debug(
                    '"producedata" event: [sctpStreamParameters:%o, appData:%o]',
                    sctpStreamParameters, appData);

                try
                {
                    // eslint-disable-next-line no-shadow
                    const { id } = await peer.request(
                        'produceData',
                        {
                            transportId : sendTransport.id,
                            sctpStreamParameters,
                            
                            label,
                            protocol,
                            appData
                        });

                    callback({ id });
                } catch (error) {
                    errback(error);
                }
            });

            producer = await sendTransport.produce(params);
            producer.on('transportclose', () => {

            });

            producer.on('trackended', () => {

            });

        }


    } catch (error) {
        console.error('Device() error :',error);
    }
    
    
    //3.join
    // const peerInfo = await protoo.request('join',{
    //     displayName:"neo",
    //     device: mediasoupDevice,
    //     rtpCapabilities: rtpCapabilities,
    //     sctpCapabilities: undefined
    // }); 
    // console.log('peerInfo :',peerInfo);



    //produce
    // console.log('>>>> params',params);
    // producer = await peer.request('produce',{
    //     transportId : transport.id,
    //     kind: params.track.kind,
    //     rtpParameters: rtpCapabilities,
    //     ...params
    // });
    // producer.on('trackended', () => {
    //     console.log('track ended')
    //     // close video track
    // })
    
    // producer.on('transportclose', () => {
    //     console.log('transport ended')
    //     // close video track
    // })
}

const streamSuccess = (stream) => {
    localVideo.srcObject = stream
    const track = stream.getVideoTracks()[0]
    params = {
      track,
      ...params
    }
    console.log('params : ',params);
    goConnect(true)
}
const getLocalStream = () => {
    produce = true;
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: {
          min: 640,
          max: 1920,
        },
        height: {
          min: 400,
          max: 1080,
        }
      }
    })
    .then(streamSuccess)
    .catch(error => {
      console.log(error.message)
    })
}

btn_webcam.disabled = false;
btn_webcam.addEventListener('click', getLocalStream)
// btn_subscribe.addEventListener('click', goConsume)