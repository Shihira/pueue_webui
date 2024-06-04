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
    Tab,
    Tabs,
    Text,
    TextInput,
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
            <DescriptionListDescription>{kv.value}</DescriptionListDescription>
        </DescriptionListGroup>
    );
};


const PueueGroupTable = ({ group, groupDetail } : { group : string, groupDetail : any }) => {
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
        if (typeof s == "object") {
            const key = Object.keys(s)[0];
            return key == 'Done' ? unfoldStatus(s[key]) : [key, ...unfoldStatus(s[key])];
        }
        else return [(s as string)];
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
                            <Desc name={'Status'} value={unfoldStatus(task.status)}/>
                            <Desc name={'Working Directory'} value={task.path}/>
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
                    <Button variant='plain' onClick={()=>pueueManager.pueue('restart', {not_in_place: true}, [id])}><CopyIcon/></Button>
                </Td>
            </Tr>
        );

        rows.push(<Tbody key={id} isExpanded={isExpanded}>{[mainRow, isExpanded ? detailRow : undefined]}</Tbody>);

        rowIndex += 1;
    }

    const addOptions = useRef<{label: string, command: string, deps: string, delay: string}>({label: "", command: "", deps: "", delay: ""});

    return (
    <>
    <Card>
        <CardBody>
            <DescriptionList isHorizontal termWidth='20ch' isCompact>
                <Desc name={'Status'} value={groupDetail.status}/>
                <Desc name={'Parallel Tasks'} value={groupDetail.parallel_tasks}/>
            </DescriptionList>
        </CardBody>
    </Card>
    <Table variant='compact'>
        <Thead>
            <Tr>
                <Th></Th>
                <Th width={10}>Label</Th>
                <Th width={30}>Command</Th>
                <Th width={10}>Dependencies</Th>
                <Th width={10}>Timing (<Text component={TextVariants.a}>Show Date</Text>)</Th>
                <Th width={10}></Th>
            </Tr>
        </Thead>
        {rows}
        <Tbody key={"launch"}>
            <Tr className={'text-input-with-proper-background'}>
                <Td></Td>
                <Td><TextInput id='label' placeholder='Label' onChange={(_, v)=>{addOptions.current.label = v;}}/></Td>
                <Td><TextInput id='command' placeholder='Command' onChange={(_, v)=>{addOptions.current.command = v;}}/></Td>
                <Td><TextInput id='deps' placeholder='Dependencies' onChange={(_, v)=>{addOptions.current.deps = v;}}/></Td>
                <Td><TextInput id='delay' placeholder='Delay (e.g. 15s, 1d)' onChange={(_, v)=>{addOptions.current.delay = v;}}/></Td>
                <Td>
                    <Button variant='plain' onClick={()=>pueueManager.pueue('add', {
                            label: addOptions.current.label ? addOptions.current.label : null,
                            after: addOptions.current.deps ? addOptions.current.deps.split(',') : [],
                            delay: addOptions.current.delay ? addOptions.current.delay : null,
                            group: group,
                        }, [addOptions.current.command])
                    }>
                        <PlusCircleIcon/>
                    </Button>
                </Td>
            </Tr>
        </Tbody>
    </Table>
    </>
    );
};

const PueuePage = () => {
    const [ currentGroup, setCurrentGroup ] = React.useState<string>('default');
    const [ groups, setGroups ] = React.useState<any>({});

    React.useEffect(() => {
        pueueManager.pueue('group', { json: true })
            .then((data) => { setGroups(data); });
    }, []);

    const groupTabs = Object.keys(groups).map((group) => (
        <Tab
            key={group}
            eventKey={group}
            title={group}
        >
            { currentGroup == group ? <PueueGroupTable group={group} groupDetail={groups[group]}/> : <></> }
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
