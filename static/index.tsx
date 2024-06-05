import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
    ExpandableRowContent,
    Table, Thead, Tbody, Tr, Th, Td,
} from '@patternfly/react-table';
import {
    Button,
    Card,
    CardBody,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    Label,
    NumberInput,
    Tab,
    Tabs,
    Text,
    TextInput,
    TextInputGroup,
    TextInputGroupMain,
    TextInputGroupUtilities,
    TextVariants,
} from '@patternfly/react-core';

import { TimesIcon, RedoIcon, PlusCircleIcon, ArrowRightIcon, TrashIcon, CopyIcon, SyncAltIcon } from '@patternfly/react-icons';
import { pueueManager, PueueMessageEvent } from './pueue-manager';
import { UpdateDepots } from './update-depots';

import "@patternfly/patternfly/patternfly";
import "@patternfly/patternfly/patternfly-theme-dark";
import "./styles"

const timeout = (ms : number) : Promise<any> => {
    return new Promise((cb) => setTimeout(cb, ms));
};

const formatTime = (date : Date | null) : string => {
    if (!date) return '?';
    return (
        date.getHours  ().toString().padStart(2, '0') + ':' +
        date.getMinutes().toString().padStart(2, '0') + ':' +
        date.getSeconds().toString().padStart(2, '0')
    );
}

declare class PueueTask {
    id : number;
    command: string;
    label: string;
    path: string;
    start: string;
    end: string;
    group: string;
    envs: {[name: string] : string};
    status: any;
    dependencies: string[];
}

declare class PueueGroup {
    status: string;
    parallel_tasks: number;
    dir : string;
}

declare class PueueMeta {
    cwd : string;
}

class PueueContext {
    tasks : {[id: string] : PueueTask} = {};
    groups : {[id: string] : PueueGroup} = {};
    cwd : string = "";

    updateStatus : ()=>void = ()=>{};

    storeMeta() {
        pueueManager.pueue_webui_meta({
            groups: Object.fromEntries(Object.entries(this.groups).map(([k, v]) => [k, {dir: v.dir}])),
            cwd: this.cwd,
        });
    }
}

const pueueContext = React.createContext<PueueContext>(new PueueContext());
const PueueContextProvider = pueueContext.Provider;
//const PueueContextConsumer = pueueContext.Consumer;

const textInputBinder = (state, setState, arg : string) => ({
    id: arg,
    value: state[arg],
    onChange: (_, v) => setState((x) => { const new_x = {...x}; new_x[arg] = v; return new_x; }),
});

const LogView = ({id}) => {
    const [log, setLog] = React.useState<string>('');
    const elemRef = React.useRef<HTMLDivElement>(null);

    const appendLog = (e : Event) => {
        const data = (e as PueueMessageEvent).data;
        if (data[0] != id) {
            console.log(data[0], id);
            return;
        }
        setLog((l) => l + data[3]);
    };

    useEffect(() => {
        pueueManager.observer.addEventListener('onLogUpdated', appendLog);
        pueueManager.pueue_log_subscription(id, true)
            .then((data) => pueueManager.observer.dispatchEvent(new PueueMessageEvent('onLogUpdated', data)));
        //console.log('mounted', id);
        //return () => console.log('unmounted', id);
        return () => {
            pueueManager.pueue_log_subscription(id, false);
            pueueManager.observer.removeEventListener('onLogUpdated', appendLog);
        };
    }, []);

    useEffect(() => {
        if (elemRef.current) {
            elemRef.current.scrollTop = elemRef.current.scrollHeight;
        }
    }, [log]);

    return (
        <div ref={elemRef} className='log-view'>
            <pre>{log}</pre>
        </div>
    );
};

const Desc = (kv : any) => {
    return (
        <DescriptionListGroup>
            <DescriptionListTerm>{kv.name}</DescriptionListTerm>
            <DescriptionListDescription>{kv.children}</DescriptionListDescription>
        </DescriptionListGroup>
    );
};

const PueueTaskRow = ({ id, onCopy } : { id : string, onCopy : ()=>void }) => {
    const [ isExpanded, setIsExapnded ] = React.useState<boolean>(false);
    const [ envs, setEnvs ] = React.useState<{[v:string] : string}>({});

    const context = React.useContext(pueueContext);
    const task = context.tasks[id];

    const unfoldStatus = (s : any) => {
        if (s && typeof s == "object") {
            const key = Object.keys(s)[0];
            return key == 'Done' ? unfoldStatus(s[key]) : [key, ...unfoldStatus(s[key])];
        }
        else return [String(s)];
    };

    const getLabel = (id : string) => {
        const task = context.tasks[id];
        const status = task ? unfoldStatus(task.status) : [];
        const statusColor = (
            status.indexOf('Success') >= 0 ? 'green' :
            status.indexOf('Running') >= 0 ? 'blue' :
            status.indexOf('Failed') >= 0 ? 'red' :
            status.indexOf('DependencyFailed') >= 0 ? 'red' :
            'grey');

        return (<Label key={id} color={statusColor}>{task?.label}#{id}</Label>);
    };

    const dateStart = task.start ? new Date(Date.parse(task.start)) : null;
    const dateEnd = task.end ? new Date(Date.parse(task.end)) : null;

    const detailRow = (
        <Tr key='detail'>
            <Td></Td>
            <Td colSpan={5}>
                <ExpandableRowContent>
                    <DescriptionList isHorizontal termWidth='20ch' isCompact>
                        <Desc name={'Status'}>{unfoldStatus(task.status).join(' ')}</Desc>
                        <Desc name={'Working Directory'}>{task.path}</Desc>
                        <Desc name={'Environments'}>
                            { Object.keys(envs).length == 0 ? (
                                <Button size='sm' variant='secondary'
                                    onClick={()=>pueueManager.pueue('status', {json: true, group: task.group, __controller_remove_envs: false}).then((data) => setEnvs(data.tasks[id].envs))}
                                >...</Button>
                                ) : (
                                <div className='envs-view'>
                                    <pre>
                                        {Object.entries(envs).map(([k, v]) => `${k} = "${v}"`).join('\n')}
                                    </pre>
                                </div>
                                )
                            }
                        </Desc>
                        <Desc name={'Log'}><LogView id={id}/></Desc>
                    </DescriptionList>
                </ExpandableRowContent>
            </Td>
        </Tr>
    );

    const mainRow = (
        <Tr key='main'>
            <Td
                expand={{
                    rowIndex: Number(id),
                    isExpanded,
                    onToggle: () => setIsExapnded((v) => !v),
                }}
            >
            </Td>
            <Td>{getLabel(id)}</Td>
            <Td>{task.command}</Td>
            <Td>{task.dependencies.map(getLabel)}</Td>
            <Td>{formatTime(dateStart)}&nbsp;&nbsp;<ArrowRightIcon/>&nbsp;&nbsp;{formatTime(dateEnd)}</Td>
            <Td>
                <Button variant='plain' onClick={()=>pueueManager.pueue('kill', {}, [id])}><TimesIcon/></Button>
                <Button variant='plain' onClick={()=>pueueManager.pueue('remove', {}, [id])}><TrashIcon/></Button>
                <Button variant='plain' onClick={()=>pueueManager.pueue('restart', {in_place: true}, [id])}><RedoIcon/></Button>
                <Button variant='plain' onClick={onCopy}><CopyIcon/></Button>
            </Td>
        </Tr>
    );

    return (<Tbody isExpanded={isExpanded}>{[mainRow, isExpanded ? detailRow : undefined]}</Tbody>);
};

const PueueGroupTable = ({ group } : { group : string }) => {
    const context = React.useContext(pueueContext);
    const groupDetail = context.groups[group];

    const [ form, setForm ] = React.useState<{
        label: string,
        command: string,
        deps: string,
        delay: string,
        parallel: string,
        dir: string,
    }>({
        label: "",
        command: "",
        deps: "",
        delay: "",
        parallel: groupDetail.parallel_tasks.toString(),
        dir: groupDetail.dir,
    });
    const bindForm = textInputBinder.bind(null, form, setForm);

    const rows : React.ReactNode[] = Object.keys(context.tasks).map((id : string) => (
            <PueueTaskRow key={id} id={id} onCopy={() => {
                    const task = context.tasks[id];
                    setForm({
                        label: task.label + '#' + task.id,
                        command: task.command,
                        deps: task.dependencies.join(','),
                        delay: "",
                        parallel: form.parallel,
                        dir: task.path,
                    });
                }}
            />
        ));

    const taskIdInplace = form.label.indexOf('#') >= 0 ? form.label.split('#')[1] : '';

    return (
    <Card>
    <CardBody>
        <DescriptionList isHorizontal termWidth='20ch' isCompact>
            <Desc name={'Group Name'}>{group}</Desc>
            <Desc name={'Status'}>
                {groupDetail.status}
                <Button style={{marginLeft: 30}} variant='tertiary' size='sm'
                    onClick={() =>
                        (groupDetail.status == 'Running') ? 
                            pueueManager.pueue('pause', {group}) :
                            pueueManager.pueue('start', {group})
                    }
                >
                    {groupDetail.status == 'Running' ? 'Pause' : 'Resume'}
                </Button>
            </Desc>
            <Desc name={'Parallel Tasks'}>
                <TextInputGroup>
                    <TextInputGroupMain {...bindForm('parallel')}/>
                    <TextInputGroupUtilities>
                        <Button variant='plain' onClick={() => {
                                pueueManager.pueue('parallel', {group}, [form.parallel]);
                            }}
                        ><ArrowRightIcon/></Button>
                    </TextInputGroupUtilities>
                </TextInputGroup>
            </Desc>
            <Desc name={'Working Directory'}>
                <TextInputGroup>
                    <TextInputGroupMain placeholder={context.cwd} {...bindForm('dir')}/>
                    <TextInputGroupUtilities>
                        <Button variant='plain' onClick={() => {
                                context.groups[group].dir = form.dir;
                                context.storeMeta();
                            }}
                        ><Text component='small'>Apply to Group</Text> <ArrowRightIcon/></Button>
                    </TextInputGroupUtilities>
                </TextInputGroup>
            </Desc>
        </DescriptionList>
    </CardBody>
    <CardBody>
        <Table variant='compact'>
            <Thead>
                <Tr>
                    <Th aria-label="expand"></Th>
                    <Th width={10}>Label</Th>
                    <Th width={30}>Command</Th>
                    <Th width={10}>Dependencies</Th>
                    <Th width={10}>Timing (<Text component={TextVariants.a}>Show Date</Text>)</Th>
                    <Th width={10} aria-label="actions"></Th>
                </Tr>
            </Thead>
            {rows}
            <Tbody key={"launch"}>
                <Tr className={'text-input-with-proper-background'}>
                    <Td></Td>
                    <Td><TextInput placeholder='Label' {...bindForm('label')}/></Td>
                    <Td><TextInput placeholder='Command' {...bindForm('command')}/></Td>
                    <Td><TextInput placeholder='Dependencies' {...bindForm('deps')} isDisabled={taskIdInplace}/></Td>
                    <Td><TextInput placeholder='Delay (e.g. 15s, 1d)' {...bindForm('delay')}/></Td>
                    <Td>{!taskIdInplace ? (
                            <Button variant='plain' onClick={()=>pueueManager.pueue('add', {
                                    label: form.label ? form.label : null,
                                    after: form.deps  ? form.deps.split(',') : [],
                                    delay: form.delay ? form.delay : null,
                                    group: group,
                                    working_directory: form.dir || context.cwd,
                                }, [form.command])
                            }>
                                <PlusCircleIcon/>
                            </Button>
                            ): (
                            <Button variant='plain' onClick={async ()=> {
                                    const taskId = form.label.split('#')[1];
                                    await pueueManager.pueue('restart', {in_place: true, stashed: true}, [taskId]);
                                    await pueueManager.pueue_edit(taskId, {
                                            'command': form.command,
                                            'path': form.dir,
                                            'label': form.label.split('#')[0]
                                        });
                                    await pueueManager.pueue('enqueue', form.delay ? {delay: form.delay} : {}, [taskId]);
                                }}
                            >
                                <RedoIcon/>
                            </Button>
                            )
                    }</Td>
                </Tr>
            </Tbody>
        </Table>
    </CardBody>
    </Card>
    );
};

const PueuePage = () => {
    const [ currentGroup, setCurrentGroup ] = React.useState<string>('default');
    const [ groups, setGroups ] = React.useState<{[id : string] : PueueGroup}>({});
    const [ tasks, setTasks ] = React.useState<{[id : string] : PueueTask}>({});
    const [ meta, setMeta ] = React.useState<PueueMeta>({cwd: ''});


    const currentContext = new PueueContext();
    currentContext.tasks = structuredClone(tasks);
    currentContext.groups = structuredClone(groups);
    currentContext.cwd = meta.cwd;

    currentContext.updateStatus = () => {
        Promise.all([
            pueueManager.pueue_webui_meta(),
            pueueManager.pueue('status', { json: true, group: currentGroup })
        ]).then(([metaData, statusData]) => {
            Object.keys(statusData.groups).forEach((k) => {
                statusData.groups[k].dir = metaData.groups && metaData.groups[k] && metaData.groups[k].dir ? metaData.groups[k].dir : '';
            });

            setMeta({cwd: metaData.cwd || ''});
            setGroups(statusData.groups);
            setTasks(statusData.tasks);
        });
    };

    const updateStatusDelayed = async () => { await timeout(100); currentContext.updateStatus(); };

    React.useEffect(() => {
        currentContext.updateStatus();
        pueueManager.observer.addEventListener('onStatusUpdated', updateStatusDelayed);

        return () => {
            pueueManager.observer.removeEventListener('onStatusUpdated', updateStatusDelayed);
        }
    }, []);

    React.useEffect(() => {
        currentContext.updateStatus();
    }, [currentGroup]);

    const groupTabs = Object.keys(groups).map((group) => (
        <Tab
            key={group}
            eventKey={group}
            title={group}
        >
            { currentGroup == group ? <PueueGroupTable group={group}/> : <></> }
        </Tab>
    ));

    return (
    <Card>
        <CardBody>
            <PueueContextProvider value={currentContext}>
                <Tabs
                    isBox
                    activeKey={currentGroup}
                    onSelect={(_, k) => setCurrentGroup(k as string)}
                >{groupTabs}</Tabs>
            </PueueContextProvider>
        </CardBody>
    </Card>
    );
};

document.addEventListener('DOMContentLoaded', () => {
    pueueManager.jsonrpcWebsocket.addEventListener('open', () => {
        var e : HTMLElement | null = null;

        e = document.getElementById('update-depots');
        e && createRoot(e).render(<UpdateDepots/>);

        e = document.getElementById('group-table');
        e && createRoot(e).render(<PueuePage/>);
    });
});
