
export class PueueMessageEvent extends Event {
    data : any;
    constructor(eventName : string, inData : any) {
        super(eventName);
        this.data = inData;
    }
}

export class PueueManager {
    idCounter : number;
    jsonrpcWebsocket : WebSocket;
    callbacks : object;
    observer : EventTarget;

    send(data : any) {
        console.log('send', data);
        this.jsonrpcWebsocket.send(JSON.stringify(data));
    }

    constructor() {
        this.idCounter = 1000;
        this.callbacks = {};
        this.observer = new EventTarget();
        this.jsonrpcWebsocket = new WebSocket('ws://localhost:9092');
        this.jsonrpcWebsocket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            console.log('recv', data);

            if (data.error !== undefined) {
                console.log(data.error);
            }
            else if (data.method !== undefined) {
                if (data.method.startsWith('on')) {
                    this.observer.dispatchEvent(new PueueMessageEvent(data.method, data.params));
                }
            }
            else if (data.id !== undefined && data.id in this.callbacks) {
                this.callbacks[data.id](data.result);
            }
            else {
                console.log('not handled');
            }

            if (data.id !== undefined && data.id in this.callbacks) {
                delete this.callbacks[data.id];
            }
        };
        this.jsonrpcWebsocket.onclose = (e) => { console.log(e); }
        this.jsonrpcWebsocket.onerror = (e) => { console.log(e); }
    }

    pueue(subcommands : string | string[], options : any = {}, args : string[] = []) : Promise<any> {
        const self = this;
        return new Promise((cb) => {
            const id = self.idCounter
            self.idCounter += 1;
            self.send({
                jsonrpc: '2.0',
                id: id,
                method: 'pueue',
                params: [subcommands, options, args]
            });
            self.callbacks[id] = cb;
        });
    };

    pueue_log_subscription(taskId : string, addOrDel : boolean, options={}) : Promise<any> {
        const self = this;
        return new Promise((cb) => {
            const id = self.idCounter
            self.idCounter += 1;
            self.send({
                jsonrpc: '2.0',
                id: id,
                method: 'pueue_log_subscription',
                params: [taskId, addOrDel, options]
            });
            self.callbacks[id] = cb;
        });
    };

    run_local_command_async(cmd : string[]) : Promise<any> {
        const self = this;
        return new Promise((cb) => {
            const id = self.idCounter
            self.idCounter += 1;
            self.send({
                jsonrpc: '2.0',
                id: id,
                method: 'run_local_command_async',
                params: [cmd]
            });
            self.callbacks[id] = cb;
        });
    };
}

export const pueueManager = new PueueManager();

