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
let recvTransport = null;
let forceTcp = false;
let useDataChannel = false;
let producer = null;
let consumer = null;
let produce = true;
let consume = true;
let protoo;
let routerRtpCapabilities;
let deviceHandlerName;

const goConnect = ({sender}) => {
    produce = sender ? true : false;
    consume = sender ? false : true;
    const url = `wss://192.168.0.51:4443/?roomId=${roomName}&peerId=${peerId}&consumerReplicas=0`;
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
    try {
        deviceHandlerName = mediasoupClient.detectDevice();
        if (deviceHandlerName) {
            console.log("detected handler: %s", deviceHandlerName);
        } else {
            console.warn("no suitable handler found for current browser/device");
        }

        mediasoupDevice = new mediasoupClient.Device({ handlerName : deviceHandlerName });
        console.log('>>>> mediasoupDevice: ',mediasoupDevice);
        routerRtpCapabilities = await protoo.request('getRouterRtpCapabilities');
        console.log('rtpCapabilites: ',routerRtpCapabilities);

        await mediasoupDevice.load({ routerRtpCapabilities });
        console.log('mediasoup device : ',mediasoupDevice);

        if(produce)
        {
            //4. create transport
            const transportInfo = await protoo.request('createWebRtcTransport',{
                forceTcp         : forceTcp,
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
                    console.log('>>>> sendTransport.on("produce") : ',id);
                    callback({ id });
                } catch (error) {
                    errback(error);
                }
            });
            //send produce by datachannel to router
            sendTransport.on('producedata', async ({sctpStreamParameters,label,protocol,appData},callback,errback) => {
                console.log(
                    '"producedata" event: [sctpStreamParameters:%o, appData:%o]',
                    sctpStreamParameters, appData);

                try
                {
                    const { id } = await peer.request('produceData',{
                        transportId : sendTransport.id,
                        sctpStreamParameters,
                        label,
                        protocol,
                        appData
                    });
                    console.log('>>>> sendTransport.on("producedata") : ',id);
                    callback({ id });
                } catch (error) {
                    errback(error);
                }
            });

            // Join now into the room.
            // NOTE: Don't send our RTP capabilities if we don't want to consume.
            const { peers } = await protoo.request('join',{
                displayName     : peerId,
                device          : mediasoupDevice,
                rtpCapabilities : true
                    ? mediasoupDevice.rtpCapabilities
                    : undefined,
                sctpCapabilities : useDataChannel && true
                    ? mediasoupDevice.sctpCapabilities
                    : undefined
            });

            producer = await sendTransport.produce(params);
            producer.on('transportclose', () => {

            });

            producer.on('trackended', () => {

            });

        }

        // Create mediasoup Transport for receiving (unless we don't want to consume).
        if (consume)
        {
            const transportInfo = await protoo.request('createWebRtcTransport',{
                forceTcp         : forceTcp,
                producing        : false,
                consuming        : true,
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

            recvTransport = mediasoupDevice.createRecvTransport({
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
                iceServers 	       : [],
                additionalSettings :
                    { encodedInsertableStreams: false }
            });

            recvTransport.on('connect', ({ iceParameters, dtlsParameters }, callback, errback) => {
                protoo.request('connectWebRtcTransport',{
                    transportId : recvTransport.id,
                    iceParameters,
                    dtlsParameters
                })
                .then(callback)
                .catch(errback);
            });
            // Join now into the room.
            // NOTE: Don't send our RTP capabilities if we don't want to consume.
            const { peers } = await protoo.request('join',{
                displayName     : peerId,
                device          : mediasoupDevice,
                rtpCapabilities : true
                    ? mediasoupDevice.rtpCapabilities
                    : undefined,
                sctpCapabilities : useDataChannel && true
                    ? mediasoupDevice.sctpCapabilities
                    : undefined
            });

            consumer = await recvTransport.consume({
                id,
                producerId,
                kind,
                rtpParameters,
                // NOTE: Force streamId to be same in mic and webcam and different
                // in screen sharing so libwebrtc will just try to sync mic and
                // webcam streams from the same remote peer.
                streamId : `${peerId}-${appData.share ? 'share' : 'mic-webcam'}`,
                appData  : { ...appData, peerId } // Trick.
            });

            // Store in the map.
            consumers.set(consumer.id, consumer);

            consumer.on('transportclose', () =>
            {
                consumers.delete(consumer.id);
            });

        }

    } catch (error) {
        console.error('Device() error :',error);
    }
    
}

const streamSuccess = (stream) => {
    localVideo.srcObject = stream
    const track = stream.getVideoTracks()[0]
    params = {
      track,
      ...params
    }
    console.log('params : ',params);
    goConnect({sender:true})
}
const getLocalStream = () => {
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        ...VIDEO_CONSTRAINS['hd']
      }
    })
    .then(streamSuccess)
    .catch(error => {
      console.log(error.message)
    })
}
const goConsume = () => {
    consume = true;
    console.log('click consume');
    goConnect({sender:false})
}

btn_webcam.disabled = false;
btn_webcam.addEventListener('click', getLocalStream)
btn_subscribe.addEventListener('click', goConsume)