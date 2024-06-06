import React from 'react';
import { pueueManager, PueueMessageEvent } from './pueue-manager';

export const timeout = (ms : number) : Promise<any> => {
    return new Promise((cb) => setTimeout(cb, ms));
};

export const formatTime = (date : Date | null) : string => {
    if (!date) return '?';
    return (
        date.getHours  ().toString().padStart(2, '0') + ':' +
        date.getMinutes().toString().padStart(2, '0') + ':' +
        date.getSeconds().toString().padStart(2, '0')
    );
}

export class PueueTask {
    id : number = -1;
    command: string = '';
    label: string = '';
    path: string = '';
    start: string = '';
    end: string = '';
    group: string = '';
    envs: {[name: string] : string} = {};
    status: any = null;
    dependencies: string[] = [];
}

export declare class PueueGroup {
    status: string;
    parallel_tasks: number;
    dir : string;
}

export declare class PueueMeta {
    cwd : string;
}

export class PueueContext {
    tasks : {[id: string] : PueueTask} = {};
    groups : {[id: string] : PueueGroup} = {};
    cwd : string = "";

    updateStatus : ()=>void = ()=>{};
    addAlert: (body : string, title? : string, variant? : string) => void = ()=>{};
    removeAlert: (key : string) => void = ()=>{};

    storeMeta() {
        return pueueManager.pueue_webui_meta({
            groups: Object.fromEntries(Object.entries(this.groups).map(([k, v]) => [k, {dir: v.dir}])),
            cwd: this.cwd,
        });
    }
}

export const pueueContext = React.createContext<PueueContext>(new PueueContext());
export const PueueContextProvider = pueueContext.Provider;
//const PueueContextConsumer = pueueContext.Consumer;

export const getContext = () => React.useContext(pueueContext);

export const textInputBinder = (state, setState, arg : string) => ({
    id: arg,
    value: state[arg],
    onChange: (_, v) => setState((x) => { const new_x = {...x}; new_x[arg] = v; return new_x; }),
});


