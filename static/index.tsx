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

import { TimesIcon, RedoIcon, PlusCircleIcon, ArrowRightIcon, TrashIcon, CopyIcon, SyncAltIcon, ArrowRightIcon } from '@patternfly/react-icons';
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

class PueueContext {
    tasks : any;
    groups : any;
}

const textInputBinder = (state, setState, arg : string) => ({
    id: arg,
    value: state[arg],
    onChange: (_, v) => setState((x) => { const new_x = {...x}; new_x[arg] = v; return new_x; }),
});

const DescLog = ({id, task}) => {
    const [log, setLog] = React.useState<string>('');
    const elemRef = React.useRef<HTMLDivElement>(null);

    const [followLog, setFollowLog] = React.useState<boolean>(false);
    const followLogRef = useRef<boolean>(false);

    const updateLog = async () => {
        const data = await pueueManager.pueue(['log'], {lines: 20, json: true}, [id])
        setLog(data[id].output);
        if (followLogRef.current) {
            await timeout(1000);
            updateLog();
        }
    };

    const appendLog = (e : Event) => {
        const data = (e as PueueMessageEvent).data;
        if (data[0] != id) {
            console.log(data[0], id);
            return;
        }
        setLog((l) => l + data[3]);
    };

    useEffect(() => {
        //updateLog();
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

    useEffect(() => {
        if (followLog) {
            updateLog();
        }
        followLogRef.current = followLog;
        return () => {
            followLogRef.current = false;
        }
    }, [followLog]);

    return (
        <DescriptionListGroup>
            <DescriptionListTerm>Logs &nbsp;
                <SyncAltIcon color={followLog ? 'blue' : undefined}
                    onClick={() => {
                        setFollowLog((c) => !c);
                    }}
                />
            </DescriptionListTerm>
            <DescriptionListDescription>
                <div ref={elemRef} className='log-view'>
                    <pre>{log}</pre>
                </div>
            </DescriptionListDescription>
        </DescriptionListGroup>
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


const PueueGroupTable = ({ group, groupDetail, meta } : { group : string, groupDetail : any, meta: any }) => {
    const [ tasks, setTasks ] = React.useState<any>({});
    const [ expandedRows, setExpandedRows ] = React.useState<any>({});

    const updateStatus = async (after : number = 0) => {
        if (timeout)
            await timeout(after);
        const data = await pueueManager.pueue('status', { json: true, group:  group });
        setTasks(data.tasks);
    };

    const updateStatusDelayed = () => { updateStatus(100); };

    const constructor = () => {
        updateStatus();
        pueueManager.observer.addEventListener('onStatusUpdated', updateStatusDelayed);
    };
    const destructor = () => {
        pueueManager.observer.removeEventListener('onStatusUpdated', updateStatusDelayed);
    };

    useEffect(() => { constructor(); return destructor }, []);

    const unfoldStatus = (s : any) => {
        if (s && typeof s == "object") {
            const key = Object.keys(s)[0];
            return key == 'Done' ? unfoldStatus(s[key]) : [key, ...unfoldStatus(s[key])];
        }
        else return [String(s)];
    };

    const getLabel = (id : string) => {
        const task = tasks[id];
        const status = task ? unfoldStatus(task.status) : [];
        const statusColor = (
            status.indexOf('Success') >= 0 ? 'green' :
            status.indexOf('Running') >= 0 ? 'blue' :
            status.indexOf('Failed') >= 0 ? 'red' :
            status.indexOf('DependencyFailed') >= 0 ? 'red' :
            'grey');

        return (<Label key={id} color={statusColor}>{task?.label}#{id}</Label>);
    };

    const rows : React.ReactNode[] = [];
    var rowIndex = 0;
    for (const id in tasks) {
        const task = tasks[id];

        const dateStart = task.start ? new Date(Date.parse(task.start)) : null;
        const dateEnd = task.end ? new Date(Date.parse(task.end)) : null;
        const isExpanded = Boolean(expandedRows[id]);

        const detailRow = (
            <Tr key='detail'>
                <Td></Td>
                <Td colSpan={5}>
                    <ExpandableRowContent>
                        <DescriptionList isHorizontal termWidth='20ch' isCompact>
                            <Desc name={'Status'}>{unfoldStatus(task.status).join(' ')}</Desc>
                            <Desc name={'Working Directory'}>{task.path}</Desc>
                            <Desc name={'Environments'}><div className='envs-view'>
                                <pre>
                                    {Object.entries(task.envs).map(([k, v]) => `${k} = "${v}"`).join('\n')}
                                </pre>
                            </div></Desc>
                            <DescLog id={id} task={task}/>
                        </DescriptionList>
                    </ExpandableRowContent>
                </Td>
            </Tr>
        );

        const mainRow = (
            <Tr key='main'>
                <Td
                    expand={{
                        rowIndex,
                        isExpanded,
                        onToggle: () => {
                            const newExpandedRows = {...expandedRows};
                            newExpandedRows[id] = !Boolean(newExpandedRows[id]);
                            setExpandedRows(newExpandedRows);
                        },
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
                    <Button variant='plain' onClick={()=>setForm({
                            label: task.label + '#' + task.id,
                            command: task.command,
                            deps: task.dependencies.join(','),
                            delay: "",
                            parallel: form.parallel,
                            dir: task.path,
                        })}
                    ><CopyIcon/></Button>
                </Td>
            </Tr>
        );

        rows.push(<Tbody key={id} isExpanded={isExpanded}>{[mainRow, isExpanded ? detailRow : undefined]}</Tbody>);

        rowIndex += 1;
    }

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
        dir: (group in meta.groups) && meta.groups[group].dir ? meta.groups[group].dir : "",
    });
    const bindForm = textInputBinder.bind(null, form, setForm);

    const taskIdInplace = form.label.indexOf('#') >= 0 ? form.label.split('#')[1] : '';

    return (
    <Card>
    <CardBody>
        <DescriptionList isHorizontal termWidth='20ch' isCompact>
            <Desc name={'Group Name'}>{group}</Desc>
            <Desc name={'Status'}>
                {groupDetail.status}
                <Button style={{marginLeft: 30}}>Pause</Button>
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
                    <TextInputGroupMain placeholder={meta.cwd} {...bindForm('dir')}/>
                    <TextInputGroupUtilities>
                        <Button variant='plain' onClick={() => {
                                const newMeta = structuredClone(meta);
                                newMeta.groups[group].dir = form.dir;
                                pueueManager.pueue_webui_meta(newMeta);
                            }}
                        ><ArrowRightIcon/> Apply to Group</Button>
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
                                    working_directory: form.dir ? form.dir : meta.cwd,
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
    const [ groups, setGroups ] = React.useState<any>({});
    const [ meta, setMeta ] = React.useState<any>({cwd: '', groups: {}});

    React.useEffect(() => {
        Promise.all([
            pueueManager.pueue_webui_meta(),
            pueueManager.pueue('group', { json: true })
        ]).then(([metaData, groupData]) => {
            // tidy meta data
            metaData.cwd = metaData.cwd || '';
            metaData.groups = metaData.groups || {};

            for (const g in groupData)
                metaData.groups[g] = metaData.groups[g] || {};
            for (const g in metaData.groups)
                if (!(g in groupData))
                    delete metaData.groups[g];

            setMeta(metaData);
            setGroups(groupData);
        });
    }, []);

    const groupTabs = Object.keys(groups).map((group) => (
        <Tab
            key={group}
            eventKey={group}
            title={group}
        >
            { currentGroup == group ? <PueueGroupTable group={group} groupDetail={groups[group]} meta={meta}/> : <></> }
        </Tab>
    ));

    return (
    <Card>
        <CardBody>
            <Tabs
                isBox
                activeKey={currentGroup}
                onSelect={(_, k) => setCurrentGroup(k as string)}
            >{groupTabs}</Tabs>
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
