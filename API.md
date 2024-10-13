1. Is exist a room(router)
URI: /?info=true&roomId & 
- live (1:N)
- chat (1:1)
- meet (N:N)
1.1 Execute order
1.2 Connect room : /rooms/:roomId
-> getRouterRtpCapabilities

2. create broadcaster: 사용자를 그룹화 하기 위해 생성
URI: /rooms/:roomId/broadcasters
_broadcasters = new Map();
-> virtual object
-> 1명의 사용자
const broadcaster =
{
    id,
    data :
    {
        displayName,
        device :
        {
            flag    : 'broadcaster',
            name    : device.name || 'Unknown device',
            version : device.version
        },
        rtpCapabilities,
        transports    : new Map(),
        producers     : new Map(),
        consumers     : new Map(),
        dataProducers : new Map(),
        dataConsumers : new Map()
    }
};
this._broadcasters.set(broadcaster.id, broadcaster);
-> 다른 사용자에서 신규 사용자 전파
otherPeer.notify(
    'newPeer',
    {
        id          : broadcaster.id,
        displayName : broadcaster.data.displayName,
        device      : broadcaster.data.device
    })
    .catch(() => {});
-> rtpCapabilities 있으면 _broadcaster에 있는 다른 사용자의 produce 하는것을 consume

3. create transport
URI: /rooms/:roomId/broadcasters/:broadcasterId/transports
-> PlainTransport(로컬 파일 또는 외부 URL) or WebRtcTransport 생성
-> type: webrtc
==> this._mediasoupRouter.createWebRtcTransport(webRtcTransportOptions);
==> return 
return {
    id             : transport.id,
    iceParameters  : transport.iceParameters,
    iceCandidates  : transport.iceCandidates,
    dtlsParameters : transport.dtlsParameters,
    sctpParameters : transport.sctpParameters
};
-> type: plain
==> this._mediasoupRouter.createPlainTransport(plainTransportOptions);
==> return
return {
    id       : transport.id,
    ip       : transport.tuple.localIp,
    port     : transport.tuple.localPort,
    rtcpPort : transport.rtcpTuple ? transport.rtcpTuple.localPort : undefined
};
* plain 영상을 consume 하기 위해 7번 실행

-> 생성 완료되면 broadcaster에 등록 (transport.id, transport)

4. connect transport
URI: /rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/connect
-> _broadcaster.get(broadcasterId) 있는지 검사
-> 있다면 해당 broadcaster 선택
--> transport = broadcaster.data.transports.get(transportId);
-> 접속
--> transport.connect({ dtlsParameters });

5. produce
URI: /rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/producers
-> _broadcaster.get(broadcasterId) 있는지 검사
-> 있다면 해당 broadcaster 선택
--> transport = broadcaster.data.transports.get(transportId);
-> produce
--> producer = await transport.produce({ kind, rtpParameters });
-> producer을 broadcaster.data.producer.set(producer.id,producer) 저장
-> 같은 room 에는 사용에게 producer을 consume 하도록 _createConsumer({ consumerPeer, producerPeer, producer }) 실행
* _createConsumer
>>> rtpCapabilities 있는지, router를 canConsume 할 수 있는지 확인
>>> _broadcaster에서 자신외 peer에 transports가 consume 이 아니면
>>> transport.consume() 실행
>>> 

6. consume
URI: /rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/consume
-> _broadcaster.get(broadcasterId) 있는지 검사
-> 있다면 해당 broadcaster 선택
--> transport = broadcaster.data.transports.get(transportId);
-> consume


----
이하 7,8번은 Client 에서 protoo 웹소켓으로 newProducer 인식 후 실행 하는것으로 보임

7. broadcaster에 의해 공유 되는 영상 produce
URI: /rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/produce/data
-> _broadcaster.get(broadcasterId) 있는지 검사
-> 있다면 해당 broadcaster 선택
--> transport = broadcaster.data.transports.get(transportId);
-> dataProducer = await transport.produceData({sctpStreamParameters,label,protocol,appData});
-> dataProducer 저장 : broadcaster.data.dataProducers.set(dataProducer.id, dataProducer);
==> return { id : dataProducer.id }

8. broadcaster에 의해 공유 되는 영상 consume
URI: /rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/consume/data
-> _broadcaster.get(broadcasterId) 있는지 검사
-> 있다면 해당 broadcaster 선택
--> transport = broadcaster.data.transports.get(transportId);
-> dataConsumer = await transport.consumeData({dataProducerId});
-> broadcaster broadcaster.data.dataConsumers.set(dataConsumer.id, dataConsumer);
==> return { id : dataConsumer.id, streamId: dataConsumer.sctpStreamParameters.streamId }


10. delete broadcaster
URI: /rooms/:roomId/broadcasters/:broadcasterId
-> room.deleteBroadcaster({ broadcasterId });
-> const broadcaster = this._broadcasters.get(broadcasterId); 삭제한 broadcaster
-> broadcaster.data.transports.values() 에서 등록된 모든 transport 삭제
-> _broadcasters 에서 해당 broadcasterId 삭제
-> _broadcasters의 다른 사용자에게 알림
peer.notify('peerClosed', { peerId: broadcasterId }).catch(() => {});


---
* Protoo(Websocket)
1. create transport
URL: const transport = new protooClient.WebSocketTransport(`ws://localhost:3000/?peerId=neo&roomId=live`);
- url parse
-- roomId: live
-- peerId: neo
1.1 getOrCreateRoom({ roomId, consumerReplicas=0})
- create Room
-- const protooRoom = new protoo.Room();
-- existingPeer = this._protooRoom.getPeer(peerId);
--- existingPeer ? existingPeer.close()
--- peer = this._protooRoom.createPeer(peerId, protooWebSocketTransport);
--- peer event 정의
>>> peer.on('request',(request,accept,reject) => {
    this._handleProtooRequest
})
>>> _handleProtooRequest
case 'getRouterRtpCapabilities';
case 'join':
case 'createWebRtcTransport';
case 'connectWebRtcTransport';
case 'restartIce';
case 'produce';
case 'closeProducer';
case 'pauseProducer';
case 'resumeProducer';
case 'pauseConsumer';
case 'resumeConsumer';
case 'setConsumerPreferredLayers';
case 'setConsumerPriority';
case 'requestConsumerKeyFrame';
case 'produceData';
case 'changeDisplayName';

- accept(); 응답
- connection 저장 
-- room.handleProtooConnection({ peerId, protooWebSocketTransport });
-- this._protooRoom.createPeer(peerId, protooWebSocketTransport);
- peer 정보 생성
- peer = this._protooRoom.createPeer(peerId, protooWebsocketTransport);
- peer: {}
