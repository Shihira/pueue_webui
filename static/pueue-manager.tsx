export class PueueMessageEvent extends Event {
    data : any;
    constructor(eventName : string, inData : any) {
        super(eventName);
        this.data = inData;
    }
}

export declare class Connection {
    onRecv: (h : (data: any)=>void) => void;
    onClose: (h : (data: any)=>void) => void;
    onError: (h : (data: any)=>void) => void;
    send: (data:any) => void;
}

export class PueueManager {
    idCounter : number = 1000;
    callbacks : object = {};
    observer : EventTarget = new EventTarget();

    connection : Connection;

    onClose(data : any) {
        this.observer.dispatchEvent(new PueueMessageEvent('onError', {message: 'Connection Closed', data: data}));
    }

    onError(data : any) {
        this.observer.dispatchEvent(new PueueMessageEvent('onError', {message: 'Connection Error', data: data}));
    }

    onRecv(raw_data : any) {
        var data : any = {};
        try {
            data = JSON.parse(raw_data);
            console.log('recv', data);
        } catch(e) {
            console.log('recv', raw_data);
            return;
        }

        if (data.method !== undefined) {
            if (data.method.startsWith('on')) {
                this.observer.dispatchEvent(new PueueMessageEvent(data.method, data.params));
            }
        }
        else {
            if (data.error !== undefined) {
                this.observer.dispatchEvent(new PueueMessageEvent('onError', data.error));
            }

            if (data.id !== undefined && data.id in this.callbacks) {
                this.callbacks[data.id](data.result);
            }
            else {
                console.log('not handled');
            }

            if (data.id !== undefined && data.id in this.callbacks) {
                delete this.callbacks[data.id];
            }
        }
    }

    async connect(connectionEstablisher : Promise<Connection>) {
        this.connection = await connectionEstablisher;
        this.connection.onRecv(this.onRecv.bind(this));
        this.connection.onClose(this.onClose.bind(this));
        this.connection.onError(this.onError.bind(this));
    }

    call_rpc(method : string, params: any) : Promise<any> {
        const self = this;
        return new Promise((cb) => {
            const id = self.idCounter
            self.idCounter += 1;
            self.connection.send({
                jsonrpc: '2.0',
                id: id,
                method,
                params,
            });
            self.callbacks[id] = cb;
        });
    }

    pueue(subcommands : string | string[], options : any = {}, args : string[] = []) : Promise<any> {
        return this.call_rpc('pueue', [subcommands, options, args]);
    };

    pueue_log_subscription(taskId : string, addOrDel : boolean, options={}) : Promise<any> {
        return this.call_rpc('pueue_log_subscription', [taskId, addOrDel, options]);
    };

    pueue_webui_meta(data : any = null) : Promise<any> {
        return this.call_rpc('pueue_webui_meta', [data]);
    };

    pueue_edit(id : string, kvs: any) : Promise<any> {
        return this.call_rpc('pueue_edit', [id, kvs]);
    };

    run_local_command_async(cmd : string[]) : Promise<any> {
        return this.call_rpc('run_local_command_async', [cmd]);
    };
}

export const pueueManager = new PueueManager();

export function establishWebsocket(url) : Promise<Connection> {
    return new Promise((cb) => {
        const jsonrpcWebsocket = new WebSocket(url);
        jsonrpcWebsocket.addEventListener('open', () => {
            cb({
                onRecv: (h) => { jsonrpcWebsocket.onmessage = (e) => h(e.data); },
                onClose: (h) => { jsonrpcWebsocket.onclose = h; },
                onError: (h) => { jsonrpcWebsocket.onerror = h; },
                send: (data) => {
                    console.log('send', data);
                    jsonrpcWebsocket.send(JSON.stringify(data));
                }
            });
        });
    });
};

export async function establishCockpitChannel(cockpit : any) : Promise<Connection> {
    const INSTALL_NAME = document.location.pathname.split('/')[3];
    const user = await cockpit.user();
    const processChannel = cockpit.spawn(
        [ "python3", cockpit.manifests[INSTALL_NAME].common.installation + "/scripts/pueue_main.py", "--stdio" ],
        { directory: user.home, err: "message" });
    return {
        onRecv: (h) => { processChannel.stream((raw_data : string) => {
            raw_data.split('\n').filter((x) => x.trim().length !== 0).forEach(h); });
        },
        onClose: (h) => { processChannel.then(h); },
        onError: (h) => { processChannel.catch(h); },
        send: (data) => {
            console.log('send', data);
            processChannel.input(JSON.stringify(data) + "\n", true);
        }
    };
};
