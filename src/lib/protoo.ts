import protoo from 'protoo-server';
import url from 'node:url';

const rooms = new protoo.Room();

const ProtooConnection = async ( protooWebSocketServer: protoo.WebSocketServer ) => {
    console.log('running protoo WebSocketServer...');
    protooWebSocketServer.on('connectionrequest', (info, accept, reject) => {
        if (info.socket && info.request.url) {
            const u = url.parse(info.request.url, true);
            const peerId = u.query && u.query['peerId'] ? u.query['peerId'].toString() : undefined;
            console.log('>>>>>>>>>>>>>>',peerId);
            if(peerId){
                const transport = accept();
                const peer = rooms.createPeer(peerId, transport);
                peer.on('request',(request,accept,reject) =>{
                    const type = request.method;
                    console.log(request);
                    switch(type){
                        case "getOrRouter":
                            peer.request('received',{peerId});
                            accept({data:'googl'})
                            break;
                        case "c":
                            break;
                        default:
                            reject(500,'Internal Error');
                            break;
                    }
                });

                peer.on('close', () =>{
                    console.log('peer is closed')
                });

                peer.on('notification', (notification) => {

                });
            } else {
                reject(403,'Not exist peerId');
            }
        }
    })
}

export { ProtooConnection }