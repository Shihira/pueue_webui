import React from 'react';
import {
    ExpandableRowContent,
    Table, Thead, Tbody, Tr, Th, Td,
} from '@patternfly/react-table';
import {
    Alert,
    AlertActionCloseButton,
    AlertGroup,
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
    TextInputGroup,
    TextInputGroupMain,
    TextInputGroupUtilities,
    TextVariants,
} from '@patternfly/react-core';

import { TimesIcon, RedoIcon, PlusCircleIcon, ArrowRightIcon, TrashIcon, CopyIcon, SyncAltIcon, EditIcon, CrossIcon, OffIcon } from '@patternfly/react-icons';
import { pueueManager, PueueMessageEvent } from '../pueue-manager';
import {
    timeout,
    formatTime,
    PueueTask,
    PueueGroup,
    PueueMeta,
    PueueContext,
    pueueContext,
    PueueContextProvider,
    textInputBinder,
} from '../utils';


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

    React.useEffect(() => {
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

    React.useEffect(() => {
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

const PueueTaskRow = ({ id, group } : { id : string, group : string }) => {
    const [ isExpanded, setIsExapnded ] = React.useState<boolean>(false);
    const [ isEditable, setIsEditable ] = React.useState<boolean>(false);
    const [ envs, setEnvs ] = React.useState<{[v:string] : string}>({});

    const context = React.useContext(pueueContext);
    const task = context.tasks[id] || new PueueTask();
    const groupDetail = context.groups[group];
    const isNew = (id == 'launch');

    const [ form, setForm ] = React.useState<{
        label: string,
        command: string,
        deps: string,
        delay: string,
        dir: string,
    }>({
        label: "",
        command: "",
        deps: "",
        delay: "",
        dir: "",
    });
    const bindForm = textInputBinder.bind(null, form, setForm);

    const alertDone = (x : string) => context.addAlert(x, 'Done', 'Success');

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
                    { !isEditable && !isNew ?
                        <>
                        <Desc name={'Status'}>{unfoldStatus(task.status).join(' ')}</Desc>
                        <Desc name={'Working Directory'}>{task.path}</Desc>
                        <Desc name={'Environments'}>
                            { Object.keys(envs).length == 0 ? (
                                <Button size='sm' variant='secondary'
                                    onClick={()=>pueueManager.pueue('status', {json: true, group, __controller_remove_envs: false}).then((data) => setEnvs(data.tasks[id].envs))}
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
                        </> :

                        <>
                        <Desc name={'Working Directory'}><TextInput placeholder={groupDetail.dir || context.cwd} {...bindForm('dir')}/></Desc>
                        </>
                    }
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
            { !isEditable && !isNew ?
                <>
                <Td>{getLabel(id)}</Td>
                <Td>{task.command}</Td>
                <Td>{task.dependencies.map(getLabel)}</Td>
                <Td>{formatTime(dateStart)}&nbsp;&nbsp;<ArrowRightIcon/>&nbsp;&nbsp;{formatTime(dateEnd)}</Td>
                <Td>
                    <Button variant='plain' onClick={()=>pueueManager.pueue('kill', {}, [id]).then(alertDone)}><TimesIcon/></Button>
                    <Button variant='plain' onClick={()=>pueueManager.pueue('remove', {}, [id]).then(alertDone)}><TrashIcon/></Button>
                    <Button variant='plain' onClick={()=>pueueManager.pueue('restart', {in_place: true}, [id]).then(alertDone)}><RedoIcon/></Button>
                    <Button variant='plain' onClick={() => {
                            setForm({label: task.label, command: task.command, deps: task.dependencies.join(','), delay: '', dir: task.path});
                            setIsEditable(true);
                        }}
                    ><EditIcon/></Button>
                </Td>
                </> :

                <>
                <Td><TextInput placeholder='Label' {...bindForm('label')}/></Td>
                <Td><TextInput placeholder='Command' {...bindForm('command')}/></Td>
                <Td><TextInput placeholder='Dependencies' {...bindForm('deps')}/></Td>
                <Td><TextInput placeholder='Delay (e.g. 15s, 1d)' {...bindForm('delay')}/></Td>
                <Td>
                    <Button variant='plain' onClick={async ()=> {
                            await pueueManager.pueue('add', {
                                label: form.label ? form.label : null,
                                after: form.deps  ? form.deps.split(',') : [],
                                delay: form.delay ? form.delay : null,
                                group: group,
                                working_directory: form.dir || groupDetail.dir || context.cwd,
                            }, [form.command]).then(alertDone);
                            if (!isNew)
                                setIsEditable(false);
                        }}
                    >
                        <PlusCircleIcon/>
                    </Button>
                    { !isNew ?
                        <>
                        <Button variant='plain' onClick={async ()=> {
                                await pueueManager.pueue('restart', {in_place: true, stashed: true}, [id]).then(alertDone);
                                await pueueManager.pueue_edit(id, {
                                        'command': form.command,
                                        'path': form.dir,
                                        'label': form.label,
                                    }).then(alertDone);
                                await pueueManager.pueue('enqueue', form.delay ? {delay: form.delay} : {}, [id]).then(alertDone);
                                setIsEditable(false);
                            }}
                            isDisabled={task.dependencies.join(',') != form.deps} /*pueue client backend does not support editing dependencies*/
                        >
                            <RedoIcon/>
                        </Button>
                        <Button variant='plain' onClick={()=>setIsEditable(false)}><OffIcon/></Button>
                        </> :
                        <></>
                    }
                </Td>
                </>
            }
        </Tr>
    );

    return (<Tbody isExpanded={isExpanded} className={'text-input-with-proper-background'}>{[mainRow, isExpanded ? detailRow : undefined]}</Tbody>);
};

const PueueGroupTable = ({ group } : { group : string }) => {
    const context = React.useContext(pueueContext);
    const groupDetail = context.groups[group];

    const [ form, setForm ] = React.useState<{
        parallel: string,
        dir: string,
    }>({
        parallel: groupDetail.parallel_tasks.toString(),
        dir: groupDetail.dir,
    });
    const bindForm = textInputBinder.bind(null, form, setForm);

    const alertDone = (x : string) => context.addAlert(x, 'Done', 'success');

    const rows : React.ReactNode[] = Object.keys(context.tasks).map((id : string) => (<PueueTaskRow key={id} id={id} group={group}/>));
    rows.push(<PueueTaskRow key='launch' id='launch' group={group}/>);

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
                            pueueManager.pueue('pause', {group}).then(alertDone).then(context.updateStatus) :
                            pueueManager.pueue('start', {group}).then(alertDone).then(context.updateStatus)
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
                                pueueManager.pueue('parallel', {group}, [form.parallel]).then(alertDone);
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
                                context.storeMeta().then(alertDone);
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
        </Table>
    </CardBody>
    </Card>
    );
};

export const PueueView = ({ children } : { children : React.ReactNode }) => {
    const [ currentGroup, setCurrentGroup ] = React.useState<string>('default');
    const [ groups, setGroups ] = React.useState<{[id : string] : PueueGroup}>({});
    const [ tasks, setTasks ] = React.useState<{[id : string] : PueueTask}>({});
    const [ meta, setMeta ] = React.useState<PueueMeta>({cwd: ''});
    const [ alerts, setAlerts ] = React.useState<{[id : string] : { id: number, title: string, body: string, variant: string }}>({counter: { id: 0, title: '', body: '', variant: ''}});


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

    currentContext.addAlert = (body, title, variant) => {
        setAlerts((a) => {
            const newAlerts = structuredClone(a);
            newAlerts[a.counter.id.toString()] = {
                id: a.counter.id,
                title: (title || 'Message'),
                body: (body || ''),
                variant: (variant || 'info')
            };
            newAlerts.counter.id += 1;
            console.log(newAlerts);
            return newAlerts;
        });
    };
    currentContext.removeAlert = (key) => {
        setAlerts((a) => {
            const newAlerts = {...a};
            delete newAlerts[key];
            return newAlerts;
        });
    };

    const updateStatusDelayed = async () => { await timeout(100); currentContext.updateStatus(); };
    const addAlertOnError = (_e : Event) => {
        const e = _e as PueueMessageEvent;
        console.error(e);
        currentContext.addAlert(typeof e.data.data == 'string' ? e.data.data : JSON.stringify(e.data.data), e.data.message, 'warning');
    }

    React.useEffect(() => {
        currentContext.updateStatus();
    }, []);

    React.useEffect(() => {
        pueueManager.observer.addEventListener('onStatusUpdated', updateStatusDelayed);
        pueueManager.observer.addEventListener('onError', addAlertOnError);

        return () => {
            pueueManager.observer.removeEventListener('onStatusUpdated', updateStatusDelayed);
            pueueManager.observer.removeEventListener('onError', addAlertOnError);
        }
    });

    React.useEffect(() => {
        setTasks({});
        currentContext.updateStatus();
    }, [currentGroup]);

    const groupTabs = Object.keys(groups).map((group) => (
        <Tab key={group} eventKey={group} title={group}>
            { currentGroup == group ? <PueueGroupTable group={group}/> : <></> }
        </Tab>
    ));

    return (
    <PueueContextProvider value={currentContext}>
        {children}
        <Card key='main-view'>
            <CardBody>
                <Tabs
                    isBox
                    activeKey={currentGroup}
                    onSelect={(_, k) => setCurrentGroup(k as string)}
                >{groupTabs}</Tabs>
            </CardBody>
        </Card>
        <AlertGroup isToast key='alerts'>
        {
            Object.entries(alerts).map(([key, x]) => key == 'counter' ?
                <></> :
                <Alert key={key} variant={x.variant as any} title={x.title} timeout={5000}
                    style={{whiteSpace: 'pre-wrap'}}
                    onTimeout={currentContext.removeAlert.bind(null, key)}
                    actionClose={<AlertActionCloseButton onClose={currentContext.removeAlert.bind(null, key)}/>}
                >{x.body}</Alert>)
        }
        </AlertGroup>
    </PueueContextProvider>
    );
};

