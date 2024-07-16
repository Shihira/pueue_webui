import React from 'react';
import {
    ExpandableRowContent,
    Table, Thead, Tbody, Tr, Th, Td,
    ActionsColumn,
    InnerScrollContainer,
} from '@patternfly/react-table';
import {
    ActionList,
    ActionListItem,
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
    Switch,
    Tab,
    Tabs,
    Text,
    TextInput,
    TextInputGroup,
    TextInputGroupMain,
    TextInputGroupUtilities,
    TextVariants,
    getBreakpoint,
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
        // data post processing for better visualization
        const log_data = data[3].replace(/[\r\n]+/g, '\n'); // normalize all line breaks
        setLog((l) => l + log_data);
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
            <pre>{log || '(This log is empty)'}</pre>
        </div>
    );
};

const Desc = (kv : any) => {
    const context = React.useContext(pueueContext);
    const horizon = !(kv.wrapOnSm && context.sm);

    return (
        <>
            <DescriptionListGroup>
                <DescriptionListTerm>{kv.name}</DescriptionListTerm>
                <DescriptionListDescription>{horizon && kv.children}</DescriptionListDescription>
            </DescriptionListGroup>
            {!horizon && kv.children}
        </>
    );
};

import styles from '@patternfly/react-styles/css/components/FormControl/form-control';
import { css } from '@patternfly/react-styles';

const TextArea = (prop: any) => {
    const ref = React.useRef<HTMLTextAreaElement | null>(null);
    React.useEffect(() => {
        ref.current?.style.setProperty('height', '0');
        ref.current?.style.setProperty('height', (ref.current?.scrollHeight + 1) + 'px');
    }, []);

    const handleChange = (e) => {
        ref.current?.style.setProperty('height', '0');
        ref.current?.style.setProperty('height', (ref.current?.scrollHeight + 1) + 'px');
        prop.onChange(e, e.currentTarget.value);
    };

    return (
    <span className={css(styles.formControl)}>
        <textarea onChange={handleChange} placeholder={prop.placeholder} value={prop.value} ref={ref} style={{fontFamily: 'monospace', resize: 'vertical'}} />
    </span>
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
            status.indexOf('Killed') >= 0 ? 'red' :
            status.indexOf('DependencyFailed') >= 0 ? 'red' :
            'grey');

        return (<Label key={id} color={statusColor}>{task?.label}#{id}</Label>);
    };

    const dateStart = task.start ? new Date(Date.parse(task.start)) : null;
    const dateEnd = task.end ? new Date(Date.parse(task.end)) : null;

    const data : {[key : string] : React.ReactNode} = {};
    const actions : {[key : string] : ()=>void} = {};

    const dataPropertyTable = {
        label: { title: 'Label', priority: 0 },
        status: { title: 'Status', priority: 1 },
        command: { title: 'Command', priority: 2 },
        deps: { title: 'Dependencies', priority: 3 },
        time: { title: 'Time Elapsed', priority: 4 },
        dir: { title: 'Working Directory', priority: 5 },
        env: { title: 'Environments', priority: 6, boarden: true },
        logs: { title: 'Logs', priority: 7, boarden: true },
    };

    const actionsPropertyTable = {
        add: { title: 'Add', priority: 0, icon: <PlusCircleIcon/> },
        restart: { title: 'Restart', priority: 1, icon: <RedoIcon/> },
        kill: { title: 'Kill', priority: 2, icon: <TimesIcon/> },
        remove: { title: 'Remove', priority: 3, icon: <TrashIcon/> },
        edit: { title: 'Edit', priority: 4, icon: <EditIcon/> },
    };

    if (isEditable || isNew) {
        data.label = <TextInput placeholder='Label' {...bindForm('label')}/>;
        data.command = <TextArea placeholder='Command' {...bindForm('command')} autoReize/>;
        data.deps = <TextInput placeholder='Dependencies' {...bindForm('deps')}/>;
        data.time = <TextInput placeholder='Delay (e.g. 15s, 1d)' {...bindForm('delay')}/>;

        actions.add = async () => {
            await pueueManager.pueue('add', {
                label: form.label ? form.label : null,
                after: form.deps  ? form.deps.split(',') : [],
                delay: form.delay ? form.delay : null,
                group: group,
                working_directory: form.dir || groupDetail.dir || context.cwd,
            }, [form.command]).then(alertDone);
            if (!isNew)
                setIsEditable(false);
        };

        if (!isNew) {
            actions.restart = async ()=> {
                await pueueManager.pueue('restart', {in_place: true, stashed: true}, [id]).then(alertDone);
                await pueueManager.pueue_edit(id, {
                        'command': form.command,
                        'path': form.dir,
                        'label': form.label,
                    }).then(alertDone);
                await pueueManager.pueue('enqueue', form.delay ? {delay: form.delay} : {}, [id]).then(alertDone);
                setIsEditable(false);
            };

            actions.edit = ()=>setIsEditable(false);
        }
    }
    else {
        data.label = getLabel(id);
        data.command = task.command;
        data.deps = task.dependencies.map(getLabel);
        data.time = <Text style={{textWrap: 'nowrap'}}>{formatTime(dateStart)}&nbsp;&nbsp;<ArrowRightIcon/>&nbsp;&nbsp;{formatTime(dateEnd)}</Text>;

        data.status = unfoldStatus(task.status).join(' ');
        data.dir = task.path;

        data.env = Object.keys(envs).length == 0 ? (
            <Button size='sm' variant='secondary'
                onClick={()=>pueueManager.pueue('status', {json: true, group, __controller_remove_envs: false}).then((data) => setEnvs(data.tasks[id].envs))}
            >...</Button>
        ) : (
            <div className='envs-view'>
                <pre>
                    {Object.entries(envs).map(([k, v]) => `${k} = "${v}"`).join('\n')}
                </pre>
            </div>
        );

        data.logs = <LogView id={id}/>;

        actions.kill = ()=>pueueManager.pueue('kill', {}, [id]).then(alertDone);
        actions.remove = ()=>pueueManager.pueue('remove', {}, [id]).then(alertDone);
        actions.restart = ()=>pueueManager.pueue('restart', {in_place: true}, [id]).then(alertDone);
        actions.edit = () => {
            setForm({label: task.label, command: task.command, deps: task.dependencies.join(','), delay: '', dir: task.path});
            setIsEditable(true);
        }
    }

    const detailRow = (
        <Tr key='detail'>
            {!context.sm && <Td></Td>}
            <Td colSpan={5}>
                <ExpandableRowContent>
                    <DescriptionList isHorizontal termWidth='20ch' isCompact>
                    {
                        Object.keys(data)
                            .filter((k) => k != 'label')
                            .sort((k1, k2) => dataPropertyTable[k1].priority - dataPropertyTable[k2].priority)
                            .map((k) => (<>
                                <Desc name={dataPropertyTable[k].title} wrapOnSm={dataPropertyTable[k].boarden}>{data[k]}</Desc>
                            </>))
                    }
                    </DescriptionList>
                </ExpandableRowContent>
            </Td>
        </Tr>
    );

    const mainRow = (
        <Tr key={'main-' + id}>
            <Td expand={{ rowIndex: Number(id), isExpanded, onToggle: () => setIsExapnded((v) => !v), }} />
            { context.sm ? (
                <>
                    <Td>{data.label}</Td>
                    <ActionsColumn items={
                        Object.keys(actions)
                            .sort((k1, k2) => actionsPropertyTable[k1].priority - actionsPropertyTable[k2].priority)
                            .map((k) => { return { title: actionsPropertyTable[k].title, onClick: actions[k] }; })
                    } />
                </>
            ) : (
                <>
                    <Td>{data.label}</Td>
                    <Td>{data.command}</Td>
                    <Td>{data.deps}</Td>
                    <Td>{data.time}</Td>
                    <Td><ActionList isIconList>
                    { 
                        Object.keys(actions)
                            .sort((k1, k2) => actionsPropertyTable[k1].priority - actionsPropertyTable[k2].priority)
                            .map((k) => <ActionListItem><Button variant='plain' onClick={actions[k]}>{actionsPropertyTable[k].icon}</Button></ActionListItem>)
                    }
                    </ActionList></Td>
                </>
            )}
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

    const rows : React.ReactNode[] = Object.keys(context.tasks).map((id : string) => (<PueueTaskRow key={id} id={id} group={group} />));
    rows.push(<PueueTaskRow key='launch' id='launch' group={group} />);

    return (
    <Card>
    <CardBody>
        <DescriptionList isHorizontal termWidth='20ch' isCompact>
            <Desc name={'Group Name'}>{group}</Desc>
            <Desc name={'Status'}>
                {groupDetail.status}
            </Desc>
            <Desc name={'Opeartions'} wrapOnSm>
                <ActionList>
                    <ActionListItem>
                    <Button variant='tertiary' size='sm'
                        onClick={() =>
                            (groupDetail.status == 'Running') ? 
                                pueueManager.pueue('pause', {group}).then(alertDone).then(context.updateStatus) :
                                pueueManager.pueue('start', {group}).then(alertDone).then(context.updateStatus)
                        }
                    >
                        {groupDetail.status == 'Running' ? 'Pause' : 'Resume'}
                    </Button>
                    </ActionListItem>
                    <ActionListItem>
                    <Button variant='tertiary' size='sm'
                        onClick={() => pueueManager.pueue('clean', {group}).then(alertDone)}
                    >Clean</Button>{' '}
                    </ActionListItem>
                    <ActionListItem>
                    <Button variant='tertiary' size='sm'
                        onClick={() => pueueManager.pueue(['group', 'delete'], {}, [group]).then(alertDone)}
                    >Delete</Button>
                    </ActionListItem>
                </ActionList>
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
            <Desc name={'Working Directory'} wrapOnSm>
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
        <InnerScrollContainer>
            <Table variant='compact' gridBreakPoint=''>
                { !context.sm && <Thead>
                    <Tr>
                        <Th aria-label="expand"></Th>
                        <Th width={10} style={{minWidth: 120}}>Label</Th>
                        <Th width={40} style={{minWidth: 400}}>Command</Th>
                        <Th width={10} style={{minWidth: 120}}>Dependencies</Th>
                        <Th width={10}>Timing</Th>
                        <Th width={10} aria-label="actions"></Th>
                    </Tr>
                </Thead> }
                {rows}
            </Table>
        </InnerScrollContainer>
    </CardBody>
    </Card>
    );
};

function isSmall() {
    return ['sm', 'default'].indexOf(getBreakpoint(window.innerWidth)) >= 0;
}

export const PueueView = ({ followGlobalDark, children } : { followGlobalDark : boolean, children : React.ReactNode }) => {
    const [ currentGroup, setCurrentGroup ] = React.useState<string>('default');
    const [ groups, setGroups ] = React.useState<{[id : string] : PueueGroup}>({});
    const [ tasks, setTasks ] = React.useState<{[id : string] : PueueTask}>({});
    const [ meta, setMeta ] = React.useState<PueueMeta>({cwd: ''});
    const [ alerts, setAlerts ] = React.useState<{[id : string] : { id: number, title: string, body: string, variant: string }}>({counter: { id: 0, title: '', body: '', variant: ''}});

    // UI
    const [ dark, setDark ] = React.useState<boolean>(true);
    const [ sm, setSm ] = React.useState(isSmall());

    const currentContext = new PueueContext();
    currentContext.tasks = structuredClone(tasks);
    currentContext.groups = structuredClone(groups);
    currentContext.cwd = meta.cwd;
    currentContext.sm = sm;

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
        const onResize = ()=>setSm(isSmall());
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        }
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

    React.useEffect(() => {
        if (!followGlobalDark)
            document.documentElement.className = dark ? 'pf-v5-theme-dark' : '';
    }, [dark]);

    const groupTabs = Object.keys(groups).map((group) => (
        <Tab key={group} eventKey={group} title={group}>
            { currentGroup == group ? <PueueGroupTable group={group}/> : <></> }
        </Tab>
    ));

    const OptionalCard = sm ? React.Fragment : Card;
    const OptionalCardBody = sm ? React.Fragment : CardBody;

    return (
    <PueueContextProvider value={currentContext}>
        {children}
        <OptionalCard key='main-view'>
            <OptionalCardBody>
                { followGlobalDark ? <></> : (
                    <div style={{textAlign: 'right', paddingBottom: 10}}>
                        <Switch id='dark_mode' label='Dark Mode' labelOff='Light Mode' isChecked={dark} isReversed onChange={(_, b)=>setDark(b)} />
                    </div>
                )}
                <Tabs
                    isBox
                    activeKey={currentGroup}
                    onSelect={(_, k) => setCurrentGroup(k as string)}
                >{groupTabs}</Tabs>
            </OptionalCardBody>
        </OptionalCard>
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

